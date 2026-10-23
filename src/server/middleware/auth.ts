import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppEnv, AuthContext, AuthUser, Env } from '../env';
import { customerScope, effectivePermissions } from '@shared/permissions';
import { forbidden, unauthorized } from '../lib/http';
import { readSessionCookie, resolveSession } from '../lib/session';
import { AGENT_PERMISSIONS, AGENT_SCOPE_PERMISSIONS } from '@shared/agent';
import { AGENT_TOKEN_PREFIX, hashAgentToken } from '../lib/agentToken';
import { delegatedPathAllowed, loadDelegation } from '../lib/delegation';
import { auditStatement } from '../lib/audit';

type Jwks = ReturnType<typeof createRemoteJWKSet>;
const jwksCache = new Map<string, Jwks>();

function getJwks(teamDomain: string): Jwks {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Ba cách xác định người dùng, xét theo thứ tự:
 *   1. Phiên đăng nhập bằng mật khẩu (cookie HttpOnly) - dùng khi chưa có tên miền cho Access.
 *   2. Cloudflare Access JWT - dùng khi đã gắn crm.<tên miền> và bật Zero Trust.
 *   3. Header X-Dev-Email - CHỈ chấp nhận khi chạy máy lập trình (ENVIRONMENT=development).
 */
export async function resolveEmail(env: Env, headers: Headers): Promise<string> {
  const jwt = headers.get('Cf-Access-Jwt-Assertion');
  if (jwt && env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    try {
      const { payload } = await jwtVerify(jwt, getJwks(env.ACCESS_TEAM_DOMAIN), {
        audience: env.ACCESS_AUD,
        issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      });
      const email = (payload.email as string | undefined) ?? (payload.sub as string | undefined);
      if (!email) throw unauthorized('Token Access không chứa email');
      return email.toLowerCase();
    } catch {
      throw unauthorized('Token Cloudflare Access không hợp lệ');
    }
  }

  const devAuth = env.DEV_AUTH_ENABLED === 'true' && env.ENVIRONMENT === 'development';
  if (devAuth) {
    const devEmail = headers.get('X-Dev-Email');
    if (devEmail) return devEmail.trim().toLowerCase();
  }

  throw unauthorized('Chưa đăng nhập');
}

/**
 * Phạm vi dữ liệu: theo vai trò, nhưng ai được cấp quyền xem công nợ toàn công ty
 * (ví dụ kế toán) thì phải nhìn được mọi khách, không chỉ khách của mình.
 */
function scopeFor(role: AuthUser['role'], permissions: string[]) {
  if (permissions.includes('debt.read.all') || permissions.includes('customer.read.all')) return 'ALL';
  if (permissions.includes('debt.read.team') || permissions.includes('customer.read.team')) return 'TEAM';
  return customerScope(role);
}

/** Quyền cấp thêm cho riêng tài khoản (gói Kế toán chẳng hạn). */
export async function loadExtraPermissions(db: D1Database, userId: string): Promise<string[]> {
  const rows = await db
    .prepare('SELECT permission FROM user_permissions WHERE user_id = ?')
    .bind(userId)
    .all<{ permission: string }>();
  return (rows.results ?? []).map((r) => r.permission);
}

export async function loadUserByEmail(db: D1Database, email: string): Promise<AuthUser> {
  const user = await db
    .prepare(
      `SELECT id, email, display_name, role, status, must_change_password FROM users
       WHERE lower(email) = lower(?) AND deleted_at IS NULL AND kind = 'HUMAN'`,
    )
    .bind(email)
    .first<AuthUser & { must_change_password: number }>();

  if (!user) {
    throw forbidden('Email đã xác thực nhưng chưa được cấp tài khoản trong CRM. Liên hệ quản trị.');
  }
  if (user.status !== 'ACTIVE') {
    throw forbidden('Tài khoản đang bị khoá.');
  }
  return user;
}

/** Tài khoản đang bị bắt đổi mật khẩu chỉ gọi được /api/me (và /api/auth/*) cho tới khi đổi xong. */
function assertPasswordChanged(c: { req: { url: string } }, user: { must_change_password?: number }): void {
  if (user.must_change_password !== 1) return;
  const path = new URL(c.req.url).pathname;
  if (path === '/api/me') return;
  throw forbidden('Bạn cần đổi mật khẩu trước khi dùng. Vào vanhanh.ailla.vn, đổi mật khẩu rồi mở lại trang này.');
}

/**
 * AI agent vào bằng khóa riêng (Authorization: Bearer agt_...). Quyền của agent CHỈ là các quyền cấp riêng cho
 * nó (agent.read, agent.propose), không bao giờ theo vai trò; và chỉ được gọi /api/agent/*.
 */
async function resolveAgentAuth(
  c: { env: Env; req: { header: (n: string) => string | undefined; url: string; method: string } },
): Promise<AuthContext | null> {
  const header = c.req.header('Authorization') ?? '';
  if (!header.startsWith('Bearer ' + AGENT_TOKEN_PREFIX)) return null;
  const hash = await hashAgentToken(header.slice('Bearer '.length).trim());
  const row = await c.env.DB.prepare(
    `SELECT a.id, a.status AS agent_status, a.last_used_at, u.email, u.display_name, u.status AS user_status
     FROM agents a JOIN users u ON u.id = a.id
     WHERE a.token_hash = ? AND u.deleted_at IS NULL`,
  )
    .bind(hash)
    .first<{
      id: string;
      agent_status: string;
      last_used_at: string | null;
      email: string;
      display_name: string;
      user_status: string;
    }>();
  if (!row || row.agent_status !== 'ACTIVE' || row.user_status !== 'ACTIVE') {
    throw unauthorized('Khóa agent không đúng hoặc đã bị khóa');
  }
  const path = new URL(c.req.url).pathname;
  const dlg = c.req.header('X-Delegation');
  if (dlg) return resolveDelegated(c, row, dlg, path);
  if (!path.startsWith('/api/agent/')) throw forbidden('Agent chỉ được dùng các đường dẫn /api/agent/*');
  const now = new Date();
  // Chỉ ghi lần dùng cuối khi đã cũ hơn 5 phút để mỗi lần gọi không tốn một lượt ghi.
  if (!row.last_used_at || now.getTime() - new Date(row.last_used_at).getTime() > 300_000) {
    await c.env.DB.prepare('UPDATE agents SET last_used_at = ? WHERE id = ?').bind(now.toISOString(), row.id).run();
  }
  const extra = await loadExtraPermissions(c.env.DB, row.id);
  return {
    user: {
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    },
    scope: 'ALL',
    permissions: extra.filter(
      (p) => (AGENT_PERMISSIONS as readonly string[]).includes(p) || AGENT_SCOPE_PERMISSIONS.includes(p),
    ),
    actorType: 'AGENT',
  };
}

/**
 * Agent ghi dữ liệu thay người: cần quyền 'agent.act' + giấy ủy quyền (X-Delegation) sinh ra khi CHÍNH người được chỉ định
 * vừa ra lệnh cho agent này qua web. Từ đó yêu cầu chạy với đúng quyền của người đó, chỉ trong danh sách đường dẫn cho phép,
 * không xóa cứng, tối đa vài chục lần ghi mỗi giấy; mọi lần ghi đều có dòng nhật ký riêng.
 */
async function resolveDelegated(
  c: { env: Env; req: { method: string } },
  agent: { id: string; email: string; display_name: string },
  token: string,
  path: string,
): Promise<AuthContext> {
  const method = c.req.method.toUpperCase();
  const own = await loadExtraPermissions(c.env.DB, agent.id);
  if (!own.includes('agent.act')) throw forbidden('Agent này chưa được cấp quyền ghi dữ liệu');
  const d = await loadDelegation(c.env.DB, token, agent.id);
  if (!d) throw forbidden('Không có lệnh của người được chỉ định (hoặc đã hết hạn). Chỉ ghi được khi người đó vừa nhắn agent trên web Điều hành agent.');
  if (!delegatedPathAllowed(method, path)) throw forbidden('Agent chưa được phép thao tác này');
  if (method !== 'GET') {
    const r = await c.env.DB.prepare('UPDATE agent_delegations SET uses = uses + 1 WHERE token_hash = ? AND uses < max_uses AND expires_at > ?')
      .bind(d.token_hash, new Date().toISOString())
      .run();
    if (!r.meta.changes) throw forbidden('Lệnh này đã dùng hết số lần ghi cho phép; nhờ người ra lệnh nhắn lại');
  }
  const u = await c.env.DB
    .prepare("SELECT id, email, display_name, role, status FROM users WHERE id = ? AND deleted_at IS NULL AND kind = 'HUMAN'")
    .bind(d.user_id)
    .first<AuthUser>();
  if (!u || u.status !== 'ACTIVE') throw forbidden('Người ra lệnh không còn hoạt động');
  const extra = await loadExtraPermissions(c.env.DB, u.id);
  const permissions = effectivePermissions(u.role as AuthUser['role'], extra);
  return {
    user: { id: u.id, email: u.email, display_name: u.display_name, role: u.role as AuthUser['role'], status: u.status },
    scope: scopeFor(u.role as AuthUser['role'], permissions),
    permissions,
    actorType: 'AGENT',
    delegation: { agentId: agent.id, agentName: agent.display_name },
  };
}

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const agentAuth = await resolveAgentAuth(c);
  if (agentAuth) {
    c.set('auth', agentAuth);
    await next();
    if (agentAuth.delegation && c.req.method !== 'GET') {
      // Nhật ký riêng: agent nào, thay ai, làm gì, kết quả ra sao.
      await auditStatement(c.env.DB, {
        actorId: agentAuth.delegation.agentId,
        actorType: 'AGENT',
        action: 'AGENT_ACT',
        entityType: 'AGENT',
        entityId: new URL(c.req.url).pathname,
        after: { method: c.req.method, status: c.res.status, on_behalf_of: agentAuth.user.display_name },
        result: c.res.status < 400 ? 'OK' : 'FAILED',
        requestId: c.get('requestId'),
        ip: c.req.header('CF-Connecting-IP') ?? null,
      }).run();
    }
    return;
  }
  const token = readSessionCookie(c.req.raw.headers);
  if (token) {
    const session = await resolveSession(c.env.DB, token);
    if (session) {
      if (session.status !== 'ACTIVE') throw forbidden('Tài khoản đang bị khoá.');
      assertPasswordChanged(c, session);
      const extra = await loadExtraPermissions(c.env.DB, session.id);
      const role = session.role as AuthUser['role'];
      c.set('auth', {
        user: {
          id: session.id,
          email: session.email,
          display_name: session.display_name,
          role,
          status: session.status,
          must_change_password: session.must_change_password,
        },
        scope: scopeFor(role, effectivePermissions(role, extra)),
        permissions: effectivePermissions(role, extra),
      });
      await next();
      return;
    }
  }

  const email = await resolveEmail(c.env, c.req.raw.headers);
  const user = await loadUserByEmail(c.env.DB, email);
  assertPasswordChanged(c, user);
  const extra = await loadExtraPermissions(c.env.DB, user.id);
  c.set('auth', {
    user,
    scope: scopeFor(user.role, effectivePermissions(user.role, extra)),
    permissions: effectivePermissions(user.role, extra),
  });
  await next();
};

/**
 * Middleware mềm: có danh tính thì gắn vào context, không có cũng cho đi tiếp.
 * Dùng cho các endpoint như /api/auth/change-password khi cần biết ai đang gọi.
 */
export const optionalAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = readSessionCookie(c.req.raw.headers);
  if (token) {
    const session = await resolveSession(c.env.DB, token);
    if (session && session.status === 'ACTIVE') {
      const role = session.role as AuthUser['role'];
      c.set('auth', {
        user: {
          id: session.id,
          email: session.email,
          display_name: session.display_name,
          role,
          status: session.status,
          must_change_password: session.must_change_password,
        },
        scope: customerScope(role),
        permissions: effectivePermissions(role, await loadExtraPermissions(c.env.DB, session.id)),
      });
    }
  }
  await next();
};

import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppEnv, AuthUser, Env } from '../env';
import { customerScope, effectivePermissions } from '@shared/permissions';
import { forbidden, unauthorized } from '../lib/http';
import { readSessionCookie, resolveSession } from '../lib/session';

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
       WHERE lower(email) = lower(?) AND deleted_at IS NULL`,
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

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = readSessionCookie(c.req.raw.headers);
  if (token) {
    const session = await resolveSession(c.env.DB, token);
    if (session) {
      if (session.status !== 'ACTIVE') throw forbidden('Tài khoản đang bị khoá.');
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

import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso } from '@shared/datetime';
import { zodFieldErrors } from '@shared/schemas';
import { AGENT_PHIEU_CHI, AGENT_SCOPES, AGENT_SCOPE_LABELS, AGENT_SCOPE_PREFIX } from '@shared/agent';
import { AGENT_IDS, AGENT_ROSTER } from '@shared/agentRoster';
import type { Role } from '@shared/enums';
import { effectivePermissions } from '@shared/permissions';
import type { AppEnv } from '../env';
import { auditStatement } from '../lib/audit';
import { generateAgentToken, hashAgentToken, tokenHint } from '../lib/agentToken';
import { forbidden, notFound, ok, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { requirePermission } from '../middleware/rbac';

/**
 * Quản lý tài khoản agent (chỉ CEO, trên địa chỉ quản trị): tạo agent, đổi khóa, khóa/mở.
 * Khóa gốc chỉ hiện đúng một lần trong kết quả tạo/đổi khóa; hệ thống chỉ giữ bản băm.
 */
export const agentAdminRoutes = new Hono<AppEnv>();

agentAdminRoutes.use('*', requirePermission('user.manage'));
agentAdminRoutes.use('*', async (c, next) => {
  if (c.get('auth').user.role !== 'CEO') throw forbidden('Chỉ chủ doanh nghiệp được quản lý agent.');
  await next();
});

agentAdminRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT a.id, a.name, a.purpose, a.status, a.token_hint, a.last_used_at, a.created_at, a.rotated_at,
            (SELECT COUNT(*) FROM user_permissions up WHERE up.user_id = a.id AND up.permission = 'agent.propose') AS can_propose,
            (SELECT COUNT(*) FROM user_permissions up WHERE up.user_id = a.id AND up.permission = 'agent.act') AS can_act,
            (SELECT COUNT(*) FROM user_permissions up WHERE up.user_id = a.id AND up.permission = '${AGENT_PHIEU_CHI}') AS can_phieuchi,
            (SELECT group_concat(u.display_name, ', ') FROM agent_delegators g JOIN users u ON u.id = g.user_id WHERE g.agent_id = a.id) AS delegators,
            (SELECT group_concat(g.user_id, ',') FROM agent_delegators g WHERE g.agent_id = a.id) AS delegator_ids,
            (SELECT g.chat_agent FROM agent_delegators g WHERE g.agent_id = a.id LIMIT 1) AS chat_agent,
            (SELECT group_concat(substr(up.permission, ${AGENT_SCOPE_PREFIX.length + 1}), ',') FROM user_permissions up
              WHERE up.user_id = a.id AND up.permission LIKE '${AGENT_SCOPE_PREFIX}%') AS scopes
     FROM agents a ORDER BY a.created_at DESC`,
  ).all<Record<string, unknown>>();
  return ok(
    c,
    (rows.results ?? []).map((r) => ({
      ...r,
      chat_agent: r.chat_agent ?? rosterIdByName(String(r.name ?? '')),
      scopes: r.scopes ? String(r.scopes).split(',') : [],
      delegator_ids: r.delegator_ids ? String(r.delegator_ids).split(',') : [],
    })),
    { all_scopes: AGENT_SCOPES, scope_labels: AGENT_SCOPE_LABELS },
  );
});

const createSchema = z.object({
  name: z.string().trim().min(2, 'Đặt tên agent (ít nhất 2 ký tự)').max(80),
  purpose: z.string().trim().max(300).optional().nullable(),
  can_propose: z.boolean().optional(),
  scopes: z.array(z.enum(AGENT_SCOPES)).optional(),
});

agentAdminRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const id = newId();
  const now = nowIso();
  const token = generateAgentToken();
  const hash = await hashAgentToken(token);
  const input = parsed.data;
  const statements = [
    c.env.DB.prepare(
      `INSERT INTO users (id, email, display_name, role, status, kind, created_at, updated_at)
       VALUES (?, ?, ?, 'EMPLOYEE', 'ACTIVE', 'AGENT', ?, ?)`,
    ).bind(id, `agent-${id.slice(0, 8)}@agents.ailla.local`, `Agent · ${input.name}`, now, now),
    c.env.DB.prepare(
      `INSERT INTO agents (id, name, purpose, token_hash, token_hint, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    ).bind(id, input.name, input.purpose ?? '', hash, tokenHint(token), auth.user.id, now),
    c.env.DB.prepare(
      `INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, 'agent.read', ?, ?)`,
    ).bind(id, auth.user.id, now),
  ];
  if (input.can_propose !== false) {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, 'agent.propose', ?, ?)`,
      ).bind(id, auth.user.id, now),
    );
  }
  for (const sc of new Set(input.scopes ?? [])) {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)`,
      ).bind(id, AGENT_SCOPE_PREFIX + sc, auth.user.id, now),
    );
  }
  statements.push(
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'AGENT_CREATED',
      entityType: 'AGENT',
      entityId: id,
      after: { name: input.name, can_propose: input.can_propose !== false },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  );
  await c.env.DB.batch(statements);
  return ok(c, { id, name: input.name, token }, undefined, 201);
});

agentAdminRoutes.post('/:id/rotate', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const exists = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ?').bind(id).first();
  if (!exists) throw notFound('Không tìm thấy agent');
  const token = generateAgentToken();
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE agents SET token_hash = ?, token_hint = ?, rotated_at = ? WHERE id = ?').bind(
      await hashAgentToken(token),
      tokenHint(token),
      now,
      id,
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'AGENT_TOKEN_ROTATED',
      entityType: 'AGENT',
      entityId: id,
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  return ok(c, { id, token });
});

agentAdminRoutes.post('/:id/status', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
  const enabled = body.enabled !== false;
  const exists = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ?').bind(id).first();
  if (!exists) throw notFound('Không tìm thấy agent');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE agents SET status = ? WHERE id = ?').bind(enabled ? 'ACTIVE' : 'DISABLED', id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: enabled ? 'AGENT_ENABLED' : 'AGENT_DISABLED',
      entityType: 'AGENT',
      entityId: id,
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  return ok(c, { id, enabled });
});

/** Đặt lại phạm vi đọc của một agent (thay toàn bộ danh sách). */
const scopesSchema = z.object({ scopes: z.array(z.enum(AGENT_SCOPES)) });
agentAdminRoutes.put('/:id/scopes', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const parsed = scopesSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Phạm vi không hợp lệ', zodFieldErrors(parsed.error));
  }
  const exists = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ?').bind(id).first();
  if (!exists) throw notFound('Không tìm thấy agent');
  const now = nowIso();
  const keep = [...new Set(parsed.data.scopes)];
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM user_permissions WHERE user_id = ? AND permission LIKE '${AGENT_SCOPE_PREFIX}%'`).bind(id),
    ...keep.map((sc) =>
      c.env.DB.prepare(
        `INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)`,
      ).bind(id, AGENT_SCOPE_PREFIX + sc, auth.user.id, now),
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'AGENT_SCOPES_SET',
      entityType: 'AGENT',
      entityId: id,
      after: { scopes: keep },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  return ok(c, { id, scopes: keep });
});

/** Công tắc "agent được lập phiếu chi khi người được chỉ định ra lệnh" (chị Hoa đồng ý 27/10/2026; mặc định bật cho Kế toán trưởng). */
agentAdminRoutes.post('/:id/phieuchi', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const enabled = ((await c.req.json().catch(() => ({}))) as { enabled?: boolean }).enabled === true;
  const exists = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ?').bind(id).first();
  if (!exists) throw notFound('Không tìm thấy agent');
  await c.env.DB.batch([
    enabled
      ? c.env.DB.prepare('INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(id, AGENT_PHIEU_CHI, auth.user.id, nowIso())
      : c.env.DB.prepare('DELETE FROM user_permissions WHERE user_id = ? AND permission = ?').bind(id, AGENT_PHIEU_CHI),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: enabled ? 'AGENT_PHIEU_CHI_ON' : 'AGENT_PHIEU_CHI_OFF',
      entityType: 'AGENT',
      entityId: id,
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  return ok(c, { id, can_phieuchi: enabled });
});

/** Tài khoản agent chưa gắn agent nào trên trang Điều hành agent: ghép theo tên ("Kế toán trưởng" → ke-toan-truong-ailla). */
const normName = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/^agent\s*·\s*/, '').replace(/[^a-z0-9]/g, '');
function rosterIdByName(name: string): string | null {
  const n = normName(name);
  return n ? (AGENT_ROSTER.find((a) => normName(a.name) === n)?.id ?? null) : null;
}

/** Người có thể được chỉ định ra lệnh ghi cho agent: nhân sự đang làm, có vai kế toán / điều phối (khớp rào ở agentSpend). */
async function delegatorCandidates(db: D1Database) {
  const rows = await db
    .prepare(
      `SELECT u.id, u.display_name, u.role, (SELECT group_concat(p.permission, ',') FROM user_permissions p WHERE p.user_id = u.id) AS extra
       FROM users u WHERE u.kind = 'HUMAN' AND u.status = 'ACTIVE' AND u.deleted_at IS NULL AND u.role <> 'CEO' ORDER BY u.display_name`,
    )
    .all<{ id: string; display_name: string; role: Role; extra: string | null }>();
  return (rows.results ?? [])
    .filter((u) => {
      const p = effectivePermissions(u.role, u.extra ? u.extra.split(',') : []);
      return p.includes('order.accounting.confirm') || p.includes('order.approve.normal');
    })
    .map((u) => ({ id: u.id, display_name: u.display_name }));
}

agentAdminRoutes.get('/delegator-candidates', async (c) => ok(c, await delegatorCandidates(c.env.DB)));

/**
 * Chị Hoa chọn ai được ra lệnh ghi cho agent (lập phiếu chi...). Người được chọn cũng được nhắn agent đó trên web Điều hành agent.
 * Giữ nguyên số Telegram đã gắn của người cũ; người bỏ chọn thì mất quyền ra lệnh (giấy ủy quyền cũ hết hiệu lực vì phải khớp bảng này).
 */
agentAdminRoutes.put('/:id/delegators', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const b = (await c.req.json().catch(() => ({}))) as { user_ids?: string[]; chat_agent?: string };
  const exists = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ?').bind(id).first();
  if (!exists) throw notFound('Không tìm thấy agent');
  const cur = await c.env.DB.prepare('SELECT chat_agent FROM agent_delegators WHERE agent_id = ? LIMIT 1').bind(id).first<{ chat_agent: string }>();
  const nm = await c.env.DB.prepare('SELECT name FROM agents WHERE id = ?').bind(id).first<{ name: string }>();
  const chatAgent = cur?.chat_agent ?? (String(b.chat_agent ?? '') || rosterIdByName(nm?.name ?? '') || '');
  if (!AGENT_IDS.includes(chatAgent)) throw unprocessable('NEED_CHAT_AGENT', 'Chọn agent trên trang Điều hành agent ứng với tài khoản này', { chat_agent: 'Bắt buộc' });
  const allowed = new Set((await delegatorCandidates(c.env.DB)).map((u) => u.id));
  const want = [...new Set((b.user_ids ?? []).map(String))];
  const bad = want.filter((u) => !allowed.has(u));
  if (bad.length) throw unprocessable('NOT_ACCOUNTANT', 'Chỉ chọn được người có vai kế toán hoặc điều phối', { user_ids: bad.join(',') });
  const now = nowIso();
  const keep = want.length ? `AND user_id NOT IN (${want.map(() => '?').join(',')})` : '';
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM agent_delegators WHERE agent_id = ? ${keep}`).bind(id, ...want),
    ...want.flatMap((u) => [
      c.env.DB.prepare('INSERT OR IGNORE INTO agent_delegators (agent_id, chat_agent, user_id, granted_by, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, chatAgent, u, auth.user.id, now),
      c.env.DB.prepare('INSERT OR IGNORE INTO agent_chat_access (user_id, agent, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(u, chatAgent, auth.user.id, now),
    ]),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'AGENT_DELEGATORS_SET',
      entityType: 'AGENT',
      entityId: id,
      requestId: c.get('requestId'),
      after: { chat_agent: chatAgent, user_ids: want },
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  return ok(c, { id, chat_agent: chatAgent, user_ids: want });
});

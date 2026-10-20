import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso } from '@shared/datetime';
import { zodFieldErrors } from '@shared/schemas';
import { AGENT_SCOPES, AGENT_SCOPE_LABELS, AGENT_SCOPE_PREFIX } from '@shared/agent';
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
            (SELECT group_concat(substr(up.permission, ${AGENT_SCOPE_PREFIX.length + 1}), ',') FROM user_permissions up
              WHERE up.user_id = a.id AND up.permission LIKE '${AGENT_SCOPE_PREFIX}%') AS scopes
     FROM agents a ORDER BY a.created_at DESC`,
  ).all<Record<string, unknown>>();
  return ok(
    c,
    (rows.results ?? []).map((r) => ({ ...r, scopes: r.scopes ? String(r.scopes).split(',') : [] })),
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

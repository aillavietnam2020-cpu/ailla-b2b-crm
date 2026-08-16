import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { nowIso } from '@shared/datetime';
import { auditStatement } from '../lib/audit';
import { badRequest, ok } from '../lib/http';
import { ROLE_PERMISSIONS } from '@shared/permissions';
import { listAlerts, syncAlerts } from '../services/alerts';
import { loadConfig } from '../lib/settings';
import { requirePermission } from '../middleware/rbac';

export const coreRoutes = new Hono<AppEnv>();

coreRoutes.get('/me', (c) => {
  const auth = c.get('auth');
  return ok(c, {
    user: auth.user,
    scope: auth.scope,
    permissions: [...ROLE_PERMISSIONS[auth.user.role]],
    environment: c.env.ENVIRONMENT,
  });
});

/** Danh sách nhân viên để lọc/phân công. Nhân viên chỉ thấy chính mình. */
coreRoutes.get('/users', async (c) => {
  const auth = c.get('auth');
  if (auth.user.role === 'EMPLOYEE') {
    return ok(c, [{ id: auth.user.id, display_name: auth.user.display_name, role: auth.user.role }]);
  }
  const rows = await c.env.DB.prepare(
    `SELECT id, display_name, role, legacy_name FROM users
     WHERE status = 'ACTIVE' AND deleted_at IS NULL ORDER BY role, display_name`,
  ).all();
  return ok(c, rows.results ?? []);
});

coreRoutes.get('/tiers', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT id, code, name, rank, debt_limit FROM price_tiers ORDER BY rank',
  ).all();
  return ok(c, rows.results ?? []);
});

coreRoutes.get('/alerts', async (c) => {
  const auth = c.get('auth');
  const ownerId = auth.scope === 'OWN' ? auth.user.id : undefined;
  return ok(c, await listAlerts(c.env.DB, { ownerId, limit: 100 }));
});

/** Chạy lại toàn bộ rule cảnh báo (cron mỗi giờ cũng gọi hàm này). */
coreRoutes.post('/alerts/refresh', requirePermission('dashboard.manager'), async (c) => {
  const config = await loadConfig(c.env.DB);
  return ok(c, await syncAlerts(c.env.DB, config));
});

/** Cấu hình vận hành: ngưỡng duyệt giá, tỷ lệ thưởng, thời gian khoá đăng nhập... */
coreRoutes.get('/settings', requirePermission('dashboard.manager'), async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT key, value_json, version, updated_at FROM app_settings ORDER BY key',
  ).all();
  return ok(c, { items: rows.results ?? [], config: await loadConfig(c.env.DB) });
});

coreRoutes.patch('/settings', requirePermission('settings.manage'), async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const entries = Object.entries(body);
  if (entries.length === 0) throw badRequest('EMPTY_UPDATE', 'Không có thiết lập nào để cập nhật');

  const now = nowIso();
  const statements = entries.flatMap(([key, value]) => [
    c.env.DB.prepare(
      `INSERT INTO app_settings (key, value_json, version, updated_by, updated_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json,
         version = version + 1, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    ).bind(key, JSON.stringify(value), auth.user.id, now),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'SETTING_UPDATED',
      entityType: 'APP_SETTING',
      entityId: key,
      after: { value: value },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  await c.env.DB.batch(statements);
  return ok(c, { config: await loadConfig(c.env.DB) });
});

coreRoutes.get('/audit', requirePermission('audit.read.own'), async (c) => {
  const auth = c.get('auth');
  const entityType = c.req.query('entity_type') ?? null;
  const entityId = c.req.query('entity_id') ?? null;
  const params: unknown[] = [];
  const where: string[] = ['1=1'];

  // Nhân viên chỉ xem thao tác của chính mình (mục 4).
  if (auth.user.role === 'EMPLOYEE') {
    where.push('a.actor_id = ?');
    params.push(auth.user.id);
  }
  if (entityType) {
    where.push('a.entity_type = ?');
    params.push(entityType);
  }
  if (entityId) {
    where.push('a.entity_id = ?');
    params.push(entityId);
  }

  const rows = await c.env.DB.prepare(
    `SELECT a.id, a.actor_id, u.display_name AS actor_name, a.action, a.entity_type, a.entity_id,
            a.before_json, a.after_json, a.reason, a.ip, a.request_id, a.created_at
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.created_at DESC LIMIT 200`,
  )
    .bind(...params)
    .all();
  return ok(c, rows.results ?? []);
});

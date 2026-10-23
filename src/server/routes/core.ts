import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { nowIso } from '@shared/datetime';
import { auditStatement } from '../lib/audit';
import { badRequest, ok } from '../lib/http';
import { listAlerts, syncAlerts } from '../services/alerts';
import { loadConfig } from '../lib/settings';
import { requirePermission } from '../middleware/rbac';
import { adminOnlyEndpoint } from '../middleware/adminHost';
import { allowedAgents } from './agentChat';

export const coreRoutes = new Hono<AppEnv>();

coreRoutes.get('/me', async (c) => {
  const auth = c.get('auth');
  return ok(c, {
    // Agent mà người này được nhắn trên trang Điều hành agent (rỗng thì không hiện mục đó).
    agent_chat: await allowedAgents(c.env.DB, auth.user),
    user: auth.user,
    scope: auth.scope,
    // Quyền theo vai trò CỘNG quyền cấp thêm (gói Kế toán), nếu không giao diện sẽ ẩn
    // mất các nút mà backend thực tế cho phép.
    permissions: auth.permissions,
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
     WHERE status = 'ACTIVE' AND deleted_at IS NULL AND kind = 'HUMAN' ORDER BY role, display_name`,
  ).all();
  return ok(c, rows.results ?? []);
});

coreRoutes.get('/tiers', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT t.id, t.code, t.name, t.rank, t.debt_limit, COALESCE(r.min_order_amount, 0) AS min_order_amount
     FROM price_tiers t LEFT JOIN tier_upgrade_rules r ON r.tier_id = t.id ORDER BY t.rank`,
  ).all();
  return ok(c, rows.results ?? []);
});

/** Điều kiện lên cấp: tiền hàng tối thiểu của một đơn để sale tự đưa khách lên cấp này (0 = chưa đặt, sale phải xin duyệt). */
coreRoutes.put('/tiers/:id/upgrade-rule', adminOnlyEndpoint, requirePermission('customer.tier.change'), async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => null)) as { min_order_amount?: unknown } | null;
  const amount = Math.round(Number(body?.min_order_amount ?? NaN));
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000_000) {
    throw badRequest('BAD_AMOUNT', 'Số tiền không hợp lệ (từ 0 trở lên, tính bằng đồng).');
  }
  const tier = await c.env.DB.prepare('SELECT id, name FROM price_tiers WHERE id = ?').bind(c.req.param('id')).first<{ id: string; name: string }>();
  if (!tier) throw badRequest('NO_TIER', 'Không tìm thấy cấp giá.');
  const before = await c.env.DB.prepare('SELECT min_order_amount FROM tier_upgrade_rules WHERE tier_id = ?').bind(tier.id).first<{ min_order_amount: number }>();
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO tier_upgrade_rules (tier_id, min_order_amount, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (tier_id) DO UPDATE SET min_order_amount = excluded.min_order_amount, updated_at = excluded.updated_at`,
      )
      .bind(tier.id, amount, nowIso()),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'TIER_RULE_CHANGED',
      entityType: 'PRICE_TIER',
      entityId: tier.id,
      before: { min_order_amount: before?.min_order_amount ?? 0 },
      after: { min_order_amount: amount, tier: tier.name },
      requestId: c.get('requestId'),
      ip: null,
    }),
  ]);
  return ok(c, { tier_id: tier.id, min_order_amount: amount });
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

coreRoutes.patch('/settings', adminOnlyEndpoint, requirePermission('settings.manage'), async (c) => {
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
  // Mặc định ẩn các dòng "đọc dữ liệu" (mỗi lần mở web là một dòng), chỉ hiện việc sửa / thêm / xóa / duyệt.
  if (c.req.query('include_reads') !== '1') {
    where.push("a.action NOT LIKE '%_READ'");
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

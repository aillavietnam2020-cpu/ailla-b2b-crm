import { Hono } from 'hono';
import type { AppEnv, AuthContext } from '../env';
import { forbidden, ok } from '../lib/http';
import { requirePermission } from '../middleware/rbac';

/**
 * Phòng điều hành (trang quản trị): số liệu chỉ đọc để so giá bán với giá thành theo giá nguyên liệu mới nhất.
 * Chỉ CEO và kế toán. Không ghi gì.
 */
export const dieuhanhRoutes = new Hono<AppEnv>();
dieuhanhRoutes.use('*', requirePermission('hub.access'));

const canMoney = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('debt.read.all');

/** Số đơn đã xuất kho theo kênh sàn và ngày (đơn Poscake web tự kéo về mỗi sáng), để tạm tính tháng chưa chốt. */
dieuhanhRoutes.get('/channel-orders', async (c) => {
  if (!canMoney(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem');
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return ok(c, []);
  const r = await c.env.DB.prepare(
    `SELECT channel, day, COUNT(DISTINCT order_id) AS orders FROM channel_order_lines
     WHERE day BETWEEN ? AND ? GROUP BY channel, day ORDER BY day`,
  )
    .bind(from, to)
    .all();
  return ok(c, r.results ?? []);
});

/** Giá bán đang áp dụng: bảng giá theo cấp (mới nhất mỗi sản phẩm × cấp) và giá riêng từng khách (gia công). */
dieuhanhRoutes.get('/sell-prices', async (c) => {
  if (!canMoney(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem giá bán so với giá thành');
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const [tiers, tierPrices, custPrices, map] = await Promise.all([
    c.env.DB.prepare('SELECT id, code, name, rank FROM price_tiers ORDER BY rank').all(),
    c.env.DB.prepare(
      `SELECT p.sku, p.name, pp.tier_id, pp.amount, pp.valid_from
       FROM product_prices pp JOIN products p ON p.id = pp.product_id
       WHERE pp.status = 'ACTIVE' AND pp.amount > 0 AND p.deleted_at IS NULL AND p.active = 1
         AND pp.valid_from <= ? AND (pp.valid_to IS NULL OR pp.valid_to >= ?)
       ORDER BY p.sku, pp.tier_id, pp.valid_from`,
    )
      .bind(today, today)
      .all<{ sku: string; name: string; tier_id: string; amount: number; valid_from: string }>(),
    c.env.DB.prepare(
      `SELECT cu.id AS customer_id, cu.name AS customer, p.sku, p.name, cp.amount, cp.valid_from
       FROM customer_prices cp JOIN products p ON p.id = cp.product_id JOIN customers cu ON cu.id = cp.customer_id
       WHERE cp.valid_from <= ? AND (cp.valid_to IS NULL OR cp.valid_to >= ?) AND cu.deleted_at IS NULL
       ORDER BY cu.name, p.sku, cp.valid_from`,
    )
      .bind(today, today)
      .all<{ customer_id: string; customer: string; sku: string; name: string; amount: number; valid_from: string }>(),
    c.env.DB.prepare('SELECT crm_sku, misa_code, factor FROM kho_map').all(),
  ]);
  // Mỗi sản phẩm × cấp (hoặc × khách) chỉ giữ giá có hiệu lực mới nhất.
  const latest = <T extends { valid_from: string }>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, T>();
    for (const r of rows) {
      const k = key(r);
      const cur = m.get(k);
      if (!cur || r.valid_from >= cur.valid_from) m.set(k, r);
    }
    return [...m.values()];
  };
  return ok(c, {
    tiers: tiers.results ?? [],
    tier_prices: latest(tierPrices.results ?? [], (r) => `${r.sku}|${r.tier_id}`),
    customer_prices: latest(custPrices.results ?? [], (r) => `${r.sku}|${r.customer_id}`),
    map: map.results ?? [],
  });
});

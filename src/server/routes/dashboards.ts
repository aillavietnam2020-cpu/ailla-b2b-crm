import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { badRequest, forbidden, ok } from '../lib/http';
import { requirePermission } from '../middleware/rbac';
import { loadConfig } from '../lib/settings';
import { ceoDashboard, managerDashboard, salesPerformance } from '../services/dashboards';
import { salesDashboard } from '../services/reports';

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get('/manager', requirePermission('dashboard.manager'), async (c) => {
  return ok(c, await managerDashboard(c.env.DB, c.req.query('month')));
});

dashboardRoutes.get('/ceo', requirePermission('dashboard.ceo'), async (c) => {
  return ok(c, await ceoDashboard(c.env.DB, c.req.query('month')));
});

/**
 * Báo cáo doanh số + thưởng theo kỳ (tháng 'YYYY-MM' hoặc năm 'YYYY').
 * Nhân viên chỉ xem được số của chính mình.
 */
dashboardRoutes.get('/sales', async (c) => {
  const auth = c.get('auth');
  const config = await loadConfig(c.env.DB);
  const requested = c.req.query('user_id');
  const ownerId = auth.user.role === 'EMPLOYEE' ? auth.user.id : (requested ?? null);
  return ok(
    c,
    await salesDashboard(c.env.DB, config, { period: c.req.query('period') ?? undefined, ownerId }),
  );
});

/** Kết quả cá nhân. Nhân viên chỉ xem được của chính mình. */
dashboardRoutes.get('/me', async (c) => {
  const auth = c.get('auth');
  const requested = c.req.query('user_id');
  const userId = auth.user.role === 'EMPLOYEE' ? auth.user.id : (requested ?? auth.user.id);
  return ok(c, await salesPerformance(c.env.DB, userId, c.req.query('month')));
});

/**
 * Kênh của một đơn B2B: khách chỉ dùng bảng giá riêng (không có cấp giá) là kênh GIA CÔNG; còn lại là B2B (đại lý, NPP).
 */
const CHANNEL_EXPR = "CASE WHEN c.price_mode = 'CUSTOM' AND c.tier_id IS NULL THEN 'GIA_CONG' ELSE 'B2B' END";

/**
 * Doanh thu B2B theo từng mã sản phẩm và tháng (đơn đã duyệt), để trang quản trị ghép giá vốn và chi phí ra lãi lỗ.
 * Chỉ CEO và kế toán (quyền xem công nợ toàn công ty) gọi được, giống các số tài chính khác.
 * Doanh thu một dòng = tiền hàng của dòng đó; phần chiết khấu / trừ thưởng cấp đơn nằm riêng ở `order_adjust`.
 */
dashboardRoutes.get('/b2b-sku', async (c) => {
  const auth = c.get('auth');
  if (auth.user.role !== 'CEO' && !auth.permissions.includes('debt.read.all')) {
    throw forbidden('Chỉ CEO hoặc kế toán xem báo cáo doanh thu theo mã');
  }
  const from = c.req.query('from');
  const to = c.req.query('to');
  const ok10 = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!ok10(from) || !ok10(to)) throw badRequest('BAD_RANGE', 'Cần chọn ngày bắt đầu và kết thúc');
  const lines = await c.env.DB.prepare(
    `SELECT substr(o.order_date, 1, 7) AS month, ${CHANNEL_EXPR} AS channel, p.sku AS sku, p.name AS name,
            COALESCE(g.name, 'Chưa phân nhóm') AS group_name,
            SUM(i.qty) AS qty, SUM(i.line_total) AS revenue
     FROM order_items i
     JOIN orders o ON o.id = i.order_id AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
     JOIN customers c ON c.id = o.customer_id
     JOIN products p ON p.id = i.product_id
     LEFT JOIN product_groups g ON g.id = p.group_id
     WHERE o.order_date BETWEEN ? AND ?
     GROUP BY month, channel, p.sku, p.name, group_name
     ORDER BY month, revenue DESC
     LIMIT 6000`,
  )
    .bind(from, to)
    .all();
  const months = await c.env.DB.prepare(
    `SELECT substr(o.order_date, 1, 7) AS month, ${CHANNEL_EXPR} AS channel, COUNT(*) AS orders,
            COALESCE(SUM(o.subtotal), 0) AS subtotal,
            COALESCE(SUM(o.discount_amount + o.bonus_deduction), 0) AS order_adjust,
            COALESCE(SUM(o.subtotal - o.discount_amount - o.bonus_deduction), 0) AS revenue
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND o.order_date BETWEEN ? AND ?
     GROUP BY month, channel ORDER BY month`,
  )
    .bind(from, to)
    .all();
  return ok(c, { from, to, lines: lines.results ?? [], months: months.results ?? [] });
});

import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { badRequest, forbidden, ok } from '../lib/http';
import { customerScopeClause, requirePermission } from '../middleware/rbac';
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
 * Doanh thu thực của tháng (`revenue`) = tiền hàng − chiết khấu. Thưởng cấp đơn (`bonus`) là CHI PHÍ kênh, không trừ vào doanh thu
 * (chị Hoa chốt 28/10/2026), để Tổng quan, Lãi lỗ, Đối chiếu doanh thu và trang Kênh phân phối cùng một số.
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
            COALESCE(SUM(o.bonus_deduction), 0) AS bonus,
            COALESCE(SUM(o.subtotal - o.discount_amount), 0) AS revenue
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND o.order_date BETWEEN ? AND ?
     GROUP BY month, channel ORDER BY month`,
  )
    .bind(from, to)
    .all();
  return ok(c, { from, to, lines: lines.results ?? [], months: months.results ?? [] });
});

/**
 * Trang Kênh phân phối (hai web): đơn, khách và sản phẩm của Kênh phân phối (không gồm Kênh OEM).
 * Nhân viên chỉ thấy khách mình phụ trách (customerScopeClause). Không có giá vốn, lãi: giá vốn ghép ở trang quản trị.
 * - orders: mọi đơn chưa xoá từ `since` (mặc định 92 ngày trước `from`) tới `to`, kèm tiền đã thu (phân bổ phiếu thu chưa huỷ).
 * - customers: khách Kênh phân phối, cấp giá, người phụ trách, ngày tạo, chu kỳ đặt, đơn đầu tiên / số đơn đã duyệt mọi lúc.
 * - items: tiền hàng, số lượng theo mã trong [from, to], đơn đã duyệt.
 */
dashboardRoutes.get('/kenh-pp', requirePermission('customer.read.own'), async (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');
  const ok10 = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!ok10(from) || !ok10(to) || from > to) throw badRequest('BAD_RANGE', 'Cần chọn ngày bắt đầu và kết thúc');
  const q = c.req.query('since');
  const since = ok10(q) && q <= from ? q : new Date(new Date(`${from}T00:00:00Z`).getTime() - 92 * 864e5).toISOString().slice(0, 10);
  const scope = customerScopeClause(c.get('auth'));
  const ch = `(${CHANNEL_EXPR}) = 'B2B'`;
  const orders = await c.env.DB.prepare(
    `SELECT o.id, o.order_no, o.order_date, o.customer_id, o.subtotal, o.discount_amount, o.bonus_deduction, o.total_amount,
            o.approval_status, o.delivery_status, o.accounting_status, o.payment_status,
            COALESCE((SELECT SUM(a.amount) FROM payment_allocations a WHERE a.order_id = o.id AND a.reversed_at IS NULL), 0) AS received
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.deleted_at IS NULL AND o.order_date BETWEEN ? AND ? AND ${ch} AND ${scope.sql}
     ORDER BY o.order_date LIMIT 5000`,
  )
    .bind(since, to, ...scope.params)
    .all();
  const customers = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.created_at, c.reorder_cycle_days, t.name AS tier, u.display_name AS owner_name,
            (SELECT MIN(o.order_date) FROM orders o WHERE o.customer_id = c.id AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED') AS first_order,
            (SELECT MAX(o.order_date) FROM orders o WHERE o.customer_id = c.id AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED') AS last_order,
            (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED') AS n_orders
     FROM customers c LEFT JOIN price_tiers t ON t.id = c.tier_id LEFT JOIN users u ON u.id = c.owner_id
     WHERE c.deleted_at IS NULL AND ${ch} AND ${scope.sql} LIMIT 5000`,
  )
    .bind(...scope.params)
    .all();
  const items = await c.env.DB.prepare(
    `SELECT p.sku AS sku, p.name AS name, COALESCE(g.name, 'Chưa phân nhóm') AS group_name, SUM(i.qty) AS qty, SUM(i.line_total) AS revenue
     FROM order_items i
     JOIN orders o ON o.id = i.order_id AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
     JOIN customers c ON c.id = o.customer_id
     JOIN products p ON p.id = i.product_id
     LEFT JOIN product_groups g ON g.id = p.group_id
     WHERE o.order_date BETWEEN ? AND ? AND ${ch} AND ${scope.sql}
     GROUP BY p.sku, p.name, group_name ORDER BY revenue DESC LIMIT 2000`,
  )
    .bind(from, to, ...scope.params)
    .all();
  return ok(c, { from, to, since, orders: orders.results ?? [], customers: customers.results ?? [], items: items.results ?? [] });
});

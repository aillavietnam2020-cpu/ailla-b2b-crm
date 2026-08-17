import { vnDate } from '@shared/datetime';
import type { AppConfig } from '../lib/settings';

/**
 * Dashboard kinh doanh, dựng theo đúng sheet DASHBOARD_SALE trong file CRM của công ty:
 *   A. Tổng quan công ty trong kỳ
 *   B. KPI hiệu suất từng sale
 *   C. Nhóm sản phẩm bán chạy
 *   D. Phễu khách hàng
 *
 * "Doanh thu trong kỳ" theo định nghĩa của file: tiền hàng đã trừ chiết khấu, KHÔNG tính
 * phí vận chuyển. Chỉ tính đơn đã duyệt.
 */

export interface SalesOverview {
  revenue: number;
  orders: number;
  aov: number;
  customers_with_orders: number;
  new_first_order_customers: number;
  new_contacted_customers: number;
  close_rate: number;
  repeat_rate: number;
  official_debt: number;
  over_limit_customers: number;
  overdue_reorder_customers: number;
}

export interface SalesKpiRow {
  user_id: string | null;
  display_name: string;
  revenue: number;
  revenue_new_customers: number;
  revenue_old_customers: number;
  orders: number;
  aov: number;
  new_customers: number;
  collected: number;
}

export interface ProductGroupRow {
  group_name: string;
  revenue: number;
  quantity: number;
  order_lines: number;
  share: number;
  revenue_total: number;
}

export interface FunnelRow {
  stage: string;
  customers: number;
  share: number;
  revenue_total: number;
}

export interface SalesDashboard {
  period: string;
  from: string;
  to: string;
  overview: SalesOverview;
  by_sale: SalesKpiRow[];
  by_product_group: ProductGroupRow[];
  funnel: FunnelRow[];
}

function periodRange(period: string): { from: string; to: string } {
  if (/^\d{4}$/.test(period)) return { from: `${period}-01-01`, to: `${period}-12-31` };
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, '0')}` };
}

/** Doanh thu = tiền hàng - chiết khấu - trừ thưởng, KHÔNG cộng phí vận chuyển. */
const REVENUE_EXPR = '(o.subtotal - o.discount_amount - o.bonus_deduction)';

export async function salesDashboard(
  db: D1Database,
  _config: AppConfig,
  options: { period?: string; ownerId?: string | null },
): Promise<SalesDashboard> {
  const period = options.period ?? vnDate().slice(0, 7);
  const { from, to } = periodRange(period);
  const ownerFilter = options.ownerId ? 'AND o.owner_id = ?' : '';
  const ownerParams = options.ownerId ? [options.ownerId] : [];

  /* ---------------- A. Tổng quan ---------------- */
  const overviewRow = await db
    .prepare(
      `SELECT
        COALESCE(SUM(${REVENUE_EXPR}), 0) AS revenue,
        COUNT(*) AS orders,
        COUNT(DISTINCT o.customer_id) AS customers_with_orders
       FROM orders o
       WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
         AND o.order_date BETWEEN ? AND ? ${ownerFilter}`,
    )
    .bind(from, to, ...ownerParams)
    .first<{ revenue: number; orders: number; customers_with_orders: number }>();

  // Khách chốt đơn ĐẦU TIÊN trong kỳ: đơn sớm nhất của khách rơi vào kỳ này.
  const firstOrderRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT o.customer_id, MIN(o.order_date) AS first_date
         FROM orders o
         WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED' ${ownerFilter}
         GROUP BY o.customer_id
       ) t WHERE t.first_date BETWEEN ? AND ?`,
    )
    .bind(...ownerParams, from, to)
    .first<{ n: number }>();

  const contactedRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM customers c
       WHERE c.deleted_at IS NULL AND c.first_contact_date BETWEEN ? AND ?
         ${options.ownerId ? 'AND c.owner_id = ?' : ''}`,
    )
    .bind(from, to, ...ownerParams)
    .first<{ n: number }>();

  // Khách cũ tái đơn: đã từng mua TRƯỚC kỳ và có đơn trong kỳ.
  const repeatRow = await db
    .prepare(
      `SELECT
        (SELECT COUNT(DISTINCT o.customer_id) FROM orders o
          WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
            AND o.order_date BETWEEN ? AND ? ${ownerFilter}
            AND o.customer_id IN (
              SELECT customer_id FROM orders WHERE deleted_at IS NULL
                AND approval_status = 'APPROVED' AND order_date < ?)) AS repeated,
        (SELECT COUNT(DISTINCT customer_id) FROM orders WHERE deleted_at IS NULL
           AND approval_status = 'APPROVED' AND order_date < ?) AS bought_before`,
    )
    .bind(from, to, ...ownerParams, from, from)
    .first<{ repeated: number; bought_before: number }>();

  const today = vnDate();
  const riskRow = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM customers c
          WHERE c.deleted_at IS NULL AND c.stage <> 'LOST' AND c.last_order_date IS NOT NULL
            AND julianday(?) - julianday(c.last_order_date) >
                COALESCE(c.reorder_cycle_days, 30)) AS overdue_reorder`,
    )
    .bind(today)
    .first<{ overdue_reorder: number }>();

  /* ---------------- B. KPI từng sale ---------------- */
  const bySale = await db
    .prepare(
      `SELECT u.id AS user_id, u.display_name,
        COALESCE(SUM(${REVENUE_EXPR}), 0) AS revenue,
        COALESCE(SUM(CASE WHEN first_order.first_date BETWEEN ? AND ?
                          THEN ${REVENUE_EXPR} ELSE 0 END), 0) AS revenue_new_customers,
        COALESCE(SUM(CASE WHEN first_order.first_date < ?
                          THEN ${REVENUE_EXPR} ELSE 0 END), 0) AS revenue_old_customers,
        COUNT(o.id) AS orders,
        (SELECT COUNT(*) FROM customers c WHERE c.owner_id = u.id AND c.deleted_at IS NULL
           AND c.first_contact_date BETWEEN ? AND ?) AS new_customers,
        (SELECT COALESCE(SUM(CASE WHEN p.is_adjustment = 1 THEN -p.amount ELSE p.amount END), 0)
           FROM payments p JOIN customers c2 ON c2.id = p.customer_id
           WHERE c2.owner_id = u.id AND p.accounting_status = 'DA_XAC_NHAN'
             AND p.paid_at BETWEEN ? AND ?) AS collected
       FROM users u
       LEFT JOIN orders o ON o.owner_id = u.id AND o.deleted_at IS NULL
            AND o.approval_status = 'APPROVED' AND o.order_date BETWEEN ? AND ?
       LEFT JOIN (
         SELECT customer_id, MIN(order_date) AS first_date FROM orders
         WHERE deleted_at IS NULL AND approval_status = 'APPROVED' GROUP BY customer_id
       ) first_order ON first_order.customer_id = o.customer_id
       WHERE u.deleted_at IS NULL AND u.role = 'EMPLOYEE'
         ${options.ownerId ? 'AND u.id = ?' : ''}
       GROUP BY u.id, u.display_name
       ORDER BY revenue DESC`,
    )
    .bind(from, to, from, from, to, from, to, from, to, ...ownerParams)
    .all<Omit<SalesKpiRow, 'aov'>>();

  /* ---------------- C. Nhóm sản phẩm ---------------- */
  const groups = await db
    .prepare(
      `SELECT COALESCE(g.name, 'Chưa phân nhóm') AS group_name,
        COALESCE(SUM(CASE WHEN o.order_date BETWEEN ? AND ? THEN i.line_total ELSE 0 END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN o.order_date BETWEEN ? AND ? THEN i.qty ELSE 0 END), 0) AS quantity,
        COALESCE(SUM(CASE WHEN o.order_date BETWEEN ? AND ? THEN 1 ELSE 0 END), 0) AS order_lines,
        COALESCE(SUM(i.line_total), 0) AS revenue_total
       FROM order_items i
       JOIN orders o ON o.id = i.order_id AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
       JOIN products p ON p.id = i.product_id
       LEFT JOIN product_groups g ON g.id = p.group_id
       ${options.ownerId ? 'WHERE o.owner_id = ?' : ''}
       GROUP BY group_name
       ORDER BY revenue_total DESC`,
    )
    .bind(from, to, from, to, from, to, ...ownerParams)
    .all<Omit<ProductGroupRow, 'share'>>();

  /* ---------------- D. Phễu khách hàng ---------------- */
  const funnel = await db
    .prepare(
      `SELECT c.stage,
              COUNT(*) AS customers,
              COALESCE((SELECT SUM(o.subtotal) FROM orders o
                        WHERE o.customer_id = c.id AND o.deleted_at IS NULL
                          AND o.approval_status = 'APPROVED'), 0) AS revenue_total
       FROM customers c
       WHERE c.deleted_at IS NULL ${options.ownerId ? 'AND c.owner_id = ?' : ''}
       GROUP BY c.stage`,
    )
    .bind(...ownerParams)
    .all<{ stage: string; customers: number; revenue_total: number }>();

  const debts = await db
    .prepare(
      `SELECT COALESCE(SUM(c.opening_debt), 0) AS opening FROM customers c WHERE c.deleted_at IS NULL`,
    )
    .first<{ opening: number }>();

  const revenue = overviewRow?.revenue ?? 0;
  const orders = overviewRow?.orders ?? 0;
  const contacted = contactedRow?.n ?? 0;
  const firstOrders = firstOrderRow?.n ?? 0;
  const groupRows = groups.results ?? [];
  const groupTotal = groupRows.reduce((acc, g) => acc + g.revenue, 0);
  const funnelRows = funnel.results ?? [];
  const funnelTotal = funnelRows.reduce((acc, f) => acc + f.customers, 0);

  return {
    period,
    from,
    to,
    overview: {
      revenue,
      orders,
      aov: orders ? Math.round(revenue / orders) : 0,
      customers_with_orders: overviewRow?.customers_with_orders ?? 0,
      new_first_order_customers: firstOrders,
      new_contacted_customers: contacted,
      close_rate: contacted ? Math.round((firstOrders / contacted) * 100) : 0,
      repeat_rate: repeatRow?.bought_before
        ? Math.round((repeatRow.repeated / repeatRow.bought_before) * 100)
        : 0,
      official_debt: debts?.opening ?? 0,
      over_limit_customers: 0,
      overdue_reorder_customers: riskRow?.overdue_reorder ?? 0,
    },
    by_sale: (bySale.results ?? []).map((r) => ({
      ...r,
      aov: r.orders ? Math.round(r.revenue / r.orders) : 0,
    })),
    by_product_group: groupRows.map((g) => ({
      ...g,
      share: groupTotal ? Math.round((g.revenue / groupTotal) * 1000) / 10 : 0,
    })),
    funnel: funnelRows.map((f) => ({
      ...f,
      share: funnelTotal ? Math.round((f.customers / funnelTotal) * 1000) / 10 : 0,
    })),
  };
}

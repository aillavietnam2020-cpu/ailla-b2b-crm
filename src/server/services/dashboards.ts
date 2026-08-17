import { vnDate } from '@shared/datetime';
import type { CeoDashboard, ManagerDashboard, SalesPerformance } from '@shared/types';
import type { CustomerStage } from '@shared/enums';
import { listDebts, totalDebts } from './debts';
import { listAlerts } from './alerts';
import { listApprovals } from './approvals';

function monthPrefix(today = vnDate()): string {
  return today.slice(0, 7);
}

export async function managerDashboard(db: D1Database): Promise<ManagerDashboard> {
  const today = vnDate();
  const month = monthPrefix(today);

  const reps = await db
    .prepare(
      `SELECT u.id AS user_id, u.display_name,
        (SELECT COUNT(*) FROM customers c WHERE c.owner_id = u.id AND c.deleted_at IS NULL) AS customers,
        (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'OPEN') AS open_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'OPEN' AND t.due_at < ?) AS overdue_tasks,
        (SELECT COUNT(*) FROM customer_activities a WHERE a.user_id = u.id AND a.created_at >= ?) AS activities_30d,
        (SELECT COUNT(*) FROM orders o WHERE o.owner_id = u.id AND o.deleted_at IS NULL
            AND o.approval_status = 'APPROVED' AND substr(o.order_date, 1, 7) = ?) AS orders_month,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.owner_id = u.id AND o.deleted_at IS NULL
            AND o.approval_status = 'APPROVED' AND substr(o.order_date, 1, 7) = ?) AS revenue_month,
        (SELECT COUNT(DISTINCT o.customer_id) FROM orders o WHERE o.owner_id = u.id
            AND o.approval_status = 'APPROVED' AND o.deleted_at IS NULL) AS customers_with_orders
       FROM users u
       WHERE u.role = 'EMPLOYEE' AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
       ORDER BY revenue_month DESC`,
    )
    .bind(today, new Date(Date.now() - 30 * 86_400_000).toISOString(), month, month)
    .all<ManagerDashboard['reps'][number]>();

  const counts = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM customers WHERE owner_id IS NULL AND deleted_at IS NULL) AS unassigned_customers,
        (SELECT COUNT(*) FROM approvals WHERE status = 'PENDING') AS pending_approvals,
        (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL AND next_follow_up_at IS NOT NULL
           AND next_follow_up_at < ? AND stage <> 'LOST') AS overdue_customers,
        (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL AND data_quality = 'NEEDS_REVIEW') AS needs_review_customers`,
    )
    .bind(today)
    .first<Omit<ManagerDashboard, 'reps' | 'alerts'>>();

  const alerts = await listAlerts(db, { limit: 20 });

  return {
    reps: reps.results ?? [],
    unassigned_customers: counts?.unassigned_customers ?? 0,
    pending_approvals: counts?.pending_approvals ?? 0,
    overdue_customers: counts?.overdue_customers ?? 0,
    needs_review_customers: counts?.needs_review_customers ?? 0,
    alerts,
  };
}

export async function ceoDashboard(db: D1Database): Promise<CeoDashboard> {
  const month = monthPrefix();

  const money = await db
    .prepare(
      `SELECT
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE deleted_at IS NULL
           AND approval_status = 'APPROVED' AND substr(order_date, 1, 7) = ?) AS revenue_month,
        (SELECT COALESCE(SUM(CASE WHEN is_adjustment = 1 THEN -amount ELSE amount END), 0)
           FROM payments WHERE substr(paid_at, 1, 7) = ?
           AND accounting_status = 'DA_XAC_NHAN') AS collected_month,
        (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL) AS customers_total,
        (SELECT COUNT(DISTINCT customer_id) FROM orders WHERE approval_status = 'APPROVED'
           AND deleted_at IS NULL) AS customers_with_orders`,
    )
    .bind(month, month)
    .first<{
      revenue_month: number;
      collected_month: number;
      customers_total: number;
      customers_with_orders: number;
    }>();

  const debts = totalDebts(await listDebts(db, '1=1', []));

  const quality = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL AND data_quality = 'NEEDS_REVIEW') AS customers_needs_review,
        (SELECT COUNT(DISTINCT p.id) FROM products p
           JOIN price_tiers t ON 1 = 1
           LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.tier_id = t.id AND pp.amount IS NOT NULL
           WHERE p.deleted_at IS NULL AND pp.id IS NULL) AS products_missing_price,
        (SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL AND data_quality = 'NEEDS_REVIEW') AS orders_needs_review,
        (SELECT COUNT(*) FROM payments WHERE review_status = 'NEEDS_REVIEW') AS payments_needs_review`,
    )
    .first<CeoDashboard['data_quality']>();

  const lastImport = await db
    .prepare(`SELECT status FROM import_batches ORDER BY created_at DESC LIMIT 1`)
    .first<{ status: string }>();

  const decisions = await listAlerts(db, {
    codes: [
      'DEBT_LIMIT_EXCEEDED',
      'PROJECTED_DEBT_EXCEEDED',
      'MISSING_PRICE',
      'IMPORT_RECONCILIATION_FAILED',
      'ACCOUNTING_PENDING',
    ],
    limit: 20,
  });
  const pendingApprovals = await listApprovals(db, 'PENDING', 20);

  const customersTotal = money?.customers_total ?? 0;
  return {
    revenue_month: money?.revenue_month ?? 0,
    collected_month: money?.collected_month ?? 0,
    official_debt: debts.official_debt,
    projected_debt: debts.projected_debt,
    pending_charges: debts.pending_charges,
    pending_cash: debts.pending_cash,
    customers_total: customersTotal,
    customers_with_orders: money?.customers_with_orders ?? 0,
    order_rate: customersTotal ? Math.round(((money?.customers_with_orders ?? 0) / customersTotal) * 100) : 0,
    data_quality: {
      customers_needs_review: quality?.customers_needs_review ?? 0,
      products_missing_price: quality?.products_missing_price ?? 0,
      orders_needs_review: quality?.orders_needs_review ?? 0,
      payments_needs_review: quality?.payments_needs_review ?? 0,
      last_import_status: lastImport?.status ?? null,
      last_import_reconciled: lastImport ? lastImport.status === 'RECONCILED' : null,
    },
    decisions,
    pending_approvals: pendingApprovals,
  };
}

export async function salesPerformance(db: D1Database, userId: string): Promise<SalesPerformance> {
  const today = vnDate();
  const month = monthPrefix(today);

  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM customers WHERE owner_id = ? AND deleted_at IS NULL) AS customers,
        (SELECT COUNT(DISTINCT customer_id) FROM orders WHERE owner_id = ? AND approval_status = 'APPROVED'
           AND deleted_at IS NULL) AS customers_with_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE owner_id = ? AND approval_status = 'APPROVED'
           AND deleted_at IS NULL AND substr(order_date, 1, 7) = ?) AS revenue_month,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE owner_id = ? AND approval_status = 'APPROVED'
           AND deleted_at IS NULL) AS revenue_total,
        (SELECT COUNT(*) FROM customer_activities WHERE user_id = ? AND substr(created_at, 1, 7) = ?) AS activities_month,
        (SELECT COUNT(*) FROM tasks WHERE assignee_id = ? AND status = 'OPEN') AS open_tasks,
        (SELECT COUNT(*) FROM tasks WHERE assignee_id = ? AND status = 'OPEN' AND due_at < ?) AS overdue_tasks`,
    )
    .bind(userId, userId, userId, month, userId, userId, month, userId, userId, today)
    .first<Omit<SalesPerformance, 'order_rate' | 'by_stage'>>();

  const stages = await db
    .prepare(
      `SELECT stage, COUNT(*) AS count FROM customers WHERE owner_id = ? AND deleted_at IS NULL GROUP BY stage`,
    )
    .bind(userId)
    .all<{ stage: CustomerStage; count: number }>();

  const customers = row?.customers ?? 0;
  return {
    customers,
    customers_with_orders: row?.customers_with_orders ?? 0,
    order_rate: customers ? Math.round(((row?.customers_with_orders ?? 0) / customers) * 100) : 0,
    revenue_month: row?.revenue_month ?? 0,
    revenue_total: row?.revenue_total ?? 0,
    activities_month: row?.activities_month ?? 0,
    open_tasks: row?.open_tasks ?? 0,
    overdue_tasks: row?.overdue_tasks ?? 0,
    by_stage: stages.results ?? [],
  };
}

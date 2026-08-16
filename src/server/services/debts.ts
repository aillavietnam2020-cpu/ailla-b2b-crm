import { computeDebt } from '@shared/debt';
import type { DebtSummary } from '@shared/types';

interface DebtRow {
  id: string;
  name: string;
  owner_id: string | null;
  owner_name: string | null;
  opening_debt: number;
  credit_limit: number | null;
  tier_debt_limit: number | null;
  posted_charges: number;
  pending_charges: number;
  confirmed_payments: number;
  pending_cash: number;
  credit_balance: number;
}

/**
 * Tổng hợp công nợ theo khách. Ba khái niệm được tính riêng đúng mục 9.1:
 *  - posted_charges: đơn đã duyệt + đã xuất/giao + kế toán ĐÃ xác nhận
 *  - pending_charges: đơn đã duyệt + đã xuất/giao nhưng kế toán CHƯA xác nhận
 *  - confirmed_payments: phần đã phân bổ của payment kế toán ĐÃ xác nhận
 *  - pending_cash: payment chưa xác nhận + phần chưa phân bổ của payment đã xác nhận
 */
const BASE_SQL = `
SELECT c.id, c.name, c.owner_id, u.display_name AS owner_name,
       c.opening_debt, c.credit_limit, t.debt_limit AS tier_debt_limit,
       COALESCE(o.posted_charges, 0)     AS posted_charges,
       COALESCE(o.pending_charges, 0)    AS pending_charges,
       COALESCE(p.confirmed_payments, 0) AS confirmed_payments,
       COALESCE(p.pending_cash, 0)       AS pending_cash,
       COALESCE(cb.amount, 0)            AS credit_balance
FROM customers c
LEFT JOIN users u ON u.id = c.owner_id
LEFT JOIN price_tiers t ON t.id = c.tier_id
LEFT JOIN (
  SELECT customer_id,
    SUM(CASE WHEN accounting_status = 'DA_XAC_NHAN' AND delivery_status IN ('DA_XUAT_KHO','DA_GIAO')
             THEN total_amount ELSE 0 END) AS posted_charges,
    SUM(CASE WHEN accounting_status = 'CHUA_XAC_NHAN' AND delivery_status IN ('DA_XUAT_KHO','DA_GIAO')
             THEN total_amount ELSE 0 END) AS pending_charges
  FROM orders
  WHERE deleted_at IS NULL AND approval_status = 'APPROVED'
  GROUP BY customer_id
) o ON o.customer_id = c.id
LEFT JOIN (
  -- Bút toán đảo (is_adjustment = 1) mang dấu âm: nó TRỪ lại khoản thu đã ghi nhận trước đó.
  SELECT p.customer_id,
    SUM(CASE WHEN p.accounting_status = 'DA_XAC_NHAN'
             THEN COALESCE(a.allocated, 0) * CASE WHEN p.is_adjustment = 1 THEN -1 ELSE 1 END
             ELSE 0 END) AS confirmed_payments,
    SUM((p.amount - CASE WHEN p.accounting_status = 'DA_XAC_NHAN' THEN COALESCE(a.allocated, 0) ELSE 0 END)
        * CASE WHEN p.is_adjustment = 1 THEN -1 ELSE 1 END) AS pending_cash
  FROM payments p
  LEFT JOIN (
    SELECT payment_id, SUM(amount) AS allocated
    FROM payment_allocations WHERE reversed_at IS NULL GROUP BY payment_id
  ) a ON a.payment_id = p.id
  GROUP BY p.customer_id
) p ON p.customer_id = c.id
LEFT JOIN customer_credit_balances cb ON cb.customer_id = c.id
WHERE c.deleted_at IS NULL`;

function toSummary(row: DebtRow): DebtSummary {
  const debt = computeDebt({
    openingDebt: row.opening_debt ?? 0,
    postedCharges: row.posted_charges ?? 0,
    confirmedPayments: row.confirmed_payments ?? 0,
    pendingCharges: row.pending_charges ?? 0,
    pendingCash: row.pending_cash ?? 0,
    creditBalance: row.credit_balance ?? 0,
  });
  const limit = row.credit_limit ?? row.tier_debt_limit ?? 0;
  return {
    customer_id: row.id,
    customer_name: row.name,
    owner_name: row.owner_name,
    ...debt,
    opening_debt: debt.openingDebt,
    posted_charges: debt.postedCharges,
    confirmed_payments: debt.confirmedPayments,
    official_debt: debt.officialDebt,
    pending_charges: debt.pendingCharges,
    pending_cash: debt.pendingCash,
    projected_debt: debt.projectedDebt,
    credit_balance: debt.creditBalance,
    limit,
    official_exceeded: limit > 0 && debt.officialDebt > limit,
    projected_exceeded: limit > 0 && debt.projectedDebt > limit,
  } as DebtSummary;
}

export async function getCustomerDebt(db: D1Database, customerId: string): Promise<DebtSummary> {
  const row = await db.prepare(`${BASE_SQL} AND c.id = ?`).bind(customerId).first<DebtRow>();
  if (!row) {
    return {
      customer_id: customerId,
      customer_name: '',
      opening_debt: 0,
      posted_charges: 0,
      confirmed_payments: 0,
      official_debt: 0,
      pending_charges: 0,
      pending_cash: 0,
      projected_debt: 0,
      credit_balance: 0,
      limit: 0,
      official_exceeded: false,
      projected_exceeded: false,
    };
  }
  return toSummary(row);
}

export async function listDebts(
  db: D1Database,
  scopeSql: string,
  scopeParams: unknown[],
  filter?: { onlyExceeded?: boolean; onlyWithDebt?: boolean },
): Promise<DebtSummary[]> {
  const rows = await db
    .prepare(`${BASE_SQL} AND ${scopeSql} ORDER BY c.name COLLATE NOCASE`)
    .bind(...scopeParams)
    .all<DebtRow>();
  let list = (rows.results ?? []).map(toSummary);
  if (filter?.onlyExceeded) list = list.filter((d) => d.official_exceeded || d.projected_exceeded);
  if (filter?.onlyWithDebt) list = list.filter((d) => d.official_debt !== 0 || d.projected_debt !== 0);
  return list;
}

export interface DebtTotals {
  opening_debt: number;
  official_debt: number;
  projected_debt: number;
  pending_charges: number;
  pending_cash: number;
  credit_balance: number;
  customers_exceeded: number;
}

export function totalDebts(list: DebtSummary[]): DebtTotals {
  return list.reduce<DebtTotals>(
    (acc, d) => ({
      opening_debt: acc.opening_debt + d.opening_debt,
      official_debt: acc.official_debt + d.official_debt,
      projected_debt: acc.projected_debt + d.projected_debt,
      pending_charges: acc.pending_charges + d.pending_charges,
      pending_cash: acc.pending_cash + d.pending_cash,
      credit_balance: acc.credit_balance + d.credit_balance,
      customers_exceeded: acc.customers_exceeded + (d.official_exceeded || d.projected_exceeded ? 1 : 0),
    }),
    {
      opening_debt: 0,
      official_debt: 0,
      projected_debt: 0,
      pending_charges: 0,
      pending_cash: 0,
      credit_balance: 0,
      customers_exceeded: 0,
    },
  );
}

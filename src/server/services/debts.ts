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
 *  - confirmed_payments: TOÀN BỘ tiền kế toán ĐÃ xác nhận, kể cả khoản khách trả
 *    nợ chung chưa gán vào đơn nào — chốt theo cách công ty đang làm trên Excel:
 *    kế toán xác nhận là trừ thẳng công nợ, không chờ phân bổ từng đơn.
 *  - pending_cash: tiền sale đã báo về nhưng kế toán CHƯA xác nhận
 */
const BASE_SQL = `
SELECT c.id, c.name, c.owner_id, u.display_name AS owner_name,
       c.opening_debt, c.credit_limit, t.debt_limit AS tier_debt_limit,
       COALESCE(o.posted_charges, 0) - COALESCE(rt.credited, 0) AS posted_charges,
       COALESCE(o.pending_charges, 0) - COALESCE(rt.awaiting, 0) AS pending_charges,
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
  -- Hàng trả lại: kế toán đã xác nhận thì giảm công nợ chính thức; kho đã nhận mà kế toán chưa xác nhận
  -- thì chỉ giảm công nợ dự kiến.
  SELECT customer_id,
    SUM(CASE WHEN status = 'DA_GIAM_NO' THEN credit_amount ELSE 0 END) AS credited,
    SUM(CASE WHEN status = 'DA_NHAN_KHO' THEN credit_amount ELSE 0 END) AS awaiting
  FROM order_returns GROUP BY customer_id
) rt ON rt.customer_id = c.id
LEFT JOIN (
  -- Bút toán đảo (is_adjustment = 1) mang dấu âm: nó TRỪ lại khoản thu đã ghi nhận trước đó.
  SELECT p.customer_id,
    SUM(CASE WHEN p.accounting_status = 'DA_XAC_NHAN'
             THEN p.amount * CASE WHEN p.is_adjustment = 1 THEN -1 ELSE 1 END
             ELSE 0 END) AS confirmed_payments,
    SUM(CASE WHEN p.accounting_status = 'DA_XAC_NHAN' THEN 0
             ELSE p.amount * CASE WHEN p.is_adjustment = 1 THEN -1 ELSE 1 END END) AS pending_cash
  FROM payments p
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

/** Một dòng trong lịch sử giao dịch công nợ của khách (13/10 chị: hồ sơ khách cần lịch sử giao dịch). */
export interface LedgerEntry {
  date: string;
  kind: 'DAU_KY' | 'GHI_NO' | 'THANH_TOAN' | 'DIEU_CHINH' | 'TRA_HANG';
  ref: string;
  note: string | null;
  /** + làm tăng nợ, - làm giảm nợ */
  amount: number;
  /** true: đã tính vào công nợ chính thức (kế toán xác nhận); false: còn chờ */
  confirmed: boolean;
  /** dư nợ chính thức sau dòng này (chỉ cộng các dòng đã xác nhận) */
  balance: number;
}

export async function customerLedger(db: D1Database, customerId: string): Promise<LedgerEntry[]> {
  const cust = await db.prepare('SELECT opening_debt, created_at FROM customers WHERE id = ?')
    .bind(customerId).first<{ opening_debt: number | null; created_at: string }>();
  const rows: Omit<LedgerEntry, 'balance'>[] = [];
  if (cust?.opening_debt) {
    rows.push({ date: '', kind: 'DAU_KY', ref: 'Dư nợ cũ đầu kỳ', note: null, amount: cust.opening_debt, confirmed: true });
  }
  const orders = await db.prepare(
    `SELECT order_no, legacy_order_code, order_date, total_amount, accounting_status, note FROM orders
     WHERE customer_id = ? AND deleted_at IS NULL AND approval_status = 'APPROVED'
       AND delivery_status IN ('DA_XUAT_KHO','DA_GIAO')`,
  ).bind(customerId).all<Record<string, any>>();
  for (const o of orders.results ?? []) {
    rows.push({ date: o.order_date, kind: 'GHI_NO', ref: o.legacy_order_code || o.order_no, note: o.note ?? null,
      amount: o.total_amount ?? 0, confirmed: o.accounting_status === 'DA_XAC_NHAN' });
  }
  const pays = await db.prepare(
    `SELECT external_receipt_no, paid_at, amount, accounting_status, is_adjustment, method, note FROM payments
     WHERE customer_id = ?`,
  ).bind(customerId).all<Record<string, any>>();
  for (const p of pays.results ?? []) {
    const adj = p.is_adjustment === 1;
    rows.push({ date: p.paid_at, kind: adj ? 'DIEU_CHINH' : 'THANH_TOAN',
      ref: p.external_receipt_no || (adj ? 'Bút toán đảo' : p.method || 'Thu tiền'), note: p.note ?? null,
      amount: adj ? p.amount : -p.amount, confirmed: p.accounting_status === 'DA_XAC_NHAN' });
  }
  const rets = await db.prepare(
    `SELECT return_no, return_date, credit_amount, claimed_amount, status, reason FROM order_returns
     WHERE customer_id = ? AND status IN ('DA_NHAN_KHO','DA_GIAM_NO')`,
  ).bind(customerId).all<Record<string, any>>();
  for (const r of rets.results ?? []) {
    rows.push({ date: r.return_date, kind: 'TRA_HANG', ref: r.return_no, note: r.reason ?? null,
      amount: -(r.credit_amount || r.claimed_amount || 0), confirmed: r.status === 'DA_GIAM_NO' });
  }
  rows.sort((a, b) => (a.kind === 'DAU_KY' ? -1 : b.kind === 'DAU_KY' ? 1 : String(a.date).localeCompare(String(b.date))));
  let bal = 0;
  return rows.map((r) => {
    if (r.confirmed) bal += r.amount;
    return { ...r, balance: bal };
  });
}

export interface StatementOrder {
  id: string;
  order_no: string;
  order_date: string;
  delivered: boolean;
  total: number;
  paid: number;
  remaining: number;
}
export interface StatementPayment {
  id: string;
  paid_at: string;
  amount: number;
  method: string | null;
  receipt: string | null;
  confirmed: boolean;
  allocations: Array<{ order_no: string; amount: number }>;
  to_old_debt: number;
  to_credit: number;
}
export interface CustomerStatement {
  customer: { id: string; name: string; phone: string | null; address: string | null };
  as_of: string;
  old_debt_left: number;
  credit: number;
  orders: StatementOrder[];
  payments: StatementPayment[];
  orders_remaining: number;
  owed_total: number;
}

/**
 * Bảng đối chiếu công nợ để giải thích cho khách: các đơn còn nợ / vừa thanh toán, mỗi khoản tiền đã trừ vào đơn nào,
 * phần thừa trừ công nợ cũ hay thành số dư có. Tổng phải trả = đơn còn nợ + công nợ cũ còn lại - số dư có.
 */
export async function customerStatement(db: D1Database, customerId: string, asOf: string): Promise<CustomerStatement> {
  const cust = await db
    .prepare('SELECT id, name, phone_text, address, province, opening_debt FROM customers WHERE id = ? AND deleted_at IS NULL')
    .bind(customerId)
    .first<{ id: string; name: string; phone_text: string | null; address: string | null; province: string | null; opening_debt: number | null }>();
  if (!cust) throw new Error('Không thấy khách');
  const ords = await db
    .prepare(
      `SELECT o.id, o.order_no, o.legacy_order_code, o.order_date, o.delivery_status, o.total_amount, o.cod_amount,
              COALESCE(a.received, 0) AS received
       FROM orders o
       LEFT JOIN (SELECT pa.order_id AS order_id,
                         SUM(CASE WHEN p.is_adjustment = 1 THEN -pa.amount ELSE pa.amount END) AS received
                  FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id
                  WHERE pa.reversed_at IS NULL GROUP BY pa.order_id) a ON a.order_id = o.id
       WHERE o.customer_id = ? AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND o.delivery_status <> 'HOAN'
       ORDER BY o.order_date ASC, o.created_at ASC`,
    )
    .bind(customerId)
    .all<{ id: string; order_no: string; legacy_order_code: string | null; order_date: string; delivery_status: string; total_amount: number; cod_amount: number | null; received: number }>();
  const names = new Map<string, string>();
  const allOrders: StatementOrder[] = (ords.results ?? []).map((o) => {
    const no = o.legacy_order_code || o.order_no;
    names.set(o.id, no);
    const paid = (o.received ?? 0) + (o.cod_amount ?? 0);
    return {
      id: o.id,
      order_no: no,
      order_date: o.order_date,
      delivered: o.delivery_status === 'DA_XUAT_KHO' || o.delivery_status === 'DA_GIAO',
      total: o.total_amount,
      paid,
      remaining: o.total_amount - paid,
    };
  });
  // Đơn còn nợ + đơn đã trả đủ trong 120 ngày gần đây.
  const cutoff = new Date(new Date(asOf + 'T00:00:00Z').getTime() - 120 * 864e5).toISOString().slice(0, 10);
  const orders = allOrders.filter((o) => o.remaining > 0 || o.order_date >= cutoff);

  const pays = await db
    .prepare(
      `SELECT p.id, p.paid_at, p.amount, p.method, p.external_receipt_no, p.accounting_status, p.is_adjustment, p.purpose
       FROM payments p WHERE p.customer_id = ? AND p.is_adjustment = 0 AND p.paid_at >= ? ORDER BY p.paid_at ASC, p.created_at ASC`,
    )
    .bind(customerId, cutoff)
    .all<{ id: string; paid_at: string; amount: number; method: string | null; external_receipt_no: string | null; accounting_status: string; is_adjustment: number; purpose: string }>();
  const allocRows = await db
    .prepare(
      `SELECT pa.payment_id, pa.order_id, pa.amount FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id
       WHERE p.customer_id = ? AND pa.reversed_at IS NULL`,
    )
    .bind(customerId)
    .all<{ payment_id: string; order_id: string; amount: number }>();
  const byPay = new Map<string, Array<{ order_no: string; amount: number }>>();
  for (const r of allocRows.results ?? []) {
    const arr = byPay.get(r.payment_id) ?? [];
    arr.push({ order_no: names.get(r.order_id) ?? r.order_id, amount: r.amount });
    byPay.set(r.payment_id, arr);
  }
  // Phần chưa trừ đơn nào: trừ công nợ cũ trước, hết nợ cũ thì thành số dư có (làm tuần tự theo ngày).
  let oldLeft = cust.opening_debt ?? 0;
  const everPays = await db
    .prepare('SELECT id, amount, purpose, paid_at FROM payments WHERE customer_id = ? AND is_adjustment = 0 ORDER BY paid_at ASC, created_at ASC')
    .bind(customerId)
    .all<{ id: string; amount: number; purpose: string; paid_at: string }>();
  const split = new Map<string, { old: number; credit: number }>();
  for (const p of everPays.results ?? []) {
    const allocated = (byPay.get(p.id) ?? []).reduce((n, x) => n + x.amount, 0);
    if (p.purpose === 'DEPOSIT') {
      split.set(p.id, { old: 0, credit: Math.max(0, p.amount - allocated) });
      continue;
    }
    const left = Math.max(0, p.amount - allocated);
    const toOld = Math.min(left, Math.max(0, oldLeft));
    oldLeft -= toOld;
    split.set(p.id, { old: toOld, credit: left - toOld });
  }
  const payments: StatementPayment[] = (pays.results ?? []).map((p) => ({
    id: p.id,
    paid_at: p.paid_at,
    amount: p.amount,
    method: p.method,
    receipt: p.external_receipt_no,
    confirmed: p.accounting_status === 'DA_XAC_NHAN',
    allocations: byPay.get(p.id) ?? [],
    to_old_debt: split.get(p.id)?.old ?? 0,
    to_credit: split.get(p.id)?.credit ?? 0,
  }));
  // Số dư có = các khoản tiền chưa trừ đơn nào và vượt công nợ cũ (kể cả khoản ghi từ trước khi có quy tắc tự phân bổ).
  const ordersRemaining = allOrders.reduce((n, o) => n + Math.max(0, o.remaining), 0);
  let credit = 0;
  for (const v of split.values()) credit += v.credit;
  return {
    customer: { id: cust.id, name: cust.name, phone: cust.phone_text, address: cust.address ?? cust.province },
    as_of: asOf,
    old_debt_left: Math.max(0, oldLeft),
    credit,
    orders,
    payments,
    orders_remaining: ordersRemaining,
    owed_total: ordersRemaining + Math.max(0, oldLeft) - credit,
  };
}

export interface AgingRow {
  customer_id: string;
  customer_name: string;
  owner_name: string | null;
  official_debt: number;
  /** nợ theo tuổi đơn: 0–30, 31–60, 61–90, trên 90 ngày; old = phần nợ không còn đơn nào đối ứng (dư nợ đầu kỳ cũ) */
  b30: number;
  b60: number;
  b90: number;
  b90p: number;
  old: number;
  oldest_days: number;
}

export interface DebtAging {
  as_of: string;
  rows: AgingRow[];
  totals: { debt: number; b30: number; b60: number; b90: number; b90p: number; old: number };
  rev90: number;
  dso: number | null;
}

/**
 * Tuổi nợ phải thu (khách B2B). Tiền khách trả kế toán trừ thẳng vào công nợ chứ không gán từng đơn, nên tuổi nợ tính theo
 * cách vào trước trả trước: phần nợ còn lại được xếp vào các đơn MỚI nhất, đơn cũ coi như đã trả trước. Tuổi tính từ ngày đơn.
 * DSO (số ngày thu tiền bình quân) = tổng nợ chính thức ÷ doanh thu đơn đã xác nhận 90 ngày gần nhất × 90.
 */
export async function debtAging(db: D1Database, scopeSql: string, scopeParams: unknown[], asOf: string): Promise<DebtAging> {
  const list = (await listDebts(db, scopeSql, scopeParams, { onlyWithDebt: true })).filter((d) => d.official_debt > 0);
  const ids = new Set(list.map((d) => d.customer_id));
  const orders = await db
    .prepare(
      `SELECT o.customer_id, o.order_date, o.total_amount FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND o.accounting_status = 'DA_XAC_NHAN'
         AND o.delivery_status IN ('DA_XUAT_KHO','DA_GIAO') AND c.deleted_at IS NULL AND ${scopeSql}
       ORDER BY o.order_date DESC`,
    )
    .bind(...scopeParams)
    .all<{ customer_id: string; order_date: string; total_amount: number }>();
  const by = new Map<string, Array<{ order_date: string; total_amount: number }>>();
  const t0 = new Date(`${asOf}T00:00:00Z`).getTime();
  const since = new Date(t0 - 90 * 864e5).toISOString().slice(0, 10);
  let rev90 = 0;
  for (const o of orders.results ?? []) {
    if (o.order_date >= since && o.order_date <= asOf) rev90 += o.total_amount || 0;
    if (!ids.has(o.customer_id)) continue;
    const a = by.get(o.customer_id) ?? [];
    a.push(o);
    by.set(o.customer_id, a);
  }
  const rows: AgingRow[] = list.map((d) => {
    const r: AgingRow = { customer_id: d.customer_id, customer_name: d.customer_name, owner_name: d.owner_name ?? null, official_debt: d.official_debt, b30: 0, b60: 0, b90: 0, b90p: 0, old: 0, oldest_days: 0 };
    let left = d.official_debt;
    for (const o of by.get(d.customer_id) ?? []) {
      if (left <= 0) break;
      const take = Math.min(left, o.total_amount || 0);
      if (take <= 0) continue;
      left -= take;
      const days = Math.max(0, Math.round((t0 - new Date(`${o.order_date}T00:00:00Z`).getTime()) / 864e5));
      if (days > r.oldest_days) r.oldest_days = days;
      if (days <= 30) r.b30 += take;
      else if (days <= 60) r.b60 += take;
      else if (days <= 90) r.b90 += take;
      else r.b90p += take;
    }
    if (left > 0) r.old = left;
    return r;
  });
  rows.sort((a, b) => b.b90p + b.old - (a.b90p + a.old) || b.official_debt - a.official_debt);
  const totals = rows.reduce((t, r) => ({ debt: t.debt + r.official_debt, b30: t.b30 + r.b30, b60: t.b60 + r.b60, b90: t.b90 + r.b90, b90p: t.b90p + r.b90p, old: t.old + r.old }), { debt: 0, b30: 0, b60: 0, b90: 0, b90p: 0, old: 0 });
  return { as_of: asOf, rows, totals, rev90, dso: rev90 > 0 ? Math.round((totals.debt / rev90) * 90) : null };
}

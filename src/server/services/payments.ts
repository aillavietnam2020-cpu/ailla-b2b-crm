import { nowIso, vnDate } from '@shared/datetime';
import { derivePaymentStatus } from '@shared/orders';
import type { PaymentCreateInput } from '@shared/schemas';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { eventStatement } from '../lib/events';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { ALLOCATED_BY_PAYMENT, RECEIVED_BY_ORDER } from '../lib/sql';

export interface PaymentRow {
  id: string;
  external_receipt_no: string | null;
  customer_id: string;
  customer_name: string;
  amount: number;
  paid_at: string;
  method: string | null;
  accounting_status: string;
  review_status: string;
  is_general_repayment: number;
  is_adjustment: number;
  allocated: number;
  note: string | null;
}

export async function listPayments(
  db: D1Database,
  scopeSql: string,
  scopeParams: unknown[],
  filters: { customerId?: string; orderId?: string; pendingOnly?: boolean; limit?: number },
): Promise<PaymentRow[]> {
  const where: string[] = [scopeSql];
  const params: unknown[] = [...scopeParams];
  if (filters.customerId) {
    where.push('p.customer_id = ?');
    params.push(filters.customerId);
  }
  if (filters.orderId) {
    where.push('p.id IN (SELECT payment_id FROM payment_allocations WHERE order_id = ?)');
    params.push(filters.orderId);
  }
  if (filters.pendingOnly) {
    where.push(`(p.is_general_repayment = 1 OR p.review_status = 'NEEDS_REVIEW'
                 OR p.amount > COALESCE(a.allocated, 0))`);
  }

  const rows = await db
    .prepare(
      `SELECT p.id, p.external_receipt_no, p.customer_id, c.name AS customer_name, p.amount, p.paid_at,
              p.method, p.accounting_status, p.review_status, p.is_general_repayment, p.is_adjustment, p.note, p.created_by,
              COALESCE(a.allocated, 0) AS allocated
       FROM payments p
       JOIN customers c ON c.id = p.customer_id
       LEFT JOIN (SELECT payment_id, SUM(amount) AS allocated FROM payment_allocations
                  WHERE reversed_at IS NULL GROUP BY payment_id) a ON a.payment_id = p.id
       WHERE ${where.join(' AND ')}
       ORDER BY p.paid_at DESC LIMIT ?`,
    )
    .bind(...params, filters.limit ?? 100)
    .all<PaymentRow>();
  return rows.results ?? [];
}

/**
 * Tiền của khách là của KHÁCH, ghi ở đơn hay ở công nợ đều như nhau. Thứ tự trừ:
 *  1. Đơn kế toán chọn (nếu có), tối đa bằng phần còn phải thu của đơn đó;
 *  2. các đơn còn phải thu khác của khách, ĐƠN ĐẶT TRƯỚC TRỪ TRƯỚC;
 *  3. hết đơn mà vẫn còn thừa: giữ lại ở khách, tự trừ vào công nợ cũ; không còn công nợ cũ thì khách đang dư tiền (công ty nợ khách).
 * Thiếu so với đơn thì đơn vẫn còn phần chưa trả, nằm trong công nợ của khách.
 */
/** Dấu "phần tiền thừa của khoản này đã được xử lý (trừ nợ cũ / thành số dư có)": mỗi khoản chỉ xử lý MỘT lần, kẻo cộng số dư có nhiều lần. */
export const LEFTOVER_SETTLED_ACTION = 'PAYMENT_LEFTOVER_SETTLED';
export const NOT_LEFTOVER_SETTLED_SQL = `NOT EXISTS (SELECT 1 FROM audit_logs al WHERE al.entity_type = 'PAYMENT' AND al.entity_id = p.id AND al.action = '${LEFTOVER_SETTLED_ACTION}')`;

async function openOrdersOf(db: D1Database, customerId: string): Promise<Array<{ id: string; remaining: number }>> {
  const rows = await db
    .prepare(
      `SELECT o.id, o.total_amount - COALESCE(o.cod_amount, 0) - COALESCE(a.received, 0) AS remaining
       FROM orders o LEFT JOIN (${RECEIVED_BY_ORDER}) a ON a.order_id = o.id
       WHERE o.customer_id = ? AND o.deleted_at IS NULL AND o.approval_status IN ('APPROVED', 'PENDING_APPROVAL')
         AND o.delivery_status <> 'HOAN'
       ORDER BY o.order_date ASC, o.created_at ASC`,
    )
    .bind(customerId)
    .all<{ id: string; remaining: number }>();
  return (rows.results ?? []).filter((r) => r.remaining > 0);
}

/**
 * Đơn mà khoản tiền này ĐÃ NÊU RÕ: bill của khoản tiền gắn với đơn nào, hoặc ghi chú/giải thích có mã đơn của khách.
 * Khoản tiền khách chuyển cho một đơn cụ thể thì trừ đúng đơn đó trước; phần dư mới chia theo đơn cũ nhất.
 */
export async function namedOrdersOf(
  db: D1Database,
  customerId: string,
  payments: Array<{ id: string; note: string | null; explanation: string | null }>,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!payments.length) return out;
  const add = (pid: string, oid: string) => {
    const l = out.get(pid) ?? [];
    if (!l.includes(oid)) l.push(oid);
    out.set(pid, l);
  };
  const ids = new Set(payments.map((p) => p.id));
  const bills = await db
    .prepare(`SELECT payment_id, order_id FROM bills WHERE customer_id = ? AND deleted_at IS NULL AND payment_id IS NOT NULL AND order_id IS NOT NULL`)
    .bind(customerId)
    .all<{ payment_id: string; order_id: string }>();
  for (const b of bills.results ?? []) if (ids.has(b.payment_id)) add(b.payment_id, b.order_id);
  const orders = await db
    .prepare(`SELECT id, order_no FROM orders WHERE customer_id = ? AND deleted_at IS NULL AND order_no IS NOT NULL AND length(order_no) >= 6`)
    .bind(customerId)
    .all<{ id: string; order_no: string }>();
  for (const p of payments) {
    const text = `${p.note ?? ''} ${p.explanation ?? ''}`.toUpperCase();
    if (!text.trim()) continue;
    for (const o of orders.results ?? []) if (text.includes(o.order_no.toUpperCase())) add(p.id, o.id);
  }
  return out;
}

async function planAutoAllocation(
  db: D1Database,
  customerId: string,
  amount: number,
  preferred: Array<{ order_id: string; amount: number }>,
): Promise<Array<{ order_id: string; amount: number }>> {
  const open = await openOrdersOf(db, customerId);
  const remainingOf = new Map(open.map((r) => [r.id, r.remaining]));
  const plan: Array<{ order_id: string; amount: number }> = [];
  let left = amount;
  const put = (orderId: string, want: number) => {
    const room = remainingOf.get(orderId) ?? 0;
    const take = Math.min(left, want, room);
    if (take > 0) {
      plan.push({ order_id: orderId, amount: take });
      remainingOf.set(orderId, room - take);
      left -= take;
    }
  };
  for (const pref of preferred) put(pref.order_id, pref.amount > 0 ? pref.amount : Number.MAX_SAFE_INTEGER);
  for (const r of open) if (left > 0) put(r.id, Number.MAX_SAFE_INTEGER);
  return plan;
}

/** Còn thừa sau khi trừ hết đơn: trừ vào công nợ cũ; hết công nợ cũ thì ghi nhận công ty đang nợ khách (số dư có của khách). */
async function settleLeftover(
  db: D1Database,
  customerId: string,
  paymentId: string,
  amount: number,
  allocated: number,
  actor: { actorId: string | null; requestId: string; ip: string | null },
) {
  const leftover = amount - allocated;
  if (leftover <= 0) return { to_old: 0, to_credit: 0 };
  const cust = await db.prepare('SELECT opening_debt FROM customers WHERE id = ?').bind(customerId).first<{ opening_debt: number }>();
  const prior = await db
    .prepare(
      `SELECT COALESCE(SUM(p.amount - COALESCE(a.allocated, 0)), 0) AS free
       FROM payments p LEFT JOIN (${ALLOCATED_BY_PAYMENT}) a ON a.payment_id = p.id
       WHERE p.customer_id = ? AND p.id <> ? AND p.is_adjustment = 0 AND p.purpose <> 'DEPOSIT'`,
    )
    .bind(customerId, paymentId)
    .first<{ free: number }>();
  const oldDebtLeft = Math.max(0, (cust?.opening_debt ?? 0) - (prior?.free ?? 0));
  const toOld = Math.min(leftover, oldDebtLeft);
  const toCredit = leftover - toOld;
  const stmts: D1PreparedStatement[] = [];
  if (toCredit > 0) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO customer_credit_balances (id, customer_id, amount, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (customer_id) DO UPDATE SET amount = amount + excluded.amount, updated_at = excluded.updated_at`,
        )
        .bind(newId(), customerId, toCredit, nowIso()),
    );
  }
  stmts.push(
    auditStatement(db, {
      actorId: actor.actorId,
      action: LEFTOVER_SETTLED_ACTION,
      entityType: 'PAYMENT',
      entityId: paymentId,
      after: { to_old_debt: toOld, to_credit: toCredit },
      requestId: actor.requestId,
      ip: actor.ip,
    }),
  );
  await db.batch(stmts);
  return { to_old: toOld, to_credit: toCredit };
}

/**
 * Kế toán bấm "Tự chia vào đơn" cho một khoản tiền đã ghi mà chưa trừ hết vào đơn: chia theo thứ tự ưu tiên
 * (đơn đặt trước trừ trước), phần thừa trừ công nợ cũ, hết nợ cũ thì thành số dư có của khách.
 */
export async function autoAllocatePayment(
  db: D1Database,
  auth: AuthContext,
  paymentId: string,
  ctx: { requestId: string; ip: string | null },
  opts: { skipIfNoOrders?: boolean } = {},
): Promise<{ allocated: number; to_old_debt: number; to_credit: number; skipped?: boolean }> {
  if (!auth.permissions.includes('payment.allocate')) throw forbidden('Cần quyền phân bổ tiền để làm việc này.');
  const p = await db
    .prepare(
      `SELECT p.id, p.customer_id, p.amount, p.is_adjustment, p.purpose, p.note, p.explanation, COALESCE(a.allocated, 0) AS allocated
       FROM payments p LEFT JOIN (${ALLOCATED_BY_PAYMENT}) a ON a.payment_id = p.id WHERE p.id = ?`,
    )
    .bind(paymentId)
    .first<{ id: string; customer_id: string; amount: number; is_adjustment: number; purpose: string; note: string | null; explanation: string | null; allocated: number }>();
  if (!p) throw notFound('Không tìm thấy khoản tiền');
  if (p.is_adjustment || p.purpose === 'DEPOSIT') throw unprocessable('NOT_ALLOCATABLE', 'Khoản này (đặt cọc / bút toán đảo) không tự chia vào đơn.');
  const free = p.amount - p.allocated;
  if (free <= 0) return { allocated: 0, to_old_debt: 0, to_credit: 0 };
  const done = await db
    .prepare(`SELECT 1 AS x FROM audit_logs WHERE entity_type = 'PAYMENT' AND entity_id = ? AND action = ? LIMIT 1`)
    .bind(paymentId, LEFTOVER_SETTLED_ACTION)
    .first();
  const named = (await namedOrdersOf(db, p.customer_id, [p])).get(p.id) ?? [];
  const plan = await planAutoAllocation(db, p.customer_id, free, named.map((order_id) => ({ order_id, amount: 0 })));
  // Phần thừa của khoản này đã được xử lý (trừ nợ cũ / số dư có) rồi: chỉ còn chia được vào đơn mới, không cộng số dư có lần nữa.
  if (done && !plan.length) return { allocated: 0, to_old_debt: 0, to_credit: 0, skipped: true };
  if (opts.skipIfNoOrders && !plan.length) return { allocated: 0, to_old_debt: 0, to_credit: 0, skipped: true };
  let allocated = 0;
  if (plan.length) {
    await allocatePayment(db, auth, paymentId, plan, ctx);
    allocated = plan.reduce((n, x) => n + x.amount, 0);
  }
  if (done) return { allocated, to_old_debt: 0, to_credit: 0 };
  const left = await settleLeftover(db, p.customer_id, paymentId, free, allocated, {
    actorId: auth.user.id,
    requestId: ctx.requestId,
    ip: ctx.ip,
  });
  return { allocated, to_old_debt: left.to_old, to_credit: left.to_credit };
}

/**
 * Bill đã gắn đơn này nhưng khoản tiền ghi lúc đơn chưa duyệt nên chưa trừ vào đơn (hoặc trừ thiếu):
 * đơn đã duyệt thì trừ đúng khoản đó vào đơn. Phần tiền thừa lúc đó đã tính vào số dư có của khách thì trả lại cho khớp.
 */
export async function applyNamedPaymentsToOrder(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  ctx: { requestId: string; ip: string | null },
): Promise<number> {
  const o = await db
    .prepare(
      `SELECT o.id, o.customer_id, o.total_amount - COALESCE(o.cod_amount, 0) - COALESCE(a.received, 0) AS remaining
       FROM orders o LEFT JOIN (${RECEIVED_BY_ORDER}) a ON a.order_id = o.id
       WHERE o.id = ? AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND o.delivery_status <> 'HOAN'`,
    )
    .bind(orderId)
    .first<{ id: string; customer_id: string; remaining: number }>();
  if (!o || o.remaining <= 0) return 0;
  const rows = await db
    .prepare(
      `SELECT DISTINCT p.id, p.amount - COALESCE(a.allocated, 0) AS free
       FROM bills b JOIN payments p ON p.id = b.payment_id
       LEFT JOIN (${ALLOCATED_BY_PAYMENT}) a ON a.payment_id = p.id
       WHERE b.order_id = ? AND b.deleted_at IS NULL AND p.customer_id = ? AND p.is_adjustment = 0 AND p.purpose <> 'DEPOSIT'
         AND p.amount > COALESCE(a.allocated, 0)
       ORDER BY p.paid_at ASC, p.created_at ASC`,
    )
    .bind(orderId, o.customer_id)
    .all<{ id: string; free: number }>();
  let left = o.remaining;
  let applied = 0;
  for (const r of rows.results ?? []) {
    if (left <= 0) break;
    const take = Math.min(left, r.free);
    if (take <= 0) continue;
    await allocatePayment(db, auth, r.id, [{ order_id: orderId, amount: take }], ctx);
    const st = await db
      .prepare(`SELECT after_json FROM audit_logs WHERE entity_type = 'PAYMENT' AND entity_id = ? AND action = ? ORDER BY created_at DESC LIMIT 1`)
      .bind(r.id, LEFTOVER_SETTLED_ACTION)
      .first<{ after_json: string | null }>()
      .catch(() => null);
    let credited = 0;
    try {
      credited = Number(JSON.parse(st?.after_json ?? '{}').to_credit ?? 0) || 0;
    } catch {
      credited = 0;
    }
    const back = Math.min(take, credited);
    if (back > 0) {
      await db
        .prepare('UPDATE customer_credit_balances SET amount = MAX(0, amount - ?), updated_at = ? WHERE customer_id = ?')
        .bind(back, nowIso(), o.customer_id)
        .run();
    }
    left -= take;
    applied += take;
  }
  return applied;
}

/**
 * Khách đặt cọc THẬT: tiền cọc nằm ở khách; khi đơn đã đi (xuất kho) thì trừ cọc còn dư vào đơn đó (cọc cũ trừ trước),
 * đơn nào cũng vậy. Tổng công nợ của khách không đổi (cọc vốn đã trừ nợ), chỉ là đơn hiện đúng đã thu bao nhiêu.
 * Trả về số tiền cọc đã trừ vào đơn.
 */
export async function applyDepositsToOrder(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  ctx: { requestId: string; ip: string | null },
): Promise<number> {
  const o = await db
    .prepare(
      `SELECT o.id, o.customer_id, o.total_amount - COALESCE(o.cod_amount, 0) - COALESCE(a.received, 0) AS remaining
       FROM orders o LEFT JOIN (${RECEIVED_BY_ORDER}) a ON a.order_id = o.id
       WHERE o.id = ? AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED'`,
    )
    .bind(orderId)
    .first<{ id: string; customer_id: string; remaining: number }>();
  if (!o || o.remaining <= 0) return 0;
  const named = await applyNamedPaymentsToOrder(db, auth, orderId, ctx);
  if (named >= o.remaining) return named;
  o.remaining -= named;
  const deps = await db
    .prepare(
      `SELECT p.id, p.amount - COALESCE(a.allocated, 0) AS free
       FROM payments p LEFT JOIN (${ALLOCATED_BY_PAYMENT}) a ON a.payment_id = p.id
       WHERE p.customer_id = ? AND p.purpose = 'DEPOSIT' AND p.is_adjustment = 0 AND p.amount > COALESCE(a.allocated, 0)
       ORDER BY p.paid_at ASC, p.created_at ASC`,
    )
    .bind(o.customer_id)
    .all<{ id: string; free: number }>();
  let left = o.remaining;
  let applied = 0;
  for (const d of deps.results ?? []) {
    if (left <= 0) break;
    const take = Math.min(left, d.free);
    if (take <= 0) continue;
    await allocatePayment(db, auth, d.id, [{ order_id: orderId, amount: take }], ctx);
    left -= take;
    applied += take;
  }
  return applied + named;
}

/**
 * Tự chia hàng loạt các khoản tiền đã ghi mà chưa trừ hết vào đơn (khoản ghi từ trước khi có quy tắc tự phân bổ).
 * Làm từng đợt nhỏ (limit) để không quá tải; trả số khoản còn lại để bấm tiếp.
 */
export async function autoAllocateBatch(
  db: D1Database,
  auth: AuthContext,
  limit: number,
  ctx: { requestId: string; ip: string | null },
): Promise<{ processed: number; allocated: number; to_old_debt: number; to_credit: number; remaining: number }> {
  const where = `p.is_adjustment = 0 AND p.purpose <> 'DEPOSIT' AND p.amount > COALESCE(a.allocated, 0) AND ${NOT_LEFTOVER_SETTLED_SQL}`;
  const q = `SELECT p.id FROM payments p LEFT JOIN (${ALLOCATED_BY_PAYMENT}) a ON a.payment_id = p.id WHERE ${where} ORDER BY p.paid_at ASC, p.created_at ASC`;
  const rows = await db.prepare(`${q} LIMIT 300`).all<{ id: string }>();
  const max = Math.max(1, Math.min(limit, 25));
  let allocated = 0;
  let toOld = 0;
  let toCredit = 0;
  let processed = 0;
  for (const r of rows.results ?? []) {
    if (processed >= max) break;
    try {
      const x = await autoAllocatePayment(db, auth, r.id, ctx, { skipIfNoOrders: true });
      if (x.skipped) continue;
      allocated += x.allocated;
      toOld += x.to_old_debt;
      toCredit += x.to_credit;
      processed += 1;
    } catch (e) {
      console.error('[auto-allocate]', r.id, e);
    }
  }
  const pre = await previewAutoAllocate(db);
  return { processed, allocated, to_old_debt: toOld, to_credit: toCredit, remaining: pre.with_orders.n };
}

export interface AutoAllocateGroupRow {
  customer_id: string;
  customer_name: string;
  n: number;
  to_orders: number;
  to_old_debt: number;
  to_credit: number;
  credit_now: number;
}
export interface AutoAllocatePreview {
  /** Số khoản đã nêu rõ đơn (bill gắn đơn / ghi chú có mã đơn): trừ đúng đơn đó trước. */
  named_n: number;
  with_orders: { n: number; to_orders: number; to_old_debt: number; to_credit: number; customers: AutoAllocateGroupRow[] };
  leftover_only: { n: number; amount: number; customers: AutoAllocateGroupRow[] };
}

/**
 * Xem trước (KHÔNG ghi gì): các khoản tiền chưa chia hết sẽ đi đâu nếu bấm "Chia vào đơn".
 *  - with_orders: khoản còn đơn thiếu tiền để chia vào.
 *  - leftover_only: khoản khách không còn đơn nào thiếu, chỉ còn tiền thừa (thường đã tính vào số dư có / trừ nợ cũ lúc ghi).
 */
export async function previewAutoAllocate(db: D1Database): Promise<AutoAllocatePreview> {
  const rows = await db
    .prepare(
      `SELECT p.id, p.customer_id, c.name AS customer_name, c.opening_debt AS opening_debt,
              p.note, p.explanation, p.amount - COALESCE(a.allocated, 0) AS free, (${NOT_LEFTOVER_SETTLED_SQL}) AS unsettled
       FROM payments p JOIN customers c ON c.id = p.customer_id
       LEFT JOIN (${ALLOCATED_BY_PAYMENT}) a ON a.payment_id = p.id
       WHERE p.is_adjustment = 0 AND p.purpose <> 'DEPOSIT' AND p.amount > COALESCE(a.allocated, 0)
       ORDER BY p.customer_id, p.paid_at ASC, p.created_at ASC`,
    )
    .all<{ id: string; customer_id: string; customer_name: string; opening_debt: number; free: number; unsettled: number; note: string | null; explanation: string | null }>();
  const credits = new Map<string, number>();
  for (const r of (await db.prepare('SELECT customer_id, amount FROM customer_credit_balances').all<{ customer_id: string; amount: number }>()).results ?? []) {
    credits.set(r.customer_id, r.amount);
  }
  const byCustomer = new Map<string, typeof rows.results>();
  for (const r of rows.results ?? []) {
    const list = byCustomer.get(r.customer_id) ?? [];
    list.push(r);
    byCustomer.set(r.customer_id, list);
  }
  const A = new Map<string, AutoAllocateGroupRow>();
  const B = new Map<string, AutoAllocateGroupRow>();
  const bump = (m: Map<string, AutoAllocateGroupRow>, r: { customer_id: string; customer_name: string }, d: Partial<AutoAllocateGroupRow>) => {
    const g = m.get(r.customer_id) ?? { customer_id: r.customer_id, customer_name: r.customer_name, n: 0, to_orders: 0, to_old_debt: 0, to_credit: 0, credit_now: credits.get(r.customer_id) ?? 0 };
    g.n += d.n ?? 0;
    g.to_orders += d.to_orders ?? 0;
    g.to_old_debt += d.to_old_debt ?? 0;
    g.to_credit += d.to_credit ?? 0;
    m.set(r.customer_id, g);
  };
  let namedCount = 0;
  for (const [customerId, list] of byCustomer) {
    if (!list.some((r) => r.unsettled)) continue;
    const remaining = new Map((await openOrdersOf(db, customerId)).map((o) => [o.id, o.remaining]));
    let totalFree = list.reduce((n, r) => n + r.free, 0);
    const named = await namedOrdersOf(db, customerId, list);
    for (const r of list) {
      if (!r.unsettled) continue;
      let left = r.free;
      let toOrders = 0;
      const pref = named.get(r.id) ?? [];
      const order = [...pref.filter((id) => remaining.has(id)), ...[...remaining.keys()].filter((id) => !pref.includes(id))];
      if (pref.length) namedCount += 1;
      for (const id of order) {
        const room = remaining.get(id) ?? 0;
        if (left <= 0) break;
        const take = Math.min(left, room);
        if (take > 0) {
          remaining.set(id, room - take);
          left -= take;
          toOrders += take;
        }
      }
      const leftover = r.free - toOrders;
      const prior = totalFree - r.free;
      const toOld = Math.min(leftover, Math.max(0, r.opening_debt - prior));
      const toCredit = leftover - toOld;
      totalFree -= toOrders;
      if (toOrders > 0) bump(A, r, { n: 1, to_orders: toOrders, to_old_debt: toOld, to_credit: toCredit });
      else bump(B, r, { n: 1, to_old_debt: r.free });
    }
  }
  const arr = (m: Map<string, AutoAllocateGroupRow>) => [...m.values()].sort((x, y) => y.to_orders + y.to_old_debt + y.to_credit - (x.to_orders + x.to_old_debt + x.to_credit));
  const a = arr(A);
  const b = arr(B);
  return {
    named_n: namedCount,
    with_orders: {
      n: a.reduce((n, x) => n + x.n, 0),
      to_orders: a.reduce((n, x) => n + x.to_orders, 0),
      to_old_debt: a.reduce((n, x) => n + x.to_old_debt, 0),
      to_credit: a.reduce((n, x) => n + x.to_credit, 0),
      customers: a.slice(0, 60),
    },
    leftover_only: { n: b.reduce((n, x) => n + x.n, 0), amount: b.reduce((n, x) => n + x.to_old_debt, 0), customers: b.slice(0, 60) },
  };
}

/**
 * Kế toán đã kiểm: các khoản chỉ còn tiền thừa (khách không còn đơn nào thiếu) được giữ nguyên số tiền, chỉ bỏ khỏi danh sách việc.
 * KHÔNG đổi số dư có, KHÔNG đổi đơn nào; chỉ ghi dấu "đã xử lý phần thừa" vào nhật ký.
 */
export async function markLeftoverReviewed(
  db: D1Database,
  auth: AuthContext,
  ctx: { requestId: string; ip: string | null },
): Promise<{ marked: number }> {
  if (!auth.permissions.includes('payment.allocate')) throw forbidden('Cần quyền phân bổ tiền để làm việc này.');
  const rows = await db
    .prepare(
      `SELECT p.id, p.customer_id, p.amount - COALESCE(a.allocated, 0) AS free
       FROM payments p LEFT JOIN (${ALLOCATED_BY_PAYMENT}) a ON a.payment_id = p.id
       WHERE p.is_adjustment = 0 AND p.purpose <> 'DEPOSIT' AND p.amount > COALESCE(a.allocated, 0) AND ${NOT_LEFTOVER_SETTLED_SQL}`,
    )
    .all<{ id: string; customer_id: string; free: number }>();
  const hasRoom = new Map<string, boolean>();
  const stmts: D1PreparedStatement[] = [];
  for (const r of rows.results ?? []) {
    if (!hasRoom.has(r.customer_id)) hasRoom.set(r.customer_id, (await openOrdersOf(db, r.customer_id)).length > 0);
    if (hasRoom.get(r.customer_id)) continue;
    stmts.push(
      auditStatement(db, {
        actorId: auth.user.id,
        action: LEFTOVER_SETTLED_ACTION,
        entityType: 'PAYMENT',
        entityId: r.id,
        after: { kept: r.free },
        reason: 'Kế toán đã kiểm, giữ nguyên số tiền, bỏ khỏi danh sách việc',
        requestId: ctx.requestId,
        ip: ctx.ip,
      }),
    );
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  return { marked: stmts.length };
}

/**
 * Ghi nhận tiền khách trả (mục 9).
 * - Có chọn đơn: phân bổ ngay.
 * - Không chọn đơn: coi là "trả nợ chung", vào hàng chờ phân bổ, CHƯA trừ nợ từng đơn.
 * Chỉ khoản đã được kế toán xác nhận mới trừ vào công nợ chính thức.
 */
export async function recordPayment(
  db: D1Database,
  auth: AuthContext,
  input: PaymentCreateInput,
  ctx: { requestId: string; ip: string | null },
): Promise<{ id: string; pending_allocation: boolean }> {
  const customer = await db
    .prepare('SELECT id, name FROM customers WHERE id = ? AND deleted_at IS NULL')
    .bind(input.customer_id)
    .first<{ id: string; name: string }>();
  if (!customer) throw notFound('Không tìm thấy khách hàng');

  const paymentId = newId();
  const now = nowIso();
  const paidAt = input.paid_at ?? vnDate();
  const isAdjustment = Boolean(input.is_adjustment) || input.amount < 0;
  // Database chỉ lưu số DƯƠNG; ý nghĩa trừ đi nằm ở cờ is_adjustment (mục 9.2).
  const amount = Math.abs(input.amount);
  let allocations = (input.allocations ?? []).map((a) => ({
    order_id: a.order_id,
    amount: Math.abs(a.amount),
  }));
  // Bút toán đảo luôn phải chỉ rõ đơn cần trừ lại, không được để dạng "trả nợ chung".
  // Không còn "trả nợ chung chờ phân bổ": tiền tự phân bổ ngay theo thứ tự ưu tiên (xem planAutoAllocation).
  const isGeneral = false;
  // Sale chỉ được TÍCH "tiền về"; khoản này nằm ở nhóm "chờ tiền về" cho tới khi kế toán
  // xác nhận. Chỉ tài khoản có quyền kế toán mới xác nhận ngay lúc ghi nhận.
  const canConfirm = auth.permissions.includes('order.accounting.confirm');
  const method = input.method ?? null;
  const purpose = input.purpose ?? 'ORDER';
  const explanation = (input.explanation ?? '').trim();
  const bankRef = (input.bank_ref ?? '').trim() || null;
  const receiverName = (input.receiver_name ?? '').trim() || null;
  // Tiền mặt chưa có ảnh phiếu thu ký tên thì chưa xác nhận ngay được (ảnh gửi sau khi ghi khoản).
  const accountingStatus =
    input.accounting_confirmed && canConfirm && method !== 'Tiền mặt' ? 'DA_XAC_NHAN' : 'CHUA_XAC_NHAN';

  // --- Quy tắc kế toán cho khoản tiền về ---
  if (method === 'Tiền mặt' && !isAdjustment && !receiverName) {
    throw unprocessable('RECEIVER_REQUIRED', 'Tiền mặt: ghi tên người nhận tiền.', {
      receiver_name: 'Bắt buộc với tiền mặt',
    });
  }
  if (purpose === 'DEPOSIT' && allocations.length > 0) {
    throw unprocessable('DEPOSIT_NO_ORDER', 'Tiền đặt cọc / ứng trước chưa gắn vào đơn nào.', {
      allocations: 'Bỏ phân bổ',
    });
  }
  if (bankRef) {
    const dup = await db
      .prepare(
        `SELECT p.paid_at, p.amount, c.name FROM payments p JOIN customers c ON c.id = p.customer_id
         WHERE p.bank_ref = ?`,
      )
      .bind(bankRef)
      .first<{ paid_at: string; amount: number; name: string }>();
    if (dup) {
      throw conflict(
        'DUPLICATE_BANK_REF',
        `Bill này (số tham chiếu ${bankRef}) đã được ghi cho khách ${dup.name}, ${dup.amount.toLocaleString('vi-VN')}đ ngày ${dup.paid_at}. Không ghi hai lần.`,
      );
    }
  }
  if (input.receiving_account_id) {
    const acc = await db
      .prepare('SELECT id FROM receiving_accounts WHERE id = ? AND active = 1')
      .bind(input.receiving_account_id)
      .first();
    if (!acc) throw unprocessable('BAD_ACCOUNT', 'Tài khoản nhận không có trong danh sách hợp lệ.', { receiving_account_id: 'Không hợp lệ' });
  }
  // Tiền thường (không phải đặt cọc, không phải bút toán đảo): tự phân bổ ngay theo thứ tự ưu tiên.
  if (!isAdjustment && purpose !== 'DEPOSIT') {
    allocations = await planAutoAllocation(db, customer.id, amount, allocations);
  }
  if (!isAdjustment && purpose === 'DEPOSIT' && explanation.length < 5) {
    throw unprocessable(
      'EXPLANATION_REQUIRED',
      'Ghi giải trình cho khoản đặt cọc (ví dụ: cọc cho đơn dự kiến tuần sau).',
      { explanation: 'Bắt buộc' },
    );
  }
  const reviewReasons: string[] = [];
  if (method === 'Chuyển khoản' && !input.receiving_account_id) reviewReasons.push('Tài khoản nhận không có trong danh sách hợp lệ');
  if (method === 'Tiền mặt') reviewReasons.push('Tiền mặt: kiểm ảnh phiếu thu có chữ ký');
  const receiptNo = input.external_receipt_no ?? bankRef;
  const reviewStatus = receiptNo && reviewReasons.length === 0 ? 'OK' : 'NEEDS_REVIEW';
  const reviewReason = reviewReasons.length ? reviewReasons.join('; ') : null;

  if (isAdjustment && allocations.length === 0) {
    throw unprocessable(
      'ADJUSTMENT_NEEDS_ORDER',
      'Bút toán đảo phải chọn đúng đơn hàng cần trừ lại số tiền đã ghi nhận.',
      { allocations: 'Chọn đơn cần điều chỉnh' },
    );
  }

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO payments (id, external_receipt_no, source, external_row_key, customer_id, amount,
           paid_at, method, accounting_status, review_status, is_general_repayment, is_adjustment,
           adjustment_reason, note, created_by, created_at, updated_at,
           purpose, explanation, receiving_account_id, receiver_name, review_reason, bank_ref)
         VALUES (?, ?, 'MANUAL', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        paymentId,
        receiptNo ?? null,
        customer.id,
        amount,
        paidAt,
        method,
        accountingStatus,
        reviewStatus,
        isGeneral ? 1 : 0,
        isAdjustment ? 1 : 0,
        isAdjustment ? (input.adjustment_reason ?? 'Bút toán đảo') : null,
        input.note ?? null,
        auth.user.id,
        now,
        now,
        purpose,
        explanation || null,
        input.receiving_account_id ?? null,
        receiverName,
        reviewReason,
        bankRef,
      ),
  ];

  if (isGeneral) {
    statements.push(
      db
        .prepare(
          `INSERT INTO payment_allocations_pending (id, payment_id, customer_id, amount, reason, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
        )
        .bind(
          newId(),
          paymentId,
          customer.id,
          amount,
          'Khoản trả nợ chung - chờ phân bổ vào từng đơn',
          now,
        ),
    );
  }

  statements.push(
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'PAYMENT_RECORDED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      after: {
        customer: customer.name,
        amount,
        is_adjustment: isAdjustment,
        paid_at: paidAt,
        accounting_status: accountingStatus,
        general: isGeneral,
      },
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  );

  statements.push(
    eventStatement(db, {
      type: 'PAYMENT_RECORDED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      actorId: auth.user.id,
      actorType: auth.actorType ?? 'USER',
      payload: { customer_id: customer.id, amount, is_adjustment: isAdjustment, general: isGeneral },
    }),
  );
  await db.batch(statements);

  if (!isGeneral && allocations.length > 0) {
    await allocatePayment(db, auth, paymentId, allocations, ctx);
  }

  if (!isAdjustment && purpose !== 'DEPOSIT') {
    await settleLeftover(db, customer.id, paymentId, amount, allocations.reduce((n, x) => n + x.amount, 0), {
      actorId: auth.user.id,
      requestId: ctx.requestId,
      ip: ctx.ip,
    });
  }

  return { id: paymentId, pending_allocation: isGeneral };
}

/** Kế toán xác nhận (hoặc bỏ xác nhận) một khoản tiền đã ghi nhận. */
export async function setPaymentAccountingStatus(
  db: D1Database,
  auth: AuthContext,
  paymentId: string,
  confirmed: boolean,
  note: string | null,
  ctx: { requestId: string; ip: string | null },
): Promise<void> {
  const payment = await db
    .prepare(
      `SELECT p.id, p.amount, p.accounting_status, p.method, c.name AS customer_name
       FROM payments p JOIN customers c ON c.id = p.customer_id WHERE p.id = ?`,
    )
    .bind(paymentId)
    .first<{ id: string; amount: number; accounting_status: string; method: string | null; customer_name: string }>();
  if (!payment) throw notFound('Không tìm thấy khoản tiền này');
  if (confirmed && payment.method === 'Tiền mặt') {
    const receipt = await db
      .prepare(
        `SELECT 1 AS x FROM bills WHERE payment_id = ? AND kind = 'PHIEU_THU' AND deleted_at IS NULL LIMIT 1`,
      )
      .bind(paymentId)
      .first();
    if (!receipt) {
      throw badRequest(
        'RECEIPT_REQUIRED',
        'Tiền mặt phải có ảnh phiếu thu có chữ ký của người nộp và người nhận trước khi xác nhận. Nhờ sale gửi ảnh phiếu thu.',
      );
    }
  }

  const now = nowIso();
  await db.batch([
    eventStatement(db, {
      type: 'PAYMENT_CONFIRMED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      actorId: auth.user.id,
      actorType: auth.actorType ?? 'USER',
      payload: { confirmed, amount: payment.amount },
    }),
    db
      .prepare(
        `UPDATE payments SET accounting_status = ?, updated_at = ?,
           review_status = CASE WHEN ? = 1 THEN 'OK' ELSE review_status END WHERE id = ?`,
      )
      .bind(confirmed ? 'DA_XAC_NHAN' : 'CHUA_XAC_NHAN', now, confirmed ? 1 : 0, paymentId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ACCOUNTING_CONFIRMED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      before: { accounting_status: payment.accounting_status },
      after: {
        accounting_status: confirmed ? 'DA_XAC_NHAN' : 'CHUA_XAC_NHAN',
        customer: payment.customer_name,
        amount: payment.amount,
      },
      reason: note,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
}

/**
 * Phân bổ một payment cho nhiều đơn (mục 9.2).
 * - Tổng phân bổ không vượt số tiền của payment.
 * - Không phân bổ quá số còn phải thu của từng đơn; phần dư đi vào credit_balance.
 * - Trạng thái thanh toán của đơn được TÍNH LẠI, không nhập tay.
 */
/**
 * Gợi ý đơn cho các khoản tiền chưa gắn vào đơn nào: đơn CÙNG KHÁCH có số còn phải thu đúng bằng số tiền,
 * và chỉ có DUY NHẤT một đơn như vậy (mơ hồ thì không gợi ý, để kế toán tự chọn).
 */
export async function suggestOrdersForPayments(
  db: D1Database,
  payments: Array<{ id: string; customer_id: string; amount: number; is_adjustment: number }>,
): Promise<Map<string, { order_id: string; order_no: string; remaining: number }>> {
  const out = new Map<string, { order_id: string; order_no: string; remaining: number }>();
  const cand = payments.filter((p) => !p.is_adjustment);
  const customers = [...new Set(cand.map((p) => p.customer_id))];
  for (let i = 0; i < customers.length; i += 40) {
    const part = customers.slice(i, i + 40);
    const rows = (
      await db
        .prepare(
          `SELECT o.id, o.order_no, o.customer_id, o.total_amount - COALESCE(a.received, 0) - COALESCE(o.cod_amount, 0) AS remaining
           FROM orders o LEFT JOIN (${RECEIVED_BY_ORDER}) a ON a.order_id = o.id
           WHERE o.customer_id IN (${part.map(() => '?').join(',')}) AND o.deleted_at IS NULL
             AND o.approval_status IN ('APPROVED', 'PENDING_APPROVAL') AND o.delivery_status <> 'HOAN'`,
        )
        .bind(...part)
        .all<{ id: string; order_no: string; customer_id: string; remaining: number }>()
    ).results ?? [];
    for (const p of cand.filter((x) => part.includes(x.customer_id))) {
      const hit = rows.filter((r) => r.customer_id === p.customer_id && r.remaining === p.amount);
      if (hit.length === 1) out.set(p.id, { order_id: hit[0].id, order_no: hit[0].order_no, remaining: hit[0].remaining });
    }
  }
  return out;
}

/** Một lần bấm: gắn khoản tiền vào đơn rồi xác nhận khoản tiền (kế toán đã đối chiếu bill). */
export async function confirmAndAttachPayment(
  db: D1Database,
  auth: AuthContext,
  paymentId: string,
  orderId: string,
  ctx: { requestId: string; ip: string | null },
): Promise<{ allocated: number }> {
  if (!auth.permissions.includes('order.accounting.confirm') || !auth.permissions.includes('payment.allocate')) {
    throw forbidden('Cần quyền xác nhận kế toán và phân bổ tiền để làm việc này.');
  }
  const p = await db
    .prepare(
      `SELECT p.id, p.amount, p.is_adjustment, COALESCE(a.allocated, 0) AS allocated
       FROM payments p LEFT JOIN (${ALLOCATED_BY_PAYMENT}) a ON a.payment_id = p.id WHERE p.id = ?`,
    )
    .bind(paymentId)
    .first<{ id: string; amount: number; is_adjustment: number; allocated: number }>();
  if (!p) throw notFound('Không tìm thấy khoản tiền này');
  if (p.is_adjustment) throw unprocessable('ADJUSTMENT', 'Bút toán đảo không gắn đơn theo cách này.');
  const left = p.amount - p.allocated;
  if (left > 0) await allocatePayment(db, auth, paymentId, [{ order_id: orderId, amount: left }], ctx);
  await setPaymentAccountingStatus(db, auth, paymentId, true, 'Xác nhận và gắn đơn một lần', ctx);
  return { allocated: left };
}

/**
 * Hoàn tiền cho khách (phiếu chi hoàn tiền): ghi bút toán đảo vào đúng đơn, kế toán lập là có hiệu lực luôn,
 * KHÔNG qua bước CEO duyệt. Bắt buộc có bill/số tham chiếu chuyển khoản và lý do. Không hoàn quá số khách đã trả cho đơn.
 */
export async function refundOrderPayment(
  db: D1Database,
  auth: AuthContext,
  input: { order_id: string; amount: number; bill_ref: string; reason: string; paid_at?: string },
  ctx: { requestId: string; ip: string | null },
): Promise<{ id: string }> {
  if (!auth.permissions.includes('order.accounting.confirm') || !auth.permissions.includes('payment.allocate')) {
    throw forbidden('Cần quyền xác nhận kế toán và phân bổ tiền để lập phiếu hoàn tiền.');
  }
  const amount = Math.round(Number(input.amount));
  const billRef = (input.bill_ref ?? '').trim();
  const reason = (input.reason ?? '').trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw unprocessable('BAD_AMOUNT', 'Số tiền hoàn phải lớn hơn 0.', { amount: 'Nhập số tiền' });
  }
  if (billRef.length < 3) {
    throw unprocessable('BILL_REQUIRED', 'Phiếu hoàn tiền phải có bill / số tham chiếu chuyển khoản.', { bill_ref: 'Bắt buộc' });
  }
  if (reason.length < 5) {
    throw unprocessable('REASON_REQUIRED', 'Ghi lý do hoàn tiền (ví dụ: kho xuất thiếu 3 thùng, hoàn lại phần chênh).', { reason: 'Bắt buộc' });
  }
  const o = await db
    .prepare(
      `SELECT o.id, o.customer_id, COALESCE(r.received, 0) AS received
       FROM orders o LEFT JOIN (${RECEIVED_BY_ORDER}) r ON r.order_id = o.id WHERE o.id = ? AND o.deleted_at IS NULL`,
    )
    .bind(input.order_id)
    .first<{ id: string; customer_id: string; received: number }>();
  if (!o) throw notFound('Không tìm thấy đơn');
  if (amount > o.received) {
    throw unprocessable('REFUND_TOO_MUCH', `Đơn này khách mới trả ${o.received.toLocaleString('vi-VN')}đ, không hoàn nhiều hơn số đã trả.`, {
      amount: 'Vượt số đã trả',
    });
  }
  return recordPayment(
    db,
    auth,
    {
      customer_id: o.customer_id,
      amount: -amount,
      paid_at: input.paid_at,
      method: 'Chuyển khoản',
      is_adjustment: true,
      adjustment_reason: `Hoàn tiền cho khách: ${reason}`,
      note: `Phiếu chi hoàn tiền · bill ${billRef}`,
      bank_ref: billRef,
      accounting_confirmed: true,
      allocations: [{ order_id: o.id, amount }],
    } as PaymentCreateInput,
    ctx,
  );
}

export async function allocatePayment(
  db: D1Database,
  auth: AuthContext,
  paymentId: string,
  allocations: Array<{ order_id: string; amount: number }>,
  ctx: { requestId: string; ip: string | null },
): Promise<{ allocated: number; credit_balance: number }> {
  const payment = await db
    .prepare(
      `SELECT p.id, p.customer_id, p.amount, p.accounting_status, p.is_adjustment,
              COALESCE(a.allocated, 0) AS allocated
       FROM payments p
       LEFT JOIN (${ALLOCATED_BY_PAYMENT}) a ON a.payment_id = p.id
       WHERE p.id = ?`,
    )
    .bind(paymentId)
    .first<{
      id: string;
      customer_id: string;
      amount: number;
      accounting_status: string;
      is_adjustment: number;
      allocated: number;
    }>();
  if (!payment) throw notFound('Không tìm thấy phiếu thu');

  // Số tiền trong database luôn dương; bút toán đảo mang ý nghĩa trừ đi.
  const isAdjustment = payment.is_adjustment === 1;
  const requested = allocations.reduce((acc, a) => acc + Math.abs(a.amount), 0);
  if (payment.allocated + requested > payment.amount) {
    throw unprocessable(
      'ALLOCATION_EXCEEDS_PAYMENT',
      `Tổng phân bổ (${(payment.allocated + requested).toLocaleString('vi-VN')}đ) vượt số tiền phiếu thu (${payment.amount.toLocaleString('vi-VN')}đ).`,
    );
  }

  const orderIds = allocations.map((a) => a.order_id);
  const orderRows = await db
    .prepare(
      `SELECT o.id, o.customer_id, o.total_amount, o.cod_amount, COALESCE(a.received, 0) AS received
       FROM orders o
       LEFT JOIN (${RECEIVED_BY_ORDER}) a ON a.order_id = o.id
       WHERE o.id IN (${orderIds.map(() => '?').join(',')}) AND o.deleted_at IS NULL`,
    )
    .bind(...orderIds)
    .all<{ id: string; customer_id: string; total_amount: number; cod_amount: number; received: number }>();
  const orders = new Map((orderRows.results ?? []).map((o) => [o.id, o]));

  const now = nowIso();
  const statements: D1PreparedStatement[] = [];
  let excess = 0;

  for (const allocation of allocations) {
    const order = orders.get(allocation.order_id);
    if (!order) throw badRequest('ORDER_NOT_FOUND', `Đơn ${allocation.order_id} không tồn tại`);
    if (order.customer_id !== payment.customer_id) {
      throw unprocessable(
        'CUSTOMER_MISMATCH',
        'Chỉ được phân bổ phiếu thu cho đơn của chính khách hàng đó.',
      );
    }

    const receivedBefore = order.received + order.cod_amount;
    const remaining = order.total_amount - receivedBefore;
    const wanted = Math.abs(allocation.amount);
    // Bút toán đảo trừ đúng số đã ghi nhận; phiếu thu thường thì phần vượt quá công nợ của đơn
    // được giữ lại thành số dư có của khách chứ không để đơn âm.
    const applied = isAdjustment ? wanted : Math.min(wanted, Math.max(0, remaining));
    excess += wanted - applied;

    if (applied > 0) {
      statements.push(
        db
          .prepare(
            `INSERT INTO payment_allocations (id, payment_id, order_id, amount, allocated_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (payment_id, order_id) DO UPDATE SET amount = amount + excluded.amount`,
          )
          .bind(newId(), paymentId, allocation.order_id, applied, auth.user.id, now),
        db
          .prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?')
          .bind(
            derivePaymentStatus(
              order.total_amount,
              receivedBefore + (isAdjustment ? -applied : applied),
            ),
            now,
            allocation.order_id,
          ),
      );
    }
  }

  if (excess > 0 && !isAdjustment) {
    // Thu thừa lưu riêng thành credit balance, KHÔNG dùng số âm (mục 9.2).
    statements.push(
      db
        .prepare(
          `INSERT INTO customer_credit_balances (id, customer_id, amount, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (customer_id) DO UPDATE SET amount = amount + excluded.amount, updated_at = excluded.updated_at`,
        )
        .bind(newId(), payment.customer_id, excess, now),
    );
  }

  statements.push(
    db
      .prepare(
        `UPDATE payment_allocations_pending SET status = 'RESOLVED', resolved_at = ?, resolved_by = ?
         WHERE payment_id = ? AND status = 'PENDING'`,
      )
      .bind(now, auth.user.id, paymentId),
    db.prepare('UPDATE payments SET is_general_repayment = 0, updated_at = ? WHERE id = ?').bind(now, paymentId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'PAYMENT_ALLOCATED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      after: { allocations, excess },
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  );

  await db.batch(statements);
  const credit = await db
    .prepare('SELECT amount FROM customer_credit_balances WHERE customer_id = ?')
    .bind(payment.customer_id)
    .first<{ amount: number }>();

  return { allocated: requested - excess, credit_balance: credit?.amount ?? 0 };
}

/** Sửa ngày tiền về của một khoản (nhập nhầm ngày/tháng). Giữ nhật ký: ngày cũ, ngày mới, lý do. */
export async function fixPaymentDate(
  db: D1Database,
  auth: AuthContext,
  paymentId: string,
  newDate: string,
  reason: string,
  ctx: { requestId: string; ip: string | null },
): Promise<{ paid_at: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || Number.isNaN(Date.parse(newDate + 'T00:00:00Z'))) throw badRequest('BAD_DATE', 'Ngày không đúng (cần dạng năm-tháng-ngày).');
  if (newDate > vnDate()) throw badRequest('FUTURE_DATE', 'Ngày tiền về không được ở tương lai.');
  if (reason.trim().length < 3) throw badRequest('NEED_REASON', 'Ghi lý do sửa ngày.');
  const p = await db.prepare('SELECT id, paid_at FROM payments WHERE id = ?').bind(paymentId).first<{ id: string; paid_at: string }>();
  if (!p) throw notFound('Không tìm thấy khoản tiền');
  await db.batch([
    db.prepare('UPDATE payments SET paid_at = ?, updated_at = ? WHERE id = ?').bind(newDate, nowIso(), paymentId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'PAYMENT_DATE_FIXED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      before: { paid_at: p.paid_at },
      after: { paid_at: newDate },
      reason: reason.trim(),
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
  return { paid_at: newDate };
}

/** Xóa an toàn một khoản tiền ghi nhầm: chỉ khi chưa xác nhận và chưa trừ vào đơn nào. Giữ nguyên bản ghi cũ trong nhật ký cùng lý do. */
export async function voidPayment(
  db: D1Database,
  auth: AuthContext,
  paymentId: string,
  reason: string,
  ctx: { requestId: string; ip: string | null },
): Promise<{ ok: true }> {
  if (reason.trim().length < 5) throw badRequest('NEED_REASON', 'Ghi lý do xóa (ít nhất vài chữ).');
  const p = await db.prepare('SELECT * FROM payments WHERE id = ?').bind(paymentId).first<Record<string, unknown>>();
  if (!p) throw notFound('Không tìm thấy khoản tiền');
  if (p.accounting_status !== 'CHUA_XAC_NHAN') throw conflict('ALREADY_CONFIRMED', 'Khoản đã được xác nhận, không xóa được. Cần làm phiếu điều chỉnh.');
  const used = await db.prepare('SELECT COUNT(*) AS n FROM payment_allocations WHERE payment_id = ?').bind(paymentId).first<{ n: number }>();
  if ((used?.n ?? 0) > 0) throw conflict('HAS_ALLOCATION', 'Khoản này đã từng được trừ vào đơn, không xóa được.');
  const settled = await db
    .prepare(`SELECT 1 AS x FROM audit_logs WHERE entity_type = 'PAYMENT' AND entity_id = ? AND action = ? LIMIT 1`)
    .bind(paymentId, LEFTOVER_SETTLED_ACTION)
    .first();
  if (settled) throw conflict('LEFTOVER_SETTLED', 'Khoản này đã tính vào số dư của khách, không xóa được.');
  await db.batch([
    db.prepare('UPDATE bills SET payment_id = NULL WHERE payment_id = ?').bind(paymentId),
    db.prepare('DELETE FROM payment_allocations_pending WHERE payment_id = ?').bind(paymentId),
    db.prepare('DELETE FROM payments WHERE id = ?').bind(paymentId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'PAYMENT_VOIDED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      before: p,
      reason: reason.trim(),
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
  return { ok: true };
}

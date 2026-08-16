import { nowIso, vnDate } from '@shared/datetime';
import { derivePaymentStatus } from '@shared/orders';
import type { PaymentCreateInput } from '@shared/schemas';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, notFound, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';

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
  allocated: number;
  note: string | null;
}

export async function listPayments(
  db: D1Database,
  scopeSql: string,
  scopeParams: unknown[],
  filters: { customerId?: string; pendingOnly?: boolean; limit?: number },
): Promise<PaymentRow[]> {
  const where: string[] = [scopeSql];
  const params: unknown[] = [...scopeParams];
  if (filters.customerId) {
    where.push('p.customer_id = ?');
    params.push(filters.customerId);
  }
  if (filters.pendingOnly) {
    where.push(`(p.is_general_repayment = 1 OR p.review_status = 'NEEDS_REVIEW'
                 OR p.amount > COALESCE(a.allocated, 0))`);
  }

  const rows = await db
    .prepare(
      `SELECT p.id, p.external_receipt_no, p.customer_id, c.name AS customer_name, p.amount, p.paid_at,
              p.method, p.accounting_status, p.review_status, p.is_general_repayment, p.note,
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
  const isGeneral = !input.allocations || input.allocations.length === 0;
  const accountingStatus = input.accounting_confirmed ? 'DA_XAC_NHAN' : 'CHUA_XAC_NHAN';
  const reviewStatus = input.external_receipt_no ? 'OK' : 'NEEDS_REVIEW';

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO payments (id, external_receipt_no, source, external_row_key, customer_id, amount,
           paid_at, method, accounting_status, review_status, is_general_repayment, note,
           created_by, created_at, updated_at)
         VALUES (?, ?, 'MANUAL', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        paymentId,
        input.external_receipt_no ?? null,
        customer.id,
        input.amount,
        paidAt,
        input.method ?? null,
        accountingStatus,
        reviewStatus,
        isGeneral ? 1 : 0,
        input.note ?? null,
        auth.user.id,
        now,
        now,
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
          input.amount,
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
        amount: input.amount,
        paid_at: paidAt,
        accounting_status: accountingStatus,
        general: isGeneral,
      },
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  );

  await db.batch(statements);

  if (!isGeneral && input.allocations) {
    await allocatePayment(db, auth, paymentId, input.allocations, ctx);
  }

  return { id: paymentId, pending_allocation: isGeneral };
}

/**
 * Phân bổ một payment cho nhiều đơn (mục 9.2).
 * - Tổng phân bổ không vượt số tiền của payment.
 * - Không phân bổ quá số còn phải thu của từng đơn; phần dư đi vào credit_balance.
 * - Trạng thái thanh toán của đơn được TÍNH LẠI, không nhập tay.
 */
export async function allocatePayment(
  db: D1Database,
  auth: AuthContext,
  paymentId: string,
  allocations: Array<{ order_id: string; amount: number }>,
  ctx: { requestId: string; ip: string | null },
): Promise<{ allocated: number; credit_balance: number }> {
  const payment = await db
    .prepare(
      `SELECT p.id, p.customer_id, p.amount, p.accounting_status,
              COALESCE(a.allocated, 0) AS allocated
       FROM payments p
       LEFT JOIN (SELECT payment_id, SUM(amount) AS allocated FROM payment_allocations
                  WHERE reversed_at IS NULL GROUP BY payment_id) a ON a.payment_id = p.id
       WHERE p.id = ?`,
    )
    .bind(paymentId)
    .first<{ id: string; customer_id: string; amount: number; accounting_status: string; allocated: number }>();
  if (!payment) throw notFound('Không tìm thấy phiếu thu');

  const requested = allocations.reduce((acc, a) => acc + a.amount, 0);
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
       LEFT JOIN (SELECT order_id, SUM(amount) AS received FROM payment_allocations
                  WHERE reversed_at IS NULL GROUP BY order_id) a ON a.order_id = o.id
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
    const applied = Math.min(allocation.amount, Math.max(0, remaining));
    excess += allocation.amount - applied;

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
          .bind(derivePaymentStatus(order.total_amount, receivedBefore + applied), now, allocation.order_id),
      );
    }
  }

  if (excess > 0) {
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

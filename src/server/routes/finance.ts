import { Hono } from 'hono';
import { derivePaymentStatus } from '@shared/orders';
import { RECEIVED_BY_ORDER } from '../lib/sql';
import type { AppEnv } from '../env';
import { ok } from '../lib/http';
import { auditStatement, clientIp } from '../lib/audit';
import { badRequest, forbidden, notFound } from '../lib/http';
import { parseInput } from '../lib/validate';
import { paymentAllocateSchema, paymentCreateSchema } from '@shared/schemas';
import { customerScopeClause, requirePermission } from '../middleware/rbac';
import { listDebts, totalDebts } from '../services/debts';
import {
  allocatePayment,
  confirmAndAttachPayment,
  autoAllocatePayment,
  autoAllocateBatch,
  previewAutoAllocate,
  markLeftoverReviewed,
  fixPaymentDate,
  voidPayment,
  refundOrderPayment,
  listPayments,
  recordPayment,
  setPaymentAccountingStatus,
} from '../services/payments';

export const financeRoutes = new Hono<AppEnv>();

financeRoutes.get('/debts', requirePermission('debt.read.own'), async (c) => {
  const auth = c.get('auth');
  const scope = customerScopeClause(auth);
  const list = await listDebts(c.env.DB, scope.sql, scope.params, {
    onlyExceeded: c.req.query('filter') === 'exceeded',
    onlyWithDebt: c.req.query('filter') === 'has_debt',
  });
  return ok(c, list, { totals: totalDebts(list) });
});

financeRoutes.get('/payments', requirePermission('debt.read.own'), async (c) => {
  const auth = c.get('auth');
  // Nhân viên chỉ thấy phiếu thu của khách mình phụ trách.
  const scope =
    auth.scope === 'OWN' ? { sql: 'c.owner_id = ?', params: [auth.user.id] } : { sql: '1=1', params: [] };
  const items = await listPayments(c.env.DB, scope.sql, scope.params, {
    customerId: c.req.query('customer_id') ?? undefined,
    orderId: c.req.query('order_id') ?? undefined,
    pendingOnly: c.req.query('pending') === '1',
    limit: Number(c.req.query('limit') ?? 100),
  });
  return ok(c, items);
});

/** Ghi nhận tiền khách trả. Không chọn đơn = trả nợ chung, vào hàng chờ phân bổ. */
financeRoutes.post('/payments', requirePermission('order.payment.record'), async (c) => {
  const auth = c.get('auth');
  const input = parseInput(paymentCreateSchema, await c.req.json().catch(() => ({})));
  const result = await recordPayment(c.env.DB, auth, input, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, result);
});

/** Kế toán xác nhận khoản tiền sale đã tích là "tiền về". */
financeRoutes.post('/payments/:id/confirm', requirePermission('order.accounting.confirm'), async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as { confirmed?: boolean; note?: string };
  await setPaymentAccountingStatus(
    c.env.DB,
    auth,
    c.req.param('id'),
    body.confirmed !== false,
    body.note ?? null,
    { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) },
  );
  return ok(c, { ok: true });
});

/** Sửa ngày tiền về của khoản nhập nhầm (kế toán). */
financeRoutes.post('/payments/:id/fix-date', requirePermission('order.accounting.confirm'), async (c) => {
  const b = (await c.req.json().catch(() => null)) as { paid_at?: unknown; reason?: unknown } | null;
  const r = await fixPaymentDate(c.env.DB, c.get('auth'), c.req.param('id'), String(b?.paid_at ?? ''), String(b?.reason ?? ''), {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, r);
});

/** Xóa an toàn khoản tiền ghi nhầm (chưa xác nhận, chưa trừ đơn), có lý do. */
financeRoutes.post('/payments/:id/void', requirePermission('order.accounting.confirm'), async (c) => {
  const b = (await c.req.json().catch(() => null)) as { reason?: unknown } | null;
  const r = await voidPayment(c.env.DB, c.get('auth'), c.req.param('id'), String(b?.reason ?? ''), {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, r);
});

/** Phiếu chi hoàn tiền cho khách: kế toán (Thảo) lập, cần bill + lý do, không qua CEO duyệt. */
financeRoutes.post('/payments/refund', async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await refundOrderPayment(
    c.env.DB,
    auth,
    {
      order_id: String(b?.order_id ?? ''),
      amount: Number(b?.amount ?? 0),
      bill_ref: String(b?.bill_ref ?? ''),
      reason: String(b?.reason ?? ''),
    },
    { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) },
  );
  return ok(c, r);
});

/** Xem trước (không ghi gì): các khoản tiền chưa chia sẽ đi đâu nếu bấm "Chia vào đơn". */
financeRoutes.get('/payments/auto-allocate-preview', async (c) => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('payment.allocate')) throw forbidden('Cần quyền phân bổ tiền để làm việc này.');
  return ok(c, await previewAutoAllocate(c.env.DB));
});

/** Kế toán đã kiểm các khoản chỉ còn tiền thừa: giữ nguyên số tiền, chỉ bỏ khỏi danh sách việc. */
financeRoutes.post('/payments/leftover-reviewed', async (c) => {
  const auth = c.get('auth');
  const r = await markLeftoverReviewed(c.env.DB, auth, { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) });
  return ok(c, r);
});

/** Tự chia hàng loạt các khoản tiền cũ chưa trừ vào đơn (từng đợt 25 khoản, bấm tiếp tới khi hết). */
financeRoutes.post('/payments/auto-allocate-all', async (c) => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('payment.allocate')) throw forbidden('Cần quyền phân bổ tiền để làm việc này.');
  const r = await autoAllocateBatch(c.env.DB, auth, 25, { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) });
  return ok(c, r);
});

/** Tự chia một khoản tiền đã ghi vào các đơn của khách theo thứ tự ưu tiên (đơn đặt trước trừ trước). */
financeRoutes.post('/payments/:id/auto-allocate', async (c) => {
  const auth = c.get('auth');
  const r = await autoAllocatePayment(c.env.DB, auth, c.req.param('id'), {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, r);
});

/** Một lần bấm: gắn khoản tiền vào đơn rồi xác nhận khoản tiền. */
financeRoutes.post('/payments/:id/confirm-attach', async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => null)) as { order_id?: unknown } | null;
  const orderId = String(b?.order_id ?? '');
  if (!orderId) throw badRequest('MISSING', 'Chọn đơn cần gắn');
  const r = await confirmAndAttachPayment(c.env.DB, auth, c.req.param('id'), orderId, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, r);
});

financeRoutes.post('/payments/:id/allocate', requirePermission('payment.allocate'), async (c) => {
  const auth = c.get('auth');
  const input = parseInput(paymentAllocateSchema, await c.req.json().catch(() => ({})));
  const result = await allocatePayment(c.env.DB, auth, c.req.param('id'), input.allocations, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, result);
});

/**
 * Xóa phiếu thu ghi sai (nhầm khách, nhầm số, ghi trùng). Xóa hẳn khỏi công nợ, kèm phần trừ vào đơn;
 * ảnh bill giữ lại trong kho bill (bỏ liên kết). Toàn bộ phiếu cũ lưu vào nhật ký để tra lại.
 *  - Người ghi phiếu: xóa được khi kế toán CHƯA xác nhận.
 *  - Kế toán / CEO: xóa được cả phiếu đã xác nhận (bắt buộc ghi lý do).
 */
financeRoutes.post('/payments/:id/delete', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
  const reason = String(body.reason ?? '').trim();
  if (reason.length < 3) throw badRequest('REASON_REQUIRED', 'Ghi lý do xóa phiếu thu');
  const db = c.env.DB;
  const p = await db.prepare('SELECT * FROM payments WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!p) throw notFound('Không tìm thấy phiếu thu');
  const isAcct = auth.user.role === 'CEO' || auth.permissions.includes('order.accounting.confirm');
  const isOwner = p.created_by === auth.user.id;
  if (!isAcct && !(isOwner && p.accounting_status !== 'DA_XAC_NHAN')) {
    throw forbidden(
      p.accounting_status === 'DA_XAC_NHAN'
        ? 'Phiếu đã được kế toán xác nhận: nhờ kế toán xóa.'
        : 'Chỉ người ghi phiếu hoặc kế toán mới xóa được.',
    );
  }
  const allocs = (await db.prepare('SELECT order_id, amount FROM payment_allocations WHERE payment_id = ?').bind(id).all()).results ?? [];
  await db.batch([
    db.prepare('UPDATE bills SET payment_id = NULL WHERE payment_id = ?').bind(id),
    db.prepare('DELETE FROM payment_allocations WHERE payment_id = ?').bind(id),
    db.prepare('DELETE FROM payment_allocations_pending WHERE payment_id = ?').bind(id),
    db.prepare('DELETE FROM payments WHERE id = ?').bind(id),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'PAYMENT_DELETED',
      entityType: 'PAYMENT',
      entityId: id,
      before: { ...p, allocations: allocs },
      after: { reason },
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  // Tính lại tình trạng thanh toán của các đơn đã được phiếu này trừ.
  for (const a of allocs as Array<{ order_id: string }>) {
    const o = await db
      .prepare(`SELECT o.total_amount, o.cod_amount, COALESCE(r.received, 0) AS received FROM orders o LEFT JOIN (${RECEIVED_BY_ORDER}) r ON r.order_id = o.id WHERE o.id = ?`)
      .bind(a.order_id)
      .first<{ total_amount: number; cod_amount: number; received: number }>();
    if (o) {
      await db
        .prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?')
        .bind(derivePaymentStatus(o.total_amount, o.received + o.cod_amount), new Date().toISOString(), a.order_id)
        .run();
    }
  }
  return ok(c, { ok: true });
});

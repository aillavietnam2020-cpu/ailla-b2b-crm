import { Hono } from 'hono';
import { applyDepositsToOrder } from '../services/payments';
import { decideShipEdit, isShipApprover, listShipEdits, requestShipEdit } from '../services/shipEdits';
import type { AppEnv } from '../env';
import { created, forbidden, notFound, ok, unprocessable } from '../lib/http';
import { nowIso, shipDayToIso, vnDate } from '@shared/datetime';
import { auditStatement, clientIp } from '../lib/audit';
import { parseInput } from '../lib/validate';
import { loadConfig } from '../lib/settings';
import {
  accountingConfirmSchema,
  approvalDecisionSchema,
  deliveryUpdateSchema,
  shipInfoSchema,
  flowApproveSchema,
  flowHoldSchema,
  flowKhoReportSchema,
  flowNoteSchema,
  flowCorrectShippedSchema,
  flowShipSchema,
  flowToKhoSchema,
  orderCancelSchema,
  orderCreateSchema,
  orderSubmitSchema,
  orderUpdateSchema,
} from '@shared/schemas';
import { requirePermission } from '../middleware/rbac';
import {
  cancelOrder,
  createOrder,
  getOrderDetail,
  listOrders,
  prepareOrder,
  setAccountingStatus,
  submitOrder,
  updateDeliveryStatus,
  updateOrder,
} from '../services/orders';
import { decideApproval, listApprovals } from '../services/approvals';
import {
  flowApprove,
  flowAcceptShipped,
  flowConfirmShipped,
  flowHold,
  flowKhoReport,
  flowLockMoney,
  flowSend,
  flowShip,
  flowCorrectShipped,
  flowSummary,
  flowToKho,
  khoCheck,
  releaseHeldOrders,
  seesAllOrders,
  setFlowEnabled,
} from '../services/orderFlow';
import { adminOnlyEndpoint } from '../middleware/adminHost';
import { beginIdempotent, completeIdempotent } from '../lib/idempotency';
import { createProductionRequests } from '../services/productionRequests';
import { recordCarrierPaid } from '../services/carrierPaid';

export const orderRoutes = new Hono<AppEnv>();

function scopeFor(auth: { user: { id: string; role: string }; scope: string; permissions: string[] }) {
  // Sale chỉ thấy đơn của mình; kế toán kho (quyền order.kho.process) và quản lý thấy mọi đơn.
  const all = auth.user.role !== 'EMPLOYEE' || seesAllOrders(auth as never);
  return all ? { sql: '1=1', params: [] as unknown[] } : { sql: 'o.owner_id = ?', params: [auth.user.id] };
}

const flowCtx = (c: { get: (k: 'requestId') => string; req: { raw: Request } }) => ({
  requestId: c.get('requestId'),
  ip: clientIp(c.req.raw.headers),
});

orderRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const scope = scopeFor(auth);
  await releaseHeldOrders(c.env.DB);
  const items = await listOrders(c.env.DB, scope.sql, scope.params, {
    khoStatus: c.req.query('kho_status') ?? undefined,
    status: c.req.query('status') ?? undefined,
    customerId: c.req.query('customer_id') ?? undefined,
    q: c.req.query('q') ?? undefined,
    limit: Number(c.req.query('limit') ?? 100),
  });
  return ok(c, items);
});

/** Đếm việc đang chờ ở từng bước của luồng kho + danh sách mã đang thiếu cần sản xuất. */
orderRoutes.get('/flow/summary', async (c) => {
  await releaseHeldOrders(c.env.DB);
  return ok(c, await flowSummary(c.env.DB, c.get('auth')));
});

/** Làm lệnh sản xuất từ các mã đang thiếu: ghi phiếu vào ngăn Sản xuất, bỏ qua mã đã có lệnh đang mở. */
orderRoutes.post('/flow/production-requests', requirePermission('order.approve.normal'), async (c) => {
  const b = (await c.req.json().catch(() => null)) as { items?: Array<{ sku?: unknown; qty?: unknown; note?: unknown }> } | null;
  const items = (Array.isArray(b?.items) ? b!.items : [])
    .map((i) => ({ sku: String(i.sku ?? '').trim(), qty: Number(i.qty), note: String(i.note ?? '') }))
    .filter((i) => i.sku)
    .slice(0, 50)
    .map((i) => ({ sku: i.sku, qty: Number.isFinite(i.qty) && i.qty > 0 ? i.qty : undefined, note: i.note }));
  return ok(c, await createProductionRequests(c.env.DB, c.get('auth'), items));
});

/** CEO bật/tắt luồng kho cho đơn tạo mới. */
orderRoutes.put('/flow/enabled', adminOnlyEndpoint, requirePermission('settings.manage'), async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
  return ok(c, await setFlowEnabled(c.env.DB, c.get('auth'), body.enabled === true, flowCtx(c)));
});

/** Xem trước đơn: áp giá, phát hiện chặn/duyệt trước khi lưu. */
orderRoutes.post('/preview', requirePermission('order.create', 'order.create.team'), async (c) => {
  const auth = c.get('auth');
  const input = parseInput(orderCreateSchema, await c.req.json().catch(() => ({})));
  const config = await loadConfig(c.env.DB);
  const prepared = await prepareOrder(c.env.DB, config, auth, input);
  return ok(c, {
    lines: prepared.lines,
    totals: prepared.totals,
    approvals: prepared.approvals,
    customer: { id: prepared.customer.id, name: prepared.customer.name, tier_id: prepared.customer.tier_id },
  });
});

orderRoutes.post('/', requirePermission('order.create', 'order.create.team'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const input = parseInput(orderCreateSchema, body);
  const config = await loadConfig(c.env.DB);
  const key = c.req.header('Idempotency-Key') ?? null;

  const replay = await beginIdempotent(c.env.DB, key, auth.user.id, 'POST /api/orders', body);
  if (replay) return ok(c, replay.response, { idempotent_replay: true });

  const result = await createOrder(c.env.DB, config, auth, input, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  await completeIdempotent(c.env.DB, key, result);
  return created(c, result);
});

/** Kiểm tồn từng dòng của đơn (tồn thành phẩm, hàng đã giữ, khả năng sản xuất theo định mức). */
orderRoutes.get('/:id/kho-check', async (c) => {
  return ok(c, await khoCheck(c.env.DB, c.get('auth'), c.req.param('id')));
});

orderRoutes.post('/:id/flow/send', async (c) => {
  const input = parseInput(flowNoteSchema, await c.req.json().catch(() => ({})));
  return ok(c, await flowSend(c.env.DB, c.get('auth'), c.req.param('id'), input.note ?? null, flowCtx(c)));
});

orderRoutes.post('/:id/flow/to-kho', async (c) => {
  const input = parseInput(flowToKhoSchema, await c.req.json().catch(() => ({})));
  return ok(c, await flowToKho(c.env.DB, c.get('auth'), c.req.param('id'), input, flowCtx(c)));
});

orderRoutes.post('/:id/flow/kho-report', async (c) => {
  const input = parseInput(flowKhoReportSchema, await c.req.json().catch(() => ({})));
  return ok(c, await flowKhoReport(c.env.DB, c.get('auth'), c.req.param('id'), input, flowCtx(c)));
});

orderRoutes.post('/:id/flow/hold', async (c) => {
  const input = parseInput(flowHoldSchema, await c.req.json().catch(() => ({})));
  return ok(c, await flowHold(c.env.DB, c.get('auth'), c.req.param('id'), input, flowCtx(c)));
});

orderRoutes.post('/:id/flow/approve', async (c) => {
  const input = parseInput(flowApproveSchema, await c.req.json().catch(() => ({})));
  const config = await loadConfig(c.env.DB);
  return ok(
    c,
    await flowApprove(c.env.DB, c.get('auth'), c.req.param('id'), input, {
      ...flowCtx(c),
      allowSelfApproval: config.allowSelfApproval,
    }),
  );
});

/** Sửa phiếu xuất kho (số thực xuất / ngày / người xuất) có lý do: kho gửi yêu cầu, quản lý điều phối hoặc CEO duyệt. */
orderRoutes.get('/ship-edits', async (c) => {
  return ok(c, await listShipEdits(c.env.DB, c.get('auth'), c.req.query('status') ?? 'CHO_DUYET'));
});
orderRoutes.post('/ship-edits/:rid/decide', async (c) => {
  const b = (await c.req.json().catch(() => null)) as { decision?: unknown; note?: unknown } | null;
  const decision = b?.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';
  return ok(c, await decideShipEdit(c.env.DB, c.get('auth'), c.req.param('rid'), decision, String(b?.note ?? '').trim() || null, flowCtx(c)));
});
orderRoutes.post('/:id/ship-edits', async (c) => {
  const b = (await c.req.json().catch(() => null)) as {
    ship_day?: unknown;
    shipped_by_name?: unknown;
    lines?: unknown;
    reason?: unknown;
  } | null;
  const lines = Array.isArray(b?.lines)
    ? (b!.lines as Array<{ product_id?: unknown; shipped_qty?: unknown }>).map((l) => ({ product_id: String(l.product_id ?? ''), shipped_qty: Math.max(0, Math.floor(Number(l.shipped_qty) || 0)) })).filter((l) => l.product_id)
    : null;
  const day = typeof b?.ship_day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.ship_day) ? b.ship_day : null;
  return ok(
    c,
    await requestShipEdit(
      c.env.DB,
      c.get('auth'),
      c.req.param('id'),
      { ship_day: day, shipped_by_name: typeof b?.shipped_by_name === 'string' ? b.shipped_by_name : null, lines, reason: String(b?.reason ?? '') },
      flowCtx(c),
    ),
  );
});

orderRoutes.post('/:id/flow/ship', async (c) => {
  const input = parseInput(flowShipSchema, await c.req.json().catch(() => ({})));
  return ok(c, await flowShip(c.env.DB, c.get('auth'), c.req.param('id'), input, flowCtx(c)));
});

/** Kho sửa số thực xuất sau khi đã xuất (kể cả đã chốt tiền): kho + đơn + tiền đổi theo, kế toán xác nhận lại. */
orderRoutes.post('/:id/flow/correct-shipped', async (c) => {
  // Kế toán kho không tự sửa số thực xuất: gửi yêu cầu kèm lý do để quản lý điều phối duyệt (POST /:id/ship-edits).
  if (!isShipApprover(c.get('auth')) && !c.get('auth').permissions.includes('order.accounting.confirm')) {
    throw forbidden('Sửa số thực xuất cần quản lý điều phối duyệt. Gửi yêu cầu sửa phiếu kèm lý do.');
  }
  const input = parseInput(flowCorrectShippedSchema, await c.req.json().catch(() => ({})));
  return ok(c, await flowCorrectShipped(c.env.DB, c.get('auth'), c.req.param('id'), input, flowCtx(c)));
});

/** Công ty miễn ship, khách trả cước nhà xe rồi trừ vào tiền đơn: ghi phiếu thu bù trừ + phiếu chi vận chuyển. */
orderRoutes.post('/:id/carrier-paid', requirePermission('order.payment.record'), async (c) => {
  const b = (await c.req.json().catch(() => null)) as { amount?: unknown; carrier?: unknown; note?: unknown } | null;
  const amount = Math.round(Number(b?.amount));
  const carrier = String(b?.carrier ?? '').trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw unprocessable('BAD_AMOUNT', 'Số tiền cước phải lớn hơn 0', { amount: 'Nhập số tiền cước' });
  }
  if (carrier.length < 2) {
    throw unprocessable('NO_CARRIER', 'Ghi tên nhà xe hoặc biển số xe', { carrier: 'Bắt buộc' });
  }
  return ok(
    c,
    await recordCarrierPaid(
      c.env.DB,
      c.get('auth'),
      c.req.param('id'),
      { amount, carrier, note: b?.note == null ? null : String(b.note) },
      { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) },
    ),
  );
});

/**
 * Một lần bấm cho người vừa là điều phối vừa làm thay kế toán (Thảo): xác nhận đã xuất → chốt tiền → xác nhận ghi nợ,
 * làm tới đâu đơn đủ điều kiện tới đó. Lỗi ở bước nào thì dừng và báo đúng bước đó.
 */
orderRoutes.post('/:id/flow/finish', requirePermission('order.accounting.confirm'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const input = parseInput(flowNoteSchema, await c.req.json().catch(() => ({})));
  const ctx = flowCtx(c);
  const status = async () =>
    (await c.env.DB.prepare('SELECT kho_status FROM orders WHERE id = ? AND deleted_at IS NULL').bind(id).first<{ kho_status: string }>())?.kho_status;
  const steps: string[] = [];
  let cur = await status();
  if (cur === 'DA_XUAT') {
    await flowConfirmShipped(c.env.DB, auth, id, input.note ?? null, ctx);
    steps.push('Xác nhận đã xuất');
    cur = await status();
  }
  if (cur === 'CHO_CHOT_TIEN') {
    await flowLockMoney(c.env.DB, auth, id, input.note ?? null, ctx);
    steps.push('Chốt tiền');
    cur = await status();
  }
  if (cur === 'DA_CHOT_TIEN') {
    await setAccountingStatus(c.env.DB, auth, id, 'DA_XAC_NHAN', input.note ?? null, {
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    });
    steps.push('Xác nhận ghi nợ');
    cur = await status();
  }
  if (!steps.length) {
    throw unprocessable('NOT_READY', 'Đơn chưa tới bước này (cần kho đã xuất hàng).');
  }
  return ok(c, { steps, kho_status: cur });
});

orderRoutes.post('/:id/flow/confirm-shipped', async (c) => {
  const input = parseInput(flowNoteSchema, await c.req.json().catch(() => ({})));
  return ok(c, await flowConfirmShipped(c.env.DB, c.get('auth'), c.req.param('id'), input.note ?? null, flowCtx(c)));
});

orderRoutes.post('/:id/flow/accept-shipped', async (c) => {
  const input = parseInput(flowNoteSchema, await c.req.json().catch(() => ({})));
  return ok(c, await flowAcceptShipped(c.env.DB, c.get('auth'), c.req.param('id'), input.note ?? null, flowCtx(c)));
});

orderRoutes.post('/:id/flow/lock-money', async (c) => {
  const input = parseInput(flowNoteSchema, await c.req.json().catch(() => ({})));
  return ok(c, await flowLockMoney(c.env.DB, c.get('auth'), c.req.param('id'), input.note ?? null, flowCtx(c)));
});

orderRoutes.get('/:id', async (c) => {
  const auth = c.get('auth');
  return ok(c, await getOrderDetail(c.env.DB, auth, c.req.param('id')));
});

/** Sửa đơn: khách đổi ý, kho hết hàng, kho xuất sai... Lưu bản trước/sau và lý do. */
orderRoutes.put('/:id', requirePermission('order.create', 'order.create.team'), async (c) => {
  const auth = c.get('auth');
  const input = parseInput(orderUpdateSchema, await c.req.json().catch(() => ({})));
  const config = await loadConfig(c.env.DB);
  const result = await updateOrder(c.env.DB, config, auth, c.req.param('id'), input, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, result);
});

orderRoutes.post('/:id/submit', requirePermission('order.submit'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  parseInput(orderSubmitSchema, body);
  const config = await loadConfig(c.env.DB);
  const key = c.req.header('Idempotency-Key') ?? null;

  const replay = await beginIdempotent(
    c.env.DB,
    key,
    auth.user.id,
    `POST /api/orders/${c.req.param('id')}/submit`,
    body,
  );
  if (replay) return ok(c, replay.response, { idempotent_replay: true });

  const result = await submitOrder(c.env.DB, config, auth, c.req.param('id'), {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  await completeIdempotent(c.env.DB, key, result);
  return ok(c, result);
});

/** Kế toán trừ tiền cọc còn dư của khách vào một đơn (cọc cũ trừ trước). */
orderRoutes.post('/:id/apply-deposit', async (c) => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('payment.allocate')) throw forbidden('Cần quyền phân bổ tiền để trừ cọc vào đơn.');
  const applied = await applyDepositsToOrder(c.env.DB, auth, c.req.param('id'), {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, { applied });
});

orderRoutes.post('/:id/delivery', async (c) => {
  const auth = c.get('auth');
  const input = parseInput(deliveryUpdateSchema, await c.req.json().catch(() => ({})));
  // Kế toán kho được ghi "đã xuất kho" cho đơn không đi luồng kho; các trạng thái khác vẫn cần quyền cập nhật giao hàng.
  const khoShip = input.delivery_status === 'DA_XUAT_KHO' && auth.permissions.includes('order.kho.process');
  if (!khoShip && !auth.permissions.includes('order.delivery.update')) {
    throw forbidden('Không có quyền cập nhật trạng thái giao hàng');
  }
  await updateDeliveryStatus(
    c.env.DB,
    auth,
    c.req.param('id'),
    input.delivery_status,
    input.note ?? null,
    { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) },
    { day: input.ship_day ?? null, by: input.shipped_by_name || null },
  );
  return ok(c, { ok: true });
});

/** Sửa ngày xuất kho + người xuất kho của đơn ĐÃ xuất (kế toán kho, người duyệt đơn, CEO). Kho tính lại tồn theo ngày mới. */
orderRoutes.post('/:id/ship-info', async (c) => {
  const auth = c.get('auth');
  if (!isShipApprover(auth)) {
    throw forbidden('Sửa ngày xuất / người xuất cần quản lý điều phối duyệt. Kho gửi yêu cầu sửa phiếu kèm lý do.');
  }
  const input = parseInput(shipInfoSchema, await c.req.json().catch(() => ({})));
  const id = c.req.param('id');
  if (input.ship_day > vnDate()) throw unprocessable('BAD_SHIP_DAY', 'Ngày xuất kho không được sau hôm nay.');
  const o = await c.env.DB
    .prepare('SELECT id, delivery_status, delivered_at, shipped_by_name FROM orders WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<{ id: string; delivery_status: string; delivered_at: string | null; shipped_by_name: string | null }>();
  if (!o) throw notFound('Không tìm thấy đơn hàng');
  if (!['DA_XUAT_KHO', 'DA_GIAO'].includes(o.delivery_status)) {
    throw unprocessable('NOT_SHIPPED', 'Đơn chưa xuất kho nên chưa có ngày xuất để sửa.');
  }
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB
      .prepare('UPDATE orders SET delivered_at = ?, shipped_by_name = ?, updated_at = ? WHERE id = ?')
      .bind(shipDayToIso(input.ship_day), input.shipped_by_name, now, id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'ORDER_SHIP_INFO_EDITED',
      entityType: 'ORDER',
      entityId: id,
      before: { delivered_at: o.delivered_at, shipped_by_name: o.shipped_by_name },
      after: { ship_day: input.ship_day, shipped_by_name: input.shipped_by_name },
      reason: input.note ?? null,
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { id, ship_day: input.ship_day });
});

/** Kế toán xác nhận / bỏ xác nhận đơn (mốc ghi công nợ chính thức). */
orderRoutes.post('/:id/accounting', requirePermission('order.accounting.confirm'), async (c) => {
  const auth = c.get('auth');
  const input = parseInput(accountingConfirmSchema, await c.req.json().catch(() => ({})));
  await setAccountingStatus(
    c.env.DB,
    auth,
    c.req.param('id'),
    input.accounting_status,
    input.note ?? null,
    { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) },
  );
  return ok(c, { ok: true });
});

orderRoutes.post('/:id/cancel', requirePermission('order.create', 'order.create.team'), async (c) => {
  const auth = c.get('auth');
  const input = parseInput(orderCancelSchema, await c.req.json().catch(() => ({})));
  await cancelOrder(c.env.DB, auth, c.req.param('id'), input.reason, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, { ok: true });
});

export const approvalRoutes = new Hono<AppEnv>();

approvalRoutes.get('/', requirePermission('order.approve.normal', 'order.approve.exception'), async (c) => {
  return ok(c, await listApprovals(c.env.DB, c.req.query('status') ?? 'PENDING', 100));
});

approvalRoutes.post('/:id/decide', requirePermission('order.approve.normal', 'order.approve.exception'), async (c) => {
  const auth = c.get('auth');
  const input = parseInput(approvalDecisionSchema, await c.req.json().catch(() => ({})));
  const config = await loadConfig(c.env.DB);
  const result = await decideApproval(
    c.env.DB,
    auth,
    c.req.param('id'),
    input.decision,
    input.note ?? null,
    {
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
      allowSelfApproval: config.allowSelfApproval,
    },
  );
  return ok(c, result);
});

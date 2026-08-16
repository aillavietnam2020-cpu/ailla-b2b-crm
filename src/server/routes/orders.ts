import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { created, ok } from '../lib/http';
import { clientIp } from '../lib/audit';
import { parseInput } from '../lib/validate';
import { loadConfig } from '../lib/settings';
import {
  accountingConfirmSchema,
  approvalDecisionSchema,
  deliveryUpdateSchema,
  orderCancelSchema,
  orderCreateSchema,
  orderSubmitSchema,
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
} from '../services/orders';
import { decideApproval, listApprovals } from '../services/approvals';
import { beginIdempotent, completeIdempotent } from '../lib/idempotency';

export const orderRoutes = new Hono<AppEnv>();

function scopeFor(role: string, userId: string) {
  return role === 'EMPLOYEE'
    ? { sql: 'o.owner_id = ?', params: [userId] }
    : { sql: '1=1', params: [] as unknown[] };
}

orderRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const scope = scopeFor(auth.user.role, auth.user.id);
  const items = await listOrders(c.env.DB, scope.sql, scope.params, {
    status: c.req.query('status') ?? undefined,
    customerId: c.req.query('customer_id') ?? undefined,
    q: c.req.query('q') ?? undefined,
    limit: Number(c.req.query('limit') ?? 100),
  });
  return ok(c, items);
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

orderRoutes.get('/:id', async (c) => {
  const auth = c.get('auth');
  return ok(c, await getOrderDetail(c.env.DB, auth, c.req.param('id')));
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

orderRoutes.post('/:id/delivery', requirePermission('order.delivery.update'), async (c) => {
  const auth = c.get('auth');
  const input = parseInput(deliveryUpdateSchema, await c.req.json().catch(() => ({})));
  await updateDeliveryStatus(c.env.DB, auth, c.req.param('id'), input.delivery_status, input.note ?? null, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, { ok: true });
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
  const result = await decideApproval(
    c.env.DB,
    auth,
    c.req.param('id'),
    input.decision,
    input.note ?? null,
    { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) },
  );
  return ok(c, result);
});

import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ok } from '../lib/http';
import { clientIp } from '../lib/audit';
import { parseInput } from '../lib/validate';
import { paymentAllocateSchema, paymentCreateSchema } from '@shared/schemas';
import { customerScopeClause, requirePermission } from '../middleware/rbac';
import { listDebts, totalDebts } from '../services/debts';
import {
  allocatePayment,
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

financeRoutes.post('/payments/:id/allocate', requirePermission('payment.allocate'), async (c) => {
  const auth = c.get('auth');
  const input = parseInput(paymentAllocateSchema, await c.req.json().catch(() => ({})));
  const result = await allocatePayment(c.env.DB, auth, c.req.param('id'), input.allocations, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, result);
});

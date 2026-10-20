import { Hono } from 'hono';
import {
  returnConfirmSchema,
  returnCreateSchema,
  returnKhoReceiveSchema,
} from '@shared/returns';
import { zodFieldErrors } from '@shared/schemas';
import type { AppEnv } from '../env';
import { clientIp } from '../lib/audit';
import { ok, unprocessable } from '../lib/http';
import {
  cancelReturn,
  confirmReturn,
  createReturn,
  customerPrices,
  getReturn,
  khoReceiveReturn,
  listReturns,
} from '../services/returns';

/**
 * Phiếu hàng trả lại: sale tạo → kho nhận hàng → kế toán xác nhận giảm công nợ.
 * Quyền kiểm tra ở service (kho = order.kho.process, kế toán = order.accounting.confirm).
 */
export const returnRoutes = new Hono<AppEnv>();

const ctxOf = (c: { get: (k: 'requestId') => string; req: { raw: Request } }) => ({
  requestId: c.get('requestId'),
  ip: clientIp(c.req.raw.headers),
});

returnRoutes.get('/', async (c) => {
  const items = await listReturns(c.env.DB, c.get('auth'), {
    status: c.req.query('status') ?? undefined,
    customerId: c.req.query('customer_id') ?? undefined,
    orderId: c.req.query('order_id') ?? undefined,
    q: c.req.query('q') ?? undefined,
    limit: Number(c.req.query('limit') ?? 100),
  });
  return ok(c, items);
});

/** Giá theo cấp của khách cho các mặt hàng (phiếu trả không chọn đơn gốc). */
returnRoutes.get('/price', async (c) => {
  const customerId = c.req.query('customer_id') ?? '';
  const ids = (c.req.query('product_ids') ?? '').split(',').filter(Boolean).slice(0, 100);
  if (!customerId || !ids.length) return ok(c, {});
  const m = await customerPrices(c.env.DB, customerId, ids, new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10));
  return ok(c, Object.fromEntries(m));
});

returnRoutes.get('/:id', async (c) => ok(c, await getReturn(c.env.DB, c.get('auth'), c.req.param('id'))));

returnRoutes.post('/', async (c) => {
  const parsed = returnCreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Phiếu trả hàng chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  return ok(c, await createReturn(c.env.DB, c.get('auth'), parsed.data, ctxOf(c)));
});

returnRoutes.post('/:id/receive', async (c) => {
  const parsed = returnKhoReceiveSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Số liệu nhận hàng chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  return ok(c, await khoReceiveReturn(c.env.DB, c.get('auth'), c.req.param('id'), parsed.data, ctxOf(c)));
});

returnRoutes.post('/:id/confirm', async (c) => {
  const parsed = returnConfirmSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Chọn cách xử lý tiền cho khách', zodFieldErrors(parsed.error));
  }
  return ok(c, await confirmReturn(c.env.DB, c.get('auth'), c.req.param('id'), parsed.data, ctxOf(c)));
});

returnRoutes.post('/:id/cancel', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
  return ok(c, await cancelReturn(c.env.DB, c.get('auth'), c.req.param('id'), body.reason?.trim() || null, ctxOf(c)));
});

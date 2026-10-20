import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ok, unprocessable } from '../lib/http';
import { vnDate } from '@shared/datetime';
import {
  customerPriceImportSchema,
  customerPriceSetSchema,
  zodFieldErrors,
} from '@shared/schemas';
import { requirePermission } from '../middleware/rbac';
import { adminOnlyEndpoint } from '../middleware/adminHost';
import {
  getCustomerForPrices,
  importCustomerPrices,
  listCustomPriceCustomers,
  listCustomerPrices,
  setCustomerPrice,
} from '../services/customerPrices';

/**
 * Bảng giá riêng từng khách gia công.
 * Xem: ai cũng xem được bảng giá của khách trong phạm vi mình (nhân viên chỉ khách của mình).
 * Sửa/tải lên: chỉ ở trang quản trị và chỉ Quản lý/CEO.
 */
export const customerPriceRoutes = new Hono<AppEnv>();

/** Danh sách khách đang dùng bảng giá riêng (cho trang quản trị). */
customerPriceRoutes.get('/', requirePermission('price.propose', 'price.approve'), async (c) => {
  const onDate = c.req.query('date') ?? vnDate();
  return ok(c, await listCustomPriceCustomers(c.env.DB, onDate));
});

customerPriceRoutes.get('/:customerId', async (c) => {
  const auth = c.get('auth');
  const customer = await getCustomerForPrices(c.env.DB, auth, c.req.param('customerId'));
  const onDate = c.req.query('date') ?? vnDate();
  const items = await listCustomerPrices(c.env.DB, customer.id, onDate, c.req.query('q') ?? undefined);
  return ok(c, items, { price_mode: customer.price_mode, customer_name: customer.name, date: onDate });
});

customerPriceRoutes.put(
  '/:customerId/item',
  adminOnlyEndpoint,
  requirePermission('price.propose', 'price.approve'),
  async (c) => {
    const auth = c.get('auth');
    const parsed = customerPriceSetSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
    }
    const result = await setCustomerPrice(c.env.DB, auth, c.req.param('customerId'), parsed.data, {
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    });
    return ok(c, result);
  },
);

customerPriceRoutes.post(
  '/:customerId/import',
  adminOnlyEndpoint,
  requirePermission('price.propose', 'price.approve'),
  async (c) => {
    const auth = c.get('auth');
    const parsed = customerPriceImportSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw unprocessable('VALIDATION_FAILED', 'File chưa hợp lệ', zodFieldErrors(parsed.error));
    }
    const report = await importCustomerPrices(c.env.DB, auth, c.req.param('customerId'), parsed.data, {
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    });
    return ok(c, report);
  },
);

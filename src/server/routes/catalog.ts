import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { badRequest, notFound, ok, unprocessable } from '../lib/http';
import { nowIso, vnDate } from '@shared/datetime';
import {
  priceUpsertSchema,
  productCreateSchema,
  productGroupSchema,
  productUpdateSchema,
  zodFieldErrors,
} from '@shared/schemas';
import { auditStatement } from '../lib/audit';
import { newId } from '../lib/ids';
import { requirePermission } from '../middleware/rbac';
import { listPriceTable, setPrice } from '../services/pricing';

export const catalogRoutes = new Hono<AppEnv>();

/** Danh mục sản phẩm + nhóm. */
catalogRoutes.get('/products', async (c) => {
  const onDate = c.req.query('date') ?? vnDate();
  const result = await listPriceTable(c.env.DB, onDate, {
    q: c.req.query('q') ?? undefined,
    groupId: c.req.query('group_id') ?? undefined,
    onlyMissing: c.req.query('missing_price') === '1',
    limit: Number(c.req.query('limit') ?? 500),
  });
  return ok(c, result.products, { tiers: result.tiers, date: onDate });
});

/** Bảng giá 8 cấp theo ngày hiệu lực (chỉ đọc với nhân viên). */
catalogRoutes.get('/prices', async (c) => {
  const onDate = c.req.query('date') ?? vnDate();
  const result = await listPriceTable(c.env.DB, onDate, {
    q: c.req.query('q') ?? undefined,
    onlyMissing: c.req.query('missing_price') === '1',
    limit: Number(c.req.query('limit') ?? 500),
  });
  return ok(c, { tiers: result.tiers, products: result.products, date: onDate });
});

catalogRoutes.get('/product-groups', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, code, name FROM product_groups ORDER BY name').all();
  return ok(c, rows.results ?? []);
});

catalogRoutes.post('/product-groups', requirePermission('product.manage'), async (c) => {
  const parsed = productGroupSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const id = newId();
  const now = nowIso();
  await c.env.DB.prepare(
    'INSERT INTO product_groups (id, code, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, parsed.data.code, parsed.data.name, now, now)
    .run();
  return ok(c, { id });
});

/** Thêm sản phẩm mới (SKU). Giá nhập riêng ở màn hình Bảng giá. */
catalogRoutes.post('/products', requirePermission('product.manage'), async (c) => {
  const auth = c.get('auth');
  const parsed = productCreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const input = parsed.data;

  const existing = await c.env.DB.prepare('SELECT id FROM products WHERE sku = ?')
    .bind(input.sku)
    .first<{ id: string }>();
  if (existing) throw badRequest('SKU_EXISTS', 'Mã sản phẩm đã tồn tại', { sku: 'Mã đã tồn tại' });

  const id = newId();
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO products (id, sku, name, unit, pack_size, group_id, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(
      id,
      input.sku,
      input.name,
      input.unit ?? null,
      input.pack_size ?? null,
      input.group_id ?? null,
      now,
      now,
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'PRODUCT_CREATED',
      entityType: 'PRODUCT',
      entityId: id,
      after: input,
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  return ok(c, { id });
});

catalogRoutes.patch('/products/:id', requirePermission('product.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const parsed = productUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const before = await c.env.DB.prepare(
    'SELECT id, sku, name, unit, pack_size, group_id, active FROM products WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(id)
    .first();
  if (!before) throw notFound('Không tìm thấy sản phẩm');

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
  }
  if (fields.length === 0) return ok(c, { ok: true });

  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE products SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`).bind(
      ...values,
      now,
      id,
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'PRODUCT_UPDATED',
      entityType: 'PRODUCT',
      entityId: id,
      before,
      after: parsed.data,
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  return ok(c, { ok: true });
});

/**
 * Đặt giá mới cho (sản phẩm, cấp) từ một ngày hiệu lực.
 * - CEO: giá có hiệu lực ngay (ACTIVE).
 * - Quản lý: tạo bản nháp (DRAFT) + yêu cầu duyệt gửi lên CEO (mục 4: Quản lý đề nghị, CEO duyệt).
 * Giá cũ được đóng lại bằng valid_to = ngày trước ngày hiệu lực mới; đơn cũ giữ nguyên giá đã chốt.
 */
catalogRoutes.post('/prices', requirePermission('price.propose', 'price.approve'), async (c) => {
  const auth = c.get('auth');
  const parsed = priceUpsertSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const result = await setPrice(c.env.DB, auth, parsed.data, {
    requestId: c.get('requestId'),
    ip: c.req.header('CF-Connecting-IP') ?? null,
  });
  return ok(c, result);
});

/** Lịch sử các phiên bản giá của một sản phẩm. */
catalogRoutes.get('/products/:id/price-history', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT pp.id, pp.tier_id, t.name AS tier_name, t.rank, pp.amount, pp.valid_from, pp.valid_to,
            pp.status, pp.version, pp.created_at, u.display_name AS created_by_name
     FROM product_prices pp
     JOIN price_tiers t ON t.id = pp.tier_id
     LEFT JOIN users u ON u.id = pp.created_by
     WHERE pp.product_id = ?
     ORDER BY t.rank, pp.valid_from DESC`,
  )
    .bind(c.req.param('id'))
    .all();
  return ok(c, rows.results ?? []);
});

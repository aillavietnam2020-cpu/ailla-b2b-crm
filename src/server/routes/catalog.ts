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
import { adminOnlyEndpoint } from '../middleware/adminHost';
import { listPriceTable, setPrice } from '../services/pricing';

export const catalogRoutes = new Hono<AppEnv>();

function scopeParam(value: string | undefined): 'TIER' | 'CUSTOM' | undefined {
  return value === 'TIER' || value === 'CUSTOM' ? value : undefined;
}

/** Danh mục sản phẩm + nhóm. */
catalogRoutes.get('/products', async (c) => {
  const onDate = c.req.query('date') ?? vnDate();
  const result = await listPriceTable(c.env.DB, onDate, {
    q: c.req.query('q') ?? undefined,
    scope: scopeParam(c.req.query('scope')),
    groupId: c.req.query('group_id') ?? undefined,
    onlyMissing: c.req.query('missing_price') === '1',
    limit: Number(c.req.query('limit') ?? 500),
  });
  return ok(c, result.products, { tiers: result.tiers, date: onDate });
});

/**
 * Vật tư bán kèm cho khách gia công (vỏ thùng, nắp, chai...): lấy từ danh mục kho, giá do người lập đơn tự điền,
 * không cần bảng giá và không cần duyệt giá. Tìm trong kho vật tư; chọn vào đơn thì tự tạo sản phẩm tương ứng.
 */
const SUPPLY_GROUP = 'VAT_TU_BAN';
catalogRoutes.get('/supplies', async (c) => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('order.create') && !auth.permissions.includes('order.create.team')) {
    throw badRequest('FORBIDDEN', 'Chỉ người lập đơn mới tìm vật tư bán kèm.');
  }
  const words = (c.req.query('q') ?? '').trim().split(/\s+/).filter((w) => w.length >= 1).slice(0, 5);
  const where = ["i.active = 1", "i.cls NOT IN ('TP', 'COMBO', 'BTP')"];
  const params: unknown[] = [];
  for (const w of words) {
    where.push("(i.code LIKE ? OR i.name LIKE ? OR i.grp LIKE ?)");
    params.push(`%${w}%`, `%${w}%`, `%${w}%`);
  }
  const rows = await c.env.DB.prepare(
    `SELECT i.code, i.name, i.unit, i.grp, p.id AS product_id
     FROM kho_items i LEFT JOIN products p ON p.sku = i.code AND p.deleted_at IS NULL
     WHERE ${where.join(' AND ')} ORDER BY i.name LIMIT 12`,
  )
    .bind(...params)
    .all<{ code: string; name: string; unit: string; grp: string; product_id: string | null }>();
  return ok(c, rows.results ?? []);
});

catalogRoutes.post('/supplies/ensure', async (c) => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('order.create') && !auth.permissions.includes('order.create.team')) {
    throw badRequest('FORBIDDEN', 'Chỉ người lập đơn mới thêm vật tư bán kèm.');
  }
  const body = (await c.req.json().catch(() => null)) as { code?: unknown } | null;
  const code = String(body?.code ?? '').trim();
  const item = await c.env.DB.prepare("SELECT code, name, unit FROM kho_items WHERE code = ? AND active = 1")
    .bind(code)
    .first<{ code: string; name: string; unit: string }>();
  if (!item) throw notFound('Không thấy vật tư này trong kho');
  const now = nowIso();
  let group = await c.env.DB.prepare('SELECT id FROM product_groups WHERE code = ?').bind(SUPPLY_GROUP).first<{ id: string }>();
  if (!group) {
    const gid = newId();
    await c.env.DB.prepare('INSERT OR IGNORE INTO product_groups (id, code, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(gid, SUPPLY_GROUP, 'Vật tư bán kèm', now, now)
      .run();
    group = await c.env.DB.prepare('SELECT id FROM product_groups WHERE code = ?').bind(SUPPLY_GROUP).first<{ id: string }>();
  }
  let product = await c.env.DB.prepare('SELECT id, sku, name, unit FROM products WHERE sku = ? AND deleted_at IS NULL')
    .bind(item.code)
    .first<{ id: string; sku: string; name: string; unit: string | null }>();
  if (!product) {
    const pid = newId();
    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO products (id, sku, name, unit, pack_size, group_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, 1, ?, ?)',
      ).bind(pid, item.code, item.name, item.unit || null, group?.id ?? null, now, now),
      // Xuất kho thì kho tự trừ đúng mã vật tư này.
      c.env.DB.prepare('INSERT OR IGNORE INTO kho_map (crm_sku, misa_code, factor, note) VALUES (?, ?, 1, ?)').bind(
        item.code,
        item.code,
        'Vật tư bán kèm',
      ),
    ]);
    product = { id: pid, sku: item.code, name: item.name, unit: item.unit || null };
  }
  return ok(c, product);
});

/** Bảng giá 8 cấp theo ngày hiệu lực (chỉ đọc với nhân viên). */
catalogRoutes.get('/prices', async (c) => {
  const onDate = c.req.query('date') ?? vnDate();
  const result = await listPriceTable(c.env.DB, onDate, {
    q: c.req.query('q') ?? undefined,
    scope: scopeParam(c.req.query('scope')),
    onlyMissing: c.req.query('missing_price') === '1',
    limit: Number(c.req.query('limit') ?? 500),
  });
  return ok(c, { tiers: result.tiers, products: result.products, date: onDate });
});

catalogRoutes.get('/product-groups', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, code, name FROM product_groups ORDER BY name').all();
  return ok(c, rows.results ?? []);
});

/** Mã nhóm tự sinh từ tên (bỏ dấu, viết hoa, gạch ngang) để người dùng chỉ cần gõ tên. */
function groupCodeFromName(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'NHOM'
  );
}

catalogRoutes.post('/product-groups', adminOnlyEndpoint, requirePermission('product.manage'), async (c) => {
  const raw = (await c.req.json().catch(() => ({}))) as { code?: unknown; name?: unknown };
  if (!raw.code && typeof raw.name === 'string') raw.code = groupCodeFromName(raw.name);
  const parsed = productGroupSchema.safeParse(raw);
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

/** Đổi tên nhóm. Mã nhóm giữ nguyên để các nơi đang dùng mã không bị lệch. */
catalogRoutes.patch('/product-groups/:id', adminOnlyEndpoint, requirePermission('product.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const b = (await c.req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < 2 || name.length > 120) throw badRequest('BAD_NAME', 'Tên nhóm cần từ 2 đến 120 ký tự');
  const before = await c.env.DB.prepare('SELECT id, code, name FROM product_groups WHERE id = ?').bind(id).first<{ id: string; code: string; name: string }>();
  if (!before) throw notFound('Không tìm thấy nhóm');
  const dup = await c.env.DB.prepare('SELECT id FROM product_groups WHERE name = ? AND id <> ?').bind(name, id).first();
  if (dup) throw badRequest('DUPLICATE_NAME', 'Đã có nhóm tên "' + name + '"');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE product_groups SET name = ?, updated_at = ? WHERE id = ?').bind(name, nowIso(), id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'PRODUCT_GROUP_RENAMED',
      entityType: 'PRODUCT_GROUP',
      entityId: id,
      before,
      after: { name },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  return ok(c, { id });
});

/** Xóa nhóm: sản phẩm trong nhóm chuyển về "Chưa có nhóm". Nhóm đang dùng trong giá điều chỉnh thì chưa xóa được. */
catalogRoutes.delete('/product-groups/:id', adminOnlyEndpoint, requirePermission('product.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const g = await c.env.DB.prepare('SELECT id, code, name FROM product_groups WHERE id = ?').bind(id).first<{ id: string; code: string; name: string }>();
  if (!g) throw notFound('Không tìm thấy nhóm');
  const adj = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM price_adjustments WHERE group_id = ?1 OR group_ids LIKE '%"' || ?1 || '"%'`,
  )
    .bind(id)
    .first<{ n: number }>();
  if ((adj?.n ?? 0) > 0) {
    throw badRequest('GROUP_IN_ADJUSTMENTS', `Nhóm "${g.name}" đang dùng trong ${adj!.n} giá điều chỉnh / khuyến mại nên chưa xóa được. Sửa hoặc xóa các điều chỉnh đó trước.`);
  }
  const used = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE group_id = ? AND deleted_at IS NULL').bind(id).first<{ n: number }>();
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE products SET group_id = NULL, updated_at = ? WHERE group_id = ?').bind(now, id),
    c.env.DB.prepare('DELETE FROM product_groups WHERE id = ?').bind(id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'PRODUCT_GROUP_DELETED',
      entityType: 'PRODUCT_GROUP',
      entityId: id,
      before: { ...g, products: used?.n ?? 0 },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  return ok(c, { id, moved: used?.n ?? 0 });
});

/** Chuyển nhiều sản phẩm vào một nhóm cùng lúc (group_id rỗng = bỏ khỏi nhóm). */
catalogRoutes.post('/products/bulk-group', adminOnlyEndpoint, requirePermission('product.manage'), async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => ({}))) as { ids?: unknown; group_id?: unknown };
  const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map((x) => String(x)))].filter(Boolean);
  if (!ids.length) throw badRequest('MISSING', 'Chưa chọn sản phẩm nào');
  if (ids.length > 500) throw badRequest('TOO_MANY', 'Mỗi lần tối đa 500 sản phẩm');
  const groupId = typeof b.group_id === 'string' && b.group_id ? b.group_id : null;
  if (groupId) {
    const g = await c.env.DB.prepare('SELECT id FROM product_groups WHERE id = ?').bind(groupId).first();
    if (!g) throw notFound('Không tìm thấy nhóm');
  }
  const now = nowIso();
  const stmts: D1PreparedStatement[] = ids.map((id) =>
    c.env.DB.prepare('UPDATE products SET group_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').bind(groupId, now, id),
  );
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  await auditStatement(c.env.DB, {
    actorId: auth.user.id,
    action: 'PRODUCT_BULK_GROUP',
    entityType: 'PRODUCT',
    entityId: null,
    after: { group_id: groupId, count: ids.length },
    requestId: c.get('requestId'),
    ip: c.req.header('CF-Connecting-IP') ?? null,
  }).run();
  return ok(c, { count: ids.length });
});

/** Thêm sản phẩm mới (SKU). Giá nhập riêng ở màn hình Bảng giá. */
catalogRoutes.post('/products', adminOnlyEndpoint, requirePermission('product.manage'), async (c) => {
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

catalogRoutes.patch('/products/:id', adminOnlyEndpoint, requirePermission('product.manage'), async (c) => {
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

/** Danh sách sản phẩm đã có ảnh (để trang hiện ô ảnh mà không phải tải từng ảnh). */
catalogRoutes.get('/products/photos', async (c) => {
  const rows = (await c.env.DB.prepare('SELECT product_id, updated_at AS v FROM product_img').all<{ product_id: string; v: string }>()).results ?? [];
  return ok(c, rows);
});

/** Ảnh sản phẩm: trả thẳng file ảnh cho thẻ <img>; ?t=1 lấy bản nhỏ. */
catalogRoutes.get('/products/:id/photo', async (c) => {
  const thumb = c.req.query('t') === '1';
  const row = await c.env.DB
    .prepare(
      thumb
        ? "SELECT CASE WHEN thumb <> '' THEN 'image/jpeg' ELSE mime END AS mime, CASE WHEN thumb <> '' THEN thumb ELSE data END AS data FROM product_img WHERE product_id = ?"
        : 'SELECT mime, data FROM product_img WHERE product_id = ?',
    )
    .bind(c.req.param('id'))
    .first<{ mime: string; data: string }>();
  if (!row) throw notFound('Chưa có ảnh');
  const bin = Uint8Array.from(atob(row.data), (ch) => ch.charCodeAt(0));
  return new Response(bin, { headers: { 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=604800' } });
});

catalogRoutes.put('/products/:id/photo', adminOnlyEndpoint, requirePermission('product.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const b = (await c.req.json().catch(() => null)) as { image?: unknown; thumb?: unknown } | null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b?.image ?? ''));
  if (!m) throw badRequest('BAD_IMAGE', 'Ảnh không đúng định dạng (jpg, png, webp)');
  if (m[2].length > 600_000) throw badRequest('IMAGE_TOO_BIG', 'Ảnh quá lớn, hãy chọn ảnh nhỏ hơn');
  const exists = await c.env.DB.prepare('SELECT 1 AS x FROM products WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!exists) throw notFound('Không tìm thấy sản phẩm');
  const tm = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b?.thumb ?? ''));
  const thumb = tm && tm[1].length <= 60_000 ? tm[1] : '';
  const now = nowIso();
  await c.env.DB
    .prepare(
      `INSERT INTO product_img (product_id, mime, data, thumb, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(product_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, thumb = excluded.thumb,
         updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    )
    .bind(id, m[1], m[2], thumb, auth.user.id, now)
    .run();
  return ok(c, { id, v: now });
});

catalogRoutes.delete('/products/:id/photo', adminOnlyEndpoint, requirePermission('product.manage'), async (c) => {
  await c.env.DB.prepare('DELETE FROM product_img WHERE product_id = ?').bind(c.req.param('id')).run();
  return ok(c, { ok: true });
});

/**
 * Xóa sản phẩm: xóa mềm (biến khỏi danh sách và khi lập đơn), lịch sử đơn cũ giữ nguyên. Không xóa khi sản phẩm còn nằm trong
 * đơn đang chờ duyệt hoặc đã duyệt nhưng chưa xuất kho; lúc đó chỉ có thể "ngừng bán".
 */
catalogRoutes.delete('/products/:id', adminOnlyEndpoint, requirePermission('product.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const p = await c.env.DB.prepare('SELECT id, sku, name FROM products WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<{ id: string; sku: string; name: string }>();
  if (!p) throw notFound('Không tìm thấy sản phẩm');
  const open = await c.env.DB
    .prepare(
      `SELECT COUNT(DISTINCT o.id) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id = ? AND o.deleted_at IS NULL AND o.approval_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED')
         AND o.delivery_status = 'CHUA_XUAT'`,
    )
    .bind(id)
    .first<{ n: number }>();
  if ((open?.n ?? 0) > 0) {
    throw badRequest('PRODUCT_IN_OPEN_ORDERS', `${p.sku} còn nằm trong ${open!.n} đơn chưa xuất kho nên chưa xóa được. Bấm "Ngừng bán" thay vì xóa.`);
  }
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE products SET deleted_at = ?, active = 0, updated_at = ? WHERE id = ?').bind(now, now, id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'PRODUCT_DELETED',
      entityType: 'PRODUCT',
      entityId: id,
      before: p,
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  return ok(c, { id });
});

/**
 * Đặt giá mới cho (sản phẩm, cấp) từ một ngày hiệu lực.
 * - CEO: giá có hiệu lực ngay (ACTIVE).
 * - Quản lý: tạo bản nháp (DRAFT) + yêu cầu duyệt gửi lên CEO (mục 4: Quản lý đề nghị, CEO duyệt).
 * Giá cũ được đóng lại bằng valid_to = ngày trước ngày hiệu lực mới; đơn cũ giữ nguyên giá đã chốt.
 */
catalogRoutes.post('/prices', adminOnlyEndpoint, requirePermission('price.propose', 'price.approve'), async (c) => {
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

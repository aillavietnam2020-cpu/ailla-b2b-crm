import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso, vnDate } from '@shared/datetime';
import { zodFieldErrors } from '@shared/schemas';
import type { AppEnv } from '../env';
import { auditStatement, clientIp } from '../lib/audit';
import { badRequest, notFound, ok, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { parseIds } from '../services/priceAdjust';
import { adminOnlyEndpoint } from '../middleware/adminHost';
import { requirePermission } from '../middleware/rbac';

/**
 * Giá điều chỉnh / khuyến mại: lớp tạm thời đặt lên trên bảng giá gốc.
 * Xem: ai xem được bảng giá. Tạo / bật tắt / xóa: người có quyền duyệt giá (CEO) trên trang quản trị.
 */
export const priceAdjustmentRoutes = new Hono<AppEnv>();

const createSchema = z
  .object({
    label: z.string().trim().min(2, 'Ghi lý do / tên chương trình').max(120),
    scope: z.enum(['ALL', 'GROUP', 'PRODUCT']),
    product_id: z.string().trim().max(80).optional().nullable(),
    group_id: z.string().trim().max(80).optional().nullable(),
    product_ids: z.array(z.string().trim().max(80)).max(400).default([]),
    group_ids: z.array(z.string().trim().max(80)).max(60).default([]),
    exclude_ids: z.array(z.string().trim().max(80)).max(400).default([]),
    tier_ids: z.array(z.string().trim().max(80)).max(12).default([]),
    kind: z.enum(['PERCENT', 'AMOUNT', 'FIXED']),
    value: z.number().finite(),
    round_to: z.number().int().min(1).max(10000).default(100),
    valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu không hợp lệ').optional(),
    valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày kết thúc không hợp lệ').optional().nullable(),
  })
  .superRefine((d, ctx) => {
    if (d.scope === 'PRODUCT' && !d.product_id && !d.product_ids.length) ctx.addIssue({ code: 'custom', path: ['product_ids'], message: 'Chọn ít nhất một sản phẩm' });
    if (d.scope === 'GROUP' && !d.group_id && !d.group_ids.length) ctx.addIssue({ code: 'custom', path: ['group_ids'], message: 'Chọn ít nhất một nhóm sản phẩm' });
    if (d.kind === 'PERCENT' && (d.value <= -100 || d.value > 500)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Phần trăm phải trong khoảng -99 đến 500' });
    }
    if (d.kind === 'FIXED' && !(d.value >= 0)) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Giá khuyến mại không âm' });
    if (d.valid_to && d.valid_from && d.valid_to < d.valid_from) {
      ctx.addIssue({ code: 'custom', path: ['valid_to'], message: 'Ngày kết thúc phải sau ngày bắt đầu' });
    }
  });

priceAdjustmentRoutes.get('/', requirePermission('price.read'), async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT a.id, a.label, a.scope, a.product_id, p.sku AS product_sku, p.name AS product_name, a.group_id, g.name AS group_name,
                a.product_ids, a.group_ids, a.exclude_ids, a.tier_ids, a.kind, a.value, a.round_to, a.valid_from, a.valid_to, a.status, a.created_at, u.display_name AS created_by_name
         FROM price_adjustments a
         LEFT JOIN products p ON p.id = a.product_id
         LEFT JOIN product_groups g ON g.id = a.group_id
         LEFT JOIN users u ON u.id = a.created_by
         ORDER BY a.status, COALESCE(a.valid_to, '9999-12-31'), a.created_at DESC`,
      )
      .all<Record<string, unknown> & { tier_ids: string; product_id: string | null; group_id: string | null; product_ids: string; group_ids: string; exclude_ids: string }>()
  ).results ?? [];
  const today = vnDate();
  const prodRows = (await c.env.DB.prepare('SELECT id, sku, name FROM products').all<{ id: string; sku: string; name: string }>()).results ?? [];
  const groupRows = (await c.env.DB.prepare('SELECT id, name FROM product_groups').all<{ id: string; name: string }>()).results ?? [];
  const pName = new Map(prodRows.map((p) => [p.id, { id: p.id, sku: p.sku, name: p.name }]));
  const gName = new Map(groupRows.map((g) => [g.id, { id: g.id, name: g.name }]));
  return ok(
    c,
    rows.map((r) => {
      const tiers = parseIds(r.tier_ids);
      const pids = [...new Set([...parseIds(r.product_ids), ...(r.product_id ? [r.product_id] : [])])];
      const gids = [...new Set([...parseIds(r.group_ids), ...(r.group_id ? [r.group_id] : [])])];
      const eids = parseIds(r.exclude_ids);
      const from = String(r.valid_from);
      const to = r.valid_to ? String(r.valid_to) : null;
      const state =
        r.status !== 'ACTIVE' ? 'OFF' : from > today ? 'SAP_AP_DUNG' : to && to < today ? 'HET_HAN' : 'DANG_AP_DUNG';
      return {
        ...r,
        tier_ids: tiers,
        state,
        products: pids.map((i) => pName.get(i)).filter(Boolean),
        groups: gids.map((i) => gName.get(i)).filter(Boolean),
        excludes: eids.map((i) => pName.get(i)).filter(Boolean),
      };
    }),
  );
});

priceAdjustmentRoutes.post('/', adminOnlyEndpoint, requirePermission('price.approve'), async (c) => {
  const auth = c.get('auth');
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Giá điều chỉnh chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const d = parsed.data;
  const now = nowIso();
  const id = newId();
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO price_adjustments (id, label, scope, product_id, group_id, product_ids, group_ids, exclude_ids, tier_ids, kind, value, round_to, valid_from, valid_to, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      )
      .bind(
        id,
        d.label,
        d.scope,
        null,
        null,
        JSON.stringify(d.scope === 'PRODUCT' ? [...new Set([...d.product_ids, ...(d.product_id ? [d.product_id] : [])])] : []),
        JSON.stringify(d.scope === 'GROUP' ? [...new Set([...d.group_ids, ...(d.group_id ? [d.group_id] : [])])] : []),
        JSON.stringify(d.scope === 'PRODUCT' ? [] : d.exclude_ids),
        JSON.stringify(d.tier_ids),
        d.kind,
        d.value,
        d.round_to,
        d.valid_from ?? vnDate(),
        d.valid_to ?? null,
        auth.user.id,
        now,
        now,
      ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'PRICE_ADJUSTMENT_CREATED',
      entityType: 'PRICE_ADJUSTMENT',
      entityId: id,
      after: d,
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { id });
});

/** Bật / tắt một điều chỉnh (tắt là về ngay giá gốc, không mất cấu hình). */
priceAdjustmentRoutes.post('/:id/toggle', adminOnlyEndpoint, requirePermission('price.approve'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const b = (await c.req.json().catch(() => null)) as { active?: unknown } | null;
  const row = await c.env.DB.prepare('SELECT id FROM price_adjustments WHERE id = ?').bind(id).first();
  if (!row) throw notFound('Không tìm thấy điều chỉnh');
  const status = b?.active === false ? 'OFF' : 'ACTIVE';
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE price_adjustments SET status = ?, updated_at = ? WHERE id = ?').bind(status, nowIso(), id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'PRICE_ADJUSTMENT_TOGGLED',
      entityType: 'PRICE_ADJUSTMENT',
      entityId: id,
      after: { status },
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { id, status });
});

priceAdjustmentRoutes.post('/:id/delete', adminOnlyEndpoint, requirePermission('price.approve'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const res = await c.env.DB.prepare('DELETE FROM price_adjustments WHERE id = ?').bind(id).run();
  if (!res.meta.changes) throw badRequest('NOT_FOUND', 'Không tìm thấy điều chỉnh');
  await auditStatement(c.env.DB, {
    actorId: auth.user.id,
    action: 'PRICE_ADJUSTMENT_DELETED',
    entityType: 'PRICE_ADJUSTMENT',
    entityId: id,
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  }).run();
  return ok(c, { id });
});

import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso, vnDate } from '@shared/datetime';
import { zodFieldErrors } from '@shared/schemas';
import type { AppEnv, AuthContext } from '../env';
import { auditStatement, clientIp } from '../lib/audit';
import { badRequest, conflict, forbidden, notFound, ok, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { adminOnlyEndpoint } from '../middleware/adminHost';
import { bonusReport, loadTiers } from '../services/bonus';
import { spanOf } from '../lib/span';

/**
 * Cơ chế thưởng NPP theo doanh số lẻ. Cơ chế (chung + riêng từng khách) do CEO đặt ở TRANG QUẢN TRỊ;
 * báo cáo xem được bởi CEO, quản lý điều phối và kế toán.
 */
export const bonusRoutes = new Hono<AppEnv>();

const isCeo = (a: AuthContext) => a.user.role === 'CEO';
const canRead = (a: AuthContext) =>
  isCeo(a) || a.permissions.includes('order.approve.normal') || a.permissions.includes('order.accounting.confirm');

const tierSchema = z.object({
  label: z.string().trim().max(60).optional().default(''),
  threshold: z.number().int().min(0),
  cash: z.number().int().min(0).default(0),
  gift_text: z.string().trim().max(200).optional().default(''),
  gift_value: z.number().int().min(0).default(0),
  gift_items: z
    .array(z.object({ item: z.string().trim().min(1).max(80), qty: z.number().positive().max(1_000_000) }))
    .max(20)
    .optional()
    .default([]),
});
const policySchema = z.object({
  customer_id: z.string().trim().max(80).optional().default(''),
  period: z.enum(['MONTH', 'YEAR']),
  tiers: z.array(tierSchema).max(30),
});

bonusRoutes.get('/policy', async (c) => {
  if (!canRead(c.get('auth'))) throw forbidden('Không có quyền xem cơ chế thưởng');
  const tiers = await loadTiers(c.env.DB);
  const names = (
    await c.env.DB.prepare('SELECT id, name FROM customers WHERE deleted_at IS NULL').all<{ id: string; name: string }>()
  ).results ?? [];
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  const general = tiers.get('') ?? { MONTH: [], YEAR: [] };
  const overrides = [...tiers.entries()]
    .filter(([id]) => id !== '')
    .map(([id, t]) => ({ customer_id: id, customer_name: nameOf.get(id) ?? id, MONTH: t.MONTH, YEAR: t.YEAR }));
  return ok(c, { general, overrides, can_edit: isCeo(c.get('auth')) });
});

/** Lưu trọn bảng mốc của một cơ chế (chung hoặc riêng một khách). Bảng rỗng + customer_id: xóa cơ chế riêng. */
bonusRoutes.put('/policy', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO đặt cơ chế thưởng');
  const parsed = policySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Cơ chế thưởng chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const d = parsed.data;
  if (d.customer_id === '' && d.tiers.length === 0) throw badRequest('EMPTY_GENERAL', 'Cơ chế chung không được để trống');
  const sorted = [...d.tiers].sort((a, b) => a.threshold - b.threshold);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].threshold === sorted[i - 1].threshold) {
      throw badRequest('DUP_THRESHOLD', 'Hai mốc không được có cùng mức doanh số');
    }
  }
  // Mã quà phải có trong danh mục kho.
  const codes = [...new Set(sorted.flatMap((t) => t.gift_items.map((g) => g.item)))];
  if (codes.length) {
    const found = (
      await c.env.DB
        .prepare(`SELECT code FROM kho_items WHERE code IN (${codes.map(() => '?').join(',')})`)
        .bind(...codes)
        .all<{ code: string }>()
    ).results ?? [];
    const have = new Set(found.map((f) => f.code));
    const miss = codes.filter((x) => !have.has(x));
    if (miss.length) throw badRequest('BAD_ITEM', `Mã quà chưa có trong danh mục kho: ${miss.join(', ')}`);
  }
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM bonus_tiers WHERE customer_id = ? AND period = ?').bind(d.customer_id, d.period),
    ...sorted.map((t, i) =>
      c.env.DB
        .prepare(
          `INSERT INTO bonus_tiers (id, customer_id, period, level_no, label, threshold, cash, gift_text, gift_value, gift_items, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          d.customer_id,
          d.period,
          i + 1,
          t.label || (d.period === 'MONTH' ? `Mức ${i + 1}` : `Mốc ${i + 1}`),
          t.threshold,
          t.cash,
          t.gift_text,
          t.gift_value,
          JSON.stringify(t.gift_items),
          auth.user.id,
          now,
        ),
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'BONUS_POLICY_SAVED',
      entityType: 'BONUS_POLICY',
      entityId: d.customer_id || 'CHUNG',
      after: { period: d.period, tiers: sorted.length },
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { saved: sorted.length });
});

/** Mã trợ giá / flash sale: không tính vào doanh số thưởng. */
bonusRoutes.get('/excluded', async (c) => {
  if (!canRead(c.get('auth'))) throw forbidden('Không có quyền xem');
  const rows = await c.env.DB
    .prepare('SELECT id, sku, name, bonus_excluded FROM products WHERE deleted_at IS NULL AND active = 1 ORDER BY sku')
    .all();
  return ok(c, rows.results ?? []);
});

bonusRoutes.put('/excluded', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO đánh dấu mã không tính thưởng');
  const b = (await c.req.json().catch(() => null)) as { product_id?: unknown; excluded?: unknown } | null;
  const id = String(b?.product_id ?? '');
  if (!id) throw badRequest('MISSING', 'Thiếu sản phẩm');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE products SET bonus_excluded = ? WHERE id = ?').bind(b?.excluded ? 1 : 0, id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'BONUS_EXCLUDED_SET',
      entityType: 'PRODUCT',
      entityId: id,
      after: { excluded: Boolean(b?.excluded) },
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { product_id: id, excluded: Boolean(b?.excluded) });
});

bonusRoutes.get('/report', async (c) => {
  if (!canRead(c.get('auth'))) throw forbidden('Không có quyền xem báo cáo thưởng');
  const q = c.req.query('month') ?? vnDate().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(q) && !/^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/.test(q))
    throw badRequest('BAD_MONTH', 'Tháng phải dạng 2026-10');
  const span = spanOf(q);
  const rep = await bonusReport(c.env.DB, span.to.slice(0, 7), { from: span.from, to: span.to });
  return ok(c, { ...rep, month: q, from: span.from, to: span.to });
});

/* ---------------- Phiếu xuất quà thưởng ---------------- */
const canApprove = (a: AuthContext) => isCeo(a) || a.permissions.includes('order.approve.normal');

interface GiftLine {
  item: string;
  name: string;
  qty: number;
}

bonusRoutes.get('/gifts', async (c) => {
  if (!canRead(c.get('auth'))) throw forbidden('Không có quyền xem phiếu quà thưởng');
  const month = c.req.query('month') ?? vnDate().slice(0, 7);
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT g.id, g.voucher_no, g.customer_id, cu.name AS customer_name, g.month, g.level_label, g.retail_sales, g.items,
                g.status, g.kho_doc_no, g.cancel_reason, g.created_at
         FROM bonus_gift_vouchers g JOIN customers cu ON cu.id = g.customer_id
         WHERE g.month = ? ORDER BY g.created_at DESC`,
      )
      .bind(month)
      .all<Record<string, unknown> & { items: string }>()
  ).results ?? [];
  return ok(
    c,
    rows.map((r) => ({ ...r, items: JSON.parse(r.items || '[]') as GiftLine[] })),
    { can_approve: canApprove(c.get('auth')) },
  );
});

/** Lập phiếu xuất quà cho một khách trong một tháng theo mốc thưởng đã đạt. Chưa trừ kho cho tới khi Thảo duyệt. */
bonusRoutes.post('/gifts', async (c) => {
  const auth = c.get('auth');
  if (!canRead(auth)) throw forbidden('Không có quyền lập phiếu quà thưởng');
  const b = (await c.req.json().catch(() => null)) as { customer_id?: unknown; month?: unknown } | null;
  const customerId = String(b?.customer_id ?? '');
  const month = String(b?.month ?? '');
  if (!customerId || !/^\d{4}-\d{2}$/.test(month)) throw badRequest('BAD_INPUT', 'Thiếu khách hoặc tháng');
  const rep = await bonusReport(c.env.DB, month);
  const row = rep.rows.find((r) => r.customer_id === customerId);
  if (!row) throw notFound('Khách này không có doanh số trong tháng');
  if (!row.month_gift_items.length) {
    throw badRequest(
      'NO_GIFT_ITEMS',
      row.month_gift_text
        ? 'Mức thưởng này chưa khai mã quà. Vào Cơ chế thưởng NPP, khai mã kho và số lượng quà cho mức này.'
        : 'Khách chưa đạt mức có thưởng hàng.',
    );
  }
  const codes = row.month_gift_items.map((g) => g.item);
  const names = new Map(
    (
      (await c.env.DB
        .prepare(`SELECT code, name FROM kho_items WHERE code IN (${codes.map(() => '?').join(',')})`)
        .bind(...codes)
        .all<{ code: string; name: string }>()).results ?? []
    ).map((r) => [r.code, r.name]),
  );
  const items: GiftLine[] = row.month_gift_items.map((g) => ({ item: g.item, name: names.get(g.item) ?? g.item, qty: g.qty }));
  const dup = await c.env.DB
    .prepare("SELECT voucher_no FROM bonus_gift_vouchers WHERE customer_id = ? AND month = ? AND status <> 'HUY'")
    .bind(customerId, month)
    .first<{ voucher_no: string }>();
  if (dup) throw conflict('EXISTS', `Tháng này khách đã có phiếu quà ${dup.voucher_no}`);

  const ym = month.slice(2, 4) + month.slice(5, 7);
  const n = (
    await c.env.DB.prepare('SELECT COUNT(*) AS n FROM bonus_gift_vouchers WHERE voucher_no LIKE ?').bind(`PQT${ym}-%`).first<{ n: number }>()
  )?.n ?? 0;
  const no = `PQT${ym}-${String(n + 1).padStart(3, '0')}`;
  const id = newId();
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO bonus_gift_vouchers (id, voucher_no, customer_id, month, level_label, retail_sales, items, status, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'CHO_DUYET', ?, ?)`,
      )
      .bind(id, no, customerId, month, row.month_level, row.retail_sales, JSON.stringify(items), auth.user.id, nowIso()),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'BONUS_GIFT_CREATED',
      entityType: 'BONUS_GIFT',
      entityId: no,
      after: { customer_id: customerId, month, level: row.month_level, items },
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { id, voucher_no: no, items });
});

/** Thảo duyệt: ghi phiếu xuất kho (XK) và trừ tồn các mã quà. */
bonusRoutes.post('/gifts/:id/approve', async (c) => {
  const auth = c.get('auth');
  if (!canApprove(auth)) throw forbidden('Chỉ quản lý điều phối hoặc CEO duyệt phiếu xuất quà');
  const id = c.req.param('id');
  const v = await c.env.DB
    .prepare(
      `SELECT g.voucher_no, g.status, g.items, g.month, g.level_label, cu.name AS customer_name
       FROM bonus_gift_vouchers g JOIN customers cu ON cu.id = g.customer_id WHERE g.id = ?`,
    )
    .bind(id)
    .first<{ voucher_no: string; status: string; items: string; month: string; level_label: string; customer_name: string }>();
  if (!v) throw notFound('Không tìm thấy phiếu');
  if (v.status !== 'CHO_DUYET') throw conflict('NOT_PENDING', 'Phiếu này không còn chờ duyệt');
  const items = JSON.parse(v.items || '[]') as GiftLine[];
  const date = vnDate();
  const ym = date.slice(2, 4) + date.slice(5, 7);
  const now = nowIso();
  let docNo = '';
  let docId = 0;
  for (let attempt = 0; attempt < 4 && !docId; attempt++) {
    const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM kho_docs WHERE type = ? AND no LIKE ?')
      .bind('XK', `XK${ym}-%`)
      .first<{ n: number }>();
    docNo = `XK${ym}-${String((row?.n ?? 0) + 1 + attempt).padStart(3, '0')}`;
    try {
      await c.env.DB
        .prepare(
          `INSERT INTO kho_docs (no, type, doc_date, partner, ref_no, ref_qty, note, extra, status, created_by, created_at)
           VALUES (?, 'XK', ?, ?, ?, NULL, ?, ?, 'OK', ?, ?)`,
        )
        .bind(
          docNo,
          date,
          v.customer_name,
          v.voucher_no,
          `Quà thưởng ${v.level_label} tháng ${v.month}`,
          JSON.stringify({ kind: 'Quà thưởng', gift_voucher: v.voucher_no }),
          auth.user.id,
          now,
        )
        .run();
      docId = (await c.env.DB.prepare('SELECT id FROM kho_docs WHERE no = ?').bind(docNo).first<{ id: number }>())?.id ?? 0;
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e;
    }
  }
  if (!docId) throw conflict('NO_CLASH', 'Không cấp được số phiếu kho, thử lại');
  await c.env.DB.batch([
    ...items.map((g) =>
      c.env.DB
        .prepare("INSERT INTO kho_moves (doc_id, item, qty, std_qty, price, role, note) VALUES (?, ?, ?, NULL, NULL, 'OUT', ?)")
        .bind(docId, g.item, -g.qty, `Quà thưởng ${v.voucher_no}`),
    ),
    c.env.DB
      .prepare(
        "UPDATE bonus_gift_vouchers SET status = 'DA_DUYET', kho_doc_no = ?, approved_by = ?, approved_at = ? WHERE id = ? AND status = 'CHO_DUYET'",
      )
      .bind(docNo, auth.user.id, now, id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'BONUS_GIFT_APPROVED',
      entityType: 'BONUS_GIFT',
      entityId: v.voucher_no,
      after: { kho_doc: docNo, items },
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { voucher_no: v.voucher_no, kho_doc_no: docNo });
});

/** Hủy phiếu quà. Đã duyệt thì hủy luôn phiếu xuất kho, kho trả lại tồn. */
bonusRoutes.post('/gifts/:id/cancel', async (c) => {
  const auth = c.get('auth');
  if (!canApprove(auth)) throw forbidden('Chỉ quản lý điều phối hoặc CEO hủy phiếu xuất quà');
  const id = c.req.param('id');
  const reason = String(((await c.req.json().catch(() => null)) as { reason?: unknown } | null)?.reason ?? '').trim();
  if (reason.length < 3) throw badRequest('NO_REASON', 'Cần ghi lý do hủy');
  const v = await c.env.DB
    .prepare('SELECT voucher_no, status, kho_doc_no FROM bonus_gift_vouchers WHERE id = ?')
    .bind(id)
    .first<{ voucher_no: string; status: string; kho_doc_no: string | null }>();
  if (!v) throw notFound('Không tìm thấy phiếu');
  if (v.status === 'HUY') throw conflict('ALREADY', 'Phiếu đã hủy rồi');
  const now = nowIso();
  const stmts = [
    c.env.DB
      .prepare("UPDATE bonus_gift_vouchers SET status = 'HUY', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ?")
      .bind(reason, auth.user.id, now, id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'BONUS_GIFT_CANCELLED',
      entityType: 'BONUS_GIFT',
      entityId: v.voucher_no,
      reason,
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ];
  if (v.kho_doc_no) {
    stmts.push(
      c.env.DB
        .prepare(
          "UPDATE kho_docs SET status = 'HUY', cancelled_by = ?, cancelled_at = ?, cancel_reason = ? WHERE no = ? AND status = 'OK'",
        )
        .bind(auth.user.id, now, `Hủy phiếu quà ${v.voucher_no}: ${reason}`, v.kho_doc_no),
    );
  }
  await c.env.DB.batch(stmts);
  return ok(c, { voucher_no: v.voucher_no });
});


/* ---------------- Phiếu chi thưởng bằng tiền ---------------- */
const cashSchema = z.object({
  customer_id: z.string().trim().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Tháng phải dạng 2026-10'),
  amount: z.number().int('Số tiền là số nguyên (đồng)').min(1, 'Số tiền phải lớn hơn 0').max(10_000_000_000),
  method: z.enum(['TIEN_MAT', 'CHUYEN_KHOAN', 'KHAC']).default('CHUYEN_KHOAN'),
  note: z.string().trim().max(300).optional().default(''),
});

bonusRoutes.get('/cash', async (c) => {
  const auth = c.get('auth');
  if (!canRead(auth)) throw forbidden('Không có quyền xem phiếu chi thưởng');
  const month = c.req.query('month') ?? vnDate().slice(0, 7);
  const rows = await c.env.DB
    .prepare(
      `SELECT v.id, v.voucher_no, v.customer_id, cu.name AS customer_name, v.month, v.amount, v.method, v.note, v.status,
              v.cancel_reason, v.created_at, u.display_name AS created_by_name, a.display_name AS approved_by_name
       FROM bonus_cash_vouchers v JOIN customers cu ON cu.id = v.customer_id
       LEFT JOIN users u ON u.id = v.created_by LEFT JOIN users a ON a.id = v.approved_by
       WHERE v.month = ? ORDER BY v.created_at DESC`,
    )
    .bind(month)
    .all();
  return ok(c, rows.results ?? [], { can_approve: canApprove(auth) });
});

bonusRoutes.post('/cash', async (c) => {
  const auth = c.get('auth');
  if (!canRead(auth)) throw forbidden('Không có quyền lập phiếu chi thưởng');
  const parsed = cashSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw unprocessable('VALIDATION_FAILED', 'Phiếu chi chưa hợp lệ', zodFieldErrors(parsed.error));
  const d = parsed.data;
  const rep = await bonusReport(c.env.DB, d.month);
  const row = rep.rows.find((r) => r.customer_id === d.customer_id);
  if (!row) throw notFound('Khách này không có doanh số trong tháng');
  if (d.amount > row.payable) {
    throw badRequest(
      'OVER_PAYABLE',
      `Chỉ còn phải chi ${row.payable.toLocaleString('vi-VN')}đ (thưởng ${row.month_cash.toLocaleString('vi-VN')}đ, đã trừ vào đơn ${row.advanced.toLocaleString('vi-VN')}đ, đã chi hoặc chờ duyệt ${row.paid.toLocaleString('vi-VN')}đ).`,
    );
  }
  const ym = d.month.slice(2, 4) + d.month.slice(5, 7);
  const id = newId();
  for (let attempt = 0; attempt < 4; attempt++) {
    const n = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM bonus_cash_vouchers WHERE voucher_no LIKE ?').bind(`PCT${ym}-%`).first<{ n: number }>())?.n ?? 0;
    const no = `PCT${ym}-${String(n + 1 + attempt).padStart(3, '0')}`;
    try {
      await c.env.DB.batch([
        c.env.DB
          .prepare(
            `INSERT INTO bonus_cash_vouchers (id, voucher_no, customer_id, month, amount, method, note, status, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'CHO_DUYET', ?, ?)`,
          )
          .bind(id, no, d.customer_id, d.month, d.amount, d.method, d.note, auth.user.id, nowIso()),
        auditStatement(c.env.DB, {
          actorId: auth.user.id,
          action: 'BONUS_CASH_CREATED',
          entityType: 'BONUS_CASH',
          entityId: no,
          after: { customer_id: d.customer_id, month: d.month, amount: d.amount, method: d.method },
          requestId: c.get('requestId'),
          ip: clientIp(c.req.raw.headers),
        }),
      ]);
      return ok(c, { id, voucher_no: no });
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e;
    }
  }
  throw conflict('NO_CLASH', 'Không cấp được số phiếu, thử lại');
});

/** Quản lý điều phối / CEO duyệt: phiếu thành "đã chi". Người lập phiếu không tự duyệt phiếu của mình (trừ CEO). */
bonusRoutes.post('/cash/:id/approve', async (c) => {
  const auth = c.get('auth');
  if (!canApprove(auth)) throw forbidden('Chỉ quản lý điều phối hoặc CEO duyệt phiếu chi thưởng');
  const v = await c.env.DB
    .prepare('SELECT voucher_no, status, created_by FROM bonus_cash_vouchers WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ voucher_no: string; status: string; created_by: string | null }>();
  if (!v) throw notFound('Không tìm thấy phiếu');
  if (v.status !== 'CHO_DUYET') throw conflict('BAD_STEP', 'Phiếu này không còn ở bước chờ duyệt');
  if (v.created_by === auth.user.id && !isCeo(auth)) throw forbidden('Người lập phiếu không tự duyệt phiếu của mình');
  await c.env.DB.batch([
    c.env.DB
      .prepare("UPDATE bonus_cash_vouchers SET status = 'DA_CHI', approved_by = ?, approved_at = ? WHERE id = ? AND status = 'CHO_DUYET'")
      .bind(auth.user.id, nowIso(), c.req.param('id')),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'BONUS_CASH_APPROVED',
      entityType: 'BONUS_CASH',
      entityId: v.voucher_no,
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { ok: true });
});

bonusRoutes.post('/cash/:id/cancel', async (c) => {
  const auth = c.get('auth');
  if (!canApprove(auth)) throw forbidden('Chỉ quản lý điều phối hoặc CEO hủy phiếu chi thưởng');
  const body = (await c.req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = String(body?.reason ?? '').trim();
  if (reason.length < 3) throw badRequest('NO_REASON', 'Cần ghi lý do hủy phiếu');
  const v = await c.env.DB
    .prepare('SELECT voucher_no, status FROM bonus_cash_vouchers WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ voucher_no: string; status: string }>();
  if (!v) throw notFound('Không tìm thấy phiếu');
  if (v.status === 'HUY') throw conflict('ALREADY', 'Phiếu này đã hủy rồi');
  await c.env.DB.batch([
    c.env.DB
      .prepare("UPDATE bonus_cash_vouchers SET status = 'HUY', cancelled_by = ?, cancelled_at = ?, cancel_reason = ? WHERE id = ? AND status <> 'HUY'")
      .bind(auth.user.id, nowIso(), reason, c.req.param('id')),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'BONUS_CASH_CANCELLED',
      entityType: 'BONUS_CASH',
      entityId: v.voucher_no,
      reason,
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { ok: true });
});

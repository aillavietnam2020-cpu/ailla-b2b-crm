import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, conflict, forbidden, notFound, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import { requirePermission } from '../middleware/rbac';

/**
 * Kho sản xuất: nhập NVL → pha chế BTP → kiểm kê đóng gói → xuất kho → hàng hoàn.
 * Sổ ghi theo từng dòng (kho_moves), không sửa đè; phiếu sai thì hủy rồi lập phiếu mới.
 * Tồn = tổng số lượng các dòng của phiếu còn hiệu lực. Đơn giá chỉ trả cho CEO / kế toán.
 */
export const khoRoutes = new Hono<AppEnv>();
khoRoutes.use('*', requirePermission('hub.access'));

const DOC_TYPES = ['PN', 'PC', 'KS', 'XB', 'XK', 'TL', 'TD'] as const;
type DocType = (typeof DOC_TYPES)[number];
const TYPE_NAME: Record<DocType, string> = {
  PN: 'Phiếu nhập kho',
  PC: 'Phiếu pha chế',
  KS: 'Phiếu kiểm kê sản xuất',
  XB: 'Phiếu xuất bán',
  XK: 'Phiếu xuất khác (mẫu, hủy, gia công)',
  TL: 'Phiếu nhập hàng hoàn',
  TD: 'Tồn đầu kỳ',
};
const VAT_TOLERANCE_PCT = 5;

const canPrice = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('debt.read.all');
const isCeo = (a: AuthContext) => a.user.role === 'CEO';
const ip = (c: { req: { header: (n: string) => string | undefined } }) => c.req.header('CF-Connecting-IP') ?? null;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN);
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/* ---------- Danh mục & định mức ---------- */

khoRoutes.get('/catalog', async (c) => {
  const auth = c.get('auth');
  const [items, bom] = await Promise.all([
    c.env.DB.prepare(
      'SELECT code, name, unit, cls, grp, min_stock, active FROM kho_items ORDER BY code',
    ).all<Record<string, unknown>>(),
    c.env.DB.prepare('SELECT product, item, qty, kind, note, sort FROM kho_bom ORDER BY product, sort').all<
      Record<string, unknown>
    >(),
  ]);
  return ok(c, { items: items.results, bom: bom.results, can_price: canPrice(auth) });
});

khoRoutes.post('/items', async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const code = String(b?.code ?? '').trim();
  const name = String(b?.name ?? '').trim();
  const cls = String(b?.cls ?? '');
  if (!code || !name) throw badRequest('MISSING', 'Cần mã và tên vật tư');
  if (!['NVL', 'BTP', 'TP', 'HH', 'CCDC', 'COMBO'].includes(cls)) throw badRequest('BAD_CLS', 'Lớp kho không đúng');
  const dup = await c.env.DB.prepare('SELECT 1 FROM kho_items WHERE code = ?').bind(code).first();
  if (dup) throw conflict('DUP_CODE', 'Mã này đã có trong danh mục');
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
    ).bind(code, name, String(b?.unit ?? ''), cls, String(b?.grp ?? ''), Math.max(0, num(b?.min_stock) || 0), nowIso()),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_ITEM_ADDED',
      entityType: 'KHO_ITEM',
      entityId: code,
      after: { code, name, cls },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { code });
});

khoRoutes.put('/items/:code', async (c) => {
  const auth = c.get('auth');
  const code = c.req.param('code');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const min = num(b?.min_stock);
  if (!(min >= 0)) throw badRequest('BAD_MIN', 'Tồn tối thiểu phải là số từ 0 trở lên');
  const res = await c.env.DB.prepare('UPDATE kho_items SET min_stock = ? WHERE code = ?').bind(min, code).run();
  if (!res.meta.changes) throw notFound('Không có mã này');
  await auditStatement(c.env.DB, {
    actorId: auth.user.id,
    action: 'KHO_ITEM_MIN',
    entityType: 'KHO_ITEM',
    entityId: code,
    after: { min_stock: min },
    requestId: c.get('requestId'),
    ip: ip(c),
  }).run();
  return ok(c, { code, min_stock: min });
});

/** Thay toàn bộ định mức của một sản phẩm (CEO). Phiếu đã ghi không đổi vì sổ lưu số đã trừ. */
khoRoutes.put('/bom/:product', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO sửa định mức');
  const product = c.req.param('product');
  const b = (await c.req.json().catch(() => null)) as { lines?: Array<Record<string, unknown>> } | null;
  const lines = b?.lines;
  if (!Array.isArray(lines)) throw badRequest('MISSING', 'Thiếu dòng định mức');
  const codes = new Set(
    (await c.env.DB.prepare('SELECT code FROM kho_items').all<{ code: string }>()).results.map((r) => r.code),
  );
  if (!codes.has(product)) throw notFound('Không có sản phẩm này');
  const seen = new Set<string>();
  for (const l of lines) {
    const item = String(l.item ?? '');
    if (!codes.has(item)) throw badRequest('BAD_ITEM', `Mã vật tư "${item}" chưa có trong danh mục`);
    if (seen.has(item)) throw badRequest('DUP_ITEM', `Mã "${item}" bị lặp`);
    seen.add(item);
    if (!(num(l.qty) > 0)) throw badRequest('BAD_QTY', `Định mức của "${item}" phải lớn hơn 0`);
  }
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM kho_bom WHERE product = ?').bind(product),
    ...lines.map((l, i) =>
      c.env.DB.prepare('INSERT INTO kho_bom (product, item, qty, kind, note, sort) VALUES (?, ?, ?, ?, ?, ?)').bind(
        product,
        String(l.item),
        num(l.qty),
        String(l.kind ?? ''),
        String(l.note ?? ''),
        i + 1,
      ),
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_BOM_SAVED',
      entityType: 'KHO_BOM',
      entityId: product,
      after: lines,
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { product, lines: lines.length });
});

/* ---------- Tồn kho, NXT, chênh lệch, cảnh báo ---------- */

khoRoutes.get('/stock', async (c) => {
  const asof = isDate(c.req.query('asof')) ? (c.req.query('asof') as string) : '9999-12-31';
  const rows = await c.env.DB.prepare(
    `SELECT item AS code, ROUND(SUM(qty), 6) AS qty
     FROM kho_ledger WHERE doc_date <= ? GROUP BY item`,
  )
    .bind(asof)
    .all<{ code: string; qty: number }>();
  return ok(c, rows.results);
});

/** Nhập – xuất – tồn trong kỳ: tồn đầu = mọi phiếu trước ngày bắt đầu. */
khoRoutes.get('/nxt', async (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!isDate(from) || !isDate(to)) throw badRequest('BAD_RANGE', 'Cần chọn ngày bắt đầu và kết thúc');
  const rows = await c.env.DB.prepare(
    `SELECT item AS code,
       ROUND(SUM(CASE WHEN doc_date < ?1 THEN qty ELSE 0 END), 6) AS opening,
       ROUND(SUM(CASE WHEN doc_date >= ?1 AND doc_date <= ?2 AND qty > 0 THEN qty ELSE 0 END), 6) AS qty_in,
       ROUND(SUM(CASE WHEN doc_date >= ?1 AND doc_date <= ?2 AND qty < 0 THEN -qty ELSE 0 END), 6) AS qty_out,
       ROUND(SUM(CASE WHEN doc_date <= ?2 THEN qty ELSE 0 END), 6) AS closing
     FROM kho_ledger GROUP BY item`,
  )
    .bind(from, to)
    .all<Record<string, number | string>>();
  return ok(c, rows.results);
});

/** Chênh lệch định mức và thực tế của các mẻ pha chế trong kỳ, theo từng NVL. */
khoRoutes.get('/variance', async (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!isDate(from) || !isDate(to)) throw badRequest('BAD_RANGE', 'Cần chọn ngày bắt đầu và kết thúc');
  const rows = await c.env.DB.prepare(
    `SELECT m.item AS code, COUNT(DISTINCT d.id) AS batches,
       ROUND(SUM(m.std_qty), 6) AS std_qty, ROUND(SUM(-m.qty), 6) AS actual_qty
     FROM kho_moves m JOIN kho_docs d ON d.id = m.doc_id
     WHERE d.status = 'OK' AND d.type = 'PC' AND m.role = 'USE' AND d.doc_date >= ? AND d.doc_date <= ?
     GROUP BY m.item`,
  )
    .bind(from, to)
    .all<Record<string, number | string>>();
  return ok(c, { tolerance_pct: VAT_TOLERANCE_PCT, rows: rows.results });
});

/** Cảnh báo cho trang kho và (sau này) cho bot Telegram: dưới mức tối thiểu, tồn âm, phiếu pha chế lệch nhiều. */
export async function khoAlerts(db: D1Database) {
  const stock = await db
    .prepare(
      `SELECT i.code, i.name, i.unit, i.cls, i.min_stock, COALESCE(s.qty, 0) AS qty
       FROM kho_items i LEFT JOIN (
         SELECT item, ROUND(SUM(qty), 6) AS qty FROM kho_ledger GROUP BY item) s ON s.item = i.code
       WHERE i.active = 1 AND (COALESCE(s.qty, 0) < 0 OR (i.min_stock > 0 AND COALESCE(s.qty, 0) < i.min_stock))
       ORDER BY COALESCE(s.qty, 0) - i.min_stock LIMIT 200`,
    )
    .all<{ code: string; name: string; unit: string; cls: string; min_stock: number; qty: number }>();
  const lech = await db
    .prepare(
      `SELECT d.no, d.doc_date, m.item AS code, i.name, ROUND(m.std_qty, 6) AS std_qty, ROUND(-m.qty, 6) AS actual_qty
       FROM kho_moves m JOIN kho_docs d ON d.id = m.doc_id JOIN kho_items i ON i.code = m.item
       WHERE d.status = 'OK' AND d.type = 'PC' AND m.role = 'USE' AND m.std_qty > 0
         AND ABS(-m.qty - m.std_qty) * 100.0 / m.std_qty > ?
       ORDER BY d.doc_date DESC, d.id DESC LIMIT 100`,
    )
    .bind(VAT_TOLERANCE_PCT)
    .all<Record<string, number | string>>();
  return {
    low: stock.results.filter((r) => r.qty >= 0),
    negative: stock.results.filter((r) => r.qty < 0),
    variance: lech.results,
  };
}

khoRoutes.get('/alerts', async (c) => ok(c, await khoAlerts(c.env.DB)));

/* ---------- Phiếu ---------- */

khoRoutes.get('/docs', async (c) => {
  const type = c.req.query('type');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const q = (c.req.query('q') ?? '').trim();
  const where: string[] = [];
  const bind: unknown[] = [];
  if (type) {
    if (!(DOC_TYPES as readonly string[]).includes(type)) throw badRequest('BAD_TYPE', 'Loại phiếu không đúng');
    where.push('d.type = ?');
    bind.push(type);
  }
  if (isDate(from)) {
    where.push('d.doc_date >= ?');
    bind.push(from);
  }
  if (isDate(to)) {
    where.push('d.doc_date <= ?');
    bind.push(to);
  }
  if (q) {
    where.push('(d.no LIKE ? OR d.partner LIKE ? OR d.ref_no LIKE ? OR d.note LIKE ?)');
    bind.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = await c.env.DB.prepare(
    `SELECT d.id, d.no, d.type, d.doc_date, d.partner, d.ref_no, d.ref_qty, d.note, d.extra, d.status,
       d.created_at, u.display_name AS created_by_name, (SELECT COUNT(*) FROM kho_moves m WHERE m.doc_id = d.id) AS n_lines
     FROM kho_docs d LEFT JOIN users u ON u.id = d.created_by
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY d.doc_date DESC, d.id DESC LIMIT 300`,
  )
    .bind(...bind)
    .all<Record<string, unknown>>();
  return ok(c, rows.results);
});

khoRoutes.get('/docs/:id', async (c) => {
  const auth = c.get('auth');
  const id = Number(c.req.param('id'));
  const doc = await c.env.DB.prepare(
    `SELECT d.*, u.display_name AS created_by_name, x.display_name AS cancelled_by_name
     FROM kho_docs d LEFT JOIN users u ON u.id = d.created_by LEFT JOIN users x ON x.id = d.cancelled_by WHERE d.id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!doc) throw notFound('Không tìm thấy phiếu');
  const moves = await c.env.DB.prepare(
    `SELECT m.id, m.item, i.name, i.unit, m.qty, m.std_qty, m.price, m.role, m.note
     FROM kho_moves m JOIN kho_items i ON i.code = m.item WHERE m.doc_id = ? ORDER BY m.id`,
  )
    .bind(id)
    .all<Record<string, unknown>>();
  const showPrice = canPrice(auth);
  return ok(c, {
    doc,
    moves: moves.results.map((m) => (showPrice ? m : { ...m, price: null })),
    type_name: TYPE_NAME[doc.type as DocType],
  });
});

interface Move {
  item: string;
  qty: number;
  std_qty: number | null;
  price: number | null;
  role: string;
  note: string;
}

khoRoutes.post('/docs', async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) throw badRequest('BAD_JSON', 'Dữ liệu gửi lên không đúng định dạng');
  const type = String(b.type ?? '') as DocType;
  if (!(DOC_TYPES as readonly string[]).includes(type)) throw badRequest('BAD_TYPE', 'Loại phiếu không đúng');
  if (type === 'TD' && !isCeo(auth)) throw forbidden('Chỉ CEO nhập tồn đầu kỳ');
  if (!isDate(b.date)) throw badRequest('BAD_DATE', 'Ngày phiếu không đúng');
  const date = b.date;
  const lines = Array.isArray(b.lines) ? (b.lines as Array<Record<string, unknown>>) : [];

  const items = new Map(
    (
      await c.env.DB.prepare('SELECT code, name, unit, cls FROM kho_items').all<{
        code: string;
        name: string;
        unit: string;
        cls: string;
      }>()
    ).results.map((r) => [r.code, r]),
  );
  const need = (code: string) => {
    const it = items.get(code);
    if (!it) throw badRequest('BAD_ITEM', `Mã "${code}" chưa có trong danh mục. Thêm mã mới ở trang Danh mục trước.`);
    return it;
  };
  const positive = (v: unknown, what: string) => {
    const n = num(v);
    if (!(n > 0)) throw badRequest('BAD_QTY', `${what} phải là số lớn hơn 0`);
    return n;
  };

  const moves: Move[] = [];
  const warnings: string[] = [];
  const extra: Record<string, unknown> = {};
  let refQty: number | null = null;

  if (type === 'PN' || type === 'TD') {
    if (!lines.length) throw badRequest('NO_LINES', 'Phiếu chưa có dòng hàng nào');
    for (const l of lines) {
      const code = String(l.item ?? '');
      const it = need(code);
      if (type === 'PN' && !['NVL', 'HH', 'CCDC'].includes(it.cls)) {
        warnings.push(`${code} (${it.name}) không phải nguyên vật liệu / hàng hóa mua về`);
      }
      const price = num(l.price);
      moves.push({
        item: code,
        qty: positive(l.qty, `Số lượng ${code}`),
        std_qty: null,
        price: Number.isFinite(price) && price >= 0 ? price : null,
        role: 'IN',
        note: String(l.note ?? ''),
      });
    }
  } else if (type === 'PC') {
    const btp = String(b.btp ?? '');
    const it = need(btp);
    if (it.cls !== 'BTP') throw badRequest('NOT_BTP', `${btp} không phải bán thành phẩm`);
    const liters = positive(b.liters, 'Số lít thực tế');
    if (!lines.length) throw badRequest('NO_LINES', 'Cần ghi số thực tế của từng nguyên vật liệu đã dùng');
    extra.btp = btp;
    extra.liters = liters;
    refQty = Number.isFinite(num(b.ref_qty)) ? num(b.ref_qty) : null;
    moves.push({ item: btp, qty: liters, std_qty: null, price: null, role: 'PRODUCT', note: '' });
    for (const l of lines) {
      const code = String(l.item ?? '');
      need(code);
      const actual = num(l.qty);
      if (!(actual >= 0)) throw badRequest('BAD_QTY', `Số thực tế của ${code} phải là số từ 0 trở lên`);
      const std = num(l.std_qty);
      moves.push({
        item: code,
        qty: -actual,
        std_qty: Number.isFinite(std) ? std : 0,
        price: null,
        role: 'USE',
        note: String(l.note ?? ''),
      });
    }
    // NVL có trong định mức mà phiếu bỏ sót: báo ngay, không tự trừ thay.
    const bom = (
      await c.env.DB.prepare('SELECT item FROM kho_bom WHERE product = ?').bind(btp).all<{ item: string }>()
    ).results;
    const given = new Set(lines.map((l) => String(l.item)));
    const miss = bom.filter((r) => !given.has(r.item)).map((r) => r.item);
    if (miss.length) warnings.push(`Thiếu số thực tế của: ${miss.join(', ')}. Ghi 0 nếu mẻ này không dùng.`);
  } else if (type === 'KS') {
    if (!lines.length) throw badRequest('NO_LINES', 'Phiếu chưa có thành phẩm nào');
    let sumRef = 0;
    let anyRef = false;
    for (const l of lines) {
      const code = String(l.item ?? '');
      const it = need(code);
      const qty = positive(l.qty, `Số lượng ${code}`);
      const goodRaw = num(l.good_qty);
      const good = Number.isFinite(goodRaw) ? goodRaw : qty;
      if (good < 0 || good > qty) throw badRequest('BAD_GOOD', `${code}: số đạt phải từ 0 đến số kiểm đếm`);
      const r = num(l.ref_qty);
      if (Number.isFinite(r)) {
        sumRef += r;
        anyRef = true;
      }
      // Thành phẩm chỉ cộng phần ĐẠT; vỏ, tem, BTP trừ theo TỔNG đã đóng (hàng lỗi vẫn tốn vật tư).
      if (good > 0) moves.push({ item: code, qty: good, std_qty: null, price: null, role: 'PRODUCT', note: String(l.note ?? '') });
      const bom = (
        await c.env.DB.prepare('SELECT item, qty FROM kho_bom WHERE product = ? ORDER BY sort')
          .bind(code)
          .all<{ item: string; qty: number }>()
      ).results;
      if (!bom.length) warnings.push(`${code} (${it.name}) chưa có định mức nên chưa tự trừ vỏ, tem, BTP.`);
      for (const r2 of bom) {
        const use = round(r2.qty * qty);
        moves.push({ item: r2.item, qty: -use, std_qty: use, price: null, role: 'AUTO', note: `ĐM ${r2.qty} × ${qty}` });
      }
    }
    if (anyRef) refQty = sumRef;
  } else if (type === 'XB' || type === 'XK') {
    if (!lines.length) throw badRequest('NO_LINES', 'Phiếu chưa có dòng hàng nào');
    if (!String(b.partner ?? '').trim() && type === 'XB') throw badRequest('NO_PARTNER', 'Cần ghi khách hàng / nơi nhận');
    extra.kind = String(b.kind ?? '');
    for (const l of lines) {
      const code = String(l.item ?? '');
      need(code);
      moves.push({ item: code, qty: -positive(l.qty, `Số lượng ${code}`), std_qty: null, price: null, role: 'OUT', note: String(l.note ?? '') });
    }
  } else if (type === 'TL') {
    if (!lines.length) throw badRequest('NO_LINES', 'Phiếu chưa có dòng hàng nào');
    for (const l of lines) {
      const code = String(l.item ?? '');
      need(code);
      const verdict = String(l.verdict ?? '');
      if (!['ban_tiep', 'bo'].includes(verdict)) throw badRequest('NO_VERDICT', `${code}: chọn "Bán tiếp" hoặc "Bỏ"`);
      const qty = positive(l.qty, `Số lượng ${code}`);
      // "Bỏ" = hàng hỏng, chỉ ghi nhận để theo dõi tỷ lệ, không cộng tồn.
      moves.push({ item: code, qty: verdict === 'ban_tiep' ? qty : 0, std_qty: verdict === 'bo' ? qty : null, price: null, role: verdict === 'ban_tiep' ? 'RETURN' : 'DROP', note: String(l.note ?? '') });
    }
  }

  // Phiếu kiểm kê sinh từ lô của khối Sản xuất: mỗi lô chỉ có 1 phiếu hiệu lực; điều chỉnh lô thì thay phiếu cũ.
  const lot = type === 'KS' ? String(b.lot ?? '').trim() : '';
  let replaced: Array<{ id: number; no: string }> = [];
  if (lot) {
    extra.lot = lot;
    replaced = (
      await c.env.DB.prepare(
        "SELECT id, no FROM kho_docs WHERE type = 'KS' AND status = 'OK' AND json_extract(extra, '$.lot') = ?",
      )
        .bind(lot)
        .all<{ id: number; no: string }>()
    ).results;
    if (replaced.length && b.replace !== true) {
      throw conflict('LOT_EXISTS', `Lô ${lot} đã có phiếu kiểm kê ${replaced[0].no}. Muốn thay thì ghi lý do điều chỉnh.`);
    }
  }

  // Cảnh báo tồn âm sau khi ghi (vẫn cho ghi: kho thực tế có thể về hàng sau, nhưng báo để kiểm tra).
  const outItems = [...new Set(moves.filter((m) => m.qty < 0).map((m) => m.item))];
  if (outItems.length) {
    const marks = outItems.map(() => '?').join(',');
    const cur = (
      await c.env.DB.prepare(
        `SELECT item, ROUND(SUM(qty), 6) AS qty FROM kho_ledger WHERE item IN (${marks}) AND doc_id NOT IN (${replaced.map((d) => d.id).concat([0]).join(',')}) GROUP BY item`,
      )
        .bind(...outItems)
        .all<{ item: string; qty: number }>()
    ).results;
    const have = new Map(cur.map((r) => [r.item, r.qty]));
    for (const code of outItems) {
      const after = round((have.get(code) ?? 0) + moves.filter((m) => m.item === code).reduce((s, m) => s + m.qty, 0));
      if (after < 0) warnings.push(`${code} (${items.get(code)?.name}) sẽ âm kho: còn ${have.get(code) ?? 0}, sau phiếu này ${after}.`);
    }
  }

  // Số phiếu: ký hiệu + năm tháng + số thứ tự, ví dụ PC2610-001. Trùng (hai người ghi cùng lúc) thì thử lại.
  const ym = date.slice(2, 4) + date.slice(5, 7);
  const now = nowIso();
  let docId = 0;
  let no = '';
  for (let attempt = 0; attempt < 4 && !docId; attempt++) {
    const row = await c.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM kho_docs WHERE type = ? AND no LIKE ?',
    )
      .bind(type, `${type}${ym}-%`)
      .first<{ n: number }>();
    no = `${type}${ym}-${String((row?.n ?? 0) + 1 + attempt).padStart(3, '0')}`;
    try {
      await c.env.DB.prepare(
        `INSERT INTO kho_docs (no, type, doc_date, partner, ref_no, ref_qty, note, extra, status, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OK', ?, ?)`,
      )
        .bind(no, type, date, String(b.partner ?? '').trim(), String(b.ref_no ?? '').trim(), refQty, String(b.note ?? '').trim(), JSON.stringify(extra), auth.user.id, now)
        .run();
      docId = (await c.env.DB.prepare('SELECT id FROM kho_docs WHERE no = ?').bind(no).first<{ id: number }>())?.id ?? 0;
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e;
    }
  }
  if (!docId) throw conflict('NO_CLASH', 'Không cấp được số phiếu, thử lại');

  await c.env.DB.batch([
    ...moves.map((m) =>
      c.env.DB.prepare('INSERT INTO kho_moves (doc_id, item, qty, std_qty, price, role, note) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
        docId,
        m.item,
        m.qty,
        m.std_qty,
        m.price,
        m.role,
        m.note,
      ),
    ),
    ...replaced.map((d) =>
      c.env.DB.prepare(
        "UPDATE kho_docs SET status = 'HUY', cancelled_by = ?, cancelled_at = ?, cancel_reason = ? WHERE id = ? AND status = 'OK'",
      ).bind(auth.user.id, now, `Thay bằng phiếu ${no}: ${String(b.reason ?? 'điều chỉnh kiểm kê lô')}`, d.id),
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_DOC_CREATED',
      entityType: 'KHO_DOC',
      entityId: no,
      after: { type, date, lines: moves.length },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { id: docId, no, warnings });
});

khoRoutes.post('/docs/:id/cancel', async (c) => {
  const auth = c.get('auth');
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = String(b?.reason ?? '').trim();
  if (reason.length < 3) throw badRequest('NO_REASON', 'Cần ghi lý do hủy phiếu');
  const doc = await c.env.DB.prepare('SELECT no, status FROM kho_docs WHERE id = ?').bind(id).first<{ no: string; status: string }>();
  if (!doc) throw notFound('Không tìm thấy phiếu');
  if (doc.status !== 'OK') throw conflict('ALREADY', 'Phiếu này đã hủy rồi');
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE kho_docs SET status = 'HUY', cancelled_by = ?, cancelled_at = ?, cancel_reason = ? WHERE id = ? AND status = 'OK'",
    ).bind(auth.user.id, nowIso(), reason, id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_DOC_CANCELLED',
      entityType: 'KHO_DOC',
      entityId: doc.no,
      reason,
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { id, no: doc.no });
});

/** Hủy lô bên khối Sản xuất → hủy phiếu kiểm kê của lô, kho trả lại vật tư. */
khoRoutes.post('/lots/:code/cancel', async (c) => {
  const auth = c.get('auth');
  const code = c.req.param('code');
  const b = (await c.req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = String(b?.reason ?? '').trim();
  if (reason.length < 3) throw badRequest('NO_REASON', 'Cần ghi lý do hủy');
  const docs = (
    await c.env.DB.prepare(
      "SELECT id, no FROM kho_docs WHERE type = 'KS' AND status = 'OK' AND json_extract(extra, '$.lot') = ?",
    )
      .bind(code)
      .all<{ id: number; no: string }>()
  ).results;
  if (!docs.length) return ok(c, { cancelled: [] });
  const now = nowIso();
  await c.env.DB.batch([
    ...docs.map((d) =>
      c.env.DB.prepare(
        "UPDATE kho_docs SET status = 'HUY', cancelled_by = ?, cancelled_at = ?, cancel_reason = ? WHERE id = ? AND status = 'OK'",
      ).bind(auth.user.id, now, `Hủy lô ${code}: ${reason}`, d.id),
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_DOC_CANCELLED',
      entityType: 'KHO_DOC',
      entityId: docs.map((d) => d.no).join(','),
      reason: `Hủy lô ${code}: ${reason}`,
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { cancelled: docs.map((d) => d.no) });
});

/* ---------- Đồng bộ mã CRM B2B → MISA ---------- */

khoRoutes.get('/map', async (c) => {
  const [map, unmapped, from] = await Promise.all([
    c.env.DB.prepare(
      `SELECT km.crm_sku, km.misa_code, km.factor, km.note, i.name AS misa_name, i.unit AS misa_unit, p.name AS crm_name
       FROM kho_map km LEFT JOIN kho_items i ON i.code = km.misa_code LEFT JOIN products p ON p.sku = km.crm_sku
       ORDER BY km.crm_sku`,
    ).all<Record<string, unknown>>(),
    // Mã CRM đã xuất kho mà chưa quy đổi: kho CHƯA trừ các dòng này.
    c.env.DB.prepare(
      `SELECT p.sku, p.name, p.unit, ROUND(SUM(oi.qty), 3) AS qty
       FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id
       WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND o.delivery_status IN ('DA_XUAT_KHO', 'DA_GIAO')
         AND substr(o.delivered_at, 1, 10) >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'b2b_from'), '9999-12-31')
         AND NOT EXISTS (SELECT 1 FROM kho_map km WHERE km.crm_sku = p.sku)
       GROUP BY p.sku ORDER BY qty DESC LIMIT 200`,
    ).all<Record<string, unknown>>(),
    c.env.DB.prepare("SELECT v FROM kho_cfg WHERE k = 'b2b_from'").first<{ v: string }>(),
  ]);
  return ok(c, { map: map.results, unmapped: unmapped.results, b2b_from: from?.v ?? '' });
});

/** CEO nạp bảng đồng bộ (thay toàn bộ). Dòng nào mã MISA chưa có trong danh mục thì bị từ chối kèm danh sách. */
khoRoutes.put('/map', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO nạp bảng đồng bộ mã');
  const b = (await c.req.json().catch(() => null)) as { rows?: Array<Record<string, unknown>> } | null;
  const rows = b?.rows;
  if (!Array.isArray(rows)) throw badRequest('MISSING', 'Thiếu dữ liệu');
  const codes = new Set(
    (await c.env.DB.prepare('SELECT code FROM kho_items').all<{ code: string }>()).results.map((r) => r.code),
  );
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const sku = String(r.crm_sku ?? '').trim();
    const code = String(r.misa_code ?? '').trim();
    if (!sku || seen.has(sku)) throw badRequest('BAD_SKU', `Mã CRM trống hoặc bị lặp: "${sku}"`);
    seen.add(sku);
    if (!codes.has(code)) bad.push(`${sku} → ${code}`);
    if (!(num(r.factor) > 0)) throw badRequest('BAD_FACTOR', `${sku}: hệ số phải lớn hơn 0`);
  }
  if (bad.length) throw badRequest('BAD_MISA', `Mã MISA chưa có trong danh mục kho: ${bad.slice(0, 10).join('; ')}`);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM kho_map'),
    ...rows.map((r) =>
      c.env.DB.prepare('INSERT INTO kho_map (crm_sku, misa_code, factor, note) VALUES (?, ?, ?, ?)').bind(
        String(r.crm_sku).trim(),
        String(r.misa_code).trim(),
        num(r.factor),
        String(r.note ?? ''),
      ),
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_MAP_SAVED',
      entityType: 'KHO_MAP',
      entityId: 'all',
      after: { rows: rows.length },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { rows: rows.length });
});

/** Ngày bắt đầu trừ kho theo đơn B2B (đơn xuất trước ngày này coi như đã nằm trong tồn đầu). */
khoRoutes.put('/cfg/b2b-from', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO đặt ngày bắt đầu');
  const b = (await c.req.json().catch(() => null)) as { date?: unknown } | null;
  if (!isDate(b?.date)) throw badRequest('BAD_DATE', 'Ngày không đúng');
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO kho_cfg (k, v) VALUES (\'b2b_from\', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v',
    ).bind(b.date),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_CFG',
      entityType: 'KHO_CFG',
      entityId: 'b2b_from',
      after: { date: b.date },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { b2b_from: b.date });
});

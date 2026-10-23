import { Hono, type Context } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, conflict, forbidden, notFound, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import { newId } from '../lib/ids';
import { adminOnlyEndpoint } from '../middleware/adminHost';

/**
 * Mua hàng nguyên vật liệu.
 * Bên vận hành (không có giá): Thảo lập phiếu mua; kho báo thực nhận từng lần giao (tự sinh phiếu nhập kho).
 * Trang quản trị (CEO, quản lý, kế toán): nhập giá lúc giao, hóa đơn nhà cung cấp (VAT, vận chuyển, bốc vác),
 * phiếu chi thanh toán, công nợ nhà cung cấp (có đầu kỳ) và giá nguyên vật liệu từng tháng (bình quân gia quyền, có tồn đầu).
 * Giá vốn nhập vào kho_moves.price để dùng chung với bảng định mức & giá thành sẵn có.
 */
export const purchasingRoutes = new Hono<AppEnv>();

const canManage = (a: AuthContext) =>
  a.user.role === 'CEO' || a.permissions.includes('order.approve.normal') || a.permissions.includes('order.accounting.confirm');
const canReceive = (a: AuthContext) =>
  canManage(a) || a.permissions.includes('sx.kiemke') || a.permissions.includes('order.kho.process');
/** Giá, tiền chỉ trả về cho CEO, quản lý, kế toán (ở trang nào cũng vậy). Kho và nhân viên khác không nhận. */
const showMoney = (c: Context<AppEnv>) => canManage(c.get('auth'));
const ipOf = (c: { req: { header: (n: string) => string | undefined } }) => c.req.header('CF-Connecting-IP') ?? null;
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

function needManage(a: AuthContext) {
  if (!canManage(a)) throw forbidden('Chỉ CEO, quản lý hoặc kế toán làm việc này');
}

/* ---------------- Nhà cung cấp ---------------- */

purchasingRoutes.get('/suppliers', async (c) => {
  const rows = (await c.env.DB.prepare('SELECT id, name, phone, note, active, opening_debt, opening_date FROM suppliers ORDER BY name').all<
    Record<string, unknown>
  >()).results;
  const money = showMoney(c);
  return ok(c, rows.map((r) => (money ? r : { id: r.id, name: r.name, phone: r.phone, note: r.note, active: r.active })));
});

purchasingRoutes.post('/suppliers', async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const b = (await c.req.json().catch(() => ({}))) as { name?: unknown; phone?: unknown; note?: unknown; opening_debt?: unknown; opening_date?: unknown };
  const name = String(b.name ?? '').trim();
  if (name.length < 2) throw badRequest('BAD_NAME', 'Nhập tên nhà cung cấp');
  if (await c.env.DB.prepare('SELECT id FROM suppliers WHERE name = ?').bind(name).first()) throw badRequest('DUPLICATE', 'Đã có nhà cung cấp tên "' + name + '"');
  // Công nợ đầu kỳ nhập luôn lúc thêm nhà cung cấp (có số nợ thì phải kèm ngày chốt).
  const debt = int(b.opening_debt);
  if (debt !== 0 && !isDate(b.opening_date)) throw badRequest('BAD_DATE', 'Có công nợ đầu kỳ thì cần chọn ngày chốt');
  const openDate = debt !== 0 || isDate(b.opening_date) ? (b.opening_date as string) : null;
  const id = newId();
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO suppliers (id, name, phone, note, opening_debt, opening_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
      id, name, String(b.phone ?? '').trim(), String(b.note ?? '').trim(), debt, openDate, now, now,
    ),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'SUPPLIER_CREATED', entityType: 'SUPPLIER', entityId: id, after: { name }, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  return ok(c, { id });
});

purchasingRoutes.put('/suppliers/:id', async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const id = c.req.param('id');
  const b = (await c.req.json().catch(() => ({}))) as { name?: unknown; phone?: unknown; note?: unknown; active?: unknown };
  const cur = await c.env.DB.prepare('SELECT id, name FROM suppliers WHERE id = ?').bind(id).first<{ id: string; name: string }>();
  if (!cur) throw notFound('Không tìm thấy nhà cung cấp');
  const name = b.name === undefined ? cur.name : String(b.name).trim();
  if (name.length < 2) throw badRequest('BAD_NAME', 'Nhập tên nhà cung cấp');
  if (name !== cur.name && (await c.env.DB.prepare('SELECT id FROM suppliers WHERE name = ? AND id <> ?').bind(name, id).first())) {
    throw badRequest('DUPLICATE', 'Đã có nhà cung cấp tên "' + name + '"');
  }
  await c.env.DB.prepare(
    `UPDATE suppliers SET name = ?, phone = COALESCE(?, phone), note = COALESCE(?, note), active = COALESCE(?, active), updated_at = ? WHERE id = ?`,
  )
    .bind(name, b.phone === undefined ? null : String(b.phone).trim(), b.note === undefined ? null : String(b.note).trim(), b.active === undefined ? null : b.active ? 1 : 0, nowIso(), id)
    .run();
  return ok(c, { id });
});

/** Công nợ đầu kỳ của nhà cung cấp: chỉ nhập ở trang quản trị. */
purchasingRoutes.put('/suppliers/:id/opening', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const id = c.req.param('id');
  const b = (await c.req.json().catch(() => ({}))) as { opening_debt?: unknown; opening_date?: unknown };
  if (!isDate(b.opening_date)) throw badRequest('BAD_DATE', 'Chọn ngày chốt công nợ đầu kỳ');
  const debt = int(b.opening_debt);
  const cur = await c.env.DB.prepare('SELECT opening_debt, opening_date FROM suppliers WHERE id = ?').bind(id).first();
  if (!cur) throw notFound('Không tìm thấy nhà cung cấp');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE suppliers SET opening_debt = ?, opening_date = ?, updated_at = ? WHERE id = ?').bind(debt, b.opening_date, nowIso(), id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'SUPPLIER_OPENING_DEBT', entityType: 'SUPPLIER', entityId: id, before: cur, after: { debt, date: b.opening_date }, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  return ok(c, { id });
});

/* ---------------- Phiếu mua hàng ---------------- */

async function nextNo(db: D1Database, table: 'po_orders' | 'kho_docs', prefix: string, date: string, extraWhere = '') {
  const ym = date.slice(2, 4) + date.slice(5, 7);
  const like = `${prefix}${ym}-%`;
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE no LIKE ? ${extraWhere}`).bind(like).first<{ n: number }>();
  return { ym, base: (row?.n ?? 0) + 1, make: (i: number) => `${prefix}${ym}-${String(i).padStart(3, '0')}` };
}

type LineIn = { item?: unknown; qty?: unknown; note?: unknown; unit_price?: unknown };

async function checkLines(db: D1Database, lines: unknown): Promise<Array<{ item: string; qty: number; note: string; unit_price: number | null }>> {
  if (!Array.isArray(lines) || !lines.length) throw badRequest('NO_LINES', 'Thêm ít nhất một dòng hàng');
  if (lines.length > 100) throw badRequest('TOO_MANY', 'Tối đa 100 dòng mỗi phiếu');
  const codes = new Set((await db.prepare('SELECT code FROM kho_items').all<{ code: string }>()).results.map((r) => r.code));
  return (lines as LineIn[]).map((l) => {
    const item = String(l.item ?? '');
    const qty = Number(l.qty);
    if (!codes.has(item)) throw badRequest('BAD_ITEM', `Mã "${item}" chưa có trong danh mục kho`);
    if (!Number.isFinite(qty) || qty <= 0) throw badRequest('BAD_QTY', `Số lượng của ${item} phải lớn hơn 0`);
    const price = l.unit_price === undefined || l.unit_price === null || l.unit_price === '' ? null : Number(l.unit_price);
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw badRequest('BAD_PRICE', `Giá của ${item} không hợp lệ`);
    return { item, qty: round6(qty), note: String(l.note ?? '').trim(), unit_price: price };
  });
}

const optDate = (v: unknown): string | null => {
  if (v === undefined || v === null || v === '') return null;
  if (!isDate(v)) throw badRequest('BAD_DATE', 'Ngày giao dự kiến không hợp lệ');
  return v;
};

export async function poStatus(db: D1Database, poId: string) {
  const lines = (await db.prepare('SELECT id, qty FROM po_lines WHERE po_id = ?').bind(poId).all<{ id: string; qty: number }>()).results;
  const got = new Map(
    (
      await db
        .prepare(
          `SELECT l.po_line_id AS id, SUM(l.qty) AS q FROM po_receipt_lines l JOIN po_receipts r ON r.id = l.receipt_id
           WHERE r.po_id = ? AND r.status = 'OK' AND l.po_line_id IS NOT NULL GROUP BY l.po_line_id`,
        )
        .bind(poId)
        .all<{ id: string; q: number }>()
    ).results.map((r) => [r.id, r.q]),
  );
  const anyReceipt = (await db.prepare("SELECT COUNT(*) AS n FROM po_receipts WHERE po_id = ? AND status = 'OK'").bind(poId).first<{ n: number }>())?.n ?? 0;
  const full = lines.length > 0 && lines.every((l) => (got.get(l.id) ?? 0) >= l.qty - 1e-9);
  const status = full ? 'DU' : anyReceipt ? 'DANG_GIAO' : 'DAT';
  await db.prepare("UPDATE po_orders SET status = ?, updated_at = ? WHERE id = ? AND status <> 'HUY'").bind(status, nowIso(), poId).run();
}

purchasingRoutes.get('/orders', async (c) => {
  const money = showMoney(c);
  const onlyOpen = c.req.query('open') === '1';
  const orders = (
    await c.env.DB.prepare(
      `SELECT o.id, o.no, o.order_date, o.expected_date, o.supplier_id, s.name AS supplier_name, s.phone AS supplier_phone, o.note, o.status, o.created_at, o.updated_at, o.source,
              u.display_name AS created_by_name
       FROM po_orders o JOIN suppliers s ON s.id = o.supplier_id LEFT JOIN users u ON u.id = o.created_by
       ${onlyOpen ? "WHERE o.status IN ('DAT', 'DANG_GIAO')" : ''}
       ORDER BY o.order_date DESC, o.no DESC LIMIT 300`,
    ).all<Record<string, unknown>>()
  ).results;
  if (!orders.length) return ok(c, []);
  const ids = orders.map((o) => String(o.id));
  const ph = ids.map(() => '?').join(',');
  const lines = (
    await c.env.DB.prepare(
      `SELECT l.id, l.po_id, l.item, i.name, i.unit, l.qty, l.note, l.unit_price FROM po_lines l JOIN kho_items i ON i.code = l.item
       WHERE l.po_id IN (${ph}) ORDER BY l.po_id, l.sort`,
    )
      .bind(...ids)
      .all<Record<string, unknown>>()
  ).results;
  const receipts = (
    await c.env.DB.prepare(`SELECT id, po_id, receipt_date, kho_doc_id, note, status FROM po_receipts WHERE po_id IN (${ph}) ORDER BY receipt_date, created_at`)
      .bind(...ids)
      .all<Record<string, unknown>>()
  ).results;
  const rIds = receipts.map((r) => String(r.id));
  const rl = rIds.length
    ? (
        await c.env.DB.prepare(
          `SELECT l.id, l.receipt_id, l.po_line_id, l.item, i.name, i.unit, l.qty, l.unit_price FROM po_receipt_lines l JOIN kho_items i ON i.code = l.item
           WHERE l.receipt_id IN (${rIds.map(() => '?').join(',')})`,
        )
          .bind(...rIds)
          .all<Record<string, unknown>>()
      ).results
    : [];
  const rlBy = new Map<string, Array<Record<string, unknown>>>();
  for (const l of rl) {
    const arr = rlBy.get(String(l.receipt_id)) ?? [];
    arr.push(money ? l : { id: l.id, receipt_id: l.receipt_id, po_line_id: l.po_line_id, item: l.item, name: l.name, unit: l.unit, qty: l.qty });
    rlBy.set(String(l.receipt_id), arr);
  }
  const rcBy = new Map<string, Array<Record<string, unknown>>>();
  for (const r of receipts) {
    const arr = rcBy.get(String(r.po_id)) ?? [];
    arr.push({ ...r, lines: rlBy.get(String(r.id)) ?? [] });
    rcBy.set(String(r.po_id), arr);
  }
  const received = new Map<string, number>();
  for (const r of receipts) if (r.status === 'OK') for (const l of rlBy.get(String(r.id)) ?? []) if (l.po_line_id) received.set(String(l.po_line_id), (received.get(String(l.po_line_id)) ?? 0) + Number(l.qty));
  return ok(
    c,
    orders.map((o) => ({
      ...o,
      lines: lines
        .filter((l) => l.po_id === o.id)
        .map((l) => {
          const { unit_price, ...rest } = l;
          return { ...rest, ...(money ? { unit_price } : {}), received: round6(received.get(String(l.id)) ?? 0) };
        }),
      receipts: rcBy.get(String(o.id)) ?? [],
    })),
  );
});

purchasingRoutes.post('/orders', async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const b = (await c.req.json().catch(() => ({}))) as { supplier_id?: unknown; order_date?: unknown; expected_date?: unknown; note?: unknown; lines?: unknown };
  if (!isDate(b.order_date)) throw badRequest('BAD_DATE', 'Chọn ngày đặt hàng');
  const expected = optDate(b.expected_date);
  const sup = await c.env.DB.prepare('SELECT id FROM suppliers WHERE id = ? AND active = 1').bind(String(b.supplier_id ?? '')).first();
  if (!sup) throw badRequest('BAD_SUPPLIER', 'Chọn nhà cung cấp');
  const lines = await checkLines(c.env.DB, b.lines);
  const id = newId();
  const now = nowIso();
  const gen = await nextNo(c.env.DB, 'po_orders', 'PM', b.order_date);
  let no = '';
  for (let a = 0; a < 4 && !no; a++) {
    const cand = gen.make(gen.base + a);
    try {
      await c.env.DB.prepare('INSERT INTO po_orders (id, no, order_date, expected_date, supplier_id, note, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, cand, b.order_date, expected, String(b.supplier_id), String(b.note ?? '').trim(), 'DAT', auth.user.id, now, now)
        .run();
      no = cand;
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e;
    }
  }
  if (!no) throw conflict('NO_CLASH', 'Không cấp được số phiếu, thử lại');
  await c.env.DB.batch([
    ...lines.map((l, i) => c.env.DB.prepare('INSERT INTO po_lines (id, po_id, item, qty, note, sort, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), id, l.item, l.qty, l.note, i, l.unit_price)),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_CREATED', entityType: 'PO', entityId: no, after: { lines: lines.length }, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  return ok(c, { id, no });
});

purchasingRoutes.put('/orders/:id', async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const id = c.req.param('id');
  const po = await c.env.DB.prepare('SELECT id, no, status FROM po_orders WHERE id = ?').bind(id).first<{ id: string; no: string; status: string }>();
  if (!po) throw notFound('Không tìm thấy phiếu mua');
  const got = (await c.env.DB.prepare("SELECT COUNT(*) AS n FROM po_receipts WHERE po_id = ? AND status = 'OK'").bind(id).first<{ n: number }>())?.n ?? 0;
  if (po.status === 'HUY' || got > 0) throw badRequest('LOCKED', 'Phiếu đã có lần nhận hàng nên không sửa dòng hàng được. Hủy lần nhận hoặc lập phiếu mới.');
  const b = (await c.req.json().catch(() => ({}))) as { supplier_id?: unknown; order_date?: unknown; expected_date?: unknown; note?: unknown; lines?: unknown };
  if (!isDate(b.order_date)) throw badRequest('BAD_DATE', 'Chọn ngày đặt hàng');
  const expected = optDate(b.expected_date);
  if (!(await c.env.DB.prepare('SELECT id FROM suppliers WHERE id = ?').bind(String(b.supplier_id ?? '')).first())) throw badRequest('BAD_SUPPLIER', 'Chọn nhà cung cấp');
  const lines = await checkLines(c.env.DB, b.lines);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE po_orders SET supplier_id = ?, order_date = ?, expected_date = ?, note = ?, updated_at = ? WHERE id = ?').bind(String(b.supplier_id), b.order_date, expected, String(b.note ?? '').trim(), nowIso(), id),
    c.env.DB.prepare('DELETE FROM po_lines WHERE po_id = ?').bind(id),
    ...lines.map((l, i) => c.env.DB.prepare('INSERT INTO po_lines (id, po_id, item, qty, note, sort, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), id, l.item, l.qty, l.note, i, l.unit_price)),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_UPDATED', entityType: 'PO', entityId: po.no, after: { lines: lines.length }, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  return ok(c, { id });
});

purchasingRoutes.post('/orders/:id/cancel', async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const id = c.req.param('id');
  const po = await c.env.DB.prepare('SELECT no, status FROM po_orders WHERE id = ?').bind(id).first<{ no: string; status: string }>();
  if (!po) throw notFound('Không tìm thấy phiếu mua');
  const got = (await c.env.DB.prepare("SELECT COUNT(*) AS n FROM po_receipts WHERE po_id = ? AND status = 'OK'").bind(id).first<{ n: number }>())?.n ?? 0;
  if (got > 0) throw badRequest('HAS_RECEIPT', 'Phiếu đã có lần nhận hàng. Hủy các lần nhận trước.');
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE po_orders SET status = 'HUY', updated_at = ? WHERE id = ?").bind(nowIso(), id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_CANCELLED', entityType: 'PO', entityId: po.no, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  return ok(c, { id });
});

/* ---------------- Nhận hàng (kho báo thực nhận) ---------------- */

purchasingRoutes.post('/orders/:id/receipts', async (c) => {
  const auth = c.get('auth');
  if (!canReceive(auth)) throw forbidden('Bạn chưa có quyền ghi nhận hàng về kho');
  const b = (await c.req.json().catch(() => ({}))) as { receipt_date?: unknown; note?: unknown; lines?: unknown };
  return ok(c, await receive(c, c.req.param('id'), b));
});

/** Ghi một lần nhận hàng cho phiếu mua: lập phiếu nhập kho PN, cộng tồn, gắn dòng nhận vào dòng đặt. */
async function receive(c: Context<AppEnv>, id: string, b: { receipt_date?: unknown; note?: unknown; lines?: unknown }) {
  const auth = c.get('auth');
  const po = await c.env.DB.prepare(
    `SELECT o.id, o.no, o.status, s.name AS supplier FROM po_orders o JOIN suppliers s ON s.id = o.supplier_id WHERE o.id = ?`,
  ).bind(id).first<{ id: string; no: string; status: string; supplier: string }>();
  if (!po) throw notFound('Không tìm thấy phiếu mua');
  if (po.status === 'HUY') throw badRequest('CANCELLED', 'Phiếu mua này đã hủy');
  if (!isDate(b.receipt_date)) throw badRequest('BAD_DATE', 'Chọn ngày nhận hàng');
  const lines = (await checkLines(c.env.DB, b.lines)) as Array<{ item: string; qty: number; note: string; po_line_id?: string | null }>;
  const poLines = new Map((await c.env.DB.prepare('SELECT id, item FROM po_lines WHERE po_id = ?').bind(id).all<{ id: string; item: string }>()).results.map((l) => [l.id, l.item]));
  (b.lines as Array<{ po_line_id?: unknown }>).forEach((l, i) => {
    let pl = l.po_line_id ? String(l.po_line_id) : null;
    if (pl && poLines.get(pl) !== lines[i].item) throw badRequest('BAD_LINE', 'Dòng nhận hàng không khớp dòng đặt hàng');
    // Không chỉ rõ dòng đặt thì gắn vào dòng đặt đầu tiên cùng mã hàng.
    if (!pl) pl = [...poLines].find(([, item]) => item === lines[i].item)?.[0] ?? null;
    lines[i].po_line_id = pl;
  });
  const now = nowIso();
  const date = b.receipt_date;
  const gen = await nextNo(c.env.DB, 'kho_docs', 'PN', date, "AND type = 'PN'");
  let docId = 0;
  let docNo = '';
  for (let a = 0; a < 4 && !docId; a++) {
    const cand = gen.make(gen.base + a);
    try {
      await c.env.DB.prepare(
        `INSERT INTO kho_docs (no, type, doc_date, partner, ref_no, ref_qty, note, extra, status, created_by, created_at)
         VALUES (?, 'PN', ?, ?, ?, NULL, ?, '{}', 'OK', ?, ?)`,
      ).bind(cand, date, po.supplier, po.no, String(b.note ?? '').trim(), auth.user.id, now).run();
      docId = (await c.env.DB.prepare('SELECT id FROM kho_docs WHERE no = ?').bind(cand).first<{ id: number }>())?.id ?? 0;
      docNo = cand;
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e;
    }
  }
  if (!docId) throw conflict('NO_CLASH', 'Không cấp được số phiếu nhập kho, thử lại');
  const rid = newId();
  await c.env.DB.prepare('INSERT INTO po_receipts (id, po_id, receipt_date, kho_doc_id, note, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(rid, id, date, docId, String(b.note ?? '').trim(), 'OK', auth.user.id, now).run();
  for (const l of lines) {
    await c.env.DB.prepare("INSERT INTO kho_moves (doc_id, item, qty, std_qty, price, role, note) VALUES (?, ?, ?, NULL, NULL, 'IN', ?)")
      .bind(docId, l.item, l.qty, `Mua hàng ${po.no}`).run();
    const mvId = (await c.env.DB.prepare('SELECT id FROM kho_moves WHERE doc_id = ? AND item = ? ORDER BY id DESC LIMIT 1').bind(docId, l.item).first<{ id: number }>())?.id ?? null;
    await c.env.DB.prepare('INSERT INTO po_receipt_lines (id, receipt_id, po_line_id, item, qty, unit_price, kho_move_id) VALUES (?, ?, ?, ?, ?, NULL, ?)')
      .bind(newId(), rid, l.po_line_id ?? null, l.item, l.qty, mvId).run();
  }
  await poStatus(c.env.DB, id);
  await auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_RECEIVED', entityType: 'PO', entityId: po.no, after: { receipt: rid, kho_doc: docNo, lines: lines.length }, requestId: c.get('requestId'), ip: ipOf(c) }).run();
  return { id: rid, kho_doc_no: docNo };
}

/** Hàng về không có phiếu đặt (ví dụ vỏ can): kho ghi phiếu nhập kho như thường, web tự tạo một phiếu mua (source = KHO)
 *  để Thảo nhập giá sau và kế toán theo dõi công nợ. Nhà cung cấp chưa có thì tự thêm theo tên kho gõ (không có công nợ đầu kỳ).
 *  Trả về phiếu mua để phiếu nhập kho gắn vào như khi chọn phiếu mua có sẵn. */
export async function autoPoForReceipt(
  c: Context<AppEnv>,
  supplierName: string,
  date: string,
  lines: Array<{ item: string; qty: number; price: number | null }>,
  note: string,
): Promise<{ id: string; no: string; status: string }> {
  const auth = c.get('auth');
  const now = nowIso();
  const name = supplierName.trim();
  const had = await c.env.DB.prepare('SELECT id FROM suppliers WHERE name = ?').bind(name).first<{ id: string }>();
  const supId = had?.id ?? newId();
  if (!had)
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO suppliers (id, name, phone, note, opening_debt, opening_date, active, created_at, updated_at) VALUES (?, ?, '', ?, 0, NULL, 1, ?, ?)").bind(supId, name, 'Kho thêm khi nhận hàng', now, now),
      auditStatement(c.env.DB, { actorId: auth.user.id, action: 'SUPPLIER_CREATED', entityType: 'SUPPLIER', entityId: supId, after: { name, by: 'kho' }, requestId: c.get('requestId'), ip: ipOf(c) }),
    ]);
  const id = newId();
  const gen = await nextNo(c.env.DB, 'po_orders', 'PM', date);
  let no = '';
  for (let a = 0; a < 4 && !no; a++) {
    const cand = gen.make(gen.base + a);
    try {
      await c.env.DB.prepare("INSERT INTO po_orders (id, no, order_date, expected_date, supplier_id, note, status, created_by, created_at, updated_at, source) VALUES (?, ?, ?, NULL, ?, ?, 'DAT', ?, ?, ?, 'KHO')")
        .bind(id, cand, date, supId, ('Tự tạo khi kho nhận hàng. ' + note).trim(), auth.user.id, now, now)
        .run();
      no = cand;
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e;
    }
  }
  if (!no) throw conflict('NO_CLASH', 'Không cấp được số phiếu mua, thử lại');
  await c.env.DB.batch([
    ...lines.map((l, i) => c.env.DB.prepare('INSERT INTO po_lines (id, po_id, item, qty, note, sort, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), id, l.item, l.qty, '', i, l.price)),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_CREATED', entityType: 'PO', entityId: no, after: { lines: lines.length, source: 'KHO' }, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  return { id, no, status: 'DAT' };
}

/** Thảo / kế toán nhập giá cho phiếu mua sau khi hàng đã về (dùng cho phiếu tự tạo khi nhận hàng, hoặc phiếu đặt chưa có giá).
 *  Giá đi vào dòng đặt và các dòng nhận hàng chưa có giá (giá vốn nhập kho tính lại). */
purchasingRoutes.put('/orders/:id/prices', async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const id = c.req.param('id');
  const po = await c.env.DB.prepare('SELECT no, status FROM po_orders WHERE id = ?').bind(id).first<{ no: string; status: string }>();
  if (!po) throw notFound('Không tìm thấy phiếu mua');
  if (po.status === 'HUY') throw badRequest('CANCELLED', 'Phiếu mua này đã hủy');
  const b = (await c.req.json().catch(() => ({}))) as { prices?: Record<string, unknown> };
  const lines = (await c.env.DB.prepare('SELECT id FROM po_lines WHERE po_id = ?').bind(id).all<{ id: string }>()).results.map((l) => l.id);
  const set: Array<[string, number]> = [];
  for (const [lid, v] of Object.entries(b.prices ?? {})) {
    if (!lines.includes(lid)) throw badRequest('BAD_LINE', 'Dòng hàng không thuộc phiếu này');
    const n = Number(v);
    if (v === '' || v == null || !Number.isFinite(n) || n < 0) throw badRequest('BAD_PRICE', 'Giá phải là số từ 0 trở lên');
    set.push([lid, n]);
  }
  if (!set.length) throw badRequest('NO_PRICE', 'Chưa nhập giá dòng nào');
  await c.env.DB.batch([
    ...set.map(([lid, n]) => c.env.DB.prepare('UPDATE po_lines SET unit_price = ? WHERE id = ?').bind(n, lid)),
    ...set.map(([lid, n]) => c.env.DB.prepare('UPDATE po_receipt_lines SET unit_price = ? WHERE po_line_id = ? AND unit_price IS NULL').bind(n, lid)),
    c.env.DB.prepare('UPDATE po_orders SET updated_at = ? WHERE id = ?').bind(nowIso(), id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_PRICE_SET', entityType: 'PO', entityId: po.no, after: { lines: set.length }, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  const rids = (await c.env.DB.prepare("SELECT id FROM po_receipts WHERE po_id = ? AND status = 'OK'").bind(id).all<{ id: string }>()).results.map((r) => r.id);
  await reprice(c.env.DB, rids);
  return ok(c, { id, lines: set.length });
});

purchasingRoutes.post('/receipts/:id/cancel', async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const id = c.req.param('id');
  const r = await c.env.DB.prepare('SELECT id, po_id, kho_doc_id, status FROM po_receipts WHERE id = ?').bind(id).first<{ id: string; po_id: string; kho_doc_id: number | null; status: string }>();
  if (!r) throw notFound('Không tìm thấy lần nhận hàng');
  if (r.status !== 'OK') throw badRequest('ALREADY', 'Lần nhận này đã hủy rồi');
  const inv = await c.env.DB.prepare("SELECT invoice_no FROM po_invoices WHERE status = 'OK' AND receipt_ids LIKE ?").bind(`%"${id}"%`).first<{ invoice_no: string }>();
  if (inv) throw badRequest('INVOICED', `Lần nhận này đã nằm trong hóa đơn ${inv.invoice_no || '(chưa có số)'}. Hủy hóa đơn trước.`);
  const b = (await c.req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = String(b.reason ?? 'Hủy lần nhận hàng').trim();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE po_receipts SET status = 'HUY' WHERE id = ?").bind(id),
    ...(r.kho_doc_id
      ? [c.env.DB.prepare("UPDATE kho_docs SET status = 'HUY', cancelled_by = ?, cancelled_at = ?, cancel_reason = ? WHERE id = ? AND status = 'OK'").bind(auth.user.id, nowIso(), reason, r.kho_doc_id)]
      : []),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_RECEIPT_CANCELLED', entityType: 'PO', entityId: r.po_id, reason, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  await poStatus(c.env.DB, r.po_id);
  return ok(c, { id });
});

/* ---------------- Giá, hóa đơn, phiếu chi (chỉ trang quản trị) ---------------- */

/** Tính lại giá vốn nhập của các dòng nhận hàng: giá lúc giao + phí phát sinh trên hóa đơn chia theo giá trị dòng. */
async function reprice(db: D1Database, receiptIds: string[]) {
  for (const rid of receiptIds) {
    const lines = (await db.prepare('SELECT id, qty, unit_price, kho_move_id FROM po_receipt_lines WHERE receipt_id = ?').bind(rid).all<{ id: string; qty: number; unit_price: number | null; kho_move_id: number | null }>()).results;
    const inv = await db.prepare("SELECT id, receipt_ids, freight, handling, other, vat_amount, vat_in_cost FROM po_invoices WHERE status = 'OK' AND receipt_ids LIKE ?").bind(`%"${rid}"%`).first<{ id: string; receipt_ids: string; freight: number; handling: number; other: number; vat_amount: number; vat_in_cost: number }>();
    let extra = 0;
    let base = 0;
    if (inv) {
      extra = inv.freight + inv.handling + inv.other + (inv.vat_in_cost ? inv.vat_amount : 0);
      const ids = (JSON.parse(inv.receipt_ids) as string[]).filter(Boolean);
      if (ids.length) {
        const all = (await db.prepare(`SELECT qty, unit_price FROM po_receipt_lines WHERE receipt_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{ qty: number; unit_price: number | null }>()).results;
        base = all.reduce((s, l) => s + (l.unit_price != null ? l.qty * l.unit_price : 0), 0);
      }
    }
    for (const l of lines) {
      if (!l.kho_move_id) continue;
      if (l.unit_price == null) {
        await db.prepare('UPDATE kho_moves SET price = NULL WHERE id = ?').bind(l.kho_move_id).run();
        continue;
      }
      const alloc = base > 0 ? (extra * (l.qty * l.unit_price)) / base : 0;
      await db.prepare('UPDATE kho_moves SET price = ? WHERE id = ?').bind(round6(l.unit_price + alloc / l.qty), l.kho_move_id).run();
    }
  }
}

purchasingRoutes.put('/receipt-lines/:id/price', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const id = c.req.param('id');
  const b = (await c.req.json().catch(() => ({}))) as { unit_price?: unknown };
  const price = b.unit_price === null || b.unit_price === '' ? null : Number(b.unit_price);
  if (price !== null && (!Number.isFinite(price) || price < 0)) throw badRequest('BAD_PRICE', 'Giá không hợp lệ');
  const l = await c.env.DB.prepare('SELECT l.receipt_id, r.status FROM po_receipt_lines l JOIN po_receipts r ON r.id = l.receipt_id WHERE l.id = ?').bind(id).first<{ receipt_id: string; status: string }>();
  if (!l) throw notFound('Không tìm thấy dòng nhận hàng');
  if (l.status !== 'OK') throw badRequest('CANCELLED', 'Lần nhận này đã hủy');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE po_receipt_lines SET unit_price = ? WHERE id = ?').bind(price, id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_PRICE_SET', entityType: 'PO_RECEIPT_LINE', entityId: id, after: { unit_price: price }, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  // Hóa đơn chứa lần nhận này cũng phải tính lại tiền hàng; đơn giản nhất là cập nhật lại giá vốn của cả hóa đơn.
  const inv = await c.env.DB.prepare("SELECT receipt_ids FROM po_invoices WHERE status = 'OK' AND receipt_ids LIKE ?").bind(`%"${l.receipt_id}"%`).first<{ receipt_ids: string }>();
  await reprice(c.env.DB, inv ? (JSON.parse(inv.receipt_ids) as string[]) : [l.receipt_id]);
  return ok(c, { id });
});

purchasingRoutes.get('/invoices', adminOnlyEndpoint, async (c) => {
  needManage(c.get('auth'));
  const rows = (
    await c.env.DB.prepare(
      `SELECT v.*, s.name AS supplier_name,
              (SELECT COUNT(*) FROM po_files f WHERE f.invoice_id = v.id) AS file_count,
              COALESCE((SELECT SUM(p.amount) FROM po_payments p WHERE p.invoice_id = v.id AND p.status = 'OK'), 0) AS paid
       FROM po_invoices v JOIN suppliers s ON s.id = v.supplier_id ORDER BY v.invoice_date DESC, v.created_at DESC LIMIT 300`,
    ).all<Record<string, unknown>>()
  ).results;
  return ok(c, rows.map((r) => ({ ...r, receipt_ids: JSON.parse(String(r.receipt_ids || '[]')) })));
});

purchasingRoutes.post('/invoices', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isDate(b.invoice_date)) throw badRequest('BAD_DATE', 'Chọn ngày hóa đơn');
  const sup = await c.env.DB.prepare('SELECT id FROM suppliers WHERE id = ?').bind(String(b.supplier_id ?? '')).first();
  if (!sup) throw badRequest('BAD_SUPPLIER', 'Chọn nhà cung cấp');
  const receiptIds = [...new Set((Array.isArray(b.receipt_ids) ? b.receipt_ids : []).map((x) => String(x)))].filter(Boolean);
  let goods = int(b.goods_amount);
  if (receiptIds.length) {
    const ph = receiptIds.map(() => '?').join(',');
    const rs = (await c.env.DB.prepare(`SELECT r.id, o.supplier_id, r.status FROM po_receipts r JOIN po_orders o ON o.id = r.po_id WHERE r.id IN (${ph})`).bind(...receiptIds).all<{ id: string; supplier_id: string; status: string }>()).results;
    if (rs.length !== receiptIds.length || rs.some((r) => r.status !== 'OK' || r.supplier_id !== String(b.supplier_id))) throw badRequest('BAD_RECEIPT', 'Có lần nhận hàng không đúng nhà cung cấp hoặc đã hủy');
    for (const rid of receiptIds) {
      if (await c.env.DB.prepare("SELECT id FROM po_invoices WHERE status = 'OK' AND receipt_ids LIKE ?").bind(`%"${rid}"%`).first()) throw badRequest('IN_INVOICE', 'Có lần nhận hàng đã nằm trong hóa đơn khác');
    }
    // Giá từng dòng nhập ngay lúc ghi chứng từ: { [mã dòng nhận hàng]: đơn giá }.
    const prices = (b.prices && typeof b.prices === 'object' ? b.prices : {}) as Record<string, unknown>;
    const own = new Set(
      (await c.env.DB.prepare(`SELECT id FROM po_receipt_lines WHERE receipt_id IN (${ph})`).bind(...receiptIds).all<{ id: string }>()).results.map((r) => r.id),
    );
    for (const [lineId, v] of Object.entries(prices)) {
      if (!own.has(lineId)) throw badRequest('BAD_LINE', 'Có dòng giá không thuộc các lần nhận hàng đã chọn');
      const price = v === null || v === '' ? null : Number(v);
      if (price !== null && (!Number.isFinite(price) || price < 0)) throw badRequest('BAD_PRICE', 'Có giá không hợp lệ');
      await c.env.DB.prepare('UPDATE po_receipt_lines SET unit_price = ? WHERE id = ?').bind(price, lineId).run();
    }
    const lines = (await c.env.DB.prepare(`SELECT qty, unit_price FROM po_receipt_lines WHERE receipt_id IN (${ph})`).bind(...receiptIds).all<{ qty: number; unit_price: number | null }>()).results;
    if (lines.some((l) => l.unit_price == null)) throw badRequest('NO_PRICE', 'Còn dòng hàng chưa có giá. Nhập giá từng dòng rồi ghi chứng từ.');
    goods = Math.round(lines.reduce((s, l) => s + l.qty * (l.unit_price as number), 0));
  }
  // Dòng hàng nhập tay (chứng từ chưa gắn lần nhận hàng của kho, hoặc hàng ngoài phiếu): mã, số lượng, đơn giá.
  const manualIn = Array.isArray(b.manual_lines) ? (b.manual_lines as Array<Record<string, unknown>>) : [];
  const manual = manualIn.length ? await checkLines(c.env.DB, manualIn.map((l) => ({ item: l.item, qty: l.qty, unit_price: l.unit_price }))) : [];
  if (manual.some((l) => l.unit_price == null)) throw badRequest('NO_PRICE', 'Có dòng hàng chưa nhập giá');
  if (manual.length) goods = (receiptIds.length ? goods : 0) + Math.round(manual.reduce((t, l) => t + l.qty * (l.unit_price as number), 0));
  const vat = int(b.vat_amount);
  const freight = int(b.freight);
  const handling = int(b.handling);
  const other = int(b.other);
  const total = goods + vat + freight + handling + other;
  if (total <= 0) throw badRequest('NO_AMOUNT', 'Hóa đơn chưa có số tiền');
  const id = newId();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO po_invoices (id, supplier_id, invoice_no, invoice_date, goods_amount, vat_amount, freight, handling, other, vat_in_cost, total, receipt_ids, note, status, created_by, created_at, doc_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OK', ?, ?, ?)`,
    ).bind(id, String(b.supplier_id), String(b.invoice_no ?? '').trim(), b.invoice_date, goods, vat, freight, handling, other, b.vat_in_cost ? 1 : 0, total, JSON.stringify(receiptIds), String(b.note ?? '').trim(), auth.user.id, nowIso(), b.doc_type === 'PG' ? 'PG' : 'HD'),
    ...manual.map((l) => c.env.DB.prepare('INSERT INTO po_invoice_lines (id, invoice_id, item, qty, unit_price) VALUES (?, ?, ?, ?, ?)').bind(newId(), id, l.item, l.qty, l.unit_price)),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_INVOICE_CREATED', entityType: 'PO_INVOICE', entityId: id, after: { total, receipts: receiptIds.length, manual_lines: manual.length }, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  await reprice(c.env.DB, receiptIds);
  return ok(c, { id, total });
});

purchasingRoutes.post('/invoices/:id/cancel', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const id = c.req.param('id');
  const v = await c.env.DB.prepare('SELECT id, status, receipt_ids FROM po_invoices WHERE id = ?').bind(id).first<{ id: string; status: string; receipt_ids: string }>();
  if (!v) throw notFound('Không tìm thấy hóa đơn');
  if (v.status !== 'OK') throw badRequest('ALREADY', 'Hóa đơn này đã hủy rồi');
  if (await c.env.DB.prepare("SELECT id FROM po_payments WHERE invoice_id = ? AND status = 'OK'").bind(id).first()) throw badRequest('HAS_PAYMENT', 'Hóa đơn đã có phiếu chi gắn vào. Hủy phiếu chi trước.');
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE po_invoices SET status = 'HUY' WHERE id = ?").bind(id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_INVOICE_CANCELLED', entityType: 'PO_INVOICE', entityId: id, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  await reprice(c.env.DB, JSON.parse(v.receipt_ids) as string[]);
  return ok(c, { id });
});

purchasingRoutes.get('/invoices/:id/lines', adminOnlyEndpoint, async (c) => {
  needManage(c.get('auth'));
  const rows = (
    await c.env.DB.prepare('SELECT l.item, i.name, i.unit, l.qty, l.unit_price FROM po_invoice_lines l JOIN kho_items i ON i.code = l.item WHERE l.invoice_id = ?')
      .bind(c.req.param('id'))
      .all()
  ).results;
  return ok(c, rows);
});

/* ---------------- Ảnh / PDF đính kèm chứng từ (bill nhà cung cấp gửi, hóa đơn đỏ) ---------------- */

const FILE_MIME = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
const MAX_FILE_B64 = 1_400_000; // khoảng 1 MB sau khi giải mã
const MAX_FILES = 12;

purchasingRoutes.get('/invoices/:id/files', adminOnlyEndpoint, async (c) => {
  needManage(c.get('auth'));
  const rows = (await c.env.DB.prepare('SELECT id, name, mime, size, created_at FROM po_files WHERE invoice_id = ? ORDER BY created_at').bind(c.req.param('id')).all()).results;
  return ok(c, rows);
});

purchasingRoutes.post('/invoices/:id/files', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const id = c.req.param('id');
  if (!(await c.env.DB.prepare('SELECT id FROM po_invoices WHERE id = ?').bind(id).first())) throw notFound('Không tìm thấy chứng từ');
  const b = (await c.req.json().catch(() => ({}))) as { name?: unknown; mime?: unknown; data?: unknown };
  const mime = String(b.mime ?? '');
  const data = String(b.data ?? '').replace(/^data:[^,]*,/, '');
  if (!FILE_MIME.test(mime)) throw badRequest('BAD_FILE', 'Chỉ nhận ảnh (JPG, PNG) hoặc PDF');
  if (!data || data.length > MAX_FILE_B64) throw badRequest('TOO_BIG', 'File quá lớn (tối đa khoảng 1 MB). Chụp lại ảnh nhỏ hơn hoặc nén PDF.');
  if (((await c.env.DB.prepare('SELECT COUNT(*) AS n FROM po_files WHERE invoice_id = ?').bind(id).first<{ n: number }>())?.n ?? 0) >= MAX_FILES) {
    throw badRequest('TOO_MANY', `Mỗi chứng từ tối đa ${MAX_FILES} file`);
  }
  const fid = newId();
  await c.env.DB.prepare('INSERT INTO po_files (id, invoice_id, name, mime, size, data, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(fid, id, String(b.name ?? '').slice(0, 120), mime, Math.round((data.length * 3) / 4), data, auth.user.id, nowIso())
    .run();
  return ok(c, { id: fid });
});

purchasingRoutes.get('/invoices/:id/files/:fid', adminOnlyEndpoint, async (c) => {
  needManage(c.get('auth'));
  const f = await c.env.DB.prepare('SELECT mime, data FROM po_files WHERE id = ? AND invoice_id = ?').bind(c.req.param('fid'), c.req.param('id')).first<{ mime: string; data: string }>();
  if (!f) throw notFound('Không tìm thấy file');
  const bin = Uint8Array.from(atob(f.data), (ch) => ch.charCodeAt(0));
  return new Response(bin, { headers: { 'Content-Type': f.mime, 'Cache-Control': 'private, max-age=3600' } });
});

purchasingRoutes.delete('/invoices/:id/files/:fid', adminOnlyEndpoint, async (c) => {
  needManage(c.get('auth'));
  await c.env.DB.prepare('DELETE FROM po_files WHERE id = ? AND invoice_id = ?').bind(c.req.param('fid'), c.req.param('id')).run();
  return ok(c, { id: c.req.param('fid') });
});

purchasingRoutes.get('/payments', adminOnlyEndpoint, async (c) => {
  needManage(c.get('auth'));
  const rows = (
    await c.env.DB.prepare(
      `SELECT p.*, s.name AS supplier_name, v.invoice_no, o.no AS po_no FROM po_payments p JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN po_invoices v ON v.id = p.invoice_id LEFT JOIN po_orders o ON o.id = p.po_id ORDER BY p.pay_date DESC, p.created_at DESC LIMIT 300`,
    ).all<Record<string, unknown>>()
  ).results;
  return ok(c, rows);
});

purchasingRoutes.post('/payments', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isDate(b.pay_date)) throw badRequest('BAD_DATE', 'Chọn ngày chi');
  const amount = int(b.amount);
  if (amount <= 0) throw badRequest('BAD_AMOUNT', 'Nhập số tiền đã chi');
  if (!(await c.env.DB.prepare('SELECT id FROM suppliers WHERE id = ?').bind(String(b.supplier_id ?? '')).first())) throw badRequest('BAD_SUPPLIER', 'Chọn nhà cung cấp');
  const kind = b.kind === 'COC' ? 'COC' : 'CHI';
  const poId = b.po_id ? String(b.po_id) : null;
  if (poId && !(await c.env.DB.prepare("SELECT id FROM po_orders WHERE id = ? AND supplier_id = ? AND status <> 'HUY'").bind(poId, String(b.supplier_id)).first())) throw badRequest('BAD_PO', 'Phiếu mua không đúng nhà cung cấp');
  const invId = b.invoice_id ? String(b.invoice_id) : null;
  if (invId && !(await c.env.DB.prepare("SELECT id FROM po_invoices WHERE id = ? AND supplier_id = ? AND status = 'OK'").bind(invId, String(b.supplier_id)).first())) throw badRequest('BAD_INVOICE', 'Hóa đơn không đúng nhà cung cấp');
  const id = newId();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO po_payments (id, supplier_id, invoice_id, pay_date, amount, account, note, status, created_by, created_at, kind, po_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'OK', ?, ?, ?, ?)")
      .bind(id, String(b.supplier_id), invId, b.pay_date, amount, String(b.account ?? '').trim(), String(b.note ?? '').trim(), auth.user.id, nowIso(), kind, poId),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_PAYMENT_CREATED', entityType: 'PO_PAYMENT', entityId: id, after: { amount }, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  return ok(c, { id });
});

purchasingRoutes.post('/payments/:id/cancel', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  needManage(auth);
  const id = c.req.param('id');
  const p = await c.env.DB.prepare('SELECT status FROM po_payments WHERE id = ?').bind(id).first<{ status: string }>();
  if (!p) throw notFound('Không tìm thấy phiếu chi');
  if (p.status !== 'OK') throw badRequest('ALREADY', 'Phiếu chi này đã hủy rồi');
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE po_payments SET status = 'HUY' WHERE id = ?").bind(id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'PO_PAYMENT_CANCELLED', entityType: 'PO_PAYMENT', entityId: id, requestId: c.get('requestId'), ip: ipOf(c) }),
  ]);
  return ok(c, { id });
});

/** Công nợ từng nhà cung cấp = đầu kỳ + hóa đơn (sau ngày chốt đầu kỳ) − đã chi (sau ngày chốt đầu kỳ). */
purchasingRoutes.get('/debts', adminOnlyEndpoint, async (c) => {
  needManage(c.get('auth'));
  const rows = (
    await c.env.DB.prepare(
      `SELECT s.id, s.name, s.opening_debt, s.opening_date,
              COALESCE((SELECT SUM(v.total) FROM po_invoices v WHERE v.supplier_id = s.id AND v.status = 'OK' AND (s.opening_date IS NULL OR v.invoice_date > s.opening_date)), 0) AS invoiced,
              COALESCE((SELECT SUM(p.amount) FROM po_payments p WHERE p.supplier_id = s.id AND p.status = 'OK' AND (s.opening_date IS NULL OR p.pay_date > s.opening_date)), 0) AS paid
       FROM suppliers s WHERE s.active = 1 ORDER BY s.name`,
    ).all<{ id: string; name: string; opening_debt: number; opening_date: string | null; invoiced: number; paid: number }>()
  ).results;
  return ok(c, rows.map((r) => ({ ...r, balance: r.opening_debt + r.invoiced - r.paid })));
});

purchasingRoutes.get('/suppliers/:id/ledger', adminOnlyEndpoint, async (c) => {
  needManage(c.get('auth'));
  const id = c.req.param('id');
  const s = await c.env.DB.prepare('SELECT id, name, opening_debt, opening_date FROM suppliers WHERE id = ?').bind(id).first<{ id: string; name: string; opening_debt: number; opening_date: string | null }>();
  if (!s) throw notFound('Không tìm thấy nhà cung cấp');
  const inv = (await c.env.DB.prepare("SELECT invoice_date AS d, invoice_no AS ref, total AS amount FROM po_invoices WHERE supplier_id = ? AND status = 'OK'").bind(id).all<{ d: string; ref: string; amount: number }>()).results;
  const pay = (await c.env.DB.prepare("SELECT pay_date AS d, account AS ref, amount, kind FROM po_payments WHERE supplier_id = ? AND status = 'OK'").bind(id).all<{ d: string; ref: string; amount: number; kind: string }>()).results;
  const entries = [
    ...inv.filter((x) => !s.opening_date || x.d > s.opening_date).map((x) => ({ date: x.d, kind: 'Hóa đơn', ref: x.ref, delta: x.amount })),
    ...pay.filter((x) => !s.opening_date || x.d > s.opening_date).map((x) => ({ date: x.d, kind: x.kind === 'COC' ? 'Đã cọc' : 'Đã chi', ref: x.ref, delta: -x.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let run = s.opening_debt;
  return ok(c, { supplier: s, entries: entries.map((e) => ({ ...e, balance: (run += e.delta) })) });
});

/* ---------------- Giá nguyên vật liệu theo tháng (bình quân gia quyền, có tồn đầu) ---------------- */

purchasingRoutes.get('/material-prices', adminOnlyEndpoint, async (c) => {
  needManage(c.get('auth'));
  const month = c.req.query('month') ?? '';
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('BAD_MONTH', 'Chọn tháng (YYYY-MM)');
  const end = `${month}-31`;
  const start = `${month}-01`;
  const inbound = (
    await c.env.DB.prepare(
      `SELECT m.item, d.doc_date AS d, m.qty, m.price FROM kho_moves m JOIN kho_docs d ON d.id = m.doc_id
       WHERE d.status = 'OK' AND m.qty > 0 AND m.price IS NOT NULL AND m.price > 0 AND d.doc_date <= ?`,
    ).bind(end).all<{ item: string; d: string; qty: number; price: number }>()
  ).results;
  const items = [...new Set(inbound.map((r) => r.item))];
  if (!items.length) return ok(c, { month, rows: [] });
  const out = (
    await c.env.DB.prepare('SELECT item, doc_date AS d, qty FROM kho_ledger WHERE qty < 0 AND doc_date <= ?').bind(end).all<{ item: string; d: string; qty: number }>()
  ).results.filter((r) => r.item && items.includes(r.item));
  const info = new Map((await c.env.DB.prepare('SELECT code, name, unit FROM kho_items').all<{ code: string; name: string; unit: string }>()).results.map((r) => [r.code, r]));
  const rows = items.map((item) => {
    const ev = [
      ...inbound.filter((r) => r.item === item).map((r) => ({ d: r.d, k: 0, qty: r.qty, price: r.price })),
      ...out.filter((r) => r.item === item).map((r) => ({ d: r.d, k: 1, qty: -r.qty, price: 0 })),
    ].sort((a, b) => (a.d === b.d ? a.k - b.k : a.d.localeCompare(b.d)));
    let q = 0;
    let v = 0;
    let openQ = 0;
    let openV = 0;
    let inQ = 0;
    let inV = 0;
    let last = 0;
    let marked = false;
    for (const e of ev) {
      if (!marked && e.d >= start) {
        openQ = q;
        openV = v;
        marked = true;
      }
      if (e.k === 0) {
        q += e.qty;
        v += e.qty * e.price;
        if (e.d >= start) {
          inQ += e.qty;
          inV += e.qty * e.price;
        }
        last = e.price;
      } else {
        const avg = q > 0 ? v / q : 0;
        const take = Math.min(e.qty, Math.max(q, 0));
        q -= take;
        v -= take * avg;
      }
    }
    if (!marked) {
      openQ = q;
      openV = v;
    }
    const avgEnd = q > 0 ? v / q : last;
    const inMonth = inQ > 0 ? inV / inQ : 0;
    return {
      item,
      name: info.get(item)?.name ?? item,
      unit: info.get(item)?.unit ?? '',
      open_qty: round6(openQ),
      open_price: openQ > 0 ? round6(openV / openQ) : 0,
      in_qty: round6(inQ),
      in_price: round6(inMonth),
      avg_price: round6(avgEnd),
      last_price: round6(last),
    };
  });
  return ok(c, { month, rows: rows.filter((r) => r.in_qty > 0 || r.open_qty > 0).sort((a, b) => a.name.localeCompare(b.name, 'vi')) });
});

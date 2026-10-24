import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, conflict, forbidden, notFound, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import { requirePermission } from '../middleware/rbac';
import { adminOnlyEndpoint } from '../middleware/adminHost';
import { khoReturnRoutes } from './khoReturns';
import { purchasingRoutes, poStatus, autoPoForReceipt } from './purchasing';
import { newId } from '../lib/ids';
import { probeSaleSplit, probeSaleExtra, syncFbSaleDays } from '../services/fbSales';
import {
  POSCAKE_CHANNELS,
  SOURCE_CHANNELS,
  loadMapVersions,
  pickMap,
  poscakeFrom,
  unmappedLabel,
  probeChannelDay,
  probeCustomerFields,
  recomputeAll,
  recomputeDay,
  sealKey,
  syncChannelDay,
} from '../services/poscake';
import {
  CHANNELS,
  CHANNEL_LABELS,
  loadLookups,
  remapUnmapped,
  resolveLabel,
  saveChannelDays,
  type Channel,
  type ChannelDay,
} from '../services/channelOut';

/**
 * Kho sản xuất: nhập NVL → pha chế BTP → kiểm kê đóng gói → xuất kho → hàng hoàn.
 * Sổ ghi theo từng dòng (kho_moves), không sửa đè; phiếu sai thì hủy rồi lập phiếu mới.
 * Tồn = tổng số lượng các dòng của phiếu còn hiệu lực. Đơn giá chỉ trả cho CEO / kế toán.
 */
export const khoRoutes = new Hono<AppEnv>();
khoRoutes.use('*', requirePermission('hub.access'));
khoRoutes.route('/ret', khoReturnRoutes);
khoRoutes.route('/mh', purchasingRoutes);

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

/**
 * Bảng định mức (kho_bom) là số nhạy cảm: chỉ CEO, quản lý và kế toán (canEditMap) nhận về nguyên bảng.
 * Người khác (kỹ thuật pha chế, kế toán kho...) chỉ nhận: sản phẩm nào có định mức, bán thành phẩm của từng
 * sản phẩm, và gọi /bom/expand để lấy LƯỢNG CẦN DÙNG cho đúng số lượng của mẻ đang làm.
 */
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
  if (canEditMap(auth)) return ok(c, { items: items.results, bom: bom.results, can_price: canPrice(auth), bom_hidden: false });
  const cls = new Map(items.results.map((i) => [String(i.code), String(i.cls)]));
  const hasBom = new Set<string>();
  const btpOf: Record<string, string> = {};
  for (const r of bom.results) {
    const product = String(r.product);
    hasBom.add(product);
    if (!btpOf[product] && cls.get(String(r.item)) === 'BTP') btpOf[product] = String(r.item);
  }
  return ok(c, {
    items: items.results,
    bom: [],
    bom_hidden: true,
    bom_has: [...hasBom],
    btp_of: btpOf,
    can_price: canPrice(auth),
  });
});

/** Lượng vật tư cần cho từng (sản phẩm, số lượng): dùng cho phiếu pha chế, kiểm kê đóng gói, in phiếu sản xuất. */
khoRoutes.post('/bom/expand', async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => null)) as { lines?: Array<{ product?: unknown; qty?: unknown }> } | null;
  const lines = Array.isArray(b?.lines) ? b!.lines : [];
  if (!lines.length) throw badRequest('MISSING', 'Thiếu sản phẩm cần tính');
  if (lines.length > 100) throw badRequest('TOO_MANY', 'Mỗi lần tối đa 100 sản phẩm');
  const out: Array<{ product: string; qty: number; rows: Array<{ item: string; need: number; kind: string | null }> }> = [];
  for (const l of lines) {
    const product = String(l.product ?? '');
    const qty = Number(l.qty);
    if (!product || !Number.isFinite(qty) || qty <= 0) throw badRequest('BAD_QTY', 'Số lượng phải lớn hơn 0');
    const rows = await c.env.DB.prepare('SELECT item, qty, kind FROM kho_bom WHERE product = ? ORDER BY sort')
      .bind(product)
      .all<{ item: string; qty: number; kind: string | null }>();
    out.push({
      product,
      qty,
      rows: rows.results.map((r) => ({ item: r.item, need: Math.round(r.qty * qty * 1e6) / 1e6, kind: r.kind })),
    });
  }
  if (!canEditMap(auth)) {
    await auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_BOM_READ',
      entityType: 'KHO_BOM',
      entityId: out.map((o) => o.product).slice(0, 5).join(','),
      ip: ip(c),
      requestId: c.get('requestId'),
    }).run();
  }
  return ok(c, out);
});

/** Giá vốn từng mã theo phiếu nhập / tồn đầu: giá nhập gần nhất và bình quân gia quyền. Chỉ người được xem giá. */
khoRoutes.get('/costs', async (c) => {
  if (!canPrice(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem giá vốn');
  const rows = await c.env.DB.prepare(
    `SELECT m.item, m.qty, m.price, d.doc_date, d.id AS doc_id
     FROM kho_moves m JOIN kho_docs d ON d.id = m.doc_id
     WHERE d.status = 'OK' AND d.type IN ('PN','TD') AND m.price IS NOT NULL AND m.price > 0 AND m.qty > 0
     ORDER BY d.doc_date, d.id, m.id`,
  ).all<{ item: string; qty: number; price: number; doc_date: string; doc_id: number }>();
  const acc = new Map<string, { last: number; last_date: string; amt: number; qty: number }>();
  for (const r of rows.results) {
    const a = acc.get(r.item) ?? { last: 0, last_date: '', amt: 0, qty: 0 };
    a.last = r.price;
    a.last_date = r.doc_date;
    a.amt += r.price * r.qty;
    a.qty += r.qty;
    acc.set(r.item, a);
  }
  return ok(
    c,
    [...acc].map(([item, a]) => ({
      item,
      last: a.last,
      last_date: a.last_date,
      avg: a.qty ? Math.round(a.amt / a.qty) : a.last,
    })),
  );
});

/* ---------- Hồ sơ vỏ can / chai / thùng ---------- */
const VO_FIELDS = ['new_code', 'kind', 'capacity', 'style', 'color', 'seq', 'photo_url', 'note', 'grp', 'std_name'] as const;
const cleanVo = (v: unknown) => {
  const t = String(v ?? '').trim();
  return t === '?' ? '' : t.slice(0, 300);
};

/** Danh sách vỏ / thùng kèm hồ sơ và các thành phẩm dùng vỏ đó (từ định mức + bảng đóng gói). */
khoRoutes.get('/vo', async (c) => {
  const items = await c.env.DB.prepare(
    `SELECT i.code, i.name, i.unit, i.grp, COALESCE(v.new_code,'') AS new_code, COALESCE(v.kind,'') AS kind,
            COALESCE(v.capacity,'') AS capacity, COALESCE(v.style,'') AS style, COALESCE(v.color,'') AS color,
            COALESCE(v.seq,'') AS seq, COALESCE(v.photo_url,'') AS photo_url, COALESCE(v.note,'') AS note,
            COALESCE(v.grp,'') AS grp_vo, COALESCE(v.std_name,'') AS std_name, v.count_qty AS count_qty, COALESCE(v.check_note,'') AS check_note,
            (SELECT MAX(p.updated_at) FROM kho_vo_img p WHERE p.code = i.code) AS photo_v,
            (SELECT GROUP_CONCAT(p.idx) FROM kho_vo_img p WHERE p.code = i.code) AS photo_idx
     FROM kho_items i LEFT JOIN kho_vo v ON v.code = i.code
     WHERE v.code IS NOT NULL
     ORDER BY i.code`,
  ).all<Record<string, unknown>>();
  const bom = await c.env.DB.prepare(
    `SELECT b.item, b.product FROM kho_bom b WHERE b.item IN (SELECT code FROM kho_vo)`,
  ).all<{ item: string; product: string }>();
  const pack = await c.env.DB.prepare('SELECT product, vo, thung FROM kho_pack').all<{
    product: string;
    vo: string;
    thung: string;
  }>();
  const used: Record<string, Set<string>> = {};
  const packed: Record<string, Set<string>> = {};
  const add = (k: string, p: string) => {
    if (!k) return;
    (used[k] ??= new Set()).add(p);
  };
  for (const r of bom.results) add(r.item, r.product);
  for (const r of pack.results) {
    for (const k of [r.vo, r.thung]) {
      if (!k) continue;
      add(k, r.product);
      (packed[k] ??= new Set()).add(r.product);
    }
  }
  const showPrice = canPrice(c.get('auth'));
  const nccRows = await c.env.DB.prepare(
    'SELECT code, name, ncc_code, price, quote_date, contact, main FROM kho_vo_ncc ORDER BY main DESC, id',
  ).all<{ code: string; name: string; ncc_code: string; price: number | null; quote_date: string; contact: string; main: number }>();
  const ncc: Record<string, unknown[]> = {};
  for (const r of nccRows.results) (ncc[r.code] ??= []).push({ ...r, price: showPrice ? r.price : null });
  return ok(c, {
    items: items.results,
    used: Object.fromEntries(Object.entries(used).map(([k, v]) => [k, [...v].sort()])),
    packed: Object.fromEntries(Object.entries(packed).map(([k, v]) => [k, [...v].sort()])),
    ncc,
    can_edit: canEditMap(c.get('auth')),
    can_price: showPrice,
  });
});

/** Ảnh vỏ: trả thẳng file ảnh để thẻ <img> dùng được; tải lên là ảnh đã nén sẵn ở trình duyệt. */
khoRoutes.get('/vo/:code/photo', async (c) => {
  const i = Math.min(4, Math.max(1, Number(c.req.query('i')) || 1));
  const thumb = c.req.query('t') === '1';
  const row = await c.env.DB.prepare(
    thumb
      ? "SELECT CASE WHEN thumb <> '' THEN 'image/jpeg' ELSE mime END AS mime, CASE WHEN thumb <> '' THEN thumb ELSE data END AS data FROM kho_vo_img WHERE code = ? AND idx = ?"
      : 'SELECT mime, data FROM kho_vo_img WHERE code = ? AND idx = ?',
  )
    .bind(c.req.param('code'), i)
    .first<{ mime: string; data: string }>();
  if (!row) throw notFound('Chưa có ảnh');
  const bin = Uint8Array.from(atob(row.data), (ch) => ch.charCodeAt(0));
  return new Response(bin, {
    headers: { 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=604800' },
  });
});

khoRoutes.put('/vo/:code/photo', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới tải ảnh vỏ');
  const code = c.req.param('code');
  const b = (await c.req.json().catch(() => null)) as { image?: unknown; idx?: unknown; thumb?: unknown } | null;
  const idx = Number(b?.idx ?? 1);
  if (!Number.isInteger(idx) || idx < 1 || idx > 4) throw badRequest('BAD_IDX', 'Mỗi vỏ tối đa 4 ảnh');
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b?.image ?? ''));
  if (!m) throw badRequest('BAD_IMAGE', 'Ảnh không đúng định dạng (jpg, png, webp)');
  if (m[2].length > 600_000) throw badRequest('IMAGE_TOO_BIG', 'Ảnh quá lớn, hãy chọn ảnh nhỏ hơn');
  const exists = await c.env.DB.prepare('SELECT 1 AS x FROM kho_items WHERE code = ?').bind(code).first();
  if (!exists) throw notFound('Không có mã này');
  const tm = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b?.thumb ?? ''));
  const thumb = tm && tm[1].length <= 60_000 ? tm[1] : '';
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO kho_vo_img (code, idx, mime, data, thumb, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(code, idx) DO UPDATE SET mime = excluded.mime, data = excluded.data, thumb = excluded.thumb,
       updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  )
    .bind(code, idx, m[1], m[2], thumb, auth.user.id, now)
    .run();
  return ok(c, { code, idx, photo_v: now });
});

khoRoutes.delete('/vo/:code/photo/:idx', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới xóa ảnh vỏ');
  await c.env.DB.prepare('DELETE FROM kho_vo_img WHERE code = ? AND idx = ?')
    .bind(c.req.param('code'), Number(c.req.param('idx')))
    .run();
  return ok(c, { ok: true });
});

/** Thay toàn bộ danh sách nhà cung cấp của một vỏ. Không có quyền xem giá thì giữ nguyên giá cũ của NCC cùng tên. */
khoRoutes.put('/vo/:code/ncc', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới sửa nhà cung cấp');
  const code = c.req.param('code');
  const b = (await c.req.json().catch(() => null)) as { rows?: Array<Record<string, unknown>> } | null;
  const rows = Array.isArray(b?.rows) ? b!.rows : [];
  if (rows.length > 20) throw badRequest('TOO_MANY', 'Tối đa 20 nhà cung cấp cho một vỏ');
  const exists = await c.env.DB.prepare('SELECT 1 AS x FROM kho_items WHERE code = ?').bind(code).first();
  if (!exists) throw notFound('Không có mã này');
  const old = await c.env.DB.prepare('SELECT name, price FROM kho_vo_ncc WHERE code = ?')
    .bind(code)
    .all<{ name: string; price: number | null }>();
  const oldPrice = new Map(old.results.map((r) => [r.name, r.price]));
  const showPrice = canPrice(auth);
  const now = nowIso();
  const clean = rows
    .map((r) => ({
      name: String(r.name ?? '').trim().slice(0, 120),
      ncc_code: String(r.ncc_code ?? '').trim().slice(0, 120),
      price: showPrice
        ? r.price === '' || r.price == null || !Number.isFinite(Number(r.price))
          ? null
          : Number(r.price)
        : (oldPrice.get(String(r.name ?? '').trim()) ?? null),
      quote_date: String(r.quote_date ?? '').trim().slice(0, 10),
      contact: String(r.contact ?? '').trim().slice(0, 200),
      main: r.main ? 1 : 0,
    }))
    .filter((r) => r.name);
  if (clean.length && !clean.some((r) => r.main)) clean[0].main = 1;
  let seenMain = false;
  for (const r of clean) {
    if (r.main && seenMain) r.main = 0;
    if (r.main) seenMain = true;
  }
  const stmts = [c.env.DB.prepare('DELETE FROM kho_vo_ncc WHERE code = ?').bind(code)];
  for (const r of clean)
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO kho_vo_ncc (code, name, ncc_code, price, quote_date, contact, main, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(code, r.name, r.ncc_code, r.price, r.quote_date, r.contact, r.main, auth.user.id, now),
    );
  await c.env.DB.batch(stmts);
  return ok(c, { code, rows: clean.length });
});

/** Gỡ một mã khỏi danh sách vỏ (xóa hồ sơ, ảnh, nhà cung cấp). Mã vật tư trong kho và định mức không bị đụng tới. */
khoRoutes.delete('/vo/:code', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới gỡ vỏ khỏi danh sách');
  const code = c.req.param('code');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM kho_vo_img WHERE code = ?').bind(code),
    c.env.DB.prepare('DELETE FROM kho_vo_ncc WHERE code = ?').bind(code),
    c.env.DB.prepare('DELETE FROM kho_vo WHERE code = ?').bind(code),
  ]);
  return ok(c, { code });
});

/**
 * Khai vỏ / thùng này dùng cho những thành phẩm nào (thông tin tra cứu, không trừ kho).
 * Mỗi thành phẩm có một vỏ và một thùng; gán vỏ này cho thành phẩm thì thay vỏ cũ của thành phẩm đó.
 */
/**
 * Sửa mã / tên MISA của một vỏ ngay trên web. Mã mới được đổi ở mọi nơi dùng mã đó (định mức, phiếu kho, quy đổi,
 * hồ sơ vỏ, ảnh, nhà cung cấp) trong một lần ghi: hoặc đổi hết hoặc không đổi gì.
 * Chị Huệ phải đổi cùng mã đó trên MISA để hai bên khớp nhau.
 */
/**
 * Danh sách vỏ đã đổi mã / tên trên web (để đưa chị Huệ đổi theo trên MISA). Lấy từ nhật ký, gộp các lần đổi liên tiếp
 * của cùng một vỏ về một dòng: mã gốc → mã hiện tại.
 */
khoRoutes.get('/vo/renames', async (c) => {
  if (!canEditMap(c.get('auth'))) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán xem danh sách đổi mã');
  const rows = await c.env.DB.prepare(
    `SELECT a.created_at, a.before_json, a.after_json, u.display_name AS who
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.action = 'KHO_VO_RENAME' ORDER BY a.created_at, a.id`,
  ).all<{ created_at: string; before_json: string | null; after_json: string | null; who: string | null }>();
  type Row = { old_code: string; old_name: string; new_code: string; new_name: string; at: string; by: string };
  const byCur = new Map<string, Row>();
  for (const r of rows.results) {
    let b: { code?: string; name?: string };
    let a: { code?: string; name?: string };
    try {
      b = JSON.parse(r.before_json ?? '{}');
      a = JSON.parse(r.after_json ?? '{}');
    } catch {
      continue;
    }
    if (!b.code || !a.code) continue;
    const prev = byCur.get(b.code);
    const entry: Row = prev
      ? { ...prev, new_code: a.code, new_name: a.name ?? prev.new_name, at: r.created_at, by: r.who ?? prev.by }
      : { old_code: b.code, old_name: b.name ?? '', new_code: a.code, new_name: a.name ?? b.name ?? '', at: r.created_at, by: r.who ?? '' };
    byCur.delete(b.code);
    byCur.set(a.code, entry);
  }
  const live = new Set(
    (await c.env.DB.prepare('SELECT code FROM kho_items').all<{ code: string }>()).results.map((x) => x.code),
  );
  const list = [...byCur.values()].filter(
    (r) => live.has(r.new_code) && (r.old_code !== r.new_code || r.old_name !== r.new_name),
  );
  // Mã vỏ mới tạo trên web (chưa chắc có trên MISA): chị Huệ cần tạo mã này trên MISA.
  const addedRows = await c.env.DB.prepare(
    `SELECT a.created_at, a.after_json, u.display_name AS who
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.action = 'KHO_ITEM_ADDED' ORDER BY a.created_at, a.id`,
  ).all<{ created_at: string; after_json: string | null; who: string | null }>();
  const inVo = new Map(
    (await c.env.DB.prepare('SELECT i.code, i.name FROM kho_vo v JOIN kho_items i ON i.code = v.code').all<{ code: string; name: string }>()).results.map((x) => [x.code, x.name]),
  );
  const renamedTo = new Map(list.map((r) => [r.old_code, r.new_code]));
  const added: Array<{ code: string; name: string; at: string; by: string }> = [];
  const seen = new Set<string>();
  for (const r of addedRows.results) {
    let a: { code?: string; name?: string } = {};
    try {
      a = JSON.parse(r.after_json ?? '{}');
    } catch {
      continue;
    }
    // Mã thêm rồi đổi mã: lấy mã hiện tại.
    const cur = a.code ? (renamedTo.get(a.code) ?? a.code) : '';
    if (!cur || seen.has(cur) || !inVo.has(cur)) continue;
    seen.add(cur);
    added.push({ code: cur, name: inVo.get(cur) ?? a.name ?? '', at: r.created_at, by: r.who ?? '' });
  }
  return ok(c, { renamed: list.sort((x, y) => x.old_code.localeCompare(y.old_code, 'vi')), added });
});

khoRoutes.post('/vo/:code/rename', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới đổi mã vỏ');
  const old = c.req.param('code');
  const b = (await c.req.json().catch(() => null)) as { code?: unknown; name?: unknown } | null;
  const next = String(b?.code ?? old).trim();
  const name = b?.name == null ? null : String(b.name).trim();
  const row = await c.env.DB.prepare(
    'SELECT i.code, i.name, i.unit, i.cls, i.grp, i.min_stock, i.active, i.created_at FROM kho_items i JOIN kho_vo v ON v.code = i.code WHERE i.code = ?',
  )
    .bind(old)
    .first<{ code: string; name: string; unit: string; cls: string; grp: string; min_stock: number; active: number; created_at: string }>();
  if (!row) throw notFound('Vỏ này chưa có trong danh sách');
  if (!next || next.length > 80) throw badRequest('BAD_CODE', 'Mã MISA không được để trống và tối đa 80 ký tự');
  if (name !== null && (!name || name.length > 200)) throw badRequest('BAD_NAME', 'Tên không được để trống');
  if (/[\r\n]/.test(next)) throw badRequest('BAD_CODE', 'Mã không được xuống dòng');
  const stmts: D1PreparedStatement[] = [];
  const db = c.env.DB;
  if (next !== old) {
    const dup = await db.prepare('SELECT 1 AS x FROM kho_items WHERE code = ?').bind(next).first();
    if (dup) throw conflict('DUP_CODE', 'Mã này đã có trong danh mục kho');
    stmts.push(
      db.prepare(
        'INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).bind(next, name ?? row.name, row.unit, row.cls, row.grp, row.min_stock, row.active, row.created_at),
    );
    for (const [table, col] of [
      ['kho_bom', 'product'],
      ['kho_bom', 'item'],
      ['kho_moves', 'item'],
      ['kho_map', 'misa_code'],
      ['channel_out', 'item'],
      ['channel_alias', 'item'],
      ['kho_pack', 'product'],
      ['kho_pack', 'vo'],
      ['kho_pack', 'thung'],
      ['kho_vo', 'code'],
      ['kho_vo_img', 'code'],
      ['kho_vo_ncc', 'code'],
    ] as const)
      stmts.push(db.prepare(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`).bind(next, old));
    stmts.push(
      db
        .prepare(
          "UPDATE channel_map SET item_label = ? || substr(item_label, length(?) + 1) WHERE substr(item_label, 1, length(?) + 3) = ? || ' - '",
        )
        .bind(next, old, old, old),
    );
    stmts.push(db.prepare('DELETE FROM kho_items WHERE code = ?').bind(old));
  } else if (name !== null && name !== row.name) {
    stmts.push(db.prepare('UPDATE kho_items SET name = ? WHERE code = ?').bind(name, old));
  } else {
    return ok(c, { code: old, changed: false });
  }
  stmts.push(
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'KHO_VO_RENAME',
      entityType: 'KHO_ITEM',
      entityId: next,
      before: { code: old, name: row.name },
      after: { code: next, name: name ?? row.name },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  );
  await db.batch(stmts);
  return ok(c, { code: next, changed: true });
});

khoRoutes.put('/vo/:code/uses', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới khai thành phẩm dùng vỏ');
  const code = c.req.param('code');
  const b = (await c.req.json().catch(() => null)) as { products?: unknown } | null;
  const want = [...new Set((Array.isArray(b?.products) ? b!.products : []).map((x) => String(x).trim()).filter(Boolean))];
  if (want.length > 400) throw badRequest('TOO_MANY', 'Tối đa 400 thành phẩm cho một vỏ');
  const vo = await c.env.DB.prepare('SELECT grp, kind FROM kho_vo WHERE code = ?')
    .bind(code)
    .first<{ grp: string; kind: string }>();
  if (!vo) throw notFound('Vỏ này chưa có trong danh sách');
  const col = vo.grp === 'THUNG' || vo.kind.toUpperCase() === 'THUNG' ? 'thung' : 'vo';
  const codes = new Set(
    (await c.env.DB.prepare('SELECT code FROM kho_items').all<{ code: string }>()).results.map((r) => r.code),
  );
  const bad = want.filter((p) => !codes.has(p));
  if (bad.length) throw badRequest('BAD_PRODUCT', `Mã thành phẩm chưa có trong kho: ${bad.slice(0, 3).join(', ')}`);
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  const current = await c.env.DB.prepare(`SELECT product FROM kho_pack WHERE ${col} = ?`)
    .bind(code)
    .all<{ product: string }>();
  for (const r of current.results)
    if (!want.includes(r.product))
      stmts.push(
        c.env.DB.prepare(`UPDATE kho_pack SET ${col} = '', updated_by = ?, updated_at = ? WHERE product = ?`).bind(
          auth.user.id,
          now,
          r.product,
        ),
      );
  for (const p of want)
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO kho_pack (product, ${col}, updated_by, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(product) DO UPDATE SET ${col} = excluded.${col}, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      ).bind(p, code, auth.user.id, now),
    );
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  return ok(c, { code, products: want.length });
});

khoRoutes.put('/vo/:code', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới sửa hồ sơ vỏ');
  const code = c.req.param('code');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const exists = await c.env.DB.prepare('SELECT 1 AS x FROM kho_items WHERE code = ?').bind(code).first();
  if (!exists) throw notFound('Không có mã này');
  const v = Object.fromEntries(VO_FIELDS.map((f) => [f, cleanVo(b?.[f])])) as Record<(typeof VO_FIELDS)[number], string>;
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO kho_vo (code, new_code, kind, capacity, style, color, seq, photo_url, note, grp, std_name, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET new_code = excluded.new_code, kind = excluded.kind, capacity = excluded.capacity,
         style = excluded.style, color = excluded.color, seq = excluded.seq, photo_url = excluded.photo_url,
         note = excluded.note, grp = excluded.grp, std_name = excluded.std_name, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    ).bind(code, v.new_code, v.kind, v.capacity, v.style, v.color, v.seq, v.photo_url, v.note, ['VO', 'THUNG', 'PHUKIEN', 'KHAC'].includes(v.grp) ? v.grp : '', v.std_name, auth.user.id, nowIso()),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_VO_UPDATE',
      entityType: 'KHO_ITEM',
      entityId: code,
      after: v,
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { code });
});

/** Nạp hàng loạt từ file Excel (sheet DOI_MA_VO và DM_THANH_PHAM đã đọc ở trình duyệt). Mã lạ thì bỏ qua và báo lại. */
khoRoutes.post('/vo/import', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới nạp dữ liệu vỏ');
  const b = (await c.req.json().catch(() => null)) as {
    vo?: Array<Record<string, unknown>>;
    pack?: Array<Record<string, unknown>>;
    create?: boolean;
  } | null;
  const vo = Array.isArray(b?.vo) ? b!.vo : [];
  const pack = Array.isArray(b?.pack) ? b!.pack : [];
  if (vo.length + pack.length > 3000) throw badRequest('TOO_MANY', 'File quá nhiều dòng, tách nhỏ rồi nạp lại');
  const codes = new Set(
    (await c.env.DB.prepare('SELECT code FROM kho_items').all<{ code: string }>()).results.map((r) => r.code),
  );
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  const missing = new Set<string>();
  let voN = 0;
  let packN = 0;
  let created = 0;
  for (const r of vo) {
    const code = String(r.code ?? '').trim();
    if (!code) continue;
    const grp = ['VO', 'THUNG', 'PHUKIEN', 'KHAC'].includes(String(r.grp)) ? String(r.grp) : '';
    if (!codes.has(code)) {
      // File có cột Tên thì tạo luôn mã mới trong kho để có sẵn "khung" cho vỏ; không có tên thì báo thiếu.
      const nm = String(r.name ?? '').trim().slice(0, 200);
      if (b?.create && nm) {
        stmts.push(
          c.env.DB.prepare(
            'INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?)',
          ).bind(code, nm, String(r.unit ?? '').trim().slice(0, 20) || 'Cái', 'NVL', grp === 'VO' || !grp ? 'Vỏ can, chai, túi' : 'Hộp, thùng, phụ kiện đóng gói', now),
        );
        codes.add(code);
        created += 1;
        stmts.push(
          auditStatement(c.env.DB, {
            actorId: auth.user.id,
            action: 'KHO_ITEM_ADDED',
            entityType: 'KHO_ITEM',
            entityId: code,
            after: { code, name: nm, cls: 'NVL' },
            requestId: c.get('requestId'),
            ip: ip(c),
          }),
        );
      } else {
        missing.add(code);
        continue;
      }
    }
    voN += 1;
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO kho_vo (code, new_code, kind, capacity, style, color, seq, photo_url, note, grp, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET kind = CASE WHEN excluded.kind <> '' THEN excluded.kind ELSE kho_vo.kind END,
           capacity = CASE WHEN excluded.capacity <> '' THEN excluded.capacity ELSE kho_vo.capacity END,
           style = CASE WHEN excluded.style <> '' THEN excluded.style ELSE kho_vo.style END,
           color = CASE WHEN excluded.color <> '' THEN excluded.color ELSE kho_vo.color END,
           seq = CASE WHEN excluded.seq <> '' THEN excluded.seq ELSE kho_vo.seq END,
           note = CASE WHEN excluded.note <> '' THEN excluded.note ELSE kho_vo.note END,
           grp = CASE WHEN excluded.grp <> '' THEN excluded.grp ELSE kho_vo.grp END,
           updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      ).bind(code, '', cleanVo(r.kind), cleanVo(r.capacity), cleanVo(r.style), cleanVo(r.color), cleanVo(r.seq), cleanVo(r.note), grp, auth.user.id, now),
    );
  }
  for (const r of pack) {
    const product = String(r.product ?? '').trim();
    const v = cleanVo(r.vo);
    const t = cleanVo(r.thung);
    if (!product || (!v && !t)) continue;
    if (!codes.has(product)) {
      missing.add(product);
      continue;
    }
    for (const x of [v, t]) if (x && !codes.has(x)) missing.add(x);
    packN += 1;
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO kho_pack (product, vo, thung, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(product) DO UPDATE SET vo = excluded.vo, thung = excluded.thung,
           updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      ).bind(product, v, t, auth.user.id, now),
    );
  }
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  await auditStatement(c.env.DB, {
    actorId: auth.user.id,
    action: 'KHO_VO_IMPORT',
    entityType: 'KHO_VO',
    entityId: 'import',
    after: { vo: voN, pack: packN, created, missing: missing.size },
    requestId: c.get('requestId'),
    ip: ip(c),
  }).run();
  return ok(c, { vo: voN, pack: packN, created, missing: [...missing].slice(0, 100) });
});

khoRoutes.post('/items', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới thêm mã vật tư');
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

/**
 * Thao tác hàng loạt trên danh mục: ngừng dùng, dùng lại hoặc xóa nhiều mã một lần.
 * Xóa chỉ áp cho mã chưa phát sinh; mã đã dùng được trả về trong `blocked` để người dùng chọn "ngừng dùng".
 */
khoRoutes.post('/items/bulk', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới sửa danh mục vật tư');
  const b = (await c.req.json().catch(() => null)) as { action?: unknown; codes?: unknown } | null;
  const action = String(b?.action ?? '');
  if (!['deactivate', 'activate', 'delete'].includes(action)) throw badRequest('BAD_ACTION', 'Thao tác không đúng');
  const codes = [...new Set((Array.isArray(b?.codes) ? b!.codes : []).map((x) => String(x)))].filter(Boolean);
  if (!codes.length) throw badRequest('MISSING', 'Chưa chọn mã nào');
  if (codes.length > 500) throw badRequest('TOO_MANY', 'Mỗi lần tối đa 500 mã');
  const db = c.env.DB;
  const existing = new Set<string>();
  for (let i = 0; i < codes.length; i += 80) {
    const part = codes.slice(i, i + 80);
    const r = await db
      .prepare(`SELECT code FROM kho_items WHERE code IN (${part.map(() => '?').join(',')})`)
      .bind(...part)
      .all<{ code: string }>();
    for (const x of r.results) existing.add(x.code);
  }
  const targets = codes.filter((x) => existing.has(x));
  const blocked: string[] = [];
  const reasons: Record<string, string[]> = {};
  let done = targets;
  if (action === 'delete') {
    // D1 giới hạn số vế UNION trong một câu lệnh, nên hỏi từng bảng bằng câu riêng rồi gộp lại.
    const REFS: Array<[string, string, string]> = [
      ['kho_bom', 'item', 'đang nằm trong định mức của sản phẩm khác'],
      ['kho_moves', 'item', 'đã có phiếu kho'],
      ['kho_map', 'misa_code', 'đang được CRM quy đổi (trang Đồng bộ mã B2B)'],
      ['channel_out', 'item', 'đã có số bán qua sàn'],
      ['channel_alias', 'item', 'có quy đổi tên sàn'],
      ['kho_pack', 'vo', 'được khai là vỏ của thành phẩm'],
      ['kho_pack', 'thung', 'được khai là thùng của thành phẩm'],
    ];
    for (let i = 0; i < targets.length; i += 60) {
      const part = targets.slice(i, i + 60);
      const ph = part.map(() => '?').join(',');
      const res = await Promise.all(
        REFS.map(([t, col]) =>
          db.prepare(`SELECT DISTINCT ${col} AS x FROM ${t} WHERE ${col} IN (${ph})`).bind(...part).all<{ x: string }>(),
        ),
      );
      res.forEach((r, k) => {
        for (const row of (r.results ?? []) as Array<{ x: string }>) (reasons[row.x] ??= []).push(REFS[k][2]);
      });
    }
    done = targets.filter((x) => !reasons[x]);
    blocked.push(...targets.filter((x) => reasons[x]));
  }
  const stmts: D1PreparedStatement[] = [];
  for (const code of done) {
    if (action === 'delete') {
      // Định mức riêng của mã này (mã là sản phẩm) và khai báo vỏ / thùng của nó đi cùng khi xóa mã.
      stmts.push(db.prepare('DELETE FROM kho_bom WHERE product = ?').bind(code));
      stmts.push(db.prepare('DELETE FROM kho_pack WHERE product = ?').bind(code));
      stmts.push(db.prepare('DELETE FROM kho_vo_img WHERE code = ?').bind(code));
      stmts.push(db.prepare('DELETE FROM kho_vo_ncc WHERE code = ?').bind(code));
      stmts.push(db.prepare('DELETE FROM kho_vo WHERE code = ?').bind(code));
      stmts.push(db.prepare('DELETE FROM kho_items WHERE code = ?').bind(code));
    } else {
      stmts.push(db.prepare('UPDATE kho_items SET active = ? WHERE code = ?').bind(action === 'activate' ? 1 : 0, code));
    }
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  await auditStatement(db, {
    actorId: auth.user.id,
    action: action === 'delete' ? 'KHO_ITEM_DELETED' : action === 'activate' ? 'KHO_ITEM_REACTIVATED' : 'KHO_ITEM_DEACTIVATED',
    entityType: 'KHO_ITEM',
    entityId: 'bulk',
    after: { action, count: done.length, codes: done.slice(0, 50), blocked: blocked.slice(0, 50) },
    requestId: c.get('requestId'),
    ip: ip(c),
  }).run();
  return ok(c, { action, done, blocked, reasons, missing: codes.filter((x) => !existing.has(x)) });
});

/** Xóa toàn bộ định mức của nhiều sản phẩm một lần. Phiếu kho đã lập giữ nguyên. */
khoRoutes.post('/bom/bulk-clear', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới xóa định mức');
  const b = (await c.req.json().catch(() => null)) as { products?: unknown } | null;
  const products = [...new Set((Array.isArray(b?.products) ? b!.products : []).map((x) => String(x)))].filter(Boolean);
  if (!products.length) throw badRequest('MISSING', 'Chưa chọn sản phẩm nào');
  if (products.length > 500) throw badRequest('TOO_MANY', 'Mỗi lần tối đa 500 sản phẩm');
  const stmts: D1PreparedStatement[] = products.map((p) => c.env.DB.prepare('DELETE FROM kho_bom WHERE product = ?').bind(p));
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  await auditStatement(c.env.DB, {
    actorId: auth.user.id,
    action: 'KHO_BOM_SAVED',
    entityType: 'KHO_BOM',
    entityId: 'bulk-clear',
    after: { cleared: products.length, products: products.slice(0, 50) },
    requestId: c.get('requestId'),
    ip: ip(c),
  }).run();
  return ok(c, { cleared: products.length });
});

/** Bật / tắt dùng một mã: ngừng dùng thì mã không hiện ở ô chọn mã, không bị xóa lịch sử. */
khoRoutes.post('/items/:code/active', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới ngừng dùng mã vật tư');
  const code = c.req.param('code');
  const b = (await c.req.json().catch(() => null)) as { active?: unknown } | null;
  const active = b?.active === false ? 0 : 1;
  const res = await c.env.DB.prepare('UPDATE kho_items SET active = ? WHERE code = ?').bind(active, code).run();
  if (!res.meta.changes) throw notFound('Không có mã này');
  await auditStatement(c.env.DB, {
    actorId: auth.user.id,
    action: active ? 'KHO_ITEM_REACTIVATED' : 'KHO_ITEM_DEACTIVATED',
    entityType: 'KHO_ITEM',
    entityId: code,
    after: { active },
    requestId: c.get('requestId'),
    ip: ip(c),
  }).run();
  return ok(c, { code, active });
});

/**
 * Xóa hẳn một mã vật tư. Chỉ xóa được khi mã CHƯA phát sinh gì: không có trong định mức của ai, chưa có phiếu kho,
 * chưa quy đổi từ CRM / sàn. Đã phát sinh thì phải "ngừng dùng" để giữ lịch sử kho.
 */
khoRoutes.delete('/items/:code', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới xóa mã vật tư');
  const code = c.req.param('code');
  const item = await c.env.DB.prepare('SELECT code, name FROM kho_items WHERE code = ?')
    .bind(code)
    .first<{ code: string; name: string }>();
  if (!item) throw notFound('Không có mã này');
  const refs = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM kho_bom WHERE item = ?1) AS bom,
       (SELECT COUNT(*) FROM kho_moves WHERE item = ?1) AS moves,
       (SELECT COUNT(*) FROM kho_map WHERE misa_code = ?1) AS map,
       (SELECT COUNT(*) FROM channel_out WHERE item = ?1) AS chan,
       (SELECT COUNT(*) FROM channel_alias WHERE item = ?1) AS alias,
       (SELECT COUNT(*) FROM kho_pack WHERE vo = ?1 OR thung = ?1) AS pack`,
  )
    .bind(code)
    .first<{ bom: number; moves: number; map: number; chan: number; alias: number; pack: number }>();
  const parts: string[] = [];
  if (refs?.bom) parts.push(`${refs.bom} sản phẩm khác đang dùng mã này trong định mức`);
  if (refs?.moves) parts.push(`${refs.moves} dòng phiếu kho`);
  if (refs?.map) parts.push(`${refs.map} quy đổi từ CRM`);
  if (refs?.chan || refs?.alias) parts.push('quy đổi / số bán qua sàn');
  if (refs?.pack) parts.push('khai báo vỏ - thành phẩm');
  if (parts.length) {
    throw conflict(
      'ITEM_IN_USE',
      `Mã ${code} đã phát sinh (${parts.join(', ')}) nên không xóa hẳn được. Gỡ chỗ đang dùng trước (xóa định mức ở trang Định mức & giá thành, gỡ quy đổi ở trang Đồng bộ mã B2B), hoặc dùng "Ngừng dùng" để ẩn mã này.`,
    );
  }
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM kho_bom WHERE product = ?').bind(code),
    c.env.DB.prepare('DELETE FROM kho_pack WHERE product = ?').bind(code),
    c.env.DB.prepare('DELETE FROM kho_vo_img WHERE code = ?').bind(code),
    c.env.DB.prepare('DELETE FROM kho_vo_ncc WHERE code = ?').bind(code),
    c.env.DB.prepare('DELETE FROM kho_vo WHERE code = ?').bind(code),
    c.env.DB.prepare('DELETE FROM kho_items WHERE code = ?').bind(code),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_ITEM_DELETED',
      entityType: 'KHO_ITEM',
      entityId: code,
      before: { code, name: item.name },
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

/** Thay toàn bộ định mức của một sản phẩm (CEO, quản lý điều phối, kế toán). Phiếu đã ghi không đổi vì sổ lưu số đã trừ. */
khoRoutes.put('/bom/:product', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới sửa định mức');
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

/**
 * Từng phiếu làm đổi tồn của một mã trong kỳ (để từ bảng Nhập – xuất – tồn bấm vào xem phiếu, không chỉ thấy số tổng).
 * Phiếu thật (kho_docs) có doc_id; phiếu xuất bán đơn B2B / trả hàng được ghép với đơn hoặc phiếu trả để mở ra xem.
 */
khoRoutes.get('/nxt/detail', async (c) => {
  const item = (c.req.query('item') ?? '').trim();
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!item) throw badRequest('NO_ITEM', 'Thiếu mã hàng');
  if (!isDate(from) || !isDate(to)) throw badRequest('BAD_RANGE', 'Cần chọn ngày bắt đầu và kết thúc');
  const opening = await c.env.DB.prepare('SELECT ROUND(COALESCE(SUM(qty), 0), 6) AS n FROM kho_ledger WHERE item = ? AND doc_date < ?')
    .bind(item, from)
    .first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT l.doc_date, l.doc_id, l.doc_type, l.doc_no, ROUND(SUM(l.qty), 6) AS qty,
            MAX(o.id) AS order_id, MAX(r.id) AS return_id
     FROM kho_ledger l
     LEFT JOIN orders o ON l.doc_id = 0 AND l.doc_type = 'B2B' AND l.doc_no = 'XB-' || o.order_no
     LEFT JOIN order_returns r ON l.doc_id = 0 AND l.doc_type = 'TRA_HANG' AND l.doc_no = r.return_no
     WHERE l.item = ? AND l.doc_date >= ? AND l.doc_date <= ?
     GROUP BY l.doc_date, l.doc_id, l.doc_type, l.doc_no
     ORDER BY l.doc_date, l.doc_id, l.doc_no`,
  )
    .bind(item, from, to)
    .all<Record<string, unknown>>();
  return ok(c, { opening: opening?.n ?? 0, rows: rows.results ?? [] });
});

/** Chênh lệch định mức và thực tế của các mẻ pha chế trong kỳ, theo từng NVL. */
khoRoutes.get('/variance', async (c) => {
  if (!canEditMap(c.get('auth'))) throw forbidden('Chỉ CEO, quản lý hoặc kế toán xem chênh lệch so với định mức');
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

khoRoutes.get('/alerts', async (c) => {
  const a = await khoAlerts(c.env.DB);
  // Cảnh báo "dùng lệch định mức" kèm số định mức: chỉ người được xem định mức.
  return ok(c, canEditMap(c.get('auth')) ? a : { ...a, variance: [] });
});

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
  // Phiếu nhập chia hai nhóm: có thành phẩm / hàng hóa / combo thì là "thành phẩm", còn lại là nguyên vật liệu, vỏ, tem...
  const clsFilter = c.req.query('cls');
  if (clsFilter === 'TP' || clsFilter === 'NVL') {
    const has =
      "EXISTS (SELECT 1 FROM kho_moves mm JOIN kho_items ii ON ii.code = mm.item WHERE mm.doc_id = d.id AND ii.cls IN ('TP', 'HH', 'COMBO'))";
    where.push(clsFilter === 'TP' ? has : `NOT ${has}`);
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
    if (type === 'TD' && b.allow_more !== true) {
      const had = await c.env.DB.prepare("SELECT no FROM kho_docs WHERE type = 'TD' AND status = 'OK' LIMIT 1").first<{ no: string }>();
      if (had) {
        throw conflict('TD_EXISTS', `Đã có phiếu tồn đầu kỳ ${had.no}. Nạp thêm sẽ CỘNG vào tồn hiện có; muốn nạp lại từ đầu thì hủy phiếu cũ trước.`);
      }
    }
    if (type === 'TD') {
      const seen = new Set<string>();
      for (const l of lines) {
        const code = String(l.item ?? '');
        if (seen.has(code)) throw badRequest('DUP_ITEM', `Mã "${code}" xuất hiện hai lần trong file, gộp lại thành một dòng`);
        seen.add(code);
      }
    }
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

  // Phiếu nhập nguyên vật liệu có thể gắn với một phiếu mua (đặt hàng ở trang quản trị): hàng về thì phiếu mua tự nhảy trạng thái.
  const poId = type === 'PN' && b.po_id ? String(b.po_id) : '';
  let poRow: { id: string; no: string; status: string } | null = null;
  if (poId) {
    poRow = await c.env.DB.prepare('SELECT id, no, status FROM po_orders WHERE id = ?').bind(poId).first<{ id: string; no: string; status: string }>();
    if (!poRow) throw badRequest('BAD_PO', 'Không tìm thấy phiếu mua đã chọn');
    if (poRow.status === 'HUY') throw badRequest('PO_CANCELLED', `Phiếu mua ${poRow.no} đã hủy`);
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
    // Chia nhóm 12 dòng / câu lệnh (D1 giới hạn 100 tham số mỗi câu) để nạp tồn đầu hàng nghìn mã vẫn chạy.
    ...Array.from({ length: Math.ceil(moves.length / 12) }, (_, i) => moves.slice(i * 12, i * 12 + 12)).map((part) =>
      c.env.DB.prepare(
        `INSERT INTO kho_moves (doc_id, item, qty, std_qty, price, role, note) VALUES ${part.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      ).bind(...part.flatMap((m) => [docId, m.item, m.qty, m.std_qty, m.price, m.role, m.note])),
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
  // Nhập nguyên vật liệu không có phiếu đặt nhưng có ghi nhà cung cấp (ví dụ vỏ can): tự tạo phiếu mua để Thảo nhập giá, kế toán theo dõi công nợ.
  if (!poRow && type === 'PN' && String(b.partner ?? '').trim().length >= 2 && moves.length) {
    const agg = new Map<string, { item: string; qty: number; price: number | null }>();
    for (const m of moves) {
      const x = agg.get(m.item);
      if (x) x.qty += m.qty;
      else agg.set(m.item, { item: m.item, qty: m.qty, price: m.price ?? null });
    }
    poRow = await autoPoForReceipt(c, String(b.partner), date, [...agg.values()], String(b.note ?? '').trim());
  }
  if (poRow) {
    // Gắn phiếu nhập kho này vào phiếu mua: mỗi dòng hàng khớp dòng đặt cùng mã (ưu tiên dòng còn thiếu).
    const poLines = (
      await c.env.DB.prepare(
        `SELECT l.id, l.item, l.qty - COALESCE((SELECT SUM(rl.qty) FROM po_receipt_lines rl JOIN po_receipts r ON r.id = rl.receipt_id
                                                  WHERE rl.po_line_id = l.id AND r.status = 'OK'), 0) AS remain
         FROM po_lines l WHERE l.po_id = ? ORDER BY l.sort`,
      )
        .bind(poRow.id)
        .all<{ id: string; item: string; remain: number }>()
    ).results;
    const mv = (await c.env.DB.prepare('SELECT id, item, qty, price FROM kho_moves WHERE doc_id = ? ORDER BY id').bind(docId).all<{ id: number; item: string; qty: number; price: number | null }>()).results;
    const rid = newId();
    await c.env.DB.prepare('INSERT INTO po_receipts (id, po_id, receipt_date, kho_doc_id, note, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(rid, poRow.id, date, docId, String(b.note ?? '').trim(), 'OK', auth.user.id, now)
      .run();
    for (const m of mv) {
      const cand = poLines.filter((l) => l.item === m.item);
      const pl = cand.find((l) => l.remain > 1e-9) ?? cand[0] ?? null;
      if (pl) pl.remain -= m.qty;
      await c.env.DB.prepare('INSERT INTO po_receipt_lines (id, receipt_id, po_line_id, item, qty, unit_price, kho_move_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(newId(), rid, pl?.id ?? null, m.item, m.qty, m.price, m.id)
        .run();
    }
    await poStatus(c.env.DB, poRow.id);
    warnings.push(`Đã ghi nhận hàng về cho phiếu mua ${poRow.no}.`);
  }
  return ok(c, { id: docId, no, warnings });
});

khoRoutes.post('/docs/:id/cancel', async (c) => {
  const auth = c.get('auth');
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = String(b?.reason ?? '').trim();
  if (reason.length < 3) throw badRequest('NO_REASON', 'Cần ghi lý do hủy phiếu');
  const doc = await c.env.DB.prepare('SELECT no, type, status FROM kho_docs WHERE id = ?').bind(id).first<{ no: string; type: string; status: string }>();
  if (!doc) throw notFound('Không tìm thấy phiếu');
  if (doc.status !== 'OK') throw conflict('ALREADY', 'Phiếu này đã hủy rồi');
  if (doc.type === 'TD' && !isCeo(auth)) throw forbidden('Chỉ CEO hủy phiếu tồn đầu kỳ');
  // Phiếu nhập đã gắn phiếu mua: hủy thì phiếu mua trả về chưa nhận (trừ khi đã vào hóa đơn nhà cung cấp).
  const linked = doc.type === 'PN'
    ? (await c.env.DB.prepare("SELECT id, po_id FROM po_receipts WHERE kho_doc_id = ? AND status = 'OK'").bind(id).all<{ id: string; po_id: string }>()).results
    : [];
  for (const r of linked) {
    const inv = await c.env.DB.prepare("SELECT invoice_no FROM po_invoices WHERE status = 'OK' AND receipt_ids LIKE ?").bind(`%"${r.id}"%`).first<{ invoice_no: string }>();
    if (inv) throw badRequest('INVOICED', `Phiếu nhập này đã nằm trong chứng từ nhà cung cấp ${inv.invoice_no || '(chưa có số)'}. Hủy chứng từ trước.`);
  }
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE kho_docs SET status = 'HUY', cancelled_by = ?, cancelled_at = ?, cancel_reason = ? WHERE id = ? AND status = 'OK'",
    ).bind(auth.user.id, nowIso(), reason, id),
    ...linked.map((r) => c.env.DB.prepare("UPDATE po_receipts SET status = 'HUY' WHERE id = ?").bind(r.id)),
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
  for (const po of new Set(linked.map((r) => r.po_id))) await poStatus(c.env.DB, po);
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
/** Gỡ một dòng quy đổi mã CRM → MISA (để mã MISA đó xóa được). Đơn đã xuất của mã CRM này sẽ vào danh sách "chưa có mã MISA". */
khoRoutes.delete('/map/:sku', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới gỡ quy đổi mã');
  const sku = c.req.param('sku');
  const row = await c.env.DB.prepare('SELECT crm_sku, misa_code FROM kho_map WHERE crm_sku = ?')
    .bind(sku)
    .first<{ crm_sku: string; misa_code: string }>();
  if (!row) throw notFound('Không có dòng quy đổi này');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM kho_map WHERE crm_sku = ?').bind(sku),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_MAP_REMOVED',
      entityType: 'KHO_MAP',
      entityId: sku,
      before: row,
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { crm_sku: sku, misa_code: row.misa_code });
});

/** Gắn hoặc sửa quy đổi cho MỘT mã CRM (kế toán làm ngay trên trang, không cần nạp lại cả file). */
khoRoutes.put('/map/:sku', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới sửa quy đổi mã');
  const sku = c.req.param('sku').trim();
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const code = String(b.misa_code ?? '').trim();
  const factor = num(b.factor);
  const note = String(b.note ?? '').slice(0, 200);
  if (!sku) throw badRequest('BAD_SKU', 'Thiếu mã CRM');
  if (!(await c.env.DB.prepare('SELECT 1 FROM kho_items WHERE code = ?').bind(code).first()))
    throw badRequest('BAD_MISA', `Mã MISA "${code}" chưa có trong danh mục kho`);
  if (!(factor > 0)) throw badRequest('BAD_FACTOR', 'Hệ số phải lớn hơn 0');
  const before = await c.env.DB.prepare('SELECT crm_sku, misa_code, factor, note FROM kho_map WHERE crm_sku = ?').bind(sku).first();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM kho_map WHERE crm_sku = ?').bind(sku),
    c.env.DB.prepare('INSERT INTO kho_map (crm_sku, misa_code, factor, note) VALUES (?, ?, ?, ?)').bind(sku, code, factor, note),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_MAP_SAVED',
      entityType: 'KHO_MAP',
      entityId: sku,
      before: before ?? undefined,
      after: { misa_code: code, factor, note },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { crm_sku: sku, misa_code: code, factor });
});

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

/* ---------- Hàng bán qua sàn (TikTok Shop, Shopee) ---------- */

const isChannel = (v: unknown): v is Channel => typeof v === 'string' && (CHANNELS as readonly string[]).includes(v);

/** Tổng quan: ngày bắt đầu trừ, từng kênh đã nạp tới ngày nào, các tên chưa có mã (kho chưa trừ). */
khoRoutes.get('/online', async (c) => {
  const db = c.env.DB;
  const [from, runs, unmapped, aliases, recent] = await Promise.all([
    db.prepare("SELECT v FROM kho_cfg WHERE k = 'online_from'").first<{ v: string }>(),
    db
      .prepare(
        `SELECT r.channel, r.day, r.orders, r.lines, r.received_at, r.source,
                COALESCE((SELECT SUM(qty) FROM channel_out o WHERE o.channel = r.channel AND o.day = r.day), 0) AS qty,
                COALESCE((SELECT SUM(qty) FROM channel_unmapped u WHERE u.channel = r.channel AND u.day = r.day), 0) AS unmapped_qty
         FROM channel_runs r ORDER BY r.day DESC, r.channel LIMIT 60`,
      )
      .all<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT channel, label, ROUND(SUM(qty), 3) AS qty, COUNT(*) AS days, MIN(day) AS first_day, MAX(day) AS last_day
         FROM channel_unmapped GROUP BY channel, label ORDER BY qty DESC LIMIT 300`,
      )
      .all<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT a.label, a.item, a.note, i.name AS item_name FROM channel_alias a LEFT JOIN kho_items i ON i.code = a.item
         ORDER BY a.label`,
      )
      .all<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT channel, MAX(day) AS last_day FROM channel_runs GROUP BY channel`,
      )
      .all<{ channel: string; last_day: string }>(),
  ]);
  // Thống kê 14 ngày gần nhất: sản phẩm lẻ bán nhiều nhất theo từng kênh (chỉ phần đã có mã vật tư).
  const top = await db
    .prepare(
      `SELECT o.channel, o.item AS code, i.name, i.unit, ROUND(SUM(o.qty), 0) AS qty
       FROM channel_out o LEFT JOIN kho_items i ON i.code = o.item
       WHERE o.day >= date('now', '+7 hours', '-13 days')
       GROUP BY o.channel, o.item ORDER BY qty DESC LIMIT 60`,
    )
    .all<Record<string, unknown>>();
  return ok(c, {
    top: top.results,
    online_from: from?.v ?? '',
    channels: CHANNEL_LABELS,
    last_day: Object.fromEntries((recent.results ?? []).map((r) => [r.channel, r.last_day])),
    runs: runs.results,
    unmapped: await withSkus(db, unmapped.results ?? []),
    aliases: aliases.results,
  });
});

/** Gắn vào mỗi tên chưa có mã danh sách mã sàn (SKU + phân loại + số lượng/combo) đang trỏ tới tên đó. */
async function withSkus(db: D1Database, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return rows;
  const labels = [...new Set(rows.map((r) => String(r.label)))].slice(0, 200);
  const found = (
    await db
      .prepare(
        `SELECT channel, item_label, sku, variant, qty FROM channel_map
         WHERE item_label IN (${labels.map(() => '?').join(',')}) ORDER BY channel, sku`,
      )
      .bind(...labels)
      .all<{ channel: string; item_label: string; sku: string; variant: string; qty: number }>()
  ).results ?? [];
  const by = new Map<string, Array<{ sku: string; variant: string; qty: number }>>();
  for (const f of found) {
    const k = `${f.channel}|${f.item_label}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push({ sku: f.sku, variant: f.variant, qty: f.qty });
  }
  return rows.map((r) => ({ ...r, skus: (by.get(`${r.channel}|${r.label}`) ?? []).slice(0, 12) }));
}

/** Nạp số xuất của một kênh (dán từ tab "Hàng lẻ theo ngày"). Nạp lại cùng ngày là thay chứ không cộng thêm. */
khoRoutes.post('/online/import', async (c) => {
  const auth = c.get('auth');
  if (!(auth.user.role === 'CEO' || auth.permissions.includes('sx.kiemke'))) {
    throw forbidden('Chỉ CEO hoặc kế toán kho mới nạp số bán qua sàn');
  }
  const b = (await c.req.json().catch(() => null)) as { channel?: unknown; days?: unknown } | null;
  if (!isChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh bán (TikTok Shop / Shopee)');
  if (!Array.isArray(b?.days) || b.days.length === 0) throw badRequest('MISSING', 'Không có ngày nào để nạp');
  if (b.days.length > 120) throw badRequest('TOO_MANY', 'Mỗi lần nạp tối đa 120 ngày');
  const days: ChannelDay[] = [];
  for (const raw of b.days as Array<Record<string, unknown>>) {
    if (!isDate(raw.day)) throw badRequest('BAD_DATE', `Ngày không đúng: ${String(raw.day)}`);
    const lines = Array.isArray(raw.lines) ? (raw.lines as Array<Record<string, unknown>>) : [];
    days.push({
      day: raw.day,
      orders: Number.isFinite(Number(raw.orders)) ? Number(raw.orders) : null,
      lines: lines.map((l) => ({ label: String(l.label ?? ''), qty: Number(l.qty) })).filter((l) => l.label && l.qty > 0),
    });
  }
  const result = await saveChannelDays(c.env.DB, b.channel, days, 'WEB');
  await c.env.DB.batch([
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_ONLINE_IMPORT',
      entityType: 'KHO_ONLINE',
      entityId: b.channel,
      after: { days: result.days, lines: result.lines, unmapped_qty: result.unmapped_qty },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, result);
});

/** Gán mã vật tư cho một tên sản phẩm lẻ chưa có mã; các dòng đang chờ của tên đó được trừ kho ngay. */
khoRoutes.put('/online/alias', async (c) => {
  const auth = c.get('auth');
  // Gán mã MISA do kế toán (chị Huệ), quản lý điều phối hoặc CEO làm; kế toán kho chỉ nhập xuất, không gán mã.
  if (!canEditMap(auth)) {
    throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới gán mã MISA');
  }
  const b = (await c.req.json().catch(() => null)) as { label?: unknown; item?: unknown; note?: unknown } | null;
  const label = String(b?.label ?? '').trim();
  const item = String(b?.item ?? '').trim();
  if (!label || !item) throw badRequest('MISSING', 'Cần tên sản phẩm và mã vật tư');
  const it = await c.env.DB.prepare('SELECT code FROM kho_items WHERE code = ?').bind(item).first<{ code: string }>();
  if (!it) throw badRequest('BAD_ITEM', 'Mã vật tư chưa có trong danh mục kho');
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO channel_alias (label, item, note) VALUES (?, ?, ?)
       ON CONFLICT (label) DO UPDATE SET item = excluded.item, note = excluded.note`,
    ).bind(label, it.code, String(b?.note ?? '')),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_ONLINE_ALIAS',
      entityType: 'KHO_ONLINE',
      entityId: label,
      after: { item: it.code },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  const moved = await remapUnmapped(c.env.DB);
  return ok(c, { label, item: it.code, moved });
});

/** Ngày bắt đầu trừ kho theo hàng bán qua sàn (trước ngày này coi như đã nằm trong tồn đầu kỳ). */
khoRoutes.put('/cfg/online-from', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO đặt ngày bắt đầu');
  const b = (await c.req.json().catch(() => null)) as { date?: unknown } | null;
  if (!isDate(b?.date)) throw badRequest('BAD_DATE', 'Ngày không đúng');
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO kho_cfg (k, v) VALUES ('online_from', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v",
    ).bind(b.date),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_CFG',
      entityType: 'KHO_CFG',
      entityId: 'online_from',
      after: { date: b.date },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { online_from: b.date });
});

/* ---------- Nguồn Poscake + bảng quy đổi combo (bán qua sàn) ---------- */

const canEditMap = (a: AuthContext) =>
  a.user.role === 'CEO' || a.permissions.includes('order.approve.normal') || a.permissions.includes('order.accounting.confirm');
const isPosChannel = (v: unknown): v is Channel => typeof v === 'string' && (POSCAKE_CHANNELS as string[]).includes(v);
const isSrcChannel = (v: unknown): v is Channel => typeof v === 'string' && (SOURCE_CHANNELS as string[]).includes(v);
const httpFetch = (url: string) => fetch(url);

/** Bán lẻ B2C theo khoảng ngày: tổng hợp từng ngày/kênh và chi tiết từng dòng phiếu (để lọc theo thời gian và tải báo cáo). */
khoRoutes.get('/online/range', async (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!isDate(from) || !isDate(to)) throw badRequest('BAD_RANGE', 'Cần chọn ngày bắt đầu và kết thúc');
  if (from > to) throw badRequest('BAD_RANGE', 'Ngày bắt đầu phải trước ngày kết thúc');
  const span = (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 864e5;
  if (span > 370) throw badRequest('TOO_LONG', 'Chọn tối đa 1 năm mỗi lần');
  const runs = await c.env.DB.prepare(
    `SELECT r.channel, r.day, r.orders,
            COALESCE((SELECT SUM(qty) FROM channel_out o WHERE o.channel = r.channel AND o.day = r.day), 0) AS qty,
            COALESCE((SELECT SUM(qty) FROM channel_unmapped u WHERE u.channel = r.channel AND u.day = r.day), 0) AS unmapped_qty
     FROM channel_runs r WHERE r.day >= ? AND r.day <= ? ORDER BY r.day DESC, r.channel`,
  )
    .bind(from, to)
    .all<Record<string, unknown>>();
  const lines = await c.env.DB.prepare(
    `SELECT o.channel, o.day, o.item AS code, COALESCE(i.name, o.item) AS name, COALESCE(i.unit, '') AS unit, o.qty
     FROM channel_out o LEFT JOIN kho_items i ON i.code = o.item
     WHERE o.day >= ? AND o.day <= ? ORDER BY o.day DESC, o.channel, o.item`,
  )
    .bind(from, to)
    .all<Record<string, unknown>>();
  return ok(c, { from, to, runs: runs.results ?? [], lines: lines.results ?? [] });
});

/** Phiếu xuất bán lẻ trong một ngày: mỗi kênh một phiếu XL-<kênh>-<ngày>, các dòng là sản phẩm lẻ đã trừ kho (từ bảng channel_out). */
khoRoutes.get('/online/day', async (c) => {
  const day = c.req.query('day');
  if (!isDate(day)) throw badRequest('BAD_DATE', 'Ngày không đúng');
  const rows = await c.env.DB.prepare(
    `SELECT o.channel, o.item AS code, COALESCE(i.name, o.item) AS name, COALESCE(i.unit, '') AS unit, o.qty
     FROM channel_out o LEFT JOIN kho_items i ON i.code = o.item
     WHERE o.day = ? ORDER BY o.channel, o.item`,
  )
    .bind(day)
    .all<{ channel: string; code: string; name: string; unit: string; qty: number }>();
  const runs = await c.env.DB.prepare('SELECT channel, orders FROM channel_runs WHERE day = ?').bind(day).all<{ channel: string; orders: number | null }>();
  const orders: Record<string, number | null> = {};
  for (const r of runs.results ?? []) orders[r.channel] = r.orders;
  const out = ['TIKTOK', 'SHOPEE', 'FACEBOOK'].map((ch) => {
    const code = ch === 'TIKTOK' ? 'TT' : ch === 'SHOPEE' ? 'SP' : 'FB';
    return {
      channel: ch,
      no: `XL-${code}-${day.replace(/-/g, '')}`,
      orders: orders[ch] ?? null,
      lines: (rows.results ?? []).filter((r) => r.channel === ch),
    };
  });
  return ok(c, { day, vouchers: out });
});

khoRoutes.get('/online/source', async (c) => {
  const rows = await c.env.DB
    .prepare('SELECT channel, shop_id, shop_names, last_sync_at, last_sync_note, updated_at FROM channel_source')
    .all<Record<string, unknown>>();
  return ok(c, rows.results ?? []);
});

/** CEO nối cửa hàng Poscake cho một kênh (mã API được mã hoá, không bao giờ trả ra lại). */
khoRoutes.put('/online/source', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO nối Poscake');
  const b = (await c.req.json().catch(() => null)) as { channel?: unknown; shop_id?: unknown; api_key?: unknown; shop_names?: unknown } | null;
  if (!isSrcChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh TikTok Shop, Shopee hoặc Facebook');
  const shopId = String(b?.shop_id ?? '').trim();
  if (!/^\d{3,20}$/.test(shopId)) throw badRequest('BAD_SHOP', 'Mã cửa hàng Poscake là một dãy số');
  const existing = await c.env.DB.prepare('SELECT api_key FROM channel_source WHERE channel = ?').bind(b.channel).first<{ api_key: string }>();
  const plain = String(b?.api_key ?? '').trim();
  if (!plain && !existing) throw badRequest('MISSING_KEY', 'Dán mã API của cửa hàng Poscake');
  const sealed = plain ? await sealKey(plain, c.env.INGEST_KEY) : (existing as { api_key: string }).api_key;
  const names = b?.shop_names && typeof b.shop_names === 'object' ? JSON.stringify(b.shop_names) : null;
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO channel_source (channel, shop_id, api_key, shop_names, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (channel) DO UPDATE SET shop_id = excluded.shop_id, api_key = excluded.api_key,
           shop_names = COALESCE(excluded.shop_names, channel_source.shop_names), updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      )
      .bind(b.channel, shopId, sealed, names, auth.user.id, nowIso()),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_POSCAKE_SOURCE',
      entityType: 'KHO_ONLINE',
      entityId: String(b.channel),
      after: { shop_id: shopId, key_changed: Boolean(plain) },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { channel: b.channel, shop_id: shopId });
});

/** Kéo lại một hoặc vài ngày (tối đa 3 ngày một lần để không quá giờ xử lý). */
khoRoutes.post('/online/sync', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới kéo lại số');
  const b = (await c.req.json().catch(() => null)) as { channel?: unknown; days?: unknown; force?: unknown } | null;
  if (!isPosChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh TikTok Shop hoặc Shopee');
  const days = Array.isArray(b?.days) ? (b.days as unknown[]).filter(isDate) : [];
  if (days.length === 0 || days.length > 3) throw badRequest('BAD_DAYS', 'Chọn từ 1 đến 3 ngày');
  const out = [];
  for (const day of days) {
    try {
      out.push({ ok: true, ...(await syncChannelDay(c.env.DB, c.env.INGEST_KEY, b.channel, day, httpFetch, { force: b.force === true })) });
    } catch (e) {
      out.push({ ok: false, day, error: e instanceof Error ? e.message : 'Không kéo được' });
    }
  }
  return ok(c, out);
});

khoRoutes.get('/online/map', async (c) => {
  const channel = c.req.query('channel');
  if (!isPosChannel(channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const rows = await c.env.DB
    .prepare('SELECT sku, variant, from_day, item_label, qty, note, updated_at FROM channel_map WHERE channel = ? ORDER BY sku, variant, from_day, item_label')
    .bind(channel)
    .all<Record<string, unknown>>();
  return ok(c, rows.results ?? []);
});

/** Combo đã bán nhưng chưa có trong bảng quy đổi (đang bị tính vào "[Chưa quy đổi]"). */
khoRoutes.get('/online/combos', async (c) => {
  const channel = c.req.query('channel');
  if (!isPosChannel(channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const map = await loadMapVersions(c.env.DB, channel);
  const rows = await c.env.DB
    .prepare(
      `SELECT sku, variant, day, MIN(name) AS name, ROUND(SUM(qty), 3) AS qty, COUNT(DISTINCT order_id) AS orders
       FROM channel_order_lines WHERE channel = ? GROUP BY sku, variant, day`,
    )
    .bind(channel)
    .all<{ sku: string; variant: string; day: string; name: string; qty: number; orders: number }>();
  const codes = new Set(
    ((await c.env.DB.prepare('SELECT code FROM kho_items').all<{ code: string }>()).results ?? []).map((r) => r.code.toLowerCase()),
  );
  // Chưa quy đổi theo từng ngày: combo mới có bản áp dụng từ ngày X thì các ngày trước X vẫn là "chưa quy đổi".
  const agg = new Map<string, { sku: string; variant: string; name: string; qty: number; orders: number; first_day: string }>();
  for (const r of rows.results ?? []) {
    if (pickMap(map, r.sku, r.variant, r.day) || codes.has(r.sku.toLowerCase())) continue;
    const key = `${r.sku}|${r.variant}`;
    const a = agg.get(key);
    if (a) {
      a.qty += r.qty;
      a.orders += r.orders;
      if (r.day < a.first_day) a.first_day = r.day;
    } else agg.set(key, { sku: r.sku, variant: r.variant, name: r.name, qty: r.qty, orders: r.orders, first_day: r.day });
  }
  return ok(c, [...agg.values()].sort((a, b) => b.qty - a.qty));
});

async function daysOfSku(db: D1Database, channel: string, skus: string[], fromDay = ''): Promise<string[]> {
  if (skus.length === 0) return [];
  const rows = await db
    .prepare(`SELECT DISTINCT day FROM channel_order_lines WHERE channel = ? AND day >= ? AND sku IN (${skus.map(() => '?').join(',')})`)
    .bind(channel, fromDay, ...skus)
    .all<{ day: string }>();
  return (rows.results ?? []).map((r) => r.day);
}

/** Thêm một dòng quy đổi: mã SKU (+ phân loại) → sản phẩm lẻ × số lượng. Số các ngày liên quan tự tính lại. */
khoRoutes.post('/online/map/add', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới sửa bảng quy đổi');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isPosChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const sku = String(b?.sku ?? '').trim();
  const variant = String(b?.variant ?? '').trim();
  const label = String(b?.item_label ?? '').trim();
  const qty = num(b?.qty ?? 1);
  if (!sku || !label) throw badRequest('MISSING', 'Cần mã SKU và sản phẩm lẻ');
  if (!(qty > 0)) throw badRequest('BAD_QTY', 'Số lượng phải lớn hơn 0');
  const fromDay = String(b?.from_day ?? '').trim();
  if (fromDay && !isDate(fromDay)) throw badRequest('BAD_DATE', 'Ngày áp dụng không hợp lệ');
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, note, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (channel, sku, variant, from_day, item_label) DO UPDATE SET qty = excluded.qty, note = excluded.note,
           updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      )
      .bind(b.channel, sku, variant, fromDay, label, qty, String(b?.note ?? ''), auth.user.id, nowIso()),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_ONLINE_MAP',
      entityType: 'KHO_ONLINE',
      entityId: `${b.channel}:${sku}`,
      after: { variant, from_day: fromDay, item_label: label, qty },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  // Kế toán đã động vào combo này thì coi như đã kiểm: bỏ cờ "CẦN KẾ TOÁN XÁC NHẬN" của cả combo.
  await c.env.DB
    .prepare(
      `UPDATE channel_map SET note = '' WHERE channel = ? AND sku = ? AND variant = ? AND from_day = ? AND note LIKE '%CẦN KẾ TOÁN%'`,
    )
    .bind(b.channel, sku, variant, fromDay)
    .run();
  const days = await daysOfSku(c.env.DB, b.channel, [sku], fromDay);
  for (const d of days) await recomputeDay(c.env.DB, b.channel, d);
  return ok(c, { recomputed_days: days.length });
});

/**
 * Đổi mã vật tư của một dòng quy đổi (quy đổi nhầm sang mã khác): giữ nguyên số lượng, bỏ cờ cần xác nhận.
 * Nếu combo đã có dòng mang mã mới thì gộp số lượng vào dòng đó.
 */
khoRoutes.post('/online/map/swap', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới sửa bảng quy đổi');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isPosChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const sku = String(b?.sku ?? '').trim();
  const variant = String(b?.variant ?? '').trim();
  const fromDay = String(b?.from_day ?? '').trim();
  const oldLabel = String(b?.old_label ?? '').trim();
  const newLabel = String(b?.new_label ?? '').trim();
  if (!sku || !oldLabel || !newLabel) throw badRequest('MISSING', 'Thiếu mã SKU hoặc sản phẩm lẻ');
  const row = await c.env.DB
    .prepare('SELECT qty FROM channel_map WHERE channel = ? AND sku = ? AND variant = ? AND from_day = ? AND item_label = ?')
    .bind(b.channel, sku, variant, fromDay, oldLabel)
    .first<{ qty: number }>();
  if (!row) throw notFound('Không thấy dòng quy đổi này');
  const now = nowIso();
  if (oldLabel !== newLabel) {
    await c.env.DB.batch([
      c.env.DB
        .prepare('DELETE FROM channel_map WHERE channel = ? AND sku = ? AND variant = ? AND from_day = ? AND item_label = ?')
        .bind(b.channel, sku, variant, fromDay, oldLabel),
      c.env.DB
        .prepare(
          `INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, note, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)
           ON CONFLICT (channel, sku, variant, from_day, item_label) DO UPDATE SET qty = channel_map.qty + excluded.qty,
             note = '', updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        )
        .bind(b.channel, sku, variant, fromDay, newLabel, row.qty, auth.user.id, now),
      auditStatement(c.env.DB, {
        actorId: auth.user.id,
        action: 'KHO_ONLINE_MAP_SWAP',
        entityType: 'KHO_ONLINE',
        entityId: `${b.channel}:${sku}`,
        before: { item_label: oldLabel },
        after: { variant, from_day: fromDay, item_label: newLabel, qty: row.qty },
        requestId: c.get('requestId'),
        ip: ip(c),
      }),
    ]);
  }
  await c.env.DB
    .prepare(
      `UPDATE channel_map SET note = '' WHERE channel = ? AND sku = ? AND variant = ? AND from_day = ? AND note LIKE '%CẦN KẾ TOÁN%'`,
    )
    .bind(b.channel, sku, variant, fromDay)
    .run();
  const days = await daysOfSku(c.env.DB, b.channel, [sku], fromDay);
  for (const d of days) await recomputeDay(c.env.DB, b.channel, d);
  return ok(c, { recomputed_days: days.length });
});

/** Kế toán đã kiểm combo này, quy đổi đúng: bỏ cờ "CẦN KẾ TOÁN XÁC NHẬN" (không đổi số lượng, không đổi mã). */
khoRoutes.post('/online/map/confirm', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới xác nhận bảng quy đổi');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isPosChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const sku = String(b?.sku ?? '').trim();
  const variant = String(b?.variant ?? '').trim();
  const fromDay = String(b?.from_day ?? '').trim();
  if (!sku) throw badRequest('MISSING', 'Thiếu mã SKU');
  const res = await c.env.DB
    .prepare(
      `UPDATE channel_map SET note = '', updated_by = ?, updated_at = ?
       WHERE channel = ? AND sku = ? AND variant = ? AND from_day = ? AND note LIKE '%CẦN KẾ TOÁN%'`,
    )
    .bind(auth.user.id, nowIso(), b.channel, sku, variant, fromDay)
    .run();
  await c.env.DB.batch([
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_ONLINE_MAP_CONFIRM',
      entityType: 'KHO_ONLINE',
      entityId: `${b.channel}:${sku}`,
      after: { variant, from_day: fromDay, rows: res.meta.changes },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { confirmed_rows: res.meta.changes });
});

/** Lưu trọn cách quy đổi của một mã sàn: thay toàn bộ các món của mã đó (cùng phân loại, cùng ngày áp dụng). */
khoRoutes.post('/online/map/set', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới sửa bảng quy đổi');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isPosChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const sku = String(b?.sku ?? '').trim();
  const variant = String(b?.variant ?? '').trim();
  const fromDay = String(b?.from_day ?? '').trim();
  if (!sku) throw badRequest('MISSING', 'Thiếu mã SKU');
  if (fromDay && !isDate(fromDay)) throw badRequest('BAD_DATE', 'Ngày áp dụng không hợp lệ');
  const parts = (Array.isArray(b?.parts) ? (b.parts as Array<Record<string, unknown>>) : [])
    .map((p) => ({ label: String(p.item_label ?? '').trim(), qty: num(p.qty ?? 1) }))
    .filter((p) => p.label);
  if (!parts.length) throw badRequest('NO_PARTS', 'Chưa chọn sản phẩm lẻ nào');
  if (parts.some((p) => !(p.qty > 0))) throw badRequest('BAD_QTY', 'Số lượng phải lớn hơn 0');
  const merged = new Map<string, number>();
  for (const p of parts) merged.set(p.label, (merged.get(p.label) ?? 0) + p.qty);
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM channel_map WHERE channel = ? AND sku = ? AND variant = ? AND from_day = ?').bind(b.channel, sku, variant, fromDay),
    ...[...merged].map(([label, qty]) =>
      c.env.DB
        .prepare('INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, note, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, \'\', ?, ?)')
        .bind(b.channel, sku, variant, fromDay, label, qty, auth.user.id, now),
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_ONLINE_MAP',
      entityType: 'KHO_ONLINE',
      entityId: `${b.channel}:${sku}`,
      after: { variant, from_day: fromDay, parts: [...merged] },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  const days = await daysOfSku(c.env.DB, b.channel, [sku], fromDay);
  for (const d of days) await recomputeDay(c.env.DB, b.channel, d);
  return ok(c, { parts: merged.size, recomputed_days: days.length });
});

khoRoutes.post('/online/map/remove', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới sửa bảng quy đổi');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isPosChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const sku = String(b?.sku ?? '').trim();
  const fromDay = String(b?.from_day ?? '').trim();
  await c.env.DB
    .prepare('DELETE FROM channel_map WHERE channel = ? AND sku = ? AND variant = ? AND from_day = ? AND item_label = ?')
    .bind(b.channel, sku, String(b?.variant ?? '').trim(), fromDay, String(b?.item_label ?? '').trim())
    .run();
  const days = await daysOfSku(c.env.DB, b.channel, [sku], fromDay);
  for (const d of days) await recomputeDay(c.env.DB, b.channel, d);
  return ok(c, { recomputed_days: days.length });
});

/**
 * Shop đổi thành phần combo / đổi quà: tạo bản quy đổi mới áp dụng từ ngày X (sao chép bản đang hiệu lực để sửa tiếp).
 * Các ngày trước X giữ nguyên cách quy đổi cũ.
 */
khoRoutes.post('/online/map/version', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới sửa bảng quy đổi');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isPosChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const sku = String(b?.sku ?? '').trim();
  const variant = String(b?.variant ?? '').trim();
  const fromDay = String(b?.from_day ?? '').trim();
  if (!sku || !isDate(fromDay)) throw badRequest('MISSING', 'Cần mã SKU và ngày bắt đầu áp dụng');
  const map = await loadMapVersions(c.env.DB, b.channel);
  const key = (variant ? `${sku}|${variant}` : sku).toLowerCase();
  const versions = map.get(key) ?? [];
  if (versions.some((v) => v.from_day === fromDay)) throw conflict('EXISTS', 'Đã có bản quy đổi áp dụng từ ngày này');
  const src = pickMap(new Map([[key, versions]]), sku, variant, fromDay);
  if (!src) throw badRequest('NO_BASE', 'Chưa có cách quy đổi nào để sao chép');
  const now = nowIso();
  await c.env.DB.batch([
    ...src.rows.map((r) =>
      c.env.DB
        .prepare(
          'INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, note, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(b.channel, sku, variant, fromDay, r.item_label, r.qty, '', auth.user.id, now),
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_ONLINE_MAP_VERSION',
      entityType: 'KHO_ONLINE',
      entityId: `${b.channel}:${sku}`,
      after: { variant, from_day: fromDay },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  const days = await daysOfSku(c.env.DB, b.channel, [sku], fromDay);
  for (const d of days) await recomputeDay(c.env.DB, b.channel, d);
  return ok(c, { rows: src.rows.length, recomputed_days: days.length });
});

/** SKU mới (shop đổi combo thì thường đổi SKU): sao chép cách quy đổi của SKU cũ sang SKU mới, rồi kế toán chỉnh quà / số lượng. */
khoRoutes.post('/online/map/clone', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới sửa bảng quy đổi');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isPosChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const fromSku = String(b?.from_sku ?? '').trim();
  const fromVariant = String(b?.from_variant ?? '').trim();
  const sku = String(b?.sku ?? '').trim();
  const variant = String(b?.variant ?? '').trim();
  if (!fromSku || !sku) throw badRequest('MISSING', 'Cần SKU cũ và SKU mới');
  const map = await loadMapVersions(c.env.DB, b.channel);
  const src = pickMap(map, fromSku, fromVariant, '9999-12-31');
  if (!src) throw badRequest('NO_BASE', 'SKU cũ chưa có cách quy đổi để sao chép');
  const now = nowIso();
  await c.env.DB.batch([
    ...src.rows.map((r) =>
      c.env.DB
        .prepare(
          `INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, note, updated_by, updated_at) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)
           ON CONFLICT (channel, sku, variant, from_day, item_label) DO NOTHING`,
        )
        .bind(b.channel, sku, variant, r.item_label, r.qty, 'Sao chép từ ' + fromSku, auth.user.id, now),
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'KHO_ONLINE_MAP_CLONE',
      entityType: 'KHO_ONLINE',
      entityId: `${b.channel}:${sku}`,
      after: { from_sku: fromSku, variant },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  const days = await daysOfSku(c.env.DB, b.channel, [sku]);
  for (const d of days) await recomputeDay(c.env.DB, b.channel, d);
  return ok(c, { rows: src.rows.length, recomputed_days: days.length });
});

/**
 * Nạp chi tiết đơn đã gửi từ Sheet kế toán kho (tab "Đơn đã gửi") cho những ngày Poscake không tin được
 * (TikTok trước 13/10). Mỗi ngày được thay nguyên; số hàng lẻ tính lại theo bảng quy đổi của web.
 */
khoRoutes.post('/online/lines', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới nạp số');
  const b = (await c.req.json().catch(() => null)) as { channel?: unknown; days?: unknown } | null;
  if (!isPosChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const days = Array.isArray(b?.days) ? (b.days as Array<{ day?: unknown; lines?: unknown }>) : [];
  if (!days.length || days.length > 40) throw badRequest('BAD_DAYS', 'Mỗi lần nạp từ 1 đến 40 ngày');
  const db = c.env.DB;
  const out: Array<{ day: string; orders: number; lines: number }> = [];
  for (const d of days) {
    if (!isDate(d.day)) continue;
    const L = (Array.isArray(d.lines) ? d.lines : []) as Array<Record<string, unknown>>;
    const stmts: D1PreparedStatement[] = [
      db.prepare('DELETE FROM channel_order_lines WHERE channel = ? AND day = ?').bind(b.channel, d.day),
    ];
    const counter = new Map<string, number>();
    for (const l of L) {
      const oid = String(l.order_id ?? '').trim();
      const qty = Number(l.qty);
      if (!oid || !(qty > 0)) continue;
      const n = (counter.get(oid) ?? 0) + 1;
      counter.set(oid, n);
      stmts.push(
        db
          .prepare(
            `INSERT INTO channel_order_lines (channel, order_id, line_no, day, shipped_at, shop, sku, variant, name, qty)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (channel, order_id, line_no) DO UPDATE SET day = excluded.day, shipped_at = excluded.shipped_at,
               shop = excluded.shop, sku = excluded.sku, variant = excluded.variant, name = excluded.name, qty = excluded.qty`,
          )
          .bind(b.channel, oid, n, d.day, String(l.shipped_at ?? ''), String(l.shop ?? ''), String(l.sku ?? '').trim(), String(l.variant ?? '').trim(), String(l.name ?? '').trim(), qty),
      );
    }
    for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
    const r = await recomputeDay(db, b.channel, d.day, 'SHEET');
    out.push({ day: d.day, orders: r.orders, lines: counter.size });
  }
  return ok(c, out);
});

/** Nạp cả bảng quy đổi (dán từ tab "Quy đổi combo" của Sheet cũ). Thay toàn bộ bảng của kênh. */
khoRoutes.put('/online/map', async (c) => {
  const auth = c.get('auth');
  if (!canEditMap(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán mới nạp bảng quy đổi');
  const b = (await c.req.json().catch(() => null)) as { channel?: unknown; rows?: unknown } | null;
  if (!isPosChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const rows = Array.isArray(b?.rows) ? (b.rows as Array<Record<string, unknown>>) : [];
  if (rows.length === 0 || rows.length > 3000) throw badRequest('BAD_ROWS', 'Bảng quy đổi trống hoặc quá lớn');
  const now = nowIso();
  const stmts = [c.env.DB.prepare("DELETE FROM channel_map WHERE channel = ? AND from_day = ''").bind(b.channel)];
  const seen = new Set<string>();
  for (const r of rows) {
    const sku = String(r.sku ?? '').trim();
    const variant = String(r.variant ?? '').trim();
    const label = String(r.item_label ?? '').trim();
    const qty = num(r.qty ?? 1);
    if (!sku || !label || !(qty > 0)) continue;
    const key = `${sku}|${variant}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    stmts.push(
      c.env.DB
        .prepare("INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, note, updated_by, updated_at) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)")
        .bind(b.channel, sku, variant, label, qty, String(r.note ?? ''), auth.user.id, now),
    );
  }
  for (let i = 0; i < stmts.length; i += 80) await c.env.DB.batch(stmts.slice(i, i + 80));
  const days = await recomputeAll(c.env.DB, b.channel);
  return ok(c, { rows: seen.size, recomputed_days: days });
});

/**
 * Đối chiếu quy đổi: mỗi dòng hàng trên đơn sàn (mã SKU + phân loại) được tính ra những mã vật tư nào.
 * Để kế toán nhìn từng dòng và tự kiểm xem quy đổi có đúng không; kèm cờ "nghi ngờ" cho dòng có vẻ là combo
 * nhưng chỉ quy ra 1 sản phẩm lẻ, hoặc quy ra đúng 1 mà số lượng bằng 1.
 */
khoRoutes.get('/online/recon', async (c) => {
  const channel = c.req.query('channel');
  if (!isPosChannel(channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const span = Math.min(Math.max(Math.floor(Number(c.req.query('days') ?? 14)) || 14, 1), 90);
  const last = await c.env.DB
    .prepare('SELECT MAX(day) AS d FROM channel_order_lines WHERE channel = ?')
    .bind(channel)
    .first<{ d: string | null }>();
  if (!last?.d) return ok(c, { from: null, to: null, orders: 0, raw_qty: 0, out_qty: 0, unmapped_qty: 0, rows: [] });
  // Xem một ngày cụ thể (để đối chiếu từng ngày với màn hình Poscake / Sheet) hoặc N ngày gần nhất.
  const oneDay = c.req.query('day');
  const end = isDate(oneDay) ? oneDay : last.d;
  const sp = isDate(oneDay) ? 1 : span;
  const map = await loadMapVersions(c.env.DB, channel);
  const items = new Map(
    ((await c.env.DB.prepare('SELECT code, name FROM kho_items').all<{ code: string; name: string }>()).results ?? []).map((r) => [
      r.code.toLowerCase(),
      r,
    ]),
  );
  const rows = await c.env.DB
    .prepare(
      `SELECT sku, variant, day, MIN(name) AS name, ROUND(SUM(qty), 3) AS qty, COUNT(DISTINCT order_id) AS orders
       FROM channel_order_lines
       WHERE channel = ? AND day <= ? AND day > date(?, '-' || ? || ' days')
       GROUP BY sku, variant, day`,
    )
    .bind(channel, end, end, sp)
    .all<{ sku: string; variant: string; day: string; name: string; qty: number; orders: number }>();
  const ord = await c.env.DB
    .prepare(
      `SELECT COUNT(DISTINCT order_id) AS n FROM channel_order_lines
       WHERE channel = ? AND day <= ? AND day > date(?, '-' || ? || ' days')`,
    )
    .bind(channel, end, end, sp)
    .first<{ n: number }>();
  let rawQty = 0;
  let outQty = 0;
  let unmapped = 0;
  // Gộp theo (mã bán, phân loại, bản quy đổi): combo đổi thành phần giữa kỳ sẽ hiện thành hai dòng.
  const agg = new Map<
    string,
    {
      sku: string;
      variant: string;
      name: string;
      qty: number;
      orders: number;
      rule: 'MAP' | 'DIRECT' | 'NONE';
      from_day: string | null;
      to: Array<{ label: string; qty: number }>;
      first: string;
      last: string;
      byDay: Record<string, number>;
    }
  >();
  for (const r of rows.results ?? []) {
    const ver = pickMap(map, r.sku, r.variant, r.day);
    const direct = items.get(r.sku.toLowerCase());
    let rule: 'MAP' | 'DIRECT' | 'NONE';
    let to: Array<{ label: string; qty: number }> = [];
    if (ver) {
      rule = 'MAP';
      to = ver.rows.map((x) => ({ label: x.item_label, qty: x.qty }));
    } else if (direct) {
      rule = 'DIRECT';
      to = [{ label: `${direct.code} - ${direct.name}`, qty: 1 }];
    } else rule = 'NONE';
    const key = `${r.sku}|${r.variant}|${rule}|${ver?.from_day ?? ""}`;
    const a = agg.get(key);
    if (a) {
      a.qty += r.qty;
      a.orders += r.orders;
      if (r.day < a.first) a.first = r.day;
      if (r.day > a.last) a.last = r.day;
      a.byDay[r.day] = (a.byDay[r.day] ?? 0) + r.qty;
    } else {
      agg.set(key, {
        sku: r.sku,
        variant: r.variant,
        name: r.name,
        qty: r.qty,
        orders: r.orders,
        rule,
        from_day: ver ? ver.from_day : null,
        to,
        first: r.day,
        last: r.day,
        byDay: { [r.day]: r.qty },
      });
    }
  }
  const out = [...agg.values()]
    .sort((a, b) => b.qty - a.qty)
    .map((r) => {
      const skip = r.to.length > 0 && r.to.every((x) => x.label.trim().toUpperCase() === 'BỎ QUA');
      const per = r.to.filter((x) => x.label.trim().toUpperCase() !== 'BỎ QUA').reduce((s, x) => s + x.qty, 0);
      rawQty += r.qty;
      if (r.rule === 'NONE') unmapped += r.qty;
      else outQty += r.qty * per;
      const text = `${r.name} ${r.variant}`.toLowerCase();
      const looksCombo = /combo|\bx\s?[2-9]\b|\b[2-9]\s?(chai|hộp|gói|cái|lọ|bộ)|\+/.test(text);
      const flags: string[] = [];
      if (r.rule === 'NONE') flags.push('Chưa quy đổi');
      if (skip) flags.push('Đang bỏ qua (không trừ kho)');
      if (r.rule !== 'NONE' && !skip && looksCombo && per <= 1) flags.push('Tên giống combo nhưng chỉ ra 1 sản phẩm');
      return {
        sku: r.sku,
        variant: r.variant,
        name: r.name,
        qty: r.qty,
        orders: r.orders,
        rule: r.rule,
        from_day: r.from_day,
        first: r.first,
        last: r.last,
        by_day: r.byDay,
        to: r.to,
        per,
        out: r.rule === 'NONE' ? 0 : r.qty * per,
        flags,
      };
    });
  // Bảng theo mã vật tư × ngày, kèm "đến từ đâu" để lần ngược khi số nhìn không đúng.
  const dayList = new Set<string>();
  const itemMap = new Map<
    string,
    {
      label: string;
      total: number;
      unmapped: boolean;
      by_day: Record<string, number>;
      from: Array<{ sku: string; variant: string; name: string; sold: number; per: number; out: number; from_day: string | null }>;
    }
  >();
  for (const r of agg.values()) {
    for (const d of Object.keys(r.byDay)) dayList.add(d);
    const parts =
      r.rule === 'NONE'
        ? [{ label: unmappedLabel(r.sku, r.variant), qty: 1, un: true }]
        : r.to.filter((x) => x.label.trim().toUpperCase() !== 'BỎ QUA').map((x) => ({ label: x.label, qty: x.qty, un: false }));
    for (const p of parts) {
      // Gộp theo mã vật tư (nhãn có thể viết "MÃ" hoặc "MÃ - Tên").
      const head = p.label.split(' - ')[0]!.trim().toLowerCase();
      const known = p.un ? undefined : items.get(head);
      const ikey = known ? known.code : p.label;
      let it = itemMap.get(ikey);
      if (!it) {
        it = { label: known ? `${known.code} - ${known.name}` : p.label, total: 0, unmapped: p.un, by_day: {}, from: [] };
        itemMap.set(ikey, it);
      }
      let s = 0;
      for (const [d, q] of Object.entries(r.byDay)) {
        it.by_day[d] = (it.by_day[d] ?? 0) + q * p.qty;
        s += q * p.qty;
      }
      it.total += s;
      it.from.push({ sku: r.sku, variant: r.variant, name: r.name, sold: r.qty, per: p.qty, out: s, from_day: r.from_day });
    }
  }
  const itemRows = [...itemMap.values()].sort((a, b) => Number(a.unmapped) - Number(b.unmapped) || b.total - a.total);
  const from = await c.env.DB.prepare("SELECT date(?, '-' || ? || ' days', '+1 day') AS d").bind(end, sp).first<{ d: string }>();
  return ok(c, {
    from: from?.d ?? null,
    to: end,
    orders: ord?.n ?? 0,
    raw_qty: Math.round(rawQty * 1000) / 1000,
    out_qty: Math.round(outQty * 1000) / 1000,
    unmapped_qty: Math.round(unmapped * 1000) / 1000,
    days: [...dayList].sort(),
    items: itemRows,
    rows: out,
  });
});

/** Danh sách đơn của một mã sàn trong kỳ: để lần tới từng đơn và so với màn hình Poscake. */
khoRoutes.get('/online/orders', async (c) => {
  const channel = c.req.query('channel');
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!isPosChannel(channel) || !isDate(from) || !isDate(to)) throw badRequest('BAD_PARAMS', 'Cần kênh và khoảng ngày');
  const rows = await c.env.DB
    .prepare(
      `SELECT order_id, day, shipped_at, shop, ROUND(SUM(qty), 3) AS qty FROM channel_order_lines
       WHERE channel = ? AND sku = ? AND variant = ? AND day >= ? AND day <= ?
       GROUP BY order_id, day, shipped_at, shop ORDER BY day, shipped_at LIMIT 1000`,
    )
    .bind(channel, String(c.req.query('sku') ?? ''), String(c.req.query('variant') ?? ''), from, to)
    .all<Record<string, unknown>>();
  return ok(c, rows.results ?? []);
});

/**
 * Xem như Sheet kế toán kho cũ (cùng tên tab, cùng cột): Đơn đã gửi, Số đơn theo ngày, Hàng lẻ theo ngày, Mã cần bổ sung.
 * Tính y như Apps Script cũ: mỗi dòng đơn tra bảng quy đổi (SKU + phân loại, rồi SKU), chưa có thì ghi "[Chưa quy đổi]".
 */
khoRoutes.get('/online/sheet', async (c) => {
  const channel = c.req.query('channel');
  if (!isPosChannel(channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const span = Math.min(Math.max(Math.floor(Number(c.req.query('days') ?? 7)) || 7, 1), 60);
  const db = c.env.DB;
  const last = await db
    .prepare('SELECT MAX(d) AS d FROM (SELECT MAX(day) AS d FROM channel_order_lines WHERE channel = ? UNION ALL SELECT MAX(day) FROM channel_runs WHERE channel = ?)')
    .bind(channel, channel)
    .first<{ d: string | null }>();
  const startDay = await poscakeFrom(db, channel);
  if (!last?.d) return ok(c, { from: null, to: null, start_day: startDay, lines: [], orders: [], daily: [], missing: [] });
  const oneDay = c.req.query('day');
  // Chọn khoảng ngày tự do (từ - đến), tối đa 92 ngày; không chọn thì lấy N ngày gần nhất như cũ.
  const qFrom = c.req.query('from');
  const qTo = c.req.query('to');
  const ranged = isDate(qFrom) && isDate(qTo) && qFrom <= qTo;
  const end = ranged ? qTo : isDate(oneDay) ? oneDay : last.d;
  const spRange = ranged
    ? ((await db.prepare("SELECT CAST(julianday(?) - julianday(?) AS INTEGER) + 1 AS n").bind(qTo, qFrom).first<{ n: number }>())?.n ?? 1)
    : 0;
  const sp = ranged ? Math.min(Math.max(spRange, 1), 92) : isDate(oneDay) ? 1 : span;
  const fromRow = await db.prepare("SELECT date(?, '-' || ? || ' days', '+1 day') AS d").bind(end, sp).first<{ d: string }>();
  const from = fromRow?.d ?? end;
  const rows = await db
    .prepare(
      `SELECT day, shipped_at, shop, order_id, sku, variant, name, qty FROM channel_order_lines
       WHERE channel = ? AND day >= ? AND day <= ? ORDER BY day, shipped_at, order_id, line_no`,
    )
    .bind(channel, from, end)
    .all<{ day: string; shipped_at: string; shop: string; order_id: string; sku: string; variant: string; name: string; qty: number }>();
  const map = await loadMapVersions(db, channel);
  const items = new Map(
    ((await db.prepare('SELECT code, name FROM kho_items').all<{ code: string; name: string }>()).results ?? []).map((r) => [
      r.code.toLowerCase(),
      r,
    ]),
  );
  const lk = await loadLookups(db);
  const ord = new Map<string, { day: string; shop: string; orders: Set<string>; qty: number }>();
  const daily = new Map<string, { day: string; shop: string; item: string; qty: number; orders: Set<string> }>();
  const missing = new Map<string, { sku: string; variant: string; name: string; first: string; qty: number }>();
  for (const r of rows.results ?? []) {
    const ok1 = `${r.day}|${r.shop}`;
    const o = ord.get(ok1) ?? { day: r.day, shop: r.shop, orders: new Set<string>(), qty: 0 };
    o.orders.add(r.order_id);
    o.qty += r.qty;
    ord.set(ok1, o);
    const ver = pickMap(map, r.sku, r.variant, r.day);
    const direct = items.get(r.sku.toLowerCase());
    let parts: Array<{ item: string; qty: number }>;
    if (ver) parts = ver.rows.map((x) => ({ item: x.item_label, qty: x.qty }));
    else if (direct) parts = [{ item: `${direct.code} - ${direct.name}`, qty: 1 }];
    else {
      const mk = `${r.sku}|${r.variant}`;
      const m = missing.get(mk) ?? { sku: r.sku, variant: r.variant, name: r.name, first: r.day, qty: 0 };
      m.qty += r.qty;
      if (r.day < m.first) m.first = r.day;
      missing.set(mk, m);
      parts = [{ item: unmappedLabel(r.sku, r.variant), qty: 1 }];
    }
    for (const p of parts) {
      if (p.item.trim().toUpperCase() === 'BỎ QUA') continue;
      // Quy mọi nhãn về mã MISA + tên theo Danh mục kho (gộp các cách viết khác nhau của cùng một mã).
      const code = resolveLabel(p.item, lk);
      const label = code ? `${code} - ${items.get(code.toLowerCase())?.name ?? ''}` : p.item;
      const dk = `${r.day}|${r.shop}|${label}`;
      const d = daily.get(dk) ?? { day: r.day, shop: r.shop, item: label, qty: 0, orders: new Set<string>() };
      d.qty += r.qty * p.qty;
      d.orders.add(r.order_id);
      daily.set(dk, d);
    }
  }
  const lineDays = new Set((rows.results ?? []).map((r) => r.day));
  const sheetRuns = (
    await db
      .prepare("SELECT day, orders FROM channel_runs WHERE channel = ? AND day >= ? AND day <= ? AND source <> 'POSCAKE'")
      .bind(channel, from, end)
      .all<{ day: string; orders: number | null }>()
  ).results ?? [];
  const sheetDays: string[] = [];
  for (const r of sheetRuns) {
    if (lineDays.has(r.day)) continue;
    sheetDays.push(r.day);
    ord.set(`${r.day}|(theo Sheet)`, { day: r.day, shop: '(theo Sheet)', orders: new Set(Array.from({ length: r.orders ?? 0 }, (_, i) => String(i))), qty: 0 });
  }
  if (sheetDays.length) {
    const marks = sheetDays.map(() => '?').join(',');
    const outs = (
      await db.prepare(`SELECT day, item, qty FROM channel_out WHERE channel = ? AND day IN (${marks})`).bind(channel, ...sheetDays).all<{ day: string; item: string; qty: number }>()
    ).results ?? [];
    const uns = (
      await db.prepare(`SELECT day, label, qty FROM channel_unmapped WHERE channel = ? AND day IN (${marks})`).bind(channel, ...sheetDays).all<{ day: string; label: string; qty: number }>()
    ).results ?? [];
    for (const o of outs) {
      const label = `${o.item} - ${items.get(o.item.toLowerCase())?.name ?? ''}`;
      daily.set(`${o.day}|(theo Sheet)|${label}`, { day: o.day, shop: '(theo Sheet)', item: label, qty: o.qty, orders: new Set<string>() });
    }
    for (const u of uns) daily.set(`${u.day}|(theo Sheet)|${u.label}`, { day: u.day, shop: '(theo Sheet)', item: u.label, qty: u.qty, orders: new Set<string>() });
    for (const d of sheetDays) {
      const o = ord.get(`${d}|(theo Sheet)`);
      if (o) o.qty = [...daily.values()].filter((x) => x.day === d && x.shop === '(theo Sheet)').reduce((s, x) => s + x.qty, 0);
    }
  }
  const byDayShop = (a: { day: string; shop: string }, b: { day: string; shop: string }) =>
    a.day.localeCompare(b.day) || a.shop.localeCompare(b.shop);
  return ok(c, {
    from,
    to: end,
    start_day: startDay,
    sheet_days: sheetDays,
    lines: rows.results ?? [],
    orders: [...ord.values()].sort(byDayShop).map((o) => ({ day: o.day, shop: o.shop, orders: o.orders.size, qty: o.qty })),
    daily: [...daily.values()]
      .sort((a, b) => byDayShop(a, b) || a.item.localeCompare(b.item))
      .map((d) => ({ day: d.day, shop: d.shop, item: d.item, qty: d.qty, orders: d.orders.size })),
    missing: [...missing.values()].sort((a, b) => b.qty - a.qty),
  });
});

khoRoutes.get('/online/probe-customer', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO chẩn đoán nguồn Poscake');
  const channel = c.req.query('channel');
  const day = c.req.query('day');
  if (!isSrcChannel(channel) || !isDate(day)) throw badRequest('BAD_PARAMS', 'Cần kênh và ngày');
  return ok(c, await probeCustomerFields(c.env.DB, c.env.INGEST_KEY, channel, day, httpFetch));
});

/** Đơn NPP đã duyệt, đang chờ kế toán kho xuất hàng: hiện ở Sản xuất & kho để in phiếu xuất kho và ghi số thực xuất. */
khoRoutes.get('/b2b-pending', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth) && !auth.permissions.includes('order.kho.process') && !auth.permissions.includes('sx.kiemke')) {
    throw forbidden('Chỉ kế toán kho xem được đơn chờ xuất');
  }
  const orders = await c.env.DB
    .prepare(
      `SELECT o.id, o.order_no, o.order_date, o.need_date, o.ship_date, o.kho_note, o.approved_at, o.flow_on, c.name AS customer_name,
              u.display_name AS owner_name
       FROM orders o JOIN customers c ON c.id = o.customer_id LEFT JOIN users u ON u.id = o.owner_id
       WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
         AND ((o.flow_on = 1 AND o.kho_status = 'CHO_XUAT') OR (o.flow_on = 0 AND o.delivery_status = 'CHUA_XUAT'))
       ORDER BY COALESCE(o.ship_date, o.need_date, substr(o.approved_at, 1, 10), o.order_date), o.order_no LIMIT 200`,
    )
    .all<Record<string, unknown> & { id: string }>();
  return ok(c, await withOrderLines(c.env.DB, orders.results));
});

/** Đơn NPP đã xuất kho trong một khoảng ngày (theo giờ Việt Nam): để xem lại và in lại phiếu xuất kho. */
khoRoutes.get('/b2b-shipped', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth) && !auth.permissions.includes('order.kho.process') && !auth.permissions.includes('sx.kiemke')) {
    throw forbidden('Chỉ kế toán kho xem được đơn đã xuất');
  }
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  if (!isDate(from) || !isDate(to)) throw badRequest('BAD_PARAMS', 'Cần từ ngày và đến ngày');
  const orders = await c.env.DB
    .prepare(
      `SELECT o.id, o.order_no, o.order_date, o.need_date, o.ship_date, o.delivered_at, o.shipped_by_name, o.flow_on, o.delivery_status,
              date(o.delivered_at, '+7 hours') AS shipped_day, c.name AS customer_name, u.display_name AS owner_name
       FROM orders o JOIN customers c ON c.id = o.customer_id LEFT JOIN users u ON u.id = o.owner_id
       WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND o.delivery_status IN ('DA_XUAT_KHO', 'DA_GIAO')
         AND o.delivered_at IS NOT NULL AND date(o.delivered_at, '+7 hours') >= ? AND date(o.delivered_at, '+7 hours') <= ?
       ORDER BY o.delivered_at DESC, o.order_no LIMIT 300`,
    )
    .bind(from, to)
    .all<Record<string, unknown> & { id: string }>();
  return ok(c, await withOrderLines(c.env.DB, orders.results));
});

async function withOrderLines(db: D1Database, orders: Array<Record<string, unknown> & { id: string }>) {
  const ids = orders.map((o) => o.id);
  const lines: Array<Record<string, unknown> & { order_id: string }> = [];
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    const r = await db
      .prepare(
        `SELECT oi.order_id, oi.product_id, p.sku, p.name, p.unit, oi.qty, oi.is_gift
         FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id IN (${part.map(() => '?').join(',')}) ORDER BY oi.order_id, oi.created_at, oi.rowid`,
      )
      .bind(...part)
      .all<Record<string, unknown> & { order_id: string }>();
    lines.push(...r.results);
  }
  return orders.map((o) => ({ ...o, lines: lines.filter((l) => l.order_id === o.id) }));
}

/** Chẩn đoán số kéo về (CEO): mỗi trạng thái Poscake có bao nhiêu đơn cập nhật trong ngày + đơn mẫu. */
khoRoutes.get('/online/probe', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO chẩn đoán nguồn Poscake');
  const channel = c.req.query('channel');
  const day = c.req.query('day');
  if (!isSrcChannel(channel) || !isDate(day)) throw badRequest('BAD_PARAMS', 'Cần kênh và ngày');
  return ok(c, await probeChannelDay(c.env.DB, c.env.INGEST_KEY, channel, day, httpFetch));
});

/** Chẩn đoán (CEO): Pancake chia số bán hàng Facebook theo người xử lý đơn bằng loại người nào. */
khoRoutes.get('/online/probe-sale', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO chẩn đoán nguồn Pancake');
  const day = c.req.query('day');
  if (!isDate(day)) throw badRequest('BAD_PARAMS', 'Cần ngày');
  return ok(c, await probeSaleSplit(c.env.DB, c.env.INGEST_KEY, day, httpFetch));
});

/** Chạy bù số bán hàng Facebook theo người (CEO): từ ngày đến ngày, tối đa 25 ngày mỗi lần. */
khoRoutes.post('/online/sale-sync', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO chạy bù số Pancake');
  const b = (await c.req.json().catch(() => ({}))) as { from?: string; to?: string };
  if (!isDate(b.from) || !isDate(b.to) || b.to < b.from) throw badRequest('BAD_PARAMS', 'Cần từ ngày và đến ngày');
  const days: string[] = [];
  for (let t = Date.parse(`${b.from}T00:00:00Z`); t <= Date.parse(`${b.to}T00:00:00Z`) && days.length < 26; t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
  if (days.length > 25) throw badRequest('TOO_MANY', 'Tối đa 25 ngày mỗi lần');
  return ok(c, await syncFbSaleDays(c.env.DB, c.env.INGEST_KEY, days, httpFetch));
});

/** Chẩn đoán (CEO): thử tham số analytics/sale. extra=ten:gia_tri,ten:gia_tri (chỉ cho phép vài tham số an toàn). */
khoRoutes.get('/online/probe-sale2', async (c) => {
  const auth = c.get('auth');
  if (!isCeo(auth)) throw forbidden('Chỉ CEO chẩn đoán nguồn Pancake');
  const day = c.req.query('day');
  if (!isDate(day)) throw badRequest('BAD_PARAMS', 'Cần ngày');
  const allow = new Set(['success_status', 'success_record', 'returned_record', 'date_type', 'record_type', 'order_status']);
  const extra: Record<string, string> = {};
  for (const part of (c.req.query('extra') ?? '').split(',')) {
    const [k, v] = part.split(':');
    if (k && v && allow.has(k)) extra[k] = v;
  }
  return ok(c, await probeSaleExtra(c.env.DB, c.env.INGEST_KEY, day, extra, httpFetch));
});

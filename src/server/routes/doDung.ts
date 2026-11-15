/**
 * ĐỒ DÙNG VĂN PHÒNG & NHÀ MÁY (chị Hoa duyệt demo 11/11/2026). Giao diện: hub/src/dodung.js. Luật thuần: services/doDung.ts.
 * - HCNS quản lý (phòng HCNS / quyền quản lý nhân sự / quyền "dodung.quanly" ở web chung) và CEO.
 * - Phiếu lấy đồ: ký mượn / trả bằng bấm xác nhận trên web (HCNS giao, người lấy bấm "Đã nhận"; người lấy khai trả, HCNS nhận lại).
 * - Hàng mẫu: Lead phòng duyệt → kho thành phẩm lập phiếu xuất kho thật (XK, ref_no = mã yêu cầu, ở routes/kho.ts) → HCNS nhận về.
 * - Đề nghị mua: Lead phòng → Quản lý mua hàng duyệt → mua về: nhập tồn; trình duyệt ghi phiếu chi nháp vào Sổ chi phí (pc_id).
 */
import { flowAdvance, flowGate, type GateRow } from '../services/flowGate';
import { Hono } from 'hono';
import { nowIso, vnDate } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, conflict, forbidden, notFound, ok } from '../lib/http';
import { bellTo } from '../lib/hubBell';
import { unpack } from '../lib/pack';
import { approverIds } from '../lib/notifyTasks';
import { requirePermission } from '../middleware/rbac';
import { loadMembers, type Members } from '../services/daoTao';
import {
  DD_NOI, isLoai, isNoi, leadsOf, maMoi, mauDau, muaDau, muaSauLead, muonTra, quaHan, soPhieu, traDong, kkChenh, type Loai, type Noi,
} from '../services/doDung';

export const doDungRoutes = new Hono<AppEnv>();
doDungRoutes.use('*', requirePermission('hub.access'));

const str = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN);
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const nowVn = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16);
const idNew = () => 'dd' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

type HubUser = { crm?: string; perms?: string[]; active?: boolean };
async function hubPerms(db: D1Database, crm: string): Promise<string[]> {
  try {
    const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
    const u = row ? ((JSON.parse(await unpack(row.data)) as { users?: HubUser[] }).users ?? []).find((x) => x.crm === crm && x.active !== false) : null;
    return u?.perms ?? [];
  } catch {
    return [];
  }
}

export type DdViewer = { id: string; name: string; pb: string; ceo: boolean; hr: boolean; lead: boolean; kho: boolean; ql: boolean; m: Members };
async function viewer(db: D1Database, auth: AuthContext): Promise<DdViewer> {
  const [m, hp] = await Promise.all([loadMembers(db, auth.user.id), hubPerms(db, auth.user.id)]);
  const me = m.users[auth.user.id];
  const ceo = auth.user.role === 'CEO' || me?.role === 'admin';
  const P = auth.permissions;
  return {
    id: auth.user.id,
    name: me?.name || auth.user.display_name,
    pb: me?.pb ?? '',
    ceo,
    hr: ceo || !!me?.hr || hp.includes('dodung.quanly'),
    lead: !!me && ['lead', 'truongphong'].includes(me.role) && !!me.pb,
    kho: ceo || P.includes('sx.kiemke') || hp.includes('sx.kiemke'),
    // Quản lý mua hàng: cùng điều kiện "quản lý mua hàng" của Mua hàng (routes/purchasing.ts canManage) trừ kế toán.
    ql: ceo || P.includes('order.approve.normal'),
    m,
  };
}
const needHr = (v: DdViewer) => {
  if (!v.hr) throw forbidden('Chỉ HCNS hoặc CEO làm việc này');
};

/* -------- Người nhận chuông -------- */
const hrIds = (m: Members) => {
  const L = Object.entries(m.users).filter(([, u]) => u.hr && u.role !== 'admin').map(([id]) => id);
  return L.length ? L : Object.entries(m.users).filter(([, u]) => u.role === 'admin').map(([id]) => id);
};
async function khoIds(db: D1Database): Promise<string[]> {
  const r = await db.prepare("SELECT DISTINCT user_id AS id FROM user_permissions WHERE permission = 'sx.kiemke'").all<{ id: string }>();
  return (r.results ?? []).map((x) => x.id);
}
async function qlIds(db: D1Database): Promise<string[]> {
  const all = await approverIds(db);
  const ceo = new Set(((await db.prepare("SELECT id FROM users WHERE role = 'CEO'").all<{ id: string }>()).results ?? []).map((x) => x.id));
  const L = all.filter((x) => !ceo.has(x));
  return L.length ? L : all;
}
const bell = (db: D1Database, ids: string[], me: string, text: string, page: string) =>
  bellTo(db, ids.filter((x) => x && x !== me), text, 'page:' + page).catch(() => 0);

/* -------- Tồn -------- */
type ItemRow = { id: string; ma: string; ten: string; loai: Loai; dvt: string; kho_code: string | null; ts_ma: string | null; gia: number; min_vp: number; min_nm: number; cho_vp: string; cho_nm: string; active: number; ghi_chu: string };
async function tonMap(db: D1Database): Promise<Map<string, number>> {
  const r = await db.prepare('SELECT item_id, noi, ROUND(SUM(qty), 6) AS q FROM dd_move GROUP BY item_id, noi').all<{ item_id: string; noi: string; q: number }>();
  return new Map((r.results ?? []).map((x) => [x.item_id + '|' + x.noi, x.q]));
}
const tonOf = (T: Map<string, number>, item: string, noi: string) => T.get(item + '|' + noi) ?? 0;

/* ================= Đọc tất cả (một lần cho mọi trang) ================= */
doDungRoutes.get('/all', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const [items, T, lay, lines, mau, mua] = await Promise.all([
    db.prepare('SELECT * FROM dd_item ORDER BY loai, ten').all<ItemRow>(),
    tonMap(db),
    db.prepare("SELECT * FROM dd_lay WHERE st IN ('cho','dang','tra_cho') OR created_at >= ? ORDER BY created_at DESC LIMIT 400").bind(new Date(Date.now() - 90 * 864e5).toISOString()).all<Record<string, unknown>>(),
    db.prepare("SELECT l.* FROM dd_lay_line l JOIN dd_lay p ON p.id = l.lay_id WHERE p.st IN ('cho','dang','tra_cho') OR p.created_at >= ?").bind(new Date(Date.now() - 90 * 864e5).toISOString()).all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM dd_mau WHERE st IN ('lead','kho') OR created_at >= ? ORDER BY created_at DESC LIMIT 400").bind(new Date(Date.now() - 120 * 864e5).toISOString()).all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM dd_mua WHERE st IN ('lead','ql','mua') OR created_at >= ? ORDER BY created_at DESC LIMIT 400").bind(new Date(Date.now() - 120 * 864e5).toISOString()).all<Record<string, unknown>>(),
  ]);
  // Phiếu xuất kho hàng mẫu (XK ref_no = mã yêu cầu) và tên hàng ở kho thành phẩm.
  const mauRows = mau.results ?? [];
  const refs = mauRows.map((x) => String(x.id));
  const xk = new Map<string, { doc_id: number; doc_no: string; doc_date: string; sl: number }>();
  for (let i = 0; i < refs.length; i += 80) {
    const part = refs.slice(i, i + 80);
    const r = await db
      .prepare(
        `SELECT d.ref_no, d.id, d.no, d.doc_date, -ROUND(SUM(m.qty), 6) AS sl FROM kho_docs d JOIN kho_moves m ON m.doc_id = d.id
         WHERE d.type = 'XK' AND d.status = 'OK' AND d.ref_no IN (${part.map(() => '?').join(',')}) GROUP BY d.id`,
      )
      .bind(...part)
      .all<{ ref_no: string; id: number; no: string; doc_date: string; sl: number }>();
    for (const x of r.results ?? []) {
      const o = xk.get(x.ref_no);
      if (o) o.sl = r6(o.sl + x.sl);
      else xk.set(x.ref_no, { doc_id: x.id, doc_no: x.no, doc_date: x.doc_date, sl: x.sl });
    }
  }
  const codes = [...new Set(mauRows.map((x) => String(x.kho_code)).concat((items.results ?? []).map((i) => i.kho_code ?? '').filter(Boolean)))];
  const ten = new Map<string, { name: string; unit: string }>();
  for (let i = 0; i < codes.length; i += 80) {
    const part = codes.slice(i, i + 80);
    const r = await db.prepare(`SELECT code, name, unit FROM kho_items WHERE code IN (${part.map(() => '?').join(',')})`).bind(...part).all<{ code: string; name: string; unit: string }>();
    for (const x of r.results ?? []) ten.set(x.code, { name: x.name, unit: x.unit });
  }
  const now = nowVn();
  const byLay = new Map<string, Record<string, unknown>[]>();
  for (const l of lines.results ?? []) (byLay.get(String(l.lay_id)) ?? byLay.set(String(l.lay_id), []).get(String(l.lay_id))!).push(l);
  return ok(c, {
    me: { id: v.id, name: v.name, pb: v.pb, ceo: v.ceo, hr: v.hr, lead: v.lead, kho: v.kho, ql: v.ql },
    noi: DD_NOI,
    items: (items.results ?? []).map((i) => ({ ...i, ton: { vp: tonOf(T, i.id, 'vp'), nm: tonOf(T, i.id, 'nm') } })),
    lay: (lay.results ?? []).map((p) => ({ ...p, lines: byLay.get(String(p.id)) ?? [], qua_han: ['dang', 'tra_cho'].includes(String(p.st)) && quaHan(p.han as string, now) })),
    mau: mauRows.map((x) => ({ ...x, kho_ten: ten.get(String(x.kho_code))?.name ?? '', kho_dvt: ten.get(String(x.kho_code))?.unit ?? '', xk: xk.get(String(x.id)) ?? null })),
    mua: mua.results ?? [],
  });
});

/** Lịch sử một món đồ (sổ đồ dùng). */
doDungRoutes.get('/item/:id', async (c) => {
  const r = await c.env.DB.prepare('SELECT * FROM dd_move WHERE item_id = ? ORDER BY ngay DESC, id DESC LIMIT 300').bind(c.req.param('id')).all();
  return ok(c, r.results ?? []);
});

/* ================= Danh mục ================= */
doDungRoutes.post('/item', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  needHr(v);
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const ten0 = str(b.ten, 200);
  const loai = b.loai;
  if (!isLoai(loai)) throw badRequest('BAD_LOAI', 'Chọn loại đồ');
  let kho = str(b.kho_code, 60) || null;
  let ten = ten0;
  let dvt = str(b.dvt, 20) || 'cái';
  if (loai === 'mau') {
    if (!kho) throw badRequest('NO_KHO_CODE', 'Hàng mẫu phải chọn mã kho thành phẩm');
    const k = await db.prepare('SELECT code, name, unit FROM kho_items WHERE code = ?').bind(kho).first<{ code: string; name: string; unit: string }>();
    if (!k) throw badRequest('BAD_KHO_CODE', 'Không có mã này ở kho thành phẩm');
    ten = ten || k.name;
    dvt = str(b.dvt, 20) || k.unit || dvt;
    kho = k.code;
    const da = await db.prepare('SELECT ma FROM dd_item WHERE kho_code = ?').bind(kho).first<{ ma: string }>();
    if (da) throw conflict('DA_CO', `Hàng mẫu này đã có trong danh mục (${da.ma})`);
  }
  if (!ten) throw badRequest('NO_TEN', 'Ghi tên đồ');
  const all = ((await db.prepare('SELECT ma FROM dd_item').all<{ ma: string }>()).results ?? []).map((x) => x.ma);
  let ma = str(b.ma, 40) || (loai === 'mau' && kho ? kho : maMoi(loai, all));
  if (all.includes(ma)) {
    if (str(b.ma, 40)) throw conflict('MA_TRUNG', 'Mã đã có');
    ma = maMoi(loai, all);
  }
  const now = nowIso();
  const id = idNew();
  const ngay = vnDate();
  const st: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO dd_item (id, ma, ten, loai, dvt, kho_code, ts_ma, gia, min_vp, min_nm, cho_vp, cho_nm, active, ghi_chu, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      )
      .bind(id, ma, ten, loai, dvt, kho, str(b.ts_ma, 40) || null, Math.max(0, Math.round(num(b.gia) || 0)), Math.max(0, num(b.min_vp) || 0), Math.max(0, num(b.min_nm) || 0),
        str(b.cho_vp, 120), str(b.cho_nm, 120), str(b.ghi_chu), v.id, now, now),
  ];
  for (const n of ['vp', 'nm'] as Noi[]) {
    const q = num(b['ton_' + n]);
    if (Number.isFinite(q) && q > 0)
      st.push(db.prepare("INSERT INTO dd_move (item_id, noi, qty, kind, ref, ngay, note, by_id, by_name, created_at) VALUES (?, ?, ?, 'dau', NULL, ?, 'Khai báo khi thêm', ?, ?, ?)").bind(id, n, r6(q), ngay, v.id, v.name, now));
  }
  await db.batch(st);
  return ok(c, { id, ma });
});

doDungRoutes.patch('/item/:id', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  needHr(v);
  const id = c.req.param('id');
  const it = await db.prepare('SELECT * FROM dd_item WHERE id = ?').bind(id).first<ItemRow>();
  if (!it) throw notFound('Không có đồ này');
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const pick = <T>(k: string, f: (x: unknown) => T, d: T) => (k in b ? f(b[k]) : d);
  await db
    .prepare('UPDATE dd_item SET ten = ?, dvt = ?, ts_ma = ?, gia = ?, min_vp = ?, min_nm = ?, cho_vp = ?, cho_nm = ?, active = ?, ghi_chu = ?, updated_at = ? WHERE id = ?')
    .bind(
      pick('ten', (x) => str(x, 200) || it.ten, it.ten), pick('dvt', (x) => str(x, 20) || it.dvt, it.dvt), pick('ts_ma', (x) => str(x, 40) || null, it.ts_ma),
      pick('gia', (x) => Math.max(0, Math.round(num(x) || 0)), it.gia), pick('min_vp', (x) => Math.max(0, num(x) || 0), it.min_vp), pick('min_nm', (x) => Math.max(0, num(x) || 0), it.min_nm),
      pick('cho_vp', (x) => str(x, 120), it.cho_vp), pick('cho_nm', (x) => str(x, 120), it.cho_nm), pick('active', (x) => (x === false || x === 0 ? 0 : 1), it.active),
      pick('ghi_chu', (x) => str(x), it.ghi_chu), nowIso(), id,
    )
    .run();
  return ok(c, { id });
});

/** Kiểm kê một nơi: chênh lệch so với sổ ghi thành dòng "kk" (đồ tiêu hao: chênh âm coi là đã dùng trong kỳ). */
doDungRoutes.post('/kk', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  needHr(v);
  const b = ((await c.req.json().catch(() => null)) ?? {}) as { noi?: unknown; ngay?: unknown; lines?: Array<{ item_id?: unknown; dem?: unknown; note?: unknown }> };
  if (!isNoi(b.noi)) throw badRequest('BAD_NOI', 'Chọn nơi kiểm kê');
  const ngay = isDate(b.ngay) ? b.ngay : vnDate();
  if (ngay > vnDate()) throw badRequest('BAD_DATE', 'Ngày kiểm không được sau hôm nay');
  const T = await tonMap(db);
  const now = nowIso();
  const ref = 'KK-' + ngay + '-' + b.noi;
  const st: D1PreparedStatement[] = [];
  for (const l of b.lines ?? []) {
    const dem = num(l.dem);
    if (!Number.isFinite(dem) || dem < 0) continue;
    const d = kkChenh(dem, tonOf(T, String(l.item_id), b.noi));
    if (!d) continue;
    st.push(db.prepare("INSERT INTO dd_move (item_id, noi, qty, kind, ref, ngay, note, by_id, by_name, created_at) VALUES (?, ?, ?, 'kk', ?, ?, ?, ?, ?, ?)").bind(String(l.item_id), b.noi, d, ref, ngay, str(l.note) || 'Kiểm kê', v.id, v.name, now));
  }
  if (st.length) await db.batch(st);
  return ok(c, { ref, chenh: st.length });
});

/** Báo hỏng / mất đồ đang nằm trên kệ (không qua phiếu lấy). */
doDungRoutes.post('/hong', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  needHr(v);
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (!isNoi(b.noi)) throw badRequest('BAD_NOI', 'Chọn nơi');
  const sl = num(b.sl);
  if (!(sl > 0)) throw badRequest('BAD_QTY', 'Số lượng không đúng');
  const ly = str(b.ly_do);
  if (!ly) throw badRequest('NO_REASON', 'Ghi lý do (hỏng gì, mất ở đâu)');
  const T = await tonMap(db);
  if (tonOf(T, String(b.item_id), b.noi) < sl - 1e-9) throw conflict('KHONG_DU', 'Trên kệ không có đủ số này');
  await db.prepare("INSERT INTO dd_move (item_id, noi, qty, kind, ref, ngay, note, by_id, by_name, created_at) VALUES (?, ?, ?, 'hong', NULL, ?, ?, ?, ?, ?)").bind(String(b.item_id), b.noi, -r6(sl), vnDate(), ly, v.id, v.name, nowIso()).run();
  return ok(c, { ok: true });
});

/* ================= Phiếu lấy đồ ================= */
type LayRow = { id: string; noi: Noi; user_id: string; user_name: string; st: string; han: string | null };
type LineRow = { id: number; lay_id: string; item_id: string; sl: number; tra: number | null; dung: number | null; tinh: string | null };
async function layGet(db: D1Database, id: string) {
  const p = await db.prepare('SELECT * FROM dd_lay WHERE id = ?').bind(id).first<LayRow>();
  if (!p) throw notFound('Không có phiếu này');
  const lines = ((await db.prepare('SELECT l.*, i.loai, i.ten FROM dd_lay_line l JOIN dd_item i ON i.id = l.item_id WHERE l.lay_id = ?').bind(id).all<LineRow & { loai: string; ten: string }>()).results ?? []);
  return { p, lines };
}
/** Giao đồ: trừ kệ của nơi lấy. Thiếu thì chặn. */
async function giaoStmts(db: D1Database, p: LayRow, lines: Array<LineRow & { ten: string }>, v: DdViewer, now: string) {
  const T = await tonMap(db);
  const need = new Map<string, number>();
  for (const l of lines) need.set(l.item_id, (need.get(l.item_id) ?? 0) + l.sl);
  for (const [it, q] of need) {
    const have = tonOf(T, it, p.noi);
    if (have < q - 1e-9) throw conflict('KHONG_DU', `${lines.find((l) => l.item_id === it)?.ten}: trên kệ ${DD_NOI[p.noi]} còn ${have}, phiếu cần ${q}`);
  }
  return lines.map((l) =>
    db.prepare("INSERT INTO dd_move (item_id, noi, qty, kind, ref, ngay, note, by_id, by_name, created_at) VALUES (?, ?, ?, 'giao', ?, ?, ?, ?, ?, ?)").bind(l.item_id, p.noi, -l.sl, p.id, vnDate(), 'Giao cho ' + p.user_name, v.id, v.name, now),
  );
}

doDungRoutes.post('/lay', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown> & { lines?: Array<{ item_id?: unknown; sl?: unknown }> };
  if (!isNoi(b.noi)) throw badRequest('BAD_NOI', 'Chọn lấy ở Văn phòng hay Nhà máy');
  const lines = (b.lines ?? []).map((l) => ({ item_id: str(l.item_id, 60), sl: num(l.sl) })).filter((l) => l.item_id);
  if (!lines.length) throw badRequest('NO_LINES', 'Chọn đồ cần lấy');
  if (lines.some((l) => !(l.sl > 0))) throw badRequest('BAD_QTY', 'Số lượng phải lớn hơn 0');
  const ids = [...new Set(lines.map((l) => l.item_id))];
  const items = new Map(((await db.prepare(`SELECT id, ten, loai, active FROM dd_item WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{ id: string; ten: string; loai: string; active: number }>()).results ?? []).map((x) => [x.id, x]));
  if (ids.some((x) => !items.get(x)?.active)) throw badRequest('BAD_ITEM', 'Có đồ không còn trong danh mục');
  // HCNS lập hộ người khác được; người thường chỉ lập cho mình.
  const uid = v.hr && str(b.user_id, 60) ? str(b.user_id, 60) : v.id;
  const uname = uid === v.id ? v.name : v.m.users[uid]?.name || str(b.user_name, 80) || uid;
  if (!str(b.shoot_id, 60) && !str(b.shoot_txt) && !str(b.muc_dich)) throw badRequest('NO_MUC_DICH', 'Chọn buổi quay hoặc ghi lấy để làm gì');
  const han = typeof b.han === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(b.han) ? b.han.slice(0, 16) : null;
  const ngay = vnDate();
  const all = ((await db.prepare('SELECT id FROM dd_lay WHERE id LIKE ?').bind('PL' + ngay.slice(2, 4) + ngay.slice(5, 7) + '-%').all<{ id: string }>()).results ?? []).map((x) => x.id);
  const id = soPhieu('PL', ngay, all);
  const now = nowIso();
  const giaoLuon = v.hr && b.giao === true;
  const p: LayRow = { id, noi: b.noi, user_id: uid, user_name: uname, st: giaoLuon ? 'dang' : 'cho', han };
  const st: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO dd_lay (id, noi, user_id, user_name, shoot_id, shoot_txt, muc_dich, han, st, giao_by, giao_name, giao_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, b.noi, uid, uname, str(b.shoot_id, 60) || null, str(b.shoot_txt, 200), str(b.muc_dich), han, p.st, giaoLuon ? v.id : null, giaoLuon ? v.name : null, giaoLuon ? now : null, now, now),
    ...lines.map((l) => db.prepare('INSERT INTO dd_lay_line (lay_id, item_id, sl) VALUES (?, ?, ?)').bind(id, l.item_id, r6(l.sl))),
  ];
  if (giaoLuon) st.push(...(await giaoStmts(db, p, lines.map((l, k) => ({ id: k, lay_id: id, item_id: l.item_id, sl: r6(l.sl), tra: null, dung: null, tinh: null, ten: items.get(l.item_id)!.ten })), v, now)));
  else {
    const T = await tonMap(db);
    for (const l of lines) if (tonOf(T, l.item_id, b.noi) < l.sl - 1e-9) throw conflict('KHONG_DU', `${items.get(l.item_id)?.ten}: trên kệ ${DD_NOI[b.noi]} còn ${tonOf(T, l.item_id, b.noi)}`);
  }
  await db.batch(st);
  if (!giaoLuon) await bell(db, hrIds(v.m), v.id, `${uname} xin lấy đồ (${id})${str(b.shoot_txt, 80) ? ' · ' + str(b.shoot_txt, 80) : ''}`, 'vp_lay');
  else await bell(db, [uid], v.id, `HCNS đã giao đồ phiếu ${id}. Bấm "Đã nhận" để ký nhận.`, 'vp_lay');
  return ok(c, { id, st: p.st });
});

doDungRoutes.post('/lay/:id/giao', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  needHr(v);
  const { p, lines } = await layGet(db, c.req.param('id'));
  if (p.st !== 'cho') throw conflict('SAI_BUOC', 'Phiếu không ở bước chờ giao');
  const now = nowIso();
  const st = await giaoStmts(db, p, lines, v, now);
  st.unshift(db.prepare("UPDATE dd_lay SET st = 'dang', giao_by = ?, giao_name = ?, giao_at = ?, updated_at = ? WHERE id = ? AND st = 'cho'").bind(v.id, v.name, now, now, p.id));
  await db.batch(st);
  await bell(db, [p.user_id], v.id, `HCNS đã giao đồ phiếu ${p.id}. Bấm "Đã nhận" để ký nhận.`, 'vp_lay');
  return ok(c, { id: p.id });
});

/** Người lấy ký nhận (bấm "Đã nhận đủ"). */
doDungRoutes.post('/lay/:id/ky', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const { p } = await layGet(db, c.req.param('id'));
  if (p.user_id !== v.id) throw forbidden('Chỉ người lấy ký nhận');
  if (p.st !== 'dang') throw conflict('SAI_BUOC', 'Phiếu chưa giao hoặc đã trả');
  await db.prepare('UPDATE dd_lay SET ky_nhan_at = COALESCE(ky_nhan_at, ?), updated_at = ? WHERE id = ?').bind(nowIso(), nowIso(), p.id).run();
  return ok(c, { id: p.id });
});

/** Trả đồ. Người lấy khai → chờ HCNS nhận lại; HCNS trả hộ / nhận lại → xong, cộng lại kệ. */
doDungRoutes.post('/lay/:id/tra', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const { p, lines } = await layGet(db, c.req.param('id'));
  const chu = p.user_id === v.id;
  if (!chu && !v.hr) throw forbidden('Chỉ người lấy hoặc HCNS ghi trả đồ');
  if (!['dang', 'tra_cho'].includes(p.st)) throw conflict('SAI_BUOC', 'Phiếu chưa giao hoặc đã trả xong');
  if (p.st === 'tra_cho' && !v.hr) throw conflict('DA_KHAI', 'Đã khai trả, chờ HCNS nhận lại');
  const b = ((await c.req.json().catch(() => null)) ?? {}) as { lines?: Array<{ id?: unknown; tra?: unknown; tinh?: unknown; note?: unknown }> };
  const got = new Map((b.lines ?? []).map((l) => [Number(l.id), l]));
  const kq = lines.map((l) => {
    const g = got.get(l.id);
    const tra = g ? num(g.tra) : l.tra ?? (muonTra(l.loai) ? l.sl : 0);
    const r = traDong(l.loai, l.sl, tra, str(g?.tinh ?? l.tinh ?? '', 20));
    if (r.err) throw badRequest('BAD_TRA', `${l.ten}: ${r.err}`);
    return { l, r, note: str(g?.note, 200) };
  });
  const now = nowIso();
  const xong = v.hr;
  const st: D1PreparedStatement[] = kq.map(({ l, r, note }) => db.prepare('UPDATE dd_lay_line SET tra = ?, dung = ?, tinh = ?, note = ? WHERE id = ?').bind(r.tra, r.dung, r.tinh, note, l.id));
  if (xong) {
    for (const { l, r } of kq)
      if (r.tra > 0) st.push(db.prepare("INSERT INTO dd_move (item_id, noi, qty, kind, ref, ngay, note, by_id, by_name, created_at) VALUES (?, ?, ?, 'tra', ?, ?, ?, ?, ?, ?)").bind(l.item_id, p.noi, r.tra, p.id, vnDate(), 'Trả lại từ ' + p.user_name, v.id, v.name, now));
    st.push(db.prepare("UPDATE dd_lay SET st = 'tra', tra_by = ?, tra_name = ?, tra_at = ?, tra_khai_at = COALESCE(tra_khai_at, ?), updated_at = ? WHERE id = ?").bind(v.id, v.name, now, now, now, p.id));
  } else st.push(db.prepare("UPDATE dd_lay SET st = 'tra_cho', tra_khai_at = ?, updated_at = ? WHERE id = ?").bind(now, now, p.id));
  await db.batch(st);
  const hong = kq.filter(({ r }) => r.tinh === 'Hỏng' || r.tinh === 'Mất');
  if (!xong) await bell(db, hrIds(v.m), v.id, `${p.user_name} trả đồ phiếu ${p.id}, chờ HCNS nhận lại`, 'vp_lay');
  else if (!chu) await bell(db, [p.user_id], v.id, `HCNS đã nhận lại đồ phiếu ${p.id}${hong.length ? ' · ' + hong.map(({ l, r }) => `${l.ten} ${r.tinh.toLowerCase()}`).join(', ') : ''}`, 'vp_lay');
  return ok(c, { id: p.id, st: xong ? 'tra' : 'tra_cho' });
});

doDungRoutes.post('/lay/:id/huy', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const { p } = await layGet(db, c.req.param('id'));
  if (p.user_id !== v.id && !v.hr) throw forbidden('Chỉ người lấy hoặc HCNS hủy phiếu');
  if (p.st !== 'cho') throw conflict('SAI_BUOC', 'Chỉ hủy được phiếu chưa giao');
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  await db.prepare("UPDATE dd_lay SET st = 'huy', ly_do_huy = ?, updated_at = ? WHERE id = ?").bind(str(b.ly_do), nowIso(), p.id).run();
  return ok(c, { id: p.id });
});

/* ================= Yêu cầu hàng mẫu từ xưởng ================= */
type MauRow = { id: string; noi: Noi; user_id: string; user_name: string; pb: string; kho_code: string; sl: number; st: string; wfi?: string | null; created_at?: string };
const mauGet = async (db: D1Database, id: string) => {
  const x = await db.prepare('SELECT * FROM dd_mau WHERE id = ?').bind(id).first<MauRow>();
  if (!x) throw notFound('Không có yêu cầu này');
  return x;
};
const xkOf = async (db: D1Database, id: string) =>
  db
    .prepare("SELECT d.id, d.no, -ROUND(SUM(m.qty), 6) AS sl FROM kho_docs d JOIN kho_moves m ON m.doc_id = d.id WHERE d.type = 'XK' AND d.status = 'OK' AND d.ref_no = ? GROUP BY d.id")
    .bind(id)
    .all<{ id: number; no: string; sl: number }>()
    .then((r) => r.results ?? []);

doDungRoutes.post('/mau', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (!isNoi(b.noi)) throw badRequest('BAD_NOI', 'Chọn nhận về Văn phòng hay Nhà máy');
  const code = str(b.kho_code, 60);
  const k = code ? await db.prepare("SELECT code, name FROM kho_items WHERE code = ? AND cls IN ('TP','HH','COMBO')").bind(code).first<{ code: string; name: string }>() : null;
  if (!k) throw badRequest('BAD_KHO_CODE', 'Chọn sản phẩm có ở kho thành phẩm');
  const sl = num(b.sl);
  if (!(sl > 0)) throw badRequest('BAD_QTY', 'Số lượng phải lớn hơn 0');
  if (!str(b.shoot_id, 60) && !str(b.shoot_txt) && !str(b.ghi_chu)) throw badRequest('NO_MUC_DICH', 'Chọn buổi quay hoặc ghi dùng để làm gì');
  const leads = leadsOf(v.m.users, v.pb, v.id);
  const st0 = mauDau({ laCeo: v.ceo, laLead: v.lead, coLead: leads.length > 0 });
  const ngay = vnDate();
  const all = ((await db.prepare('SELECT id FROM dd_mau WHERE id LIKE ?').bind('YM' + ngay.slice(2, 4) + ngay.slice(5, 7) + '-%').all<{ id: string }>()).results ?? []).map((x) => x.id);
  const id = soPhieu('YM', ngay, all);
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO dd_mau (id, noi, user_id, user_name, pb, kho_code, sl, shoot_id, shoot_txt, can_ngay, ghi_chu, st, lead_by, lead_name, lead_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, b.noi, v.id, v.name, v.pb, k.code, r6(sl), str(b.shoot_id, 60) || null, str(b.shoot_txt, 200), isDate(b.can_ngay) ? b.can_ngay : null, str(b.ghi_chu), st0,
      st0 === 'kho' ? v.id : null, st0 === 'kho' ? v.name : null, st0 === 'kho' ? now : null, now, now)
    .run();
  if (st0 === 'lead') await bell(db, leads, v.id, `${v.name} xin hàng mẫu ${r6(sl)} ${k.name} (${id}), cần duyệt`, 'vp_mau');
  else await bell(db, await khoIds(db), v.id, `Yêu cầu hàng mẫu ${id}: xuất ${r6(sl)} ${k.name} về ${DD_NOI[b.noi]}`, 'vp_mau');
  return ok(c, { id, st: st0 });
});

doDungRoutes.post('/mau/:id/duyet', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const x = await mauGet(db, c.req.param('id'));
  if (x.st !== 'lead') throw conflict('SAI_BUOC', 'Yêu cầu không ở bước chờ Lead duyệt');
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const fr: GateRow = { table: 'dd_mau', fid: 'mau', id: x.id, pb: x.pb, owner: x.user_id, wfi: x.wfi ?? null, start: x.created_at ?? '' };
  const g = await flowGate(db, fr, v.id);
  if (g.act && b.ok !== false && g.pre) return ok(c, { id: x.id, st: x.st, buoc: await flowAdvance(db, fr, g, v.id, `xin hàng mẫu ${x.id} của ${x.user_name}`) });
  if (!g.act && !v.ceo && !(v.lead && v.pb === x.pb && v.id !== x.user_id)) throw forbidden('Chỉ Lead phòng của người xin hoặc CEO duyệt');
  const now = nowIso();
  if (b.ok === false) {
    const ly = str(b.ly_do);
    if (!ly) throw badRequest('NO_REASON', 'Ghi lý do trả lại');
    await db.prepare("UPDATE dd_mau SET st = 'tl', ly_do = ?, lead_by = ?, lead_name = ?, lead_at = ?, updated_at = ? WHERE id = ?").bind(ly, v.id, v.name, now, now, x.id).run();
    await bell(db, [x.user_id], v.id, `Yêu cầu hàng mẫu ${x.id} bị trả lại: ${ly}`, 'vp_mau');
    return ok(c, { id: x.id, st: 'tl' });
  }
  await db.prepare("UPDATE dd_mau SET st = 'kho', lead_by = ?, lead_name = ?, lead_at = ?, updated_at = ? WHERE id = ?").bind(v.id, v.name, now, now, x.id).run();
  await bell(db, await khoIds(db), v.id, `Yêu cầu hàng mẫu ${x.id} đã duyệt: xuất ${x.sl} ${x.kho_code} về ${DD_NOI[x.noi]}`, 'vp_mau');
  return ok(c, { id: x.id, st: 'kho' });
});

/** HCNS nhận hàng mẫu về: phải có phiếu xuất kho (XK, ref_no = mã yêu cầu). Số nhận = số kho đã xuất. Hàng mẫu chưa có trong danh mục thì tự thêm. */
doDungRoutes.post('/mau/:id/nhan', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  needHr(v);
  const x = await mauGet(db, c.req.param('id'));
  if (x.st !== 'kho') throw conflict('SAI_BUOC', 'Yêu cầu chưa tới bước nhận');
  const docs = await xkOf(db, x.id);
  if (!docs.length) throw conflict('CHUA_XUAT', 'Kho chưa lập phiếu xuất kho cho yêu cầu này');
  const sl = r6(docs.reduce((t, d) => t + d.sl, 0));
  const now = nowIso();
  let it = await db.prepare('SELECT id FROM dd_item WHERE kho_code = ?').bind(x.kho_code).first<{ id: string }>();
  const st: D1PreparedStatement[] = [];
  if (!it) {
    const k = await db.prepare('SELECT name, unit FROM kho_items WHERE code = ?').bind(x.kho_code).first<{ name: string; unit: string }>();
    const all = ((await db.prepare('SELECT ma FROM dd_item').all<{ ma: string }>()).results ?? []).map((r) => r.ma);
    it = { id: idNew() };
    st.push(
      db.prepare("INSERT INTO dd_item (id, ma, ten, loai, dvt, kho_code, gia, created_by, created_at, updated_at) VALUES (?, ?, ?, 'mau', ?, ?, 0, ?, ?, ?)").bind(it.id, all.includes(x.kho_code) ? maMoi('mau', all) : x.kho_code, k?.name ?? x.kho_code, k?.unit || 'cái', x.kho_code, v.id, now, now),
    );
  }
  st.push(
    db.prepare("INSERT INTO dd_move (item_id, noi, qty, kind, ref, ngay, note, by_id, by_name, created_at) VALUES (?, ?, ?, 'mau', ?, ?, ?, ?, ?, ?)").bind(it.id, x.noi, sl, x.id, vnDate(), 'Kho xuất ' + docs.map((d) => d.no).join(', '), v.id, v.name, now),
    db.prepare("UPDATE dd_mau SET st = 'xong', nhan_by = ?, nhan_name = ?, nhan_at = ?, nhan_sl = ?, updated_at = ? WHERE id = ? AND st = 'kho'").bind(v.id, v.name, now, sl, now, x.id),
  );
  await db.batch(st);
  await bell(db, [x.user_id], v.id, `Hàng mẫu ${x.id} đã về ${DD_NOI[x.noi]}: ${sl} ${x.kho_code}`, 'vp_mau');
  return ok(c, { id: x.id, sl });
});

doDungRoutes.post('/mau/:id/huy', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const x = await mauGet(db, c.req.param('id'));
  if (x.user_id !== v.id && !v.hr && !v.ceo) throw forbidden('Chỉ người xin hoặc HCNS hủy');
  if (!['lead', 'kho'].includes(x.st)) throw conflict('SAI_BUOC', 'Yêu cầu đã xong, không hủy được');
  if ((await xkOf(db, x.id)).length) throw conflict('DA_XUAT', 'Kho đã xuất phiếu cho yêu cầu này: nhờ kho hủy phiếu xuất trước');
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  await db.prepare("UPDATE dd_mau SET st = 'huy', ly_do = ?, updated_at = ? WHERE id = ?").bind(str(b.ly_do) || 'Hủy', nowIso(), x.id).run();
  return ok(c, { id: x.id });
});

/* ================= Đề nghị mua đồ dùng ================= */
type MuaRow = { id: string; noi: Noi; user_id: string; user_name: string; pb: string; item_id: string | null; ten: string; loai: string; sl: number; dvt: string; gia: number; st: string; wfi?: string | null; updated_at?: string };
const muaGet = async (db: D1Database, id: string) => {
  const x = await db.prepare('SELECT * FROM dd_mua WHERE id = ?').bind(id).first<MuaRow>();
  if (!x) throw notFound('Không có đề nghị này');
  return x;
};

doDungRoutes.post('/mua', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (!isNoi(b.noi)) throw badRequest('BAD_NOI', 'Chọn mua cho Văn phòng hay Nhà máy');
  const itemId = str(b.item_id, 60) || null;
  const it = itemId ? await db.prepare('SELECT id, ten, loai, dvt FROM dd_item WHERE id = ?').bind(itemId).first<{ id: string; ten: string; loai: string; dvt: string }>() : null;
  if (itemId && !it) throw badRequest('BAD_ITEM', 'Không có đồ này trong danh mục');
  const ten = it?.ten ?? str(b.ten, 200);
  if (!ten) throw badRequest('NO_TEN', 'Ghi đồ cần mua');
  const loai = it?.loai ?? (isLoai(b.loai) ? b.loai : 'th');
  const sl = num(b.sl);
  if (!(sl > 0)) throw badRequest('BAD_QTY', 'Số lượng phải lớn hơn 0');
  const gia = Math.round(num(b.gia));
  if (!(gia >= 0)) throw badRequest('BAD_PRICE', 'Ghi đơn giá dự kiến');
  const ly = str(b.ly_do);
  if (!ly) throw badRequest('NO_REASON', 'Ghi lý do cần mua');
  const leads = leadsOf(v.m.users, v.pb, v.id);
  const st0 = muaDau({ laCeo: v.ceo, laLead: v.lead, coLead: leads.length > 0, laQl: v.ql });
  const ngay = vnDate();
  const all = ((await db.prepare('SELECT id FROM dd_mua WHERE id LIKE ?').bind('DM' + ngay.slice(2, 4) + ngay.slice(5, 7) + '-%').all<{ id: string }>()).results ?? []).map((x) => x.id);
  const id = soPhieu('DM', ngay, all);
  const now = nowIso();
  const leadOk = st0 !== 'lead';
  await db
    .prepare(
      `INSERT INTO dd_mua (id, noi, user_id, user_name, pb, item_id, ten, loai, sl, dvt, gia, ly_do, link, st, lead_by, lead_name, lead_at, ql_by, ql_name, ql_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, b.noi, v.id, v.name, v.pb, it?.id ?? null, ten, loai, r6(sl), it?.dvt ?? (str(b.dvt, 20) || 'cái'), gia, ly, str(b.link, 500), st0,
      leadOk ? v.id : null, leadOk ? v.name : null, leadOk ? now : null, st0 === 'mua' ? v.id : null, st0 === 'mua' ? v.name : null, st0 === 'mua' ? now : null, now, now)
    .run();
  const tt = Math.round(r6(sl) * gia).toLocaleString('vi-VN');
  if (st0 === 'lead') await bell(db, leads, v.id, `${v.name} đề nghị mua ${ten} (${tt} đ, ${id}), cần duyệt`, 'vp_mua');
  else if (st0 === 'ql') await bell(db, await qlIds(db), v.id, `Đề nghị mua ${ten} (${tt} đ, ${id}) cần Quản lý mua hàng duyệt`, 'vp_mua');
  else await bell(db, hrIds(v.m), v.id, `Đề nghị mua ${ten} (${id}) đã duyệt, chờ mua`, 'vp_mua');
  return ok(c, { id, st: st0 });
});

doDungRoutes.post('/mua/:id/duyet', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const x = await muaGet(db, c.req.param('id'));
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const now = nowIso();
  let next: string;
  if (x.st === 'lead') {
    const fr: GateRow = { table: 'dd_mua', fid: 'mua', id: x.id, pb: x.pb, owner: x.user_id, wfi: x.wfi ?? null, start: x.updated_at ?? '' };
    const g = await flowGate(db, fr, v.id);
    if (g.act && b.ok !== false && g.pre) return ok(c, { id: x.id, st: x.st, buoc: await flowAdvance(db, fr, g, v.id, `đề nghị mua ${x.ten} (${x.id})`) });
    if (!g.act && !v.ceo && !(v.lead && v.pb === x.pb && v.id !== x.user_id)) throw forbidden('Chỉ Lead phòng của người đề nghị hoặc CEO duyệt');
    next = v.ceo ? 'mua' : muaSauLead(v.ql);
  } else if (x.st === 'ql') {
    if (!v.ql) throw forbidden('Chỉ Quản lý mua hàng hoặc CEO duyệt');
    next = 'mua';
  } else throw conflict('SAI_BUOC', 'Đề nghị không ở bước chờ duyệt');
  if (b.ok === false) {
    const ly = str(b.ly_do);
    if (!ly) throw badRequest('NO_REASON', 'Ghi cần sửa gì');
    await db.prepare("UPDATE dd_mua SET st = 'tl', ly_do_tl = ?, updated_at = ? WHERE id = ?").bind(ly, now, x.id).run();
    await bell(db, [x.user_id], v.id, `Đề nghị mua ${x.id} cần sửa: ${ly}`, 'vp_mua');
    return ok(c, { id: x.id, st: 'tl' });
  }
  const set =
    x.st === 'lead'
      ? next === 'mua'
        ? 'lead_by = ?1, lead_name = ?2, lead_at = ?3, ql_by = ?1, ql_name = ?2, ql_at = ?3'
        : 'lead_by = ?1, lead_name = ?2, lead_at = ?3'
      : 'ql_by = ?1, ql_name = ?2, ql_at = ?3';
  await db.prepare(`UPDATE dd_mua SET ${set}, st = ?4, updated_at = ?3 WHERE id = ?5`).bind(v.id, v.name, now, next, x.id).run();
  if (next === 'ql') await bell(db, await qlIds(db), v.id, `Đề nghị mua ${x.ten} (${x.id}) Lead đã duyệt, cần Quản lý mua hàng duyệt`, 'vp_mua');
  else await bell(db, [...hrIds(v.m), x.user_id], v.id, `Đề nghị mua ${x.ten} (${x.id}) đã duyệt, chờ mua`, 'vp_mua');
  return ok(c, { id: x.id, st: next });
});

/** Mua về: nhập tồn nơi mua cho. Đồ chưa có trong danh mục thì tự thêm. pc_id = mã phiếu chi nháp trình duyệt ghi vào Sổ chi phí. */
doDungRoutes.post('/mua/:id/xong', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  if (!v.hr && !v.ql) throw forbidden('Chỉ HCNS hoặc Quản lý mua hàng ghi mua về');
  const x = await muaGet(db, c.req.param('id'));
  if (x.st !== 'mua') throw conflict('SAI_BUOC', 'Đề nghị chưa duyệt xong hoặc đã mua');
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const sl = num(b.thuc_sl);
  if (!(sl > 0)) throw badRequest('BAD_QTY', 'Ghi số thực nhận');
  const tien = Math.round(num(b.thuc_tien));
  if (!(tien >= 0)) throw badRequest('BAD_MONEY', 'Ghi số tiền thực trả');
  const ngay = isDate(b.ngay_mua) ? b.ngay_mua : vnDate();
  const now = nowIso();
  const st: D1PreparedStatement[] = [];
  let itemId = x.item_id;
  if (!itemId) {
    const all = ((await db.prepare('SELECT ma FROM dd_item').all<{ ma: string }>()).results ?? []).map((r) => r.ma);
    const loai = (isLoai(x.loai) && x.loai !== 'mau' ? x.loai : 'th') as Loai;
    itemId = idNew();
    st.push(
      db
        .prepare(`INSERT INTO dd_item (id, ma, ten, loai, dvt, gia, cho_vp, cho_nm, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(itemId, maMoi(loai, all), x.ten, loai, x.dvt, Math.round(tien / sl), x.noi === 'vp' ? str(b.cho, 120) : '', x.noi === 'nm' ? str(b.cho, 120) : '', v.id, now, now),
    );
  } else if (tien > 0) st.push(db.prepare('UPDATE dd_item SET gia = ?, updated_at = ? WHERE id = ?').bind(Math.round(tien / sl), now, itemId));
  st.push(
    db.prepare("INSERT INTO dd_move (item_id, noi, qty, kind, ref, ngay, note, by_id, by_name, created_at) VALUES (?, ?, ?, 'mua', ?, ?, ?, ?, ?, ?)").bind(itemId, x.noi, r6(sl), x.id, ngay, 'Mua về', v.id, v.name, now),
    db
      .prepare("UPDATE dd_mua SET st = 'xong', item_id = ?, thuc_sl = ?, thuc_tien = ?, tra_bang = ?, ngay_mua = ?, pc_id = ?, xong_by = ?, xong_name = ?, xong_at = ?, updated_at = ? WHERE id = ? AND st = 'mua'")
      .bind(itemId, r6(sl), tien, str(b.tra_bang, 60), ngay, str(b.pc_id, 60) || null, v.id, v.name, now, now, x.id),
  );
  await db.batch(st);
  await bell(db, [x.user_id], v.id, `Đồ đề nghị ${x.id} (${x.ten}) đã mua về ${DD_NOI[x.noi]}`, 'vp_mua');
  return ok(c, { id: x.id, item_id: itemId });
});

doDungRoutes.post('/mua/:id/huy', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const x = await muaGet(db, c.req.param('id'));
  if (x.user_id !== v.id && !v.hr && !v.ceo) throw forbidden('Chỉ người đề nghị hoặc HCNS hủy');
  if (!['lead', 'ql', 'mua', 'tl'].includes(x.st)) throw conflict('SAI_BUOC', 'Đề nghị đã mua, không hủy được');
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  await db.prepare("UPDATE dd_mua SET st = 'huy', ly_do_tl = ?, updated_at = ? WHERE id = ?").bind(str(b.ly_do) || 'Hủy', nowIso(), x.id).run();
  return ok(c, { id: x.id });
});

/** Gửi lại đề nghị bị trả lại (sau khi sửa). */
doDungRoutes.post('/mua/:id/gui-lai', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const x = await muaGet(db, c.req.param('id'));
  if (x.user_id !== v.id) throw forbidden('Chỉ người đề nghị gửi lại');
  if (x.st !== 'tl') throw conflict('SAI_BUOC', 'Đề nghị không ở bước cần sửa');
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const sl = Number.isFinite(num(b.sl)) && num(b.sl) > 0 ? r6(num(b.sl)) : x.sl;
  const gia = Number.isFinite(num(b.gia)) && num(b.gia) >= 0 ? Math.round(num(b.gia)) : x.gia;
  const leads = leadsOf(v.m.users, x.pb, v.id);
  const st0 = muaDau({ laCeo: v.ceo, laLead: v.lead, coLead: leads.length > 0, laQl: v.ql });
  await db.prepare('UPDATE dd_mua SET st = ?, sl = ?, gia = ?, ly_do = COALESCE(NULLIF(?, \'\'), ly_do), ly_do_tl = NULL, wfi = NULL, updated_at = ? WHERE id = ?').bind(st0, sl, gia, str(b.ly_do), nowIso(), x.id).run();
  if (st0 === 'lead') await bell(db, leads, v.id, `${v.name} gửi lại đề nghị mua ${x.ten} (${x.id})`, 'vp_mua');
  else if (st0 === 'ql') await bell(db, await qlIds(db), v.id, `Đề nghị mua ${x.ten} (${x.id}) gửi lại, cần Quản lý mua hàng duyệt`, 'vp_mua');
  return ok(c, { id: x.id, st: st0 });
});

/** Số chờ cho menu (đếm theo việc của người đang xem). */
doDungRoutes.get('/cho', async (c) => {
  const db = c.env.DB;
  const v = await viewer(db, c.get('auth'));
  const one = (sql: string, ...a: unknown[]) => db.prepare(sql).bind(...a).first<{ n: number }>().then((r) => r?.n ?? 0);
  const [layCho, layTra, mauLead, mauKho, muaLead, muaQl, muaMua, toi] = await Promise.all([
    v.hr ? one("SELECT COUNT(*) AS n FROM dd_lay WHERE st = 'cho'") : 0,
    v.hr ? one("SELECT COUNT(*) AS n FROM dd_lay WHERE st = 'tra_cho'") : 0,
    v.ceo ? one("SELECT COUNT(*) AS n FROM dd_mau WHERE st = 'lead'") : v.lead ? one("SELECT COUNT(*) AS n FROM dd_mau WHERE st = 'lead' AND pb = ? AND user_id <> ?", v.pb, v.id) : 0,
    v.kho || v.hr ? one("SELECT COUNT(*) AS n FROM dd_mau WHERE st = 'kho'") : 0,
    v.ceo ? one("SELECT COUNT(*) AS n FROM dd_mua WHERE st = 'lead'") : v.lead ? one("SELECT COUNT(*) AS n FROM dd_mua WHERE st = 'lead' AND pb = ? AND user_id <> ?", v.pb, v.id) : 0,
    v.ql ? one("SELECT COUNT(*) AS n FROM dd_mua WHERE st = 'ql'") : 0,
    v.hr || v.ql ? one("SELECT COUNT(*) AS n FROM dd_mua WHERE st = 'mua'") : 0,
    one("SELECT COUNT(*) AS n FROM dd_lay WHERE user_id = ? AND st IN ('dang','tra_cho')", v.id),
  ]);
  return ok(c, { lay: layCho + layTra, mau: mauLead + mauKho, mua: muaLead + muaQl + muaMua, toi, me: { hr: v.hr, kho: v.kho, ql: v.ql, lead: v.lead, ceo: v.ceo } });
});

/** Cron 8 giờ sáng: nhắc phiếu lấy đồ quá hạn trả (người lấy + HCNS). Gọi từ index.ts. */
export async function doDungReminders(db: D1Database, now: Date = new Date(), opts: { anyHour?: boolean } = {}): Promise<Record<string, unknown>> {
  const vn = new Date(now.getTime() + 7 * 3600e3);
  if (!opts.anyHour && vn.getUTCHours() !== 8) return { skipped: 'chưa tới 8 giờ' };
  let rows: LayRow[] = [];
  try {
    rows = ((await db.prepare("SELECT id, noi, user_id, user_name, st, han FROM dd_lay WHERE st IN ('dang','tra_cho') AND han IS NOT NULL").all<LayRow>()).results ?? []).filter((p) => quaHan(p.han, vn.toISOString()));
  } catch {
    return { skipped: 'chưa có bảng dd_lay' };
  }
  if (!rows.length) return { qua_han: 0 };
  const m = await loadMembers(db, 'cron');
  for (const p of rows) await bell(db, [p.user_id], '', `Phiếu lấy đồ ${p.id} đã quá hạn trả (${p.han?.replace('T', ' ')}). Trả đồ cho HCNS và bấm "Trả đồ".`, 'vp_toi');
  await bell(db, hrIds(m), '', `${rows.length} phiếu lấy đồ quá hạn trả: ${rows.map((p) => `${p.id} (${p.user_name})`).join(', ')}`, 'vp_lay');
  return { qua_han: rows.length };
}

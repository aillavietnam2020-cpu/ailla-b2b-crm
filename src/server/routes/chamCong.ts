import { Hono } from 'hono';
import { nowIso, vnDate } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, forbidden, ok } from '../lib/http';
import { canHr } from '../lib/hrAccess';
import { unpack } from '../lib/pack';
import { requirePermission } from '../middleware/rbac';
import { donTheoNgay, LOAI_DON, type Buoi, type LoaiDon } from '../services/nghiPhep';
import { loadMembers, type Members } from '../services/daoTao';
import { bellTo } from '../lib/hubBell';
import {
  CC_SETTINGS_KEY,
  ccViewer,
  dayRule,
  donNghiTheoNguoi,
  daysFrom,
  daysOf,
  lichOf,
  mondayOf,
  nearest,
  normalizeSettings,
  tongNgay,
  tongThang,
  ketQuaBu,
  type BuKq,
  type BuKieu,
  type Ca,
  type CcSettings,
  type CcViewer,
  type Luot,
  diemByIp,
  ipKey,
} from '../services/chamCong';

/**
 * Chấm công trên điện thoại (hub/src/chamcong.js). Quy tắc tính ở services/chamCong.ts.
 * Nhân viên: chấm và xem công của mình. Trưởng nhóm / trưởng phòng: xem phòng mình, xếp ca người phòng mình.
 * CEO, HCNS, kế toán: xem hết; CEO, HCNS: cài đặt (Nhân sự › Cài đặt chấm công) và xếp ca.
 */
export const chamCongRoutes = new Hono<AppEnv>();
chamCongRoutes.use('*', requirePermission('hub.access'));

type Row = { id: string; user_id: string; ngay: string; loai: 'vao' | 'ra'; at: string; kc: number | null; diem: string | null; trong: number | null; ly_do: string | null; ly_do_muon: string | null; acc: number | null; xn?: string | null; gio_quay?: string | null; quay?: string | null; anh_id?: string | null };
const COLS = 'id, user_id, ngay, loai, at, kc, diem, trong, ly_do, ly_do_muon, acc, xn, gio_quay, quay, anh_id';

export async function loadSettings(db: D1Database): Promise<CcSettings> {
  const row = await db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(CC_SETTINGS_KEY).first<{ data: string }>();
  try {
    return normalizeSettings(row ? JSON.parse(row.data) : null);
  } catch {
    return normalizeSettings(null);
  }
}

async function ctx(db: D1Database, auth: AuthContext): Promise<{ v: CcViewer; m: Members; hr: boolean }> {
  const [m, hr] = await Promise.all([loadMembers(db, auth.user.id), canHr(db, auth)]);
  return { v: ccViewer(auth.user.id, auth.user.role, m.users[auth.user.id], hr), m, hr };
}

/** Những người trong phạm vi được xem: tất cả (CEO, nhân sự) hoặc người cùng phòng (trưởng nhóm). */
function scope(v: CcViewer, m: Members): string[] | null {
  if (v.all) return null;
  if (!v.pb) return [v.id];
  return Object.entries(m.users)
    .filter(([, u]) => u.pb === v.pb)
    .map(([id]) => id);
}

/** Ca được xếp trong khoảng ngày: khóa 'người|ngày' → ca. */
async function loadXep(db: D1Database, s: CcSettings, tu: string, den: string, userId?: string): Promise<Map<string, Ca>> {
  const q = userId
    ? db.prepare('SELECT user_id, ngay, ca_id FROM cc_xepca WHERE user_id = ? AND ngay BETWEEN ? AND ?').bind(userId, tu, den)
    : db.prepare('SELECT user_id, ngay, ca_id FROM cc_xepca WHERE ngay BETWEEN ? AND ?').bind(tu, den);
  const rows = (await q.all<{ user_id: string; ngay: string; ca_id: string }>()).results ?? [];
  const out = new Map<string, Ca>();
  for (const r of rows) {
    const ca = s.ca.find((x) => x.id === r.ca_id);
    if (ca) out.set(r.user_id + '|' + r.ngay, ca);
  }
  return out;
}

/**
 * Đơn đã duyệt theo người và ngày: đơn cũ trong dữ liệu chung (hub_state.hr.don) và đơn mới (bảng ns_don, routes/nghiPhep.ts).
 * Giữ 60 giây trong máy chủ; duyệt đơn mới thì xóa ngay (resetDonCache).
 */
export type DonNgay = { don?: string; coPhep?: boolean; ot?: number };
let DON_CACHE: { at: number; map: Map<string, Map<string, DonNgay>> } | null = null;
export function resetDonCache() {
  DON_CACHE = null;
  BU_CACHE = null;
}

/**
 * Đơn làm bù (CEO 06/11) theo 'người|ngày': t = ngày được bù (kết quả bù), b = ngày đi làm bù.
 * Kết quả tính từ giờ chấm của ngày làm bù (điện thoại + máy chấm công). Giữ 60 giây như đơn nghỉ.
 */
type BuMaps = { t: Map<string, BuKq>; b: Map<string, { cho: string; kieu: BuKieu }> };
let BU_CACHE: { at: number; map: BuMaps } | null = null;
async function loadBu(db: D1Database, s: CcSettings, pbOf: (id: string) => string | undefined): Promise<BuMaps> {
  if (BU_CACHE && Date.now() - BU_CACHE.at < 60_000) return BU_CACHE.map;
  const today = vnDate();
  const map: BuMaps = { t: new Map(), b: new Map() };
  const rows =
    (
      await db
        .prepare("SELECT user_id, tu, buoi, st, bu_ngay, bu_kieu, bu_tu, bu_den FROM ns_don WHERE loai = 'lambu' AND st IN ('lead', 'hcns', 'xong') AND tu >= ?")
        .bind(vnDate(new Date(Date.now() - 180 * 864e5)))
        .all<{ user_id: string; tu: string; buoi: Exclude<Buoi, 'gio'>; st: string; bu_ngay: string; bu_kieu: BuKieu; bu_tu: string | null; bu_den: string | null }>()
    ).results ?? [];
  const xong = rows.filter((r) => r.st === 'xong' && r.tu <= today);
  const ngays = [...new Set(xong.map((r) => r.tu))];
  const luot = new Map<string, Luot[]>();
  if (ngays.length) {
    const q = (await db.prepare(`SELECT user_id, ngay, loai, at, trong, xn, gio_quay FROM cc_luot WHERE ngay IN (${ngays.map(() => '?').join(',')})`).bind(...ngays).all<Row>()).results ?? [];
    for (const r of q) luot.set(r.user_id + '|' + r.ngay, [...(luot.get(r.user_id + '|' + r.ngay) ?? []), r as Luot]);
    const sorted = ngays.slice().sort();
    const may = await loadMay(db, sorted[0], sorted[sorted.length - 1]);
    for (const [k, v] of may) if (luot.has(k) || ngays.includes(k.split('|')[1])) luot.set(k, [...(luot.get(k) ?? []), ...v]);
  }
  for (const r of rows) {
    if (!r.bu_ngay) continue;
    let kq: BuKq['kq'] = 'duyet';
    if (r.st === 'xong') {
      const lich = lichOf(s, r.user_id, pbOf(r.user_id));
      const n = tongNgay(luot.get(r.user_id + '|' + r.tu) ?? [], lich, r.tu, r.tu === today, { q: s.quyTac, le: leOf(s, r.tu) });
      kq = ketQuaBu({ kieu: r.bu_kieu, buoi: r.buoi, tu: r.bu_tu, den: r.bu_den }, n, lich, r.tu, today);
    }
    map.t.set(r.user_id + '|' + r.bu_ngay, { kq, ngay: r.tu, kieu: r.bu_kieu });
    if (r.st === 'xong') map.b.set(r.user_id + '|' + r.tu, { cho: r.bu_ngay, kieu: r.bu_kieu });
  }
  BU_CACHE = { at: Date.now(), map };
  return map;
}
const buOpt = (bu: BuMaps, id: string, d: string) => ({ bu: bu.t.get(id + '|' + d) ?? null, lamBu: bu.b.get(id + '|' + d) ?? null });

/** Từng ngày công của một người trong khoảng ngày (dùng cho đơn làm bù: tìm ngày cần bù). */
export async function ngayCongCua(db: D1Database, userId: string, pb: string | undefined, tu: string, den: string) {
  const today = vnDate();
  const s = await loadSettings(db);
  const lich = lichOf(s, userId, pb);
  const days = daysFrom(tu, Math.round((Date.parse(den) - Date.parse(tu)) / 864e5) + 1);
  const [rows, xep, don, may, bu] = await Promise.all([
    db.prepare(`SELECT ${COLS} FROM cc_luot WHERE user_id = ? AND ngay BETWEEN ? AND ? ORDER BY at`).bind(userId, tu, den).all<Row>(),
    lich.kieu === 'ca' ? loadXep(db, s, tu, den, userId) : Promise.resolve(new Map<string, Ca>()),
    loadDon(db),
    loadMay(db, tu, den, userId),
    loadBu(db, s, () => pb),
  ]);
  const list = rows.results ?? [];
  return {
    s,
    lich,
    xep,
    ngay: days.map((d) => ({
      ngay: d,
      ...tongNgay([...(list.filter((r) => r.ngay === d) as Luot[]), ...(may.get(userId + '|' + d) ?? [])], lich, d, d === today, {
        ca: xep.get(userId + '|' + d) ?? null,
        q: s.quyTac,
        le: leOf(s, d),
        ...donOpt(don.get(userId)?.get(d)),
        ...buOpt(bu, userId, d),
      }),
    })),
  };
}
async function loadDon(db: D1Database): Promise<Map<string, Map<string, DonNgay>>> {
  if (DON_CACHE && Date.now() - DON_CACHE.at < 60_000) return DON_CACHE.map;
  const map = new Map<string, Map<string, DonNgay>>();
  const at = (u: string, d: string) => {
    const m = map.get(u) ?? new Map<string, DonNgay>();
    map.set(u, m);
    const e = m.get(d) ?? {};
    m.set(d, e);
    return e;
  };
  try {
    const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
    if (row) {
      const d = JSON.parse(await unpack(row.data)) as { users?: { crm?: string; maNS?: string }[]; hr?: { don?: [] } };
      for (const [u, days] of donNghiTheoNguoi(d.users, d.hr?.don)) for (const [n, loai] of days) at(u, n).don = loai;
    }
  } catch {
    /* không đọc được đơn cũ thì bỏ qua */
  }
  const tu = vnDate(new Date(Date.now() - 400 * 864e5));
  const rows = (await db.prepare("SELECT user_id, loai, tu, den, buoi, gio FROM ns_don WHERE st = 'xong' AND loai <> 'lambu' AND den >= ?").bind(tu).all<{ user_id: string; loai: LoaiDon; tu: string; den: string; buoi: Buoi; gio: number | null }>()).results ?? [];
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  for (const [u, list] of byUser)
    for (const [n, ds] of donTheoNgay(list))
      for (const x of ds) {
        const e = at(u, n);
        // Nghỉ theo giờ (CEO 10/11): đi muộn / về sớm ngày đó không tính vi phạm; không coi là nghỉ cả ngày.
        if (x.loai === 'vesom' || x.buoi === 'gio') e.coPhep = true;
        else if (x.loai === 'ot') e.ot = (e.ot ?? 0) + (x.gio ?? 0);
        else e.don = LOAI_DON[x.loai] + (x.buoi === 'sang' ? ' (sáng)' : x.buoi === 'chieu' ? ' (chiều)' : '');
      }
  DON_CACHE = { at: Date.now(), map };
  return map;
}
const donOpt = (e?: DonNgay) => ({ don: e?.don ?? null, coPhep: !!e?.coPhep, ot: e?.ot ?? 0 });
const leOf = (s: CcSettings, d: string) => s.ngayLe.some((x) => x.ngay === d);

/** Máy chấm công: 'vp' máy văn phòng, 'xg' máy xưởng. */
export const MAY: Record<string, string> = { vp: 'Máy văn phòng', xg: 'Máy xưởng' };
/** Giờ 'HH:MM' (giờ Việt Nam) của một ngày → thời điểm UTC ISO, cùng kiểu với lượt chấm điện thoại. */
const vnIso = (ngay: string, hm: string) => new Date(Date.parse(`${ngay}T${hm}:00Z`) - 7 * 3600e3).toISOString();
/**
 * Lượt chấm từ máy (đã ghép với tài khoản web) theo khóa 'người|ngày': giờ đầu là vào, giờ cuối là ra (chỉ một giờ thì coi là vào).
 * Giai đoạn chạy song song (CEO 04/11): ngày nào có ở máy hoặc điện thoại đều tính, lấy giờ vào sớm nhất, giờ ra muộn nhất của cả hai.
 */
async function loadMay(db: D1Database, tu: string, den: string, userId?: string): Promise<Map<string, Luot[]>> {
  const q = userId
    ? db.prepare("SELECT m.user_id, c.ngay, c.gio FROM cc_may c JOIN cc_may_map m ON m.may = c.may AND m.ma = c.ma WHERE m.user_id = ? AND c.ngay BETWEEN ? AND ?").bind(userId, tu, den)
    : db.prepare("SELECT m.user_id, c.ngay, c.gio FROM cc_may c JOIN cc_may_map m ON m.may = c.may AND m.ma = c.ma WHERE m.user_id <> '' AND c.ngay BETWEEN ? AND ?").bind(tu, den);
  const rows = (await q.all<{ user_id: string; ngay: string; gio: string }>()).results ?? [];
  const out = new Map<string, Luot[]>();
  for (const r of rows) {
    let g: string[] = [];
    try {
      g = (JSON.parse(r.gio) as string[]).filter((x) => /^\d{2}:\d{2}$/.test(x)).sort();
    } catch {
      /* bỏ dòng hỏng */
    }
    if (!g.length) continue;
    const k = r.user_id + '|' + r.ngay;
    const l = out.get(k) ?? [];
    l.push({ loai: 'vao', at: vnIso(r.ngay, g[0]), trong: 1, may: true });
    if (g.length > 1) l.push({ loai: 'ra', at: vnIso(r.ngay, g[g.length - 1]), trong: 1, may: true });
    out.set(k, l);
  }
  return out;
}
const nguon = (dt: Luot[], may: Luot[]) => (dt.length && may.length ? 'ca hai' : may.length ? 'may' : dt.length ? 'dt' : '');

const vai = (v: CcViewer, hr: boolean) => ({ all: v.all, pb: v.pb, caiDat: v.all && hr });
const THANG = /^\d{4}-\d{2}$/;
const NGAY = /^\d{4}-\d{2}-\d{2}$/;

chamCongRoutes.get('/me', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const today = vnDate();
  const thang = THANG.test(c.req.query('thang') ?? '') ? (c.req.query('thang') as string) : today.slice(0, 7);
  const [s, cx, rows] = await Promise.all([
    loadSettings(db),
    ctx(db, auth),
    db
      .prepare(`SELECT ${COLS} FROM cc_luot WHERE user_id = ? AND ngay LIKE ? ORDER BY at`)
      .bind(auth.user.id, thang + '%')
      .all<Row>(),
  ]);
  const list = rows.results ?? [];
  const lich = lichOf(s, auth.user.id, cx.m.users[auth.user.id]?.pb);
  const tuan = daysFrom(today, 7);
  const xep = lich.kieu === 'ca' ? await loadXep(db, s, thang + '-01', tuan[6], auth.user.id) : new Map<string, Ca>();
  const caOf = (d: string) => xep.get(auth.user.id + '|' + d) ?? null;
  const myDon = (await loadDon(db)).get(auth.user.id);
  const bu = await loadBu(db, s, (id) => cx.m.users[id]?.pb);
  const may = await loadMay(db, thang + '-01', thang + '-31', auth.user.id);
  const ngay = daysOf(thang, today).map((d) => {
    const l = list.filter((r) => r.ngay === d) as Luot[];
    const m = may.get(auth.user.id + '|' + d) ?? [];
    return { ngay: d, ...tongNgay([...l, ...m], lich, d, d === today, { ca: caOf(d), q: s.quyTac, le: leOf(s, d), ...donOpt(myDon?.get(d)), ...buOpt(bu, auth.user.id, d) }), luot: l.length, nguon: nguon(l, m) };
  });
  return ok(c, {
    today,
    now: nowIso(),
    thang,
    diem: (lich.diem.length ? s.diem.filter((d) => lich.diem.includes(d.id)) : s.diem).map((d) => ({ ten: d.ten, bk: d.bk })),
    lich,
    rule: dayRule(lich, today, caOf(today), leOf(s, today)),
    caHomNay: caOf(today),
    caTuan: lich.kieu === 'ca' ? tuan.map((d) => ({ ngay: d, ca: caOf(d) })) : [],
    quyTac: s.quyTac,
    tong: tongThang(ngay, lich, today, s.quyTac),
    vai: vai(cx.v, cx.hr),
    homNay: list.filter((r) => r.ngay === today),
    ngay,
  });
});

/** Mạng đang dùng của người hỏi (để cài mạng wifi cho điểm chấm). */
chamCongRoutes.get('/ip', (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? '';
  return ok(c, { ip, key: ipKey(ip) });
});

chamCongRoutes.post('/cham', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const loai = b.loai === 'ra' ? 'ra' : b.loai === 'vao' ? 'vao' : null;
  if (!loai) throw badRequest('LOAI', 'Chọn Chấm vào hoặc Chấm ra');
  const latN = b.lat == null || b.lat === '' ? NaN : Number(b.lat);
  const lngN = b.lng == null || b.lng === '' ? NaN : Number(b.lng);
  const coViTri = Number.isFinite(latN) && Number.isFinite(lngN) && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;
  const lat = coViTri ? latN : null;
  const lng = coViTri ? lngN : null;
  const acc = coViTri && Number.isFinite(Number(b.acc)) ? Math.round(Number(b.acc)) : null;
  const lyDo = String(b.lyDo ?? '').trim().slice(0, 300);
  const lyDoMuon = loai === 'vao' ? String(b.lyDoMuon ?? '').trim().slice(0, 300) : '';
  const now = nowIso();
  const today = vnDate(now);
  const [s, m] = await Promise.all([loadSettings(db), loadMembers(db, auth.user.id)]);
  const lich = lichOf(s, auth.user.id, m.users[auth.user.id]?.pb);
  // Máy tính không có GPS nên vị trí đoán lệch cả cây số: đang dùng đúng mạng wifi của điểm thì coi như ở điểm.
  const quaMang = diemByIp(s, ipKey(c.req.header('cf-connecting-ip')), lich);
  if (!coViTri && !quaMang)
    throw badRequest('NO_LOCATION', 'Chưa lấy được vị trí. Hãy bật định vị và cho phép trang web xem vị trí rồi bấm lại.');
  let near = coViTri ? nearest(s, lat!, lng!, lich) : { diem: null, kc: null, trong: null as boolean | null };
  if (quaMang && near.trong !== true) near = { diem: { ...quaMang, ten: quaMang.ten + ' (wifi)' }, kc: null, trong: true };
  // Ngoài phạm vi (đi quay, gặp khách — CEO 06/11): ai cũng chấm được nhưng phải có lý do + ảnh check-in, chờ xác nhận mới tính công.
  const ngoai = near.trong === false;
  const anh = ngoai ? String(b.anh ?? '') : '';
  if (ngoai && (!lyDo || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(anh)))
    throw badRequest('NEED_OUT', `Bạn đang cách ${near.diem!.ten} khoảng ${fmtKc(near.kc!)}, ngoài phạm vi ${near.diem!.bk} m. Đi quay, gặp khách thì chọn lý do và chụp ảnh check-in để Lead xác nhận.`);
  if (anh.length > 1_200_000) throw badRequest('ANH_TO', 'Ảnh quá lớn, chụp lại giúp em');
  const q0 = ngoai && b.quay && typeof b.quay === 'object' ? (b.quay as Record<string, unknown>) : null;
  const quay = q0 ? { id: String(q0.id ?? '').slice(0, 40), gio: String(q0.gio ?? '').slice(0, 5), diaDiem: String(q0.diaDiem ?? '').slice(0, 120), ghiChu: String(q0.ghiChu ?? '').slice(0, 200) } : null;
  const gioQuay = quay && /^\d{1,2}:\d{2}$/.test(quay.gio) ? quay.gio.padStart(5, '0') : null;
  if (loai === 'vao') {
    const had = await db
      .prepare("SELECT at FROM cc_luot WHERE user_id = ? AND ngay = ? AND loai = 'vao' LIMIT 1")
      .bind(auth.user.id, today)
      .first<{ at: string }>();
    if (had) throw badRequest('DA_VAO', 'Hôm nay bạn đã chấm vào rồi. Lúc về thì bấm Chấm ra.');
  }
  const id = crypto.randomUUID();
  const trong = near.trong === null ? null : near.trong ? 1 : 0;
  const anhId = ngoai ? crypto.randomUUID() : null;
  await db.batch([
    ...(anhId ? [db.prepare('INSERT INTO cc_anh (id, user_id, data, created_at) VALUES (?, ?, ?, ?)').bind(anhId, auth.user.id, anh, now)] : []),
    db
      .prepare(
        'INSERT INTO cc_luot (id, user_id, ngay, loai, at, lat, lng, acc, kc, diem, trong, ly_do, ly_do_muon, created_at, anh_id, xn, quay, gio_quay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, auth.user.id, today, loai, now, lat, lng, acc, near.kc, near.diem?.ten ?? null, trong, lyDo || null, lyDoMuon || null, now, anhId, ngoai ? 'cho' : null, quay ? JSON.stringify(quay) : null, gioQuay),
    auditStatement(db, { actorId: auth.user.id, action: 'CC_CHAM', entityType: 'CHAM_CONG', entityId: id, after: { loai, ngay: today, kc: near.kc, trong } }),
  ]);
  if (ngoai) {
    const m = await loadMembers(db, auth.user.id);
    const ten = m.users[auth.user.id]?.name ?? 'Nhân viên';
    await bellTo(db, nguoiXacNhan(m, auth.user.id), `${ten} chấm ${loai === 'vao' ? 'vào' : 'ra'} ngoài văn phòng (${lyDo}), chờ xác nhận`, 'page:cc_xn').catch(() => 0);
  }
  return ok(c, { id, loai, at: now, ngay: today, kc: near.kc, diem: near.diem?.ten ?? null, trong, xn: ngoai ? 'cho' : null });
});

const fmtKc = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m} m`);

/** Ai xác nhận lượt chấm ngoài của một người: Lead cùng phòng; người đó là Lead hoặc phòng không có Lead thì CEO, HCNS. */
function nguoiXacNhan(m: Members, uid: string): string[] {
  const me = m.users[uid];
  const isLead = (u?: { role: string }) => !!u && ['lead', 'truongphong'].includes(u.role);
  const leads = me && !isLead(me) && me.pb ? Object.entries(m.users).filter(([id, u]) => id !== uid && u.pb === me.pb && isLead(u)).map(([id]) => id) : [];
  if (leads.length) return leads;
  return Object.entries(m.users).filter(([id, u]) => id !== uid && u.hr).map(([id]) => id);
}
/** 'lead' khi có Lead cùng phòng xác nhận; 'hcns' khi lượt này lên CEO, HCNS (người chấm là Lead hoặc phòng không có Lead). */
function capXn(m: Members, uid: string): 'lead' | 'hcns' {
  const me = m.users[uid];
  const isLead = (u?: { role: string }) => !!u && ['lead', 'truongphong'].includes(u.role);
  return me && !isLead(me) && me.pb && Object.entries(m.users).some(([id, u]) => id !== uid && u.pb === me.pb && isLead(u)) ? 'lead' : 'hcns';
}
/** Người xem có được xác nhận lượt của uid không (không ai tự xác nhận cho mình). */
function duocXacNhan(v: CcViewer, m: Members, uid: string): boolean {
  if (uid === v.id) return false;
  if (v.all) return true;
  const u = m.users[uid];
  return !!v.pb && !!u && u.pb === v.pb && !['lead', 'truongphong'].includes(u.role);
}

/** Lượt chấm ngoài văn phòng chờ xác nhận (và đã xử lý 7 ngày gần đây) trong phạm vi người xem. */
chamCongRoutes.get('/xac-nhan', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const cx = await ctx(db, auth);
  const tu = new Date(Date.now() + 7 * 3600e3 - 35 * 864e5).toISOString().slice(0, 10);
  const rows =
    (
      await db
        .prepare(`SELECT ${COLS}, xn_by, xn_at, lat, lng FROM cc_luot WHERE xn IS NOT NULL AND ngay >= ? ORDER BY at DESC LIMIT 400`)
        .bind(tu)
        .all<Row & { xn_by: string | null; xn_at: string | null; lat: number | null; lng: number | null }>()
    ).results ?? [];
  const tu7 = new Date(Date.now() + 7 * 3600e3 - 7 * 864e5).toISOString().slice(0, 10);
  const list = rows
    .filter((r) => duocXacNhan(cx.v, cx.m, r.user_id) && (r.xn === 'cho' || r.ngay >= tu7))
    .map((r) => ({ ...r, ten: cx.m.users[r.user_id]?.name ?? r.user_id, pb: cx.m.users[r.user_id]?.pb ?? '', xnTen: r.xn_by ? (cx.m.users[r.xn_by]?.name ?? r.xn_by) : '', cap: capXn(cx.m, r.user_id) }));
  return ok(c, { list, cho: list.filter((r) => r.xn === 'cho').length });
});

chamCongRoutes.post('/xac-nhan', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? '');
  const dongY = b.ok === true;
  const cx = await ctx(db, auth);
  const r = await db.prepare('SELECT id, user_id, loai, at, xn FROM cc_luot WHERE id = ?').bind(id).first<{ id: string; user_id: string; loai: string; at: string; xn: string | null }>();
  if (!r || !r.xn) throw badRequest('NOT_FOUND', 'Không tìm thấy lượt chấm này');
  if (!duocXacNhan(cx.v, cx.m, r.user_id)) throw forbidden('Bạn không xác nhận được lượt chấm này');
  const now = nowIso();
  await db.batch([
    db.prepare('UPDATE cc_luot SET xn = ?, xn_by = ?, xn_at = ? WHERE id = ?').bind(dongY ? 'ok' : 'khong', auth.user.id, now, id),
    auditStatement(db, { actorId: auth.user.id, action: 'CC_XAC_NHAN', entityType: 'CHAM_CONG', entityId: id, after: { xn: dongY ? 'ok' : 'khong' } }),
  ]);
  const gio = new Date(Date.parse(r.at) + 7 * 3600e3).toISOString().slice(11, 16);
  await bellTo(db, [r.user_id], `Lượt chấm ${r.loai === 'vao' ? 'vào' : 'ra'} ngoài văn phòng lúc ${gio} ${dongY ? 'đã được xác nhận' : 'không được xác nhận (không tính công)'}`, 'page:cc_toi').catch(() => 0);
  return ok(c, { id, xn: dongY ? 'ok' : 'khong' });
});

/** Ảnh check-in: chủ lượt chấm hoặc người được xác nhận lượt đó mới xem được. */
chamCongRoutes.get('/anh/:id', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const row = await db.prepare('SELECT user_id, data FROM cc_anh WHERE id = ?').bind(c.req.param('id')).first<{ user_id: string; data: string }>();
  if (!row) return c.text('Không có ảnh', 404);
  if (row.user_id !== auth.user.id) {
    const cx = await ctx(db, auth);
    if (!cx.v.all && !duocXacNhan(cx.v, cx.m, row.user_id)) throw forbidden('Không xem được ảnh này');
  }
  const bin = atob(row.data.slice(row.data.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400' } });
});

/** Ghi (hoặc sửa) lý do đi muộn cho lượt vào hôm nay của chính mình, khi lúc chấm chưa ghi. */
chamCongRoutes.post('/ly-do-muon', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const lyDo = String(b.lyDo ?? '').trim().slice(0, 300);
  if (!lyDo) throw badRequest('EMPTY', 'Ghi lý do đi muộn trước khi lưu');
  const today = vnDate();
  const res = await db
    .prepare("UPDATE cc_luot SET ly_do_muon = ? WHERE user_id = ? AND ngay = ? AND loai = 'vao'")
    .bind(lyDo, auth.user.id, today)
    .run();
  if (!res.meta.changes) throw badRequest('NO_VAO', 'Hôm nay chưa có lượt chấm vào');
  return ok(c, { ngay: today, lyDo });
});

/** Một ngày: mỗi người lượt vào, lượt ra, muộn, về sớm, ngoài phạm vi; người chưa chấm cũng hiện. */
chamCongRoutes.get('/ngay', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const today = vnDate();
  const ngay = NGAY.test(c.req.query('ngay') ?? '') ? (c.req.query('ngay') as string) : today;
  const [s, cx] = await Promise.all([loadSettings(db), ctx(db, auth)]);
  const ids = scope(cx.v, cx.m);
  if (ids && !cx.v.pb) throw forbidden('Chỉ CEO, HCNS và trưởng nhóm xem được chấm công của người khác');
  const rows = (await db.prepare(`SELECT ${COLS} FROM cc_luot WHERE ngay = ? ORDER BY at`).bind(ngay).all<Row>()).results ?? [];
  const people = Object.entries(cx.m.users).filter(([id]) => !ids || ids.includes(id));
  const [xep, don, may, bu] = await Promise.all([loadXep(db, s, ngay, ngay), loadDon(db), loadMay(db, ngay, ngay), loadBu(db, s, (id) => cx.m.users[id]?.pb)]);
  const extra = [...new Set(rows.map((r) => r.user_id))].filter((id) => !cx.m.users[id] && !ids);
  const list = [...people.map(([id, u]) => ({ id, name: u.name, pb: u.pb })), ...extra.map((id) => ({ id, name: id, pb: '' }))].map((p) => {
    const l = rows.filter((r) => r.user_id === p.id);
    const lich = lichOf(s, p.id, p.pb);
    const mm = may.get(p.id + '|' + ngay) ?? [];
    return { ...p, lich: lich.ten, kieu: lich.kieu, nguon: nguon(l as Luot[], mm), ...tongNgay([...(l as Luot[]), ...mm], lich, ngay, ngay === today, { ca: xep.get(p.id + '|' + ngay) ?? null, q: s.quyTac, le: leOf(s, ngay), ...donOpt(don.get(p.id)?.get(ngay)), ...buOpt(bu, p.id, ngay) }), luot: l.map((r) => ({ loai: r.loai, at: r.at, kc: r.kc, diem: r.diem, trong: r.trong, ly_do: r.ly_do, acc: r.acc, xn: r.xn ?? null, quay: r.quay ?? null })) };
  });
  return ok(c, { ngay, today, vai: vai(cx.v, cx.hr), deps: cx.m.deps, list });
});

/** Cả tháng: mỗi người số ngày có chấm, số lần muộn, tổng phút muộn, về sớm, quên chấm ra, ngoài phạm vi; kèm từng ngày. */
chamCongRoutes.get('/thang', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const today = vnDate();
  const thang = THANG.test(c.req.query('thang') ?? '') ? (c.req.query('thang') as string) : today.slice(0, 7);
  const [s, cx] = await Promise.all([loadSettings(db), ctx(db, auth)]);
  const ids = scope(cx.v, cx.m);
  if (ids && !cx.v.pb) throw forbidden('Chỉ CEO, HCNS và trưởng nhóm xem được bảng chấm công');
  const rows = (await db.prepare('SELECT user_id, ngay, loai, at, trong, ly_do_muon, xn, gio_quay FROM cc_luot WHERE ngay LIKE ? ORDER BY at').bind(thang + '%').all<Row>()).results ?? [];
  const days = daysOf(thang, today);
  const people = Object.entries(cx.m.users).filter(([id]) => !ids || ids.includes(id));
  const [xep, don, may, bu] = await Promise.all([
    days.length ? loadXep(db, s, days[0], days[days.length - 1]) : new Map<string, Ca>(),
    loadDon(db),
    days.length ? loadMay(db, days[0], days[days.length - 1]) : new Map<string, Luot[]>(),
    loadBu(db, s, (id) => cx.m.users[id]?.pb),
  ]);
  const list = people.map(([id, u]) => {
    const mine = rows.filter((r) => r.user_id === id);
    const lich = lichOf(s, id, u.pb);
    const src = new Map<string, string>();
    const ngay = days.map((d) => {
      const l = mine.filter((r) => r.ngay === d) as Luot[];
      const mm = may.get(id + '|' + d) ?? [];
      src.set(d, nguon(l, mm));
      return { ngay: d, ...tongNgay([...l, ...mm], lich, d, d === today, { ca: xep.get(id + '|' + d) ?? null, q: s.quyTac, le: leOf(s, d), ...donOpt(don.get(id)?.get(d)), ...buOpt(bu, id, d) }) };
    });
    return {
      id,
      name: u.name,
      pb: u.pb,
      lich: lich.ten,
      kieu: lich.kieu,
      chuyenCanCo: lich.chuyenCan && lich.kieu !== 'tudo',
      mayNgay: [...src.values()].filter((v) => v === 'may' || v === 'ca hai').length,
      dtNgay: [...src.values()].filter((v) => v === 'dt' || v === 'ca hai').length,
      // Lệch chỉ tính khi người đó dùng cả máy lẫn điện thoại trong tháng (giai đoạn chạy song song).
      lech: [...src.values()].some((v) => v === 'may' || v === 'ca hai') && [...src.values()].some((v) => v === 'dt' || v === 'ca hai') ? [...src.values()].filter((v) => v === 'may' || v === 'dt').length : 0,
      ...tongThang(ngay, lich, today, s.quyTac),
      ngay: ngay.map((x) => ({ n: x.ngay, vao: x.vao, ra: x.ra, muon: x.muon, som: x.som, phut: x.phut, quenRa: x.quenRa, ngoai: x.ngoai, lam: x.lam, ca: x.ca, le: x.le, don: x.don, coPhep: x.coPhep, ot: x.ot, nguon: src.get(x.ngay) ?? '', lyDoMuon: x.lyDoMuon, canhBao: x.canhBao, choXn: x.choXn, chamNgoai: x.chamNgoai, bu: x.bu, lamBu: x.lamBu })),
    };
  });
  return ok(c, { thang, today, quyTac: s.quyTac, vai: vai(cx.v, cx.hr), deps: cx.m.deps, list });
});

/** Cài đặt kèm danh sách người, phòng ban để gán lịch (chỉ CEO, HCNS). */
chamCongRoutes.get('/caidat', async (c) => {
  const auth = c.get('auth');
  const [s, cx] = await Promise.all([loadSettings(c.env.DB), ctx(c.env.DB, auth)]);
  if (!(cx.v.all && cx.hr)) throw forbidden('Chỉ CEO và HCNS xem được cài đặt chấm công');
  const people = Object.entries(cx.m.users).map(([id, u]) => ({ id, name: u.name, pb: u.pb }));
  return ok(c, { ...s, people, deps: cx.m.deps });
});

chamCongRoutes.put('/caidat', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const cx = await ctx(db, auth);
  if (!(cx.v.all && cx.hr)) throw forbidden('Chỉ CEO và HCNS đổi được cài đặt chấm công');
  const s = normalizeSettings(await c.req.json().catch(() => null));
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)
         ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      )
      .bind(CC_SETTINGS_KEY, JSON.stringify(s), now, auth.user.id),
    auditStatement(db, { actorId: auth.user.id, action: 'CC_CAIDAT', entityType: 'CHAM_CONG', entityId: CC_SETTINGS_KEY, after: s }),
  ]);
  return ok(c, s);
});

/** Xếp ca một tuần (từ thứ Hai): người làm theo ca trong phạm vi (CEO, HCNS: mọi người; trưởng nhóm: phòng mình). */
chamCongRoutes.get('/xepca', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const today = vnDate();
  const tu = mondayOf(NGAY.test(c.req.query('tu') ?? '') ? (c.req.query('tu') as string) : today);
  const days = daysFrom(tu, 7);
  const [s, cx] = await Promise.all([loadSettings(db), ctx(db, auth)]);
  const ids = scope(cx.v, cx.m);
  if (ids && !cx.v.pb) throw forbidden('Chỉ CEO, HCNS và trưởng nhóm xếp ca được');
  const people = Object.entries(cx.m.users)
    .filter(([id]) => !ids || ids.includes(id))
    .map(([id, u]) => ({ id, name: u.name, pb: u.pb, lich: lichOf(s, id, u.pb) }))
    .filter((p) => p.lich.kieu === 'ca')
    .map((p) => ({ id: p.id, name: p.name, pb: p.pb, lich: p.lich.ten }));
  const rows = (await db.prepare('SELECT user_id, ngay, ca_id FROM cc_xepca WHERE ngay BETWEEN ? AND ?').bind(days[0], days[6]).all<{ user_id: string; ngay: string; ca_id: string }>()).results ?? [];
  const xep: Record<string, Record<string, string>> = {};
  for (const r of rows) if (people.some((p) => p.id === r.user_id)) (xep[r.user_id] ??= {})[r.ngay] = r.ca_id;
  return ok(c, { tu, days, today, ca: s.ca, people, xep, deps: cx.m.deps, vai: vai(cx.v, cx.hr) });
});

chamCongRoutes.put('/xepca', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as { items?: { user_id?: unknown; ngay?: unknown; ca_id?: unknown }[] };
  const items = Array.isArray(b.items) ? b.items.slice(0, 500) : [];
  const [s, cx] = await Promise.all([loadSettings(db), ctx(db, auth)]);
  const ids = scope(cx.v, cx.m);
  if (ids && !cx.v.pb) throw forbidden('Chỉ CEO, HCNS và trưởng nhóm xếp ca được');
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const it of items) {
    const uid = String(it.user_id ?? '');
    const ngay = String(it.ngay ?? '');
    const caId = String(it.ca_id ?? '');
    const u = cx.m.users[uid];
    if (!u || (ids && !ids.includes(uid)) || !NGAY.test(ngay)) throw badRequest('XEP', 'Có người ngoài phạm vi được xếp ca');
    if (lichOf(s, uid, u.pb).kieu !== 'ca') throw badRequest('XEP', `${u.name} không theo lịch làm ca`);
    if (caId && !s.ca.some((x) => x.id === caId)) throw badRequest('XEP', 'Ca không còn trong danh sách ca');
    stmts.push(
      caId
        ? db
            .prepare(
              `INSERT INTO cc_xepca (user_id, ngay, ca_id, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT (user_id, ngay) DO UPDATE SET ca_id = excluded.ca_id, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
            )
            .bind(uid, ngay, caId, auth.user.id, now)
        : db.prepare('DELETE FROM cc_xepca WHERE user_id = ? AND ngay = ?').bind(uid, ngay),
    );
  }
  if (stmts.length) {
    stmts.push(auditStatement(db, { actorId: auth.user.id, action: 'CC_XEPCA', entityType: 'CHAM_CONG', entityId: 'xepca', after: { n: items.length } }));
    await db.batch(stmts);
  }
  return ok(c, { n: items.length });
});

/* ---------------- Nạp file máy chấm công (Nhân sự › Chấm công › Nạp file máy chấm công) ---------------- */
/** Mã đã ghép của một máy + danh sách người để chọn (CEO, HCNS). */
chamCongRoutes.get('/may/map', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const cx = await ctx(db, auth);
  if (!(cx.v.all && cx.hr)) throw forbidden('Chỉ CEO và HCNS nạp file máy chấm công');
  const may = MAY[c.req.query('may') ?? ''] ? (c.req.query('may') as string) : 'vp';
  const map = (await db.prepare('SELECT ma, ten, user_id FROM cc_may_map WHERE may = ?').bind(may).all<{ ma: string; ten: string; user_id: string }>()).results ?? [];
  const nap = await db.prepare('SELECT MIN(ngay) AS tu, MAX(ngay) AS den, MAX(nap_at) AS at, COUNT(*) AS n FROM cc_may WHERE may = ?').bind(may).first<{ tu: string; den: string; at: string; n: number }>();
  const people = Object.entries(cx.m.users).map(([id, u]) => ({ id, name: u.name, pb: u.pb }));
  return ok(c, { may, ten: MAY[may], map, nap, people, deps: cx.m.deps });
});

/**
 * Lưu một file: thay các dòng của máy đó trong khoảng ngày của file, và lưu cách ghép mã.
 * body: { may, tu, den, rows: [{ ma, ten, ngay, gio: ['08:01','17:30'], kh }], map: { ma: user_id | '' } }
 */
chamCongRoutes.post('/may', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const cx = await ctx(db, auth);
  if (!(cx.v.all && cx.hr)) throw forbidden('Chỉ CEO và HCNS nạp file máy chấm công');
  const b = (await c.req.json().catch(() => ({}))) as { may?: string; tu?: string; den?: string; rows?: { ma?: unknown; ten?: unknown; ngay?: unknown; gio?: unknown; kh?: unknown }[]; map?: Record<string, unknown> };
  const may = MAY[b.may ?? ''] ? (b.may as string) : '';
  if (!may) throw badRequest('MAY', 'Chọn máy chấm công');
  const tu = String(b.tu ?? '');
  const den = String(b.den ?? '');
  if (!NGAY.test(tu) || !NGAY.test(den) || den < tu || Date.parse(den) - Date.parse(tu) > 62 * 864e5) throw badRequest('KY', 'File chưa đúng kỳ (tối đa 2 tháng một file)');
  const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 6000).flatMap((r) => {
    const ma = String(r.ma ?? '').trim().slice(0, 30);
    const ngay = String(r.ngay ?? '');
    if (!ma || !NGAY.test(ngay) || ngay < tu || ngay > den) return [];
    const gio = (Array.isArray(r.gio) ? r.gio : []).map(String).filter((x) => /^\d{2}:\d{2}$/.test(x)).slice(0, 8);
    return [{ ma, ngay, gio, kh: String(r.kh ?? '').slice(0, 20), ten: String(r.ten ?? '').slice(0, 80) }];
  });
  if (!rows.length) throw badRequest('TRONG', 'Không đọc được dòng chấm công nào trong file');
  const now = nowIso();
  const users = new Set(Object.keys(cx.m.users));
  const names = new Map(rows.map((r) => [r.ma, r.ten]));
  const stmts: D1PreparedStatement[] = [db.prepare('DELETE FROM cc_may WHERE may = ? AND ngay BETWEEN ? AND ?').bind(may, tu, den)];
  // D1 giới hạn 100 tham số mỗi câu: ghi 15 dòng một lần (6 tham số mỗi dòng).
  for (let i = 0; i < rows.length; i += 15) {
    const part = rows.slice(i, i + 15);
    stmts.push(
      db
        .prepare(`INSERT OR REPLACE INTO cc_may (may, ma, ngay, gio, ky_hieu, nap_at) VALUES ${part.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`)
        .bind(...part.flatMap((r) => [may, r.ma, r.ngay, JSON.stringify(r.gio), r.kh || null, now])),
    );
  }
  for (const [ma, v] of Object.entries(b.map ?? {}).slice(0, 300)) {
    const uid = String(v ?? '');
    if (uid && !users.has(uid)) continue;
    stmts.push(
      db
        .prepare(
          `INSERT INTO cc_may_map (may, ma, ten, user_id, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (may, ma) DO UPDATE SET ten = excluded.ten, user_id = excluded.user_id, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        )
        .bind(may, String(ma).slice(0, 30), names.get(String(ma)) ?? null, uid, auth.user.id, now),
    );
  }
  stmts.push(auditStatement(db, { actorId: auth.user.id, action: 'CC_NAP_MAY', entityType: 'CHAM_CONG', entityId: may, after: { tu, den, n: rows.length } }));
  await db.batch(stmts);
  return ok(c, { may, tu, den, n: rows.length, ma: names.size });
});

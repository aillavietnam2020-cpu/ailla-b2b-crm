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

type Row = { id: string; user_id: string; ngay: string; loai: 'vao' | 'ra'; at: string; kc: number | null; diem: string | null; trong: number | null; ly_do: string | null; ly_do_muon: string | null; acc: number | null };

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
  const rows = (await db.prepare("SELECT user_id, loai, tu, den, buoi, gio FROM ns_don WHERE st = 'xong' AND den >= ?").bind(tu).all<{ user_id: string; loai: LoaiDon; tu: string; den: string; buoi: Buoi; gio: number | null }>()).results ?? [];
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  for (const [u, list] of byUser)
    for (const [n, ds] of donTheoNgay(list))
      for (const x of ds) {
        const e = at(u, n);
        if (x.loai === 'vesom') e.coPhep = true;
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
      .prepare('SELECT id, user_id, ngay, loai, at, kc, diem, trong, ly_do, ly_do_muon, acc FROM cc_luot WHERE user_id = ? AND ngay LIKE ? ORDER BY at')
      .bind(auth.user.id, thang + '%')
      .all<Row>(),
  ]);
  const list = rows.results ?? [];
  const lich = lichOf(s, auth.user.id, cx.m.users[auth.user.id]?.pb);
  const tuan = daysFrom(today, 7);
  const xep = lich.kieu === 'ca' ? await loadXep(db, s, thang + '-01', tuan[6], auth.user.id) : new Map<string, Ca>();
  const caOf = (d: string) => xep.get(auth.user.id + '|' + d) ?? null;
  const myDon = (await loadDon(db)).get(auth.user.id);
  const may = await loadMay(db, thang + '-01', thang + '-31', auth.user.id);
  const ngay = daysOf(thang, today).map((d) => {
    const l = list.filter((r) => r.ngay === d) as Luot[];
    const m = may.get(auth.user.id + '|' + d) ?? [];
    return { ngay: d, ...tongNgay([...l, ...m], lich, d, d === today, { ca: caOf(d), q: s.quyTac, le: leOf(s, d), ...donOpt(myDon?.get(d)) }), luot: l.length, nguon: nguon(l, m) };
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
  if (near.trong === false && !lich.ngoaiOk)
    throw badRequest('NGOAI', `Bạn đang cách ${near.diem!.ten} khoảng ${near.kc} m, ngoài phạm vi ${near.diem!.bk} m nên chưa chấm được. Đến ${near.diem!.ten} rồi bấm lại.`);
  if (near.trong === false && !lyDo)
    throw badRequest('NEED_REASON', `Bạn đang cách ${near.diem!.ten} khoảng ${near.kc} m, ngoài phạm vi ${near.diem!.bk} m. Ghi lý do (gặp khách, giao hàng…) để chấm.`);
  if (loai === 'vao') {
    const had = await db
      .prepare("SELECT at FROM cc_luot WHERE user_id = ? AND ngay = ? AND loai = 'vao' LIMIT 1")
      .bind(auth.user.id, today)
      .first<{ at: string }>();
    if (had) throw badRequest('DA_VAO', 'Hôm nay bạn đã chấm vào rồi. Lúc về thì bấm Chấm ra.');
  }
  const id = crypto.randomUUID();
  const trong = near.trong === null ? null : near.trong ? 1 : 0;
  await db.batch([
    db
      .prepare(
        'INSERT INTO cc_luot (id, user_id, ngay, loai, at, lat, lng, acc, kc, diem, trong, ly_do, ly_do_muon, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, auth.user.id, today, loai, now, lat, lng, acc, near.kc, near.diem?.ten ?? null, trong, lyDo || null, lyDoMuon || null, now),
    auditStatement(db, { actorId: auth.user.id, action: 'CC_CHAM', entityType: 'CHAM_CONG', entityId: id, after: { loai, ngay: today, kc: near.kc, trong } }),
  ]);
  return ok(c, { id, loai, at: now, ngay: today, kc: near.kc, diem: near.diem?.ten ?? null, trong });
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
  const rows = (await db.prepare('SELECT id, user_id, ngay, loai, at, kc, diem, trong, ly_do, ly_do_muon, acc FROM cc_luot WHERE ngay = ? ORDER BY at').bind(ngay).all<Row>()).results ?? [];
  const people = Object.entries(cx.m.users).filter(([id]) => !ids || ids.includes(id));
  const [xep, don, may] = await Promise.all([loadXep(db, s, ngay, ngay), loadDon(db), loadMay(db, ngay, ngay)]);
  const extra = [...new Set(rows.map((r) => r.user_id))].filter((id) => !cx.m.users[id] && !ids);
  const list = [...people.map(([id, u]) => ({ id, name: u.name, pb: u.pb })), ...extra.map((id) => ({ id, name: id, pb: '' }))].map((p) => {
    const l = rows.filter((r) => r.user_id === p.id);
    const lich = lichOf(s, p.id, p.pb);
    const mm = may.get(p.id + '|' + ngay) ?? [];
    return { ...p, lich: lich.ten, kieu: lich.kieu, nguon: nguon(l as Luot[], mm), ...tongNgay([...(l as Luot[]), ...mm], lich, ngay, ngay === today, { ca: xep.get(p.id + '|' + ngay) ?? null, q: s.quyTac, le: leOf(s, ngay), ...donOpt(don.get(p.id)?.get(ngay)) }), luot: l.map((r) => ({ loai: r.loai, at: r.at, kc: r.kc, diem: r.diem, trong: r.trong, ly_do: r.ly_do, acc: r.acc })) };
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
  const rows = (await db.prepare('SELECT user_id, ngay, loai, at, trong, ly_do_muon FROM cc_luot WHERE ngay LIKE ? ORDER BY at').bind(thang + '%').all<Row>()).results ?? [];
  const days = daysOf(thang, today);
  const people = Object.entries(cx.m.users).filter(([id]) => !ids || ids.includes(id));
  const [xep, don, may] = await Promise.all([
    days.length ? loadXep(db, s, days[0], days[days.length - 1]) : new Map<string, Ca>(),
    loadDon(db),
    days.length ? loadMay(db, days[0], days[days.length - 1]) : new Map<string, Luot[]>(),
  ]);
  const list = people.map(([id, u]) => {
    const mine = rows.filter((r) => r.user_id === id);
    const lich = lichOf(s, id, u.pb);
    const src = new Map<string, string>();
    const ngay = days.map((d) => {
      const l = mine.filter((r) => r.ngay === d) as Luot[];
      const mm = may.get(id + '|' + d) ?? [];
      src.set(d, nguon(l, mm));
      return { ngay: d, ...tongNgay([...l, ...mm], lich, d, d === today, { ca: xep.get(id + '|' + d) ?? null, q: s.quyTac, le: leOf(s, d), ...donOpt(don.get(id)?.get(d)) }) };
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
      ngay: ngay.map((x) => ({ n: x.ngay, vao: x.vao, ra: x.ra, muon: x.muon, som: x.som, phut: x.phut, quenRa: x.quenRa, ngoai: x.ngoai, lam: x.lam, ca: x.ca, le: x.le, don: x.don, coPhep: x.coPhep, ot: x.ot, nguon: src.get(x.ngay) ?? '', lyDoMuon: x.lyDoMuon, canhBao: x.canhBao })),
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

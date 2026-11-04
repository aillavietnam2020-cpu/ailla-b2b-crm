import { Hono } from 'hono';
import { nowIso, vnDate } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, forbidden, ok } from '../lib/http';
import { canHr } from '../lib/hrAccess';
import { requirePermission } from '../middleware/rbac';
import { loadMembers, type Members } from '../services/daoTao';
import {
  CC_SETTINGS_KEY,
  ccViewer,
  dayRule,
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
} from '../services/chamCong';

/**
 * Chấm công trên điện thoại (hub/src/chamcong.js). Quy tắc tính ở services/chamCong.ts.
 * Nhân viên: chấm và xem công của mình. Trưởng nhóm / trưởng phòng: xem phòng mình, xếp ca người phòng mình.
 * CEO, HCNS, kế toán: xem hết; CEO, HCNS: cài đặt (Nhân sự › Cài đặt chấm công) và xếp ca.
 */
export const chamCongRoutes = new Hono<AppEnv>();
chamCongRoutes.use('*', requirePermission('hub.access'));

type Row = { id: string; user_id: string; ngay: string; loai: 'vao' | 'ra'; at: string; kc: number | null; diem: string | null; trong: number | null; ly_do: string | null; ly_do_muon: string | null; acc: number | null };

async function loadSettings(db: D1Database): Promise<CcSettings> {
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
  const ngay = daysOf(thang, today).map((d) => {
    const l = list.filter((r) => r.ngay === d);
    return { ngay: d, ...tongNgay(l as Luot[], lich, d, d === today, { ca: caOf(d), q: s.quyTac }), luot: l.length };
  });
  return ok(c, {
    today,
    now: nowIso(),
    thang,
    diem: (lich.diem.length ? s.diem.filter((d) => lich.diem.includes(d.id)) : s.diem).map((d) => ({ ten: d.ten, bk: d.bk })),
    lich,
    rule: dayRule(lich, today, caOf(today)),
    caHomNay: caOf(today),
    caTuan: lich.kieu === 'ca' ? tuan.map((d) => ({ ngay: d, ca: caOf(d) })) : [],
    quyTac: s.quyTac,
    tong: tongThang(ngay, lich, today, s.quyTac),
    vai: vai(cx.v, cx.hr),
    homNay: list.filter((r) => r.ngay === today),
    ngay,
  });
});

chamCongRoutes.post('/cham', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const loai = b.loai === 'ra' ? 'ra' : b.loai === 'vao' ? 'vao' : null;
  if (!loai) throw badRequest('LOAI', 'Chọn Chấm vào hoặc Chấm ra');
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    throw badRequest('NO_LOCATION', 'Chưa lấy được vị trí. Hãy bật định vị và cho phép trang web xem vị trí rồi bấm lại.');
  const acc = Number.isFinite(Number(b.acc)) ? Math.round(Number(b.acc)) : null;
  const lyDo = String(b.lyDo ?? '').trim().slice(0, 300);
  const lyDoMuon = loai === 'vao' ? String(b.lyDoMuon ?? '').trim().slice(0, 300) : '';
  const now = nowIso();
  const today = vnDate(now);
  const [s, m] = await Promise.all([loadSettings(db), loadMembers(db, auth.user.id)]);
  const lich = lichOf(s, auth.user.id, m.users[auth.user.id]?.pb);
  const near = nearest(s, lat, lng, lich);
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
  const xep = await loadXep(db, s, ngay, ngay);
  const extra = [...new Set(rows.map((r) => r.user_id))].filter((id) => !cx.m.users[id] && !ids);
  const list = [...people.map(([id, u]) => ({ id, name: u.name, pb: u.pb })), ...extra.map((id) => ({ id, name: id, pb: '' }))].map((p) => {
    const l = rows.filter((r) => r.user_id === p.id);
    const lich = lichOf(s, p.id, p.pb);
    return { ...p, lich: lich.ten, kieu: lich.kieu, ...tongNgay(l as Luot[], lich, ngay, ngay === today, { ca: xep.get(p.id + '|' + ngay) ?? null, q: s.quyTac }), luot: l.map((r) => ({ loai: r.loai, at: r.at, kc: r.kc, diem: r.diem, trong: r.trong, ly_do: r.ly_do, acc: r.acc })) };
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
  const xep = days.length ? await loadXep(db, s, days[0], days[days.length - 1]) : new Map<string, Ca>();
  const list = people.map(([id, u]) => {
    const mine = rows.filter((r) => r.user_id === id);
    const lich = lichOf(s, id, u.pb);
    const ngay = days.map((d) => ({ ngay: d, ...tongNgay(mine.filter((r) => r.ngay === d) as Luot[], lich, d, d === today, { ca: xep.get(id + '|' + d) ?? null, q: s.quyTac }) }));
    return {
      id,
      name: u.name,
      pb: u.pb,
      lich: lich.ten,
      kieu: lich.kieu,
      chuyenCanCo: lich.chuyenCan && lich.kieu !== 'tudo',
      ...tongThang(ngay, lich, today, s.quyTac),
      ngay: ngay.map((x) => ({ n: x.ngay, vao: x.vao, ra: x.ra, muon: x.muon, som: x.som, phut: x.phut, quenRa: x.quenRa, ngoai: x.ngoai, lam: x.lam, ca: x.ca, lyDoMuon: x.lyDoMuon, canhBao: x.canhBao })),
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

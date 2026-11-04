import { Hono } from 'hono';
import { nowIso, vnDate } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { bellTo, hrPrivate, hubPeople } from '../lib/hubBell';
import { canHr } from '../lib/hrAccess';
import { requirePermission } from '../middleware/rbac';
import { loadMembers, type Members } from '../services/daoTao';
import { lichOf } from '../services/chamCong';
import {
  coTheDuyet,
  kyTamUng,
  LOAI_DON,
  LOAI_NGHI,
  leadsCuaPhong,
  sauLeadDuyet,
  soNgayNghi,
  trangThaiDau,
  type Buoi,
  type LoaiDon,
  type TrangThai,
} from '../services/nghiPhep';
import { loadSettings, resetDonCache } from './chamCong';

/**
 * Nghỉ phép & tăng ca, tạm ứng lương, phiếu lương của tôi (hub/src/nghiphep.js). Quy tắc ở services/nghiPhep.ts.
 * Nhân viên: gửi đơn, đề nghị tạm ứng, xem phiếu lương của mình. Lead: duyệt đơn phòng mình.
 * HCNS / CEO: duyệt vòng 2, xem mọi đơn, quỹ phép. Kế toán / CEO: duyệt tạm ứng.
 */
export const nghiPhepRoutes = new Hono<AppEnv>();
nghiPhepRoutes.use('*', requirePermission('hub.access'));

type DonRow = {
  id: string; user_id: string; pb: string | null; loai: LoaiDon; tu: string; den: string; buoi: Buoi; so_ngay: number; gio: number | null;
  ghi_chu: string | null; ly_do: string; st: TrangThai; lead_id: string | null; lead_at: string | null; hcns_id: string | null; hcns_at: string | null;
  tu_choi: string | null; created_at: string; updated_at: string;
};
type TuRow = { id: string; user_id: string; so_tien: number; ly_do: string; ky: string; st: 'kt' | 'xong' | 'tuchoi' | 'huy'; kt_id: string | null; kt_at: string | null; tu_choi: string | null; created_at: string };
const NGAY = /^\d{4}-\d{2}-\d{2}$/;

/** Người đang dùng: có phải HCNS / CEO (duyệt vòng 2), Lead phòng nào, Kế toán (duyệt tạm ứng), được xem dữ liệu nhân sự không. */
async function viewer(db: D1Database, auth: AuthContext): Promise<{ id: string; hcns: boolean; leadPb: string | null; ketoan: boolean; xemHr: boolean; m: Members }> {
  const [m, xemHr] = await Promise.all([loadMembers(db, auth.user.id), canHr(db, auth)]);
  const me = m.users[auth.user.id];
  const ceo = auth.user.role === 'CEO' || me?.role === 'admin';
  const hcns = ceo || !!me?.hr;
  const leadPb = me && ['lead', 'truongphong'].includes(me.role) && me.pb ? me.pb : null;
  return { id: auth.user.id, hcns, leadPb, ketoan: ceo || auth.permissions.includes('debt.read.all'), xemHr, m };
}
const nameOf = (m: Members, id: string | null) => (id ? m.users[id]?.name || id : '');
const pbName = (m: Members, k: string | null) => (k ? m.deps.find((d) => d.k === k)?.n ?? k : '');
const donView = (m: Members, d: DonRow) => ({
  ...d,
  ten: nameOf(m, d.user_id),
  pbTen: pbName(m, d.pb),
  loaiTen: LOAI_DON[d.loai],
  leadTen: nameOf(m, d.lead_id),
  hcnsTen: nameOf(m, d.hcns_id),
});

/** Người nhận chuông: Lead phòng, HCNS (phòng HCNS / quyền quản lý nhân sự) + CEO, Kế toán. */
function hcnsIds(m: Members): string[] {
  const hr = Object.entries(m.users).filter(([, u]) => u.hr && u.role !== 'admin').map(([id]) => id);
  return hr.length ? hr : Object.entries(m.users).filter(([, u]) => u.role === 'admin').map(([id]) => id);
}
async function ketoanIds(db: D1Database): Promise<string[]> {
  const rows = await db
    .prepare("SELECT DISTINCT user_id AS id FROM user_permissions WHERE permission = 'debt.read.all'")
    .all<{ id: string }>();
  return (rows.results ?? []).map((r) => r.id);
}
async function ceoIds(db: D1Database): Promise<string[]> {
  const rows = await db.prepare("SELECT id FROM users WHERE role = 'CEO' AND status = 'ACTIVE'").all<{ id: string }>();
  return (rows.results ?? []).map((r) => r.id);
}

/** Quỹ phép năm của một người: được hưởng (HCNS nhập ở hồ sơ, mặc định 12), đã nghỉ trước đây, đã nghỉ theo đơn mới trong năm. */
async function quyPhep(db: D1Database, userIds: string[], nam: string) {
  const [hr, ppl, rows] = await Promise.all([
    hrPrivate(db),
    hubPeople(db),
    db
      .prepare("SELECT user_id, SUM(so_ngay) AS n FROM ns_don WHERE loai = 'phep' AND st = 'xong' AND tu LIKE ? GROUP BY user_id")
      .bind(nam + '%')
      .all<{ user_id: string; n: number }>(),
  ]);
  const moi = new Map((rows.results ?? []).map((r) => [r.user_id, r.n]));
  return userIds.map((id) => {
    const ma = ppl.get(id)?.maNS ?? '';
    const p = (ma && hr.phep?.[ma]) || {};
    const huong = Number(p.huong ?? 12);
    const daCu = Number(p.da ?? 0);
    const daMoi = Number(moi.get(id) ?? 0);
    return { id, ma, huong, daCu, daMoi, con: Math.round((huong - daCu - daMoi) * 10) / 10 };
  });
}

/* ---------------- Nhân viên ---------------- */
nghiPhepRoutes.get('/me', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const today = vnDate();
  const [s, don, tu, qp] = await Promise.all([
    loadSettings(db),
    db.prepare('SELECT * FROM ns_don WHERE user_id = ? ORDER BY created_at DESC LIMIT 60').bind(auth.user.id).all<DonRow>(),
    db.prepare('SELECT * FROM ns_tamung WHERE user_id = ? ORDER BY created_at DESC LIMIT 24').bind(auth.user.id).all<TuRow>(),
    quyPhep(db, [auth.user.id], today.slice(0, 4)),
  ]);
  const m = await loadMembers(db, auth.user.id);
  return ok(c, {
    today,
    phep: qp[0],
    quyTac: { mocVong2: s.quyTac.mocVong2, tuMax: s.quyTac.tuMax },
    loai: LOAI_DON,
    don: (don.results ?? []).map((d) => donView(m, d)),
    tamung: tu.results ?? [],
  });
});

nghiPhepRoutes.post('/don', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const loai = String(b.loai ?? '') as LoaiDon;
  if (!LOAI_DON[loai]) throw badRequest('LOAI', 'Chọn loại đơn');
  const tu = String(b.tu ?? '');
  const den = loai === 'vesom' || loai === 'ot' ? tu : String(b.den ?? tu);
  if (!NGAY.test(tu) || !NGAY.test(den) || den < tu) throw badRequest('NGAY', 'Ngày chưa đúng: đến ngày phải từ ngày trở đi');
  if (Date.parse(den) - Date.parse(tu) > 61 * 864e5) throw badRequest('NGAY', 'Một đơn tối đa 2 tháng');
  const buoi: Buoi = LOAI_NGHI.includes(loai) && (b.buoi === 'sang' || b.buoi === 'chieu') && tu === den ? b.buoi : 'ca';
  const lyDo = String(b.lyDo ?? '').trim().slice(0, 400);
  if (!lyDo) throw badRequest('LY_DO', 'Ghi lý do');
  const gio = loai === 'ot' ? Number(b.gio) : null;
  if (loai === 'ot' && !(gio! > 0 && gio! <= 16)) throw badRequest('GIO', 'Ghi số giờ tăng ca (0,5 đến 16 giờ)');
  const ghiChu = String(b.ghiChu ?? '').trim().slice(0, 120) || null;
  const [s, m] = await Promise.all([loadSettings(db), loadMembers(db, auth.user.id)]);
  const me = m.users[auth.user.id];
  const pb = me?.pb ?? '';
  const lich = lichOf(s, auth.user.id, pb);
  const soNgay = LOAI_NGHI.includes(loai) ? soNgayNghi(lich, tu, den, buoi, s.ngayLe.map((x) => x.ngay)) : 0;
  if (LOAI_NGHI.includes(loai) && !soNgay) throw badRequest('NGAY', 'Khoảng ngày này không có ngày làm việc nào (Chủ nhật, ngày nghỉ, ngày lễ)');
  const leads = leadsCuaPhong(m.users, pb, auth.user.id);
  const st = trangThaiDau(leads.length > 0);
  const id = crypto.randomUUID();
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO ns_don (id, user_id, pb, loai, tu, den, buoi, so_ngay, gio, ghi_chu, ly_do, st, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, auth.user.id, pb || null, loai, tu, den, buoi, soNgay, gio, ghiChu, lyDo, st, now, now),
    auditStatement(db, { actorId: auth.user.id, action: 'NS_DON_GUI', entityType: 'NS_DON', entityId: id, after: { loai, tu, den, soNgay, st } }),
  ]);
  const ten = me?.name || auth.user.id;
  const mo = LOAI_NGHI.includes(loai) ? ` ${soNgay} ngày (${tu.slice(8)}/${tu.slice(5, 7)}${den !== tu ? '–' + den.slice(8) + '/' + den.slice(5, 7) : ''})` : '';
  await bellTo(db, st === 'lead' ? leads : hcnsIds(m), `${ten} gửi đơn ${LOAI_DON[loai].toLowerCase()}${mo}, chờ bạn duyệt`, st === 'lead' ? 'page:np_duyet' : 'page:np_ql');
  return ok(c, { id, st, soNgay });
});

nghiPhepRoutes.post('/don/:id/huy', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const res = await db
    .prepare("UPDATE ns_don SET st = 'huy', updated_at = ? WHERE id = ? AND user_id = ? AND st IN ('lead', 'hcns')")
    .bind(nowIso(), c.req.param('id'), auth.user.id)
    .run();
  if (!res.meta.changes) throw badRequest('HUY', 'Đơn đã được duyệt hoặc không còn, không rút lại được');
  return ok(c, { id: c.req.param('id') });
});

/* ---------------- Lead, HCNS: duyệt ---------------- */
nghiPhepRoutes.get('/duyet', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const v = await viewer(db, auth);
  if (!v.hcns && !v.leadPb && !v.xemHr) throw forbidden('Chỉ Lead, HCNS, CEO xem được đơn của người khác');
  const tu = NGAY.test(c.req.query('tu') ?? '') ? (c.req.query('tu') as string) : vnDate(new Date(Date.now() - 62 * 864e5));
  const all = !!(v.hcns || v.xemHr);
  const rows = (
    await (all
      ? db.prepare("SELECT * FROM ns_don WHERE st IN ('lead', 'hcns') OR tu >= ? ORDER BY created_at DESC LIMIT 400").bind(tu)
      : db.prepare("SELECT * FROM ns_don WHERE pb = ? AND (st IN ('lead', 'hcns') OR tu >= ?) ORDER BY created_at DESC LIMIT 200").bind(v.leadPb, tu)
    ).all<DonRow>()
  ).results ?? [];
  const list = rows.map((d) => ({ ...donView(v.m, d), duyet: coTheDuyet(d, { id: v.id, hr: v.hcns, leadPb: v.leadPb }) }));
  const ids = all ? Object.keys(v.m.users) : Object.entries(v.m.users).filter(([, u]) => u.pb === v.leadPb).map(([id]) => id);
  const phep = all ? (await quyPhep(db, ids, vnDate().slice(0, 4))).map((p) => ({ ...p, ten: nameOf(v.m, p.id), pbTen: pbName(v.m, v.m.users[p.id]?.pb ?? '') })) : [];
  const s = await loadSettings(db);
  return ok(c, { vai: { hcns: v.hcns, leadPb: v.leadPb, pbTen: pbName(v.m, v.leadPb), all }, mocVong2: s.quyTac.mocVong2, list, phep, deps: v.m.deps });
});

nghiPhepRoutes.post('/don/:id/duyet', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as { ok?: boolean; note?: string };
  const d = await db.prepare('SELECT * FROM ns_don WHERE id = ?').bind(c.req.param('id')).first<DonRow>();
  if (!d) throw notFound();
  const v = await viewer(db, auth);
  if (!coTheDuyet(d, { id: v.id, hr: v.hcns, leadPb: v.leadPb })) throw forbidden('Bạn không duyệt được đơn này ở bước hiện tại');
  const note = String(b.note ?? '').trim().slice(0, 300);
  if (!b.ok && !note) throw badRequest('LY_DO', 'Ghi lý do từ chối');
  const s = await loadSettings(db);
  const now = nowIso();
  let st: TrangThai;
  if (!b.ok) st = 'tuchoi';
  else if (d.st === 'lead' && !v.hcns) st = sauLeadDuyet(d.loai, d.so_ngay, s.quyTac.mocVong2);
  else st = 'xong'; // HCNS / CEO duyệt (vòng 2, hoặc thay Lead) là xong
  const isLeadStep = d.st === 'lead';
  await db.batch([
    db
      .prepare(
        `UPDATE ns_don SET st = ?, tu_choi = ?, updated_at = ?,
           lead_id = CASE WHEN ? THEN ? ELSE lead_id END, lead_at = CASE WHEN ? THEN ? ELSE lead_at END,
           hcns_id = CASE WHEN ? THEN ? ELSE hcns_id END, hcns_at = CASE WHEN ? THEN ? ELSE hcns_at END
         WHERE id = ? AND st = ?`,
      )
      .bind(st, b.ok ? null : note, now, isLeadStep ? 1 : 0, v.id, isLeadStep ? 1 : 0, now, isLeadStep ? 0 : 1, v.id, isLeadStep ? 0 : 1, now, d.id, d.st),
    auditStatement(db, { actorId: v.id, action: b.ok ? 'NS_DON_DUYET' : 'NS_DON_TUCHOI', entityType: 'NS_DON', entityId: d.id, before: { st: d.st }, after: { st, note } }),
  ]);
  resetDonCache();
  const loai = LOAI_DON[d.loai].toLowerCase();
  const ngay = `${d.tu.slice(8)}/${d.tu.slice(5, 7)}`;
  if (st === 'hcns') {
    await bellTo(db, hcnsIds(v.m), `Đơn ${loai} ${d.so_ngay} ngày của ${nameOf(v.m, d.user_id)} đã được Lead duyệt, chờ HCNS duyệt vòng 2`, 'page:np_ql');
    await bellTo(db, [d.user_id], `Lead đã duyệt đơn ${loai} ngày ${ngay} của bạn, đang chờ HCNS duyệt tiếp`, 'page:np_toi');
  } else {
    await bellTo(db, [d.user_id], st === 'xong' ? `Đơn ${loai} ngày ${ngay} của bạn đã được duyệt` : `Đơn ${loai} ngày ${ngay} của bạn bị từ chối: ${note}`, 'page:np_toi');
    if (st === 'xong' && d.loai === 'ot' && !v.hcns)
      await bellTo(db, hcnsIds(v.m), `Đã duyệt tăng ca ${d.gio ?? ''} giờ ngày ${ngay} cho ${nameOf(v.m, d.user_id)}`, 'page:np_ql');
  }
  return ok(c, { id: d.id, st });
});

/* ---------------- Tạm ứng lương ---------------- */
nghiPhepRoutes.post('/tamung', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const soTien = Math.round(Number(b.soTien));
  const lyDo = String(b.lyDo ?? '').trim().slice(0, 300);
  const s = await loadSettings(db);
  if (!(soTien > 0)) throw badRequest('TIEN', 'Ghi số tiền cần tạm ứng');
  if (s.quyTac.tuMax && soTien >= s.quyTac.tuMax) throw badRequest('TIEN', `Tạm thời chỉ cho ứng dưới ${s.quyTac.tuMax.toLocaleString('vi-VN')}đ một lần`);
  if (!lyDo) throw badRequest('LY_DO', 'Ghi lý do');
  const id = crypto.randomUUID();
  const now = nowIso();
  const ky = kyTamUng(vnDate());
  await db.batch([
    db
      .prepare('INSERT INTO ns_tamung (id, user_id, so_tien, ly_do, ky, st, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, auth.user.id, soTien, lyDo, ky, 'kt', now, now),
    auditStatement(db, { actorId: auth.user.id, action: 'NS_TU_GUI', entityType: 'NS_TAMUNG', entityId: id, after: { soTien, ky } }),
  ]);
  const m = await loadMembers(db, auth.user.id);
  const to = await ketoanIds(db);
  await bellTo(db, to.length ? to : await ceoIds(db), `${nameOf(m, auth.user.id)} đề nghị tạm ứng ${soTien.toLocaleString('vi-VN')}đ, chờ duyệt`, 'page:tu_ql');
  return ok(c, { id, st: 'kt' });
});

nghiPhepRoutes.post('/tamung/:id/huy', async (c) => {
  const auth = c.get('auth');
  const res = await c.env.DB.prepare("UPDATE ns_tamung SET st = 'huy', updated_at = ? WHERE id = ? AND user_id = ? AND st = 'kt'")
    .bind(nowIso(), c.req.param('id'), auth.user.id)
    .run();
  if (!res.meta.changes) throw badRequest('HUY', 'Đề nghị đã được xử lý, không rút lại được');
  return ok(c, { id: c.req.param('id') });
});

/** Danh sách tạm ứng: Kế toán, CEO duyệt; HCNS xem (và bảng lương lấy khoản đã duyệt). */
nghiPhepRoutes.get('/tamung', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const v = await viewer(db, auth);
  if (!v.ketoan && !v.xemHr) throw forbidden('Chỉ Kế toán, HCNS, CEO xem được tạm ứng của mọi người');
  const ky = /^\d{4}-\d{2}$/.test(c.req.query('ky') ?? '') ? (c.req.query('ky') as string) : '';
  const rows = (
    await (ky
      ? db.prepare('SELECT * FROM ns_tamung WHERE ky = ? ORDER BY created_at DESC').bind(ky)
      : db.prepare("SELECT * FROM ns_tamung WHERE st = 'kt' OR created_at >= ? ORDER BY created_at DESC LIMIT 400").bind(vnDate(new Date(Date.now() - 92 * 864e5)))
    ).all<TuRow>()
  ).results ?? [];
  const ppl = await hubPeople(db);
  const s = await loadSettings(db);
  return ok(c, {
    vai: { duyet: v.ketoan },
    tuMax: s.quyTac.tuMax,
    list: rows.map((r) => ({ ...r, ten: nameOf(v.m, r.user_id), pbTen: pbName(v.m, v.m.users[r.user_id]?.pb ?? ''), ma: ppl.get(r.user_id)?.maNS ?? '', ktTen: nameOf(v.m, r.kt_id) })),
  });
});

nghiPhepRoutes.post('/tamung/:id/duyet', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const v = await viewer(db, auth);
  if (!v.ketoan) throw forbidden('Chỉ Kế toán hoặc CEO duyệt tạm ứng');
  const b = (await c.req.json().catch(() => ({}))) as { ok?: boolean; note?: string };
  const note = String(b.note ?? '').trim().slice(0, 300);
  if (!b.ok && !note) throw badRequest('LY_DO', 'Ghi lý do từ chối');
  const r = await db.prepare('SELECT * FROM ns_tamung WHERE id = ?').bind(c.req.param('id')).first<TuRow>();
  if (!r) throw notFound();
  if (r.st !== 'kt') throw badRequest('XONG', 'Đề nghị này đã được xử lý');
  const now = nowIso();
  const st = b.ok ? 'xong' : 'tuchoi';
  await db.batch([
    db.prepare("UPDATE ns_tamung SET st = ?, kt_id = ?, kt_at = ?, tu_choi = ?, updated_at = ? WHERE id = ? AND st = 'kt'").bind(st, v.id, now, b.ok ? null : note, now, r.id),
    auditStatement(db, { actorId: v.id, action: b.ok ? 'NS_TU_DUYET' : 'NS_TU_TUCHOI', entityType: 'NS_TAMUNG', entityId: r.id, after: { st, soTien: r.so_tien, note } }),
  ]);
  const tien = r.so_tien.toLocaleString('vi-VN') + 'đ';
  await bellTo(db, [r.user_id], b.ok ? `Đề nghị tạm ứng ${tien} của bạn đã được duyệt, sẽ trừ vào lương tháng ${r.ky.slice(5)}/${r.ky.slice(0, 4)}` : `Đề nghị tạm ứng ${tien} bị từ chối: ${note}`, 'page:tu_toi');
  return ok(c, { id: r.id, st });
});

/* ---------------- Phiếu lương của tôi ---------------- */
nghiPhepRoutes.get('/phieu-luong', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const [hr, ppl, xem] = await Promise.all([
    hrPrivate(db),
    hubPeople(db),
    db.prepare('SELECT ky, xem_at FROM ns_pl_xem WHERE user_id = ?').bind(auth.user.id).all<{ ky: string; xem_at: string }>(),
  ]);
  const ma = ppl.get(auth.user.id)?.maNS ?? '';
  const seen = new Map((xem.results ?? []).map((r) => [r.ky, r.xem_at]));
  const list = !ma
    ? []
    : Object.entries(hr.payroll ?? {})
        .filter(([, p]) => p?.st === 'phathanh')
        .map(([ky, p]) => ({ ky, ph: p.ph ?? '', row: (p.rows ?? []).find((r) => r?.ma === ma) ?? null, xem: seen.get(ky) ?? null }))
        .filter((x) => x.row)
        .sort((a, b) => b.ky.localeCompare(a.ky));
  return ok(c, { ma, list });
});

nghiPhepRoutes.post('/phieu-luong/:ky/xem', async (c) => {
  const auth = c.get('auth');
  await c.env.DB.prepare('INSERT OR IGNORE INTO ns_pl_xem (user_id, ky, xem_at) VALUES (?, ?, ?)').bind(auth.user.id, c.req.param('ky').slice(0, 7), nowIso()).run();
  return ok(c, { ky: c.req.param('ky') });
});

nghiPhepRoutes.post('/phieu-luong/:ky/hoi', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as { noiDung?: string };
  const nd = String(b.noiDung ?? '').trim().slice(0, 600);
  if (!nd) throw badRequest('ND', 'Ghi điều cần hỏi');
  const ky = c.req.param('ky').slice(0, 7);
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO ns_pl_hoi (id, user_id, ky, noi_dung, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, auth.user.id, ky, nd, nowIso()).run();
  const m = await loadMembers(db, auth.user.id);
  await bellTo(db, hcnsIds(m), `${nameOf(m, auth.user.id)} hỏi về phiếu lương tháng ${ky.slice(5)}/${ky.slice(0, 4)}: ${nd.slice(0, 80)}`, 'page:hr_pl');
  return ok(c, { id });
});

/** HCNS: ai đã xem phiếu lương kỳ nào, câu hỏi về phiếu lương. */
nghiPhepRoutes.get('/phieu-luong-hcns', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const v = await viewer(db, auth);
  if (!v.xemHr) throw forbidden();
  const ky = (c.req.query('ky') ?? '').slice(0, 7);
  const [xem, hoi, ppl] = await Promise.all([
    db.prepare('SELECT user_id, xem_at FROM ns_pl_xem WHERE ky = ?').bind(ky).all<{ user_id: string; xem_at: string }>(),
    db.prepare('SELECT * FROM ns_pl_hoi WHERE ky = ? ORDER BY created_at DESC').bind(ky).all<{ id: string; user_id: string; noi_dung: string; tra_loi: string | null; created_at: string }>(),
    hubPeople(db),
  ]);
  return ok(c, {
    xem: (xem.results ?? []).map((r) => ({ ma: ppl.get(r.user_id)?.maNS ?? '', at: r.xem_at })),
    hoi: (hoi.results ?? []).map((r) => ({ ...r, ten: nameOf(v.m, r.user_id) })),
  });
});

nghiPhepRoutes.post('/phieu-luong/hoi/:id/tra-loi', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const v = await viewer(db, auth);
  if (!v.hcns) throw forbidden('Chỉ HCNS trả lời được');
  const b = (await c.req.json().catch(() => ({}))) as { traLoi?: string };
  const t = String(b.traLoi ?? '').trim().slice(0, 600);
  if (!t) throw badRequest('ND', 'Ghi câu trả lời');
  const r = await db.prepare('SELECT user_id, ky FROM ns_pl_hoi WHERE id = ?').bind(c.req.param('id')).first<{ user_id: string; ky: string }>();
  if (!r) throw notFound();
  await db.prepare('UPDATE ns_pl_hoi SET tra_loi = ?, tra_loi_by = ?, tra_loi_at = ? WHERE id = ?').bind(t, v.id, nowIso(), c.req.param('id')).run();
  await bellTo(db, [r.user_id], `HCNS trả lời câu hỏi phiếu lương tháng ${r.ky.slice(5)}: ${t.slice(0, 80)}`, 'page:pl_toi');
  return ok(c, { id: c.req.param('id') });
});

/** Số việc đang chờ mình (huy hiệu trên menu). */
nghiPhepRoutes.get('/cho', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const v = await viewer(db, auth);
  const [lead, hcns, tu] = await Promise.all([
    v.leadPb ? db.prepare("SELECT COUNT(*) AS n FROM ns_don WHERE st = 'lead' AND pb = ? AND user_id <> ?").bind(v.leadPb, v.id).first<{ n: number }>() : null,
    v.hcns ? db.prepare("SELECT COUNT(*) AS n FROM ns_don WHERE st = 'hcns'").first<{ n: number }>() : null,
    v.ketoan ? db.prepare("SELECT COUNT(*) AS n FROM ns_tamung WHERE st = 'kt'").first<{ n: number }>() : null,
  ]);
  return ok(c, { lead: lead?.n ?? 0, hcns: hcns?.n ?? 0, tu: tu?.n ?? 0, vai: { hcns: v.hcns, leadPb: v.leadPb, ketoan: v.ketoan, xemHr: v.xemHr } });
});


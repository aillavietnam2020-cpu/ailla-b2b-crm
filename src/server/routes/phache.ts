/**
 * PHA CHẾ (chị Hoa duyệt demo 07/11/2026).
 * - Yêu cầu pha chế: sổ riêng pc_req (trước nằm trong ngăn Sản xuất pcReq). "Đã pha" suy ra từ phiếu pha chế gắn mã yêu cầu.
 * - Công thức của Kỹ thuật (pc_recipe): số cho 1 lít bán thành phẩm + hướng dẫn pha. Kỹ thuật lập thì chờ Trưởng kỹ thuật
 *   (quyền sx.congthuc) duyệt; Trưởng kỹ thuật / CEO tự nhập thì dùng ngay. Bản cũ giữ làm lịch sử.
 * - Báo tồn tại xưởng (pc_count): chỉ để báo đặt hàng và lệch kho, KHÔNG sửa sổ kho.
 * - Hao hụt: đọc phiếu pha chế (kho_docs type PC) so số thực tế với số theo công thức.
 * Việc giao (Công việc) tạo ở trình duyệt vào bản chung (D().tasks), không tạo việc CRM nữa.
 */
import { Hono } from 'hono';
import { nowIso, vnDate } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { requirePermission } from '../middleware/rbac';
import { unpack } from '../lib/pack';
import { khoTonRows } from '../services/khoTon';
import { accountantIds, approverIds } from '../lib/notifyTasks';
import { bellTo } from '../lib/hubBell';
import { kyThuatIds } from './kho';

export const phacheRoutes = new Hono<AppEnv>();
phacheRoutes.use('*', requirePermission('hub.access'));

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN);
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);
/** Lệch quá 5% so với công thức thì coi là lệch (cùng ngưỡng với phiếu pha chế). */
export const PC_TOL_PCT = 5;
/** Báo tồn: số đếm khác tồn web quá 2% (và quá 0,5 đơn vị) thì là lệch kho. */
export const pcLechKho = (dem: number, web: number) => Math.abs(dem - web) > Math.max(0.5, Math.abs(web) * 0.02);

type HubUser = { id?: string; crm?: string; perms?: string[]; role?: string; active?: boolean; name?: string };
async function hubUsers(db: D1Database): Promise<HubUser[]> {
  try {
    const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
    return row ? ((JSON.parse(await unpack(row.data)) as { users?: HubUser[] }).users ?? []) : [];
  } catch {
    return [];
  }
}
/** Trưởng kỹ thuật = người có quyền "Duyệt công thức pha chế" (sx.congthuc) ở hồ sơ web chung; CEO cũng được. */
async function canApproveRecipe(db: D1Database, auth: AuthContext): Promise<boolean> {
  if (auth.user.role === 'CEO') return true;
  const me = (await hubUsers(db)).find((u) => u.crm && u.crm === auth.user.id);
  return !!me && (me.perms ?? []).includes('sx.congthuc');
}

/** Người nhận việc (mã tài khoản CRM): Quản lý mua hàng = người duyệt đơn / mua hàng (không tính CEO, như việc thiếu vật tư);
 * trình duyệt đổi sang người dùng web chung qua users[].crm. */
phacheRoutes.get('/nguoi', async (c) => {
  const all = await approverIds(c.env.DB);
  const ceo = new Set(((await c.env.DB.prepare("SELECT id FROM users WHERE role = 'CEO'").all<{ id: string }>()).results ?? []).map((x) => x.id));
  const mua = all.filter((x) => !ceo.has(x));
  return ok(c, { mua_hang: mua.length ? mua : all, ke_toan: await accountantIds(c.env.DB) });
});

/* ---------------- Yêu cầu pha chế ---------------- */
type ReqRow = { id: string; btp: string; lit: number; lit_bon: number | null; bon: number; ngay: string; han: string | null; ghi_chu: string; status: string; created_by_name: string; created_at: string; huy_by_name: string | null; ly_do_huy: string | null; huy_at: string | null };

/** Lần đầu: chép các yêu cầu cũ trong ngăn Sản xuất (hub_state 'sx'.pcReq) sang sổ mới. Chạy lại không sao (bỏ qua mã đã có). */
async function importOld(db: D1Database): Promise<number> {
  const n = await db.prepare('SELECT COUNT(*) AS n FROM pc_req').first<{ n: number }>();
  if ((n?.n ?? 0) > 0) return 0;
  let L: Array<Record<string, unknown>> = [];
  try {
    const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'sx'").first<{ data: string }>();
    if (row) L = ((JSON.parse(await unpack(row.data)) as { pcReq?: Array<Record<string, unknown>> }).pcReq ?? []) as Array<Record<string, unknown>>;
  } catch {
    L = [];
  }
  const now = nowIso();
  const st = L.filter((r) => str(r.id) && str(r.btp)).map((r) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO pc_req (id, btp, lit, lit_bon, bon, ngay, han, ghi_chu, status, created_by_name, created_at, huy_by_name, ly_do_huy, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        str(r.id, 40), str(r.btp, 60), num(r.lit) || 0, Number.isFinite(num(r.litBon)) ? num(r.litBon) : null, num(r.bon) || 1,
        isDate(r.taoLuc) ? r.taoLuc : vnDate(), isDate(r.han) ? r.han : null, str(r.ghiChu), r.st === 'HUY' ? 'HUY' : 'CHO_LAM',
        str(r.tao, 80), str(r.at, 40) || now, r.st === 'HUY' ? str(r.huyBy, 80) : null, r.st === 'HUY' ? str(r.lyDoHuy) : null, now,
      ),
  );
  if (st.length) await db.batch(st);
  return st.length;
}

phacheRoutes.get('/yc', async (c) => {
  await importOld(c.env.DB);
  const rows = await c.env.DB.prepare(
    `SELECT r.*, d.id AS doc_id, d.no AS doc_no, d.doc_date AS doc_date, d.extra AS doc_extra, u.display_name AS doc_by
     FROM pc_req r LEFT JOIN kho_docs d ON d.id = (SELECT MAX(x.id) FROM kho_docs x WHERE x.type = 'PC' AND x.status = 'OK' AND x.ref_no = r.id)
     LEFT JOIN users u ON u.id = d.created_by
     ORDER BY r.ngay DESC, r.id DESC LIMIT 500`,
  ).all<ReqRow & { doc_id: number | null; doc_no: string | null; doc_date: string | null; doc_extra: string | null; doc_by: string | null }>();
  return ok(c, rows.results ?? []);
});

function reqCode(ngay: string, used: Set<string>): string {
  const base = `YCPC${ngay.slice(2, 4)}${ngay.slice(5, 7)}-`;
  let n = 1;
  while (used.has(base + String(n).padStart(3, '0'))) n++;
  const id = base + String(n).padStart(3, '0');
  used.add(id);
  return id;
}

phacheRoutes.post('/yc', async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => null)) as { ngay?: unknown; han?: unknown; ghi_chu?: unknown; items?: Array<Record<string, unknown>> } | null;
  const ngay = isDate(b?.ngay) ? b!.ngay : vnDate();
  const han = isDate(b?.han) ? b!.han : null;
  const items = (Array.isArray(b?.items) ? b!.items : []).slice(0, 30);
  if (!items.length) throw badRequest('NO_ITEMS', 'Chưa có bán thành phẩm nào');
  const codes = items.map((x) => str(x.btp, 60));
  const ph = codes.map(() => '?').join(',');
  const found = new Map(
    ((await c.env.DB.prepare(`SELECT code, cls FROM kho_items WHERE code IN (${ph})`).bind(...codes).all<{ code: string; cls: string }>()).results ?? []).map((r) => [r.code, r.cls]),
  );
  for (const [i, x] of items.entries()) {
    if (found.get(codes[i]) !== 'BTP') throw badRequest('NOT_BTP', `${codes[i] || '(trống)'} không phải bán thành phẩm`);
    if (!(num(x.lit_bon) > 0)) throw badRequest('BAD_LIT', `Số lít của ${codes[i]} phải lớn hơn 0`);
  }
  await importOld(c.env.DB);
  const used = new Set(((await c.env.DB.prepare('SELECT id FROM pc_req WHERE id LIKE ?').bind(`YCPC${ngay.slice(2, 4)}${ngay.slice(5, 7)}-%`).all<{ id: string }>()).results ?? []).map((r) => r.id));
  const now = nowIso();
  const out: Array<{ id: string; btp: string; lit: number }> = [];
  const st = items.map((x, i) => {
    const lb = num(x.lit_bon);
    const bon = num(x.bon) > 0 ? num(x.bon) : 1;
    const id = reqCode(ngay, used);
    out.push({ id, btp: codes[i], lit: r6(lb * bon) });
    return c.env.DB.prepare(
      `INSERT INTO pc_req (id, btp, lit, lit_bon, bon, ngay, han, ghi_chu, status, created_by, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CHO_LAM', ?, ?, ?, ?)`,
    ).bind(id, codes[i], r6(lb * bon), lb, bon, ngay, han, str(b?.ghi_chu), auth.user.id, auth.user.display_name, now, now);
  });
  await c.env.DB.batch(st);
  for (const o of out) await reqLog(c.env.DB, o.id, 'TAO', 'MH', auth, `Tạo yêu cầu ${o.id} · ${o.lit} lít · hạn ${ddmm(han)}`, null, han);
  return ok(c, out);
});

/** Sửa (chưa pha) hoặc hủy yêu cầu. */
phacheRoutes.patch('/yc/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await c.env.DB.prepare('SELECT * FROM pc_req WHERE id = ?').bind(id).first<ReqRow>();
  if (!r) throw notFound('Không có yêu cầu này');
  const done = await c.env.DB.prepare("SELECT no FROM kho_docs WHERE type = 'PC' AND status = 'OK' AND ref_no = ?").bind(id).first<{ no: string }>();
  if (done) throw badRequest('DA_PHA', `Yêu cầu ${id} đã pha (phiếu ${done.no}), không sửa hay hủy được`);
  if (r.status === 'HUY') throw badRequest('DA_HUY', 'Yêu cầu đã hủy');
  const now = nowIso();
  if (b?.huy) {
    const ly = str(b.ly_do);
    if (!ly) throw badRequest('NO_REASON', 'Cần ghi lý do hủy');
    await c.env.DB.prepare("UPDATE pc_req SET status = 'HUY', ly_do_huy = ?, huy_by_name = ?, huy_at = ?, updated_at = ? WHERE id = ?")
      .bind(ly, auth.user.display_name, now, now, id)
      .run();
    // Việc pha chế cũ (bảng việc CRM, trước 07/11) cũng xong theo.
    await c.env.DB.prepare("UPDATE tasks SET status = 'DONE', completed_at = ?, updated_at = ? WHERE status = 'OPEN' AND title LIKE ?").bind(now, now, `Pha chế theo yêu cầu ${id}:%`).run();
    return ok(c, { id, status: 'HUY' });
  }
  const btp = str(b?.btp, 60) || r.btp;
  const it = await c.env.DB.prepare('SELECT cls FROM kho_items WHERE code = ?').bind(btp).first<{ cls: string }>();
  if (it?.cls !== 'BTP') throw badRequest('NOT_BTP', `${btp} không phải bán thành phẩm`);
  const lb = num(b?.lit_bon);
  if (!(lb > 0)) throw badRequest('BAD_LIT', 'Số lít phải lớn hơn 0');
  const bon = num(b?.bon) > 0 ? num(b?.bon) : r.bon || 1;
  const hanMoi = isDate(b?.han) ? b!.han : null;
  const doiHan = (hanMoi ?? '') !== (r.han ?? '');
  await c.env.DB.prepare(`UPDATE pc_req SET btp = ?, lit_bon = ?, bon = ?, lit = ?, han = ?, ghi_chu = ?, updated_at = ?${doiHan ? ", tiep_nhan = 'CHO', xin_han = NULL, xin_ly = NULL" : ''} WHERE id = ?`)
    .bind(btp, lb, bon, r6(lb * bon), hanMoi, str(b?.ghi_chu), now, id)
    .run();
  if (doiHan) {
    await reqLog(c.env.DB, id, 'SUA', 'MH', auth, `Sửa yêu cầu, đổi hạn ${r.han ?? '—'} → ${hanMoi ?? '—'}. Kỹ thuật tiếp nhận lại.`, r.han, hanMoi);
    await bellTo(c.env.DB, await kyThuatIds(c.env.DB), `Yêu cầu pha chế ${id} đổi hạn sang ${hanMoi ?? '—'}. Mở Pha chế để tiếp nhận lại.`, 'kho_pc').catch(() => 0);
  }
  return ok(c, { id });
});

/* ---------------- Tiếp nhận / xin dời hạn / trao đổi (chị Hoa duyệt demo 18/11) ----------------
 * Kỹ thuật pha chế: Tiếp nhận, hoặc Xin dời hạn (ngày + lý do). Người tạo yêu cầu (Quản lý mua hàng) / CEO: Đồng ý ngày xin,
 * Đổi sang ngày khác, hoặc Giữ hạn cũ (lý do). Hai bên nhắn trao đổi. Mọi bước ghi vào pc_req_log. */
async function reqLog(db: D1Database, reqId: string, kind: string, ben: 'KT' | 'MH', auth: AuthContext, text: string, hanCu: string | null = null, hanMoi: string | null = null) {
  await db.prepare('INSERT INTO pc_req_log (req_id, kind, ben, by_id, by_name, text, han_cu, han_moi, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(reqId, kind, ben, auth.user.id, auth.user.display_name, text.slice(0, 2000), hanCu, hanMoi, nowIso())
    .run();
}
async function isKyThuat(db: D1Database, auth: AuthContext): Promise<boolean> {
  if (auth.actorType === 'AGENT') return false;
  if (auth.user.role === 'CEO') return true;
  const me = (await hubUsers(db)).find((u) => u.crm && u.crm === auth.user.id);
  return !!me && ((me.perms ?? []).includes('sx.kythuat') || (me.perms ?? []).includes('sx.congthuc'));
}
async function isNguoiTao(db: D1Database, auth: AuthContext, r: { created_by?: string | null }): Promise<boolean> {
  if (auth.actorType === 'AGENT') return false;
  if (auth.user.role === 'CEO' || (r.created_by && r.created_by === auth.user.id)) return true;
  return (await approverIds(db)).includes(auth.user.id);
}
/** Yêu cầu còn mở (chưa hủy, chưa có phiếu pha chế). */
async function reqOpen(db: D1Database, id: string) {
  const r = await db.prepare('SELECT * FROM pc_req WHERE id = ?').bind(id).first<ReqRow & { created_by: string | null; tiep_nhan: string; xin_han: string | null; xin_ly: string | null }>();
  if (!r) throw notFound('Không có yêu cầu này');
  if (r.status === 'HUY') throw badRequest('DA_HUY', 'Yêu cầu đã hủy');
  const done = await db.prepare("SELECT no FROM kho_docs WHERE type = 'PC' AND status = 'OK' AND ref_no = ?").bind(id).first<{ no: string }>();
  if (done) throw badRequest('DA_PHA', `Yêu cầu ${id} đã pha (phiếu ${done.no})`);
  return r;
}
const ddmm = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—');

phacheRoutes.get('/yc/:id/log', async (c) => {
  const id = c.req.param('id');
  const rows = await c.env.DB.prepare('SELECT * FROM pc_req_log WHERE req_id = ? ORDER BY id').bind(id).all<Record<string, unknown>>();
  const r = await c.env.DB.prepare('SELECT created_by FROM pc_req WHERE id = ?').bind(id).first<{ created_by: string | null }>();
  const auth = c.get('auth');
  return ok(c, { rows: rows.results ?? [], la_ky_thuat: await isKyThuat(c.env.DB, auth), la_nguoi_tao: r ? await isNguoiTao(c.env.DB, auth, r) : false });
});

phacheRoutes.post('/yc/:id/nhan', async (c) => {
  const auth = c.get('auth');
  if (!(await isKyThuat(c.env.DB, auth))) throw forbidden('Chỉ Kỹ thuật pha chế tiếp nhận yêu cầu');
  const id = c.req.param('id');
  const r = await reqOpen(c.env.DB, id);
  if (r.tiep_nhan === 'XIN') throw badRequest('DANG_XIN', 'Đang chờ người tạo trả lời việc xin dời hạn');
  const now = nowIso();
  await c.env.DB.prepare("UPDATE pc_req SET tiep_nhan = 'NHAN', nhan_by_name = ?, nhan_at = ?, updated_at = ? WHERE id = ?").bind(auth.user.display_name, now, now, id).run();
  await reqLog(c.env.DB, id, 'NHAN', 'KT', auth, `Tiếp nhận, làm theo hạn ${ddmm(r.han)}`);
  if (r.created_by) await bellTo(c.env.DB, [r.created_by], `Kỹ thuật pha chế đã tiếp nhận yêu cầu ${id} (hạn ${ddmm(r.han)})`, 'kho_pc').catch(() => 0);
  return ok(c, { id, tiep_nhan: 'NHAN' });
});

phacheRoutes.post('/yc/:id/xin', async (c) => {
  const auth = c.get('auth');
  if (!(await isKyThuat(c.env.DB, auth))) throw forbidden('Chỉ Kỹ thuật pha chế xin dời hạn');
  const id = c.req.param('id');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const han = isDate(b?.han) ? (b!.han as string) : null;
  const ly = str(b?.ly_do);
  if (!han) throw badRequest('BAD_DATE', 'Chọn ngày làm được');
  if (!ly) throw badRequest('NO_REASON', 'Cần ghi lý do xin dời hạn');
  const r = await reqOpen(c.env.DB, id);
  await c.env.DB.prepare("UPDATE pc_req SET tiep_nhan = 'XIN', xin_han = ?, xin_ly = ?, updated_at = ? WHERE id = ?").bind(han, ly, nowIso(), id).run();
  await reqLog(c.env.DB, id, 'XIN', 'KT', auth, `Xin dời hạn ${ddmm(r.han)} → ${ddmm(han)}: ${ly}`, r.han, han);
  const to = r.created_by ? [r.created_by] : (await approverIds(c.env.DB));
  await bellTo(c.env.DB, to, `Kỹ thuật pha chế xin dời hạn yêu cầu ${id}: ${ddmm(r.han)} → ${ddmm(han)}. Lý do: ${ly}`.slice(0, 480), 'kho_pc').catch(() => 0);
  return ok(c, { id, tiep_nhan: 'XIN' });
});

/** Người tạo trả lời: kieu DONGY (lấy ngày kỹ thuật xin) · DOI (han mới) · GIU (giữ hạn, bắt buộc lý do). */
phacheRoutes.post('/yc/:id/tra-loi', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const r = await reqOpen(c.env.DB, id);
  if (!(await isNguoiTao(c.env.DB, auth, r))) throw forbidden('Chỉ người tạo yêu cầu (Quản lý mua hàng) hoặc CEO trả lời');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const kieu = str(b?.kieu, 10);
  const ly = str(b?.ly_do);
  const now = nowIso();
  let hanMoi = r.han;
  let tn = 'CHO';
  let text = '';
  if (kieu === 'DONGY') {
    if (r.tiep_nhan !== 'XIN' || !r.xin_han) throw badRequest('KHONG_XIN', 'Kỹ thuật không có đề nghị dời hạn nào');
    hanMoi = r.xin_han;
    tn = 'NHAN';
    text = `Đồng ý dời hạn ${ddmm(r.han)} → ${ddmm(hanMoi)}${ly ? ': ' + ly : ''}`;
  } else if (kieu === 'DOI') {
    if (!isDate(b?.han)) throw badRequest('BAD_DATE', 'Chọn hạn mới');
    hanMoi = b!.han as string;
    text = `Đặt hạn mới ${ddmm(r.han)} → ${ddmm(hanMoi)}${ly ? ': ' + ly : ''}. Chờ Kỹ thuật tiếp nhận lại.`;
  } else if (kieu === 'GIU') {
    if (!ly) throw badRequest('NO_REASON', 'Cần ghi lý do giữ hạn cũ');
    text = `Giữ hạn ${ddmm(r.han)}: ${ly}. Chờ Kỹ thuật tiếp nhận lại.`;
  } else throw badRequest('BAD_KIEU', 'Chọn Đồng ý, Đổi ngày khác hoặc Giữ hạn cũ');
  await c.env.DB.prepare(`UPDATE pc_req SET han = ?, tiep_nhan = ?, xin_han = NULL, xin_ly = NULL, updated_at = ?${tn === 'NHAN' ? ', nhan_at = ?' : ''} WHERE id = ?`)
    .bind(...(tn === 'NHAN' ? [hanMoi, tn, now, now, id] : [hanMoi, tn, now, id]))
    .run();
  await reqLog(c.env.DB, id, kieu, 'MH', auth, text, r.han, hanMoi);
  await bellTo(c.env.DB, await kyThuatIds(c.env.DB), `Yêu cầu pha chế ${id}: ${text}`.slice(0, 480), 'kho_pc').catch(() => 0);
  return ok(c, { id, han: hanMoi, tiep_nhan: tn });
});

/** Tin nhắn trao đổi trong yêu cầu; báo chuông bên kia. */
phacheRoutes.post('/yc/:id/tin', async (c) => {
  const auth = c.get('auth');
  if (auth.actorType === 'AGENT') throw forbidden('Agent không nhắn trong yêu cầu pha chế');
  const id = c.req.param('id');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const text = str(b?.text, 1000);
  if (!text) throw badRequest('EMPTY', 'Chưa có nội dung');
  const r = await c.env.DB.prepare('SELECT id, created_by FROM pc_req WHERE id = ?').bind(id).first<{ id: string; created_by: string | null }>();
  if (!r) throw notFound('Không có yêu cầu này');
  const kt = await isKyThuat(c.env.DB, auth);
  const ben: 'KT' | 'MH' = kt && auth.user.id !== r.created_by && auth.user.role !== 'CEO' ? 'KT' : 'MH';
  await reqLog(c.env.DB, id, 'MSG', ben, auth, text);
  const to = ben === 'KT' ? (r.created_by ? [r.created_by] : await approverIds(c.env.DB)) : await kyThuatIds(c.env.DB);
  await bellTo(c.env.DB, to.filter((x) => x !== auth.user.id), `${auth.user.display_name} nhắn về yêu cầu pha chế ${id}: ${text}`.slice(0, 480), 'kho_pc').catch(() => 0);
  return ok(c, { id });
});

/* ---------------- Công thức ---------------- */
type RecipeRow = { id: number; btp: string; version: number; status: string; lines: string; huong_dan: string; ly_do: string; created_by: string | null; created_by_name: string; created_at: string; approved_by_name: string | null; approved_at: string | null; tu_duyet: number; tra_ly_do: string | null; effective_at: string | null };

phacheRoutes.get('/ct', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM pc_recipe ORDER BY btp, version DESC, id DESC').all<RecipeRow>();
  return ok(c, { rows: (rows.results ?? []).map((r) => ({ ...r, lines: JSON.parse(r.lines || '[]') })), can_approve: await canApproveRecipe(c.env.DB, c.get('auth')) });
});

/** Thêm / điều chỉnh công thức. Trưởng kỹ thuật (hoặc CEO) lập thì dùng ngay; người khác lập thì chờ duyệt. */
phacheRoutes.post('/ct', async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  // Bán thành phẩm mới chưa có mã trên hệ thống (07/11): lưu tạm "MOI:<tên>", kế toán thêm mã rồi gán (POST /ct/gan-ma).
  const tenMoi = str(b?.new_name, 100);
  const btp = tenMoi ? `MOI:${tenMoi}` : str(b?.btp, 60);
  if (!tenMoi) {
    const it = await c.env.DB.prepare('SELECT cls FROM kho_items WHERE code = ?').bind(btp).first<{ cls: string }>();
    if (it?.cls !== 'BTP') throw badRequest('NOT_BTP', `${btp || '(trống)'} không phải bán thành phẩm`);
  } else {
    const dup = await c.env.DB.prepare("SELECT code FROM kho_items WHERE cls = 'BTP' AND lower(name) = lower(?)").bind(tenMoi).first<{ code: string }>();
    if (dup) throw badRequest('DA_CO_MA', `Đã có bán thành phẩm "${tenMoi}" (mã ${dup.code}). Chọn trong danh sách thay vì thêm mới.`);
  }
  const ly = str(b?.ly_do);
  if (!ly) throw badRequest('NO_REASON', 'Cần ghi lý do thêm / điều chỉnh công thức');
  const raw = Array.isArray(b?.lines) ? (b!.lines as Array<Record<string, unknown>>) : [];
  const lines = raw.map((l) => ({ item: str(l.item, 60), qty: r6(num(l.qty)) })).filter((l) => l.item);
  if (!lines.length) throw badRequest('NO_LINES', 'Công thức chưa có nguyên liệu nào');
  if (new Set(lines.map((l) => l.item)).size !== lines.length) throw badRequest('DUP', 'Một nguyên liệu bị ghi hai dòng');
  for (const l of lines) if (!(l.qty >= 0)) throw badRequest('BAD_QTY', `Số của ${l.item} phải là số từ 0 trở lên`);
  const ph = lines.map(() => '?').join(',');
  const have = new Set(((await c.env.DB.prepare(`SELECT code FROM kho_items WHERE code IN (${ph})`).bind(...lines.map((l) => l.item)).all<{ code: string }>()).results ?? []).map((r) => r.code));
  const miss = lines.filter((l) => !have.has(l.item)).map((l) => l.item);
  if (miss.length) throw badRequest('NO_ITEM', `Không có mã: ${miss.join(', ')}`);
  const pend = await c.env.DB.prepare("SELECT id FROM pc_recipe WHERE btp = ? AND status = 'CHO'").bind(btp).first<{ id: number }>();
  if (pend) throw badRequest('CHO_DUYET', 'Bán thành phẩm này đang có phiếu điều chỉnh chờ duyệt. Chờ duyệt xong (hoặc trả lại) rồi lập phiếu mới.');
  const top = await c.env.DB.prepare('SELECT MAX(version) AS v FROM pc_recipe WHERE btp = ?').bind(btp).first<{ v: number | null }>();
  const version = (top?.v ?? 0) + 1;
  const self = await canApproveRecipe(c.env.DB, auth);
  const now = nowIso();
  const ins = c.env.DB.prepare(
    `INSERT INTO pc_recipe (btp, version, status, lines, huong_dan, ly_do, created_by, created_by_name, created_at, approved_by_name, approved_at, tu_duyet, effective_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(btp, version, self ? 'OK' : 'CHO', JSON.stringify(lines), str(b?.huong_dan, 8000), ly, auth.user.id, auth.user.display_name, now, self ? auth.user.display_name : null, self ? now : null, self ? 1 : 0, self ? now : null);
  if (self) await c.env.DB.batch([c.env.DB.prepare("UPDATE pc_recipe SET status = 'CU' WHERE btp = ? AND status = 'OK'").bind(btp), ins]);
  else await ins.run();
  const row = await c.env.DB.prepare('SELECT id FROM pc_recipe WHERE btp = ? AND version = ?').bind(btp, version).first<{ id: number }>();
  return ok(c, { id: row?.id ?? null, btp, version, status: self ? 'OK' : 'CHO' });
});

phacheRoutes.post('/ct/:id/duyet', async (c) => {
  const auth = c.get('auth');
  if (!(await canApproveRecipe(c.env.DB, auth))) throw forbidden('Chỉ Trưởng kỹ thuật (quyền Duyệt công thức pha chế) hoặc CEO duyệt công thức');
  const id = Number(c.req.param('id'));
  const r = await c.env.DB.prepare('SELECT * FROM pc_recipe WHERE id = ?').bind(id).first<RecipeRow>();
  if (!r) throw notFound('Không có phiếu điều chỉnh này');
  if (r.status !== 'CHO') throw badRequest('KHONG_CHO', 'Phiếu này không còn chờ duyệt');
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE pc_recipe SET status = 'CU' WHERE btp = ? AND status = 'OK'").bind(r.btp),
    c.env.DB.prepare("UPDATE pc_recipe SET status = 'OK', approved_by_name = ?, approved_at = ?, effective_at = ? WHERE id = ?").bind(auth.user.display_name, now, now, id),
  ]);
  return ok(c, { id, btp: r.btp, version: r.version });
});

phacheRoutes.post('/ct/:id/tra', async (c) => {
  const auth = c.get('auth');
  if (!(await canApproveRecipe(c.env.DB, auth))) throw forbidden('Chỉ Trưởng kỹ thuật (quyền Duyệt công thức pha chế) hoặc CEO trả lại công thức');
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const ly = str(b?.ly_do);
  if (!ly) throw badRequest('NO_REASON', 'Cần ghi lý do trả lại');
  const r = await c.env.DB.prepare('SELECT status FROM pc_recipe WHERE id = ?').bind(id).first<{ status: string }>();
  if (!r) throw notFound('Không có phiếu điều chỉnh này');
  if (r.status !== 'CHO') throw badRequest('KHONG_CHO', 'Phiếu này không còn chờ duyệt');
  await c.env.DB.prepare("UPDATE pc_recipe SET status = 'TRA', tra_ly_do = ?, approved_by_name = ?, approved_at = ? WHERE id = ?").bind(ly, auth.user.display_name, nowIso(), id).run();
  return ok(c, { id });
});

/** Kế toán thêm mã cho bán thành phẩm mới rồi gán vào công thức đang lưu tạm "MOI:<tên>". */
phacheRoutes.post('/ct/gan-ma', async (c) => {
  const auth = c.get('auth');
  if (!(auth.user.role === 'CEO' || auth.permissions.includes('order.approve.normal') || auth.permissions.includes('order.accounting.confirm')))
    throw forbidden('Chỉ CEO, quản lý hoặc kế toán gán mã bán thành phẩm');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const moi = str(b?.moi, 110);
  const code = str(b?.code, 60);
  if (!moi.startsWith('MOI:')) throw badRequest('BAD_MOI', 'Không phải bán thành phẩm mới');
  const it = await c.env.DB.prepare('SELECT cls, name FROM kho_items WHERE code = ?').bind(code).first<{ cls: string; name: string }>();
  if (it?.cls !== 'BTP') throw badRequest('NOT_BTP', `${code || '(trống)'} không phải bán thành phẩm`);
  const has = await c.env.DB.prepare('SELECT 1 FROM pc_recipe WHERE btp = ?').bind(code).first();
  if (has) throw badRequest('DA_CO_CT', `Mã ${code} đã có công thức, không gán thêm được`);
  const r = await c.env.DB.prepare('UPDATE pc_recipe SET btp = ? WHERE btp = ?').bind(code, moi).run();
  if (!r.meta.changes) throw notFound('Không còn công thức nào chờ gán mã này');
  return ok(c, { code, name: it.name, rows: r.meta.changes });
});

/* ---------------- Báo tồn tại xưởng ---------------- */
phacheRoutes.get('/ton', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM pc_count ORDER BY id DESC LIMIT 30').all<{ id: number; lines: string; note: string; created_by_name: string; created_at: string }>();
  return ok(c, (rows.results ?? []).map((r) => ({ ...r, lines: JSON.parse(r.lines || '[]') })));
});

/** Kỹ thuật gửi số đếm. Web so với tồn trên sổ và mức đặt mua (min_stock): hết thật thì cần đặt; khác sổ thì lệch kho.
 * Chỉ lưu để báo, không sửa sổ kho (sửa tồn vẫn do kế toán kho lập phiếu kiểm kê). */
phacheRoutes.post('/ton', async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => null)) as { lines?: Array<Record<string, unknown>>; note?: unknown; preview?: unknown } | null;
  const raw = (Array.isArray(b?.lines) ? b!.lines : []).slice(0, 200);
  const dem = new Map<string, number>();
  for (const l of raw) {
    const code = str(l.item, 60);
    const q = num(l.dem);
    if (!code) continue;
    if (!(q >= 0)) throw badRequest('BAD_QTY', `Số đếm của ${code} phải là số từ 0 trở lên`);
    dem.set(code, r6(q));
  }
  if (!dem.size) throw badRequest('NO_LINES', 'Chưa gõ số đếm mã nào');
  const ton = new Map((await khoTonRows(c.env.DB)).map((r) => [r.code, r]));
  const lines = [...dem].map(([item, q]) => {
    const r = ton.get(item);
    if (!r) throw badRequest('NO_ITEM', `Không có mã ${item}`);
    const web = r6(r.ton);
    const min = r6(r.min_stock || 0);
    return { item, name: r.name, unit: r.unit, web, dem: q, min, dat: min > 0 && q < min, lech: pcLechKho(q, web), web_sap_het: min > 0 && r.kha_dung < min };
  });
  if (b?.preview) return ok(c, { lines });
  const res = await c.env.DB.prepare('INSERT INTO pc_count (lines, note, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(JSON.stringify(lines), str(b?.note), auth.user.id, auth.user.display_name, nowIso())
    .run();
  return ok(c, { id: res.meta.last_row_id, lines });
});

/* ---------------- Phiếu pha chế NHÁP (16/11, chị Hoa đồng ý cho agent Kế toán trưởng nhập) ----------------
 * Agent Kế toán trưởng ghi thay người ra lệnh (quyền agent.w.phache) chỉ lập NHÁP; người ra lệnh phải là Kế toán hoặc CEO (chị Hoa chốt 16/11).
 * Kế toán kiểm, sửa nếu cần rồi bấm Ghi phiếu trên web thì mới thành phiếu kho. Kỹ thuật pha chế vẫn tự ghi phiếu của mình như cũ.
 * Cùng luật như web: phải có công thức đã duyệt, lệch quá 5% phải có lý do. */
/** Kế toán = tài khoản được cấp riêng quyền xác nhận kế toán (cùng danh sách việc kế toán, accountantIds); quản lý có sẵn quyền theo vai trò thì không tính. */
async function isKeToan(db: D1Database, a: AuthContext): Promise<boolean> {
  return a.user.role === 'CEO' || (await accountantIds(db)).includes(a.user.id);
}
type NhapRow = { id: number; ref_no: string; btp: string; ngay: string; lit_bon: number; bon: number; liters: number; nguoi: string; lines: string; ct_version: number | null; ly_do_lech: string; ghi_chu: string; status: string; created_by_name: string; agent_name: string | null; created_at: string; doc_id: number | null; doc_no: string | null; xu_ly_by_name: string | null; xu_ly_at: string | null; ly_do_huy: string | null };
const nhapOut = (r: NhapRow) => ({ ...r, nguoi: JSON.parse(r.nguoi || '[]'), lines: JSON.parse(r.lines || '[]') });

phacheRoutes.get('/nhap', async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM pc_nhap WHERE status = 'CHO' OR created_at >= ? ORDER BY id DESC LIMIT 200")
    .bind(new Date(Date.now() - 30 * 86400000).toISOString())
    .all<NhapRow>();
  const auth = c.get('auth');
  return ok(c, { rows: (rows.results ?? []).map(nhapOut), can_duyet: auth.actorType !== 'AGENT' && (await isKeToan(c.env.DB, auth)) });
});

/** Body: { btp, lit_bon, bon?, ngay?, ref_no?, nguoi?: string[], lines: [{item, qty}], ly_do_lech?, ghi_chu? }.
 * qty là số THỰC TẾ đã dùng (đơn vị của mã). Thiếu nguyên liệu trong công thức thì coi như 0 và báo lại. */
phacheRoutes.post('/nhap', async (c) => {
  const auth = c.get('auth');
  if (auth.delegation && !(await isKeToan(c.env.DB, auth))) throw forbidden('Agent chỉ lập phiếu pha chế nháp khi Kế toán hoặc CEO ra lệnh');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) throw badRequest('BAD_JSON', 'Dữ liệu gửi lên không đúng định dạng');
  const btp = str(b.btp, 60);
  const it = await c.env.DB.prepare('SELECT cls, name FROM kho_items WHERE code = ?').bind(btp).first<{ cls: string; name: string }>();
  if (it?.cls !== 'BTP') throw badRequest('NOT_BTP', `${btp || '(trống)'} không phải bán thành phẩm`);
  const ct = await c.env.DB.prepare("SELECT version, lines FROM pc_recipe WHERE btp = ? AND status = 'OK'").bind(btp).first<{ version: number; lines: string }>();
  if (!ct) throw badRequest('NO_CT', `${it.name} chưa có công thức pha đã duyệt. Kỹ thuật pha chế nhập công thức trước (Pha chế › Công thức).`);
  const litBon = num(b.lit_bon);
  if (!(litBon > 0)) throw badRequest('BAD_LIT', 'Số lít (1 bồn) phải lớn hơn 0');
  const bon = num(b.bon) > 0 ? num(b.bon) : 1;
  const liters = r6(litBon * bon);
  const ngay = isDate(b.ngay) ? b.ngay : vnDate();
  const refNo = str(b.ref_no, 40);
  if (refNo) {
    const y = await c.env.DB.prepare('SELECT status FROM pc_req WHERE id = ?').bind(refNo).first<{ status: string }>();
    if (!y) throw badRequest('NO_YC', `Không có yêu cầu pha chế ${refNo}`);
    if (y.status === 'HUY') throw badRequest('YC_HUY', `Yêu cầu ${refNo} đã hủy`);
  }
  const given = new Map<string, number>();
  for (const l of Array.isArray(b.lines) ? (b.lines as Array<Record<string, unknown>>) : []) {
    const code = str(l.item, 60);
    if (!code) continue;
    const q = num(l.qty);
    if (!(q >= 0)) throw badRequest('BAD_QTY', `Số thực tế của ${code} phải là số từ 0 trở lên`);
    given.set(code, r6(q));
  }
  const recipe = JSON.parse(ct.lines || '[]') as Array<{ item: string; qty: number }>;
  const inCt = new Set(recipe.map((r) => r.item));
  const extra = [...given.keys()].filter((k) => !inCt.has(k));
  if (extra.length) throw badRequest('NOT_IN_CT', `Không có trong công thức ${it.name}: ${extra.join(', ')}. Muốn thêm nguyên liệu thì điều chỉnh công thức trước.`);
  const warnings: string[] = [];
  const missing = recipe.filter((r) => !given.has(r.item)).map((r) => r.item);
  if (missing.length) warnings.push(`Không có số thực tế của: ${missing.join(', ')} (ghi 0). Kỹ thuật pha chế kiểm lại.`);
  const lines = recipe.map((r) => ({ item: r.item, qty: given.get(r.item) ?? 0, std_qty: r6(r.qty * liters) }));
  const lech = lines.filter((l) => l.std_qty > 0 && (Math.abs(l.qty - l.std_qty) * 100) / l.std_qty > PC_TOL_PCT).map((l) => l.item);
  const lyDo = str(b.ly_do_lech);
  if (lech.length && !lyDo) throw badRequest('NO_REASON', `Lệch quá ${PC_TOL_PCT}% so với công thức (${lech.join(', ')}): cần ghi lý do lệch (ly_do_lech)`);
  // Thiếu vật tư so với tồn: vẫn lập nháp, báo kỹ thuật pha chế (quy tắc kyThuatIds 07/11).
  const ton = new Map((await khoTonRows(c.env.DB)).map((r) => [r.code, r]));
  const thieu = lines.filter((l) => l.qty > 0 && l.qty > (ton.get(l.item)?.ton ?? 0)).map((l) => `${ton.get(l.item)?.name ?? l.item} cần ${l.qty}, tồn ${r6(ton.get(l.item)?.ton ?? 0)}`);
  if (thieu.length) warnings.push(`Tồn không đủ: ${thieu.join('; ')}`);
  const nguoi = Array.isArray(b.nguoi) ? (b.nguoi as unknown[]).map((x) => str(x, 60)).filter(Boolean).slice(0, 20) : [];
  const res = await c.env.DB.prepare(
    `INSERT INTO pc_nhap (ref_no, btp, ngay, lit_bon, bon, liters, nguoi, lines, ct_version, ly_do_lech, ghi_chu, status, created_by, created_by_name, agent_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CHO', ?, ?, ?, ?)`,
  )
    .bind(refNo, btp, ngay, litBon, bon, liters, JSON.stringify(nguoi), JSON.stringify(lines), ct.version, lyDo, str(b.ghi_chu), auth.user.id, auth.user.display_name, auth.delegation?.agentName ?? null, nowIso())
    .run();
  const id = Number(res.meta.last_row_id);
  const txt = `Phiếu pha chế nháp #${id}: ${it.name} · ${liters} lít${auth.delegation ? ` (agent ${auth.delegation.agentName} lập thay ${auth.user.display_name})` : ''}. Kế toán kiểm rồi bấm Ghi phiếu ở Pha chế › Yêu cầu & phiếu.${thieu.length ? ' Tồn không đủ: ' + thieu.join('; ') : ''}`;
  // Kế toán duyệt nháp; thiếu vật tư thì nhắc cả kỹ thuật pha chế (quy tắc kyThuatIds 07/11).
  const nhan = [...new Set([...(await accountantIds(c.env.DB)), ...(thieu.length ? await kyThuatIds(c.env.DB) : [])])];
  await bellTo(c.env.DB, nhan, txt.slice(0, 480), 'kho_pc').catch(() => 0);
  return ok(c, { id, btp, liters, ct_version: ct.version, lech, warnings });
});

/** Kỹ thuật pha chế đã ghi phiếu kho từ nháp này (gọi sau khi POST /api/hub/kho/docs thành công). */
phacheRoutes.post('/nhap/:id/xong', async (c) => {
  const auth = c.get('auth');
  if (auth.actorType === 'AGENT' || !(await isKeToan(c.env.DB, auth))) throw forbidden('Kế toán (hoặc CEO) xử lý phiếu pha chế nháp trên web');
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const doc = await c.env.DB.prepare("SELECT id, no FROM kho_docs WHERE id = ? AND type = 'PC' AND status = 'OK'").bind(num(b?.doc_id)).first<{ id: number; no: string }>();
  if (!doc) throw badRequest('NO_DOC', 'Không thấy phiếu pha chế đã ghi');
  const r = await c.env.DB.prepare("UPDATE pc_nhap SET status = 'DA_GHI', doc_id = ?, doc_no = ?, xu_ly_by_name = ?, xu_ly_at = ? WHERE id = ? AND status = 'CHO'")
    .bind(doc.id, doc.no, auth.user.display_name, nowIso(), id)
    .run();
  if (!r.meta.changes) throw notFound('Phiếu nháp không còn chờ xử lý');
  return ok(c, { id, doc_no: doc.no });
});

phacheRoutes.post('/nhap/:id/huy', async (c) => {
  const auth = c.get('auth');
  if (auth.actorType === 'AGENT' || !(await isKeToan(c.env.DB, auth))) throw forbidden('Kế toán (hoặc CEO) hủy phiếu pha chế nháp trên web');
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const ly = str(b?.ly_do);
  if (!ly) throw badRequest('NO_REASON', 'Cần ghi lý do hủy');
  const r = await c.env.DB.prepare("UPDATE pc_nhap SET status = 'HUY', ly_do_huy = ?, xu_ly_by_name = ?, xu_ly_at = ? WHERE id = ? AND status = 'CHO'")
    .bind(ly, auth.user.display_name, nowIso(), id)
    .run();
  if (!r.meta.changes) throw notFound('Phiếu nháp không còn chờ xử lý');
  return ok(c, { id });
});

/* ---------------- Hao hụt ---------------- */
/** Các mẻ pha trong kỳ: số thực tế so với số theo công thức (std_qty) từng nguyên liệu, người pha, lý do lệch.
 * Kèm giá bình quân (phiếu nhập / tồn đầu) để tính tiền hao hụt, chỉ khi người xem được xem giá. */
phacheRoutes.get('/haohut', async (c) => {
  const auth = c.get('auth');
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!isDate(from) || !isDate(to)) throw badRequest('BAD_RANGE', 'Cần chọn ngày bắt đầu và kết thúc');
  const docs = await c.env.DB.prepare(
    `SELECT d.id, d.no, d.doc_date, d.ref_no, d.ref_qty, d.extra, COALESCE(u.display_name, '') AS created_by_name, r.lit AS yc_lit
     FROM kho_docs d LEFT JOIN pc_req r ON r.id = d.ref_no LEFT JOIN users u ON u.id = d.created_by
     WHERE d.type = 'PC' AND d.status = 'OK' AND d.doc_date >= ? AND d.doc_date <= ? ORDER BY d.doc_date DESC, d.id DESC LIMIT 1000`,
  )
    .bind(from, to)
    .all<{ id: number; no: string; doc_date: string; ref_no: string | null; ref_qty: number | null; extra: string | null; created_by_name: string; yc_lit: number | null }>();
  const ids = (docs.results ?? []).map((d) => d.id);
  let moves: Array<{ doc_id: number; item: string; qty: number; std_qty: number | null; role: string; note: string }> = [];
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90);
    const r = await c.env.DB.prepare(`SELECT doc_id, item, qty, std_qty, role, note FROM kho_moves WHERE doc_id IN (${part.map(() => '?').join(',')})`)
      .bind(...part)
      .all<{ doc_id: number; item: string; qty: number; std_qty: number | null; role: string; note: string }>();
    moves = moves.concat(r.results ?? []);
  }
  const canPrice = auth.user.role === 'CEO' || auth.permissions.includes('debt.read.all');
  let price: Record<string, number> = {};
  if (canPrice) {
    const pr = await c.env.DB.prepare(
      `SELECT m.item, SUM(m.price * m.qty) AS amt, SUM(m.qty) AS q FROM kho_moves m JOIN kho_docs d ON d.id = m.doc_id
       WHERE d.status = 'OK' AND d.type IN ('PN','TD') AND m.price > 0 AND m.qty > 0 GROUP BY m.item`,
    ).all<{ item: string; amt: number; q: number }>();
    price = Object.fromEntries((pr.results ?? []).filter((r) => r.q > 0).map((r) => [r.item, Math.round(r.amt / r.q)]));
  }
  return ok(c, { docs: docs.results ?? [], moves, price: canPrice ? price : null, tol_pct: PC_TOL_PCT });
});

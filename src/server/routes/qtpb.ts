import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso } from '@shared/datetime';
import { HUB_ONLY } from '@shared/permissions';
import type { AppEnv, AuthContext } from '../env';
import { syncAccessEmails } from '../lib/access-sync';
import { auditStatement } from '../lib/audit';
import { canHr, setAccountStatus } from '../lib/hrAccess';
import { badRequest, conflict, forbidden, notFound, ok } from '../lib/http';
import { newId } from '../lib/ids';
import { pack, unpack } from '../lib/pack';
import { hashPassword } from '../lib/password';
import { applyUndo, enabledDepts, leadOf, type QtpbData } from '../lib/qtpb';
import { revokeAllSessions } from '../lib/session';
import { syncBangXem, undoBang } from '../services/qtpbStore';
import type { GuardUser } from '../lib/stateGuard';
import { requirePermission } from '../middleware/rbac';

/**
 * QUẢN TRỊ PHÒNG BAN (đợt 1, CEO duyệt demo 14/11/2026)
 *  - Lead gửi đề nghị thêm người mới → HCNS (hoặc CEO) duyệt → web tạo tài khoản đăng nhập (mật khẩu tạm, lần đầu phải đổi).
 *  - HCNS tự thêm người → tạo tài khoản ngay; Lead phòng nhận thông báo để set quyền.
 *  - Nhật ký thay đổi của Lead: Lead xem phòng mình; CEO và Quản lý (quyền "qtpb.hoantac") xem mọi phòng và hoàn tác.
 * Quyền, khóa người nghỉ, menu, mẫu quyền Lead đổi ngay trên bản chung (hub.ts + lib/qtpb.ts kiểm phạm vi).
 */
export const qtpbRoutes = new Hono<AppEnv>();
qtpbRoutes.use('*', requirePermission('hub.access'));

type MainData = { users?: GuardUser[]; qtpb?: QtpbData; [k: string]: unknown };

export async function loadMain(db: D1Database): Promise<{ version: number; data: MainData } | null> {
  const row = await db.prepare("SELECT version, data FROM hub_state WHERE id = 'main'").first<{ version: number; data: string }>();
  if (!row) return null;
  return { version: row.version, data: JSON.parse(await unpack(row.data)) as MainData };
}

/** Sửa bản chung trên máy chủ (hoàn tác). Có người vừa ghi thì đọc lại và thử lại. */
export async function mutateMain(db: D1Database, userId: string, f: (d: MainData) => boolean): Promise<boolean> {
  for (let i = 0; i < 4; i += 1) {
    const cur = await loadMain(db);
    if (!cur) return false;
    if (!f(cur.data)) return false;
    const res = await db
      .prepare("UPDATE hub_state SET version = version + 1, data = ?, updated_at = ?, updated_by = ? WHERE id = 'main' AND version = ?")
      .bind(await pack(JSON.stringify(cur.data)), nowIso(), userId, cur.version)
      .run();
    if (res.meta.changes) return true;
  }
  throw conflict('VERSION_CONFLICT', 'Đang có người sửa cùng lúc, thử lại sau ít giây');
}

/** Cập nhật qtpb.bangXem trong bản chung sau khi bảng dữ liệu đổi ai xem / bị xóa / hoàn tác. */
export async function syncBangXemMain(db: D1Database, userId: string): Promise<void> {
  const cur = await loadMain(db);
  await syncBangXem(db, (cur?.data.qtpb as { bangXem?: string[] } | undefined)?.bangXem, (f) =>
    mutateMain(db, userId, (d) => {
      d.qtpb = (d.qtpb ?? {}) as QtpbData;
      return f(d.qtpb as { bangXem?: string[] });
    }),
  );
}

type Ctx = { ceo: boolean; hr: boolean; undo: boolean; lead: { dept: string } | null; name: string; depts: string[] };

async function ctxOf(db: D1Database, auth: AuthContext): Promise<Ctx> {
  const main = await loadMain(db);
  const users = main?.data.users ?? [];
  const me = users.find((u) => u?.crm === auth.user.id && u.active !== false);
  const ceo = auth.user.role === 'CEO';
  const hr = await canHr(db, auth);
  const l = leadOf(users, auth.user.id, main?.data.qtpb);
  return {
    ceo,
    hr,
    undo: ceo || !!me?.perms?.includes('qtpb.hoantac'),
    lead: l ? { dept: l.dept } : null,
    name: String(me?.name ?? auth.user.display_name ?? ''),
    depts: enabledDepts(main?.data.qtpb),
  };
}

const reqSchema = z.object({
  name: z.string().trim().min(2, 'Nhập họ tên').max(120),
  email: z.string().trim().email('Email không hợp lệ').max(200),
  title: z.string().trim().max(80).optional().default(''),
  cap: z.string().trim().max(40).optional().default(''),
  start_date: z.string().trim().max(10).optional().default(''),
  kind: z.string().trim().max(40).optional().default(''),
  note: z.string().trim().max(500).optional().default(''),
  dept: z.string().trim().max(20).optional(),
});

/** Mật khẩu tạm: 12 ký tự chữ + số, đủ mạnh; lần đầu đăng nhập phải đổi. */
function tempPassword(): string {
  const A = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const N = '23456789';
  const b = crypto.getRandomValues(new Uint8Array(10));
  let s = '';
  for (let i = 0; i < 7; i += 1) s += A[b[i]! % A.length];
  for (let i = 7; i < 10; i += 1) s += N[b[i]! % N.length];
  return `Ai${s}`;
}

async function emailTaken(db: D1Database, email: string): Promise<boolean> {
  const r = await db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').bind(email).first();
  return !!r;
}

/** Tạo tài khoản nhân viên chỉ vào khu làm việc (giống "Thêm nhân sự" ở Tài khoản & phân quyền). */
async function createAccount(c: { env: AppEnv['Bindings'] }, auth: AuthContext, email: string, name: string, requestId: string | null) {
  if (await emailTaken(c.env.DB, email)) throw badRequest('EMAIL_EXISTS', 'Email này đã có tài khoản đăng nhập. Nhờ CEO gắn tài khoản cũ ở Tài khoản & phân quyền.');
  const id = newId();
  const now = nowIso();
  const password = tempPassword();
  const hash = await hashPassword(password);
  const grant = (p: string) =>
    c.env.DB.prepare(
      'INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, permission) DO NOTHING',
    ).bind(id, p, auth.user.id, now);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (id, email, display_name, role, status, password_hash, password_updated_at, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, 'EMPLOYEE', 'ACTIVE', ?, ?, 1, ?, ?)`,
    ).bind(id, email.toLowerCase(), name, hash, now, now, now),
    grant('hub.access'),
    grant(HUB_ONLY),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: id,
      after: { email, role: 'EMPLOYEE', display_name: name, source: 'qtpb' },
      requestId,
    }),
  ]);
  const access = await syncAccessEmails(c.env).catch(() => ({ ok: false, error: 'lỗi mạng' }));
  return { id, password, access };
}

async function logAdd(db: D1Database, ctx: Ctx, actorId: string, dept: string, crm: string, name: string, title: string, byLead: string) {
  await db
    .prepare(
      `INSERT INTO qtpb_log (id, at, actor_id, actor_name, actor_role, dept, action, target, target_name, summary, before_json, after_json)
       VALUES (?, ?, ?, ?, ?, ?, 'add', ?, ?, ?, 'null', ?)`,
    )
    .bind(
      newId(),
      nowIso(),
      actorId,
      ctx.name,
      ctx.ceo ? 'ceo' : 'hr',
      dept,
      crm,
      name,
      `Tạo tài khoản ${name}${title ? ` (${title})` : ''}${byLead ? ` theo đề nghị của ${byLead}` : ''}`,
      JSON.stringify({ crm, title }),
    )
    .run();
}

qtpbRoutes.get('/ctx', async (c) => ok(c, await ctxOf(c.env.DB, c.get('auth'))));

qtpbRoutes.get('/requests', async (c) => {
  const auth = c.get('auth');
  const ctx = await ctxOf(c.env.DB, auth);
  if (!ctx.ceo && !ctx.hr && !ctx.lead) throw forbidden();
  const all = ctx.ceo || ctx.hr;
  const { results } = await c.env.DB
    .prepare(
      `SELECT id, dept, name, email, title, cap, start_date, kind, note, status, by_name, by_role, decided_name, decided_at, reason, crm_id, created_at
       FROM qtpb_requests WHERE (? = 1 OR dept = ?) AND (status = 'PENDING' OR created_at >= ?) ORDER BY created_at DESC LIMIT 200`,
    )
    .bind(all ? 1 : 0, ctx.lead?.dept ?? '', new Date(Date.now() - 45 * 86_400_000).toISOString())
    .all();
  return ok(c, { rows: results ?? [], ctx });
});

qtpbRoutes.post('/requests', async (c) => {
  const auth = c.get('auth');
  const ctx = await ctxOf(c.env.DB, auth);
  if (!ctx.lead) throw forbidden('Chỉ Lead của phòng đã mở Quản trị phòng mới gửi được đề nghị.');
  const p = reqSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!p.success) throw badRequest('VALIDATION_FAILED', p.error.issues[0]?.message ?? 'Dữ liệu chưa hợp lệ');
  const v = p.data;
  if (await emailTaken(c.env.DB, v.email)) throw badRequest('EMAIL_EXISTS', 'Email này đã có tài khoản đăng nhập.');
  const dup = await c.env.DB.prepare("SELECT id FROM qtpb_requests WHERE status = 'PENDING' AND lower(email) = lower(?)").bind(v.email).first();
  if (dup) throw badRequest('DUPLICATE', 'Email này đang có đề nghị chờ duyệt.');
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO qtpb_requests (id, dept, name, email, title, cap, start_date, kind, note, status, by_id, by_name, by_role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, 'lead', ?)`,
  )
    .bind(id, ctx.lead.dept, v.name, v.email.toLowerCase(), v.title, v.cap, v.start_date, v.kind, v.note, auth.user.id, ctx.name, nowIso())
    .run();
  return ok(c, { id });
});

qtpbRoutes.post('/requests/:id/decide', async (c) => {
  const auth = c.get('auth');
  const ctx = await ctxOf(c.env.DB, auth);
  if (!ctx.ceo && !ctx.hr) throw forbidden('Chỉ HCNS hoặc CEO duyệt người mới.');
  const body = (await c.req.json().catch(() => ({}))) as { approve?: boolean; reason?: string };
  const r = await c.env.DB.prepare('SELECT * FROM qtpb_requests WHERE id = ?').bind(c.req.param('id')).first<{
    id: string; dept: string; name: string; email: string; title: string; status: string; by_name: string;
  }>();
  if (!r) throw notFound('Không tìm thấy đề nghị');
  if (r.status !== 'PENDING') throw badRequest('DONE', 'Đề nghị này đã xử lý rồi');
  const now = nowIso();
  if (!body.approve) {
    await c.env.DB.prepare("UPDATE qtpb_requests SET status = 'REJECTED', decided_by = ?, decided_name = ?, decided_at = ?, reason = ? WHERE id = ? AND status = 'PENDING'")
      .bind(auth.user.id, ctx.name, now, String(body.reason ?? '').slice(0, 300), r.id)
      .run();
    return ok(c, { status: 'REJECTED' });
  }
  const acc = await createAccount(c, auth, r.email, r.name, c.get('requestId'));
  await c.env.DB.prepare("UPDATE qtpb_requests SET status = 'APPROVED', decided_by = ?, decided_name = ?, decided_at = ?, crm_id = ? WHERE id = ?")
    .bind(auth.user.id, ctx.name, now, acc.id, r.id)
    .run();
  await logAdd(c.env.DB, ctx, auth.user.id, r.dept, acc.id, r.name, r.title, r.by_name);
  return ok(c, { status: 'APPROVED', crm_id: acc.id, email: r.email, password: acc.password, access: acc.access });
});

/** HCNS (hoặc CEO) tự thêm người: tạo tài khoản ngay, Lead phòng set quyền sau. */
qtpbRoutes.post('/hr-add', async (c) => {
  const auth = c.get('auth');
  const ctx = await ctxOf(c.env.DB, auth);
  if (!ctx.ceo && !ctx.hr) throw forbidden('Chỉ HCNS hoặc CEO thêm người trực tiếp.');
  const p = reqSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!p.success) throw badRequest('VALIDATION_FAILED', p.error.issues[0]?.message ?? 'Dữ liệu chưa hợp lệ');
  const v = p.data;
  if (!v.dept) throw badRequest('VALIDATION_FAILED', 'Chọn phòng');
  if (v.dept === 'HCNS' && !ctx.ceo) throw forbidden('Chỉ CEO đưa người vào phòng HCNS.');
  const acc = await createAccount(c, auth, v.email, v.name, c.get('requestId'));
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO qtpb_requests (id, dept, name, email, title, cap, start_date, kind, note, status, by_id, by_name, by_role, decided_by, decided_name, decided_at, crm_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(newId(), v.dept, v.name, v.email.toLowerCase(), v.title, v.cap, v.start_date, v.kind, v.note, auth.user.id, ctx.name, ctx.ceo ? 'ceo' : 'hr', auth.user.id, ctx.name, now, acc.id, now)
    .run();
  await logAdd(c.env.DB, ctx, auth.user.id, v.dept, acc.id, v.name, v.title, '');
  return ok(c, { status: 'APPROVED', crm_id: acc.id, email: v.email, password: acc.password, access: acc.access });
});

qtpbRoutes.get('/log', async (c) => {
  const auth = c.get('auth');
  const ctx = await ctxOf(c.env.DB, auth);
  const want = c.req.query('dept') ?? '';
  let dept = want;
  if (!ctx.ceo && !ctx.undo && !ctx.hr) {
    if (!ctx.lead) throw forbidden();
    dept = ctx.lead.dept;
  }
  const { results } = await c.env.DB
    .prepare(
      `SELECT id, at, actor_name, actor_role, dept, action, target, target_name, summary, before_json, after_json, undone_at, undone_name
       FROM qtpb_log WHERE (? = '' OR dept = ?) ORDER BY at DESC LIMIT 300`,
    )
    .bind(dept, dept)
    .all();
  return ok(c, { rows: results ?? [], ctx });
});

qtpbRoutes.post('/log/:id/undo', async (c) => {
  const auth = c.get('auth');
  const ctx = await ctxOf(c.env.DB, auth);
  if (!ctx.undo) throw forbidden('Chỉ CEO hoặc Quản lý được hoàn tác.');
  const row = await c.env.DB.prepare('SELECT * FROM qtpb_log WHERE id = ?').bind(c.req.param('id')).first<{
    id: string; dept: string; action: string; target: string; before_json: string; undone_at: string | null;
  }>();
  if (!row) throw notFound('Không tìm thấy dòng nhật ký');
  if (row.undone_at) throw badRequest('DONE', 'Dòng này đã hoàn tác rồi');
  const before = JSON.parse(row.before_json ?? 'null') as unknown;
  if (row.action === 'bang') {
    if (!(await undoBang(c.env.DB, row.target, before, JSON.parse((row as { after_json?: string }).after_json ?? 'null')))) throw badRequest('GONE', 'Không còn bảng này để hoàn tác.');
    await syncBangXemMain(c.env.DB, auth.user.id);
    await c.env.DB.prepare('UPDATE qtpb_log SET undone_at = ?, undone_by = ?, undone_name = ? WHERE id = ?')
      .bind(nowIso(), auth.user.id, ctx.name, row.id)
      .run();
    return ok(c, { ok: true });
  }
  let crm = '';
  const done = await mutateMain(c.env.DB, auth.user.id, (d) => {
    if (row.action === 'add') {
      const u = (d.users ?? []).find((x) => x?.crm === row.target);
      crm = row.target;
      if (!u) return true; // chưa vào bản chung: chỉ cần khóa tài khoản
      u.active = false;
      return true;
    }
    const u = (d.users ?? []).find((x) => x?.id === row.target);
    if (u?.crm) crm = u.crm;
    return applyUndo(d, { action: row.action, dept: row.dept, target: row.target, before });
  });
  if (!done) throw badRequest('GONE', 'Không còn dữ liệu để hoàn tác (người hoặc mục đã bị xóa).');
  if (crm && row.action === 'lock') await setAccountStatus(c.env.DB, [crm], 'ACTIVE', auth.user.id, c.get('requestId'));
  if (crm && row.action === 'add') {
    await setAccountStatus(c.env.DB, [crm], 'DISABLED', auth.user.id, c.get('requestId'));
    await revokeAllSessions(c.env.DB, crm);
  }
  if (crm && (row.action === 'lock' || row.action === 'add')) await syncAccessEmails(c.env).catch(() => undefined);
  await c.env.DB.prepare('UPDATE qtpb_log SET undone_at = ?, undone_by = ?, undone_name = ? WHERE id = ?')
    .bind(nowIso(), auth.user.id, ctx.name, row.id)
    .run();
  return ok(c, { ok: true });
});

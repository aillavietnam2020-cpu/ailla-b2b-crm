import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso, vnDate } from '@shared/datetime';
import { zodFieldErrors } from '@shared/schemas';
import type { AppEnv, AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, forbidden, notFound, ok, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { requirePermission } from '../middleware/rbac';
import { exportDocText, fileInfo, saKey } from '../services/gdrive';
import {
  canEditDoc,
  canSeeDoc,
  canTrack,
  driveIdFrom,
  fromDriveMarkdown,
  gradeQuiz,
  isEditor,
  loadMembers,
  parseJsonArr,
  publishStatus,
  requiredFor,
  viewerOf,
  type Members,
  type Quiz,
  type Viewer,
} from '../services/daoTao';

/**
 * Đào tạo & onboarding (web vận hành › Đào tạo, hub/src/daotao.js). Chị Hoa duyệt demo 02/11/2026.
 * Tài liệu Chung + Sổ tay web: mọi nhân viên. Tài liệu team: chỉ team đó, quản lý team, CEO, nhân sự.
 * Quy tắc xem / soạn ở services/daoTao.ts.
 */
export const daoTaoRoutes = new Hono<AppEnv>();
daoTaoRoutes.use('*', requirePermission('hub.access'));

type DocRow = {
  id: string; nhom: string; teams: string; title: string; summary: string; body: string; version: number; status: string;
  bat_buoc: string; lo_trinh: string; han_ngay: number; quiz: string; sort: number; created_at: string; created_by: string;
  updated_at: string; updated_by: string; published_at: string | null; approved_by: string | null;
  drive_id: string; drive_mod: string; drive_sync_at: string | null;
};

async function ctx(db: D1Database, auth: AuthContext): Promise<{ v: Viewer; m: Members }> {
  const m = await loadMembers(db, auth.user.id);
  const g = await db.prepare('SELECT scopes FROM dt_editor WHERE user_id = ?').bind(auth.user.id).first<{ scopes: string }>();
  return { v: viewerOf(auth.user.id, auth.user.role, m, parseJsonArr(g?.scopes)), m };
}

const lite = (r: DocRow) => ({ nhom: r.nhom, teams: parseJsonArr(r.teams), status: r.status, created_by: r.created_by });

/** Bỏ phần nặng (nội dung, đáp án) khi trả danh sách; người không soạn được thì không thấy đáp án câu kiểm tra. */
function shape(r: DocRow, v: Viewer, withBody: boolean) {
  const quiz = parseJsonArr<Quiz[number]>(r.quiz);
  const edit = canEditDoc(v, lite(r));
  return {
    id: r.id, nhom: r.nhom, teams: parseJsonArr(r.teams), title: r.title, summary: r.summary, version: r.version, status: r.status,
    bat_buoc: r.bat_buoc, lo_trinh: r.lo_trinh, han_ngay: r.han_ngay, sort: r.sort, updated_at: r.updated_at, updated_by: r.updated_by,
    published_at: r.published_at, quiz_n: quiz.length, can_edit: edit, drive_id: r.drive_id ?? '', drive_mod: r.drive_mod ?? '', drive_sync_at: r.drive_sync_at ?? null,
    ...(withBody ? { body: r.body, quiz: edit ? quiz : quiz.map((q) => ({ q: q.q, o: q.o })) } : {}),
  };
}

async function allDocs(db: D1Database) {
  const { results } = await db.prepare("SELECT * FROM dt_doc WHERE status != 'an' ORDER BY sort, title").all<DocRow>();
  return results;
}

async function getDoc(db: D1Database, id: string) {
  const r = await db.prepare('SELECT * FROM dt_doc WHERE id = ?').bind(id).first<DocRow>();
  if (!r || r.status === 'an') throw notFound('Không tìm thấy tài liệu');
  return r;
}

/* ---------- Google Docs: web đọc qua tài khoản máy (chỉ xem), chép nội dung vào tài liệu ---------- */
const DRIVE_DOC = 'application/vnd.google-apps.document';
async function loadDrive(env: AppEnv['Bindings'], id: string) {
  const key = saKey(env.GDRIVE_SA_JSON);
  if (!key) throw badRequest('DRIVE_OFF', 'Web chưa nối Google Drive. Nhờ chị Hoa chạy NOI-GOOGLE-DRIVE.bat trước.');
  const f = await fileInfo(key, id);
  if (!f) throw badRequest('DRIVE_NO_ACCESS', `Web chưa xem được file này. Chia sẻ file (hoặc thư mục chứa nó) cho email ${key.client_email} quyền Người xem.`);
  if (f.mimeType !== DRIVE_DOC) throw badRequest('DRIVE_NOT_DOC', 'Chỉ lấy được nội dung từ file Google Docs (file Word, PDF thì mở trong Drive rồi chọn Lưu dưới dạng Google Docs).');
  const md = await exportDocText(key, id);
  if (md == null) throw badRequest('DRIVE_EXPORT', 'Chưa đọc được nội dung file, thử lại sau ít phút.');
  return { id, title: f.name, body: fromDriveMarkdown(md), modified: f.modifiedTime ?? '', link: f.webViewLink ?? `https://docs.google.com/document/d/${id}/edit` };
}

/** Tài liệu lấy từ Drive: quá 5 phút từ lần hỏi trước thì hỏi lại; file đã sửa thì chép nội dung mới (lỗi thì giữ bản đang có). */
async function refreshDrive(env: AppEnv['Bindings'], r: DocRow): Promise<DocRow> {
  if (!r.drive_id || (r.drive_sync_at && Date.now() - Date.parse(r.drive_sync_at) < 300_000)) return r;
  const now = nowIso();
  try {
    const key = saKey(env.GDRIVE_SA_JSON);
    const f = key ? await fileInfo(key, r.drive_id) : null;
    if (key && f && f.modifiedTime && f.modifiedTime !== r.drive_mod) {
      const md = await exportDocText(key, r.drive_id);
      if (md != null) {
        const body = fromDriveMarkdown(md);
        await env.DB.prepare('UPDATE dt_doc SET body = ?, drive_mod = ?, drive_sync_at = ? WHERE id = ?').bind(body, f.modifiedTime, now, r.id).run();
        return { ...r, body, drive_mod: f.modifiedTime, drive_sync_at: now };
      }
    }
  } catch {
    /* Drive lỗi: vẫn hiện bản đã chép */
  }
  await env.DB.prepare('UPDATE dt_doc SET drive_sync_at = ? WHERE id = ?').bind(now, r.id).run();
  return { ...r, drive_sync_at: now };
}

/** Người soạn dán link Google Docs: xem trước tên + nội dung web lấy được. */
daoTaoRoutes.post('/drive/xem', async (c) => {
  const { v } = await ctx(c.env.DB, c.get('auth'));
  if (!isEditor(v)) throw forbidden('Chỉ người soạn tài liệu dùng được');
  const id = driveIdFrom(String(((await c.req.json().catch(() => ({}))) as { link?: unknown }).link ?? ''));
  if (!id) throw badRequest('BAD_LINK', 'Dán link file Google Docs (bấm Chia sẻ › Sao chép đường liên kết)');
  return ok(c, await loadDrive(c.env, id));
});

/** Ai đang xem + quyền của họ, danh sách phòng ban (để trang biết hiện mục nào). */
daoTaoRoutes.get('/me', async (c) => {
  const auth = c.get('auth');
  const { v, m } = await ctx(c.env.DB, auth);
  const nb = await c.env.DB.prepare('SELECT * FROM dt_newbie WHERE user_id = ?').bind(auth.user.id).first();
  return ok(c, { ...v, editor: isEditor(v), tracker: v.ceo || v.hr || (v.manager && !!v.pb), deps: m.deps, newbie: nb ?? null });
});

/** Tài liệu tôi xem được + lượt xác nhận của tôi. */
daoTaoRoutes.get('/docs', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  const docs = (await allDocs(c.env.DB)).filter((r) => canSeeDoc(v, lite(r)));
  const { results: acks } = await c.env.DB.prepare('SELECT doc_id, version, score, at FROM dt_ack WHERE user_id = ?')
    .bind(auth.user.id)
    .all<{ doc_id: string; version: number; score: number | null; at: string }>();
  return ok(c, { docs: docs.map((r) => shape(r, v, false)), acks });
});

daoTaoRoutes.get('/docs/:id', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  const r = await refreshDrive(c.env, await getDoc(c.env.DB, c.req.param('id')));
  if (!canSeeDoc(v, lite(r))) throw forbidden('Tài liệu này chỉ dành cho team khác');
  const [{ results: hoi }, ack] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM dt_hoi WHERE doc_id = ? ORDER BY created_at DESC LIMIT 100').bind(r.id).all<{ user_id: string }>(),
    c.env.DB.prepare('SELECT version, score, at FROM dt_ack WHERE doc_id = ? AND user_id = ?').bind(r.id, auth.user.id).first(),
  ]);
  // Người đọc thường chỉ thấy câu hỏi của mình; người soạn thấy hết để trả lời.
  const edit = canEditDoc(v, lite(r));
  return ok(c, { ...shape(r, v, true), ack: ack ?? null, hoi: edit ? hoi : hoi.filter((h) => h.user_id === auth.user.id) });
});

const quizSchema = z.array(z.object({ q: z.string().trim().min(1).max(300), o: z.array(z.string().trim().min(1).max(200)).min(2).max(6), a: z.number().int().min(0) }))
  .max(20)
  .refine((qs) => qs.every((q) => q.a < q.o.length), 'Đáp án đúng phải là một trong các lựa chọn');

const docSchema = z.object({
  nhom: z.enum(['chung', 'web', 'team']),
  teams: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  title: z.string().trim().min(3, 'Ghi tên tài liệu').max(160),
  summary: z.string().trim().max(300).default(''),
  body: z.string().max(200_000).default(''),
  bat_buoc: z.enum(['moi', 'tat_ca', 'khong']).default('khong'),
  lo_trinh: z.enum(['d1', 'w1', 'm1', '']).default(''),
  han_ngay: z.number().int().min(1).max(120).default(7),
  quiz: quizSchema.default([]),
  sort: z.number().int().min(0).max(9999).default(100),
  /** dang = đăng (Chung của người không phải CEO thì thành chờ duyệt) · nhap = lưu nháp */
  action: z.enum(['dang', 'nhap']).default('nhap'),
  /** Sửa lớn: lên bản mới, mọi người phải đọc và xác nhận lại. */
  major: z.boolean().default(false),
  /** Link / mã file Google Docs: có thì nội dung lấy từ Drive (bỏ qua body gửi lên). '' = soạn trên web. */
  drive: z.string().trim().max(400).default(''),
});

function parseDoc(body: unknown) {
  const p = docSchema.safeParse(body);
  if (!p.success) throw unprocessable('VALIDATION_FAILED', 'Tài liệu chưa hợp lệ', zodFieldErrors(p.error));
  const d = p.data;
  if (d.nhom === 'team' && !d.teams.length) throw badRequest('NO_TEAM', 'Chọn ít nhất một team được xem');
  if (d.nhom !== 'team') d.teams = [];
  const driveId = d.drive ? driveIdFrom(d.drive) : '';
  if (driveId === null) throw badRequest('BAD_LINK', 'Link Google Docs không đúng');
  return { ...d, driveId };
}

/** Tài liệu nguồn Drive: lấy nội dung mới nhất ngay lúc lưu. */
async function withDrive(env: AppEnv['Bindings'], d: ReturnType<typeof parseDoc>) {
  if (!d.driveId) return { body: d.body, drive_id: '', drive_mod: '', drive_sync_at: null as string | null };
  const f = await loadDrive(env, d.driveId);
  return { body: f.body, drive_id: d.driveId, drive_mod: f.modified, drive_sync_at: nowIso() };
}

daoTaoRoutes.post('/docs', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  const d = parseDoc(await c.req.json().catch(() => ({})));
  if (!canEditDoc(v, d)) throw forbidden('Bạn chưa được giao quyền soạn loại tài liệu này');
  const id = newId();
  const now = nowIso();
  const status = d.action === 'dang' ? publishStatus(v, d.nhom) : 'nhap';
  const g = await withDrive(c.env, d);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO dt_doc (id, nhom, teams, title, summary, body, version, status, bat_buoc, lo_trinh, han_ngay, quiz, sort,
         created_at, created_by, updated_at, updated_by, published_at, approved_by, drive_id, drive_mod, drive_sync_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, d.nhom, JSON.stringify(d.teams), d.title, d.summary, g.body, status, d.bat_buoc, d.lo_trinh, d.han_ngay, JSON.stringify(d.quiz), d.sort,
      now, auth.user.id, now, auth.user.id, status === 'dang' ? now : null, status === 'dang' && d.nhom === 'chung' ? auth.user.id : null,
      g.drive_id, g.drive_mod, g.drive_sync_at),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'DT_DOC_ADD', entityType: 'DT_DOC', entityId: id, after: { title: d.title, nhom: d.nhom, status } }),
  ]);
  return ok(c, { id, status });
});

daoTaoRoutes.put('/docs/:id', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  const old = await getDoc(c.env.DB, c.req.param('id'));
  const d = parseDoc(await c.req.json().catch(() => ({})));
  if (!canEditDoc(v, lite(old)) || !canEditDoc(v, d)) throw forbidden('Bạn chưa được giao quyền sửa tài liệu này');
  const now = nowIso();
  // Một tài liệu một nội dung: lưu nháp là gỡ xuống; người không phải CEO sửa tài liệu Chung thì chờ CEO duyệt lại.
  const status = d.action === 'dang' ? publishStatus(v, d.nhom) : 'nhap';
  const version = old.version + (d.major && old.published_at ? 1 : 0);
  const g = await withDrive(c.env, d);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE dt_doc SET nhom = ?, teams = ?, title = ?, summary = ?, body = ?, version = ?, status = ?, bat_buoc = ?, lo_trinh = ?, han_ngay = ?,
         quiz = ?, sort = ?, updated_at = ?, updated_by = ?, published_at = CASE WHEN ? = 'dang' THEN COALESCE(published_at, ?) ELSE published_at END,
         approved_by = CASE WHEN ? = 'dang' AND ? = 'chung' THEN ? ELSE approved_by END, drive_id = ?, drive_mod = ?, drive_sync_at = ? WHERE id = ?`,
    ).bind(d.nhom, JSON.stringify(d.teams), d.title, d.summary, g.body, version, status, d.bat_buoc, d.lo_trinh, d.han_ngay, JSON.stringify(d.quiz),
      d.sort, now, auth.user.id, status, now, status, d.nhom, auth.user.id, g.drive_id, g.drive_mod, g.drive_sync_at, old.id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'DT_DOC_EDIT', entityType: 'DT_DOC', entityId: old.id,
      before: { title: old.title, version: old.version, status: old.status }, after: { title: d.title, version, status } }),
  ]);
  return ok(c, { id: old.id, status, version });
});

/** CEO duyệt tài liệu Chung đang chờ. */
daoTaoRoutes.post('/docs/:id/approve', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  if (!v.ceo) throw forbidden('Chỉ CEO duyệt tài liệu Chung');
  const r = await getDoc(c.env.DB, c.req.param('id'));
  if (r.status !== 'cho_duyet') throw badRequest('NOT_PENDING', 'Tài liệu không ở trạng thái chờ duyệt');
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE dt_doc SET status = 'dang', approved_by = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?")
      .bind(auth.user.id, now, now, r.id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'DT_DOC_APPROVE', entityType: 'DT_DOC', entityId: r.id }),
  ]);
  return ok(c, { id: r.id, status: 'dang' });
});

/** Gỡ tài liệu (ẩn, không xóa hẳn). */
daoTaoRoutes.delete('/docs/:id', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  const r = await getDoc(c.env.DB, c.req.param('id'));
  if (!canEditDoc(v, lite(r))) throw forbidden('Bạn không gỡ được tài liệu này');
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE dt_doc SET status = 'an', updated_at = ?, updated_by = ? WHERE id = ?").bind(nowIso(), auth.user.id, r.id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'DT_DOC_HIDE', entityType: 'DT_DOC', entityId: r.id, before: { title: r.title } }),
  ]);
  return ok(c, { id: r.id });
});

/** "Tôi đã đọc và hiểu" (kèm trả lời câu kiểm tra nếu tài liệu có). */
daoTaoRoutes.post('/docs/:id/ack', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  const r = await getDoc(c.env.DB, c.req.param('id'));
  if (r.status !== 'dang' || !canSeeDoc(v, lite(r))) throw forbidden('Tài liệu chưa đăng hoặc không dành cho bạn');
  const body = (await c.req.json().catch(() => ({}))) as { answers?: unknown };
  const g = gradeQuiz(parseJsonArr<Quiz[number]>(r.quiz), body.answers);
  if (!g.pass) return ok(c, { pass: false, right: g.right, total: g.total });
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO dt_ack (doc_id, user_id, version, score, at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (doc_id, user_id) DO UPDATE SET version = excluded.version, score = excluded.score, at = excluded.at`,
  ).bind(r.id, auth.user.id, r.version, g.total ? g.right : null, now).run();
  return ok(c, { pass: true, right: g.right, total: g.total, version: r.version, at: now });
});

daoTaoRoutes.post('/docs/:id/hoi', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  const r = await getDoc(c.env.DB, c.req.param('id'));
  if (!canSeeDoc(v, lite(r))) throw forbidden();
  const text = String(((await c.req.json().catch(() => ({}))) as { text?: unknown }).text ?? '').trim().slice(0, 1000);
  if (text.length < 3) throw badRequest('EMPTY', 'Gõ câu hỏi giúp em');
  const id = newId();
  await c.env.DB.prepare('INSERT INTO dt_hoi (id, doc_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, r.id, auth.user.id, text, nowIso()).run();
  return ok(c, { id });
});

daoTaoRoutes.post('/hoi/:id/tra-loi', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  const h = await c.env.DB.prepare('SELECT * FROM dt_hoi WHERE id = ?').bind(c.req.param('id')).first<{ id: string; doc_id: string }>();
  if (!h) throw notFound();
  const r = await getDoc(c.env.DB, h.doc_id);
  if (!canEditDoc(v, lite(r))) throw forbidden('Chỉ người soạn tài liệu này trả lời được');
  const answer = String(((await c.req.json().catch(() => ({}))) as { answer?: unknown }).answer ?? '').trim().slice(0, 2000);
  if (!answer) throw badRequest('EMPTY', 'Gõ câu trả lời');
  await c.env.DB.prepare('UPDATE dt_hoi SET answer = ?, answered_by = ?, answered_at = ? WHERE id = ?').bind(answer, auth.user.id, nowIso(), h.id).run();
  return ok(c, { id: h.id });
});

/** Theo dõi: từng người (quản lý thấy phòng mình, CEO / nhân sự thấy hết) + tài liệu bắt buộc còn thiếu. */
daoTaoRoutes.get('/theo-doi', async (c) => {
  const auth = c.get('auth');
  const { v, m } = await ctx(c.env.DB, auth);
  if (!(v.ceo || v.hr || (v.manager && v.pb))) throw forbidden('Chỉ quản lý, nhân sự và CEO xem được');
  const docs = (await allDocs(c.env.DB)).filter((r) => r.status === 'dang');
  const [{ results: acks }, { results: nbs }, { results: grants }, { results: hoi }] = await Promise.all([
    c.env.DB.prepare('SELECT doc_id, user_id, version, score, at FROM dt_ack').all<{ doc_id: string; user_id: string; version: number; score: number | null; at: string }>(),
    c.env.DB.prepare('SELECT * FROM dt_newbie').all<{ user_id: string; start_date: string; mentor_id: string; done_at: string | null }>(),
    c.env.DB.prepare('SELECT user_id, scopes FROM dt_editor').all<{ user_id: string; scopes: string }>(),
    c.env.DB.prepare('SELECT h.id, h.doc_id, h.user_id, h.text, h.created_at FROM dt_hoi h WHERE h.answer IS NULL ORDER BY h.created_at').all<{ id: string; doc_id: string; user_id: string; text: string; created_at: string }>(),
  ]);
  const ackBy = new Map(acks.map((a) => [a.doc_id + '|' + a.user_id, a]));
  const nbBy = new Map(nbs.map((n) => [n.user_id, n]));
  const grantBy = new Map(grants.map((g) => [g.user_id, parseJsonArr(g.scopes)]));
  const today = vnDate();
  const people = Object.entries(m.users)
    .filter(([, u]) => canTrack(v, u))
    .map(([id, u]) => {
      const nb = nbBy.get(id);
      const newbie = !!nb && !nb.done_at;
      const pv = viewerOf(id, '', m, grantBy.get(id) ?? []);
      const req = docs.filter((r) => canSeeDoc(pv, lite(r)) && requiredFor(r, newbie));
      const rows = req.map((r) => {
        const a = ackBy.get(r.id + '|' + id);
        const base = r.bat_buoc === 'moi' && nb ? nb.start_date : (r.published_at ?? r.created_at).slice(0, 10);
        const due = vnDate(new Date(new Date(base + 'T00:00:00+07:00').getTime() + r.han_ngay * 86_400_000));
        return { id: r.id, title: r.title, done: !!a && a.version >= r.version, old: !!a && a.version < r.version, due, late: (!a || a.version < r.version) && due < today };
      });
      return { id, name: u.name, pb: u.pb, role: u.role, newbie: nb ?? null, required: rows.length, done: rows.filter((x) => x.done).length,
        late: rows.filter((x) => x.late).length, missing: rows.filter((x) => !x.done) };
    });
  // Ai đã xác nhận từng tài liệu (trong phạm vi người mình theo dõi được).
  const seen = new Set(people.map((p) => p.id));
  const perDoc = docs.map((r) => {
    const target = people.filter((p) => canSeeDoc(viewerOf(p.id, '', m, grantBy.get(p.id) ?? []), lite(r)));
    const ok = target.filter((p) => { const a = ackBy.get(r.id + '|' + p.id); return !!a && a.version >= r.version; });
    return { id: r.id, title: r.title, version: r.version, total: target.length, ok: ok.length, notYet: target.filter((p) => !ok.includes(p)).map((p) => p.name) };
  });
  const docTitle = new Map(docs.map((r) => [r.id, r.title]));
  const hoiOpen = hoi.filter((h) => seen.has(h.user_id) || v.ceo || v.hr).map((h) => ({ ...h, title: docTitle.get(h.doc_id) ?? '', name: m.users[h.user_id]?.name ?? '' }));
  return ok(c, { people, perDoc, hoi: hoiOpen, users: Object.entries(m.users).map(([id, u]) => ({ id, name: u.name, pb: u.pb })) });
});

/** Ghi / sửa nhân viên mới: ngày vào làm, người kèm, đánh dấu xong onboarding. */
daoTaoRoutes.put('/newbie/:uid', async (c) => {
  const auth = c.get('auth');
  const { v, m } = await ctx(c.env.DB, auth);
  const uid = c.req.param('uid');
  if (!canTrack(v, m.users[uid]) || !(v.ceo || v.hr || v.manager)) throw forbidden('Bạn không quản lý người này');
  const b = (await c.req.json().catch(() => ({}))) as { start_date?: string; mentor_id?: string; done?: boolean; remove?: boolean };
  if (b.remove) {
    await c.env.DB.prepare('DELETE FROM dt_newbie WHERE user_id = ?').bind(uid).run();
    return ok(c, { user_id: uid });
  }
  const sd = String(b.start_date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) throw badRequest('BAD_DATE', 'Chọn ngày vào làm');
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO dt_newbie (user_id, start_date, mentor_id, done_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET start_date = excluded.start_date, mentor_id = excluded.mentor_id, done_at = excluded.done_at,
       updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  ).bind(uid, sd, String(b.mentor_id ?? '').slice(0, 80), b.done ? now : null, now, auth.user.id).run();
  return ok(c, { user_id: uid });
});

/** Người được giao quyền soạn thêm: CEO và nhân sự xem; chỉ CEO giao. */
daoTaoRoutes.get('/editors', async (c) => {
  const { v, m } = await ctx(c.env.DB, c.get('auth'));
  if (!(v.ceo || v.hr)) throw forbidden('Chỉ CEO và nhân sự xem được');
  const { results } = await c.env.DB.prepare('SELECT user_id, scopes, updated_at FROM dt_editor').all<{ user_id: string; scopes: string; updated_at: string }>();
  const auto = Object.entries(m.users)
    .filter(([, u]) => u.role === 'admin' || u.hr || (['truongphong', 'lead'].includes(u.role) && u.pb))
    .map(([id, u]) => ({ id, name: u.name, pb: u.pb, role: u.role, hr: u.hr }));
  return ok(c, { granted: results.map((r) => ({ ...r, scopes: parseJsonArr(r.scopes), name: m.users[r.user_id]?.name ?? '' })), auto,
    users: Object.entries(m.users).map(([id, u]) => ({ id, name: u.name, pb: u.pb })) });
});

daoTaoRoutes.put('/editors/:uid', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  if (!v.ceo) throw forbidden('Chỉ CEO giao quyền soạn');
  const raw = ((await c.req.json().catch(() => ({}))) as { scopes?: unknown }).scopes;
  const scopes = (Array.isArray(raw) ? raw : []).map(String).filter((s) => s === 'chung' || s === 'web' || /^team:[\w.-]{1,40}$/.test(s)).slice(0, 30);
  const uid = c.req.param('uid');
  const now = nowIso();
  await c.env.DB.batch([
    scopes.length
      ? c.env.DB.prepare(
          `INSERT INTO dt_editor (user_id, scopes, updated_at, updated_by) VALUES (?, ?, ?, ?)
           ON CONFLICT (user_id) DO UPDATE SET scopes = excluded.scopes, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        ).bind(uid, JSON.stringify(scopes), now, auth.user.id)
      : c.env.DB.prepare('DELETE FROM dt_editor WHERE user_id = ?').bind(uid),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'DT_EDITOR_SET', entityType: 'DT_EDITOR', entityId: uid, after: { scopes } }),
  ]);
  return ok(c, { user_id: uid, scopes });
});

const IMG_MAX = 1_500_000;
const IMG_OK = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Ảnh chụp màn hình chèn vào tài liệu (người soạn được ít nhất một loại tài liệu). */
daoTaoRoutes.post('/img', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  if (!isEditor(v)) throw forbidden('Chỉ người soạn tài liệu chèn được ảnh');
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw badRequest('MISSING', 'Chưa chọn ảnh');
  if (!IMG_OK.includes(file.type)) throw badRequest('BAD_TYPE', 'Chỉ chèn được ảnh (jpg, png, gif, webp)');
  if (file.size > IMG_MAX) throw badRequest('TOO_LARGE', 'Ảnh quá 1,5 MB, chị thu nhỏ hoặc chụp lại giúp em');
  const id = newId();
  await c.env.DB.prepare('INSERT INTO dt_img (id, mime, size, data, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, file.type, file.size, new Uint8Array(await file.arrayBuffer()), nowIso(), auth.user.id)
    .run();
  return ok(c, { id });
});

daoTaoRoutes.get('/img/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT mime, data FROM dt_img WHERE id = ?').bind(c.req.param('id')).first<{ mime: string; data: unknown }>();
  if (!row) throw notFound();
  const d = row.data;
  const bytes =
    d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : Array.isArray(d) ? Uint8Array.from(d as number[]) : Uint8Array.from(Object.values(d as object) as number[]);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': IMG_OK.includes(row.mime) ? row.mime : 'application/octet-stream',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

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
  drive_id: string; drive_mod: string; drive_sync_at: string | null; files: string;
  approved_at: string | null; pending: string; pending_by: string | null; pending_at: string | null; review_note: string | null;
};

async function ctx(db: D1Database, auth: AuthContext): Promise<{ v: Viewer; m: Members }> {
  const [m] = await Promise.all([loadMembers(db, auth.user.id), loadNames(db)]);
  const g = await db.prepare('SELECT scopes FROM dt_editor WHERE user_id = ?').bind(auth.user.id).first<{ scopes: string }>();
  return { v: viewerOf(auth.user.id, auth.user.role, m, parseJsonArr(g?.scopes)), m };
}

const lite = (r: DocRow) => ({ nhom: r.nhom, teams: parseJsonArr(r.teams), status: r.status, created_by: r.created_by });

/** Bỏ phần nặng (nội dung, đáp án) khi trả danh sách; người không soạn được thì không thấy đáp án câu kiểm tra. */
const who = (m: Members, id: string | null | undefined) => (!id ? '' : id.startsWith('he-thong') ? 'Hệ thống' : m.users[id]?.name || NAMES.get(id) || '');
/* Tên hiển thị của tài khoản (người chưa gắn vào danh sách nhân sự vẫn có tên). Giữ 5 phút trong máy chủ. */
let NAMES = new Map<string, string>();
let NAMES_AT = 0;
async function loadNames(db: D1Database) {
  if (Date.now() - NAMES_AT < 300_000) return;
  const { results } = await db.prepare('SELECT id, display_name FROM users').all<{ id: string; display_name: string }>();
  NAMES = new Map(results.map((r) => [r.id, r.display_name]));
  NAMES_AT = Date.now();
}
const pendingOf = (r: DocRow) => { try { return r.pending ? (JSON.parse(r.pending) as Record<string, unknown>) : null; } catch { return null; } };

function shape(r: DocRow, v: Viewer, withBody: boolean, m: Members) {
  const quiz = parseJsonArr<Quiz[number]>(r.quiz);
  const edit = canEditDoc(v, lite(r));
  const pend = edit || v.ceo ? pendingOf(r) : null;
  return {
    updated_by_name: who(m, r.updated_by), approved_at: r.approved_at ?? null, approved_by_name: who(m, r.approved_by),
    has_pending: !!r.pending && (edit || v.ceo), pending_by_name: pend ? who(m, r.pending_by) : '', pending_at: pend ? r.pending_at : null,
    review_note: edit ? r.review_note ?? '' : '',
    ...(withBody && pend ? { pending: pend } : {}),
    id: r.id, nhom: r.nhom, teams: parseJsonArr(r.teams), title: r.title, summary: r.summary, version: r.version, status: r.status,
    bat_buoc: r.bat_buoc, lo_trinh: r.lo_trinh, han_ngay: r.han_ngay, sort: r.sort, updated_at: r.updated_at, updated_by: r.updated_by,
    published_at: r.published_at, quiz_n: quiz.length, can_edit: edit, drive_id: r.drive_id ?? '', drive_mod: r.drive_mod ?? '', drive_sync_at: r.drive_sync_at ?? null, files: parseJsonArr(r.files),
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
  if (!key) throw badRequest('DRIVE_OFF', 'Web chưa nối Google Drive. Nhờ CEO nối Google Drive trước.');
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

/** Người soạn dán link một file trên Drive (PDF, bảng tính, trình chiếu, thư mục…): web thử đọc tên file; không đọc được vẫn nhận link. */
daoTaoRoutes.post('/drive/ten', async (c) => {
  const { v } = await ctx(c.env.DB, c.get('auth'));
  if (!isEditor(v)) throw forbidden('Chỉ người soạn tài liệu dùng được');
  const link = String(((await c.req.json().catch(() => ({}))) as { link?: unknown }).link ?? '').trim();
  if (!/^https:\/\/\S+$/.test(link) || link.length > 500) throw badRequest('BAD_LINK', 'Dán link bắt đầu bằng https://');
  const id = /google\.com/.test(link) ? driveIdFrom(link) : null;
  const key = saKey(c.env.GDRIVE_SA_JSON);
  let name = /google\.com/.test(link) ? 'File trên Google Drive' : link.replace(/^https:\/\//, '').slice(0, 80);
  let mime = /\/folders\//.test(link) ? 'application/vnd.google-apps.folder' : '';
  if (id && key) {
    try {
      const f = await fileInfo(key, id);
      if (f) { name = f.name; mime = f.mimeType; }
    } catch { /* không đọc được tên thì giữ tên mặc định */ }
  }
  return ok(c, { url: link, name: name.slice(0, 200), mime });
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
  const { v, m } = await ctx(c.env.DB, auth);
  const docs = (await allDocs(c.env.DB)).filter((r) => canSeeDoc(v, lite(r)));
  const { results: acks } = await c.env.DB.prepare('SELECT doc_id, version, score, at FROM dt_ack WHERE user_id = ?')
    .bind(auth.user.id)
    .all<{ doc_id: string; version: number; score: number | null; at: string }>();
  return ok(c, { docs: docs.map((r) => shape(r, v, false, m)), acks });
});

daoTaoRoutes.get('/docs/:id', async (c) => {
  const auth = c.get('auth');
  const { v, m } = await ctx(c.env.DB, auth);
  const r = await refreshDrive(c.env, await getDoc(c.env.DB, c.req.param('id')));
  if (!canSeeDoc(v, lite(r))) throw forbidden('Tài liệu này chỉ dành cho team khác');
  const [{ results: hoi }, ack] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM dt_hoi WHERE doc_id = ? ORDER BY created_at DESC LIMIT 100').bind(r.id).all<{ user_id: string }>(),
    c.env.DB.prepare('SELECT version, score, at FROM dt_ack WHERE doc_id = ? AND user_id = ?').bind(r.id, auth.user.id).first(),
  ]);
  // Người đọc thường chỉ thấy câu hỏi của mình; người soạn thấy hết để trả lời.
  const edit = canEditDoc(v, lite(r));
  return ok(c, { ...shape(r, v, true, m), ack: ack ?? null, hoi: edit ? hoi : hoi.filter((h) => h.user_id === auth.user.id) });
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
  /** Tệp đính kèm đã tải lên qua POST /file. */
  files: z.array(z.union([
    z.object({ id: z.string().uuid(), name: z.string().max(200), size: z.number().int().min(0), mime: z.string().max(120) }),
    /** Link file trên Google Drive (hoặc trang web khác): chỉ lưu đường dẫn, mở bằng quyền Drive của người đọc. */
    z.object({ url: z.string().url().max(500).refine((u) => u.startsWith('https://'), 'Link phải bắt đầu bằng https://'), name: z.string().trim().min(1).max(200), mime: z.string().max(120).default('') }),
  ])).max(20).default([]),
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

/** Gắn tệp vừa tải lên vào tài liệu (tệp đã thuộc tài liệu khác thì không chuyển). */
const linkFiles = (db: D1Database, docId: string, files: ({ id: string } | { url: string })[]) =>
  files.filter((f): f is { id: string } => 'id' in f).map((f) => db.prepare('UPDATE dt_file SET doc_id = ? WHERE id = ? AND (doc_id IS NULL OR doc_id = ?)').bind(docId, f.id, docId));

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
         created_at, created_by, updated_at, updated_by, published_at, approved_by, drive_id, drive_mod, drive_sync_at, files)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, d.nhom, JSON.stringify(d.teams), d.title, d.summary, g.body, status, d.bat_buoc, d.lo_trinh, d.han_ngay, JSON.stringify(d.quiz), d.sort,
      now, auth.user.id, now, auth.user.id, status === 'dang' ? now : null, status === 'dang' ? auth.user.id : null,
      g.drive_id, g.drive_mod, g.drive_sync_at, JSON.stringify(d.files)),
    ...(status === 'dang' ? [c.env.DB.prepare('UPDATE dt_doc SET approved_at = ? WHERE id = ?').bind(now, id)] : []),
    ...linkFiles(c.env.DB, id, d.files),
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
  const g = await withDrive(c.env, d);
  // Người khác CEO sửa tài liệu đang hiện: cất bản sửa chờ CEO duyệt, mọi người vẫn đọc bản đã duyệt.
  if (!v.ceo && old.status === 'dang') {
    const pend = { nhom: d.nhom, teams: d.teams, title: d.title, summary: d.summary, body: g.body, bat_buoc: d.bat_buoc, lo_trinh: d.lo_trinh,
      han_ngay: d.han_ngay, quiz: d.quiz, sort: d.sort, drive_id: g.drive_id, drive_mod: g.drive_mod, files: d.files, major: d.major };
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE dt_doc SET pending = ?, pending_by = ?, pending_at = ?, review_note = NULL WHERE id = ?').bind(JSON.stringify(pend), auth.user.id, now, old.id),
      ...linkFiles(c.env.DB, old.id, d.files),
      auditStatement(c.env.DB, { actorId: auth.user.id, action: 'DT_DOC_EDIT_PENDING', entityType: 'DT_DOC', entityId: old.id, after: { title: d.title } }),
    ]);
    return ok(c, { id: old.id, status: 'cho_duyet', pending: true, version: old.version });
  }
  // Một tài liệu một nội dung: lưu nháp là gỡ xuống. CEO đăng là duyệt luôn; người khác đăng thì chờ CEO duyệt.
  const status = d.action === 'dang' ? publishStatus(v, d.nhom) : 'nhap';
  const version = old.version + (d.major && old.published_at ? 1 : 0);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE dt_doc SET nhom = ?, teams = ?, title = ?, summary = ?, body = ?, version = ?, status = ?, bat_buoc = ?, lo_trinh = ?, han_ngay = ?,
         quiz = ?, sort = ?, updated_at = ?, updated_by = ?, published_at = CASE WHEN ? = 'dang' THEN COALESCE(published_at, ?) ELSE published_at END,
         approved_by = CASE WHEN ? = 'dang' THEN ? ELSE approved_by END, approved_at = CASE WHEN ? = 'dang' THEN ? ELSE approved_at END,
         drive_id = ?, drive_mod = ?, drive_sync_at = ?, files = ?, pending = '', pending_by = NULL, pending_at = NULL, review_note = NULL WHERE id = ?`,
    ).bind(d.nhom, JSON.stringify(d.teams), d.title, d.summary, g.body, version, status, d.bat_buoc, d.lo_trinh, d.han_ngay, JSON.stringify(d.quiz),
      d.sort, now, auth.user.id, status, now, status, auth.user.id, status, now, g.drive_id, g.drive_mod, g.drive_sync_at, JSON.stringify(d.files), old.id),
    ...linkFiles(c.env.DB, old.id, d.files),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'DT_DOC_EDIT', entityType: 'DT_DOC', entityId: old.id,
      before: { title: old.title, version: old.version, status: old.status }, after: { title: d.title, version, status } }),
  ]);
  return ok(c, { id: old.id, status, version });
});

/** CEO duyệt: tài liệu mới chờ duyệt, hoặc bản sửa đang chờ của tài liệu đã hiện. */
daoTaoRoutes.post('/docs/:id/approve', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  if (!v.ceo) throw forbidden('Chỉ CEO duyệt tài liệu');
  const r = await getDoc(c.env.DB, c.req.param('id'));
  const p = pendingOf(r) as null | { nhom: string; teams: string[]; title: string; summary: string; body: string; bat_buoc: string; lo_trinh: string;
    han_ngay: number; quiz: unknown[]; sort: number; drive_id: string; drive_mod: string; files: unknown[]; major: boolean };
  if (r.status !== 'cho_duyet' && !p) throw badRequest('NOT_PENDING', 'Tài liệu không có gì chờ duyệt');
  const now = nowIso();
  await c.env.DB.batch([
    p
      ? c.env.DB.prepare(
          `UPDATE dt_doc SET nhom = ?, teams = ?, title = ?, summary = ?, body = ?, bat_buoc = ?, lo_trinh = ?, han_ngay = ?, quiz = ?, sort = ?, drive_id = ?,
             drive_mod = ?, files = ?, version = version + ?, updated_at = ?, updated_by = ?, status = 'dang', approved_by = ?, approved_at = ?,
             pending = '', pending_by = NULL, pending_at = NULL, review_note = NULL WHERE id = ?`,
        ).bind(p.nhom, JSON.stringify(p.teams), p.title, p.summary, p.body, p.bat_buoc, p.lo_trinh, p.han_ngay, JSON.stringify(p.quiz), p.sort, p.drive_id ?? '',
          p.drive_mod ?? '', JSON.stringify(p.files ?? []), p.major ? 1 : 0, r.pending_at ?? now, r.pending_by ?? auth.user.id, auth.user.id, now, r.id)
      : c.env.DB.prepare("UPDATE dt_doc SET status = 'dang', approved_by = ?, approved_at = ?, published_at = COALESCE(published_at, ?), review_note = NULL WHERE id = ?")
          .bind(auth.user.id, now, now, r.id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'DT_DOC_APPROVE', entityType: 'DT_DOC', entityId: r.id }),
  ]);
  return ok(c, { id: r.id, status: 'dang' });
});

/** CEO trả lại kèm lời nhắn: bỏ bản sửa đang chờ (giữ bản đã duyệt), hoặc đưa tài liệu mới về nháp để người soạn sửa. */
daoTaoRoutes.post('/docs/:id/tra-lai', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  if (!v.ceo) throw forbidden('Chỉ CEO trả lại tài liệu');
  const r = await getDoc(c.env.DB, c.req.param('id'));
  const note = String(((await c.req.json().catch(() => ({}))) as { note?: unknown }).note ?? '').trim().slice(0, 1000);
  if (r.pending) {
    await c.env.DB.prepare("UPDATE dt_doc SET pending = '', pending_by = NULL, pending_at = NULL, review_note = ? WHERE id = ?").bind(note || 'CEO trả lại bản sửa', r.id).run();
  } else if (r.status === 'cho_duyet') {
    await c.env.DB.prepare("UPDATE dt_doc SET status = 'nhap', review_note = ? WHERE id = ?").bind(note || 'CEO trả lại', r.id).run();
  } else throw badRequest('NOT_PENDING', 'Tài liệu không có gì chờ duyệt');
  return ok(c, { id: r.id });
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
  if (text.length < 3) throw badRequest('EMPTY', 'Gõ câu hỏi trước khi gửi');
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
  if (file.size > IMG_MAX) throw badRequest('TOO_LARGE', 'Ảnh quá 1,5 MB, hãy thu nhỏ hoặc chụp lại');
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

/* ---------- Tệp đính kèm (Word, PDF, Excel, PowerPoint, ảnh): tối đa 1,8 MB mỗi tệp, cất trong D1 như file hồ sơ nhân sự ---------- */
const FILE_MAX = 1_800_000;
const FILE_EXT: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain',
};
const INLINE_MIME = ['application/pdf', 'image/png', 'image/jpeg'];

daoTaoRoutes.post('/file', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  if (!isEditor(v)) throw forbidden('Chỉ người soạn tài liệu tải tệp lên được');
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw badRequest('MISSING', 'Chưa chọn tệp');
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const mime = FILE_EXT[ext];
  if (!mime) throw badRequest('BAD_TYPE', 'Chỉ tải được Word, PDF, Excel, PowerPoint hoặc ảnh');
  if (file.size > FILE_MAX) throw badRequest('TOO_LARGE', 'Tệp quá 1,8 MB. File lớn hơn thì để trên Google Drive rồi dán link Google Docs, hoặc lưu PDF nhỏ lại.');
  const id = newId();
  const name = file.name.slice(0, 200);
  await c.env.DB.prepare('INSERT INTO dt_file (id, name, mime, size, data, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, name, mime, file.size, new Uint8Array(await file.arrayBuffer()), nowIso(), auth.user.id)
    .run();
  return ok(c, { id, name, size: file.size, mime });
});

daoTaoRoutes.get('/file/:id', async (c) => {
  const auth = c.get('auth');
  const { v } = await ctx(c.env.DB, auth);
  const row = await c.env.DB.prepare('SELECT doc_id, name, mime, data, created_by FROM dt_file WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ doc_id: string | null; name: string; mime: string; data: unknown; created_by: string }>();
  if (!row) throw notFound('Không tìm thấy tệp');
  if (row.doc_id) {
    const r = await getDoc(c.env.DB, row.doc_id);
    if (!canSeeDoc(v, lite(r))) throw forbidden('Tệp này thuộc tài liệu của team khác');
  } else if (row.created_by !== auth.user.id && !v.ceo) throw forbidden();
  const d = row.data;
  const bytes =
    d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : Array.isArray(d) ? Uint8Array.from(d as number[]) : Uint8Array.from(Object.values(d as object) as number[]);
  const inline = INLINE_MIME.includes(row.mime) && c.req.query('tai') !== '1';
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': row.mime,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

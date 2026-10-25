import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, notFound, ok, unauthorized } from '../lib/http';
import { newId } from '../lib/ids';
import { requirePermission } from '../middleware/rbac';
import { agentDone, claimDueForAgent, createDrafts, type RawDraft } from '../services/fpPublish';

/**
 * Hàng việc gửi sang Worker dựng video (máy ở văn phòng).
 *  - /api/hub/worker-tasks : trang quản trị tạo việc và xem tiến độ (cần đăng nhập + quyền khu quản trị).
 *  - /api/worker/pull, /api/worker/push : Worker tự gọi, xác thực bằng khoá riêng WORKER_KEY (secret của Worker web).
 */
const KINDS = [
  'win_analyze', 'win_approve', 'win_fix', 'win_child_ok', 'win_child_fix',
  // Thẻ video ở Marketing: dựng one shot / chèn chữ / sửa video có sẵn / giọng đọc; duyệt, góp ý sửa, duyệt kịch bản
  'card_build', 'card_ok', 'card_fix', 'card_redo', 'card_script_ok', 'card_script_fix', 'card_script_edit', 'card_notify',
  // Công xưởng SX video: nhân sự tự đặt order bằng tay, tách hẳn khỏi luồng thẻ video
  'xuong_build', 'xuong_ok', 'xuong_fix', 'xuong_redo', 'xuong_script_ok', 'xuong_script_fix', 'xuong_script_edit',
  // Buổi quay xong: quét thư mục cảnh vào kho cảnh của Worker (như lệnh /quet trên Telegram)
  'card_scan',
  // Xuất hook / kịch bản ra Excel hoặc Word, Worker lưu vào Google Drive của công ty và trả link
  'card_export',
  // Fanpage: agent viết nội dung (fp_write) và tự lên lịch bài theo yêu cầu của chị (fp_plan)
  'fp_write', 'fp_plan',
] as const;
const STATUSES = ['queued', 'taken', 'running', 'review', 'building', 'done', 'error'] as const;

type TaskRow = {
  id: string;
  kind: string;
  ref: string | null;
  payload: string;
  status: string;
  progress: number;
  detail: string | null;
  worker_job: string | null;
  result: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const view = (r: TaskRow) => ({
  ...r,
  payload: JSON.parse(r.payload || '{}'),
  result: r.result ? JSON.parse(r.result) : null,
});

export const hubWorkerRoutes = new Hono<AppEnv>();
hubWorkerRoutes.use('*', requirePermission('hub.access'));

hubWorkerRoutes.get('/', async (c) => {
  // ?kind=card: việc của thẻ video Marketing; mặc định: việc video win (Hypit) như cũ.
  // ?kind=xuong: order của trang Công xưởng SX video.
  const card = c.req.query('kind') === 'card';
  const xuong = c.req.query('kind') === 'xuong';
  const fp = c.req.query('kind') === 'fp';
  const rows = await c.env.DB.prepare(
    fp
      ? "SELECT * FROM worker_tasks WHERE substr(kind,1,3) = 'fp_' ORDER BY created_at DESC LIMIT 500"
      : xuong
      ? "SELECT * FROM worker_tasks WHERE kind LIKE 'xuong%' ORDER BY created_at DESC LIMIT 500"
      : card
      ? "SELECT * FROM worker_tasks WHERE kind LIKE 'card%' ORDER BY created_at DESC LIMIT 500"
      : "SELECT * FROM worker_tasks WHERE kind NOT LIKE 'card%' AND kind NOT LIKE 'xuong%' AND substr(kind,1,3) <> 'fp_' ORDER BY created_at DESC LIMIT 200",
  ).all<TaskRow>();
  return ok(c, (rows.results ?? []).map(view));
});

hubWorkerRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { kind?: string; ref?: string; payload?: unknown };
  if (!(KINDS as readonly string[]).includes(String(body.kind))) throw badRequest('BAD_KIND', 'Loại việc không hợp lệ');
  const payload = JSON.stringify(body.payload ?? {});
  if (payload.length > 200_000) throw badRequest('TOO_LARGE', 'Nội dung quá dài');
  const id = 'WT-' + newId().slice(0, 10).toUpperCase();
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO worker_tasks (id, kind, ref, payload, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)`,
  )
    .bind(id, body.kind, body.ref ?? null, payload, c.get('auth').user.id, now, now)
    .run();
  return ok(c, { id });
});

/**
 * Xem bản nháp video: phát thẳng từ máy dựng ở văn phòng qua đường kết nối riêng (máy dựng tự báo địa chỉ),
 * không chép file đi đâu. Người xem phải đăng nhập và có quyền khu quản trị.
 */
hubWorkerRoutes.get('/preview/:job', async (c) => {
  const job = c.req.param('job');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(job)) throw badRequest('BAD_JOB', 'Mã video không hợp lệ');
  const row = await c.env.DB.prepare("SELECT v FROM app_kv WHERE k = 'worker_preview_url'").first<{ v: string }>();
  if (!row || !c.env.WORKER_KEY) throw notFound('Máy dựng chưa bật đường xem bản nháp');
  const headers: Record<string, string> = { 'X-Worker-Key': c.env.WORKER_KEY };
  const range = c.req.header('Range');
  if (range) headers.Range = range;
  let res: Response;
  try {
    res = await fetch(`${row.v}/preview/${job}`, { headers });
  } catch {
    throw notFound('Không kết nối được máy dựng (máy văn phòng có đang bật không?)');
  }
  if (!res.ok && res.status !== 206) throw notFound(res.status === 404 ? 'Chưa có bản nháp cho video này' : 'Máy dựng chưa trả được video');
  const out = new Headers();
  for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  out.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers: out });
});

/* ---------- Worker gọi ---------- */
export const workerRoutes = new Hono<AppEnv>();

workerRoutes.use('*', async (c, next) => {
  const key = c.req.header('X-Worker-Key') ?? '';
  const expected = c.env.WORKER_KEY ?? '';
  if (!expected || key.length !== expected.length) throw unauthorized('Sai khoá Worker');
  // So sánh không lộ thời gian.
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) throw unauthorized('Sai khoá Worker');
  await next();
});

/** Lấy việc mới; đánh dấu đã nhận để không ai lấy trùng. */
workerRoutes.post('/pull', async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT * FROM worker_tasks WHERE status = 'queued' AND substr(kind,1,3) <> 'fp_' ORDER BY created_at LIMIT 10",
  ).all<TaskRow>();
  const list = rows.results ?? [];
  const now = nowIso();
  for (const r of list) {
    await c.env.DB.prepare("UPDATE worker_tasks SET status = 'taken', updated_at = ? WHERE id = ? AND status = 'queued'")
      .bind(now, r.id)
      .run();
  }
  return ok(c, list.map(view));
});

/** Gửi tiến độ / kết quả của một việc. */
workerRoutes.post('/push', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    progress?: number;
    detail?: string;
    worker_job?: string;
    result?: unknown;
  };
  if (!body.id) throw badRequest('NO_ID', 'Thiếu mã việc');
  if (body.status && !(STATUSES as readonly string[]).includes(body.status)) throw badRequest('BAD_STATUS', 'Trạng thái lạ');
  const row = await c.env.DB.prepare('SELECT id FROM worker_tasks WHERE id = ?').bind(body.id).first();
  if (!row) throw notFound('Không có việc này');
  const result = body.result === undefined ? null : JSON.stringify(body.result);
  if (result && result.length > 900_000) throw badRequest('TOO_LARGE', 'Kết quả quá lớn');
  await c.env.DB.prepare(
    `UPDATE worker_tasks SET status = COALESCE(?, status), progress = COALESCE(?, progress), detail = COALESCE(?, detail),
       worker_job = COALESCE(?, worker_job), result = COALESCE(?, result), updated_at = ? WHERE id = ?`,
  )
    .bind(
      body.status ?? null,
      Number.isFinite(body.progress) ? Math.round(Number(body.progress)) : null,
      body.detail ? String(body.detail).slice(0, 1000) : null,
      body.worker_job ?? null,
      result,
      nowIso(),
      body.id,
    )
    .run();
  return ok(c, { ok: true });
});

/** Máy dựng báo địa chỉ đường xem bản nháp (đổi mỗi lần máy dựng khởi động lại). */
workerRoutes.post('/preview-url', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { url?: string };
  const url = String(body.url ?? '').replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url)) throw badRequest('BAD_URL', 'Địa chỉ không hợp lệ');
  await c.env.DB.prepare(
    `INSERT INTO app_kv (k, v, updated_at) VALUES ('worker_preview_url', ?, ?)
     ON CONFLICT (k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`,
  )
    .bind(url, nowIso())
    .run();
  return ok(c, { ok: true });
});

/* ---------- Agent Fanpage (OpenClaw trên VPS) gọi: khoá riêng FP_KEY, chỉ thấy việc fp_* ---------- */
export const fpAgentRoutes = new Hono<AppEnv>();
fpAgentRoutes.use('*', async (c, next) => {
  const key = c.req.header('X-Fp-Key') ?? '';
  const expected = c.env.FP_KEY ?? '';
  if (!expected || key.length !== expected.length) throw unauthorized('Sai khoá');
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) throw unauthorized('Sai khoá');
  await next();
});
/** Agent hỏi bài Fanpage tới giờ đăng (đã duyệt, đã chọn page + giờ); trả về rồi coi như đã nhận. */
fpAgentRoutes.post('/due', async (c) => ok(c, await claimDueForAgent(c.env.DB)));
/** Agent báo đã đăng xong (ok + fb_post_id) hoặc lỗi (error). */
fpAgentRoutes.post('/done', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { card_id?: string; ok?: boolean; fb_post_id?: string; error?: string };
  if (!body.card_id) throw badRequest('NO_ID', 'Thiếu mã bài');
  if (!(await agentDone(c.env.DB, body))) throw notFound('Không thấy bài');
  return ok(c, { ok: true });
});
/** Agent tạo bài vào lịch (luôn vào Chờ duyệt, chị duyệt rồi mới đăng). Gửi lại cùng bài thì bỏ qua, không nhân đôi. */
fpAgentRoutes.post('/draft', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { task_id?: string; posts?: RawDraft[] };
  if (!Array.isArray(body.posts) || !body.posts.length) throw badRequest('NO_POSTS', 'Chưa có bài nào');
  return ok(c, await createDrafts(c.env.DB, String(body.task_id ?? ''), body.posts));
});
fpAgentRoutes.post('/pull', async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT * FROM worker_tasks WHERE status = 'queued' AND substr(kind,1,3) = 'fp_' ORDER BY created_at LIMIT 5",
  ).all<TaskRow>();
  const list = rows.results ?? [];
  const now = nowIso();
  for (const r of list) {
    await c.env.DB.prepare("UPDATE worker_tasks SET status = 'taken', updated_at = ? WHERE id = ? AND status = 'queued'").bind(now, r.id).run();
  }
  return ok(c, list.map(view));
});
fpAgentRoutes.post('/push', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { id?: string; status?: string; progress?: number; detail?: string; result?: unknown };
  if (!body.id) throw badRequest('NO_ID', 'Thiếu mã việc');
  if (body.status && !(STATUSES as readonly string[]).includes(body.status)) throw badRequest('BAD_STATUS', 'Trạng thái lạ');
  const row = await c.env.DB.prepare("SELECT id FROM worker_tasks WHERE id = ? AND substr(kind,1,3) = 'fp_'").bind(body.id).first();
  if (!row) throw notFound('Không có việc này');
  const result = body.result === undefined ? null : JSON.stringify(body.result);
  if (result && result.length > 900_000) throw badRequest('TOO_LARGE', 'Kết quả quá lớn');
  await c.env.DB.prepare(
    `UPDATE worker_tasks SET status = COALESCE(?, status), progress = COALESCE(?, progress), detail = COALESCE(?, detail),
       result = COALESCE(?, result), updated_at = ? WHERE id = ?`,
  ).bind(body.status ?? null, Number.isFinite(body.progress) ? Math.round(Number(body.progress)) : null, body.detail ? String(body.detail).slice(0, 1000) : null, result, nowIso(), body.id).run();
  return ok(c, { ok: true });
});

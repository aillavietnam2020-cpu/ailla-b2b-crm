import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, notFound, ok, unauthorized } from '../lib/http';
import { allowedAgents } from './agentChat';

/**
 * Nút ghi âm của web Điều hành agent: trình duyệt thu âm, gửi lên đây; máy ở văn phòng (Whisper large-v3 chạy bằng card đồ họa)
 * lấy về nghe rồi trả chữ. Máy tắt thì web tự quay về cách nhận giọng của trình duyệt.
 *  - /api/agent-chat/stt : người đang đăng nhập gửi âm thanh và hỏi kết quả.
 *  - /api/stt-worker     : chương trình nghe trên máy văn phòng, xác thực bằng WORKER_KEY như Worker dựng video.
 */
const SEEN_KEY = 'stt_worker_seen';
const ONLINE_MS = 30_000;
const TAKEN_STALE_MS = 120_000;
const MAX_AUDIO_B64 = 1_400_000; // D1 giới hạn khoảng 2 MB một giá trị; ~4 phút âm thanh nén

export const sttRoutes = new Hono<AppEnv>();

async function workerOnline(db: D1Database): Promise<boolean> {
  const r = await db.prepare('SELECT v FROM app_kv WHERE k = ?').bind(SEEN_KEY).first<{ v: string }>();
  return !!r && Date.now() - Date.parse(r.v) < ONLINE_MS;
}

sttRoutes.get('/status', async (c) => ok(c, { online: await workerOnline(c.env.DB) }));

sttRoutes.post('/', async (c) => {
  const user = c.get('auth').user;
  if (!(await allowedAgents(c.env.DB, user)).length) throw badRequest('NO_ACCESS', 'Bạn chưa được cấp quyền nhắn agent');
  const b = (await c.req.json().catch(() => ({}))) as { audio_b64?: string; mime?: string };
  const mime = String(b.mime ?? '').split(';')[0].trim().toLowerCase();
  if (!/^audio\/(webm|ogg|mp4|mpeg|wav|x-wav|aac)$/.test(mime)) throw badRequest('BAD_MIME', 'Định dạng âm thanh chưa nhận');
  if (typeof b.audio_b64 !== 'string' || !b.audio_b64 || b.audio_b64.length > MAX_AUDIO_B64 || !/^[A-Za-z0-9+/=]+$/.test(b.audio_b64)) {
    throw badRequest('BAD_AUDIO', 'Đoạn ghi âm quá dài hoặc không đúng (tối đa khoảng 4 phút)');
  }
  const now = nowIso();
  await c.env.DB.prepare("DELETE FROM agent_stt_jobs WHERE created_at < ?").bind(new Date(Date.now() - 86_400_000).toISOString()).run();
  await c.env.DB.prepare('INSERT INTO agent_stt_jobs (owner_id, mime, audio, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(user.id, mime, b.audio_b64, now, now)
    .run();
  const row = await c.env.DB.prepare('SELECT MAX(id) AS id FROM agent_stt_jobs WHERE owner_id = ?').bind(user.id).first<{ id: number }>();
  return ok(c, { id: row!.id });
});

sttRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const r = await c.env.DB.prepare('SELECT status, text, error FROM agent_stt_jobs WHERE id = ? AND owner_id = ?')
    .bind(id, c.get('auth').user.id)
    .first<{ status: string; text: string | null; error: string | null }>();
  if (!r) throw notFound('Không có đoạn ghi âm này');
  return ok(c, r);
});

export const sttWorkerRoutes = new Hono<AppEnv>();

sttWorkerRoutes.use('*', async (c, next) => {
  const key = c.req.header('X-Worker-Key') ?? '';
  const expected = c.env.WORKER_KEY ?? '';
  if (!expected || key.length !== expected.length) throw unauthorized('Sai khoá Worker');
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) throw unauthorized('Sai khoá Worker');
  await next();
});

/** Lấy một đoạn ghi âm đang chờ; cũng là tín hiệu "máy nghe đang bật". */
sttWorkerRoutes.post('/pull', async (c) => {
  const now = nowIso();
  await c.env.DB.prepare("INSERT INTO app_kv (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at")
    .bind(SEEN_KEY, now, now)
    .run();
  await c.env.DB.prepare("UPDATE agent_stt_jobs SET status = 'queued' WHERE status = 'taken' AND updated_at < ?")
    .bind(new Date(Date.now() - TAKEN_STALE_MS).toISOString())
    .run();
  const job = await c.env.DB.prepare("SELECT id, mime, audio FROM agent_stt_jobs WHERE status = 'queued' AND audio IS NOT NULL ORDER BY id LIMIT 1").first<{ id: number; mime: string; audio: string }>();
  if (!job) return ok(c, null);
  const res = await c.env.DB.prepare("UPDATE agent_stt_jobs SET status = 'taken', updated_at = ? WHERE id = ? AND status = 'queued'").bind(now, job.id).run();
  if (!res.meta.changes) return ok(c, null);
  return ok(c, job);
});

sttWorkerRoutes.post('/push', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { id?: number; text?: string; error?: string };
  const id = Number(b.id);
  if (!Number.isInteger(id)) throw badRequest('NO_ID', 'Thiếu mã');
  const err = b.error ? String(b.error).slice(0, 300) : null;
  const text = err ? null : String(b.text ?? '').slice(0, 20_000);
  await c.env.DB.prepare("UPDATE agent_stt_jobs SET status = ?, text = ?, error = ?, audio = NULL, updated_at = ? WHERE id = ?")
    .bind(err ? 'error' : 'done', text, err, nowIso(), id)
    .run();
  return ok(c, { ok: true });
});

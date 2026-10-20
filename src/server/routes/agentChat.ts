import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import { AGENT_IDS, AGENT_ROSTER } from '@shared/agentRoster';
import type { AppEnv } from '../env';
import { forbidden, badRequest, notFound, ok, unauthorized } from '../lib/http';
import { requirePermission } from '../middleware/rbac';

/**
 * Nhắn agent ngay trên web.
 *  - /api/agent-chat : chị (CEO) xem danh sách agent, đọc và gửi tin. Tin vào hàng đợi.
 *  - /api/agent-relay      : chương trình nhỏ trên VPS (cầu nối) lấy tin về, nhờ agent trả lời, gửi trả lời lên.
 *    Xác thực bằng khoá riêng AGENT_RELAY_KEY (secret của Worker), không dùng phiên đăng nhập.
 * Web chỉ chuyển lời; mọi việc agent làm với dữ liệu thật vẫn đi qua cổng /api/agent (đọc + đề xuất chờ duyệt).
 */

const SEEN_KEY = 'agent_relay_seen';
const ONLINE_MS = 90_000;
const STUCK_MS = 20 * 60_000;

type Msg = {
  id: number;
  agent: string;
  role: string;
  body: string;
  status: string;
  tg: number;
  reply_to: number | null;
  created_at: string;
};

/* ---------- Chị dùng trên web ---------- */
export const agentChatRoutes = new Hono<AppEnv>();
agentChatRoutes.use('*', requirePermission('user.manage'));
agentChatRoutes.use('*', async (c, next) => {
  if (c.get('auth').user.role !== 'CEO') throw forbidden('Chỉ chủ doanh nghiệp được nhắn agent trên web.');
  await next();
});

agentChatRoutes.get('/agents', async (c) => {
  const seen = await c.env.DB.prepare('SELECT v FROM app_kv WHERE k = ?').bind(SEEN_KEY).first<{ v: string }>();
  const online = !!seen && Date.now() - Date.parse(seen.v) < ONLINE_MS;
  const stats = await c.env.DB.prepare(
    `SELECT agent,
            SUM(CASE WHEN role = 'USER' AND status IN ('queued', 'taken') THEN 1 ELSE 0 END) AS pending,
            MAX(id) AS last_id
     FROM agent_chat GROUP BY agent`,
  ).all<{ agent: string; pending: number; last_id: number }>();
  const by = new Map((stats.results ?? []).map((r) => [r.agent, r]));
  return ok(c, {
    relay_online: online,
    relay_seen: seen?.v ?? null,
    agents: AGENT_ROSTER.map((a) => ({
      ...a,
      pending: by.get(a.id)?.pending ?? 0,
      last_id: by.get(a.id)?.last_id ?? 0,
    })),
  });
});

agentChatRoutes.get('/', async (c) => {
  const agent = c.req.query('agent') ?? '';
  if (!AGENT_IDS.includes(agent)) throw badRequest('BAD_AGENT', 'Agent không có trong danh sách');
  const after = Math.max(0, Math.floor(Number(c.req.query('after') ?? 0)) || 0);
  // Lần đầu lấy 100 tin gần nhất; các lần sau chỉ lấy tin mới hơn mốc.
  const rows = after
    ? await c.env.DB.prepare(
        `SELECT id, agent, role, body, status, tg, reply_to, created_at FROM agent_chat
         WHERE agent = ? AND id > ? ORDER BY id LIMIT 200`,
      )
        .bind(agent, after)
        .all<Msg>()
    : await c.env.DB.prepare(
        `SELECT * FROM (SELECT id, agent, role, body, status, tg, reply_to, created_at FROM agent_chat
         WHERE agent = ? ORDER BY id DESC LIMIT 100) ORDER BY id`,
      )
        .bind(agent)
        .all<Msg>();
  return ok(c, rows.results ?? []);
});

/** Cập nhật trạng thái các tin chị đã gửi (đang chờ / đang làm / xong / lỗi) để hiện trên màn hình. */
agentChatRoutes.get('/status', async (c) => {
  const agent = c.req.query('agent') ?? '';
  if (!AGENT_IDS.includes(agent)) throw badRequest('BAD_AGENT', 'Agent không có trong danh sách');
  const rows = await c.env.DB.prepare(
    `SELECT id, status FROM agent_chat WHERE agent = ? AND role = 'USER' ORDER BY id DESC LIMIT 30`,
  )
    .bind(agent)
    .all<{ id: number; status: string }>();
  return ok(c, rows.results ?? []);
});

agentChatRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { agent?: string; body?: string; tg?: boolean };
  const agent = String(body.agent ?? '');
  if (!AGENT_IDS.includes(agent)) throw badRequest('BAD_AGENT', 'Agent không có trong danh sách');
  const text = String(body.body ?? '').trim();
  if (!text) throw badRequest('EMPTY', 'Chưa gõ nội dung');
  if (text.length > 4000) throw badRequest('TOO_LONG', 'Tin quá dài (tối đa 4000 ký tự)');
  const now = nowIso();
  const res = await c.env.DB.prepare(
    `INSERT INTO agent_chat (agent, role, body, status, tg, created_by, created_at, updated_at)
     VALUES (?, 'USER', ?, 'queued', ?, ?, ?, ?)`,
  )
    .bind(agent, text, body.tg ? 1 : 0, c.get('auth').user.id, now, now)
    .run();
  return ok(c, { id: res.meta.last_row_id });
});

/* ---------- Cầu nối trên VPS gọi ---------- */
export const agentRelayRoutes = new Hono<AppEnv>();

agentRelayRoutes.use('*', async (c, next) => {
  const key = c.req.header('X-Relay-Key') ?? '';
  const expected = (c.env.AGENT_RELAY_KEY ?? '').trim(); // secret đặt từ PowerShell có thể dính ký tự xuống dòng
  if (!expected || key.length !== expected.length) throw unauthorized('Sai khoá cầu nối');
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) throw unauthorized('Sai khoá cầu nối');
  await next();
});

/** Lấy tin mới (tối đa 3), đánh dấu đã nhận để không ai lấy trùng. Cũng là tín hiệu "cầu nối đang sống". */
agentRelayRoutes.post('/pull', async (c) => {
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO app_kv (k, v, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`,
  )
    .bind(SEEN_KEY, now, now)
    .run();
  // Tin nhận rồi mà quá lâu không có trả lời (cầu nối chết giữa chừng): báo lỗi để chị biết gửi lại.
  const cutoff = new Date(Date.now() - STUCK_MS).toISOString();
  await c.env.DB.prepare(
    `UPDATE agent_chat SET status = 'error', updated_at = ? WHERE role = 'USER' AND status = 'taken' AND updated_at < ?`,
  )
    .bind(now, cutoff)
    .run();
  const rows = await c.env.DB.prepare(
    `SELECT id, agent, body, tg FROM agent_chat WHERE role = 'USER' AND status = 'queued' ORDER BY id LIMIT 3`,
  ).all<{ id: number; agent: string; body: string; tg: number }>();
  const list: typeof rows.results = [];
  for (const r of rows.results ?? []) {
    const res = await c.env.DB.prepare(
      `UPDATE agent_chat SET status = 'taken', updated_at = ? WHERE id = ? AND status = 'queued'`,
    )
      .bind(now, r.id)
      .run();
    if (res.meta.changes) list.push(r);
  }
  return ok(c, list);
});

/** Gửi câu trả lời (hoặc lỗi) của agent cho một tin. */
agentRelayRoutes.post('/push', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { id?: number; reply?: string; error?: string };
  const id = Number(b.id);
  if (!Number.isInteger(id)) throw badRequest('NO_ID', 'Thiếu mã tin');
  const row = await c.env.DB.prepare(`SELECT id, agent FROM agent_chat WHERE id = ? AND role = 'USER'`)
    .bind(id)
    .first<{ id: number; agent: string }>();
  if (!row) throw notFound('Không có tin này');
  const now = nowIso();
  const failed = !!b.error;
  const text = failed ? String(b.error).slice(0, 2000) : String(b.reply ?? '').trim().slice(0, 20000) || '(agent không trả lời nội dung)';
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO agent_chat (agent, role, body, status, reply_to, created_at, updated_at) VALUES (?, ?, ?, 'done', ?, ?, ?)`,
    ).bind(row.agent, failed ? 'SYSTEM' : 'AGENT', text, id, now, now),
    c.env.DB.prepare(`UPDATE agent_chat SET status = ?, updated_at = ? WHERE id = ?`).bind(failed ? 'error' : 'done', now, id),
  ]);
  return ok(c, { ok: true });
});

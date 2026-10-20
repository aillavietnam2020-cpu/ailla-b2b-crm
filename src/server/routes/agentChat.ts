import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import { AGENT_IDS, AGENT_ROSTER } from '@shared/agentRoster';
import type { AppEnv } from '../env';
import { forbidden, badRequest, notFound, ok, unauthorized } from '../lib/http';

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

const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_B64 = 2_000_000; // ~1,5 MB ảnh; D1 giới hạn khoảng 2 MB một giá trị

/** Gắn danh sách ảnh (id, tên) vào từng tin. */
async function withFiles<T extends { id: number }>(db: D1Database, msgs: T[]) {
  if (!msgs.length) return msgs.map((m) => ({ ...m, files: [] as Array<{ id: number; name: string }> }));
  const ids = msgs.map((m) => m.id);
  const rows = await db
    .prepare(`SELECT id, chat_id, name FROM agent_chat_files WHERE chat_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`)
    .bind(...ids)
    .all<{ id: number; chat_id: number; name: string }>();
  const by = new Map<number, Array<{ id: number; name: string }>>();
  for (const f of rows.results ?? []) (by.get(f.chat_id) ?? by.set(f.chat_id, []).get(f.chat_id)!).push({ id: f.id, name: f.name });
  return msgs.map((m) => ({ ...m, files: by.get(m.id) ?? [] }));
}

type Msg = {
  id: number;
  agent: string;
  role: string;
  body: string;
  status: string;
  tg: number;
  reply_to: number | null;
  source: string;
  created_at: string;
};

/* ---------- Người dùng web: chị Hoa (tất cả agent) và nhân sự được chị cấp quyền (từng agent) ---------- */
export const agentChatRoutes = new Hono<AppEnv>();

const isCeo = (c: { get: (k: 'auth') => { user: { id: string; role: string } } }) => c.get('auth').user.role === 'CEO';

/** Agent mà người đang đăng nhập được nhắn: CEO tất cả; người khác chỉ agent chị Hoa đã cấp (bảng agent_chat_access). */
export async function allowedAgents(db: D1Database, user: { id: string; role: string }): Promise<string[]> {
  if (user.role === 'CEO') return [...AGENT_IDS];
  const rows = await db.prepare('SELECT agent FROM agent_chat_access WHERE user_id = ?').bind(user.id).all<{ agent: string }>();
  return (rows.results ?? []).map((r) => r.agent).filter((a) => AGENT_IDS.includes(a));
}

async function needAgent(c: Parameters<typeof isCeo>[0] & { env: { DB: D1Database } }, agent: string) {
  if (!AGENT_IDS.includes(agent)) throw badRequest('BAD_AGENT', 'Agent không có trong danh sách');
  const user = c.get('auth').user;
  if (!(await allowedAgents(c.env.DB, user)).includes(agent)) throw forbidden('Bạn chưa được cấp quyền nhắn agent này.');
}

agentChatRoutes.get('/agents', async (c) => {
  const seen = await c.env.DB.prepare('SELECT v FROM app_kv WHERE k = ?').bind(SEEN_KEY).first<{ v: string }>();
  const online = !!seen && Date.now() - Date.parse(seen.v) < ONLINE_MS;
  // Đầu ngày theo giờ Việt Nam (UTC+7) để đếm "tin hôm nay".
  const vn = new Date(Date.now() + 7 * 3_600_000);
  vn.setUTCHours(0, 0, 0, 0);
  const dayStart = new Date(vn.getTime() - 7 * 3_600_000).toISOString();
  const stats = await c.env.DB.prepare(
    `SELECT agent,
            SUM(CASE WHEN role = 'USER' AND status IN ('queued', 'taken') THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today,
            MAX(created_at) AS last_at,
            MAX(id) AS last_id
     FROM agent_chat WHERE owner_id = ? GROUP BY agent`,
  )
    .bind(dayStart, c.get('auth').user.id)
    .all<{ agent: string; pending: number; today: number; last_at: string | null; last_id: number }>();
  const by = new Map((stats.results ?? []).map((r) => [r.agent, r]));
  const allowed = await allowedAgents(c.env.DB, c.get('auth').user);
  return ok(c, {
    relay_online: online,
    relay_seen: seen?.v ?? null,
    is_ceo: isCeo(c),
    agents: AGENT_ROSTER.filter((a) => allowed.includes(a.id)).map((a) => ({
      ...a,
      pending: by.get(a.id)?.pending ?? 0,
      today: by.get(a.id)?.today ?? 0,
      last_at: by.get(a.id)?.last_at ?? null,
      last_id: by.get(a.id)?.last_id ?? 0,
    })),
  });
});

agentChatRoutes.get('/', async (c) => {
  const agent = c.req.query('agent') ?? '';
  await needAgent(c, agent);
  const me = c.get('auth').user.id;
  const after = Math.max(0, Math.floor(Number(c.req.query('after') ?? 0)) || 0);
  // Lần đầu lấy 100 tin gần nhất; các lần sau chỉ lấy tin mới hơn mốc.
  const rows = after
    ? await c.env.DB.prepare(
        `SELECT id, agent, role, body, status, tg, reply_to, source, created_at FROM agent_chat
         WHERE agent = ? AND owner_id = ? AND id > ? ORDER BY id LIMIT 200`,
      )
        .bind(agent, me, after)
        .all<Msg>()
    : await c.env.DB.prepare(
        `SELECT * FROM (SELECT id, agent, role, body, status, tg, reply_to, source, created_at FROM agent_chat
         WHERE agent = ? AND owner_id = ? ORDER BY id DESC LIMIT 100) ORDER BY id`,
      )
        .bind(agent, me)
        .all<Msg>();
  return ok(c, await withFiles(c.env.DB, rows.results ?? []));
});

/** Ảnh của một tin (do agent gửi). Chỉ CEO xem; không cho trình duyệt đoán kiểu file. */
agentChatRoutes.get('/file/:id', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT f.name, f.mime, f.data FROM agent_chat_files f JOIN agent_chat m ON m.id = f.chat_id
     WHERE f.id = ? AND m.owner_id = ?`,
  )
    .bind(Number(c.req.param('id')), c.get('auth').user.id)
    .first<{ name: string; mime: string; data: string }>();
  if (!row || !IMAGE_MIMES.includes(row.mime)) throw notFound('Không có ảnh này');
  const bin = atob(row.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
});

/** Danh sách ảnh trong cuộc trò chuyện với một agent (cho cột bên phải). */
agentChatRoutes.get('/files', async (c) => {
  const agent = c.req.query('agent') ?? '';
  await needAgent(c, agent);
  const rows = await c.env.DB.prepare(
    `SELECT f.id, f.name, f.created_at FROM agent_chat_files f JOIN agent_chat m ON m.id = f.chat_id
     WHERE m.agent = ? AND m.owner_id = ? ORDER BY f.id DESC LIMIT 60`,
  )
    .bind(agent, c.get('auth').user.id)
    .all<{ id: number; name: string; created_at: string }>();
  return ok(c, rows.results ?? []);
});

/** Cập nhật trạng thái các tin chị đã gửi (đang chờ / đang làm / xong / lỗi) để hiện trên màn hình. */
agentChatRoutes.get('/status', async (c) => {
  const agent = c.req.query('agent') ?? '';
  await needAgent(c, agent);
  const rows = await c.env.DB.prepare(
    `SELECT id, status FROM agent_chat WHERE agent = ? AND owner_id = ? AND role = 'USER' ORDER BY id DESC LIMIT 30`,
  )
    .bind(agent, c.get('auth').user.id)
    .all<{ id: number; status: string }>();
  return ok(c, rows.results ?? []);
});

agentChatRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { agent?: string; body?: string; tg?: boolean };
  const agent = String(body.agent ?? '');
  await needAgent(c, agent);
  const text = String(body.body ?? '').trim();
  if (!text) throw badRequest('EMPTY', 'Chưa gõ nội dung');
  if (text.length > 4000) throw badRequest('TOO_LONG', 'Tin quá dài (tối đa 4000 ký tự)');
  const now = nowIso();
  const res = await c.env.DB.prepare(
    `INSERT INTO agent_chat (agent, role, body, status, tg, created_by, owner_id, created_at, updated_at)
     VALUES (?, 'USER', ?, 'queued', ?, ?, ?, ?, ?)`,
  )
    // Gửi kèm sang Telegram chỉ dành cho chị Hoa (nhân sự không có Telegram nối với web).
    .bind(agent, text, body.tg && isCeo(c) ? 1 : 0, c.get('auth').user.id, c.get('auth').user.id, now, now)
    .run();
  return ok(c, { id: res.meta.last_row_id });
});

/** Chị Hoa xem và đặt ai được nhắn agent nào (chỉ CEO). */
agentChatRoutes.get('/access', async (c) => {
  if (!isCeo(c)) throw forbidden('Chỉ chủ doanh nghiệp được cấp quyền.');
  const users = await c.env.DB.prepare(
    `SELECT id, display_name, role FROM users WHERE kind = 'HUMAN' AND status = 'ACTIVE' AND deleted_at IS NULL AND role <> 'CEO'
     ORDER BY role, display_name`,
  ).all<{ id: string; display_name: string; role: string }>();
  const acc = await c.env.DB.prepare('SELECT user_id, agent FROM agent_chat_access').all<{ user_id: string; agent: string }>();
  const by = new Map<string, string[]>();
  for (const r of acc.results ?? []) (by.get(r.user_id) ?? by.set(r.user_id, []).get(r.user_id)!).push(r.agent);
  return ok(c, (users.results ?? []).map((u) => ({ ...u, agents: by.get(u.id) ?? [] })));
});

agentChatRoutes.put('/access/:userId', async (c) => {
  if (!isCeo(c)) throw forbidden('Chỉ chủ doanh nghiệp được cấp quyền.');
  const userId = c.req.param('userId');
  const b = (await c.req.json().catch(() => ({}))) as { agents?: string[] };
  const agents = [...new Set((b.agents ?? []).filter((a) => AGENT_IDS.includes(String(a))))];
  const u = await c.env.DB.prepare(`SELECT id FROM users WHERE id = ? AND kind = 'HUMAN' AND role <> 'CEO'`).bind(userId).first();
  if (!u) throw notFound('Không có người dùng này');
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM agent_chat_access WHERE user_id = ?').bind(userId),
    ...agents.map((a) =>
      c.env.DB.prepare('INSERT INTO agent_chat_access (user_id, agent, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(userId, a, c.get('auth').user.id, now),
    ),
  ]);
  return ok(c, { user_id: userId, agents });
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
  // Mỗi ngày một lần: xóa tin và ảnh quá 30 ngày khỏi web (Telegram và agent vẫn giữ nguyên).
  const prune = await c.env.DB.prepare(`SELECT v FROM app_kv WHERE k = 'agent_chat_pruned'`).first<{ v: string }>();
  if (!prune || Date.now() - Date.parse(prune.v) > 86_400_000) {
    const old = new Date(Date.now() - 30 * 86_400_000).toISOString();
    await c.env.DB.prepare(`DELETE FROM agent_chat_files WHERE chat_id IN (SELECT id FROM agent_chat WHERE created_at < ?)`).bind(old).run();
    await c.env.DB.prepare(`DELETE FROM agent_chat WHERE created_at < ?`).bind(old).run();
    await c.env.DB.prepare(
      `INSERT INTO app_kv (k, v, updated_at) VALUES ('agent_chat_pruned', ?, ?)
       ON CONFLICT (k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`,
    )
      .bind(now, now)
      .run();
  }
  // Tin nhận rồi mà quá lâu không có trả lời (cầu nối chết giữa chừng): báo lỗi để chị biết gửi lại.
  const cutoff = new Date(Date.now() - STUCK_MS).toISOString();
  await c.env.DB.prepare(
    `UPDATE agent_chat SET status = 'error', updated_at = ? WHERE role = 'USER' AND status = 'taken' AND updated_at < ?`,
  )
    .bind(now, cutoff)
    .run();
  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.agent, m.body, m.tg, m.owner_id, u.display_name AS who_name, u.role AS who_role
     FROM agent_chat m LEFT JOIN users u ON u.id = m.created_by
     WHERE m.role = 'USER' AND m.status = 'queued' ORDER BY m.id LIMIT 3`,
  ).all<{ id: number; agent: string; body: string; tg: number; owner_id: string | null; who_name: string | null; who_role: string | null }>();
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
  const b = (await c.req.json().catch(() => ({}))) as {
    id?: number;
    reply?: string;
    error?: string;
    files?: Array<{ name?: string; mime?: string; b64?: string }>;
  };
  const id = Number(b.id);
  if (!Number.isInteger(id)) throw badRequest('NO_ID', 'Thiếu mã tin');
  const row = await c.env.DB.prepare(`SELECT id, agent, owner_id FROM agent_chat WHERE id = ? AND role = 'USER'`)
    .bind(id)
    .first<{ id: number; agent: string; owner_id: string | null }>();
  if (!row) throw notFound('Không có tin này');
  const now = nowIso();
  const failed = !!b.error;
  const text = failed ? String(b.error).slice(0, 2000) : String(b.reply ?? '').trim().slice(0, 20000) || '(agent không trả lời nội dung)';
  const files = (b.files ?? [])
    .slice(0, 4)
    .filter((f) => f && IMAGE_MIMES.includes(String(f.mime)) && typeof f.b64 === 'string' && f.b64.length > 0 && f.b64.length <= MAX_FILE_B64 && /^[A-Za-z0-9+/=]+$/.test(f.b64));
  const ins = await c.env.DB.prepare(
    `INSERT INTO agent_chat (agent, role, body, status, reply_to, owner_id, created_at, updated_at) VALUES (?, ?, ?, 'done', ?, ?, ?, ?)`,
  )
    .bind(row.agent, failed ? 'SYSTEM' : 'AGENT', text, id, row.owner_id, now, now)
    .run();
  const replyId =
    Number(ins.meta.last_row_id) ||
    (await c.env.DB.prepare(`SELECT MAX(id) AS id FROM agent_chat WHERE reply_to = ?`).bind(id).first<{ id: number }>())?.id ||
    0;
  for (const f of files) {
    await c.env.DB.prepare(`INSERT INTO agent_chat_files (chat_id, name, mime, data, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(replyId, String(f.name ?? 'anh').slice(0, 120), f.mime, f.b64, now)
      .run();
  }
  await c.env.DB.prepare(`UPDATE agent_chat SET status = ?, updated_at = ? WHERE id = ?`).bind(failed ? 'error' : 'done', now, id).run();
  return ok(c, { ok: true, files: files.length });
});

/**
 * Cầu nối chép tin Telegram của chị Hoa với agent lên web (từ lúc bật trở đi). Mỗi tin có ext_id duy nhất nên gửi lại không bị trùng.
 * Tin chỉ để HIỆN, không đưa vào hàng đợi cho agent.
 */
agentRelayRoutes.post('/sync', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as {
    items?: Array<{
      agent?: string;
      role?: string;
      body?: string;
      ext_id?: string;
      ts?: number;
      files?: Array<{ name?: string; mime?: string; b64?: string }>;
    }>;
  };
  const items = (b.items ?? []).slice(0, 100);
  let added = 0;
  for (const it of items) {
    if (!it || !AGENT_IDS.includes(String(it.agent)) || !['USER', 'AGENT'].includes(String(it.role))) continue;
    const ext = String(it.ext_id ?? '').slice(0, 120);
    const body = String(it.body ?? '').trim().slice(0, 20000);
    if (!ext || !body) continue;
    const at = Number.isFinite(it.ts) ? new Date(Number(it.ts)).toISOString() : nowIso();
    const res = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO agent_chat (agent, role, body, status, source, ext_id, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, 'done', 'TELEGRAM', ?, (SELECT id FROM users WHERE role = 'CEO' AND kind = 'HUMAN' ORDER BY created_at LIMIT 1), ?, ?)`,
    )
      .bind(it.agent, it.role, body, ext, at, at)
      .run();
    if (!res.meta.changes) continue;
    added++;
    const row = await c.env.DB.prepare(`SELECT id FROM agent_chat WHERE ext_id = ?`).bind(ext).first<{ id: number }>();
    for (const f of (it.files ?? [])
      .slice(0, 4)
      .filter((f) => f && IMAGE_MIMES.includes(String(f.mime)) && typeof f.b64 === 'string' && f.b64.length > 0 && f.b64.length <= MAX_FILE_B64 && /^[A-Za-z0-9+/=]+$/.test(f.b64))) {
      await c.env.DB.prepare(`INSERT INTO agent_chat_files (chat_id, name, mime, data, created_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(row?.id ?? 0, String(f.name ?? 'anh').slice(0, 120), f.mime, f.b64, at)
        .run();
    }
  }
  return ok(c, { added });
});

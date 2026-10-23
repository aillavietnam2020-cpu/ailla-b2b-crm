import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import { AGENT_IDS, AGENT_ROSTER } from '@shared/agentRoster';
import type { AppEnv } from '../env';
import { forbidden, badRequest, notFound, ok, unauthorized } from '../lib/http';
import { issueDelegation, issueTelegramDelegation } from '../lib/delegation';

/**
 * Nhắn agent ngay trên web.
 *  - /api/agent-chat : chị (CEO) xem danh sách agent, đọc và gửi tin. Tin vào hàng đợi.
 *  - /api/agent-relay      : chương trình nhỏ trên VPS (cầu nối) lấy tin về, nhờ agent trả lời, gửi trả lời lên.
 *    Xác thực bằng khoá riêng AGENT_RELAY_KEY (secret của Worker), không dùng phiên đăng nhập.
 * Web chỉ chuyển lời; mọi việc agent làm với dữ liệu thật vẫn đi qua cổng /api/agent (đọc + đề xuất chờ duyệt).
 */

const SEEN_KEY = 'agent_relay_seen';
const ONLINE_MS = 90_000;
const STUCK_MS = 3 * 3_600_000; // agent làm việc dài thì cứ chờ lần lượt; chị muốn dừng thì gõ /stop

const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_B64 = 2_000_000; // ~1,5 MB ảnh; D1 giới hạn khoảng 2 MB một giá trị

/** Gắn danh sách ảnh (id, tên) vào từng tin. */
async function withFiles<T extends { id: number }>(db: D1Database, msgs: T[]) {
  if (!msgs.length) return msgs.map((m) => ({ ...m, files: [] as Array<{ id: number; name: string }>, docs: [] as DocInfo[] }));
  const ids = msgs.map((m) => m.id);
  const rows = await db
    .prepare(`SELECT id, chat_id, name FROM agent_chat_files WHERE chat_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`)
    .bind(...ids)
    .all<{ id: number; chat_id: number; name: string }>();
  const by = new Map<number, Array<{ id: number; name: string }>>();
  for (const f of rows.results ?? []) (by.get(f.chat_id) ?? by.set(f.chat_id, []).get(f.chat_id)!).push({ id: f.id, name: f.name });
  const dr = await db
    .prepare(`SELECT id, chat_id, name, size, nparts, (preview IS NOT NULL) AS has_preview FROM agent_chat_docs WHERE chat_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`)
    .bind(...ids)
    .all<DocInfo & { chat_id: number }>();
  const dby = new Map<number, DocInfo[]>();
  for (const d of dr.results ?? []) (dby.get(d.chat_id) ?? dby.set(d.chat_id, []).get(d.chat_id)!).push({ id: d.id, name: d.name, size: d.size, nparts: d.nparts, has_preview: d.has_preview });
  return msgs.map((m) => ({ ...m, files: by.get(m.id) ?? [], docs: dby.get(m.id) ?? [] }));
}

type DocInfo = { id: number; name: string; size: number; nparts: number; has_preview?: number };
const DOC_EXT = ['xlsx', 'xls', 'csv', 'pdf', 'docx', 'doc', 'pptx', 'txt', 'md', 'json', 'mp4', 'mov', 'webm', 'mp3', 'wav', 'm4a'];
const DOC_MAX = 25 * 1024 * 1024; // 25 MB mỗi file
const DOC_PART = 900_000; // byte gốc mỗi mảnh (base64 ~1,2 MB, dưới giới hạn 2 MB của D1)
const DOCS_PER_MSG = 3;
const MAX_IMAGES = 6;

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

/** Bước 1: khai báo file sắp tải (tên, dung lượng). Trả về mã và số mảnh cần gửi. */
agentChatRoutes.post('/doc', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; size?: number };
  const name = String(b.name ?? '').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 120);
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const size = Math.floor(Number(b.size));
  if (!name || !DOC_EXT.includes(ext)) throw badRequest('BAD_TYPE', 'Loại file này chưa nhận (nhận: ' + DOC_EXT.join(', ') + ')');
  if (!Number.isFinite(size) || size <= 0) throw badRequest('BAD_SIZE', 'File rỗng');
  if (size > DOC_MAX) throw badRequest('TOO_BIG', 'File quá lớn (tối đa 25 MB)');
  const nparts = Math.ceil(size / DOC_PART);
  const now = nowIso();
  const me = c.get('auth').user.id;
  await c.env.DB.prepare('INSERT INTO agent_chat_docs (owner_id, name, size, nparts, created_at) VALUES (?, ?, ?, ?, ?)').bind(me, name, size, nparts, now).run();
  const row = await c.env.DB.prepare('SELECT MAX(id) AS id FROM agent_chat_docs WHERE owner_id = ?').bind(me).first<{ id: number }>();
  return ok(c, { id: row!.id, nparts, part_bytes: DOC_PART });
});

/** Bước 2: gửi từng mảnh (base64). Gửi lại cùng mảnh thì thay mảnh cũ. */
agentChatRoutes.put('/doc/:id/:seq', async (c) => {
  const id = Number(c.req.param('id'));
  const seq = Number(c.req.param('seq'));
  const d = await c.env.DB.prepare('SELECT nparts FROM agent_chat_docs WHERE id = ? AND owner_id = ? AND chat_id IS NULL')
    .bind(id, c.get('auth').user.id)
    .first<{ nparts: number }>();
  if (!d) throw notFound('Không có file này');
  if (!Number.isInteger(seq) || seq < 0 || seq >= d.nparts) throw badRequest('BAD_SEQ', 'Số mảnh không đúng');
  const b = (await c.req.json().catch(() => ({}))) as { b64?: string };
  if (typeof b.b64 !== 'string' || !b.b64 || b.b64.length > 1_400_000 || !/^[A-Za-z0-9+/=]+$/.test(b.b64)) throw badRequest('BAD_PART', 'Mảnh file không đúng');
  await c.env.DB.prepare('INSERT OR REPLACE INTO agent_chat_doc_parts (doc_id, seq, data) VALUES (?, ?, ?)').bind(id, seq, b.b64).run();
  return ok(c, { ok: true });
});

/** Tải lại file đã gửi (chỉ người gửi). */
agentChatRoutes.get('/doc/:id', async (c) => {
  const d = await c.env.DB.prepare('SELECT id, name, nparts FROM agent_chat_docs WHERE id = ? AND owner_id = ? AND chat_id IS NOT NULL')
    .bind(Number(c.req.param('id')), c.get('auth').user.id)
    .first<{ id: number; name: string; nparts: number }>();
  if (!d) throw notFound('Không có file này');
  const parts = await c.env.DB.prepare('SELECT data FROM agent_chat_doc_parts WHERE doc_id = ? ORDER BY seq').bind(d.id).all<{ data: string }>();
  const chunks = (parts.results ?? []).map((p) => {
    const bin = atob(p.data);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  });
  return new Response(new Blob(chunks), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

/** Bản xem trước (Excel, Word đã đọc sẵn) của file trong cuộc trò chuyện của chính người đang đăng nhập. */
agentChatRoutes.get('/doc/:id/preview', async (c) => {
  const d = await c.env.DB.prepare('SELECT preview FROM agent_chat_docs WHERE id = ? AND owner_id = ? AND chat_id IS NOT NULL')
    .bind(Number(c.req.param('id')), c.get('auth').user.id)
    .first<{ preview: string | null }>();
  if (!d) throw notFound('Không có file này');
  return ok(c, { preview: d.preview });
});

agentChatRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    agent?: string;
    body?: string;
    tg?: boolean;
    files?: Array<{ name?: string; mime?: string; b64?: string }>;
    docs?: number[];
  };
  const agent = String(body.agent ?? '');
  await needAgent(c, agent);
  // Ảnh chị dán hoặc đính kèm (tối đa 3 ảnh, trình duyệt đã nén sẵn).
  const files = (body.files ?? [])
    .slice(0, MAX_IMAGES)
    .filter((f) => f && IMAGE_MIMES.includes(String(f.mime)) && typeof f.b64 === 'string' && f.b64.length > 0 && f.b64.length <= MAX_FILE_B64 && /^[A-Za-z0-9+/=]+$/.test(f.b64));
  const me0 = c.get('auth').user.id;
  const wantDocs = [...new Set((body.docs ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, DOCS_PER_MSG);
  const docRows: Array<{ id: number; nparts: number }> = [];
  for (const did of wantDocs) {
    const d = await c.env.DB.prepare('SELECT id, nparts FROM agent_chat_docs WHERE id = ? AND owner_id = ? AND chat_id IS NULL').bind(did, me0).first<{ id: number; nparts: number }>();
    if (!d) throw badRequest('BAD_DOC', 'File đính kèm không còn, chị tải lại nhé');
    const have = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM agent_chat_doc_parts WHERE doc_id = ?').bind(did).first<{ n: number }>();
    if ((have?.n ?? 0) !== d.nparts) throw badRequest('DOC_INCOMPLETE', 'File chưa tải xong, chị đợi một chút rồi gửi');
    docRows.push(d);
  }
  const text = String(body.body ?? '').trim() || (docRows.length ? '(gửi file)' : files.length ? '(gửi ảnh)' : '');
  if (!text) throw badRequest('EMPTY', 'Chưa gõ nội dung');
  if (text.length > 20000) throw badRequest('TOO_LONG', 'Tin quá dài (tối đa 20.000 ký tự)');
  const now = nowIso();
  const res = await c.env.DB.prepare(
    `INSERT INTO agent_chat (agent, role, body, status, tg, created_by, owner_id, created_at, updated_at)
     VALUES (?, 'USER', ?, 'queued', ?, ?, ?, ?, ?)`,
  )
    // Gửi kèm sang Telegram chỉ dành cho chị Hoa (nhân sự không có Telegram nối với web).
    .bind(agent, text, body.tg && isCeo(c) ? 1 : 0, c.get('auth').user.id, c.get('auth').user.id, now, now)
    .run();
  const id =
    Number(res.meta.last_row_id) ||
    (await c.env.DB.prepare(`SELECT MAX(id) AS id FROM agent_chat WHERE owner_id = ? AND role = 'USER'`).bind(c.get('auth').user.id).first<{ id: number }>())?.id ||
    0;
  for (const f of files) {
    await c.env.DB.prepare(`INSERT INTO agent_chat_files (chat_id, name, mime, data, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, String(f.name ?? 'anh').slice(0, 120), f.mime, f.b64, now)
      .run();
  }
  for (const d of docRows) await c.env.DB.prepare('UPDATE agent_chat_docs SET chat_id = ? WHERE id = ?').bind(id, d.id).run();
  return ok(c, { id });
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
    // File đính kèm quá 30 ngày, và file tải dở quá 1 ngày
    const stale = new Date(Date.now() - 86_400_000).toISOString();
    await c.env.DB.prepare(
      `DELETE FROM agent_chat_doc_parts WHERE doc_id IN (SELECT id FROM agent_chat_docs WHERE created_at < ? OR (chat_id IS NULL AND created_at < ?))`,
    ).bind(old, stale).run();
    await c.env.DB.prepare(`DELETE FROM agent_chat_docs WHERE created_at < ? OR (chat_id IS NULL AND created_at < ?)`).bind(old, stale).run();
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
    `SELECT m.id, m.agent, m.body, m.tg, m.owner_id, m.created_by, u.display_name AS who_name, u.role AS who_role
     FROM agent_chat m LEFT JOIN users u ON u.id = m.created_by
     WHERE m.role = 'USER' AND m.status = 'queued'
       -- Lần lượt: mỗi agent (và mỗi người nhắn) chỉ nhận tin kế tiếp khi tin trước đã xong; các tin gửi dồn xếp hàng đợi theo thứ tự
       AND NOT EXISTS (SELECT 1 FROM agent_chat t WHERE t.agent = m.agent AND t.owner_id IS m.owner_id AND t.role = 'USER' AND t.status = 'taken')
       AND NOT EXISTS (SELECT 1 FROM agent_chat q WHERE q.agent = m.agent AND q.owner_id IS m.owner_id AND q.role = 'USER' AND q.status = 'queued' AND q.id < m.id)
     ORDER BY m.id LIMIT 6`,
  ).all<{ id: number; agent: string; body: string; tg: number; owner_id: string | null; created_by: string | null; who_name: string | null; who_role: string | null }>();
  const list: typeof rows.results = [];
  for (const r of rows.results ?? []) {
    const res = await c.env.DB.prepare(
      `UPDATE agent_chat SET status = 'taken', updated_at = ? WHERE id = ? AND status = 'queued'`,
    )
      .bind(now, r.id)
      .run();
    if (res.meta.changes) list.push(r);
  }
  // Kèm danh sách ảnh đính kèm của từng tin (cầu nối tải từng ảnh qua /file/:id).
  const withImgs = await withFiles(c.env.DB, list);
  // Tin của người được chỉ định ra lệnh cho agent (chị Thảo → Kế toán trưởng): kèm giấy ủy quyền ghi dữ liệu, 30 phút.
  const out = [];
  for (const m of withImgs) {
    const g = m.created_by
      ? await c.env.DB.prepare('SELECT agent_id FROM agent_delegators WHERE chat_agent = ? AND user_id = ?').bind(m.agent, m.created_by).first<{ agent_id: string }>()
      : null;
    out.push(g ? { ...m, delegation: await issueDelegation(c.env.DB, g.agent_id, m.created_by!, m.id) } : m);
  }
  return ok(c, out);
});

/** Cầu nối tải ảnh đính kèm của tin chị gửi (để đưa cho agent xem). */
agentRelayRoutes.get('/file/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT name, mime, data FROM agent_chat_files WHERE id = ?')
    .bind(Number(c.req.param('id')))
    .first<{ name: string; mime: string; data: string }>();
  if (!row) throw notFound('Không có ảnh này');
  return ok(c, { name: row.name, mime: row.mime, b64: row.data });
});

/** Cầu nối đưa file agent tạo ra (md, xlsx, docx, pdf...) lên web: khai báo file, kèm bản xem trước nếu có. */
agentRelayRoutes.post('/doc-start', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; size?: number; owner_id?: string | null; preview?: string | null };
  const name = String(b.name ?? '').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 120);
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const size = Math.floor(Number(b.size));
  if (!name || !DOC_EXT.includes(ext)) throw badRequest('BAD_TYPE', 'Loại file này chưa nhận');
  if (!Number.isFinite(size) || size <= 0 || size > DOC_MAX) throw badRequest('BAD_SIZE', 'Dung lượng file không hợp lệ (tối đa 25 MB)');
  const owner =
    (b.owner_id ? String(b.owner_id) : '') ||
    (await c.env.DB.prepare(`SELECT id FROM users WHERE role = 'CEO' AND kind = 'HUMAN' ORDER BY created_at LIMIT 1`).first<{ id: string }>())?.id ||
    '';
  if (!owner) throw badRequest('NO_OWNER', 'Chưa có người nhận file');
  const preview = typeof b.preview === 'string' && b.preview ? b.preview.slice(0, 400_000) : null;
  const nparts = Math.ceil(size / DOC_PART);
  await c.env.DB.prepare('INSERT INTO agent_chat_docs (owner_id, name, size, nparts, created_at, preview) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(owner, name, size, nparts, nowIso(), preview)
    .run();
  const row = await c.env.DB.prepare('SELECT MAX(id) AS id FROM agent_chat_docs WHERE owner_id = ?').bind(owner).first<{ id: number }>();
  return ok(c, { id: row!.id, nparts, part_bytes: DOC_PART });
});

agentRelayRoutes.post('/doc-part', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { id?: number; seq?: number; b64?: string };
  const id = Number(b.id);
  const seq = Number(b.seq);
  const d = await c.env.DB.prepare('SELECT nparts FROM agent_chat_docs WHERE id = ? AND chat_id IS NULL').bind(id).first<{ nparts: number }>();
  if (!d) throw notFound('Không có file này');
  if (!Number.isInteger(seq) || seq < 0 || seq >= d.nparts) throw badRequest('BAD_SEQ', 'Số mảnh không đúng');
  if (typeof b.b64 !== 'string' || !b.b64 || b.b64.length > 1_400_000 || !/^[A-Za-z0-9+/=]+$/.test(b.b64)) throw badRequest('BAD_PART', 'Mảnh file không đúng');
  await c.env.DB.prepare('INSERT OR REPLACE INTO agent_chat_doc_parts (doc_id, seq, data) VALUES (?, ?, ?)').bind(id, seq, b.b64).run();
  return ok(c, { ok: true });
});

/** Cầu nối tải từng mảnh file chị đính kèm. */
agentRelayRoutes.get('/doc/:id/:seq', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT p.data FROM agent_chat_doc_parts p JOIN agent_chat_docs d ON d.id = p.doc_id WHERE p.doc_id = ? AND p.seq = ? AND d.chat_id IS NOT NULL`,
  )
    .bind(Number(c.req.param('id')), Number(c.req.param('seq')))
    .first<{ data: string }>();
  if (!row) throw notFound('Không có mảnh này');
  return ok(c, { b64: row.data });
});

/** Cầu nối vừa khởi động lại: tin đang làm dở của lượt trước không còn ai làm tiếp, báo lỗi để hàng đợi chạy tiếp (không tự làm lại để khỏi ghi hai lần). */
agentRelayRoutes.post('/reset-taken', async (c) => {
  const r = await c.env.DB.prepare(`UPDATE agent_chat SET status = 'error', updated_at = ? WHERE role = 'USER' AND status = 'taken'`).bind(nowIso()).run();
  return ok(c, { reset: r.meta.changes ?? 0 });
});

/** Cầu nối báo: tin Telegram này do người có định danh sender_id gửi cho agent. Nếu người đó được chỉ định ra lệnh cho agent thì tạo giấy ủy quyền. */
agentRelayRoutes.post('/delegate-tg', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { items?: Array<{ chat_agent?: string; sender_id?: string; ext_id?: string; ts?: number }> };
  let made = 0;
  for (const it of (b.items ?? []).slice(0, 50)) {
    const sender = String(it.sender_id ?? '');
    const ext = String(it.ext_id ?? '');
    if (!sender || !ext) continue;
    // chỉ tin vừa gửi (trong 5 phút): đồng bộ lại lịch sử cũ không được sinh giấy
    const ts = Number(it.ts);
    if (!Number.isFinite(ts) || Date.now() - ts > 300_000 || ts - Date.now() > 60_000) continue;
    const g = await c.env.DB.prepare('SELECT agent_id, user_id FROM agent_delegators WHERE chat_agent = ? AND telegram_id = ?')
      .bind(String(it.chat_agent ?? ''), sender)
      .first<{ agent_id: string; user_id: string }>();
    if (!g) continue;
    await issueTelegramDelegation(c.env.DB, g.agent_id, g.user_id, ext);
    made++;
  }
  return ok(c, { made });
});

/** Gửi câu trả lời (hoặc lỗi) của agent cho một tin. */
agentRelayRoutes.post('/push', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as {
    id?: number;
    reply?: string;
    error?: string;
    files?: Array<{ name?: string; mime?: string; b64?: string }>;
    docs?: number[];
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
  for (const did of (b.docs ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 4)) {
    await c.env.DB.prepare('UPDATE agent_chat_docs SET chat_id = ? WHERE id = ? AND chat_id IS NULL AND owner_id IS ?').bind(replyId, did, row.owner_id).run();
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
      docs?: number[];
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
    for (const did of (it.docs ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 4)) {
      await c.env.DB.prepare('UPDATE agent_chat_docs SET chat_id = ? WHERE id = ? AND chat_id IS NULL').bind(row?.id ?? 0, did).run();
    }
  }
  return ok(c, { added });
});

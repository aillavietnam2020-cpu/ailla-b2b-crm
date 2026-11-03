import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { AGENT_ROSTER } from '@shared/agentRoster';
import { unpack } from '../lib/pack';
import { requirePermission } from '../middleware/rbac';

/**
 * Tin nhắn kiểu Lark (hub/src/tinnhan.js, chị Hoa 02–03/11/2026). Máy chủ chặn quyền, không chỉ ẩn trên màn hình:
 * - 'g:chung': mọi người. 'g:<phòng>': chỉ nhân sự phòng đó (theo phòng ban trong dữ liệu chung) và CEO.
 * - 'p:<mã dự án>': người phụ trách, thành viên, nhân sự các phòng tham gia dự án (projects[].team / teams), CEO.
 * - 'n:<mã>': nhóm phối hợp tự tạo (ví dụ Team Content – Digital): chỉ thành viên nhóm (bảng chat_groups) và CEO.
 * - 'dm:<a>~<b>': chỉ hai người.
 * - Nhắc việc: nhắc mình hoặc nhắc người khác theo giờ; trình duyệt hỏi /reminders/due khoảng 45 giây một lần.
 */
export const chatRoutes = new Hono<AppEnv>();
chatRoutes.use('*', requirePermission('hub.access'));

const ROOM_RE = /^(g:[a-z0-9_-]{1,40}|p:[A-Za-z0-9_-]{1,40}|n:[A-Za-z0-9_-]{1,40}|dm:[A-Za-z0-9_-]{1,64}~[A-Za-z0-9_-]{1,64})$/;
const PAGE = 60;
const NEW_GROUP_DAYS = 3; // nhóm chưa mở lần nào: chỉ đếm tin chưa đọc trong 3 ngày gần nhất

/* mã phòng ban → nhóm chat phòng (giống hub/src/khonggian.js KPB_TEAM) */
const PB_TEAM: Record<string, string> = { CM: 'content', ADS: 'digital', KOC: 'koc', KT: 'ketoan', KV: 'kho', SX: 'sx', HCNS: 'hcns', B2B: 'sale', B2C: 'sale' };
type HubU = { id?: string; crm?: string; role?: string; phongBan?: string };
type HubP = { id?: string; team?: string; teams?: string[]; owner?: string; tv?: string[] };
export function teamKey(u: HubU | null): string {
  if (!u) return '';
  if (u.phongBan && PB_TEAM[u.phongBan]) return PB_TEAM[u.phongBan];
  if (u.role === 'digital') return 'digital';
  if (u.role === 'content' || u.role === 'lead') return 'content';
  return String(u.phongBan ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
}
/* người + dự án trong dữ liệu chung: chỉ giải nén lại khi bản chung đổi phiên bản (bản chung nặng) */
let HUB: { v: string; users: HubU[]; projects: HubP[]; agents: Record<string, string[]> } | null = null;
async function hubCtx(db: D1Database, fresh = false) {
  const vr = await db.prepare("SELECT version, updated_at FROM hub_state WHERE id = 'main'").first<{ version: number; updated_at: string }>();
  const v = vr ? vr.version + '|' + vr.updated_at : '';
  if (HUB && !fresh && HUB.v === v) return HUB;
  const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  let users: HubU[] = [];
  let projects: HubP[] = [];
  let agents: Record<string, string[]> = {};
  if (row) {
    try {
      const d = JSON.parse(await unpack(row.data)) as { users?: HubU[]; projects?: HubP[]; chatAgents?: Record<string, string[]> };
      users = Array.isArray(d.users) ? d.users : [];
      projects = Array.isArray(d.projects) ? d.projects : [];
      agents = d.chatAgents && typeof d.chatAgents === 'object' ? d.chatAgents : {};
    } catch {
      /* dữ liệu hỏng: coi như chưa có ai */
    }
  }
  HUB = { v, users, projects, agents };
  return HUB;
}
type Acc = { id: string; hubId: string; team: string; ceo: boolean; lead: boolean; db: D1Database };
async function access(c: { env: AppEnv['Bindings']; get: (k: 'auth') => AppEnv['Variables']['auth'] }): Promise<Acc> {
  const user = c.get('auth').user;
  const hub = await hubCtx(c.env.DB);
  const hu = hub.users.find((u) => u.crm && u.crm === user.id) ?? null;
  const ceo = user.role === 'CEO' || hu?.role === 'admin';
  return { id: user.id, hubId: hu?.id ?? '', team: teamKey(hu), ceo, lead: ceo || ['lead', 'truongphong'].includes(hu?.role ?? '') || user.role === 'MANAGER', db: c.env.DB };
}
const parseMembers = (s: unknown): string[] => {
  try {
    const v = JSON.parse(String(s ?? '[]'));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};
/** Phòng hợp lệ và người này được vào. */
export async function canRoom(room: string, A: Acc): Promise<boolean> {
  if (!ROOM_RE.test(room)) return false;
  if (room.startsWith('dm:')) {
    const [a, b] = room.slice(3).split('~');
    return (a === A.id || b === A.id) && a <= b;
  }
  if (room === 'g:chung' || A.ceo) return true;
  if (room.startsWith('g:')) return !!A.team && room.slice(2) === A.team;
  if (room.startsWith('p:')) {
    const id = room.slice(2);
    let p = (await hubCtx(A.db)).projects.find((x) => x.id === id);
    if (!p) p = (await hubCtx(A.db, true)).projects.find((x) => x.id === id); // dự án vừa tạo
    if (!p) return false;
    return p.owner === A.hubId || (p.tv ?? []).includes(A.hubId) || (!!A.team && [p.team, ...(p.teams ?? [])].includes(A.team));
  }
  const g = await A.db.prepare('SELECT members FROM chat_groups WHERE id = ?').bind(room.slice(2)).first<{ members: string }>();
  return !!g && parseMembers(g.members).includes(A.id);
}
export const dmRoom = (a: string, b: string) => 'dm:' + [a, b].sort().join('~');

async function needRoom(room: unknown, A: Acc): Promise<string> {
  const r = String(room ?? '');
  if (!ROOM_RE.test(r)) throw badRequest('BAD_ROOM', 'Phòng chat không hợp lệ');
  if (!(await canRoom(r, A))) throw forbidden(r.startsWith('dm:') ? 'Đây là tin nhắn riêng của người khác' : 'Bạn không thuộc nhóm này');
  return r;
}

/** Danh sách phòng có tin: tin cuối + số chưa đọc. */
chatRoutes.get('/summary', async (c) => {
  const A = await access(c);
  const me = A.id;
  const db = c.env.DB;
  const since = new Date(Date.now() - NEW_GROUP_DAYS * 864e5).toISOString();
  const mine = `(m.room LIKE 'g:%' OR m.room LIKE 'p:%' OR m.room LIKE 'n:%' OR m.room LIKE 'dm:' || ?1 || '~%' OR m.room LIKE 'dm:%~' || ?1)`;
  const last = await db
    .prepare(
      `SELECT m.room, m.id, m.user_id, m.body, m.kind, m.created_at FROM chat_msgs m
       JOIN (SELECT room, MAX(id) AS id FROM chat_msgs m WHERE ${mine} GROUP BY room) x ON x.id = m.id`,
    )
    .bind(me)
    .all<{ room: string; id: number; user_id: string; body: string; kind: string; created_at: string }>();
  const unread = await db
    .prepare(
      `SELECT m.room, COUNT(*) AS n FROM chat_msgs m LEFT JOIN chat_reads r ON r.room = m.room AND r.user_id = ?1
       WHERE ${mine} AND m.user_id <> ?1 AND m.id > COALESCE(r.last_id, 0) AND (r.last_id IS NOT NULL OR m.created_at > ?2)
       GROUP BY m.room`,
    )
    .bind(me, since)
    .all<{ room: string; n: number }>();
  const un = new Map((unread.results ?? []).map((r) => [r.room, r.n]));
  const okRoom = new Map<string, boolean>();
  for (const r of last.results ?? []) okRoom.set(r.room, await canRoom(r.room, A));
  const rooms = (last.results ?? [])
    .filter((r) => okRoom.get(r.room))
    .map((r) => ({ room: r.room, last: { id: r.id, user_id: r.user_id, body: r.body.slice(0, 140), kind: r.kind, created_at: r.created_at }, unread: un.get(r.room) ?? 0 }));
  return ok(c, { rooms });
});

chatRoutes.get('/msgs', async (c) => {
  const A = await access(c);
  const room = await needRoom(c.req.query('room'), A);
  const after = Number(c.req.query('after') ?? 0) || 0;
  const before = Number(c.req.query('before') ?? 0) || 0;
  const db = c.env.DB;
  const rows = after
    ? await db.prepare(`SELECT * FROM chat_msgs WHERE room = ? AND id > ? ORDER BY id LIMIT ${PAGE * 2}`).bind(room, after).all()
    : await db
        .prepare(`SELECT * FROM (SELECT * FROM chat_msgs WHERE room = ? ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ${PAGE}) ORDER BY id`)
        .bind(...(before ? [room, before] : [room]))
        .all();
  return ok(c, rows.results ?? []);
});

chatRoutes.post('/msgs', async (c) => {
  const A = await access(c);
  const me = A.id;
  const b = (await c.req.json().catch(() => null)) as { room?: unknown; body?: unknown; kind?: unknown; ref?: unknown } | null;
  const room = await needRoom(b?.room, A);
  const body = String(b?.body ?? '').trim().slice(0, 4000);
  const kind = ['', 'task', 'remind', 'file', 'react'].includes(String(b?.kind ?? '')) ? String(b?.kind ?? '') : '';
  const ref = String(b?.ref ?? '').slice(0, 80);
  if (!body && !ref) throw badRequest('EMPTY', 'Chưa có nội dung');
  if (kind === 'react' && !/^r:\d{1,12}$/.test(ref)) throw badRequest('BAD_REACT', 'Thả cảm xúc cho tin không hợp lệ');
  const at = nowIso();
  const r = await c.env.DB.prepare('INSERT INTO chat_msgs (room, user_id, body, kind, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(room, me, body, kind, ref, at)
    .run();
  const id = Number(r.meta.last_row_id);
  await c.env.DB.prepare(
    'INSERT INTO chat_reads (user_id, room, last_id) VALUES (?, ?, ?) ON CONFLICT(user_id, room) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)',
  )
    .bind(me, room, id)
    .run();
  if (!kind && body.includes('@')) await callAgents(A, room, body, me).catch(() => undefined);
  return ok(c, { id, room, user_id: me, body, kind, ref, created_at: at });
});

chatRoutes.post('/read', async (c) => {
  const A = await access(c);
  const me = A.id;
  const b = (await c.req.json().catch(() => null)) as { room?: unknown; last_id?: unknown } | null;
  const room = await needRoom(b?.room, A);
  const id = Math.max(0, Number(b?.last_id) || 0);
  await c.env.DB.prepare(
    'INSERT INTO chat_reads (user_id, room, last_id) VALUES (?, ?, ?) ON CONFLICT(user_id, room) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)',
  )
    .bind(me, room, id)
    .run();
  return ok(c, { room, last_id: id });
});

/** Đặt nhắc: cho mình hoặc người khác. */
chatRoutes.post('/reminders', async (c) => {
  const A = await access(c);
  const me = A.id;
  const b = (await c.req.json().catch(() => null)) as { user_id?: unknown; due_at?: unknown; text?: unknown; room?: unknown; task_id?: unknown } | null;
  const due = Date.parse(String(b?.due_at ?? ''));
  if (!Number.isFinite(due)) throw badRequest('BAD_TIME', 'Chọn giờ nhắc');
  const text = String(b?.text ?? '').trim().slice(0, 500);
  if (!text) throw badRequest('EMPTY', 'Ghi nhắc việc gì');
  const who = String(b?.user_id ?? me).slice(0, 64) || me;
  const room = b?.room ? await needRoom(b.room, A) : '';
  const r = await c.env.DB.prepare(
    'INSERT INTO chat_reminders (user_id, by_id, due_at, text, room, task_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(who, me, new Date(due).toISOString(), text, room, String(b?.task_id ?? '').slice(0, 80), nowIso())
    .run();
  return ok(c, { id: Number(r.meta.last_row_id) });
});

/** Nhắc đến giờ của tôi: trả về rồi đánh dấu đã nhắc (mỗi nhắc chỉ báo một lần). */
chatRoutes.get('/reminders/due', async (c) => {
  const me = c.get('auth').user.id;
  const now = nowIso();
  const rows = await c.env.DB.prepare('SELECT * FROM chat_reminders WHERE user_id = ? AND fired_at IS NULL AND due_at <= ? ORDER BY due_at LIMIT 20')
    .bind(me, now)
    .all<{ id: number }>();
  const L = rows.results ?? [];
  if (L.length)
    await c.env.DB.prepare(`UPDATE chat_reminders SET fired_at = ? WHERE id IN (${L.map(() => '?').join(',')})`)
      .bind(now, ...L.map((x) => x.id))
      .run();
  return ok(c, L);
});

/** Nhắc sắp tới: của tôi và tôi đặt cho người khác. */
chatRoutes.get('/reminders', async (c) => {
  const me = c.get('auth').user.id;
  const rows = await c.env.DB.prepare(
    'SELECT * FROM chat_reminders WHERE (user_id = ? OR by_id = ?) AND fired_at IS NULL ORDER BY due_at LIMIT 50',
  )
    .bind(me, me)
    .all();
  return ok(c, rows.results ?? []);
});

chatRoutes.delete('/reminders/:id', async (c) => {
  const me = c.get('auth').user.id;
  const r = await c.env.DB.prepare('DELETE FROM chat_reminders WHERE id = ? AND (user_id = ? OR by_id = ?)').bind(Number(c.req.param('id')), me, me).run();
  return ok(c, { deleted: r.meta.changes ?? 0 });
});

/* ---------- Ảnh / tệp trong cuộc trò chuyện (học Zalo) ---------- */
export const CHAT_FILE_MAX = 1_600_000;
const FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', // ghi âm tin nhắn thoại
];

/** Gửi tệp: lưu tệp rồi đăng một tin loại 'file' (ref = mã tệp) vào phòng. */
chatRoutes.post('/files', async (c) => {
  const A = await access(c);
  const me = A.id;
  const form = await c.req.formData().catch(() => null);
  const room = await needRoom(form?.get('room'), A);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw badRequest('MISSING', 'Chưa chọn tệp');
  if (!FILE_TYPES.includes(file.type)) throw badRequest('BAD_TYPE', 'Chỉ gửi được ảnh, ghi âm, PDF, Word, Excel, PowerPoint hoặc tệp chữ');
  if (file.size > CHAT_FILE_MAX) throw badRequest('TOO_LARGE', 'Tệp quá 1,5 MB, hãy gửi link Google Drive');
  const id = crypto.randomUUID();
  const name = (file.name || 'tep').slice(0, 160);
  const at = nowIso();
  await c.env.DB.prepare('INSERT INTO chat_files (id, room, name, mime, size, data, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, room, name, file.type, file.size, new Uint8Array(await file.arrayBuffer()), me, at)
    .run();
  const r = await c.env.DB.prepare('INSERT INTO chat_msgs (room, user_id, body, kind, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(room, me, name, 'file', 'f:' + id, at)
    .run();
  const mid = Number(r.meta.last_row_id);
  await c.env.DB.prepare(
    'INSERT INTO chat_reads (user_id, room, last_id) VALUES (?, ?, ?) ON CONFLICT(user_id, room) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)',
  )
    .bind(me, room, mid)
    .run();
  return ok(c, { msg: { id: mid, room, user_id: me, body: name, kind: 'file', ref: 'f:' + id, created_at: at }, file: { id, name, mime: file.type, size: file.size, user_id: me, created_at: at } });
});

/** Danh sách ảnh / tệp của một phòng (cột Thông tin hội thoại). */
chatRoutes.get('/files', async (c) => {
  const A = await access(c);
  const room = await needRoom(c.req.query('room'), A);
  const rows = await c.env.DB.prepare('SELECT id, name, mime, size, user_id, created_at FROM chat_files WHERE room = ? ORDER BY created_at DESC LIMIT 200')
    .bind(room)
    .all();
  return ok(c, rows.results ?? []);
});

chatRoutes.get('/files/:id', async (c) => {
  const A = await access(c);
  const row = await c.env.DB.prepare('SELECT room, name, mime, data FROM chat_files WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ room: string; name: string; mime: string; data: unknown }>();
  if (!row) throw notFound('Không thấy tệp');
  if (!(await canRoom(row.room, A))) throw forbidden('Tệp trong tin nhắn riêng của người khác');
  const d = row.data;
  const bytes =
    d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : Uint8Array.from((Array.isArray(d) ? d : Object.values(d as object)) as number[]);
  const dl = c.req.query('dl') === '1';
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'content-type': row.mime,
      'content-disposition': `${dl ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      'cache-control': 'private, max-age=3600',
    },
  });
});

/* ---------- Nhóm phối hợp tự tạo (ví dụ Team Content – Digital): chỉ thành viên thấy ---------- */
chatRoutes.get('/groups', async (c) => {
  const A = await access(c);
  const rows = await c.env.DB.prepare('SELECT id, name, members, created_by, created_at FROM chat_groups ORDER BY created_at').all<{ id: string; name: string; members: string; created_by: string; created_at: string }>();
  const L = (rows.results ?? []).map((g) => ({ ...g, members: parseMembers(g.members) })).filter((g) => A.ceo || g.members.includes(A.id));
  return ok(c, L);
});

function groupBody(b: { name?: unknown; members?: unknown } | null, me: string) {
  const name = String(b?.name ?? '').trim().slice(0, 80);
  if (!name) throw badRequest('EMPTY', 'Đặt tên nhóm');
  const members = [...new Set([me, ...(Array.isArray(b?.members) ? b!.members : []).map(String)])].filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 80);
  if (members.length < 2) throw badRequest('FEW', 'Chọn ít nhất một thành viên');
  return { name, members };
}

/** Tạo nhóm: CEO, Lead, trưởng phòng. */
chatRoutes.post('/groups', async (c) => {
  const A = await access(c);
  if (!A.lead) throw forbidden('Chỉ CEO, Lead, trưởng phòng tạo nhóm');
  const g = groupBody((await c.req.json().catch(() => null)) as never, A.id);
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const at = nowIso();
  await c.env.DB.prepare('INSERT INTO chat_groups (id, name, members, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, g.name, JSON.stringify(g.members), A.id, at, at)
    .run();
  return ok(c, { id, name: g.name, members: g.members, created_by: A.id, created_at: at });
});

/** Sửa tên / thành viên: người tạo nhóm hoặc CEO. */
chatRoutes.put('/groups/:id', async (c) => {
  const A = await access(c);
  const row = await c.env.DB.prepare('SELECT created_by FROM chat_groups WHERE id = ?').bind(c.req.param('id')).first<{ created_by: string }>();
  if (!row) throw notFound('Không thấy nhóm');
  if (row.created_by !== A.id && !A.ceo) throw forbidden('Chỉ người tạo nhóm hoặc CEO sửa được');
  const g = groupBody((await c.req.json().catch(() => null)) as never, row.created_by);
  await c.env.DB.prepare('UPDATE chat_groups SET name = ?, members = ?, updated_at = ? WHERE id = ?').bind(g.name, JSON.stringify(g.members), nowIso(), c.req.param('id')).run();
  return ok(c, { id: c.req.param('id'), ...g });
});

chatRoutes.delete('/groups/:id', async (c) => {
  const A = await access(c);
  const row = await c.env.DB.prepare('SELECT created_by FROM chat_groups WHERE id = ?').bind(c.req.param('id')).first<{ created_by: string }>();
  if (!row) throw notFound('Không thấy nhóm');
  if (row.created_by !== A.id && !A.ceo) throw forbidden('Chỉ người tạo nhóm hoặc CEO xoá được');
  await c.env.DB.prepare('DELETE FROM chat_groups WHERE id = ?').bind(c.req.param('id')).run();
  return ok(c, { deleted: true });
});

/* ---------- Agent trong nhóm chat (chị Hoa 03/11): Lead / CEO thêm agent vào nhóm (dữ liệu chung chatAgents[phòng]);
   agent CHỈ trả lời khi được gọi @tên. Web gửi cho agent các tin gần đây của nhóm để agent hiểu bối cảnh, không phải kể lại;
   câu trả lời (cầu nối VPS /api/agent-relay/push) được đưa về đúng nhóm (app_kv chatlink:<mã tin agent>). ---------- */
const CONTEXT_N = 20;
async function callAgents(A: Acc, room: string, body: string, me: string) {
  const hub = await hubCtx(A.db);
  const ids = hub.agents[room] ?? [];
  if (!ids.length) return;
  const low = body.toLowerCase();
  const called = AGENT_ROSTER.filter((a) => ids.includes(a.id) && low.includes('@' + a.name.toLowerCase()));
  if (!called.length) return;
  const rows = await A.db.prepare("SELECT user_id, body, kind, created_at FROM chat_msgs WHERE room = ? AND kind IN ('', 'agent', 'task') ORDER BY id DESC LIMIT ?").bind(room, CONTEXT_N).all<{ user_id: string; body: string; kind: string; created_at: string }>();
  const who = (id: string) => (id.startsWith('agent:') ? AGENT_ROSTER.find((a) => 'agent:' + a.id === id)?.name ?? 'Agent' : (hub.users.find((u) => u.crm === id) as (HubU & { name?: string }) | undefined)?.name ?? 'Nhân sự');
  const hhmm = (s: string) => new Date(Date.parse(s) + 7 * 3600e3).toISOString().slice(11, 16);
  const ctx = (rows.results ?? []).reverse().map((m) => `- ${who(m.user_id)} (${hhmm(m.created_at)}): ${m.body.slice(0, 600)}`).join('\n');
  const sender = who(me);
  const now = nowIso();
  for (const a of called) {
    const text = `[Bạn đang được gọi trong nhóm chat "${room}" trên web AILLA. Trả lời ngắn gọn bằng tiếng Việt, trả lời ngay trong nhóm.]\nTin gần đây trong nhóm:\n${ctx}\n\n${sender} hỏi bạn: ${body}`;
    const r = await A.db.prepare(`INSERT INTO agent_chat (agent, role, body, status, tg, created_by, owner_id, created_at, updated_at) VALUES (?, 'USER', ?, 'queued', 0, ?, ?, ?, ?)`)
      .bind(a.id, text.slice(0, 20000), me, me, now, now)
      .run();
    const acId = Number(r.meta.last_row_id);
    await A.db.prepare('INSERT INTO app_kv (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at').bind('chatlink:' + acId, room, now).run();
  }
}

/** Agent để hiện tên / gợi ý @ trong chat (ai vào web vận hành cũng xem được danh sách tên). */
chatRoutes.get('/agents', (c) => ok(c, AGENT_ROSTER.map((a) => ({ id: a.id, name: a.name, title: a.title, emoji: a.emoji, color: a.color }))));

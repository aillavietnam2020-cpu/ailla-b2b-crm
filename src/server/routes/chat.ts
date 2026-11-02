import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, forbidden, ok } from '../lib/http';
import { requirePermission } from '../middleware/rbac';

/**
 * Tin nhắn kiểu Lark (hub/src/tinnhan.js, chị Hoa 02/11/2026).
 * - Nhóm 'g:<phòng>' và nhóm dự án 'p:<mã dự án>' (dự án liên phòng): ai vào được web vận hành đều đọc, viết được (nhóm nội bộ công ty).
 * - Nhắn riêng 'dm:<a>~<b>': chỉ hai người trong tên phòng đọc, viết được (máy chủ chặn, không chỉ ẩn trên màn hình).
 * - Nhắc việc: nhắc mình hoặc nhắc người khác theo giờ; trình duyệt hỏi /reminders/due khoảng 45 giây một lần.
 */
export const chatRoutes = new Hono<AppEnv>();
chatRoutes.use('*', requirePermission('hub.access'));

const ROOM_RE = /^(g:[a-z0-9_-]{1,40}|p:[A-Za-z0-9_-]{1,40}|dm:[A-Za-z0-9_-]{1,64}~[A-Za-z0-9_-]{1,64})$/;
const PAGE = 60;
const NEW_GROUP_DAYS = 3; // nhóm chưa mở lần nào: chỉ đếm tin chưa đọc trong 3 ngày gần nhất

/** Phòng hợp lệ và người này được vào. */
export function canRoom(room: string, userId: string): boolean {
  if (!ROOM_RE.test(room)) return false;
  if (room.startsWith('g:') || room.startsWith('p:')) return true;
  const [a, b] = room.slice(3).split('~');
  return (a === userId || b === userId) && a <= b;
}
export const dmRoom = (a: string, b: string) => 'dm:' + [a, b].sort().join('~');

function needRoom(room: unknown, userId: string): string {
  const r = String(room ?? '');
  if (!ROOM_RE.test(r)) throw badRequest('BAD_ROOM', 'Phòng chat không hợp lệ');
  if (!canRoom(r, userId)) throw forbidden('Đây là tin nhắn riêng của người khác');
  return r;
}

/** Danh sách phòng có tin: tin cuối + số chưa đọc. */
chatRoutes.get('/summary', async (c) => {
  const me = c.get('auth').user.id;
  const db = c.env.DB;
  const since = new Date(Date.now() - NEW_GROUP_DAYS * 864e5).toISOString();
  const mine = `(m.room LIKE 'g:%' OR m.room LIKE 'p:%' OR m.room LIKE 'dm:' || ?1 || '~%' OR m.room LIKE 'dm:%~' || ?1)`;
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
  const rooms = (last.results ?? [])
    .filter((r) => canRoom(r.room, me))
    .map((r) => ({ room: r.room, last: { id: r.id, user_id: r.user_id, body: r.body.slice(0, 140), kind: r.kind, created_at: r.created_at }, unread: un.get(r.room) ?? 0 }));
  return ok(c, { rooms });
});

chatRoutes.get('/msgs', async (c) => {
  const me = c.get('auth').user.id;
  const room = needRoom(c.req.query('room'), me);
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
  const me = c.get('auth').user.id;
  const b = (await c.req.json().catch(() => null)) as { room?: unknown; body?: unknown; kind?: unknown; ref?: unknown } | null;
  const room = needRoom(b?.room, me);
  const body = String(b?.body ?? '').trim().slice(0, 4000);
  const kind = ['', 'task', 'remind'].includes(String(b?.kind ?? '')) ? String(b?.kind ?? '') : '';
  const ref = String(b?.ref ?? '').slice(0, 80);
  if (!body && !ref) throw badRequest('EMPTY', 'Chưa có nội dung');
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
  return ok(c, { id, room, user_id: me, body, kind, ref, created_at: at });
});

chatRoutes.post('/read', async (c) => {
  const me = c.get('auth').user.id;
  const b = (await c.req.json().catch(() => null)) as { room?: unknown; last_id?: unknown } | null;
  const room = needRoom(b?.room, me);
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
  const me = c.get('auth').user.id;
  const b = (await c.req.json().catch(() => null)) as { user_id?: unknown; due_at?: unknown; text?: unknown; room?: unknown; task_id?: unknown } | null;
  const due = Date.parse(String(b?.due_at ?? ''));
  if (!Number.isFinite(due)) throw badRequest('BAD_TIME', 'Chọn giờ nhắc');
  const text = String(b?.text ?? '').trim().slice(0, 500);
  if (!text) throw badRequest('EMPTY', 'Ghi nhắc việc gì');
  const who = String(b?.user_id ?? me).slice(0, 64) || me;
  const room = b?.room ? needRoom(b.room, me) : '';
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

/**
 * Zalo trong CRM, đợt 1 (chị Hoa duyệt demo 27/11/2026).
 *
 *  /api/zalo             người dùng web: nick, hội thoại, tin nhắn, gửi tin (người bấm), gắn khách, tin mẫu.
 *  /api/zalo-nick-relay  chương trình trên VPS (vps-zalo/zalo-nick.mjs) gọi bằng khóa cầu nối AGENT_RELAY_KEY:
 *                        lấy lệnh (đăng nhập QR, gửi tin, đăng xuất), báo trạng thái nick, đẩy tin đến/đi, thu hồi, đã xem.
 *
 * Quyền: sale chỉ thấy nick mình phụ trách và hội thoại trên nick đó. Lead / CEO thấy hết, và là người duy nhất
 * thấy nội dung tin khách đã thu hồi. Đợt này KHÔNG có gửi tự động: tin chỉ đi khi người bấm Gửi.
 * Trần chống khóa nick: 5 tin / 30 giây / nick (web chặn, máy VPS cũng chặn).
 */
import { Hono, type Context } from 'hono';
import { nowIso, vnDate } from '@shared/datetime';
import {
  aiSensitive,
  ZALO_SEND_WINDOW_MS,
  ZALO_TEXT_MAX,
  msgForViewer,
  msgPreview,
  sendAllowed,
  zaloPhone,
  type ZaloDay,
  type ZaloMsgRow,
} from '@shared/zalo';
import type { AppEnv } from '../env';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { newId } from '../lib/ids';
import { cskhMe } from '../services/cskh';
import { agentAllowed, agentPrompt, loadAiCfg, parseAgent, queueAgent } from '../services/zaloAgent';
import { relayAuth } from './agentChat';

type C = Context<AppEnv>;
const str = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);

/* ------------------------------------------------------------------ ai đang xem */
export interface Viewer {
  id: string;
  name: string;
  lead: boolean;
}
export async function viewer(c: C): Promise<Viewer> {
  const auth = c.get('auth');
  if (auth.actorType === 'AGENT') throw forbidden('Agent không dùng hộp tin Zalo');
  let lead = auth.user.role === 'CEO' || auth.user.role === 'MANAGER';
  if (!lead) {
    try {
      lead = (await cskhMe(c.env.DB, auth)).lead;
    } catch {
      /* không đọc được dữ liệu chung thì coi là sale */
    }
  }
  return { id: auth.user.id, name: auth.user.display_name, lead };
}
/** Điều kiện SQL "nick này người xem thấy được" (bí danh bảng nick là n). */
export const nickScope = (v: Viewer): { sql: string; params: unknown[] } => (v.lead ? { sql: '1=1', params: [] } : { sql: 'n.owner_id = ?', params: [v.id] });

interface NickRow {
  id: string;
  name: string;
  owner_id: string | null;
  status: string;
  disabled: number;
}
export async function nickFor(c: C, v: Viewer, id: string): Promise<NickRow> {
  const n = await c.env.DB.prepare('SELECT id, name, owner_id, status, disabled FROM zalo_nicks WHERE id = ?').bind(id).first<NickRow>();
  if (!n) throw notFound('Không có nick này');
  if (!v.lead && n.owner_id !== v.id) throw forbidden('Nick này không phải của bạn');
  return n;
}
interface ConvRow {
  id: string;
  nick_id: string;
  thread_id: string;
  is_group: number;
  name: string;
  customer_id: string | null;
  cskh_phone: string | null;
  peer_phone: string;
  owner_id: string | null;
  nick_name: string;
}
export async function convFor(c: C, v: Viewer, id: string): Promise<ConvRow> {
  const r = await c.env.DB.prepare(
    `SELECT z.id, z.nick_id, z.thread_id, z.is_group, z.name, z.customer_id, z.cskh_phone, z.peer_phone, n.owner_id, n.name AS nick_name
     FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id WHERE z.id = ?`,
  )
    .bind(id)
    .first<ConvRow>();
  if (!r) throw notFound('Không có hội thoại này');
  if (!v.lead && r.owner_id !== v.id) throw forbidden('Hội thoại này thuộc nick của người khác');
  return r;
}

/** Trần 5 tin / 30 giây / nick: đếm lệnh gửi chưa hỏng trong 30 giây qua. */
async function checkRate(db: D1Database, nickId: string) {
  const since = new Date(Date.now() - ZALO_SEND_WINDOW_MS).toISOString();
  const rows =
    (await db.prepare("SELECT created_at FROM zalo_cmds WHERE nick_id = ? AND kind IN ('SEND','FRIEND_REQ') AND status <> 'FAILED' AND created_at >= ?").bind(nickId, since).all<{ created_at: string }>())
      .results ?? [];
  const r = sendAllowed(rows.map((x) => Date.parse(x.created_at)), Date.now());
  if (!r.ok) throw badRequest('ZALO_SLOW', `Gửi nhanh quá dễ bị Zalo khóa nick. Chờ ${r.waitSec} giây rồi gửi tiếp.`);
}

/* ================================================================== web */
export const zaloRoutes = new Hono<AppEnv>();

/** Người xem là ai, nick của mình, số tin chưa đọc (nút Zalo trên thanh trên cùng). */
zaloRoutes.get('/me', async (c) => {
  const v = await viewer(c);
  const sc = nickScope(v);
  const nicks =
    (await c.env.DB.prepare(`SELECT n.id, n.name, n.status, n.owner_id FROM zalo_nicks n WHERE ${sc.sql} AND n.disabled = 0 ORDER BY n.name`).bind(...sc.params).all()).results ?? [];
  const cnt = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN z.is_group = 0 THEN z.unread ELSE 0 END), 0) AS unread,
            COALESCE(SUM(CASE WHEN z.is_group = 0 AND z.waiting_since IS NOT NULL THEN 1 ELSE 0 END), 0) AS wait
     FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id WHERE ${sc.sql}`,
  )
    .bind(...sc.params)
    .first<{ unread: number; wait: number }>();
  return ok(c, { id: v.id, lead: v.lead, nicks, unread: cnt?.unread ?? 0, wait: cnt?.wait ?? 0 });
});

/* ---------------- nick */
zaloRoutes.get('/nicks', async (c) => {
  const v = await viewer(c);
  const sc = nickScope(v);
  const day = vnDate();
  const from = new Date(Date.parse(day + 'T00:00:00+07:00')).toISOString();
  const rows =
    (
      await c.env.DB.prepare(
        `SELECT n.id, n.name, n.owner_id, u.display_name AS owner_name, n.status, n.status_note, n.zalo_name, n.disabled, n.seen_at, n.updated_at,
           (SELECT COUNT(*) FROM zalo_msgs m WHERE m.nick_id = n.id AND m.from_me = 0 AND m.at >= ?) AS in_today,
           (SELECT COUNT(*) FROM zalo_msgs m WHERE m.nick_id = n.id AND m.from_me = 1 AND m.at >= ?) AS out_today
         FROM zalo_nicks n LEFT JOIN users u ON u.id = n.owner_id WHERE ${sc.sql} ORDER BY n.disabled, n.name`,
      )
        .bind(from, from, ...sc.params)
        .all()
    ).results ?? [];
  const relay = await c.env.DB.prepare("SELECT v FROM app_kv WHERE k = 'zalo_nick_seen'").first<{ v: string }>();
  const users = v.lead
    ? ((await c.env.DB.prepare("SELECT id, display_name FROM users WHERE status = 'ACTIVE' AND deleted_at IS NULL AND kind = 'HUMAN' ORDER BY display_name").all()).results ?? [])
    : [];
  return ok(c, { lead: v.lead, nicks: rows, relay_seen: relay?.v ?? null, users });
});

zaloRoutes.post('/nicks', async (c) => {
  const v = await viewer(c);
  if (!v.lead) throw forbidden('Chỉ Lead / CEO thêm nick');
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; owner_id?: string };
  const name = str(b.name, 80);
  if (!name) throw badRequest('NO_NAME', 'Đặt tên cho nick, ví dụ "Zalo Sale 1"');
  const owner = str(b.owner_id, 64) || null;
  if (owner && !(await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(owner).first())) throw badRequest('NO_OWNER', 'Không có người phụ trách này');
  const id = newId();
  const now = nowIso();
  await c.env.DB.prepare('INSERT INTO zalo_nicks (id, name, owner_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, name, owner, v.id, now, now).run();
  return ok(c, { id });
});

zaloRoutes.patch('/nicks/:id', async (c) => {
  const v = await viewer(c);
  if (!v.lead) throw forbidden('Chỉ Lead / CEO sửa nick');
  const n = await nickFor(c, v, c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; owner_id?: string | null };
  const name = b.name === undefined ? n.name : str(b.name, 80) || n.name;
  const owner = b.owner_id === undefined ? n.owner_id : str(b.owner_id, 64) || null;
  await c.env.DB.prepare('UPDATE zalo_nicks SET name = ?, owner_id = ?, updated_at = ? WHERE id = ?').bind(name, owner, nowIso(), n.id).run();
  return ok(c, { ok: true });
});

/** Xin mã QR để quét bằng Zalo trên điện thoại (thêm nick hoặc quét lại khi rớt). */
zaloRoutes.post('/nicks/:id/qr', async (c) => {
  const v = await viewer(c);
  const n = await nickFor(c, v, c.req.param('id'));
  const now = nowIso();
  await c.env.DB.prepare("UPDATE zalo_cmds SET status = 'FAILED', error = 'Đã xin mã mới', done_at = ? WHERE nick_id = ? AND kind = 'LOGIN_QR' AND status IN ('PENDING','TAKEN')")
    .bind(now, n.id)
    .run();
  await c.env.DB.prepare("INSERT INTO zalo_cmds (id, nick_id, kind, status, created_by, created_at) VALUES (?, ?, 'LOGIN_QR', 'PENDING', ?, ?)").bind(newId(), n.id, v.id, now).run();
  await c.env.DB.prepare("UPDATE zalo_nicks SET status = 'QR', status_note = 'Đang tạo mã QR…', qr_image = NULL, qr_at = ?, disabled = 0, updated_at = ? WHERE id = ?").bind(now, now, n.id).run();
  return ok(c, { ok: true });
});

/** Trạng thái một nick (hộp quét QR hỏi mỗi 2 giây). */
zaloRoutes.get('/nicks/:id', async (c) => {
  const v = await viewer(c);
  const n = await nickFor(c, v, c.req.param('id'));
  const r = await c.env.DB.prepare('SELECT id, name, status, status_note, qr_image, qr_at, zalo_name FROM zalo_nicks WHERE id = ?').bind(n.id).first();
  return ok(c, r);
});

/** Ngừng nick: máy VPS đăng xuất và xóa phiên đã lưu. Bật lại = quét QR. */
zaloRoutes.post('/nicks/:id/stop', async (c) => {
  const v = await viewer(c);
  const n = await nickFor(c, v, c.req.param('id'));
  const now = nowIso();
  await c.env.DB.prepare("INSERT INTO zalo_cmds (id, nick_id, kind, status, created_by, created_at) VALUES (?, ?, 'LOGOUT', 'PENDING', ?, ?)").bind(newId(), n.id, v.id, now).run();
  await c.env.DB.prepare("UPDATE zalo_nicks SET disabled = 1, status = 'STOPPED', status_note = ?, qr_image = NULL, updated_at = ? WHERE id = ?").bind('Đã ngừng bởi ' + v.name, now, n.id).run();
  return ok(c, { ok: true });
});

/* ---------------- hội thoại */
zaloRoutes.get('/convs', async (c) => {
  const v = await viewer(c);
  const sc = nickScope(v);
  const f = c.req.query('f') ?? 'all';
  const where = [sc.sql];
  const params: unknown[] = [...sc.params];
  if (f === 'wait') where.push('z.is_group = 0 AND z.waiting_since IS NOT NULL');
  if (f === 'grp') where.push('z.is_group = 1');
  if (f === 'unread') where.push('z.unread > 0');
  const nick = c.req.query('nick');
  if (nick) {
    where.push('z.nick_id = ?');
    params.push(nick);
  }
  const q = str(c.req.query('q'), 80);
  // Nhóm / bạn kéo về từ danh bạ mà chưa có tin nào thì không liệt kê (nick có hàng trăm nhóm), gõ tên vẫn tìm ra.
  if (!q) where.push('z.last_at IS NOT NULL');
  if (q) {
    where.push('(z.name LIKE ? OR z.peer_phone LIKE ? OR cu.name LIKE ? OR cs.name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows =
    (
      await c.env.DB.prepare(
        `SELECT z.id, z.nick_id, n.name AS nick_name, z.is_group, z.name, z.avatar, z.peer_phone, z.customer_id, cu.name AS customer_name,
                z.cskh_phone, cs.name AS cskh_name, z.last_at, z.last_text, z.last_from_me, z.unread, z.waiting_since, z.pinned_at, z.typing_at, z.is_friend
         FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id
         LEFT JOIN customers cu ON cu.id = z.customer_id LEFT JOIN cskh_customers cs ON cs.phone = z.cskh_phone
         WHERE ${where.join(' AND ')} ORDER BY (z.pinned_at IS NULL), (z.waiting_since IS NULL), z.last_at DESC LIMIT 300`,
      )
        .bind(...params)
        .all<{ is_group: number; last_from_me: number; last_text: string }>()
    ).results ?? [];
  // Cờ đỏ: tin cuối của khách trúng "Từ khóa để người thật xử lý" (Cài AI soạn sẵn).
  const blocked = (await loadAiCfg(c.env.DB)).blocked;
  return ok(c, rows.map((r) => ({ ...r, flag: !r.is_group && !r.last_from_me ? aiSensitive(r.last_text, blocked) : null })));
});

const MSG_COLS = `m.id, m.conv_id, m.from_me, m.sender_name, m.kind, m.text, m.url, m.at, m.recalled_at, m.seen_at, m.quote_text, m.quote_name, m.hidden_at, u.display_name AS sent_by_name`;

/** Một hội thoại: tin (mới nhất 100, kéo lên xem cũ hơn bằng ?before=), tin đang chờ gửi, thông tin khách cho khung bên phải. */
zaloRoutes.get('/convs/:id', async (c) => {
  const v = await viewer(c);
  const z = await convFor(c, v, c.req.param('id'));
  const before = c.req.query('before');
  const msgs = (
    (
      await c.env.DB.prepare(
        `SELECT ${MSG_COLS} FROM zalo_msgs m LEFT JOIN users u ON u.id = m.sent_by WHERE m.conv_id = ? ${v.lead ? '' : 'AND m.hidden_at IS NULL'} ${before ? 'AND m.at < ?' : ''} ORDER BY m.at DESC LIMIT 100`,
      )
        .bind(...(before ? [z.id, before] : [z.id]))
        .all<ZaloMsgRow>()
    ).results ?? []
  )
    .reverse()
    .map((m) => msgForViewer(m, v.lead));
  // Cảm xúc của các tin đang hiện.
  const reacts: Record<string, Array<{ icon: string; who_name: string; from_me: number }>> = {};
  for (let i = 0; i < msgs.length; i += 90) {
    const part = msgs.slice(i, i + 90).map((m) => m.id);
    const rr =
      (await c.env.DB.prepare(`SELECT msg_row_id, icon, who_name, from_me FROM zalo_reactions WHERE msg_row_id IN (${part.map(() => '?').join(',')})`).bind(...part).all<{ msg_row_id: string; icon: string; who_name: string; from_me: number }>())
        .results ?? [];
    for (const r of rr) (reacts[r.msg_row_id] ??= []).push({ icon: r.icon, who_name: r.who_name, from_me: r.from_me });
  }
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const pending =
    (await c.env.DB.prepare("SELECT id, text, status, error, created_at, payload FROM zalo_cmds WHERE conv_id = ? AND kind = 'SEND' AND status <> 'DONE' AND created_at >= ? ORDER BY created_at").bind(z.id, since).all())
      .results ?? [];
  let customer = null;
  if (z.customer_id) {
    customer = await c.env.DB.prepare(
      `SELECT c.id, c.name, c.phone_text, c.province, c.stage, t.name AS tier_name, u.display_name AS owner_name,
         (SELECT MAX(o.order_date) FROM orders o WHERE o.customer_id = c.id AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED') AS last_order_date
       FROM customers c LEFT JOIN price_tiers t ON t.id = c.tier_id LEFT JOIN users u ON u.id = c.owner_id WHERE c.id = ?`,
    )
      .bind(z.customer_id)
      .first();
  }
  let cskh = null;
  if (z.cskh_phone) {
    cskh = await c.env.DB.prepare('SELECT phone, name, owner_name, order_count, total_spent, last_order_day, last_product FROM cskh_customers WHERE phone = ?').bind(z.cskh_phone).first();
  }
  const conv = await c.env.DB.prepare('SELECT z.*, n.name AS nick_name FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id WHERE z.id = ?').bind(z.id).first();
  return ok(c, { conv, msgs: msgs.map((m) => ({ ...m, reacts: reacts[m.id] ?? [] })), pending, customer, cskh, lead: v.lead, can_send: v.lead || z.owner_id === v.id });
});

zaloRoutes.post('/convs/:id/read', async (c) => {
  const v = await viewer(c);
  const z = await convFor(c, v, c.req.param('id'));
  await c.env.DB.prepare('UPDATE zalo_convs SET unread = 0 WHERE id = ?').bind(z.id).run();
  return ok(c, { ok: true });
});

async function queueSend(
  c: C,
  v: Viewer,
  nick: NickRow,
  text: string,
  target: { conv_id?: string; thread_id?: string; is_group?: number; to_phone?: string; customer_id?: string | null; cskh_phone?: string | null },
  payload: SendPayload = {},
) {
  if (nick.disabled || nick.status !== 'ON') throw badRequest('NICK_OFF', `Nick "${nick.name}" chưa nối Zalo. Vào Nick Zalo để quét QR.`);
  const t = String(text ?? '').trim();
  if (!t && !payload.file && !payload.sticker && !payload.url) throw badRequest('NO_TEXT', 'Chưa có nội dung');
  if (t.length > ZALO_TEXT_MAX) throw badRequest('TOO_LONG', `Tin dài quá (tối đa ${ZALO_TEXT_MAX} ký tự)`);
  await checkRate(c.env.DB, nick.id);
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO zalo_cmds (id, nick_id, kind, conv_id, thread_id, is_group, to_phone, customer_id, cskh_phone, text, payload, status, created_by, created_at)
     VALUES (?, ?, 'SEND', ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
  )
    .bind(id, nick.id, target.conv_id ?? null, target.thread_id ?? null, target.is_group ?? 0, target.to_phone ?? null, target.customer_id ?? null, target.cskh_phone ?? null, t, Object.keys(payload).length ? JSON.stringify(payload) : '', v.id, nowIso())
    .run();
  return id;
}

/** Dữ liệu thêm khi gửi: trích dẫn tin cũ, tệp đã tải lên, nhãn dán, ảnh / tệp theo đường dẫn (chuyển tiếp). */
interface SendPayload {
  quote?: { msg_id: string; cli_msg_id: string; raw: string; text: string; name: string };
  file?: { id: string; name: string; mime: string };
  sticker?: { id: number; cateId: number; type: number; url: string };
  url?: { href: string; kind: string; name: string };
}
/** Lệnh không phải gửi tin (thu hồi, thả cảm xúc, kết bạn, kéo danh bạ). */
async function queueCmd(c: C, v: Viewer, nickId: string, kind: string, extra: { conv_id?: string | null; thread_id?: string | null; is_group?: number; text?: string; payload?: unknown }) {
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO zalo_cmds (id, nick_id, kind, conv_id, thread_id, is_group, text, payload, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
  )
    .bind(id, nickId, kind, extra.conv_id ?? null, extra.thread_id ?? null, extra.is_group ?? 0, extra.text ?? null, extra.payload ? JSON.stringify(extra.payload) : '', v.id, nowIso())
    .run();
  return id;
}
interface MsgFull {
  id: string;
  conv_id: string;
  nick_id: string;
  msg_id: string;
  cli_msg_id: string;
  from_me: number;
  kind: string;
  text: string;
  url: string;
  raw: string;
  sender_name: string;
  recalled_at: string | null;
}
async function msgFor(c: C, v: Viewer, id: string): Promise<{ m: MsgFull; z: ConvRow }> {
  const m = await c.env.DB.prepare('SELECT id, conv_id, nick_id, msg_id, cli_msg_id, from_me, kind, text, url, raw, sender_name, recalled_at FROM zalo_msgs WHERE id = ?').bind(id).first<MsgFull>();
  if (!m) throw notFound('Không có tin này');
  const z = await convFor(c, v, m.conv_id);
  return { m, z };
}
const canSendIn = (v: Viewer, z: ConvRow) => v.lead || z.owner_id === v.id;

/** Tải ảnh / tệp lên để gửi Zalo (base64, tối đa 1,9 MB; ảnh đã được trình duyệt thu nhỏ). Máy Zalo gửi xong thì xóa nội dung. */
const FILE_MAX = 1_900_000;
zaloRoutes.post('/files', async (c) => {
  const v = await viewer(c);
  const b = (await c.req.json().catch(() => ({}))) as { nick_id?: string; name?: string; mime?: string; b64?: string };
  const nick = await nickFor(c, v, str(b.nick_id, 64));
  const b64 = String(b.b64 ?? '');
  if (!b64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) throw badRequest('BAD_FILE', 'Tệp không đọc được');
  if (b64.length * 0.75 > FILE_MAX + 4) throw badRequest('TOO_BIG', 'Tệp lớn quá 1,9 MB. Ảnh thì web tự thu nhỏ; tệp lớn hơn gửi bằng Zalo trên điện thoại.');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const id = newId();
  const name = str(b.name, 120).replace(/[\\/:*?"<>|]/g, '_') || 'tep';
  await c.env.DB.prepare('INSERT INTO zalo_files (id, nick_id, name, mime, size, data, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, nick.id, name, str(b.mime, 100) || 'application/octet-stream', bytes.length, bytes, v.id, nowIso())
    .run();
  return ok(c, { id });
});

/** Thu hồi tin bên mình đã gửi (trên Zalo, khách không còn thấy). */
zaloRoutes.post('/msgs/:id/undo', async (c) => {
  const v = await viewer(c);
  const { m, z } = await msgFor(c, v, c.req.param('id'));
  if (!canSendIn(v, z)) throw forbidden('Chỉ người phụ trách nick hoặc Lead được thu hồi');
  if (!m.from_me) throw badRequest('NOT_MINE', 'Chỉ thu hồi được tin bên mình gửi');
  if (m.recalled_at) throw badRequest('DONE', 'Tin này đã thu hồi');
  if (m.msg_id.startsWith('web:')) throw badRequest('NO_ID', 'Tin này thiếu mã Zalo, thu hồi trên điện thoại');
  const id = await queueCmd(c, v, m.nick_id, 'UNDO', { conv_id: z.id, thread_id: z.thread_id, is_group: z.is_group, payload: { msg_id: m.msg_id, cli_msg_id: m.cli_msg_id } });
  return ok(c, { id });
});

/** Xóa phía mình: ẩn tin trên web (khách vẫn thấy trên Zalo). Lead / CEO vẫn xem được, có dấu "đã ẩn". */
zaloRoutes.post('/msgs/:id/hide', async (c) => {
  const v = await viewer(c);
  const { m, z } = await msgFor(c, v, c.req.param('id'));
  if (!canSendIn(v, z)) throw forbidden();
  await c.env.DB.prepare('UPDATE zalo_msgs SET hidden_at = ?, hidden_by = ? WHERE id = ?').bind(nowIso(), v.name, m.id).run();
  return ok(c, { ok: true });
});

/** Mã cảm xúc Zalo: tim, thích, haha, wow, khóc, giận. */
export const ZALO_ICONS = ['/-heart', '/-strong', ':>', ':o', ':-((', ':-h'];
zaloRoutes.post('/msgs/:id/react', async (c) => {
  const v = await viewer(c);
  const { m, z } = await msgFor(c, v, c.req.param('id'));
  if (!canSendIn(v, z)) throw forbidden();
  const b = (await c.req.json().catch(() => ({}))) as { icon?: string };
  const icon = String(b.icon ?? '');
  if (!ZALO_ICONS.includes(icon)) throw badRequest('BAD_ICON', 'Không có cảm xúc này');
  if (m.msg_id.startsWith('web:')) throw badRequest('NO_ID', 'Tin này thiếu mã Zalo');
  const id = await queueCmd(c, v, m.nick_id, 'REACT', { conv_id: z.id, thread_id: z.thread_id, is_group: z.is_group, payload: { msg_id: m.msg_id, cli_msg_id: m.cli_msg_id, icon, row: m.id } });
  return ok(c, { id });
});

/** Chuyển tiếp một tin (chữ, hoặc ảnh / tệp có đường dẫn) sang tối đa 5 hội thoại. Vẫn qua trần 5 tin / 30 giây. */
zaloRoutes.post('/msgs/:id/forward', async (c) => {
  const v = await viewer(c);
  const { m } = await msgFor(c, v, c.req.param('id'));
  if (m.recalled_at && !v.lead) throw badRequest('RECALLED', 'Tin đã thu hồi');
  const b = (await c.req.json().catch(() => ({}))) as { conv_ids?: string[] };
  const ids = [...new Set((b.conv_ids ?? []).map((x) => str(x, 64)).filter(Boolean))].slice(0, 5);
  if (!ids.length) throw badRequest('NO_TARGET', 'Chọn hội thoại nhận');
  const out: string[] = [];
  for (const cid of ids) {
    const z = await convFor(c, v, cid);
    if (!canSendIn(v, z)) throw forbidden('Không gửi được vào hội thoại thuộc nick của người khác');
    const nick = await nickFor(c, v, z.nick_id);
    const media = m.url && ['image', 'file', 'video', 'voice'].includes(m.kind);
    const payload: SendPayload = media ? { url: { href: m.url, kind: m.kind, name: m.text || 'tep' } } : {};
    const text = media ? (m.kind === 'image' ? m.text : '') : m.kind === 'link' ? m.url || m.text : m.text;
    out.push(await queueSend(c, v, nick, text, { conv_id: z.id, thread_id: z.thread_id, is_group: z.is_group }, payload));
  }
  return ok(c, { ids: out });
});

/** Ghim hội thoại lên đầu danh sách (trên web). */
zaloRoutes.post('/convs/:id/pin', async (c) => {
  const v = await viewer(c);
  const z = await convFor(c, v, c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { on?: boolean };
  await c.env.DB.prepare('UPDATE zalo_convs SET pinned_at = ? WHERE id = ?').bind(b.on ? nowIso() : null, z.id).run();
  return ok(c, { ok: true });
});

/** Gửi lời mời kết bạn (người bấm). Trần 30 lời mời / 24 giờ / nick. */
export const ZALO_FRIEND_DAY_MAX = 30;
zaloRoutes.post('/convs/:id/friend', async (c) => {
  const v = await viewer(c);
  const z = await convFor(c, v, c.req.param('id'));
  if (!canSendIn(v, z)) throw forbidden();
  if (z.is_group) throw badRequest('GROUP', 'Nhóm không kết bạn được');
  const nick = await nickFor(c, v, z.nick_id);
  if (nick.disabled || nick.status !== 'ON') throw badRequest('NICK_OFF', `Nick "${nick.name}" chưa nối Zalo`);
  const day = new Date(Date.now() - 24 * 3600_000).toISOString();
  const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM zalo_cmds WHERE nick_id = ? AND kind = 'FRIEND_REQ' AND status <> 'FAILED' AND created_at >= ?").bind(nick.id, day).first<{ n: number }>();
  if ((n?.n ?? 0) >= ZALO_FRIEND_DAY_MAX) throw badRequest('FRIEND_MAX', `Nick đã gửi ${ZALO_FRIEND_DAY_MAX} lời mời trong 24 giờ. Gửi thêm dễ bị Zalo khóa, để mai gửi tiếp.`);
  await checkRate(c.env.DB, nick.id);
  const b = (await c.req.json().catch(() => ({}))) as { text?: string };
  const id = await queueCmd(c, v, nick.id, 'FRIEND_REQ', { conv_id: z.id, thread_id: z.thread_id, text: str(b.text, 150) || 'Chào anh/chị, em bên AILLA ạ.' });
  return ok(c, { id });
});

/** Lời mời kết bạn gửi tới các nick người xem thấy. */
zaloRoutes.get('/friend-reqs', async (c) => {
  const v = await viewer(c);
  const sc = nickScope(v);
  const r =
    (await c.env.DB.prepare(`SELECT f.nick_id, n.name AS nick_name, f.uid, f.name, f.avatar, f.msg, f.at FROM zalo_friend_reqs f JOIN zalo_nicks n ON n.id = f.nick_id WHERE f.status = 'PENDING' AND ${sc.sql} ORDER BY f.at DESC LIMIT 100`).bind(...sc.params).all())
      .results ?? [];
  return ok(c, r);
});
zaloRoutes.post('/friend-reqs/:nick/:uid', async (c) => {
  const v = await viewer(c);
  const nick = await nickFor(c, v, c.req.param('nick'));
  const uid = str(c.req.param('uid'), 64);
  const b = (await c.req.json().catch(() => ({}))) as { accept?: boolean };
  const id = await queueCmd(c, v, nick.id, b.accept ? 'FRIEND_ACCEPT' : 'FRIEND_REJECT', { thread_id: uid });
  return ok(c, { id });
});

/** Kéo danh bạ, nhóm và tin cũ của nick về web. */
zaloRoutes.post('/nicks/:id/sync', async (c) => {
  const v = await viewer(c);
  const nick = await nickFor(c, v, c.req.param('id'));
  if (nick.status !== 'ON') throw badRequest('NICK_OFF', 'Nick chưa nối Zalo');
  const id = await queueCmd(c, v, nick.id, 'SYNC', {});
  return ok(c, { id });
});

/** Nhãn dán đã gặp gần đây (khách gửi hoặc mình gửi) để chọn gửi lại. */
zaloRoutes.get('/stickers', async (c) => {
  const v = await viewer(c);
  const sc = nickScope(v);
  const rows =
    (await c.env.DB.prepare(`SELECT m.raw, m.url FROM zalo_msgs m JOIN zalo_nicks n ON n.id = m.nick_id WHERE m.kind = 'sticker' AND m.raw <> '' AND ${sc.sql} ORDER BY m.at DESC LIMIT 300`).bind(...sc.params).all<{ raw: string; url: string }>())
      .results ?? [];
  const seen = new Map<string, { id: number; cateId: number; type: number; url: string }>();
  for (const r of rows) {
    try {
      const ct = ((JSON.parse(r.raw) as { content?: { id?: number; catId?: number; cateId?: number; type?: number } }).content ?? {}) as { id?: number; catId?: number; cateId?: number; type?: number };
      if (ct.id === undefined || seen.has(String(ct.id))) continue;
      seen.set(String(ct.id), { id: Number(ct.id), cateId: Number(ct.catId ?? ct.cateId ?? 0), type: Number(ct.type ?? 0), url: r.url });
    } catch {
      /* bỏ */
    }
    if (seen.size >= 40) break;
  }
  return ok(c, [...seen.values()]);
});

/** Gửi tin trong hội thoại (người bấm Gửi). Chương trình VPS lấy về gửi trong vài giây. */
zaloRoutes.post('/convs/:id/send', async (c) => {
  const v = await viewer(c);
  const z = await convFor(c, v, c.req.param('id'));
  if (!v.lead && z.owner_id !== v.id) throw forbidden('Chỉ người phụ trách nick hoặc Lead được gửi');
  const nick = await nickFor(c, v, z.nick_id);
  const b = (await c.req.json().catch(() => ({}))) as { text?: string; quote_id?: string; file_id?: string; sticker?: { id?: number; cateId?: number; type?: number; url?: string } };
  const payload: SendPayload = {};
  if (b.quote_id) {
    const { m } = await msgFor(c, v, str(b.quote_id, 64));
    if (m.conv_id !== z.id) throw badRequest('BAD_QUOTE', 'Tin trích dẫn không thuộc hội thoại này');
    payload.quote = { msg_id: m.msg_id, cli_msg_id: m.cli_msg_id, raw: m.raw, text: m.text.slice(0, 300), name: m.from_me ? '' : m.sender_name };
  }
  if (b.file_id) {
    const f = await c.env.DB.prepare('SELECT id, name, mime FROM zalo_files WHERE id = ? AND created_by = ? AND sent_at IS NULL').bind(str(b.file_id, 64), v.id).first<{ id: string; name: string; mime: string }>();
    if (!f) throw badRequest('NO_FILE', 'Không thấy tệp vừa tải lên, chọn lại tệp');
    payload.file = { id: f.id, name: f.name, mime: f.mime };
  }
  if (b.sticker && Number.isFinite(Number(b.sticker.id))) payload.sticker = { id: Number(b.sticker.id), cateId: Number(b.sticker.cateId) || 0, type: Number(b.sticker.type) || 0, url: str(b.sticker.url, 500) };
  const id = await queueSend(c, v, nick, String(b.text ?? ''), { conv_id: z.id, thread_id: z.thread_id, is_group: z.is_group }, payload);
  return ok(c, { id });
});

/** Nhắn Zalo từ hồ sơ khách chưa có hội thoại: máy tìm Zalo theo số điện thoại rồi gửi. */
zaloRoutes.post('/send-new', async (c) => {
  const v = await viewer(c);
  const b = (await c.req.json().catch(() => ({}))) as { nick_id?: string; phone?: string; text?: string; customer_id?: string; cskh_phone?: string };
  const nick = await nickFor(c, v, str(b.nick_id, 64));
  const phone = zaloPhone(b.phone);
  if (!phone) throw badRequest('NO_PHONE', 'Số điện thoại khách không đúng');
  const cus = str(b.customer_id, 64) || null;
  const cs = zaloPhone(b.cskh_phone) || null;
  await checkLinkAllowed(c, v, cus, cs);
  const id = await queueSend(c, v, nick, String(b.text ?? ''), { to_phone: phone, customer_id: cus, cskh_phone: cs });
  return ok(c, { id });
});

/** Tình trạng lệnh gửi (web hỏi lại để báo đã gửi / lỗi). */
zaloRoutes.get('/cmds/:id', async (c) => {
  const v = await viewer(c);
  const r = await c.env.DB.prepare('SELECT id, nick_id, kind, status, error, conv_id, created_by FROM zalo_cmds WHERE id = ?').bind(c.req.param('id')).first<{ nick_id: string; created_by: string }>();
  if (!r) throw notFound();
  if (!v.lead && r.created_by !== v.id) throw forbidden();
  return ok(c, r);
});

async function checkLinkAllowed(c: C, v: Viewer, customerId: string | null, cskhPhone: string | null) {
  if (customerId) {
    const cu = await c.env.DB.prepare('SELECT owner_id FROM customers WHERE id = ? AND deleted_at IS NULL').bind(customerId).first<{ owner_id: string | null }>();
    if (!cu) throw badRequest('NO_CUSTOMER', 'Không có khách này');
    if (!v.lead && cu.owner_id !== v.id) throw forbidden('Khách này không phải của bạn');
  }
  if (cskhPhone) {
    const cs = await c.env.DB.prepare('SELECT owner_id FROM cskh_customers WHERE phone = ?').bind(cskhPhone).first<{ owner_id: string | null }>();
    if (!cs) throw badRequest('NO_CUSTOMER', 'Không có khách lẻ này');
    if (!v.lead && cs.owner_id !== v.id) throw forbidden('Khách lẻ này không phải của bạn');
  }
}

/** Gắn / bỏ gắn hội thoại với khách kênh phân phối hoặc khách lẻ CSKH. */
zaloRoutes.post('/convs/:id/link', async (c) => {
  const v = await viewer(c);
  const z = await convFor(c, v, c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { customer_id?: string | null; cskh_phone?: string | null };
  const cus = b.customer_id === undefined ? z.customer_id : str(b.customer_id, 64) || null;
  const cs = b.cskh_phone === undefined ? z.cskh_phone : zaloPhone(b.cskh_phone) || null;
  await checkLinkAllowed(c, v, b.customer_id ? cus : null, b.cskh_phone ? cs : null);
  await c.env.DB.prepare('UPDATE zalo_convs SET customer_id = ?, cskh_phone = ?, link_by = ?, updated_at = ? WHERE id = ?').bind(cus, cs, v.name, nowIso(), z.id).run();
  return ok(c, { ok: true });
});

/** Tìm khách để gắn (tên hoặc số). Sale chỉ thấy khách của mình. */
zaloRoutes.get('/find-customer', async (c) => {
  const v = await viewer(c);
  const q = str(c.req.query('q'), 60);
  if (q.length < 2) return ok(c, { customers: [], cskh: [] });
  const like = `%${q}%`;
  const own = v.lead ? '' : 'AND owner_id = ?';
  const p = v.lead ? [] : [v.id];
  const customers =
    (await c.env.DB.prepare(`SELECT id, name, phone_text, province FROM customers WHERE deleted_at IS NULL AND (name LIKE ? OR phone_normalized LIKE ?) ${own} ORDER BY name LIMIT 10`).bind(like, like, ...p).all())
      .results ?? [];
  const cskh = (await c.env.DB.prepare(`SELECT phone, name FROM cskh_customers WHERE (name LIKE ? OR phone LIKE ?) ${own} ORDER BY name LIMIT 10`).bind(like, like, ...p).all()).results ?? [];
  return ok(c, { customers, cskh });
});

/* ---------------- Zalo của một khách (cột Zalo, khung Tin Zalo, Lịch sử chăm sóc) */
type StatusRow = { key: string; wait_since: string | null; unread: number; last_at: string | null; last_from_me: number; nick_name: string };
async function statusBy(c: C, col: 'customer_id' | 'cskh_phone') {
  const v = await viewer(c);
  const sc = nickScope(v);
  const rows =
    (
      await c.env.DB.prepare(
        `SELECT z.${col} AS key, MIN(z.waiting_since) AS wait_since, SUM(z.unread) AS unread, MAX(z.last_at) AS last_at,
                MAX(CASE WHEN z.last_at = (SELECT MAX(z2.last_at) FROM zalo_convs z2 WHERE z2.${col} = z.${col}) THEN z.last_from_me END) AS last_from_me,
                GROUP_CONCAT(DISTINCT n.name) AS nick_name
         FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id WHERE z.${col} IS NOT NULL AND z.is_group = 0 AND ${sc.sql} GROUP BY z.${col}`,
      )
        .bind(...sc.params)
        .all<StatusRow>()
    ).results ?? [];
  return ok(c, { now: nowIso(), rows });
}
zaloRoutes.get('/status/customers', (c) => statusBy(c, 'customer_id'));
zaloRoutes.get('/status/cskh', (c) => statusBy(c, 'cskh_phone'));

/** Mọi hội thoại 1-1 của một khách trên các nick người xem thấy: tin gộp theo thời gian + tóm tắt từng ngày. */
zaloRoutes.get('/thread', async (c) => {
  const v = await viewer(c);
  const sc = nickScope(v);
  const cus = str(c.req.query('customer_id'), 64);
  const cs = zaloPhone(c.req.query('cskh_phone'));
  if (!cus && !cs) throw badRequest('NO_CUSTOMER', 'Thiếu khách');
  const convs =
    (
      await c.env.DB.prepare(
        `SELECT z.id, z.nick_id, n.name AS nick_name, n.status AS nick_status, n.owner_id, z.name, z.peer_phone, z.unread, z.waiting_since, z.last_at
         FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id WHERE z.is_group = 0 AND ${cus ? 'z.customer_id = ?' : 'z.cskh_phone = ?'} AND ${sc.sql} ORDER BY z.last_at DESC`,
      )
        .bind(cus || cs, ...sc.params)
        .all<{ id: string; nick_name: string; owner_id: string | null }>()
    ).results ?? [];
  const ids = convs.map((x) => x.id);
  let msgs: Array<ZaloMsgRow & { recalled: boolean; nick_name?: string; conv_id?: string }> = [];
  const days: ZaloDay[] = [];
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    msgs = (
      (await c.env.DB.prepare(`SELECT ${MSG_COLS} FROM zalo_msgs m LEFT JOIN users u ON u.id = m.sent_by WHERE m.conv_id IN (${ph}) ORDER BY m.at DESC LIMIT 60`).bind(...ids).all<ZaloMsgRow & { conv_id: string }>())
        .results ?? []
    )
      .reverse()
      .map((m) => ({ ...msgForViewer(m, v.lead), nick_name: convs.find((x) => x.id === m.conv_id)?.nick_name }));
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const all =
      (
        await c.env.DB.prepare(`SELECT conv_id, from_me, kind, text, at, recalled_at FROM zalo_msgs WHERE conv_id IN (${ph}) AND at >= ? ORDER BY at`)
          .bind(...ids, since)
          .all<{ conv_id: string; from_me: number; kind: string; text: string; at: string; recalled_at: string | null }>()
      ).results ?? [];
    const map = new Map<string, ZaloDay>();
    for (const m of all) {
      const day = vnDate(m.at);
      const k = day + '|' + m.conv_id;
      let d = map.get(k);
      if (!d) {
        d = { day, nick: convs.find((x) => x.id === m.conv_id)?.nick_name ?? '', conv_id: m.conv_id, in: 0, out: 0, last_in: '', last_out: '', last_at: m.at };
        map.set(k, d);
      }
      const txt = m.recalled_at && !v.lead ? '' : msgPreview(m.kind, m.text);
      if (m.from_me) {
        d.out++;
        if (txt) d.last_out = txt;
      } else {
        d.in++;
        if (txt) d.last_in = txt;
      }
      d.last_at = m.at;
    }
    days.push(...[...map.values()].sort((a, b) => (a.last_at < b.last_at ? 1 : -1)));
  }
  const sc2 = nickScope(v);
  const myNicks =
    (await c.env.DB.prepare(`SELECT n.id, n.name, n.status FROM zalo_nicks n WHERE ${sc2.sql} AND n.disabled = 0 ORDER BY n.name`).bind(...sc2.params).all()).results ?? [];
  return ok(c, { convs, msgs, days, nicks: myNicks, lead: v.lead });
});

/* ---------------- tin mẫu "/" */
zaloRoutes.get('/templates', async (c) => {
  await viewer(c);
  const r = (await c.env.DB.prepare('SELECT code, text FROM zalo_templates ORDER BY code').all()).results ?? [];
  return ok(c, r);
});
zaloRoutes.put('/templates', async (c) => {
  const v = await viewer(c);
  if (!v.lead) throw forbidden('Chỉ Lead / CEO sửa tin mẫu');
  const b = (await c.req.json().catch(() => ({}))) as { items?: Array<{ code?: string; text?: string }> };
  const items = (b.items ?? [])
    .map((x) => ({ code: str(x.code, 30).replace(/^\//, '').toLowerCase().replace(/[^a-z0-9-]/g, '-'), text: str(x.text, ZALO_TEXT_MAX) }))
    .filter((x) => x.code && x.text)
    .slice(0, 60);
  const now = nowIso();
  const st = [c.env.DB.prepare('DELETE FROM zalo_templates')];
  const seen = new Set<string>();
  for (const x of items) {
    if (seen.has(x.code)) continue;
    seen.add(x.code);
    st.push(c.env.DB.prepare('INSERT INTO zalo_templates (id, code, text, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)').bind(newId(), x.code, x.text, v.id, now));
  }
  await c.env.DB.batch(st);
  return ok(c, { n: seen.size });
});

/* ================================================================== VPS */
export const zaloNickRelayRoutes = new Hono<AppEnv>();
zaloNickRelayRoutes.use('*', relayAuth);

/** Chương trình VPS hỏi mỗi vài giây: nick nào cần chạy, lệnh nào cần làm. */
zaloNickRelayRoutes.get('/poll', async (c) => {
  const db = c.env.DB;
  const now = nowIso();
  // Lệnh đã nhận mà 5 phút chưa báo xong: coi là hỏng, không gửi lại (tránh gửi trùng cho khách).
  const stale = new Date(Date.now() - 5 * 60_000).toISOString();
  await db.prepare("UPDATE zalo_cmds SET status = 'FAILED', error = 'Máy Zalo không trả lời', done_at = ? WHERE status = 'TAKEN' AND taken_at < ?").bind(now, stale).run();
  // Lệnh gửi chờ quá 10 phút (máy VPS tắt): bỏ, người gửi thấy lỗi và tự gửi lại.
  const old = new Date(Date.now() - 10 * 60_000).toISOString();
  await db.prepare("UPDATE zalo_cmds SET status = 'FAILED', error = 'Máy Zalo chưa chạy, tin chưa gửi', done_at = ? WHERE status = 'PENDING' AND created_at < ?").bind(now, old).run();
  const cmds =
    (await db.prepare("SELECT id, nick_id, kind, thread_id, is_group, to_phone, text, payload FROM zalo_cmds WHERE status = 'PENDING' ORDER BY created_at LIMIT 20").all<{ id: string }>()).results ?? [];
  if (cmds.length) {
    await db.batch(cmds.map((x) => db.prepare("UPDATE zalo_cmds SET status = 'TAKEN', taken_at = ? WHERE id = ? AND status = 'PENDING'").bind(now, x.id)));
  }
  const nicks = (await db.prepare('SELECT id, name, disabled, status FROM zalo_nicks').all()).results ?? [];
  await db.prepare("INSERT INTO app_kv (k, v, updated_at) VALUES ('zalo_nick_seen', ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at").bind(now, now).run();
  return ok(c, { nicks, cmds });
});

const STATUSES = ['QR', 'SCANNED', 'ON', 'OFF', 'NEED_QR', 'STOPPED'];
zaloNickRelayRoutes.post('/state', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { nick_id?: string; status?: string; note?: string; qr_image?: string; zalo_uid?: string; zalo_name?: string };
  const id = str(b.nick_id, 64);
  const st = str(b.status, 16);
  if (!id || !STATUSES.includes(st)) throw badRequest('BAD_STATE', 'Sai trạng thái');
  const now = nowIso();
  const qr = st === 'QR' && typeof b.qr_image === 'string' && b.qr_image.length < 200_000 && /^[A-Za-z0-9+/=]+$/.test(b.qr_image.replace(/^data:image\/png;base64,/, '')) ? b.qr_image.replace(/^data:image\/png;base64,/, '') : null;
  await c.env.DB.prepare(
    `UPDATE zalo_nicks SET status = ?, status_note = ?, qr_image = ?, qr_at = CASE WHEN ? IS NOT NULL THEN ? ELSE qr_at END,
       zalo_uid = COALESCE(?, zalo_uid), zalo_name = COALESCE(?, zalo_name), seen_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(st, str(b.note, 300), qr, qr, now, str(b.zalo_uid, 64) || null, str(b.zalo_name, 120) || null, now, now, id)
    .run();
  if (st === 'ON' || st === 'NEED_QR') {
    await c.env.DB.prepare("UPDATE zalo_cmds SET status = 'DONE', done_at = ? WHERE nick_id = ? AND kind = 'LOGIN_QR' AND status IN ('PENDING','TAKEN')").bind(now, id).run();
  }
  return ok(c, { ok: true });
});

interface RelayEvent {
  type?: string;
  thread_id?: string;
  is_group?: boolean;
  thread_name?: string;
  avatar?: string;
  peer_phone?: string;
  msg_id?: string;
  cli_msg_id?: string;
  msg_ids?: string[];
  from_me?: boolean;
  sender_uid?: string;
  sender_name?: string;
  kind?: string;
  text?: string;
  url?: string;
  at?: number | string;
  /** Tin cũ kéo về: không tính chưa đọc / đang chờ. */
  old?: boolean;
  quote_text?: string;
  quote_name?: string;
  raw?: string;
  /** react: mã tin được thả, người thả, biểu tượng */
  icon?: string;
  uid?: string;
  name?: string;
  avatar_url?: string;
  phone?: string;
  /** friends / groups: danh sách */
  list?: Array<{ uid?: string; id?: string; name?: string; avatar?: string; phone?: string }>;
}
const KINDS = ['text', 'image', 'file', 'sticker', 'voice', 'video', 'link', 'other'];
const atIso = (v: unknown) => {
  const n = typeof v === 'number' ? v : /^\d+$/.test(String(v ?? '')) ? Number(v) : Date.parse(String(v ?? ''));
  return Number.isFinite(n) && n > 1e12 ? new Date(n).toISOString() : nowIso();
};

/** Tìm khách theo số Zalo: khách kênh phân phối (số chính hoặc số Zalo trong hồ sơ) và khách lẻ CSKH. Ưu tiên khách của người phụ trách nick. */
export async function matchByPhone(db: D1Database, phone: string, ownerId: string | null): Promise<{ customer_id: string | null; cskh_phone: string | null }> {
  if (!phone) return { customer_id: null, cskh_phone: null };
  const cus =
    (
      await db
        .prepare(
          `SELECT id, owner_id FROM customers WHERE deleted_at IS NULL AND (phone_normalized = ? OR REPLACE(REPLACE(REPLACE(COALESCE(zalo, ''), ' ', ''), '.', ''), '-', '') = ?)
           ORDER BY CASE WHEN owner_id = ? THEN 0 ELSE 1 END LIMIT 1`,
        )
        .bind(phone, phone, ownerId)
        .all<{ id: string }>()
    ).results ?? [];
  const cs = await db.prepare('SELECT phone FROM cskh_customers WHERE phone = ?').bind(phone).first<{ phone: string }>();
  return { customer_id: cus[0]?.id ?? null, cskh_phone: cs?.phone ?? null };
}

async function upsertConv(db: D1Database, nickId: string, ownerId: string | null, e: RelayEvent): Promise<string> {
  const threadId = str(e.thread_id, 64);
  const now = nowIso();
  const name = str(e.thread_name, 200);
  const phone = zaloPhone(e.peer_phone);
  const ex = await db.prepare('SELECT id, customer_id, cskh_phone, link_by FROM zalo_convs WHERE nick_id = ? AND thread_id = ?').bind(nickId, threadId).first<{ id: string; customer_id: string | null; cskh_phone: string | null; link_by: string }>();
  if (ex) {
    await db
      .prepare("UPDATE zalo_convs SET name = CASE WHEN ? <> '' THEN ? ELSE name END, avatar = CASE WHEN ? <> '' THEN ? ELSE avatar END, peer_phone = CASE WHEN ? <> '' THEN ? ELSE peer_phone END, updated_at = ? WHERE id = ?")
      .bind(name, name, str(e.avatar, 500), str(e.avatar, 500), phone, phone, now, ex.id)
      .run();
    if (!e.is_group && phone && !ex.customer_id && !ex.cskh_phone && !ex.link_by) {
      const m = await matchByPhone(db, phone, ownerId);
      if (m.customer_id || m.cskh_phone) await db.prepare("UPDATE zalo_convs SET customer_id = ?, cskh_phone = ?, link_by = 'AUTO' WHERE id = ?").bind(m.customer_id, m.cskh_phone, ex.id).run();
    }
    return ex.id;
  }
  const m = e.is_group ? { customer_id: null, cskh_phone: null } : await matchByPhone(db, phone, ownerId);
  const id = newId();
  await db
    .prepare(
      `INSERT INTO zalo_convs (id, nick_id, thread_id, is_group, name, avatar, peer_phone, customer_id, cskh_phone, link_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(nick_id, thread_id) DO NOTHING`,
    )
    .bind(id, nickId, threadId, e.is_group ? 1 : 0, name, str(e.avatar, 500), phone, m.customer_id, m.cskh_phone, m.customer_id || m.cskh_phone ? 'AUTO' : '', now, now)
    .run();
  const r = await db.prepare('SELECT id FROM zalo_convs WHERE nick_id = ? AND thread_id = ?').bind(nickId, threadId).first<{ id: string }>();
  return r!.id;
}

/** Ghi một tin vào hội thoại; tin mới thì cập nhật tin cuối, số chưa đọc, "đang chờ trả lời". Trả về false nếu tin đã có. */
interface NewMsg {
  msg_id: string;
  cli_msg_id: string;
  from_me: boolean;
  sender_uid: string;
  sender_name: string;
  kind: string;
  text: string;
  url: string;
  at: string;
  sent_by: string | null;
  quote_text?: string;
  quote_name?: string;
  raw?: string;
  old?: boolean;
}
async function addMsg(db: D1Database, convId: string, nickId: string, m: NewMsg): Promise<boolean> {
  const r = await db
    .prepare(
      `INSERT INTO zalo_msgs (id, conv_id, nick_id, msg_id, cli_msg_id, from_me, sender_uid, sender_name, kind, text, url, at, sent_by, quote_text, quote_name, raw, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(nick_id, msg_id) DO NOTHING`,
    )
    .bind(newId(), convId, nickId, m.msg_id, m.cli_msg_id, m.from_me ? 1 : 0, m.sender_uid, m.sender_name, m.kind, m.text, m.url, m.at, m.sent_by, m.quote_text ?? '', m.quote_name ?? '', m.raw ?? '', nowIso())
    .run();
  if (!r.meta.changes) {
    if (m.sent_by) await db.prepare('UPDATE zalo_msgs SET sent_by = ? WHERE nick_id = ? AND msg_id = ? AND sent_by IS NULL').bind(m.sent_by, nickId, m.msg_id).run();
    // Zalo dội lại tin mình vừa gửi từ web: bổ sung mã phụ + dữ liệu gốc để sau này thu hồi / trích dẫn được.
    if (m.cli_msg_id || m.raw) await db.prepare("UPDATE zalo_msgs SET cli_msg_id = CASE WHEN cli_msg_id = '' THEN ? ELSE cli_msg_id END, raw = CASE WHEN raw = '' THEN ? ELSE raw END, url = CASE WHEN url = '' THEN ? ELSE url END WHERE nick_id = ? AND msg_id = ?").bind(m.cli_msg_id, m.raw ?? '', m.url, nickId, m.msg_id).run();
    return false;
  }
  const prev = msgPreview(m.kind, m.text);
  if (m.old) {
    // Tin cũ: chỉ đổi "tin cuối" nếu mới hơn, không tính chưa đọc / đang chờ.
    await db.prepare('UPDATE zalo_convs SET last_text = CASE WHEN last_at IS NULL OR last_at < ? THEN ? ELSE last_text END, last_from_me = CASE WHEN last_at IS NULL OR last_at < ? THEN ? ELSE last_from_me END, last_at = MAX(COALESCE(last_at, ?), ?) WHERE id = ?')
      .bind(m.at, prev, m.at, m.from_me ? 1 : 0, m.at, m.at, convId)
      .run();
    return true;
  }
  if (m.from_me) {
    // Mình đã trả lời (trên web hoặc trên điện thoại): hết "đang chờ".
    await db.prepare('UPDATE zalo_convs SET last_at = MAX(COALESCE(last_at, ?), ?), last_text = ?, last_from_me = 1, waiting_since = NULL, unread = 0, updated_at = ? WHERE id = ?').bind(m.at, m.at, prev, nowIso(), convId).run();
  } else {
    await db
      .prepare('UPDATE zalo_convs SET last_at = MAX(COALESCE(last_at, ?), ?), last_text = ?, last_from_me = 0, unread = unread + 1, waiting_since = COALESCE(waiting_since, ?), updated_at = ? WHERE id = ?')
      .bind(m.at, m.at, prev, m.at, nowIso(), convId)
      .run();
  }
  return true;
}

/** Tin đến / đi, thu hồi, đã xem từ một nick (tối đa 50 sự kiện mỗi lần). */
zaloNickRelayRoutes.post('/events', async (c) => {
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as { nick_id?: string; events?: RelayEvent[] };
  const nick = await db.prepare('SELECT id, owner_id FROM zalo_nicks WHERE id = ?').bind(str(b.nick_id, 64)).first<{ id: string; owner_id: string | null }>();
  if (!nick) throw notFound('Không có nick này');
  let added = 0;
  for (const e of (b.events ?? []).slice(0, 50)) {
    const threadId = str(e.thread_id, 64);
    if (!threadId) continue;
    if (e.type === 'msg') {
      const msgId = str(e.msg_id, 80);
      if (!msgId) continue;
      const convId = await upsertConv(db, nick.id, nick.owner_id, e);
      const kind = KINDS.includes(String(e.kind)) ? String(e.kind) : 'other';
      const url = /^https:\/\//.test(String(e.url ?? '')) ? str(e.url, 1000) : '';
      const raw = typeof e.raw === 'string' && e.raw.length <= 4000 ? e.raw : '';
      if (
        await addMsg(db, convId, nick.id, {
          msg_id: msgId,
          cli_msg_id: str(e.cli_msg_id, 80),
          from_me: !!e.from_me,
          sender_uid: str(e.sender_uid, 64),
          sender_name: str(e.sender_name, 120),
          kind,
          text: str(e.text, 6000),
          url,
          at: atIso(e.at),
          sent_by: null,
          quote_text: str(e.quote_text, 300),
          quote_name: str(e.quote_name, 120),
          raw,
          old: !!e.old,
        })
      )
        added++;
      if (!e.from_me && !e.is_group) {
        await db.prepare('UPDATE zalo_convs SET typing_at = NULL WHERE id = ?').bind(convId).run();
        // Khách kênh phân phối nhắn tới: nhờ agent CSKH B2B soạn nháp (chỉ khách đã gắn, chỉ tin mới).
        if (!e.old && (await agentAllowed(db, nick.id, String(e.text ?? '')))) await queueAgent(db, convId);
      }
    } else if (e.type === 'undo') {
      // Thu hồi: giữ nguyên nội dung, chỉ đánh dấu (Lead / CEO vẫn đọc được).
      const ids = [str(e.msg_id, 80), str(e.cli_msg_id, 80)].filter(Boolean);
      if (!ids.length) continue;
      await db
        .prepare(`UPDATE zalo_msgs SET recalled_at = COALESCE(recalled_at, ?) WHERE nick_id = ? AND (msg_id IN (${ids.map(() => '?').join(',')}) OR cli_msg_id IN (${ids.map(() => '?').join(',')}))`)
        .bind(atIso(e.at), nick.id, ...ids, ...ids)
        .run();
    } else if (e.type === 'seen') {
      const ids = (e.msg_ids ?? []).map((x) => str(x, 80)).filter(Boolean).slice(0, 50);
      if (!ids.length) continue;
      await db.prepare(`UPDATE zalo_msgs SET seen_at = COALESCE(seen_at, ?) WHERE nick_id = ? AND from_me = 1 AND msg_id IN (${ids.map(() => '?').join(',')})`).bind(nowIso(), nick.id, ...ids).run();
    } else if (e.type === 'react') {
      // Cảm xúc: icon rỗng = gỡ.
      const row = await db.prepare('SELECT id FROM zalo_msgs WHERE nick_id = ? AND (msg_id = ? OR cli_msg_id = ?)').bind(nick.id, str(e.msg_id, 80), str(e.msg_id, 80)).first<{ id: string }>();
      const uid = str(e.uid, 64);
      if (!row || !uid) continue;
      if (!e.icon) await db.prepare('DELETE FROM zalo_reactions WHERE msg_row_id = ? AND who_uid = ?').bind(row.id, uid).run();
      else
        await db
          .prepare('INSERT INTO zalo_reactions (msg_row_id, who_uid, who_name, icon, from_me, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(msg_row_id, who_uid) DO UPDATE SET icon = excluded.icon, who_name = excluded.who_name, at = excluded.at')
          .bind(row.id, uid, str(e.name, 120), str(e.icon, 20), e.from_me ? 1 : 0, atIso(e.at))
          .run();
    } else if (e.type === 'typing') {
      await db.prepare('UPDATE zalo_convs SET typing_at = ? WHERE nick_id = ? AND thread_id = ?').bind(nowIso(), nick.id, threadId).run();
    } else if (e.type === 'friends') {
      // Danh bạ: thread_id = "friends". Ghi bạn bè, điền số Zalo cho hội thoại, đánh dấu đã là bạn.
      const now = nowIso();
      const st: D1PreparedStatement[] = [];
      for (const f of (e.list ?? []).slice(0, 300)) {
        const uid = str(f.uid, 64);
        if (!uid) continue;
        const ph = zaloPhone(f.phone);
        st.push(
          db
            .prepare('INSERT INTO zalo_friends (nick_id, uid, name, avatar, phone, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(nick_id, uid) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, phone = excluded.phone, updated_at = excluded.updated_at')
            .bind(nick.id, uid, str(f.name, 120), str(f.avatar, 500), ph, now),
          db.prepare("UPDATE zalo_convs SET is_friend = 1, peer_phone = CASE WHEN peer_phone = '' THEN ? ELSE peer_phone END WHERE nick_id = ? AND thread_id = ?").bind(ph, nick.id, uid),
        );
      }
      for (let i = 0; i < st.length; i += 80) await db.batch(st.slice(i, i + 80));
    } else if (e.type === 'groups') {
      // Nhóm Zalo của nick: tạo hội thoại nhóm (chưa có tin) để thấy trong Hộp tin.
      for (const g of (e.list ?? []).slice(0, 300)) {
        const gid = str(g.id, 64);
        if (gid) await upsertConv(db, nick.id, nick.owner_id, { thread_id: gid, thread_name: str(g.name, 200), avatar: str(g.avatar, 500), is_group: true });
      }
    } else if (e.type === 'fr_req') {
      await db
        .prepare("INSERT INTO zalo_friend_reqs (nick_id, uid, name, avatar, msg, at, status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING') ON CONFLICT(nick_id, uid) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, msg = excluded.msg, at = excluded.at, status = 'PENDING'")
        .bind(nick.id, threadId, str(e.name, 120), str(e.avatar_url, 500), str(e.text, 300), atIso(e.at))
        .run();
    } else if (e.type === 'fr_ok') {
      await db.prepare("UPDATE zalo_friend_reqs SET status = 'ACCEPTED' WHERE nick_id = ? AND uid = ?").bind(nick.id, threadId).run();
      await db.prepare('UPDATE zalo_convs SET is_friend = 1 WHERE nick_id = ? AND thread_id = ?').bind(nick.id, threadId).run();
    }
  }
  await db.prepare('UPDATE zalo_nicks SET seen_at = ? WHERE id = ?').bind(nowIso(), nick.id).run();
  return ok(c, { added });
});

/** Máy VPS báo lệnh đã làm xong. Gửi tin xong thì ghi tin vào hội thoại ngay (không chờ Zalo dội lại). */
zaloNickRelayRoutes.post('/cmd/:id/done', async (c) => {
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as { ok?: boolean; error?: string; msg_id?: string; cli_msg_id?: string; thread_id?: string; thread_name?: string; peer_phone?: string; text?: string };
  const cmd = await db
    .prepare('SELECT id, nick_id, kind, conv_id, thread_id, to_phone, customer_id, cskh_phone, text, payload, created_by, status FROM zalo_cmds WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ id: string; nick_id: string; kind: string; conv_id: string | null; thread_id: string | null; to_phone: string | null; customer_id: string | null; cskh_phone: string | null; text: string | null; payload: string; created_by: string | null; status: string }>();
  if (!cmd) throw notFound();
  if (cmd.status === 'DONE') return ok(c, { ok: true });
  const now = nowIso();
  let pl: { file?: { id: string; name: string }; sticker?: { url: string }; url?: { href: string; kind: string; name: string }; quote?: { text: string; name: string }; msg_id?: string; cli_msg_id?: string; icon?: string; row?: string } = {};
  try {
    pl = cmd.payload ? JSON.parse(cmd.payload) : {};
  } catch {
    /* bỏ */
  }
  if (pl.file) await db.prepare('UPDATE zalo_files SET data = NULL, sent_at = ? WHERE id = ?').bind(now, pl.file.id).run();
  if (!b.ok) {
    await db.prepare("UPDATE zalo_cmds SET status = 'FAILED', error = ?, done_at = ? WHERE id = ?").bind(str(b.error, 300) || 'Lỗi', now, cmd.id).run();
    return ok(c, { ok: true });
  }
  if (cmd.kind === 'AGENT') {
    // Agent CSKH B2B trả nháp: lưu cạnh nháp AI, theo tin khách mới nhất lúc dựng lời nhờ.
    const lastId = String((pl as { last_msg_id?: string }).last_msg_id ?? '');
    const r = parseAgent(String(b.text ?? ''));
    if (cmd.conv_id && lastId && r.reply) {
      await db
        .prepare("INSERT INTO zalo_ai (conv_id, msg_id, text, note, source, order_json, created_at) VALUES (?, ?, ?, '', 'agent', ?, ?) ON CONFLICT(conv_id) DO UPDATE SET msg_id = excluded.msg_id, text = excluded.text, note = '', source = 'agent', order_json = excluded.order_json, created_at = excluded.created_at")
        // Chị Hoa 27/11: tắt đơn nháp do agent gợi ý (không phải khách nói gì cũng là lên đơn); chỉ giữ câu trả lời.
        .bind(cmd.conv_id, lastId, r.reply, '', now)
        .run();
    }
    await db.prepare("UPDATE zalo_cmds SET status = 'DONE', done_at = ? WHERE id = ?").bind(now, cmd.id).run();
    if (cmd.conv_id && r.reply) await db.prepare("INSERT INTO zalo_ai_log (conv_id, source, action, at) VALUES (?, 'agent', 'draft', ?)").bind(cmd.conv_id, now).run();
    // Trong lúc agent soạn, khách nhắn thêm: nhờ soạn lại theo tin mới.
    if (cmd.conv_id) {
      const newer = await db.prepare('SELECT msg_id FROM zalo_msgs WHERE conv_id = ? AND from_me = 0 ORDER BY at DESC LIMIT 1').bind(cmd.conv_id).first<{ msg_id: string }>();
      if (newer && lastId && newer.msg_id !== lastId) await queueAgent(db, cmd.conv_id);
    }
    return ok(c, { ok: true });
  }
  if (cmd.kind === 'UNDO' && pl.msg_id) await db.prepare('UPDATE zalo_msgs SET recalled_at = COALESCE(recalled_at, ?) WHERE nick_id = ? AND msg_id = ?').bind(now, cmd.nick_id, pl.msg_id).run();
  if (cmd.kind === 'REACT' && pl.row && pl.icon) {
    await db
      .prepare("INSERT INTO zalo_reactions (msg_row_id, who_uid, who_name, icon, from_me, at) VALUES (?, 'me', 'Mình', ?, 1, ?) ON CONFLICT(msg_row_id, who_uid) DO UPDATE SET icon = excluded.icon, at = excluded.at")
      .bind(pl.row, pl.icon, now)
      .run();
  }
  if (cmd.kind === 'FRIEND_ACCEPT' || cmd.kind === 'FRIEND_REJECT') {
    await db.prepare('UPDATE zalo_friend_reqs SET status = ? WHERE nick_id = ? AND uid = ?').bind(cmd.kind === 'FRIEND_ACCEPT' ? 'ACCEPTED' : 'REJECTED', cmd.nick_id, cmd.thread_id ?? '').run();
    if (cmd.kind === 'FRIEND_ACCEPT') await db.prepare('UPDATE zalo_convs SET is_friend = 1 WHERE nick_id = ? AND thread_id = ?').bind(cmd.nick_id, cmd.thread_id ?? '').run();
  }
  let convId = cmd.conv_id;
  if (cmd.kind === 'SEND') {
    if (!convId && b.thread_id) {
      const nick = await db.prepare('SELECT owner_id FROM zalo_nicks WHERE id = ?').bind(cmd.nick_id).first<{ owner_id: string | null }>();
      convId = await upsertConv(db, cmd.nick_id, nick?.owner_id ?? null, { thread_id: b.thread_id, thread_name: b.thread_name, peer_phone: b.peer_phone || cmd.to_phone || '', is_group: false });
      if (cmd.customer_id || cmd.cskh_phone) {
        await db.prepare("UPDATE zalo_convs SET customer_id = COALESCE(?, customer_id), cskh_phone = COALESCE(?, cskh_phone), link_by = 'Nhắn từ hồ sơ khách' WHERE id = ?").bind(cmd.customer_id, cmd.cskh_phone, convId).run();
      }
    }
    if (convId) {
      const kind = pl.sticker ? 'sticker' : pl.file ? (/^image\//.test((pl.file as { mime?: string }).mime ?? '') ? 'image' : 'file') : pl.url ? pl.url.kind : 'text';
      const text = pl.file && !cmd.text ? pl.file.name : cmd.text ?? '';
      await addMsg(db, convId, cmd.nick_id, {
        msg_id: str(b.msg_id, 80) || 'web:' + cmd.id,
        cli_msg_id: str(b.cli_msg_id, 80),
        from_me: true,
        sender_uid: '',
        sender_name: '',
        kind,
        text,
        url: pl.sticker?.url ?? pl.url?.href ?? '',
        at: now,
        sent_by: cmd.created_by,
        quote_text: pl.quote?.text ?? '',
        quote_name: pl.quote?.name ?? '',
      });
    }
  }
  await db.prepare("UPDATE zalo_cmds SET status = 'DONE', msg_id = ?, conv_id = COALESCE(conv_id, ?), done_at = ? WHERE id = ?").bind(str(b.msg_id, 80) || null, convId, now, cmd.id).run();
  return ok(c, { ok: true, conv_id: convId });
});

/** Máy Zalo lấy lời nhờ agent CSKH B2B cho lệnh AGENT (dựng lúc lấy để có tin mới nhất). */
zaloNickRelayRoutes.get('/agent-ctx/:id', async (c) => {
  const db = c.env.DB;
  const cmd = await db.prepare("SELECT id, conv_id FROM zalo_cmds WHERE id = ? AND kind = 'AGENT'").bind(c.req.param('id')).first<{ id: string; conv_id: string | null }>();
  if (!cmd?.conv_id) throw notFound();
  const p = await agentPrompt(db, cmd.conv_id);
  if (!p) throw badRequest('NO_CONTEXT', 'Hội thoại chưa gắn khách kênh phân phối hoặc chưa có tin khách');
  await db.prepare('UPDATE zalo_cmds SET payload = ? WHERE id = ?').bind(JSON.stringify({ last_msg_id: p.last_msg_id }), cmd.id).run();
  return ok(c, { agent: 'cskh-b2b-ailla', session: p.session, prompt: p.prompt });
});

/** Máy Zalo lấy nội dung tệp sale đã tải lên để gửi. */
zaloNickRelayRoutes.get('/file/:id', async (c) => {
  const f = await c.env.DB.prepare('SELECT name, mime, data FROM zalo_files WHERE id = ?').bind(c.req.param('id')).first<{ name: string; mime: string; data: ArrayBuffer | Uint8Array | number[] | null }>();
  if (!f || !f.data) throw notFound('Tệp đã gửi hoặc không còn');
  const bytes = f.data instanceof Uint8Array ? f.data : Array.isArray(f.data) ? new Uint8Array(f.data) : new Uint8Array(f.data);
  return new Response(bytes as unknown as BodyInit, { headers: { 'Content-Type': f.mime, 'X-File-Name': encodeURIComponent(f.name) } });
});

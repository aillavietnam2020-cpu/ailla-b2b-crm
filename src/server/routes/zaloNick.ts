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
import { relayAuth } from './agentChat';

type C = Context<AppEnv>;
const str = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);

/* ------------------------------------------------------------------ ai đang xem */
interface Viewer {
  id: string;
  name: string;
  lead: boolean;
}
async function viewer(c: C): Promise<Viewer> {
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
const nickScope = (v: Viewer): { sql: string; params: unknown[] } => (v.lead ? { sql: '1=1', params: [] } : { sql: 'n.owner_id = ?', params: [v.id] });

interface NickRow {
  id: string;
  name: string;
  owner_id: string | null;
  status: string;
  disabled: number;
}
async function nickFor(c: C, v: Viewer, id: string): Promise<NickRow> {
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
async function convFor(c: C, v: Viewer, id: string): Promise<ConvRow> {
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
    (await db.prepare("SELECT created_at FROM zalo_cmds WHERE nick_id = ? AND kind = 'SEND' AND status <> 'FAILED' AND created_at >= ?").bind(nickId, since).all<{ created_at: string }>())
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
  if (q) {
    where.push('(z.name LIKE ? OR z.peer_phone LIKE ? OR cu.name LIKE ? OR cs.name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows =
    (
      await c.env.DB.prepare(
        `SELECT z.id, z.nick_id, n.name AS nick_name, z.is_group, z.name, z.avatar, z.peer_phone, z.customer_id, cu.name AS customer_name,
                z.cskh_phone, cs.name AS cskh_name, z.last_at, z.last_text, z.last_from_me, z.unread, z.waiting_since
         FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id
         LEFT JOIN customers cu ON cu.id = z.customer_id LEFT JOIN cskh_customers cs ON cs.phone = z.cskh_phone
         WHERE ${where.join(' AND ')} ORDER BY (z.waiting_since IS NULL), z.last_at DESC LIMIT 300`,
      )
        .bind(...params)
        .all()
    ).results ?? [];
  return ok(c, rows);
});

const MSG_COLS = `m.id, m.conv_id, m.from_me, m.sender_name, m.kind, m.text, m.url, m.at, m.recalled_at, m.seen_at, u.display_name AS sent_by_name`;

/** Một hội thoại: tin (mới nhất 100, kéo lên xem cũ hơn bằng ?before=), tin đang chờ gửi, thông tin khách cho khung bên phải. */
zaloRoutes.get('/convs/:id', async (c) => {
  const v = await viewer(c);
  const z = await convFor(c, v, c.req.param('id'));
  const before = c.req.query('before');
  const msgs = (
    (
      await c.env.DB.prepare(
        `SELECT ${MSG_COLS} FROM zalo_msgs m LEFT JOIN users u ON u.id = m.sent_by WHERE m.conv_id = ? ${before ? 'AND m.at < ?' : ''} ORDER BY m.at DESC LIMIT 100`,
      )
        .bind(...(before ? [z.id, before] : [z.id]))
        .all<ZaloMsgRow>()
    ).results ?? []
  )
    .reverse()
    .map((m) => msgForViewer(m, v.lead));
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const pending =
    (await c.env.DB.prepare("SELECT id, text, status, error, created_at FROM zalo_cmds WHERE conv_id = ? AND kind = 'SEND' AND status <> 'DONE' AND created_at >= ? ORDER BY created_at").bind(z.id, since).all())
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
  return ok(c, { conv, msgs, pending, customer, cskh, lead: v.lead, can_send: v.lead || z.owner_id === v.id });
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
) {
  if (nick.disabled || nick.status !== 'ON') throw badRequest('NICK_OFF', `Nick "${nick.name}" chưa nối Zalo. Vào Nick Zalo để quét QR.`);
  const t = String(text ?? '').trim();
  if (!t) throw badRequest('NO_TEXT', 'Chưa có nội dung');
  if (t.length > ZALO_TEXT_MAX) throw badRequest('TOO_LONG', `Tin dài quá (tối đa ${ZALO_TEXT_MAX} ký tự)`);
  await checkRate(c.env.DB, nick.id);
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO zalo_cmds (id, nick_id, kind, conv_id, thread_id, is_group, to_phone, customer_id, cskh_phone, text, status, created_by, created_at)
     VALUES (?, ?, 'SEND', ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
  )
    .bind(id, nick.id, target.conv_id ?? null, target.thread_id ?? null, target.is_group ?? 0, target.to_phone ?? null, target.customer_id ?? null, target.cskh_phone ?? null, t, v.id, nowIso())
    .run();
  return id;
}

/** Gửi tin trong hội thoại (người bấm Gửi). Chương trình VPS lấy về gửi trong vài giây. */
zaloRoutes.post('/convs/:id/send', async (c) => {
  const v = await viewer(c);
  const z = await convFor(c, v, c.req.param('id'));
  if (!v.lead && z.owner_id !== v.id) throw forbidden('Chỉ người phụ trách nick hoặc Lead được gửi');
  const nick = await nickFor(c, v, z.nick_id);
  const b = (await c.req.json().catch(() => ({}))) as { text?: string };
  const id = await queueSend(c, v, nick, String(b.text ?? ''), { conv_id: z.id, thread_id: z.thread_id, is_group: z.is_group });
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
    (await db.prepare("SELECT id, nick_id, kind, thread_id, is_group, to_phone, text FROM zalo_cmds WHERE status = 'PENDING' ORDER BY created_at LIMIT 20").all<{ id: string }>()).results ?? [];
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
async function addMsg(db: D1Database, convId: string, nickId: string, m: { msg_id: string; cli_msg_id: string; from_me: boolean; sender_uid: string; sender_name: string; kind: string; text: string; url: string; at: string; sent_by: string | null }): Promise<boolean> {
  const r = await db
    .prepare(
      `INSERT INTO zalo_msgs (id, conv_id, nick_id, msg_id, cli_msg_id, from_me, sender_uid, sender_name, kind, text, url, at, sent_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(nick_id, msg_id) DO NOTHING`,
    )
    .bind(newId(), convId, nickId, m.msg_id, m.cli_msg_id, m.from_me ? 1 : 0, m.sender_uid, m.sender_name, m.kind, m.text, m.url, m.at, m.sent_by, nowIso())
    .run();
  if (!r.meta.changes) {
    if (m.sent_by) await db.prepare('UPDATE zalo_msgs SET sent_by = ? WHERE nick_id = ? AND msg_id = ? AND sent_by IS NULL').bind(m.sent_by, nickId, m.msg_id).run();
    return false;
  }
  const prev = msgPreview(m.kind, m.text);
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
      if (await addMsg(db, convId, nick.id, { msg_id: msgId, cli_msg_id: str(e.cli_msg_id, 80), from_me: !!e.from_me, sender_uid: str(e.sender_uid, 64), sender_name: str(e.sender_name, 120), kind, text: str(e.text, 6000), url, at: atIso(e.at), sent_by: null })) added++;
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
    }
  }
  await db.prepare('UPDATE zalo_nicks SET seen_at = ? WHERE id = ?').bind(nowIso(), nick.id).run();
  return ok(c, { added });
});

/** Máy VPS báo lệnh đã làm xong. Gửi tin xong thì ghi tin vào hội thoại ngay (không chờ Zalo dội lại). */
zaloNickRelayRoutes.post('/cmd/:id/done', async (c) => {
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as { ok?: boolean; error?: string; msg_id?: string; thread_id?: string; thread_name?: string; peer_phone?: string };
  const cmd = await db
    .prepare('SELECT id, nick_id, kind, conv_id, to_phone, customer_id, cskh_phone, text, created_by, status FROM zalo_cmds WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ id: string; nick_id: string; kind: string; conv_id: string | null; to_phone: string | null; customer_id: string | null; cskh_phone: string | null; text: string; created_by: string | null; status: string }>();
  if (!cmd) throw notFound();
  if (cmd.status === 'DONE') return ok(c, { ok: true });
  const now = nowIso();
  if (!b.ok) {
    await db.prepare("UPDATE zalo_cmds SET status = 'FAILED', error = ?, done_at = ? WHERE id = ?").bind(str(b.error, 300) || 'Lỗi', now, cmd.id).run();
    return ok(c, { ok: true });
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
      await addMsg(db, convId, cmd.nick_id, { msg_id: str(b.msg_id, 80) || 'web:' + cmd.id, cli_msg_id: '', from_me: true, sender_uid: '', sender_name: '', kind: 'text', text: cmd.text, url: '', at: now, sent_by: cmd.created_by });
    }
  }
  await db.prepare("UPDATE zalo_cmds SET status = 'DONE', msg_id = ?, conv_id = COALESCE(conv_id, ?), done_at = ? WHERE id = ?").bind(str(b.msg_id, 80) || null, convId, now, cmd.id).run();
  return ok(c, { ok: true, conv_id: convId });
});

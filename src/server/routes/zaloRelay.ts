import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, ok } from '../lib/http';
import { newId } from '../lib/ids';
import { bellTo } from '../lib/hubBell';
import { relayAuth } from './agentChat';
import { runRead } from './orderIntake';

/**
 * Phương án 1: chương trình Zalo trên VPS (một số Zalo riêng của công ty, KHÔNG phải Zalo của CEO hay sale)
 * đẩy tin trong nhóm lên đây, và lấy về các tin cần gửi vào nhóm.
 *  - Nhóm chưa được Điều phối bật thì chỉ ghi tên nhóm, không đọc, không trả lời.
 *  - Nhóm đã bật: tin có ảnh hoặc có số thì máy đọc thử; có dòng hàng mới thành đơn chờ (chưa phải đơn),
 *    báo Sale phụ trách khách, và trả về một câu "đã nhận" cố định cho trợ lý gửi. Máy không tự trả lời gì khác.
 *  - Tin gửi vào nhóm chỉ có khi người dùng web bấm "Trợ lý gửi vào nhóm" ở đơn đã duyệt.
 * Xác thực bằng khoá cầu nối AGENT_RELAY_KEY (đã có trên VPS).
 */
export const zaloRelayRoutes = new Hono<AppEnv>();
zaloRelayRoutes.use('*', relayAuth);

const MAX_IMAGE_B64 = 2_000_000;
export const ACK_TEXT = 'AILLA đã nhận đơn. Nhân viên đang kiểm lại và sẽ gửi đơn xác nhận vào nhóm này.';
const ACK_GAP_MS = 10 * 60_000;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Tin chữ có vẻ là đơn: có số và đủ dài. Lời chào, cảm ơn... bỏ qua để đỡ tốn máy đọc. */
export function looksLikeOrder(text: string | null): boolean {
  if (!text) return false;
  const t = text.trim();
  return t.length >= 6 && /\d/.test(t);
}

zaloRelayRoutes.post('/message', async (c) => {
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as {
    thread_id?: string;
    thread_name?: string;
    is_group?: boolean;
    sender_name?: string;
    msg_id?: string;
    text?: string;
    image_b64?: string;
    mime?: string;
  };
  const threadId = String(b.thread_id ?? '').trim().slice(0, 64);
  if (!threadId) throw badRequest('NO_THREAD', 'Thiếu mã nhóm');
  const now = nowIso();
  const name = b.thread_name ? String(b.thread_name).slice(0, 200) : null;
  await db
    .prepare(
      `INSERT INTO zalo_threads (thread_id, name, enabled, last_msg_at, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?)
       ON CONFLICT(thread_id) DO UPDATE SET name = COALESCE(excluded.name, zalo_threads.name), last_msg_at = excluded.last_msg_at`,
    )
    .bind(threadId, name, now, now, now)
    .run();
  const th = await db.prepare('SELECT enabled, customer_id, name FROM zalo_threads WHERE thread_id = ?').bind(threadId).first<{ enabled: number; customer_id: string | null; name: string | null }>();
  if (!th?.enabled || !th.customer_id) return ok(c, { action: 'none', reason: 'thread_off' });

  const text = typeof b.text === 'string' && b.text.trim() ? b.text.trim().slice(0, 6000) : null;
  let image: { bytes: Uint8Array; mime: string } | null = null;
  if (b.image_b64) {
    const mime = String(b.mime ?? 'image/jpeg').toLowerCase();
    if (/^image\/(jpeg|png|webp)$/.test(mime) && b.image_b64.length <= MAX_IMAGE_B64 && /^[A-Za-z0-9+/=]+$/.test(b.image_b64)) {
      image = { bytes: b64ToBytes(b.image_b64), mime };
    }
  }
  if (!image && !looksLikeOrder(text)) return ok(c, { action: 'none', reason: 'not_order' });

  const msgId = b.msg_id ? String(b.msg_id).slice(0, 80) : null;
  if (msgId) {
    const seen = await db.prepare('SELECT id FROM order_intakes WHERE zalo_msg_id = ?').bind(msgId).first();
    if (seen) return ok(c, { action: 'none', reason: 'duplicate' });
  }
  const id = newId();
  await db
    .prepare(
      `INSERT INTO order_intakes (id, source, customer_id, raw_text, image, image_mime, image_size, status, zalo_thread_id, zalo_thread_name, zalo_sender, zalo_msg_id, created_at, updated_at)
       VALUES (?, 'ZALO_GROUP', ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, th.customer_id, text, image?.bytes ?? null, image?.mime ?? null, image?.bytes.length ?? null, threadId, th.name, b.sender_name ? String(b.sender_name).slice(0, 120) : null, msgId, now, now)
    .run();
  let lines = 0;
  try {
    const r = await runRead(c.env, id, th.customer_id, text, image);
    lines = r.lines.length;
  } catch {
    // Máy đọc lỗi: vẫn giữ đơn chờ để sale tự xem ảnh, nhưng không trả lời khách.
    await db.prepare("UPDATE order_intakes SET status = 'READ', result_json = ? WHERE id = ?").bind(JSON.stringify({ customer_hint: null, delivery_note: null, note: null, lines: [] }), id).run();
    await notify(db, th.customer_id, `Nhóm Zalo "${th.name ?? ''}" có tin giống đơn hàng nhưng máy chưa đọc được. Mở Tạo đơn › Đơn từ Zalo để xem.`);
    return ok(c, { action: 'none', reason: 'read_failed', intake_id: id });
  }
  if (lines === 0) {
    await db.prepare("UPDATE order_intakes SET status = 'DISMISSED', updated_at = ? WHERE id = ?").bind(nowIso(), id).run();
    return ok(c, { action: 'none', reason: 'no_lines' });
  }
  await notify(db, th.customer_id, `Đơn mới từ nhóm Zalo "${th.name ?? ''}" (${lines} dòng). Mở Tạo đơn › Đơn từ Zalo để kiểm và lập đơn.`);
  // Trả lời "đã nhận" tối đa một lần mỗi 10 phút trong một nhóm.
  const lastAck = await db.prepare("SELECT v FROM app_kv WHERE k = ?").bind(`zalo_ack:${threadId}`).first<{ v: string }>();
  if (lastAck && Date.now() - Date.parse(lastAck.v) < ACK_GAP_MS) return ok(c, { action: 'none', reason: 'ack_recent', intake_id: id });
  await db.prepare('INSERT INTO app_kv (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at').bind(`zalo_ack:${threadId}`, nowIso(), nowIso()).run();
  return ok(c, { action: 'reply', text: ACK_TEXT, intake_id: id });
});

/** Báo Sale phụ trách khách; khách chưa có Sale thì báo người có quyền điều phối duyệt đơn (không báo CEO). */
async function notify(db: D1Database, customerId: string, text: string) {
  const own = await db.prepare('SELECT owner_id FROM customers WHERE id = ?').bind(customerId).first<{ owner_id: string | null }>();
  let to = own?.owner_id ? [own.owner_id] : [];
  if (!to.length) {
    const r = await db
      .prepare(
        `SELECT DISTINCT u.id FROM users u JOIN user_permissions p ON p.user_id = u.id AND p.permission = 'order.approve.normal'
         WHERE u.status = 'ACTIVE' AND u.deleted_at IS NULL`,
      )
      .all<{ id: string }>();
    to = (r.results ?? []).map((x) => x.id);
  }
  try {
    await bellTo(db, to, text, '');
  } catch {
    /* chuông lỗi thì thôi */
  }
}

/** Tin chờ gửi vào nhóm (do người dùng web bấm gửi). */
zaloRelayRoutes.get('/outbox', async (c) => {
  const r = await c.env.DB.prepare("SELECT id, thread_id, text FROM zalo_outbox WHERE status = 'PENDING' ORDER BY created_at LIMIT 20").all();
  await c.env.DB.prepare('INSERT INTO app_kv (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at').bind('zalo_relay_seen', nowIso(), nowIso()).run();
  return ok(c, r.results ?? []);
});

zaloRelayRoutes.post('/outbox/:id/done', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  await c.env.DB.prepare("UPDATE zalo_outbox SET status = ?, error = ?, sent_at = ? WHERE id = ? AND status = 'PENDING'")
    .bind(b.ok ? 'SENT' : 'FAILED', b.ok ? null : String(b.error ?? 'lỗi').slice(0, 300), nowIso(), c.req.param('id'))
    .run();
  return ok(c, { ok: true });
});

import { Hono, type Context } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, forbidden, notFound, ok, unprocessable } from '../lib/http';
import { auditStatement, clientIp } from '../lib/audit';
import { newId } from '../lib/ids';
import { requirePermission } from '../middleware/rbac';
import { getOrderDetail } from '../services/orders';
import { readOrder, type CatalogItem, type ReadResult } from '../lib/orderReader';

/**
 * Đơn từ Zalo (phương án 3): sale đưa ảnh / tin nhắn đơn của khách vào web, máy đọc ra dòng hàng để điền sẵn trang tạo đơn.
 * Máy không tạo đơn, không tính giá. Sale kiểm, lưu đơn như bình thường, Điều phối duyệt rồi mới gửi link cho khách.
 */
export const orderIntakeRoutes = new Hono<AppEnv>();

const MAX_IMAGE_B64 = 2_000_000; // ~1,5 MB ảnh
const SHARE_DAYS = 30;

/** Danh mục để máy chọn mã: khách có bảng giá riêng thì chỉ hàng trong bảng riêng, còn lại là hàng đang có giá theo cấp. */
export async function loadCatalog(db: D1Database, customerId: string | null): Promise<CatalogItem[]> {
  if (customerId) {
    const c = await db.prepare('SELECT price_mode FROM customers WHERE id = ? AND deleted_at IS NULL').bind(customerId).first<{ price_mode: string | null }>();
    if (c?.price_mode === 'CUSTOM') {
      const r = await db
        .prepare(
          `SELECT DISTINCT p.id, p.sku, p.name, p.unit, p.pack_size FROM customer_prices cp JOIN products p ON p.id = cp.product_id
           WHERE cp.customer_id = ? AND p.deleted_at IS NULL AND p.active = 1 ORDER BY p.sku`,
        )
        .bind(customerId)
        .all<CatalogItem>();
      return r.results ?? [];
    }
  }
  const r = await db
    .prepare(
      `SELECT p.id, p.sku, p.name, p.unit, p.pack_size FROM products p
       WHERE p.active = 1 AND p.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM product_prices pp WHERE pp.product_id = p.id AND pp.amount IS NOT NULL AND pp.amount > 0)
       ORDER BY p.sku`,
    )
    .all<CatalogItem>();
  return r.results ?? [];
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Ráp kết quả đọc với thông tin sản phẩm để trang tạo đơn dùng ngay. */
export function withProducts(read: ReadResult, catalog: CatalogItem[]) {
  const bySku = new Map(catalog.map((p) => [p.sku, p]));
  return {
    ...read,
    lines: read.lines.map((l) => ({
      ...l,
      products: l.candidates.map((s) => bySku.get(s)).filter((p): p is CatalogItem => !!p),
    })),
  };
}

export async function runRead(
  env: AppEnv['Bindings'],
  intakeId: string,
  customerId: string | null,
  text: string | null,
  image: { bytes: Uint8Array; mime: string } | null,
) {
  const db = env.DB;
  const catalog = await loadCatalog(db, customerId);
  try {
    const read = await readOrder(env, catalog, { text, image });
    await db
      .prepare("UPDATE order_intakes SET status = 'READ', result_json = ?, error = NULL, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(read), nowIso(), intakeId)
      .run();
    return withProducts(read, catalog);
  } catch (e) {
    const code = e instanceof Error ? e.message : 'AI_ERROR';
    await db.prepare("UPDATE order_intakes SET status = 'FAILED', error = ?, updated_at = ? WHERE id = ?").bind(code.slice(0, 200), nowIso(), intakeId).run();
    throw code;
  }
}

function aiMessage(code: unknown): string {
  const s = String(code);
  if (s === 'AI_NOT_CONFIGURED') return 'Máy đọc đơn chưa được bật. Báo người làm web.';
  if (s === 'AI_BAD_OUTPUT') return 'Máy chưa đọc được đơn này. Thử ảnh rõ hơn, hoặc dán chữ tin nhắn.';
  if (s.startsWith('AI_HTTP_') || s.includes('Timeout') || s.includes('timed out'))
    return 'Máy đọc đơn đang bận hoặc mất kết nối. Thử lại sau ít phút.';
  return 'Máy chưa đọc được đơn này. Thử lại hoặc lập đơn tay.';
}

/** Đưa ảnh và/hoặc chữ tin nhắn vào, máy đọc ra dòng hàng. */
orderIntakeRoutes.post('/read', requirePermission('order.create', 'order.create.team'), async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => ({}))) as { text?: string; image_b64?: string; mime?: string; customer_id?: string };
  const text = typeof b.text === 'string' && b.text.trim() ? b.text.trim().slice(0, 6000) : null;
  let image: { bytes: Uint8Array; mime: string } | null = null;
  if (b.image_b64) {
    const mime = String(b.mime ?? '').toLowerCase();
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw badRequest('BAD_MIME', 'Chỉ nhận ảnh JPG, PNG hoặc WEBP');
    if (typeof b.image_b64 !== 'string' || b.image_b64.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(b.image_b64))
      throw badRequest('BAD_IMAGE', 'Ảnh quá lớn hoặc không đúng');
    image = { bytes: b64ToBytes(b.image_b64), mime };
  }
  if (!text && !image) throw badRequest('EMPTY', 'Chọn ảnh đơn hoặc dán tin nhắn của khách');
  const customerId = typeof b.customer_id === 'string' && b.customer_id ? b.customer_id : null;
  const id = newId();
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO order_intakes (id, source, customer_id, raw_text, image, image_mime, image_size, status, created_by, created_at, updated_at)
     VALUES (?, 'SALE', ?, ?, ?, ?, ?, 'NEW', ?, ?, ?)`,
  )
    .bind(id, customerId, text, image ? image.bytes : null, image?.mime ?? null, image?.bytes.length ?? null, auth.user.id, now, now)
    .run();
  try {
    const result = await runRead(c.env, id, customerId, text, image);
    return ok(c, { id, ...result });
  } catch (code) {
    throw unprocessable('READ_FAILED', aiMessage(code));
  }
});

async function loadIntake(db: D1Database, id: string) {
  return db
    .prepare('SELECT id, source, customer_id, raw_text, image_mime, order_id, created_by, created_at, zalo_thread_name, zalo_sender, status, result_json FROM order_intakes WHERE id = ?')
    .bind(id)
    .first<{
      id: string; source: string; customer_id: string | null; raw_text: string | null; image_mime: string | null; order_id: string | null;
      created_by: string | null; created_at: string; zalo_thread_name: string | null; zalo_sender: string | null; status: string; result_json: string | null;
    }>();
}

/** Người xem được ảnh gốc: người đưa vào, hoặc người xem được đơn đã gắn ảnh. Ảnh từ nhóm Zalo chưa gắn đơn: ai lập đơn được cũng xem được. */
async function canSeeIntake(db: D1Database, auth: AuthContext, row: { created_by: string | null; order_id: string | null; source: string }) {
  if (row.created_by === auth.user.id) return true;
  if (row.order_id) {
    try {
      await getOrderDetail(db, auth, row.order_id);
      return true;
    } catch {
      return false;
    }
  }
  return row.source === 'ZALO_GROUP' && (auth.permissions.includes('order.create') || auth.permissions.includes('order.create.team'));
}

orderIntakeRoutes.get('/:id/image', async (c) => {
  const auth = c.get('auth');
  const row = await loadIntake(c.env.DB, c.req.param('id'));
  if (!row) throw notFound('Không có ảnh này');
  if (!(await canSeeIntake(c.env.DB, auth, row))) throw forbidden();
  const img = await c.env.DB.prepare('SELECT image FROM order_intakes WHERE id = ?').bind(row.id).first<{ image: ArrayBuffer | number[] | null }>();
  if (!img?.image) throw notFound('Đơn này không có ảnh');
  const bytes = img.image instanceof ArrayBuffer ? new Uint8Array(img.image) : new Uint8Array(img.image as number[]);
  return new Response(bytes, { headers: { 'Content-Type': row.image_mime ?? 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
});

/** Lưu đơn xong thì gắn ảnh gốc vào đơn để Điều phối đối chiếu. */
orderIntakeRoutes.post('/:id/attach', requirePermission('order.create', 'order.create.team'), async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => ({}))) as { order_id?: string };
  const row = await loadIntake(c.env.DB, c.req.param('id'));
  if (!row) throw notFound('Không có ảnh này');
  if (!(await canSeeIntake(c.env.DB, auth, row))) throw forbidden();
  if (!b.order_id) throw badRequest('NO_ORDER', 'Thiếu đơn');
  await getOrderDetail(c.env.DB, auth, b.order_id); // chặn gắn vào đơn không xem được
  await c.env.DB.prepare("UPDATE order_intakes SET order_id = ?, status = 'USED', updated_at = ? WHERE id = ?").bind(b.order_id, nowIso(), row.id).run();
  return ok(c, { ok: true });
});

/** Ảnh / tin gốc của một đơn (hiện trên trang chi tiết đơn). */
orderIntakeRoutes.get('/by-order/:orderId', async (c) => {
  const auth = c.get('auth');
  const orderId = c.req.param('orderId');
  await getOrderDetail(c.env.DB, auth, orderId);
  const r = await c.env.DB.prepare(
    `SELECT id, source, raw_text, image_mime IS NOT NULL AS has_image, zalo_thread_name, zalo_sender, created_at FROM order_intakes WHERE order_id = ? ORDER BY created_at`,
  )
    .bind(orderId)
    .all();
  return ok(c, r.results ?? []);
});

function newToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const SHARE_OK = new Set(['APPROVED']);

/** Link ở địa chỉ khách mở được không cần đăng nhập (SHARE_BASE_URL), kể cả khi sale đang ở trang quản trị. */
function shareUrl(c: { req: { url: string }; env: AppEnv['Bindings'] }, token: string) {
  if (c.env.SHARE_BASE_URL) return `${c.env.SHARE_BASE_URL.replace(/\/$/, '')}/d/${token}`;
  const u = new URL(c.req.url);
  return `${u.protocol}//${u.host}/d/${token}`;
}

type ShareRow = { token: string; created_at: string; expires_at: string; first_viewed_at: string | null; view_count: number; confirmed_at: string | null; change_note: string | null; change_at: string | null };

async function currentShare(db: D1Database, orderId: string): Promise<ShareRow | null> {
  return db
    .prepare(
      `SELECT token, created_at, expires_at, first_viewed_at, view_count, confirmed_at, change_note, change_at FROM order_share_links
       WHERE order_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(orderId)
    .first<ShareRow>();
}

/** Lời nhắn để sale dán vào Zalo: tóm tắt đơn + link xác nhận. */
export function shareMessage(o: { order_no: string; items: Array<{ product_name: string; qty: number; unit?: string | null; pack_size?: string | null; is_gift?: boolean }>; total_amount: number }, url: string): string {
  const lines = o.items.map((i) => `- ${i.product_name}: ${qtyText(i.qty, i.unit ?? null, i.pack_size ?? null)}${i.is_gift ? ' (tặng)' : ''}`);
  return [
    `AILLA gửi Quý khách đơn hàng ${o.order_no}:`,
    ...lines,
    `Tổng tiền: ${o.total_amount.toLocaleString('vi-VN')}đ`,
    `Quý khách xem chi tiết và bấm "Đúng, chốt đơn" tại: ${url}`,
  ].join('\n');
}

/** Số lượng đọc cho khách: mã bán theo thùng thì ghi thùng; mã lẻ chia hết quy cách thì ghi thêm số thùng. */
export function qtyText(qty: number, unit: string | null, pack: string | null): string {
  const u = (unit ?? '').trim();
  const lower = u.toLowerCase();
  if (lower.includes('thùng') || lower.includes('thung')) return `${qty} thùng`;
  const n = Number(String(pack ?? '').match(/\d+/)?.[0] ?? 1);
  const name = u ? lower : 'chai';
  if (n > 1 && qty % n === 0) return `${qty / n} thùng (${qty} ${name})`;
  return `${qty} ${name}`;
}

orderIntakeRoutes.get('/share/:orderId', async (c) => {
  const auth = c.get('auth');
  const orderId = c.req.param('orderId');
  const o = await getOrderDetail(c.env.DB, auth, orderId);
  const s = await currentShare(c.env.DB, orderId);
  return ok(c, {
    can_share: SHARE_OK.has(o.approval_status),
    link: s ? { ...s, url: shareUrl(c, s.token), message: shareMessage(o, shareUrl(c, s.token)) } : null,
  });
});

/** Lấy link còn hạn của đơn, chưa có thì tạo (ghi nhật ký). */
async function ensureShare(c: Context<AppEnv>, auth: AuthContext, orderId: string) {
  let s = await currentShare(c.env.DB, orderId);
  if (!s || s.expires_at < nowIso()) {
    const token = newToken();
    const now = nowIso();
    const exp = new Date(Date.now() + SHARE_DAYS * 86_400_000).toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO order_share_links (token, order_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(token, orderId, auth.user.id, now, exp),
      auditStatement(c.env.DB, {
        actorId: auth.user.id,
        action: 'ORDER_SHARE_LINK',
        entityType: 'ORDER',
        entityId: orderId,
        after: { expires_at: exp },
        ip: clientIp(c.req.raw.headers),
        requestId: c.get('requestId'),
      }),
    ]);
    s = await currentShare(c.env.DB, orderId);
  }
  return s!;
}

/** Tạo (hoặc lấy lại) link gửi khách. Chỉ đơn đã duyệt. */
orderIntakeRoutes.post('/share/:orderId', requirePermission('order.create', 'order.create.team'), async (c) => {
  const auth = c.get('auth');
  const orderId = c.req.param('orderId');
  const o = await getOrderDetail(c.env.DB, auth, orderId);
  if (!SHARE_OK.has(o.approval_status)) throw unprocessable('NOT_APPROVED', 'Đơn chưa được duyệt nên chưa gửi khách được.');
  const s = await ensureShare(c, auth, orderId);
  const url = shareUrl(c, s.token);
  return ok(c, { link: { ...s, url, message: shareMessage(o, url) } });
});

/* ------------------------------------------------------------------ */
/* Phương án 1: trợ lý đọc đơn trong nhóm Zalo                          */
/* ------------------------------------------------------------------ */

/** Nhóm Zalo mà đơn này đến từ (đơn trợ lý nhận trong nhóm). */
async function threadOfOrder(db: D1Database, orderId: string) {
  return db
    .prepare(
      `SELECT i.zalo_thread_id AS thread_id, COALESCE(t.name, i.zalo_thread_name) AS name FROM order_intakes i
       LEFT JOIN zalo_threads t ON t.thread_id = i.zalo_thread_id
       WHERE i.order_id = ? AND i.source = 'ZALO_GROUP' AND i.zalo_thread_id IS NOT NULL ORDER BY i.created_at DESC LIMIT 1`,
    )
    .bind(orderId)
    .first<{ thread_id: string; name: string | null }>();
}

orderIntakeRoutes.get('/zalo-send/:orderId', async (c) => {
  const auth = c.get('auth');
  const orderId = c.req.param('orderId');
  await getOrderDetail(c.env.DB, auth, orderId);
  const th = await threadOfOrder(c.env.DB, orderId);
  const last = await c.env.DB.prepare('SELECT status, error, created_at, sent_at FROM zalo_outbox WHERE order_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(orderId)
    .first<{ status: string; error: string | null; created_at: string; sent_at: string | null }>();
  return ok(c, { thread: th ?? null, last: last ?? null });
});

/** Đơn đã duyệt: nhờ trợ lý gửi lời nhắn + link xác nhận vào đúng nhóm Zalo khách đã gửi đơn. */
orderIntakeRoutes.post('/zalo-send/:orderId', requirePermission('order.create', 'order.create.team'), async (c) => {
  const auth = c.get('auth');
  const orderId = c.req.param('orderId');
  const o = await getOrderDetail(c.env.DB, auth, orderId);
  if (!SHARE_OK.has(o.approval_status)) throw unprocessable('NOT_APPROVED', 'Đơn chưa được duyệt nên chưa gửi khách được.');
  const th = await threadOfOrder(c.env.DB, orderId);
  if (!th) throw unprocessable('NO_THREAD', 'Đơn này không đến từ nhóm Zalo nên trợ lý không biết gửi vào đâu. Chép lời nhắn và gửi tay.');
  const pending = await c.env.DB.prepare("SELECT id FROM zalo_outbox WHERE order_id = ? AND status = 'PENDING'").bind(orderId).first();
  if (pending) throw unprocessable('PENDING', 'Tin của đơn này đang chờ trợ lý gửi.');
  const s = await ensureShare(c, auth, orderId);
  const url = shareUrl(c, s.token);
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO zalo_outbox (id, thread_id, text, order_id, status, created_by, created_at) VALUES (?, ?, ?, ?, 'PENDING', ?, ?)").bind(
      newId(),
      th.thread_id,
      shareMessage(o, url),
      orderId,
      auth.user.id,
      nowIso(),
    ),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'ORDER_ZALO_SEND', entityType: 'ORDER', entityId: orderId, after: { thread: th.name }, requestId: c.get('requestId') }),
  ]);
  return ok(c, { ok: true, thread: th });
});

/** Đơn trợ lý nhận trong nhóm Zalo, chưa ai lập đơn (14 ngày gần nhất). */
orderIntakeRoutes.get('/pending', requirePermission('order.create', 'order.create.team'), async (c) => {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const r = await c.env.DB.prepare(
    `SELECT i.id, i.customer_id, cu.name AS customer_name, COALESCE(t.name, i.zalo_thread_name) AS thread_name, i.zalo_sender, i.raw_text,
            i.image_mime IS NOT NULL AS has_image, i.result_json, i.created_at
     FROM order_intakes i LEFT JOIN customers cu ON cu.id = i.customer_id LEFT JOIN zalo_threads t ON t.thread_id = i.zalo_thread_id
     WHERE i.source = 'ZALO_GROUP' AND i.status = 'READ' AND i.order_id IS NULL AND i.created_at >= ?
     ORDER BY i.created_at DESC LIMIT 50`,
  )
    .bind(since)
    .all<{ id: string; result_json: string | null } & Record<string, unknown>>();
  return ok(
    c,
    (r.results ?? []).map(({ result_json, ...x }) => {
      let n = 0;
      try {
        n = (JSON.parse(result_json ?? '{}') as ReadResult).lines?.length ?? 0;
      } catch {
        n = 0;
      }
      return { ...x, line_count: n };
    }),
  );
});

/** Danh sách nhóm Zalo trợ lý đang ở trong. Điều phối bật nhóm nào thì trợ lý mới đọc đơn nhóm đó. */
orderIntakeRoutes.get('/zalo/threads', requirePermission('order.approve.normal'), async (c) => {
  const r = await c.env.DB.prepare(
    `SELECT t.thread_id, t.name, t.customer_id, cu.name AS customer_name, t.enabled, t.last_msg_at FROM zalo_threads t
     LEFT JOIN customers cu ON cu.id = t.customer_id ORDER BY t.enabled DESC, t.last_msg_at DESC LIMIT 300`,
  ).all();
  return ok(c, r.results ?? []);
});

orderIntakeRoutes.put('/zalo/threads/:threadId', requirePermission('order.approve.normal'), async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => ({}))) as { enabled?: boolean; customer_id?: string | null };
  const id = c.req.param('threadId');
  const t = await c.env.DB.prepare('SELECT thread_id, enabled, customer_id FROM zalo_threads WHERE thread_id = ?')
    .bind(id)
    .first<{ thread_id: string; enabled: number; customer_id: string | null }>();
  if (!t) throw notFound('Không có nhóm này');
  const customerId = b.customer_id === undefined ? t.customer_id : b.customer_id || null;
  if (customerId) {
    const cu = await c.env.DB.prepare('SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL').bind(customerId).first();
    if (!cu) throw badRequest('BAD_CUSTOMER', 'Khách không có');
  }
  const enabled = b.enabled === undefined ? t.enabled : b.enabled ? 1 : 0;
  if (enabled && !customerId) throw unprocessable('NEED_CUSTOMER', 'Gắn nhóm với một khách trước rồi mới bật trợ lý đọc đơn.');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE zalo_threads SET enabled = ?, customer_id = ?, updated_at = ? WHERE thread_id = ?').bind(enabled, customerId, nowIso(), id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'ZALO_THREAD_SET',
      entityType: 'ZALO_THREAD',
      entityId: id,
      before: { enabled: t.enabled, customer_id: t.customer_id },
      after: { enabled, customer_id: customerId },
      requestId: c.get('requestId'),
    }),
  ]);
  return ok(c, { ok: true });
});

/** Mở một đơn trợ lý đã đọc để điền vào trang tạo đơn. */
orderIntakeRoutes.get('/:id', requirePermission('order.create', 'order.create.team'), async (c) => {
  const auth = c.get('auth');
  const row = await loadIntake(c.env.DB, c.req.param('id'));
  if (!row) throw notFound('Không có đơn này');
  if (!(await canSeeIntake(c.env.DB, auth, row))) throw forbidden();
  let read: ReadResult = { customer_hint: null, delivery_note: null, note: null, lines: [] };
  try {
    read = JSON.parse(row.result_json ?? '') as ReadResult;
  } catch {
    /* chưa đọc được */
  }
  const catalog = await loadCatalog(c.env.DB, row.customer_id);
  return ok(c, {
    id: row.id,
    customer_id: row.customer_id,
    thread_name: row.zalo_thread_name,
    sender: row.zalo_sender,
    raw_text: row.raw_text,
    has_image: !!row.image_mime,
    ...withProducts(read, catalog),
  });
});

/** Tin trong nhóm không phải đơn, hoặc đơn đã lập tay: bỏ khỏi danh sách chờ. */
orderIntakeRoutes.post('/:id/dismiss', requirePermission('order.create', 'order.create.team'), async (c) => {
  const auth = c.get('auth');
  const row = await loadIntake(c.env.DB, c.req.param('id'));
  if (!row) throw notFound('Không có đơn này');
  if (!(await canSeeIntake(c.env.DB, auth, row))) throw forbidden();
  await c.env.DB.prepare("UPDATE order_intakes SET status = 'DISMISSED', updated_at = ? WHERE id = ? AND order_id IS NULL").bind(nowIso(), row.id).run();
  return ok(c, { ok: true });
});

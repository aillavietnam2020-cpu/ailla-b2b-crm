import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { auditStatement, clientIp } from '../lib/audit';
import { bellTo } from '../lib/hubBell';
import { qtyText } from './orderIntake';

/**
 * Trang khách xem đơn và bấm xác nhận (link sale gửi qua Zalo). Không cần đăng nhập: ai có link mới mở được,
 * link khó đoán, hết hạn sau 30 ngày. Không có chữ "chị/em", không hiện công nợ hay thông tin nội bộ.
 * Trang thuần HTML, không dùng script (đúng chính sách bảo mật của web), mở tốt trong trình duyệt của Zalo.
 */
export const publicOrderRoutes = new Hono<AppEnv>();

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
const vnd = (n: number) => `${Number(n || 0).toLocaleString('vi-VN')}đ`;
const vnTime = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ngày ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};
const vnDay = (ymd: string | null) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '');

type LinkRow = { token: string; order_id: string; expires_at: string; revoked_at: string | null; confirmed_at: string | null; change_note: string | null; change_at: string | null; first_viewed_at: string | null };

async function loadLink(db: D1Database, token: string): Promise<LinkRow | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const r = await db
    .prepare('SELECT token, order_id, expires_at, revoked_at, confirmed_at, change_note, change_at, first_viewed_at FROM order_share_links WHERE token = ?')
    .bind(token)
    .first<LinkRow>();
  if (!r || r.revoked_at || r.expires_at < nowIso()) return null;
  return r;
}

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title><style>
:root{--bg:#f3f5f2;--card:#fff;--ink:#1d2a24;--muted:#5f6f67;--line:#dbe2dc;--brand:#1f7a55;--ok:#1d8a4e;--okbg:#e2f4e8;--warn:#9a5d00;--warnbg:#fff2d9}
@media (prefers-color-scheme:dark){:root{--bg:#121815;--card:#1a221e;--ink:#e6ece8;--muted:#9aaba2;--line:#2c3832;--brand:#46b386;--ok:#53c283;--okbg:#183324;--warn:#e3a43c;--warnbg:#3a2c12;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}
.w{max-width:560px;margin:0 auto;display:grid;gap:14px}.c{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;display:grid;gap:10px}
h1{font-size:20px;margin:0}.m{color:var(--muted);font-size:14px}.b{font-weight:700;color:var(--brand);letter-spacing:.04em;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:15px}td{padding:8px 0;border-bottom:1px solid var(--line);vertical-align:top}td.r{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.t td{border:0;padding:3px 0}.big td{font-weight:700;font-size:17px}
button{font:inherit;font-weight:700;width:100%;padding:14px;border-radius:12px;border:0;background:var(--brand);color:#fff;cursor:pointer}
button.g{background:transparent;color:var(--ink);border:1px solid var(--line);font-weight:600}
textarea{font:inherit;width:100%;min-height:90px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--card);color:var(--ink)}
.ok{background:var(--okbg);color:var(--ok);border-radius:12px;padding:14px;font-weight:600}.wn{background:var(--warnbg);color:var(--warn);border-radius:12px;padding:14px}
details summary{cursor:pointer;color:var(--muted);padding:6px 0}form{display:grid;gap:10px;margin:0}
</style></head><body><div class="w">${body}</div></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

const gone = () =>
  page('Không mở được đơn', `<div class="c"><div class="b">AILLA</div><h1>Link này không còn mở được</h1><p class="m">Link đã hết hạn hoặc không đúng. Quý khách nhắn lại cho nhân viên AILLA để nhận link mới.</p></div>`, 404);

async function orderView(db: D1Database, orderId: string) {
  const o = await db
    .prepare(
      `SELECT o.id, o.order_no, o.order_date, o.subtotal, o.discount_amount, o.bonus_deduction, o.shipping_fee, o.total_amount, o.cod_amount,
              o.approval_status, o.owner_id, o.created_by, o.note, c.name AS customer_name, c.address AS customer_address
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`,
    )
    .bind(orderId)
    .first<{
      id: string; order_no: string; order_date: string; subtotal: number; discount_amount: number; bonus_deduction: number; shipping_fee: number;
      total_amount: number; cod_amount: number; approval_status: string; owner_id: string | null; created_by: string | null; note: string | null;
      customer_name: string; customer_address: string | null;
    }>();
  if (!o) return null;
  const items = await db
    .prepare(
      `SELECT p.name, p.unit, p.pack_size, oi.qty, oi.applied_price, oi.line_total, COALESCE(oi.is_gift, 0) AS is_gift
       FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? ORDER BY oi.created_at, oi.rowid`,
    )
    .bind(orderId)
    .all<{ name: string; unit: string | null; pack_size: string | null; qty: number; applied_price: number; line_total: number; is_gift: number }>();
  return { ...o, items: items.results ?? [] };
}

publicOrderRoutes.get('/:token', async (c) => {
  const db = c.env.DB;
  const link = await loadLink(db, c.req.param('token'));
  if (!link) return gone();
  const o = await orderView(db, link.order_id);
  if (!o || o.approval_status === 'CANCELLED') return gone();
  const now = nowIso();
  await db
    .prepare('UPDATE order_share_links SET view_count = view_count + 1, first_viewed_at = COALESCE(first_viewed_at, ?) WHERE token = ?')
    .bind(now, link.token)
    .run();
  const rows = o.items
    .map(
      (i) =>
        `<tr><td>${esc(i.name)}${i.is_gift ? ' <span class="m">(tặng)</span>' : ''}<div class="m">${esc(qtyText(i.qty, i.unit, i.pack_size))}</div></td><td class="r">${i.is_gift ? '0đ' : vnd(i.line_total)}</td></tr>`,
    )
    .join('');
  const extra = [
    o.discount_amount ? `<tr><td>Chiết khấu</td><td class="r">−${vnd(o.discount_amount)}</td></tr>` : '',
    o.bonus_deduction ? `<tr><td>Trừ thưởng</td><td class="r">−${vnd(o.bonus_deduction)}</td></tr>` : '',
    o.shipping_fee ? `<tr><td>Phí vận chuyển</td><td class="r">${vnd(o.shipping_fee)}</td></tr>` : '',
  ].join('');
  const sent = c.req.query('sent');
  let action: string;
  if (link.confirmed_at) {
    action = `<div class="ok">Quý khách đã chốt đơn lúc ${esc(vnTime(link.confirmed_at))}. AILLA sẽ chuẩn bị hàng và báo lịch giao.</div>`;
  } else if (link.change_at && sent === 'sua') {
    action = `<div class="wn">Đã gửi yêu cầu sửa cho nhân viên AILLA. Nhân viên sẽ sửa đơn và gửi lại link mới.</div>`;
  } else {
    action = `${link.change_at ? `<div class="wn">Quý khách đã gửi yêu cầu sửa lúc ${esc(vnTime(link.change_at))}: “${esc(link.change_note)}”. Nếu đơn đã đúng, bấm chốt đơn.</div>` : ''}
<form method="post" action="/d/${esc(link.token)}/chot"><button type="submit">Đúng, chốt đơn</button></form>
<details><summary>Đơn chưa đúng? Bấm vào đây để báo sửa</summary>
<form method="post" action="/d/${esc(link.token)}/sua"><textarea name="note" maxlength="1000" required placeholder="Ví dụ: Hygiene đen lấy 10 can thôi, thêm 2 thùng rửa chén dứa 2kg"></textarea><button class="g" type="submit">Gửi yêu cầu sửa</button></form></details>`;
  }
  return page(
    `Đơn hàng ${o.order_no}`,
    `<div class="c"><div class="b">AILLA · ĐƠN HÀNG</div><h1>${esc(o.order_no)}</h1>
<div class="m">${esc(o.customer_name)}${o.customer_address ? ' · ' + esc(o.customer_address) : ''}<br>Ngày đặt ${esc(vnDay(o.order_date))}</div></div>
<div class="c"><table>${rows}</table><table class="t"><tr><td>Tiền hàng</td><td class="r">${vnd(o.subtotal)}</td></tr>${extra}
<tr class="big"><td>Tổng tiền</td><td class="r">${vnd(o.total_amount)}</td></tr>${o.cod_amount ? `<tr><td class="m">Đã đặt cọc</td><td class="r m">${vnd(o.cod_amount)}</td></tr>` : ''}</table>
${o.note ? `<div class="m">Ghi chú: ${esc(o.note)}</div>` : ''}</div>
<div class="c">${action}</div>
<p class="m" style="text-align:center">Cần hỗ trợ, Quý khách nhắn nhân viên AILLA trên Zalo.</p>`,
  );
});

async function notifyStaff(db: D1Database, o: { owner_id: string | null; created_by: string | null }, text: string) {
  const to = [o.owner_id, o.created_by].filter((x): x is string => !!x);
  try {
    await bellTo(db, [...new Set(to)], text, '');
  } catch {
    /* chuông lỗi thì thôi, giờ xác nhận vẫn đã lưu */
  }
}

publicOrderRoutes.post('/:token/chot', async (c) => {
  const db = c.env.DB;
  const link = await loadLink(db, c.req.param('token'));
  if (!link) return gone();
  const o = await orderView(db, link.order_id);
  if (!o || o.approval_status === 'CANCELLED') return gone();
  if (!link.confirmed_at) {
    const now = nowIso();
    const res = await db.prepare('UPDATE order_share_links SET confirmed_at = ? WHERE token = ? AND confirmed_at IS NULL').bind(now, link.token).run();
    if (res.meta.changes) {
      await db.batch([
        auditStatement(db, {
          actorId: null,
          actorType: 'SYSTEM',
          action: 'ORDER_CUSTOMER_CONFIRMED',
          entityType: 'ORDER',
          entityId: o.id,
          after: { confirmed_at: now },
          source: 'share-link',
          ip: clientIp(c.req.raw.headers),
          requestId: c.get('requestId'),
        }),
      ]);
      await notifyStaff(db, o, `Khách ${o.customer_name} đã bấm chốt đơn ${o.order_no}`);
    }
  }
  return c.redirect(`/d/${link.token}`, 303);
});

publicOrderRoutes.post('/:token/sua', async (c) => {
  const db = c.env.DB;
  const link = await loadLink(db, c.req.param('token'));
  if (!link) return gone();
  const o = await orderView(db, link.order_id);
  if (!o || o.approval_status === 'CANCELLED') return gone();
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const note = String((form as Record<string, unknown>).note ?? '').trim().slice(0, 1000);
  if (!note || link.confirmed_at) return c.redirect(`/d/${link.token}`, 303);
  const now = nowIso();
  await db.batch([
    db.prepare('UPDATE order_share_links SET change_note = ?, change_at = ? WHERE token = ?').bind(note, now, link.token),
    auditStatement(db, {
      actorId: null,
      actorType: 'SYSTEM',
      action: 'ORDER_CUSTOMER_CHANGE_REQUEST',
      entityType: 'ORDER',
      entityId: o.id,
      after: { note },
      source: 'share-link',
      ip: clientIp(c.req.raw.headers),
      requestId: c.get('requestId'),
    }),
  ]);
  await notifyStaff(db, o, `Khách ${o.customer_name} báo sửa đơn ${o.order_no}: ${note.slice(0, 120)}`);
  return c.redirect(`/d/${link.token}?sent=sua`, 303);
});

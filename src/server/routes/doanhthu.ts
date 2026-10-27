import { Hono } from 'hono';
import { vnDate } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { auditStatement, nowIso } from '../lib/audit';
import { badRequest, forbidden, ok } from '../lib/http';

/**
 * Doanh thu thực theo kênh × tháng (trang quản trị › Đối chiếu doanh thu, chị Hoa chốt 26/10/2026).
 * - Số web của tháng được lưu lại (đóng băng) từ ngày 10 tháng sau; đã lưu thì không ghi đè, trừ CEO "chốt lại" có lý do.
 * - Số kế toán (chị Huệ) nhập tay từng kênh × tháng để so với số web.
 * Chỉ CEO và kế toán. Số web do trang tính (cùng một hàm cho mọi trang) rồi gửi lên đây.
 */
export const doanhthuRoutes = new Hono<AppEnv>();

const CHANNELS = ['tts', 'spe', 'fb', 'cskh', 'b2b', 'gc'] as const;
const canMoney = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('debt.read.all');
const isYm = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isCh = (v: unknown): v is (typeof CHANNELS)[number] => typeof v === 'string' && (CHANNELS as readonly string[]).includes(v);
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : NaN);

/** Ngày chốt số của tháng = ngày 10 tháng sau (giống hub/src/dtcalc.js). */
export function revenueCloseDate(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01-10` : `${y}-${String(m + 1).padStart(2, '0')}-10`;
}

doanhthuRoutes.get('/', async (c) => {
  if (!canMoney(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem');
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!isYm(from) || !isYm(to)) throw badRequest('BAD_RANGE', 'Cần tháng bắt đầu và kết thúc (yyyy-mm)');
  const r = await c.env.DB.prepare('SELECT * FROM revenue_months WHERE ym BETWEEN ? AND ? ORDER BY ym, channel').bind(from, to).all();
  return ok(c, r.results ?? []);
});

/** Lưu số web đã chốt của một tháng. Kênh đã có số chốt thì bỏ qua (đóng băng); CEO gửi force + lý do để chốt lại. */
doanhthuRoutes.post('/chot', async (c) => {
  const auth = c.get('auth');
  if (!canMoney(auth)) throw forbidden('Chỉ CEO hoặc kế toán chốt số');
  const b = (await c.req.json().catch(() => ({}))) as {
    ym?: unknown;
    rows?: { channel?: unknown; amount?: unknown; orders?: unknown; data?: unknown }[];
    force?: unknown;
    reason?: unknown;
  };
  if (!isYm(b.ym)) throw badRequest('BAD_MONTH', 'Tháng không hợp lệ');
  const ym = b.ym;
  if (vnDate() < revenueCloseDate(ym)) throw badRequest('NOT_YET', `Tháng ${ym} chốt số từ ngày ${revenueCloseDate(ym)}`);
  const force = b.force === true;
  const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
  if (force && auth.user.role !== 'CEO') throw forbidden('Chỉ CEO chốt lại số đã chốt');
  if (force && reason.length < 3) throw badRequest('NEED_REASON', 'Chốt lại cần ghi lý do');
  const rows = Array.isArray(b.rows) ? b.rows : [];
  if (!rows.length) throw badRequest('NO_ROWS', 'Không có số để chốt');
  const at = nowIso();
  const saved: string[] = [];
  for (const r of rows) {
    const amount = num(r.amount);
    const orders = num(r.orders);
    if (!isCh(r.channel) || amount === null || Number.isNaN(amount) || Number.isNaN(orders as number)) {
      throw badRequest('BAD_ROW', 'Dòng số chốt không hợp lệ');
    }
    const data = JSON.stringify(r.data ?? null);
    if (data.length > 20000) throw badRequest('TOO_LARGE', 'Dữ liệu quá lớn');
    const before = await c.env.DB.prepare('SELECT web_amount, web_orders, closed_at FROM revenue_months WHERE ym = ? AND channel = ?')
      .bind(ym, r.channel)
      .first<{ web_amount: number | null; web_orders: number | null; closed_at: string | null }>();
    if (before?.closed_at && !force) continue;
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO revenue_months (ym, channel, web_amount, web_orders, web_json, closed_at, closed_by) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (ym, channel) DO UPDATE SET web_amount = excluded.web_amount, web_orders = excluded.web_orders,
           web_json = excluded.web_json, closed_at = excluded.closed_at, closed_by = excluded.closed_by`,
      ).bind(ym, r.channel, amount, orders, data, at, auth.user.id),
      auditStatement(c.env.DB, {
        actorId: auth.user.id,
        action: force ? 'REVENUE_RECLOSE' : 'REVENUE_CLOSE',
        entityType: 'REVENUE_MONTH',
        entityId: `${ym}:${r.channel}`,
        before: before ?? null,
        after: { web_amount: amount, web_orders: orders },
        reason: force ? reason : null,
      }),
    ]);
    saved.push(r.channel);
  }
  return ok(c, { saved });
});

/** Số kế toán nhập tay (để trống = xóa số đã nhập). */
doanhthuRoutes.put('/ketoan', async (c) => {
  const auth = c.get('auth');
  if (!canMoney(auth)) throw forbidden('Chỉ CEO hoặc kế toán nhập số');
  const b = (await c.req.json().catch(() => ({}))) as { ym?: unknown; channel?: unknown; amount?: unknown; note?: unknown };
  if (!isYm(b.ym) || !isCh(b.channel)) throw badRequest('BAD_ROW', 'Tháng hoặc kênh không hợp lệ');
  const amount = num(b.amount);
  if (Number.isNaN(amount)) throw badRequest('BAD_AMOUNT', 'Số tiền không hợp lệ');
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 500) : '';
  const before = await c.env.DB.prepare('SELECT kt_amount, kt_note FROM revenue_months WHERE ym = ? AND channel = ?')
    .bind(b.ym, b.channel)
    .first();
  const at = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO revenue_months (ym, channel, kt_amount, kt_note, kt_at, kt_by) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (ym, channel) DO UPDATE SET kt_amount = excluded.kt_amount, kt_note = excluded.kt_note,
         kt_at = excluded.kt_at, kt_by = excluded.kt_by`,
    ).bind(b.ym, b.channel, amount, note || null, at, auth.user.id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'REVENUE_ACCOUNTING_SET',
      entityType: 'REVENUE_MONTH',
      entityId: `${b.ym}:${b.channel}`,
      before: before ?? null,
      after: { kt_amount: amount, kt_note: note || null },
    }),
  ]);
  return ok(c, { ok: true });
});

/** Từng đơn đã duyệt tạo nên doanh thu Kênh phân phối / Kênh OEM của một tháng (cùng điều kiện với /api/dashboards/b2b-sku). */
doanhthuRoutes.get('/b2b-orders', async (c) => {
  if (!canMoney(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem');
  const ym = c.req.query('ym');
  const ch = c.req.query('channel');
  if (!isYm(ym) || (ch !== 'B2B' && ch !== 'GIA_CONG')) throw badRequest('BAD_RANGE', 'Tháng hoặc kênh không hợp lệ');
  const r = await c.env.DB.prepare(
    `SELECT o.order_no, o.order_date, c.name AS customer,
            (o.subtotal - o.discount_amount - o.bonus_deduction) AS revenue
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND substr(o.order_date, 1, 7) = ?
       AND (CASE WHEN c.price_mode = 'CUSTOM' AND c.tier_id IS NULL THEN 'GIA_CONG' ELSE 'B2B' END) = ?
     ORDER BY o.order_date, o.order_no LIMIT 2000`,
  )
    .bind(ym, ch)
    .all();
  return ok(c, r.results ?? []);
});

import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { clientIp } from '../lib/audit';
import { badRequest, forbidden, ok } from '../lib/http';
import { recordPayment } from '../services/payments';

/**
 * Nhân viên mua hàng công ty, cuối tháng trừ lương. Mỗi nhân viên là một khách cấp "Nhân viên" có mã nhân sự (staff_code).
 * Số phải trừ = các đơn đã xuất kho / giao trong tháng. Chốt kỳ lương thì ghi "đã thu bằng trừ lương" cho các đơn đó
 * (công nợ nhân viên về 0) và phiếu lương đọc số này để điền dòng "Mua hàng công ty (trừ lương)".
 */
export const staffPurchaseRoutes = new Hono<AppEnv>();

const canView = (a: AuthContext) => a.user.role === 'CEO' || a.user.role === 'MANAGER' || a.permissions.includes('order.accounting.confirm');
const canClose = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('order.accounting.confirm');
const monthOk = (m: unknown): m is string => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m);

async function load(db: D1Database, month: string) {
  const staff = await db
    .prepare(
      `SELECT c.id, c.name, c.staff_code FROM customers c JOIN price_tiers t ON t.id = c.tier_id
       WHERE c.deleted_at IS NULL AND t.code = 'NHAN_VIEN' AND c.staff_code IS NOT NULL AND c.staff_code <> '' ORDER BY c.staff_code`,
    )
    .all<{ id: string; name: string; staff_code: string }>();
  const out: Array<{
    customer_id: string;
    name: string;
    staff_code: string;
    total: number;
    closed: number;
    orders: Array<{ order_no: string; order_date: string; total_amount: number }>;
  }> = [];
  for (const s of staff.results ?? []) {
    const ords = await db
      .prepare(
        `SELECT order_no, order_date, total_amount FROM orders
         WHERE customer_id = ? AND deleted_at IS NULL AND approval_status = 'APPROVED' AND delivery_status IN ('DA_XUAT_KHO', 'DA_GIAO')
           AND substr(date(COALESCE(delivered_at, order_date), '+7 hours'), 1, 7) = ? ORDER BY order_date`,
      )
      .bind(s.id, month)
      .all<{ order_no: string; order_date: string; total_amount: number }>();
    const closed = await db
      .prepare('SELECT amount FROM staff_deductions WHERE month = ? AND staff_code = ?')
      .bind(month, s.staff_code)
      .first<{ amount: number }>();
    const list = ords.results ?? [];
    out.push({
      customer_id: s.id,
      name: s.name,
      staff_code: s.staff_code,
      total: list.reduce((n, o) => n + o.total_amount, 0),
      closed: closed?.amount ?? 0,
      orders: list,
    });
  }
  return out;
}

staffPurchaseRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  if (!canView(auth)) throw forbidden('Chỉ quản lý, kế toán hoặc CEO xem được mua hàng của nhân viên.');
  const month = c.req.query('month');
  if (!monthOk(month)) throw badRequest('BAD_MONTH', 'Chọn tháng dạng 2026-10.');
  return ok(c, await load(c.env.DB, month));
});

/** Chốt trừ lương: ghi "Trừ lương" cho các đơn nhân viên đã mua trong tháng; chốt lại thì chỉ ghi phần phát sinh thêm. */
staffPurchaseRoutes.post('/close', async (c) => {
  const auth = c.get('auth');
  if (!canClose(auth)) throw forbidden('Chỉ kế toán hoặc CEO chốt trừ lương vào công nợ nhân viên.');
  const body = (await c.req.json().catch(() => null)) as { month?: unknown } | null;
  if (!monthOk(body?.month)) throw badRequest('BAD_MONTH', 'Chọn tháng dạng 2026-10.');
  const month = body!.month as string;
  const rows = await load(c.env.DB, month);
  const done: Array<{ staff_code: string; name: string; amount: number }> = [];
  for (const r of rows) {
    const delta = r.total - r.closed;
    if (delta <= 0) continue;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    await recordPayment(
      c.env.DB,
      auth,
      {
        customer_id: r.customer_id,
        amount: delta,
        paid_at: lastDay,
        method: 'Trừ lương',
        external_receipt_no: `LUONG-${month}-${r.staff_code}${r.closed ? '-' + Date.now().toString(36) : ''}`,
        accounting_confirmed: true,
        explanation: `Trừ lương tháng ${month} (${r.staff_code})`,
        note: `Nhân viên mua hàng công ty, trừ vào lương tháng ${month}`,
      } as Parameters<typeof recordPayment>[2],
      { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) },
    );
    await c.env.DB
      .prepare(
        `INSERT INTO staff_deductions (month, staff_code, customer_id, amount, closed_by, closed_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (month, staff_code) DO UPDATE SET amount = excluded.amount, closed_by = excluded.closed_by, closed_at = excluded.closed_at`,
      )
      .bind(month, r.staff_code, r.customer_id, r.total, auth.user.id, nowIso())
      .run();
    done.push({ staff_code: r.staff_code, name: r.name, amount: delta });
  }
  return ok(c, { month, closed: done, total: done.reduce((n, x) => n + x.amount, 0) });
});

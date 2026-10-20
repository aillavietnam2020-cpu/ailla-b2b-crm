import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso } from '@shared/datetime';
import { zodFieldErrors } from '@shared/schemas';
import type { AppEnv, AuthContext } from '../env';
import { auditStatement, clientIp } from '../lib/audit';
import { badRequest, conflict, forbidden, notFound, ok, unprocessable } from '../lib/http';
import { createShippingVoucher } from '../services/shippingVouchers';

/**
 * Sổ phiếu chi vận chuyển. Quản lý điều phối (Thảo) hoặc CEO lập, lập xong có hiệu lực luôn (không qua bước duyệt).
 * Kế toán xem được (đối chiếu sổ). Không gắn vào đơn, không chia chi phí theo đơn.
 */
export const shippingVoucherRoutes = new Hono<AppEnv>();

const canWrite = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('order.approve.normal');
const canRead = (a: AuthContext) => canWrite(a) || a.permissions.includes('order.accounting.confirm');

const createSchema = z.object({
  voucher_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phiếu không hợp lệ')
    .optional(),
  carrier: z.string().trim().min(1, 'Ghi đơn vị vận chuyển hoặc biển số xe').max(120),
  destination: z.string().trim().max(160).optional().default(''),
  amount: z.number().int('Số tiền là số nguyên (đồng)').min(1, 'Số tiền phải lớn hơn 0').max(10_000_000_000),
  method: z.enum(['TIEN_MAT', 'CHUYEN_KHOAN', 'KHAC']).default('TIEN_MAT'),
  order_refs: z.string().trim().max(600).optional().default(''),
  note: z.string().trim().max(600).optional().default(''),
});

shippingVoucherRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  if (!canRead(auth)) throw forbidden('Chỉ quản lý điều phối, kế toán hoặc CEO xem được phiếu chi vận chuyển');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const q = (c.req.query('q') ?? '').trim();
  const where: string[] = [];
  const bind: unknown[] = [];
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    where.push('v.voucher_date >= ?');
    bind.push(from);
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    where.push('v.voucher_date <= ?');
    bind.push(to);
  }
  if (q) {
    where.push('(v.voucher_no LIKE ? OR v.carrier LIKE ? OR v.destination LIKE ? OR v.order_refs LIKE ? OR v.note LIKE ?)');
    bind.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = await c.env.DB.prepare(
    `SELECT v.id, v.voucher_no, v.voucher_date, v.carrier, v.destination, v.amount, v.method, v.order_refs, v.note,
            v.status, v.created_at, v.cancel_reason, u.display_name AS created_by_name
     FROM shipping_vouchers v LEFT JOIN users u ON u.id = v.created_by
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT 500`,
  )
    .bind(...bind)
    .all<{ amount: number; status: string }>();
  const list = rows.results ?? [];
  const total = list.filter((r) => r.status === 'OK').reduce((s, r) => s + r.amount, 0);
  return ok(c, list, { total_amount: total, can_write: canWrite(auth) });
});

shippingVoucherRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  if (!canWrite(auth)) throw forbidden('Chỉ quản lý điều phối hoặc CEO được lập phiếu chi vận chuyển');
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Phiếu chi chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const r = await createShippingVoucher(c.env.DB, auth, parsed.data, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, r);
});

shippingVoucherRoutes.post('/:id/cancel', async (c) => {
  const auth = c.get('auth');
  if (!canWrite(auth)) throw forbidden('Chỉ quản lý điều phối hoặc CEO được hủy phiếu chi vận chuyển');
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = String(body?.reason ?? '').trim();
  if (reason.length < 3) throw badRequest('NO_REASON', 'Cần ghi lý do hủy phiếu');
  const v = await c.env.DB.prepare('SELECT voucher_no, status FROM shipping_vouchers WHERE id = ?')
    .bind(id)
    .first<{ voucher_no: string; status: string }>();
  if (!v) throw notFound('Không tìm thấy phiếu');
  if (v.status !== 'OK') throw conflict('ALREADY', 'Phiếu này đã hủy rồi');
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        "UPDATE shipping_vouchers SET status = 'HUY', cancelled_by = ?, cancelled_at = ?, cancel_reason = ? WHERE id = ? AND status = 'OK'",
      )
      .bind(auth.user.id, nowIso(), reason, id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'SHIPPING_VOUCHER_CANCELLED',
      entityType: 'SHIPPING_VOUCHER',
      entityId: v.voucher_no,
      reason,
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { id, voucher_no: v.voucher_no });
});

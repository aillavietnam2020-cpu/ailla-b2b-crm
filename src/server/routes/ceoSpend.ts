import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import { CEO_SPEND_KEY, parseCeoSpend } from '@shared/ceoSpend';
import type { AppEnv } from '../env';
import { auditStatement, clientIp } from '../lib/audit';
import { conflict, forbidden, notFound, ok } from '../lib/http';

/**
 * Khoản chi từ ngưỡng chờ CEO duyệt (chị Hoa chốt 27/10/2026), dùng cho trang quản trị › Phê duyệt.
 * Phiếu chi vận chuyển và phiếu chi nhà cung cấp là tiền đã chi thật nên vẫn tính vào số liệu như cũ; CEO duyệt để xác nhận,
 * không đồng ý thì hủy phiếu ở nút hủy đang có. Phiếu chi thưởng NPP chờ CEO ở routes/bonus.ts (chưa thành "đã chi" tới khi CEO duyệt).
 */
export const ceoSpendRoutes = new Hono<AppEnv>();

export async function loadCeoSpend(db: D1Database): Promise<number> {
  const r = await db.prepare('SELECT value_json FROM app_settings WHERE key = ?').bind(CEO_SPEND_KEY).first<{ value_json: string }>();
  return parseCeoSpend(r?.value_json);
}

/** Ngưỡng hiện tại (ai đăng nhập cũng đọc được, để web báo trước "khoản này sẽ chờ chị Hoa duyệt"). */
ceoSpendRoutes.get('/', async (c) => ok(c, { threshold: await loadCeoSpend(c.env.DB) }));

/** Danh sách đang chờ CEO: chỉ CEO xem. */
ceoSpendRoutes.get('/pending', async (c) => {
  if (c.get('auth').user.role !== 'CEO') return ok(c, []);
  const ship = await c.env.DB.prepare(
    `SELECT 'ship' AS kind, v.id, v.voucher_no AS no, v.voucher_date AS day, v.carrier AS title, v.destination AS sub, v.amount,
            v.created_at, u.display_name AS created_by_name
     FROM shipping_vouchers v LEFT JOIN users u ON u.id = v.created_by
     WHERE v.status = 'OK' AND v.ceo_status = 'CHO' ORDER BY v.created_at`,
  ).all();
  const ncc = await c.env.DB.prepare(
    `SELECT 'ncc' AS kind, p.id, o.no AS no, p.pay_date AS day, s.name AS title, p.note AS sub, p.amount,
            p.created_at, u.display_name AS created_by_name
     FROM po_payments p JOIN suppliers s ON s.id = p.supplier_id LEFT JOIN po_orders o ON o.id = p.po_id LEFT JOIN users u ON u.id = p.created_by
     WHERE p.status = 'OK' AND p.ceo_status = 'CHO' ORDER BY p.created_at`,
  ).all();
  return ok(c, [...(ship.results ?? []), ...(ncc.results ?? [])]);
});

/** CEO duyệt một khoản chi đang chờ. kind: ship (phiếu chi vận chuyển) | ncc (phiếu chi nhà cung cấp). */
ceoSpendRoutes.post('/:kind/:id/approve', async (c) => {
  const auth = c.get('auth');
  if (auth.user.role !== 'CEO') throw forbidden('Khoản chi từ ngưỡng chỉ CEO duyệt');
  const kind = c.req.param('kind');
  const table = kind === 'ship' ? 'shipping_vouchers' : kind === 'ncc' ? 'po_payments' : '';
  if (!table) throw notFound('Không có loại chi này');
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`SELECT status, ceo_status FROM ${table} WHERE id = ?`).bind(id).first<{ status: string; ceo_status: string }>();
  if (!row) throw notFound('Không tìm thấy phiếu chi');
  if (row.status !== 'OK' || row.ceo_status !== 'CHO') throw conflict('BAD_STEP', 'Phiếu này không còn chờ CEO duyệt');
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE ${table} SET ceo_status = 'DUYET', ceo_by = ?, ceo_at = ? WHERE id = ? AND ceo_status = 'CHO'`).bind(auth.user.id, nowIso(), id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'CEO_SPEND_APPROVED',
      entityType: kind === 'ship' ? 'SHIPPING_VOUCHER' : 'PO_PAYMENT',
      entityId: id,
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { id, ceo_status: 'DUYET' });
});

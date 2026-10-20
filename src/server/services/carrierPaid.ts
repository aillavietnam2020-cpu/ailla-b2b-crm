import { vnDate } from '@shared/datetime';
import type { AuthContext } from '../env';
import { badRequest, notFound } from '../lib/http';
import { recordPayment } from './payments';
import { createShippingVoucher } from './shippingVouchers';

/**
 * Công ty miễn ship nhưng khi giao khách trả cước cho nhà xe rồi trừ vào tiền đơn: công ty chỉ nhận một giao dịch đã trừ cước.
 * Một thao tác ghi đủ hai việc để sổ sách khớp:
 *  1) phiếu thu "Bù trừ cước vận chuyển" gắn vào đơn (đơn không còn báo nợ phần cước; kế toán xác nhận như mọi phiếu thu),
 *  2) phiếu chi vận chuyển (chi phí của công ty, hình thức "Khác: khách trả hộ") để báo cáo chi phí vận chuyển đủ.
 */
export async function recordCarrierPaid(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  input: { amount: number; carrier: string; note?: string | null; paid_at?: string },
  ctx: { requestId: string; ip: string | null },
) {
  const o = await db
    .prepare(
      `SELECT o.id, o.order_no, o.customer_id, o.owner_id, o.approval_status, c.name AS customer_name
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ? AND o.deleted_at IS NULL`,
    )
    .bind(orderId)
    .first<{
      id: string;
      order_no: string;
      customer_id: string;
      owner_id: string | null;
      approval_status: string;
      customer_name: string;
    }>();
  if (!o) throw notFound('Không tìm thấy đơn hàng');
  if (auth.scope === 'OWN' && o.owner_id !== auth.user.id) throw notFound('Không tìm thấy đơn hàng');
  if (o.approval_status !== 'APPROVED') {
    throw badRequest('NOT_APPROVED', 'Đơn chưa được duyệt nên chưa ghi nhận cước vận chuyển khách trả hộ.');
  }
  const day = input.paid_at ?? vnDate();
  const noteExtra = (input.note ?? '').trim();
  const explanation = `Khách trả cước nhà xe ${input.carrier} hộ công ty (miễn ship), trừ vào tiền đơn ${o.order_no}.${noteExtra ? ' ' + noteExtra : ''}`;

  const pay = await recordPayment(
    db,
    auth,
    {
      customer_id: o.customer_id,
      amount: input.amount,
      paid_at: day,
      method: 'Bù trừ cước vận chuyển',
      purpose: 'ORDER',
      explanation,
      note: explanation,
      allocations: [{ order_id: o.id, amount: input.amount }],
      // Không có bill để chờ đối chiếu: người có quyền kế toán (Thảo làm thay kế toán) thì xác nhận luôn.
      accounting_confirmed: auth.permissions.includes('order.accounting.confirm'),
    },
    ctx,
  );
  const voucher = await createShippingVoucher(
    db,
    auth,
    {
      voucher_date: day,
      carrier: input.carrier,
      destination: o.customer_name,
      amount: input.amount,
      method: 'KHAC',
      order_refs: o.order_no,
      note: `Khách trả cước hộ, trừ vào tiền đơn (phiếu thu ${pay.id.slice(0, 8)}). ${noteExtra}`.trim(),
    },
    ctx,
  );
  return { payment_id: pay.id, voucher_no: voucher.voucher_no };
}

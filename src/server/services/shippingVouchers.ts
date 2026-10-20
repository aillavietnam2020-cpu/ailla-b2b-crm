import { nowIso, vnDate } from '@shared/datetime';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, conflict } from '../lib/http';
import { newId } from '../lib/ids';

export interface ShippingVoucherInput {
  voucher_date?: string;
  carrier: string;
  destination: string;
  amount: number;
  method: 'TIEN_MAT' | 'CHUYEN_KHOAN' | 'KHAC';
  order_refs: string;
  note: string;
}

/** Lập một phiếu chi vận chuyển, cấp số PCVC + năm tháng + số thứ tự. Dùng chung cho form lập phiếu và nút "khách trả cước hộ". */
export async function createShippingVoucher(
  db: D1Database,
  auth: AuthContext,
  d: ShippingVoucherInput,
  ctx: { requestId: string | null; ip: string | null },
): Promise<{ id: string; voucher_no: string }> {
  const date = d.voucher_date ?? vnDate();
  if (date > vnDate()) throw badRequest('DATE_FUTURE', 'Ngày phiếu không được sau hôm nay');
  const ym = date.slice(2, 4) + date.slice(5, 7);
  const now = nowIso();
  const id = newId();
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM shipping_vouchers WHERE voucher_no LIKE ?')
      .bind(`PCVC${ym}-%`)
      .first<{ n: number }>();
    const no = `PCVC${ym}-${String((row?.n ?? 0) + 1 + attempt).padStart(3, '0')}`;
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO shipping_vouchers (id, voucher_no, voucher_date, carrier, destination, amount, method, order_refs, note, status, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OK', ?, ?)`,
          )
          .bind(id, no, date, d.carrier, d.destination, d.amount, d.method, d.order_refs, d.note, auth.user.id, now),
        auditStatement(db, {
          actorId: auth.user.id,
          action: 'SHIPPING_VOUCHER_CREATED',
          entityType: 'SHIPPING_VOUCHER',
          entityId: no,
          after: { date, carrier: d.carrier, amount: d.amount, method: d.method },
          requestId: ctx.requestId,
          ip: ctx.ip,
        }),
      ]);
      return { id, voucher_no: no };
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e;
    }
  }
  throw conflict('NO_CLASH', 'Không cấp được số phiếu, thử lại');
}

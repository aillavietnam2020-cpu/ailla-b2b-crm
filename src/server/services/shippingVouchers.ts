import { nowIso, vnDate } from '@shared/datetime';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, conflict } from '../lib/http';
import { newId } from '../lib/ids';
import { needsCeo } from '@shared/ceoSpend';
import { loadCeoSpend } from '../routes/ceoSpend';
import { realCeo } from './agentSpend';

export interface ShippingVoucherInput {
  voucher_date?: string;
  carrier: string;
  destination: string;
  amount: number;
  method: 'TIEN_MAT' | 'CHUYEN_KHOAN' | 'KHAC';
  order_refs: string;
  note: string;
  from_account?: string;
  to_bank?: string;
  to_account_no?: string;
  to_account_name?: string;
  receiver?: string;
}

/** Lập một phiếu chi vận chuyển, cấp số PCVC + năm tháng + số thứ tự. Dùng chung cho form lập phiếu và nút "khách trả cước hộ". */
export async function createShippingVoucher(
  db: D1Database,
  auth: AuthContext,
  d: ShippingVoucherInput,
  ctx: { requestId: string | null; ip: string | null },
): Promise<{ id: string; voucher_no: string; ceo_status: string }> {
  const date = d.voucher_date ?? vnDate();
  if (date > vnDate()) throw badRequest('DATE_FUTURE', 'Ngày phiếu không được sau hôm nay');
  const ym = date.slice(2, 4) + date.slice(5, 7);
  const now = nowIso();
  const id = newId();
  // Từ ngưỡng chi (mặc định 5 triệu) mà người lập không phải CEO: phiếu vẫn có hiệu lực, gắn nhãn chờ CEO duyệt.
  const ceo = needsCeo(d.amount, await loadCeoSpend(db), realCeo(auth)) ? 'CHO' : '';
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
            `INSERT INTO shipping_vouchers (id, voucher_no, voucher_date, carrier, destination, amount, method, order_refs, note, status, created_by, created_at,
               from_account, to_bank, to_account_no, to_account_name, receiver, ceo_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OK', ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(id, no, date, d.carrier, d.destination, d.amount, d.method, d.order_refs, d.note, auth.user.id, now,
            d.from_account ?? '', d.to_bank ?? '', d.to_account_no ?? '', d.to_account_name ?? '', d.receiver ?? '', ceo),
        auditStatement(db, {
          actorId: auth.user.id,
          action: 'SHIPPING_VOUCHER_CREATED',
          entityType: 'SHIPPING_VOUCHER',
          entityId: no,
          after: { date, carrier: d.carrier, amount: d.amount, method: d.method, ceo_status: ceo },
          requestId: ctx.requestId,
          ip: ctx.ip,
        }),
      ]);
      return { id, voucher_no: no, ceo_status: ceo };
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e;
    }
  }
  throw conflict('NO_CLASH', 'Không cấp được số phiếu, thử lại');
}

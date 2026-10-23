import { z } from 'zod';

/**
 * Phiếu hàng trả lại (kế toán gọi: phiếu nhập kho hàng bán bị trả lại + giảm trừ công nợ).
 *   Sale tạo → Kho xác nhận đã nhận hàng (còn bán được thì tăng tồn) → Kế toán xác nhận giảm công nợ.
 */
export const RETURN_STATUSES = ['CHO_KHO', 'DA_NHAN_KHO', 'DA_GIAM_NO', 'HUY'] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  CHO_KHO: 'Chờ kho nhận hàng',
  DA_NHAN_KHO: 'Kho đã nhận, chờ kế toán',
  DA_GIAM_NO: 'Đã giảm công nợ',
  HUY: 'Đã huỷ',
};

export const RETURN_CONDITIONS = ['CON_BAN_DUOC', 'HONG'] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];
export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  CON_BAN_DUOC: 'Còn bán được (nhập lại tồn)',
  HONG: 'Hỏng / không bán lại được',
};

export const RETURN_RESOLUTIONS = ['TRU_CONG_NO', 'HOAN_TIEN'] as const;
export type ReturnResolution = (typeof RETURN_RESOLUTIONS)[number];
export const RETURN_RESOLUTION_LABELS: Record<ReturnResolution, string> = {
  TRU_CONG_NO: 'Trừ vào công nợ / bù vào đơn sau',
  HOAN_TIEN: 'Hoàn tiền cho khách',
};

export const returnCreateSchema = z.object({
  customer_id: z.string().min(1, 'Chọn khách hàng'),
  order_id: z.string().min(1).nullable().optional(),
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày trả không hợp lệ').optional(),
  reason: z.string().trim().min(2, 'Ghi lý do trả hàng').max(500),
  note: z.string().trim().max(1000).nullable().optional(),
  /** Hàng lỗi khách không gửi trả về, công ty bù cho khách: không qua kho, kế toán xác nhận thẳng. */
  no_collect: z.boolean().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1),
        qty: z.number().positive('Số lượng trả phải lớn hơn 0').max(1_000_000),
        unit_price: z.number().int('Đơn giá là số nguyên đồng').min(0).max(1_000_000_000).optional(),
        deduction: z.number().int('Khấu trừ là số nguyên đồng').min(0).max(10_000_000_000).optional(),
        line_note: z.string().trim().max(300).nullable().optional(),
      }),
    )
    .min(1, 'Thêm ít nhất một mặt hàng trả')
    .max(100),
});
export type ReturnCreateInput = z.infer<typeof returnCreateSchema>;

export const returnKhoReceiveSchema = z.object({
  lines: z
    .array(
      z.object({
        line_id: z.string().min(1),
        received_qty: z.number().min(0).max(1_000_000),
        condition: z.enum(RETURN_CONDITIONS),
      }),
    )
    .min(1),
  note: z.string().trim().max(500).nullable().optional(),
});
export type ReturnKhoReceiveInput = z.infer<typeof returnKhoReceiveSchema>;

export const returnConfirmSchema = z.object({
  resolution: z.enum(RETURN_RESOLUTIONS),
  /** Kế toán sửa đơn giá / khấu trừ từng dòng trước khi chốt giảm nợ. */
  lines: z
    .array(
      z.object({
        line_id: z.string().min(1),
        unit_price: z.number().int().min(0).max(1_000_000_000),
        deduction: z.number().int().min(0).max(10_000_000_000),
      }),
    )
    .optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
export type ReturnConfirmInput = z.infer<typeof returnConfirmSchema>;

export interface ReturnLineItem {
  id: string;
  product_id: string;
  sku: string;
  product_name: string;
  unit: string | null;
  qty: number;
  unit_price: number;
  deduction: number;
  received_qty: number | null;
  condition: ReturnCondition | null;
  line_note: string | null;
}

export interface ReturnListItem {
  id: string;
  return_no: string;
  customer_id: string;
  customer_name: string;
  order_id: string | null;
  order_no: string | null;
  status: ReturnStatus;
  return_date: string;
  reason: string | null;
  claimed_amount: number;
  credit_amount: number;
  resolution: ReturnResolution | null;
  /** 1 = hàng lỗi không thu về (không qua kho). */
  no_collect?: number;
  created_by_name: string | null;
  created_at: string;
}

export interface ReturnDetail extends ReturnListItem {
  note: string | null;
  kho_by_name: string | null;
  kho_at: string | null;
  kho_note: string | null;
  acct_by_name: string | null;
  acct_at: string | null;
  acct_note: string | null;
  items: ReturnLineItem[];
  log: Array<{ at: string; actor_name: string | null; action: string; note: string | null }>;
}

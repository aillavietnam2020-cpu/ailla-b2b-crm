/**
 * Schema validate dùng chung (zod). Thông báo lỗi viết tiếng Việt để hiển thị thẳng cho người dùng.
 * Backend LUÔN validate lại; không tin dữ liệu từ frontend (mục 11.1).
 */
import { z } from 'zod';
import { ACTIVITY_CHANNELS, CLOSING_RESULTS, CUSTOMER_STAGES } from './enums';

const vndAmount = z
  .number({ invalid_type_error: 'Số tiền phải là số nguyên đơn vị đồng' })
  .int('Số tiền phải là số nguyên đồng, không có phần lẻ')
  .min(0, 'Số tiền không được âm');

export const customerCreateSchema = z.object({
  name: z.string().trim().min(2, 'Tên khách hàng tối thiểu 2 ký tự').max(200),
  phone_text: z
    .string()
    .trim()
    .max(30)
    .optional()
    .nullable(),
  province: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  tier_id: z.string().trim().min(1).optional().nullable(),
  source: z.string().trim().max(100).optional().nullable(),
  stage: z.enum(CUSTOMER_STAGES).optional(),
  potential: z.string().trim().max(200).optional().nullable(),
  interested_products: z.string().trim().max(500).optional().nullable(),
  reorder_cycle_days: z.number().int().min(1).max(365).optional().nullable(),
  next_follow_up_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày chăm sóc tiếp không hợp lệ')
    .optional()
    .nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  owner_id: z.string().trim().min(1).optional().nullable(),
});
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  lost_reason: z.string().trim().max(300).optional().nullable(),
});

export const customerReassignSchema = z.object({
  owner_id: z.string().trim().min(1, 'Phải chọn nhân viên nhận khách'),
  reason: z.string().trim().min(5, 'Bắt buộc ghi lý do chuyển khách (tối thiểu 5 ký tự)'),
});

export const activityCreateSchema = z
  .object({
    channel: z.enum(ACTIVITY_CHANNELS, { errorMap: () => ({ message: 'Chọn hình thức liên hệ' }) }),
    result: z.string().trim().min(1, 'Chọn kết quả liên hệ'),
    content: z.string().trim().min(5, 'Nội dung trao đổi tối thiểu 5 ký tự'),
    next_action: z.string().trim().max(300).optional().nullable(),
    next_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Lịch chăm sóc tiếp không hợp lệ')
      .optional()
      .nullable(),
    reason_code: z.string().trim().max(100).optional().nullable(),
    stage: z.enum(CUSTOMER_STAGES).optional(),
  })
  .superRefine((value, ctx) => {
    const closing = (CLOSING_RESULTS as readonly string[]).includes(value.result);
    if (closing) {
      if (!value.reason_code || value.reason_code.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason_code'],
          message: 'Kết quả Từ chối/Mất khách bắt buộc có mã lý do',
        });
      }
      return;
    }
    // Khách còn mở: bắt buộc có bước tiếp theo và lịch tiếp (mục 7.2, AC-10)
    if (!value.next_action || value.next_action.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_action'],
        message: 'Phải ghi bước tiếp theo cho khách chưa đóng',
      });
    }
    if (!value.next_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_date'],
        message: 'Phải đặt lịch chăm sóc tiếp cho khách chưa đóng',
      });
    }
  });
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;

export const orderItemSchema = z.object({
  product_id: z.string().trim().min(1, 'Thiếu mã sản phẩm'),
  qty: z.number().int('Số lượng phải là số nguyên').min(1, 'Số lượng tối thiểu 1'),
  applied_price: vndAmount.optional().nullable(),
  price_override_reason: z.string().trim().max(300).optional().nullable(),
  /** Hàng tặng khuyến mại: đơn giá 0, không tính vào tiền hàng, không cần duyệt giá. */
  is_gift: z.boolean().optional(),
  promotion_note: z.string().trim().max(200).optional().nullable(),
});

export const orderCreateSchema = z.object({
  customer_id: z.string().trim().min(1, 'Phải chọn khách hàng'),
  order_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày đơn không hợp lệ')
    .optional(),
  items: z.array(orderItemSchema).min(1, 'Đơn phải có ít nhất một dòng sản phẩm'),
  discount_amount: vndAmount.optional(),
  bonus_deduction: vndAmount.optional(),
  shipping_fee: vndAmount.optional(),
  cod_amount: vndAmount.optional(),
  note: z.string().trim().max(1000).optional().nullable(),
  /** Chương trình khuyến mại áp dụng cho đơn (mã nội bộ do công ty đặt). */
  promotion_code: z.string().trim().max(60).optional().nullable(),
  promotion_note: z.string().trim().max(300).optional().nullable(),
});
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const productGroupSchema = z.object({
  code: z.string().trim().min(1, 'Nhập mã nhóm').max(40),
  name: z.string().trim().min(2, 'Nhập tên nhóm').max(120),
});

export const productCreateSchema = z.object({
  sku: z.string().trim().min(1, 'Nhập mã sản phẩm (SKU)').max(60),
  name: z.string().trim().min(2, 'Nhập tên sản phẩm').max(200),
  unit: z.string().trim().max(40).optional().nullable(),
  pack_size: z.string().trim().max(40).optional().nullable(),
  group_id: z.string().trim().max(60).optional().nullable(),
});

export const productUpdateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  unit: z.string().trim().max(40).optional().nullable(),
  pack_size: z.string().trim().max(40).optional().nullable(),
  group_id: z.string().trim().max(60).optional().nullable(),
  active: z.boolean().optional(),
});

export const priceUpsertSchema = z.object({
  product_id: z.string().trim().min(1, 'Thiếu sản phẩm'),
  tier_id: z.string().trim().min(1, 'Thiếu cấp giá'),
  /** null = xoá giá của cấp này (đưa về "Chưa có giá"). */
  amount: vndAmount.nullable(),
  valid_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày hiệu lực không hợp lệ')
    .optional(),
  reason: z.string().trim().max(300).optional().nullable(),
});
export type PriceUpsertInput = z.infer<typeof priceUpsertSchema>;

export const paymentCreateSchema = z.object({
  customer_id: z.string().trim().min(1, 'Phải chọn khách hàng'),
  amount: vndAmount.refine((v) => v > 0, 'Số tiền phải lớn hơn 0'),
  paid_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày nhận tiền không hợp lệ')
    .optional(),
  method: z.string().trim().max(60).optional().nullable(),
  external_receipt_no: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
  accounting_confirmed: z.boolean().optional(),
  /** Phân bổ ngay vào các đơn; để trống nghĩa là "trả nợ chung", vào hàng chờ phân bổ. */
  allocations: z
    .array(
      z.object({
        order_id: z.string().trim().min(1),
        amount: vndAmount.refine((v) => v > 0, 'Số tiền phân bổ phải lớn hơn 0'),
      }),
    )
    .optional(),
});
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

export const accountingConfirmSchema = z.object({
  accounting_status: z.enum(['CHUA_XAC_NHAN', 'DA_XAC_NHAN']),
  note: z.string().trim().max(300).optional().nullable(),
});

export const orderCancelSchema = z.object({
  reason: z.string().trim().min(5, 'Bắt buộc ghi lý do huỷ đơn'),
});

export const orderSubmitSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
});

export const approvalDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: 'Quyết định phải là duyệt hoặc từ chối' }),
  }),
  note: z.string().trim().max(500).optional().nullable(),
});

export const paymentAllocateSchema = z.object({
  allocations: z
    .array(
      z.object({
        order_id: z.string().trim().min(1),
        amount: vndAmount.refine((v) => v > 0, 'Số tiền phân bổ phải lớn hơn 0'),
      }),
    )
    .min(1, 'Phải chọn ít nhất một đơn để phân bổ'),
});

export const deliveryUpdateSchema = z.object({
  delivery_status: z.enum(['CHUA_XUAT', 'DA_XUAT_KHO', 'DA_GIAO', 'HOAN']),
  note: z.string().trim().max(300).optional().nullable(),
});

export const taskCompleteSchema = z.object({
  note: z.string().trim().max(300).optional().nullable(),
});

export const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  stage: z.string().trim().optional(),
  tier_id: z.string().trim().optional(),
  owner_id: z.string().trim().optional(),
  due: z.enum(['today', 'overdue', 'upcoming']).optional(),
  data_quality: z.enum(['OK', 'NEEDS_REVIEW']).optional(),
  debt: z.enum(['exceeded', 'has_debt']).optional(),
  sort: z
    .enum([
      'follow_up',
      'name',
      'name_desc',
      'newest',
      'oldest',
      'last_order',
      'province',
      'tier',
      'stage',
      'owner',
      'debt',
      'revenue',
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
});

/** Chuyển lỗi zod thành map field -> thông báo tiếng Việt cho form. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Các tập giá trị dùng chung cho frontend, backend và import. */

export const ROLES = ['EMPLOYEE', 'MANAGER', 'CEO'] as const;
export type Role = (typeof ROLES)[number];

export const CUSTOMER_STAGES = [
  'NEW',
  'CONSULTING',
  'QUOTED',
  'NEGOTIATING',
  'FIRST_ORDER',
  'REGULAR',
  'DORMANT',
  'LOST',
] as const;
export type CustomerStage = (typeof CUSTOMER_STAGES)[number];

export const STAGE_LABELS: Record<CustomerStage, string> = {
  NEW: 'Mới tiếp cận',
  CONSULTING: 'Đang tư vấn',
  QUOTED: 'Đã gửi báo giá',
  NEGOTIATING: 'Đang đàm phán',
  FIRST_ORDER: 'Đã chốt đơn đầu',
  REGULAR: 'Đang mua đều',
  DORMANT: 'Ngủ đông',
  LOST: 'Mất khách',
};

export const APPROVAL_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type OrderApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const DELIVERY_STATUSES = ['CHUA_XUAT', 'DA_XUAT_KHO', 'DA_GIAO', 'HOAN'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const PAYMENT_STATUSES = ['CHUA_THU', 'THU_MOT_PHAN', 'DA_THU_DU', 'THU_THUA'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ACCOUNTING_STATUSES = ['CHUA_XAC_NHAN', 'DA_XAC_NHAN'] as const;
export type AccountingStatus = (typeof ACCOUNTING_STATUSES)[number];

export const ORDER_STATUS_LABELS = {
  approval: {
    DRAFT: 'Nháp',
    PENDING_APPROVAL: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Từ chối',
    CANCELLED: 'Đã huỷ',
  } as Record<OrderApprovalStatus, string>,
  delivery: {
    CHUA_XUAT: 'Chưa xuất',
    DA_XUAT_KHO: 'Đã xuất kho',
    DA_GIAO: 'Đã giao',
    HOAN: 'Hoàn',
  } as Record<DeliveryStatus, string>,
  payment: {
    CHUA_THU: 'Chưa thu',
    THU_MOT_PHAN: 'Thu một phần',
    DA_THU_DU: 'Đã thu đủ',
    THU_THUA: 'Thu thừa',
  } as Record<PaymentStatus, string>,
  accounting: {
    CHUA_XAC_NHAN: 'Chưa xác nhận',
    DA_XAC_NHAN: 'Đã xác nhận',
  } as Record<AccountingStatus, string>,
};

export const ACTIVITY_CHANNELS = [
  'Gọi điện',
  'Zalo',
  'Messenger',
  'Gặp trực tiếp',
  'Email',
  'Khác',
] as const;

export const ACTIVITY_RESULTS = [
  'Đã trao đổi',
  'Không nghe máy',
  'Hẹn gọi lại',
  'Đã gửi chính sách',
  'Đã gửi báo giá',
  'Đồng ý nhập hàng',
  'Từ chối',
  'Mất khách',
] as const;

/** Kết quả buộc phải có reason_code (mục 7.2). */
export const CLOSING_RESULTS = ['Từ chối', 'Mất khách'] as const;

export const TASK_TYPES = [
  'FOLLOW_UP',
  'REORDER',
  'DEBT',
  'APPROVAL',
  'DATA_QUALITY',
  'FIRST_CONTACT',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const ALERT_CODES = [
  'TASK_OVERDUE',
  'REORDER_DUE',
  'DEBT_LIMIT_EXCEEDED',
  'PROJECTED_DEBT_EXCEEDED',
  'MISSING_PRICE',
  'PRICE_OVERRIDE',
  'ACCOUNTING_PENDING',
  'IMPORT_RECONCILIATION_FAILED',
] as const;
export type AlertCode = (typeof ALERT_CODES)[number];

export const ALERT_LABELS: Record<AlertCode, string> = {
  TASK_OVERDUE: 'Việc chăm sóc quá hạn',
  REORDER_DUE: 'Khách tới chu kỳ tái nhập',
  DEBT_LIMIT_EXCEEDED: 'Vượt hạn mức công nợ chính thức',
  PROJECTED_DEBT_EXCEEDED: 'Vượt hạn mức công nợ dự kiến',
  MISSING_PRICE: 'Mã hàng thiếu giá',
  PRICE_OVERRIDE: 'Giá thoả thuận vượt ngưỡng',
  ACCOUNTING_PENDING: 'Đơn đã giao chưa xác nhận kế toán',
  IMPORT_RECONCILIATION_FAILED: 'Import lệch mốc đối soát',
};

export const APPROVAL_RULES = [
  'PRICE_OVERRIDE',
  'DEBT_LIMIT_EXCEEDED',
  'PROJECTED_DEBT_EXCEEDED',
  'TIER_UNKNOWN',
  'PRICE_VERSION',
] as const;
export type ApprovalRule = (typeof APPROVAL_RULES)[number];

export const AUDIT_ACTIONS = [
  'CUSTOMER_CREATED',
  'CUSTOMER_UPDATED',
  'CUSTOMER_REASSIGNED',
  'CUSTOMER_TIER_CHANGED',
  'ACTIVITY_ADDED',
  'TASK_COMPLETED',
  'PRICE_VERSION_CREATED',
  'PRICE_OVERRIDE_REQUESTED',
  'PRICE_OVERRIDE_APPROVED',
  'PRICE_OVERRIDE_REJECTED',
  'ORDER_CREATED',
  'ORDER_SUBMITTED',
  'ORDER_APPROVED',
  'ORDER_REJECTED',
  'ORDER_CANCELLED',
  'DELIVERY_STATUS_CHANGED',
  'ACCOUNTING_CONFIRMED',
  'PAYMENT_IMPORTED',
  'PAYMENT_ALLOCATED',
  'PAYMENT_REVERSED',
  'IMPORT_PREVIEWED',
  'IMPORT_COMMITTED',
  'IMPORT_ROLLED_BACK',
  'DATA_EXPORTED',
  'USER_LOGGED_IN',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_PASSWORD_RESET',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PAYMENT_RECORDED',
  'SETTING_UPDATED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Thứ tự 8 cấp giá chuẩn (mục 8.1) - dùng cho import/export đúng 8 cột Excel. */
export const TIER_ORDER = [
  'GDKD',
  'TPP',
  'NPP',
  'TONG_DL',
  'DL_C1',
  'DL_C2',
  'DAI_SU',
  'BAN_LE',
] as const;
export type TierCode = (typeof TIER_ORDER)[number];

export const TIER_LABELS: Record<TierCode, string> = {
  GDKD: 'GĐKD',
  TPP: 'TPP',
  NPP: 'NPP',
  TONG_DL: 'Tổng đại lý',
  DL_C1: 'Đại lý cấp 1',
  DL_C2: 'Đại lý cấp 2',
  DAI_SU: 'Đại sứ',
  BAN_LE: 'Bán lẻ',
};

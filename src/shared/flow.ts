/**
 * Luồng đơn B2B qua kho. Bước hiện tại nằm ở orders.kho_status, tách riêng khỏi
 * approval/delivery/payment/accounting để đơn cũ (kho_status = KHONG) không bị ảnh hưởng.
 */
export const KHO_STATUSES = [
  'KHONG',
  'CHO_DIEU_PHOI',
  'CHO_KIEM_KHO',
  'DU_HANG',
  'THIEU_HANG',
  'CHO_HANG',
  'CHO_XUAT',
  'DA_XUAT',
  'CHO_CHOT_TIEN',
  'DA_CHOT_TIEN',
] as const;
export type KhoStatus = (typeof KHO_STATUSES)[number];

/** Người đang phải làm bước kế tiếp (theo chức năng, không gắn tên người). */
export type FlowActor = 'SALE' | 'DIEU_PHOI' | 'KHO' | 'KE_TOAN' | null;

export const KHO_LABELS: Record<KhoStatus, string> = {
  KHONG: '',
  CHO_DIEU_PHOI: 'Chờ điều phối',
  CHO_KIEM_KHO: 'Chờ kho kiểm tồn',
  DU_HANG: 'Kho báo đủ hàng',
  THIEU_HANG: 'Kho báo thiếu hàng',
  CHO_HANG: 'Giữ chờ hàng',
  CHO_XUAT: 'Chờ kho xuất',
  DA_XUAT: 'Đã xuất, chờ xác nhận',
  CHO_CHOT_TIEN: 'Chờ chốt tiền',
  DA_CHOT_TIEN: 'Đã chốt tiền',
};

export const KHO_WAITING: Record<KhoStatus, FlowActor> = {
  KHONG: null,
  CHO_DIEU_PHOI: 'DIEU_PHOI',
  CHO_KIEM_KHO: 'KHO',
  DU_HANG: 'DIEU_PHOI',
  THIEU_HANG: 'SALE',
  CHO_HANG: 'DIEU_PHOI',
  CHO_XUAT: 'KHO',
  DA_XUAT: 'DIEU_PHOI',
  CHO_CHOT_TIEN: 'SALE',
  DA_CHOT_TIEN: 'KE_TOAN',
};

export const ACTOR_LABELS: Record<Exclude<FlowActor, null>, string> = {
  SALE: 'Sale',
  DIEU_PHOI: 'Quản lý điều phối',
  KHO: 'Kế toán kho',
  KE_TOAN: 'Kế toán',
};

/** Các chặng hiển thị trên thanh tiến trình của đơn. */
export const FLOW_STEPS: Array<{ key: string; label: string; statuses: KhoStatus[] }> = [
  { key: 'gui', label: 'Sale gửi đơn', statuses: ['CHO_DIEU_PHOI'] },
  { key: 'kiem', label: 'Kho kiểm tồn', statuses: ['CHO_KIEM_KHO', 'THIEU_HANG', 'CHO_HANG'] },
  { key: 'duyet', label: 'Duyệt + lịch xuất', statuses: ['DU_HANG'] },
  { key: 'xuat', label: 'Kho xuất hàng', statuses: ['CHO_XUAT'] },
  { key: 'xacnhan', label: 'Xác nhận đã xuất', statuses: ['DA_XUAT'] },
  { key: 'tien', label: 'Chốt tiền', statuses: ['CHO_CHOT_TIEN'] },
  { key: 'ketoan', label: 'Kế toán', statuses: ['DA_CHOT_TIEN'] },
];

/** Kết quả kiểm tồn của một dòng đơn (trả về cho kế toán kho khi mở đơn). */
export interface KhoCheckLine {
  product_id: string;
  sku: string;
  name: string;
  /** Số cần, theo đơn vị lẻ của đơn. */
  qty: number;
  /** Mã trong kho (MISA); null nghĩa là chưa đồng bộ mã nên chưa kiểm được. */
  misa_code: string | null;
  misa_name: string | null;
  /** Hệ số quy đổi: 1 đơn vị trên đơn = factor đơn vị trong kho. */
  factor: number;
  need_kho: number;
  stock: number;
  /** Đã giữ cho các đơn khác đã duyệt, chưa xuất. */
  reserved: number;
  /** Còn dùng được = tồn − giữ cho đơn khác. */
  available: number;
  /** Thiếu theo đơn vị kho (0 nếu đủ). */
  short: number;
  /** Số đơn vị kho có thể làm thêm ngay từ BTP/NVL/vỏ/tem hiện có (theo định mức). */
  can_make: number | null;
  missing_components: Array<{ code: string; name: string; unit: string; need: number; have: number }>;
  /** Kết quả kho đã báo trước đó (nếu có). */
  report: { status: 'DU' | 'THIEU'; ok_qty: number | null; eta_date: string | null; note: string | null } | null;
  shipped_qty: number | null;
}

export interface FlowLogEntry {
  id: number;
  at: string;
  actor_name: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
}

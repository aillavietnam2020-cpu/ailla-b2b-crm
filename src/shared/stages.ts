/** Vòng đời khách hàng (mục 7.1) và điều kiện ra/vào từng giai đoạn. */
import { CUSTOMER_STAGES, type CustomerStage } from './enums';

/**
 * Thuc te khach hang khong di theo mot chieu: co khach dang mua deu bong quay lai giai doan
 * dam phan cho don moi, co khach ngu dong roi mua lai. Vi vay cho phep chuyen sang BAT KY
 * giai doan nao, tru mot rang buoc duy nhat: mo lai khach da mat phai do Quan ly.
 */
export const STAGE_FLOW: Record<CustomerStage, CustomerStage[]> = {
  NEW: [...CUSTOMER_STAGES],
  CONSULTING: [...CUSTOMER_STAGES],
  QUOTED: [...CUSTOMER_STAGES],
  NEGOTIATING: [...CUSTOMER_STAGES],
  FIRST_ORDER: [...CUSTOMER_STAGES],
  REGULAR: [...CUSTOMER_STAGES],
  DORMANT: [...CUSTOMER_STAGES],
  LOST: [...CUSTOMER_STAGES],
};

export const STAGE_REQUIREMENTS: Record<CustomerStage, string> = {
  NEW: 'Gán owner, nguồn khách và lịch liên hệ đầu tiên.',
  CONSULTING: 'Ghi nhu cầu, tiềm năng và sản phẩm quan tâm.',
  QUOTED: 'Tạo lịch follow-up sau khi gửi báo giá/chính sách.',
  NEGOTIATING: 'Xác nhận cấp giá, giá áp dụng và hạn mức công nợ.',
  FIRST_ORDER: 'Theo dõi giao/thu và tạo lịch hỏi bán ra.',
  REGULAR: 'Theo dõi chu kỳ tái nhập.',
  DORMANT: 'Tạo chiến dịch phục hồi khách.',
  LOST: 'Ghi lý do mất khách; chỉ Quản lý được mở lại.',
};

export function canTransition(from: CustomerStage, to: CustomerStage): boolean {
  if (from === to) return true;
  return STAGE_FLOW[from].includes(to);
}

/** Chỉ Quản lý/CEO được mở lại khách đã mất (mục 7.1). */
export function requiresManagerToReopen(from: CustomerStage, to: CustomerStage): boolean {
  return from === 'LOST' && to !== 'LOST';
}

/** Giai đoạn còn "mở" - bắt buộc phải có owner và lịch chăm sóc tiếp (mục 7.2). */
export function isOpenStage(stage: CustomerStage): boolean {
  return stage !== 'LOST';
}

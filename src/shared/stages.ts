/** Vòng đời khách hàng (mục 7.1) và điều kiện ra/vào từng giai đoạn. */
import type { CustomerStage } from './enums';

export const STAGE_FLOW: Record<CustomerStage, CustomerStage[]> = {
  NEW: ['CONSULTING', 'LOST'],
  CONSULTING: ['QUOTED', 'LOST'],
  QUOTED: ['NEGOTIATING', 'LOST'],
  NEGOTIATING: ['FIRST_ORDER', 'LOST'],
  FIRST_ORDER: ['REGULAR', 'DORMANT', 'LOST'],
  REGULAR: ['DORMANT', 'LOST'],
  DORMANT: ['REGULAR', 'FIRST_ORDER', 'LOST'],
  LOST: [],
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

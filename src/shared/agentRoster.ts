/** Các agent OpenClaw đang chạy trên VPS (mã = tên agent trong OpenClaw), kèm "hồ sơ nhân sự" hiện trên web. */
export interface AgentProfile {
  id: string;
  name: string;
  /** Chức danh hiện dưới tên. */
  title: string;
  /** Hình minh họa (emoji) và màu khung. */
  emoji: string;
  color: string;
  /** Agent này được đọc gì trên web (khớp bảng phân quyền đã duyệt). */
  quyen: string;
}

export const AGENT_ROSTER: readonly AgentProfile[] = [
  { id: 'main', name: 'AILLA Center', title: 'Thảo · Trợ lý tổng quản', emoji: '🌿', color: '#0f766e', quyen: 'Thấy toàn bộ: đơn, công nợ, kho, Marketing, Công xưởng' },
  { id: 'lead-sale-ailla', name: 'Lead Sale', title: 'Trưởng nhóm Kinh doanh', emoji: '🛒', color: '#2563eb', quyen: 'Đơn hàng, khách và công nợ' },
  { id: 'ke-toan-truong-ailla', name: 'Kế toán trưởng', title: 'Kế toán · Công nợ, đối soát', emoji: '🧾', color: '#7c3aed', quyen: 'Đơn hàng, khách và công nợ' },
  { id: 'ke-toan-kho-ailla', name: 'Kế toán kho', title: 'Kế toán kho', emoji: '📦', color: '#b45309', quyen: 'Kho, đơn đang chờ kho' },
  { id: 'ky-thuat-san-xuat-ailla', name: 'Kỹ thuật sản xuất', title: 'Kỹ thuật · Pha chế, hóa chất', emoji: '🧪', color: '#047857', quyen: 'Kho, hóa chất, phiếu pha chế' },
  { id: 'lead-content-ailla', name: 'Lead Content', title: 'Trưởng nhóm Content', emoji: '✍️', color: '#db2777', quyen: 'Thẻ video team Content, Công xưởng SX video' },
  { id: 'lead-digital-ailla', name: 'Lead Digital', title: 'Trưởng nhóm Digital Marketing', emoji: '📈', color: '#ea580c', quyen: 'Order Digital, số quảng cáo' },
  { id: 'media-ailla-agent', name: 'Media', title: 'Media · Ảnh, video, thiết kế', emoji: '🎬', color: '#9333ea', quyen: 'Thẻ video team Content, Công xưởng SX video' },
  { id: 'duan-ads-agent', name: 'Ads Duẩn', title: 'Chuyên viên Ads · Duẩn', emoji: '🎯', color: '#dc2626', quyen: 'Order Digital, số quảng cáo' },
  { id: 'thaodinh-ads-agent', name: 'Ads Thảo Đinh', title: 'Chuyên viên Ads · Thảo Đinh', emoji: '🎯', color: '#0891b2', quyen: 'Order Digital, số quảng cáo' },
  { id: 'viet-anh-ads-agent', name: 'Ads Việt Anh', title: 'Chuyên viên Ads · Việt Anh', emoji: '🎯', color: '#4f46e5', quyen: 'Order Digital, số quảng cáo' },
  { id: 'zalo-tro-ly-hoa', name: 'Zalo trợ lý', title: 'Trợ lý Zalo của chị Hoa', emoji: '💬', color: '#0284c7', quyen: 'Tạm chưa đọc dữ liệu web' },
];

export const AGENT_IDS: readonly string[] = AGENT_ROSTER.map((a) => a.id);

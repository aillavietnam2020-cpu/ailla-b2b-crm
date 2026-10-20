/** Các agent OpenClaw đang chạy trên VPS (mã = tên agent trong OpenClaw). */
export const AGENT_ROSTER = [
  { id: 'main', name: 'AILLA Center (tổng quản)' },
  { id: 'lead-sale-ailla', name: 'Lead Sale' },
  { id: 'ke-toan-truong-ailla', name: 'Kế toán trưởng' },
  { id: 'ke-toan-kho-ailla', name: 'Kế toán kho' },
  { id: 'ky-thuat-san-xuat-ailla', name: 'Kỹ thuật sản xuất' },
  { id: 'lead-content-ailla', name: 'Lead Content' },
  { id: 'lead-digital-ailla', name: 'Lead Digital' },
  { id: 'media-ailla-agent', name: 'Media' },
  { id: 'duan-ads-agent', name: 'Ads Duẩn' },
  { id: 'thaodinh-ads-agent', name: 'Ads Thảo Đinh' },
  { id: 'viet-anh-ads-agent', name: 'Ads Việt Anh' },
  { id: 'zalo-tro-ly-hoa', name: 'Zalo trợ lý của chị Hoa' },
] as const;

export const AGENT_IDS: readonly string[] = AGENT_ROSTER.map((a) => a.id);

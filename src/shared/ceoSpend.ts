/**
 * Ngưỡng chi phải CEO duyệt (chị Hoa chốt 27/10/2026: khoản chi từ 5 triệu là chị phải duyệt).
 * Ngưỡng lưu ở app_settings (khóa dưới đây), chị đổi ở Cấu hình › Ngưỡng cảnh báo. Không có thì dùng mặc định 5.000.000đ.
 * Khoản dưới ngưỡng giữ quy trình cũ; khoản CEO tự lập / tự duyệt thì không phải chờ.
 */
export const CEO_SPEND_KEY = 'spend.ceo_threshold_vnd';
export const CEO_SPEND_DEFAULT = 5_000_000;

/** Đọc ngưỡng từ giá trị đã lưu (JSON). Số không hợp lệ hoặc âm thì dùng mặc định; 0 nghĩa là tắt ngưỡng. */
export function parseCeoSpend(raw: string | null | undefined): number {
  if (raw == null) return CEO_SPEND_DEFAULT;
  try {
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : CEO_SPEND_DEFAULT;
  } catch {
    return CEO_SPEND_DEFAULT;
  }
}

/** Khoản chi này có phải chờ CEO duyệt không. */
export function needsCeo(amount: number, threshold: number, isCeo: boolean): boolean {
  return !isCeo && threshold > 0 && amount >= threshold;
}

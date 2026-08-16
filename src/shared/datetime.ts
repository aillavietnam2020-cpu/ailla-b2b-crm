/**
 * Quy ước thời gian (mục 14): LƯU UTC, HIỂN THỊ giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7).
 */

export const VN_OFFSET_MINUTES = 7 * 60;

export function nowIso(): string {
  return new Date().toISOString();
}

/** Ngày làm việc theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function vnDate(at: Date | string = new Date()): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  const shifted = new Date(d.getTime() + VN_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export function vnDateOffset(days: number, from: Date | string = new Date()): string {
  const base = typeof from === 'string' ? new Date(from) : from;
  return vnDate(new Date(base.getTime() + days * 86_400_000));
}

/** Đầu ngày Việt Nam quy về UTC ISO (00:00 giờ VN = 17:00 UTC hôm trước). */
export function vnDayStartUtc(dateStr: string): string {
  return new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - VN_OFFSET_MINUTES * 60_000)
    .toISOString();
}

export function vnDayEndUtc(dateStr: string): string {
  return new Date(
    new Date(`${dateStr}T00:00:00.000Z`).getTime() - VN_OFFSET_MINUTES * 60_000 + 86_400_000 - 1,
  ).toISOString();
}

export function formatVnDate(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
}

export function formatVnDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function daysBetween(fromDate: string, toDate: string): number {
  const a = new Date(`${fromDate.slice(0, 10)}T00:00:00.000Z`).getTime();
  const b = new Date(`${toDate.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Chuẩn hoá giá trị ngày lấy từ Excel (serial number hoặc chuỗi dd/mm/yyyy). */
export function normalizeExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return vnDate(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial: ngày 1 = 1900-01-01, có lỗi năm nhuận 1900 nên trừ 2 ngày.
    const ms = (value - 25569) * 86_400_000;
    const d = new Date(Math.round(ms));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const ymd = text.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

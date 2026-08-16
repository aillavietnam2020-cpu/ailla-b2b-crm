/**
 * Tiền luôn là số nguyên đơn vị đồng (VND). Không dùng số thực để tránh sai số.
 */

export function toVndInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value);
  }
  const cleaned = String(value)
    .replace(/[₫đdVNDvnd\s]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(/,(?=\d{3}\b)/g, '')
    .replace(/,/g, '.');
  if (cleaned === '' || cleaned === '-') return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

export function formatVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Chưa có';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return (
    new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(
      amount,
    ) + '₫'
  );
}

/** Chênh lệch phần trăm giữa giá áp dụng và giá chuẩn, làm tròn 2 chữ số. */
export function percentDiff(base: number, applied: number): number {
  if (base <= 0) return applied === base ? 0 : 100;
  return Math.round(((applied - base) / base) * 10000) / 100;
}

export function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

/**
 * Điện thoại LUÔN lưu dạng TEXT (mục 2.1). File Excel cũ có 58 số bị lưu dạng số nên mất số 0 đầu.
 * Quy tắc: khôi phục số 0 đầu khi nhận dạng được đầu số Việt Nam, KHÔNG bịa số cho khách thiếu.
 */

export interface PhoneNormalizeResult {
  /** Giá trị hiển thị/lưu trữ, giữ nguyên định dạng người dùng nhập khi hợp lệ. */
  text: string | null;
  /** Chỉ số để dò trùng: bỏ ký tự không phải chữ số, dạng 0xxxxxxxxx. */
  normalized: string | null;
  /** true khi phải thêm lại số 0 do Excel lưu dạng số. */
  restoredLeadingZero: boolean;
  /** Cần đưa vào hàng chờ kiểm tra (thiếu số hoặc độ dài bất thường). */
  needsReview: boolean;
  note?: string;
}

export function normalizePhone(raw: unknown): PhoneNormalizeResult {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { text: null, normalized: null, restoredLeadingZero: false, needsReview: true, note: 'Thiếu số điện thoại' };
  }

  const wasNumber = typeof raw === 'number';
  const rawText = wasNumber ? String(Math.trunc(raw as number)) : String(raw).trim();
  let digits = rawText.replace(/\D/g, '');
  let restoredLeadingZero = false;

  if (digits.startsWith('84') && digits.length >= 11) {
    digits = '0' + digits.slice(2);
    restoredLeadingZero = true;
  } else if (!digits.startsWith('0') && digits.length === 9) {
    // Trường hợp Excel lưu dạng số: 987214568 -> 0987214568
    digits = '0' + digits;
    restoredLeadingZero = true;
  }

  const valid = /^0\d{9}$/.test(digits);
  return {
    text: rawText.startsWith('0') || !restoredLeadingZero ? (restoredLeadingZero ? digits : rawText) : digits,
    normalized: digits || null,
    restoredLeadingZero,
    needsReview: !valid,
    note: valid ? undefined : `Số điện thoại bất thường (${digits.length} chữ số)`,
  };
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

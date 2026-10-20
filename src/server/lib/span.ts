import { vnDate } from '@shared/datetime';

export interface Span {
  from: string;
  to: string;
  /** Đúng một tháng dương lịch (YYYY-MM) thì có giá trị này, còn lại là null. */
  month: string | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Kỳ xem số liệu từ tham số của trang: "YYYY-MM-DD..YYYY-MM-DD" (đúng khoảng ngày chọn ở thanh trên cùng),
 * "YYYY-MM" (cả tháng), "YYYY" (cả năm); không hợp lệ thì tháng hiện tại.
 */
export function spanOf(param?: string | null): Span {
  const p = (param ?? '').trim();
  const r = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(p);
  if (r && DAY.test(r[1]) && DAY.test(r[2])) {
    const [from, to] = r[1] <= r[2] ? [r[1], r[2]] : [r[2], r[1]];
    return { from, to, month: from.slice(0, 7) === to.slice(0, 7) ? from.slice(0, 7) : null };
  }
  if (/^\d{4}$/.test(p)) return { from: `${p}-01-01`, to: `${p}-12-31`, month: null };
  const m = /^\d{4}-\d{2}$/.test(p) ? p : vnDate().slice(0, 7);
  const [y, mm] = m.split('-').map(Number);
  const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}`, month: m };
}

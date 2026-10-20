/**
 * Khoảng thời gian chọn ở thanh trên cùng của Trang quản trị (Tháng này, Tháng trước, tuần, ngày...) được lưu ở
 * sessionStorage "ailla_period". Các trang CRM nhúng trong khung dùng cùng nguồn gốc nên đọc được, để chọn gì ở trên
 * thì số liệu theo tháng ở đây đổi theo. Khoảng kéo qua nhiều tháng thì lấy tháng của ngày kết thúc.
 */
export function hubPeriodMonth(): string | null {
  try {
    const s = JSON.parse(sessionStorage.getItem('ailla_period') ?? 'null') as {
      from?: string;
      to?: string;
    } | null;
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    let day = s?.to || s?.from;
    // Kỳ kéo tới tương lai (Quý này, Năm nay): xem tháng hiện tại thay vì tháng cuối kỳ chưa có số.
    if (day && day > today && s?.from && s.from <= today) day = today;
    return day && /^\d{4}-\d{2}-\d{2}/.test(day) ? day.slice(0, 7) : null;
  } catch {
    return null;
  }
}

/** Kỳ gửi cho máy chủ: "từ..đến" đúng khoảng ngày đang chọn ở thanh trên cùng. */
export function hubPeriodParam(): string {
  const r = hubPeriodRange();
  return `${r.from}..${r.to}`;
}

/** Nhãn đọc được của kỳ đang chọn: 01/10/2026 – 15/10/2026 (cùng một ngày thì chỉ ghi ngày đó). */
export function hubPeriodLabel(): string {
  const r = hubPeriodRange();
  const f = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  return r.from === r.to ? f(r.from) : `${f(r.from)} – ${f(r.to)}`;
}

/** Khoảng ngày đang chọn ở thanh trên cùng; chưa chọn thì từ đầu tháng này tới hôm nay. */
export function hubPeriodRange(): { from: string; to: string } {
  try {
    const s = JSON.parse(sessionStorage.getItem('ailla_period') ?? 'null') as {
      from?: string;
      to?: string;
    } | null;
    if (s?.from && s?.to && /^\d{4}-\d{2}-\d{2}/.test(s.from) && /^\d{4}-\d{2}-\d{2}/.test(s.to)) {
      return { from: s.from.slice(0, 10), to: s.to.slice(0, 10) };
    }
  } catch {
    /* trình duyệt chặn lưu tạm: dùng mặc định */
  }
  const now = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  return { from: `${now.slice(0, 8)}01`, to: now };
}

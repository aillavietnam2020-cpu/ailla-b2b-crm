/*
 * Phần thuần (không đụng trình duyệt, không đụng mạng) của script tải TikTok hằng ngày:
 * tính ngày theo giờ Việt Nam, lập danh sách việc, đặt tên file, nhận lỗi đăng nhập/xác minh,
 * khung giờ cấm, quyết định bỏ qua việc đã nạp. Có test ở tests/unit/taiTiktokNgay.test.ts.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Ngày giờ Việt Nam (UTC+7) của một thời điểm, ra {y, m, d, dow(0=CN), hh, mm}. */
export function vnParts(now = new Date()) {
  const t = new Date(now.getTime() + 7 * 3600 * 1000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay(), hh: t.getUTCHours(), mm: t.getUTCMinutes() };
}
export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const compact = (iso) => iso.replace(/-/g, '');
export const kyOf = (iso) => iso.slice(0, 7);
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const lastDay = (ky) => ymd(+ky.slice(0, 4), +ky.slice(5), daysInMonth(+ky.slice(0, 4), +ky.slice(5)));
export const firstDay = (ky) => `${ky}-01`;
export function prevKy(ky) {
  let y = +ky.slice(0, 4);
  let m = +ky.slice(5) - 1;
  if (m < 1) { m = 12; y -= 1; }
  return `${y}-${pad(m)}`;
}
/** Hôm qua (theo giờ VN) dạng YYYY-MM-DD. */
export function yesterday(now = new Date()) {
  const p = vnParts(now);
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d) - 86400000);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
/** Mốc 00:00 giờ VN của ngày iso, tính bằng mili giây (dùng trong đường dẫn trang quảng cáo). */
export function msVN(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - 7 * 3600 * 1000;
}

/** Tháng trước chỉ tải lại vào những ngày này (ngày 1–9); ngày 10 luôn chạy bản đủ tháng chốt sổ. */
export const NGAY_THANG_TRUOC = [1, 5];

/**
 * Danh sách việc của một ngày chạy.
 * - Tháng đang chạy: 01 → hết hôm qua (từ ngày 2 trở đi; ngày 1 chưa có ngày nào đủ thì bỏ).
 * - Ngày 10: tháng trước BẢN ĐỦ THÁNG (đơn + quảng cáo trọn tháng, income 01 tháng trước → hết ngày 09 tháng này), làm trước.
 * - Ngày 1 và 5: tháng trước bản giữa tháng (đơn + quảng cáo trọn tháng, income 01 → hôm qua).
 * Mỗi việc: {ky, loai:'giua'|'du', ord:{from,to}, inc:{from,to}, ads:{from,to}, team:{from,to}}.
 */
export function lapViec(now = new Date()) {
  const p = vnParts(now);
  const homQua = yesterday(now);
  const kyNay = ymd(p.y, p.m, 1).slice(0, 7);
  const kyTruoc = prevKy(kyNay);
  const viec = [];
  if (p.d === 10) {
    viec.push({ ky: kyTruoc, loai: 'du', ord: { from: firstDay(kyTruoc), to: lastDay(kyTruoc) }, inc: { from: firstDay(kyTruoc), to: homQua }, ads: { from: firstDay(kyTruoc), to: lastDay(kyTruoc) }, team: { from: firstDay(kyTruoc), to: lastDay(kyTruoc) } });
  } else if (NGAY_THANG_TRUOC.includes(p.d)) {
    viec.push({ ky: kyTruoc, loai: 'giua', ord: { from: firstDay(kyTruoc), to: lastDay(kyTruoc) }, inc: { from: firstDay(kyTruoc), to: homQua }, ads: { from: firstDay(kyTruoc), to: lastDay(kyTruoc) }, team: { from: firstDay(kyTruoc), to: lastDay(kyTruoc) } });
  }
  if (p.d >= 2) {
    const r = { from: firstDay(kyNay), to: homQua };
    viec.push({ ky: kyNay, loai: 'giua', ord: r, inc: r, ads: r, team: r });
  }
  return viec;
}

/** Tên file trong thư mục làm việc, đúng quy ước SKILL.md (ngày YYYYMMDD). */
export function tenFile(loai, from, to) {
  const r = `${compact(from)}-${compact(to)}`;
  return {
    ord: `01_OrderSKUList_${r}.csv`,
    inc: `02_income_${r}.xlsx`,
    ads: `03_CampaignOverview_${r}.xlsx`,
    km: `04_KeyMetrics_${r}.xlsx`,
    live: `05_LivePerformance_${r}.xlsx`,
    vdays: `06_VideoPerformance_${r}.xlsx`,
    videos: `07_VideoList_${r}.xlsx`,
  }[loai];
}

/** Có đang ở khung cấm (7h00–8h30 thứ Hai và ngày 10) của hàng chờ trình duyệt không. */
export function trongKhungCam(now = new Date()) {
  const p = vnParts(now);
  const phut = p.hh * 60 + p.mm;
  return (p.dow === 1 || p.d === 10) && phut >= 7 * 60 && phut < 8 * 60 + 30;
}

/** Nhận ra trang đang đòi đăng nhập / hộp xác minh. Trả 'DANG_NHAP' | 'XAC_MINH' | ''. */
export function nhanLoiTrang(url = '', text = '') {
  const t = String(text).slice(0, 4000);
  if (/\/account\/login|\/login\b|passport|\/signin/i.test(url)) return 'DANG_NHAP';
  if (/xác minh|xác thực|mã xác (minh|thực)|captcha|kéo (qua|mảnh)|verify|security check|nhập mã|OTP/i.test(t)) return 'XAC_MINH';
  if (/đăng nhập (bằng|vào|để)|log in to|sign in to/i.test(t) && !/đăng xuất/i.test(t)) return 'DANG_NHAP';
  return '';
}

/**
 * Có cần làm việc này không, dựa vào bản đã có trên web (một dòng của /api/agent/tiktok/months: {ky, den, locked}).
 * Web tự chặn bản cũ hơn nên đây chỉ để khỏi tải thừa.
 */
export function canLam(viec, daCo, ep = false) {
  if (ep || !daCo) return { lam: true, ly_do: daCo ? 'ép chạy' : 'tháng này chưa có bản nào' };
  if (daCo.locked) return { lam: false, ly_do: 'tháng đã khoá sổ' };
  if (daCo.den === null) return { lam: false, ly_do: 'tháng đã có bản đủ tháng' };
  const den = viec.loai === 'du' ? null : viec.inc.to;
  if (viec.loai === 'giua' && daCo.den && daCo.den >= den) return { lam: false, ly_do: `web đã có số đến ${daCo.den}` };
  return { lam: true, ly_do: 'có số mới hơn' };
}

/** Chọn hàng "tháng" của việc từ danh sách /months. */
export const timThang = (months, ky) => (months || []).find((m) => m.ky === ky) || null;

/** Tin nhắn chị Hoa (đời thường, đủ 3 ý: đang làm gì / kẹt gì / chị làm gì). */
export function tinNhan(loi, { ky, buoc, gio }) {
  const th = `${ky.slice(5)}/${ky.slice(0, 4)}`;
  if (loi === 'DANG_NHAP')
    return `Chị ơi, em đang tải báo cáo TikTok tháng ${th} (${buoc}) thì TikTok Shop bắt đăng nhập lại.\nChị mở Chrome, vào Seller Center TikTok, đăng nhập giúp em (em không tự nhập mật khẩu).\nChị đăng nhập xong thì ngày mai em tự tải tiếp, hoặc chị nhắn "kéo lại TikTok" em tải ngay.`;
  if (loi === 'XAC_MINH')
    return `Chị ơi, em đang tải báo cáo TikTok tháng ${th} (${buoc}) thì TikTok hiện hộp xác minh.\nChị mở Chrome, vào tab TikTok Shop, làm xác minh giúp em.\nChị xong nhắn "kéo lại TikTok" em tải ngay, không thì ngày mai em thử lại.`;
  if (loi === 'MAT_CHROME')
    return `Chị ơi, em đang tải báo cáo TikTok tháng ${th} thì mất kết nối tới Chrome máy chị${gio ? ` lúc ${gio}` : ''}.\nChị nhắn Claude trên máy: "nối lại OpenClaw Chrome cho agent".\nNối xong chị nhắn "kéo lại TikTok", không thì ngày mai em thử lại.`;
  return `Chị ơi, báo cáo TikTok tháng ${th} hôm nay em tải chưa được (${buoc}). Chị không cần làm gì, người làm web sẽ xem.`;
}

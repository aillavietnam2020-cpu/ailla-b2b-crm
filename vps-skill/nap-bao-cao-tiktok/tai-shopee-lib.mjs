/*
 * Phần thuần (không đụng trình duyệt, không đụng mạng) của script tải Shopee hằng ngày (tai-shopee-ngay.mjs):
 * lập việc theo ngày giờ Việt Nam, cắt khoảng Doanh thu ≤ 31 ngày, đặt tên file, nhận hộp mật khẩu / kiểm tra chống máy,
 * khung giờ cấm, tin nhắn cho chị Hoa. Có test ở tests/unit/taiShopeeNgay.test.ts.
 * Cố ý không import từ file TikTok để hai chat sửa không đụng nhau.
 */

const pad = (n) => String(n).padStart(2, '0');

export const SHOPS = [
  { ten: 'aillavn1', nhan: 'thường' },
  { ten: 'aillavn', nhan: 'Mall' },
];
/** Shopee chỉ cho xuất Doanh thu tối đa 31 ngày. */
export const TOI_DA_NGAY_DOANH_THU = 31;
/** Chờ chị xử lý mật khẩu / hộp kiểm tra tối đa bấy nhiêu phút rồi bỏ shop đó. */
export const CHO_CHI_PHUT = 30;
/** Tháng trước chỉ tải bản giữa tháng vào những ngày này (ngày 10 luôn là bản đủ tháng). */
export const NGAY_THANG_TRUOC = [1, 5];

export function vnParts(now = new Date()) {
  const t = new Date(now.getTime() + 7 * 3600 * 1000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay(), hh: t.getUTCHours(), mm: t.getUTCMinutes() };
}
export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const compact = (iso) => iso.replace(/-/g, '');
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const firstDay = (ky) => `${ky}-01`;
export const lastDay = (ky) => ymd(+ky.slice(0, 4), +ky.slice(5), daysInMonth(+ky.slice(0, 4), +ky.slice(5)));
export function prevKy(ky) {
  let y = +ky.slice(0, 4);
  let m = +ky.slice(5) - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${pad(m)}`;
}
export function nextKy(ky) {
  let y = +ky.slice(0, 4);
  let m = +ky.slice(5) + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${pad(m)}`;
}
export function yesterday(now = new Date()) {
  const p = vnParts(now);
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d) - 86400000);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
/** Số ngày gồm cả hai đầu. */
export const soNgay = (from, to) =>
  Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8))) / 86400000) + 1;

/**
 * Cắt khoảng Doanh thu thành các đoạn ≤ 31 ngày, nối liền, không chồng ngày, cắt ở cuối tháng.
 * 01/10 → 09/11 thành 01/10→31/10 và 01/11→09/11 (đúng cách nap-shopee.mjs gộp lại).
 */
export function catDoanhThu(from, to) {
  if (soNgay(from, to) <= TOI_DA_NGAY_DOANH_THU) return [{ from, to }];
  const ky = from.slice(0, 7);
  const cuoi = lastDay(ky);
  if (soNgay(from, cuoi) > TOI_DA_NGAY_DOANH_THU) throw new Error('Đoạn đầu quá 31 ngày');
  return [{ from, to: cuoi }].concat(catDoanhThu(firstDay(nextKy(ky)), to));
}

/**
 * Danh sách việc của một ngày chạy (giống TikTok để chị thấy cùng một nhịp):
 * - Tháng đang chạy: 01 → hết hôm qua (từ ngày 2).
 * - Ngày 10: tháng trước ĐỦ THÁNG: đơn + quảng cáo trọn tháng, Doanh thu 01 tháng trước → hết ngày 09 (cắt 2 file).
 * - Ngày 1 và 5: tháng trước bản giữa tháng (đơn + quảng cáo trọn tháng, Doanh thu 01 → hôm qua).
 * Mỗi việc: {ky, loai:'giua'|'du', ord:{from,to}, ads:{from,to}, inc:[{from,to}…]}.
 */
export function lapViec(now = new Date()) {
  const p = vnParts(now);
  const homQua = yesterday(now);
  const kyNay = ymd(p.y, p.m, 1).slice(0, 7);
  const kyTruoc = prevKy(kyNay);
  const viec = [];
  const thangTruoc = (loai) => {
    const r = { from: firstDay(kyTruoc), to: lastDay(kyTruoc) };
    viec.push({ ky: kyTruoc, loai, ord: r, ads: r, inc: catDoanhThu(r.from, homQua) });
  };
  if (p.d === 10) thangTruoc('du');
  else if (NGAY_THANG_TRUOC.includes(p.d)) thangTruoc('giua');
  if (p.d >= 2) {
    const r = { from: firstDay(kyNay), to: homQua };
    viec.push({ ky: kyNay, loai: 'giua', ord: r, ads: r, inc: catDoanhThu(r.from, r.to) });
  }
  return viec;
}

const r2 = (r) => `${compact(r.from)}-${compact(r.to)}`;
/** Danh sách file cần có của một shop trong một việc (đúng quy ước SKILL.md). */
export function fileCanCo(viec, shop) {
  return [
    { loai: 'ord', ten: `01_DonHang_${shop}_${r2(viec.ord)}.xlsx`, ...viec.ord },
    ...viec.inc.map((r) => ({ loai: 'inc', ten: `02_DoanhThu_${shop}_${r2(r)}.xlsx`, ...r })),
    { loai: 'ads', ten: `03_QuangCao_${shop}_${r2(viec.ads)}.csv`, ...viec.ads },
  ];
}
/** File của shop này trong thư mục mà KHÔNG nằm trong danh sách cần có (bản cũ khác ngày cuối) -> xóa trước khi tải. */
export function fileCuCanXoa(dangCo, canCo, shop) {
  const giu = new Set(canCo.map((f) => f.ten));
  return dangCo.filter((n) => new RegExp(`^0[123]_(DonHang|DoanhThu|QuangCao)_${shop}_`).test(n) && !giu.has(n));
}
/** File còn thiếu (chưa nằm trong thư mục). */
export const fileConThieu = (dangCo, canCo) => canCo.filter((f) => !dangCo.includes(f.ten));

/** Đường dẫn trang Doanh thu theo khoảng ngày. */
export const urlDoanhThu = (from, to) => `https://banhang.shopee.vn/portal/finance/income?type=2&dateRange=${compact(from)}${compact(to)}`;

/** Khung cấm của hàng chờ trình duyệt: 7h00–8h30 thứ Hai và ngày 10. */
export function trongKhungCam(now = new Date()) {
  const p = vnParts(now);
  const phut = p.hh * 60 + p.mm;
  return (p.dow === 1 || p.d === 10) && phut >= 7 * 60 && phut < 8 * 60 + 30;
}

/**
 * Nhận ra trang đang chặn. Trả 'MAT_KHAU' | 'CAPTCHA' | 'DANG_NHAP' | ''.
 * Chỉ NHẬN RA để dừng và nhắn chị; script không bao giờ nhập mật khẩu hay kéo hình.
 */
export function nhanChan(url = '', text = '') {
  const t = String(text).slice(0, 4000);
  if (/shopee\.vn\/verify\/(captcha|traffic)/i.test(url) || /Kéo qua để hoàn thiện|Xác nhận để tiếp tục|kéo mảnh/i.test(t)) return 'CAPTCHA';
  if (/vui lòng nhập mật khẩu|Để đảm bảo tài khoản của bạn luôn an toàn/i.test(t)) return 'MAT_KHAU';
  if (/\/account\/login|\/seller\/login|accounts\.shopee\.vn|\/authenticate/i.test(url)) return 'DANG_NHAP';
  if (/(Đăng nhập|Log ?in)/i.test(t.slice(0, 600)) && /(Mật khẩu|Password)/i.test(t.slice(0, 1200)) && !/Đăng xuất/i.test(t)) return 'DANG_NHAP';
  return '';
}

/** Số ms đợi như người, trong [min,max] giây. rnd mặc định Math.random (để test cho giá trị cố định). */
export const doiNhuNguoi = (minS = 3, maxS = 5, rnd = Math.random) => Math.round((minS + (maxS - minS) * rnd()) * 1000);

const thang = (ky) => `${ky.slice(5)}/${ky.slice(0, 4)}`;
/** Tin nhắn chị Hoa (đời thường: đang làm gì / kẹt gì / chị làm gì). `xem` = đường dẫn xem trình duyệt máy chủ nếu có. */
export function tinNhan(loi, { shop, ky, file, gio, xem }) {
  const doan = xem ? `\nChị mở ${xem} để thấy màn hình Shopee của em.` : '\nChị mở trình duyệt của em trên máy chủ (hoặc nhắn người làm web mở giúp).';
  const dau = `Chị ơi, em đang tải file ${file} tháng ${thang(ky)} của Shopee ${shop}`;
  if (loi === 'MAT_KHAU') return `${dau} thì Shopee đòi nhập mật khẩu.${doan}\nChị nhập mật khẩu giúp em (em không tự nhập). Xong em tự làm tiếp, em chờ đến ${gio}.`;
  if (loi === 'CAPTCHA') return `${dau} thì Shopee hiện hộp kiểm tra kéo mảnh hình.${doan}\nChị kéo mảnh hình vào chỗ trống giúp em (em không tự kéo). Xong em tự làm tiếp, em chờ đến ${gio}.`;
  if (loi === 'DANG_NHAP') return `${dau} thì Shopee bắt đăng nhập lại.${doan}\nChị đăng nhập giúp em (em không tự nhập mật khẩu). Xong em tự làm tiếp, em chờ đến ${gio}.`;
  return `Chị ơi, báo cáo Shopee ${shop} tháng ${thang(ky)} hôm nay em tải chưa được (${file}). Chị không cần làm gì, người làm web sẽ xem.`;
}
export const tinBo = (shop, ky, lyDo) => `Shopee ${shop} tháng ${thang(ky)} em chưa nạp vì ${lyDo}. Chị làm xong rồi nhắn em "kéo lại Shopee", không thì ngày mai em thử lại.`;
export const tinXong = (shop, ky, tomTat) => `Chị ơi, em đã nạp Shopee ${shop} tháng ${thang(ky)} lên web: ${tomTat}.`;

/** Giờ:phút VN của một thời điểm, để ghi vào tin "em chờ đến …". */
export function gioVN(t) {
  const p = vnParts(t);
  return `${pad(p.hh)}:${pad(p.mm)}`;
}

/** Trang đang ở đúng shop chưa (tên đăng nhập đứng riêng, vì aillavn là đầu của aillavn1). */
export const coTenShop = (text, shop) => new RegExp(`(^|[^\\w.-])${shop}(?![\\w-])`, 'i').test(String(text));

/** Ngày YYYY-MM-DD -> DD/MM/YYYY (để gõ vào ô ngày) và kiểm ô ngày đã nhận đúng chưa. */
export const ngayVN = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
export function oNgayDung(giaTri, iso) {
  const v = String(giaTri).replace(/\s/g, '');
  const [y, m, d] = [iso.slice(0, 4), iso.slice(5, 7), iso.slice(8)];
  return new RegExp(`${d}[/.-]${m}[/.-]${y}|${y}[/.-]${m}[/.-]${d}`).test(v);
}

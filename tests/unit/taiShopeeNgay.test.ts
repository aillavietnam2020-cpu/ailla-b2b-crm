import { describe, expect, it } from 'vitest';
// @ts-expect-error file .mjs của VPS, không có kiểu
import * as L from '../../vps-skill/nap-bao-cao-tiktok/tai-shopee-lib.mjs';

const vn = (s: string) => new Date(`${s}+07:00`);

describe('Tải Shopee hằng ngày: ngày, cắt Doanh thu, tên file', () => {
  it('ngày thường: chỉ tháng đang chạy, 01 → hết hôm qua, một file Doanh thu', () => {
    const v = L.lapViec(vn('2026-11-17T03:15:00'));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ ky: '2026-11', loai: 'giua', ord: { from: '2026-11-01', to: '2026-11-16' }, ads: { from: '2026-11-01', to: '2026-11-16' } });
    expect(v[0].inc).toEqual([{ from: '2026-11-01', to: '2026-11-16' }]);
  });
  it('ngày 10: tháng trước ĐỦ THÁNG, Doanh thu cắt 2 file nối liền (01→31/10 và 01→09/11), rồi tháng đang chạy', () => {
    const v = L.lapViec(vn('2026-11-10T03:15:00'));
    expect(v.map((x: any) => [x.ky, x.loai])).toEqual([
      ['2026-10', 'du'],
      ['2026-11', 'giua'],
    ]);
    expect(v[0].ord).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(v[0].ads).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(v[0].inc).toEqual([
      { from: '2026-10-01', to: '2026-10-31' },
      { from: '2026-11-01', to: '2026-11-09' },
    ]);
    expect(v[1].inc).toEqual([{ from: '2026-11-01', to: '2026-11-09' }]);
  });
  it('ngày 01: bỏ tháng đang chạy, tháng trước giữa tháng chỉ một file Doanh thu tới 31', () => {
    const v = L.lapViec(vn('2026-11-01T03:15:00'));
    expect(v.map((x: any) => x.ky)).toEqual(['2026-10']);
    expect(v[0].inc).toEqual([{ from: '2026-10-01', to: '2026-10-31' }]);
  });
  it('ngày 05: tháng trước giữa tháng, Doanh thu 01/10 → 04/11 phải cắt 2 file', () => {
    const v = L.lapViec(vn('2026-11-05T03:15:00'));
    expect(v.map((x: any) => x.ky)).toEqual(['2026-10', '2026-11']);
    expect(v[0].inc).toEqual([
      { from: '2026-10-01', to: '2026-10-31' },
      { from: '2026-11-01', to: '2026-11-04' },
    ]);
  });
  it('mọi đoạn Doanh thu ≤ 31 ngày, nối liền, bắt đầu từ ngày 01 (quét cả năm)', () => {
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 28; d++) {
        const now = vn(`2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T03:15:00`);
        for (const v of L.lapViec(now)) {
          v.inc.forEach((r: any, i: number) => {
            expect(L.soNgay(r.from, r.to)).toBeLessThanOrEqual(31);
            if (i > 0) expect(L.soNgay(v.inc[i - 1].to, r.from)).toBe(2);
          });
          expect(v.inc[0].from).toBe(`${v.ky}-01`);
        }
      }
    }
  });
  it('sang năm: ngày 10/01 chốt tháng 12, Doanh thu qua 09/01', () => {
    const v = L.lapViec(vn('2027-01-10T03:15:00'));
    expect(v[0]).toMatchObject({ ky: '2026-12', loai: 'du' });
    expect(v[0].inc).toEqual([
      { from: '2026-12-01', to: '2026-12-31' },
      { from: '2027-01-01', to: '2027-01-09' },
    ]);
  });
  it('tên file đúng quy ước SKILL.md, 3 loại cho mỗi shop', () => {
    const v = L.lapViec(vn('2026-11-10T03:15:00'))[0];
    expect(L.fileCanCo(v, 'aillavn1').map((f: any) => f.ten)).toEqual([
      '01_DonHang_aillavn1_20261001-20261031.xlsx',
      '02_DoanhThu_aillavn1_20261001-20261031.xlsx',
      '02_DoanhThu_aillavn1_20261101-20261109.xlsx',
      '03_QuangCao_aillavn1_20261001-20261031.csv',
    ]);
  });
  it('tải bù: giữ file đúng khoảng ngày, xóa file cũ khác ngày cuối, chỉ xóa của đúng shop', () => {
    const v = L.lapViec(vn('2026-11-17T03:15:00'))[0];
    const can = L.fileCanCo(v, 'aillavn');
    const co = ['01_DonHang_aillavn_20261101-20261115.xlsx', '01_DonHang_aillavn_20261101-20261116.xlsx', '01_DonHang_aillavn1_20261101-20261115.xlsx'];
    expect(L.fileCuCanXoa(co, can, 'aillavn')).toEqual(['01_DonHang_aillavn_20261101-20261115.xlsx']);
    expect(L.fileConThieu(co, can).map((f: any) => f.loai)).toEqual(['inc', 'ads']);
  });
  it('địa chỉ trang Doanh thu', () => {
    expect(L.urlDoanhThu('2026-10-01', '2026-10-31')).toBe('https://banhang.shopee.vn/portal/finance/income?type=2&dateRange=2026100120261031');
  });
  it('khung cấm 7h–8h30 thứ Hai và ngày 10', () => {
    expect(L.trongKhungCam(vn('2026-11-09T07:30:00'))).toBe(true);
    expect(L.trongKhungCam(vn('2026-11-09T03:15:00'))).toBe(false);
    expect(L.trongKhungCam(vn('2026-11-10T08:00:00'))).toBe(true);
    expect(L.trongKhungCam(vn('2026-11-10T08:31:00'))).toBe(false);
    expect(L.trongKhungCam(vn('2026-11-11T07:30:00'))).toBe(false);
  });
  it('nhận ra hộp mật khẩu, hộp kéo hình, đăng nhập; trang thường thì không', () => {
    expect(L.nhanChan('https://shopee.vn/verify/captcha?x=1', '')).toBe('CAPTCHA');
    expect(L.nhanChan('https://banhang.shopee.vn/portal/finance/income', 'Kéo qua để hoàn thiện bức hình')).toBe('CAPTCHA');
    expect(L.nhanChan('https://banhang.shopee.vn/portal/finance/income', 'Để đảm bảo tài khoản của bạn luôn an toàn, vui lòng nhập mật khẩu')).toBe('MAT_KHAU');
    expect(L.nhanChan('https://accounts.shopee.vn/signin', '')).toBe('DANG_NHAP');
    expect(L.nhanChan('https://banhang.shopee.vn/portal/finance/income', 'Doanh thu Đã thanh toán Xuất Đăng xuất')).toBe('');
  });
  it('đợi như người nằm trong 3–5 giây', () => {
    expect(L.doiNhuNguoi(3, 5, () => 0)).toBe(3000);
    expect(L.doiNhuNguoi(3, 5, () => 1)).toBe(5000);
  });
  it('tin nhắn nói đủ: shop, tháng, chờ tới mấy giờ, không tự nhập', () => {
    const t = L.tinNhan('MAT_KHAU', { shop: 'aillavn', ky: '2026-10', file: 'Doanh thu', gio: '03:45' });
    expect(t).toContain('Shopee aillavn');
    expect(t).toContain('10/2026');
    expect(t).toContain('03:45');
    expect(t).toContain('không tự nhập');
  });
});

describe('Tải Shopee: nhận shop và ô ngày', () => {
  it('aillavn không nhầm với aillavn1', () => {
    expect(L.coTenShop('Kênh Người Bán · aillavn1 · Đăng xuất', 'aillavn')).toBe(false);
    expect(L.coTenShop('Kênh Người Bán · aillavn1 · Đăng xuất', 'aillavn1')).toBe(true);
    expect(L.coTenShop('shop: aillavn (Mall)', 'aillavn')).toBe(true);
  });
  it('gõ ngày DD/MM/YYYY và kiểm lại ô ngày', () => {
    expect(L.ngayVN('2026-10-01')).toBe('01/10/2026');
    expect(L.oNgayDung('01/10/2026 - 31/10/2026', '2026-10-31')).toBe(true);
    expect(L.oNgayDung('2026-10-01', '2026-10-01')).toBe(true);
    expect(L.oNgayDung('02/10/2026', '2026-10-01')).toBe(false);
  });
});

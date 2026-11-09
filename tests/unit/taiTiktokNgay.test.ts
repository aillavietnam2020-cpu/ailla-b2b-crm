import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
// @ts-expect-error file .mjs của VPS, không có kiểu
import * as L from '../../vps-skill/nap-bao-cao-tiktok/tai-tiktok-lib.mjs';

/** Giờ Việt Nam -> thời điểm (để test không phụ thuộc múi giờ máy). */
const vn = (s: string) => new Date(`${s}+07:00`);

describe('Tải TikTok hằng ngày: ngày và tên file', () => {
  it('ngày thường (giữa tháng): chỉ tháng đang chạy, 01 → hết hôm qua', () => {
    const v = L.lapViec(vn('2026-11-17T06:30:00'));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ ky: '2026-11', loai: 'giua', ord: { from: '2026-11-01', to: '2026-11-16' }, inc: { from: '2026-11-01', to: '2026-11-16' }, ads: { from: '2026-11-01', to: '2026-11-16' } });
  });
  it('ngày 01: tháng đang chạy chưa có ngày nào đủ thì bỏ, chỉ làm tháng trước (giữa tháng, trọn tháng)', () => {
    const v = L.lapViec(vn('2026-11-01T06:30:00'));
    expect(v.map((x: any) => x.ky)).toEqual(['2026-10']);
    expect(v[0]).toMatchObject({ loai: 'giua', ord: { from: '2026-10-01', to: '2026-10-31' }, inc: { from: '2026-10-01', to: '2026-10-31' } });
  });
  it('ngày 10: tháng trước ĐỦ THÁNG (income tới hết ngày 09 tháng này) làm trước, rồi tháng đang chạy tới ngày 09', () => {
    const v = L.lapViec(vn('2026-11-10T06:30:00'));
    expect(v.map((x: any) => [x.ky, x.loai])).toEqual([['2026-10', 'du'], ['2026-11', 'giua']]);
    expect(v[0]).toMatchObject({ ord: { from: '2026-10-01', to: '2026-10-31' }, ads: { from: '2026-10-01', to: '2026-10-31' }, inc: { from: '2026-10-01', to: '2026-11-09' } });
    expect(v[1].ord).toEqual({ from: '2026-11-01', to: '2026-11-09' });
  });
  it('ngày 2–9 không phải 5: chỉ tháng đang chạy; ngày 5 thêm tháng trước', () => {
    expect(L.lapViec(vn('2026-11-03T06:30:00')).map((x: any) => x.ky)).toEqual(['2026-11']);
    expect(L.lapViec(vn('2026-11-05T06:30:00')).map((x: any) => x.ky)).toEqual(['2026-10', '2026-11']);
  });
  it('sang năm: ngày 01/01 làm tháng 12 năm trước; ngày 10/01 chốt tháng 12', () => {
    expect(L.lapViec(vn('2027-01-01T06:30:00'))[0]).toMatchObject({ ky: '2026-12', ord: { to: '2026-12-31' } });
    expect(L.lapViec(vn('2027-01-10T06:30:00'))[0]).toMatchObject({ ky: '2026-12', loai: 'du', inc: { to: '2027-01-09' } });
  });
  it('tháng 2 nhuận / không nhuận', () => {
    expect(L.lastDay('2028-02')).toBe('2028-02-29');
    expect(L.lastDay('2026-02')).toBe('2026-02-28');
  });
  it('giờ Việt Nam: 23h UTC ngày 16 đã là ngày 17 ở VN', () => {
    expect(L.vnParts(new Date('2026-11-16T23:30:00Z')).d).toBe(17);
    expect(L.yesterday(new Date('2026-11-16T23:30:00Z'))).toBe('2026-11-16');
  });
  it('tên file đúng quy ước SKILL.md, mốc ms quảng cáo khớp ví dụ trong SKILL', () => {
    expect(L.tenFile('ord', '2026-11-01', '2026-11-16')).toBe('01_OrderSKUList_20261101-20261116.csv');
    expect(L.tenFile('inc', '2026-10-01', '2026-11-09')).toBe('02_income_20261001-20261109.xlsx');
    expect(L.tenFile('ads', '2026-11-01', '2026-11-16')).toBe('03_CampaignOverview_20261101-20261116.xlsx');
    expect(L.msVN('2026-10-01')).toBe(1790787600000);
    expect(L.msVN('2026-10-25')).toBe(1792861200000);
  });
});

describe('Tải TikTok hằng ngày: khung cấm, lỗi trang, bỏ qua việc đã nạp', () => {
  it('khung cấm 7h–8h30 thứ Hai và ngày 10', () => {
    expect(L.trongKhungCam(vn('2026-11-09T07:00:00'))).toBe(true); // thứ Hai
    expect(L.trongKhungCam(vn('2026-11-09T08:29:00'))).toBe(true);
    expect(L.trongKhungCam(vn('2026-11-09T08:30:00'))).toBe(false);
    expect(L.trongKhungCam(vn('2026-11-09T06:30:00'))).toBe(false);
    expect(L.trongKhungCam(vn('2026-11-10T07:30:00'))).toBe(true); // ngày 10
    expect(L.trongKhungCam(vn('2026-11-17T07:30:00'))).toBe(false); // thứ Ba thường
  });
  it('nhận ra đăng nhập lại và hộp xác minh, trang thường thì để qua', () => {
    expect(L.nhanLoiTrang('https://seller-vn.tiktok.com/account/login', '')).toBe('DANG_NHAP');
    expect(L.nhanLoiTrang('https://seller-vn.tiktok.com/order', 'Vui lòng xác minh bạn không phải người máy')).toBe('XAC_MINH');
    expect(L.nhanLoiTrang('https://seller-vn.tiktok.com/order', 'Đơn hàng\nTất cả\nĐăng xuất')).toBe('');
  });
  it('bỏ qua việc đã nạp: khoá sổ, đã đủ tháng, số mới hơn mới làm', () => {
    const v = L.lapViec(vn('2026-11-17T06:30:00'))[0];
    expect(L.canLam(v, null).lam).toBe(true);
    expect(L.canLam(v, { ky: '2026-11', den: '2026-11-16', locked: false }).lam).toBe(false);
    expect(L.canLam(v, { ky: '2026-11', den: '2026-11-15', locked: false }).lam).toBe(true);
    expect(L.canLam(v, { ky: '2026-11', den: '2026-11-16', locked: false }, true).lam).toBe(true);
    expect(L.canLam(v, { ky: '2026-11', den: null, locked: false }).lam).toBe(false);
    expect(L.canLam(v, { ky: '2026-11', den: '2026-11-01', locked: true }).lam).toBe(false);
    const du = L.lapViec(vn('2026-11-10T06:30:00'))[0];
    expect(L.canLam(du, { ky: '2026-10', den: '2026-11-04', locked: false }).lam).toBe(true);
    expect(L.canLam(du, { ky: '2026-10', den: null, locked: false }).lam).toBe(false);
  });
  it('tin nhắn chị đời thường, đủ 3 ý, không quá 5 dòng', () => {
    for (const loai of ['DANG_NHAP', 'XAC_MINH', 'MAT_CHROME']) {
      const t = L.tinNhan(loai, { ky: '2026-11', buoc: 'file đơn hàng' });
      expect(t.split('\n').length).toBeLessThanOrEqual(5);
      expect(t).toContain('Chị ơi');
    }
  });
});

describe('Lệnh tai-tiktok-ngay --ke-hoach', () => {
  it('in kế hoạch ngày 10 mà không đụng trình duyệt hay mạng', () => {
    const out = execFileSync('node', ['vps-skill/nap-bao-cao-tiktok/tai-tiktok-ngay.mjs', '--ke-hoach', '--ngay', '2026-11-10'], { encoding: 'utf8' });
    expect(out).toContain('ĐỦ THÁNG chốt sổ');
    expect(out).toContain('01_OrderSKUList_20261001-20261031.csv');
    expect(out).toContain('02_income_20261001-20261109.xlsx');
  });
});

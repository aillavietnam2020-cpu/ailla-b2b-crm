import { describe, expect, it } from 'vitest';
import {
  ccViewer,
  dayRule,
  daysOf,
  distanceM,
  lichOf,
  nearest,
  normalizeSettings,
  tongNgay,
  tongThang,
  vnMinutes,
  type Lich,
} from '../../src/server/services/chamCong';

const s = normalizeSettings({ diem: [{ id: 'vp', ten: 'Văn phòng', lat: 21.0285, lng: 105.8542, bk: 150 }] });
const vp = s.lich.find((l) => l.id === 'vp') as Lich;
const xuong = s.lich.find((l) => l.id === 'xuong') as Lich;
const sale = s.lich.find((l) => l.id === 'sale') as Lich;
// 2026-11-04 thứ Tư; thứ Bảy trong tháng 11/2026: 07 (thứ 1), 14 (thứ 2), 21 (thứ 3), 28 (thứ 4); 08 Chủ nhật. Giờ VN = UTC + 7.
const vn = (ngay: string, hm: string) => new Date(Date.parse(`${ngay}T${hm}:00Z`) - 7 * 3600e3).toISOString();
const ngay = (n: string, vao: string | null, ra: string | null, l: Lich = vp, homNay = '2026-11-30') => ({
  ngay: n,
  ...tongNgay(
    [...(vao ? [{ loai: 'vao' as const, at: vn(n, vao), trong: 1 }] : []), ...(ra ? [{ loai: 'ra' as const, at: vn(n, ra), trong: 1 }] : [])],
    l,
    n,
    n === homNay,
  ),
});

describe('chấm công: vị trí', () => {
  it('đo khoảng cách đúng cỡ', () => {
    expect(distanceM(21.0285, 105.8542, 21.0285, 105.8542)).toBe(0);
    const d = distanceM(21.0285, 105.8542, 21.0295, 105.8542); // ~111 m
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(117);
  });
  it('trong / ngoài phạm vi, chưa cài điểm thì không kiểm', () => {
    expect(nearest(s, 21.029, 105.8542).trong).toBe(true);
    expect(nearest(s, 21.04, 105.8542).trong).toBe(false);
    expect(nearest(normalizeSettings({}), 21, 105).trong).toBeNull();
  });
  it('bỏ điểm sai tọa độ, giới hạn bán kính, giờ sai lấy mặc định', () => {
    const x = normalizeSettings({ diem: [{ lat: 200, lng: 1 }, { lat: 21, lng: 105, bk: 5 }, { lat: '', lng: '' }], lich: [{ id: 'a', gioVao: '25:00' }] });
    expect(x.diem).toHaveLength(1);
    expect(x.diem[0].bk).toBe(150);
    expect(x.lich[0].gioVao).toBe('08:00');
    expect(x.macDinh).toBe('a');
    expect(x.pbLich).toEqual({}); // phòng ban trỏ tới lịch không còn thì bỏ
  });
});

describe('chấm công: lịch làm', () => {
  it('mặc định: văn phòng, xưởng theo phòng, người riêng ưu tiên hơn phòng', () => {
    expect(lichOf(s, 'a', 'CM').id).toBe('vp');
    expect(lichOf(s, 'a', 'SX').id).toBe('xuong');
    expect(lichOf({ ...s, nguoiLich: { a: 'live' } }, 'a', 'CM').id).toBe('live');
  });
  it('văn phòng nghỉ thứ Bảy thứ 2 và thứ 4; xưởng làm mọi thứ Bảy; Chủ nhật nghỉ', () => {
    expect(['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'].map((d) => dayRule(vp, d).lam)).toEqual([true, false, true, false]);
    expect(dayRule({ ...vp, thuBay: 'nghi13' }, '2026-11-07').lam).toBe(false);
    expect(dayRule(xuong, '2026-11-14')).toEqual({ lam: true, vao: 480, ra: 1050 });
    expect(dayRule(xuong, '2026-11-08').lam).toBe(false);
  });
  it('đổi giờ Việt Nam', () => {
    expect(vnMinutes(vn('2026-11-04', '08:05'))).toBe(485);
  });
});

describe('chấm công: đi muộn theo thông báo 01102026', () => {
  it('8h05 chưa muộn, 8h06 là muộn 6 phút', () => {
    expect(ngay('2026-11-04', '08:05', '17:30').muon).toBe(0);
    expect(ngay('2026-11-04', '08:06', '17:30').muon).toBe(6);
  });
  it('về trước 17h25 là về sớm; sale và live không tính muộn', () => {
    expect(ngay('2026-11-04', '08:00', '16:30').som).toBe(60);
    expect(ngay('2026-11-04', '10:00', '15:00', sale)).toMatchObject({ muon: 0, som: 0, phut: 300 });
  });
  it('lấy lượt vào sớm nhất; quên chấm ra chỉ tính ngày đã qua', () => {
    const l = [
      { loai: 'vao' as const, at: vn('2026-11-04', '08:20'), trong: 1 },
      { loai: 'vao' as const, at: vn('2026-11-04', '07:55'), trong: 0 },
    ];
    expect(tongNgay(l, vp, '2026-11-04', false)).toMatchObject({ muon: 0, quenRa: true, ngoai: true });
    expect(tongNgay(l, vp, '2026-11-04', true).quenRa).toBe(false);
  });
  it('chuyên cần: muộn + về sớm tối đa 2 lần, nghỉ tối đa 2 ngày (ví dụ C, D trong thông báo)', () => {
    const C = [ngay('2026-11-02', '08:20', '17:30'), ngay('2026-11-03', null, null), ngay('2026-11-04', '08:00', '17:30')];
    expect(tongThang(C, vp, '2026-11-30')).toMatchObject({ muonLan: 1, nghi: 1, chuyenCan: true });
    const D = [ngay('2026-11-02', '08:07', '17:30'), ngay('2026-11-03', '08:08', '17:30'), ngay('2026-11-04', '08:00', '16:00')];
    expect(tongThang(D, vp, '2026-11-30')).toMatchObject({ muonLan: 2, somLan: 1, muon10: 0, chuyenCan: false });
    expect(tongThang([ngay('2026-11-02', '10:00', '15:00', sale)], sale, '2026-11-30').chuyenCan).toBeNull();
    expect(tongThang([ngay('2026-11-02', '08:30', '17:30', xuong)], xuong, '2026-11-30')).toMatchObject({ muonLan: 1, chuyenCan: null });
  });
  it('đếm số lần muộn quá 10 phút; hôm nay chưa chấm không tính nghỉ', () => {
    const t = tongThang([ngay('2026-11-02', '08:11', '17:30'), ngay('2026-11-03', '08:10', '17:30'), ngay('2026-11-04', null, null, vp, '2026-11-04')], vp, '2026-11-04');
    expect(t).toMatchObject({ muonLan: 2, muon10: 1, nghi: 0 });
  });
  it('ngày trong tháng dừng ở hôm nay', () => {
    expect(daysOf('2026-11', '2026-11-04')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
    expect(daysOf('2026-02', '2027-01-01')).toHaveLength(28);
  });
});

describe('chấm công: ai xem được', () => {
  it('CEO, nhân sự xem hết; trưởng nhóm xem phòng mình; nhân viên chỉ của mình', () => {
    expect(ccViewer('a', 'CEO', undefined, false).all).toBe(true);
    expect(ccViewer('a', 'STAFF', { pb: 'HCNS', role: 'nhanvien', hr: true }, true).all).toBe(true);
    expect(ccViewer('a', 'STAFF', { pb: 'KD', role: 'lead', hr: false }, false)).toEqual({ id: 'a', all: false, pb: 'KD' });
    expect(ccViewer('a', 'STAFF', { pb: 'KD', role: 'nhanvien', hr: false }, false)).toEqual({ id: 'a', all: false, pb: null });
  });
});

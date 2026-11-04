import { describe, expect, it } from 'vitest';
import {
  ccViewer,
  dayRule,
  daysOf,
  donNghiTheoNguoi,
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
    expect(dayRule(xuong, '2026-11-14')).toEqual({ lam: true, vao: 480, ra: 1020, tinh: true });
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
    expect(tongThang(D, vp, '2026-11-30')).toMatchObject({ muonLan: 2, somLan: 1, muonNang: 0, chuyenCan: false });
    expect(tongThang([ngay('2026-11-02', '10:00', '15:00', sale)], sale, '2026-11-30').chuyenCan).toBeNull();
    expect(tongThang([ngay('2026-11-02', '08:30', '17:30', xuong)], xuong, '2026-11-30')).toMatchObject({ muonLan: 1, chuyenCan: null });
  });
  it('đếm số lần muộn quá 10 phút; hôm nay chưa chấm không tính nghỉ', () => {
    const t = tongThang([ngay('2026-11-02', '08:11', '17:30'), ngay('2026-11-03', '08:10', '17:30'), ngay('2026-11-04', null, null, vp, '2026-11-04')], vp, '2026-11-04');
    expect(t).toMatchObject({ muonLan: 2, muonNang: 1, nghi: 0 });
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

describe('chấm công: góp ý CEO 04/11', () => {
  const s2 = normalizeSettings({
    diem: [
      { id: 'vp', ten: 'Văn phòng', lat: 21.0285, lng: 105.8542, bk: 150 },
      { id: 'xg', ten: 'Xưởng', lat: 21.1, lng: 105.9, bk: 150 },
    ],
    lich: [
      { id: 'vp', ten: 'Văn phòng', diem: ['vp', 'khong-co'] },
      { id: 'xuong', ten: 'Xưởng', diem: ['xg'] },
      { id: 'sale', ten: 'Sale', kieu: 'tudo' },
    ],
  });
  const L = (id: string) => s2.lich.find((l) => l.id === id) as Lich;
  it('văn phòng và xưởng chấm ở điểm riêng; điểm không còn thì bỏ', () => {
    expect(L('vp').diem).toEqual(['vp']);
    expect(nearest(s2, 21.1, 105.9, L('vp'))).toMatchObject({ trong: false });
    expect(nearest(s2, 21.1, 105.9, L('xuong'))).toMatchObject({ trong: true, diem: { ten: 'Xưởng' } });
    expect(nearest(s2, 21.1, 105.9, L('sale')).trong).toBe(true); // lịch không chọn điểm: mọi điểm
  });
  it('chỉ Sale được chấm ngoài phạm vi', () => {
    expect(L('sale').ngoaiOk).toBe(true);
    expect(L('vp').ngoaiOk).toBe(false);
    expect(normalizeSettings({}).lich.filter((l) => l.ngoaiOk).map((l) => l.id)).toEqual(['sale']);
  });
  it('muộn quá 10 phút không ghi lý do thì cảnh báo; có lý do thì thôi; muộn 8 phút không hỏi', () => {
    const at = vn('2026-11-04', '08:15');
    expect(tongNgay([{ loai: 'vao', at, trong: 1 }], vp, '2026-11-04', true)).toMatchObject({ muon: 15, canhBao: true });
    expect(tongNgay([{ loai: 'vao', at, trong: 1, ly_do_muon: 'Tắc đường' }], vp, '2026-11-04', true)).toMatchObject({ canhBao: false, lyDoMuon: 'Tắc đường' });
    expect(tongNgay([{ loai: 'vao', at: vn('2026-11-04', '08:08'), trong: 1 }], vp, '2026-11-04', true)).toMatchObject({ muon: 8, canhBao: false });
  });
});

describe('chấm công: ca, nghỉ trưa, quy tắc điền được (CEO 04/11)', () => {
  const s3 = normalizeSettings({
    ca: [
      { id: 'toi', ten: 'Ca tối', tu: '19:00', den: '23:00' },
      { id: 'sai', ten: 'Qua đêm', tu: '22:00', den: '06:00' },
    ],
    quyTac: { mocLyDo: 15, mocNang: 20, ccLan: 3, ccNghi: 1 },
  });
  const live = s3.lich.find((l) => l.id === 'live') as Lich;
  const toi = s3.ca[0];
  it('bỏ ca qua đêm (chưa hỗ trợ), quy tắc lấy theo ô điền', () => {
    expect(s3.ca.map((c) => c.id)).toEqual(['toi']);
    expect(s3.quyTac).toMatchObject({ mocLyDo: 15, mocNang: 20, ccLan: 3, ccNghi: 1, tienCC: 200000 });
  });
  it('người làm ca: ngày không xếp ca là nghỉ; có ca thì tính muộn theo giờ ca, kể cả Chủ nhật', () => {
    expect(dayRule(live, '2026-11-04').lam).toBe(false);
    expect(dayRule(live, '2026-11-08', toi)).toEqual({ lam: true, vao: 1140, ra: 1380, tinh: true });
    const d = tongNgay([{ loai: 'vao', at: vn('2026-11-08', '19:12'), trong: 1 }, { loai: 'ra', at: vn('2026-11-08', '23:00'), trong: 1 }], live, '2026-11-08', false, { ca: toi, q: s3.quyTac });
    expect(d).toMatchObject({ muon: 12, ca: 'Ca tối', canhBao: false, phut: 228 });
  });
  it('mốc hỏi lý do và chuyên cần theo quy tắc điền', () => {
    const d = tongNgay([{ loai: 'vao', at: vn('2026-11-04', '08:16'), trong: 1 }], vp, '2026-11-04', true, { q: s3.quyTac });
    expect(d.canhBao).toBe(true);
    const n = [ngay('2026-11-02', '08:30', '17:30'), ngay('2026-11-03', '08:30', '17:30'), ngay('2026-11-04', '08:30', '17:30')];
    expect(tongThang(n, vp, '2026-11-30', s3.quyTac)).toMatchObject({ muonLan: 3, muonNang: 3, chuyenCan: true });
  });
  it('giờ làm trừ nghỉ trưa: văn phòng 8h–17h30 nghỉ 12h–13h30 là 8 giờ; xưởng 8h–17h nghỉ 12h–13h là 8 giờ', () => {
    expect(ngay('2026-11-04', '08:00', '17:30').phut).toBe(480);
    expect(ngay('2026-11-04', '08:00', '17:00', xuong).phut).toBe(480);
    expect(ngay('2026-11-04', '08:00', '11:00').phut).toBe(180);
  });
});

describe('chấm công: ngày nghỉ theo thông báo 01102026 (trừ nghỉ chế độ, lễ tết)', () => {
  it('ngày lễ không phải ngày làm, không tính nghỉ', () => {
    const d = tongNgay([], vp, '2026-11-04', false, { le: true });
    expect(d).toMatchObject({ lam: false, le: true });
  });
  it('đơn phép năm, ốm đã duyệt không tính vào ngày nghỉ; nghỉ không lương vẫn tính', () => {
    const don = donNghiTheoNguoi(
      [{ crm: 'u1', maNS: 'NV01' }],
      [
        { ma: 'NV01', loai: 'Nghỉ phép năm', tu: '2026-11-02', den: '2026-11-03', tt: 'duyet' },
        { ma: 'NV01', loai: 'Nghỉ không lương', tu: '2026-11-04', den: '2026-11-04', tt: 'duyet' },
        { ma: 'NV01', loai: 'Nghỉ ốm', tu: '2026-11-05', den: '2026-11-05', tt: 'cho' },
        { ma: 'NV01', loai: 'Làm thêm giờ (OT)', tu: '2026-11-06', tt: 'duyet' },
      ],
    ).get('u1')!;
    expect([...don.entries()]).toEqual([
      ['2026-11-02', 'Nghỉ phép năm'],
      ['2026-11-03', 'Nghỉ phép năm'],
      ['2026-11-04', 'Nghỉ không lương'],
    ]);
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((n) => ({ ngay: n, ...tongNgay([], vp, n, false, { don: don.get(n) ?? null }) }));
    expect(tongThang(days, vp, '2026-11-30')).toMatchObject({ nghi: 2, nghiPhep: 2, chuyenCan: true });
  });
});

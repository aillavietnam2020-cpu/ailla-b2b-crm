import { describe, expect, it } from 'vitest';
import { normalizeSettings, type Lich } from '../../src/server/services/chamCong';
import { coTheDuyet, donTheoNgay, gioNghi, leadsCuaPhong, sauLeadDuyet, soNgayNghi, trangThaiDau } from '../../src/server/services/nghiPhep';
import { dayRule } from '../../src/server/services/chamCong';

const s = normalizeSettings({});
const vp = s.lich.find((l) => l.id === 'vp') as Lich;
const live = s.lich.find((l) => l.id === 'live') as Lich;

describe('nghỉ phép: số ngày', () => {
  it('bỏ Chủ nhật, thứ Bảy nghỉ (tuần 2 và 4), ngày lễ', () => {
    // 12/11 (T5) → 16/11 (T2): T5, T6, T7 14/11 (thứ Bảy thứ 2: nghỉ), CN, T2 = 3 ngày làm
    expect(soNgayNghi(vp, '2026-11-12', '2026-11-16', 'ca')).toBe(3);
    expect(soNgayNghi(vp, '2026-11-12', '2026-11-16', 'ca', ['2026-11-13'])).toBe(2);
  });
  it('nửa ngày; lịch theo ca tính ngày lịch', () => {
    expect(soNgayNghi(vp, '2026-11-12', '2026-11-12', 'sang')).toBe(0.5);
    expect(soNgayNghi(live, '2026-11-14', '2026-11-15', 'ca')).toBe(2);
    expect(soNgayNghi(vp, '2026-11-15', '2026-11-12', 'ca')).toBe(0);
  });
});

describe('nghỉ phép: ai duyệt', () => {
  const users = { a: { pb: 'CM', role: 'nhanvien' }, l: { pb: 'CM', role: 'lead' }, b: { pb: 'KHO', role: 'nhanvien' } };
  it('có Lead thì chờ Lead; Lead tự gửi hoặc phòng không có Lead thì lên HCNS', () => {
    expect(trangThaiDau(leadsCuaPhong(users, 'CM', 'a').length > 0)).toBe('lead');
    expect(trangThaiDau(leadsCuaPhong(users, 'CM', 'l').length > 0)).toBe('hcns');
    expect(trangThaiDau(leadsCuaPhong(users, 'KHO', 'b').length > 0)).toBe('hcns');
  });
  it('nghỉ từ 3 ngày Lead duyệt xong lên HCNS; dưới 3 ngày, về sớm, OT thì xong', () => {
    expect(sauLeadDuyet('phep', 3, 3)).toBe('hcns');
    expect(sauLeadDuyet('khongluong', 2, 3)).toBe('xong');
    expect(sauLeadDuyet('ot', 5, 3)).toBe('xong');
    expect(sauLeadDuyet('vesom', 0, 3)).toBe('xong');
  });
  it('Lead chỉ duyệt đơn phòng mình ở bước Lead; HCNS duyệt cả hai bước; không ai tự duyệt đơn mình (trừ HCNS)', () => {
    const d = { st: 'lead' as const, user_id: 'a', pb: 'CM' };
    expect(coTheDuyet(d, { id: 'l', hr: false, leadPb: 'CM' })).toBe(true);
    expect(coTheDuyet(d, { id: 'x', hr: false, leadPb: 'KHO' })).toBe(false);
    expect(coTheDuyet({ ...d, st: 'hcns' }, { id: 'l', hr: false, leadPb: 'CM' })).toBe(false);
    expect(coTheDuyet({ ...d, st: 'hcns' }, { id: 'h', hr: true, leadPb: null })).toBe(true);
    expect(coTheDuyet({ ...d, user_id: 'l' }, { id: 'l', hr: false, leadPb: 'CM' })).toBe(false);
    expect(coTheDuyet({ ...d, st: 'xong' }, { id: 'h', hr: true, leadPb: null })).toBe(false);
  });
});

describe('nghỉ phép: đơn theo ngày', () => {
  it('đơn nhiều ngày trải ra từng ngày', () => {
    const m = donTheoNgay([{ loai: 'phep', tu: '2026-11-12', den: '2026-11-13', buoi: 'ca', gio: null }, { loai: 'ot', tu: '2026-11-13', den: '2026-11-13', buoi: 'ca', gio: 3 }]);
    expect([...m.keys()]).toEqual(['2026-11-12', '2026-11-13']);
    expect(m.get('2026-11-13')!.map((x) => x.loai)).toEqual(['phep', 'ot']);
  });
});

import { ketQuaBu, phutChuan, tongNgay, tongThang, type NgayCong } from '../../src/server/services/chamCong';
import { kiemBu, ngayCanBu } from '../../src/server/services/nghiPhep';

describe('làm bù (CEO 06/11)', () => {
  const S = normalizeSettings({});
  const vp = S.lich.find((l) => l.id === 'vp') as Lich;
  const iso = (d: string, hm: string) => new Date(Date.parse(`${d}T${hm}:00Z`) - 7 * 3600e3).toISOString();
  const ngay = (d: string, vao?: string, ra?: string, don?: string) => ({
    ngay: d,
    ...tongNgay(
      [...(vao ? [{ loai: 'vao' as const, at: iso(d, vao), trong: 1 }] : []), ...(ra ? [{ loai: 'ra' as const, at: iso(d, ra), trong: 1 }] : [])],
      vp,
      d,
      false,
      { don: don ?? null },
    ),
  });

  it('liệt kê ngày cần bù: không chấm, nghỉ không lương nửa ngày, đi muộn', () => {
    const L = [ngay('2026-11-03'), ngay('2026-11-04', '13:30', '17:30', 'Nghỉ không lương (sáng)'), ngay('2026-11-05', '08:40', '17:30'), ngay('2026-11-06', '08:00', '17:30'), ngay('2026-11-02', undefined, undefined, 'Nghỉ phép năm')];
    const c = ngayCanBu(L, '2026-11-07');
    expect(c.map((x) => [x.ngay, x.kieu, x.buoi])).toEqual([
      ['2026-11-05', 'gio', 'ca'],
      ['2026-11-04', 'ngay', 'sang'],
      ['2026-11-03', 'ngay', 'ca'],
    ].reverse().reverse().sort((a, b) => (b[0] as string).localeCompare(a[0] as string)));
    expect(c.find((x) => x.ngay === '2026-11-05')?.phut).toBe(40);
  });

  it('kiểm đơn: bù ngày phải vào ngày nghỉ, bù giờ phải ngoài giờ làm và đủ phút', () => {
    const c = { ngay: '2026-11-03', kieu: 'ngay' as const, buoi: 'ca' as const, phut: 0, mo: '' };
    const nghi = { lam: false, vao: 480, ra: 1050 };
    const lam = { lam: true, vao: 480, ra: 1050 };
    expect(kiemBu(c, { ngay: '2026-11-08', buoi: 'ca', tu: '', den: '' }, nghi, '2026-11-06', 30)).toBeNull();
    expect(kiemBu(c, { ngay: '2026-11-10', buoi: 'ca', tu: '', den: '' }, lam, '2026-11-06', 30)).toMatch(/ngày nghỉ/);
    expect(kiemBu(c, { ngay: '2026-12-10', buoi: 'ca', tu: '', den: '' }, nghi, '2026-11-06', 30)).toMatch(/30 ngày/);
    const g = { ngay: '2026-11-05', kieu: 'gio' as const, buoi: 'ca' as const, phut: 90, mo: '' };
    expect(kiemBu(g, { ngay: '2026-11-07', buoi: 'ca', tu: '17:30', den: '19:00' }, lam, '2026-11-06', 30)).toBeNull();
    expect(kiemBu(g, { ngay: '2026-11-07', buoi: 'ca', tu: '17:30', den: '18:30' }, lam, '2026-11-06', 30)).toMatch(/90 phút/);
    expect(kiemBu(g, { ngay: '2026-11-07', buoi: 'ca', tu: '16:00', den: '17:40' }, lam, '2026-11-06', 30)).toMatch(/ngoài giờ làm/);
  });

  it('kết quả bù: đủ, thiếu, không đến, chưa tới ngày', () => {
    const d = { kieu: 'ngay' as const, buoi: 'ca' as const, tu: null, den: null };
    expect(phutChuan(vp)).toBe(480);
    const du = ngay('2026-11-08', '08:00', '17:30');
    expect(ketQuaBu(d, du, vp, '2026-11-08', '2026-11-09')).toBe('du');
    expect(ketQuaBu(d, ngay('2026-11-08', '08:00', '15:00'), vp, '2026-11-08', '2026-11-09')).toBe('thieu');
    expect(ketQuaBu(d, ngay('2026-11-08'), vp, '2026-11-08', '2026-11-09')).toBe('khong');
    expect(ketQuaBu(d, ngay('2026-11-08'), vp, '2026-11-08', '2026-11-07')).toBe('cho');
    const g = { kieu: 'gio' as const, buoi: 'ca' as const, tu: '17:30', den: '19:00' };
    expect(ketQuaBu(g, ngay('2026-11-07', '08:00', '19:02'), vp, '2026-11-07', '2026-11-09')).toBe('du');
    expect(ketQuaBu(g, ngay('2026-11-07', '08:00', '18:20'), vp, '2026-11-07', '2026-11-09')).toBe('thieu');
  });

  it('bù đủ: ngày được bù không tính nghỉ, có công; ngày làm bù không cộng thêm công; bù giờ bỏ vi phạm', () => {
    const t = { ngay: '2026-11-03', ...tongNgay([], vp, '2026-11-03', false, { bu: { kq: 'du', ngay: '2026-11-08', kieu: 'ngay' } }) };
    const b = { ...ngay('2026-11-08', '08:00', '17:30'), lamBu: { cho: '2026-11-03', kieu: 'ngay' as const } } as NgayCong & { ngay: string };
    const m = tongThang([t, b], vp, '2026-11-10');
    expect(m.nghi).toBe(0);
    expect(m.cong).toBe(1);
    expect(m.daBu).toBe(1);
    const chua = tongThang([{ ngay: '2026-11-03', ...tongNgay([], vp, '2026-11-03', false, { bu: { kq: 'thieu', ngay: '2026-11-08', kieu: 'ngay' } }) }], vp, '2026-11-10');
    expect(chua.nghi).toBe(1);
    const muon = { ...ngay('2026-11-05', '08:40', '17:30') };
    const gio = { ngay: '2026-11-05', ...tongNgay([{ loai: 'vao', at: iso('2026-11-05', '08:40'), trong: 1 }, { loai: 'ra', at: iso('2026-11-05', '17:30'), trong: 1 }], vp, '2026-11-05', false, { bu: { kq: 'du', ngay: '2026-11-07', kieu: 'gio' } }) };
    expect(tongThang([muon], vp, '2026-11-10').viPham).toBe(1);
    expect(tongThang([gio], vp, '2026-11-10').viPham).toBe(0);
  });
});

describe('nghỉ theo giờ (CEO 10/11)', () => {
  const r = (d: string) => dayRule(vp, d);
  it('tính giờ trong giờ làm, bỏ giờ nghỉ trưa, quy ra ngày theo giờ chuẩn', () => {
    // văn phòng 08:00–17:30, trưa 12:00–13:30 → 8 giờ chuẩn
    expect(gioNghi(vp, '2026-11-12', '14:00', '16:00', r('2026-11-12'))).toEqual({ gio: 2, soNgay: 0.25 });
    expect(gioNghi(vp, '2026-11-12', '11:00', '14:00', r('2026-11-12'))).toEqual({ gio: 1.5, soNgay: 0.19 });
    expect(gioNghi(vp, '2026-11-12', '07:00', '09:00', r('2026-11-12'))).toEqual({ gio: 1, soNgay: 0.13 });
  });
  it('báo lỗi khi giờ sai, ngoài giờ làm, ngày nghỉ, hoặc nghỉ hết ngày', () => {
    expect(gioNghi(vp, '2026-11-12', '16:00', '14:00', r('2026-11-12'))).toHaveProperty('loi');
    expect(gioNghi(vp, '2026-11-12', '18:00', '19:00', r('2026-11-12'))).toHaveProperty('loi');
    expect(gioNghi(vp, '2026-11-15', '14:00', '16:00', r('2026-11-15'))).toHaveProperty('loi');
    expect(gioNghi(vp, '2026-11-12', '08:00', '17:30', r('2026-11-12'))).toHaveProperty('loi');
  });
});

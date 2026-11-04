import { describe, expect, it } from 'vitest';
import { normalizeSettings, type Lich } from '../../src/server/services/chamCong';
import { coTheDuyet, donTheoNgay, leadsCuaPhong, sauLeadDuyet, soNgayNghi, trangThaiDau } from '../../src/server/services/nghiPhep';

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

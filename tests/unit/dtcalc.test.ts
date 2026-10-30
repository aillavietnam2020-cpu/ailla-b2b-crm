import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Luật doanh thu thực (hub/src/dtcalc.js): chốt ngày 10 tháng sau, dự kiến Facebook, số đã chốt đóng băng. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(
  `${readFileSync('hub/src/dtcalc.js', 'utf8')}
  return {DT_KENH,DT_HOAN_FB,dtNgayChot,dtTrangThai,dtNhan,dtDuKien,dtFbNgay,dtCanChot,dtChon,dtLech,dtNkcKenh,dtChuaDuThang};`,
)();

describe('Doanh thu thực: luật chốt ngày 10', () => {
  it('ngày chốt là ngày 10 tháng sau, kể cả tháng 12', () => {
    expect(T.dtNgayChot('2026-09')).toBe('2026-10-10');
    expect(T.dtNgayChot('2026-12')).toBe('2027-01-10');
  });
  it('trước ngày 10 là chưa chốt, từ ngày 10 là đã chốt', () => {
    expect(T.dtTrangThai('2026-09', '2026-10-09')).toBe('chua');
    expect(T.dtTrangThai('2026-09', '2026-10-10')).toBe('chot');
    expect(T.dtTrangThai('2026-10', '2026-10-27')).toBe('chua');
    expect(T.dtNhan('2026-09', '2026-10-27')).toBe('đã chốt 10/10');
    expect(T.dtNhan('2026-10', '2026-10-27')).toBe('chưa chốt – dự kiến (chốt ngày 10/11)');
  });
  it('chỉ lưu số chốt khi đã tới ngày, chưa có số chốt và có số thật', () => {
    expect(T.dtCanChot('2026-09', '2026-10-27', null, 1_209_555_000)).toBe(true);
    expect(T.dtCanChot('2026-09', '2026-10-27', { dt: 1 }, 1_209_555_000)).toBe(false);
    expect(T.dtCanChot('2026-10', '2026-10-27', null, 733_180_000)).toBe(false);
    expect(T.dtCanChot('2026-09', '2026-10-27', null, null)).toBe(false);
    expect(T.dtCanChot('2026-09', '2026-10-27', null, 0)).toBe(false);
    expect(T.dtCanChot('2026-08', '2026-10-27', null, 851_206_500)).toBe(false);
  });
  it('tháng đã chốt hiện số chốt dù số nguồn đổi; tháng chưa chốt hiện số đang tính', () => {
    const snap = { dt: 1_209_555_000 };
    expect(T.dtChon({ dt: 1_215_000_000 }, snap, '2026-09', '2026-11-02')).toEqual({ dt: 1_209_555_000, frozen: true });
    expect(T.dtChon({ dt: 733_180_000 }, null, '2026-10', '2026-10-27')).toEqual({ dt: 733_180_000, frozen: false });
    expect(T.dtChon({ dt: 5 }, snap, '2026-10', '2026-10-27')).toEqual({ dt: 5, frozen: false });
  });
});

describe('Doanh thu thực: Facebook', () => {
  it('cộng các sale trong ngày, đơn đang giao = chốt − giao − hoàn', () => {
    const a = T.dtFbNgay([
      { tao: 12, huy: 8, giao: 3, hoan: 1, dt: 508000, dtGiao: 409000, hoanDt: 99000 },
      { tao: 5, huy: 0, giao: 2, hoan: 0, dt: 600000, dtGiao: 400000, hoanDt: 0 },
    ]);
    expect(a.dtGiao).toBe(809000);
    expect(a.dang).toBe(200000);
    expect(T.dtFbNgay([]).dang).toBe(0);
  });
  it('dự kiến = giao thành công + đang giao × (1 − 8% hoàn)', () => {
    expect(T.DT_HOAN_FB).toBe(0.08);
    expect(T.dtDuKien(733_180_000, 100_000_000)).toBe(825_180_000);
    expect(T.dtDuKien(100, -5, 0.1)).toBe(100);
  });
  it('tên kênh theo chị Hoa chốt, không ghi B2B / NPP / Gia công', () => {
    expect(T.DT_KENH.map((x: string[]) => x[1])).toEqual(['TikTok Shop', 'Shopee', 'Facebook', 'CSKH cũ', 'Kênh phân phối', 'Kênh OEM']);
    expect(T.dtLech(10, 4)).toBe(6);
    expect(T.dtLech(null, 4)).toBe(null);
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = new Function(`${readFileSync('hub/src/chicalc.js', 'utf8')}
  return {scChungNkc};`)();

describe('Doanh thu thực: chi phí Sổ chi phí bổ thẳng về kênh', () => {
  const LO: Record<string, string> = {
    G01: 'A - Trực tiếp kênh', G05: 'A - Trực tiếp kênh', G06: 'A - Trực tiếp kênh', G09: 'A - Trực tiếp kênh', G12: 'A - Trực tiếp kênh',
    G13: 'C - Chi chung', G17: 'Giá vốn', G20: 'Không tính', G24: 'C - Chi chung',
  };
  const lo = (g: string) => LO[g] || '';
  const nkc = [
    { d: '2026-10-05', k: 'Facebook', g: 'G12', t: 520_000 },
    { d: '2026-10-06', k: 'NPP', g: 'G09', t: 650_000 },
    { d: '2026-10-07', k: 'Sản xuất', g: 'G24', t: 16_000 },
    { d: '2026-10-08', k: 'Facebook', g: 'G01', t: 9_000_000 },
    { d: '2026-10-08', k: 'Facebook', g: 'G05', t: 300_000 },
    { d: '2026-10-08', k: 'NPP', g: 'G05', t: 200_000 },
    { d: '2026-10-08', k: 'TikTok', g: 'G06', t: 5_000_000 },
    { d: '2026-10-09', k: 'Shopee thường', g: 'G17', t: 70_000 },
    { d: '2026-10-09', k: 'Gia công', g: 'G20', t: 80_000 },
    { d: '2026-10-09', k: 'Facebook', g: 'G12', t: 40_000, st: 'Chờ duyệt' },
    { d: '2026-10-10', k: 'Chung', g: 'G13', t: 1_000_000 },
    { d: '2026-09-30', k: 'Facebook', g: 'G12', t: 99_000 },
  ];
  it('lấy dòng bổ về kênh, bỏ quảng cáo, phí sàn, hoa hồng TikTok; ship chỉ bỏ ở kênh bán lẻ', () => {
    const r = T.dtNkcKenh(nkc, '2026-10-01', '2026-10-31', lo);
    expect(r.v).toEqual({ tts: 0, spe: 0, fb: 520_000, b2b: 850_000, gc: 0, sx: 16_000 });
    expect(r.n.b2b).toBe(2);
  });
  it('không trừ hai lần với Chi phí chung (dòng "Chung" chỉ vào chi phí chung, dòng kênh chỉ vào kênh)', () => {
    const k = T.dtNkcKenh(nkc, '2026-10-01', '2026-10-31', lo).v;
    const kenh = k.tts + k.spe + k.fb + k.b2b + k.gc + k.sx;
    const chung = C.scChungNkc(nkc, '2026-10', lo);
    expect(chung).toBe(1_000_000);
    const one = nkc.filter((x) => x.d.startsWith('2026-10') && x.k === 'Chung');
    expect(T.dtNkcKenh(one, '2026-10-01', '2026-10-31', lo).v.fb).toBe(0);
    expect(kenh + chung).toBe(520_000 + 850_000 + 16_000 + 1_000_000);
  });
});

describe('Sàn chỉ tự chốt khi mọi shop có bản đủ tháng', () => {
  it('bản giữa tháng (có ngày "đến") hoặc thiếu shop thì chưa chốt, ghi lý do', () => {
    const full = { dt: 1, den: null };
    expect(T.dtChuaDuThang([{ ten: 'Shopee A', s: full }, { ten: 'Shopee B', s: full }])).toEqual([]);
    const ly = T.dtChuaDuThang([{ ten: 'Shopee A', s: { dt: 1, den: '2026-09-30' } }, { ten: 'Shopee B', s: null }]);
    expect(ly).toEqual(['Shopee A mới có bản đến ngày 30/09/2026, chưa có bản đủ tháng', 'Shopee B chưa tải báo cáo']);
    expect(T.dtChuaDuThang([{ ten: 'TikTok', s: { dt: 1, den: '2026-09-28' } }]).length).toBe(1);
  });
});

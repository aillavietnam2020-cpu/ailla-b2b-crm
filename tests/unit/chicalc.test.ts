import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Chi phí chung của P&L lấy từ Sổ chi phí: hub/src/chicalc.js. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = new Function(`${readFileSync('hub/src/chicalc.js', 'utf8')}\nreturn {scChungNkc};`)();
const LO: Record<string, string> = { G01: 'A - Trực tiếp kênh', G02: 'A - Trực tiếp kênh', G03: 'A - Trực tiếp kênh', G04: 'A - Trực tiếp kênh', G07: 'B - Phòng ban', G09: 'A - Trực tiếp kênh', G13: 'C - Chi chung', G14: 'C - Chi chung', G16: 'B - Phòng ban', G20: 'Không tính', G21: 'C - Chi chung', G23: 'Chờ xác định' };
const lo = (g: string) => LO[g] || '';
const r = (g: string, k: string, t: number, d = '2026-10-05', st = 'Ổn') => ({ g, k, t, d, st });

describe('Chi phí chung P&L từ Sổ chi phí', () => {
  it('lấy dòng Chung nhóm B/C của đúng tháng, gồm lương ghi thật trong sổ', () => {
    const nkc = [r('G13', 'Chung', 1000), r('G21', 'Chung', 500), r('G07', 'Chung', 3000), r('G14', 'Chung', 200, '2026-09-30')];
    expect(C.scChungNkc(nkc, '2026-10', lo)).toBe(4500);
    expect(C.scChungNkc(nkc, '2026-09', lo)).toBe(200);
  });
  it('không trừ hai lần: bỏ quảng cáo, phí sàn, vận chuyển dù bổ vào Chung', () => {
    const nkc = [r('G01', 'Chung', 9e6), r('G02', 'Chung', 8e6), r('G03', 'Chung', 7e6), r('G04', 'Chung', 6e6), r('G09', 'Chung', 5e6), r('G13', 'Chung', 100)];
    expect(C.scChungNkc(nkc, '2026-10', lo)).toBe(100);
  });
  it('bỏ dòng đã bổ về kênh, sản xuất, chờ xác định, không tính, chờ duyệt', () => {
    const nkc = [r('G13', 'Facebook', 1), r('G16', 'Sản xuất', 2), r('G23', 'Chung', 4), r('G20', 'Chung', 8), r('G13', 'Chờ xác định', 16), r('G21', 'Chung', 32, '2026-10-05', 'Chờ duyệt'), r('G21', 'Chung', 64)];
    expect(C.scChungNkc(nkc, '2026-10', lo)).toBe(64);
  });
  it('sổ trống thì 0', () => {
    expect(C.scChungNkc(undefined, '2026-10', lo)).toBe(0);
  });
});

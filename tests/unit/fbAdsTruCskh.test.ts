import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Facebook Ads không gồm đơn CSKH (chị Hoa 16/11/2026): ngày Facebook trừ số đơn CSKH cùng ngày tạo. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(
  `const csFbMinus=d=>d==='2026-11-12'?{tao:1,dt:300000,giao:1,dtGiao:300000,hoan:0}:null;
  ${readFileSync('hub/src/dtcalc.js', 'utf8')}
  return {dtFbNgay};`,
)();

describe('Facebook Ads trừ đơn CSKH', () => {
  it('trừ đúng ngày có đơn CSKH, ngày khác giữ nguyên', () => {
    const L = [{ tao: 10, huy: 0, giao: 4, hoan: 1, dt: 2000000, dtGiao: 900000, hoanDt: 100000 }];
    const a = T.dtFbNgay(L, '2026-11-12');
    expect(a.dtGiao).toBe(600000);
    expect(a.giao).toBe(3);
    expect(a.dt).toBe(1700000);
    expect(a.dang).toBe(1000000);
    expect(T.dtFbNgay(L, '2026-11-13').dtGiao).toBe(900000);
    expect(T.dtFbNgay(L).dtGiao).toBe(900000);
  });
});

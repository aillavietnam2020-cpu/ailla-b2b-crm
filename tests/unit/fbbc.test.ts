import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Trang Facebook bản mới (hub/src/fbbc.js): tỷ lệ hoàn thật, lãi sau quảng cáo theo nhóm hàng, tuần, cảnh báo. Số gần số thật T9/2026. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(`${readFileSync('hub/src/fbbc.js', 'utf8')}
  return {fbbcHoan,fbbcLines,fbbcWeeks,fbbcLast2,fbbcAlerts,fbbcTodo,fbbcLineOf};`)();

const day = (tao: number, chot: number, huy: number, hoan: number, giao: number, dt: number) => [tao, chot, huy, hoan, giao, dt, dt * 1.13, dt * 0.15];
const sep: Record<string, number[]> = {};
for (let d = 1; d <= 30; d++) {
  const w = Math.floor((d - 1) / 7);
  sep['2026-09-' + String(d).padStart(2, '0')] = day(330, 280, 50, w === 3 ? 44 : 30, 250, w === 3 ? 46e6 : 39e6);
}

describe('fbbc: tỷ lệ hoàn thật làm tỷ lệ hoàn dự kiến', () => {
  it('hoàn / (giao + hoàn) của đúng tháng; thiếu số thì null', () => {
    const r = T.fbbcHoan(sep, '2026-09');
    expect(r).toBeCloseTo((30 * 21 + 44 * 7 + 30 * 2) / (30 * 21 + 44 * 7 + 30 * 2 + 250 * 30), 6);
    expect(T.fbbcHoan(sep, '2026-08')).toBeNull();
  });
});

describe('fbbc: lãi sau quảng cáo theo nhóm hàng', () => {
  it('gán sản phẩm theo nhóm hoặc tên, quảng cáo theo mã chiến dịch; dưới hòa vốn và chưa gán mã', () => {
    const prods = [
      { n: 'Túi tẩy lồng giặt Aibio 125g', g: '', q: 100, dt: 538e6, gv: 43e6 },
      { n: 'Tẩy lồng giặt Ailla 300g', g: 'Tẩy lồng giặt', q: 10, dt: 66e6, gv: 7.5e6 },
      { n: 'Tinh dầu sấy luxury (Tím)', g: 'Tinh dầu giặt sấy', q: 10, dt: 197e6, gv: 32e6 },
      { n: 'Nồi điện mini', g: 'Hàng thương mại', q: 1, dt: 5e6, gv: 6e6 },
    ];
    const camps = [
      { prod: 'TLAI', spend: 138e6, rev: 361e6 }, { prod: 'AIBIO', spend: 28e6, rev: 76e6 }, { prod: 'TLG', spend: 52e6, rev: 112e6 },
      { prod: 'TINHDAU', spend: 152e6, rev: 250e6 }, { prod: '', spend: 50e6, rev: 73e6 }, { prod: 'LANDING', spend: 0, rev: 113e6 },
    ];
    const R = T.fbbcLines({ prods, camps, tax: 1.1, ship: 0.117 });
    const tl = R.lines.find((x: { k: string }) => x.k === 'TL');
    expect(tl.dt).toBe(604e6);
    expect(tl.spend).toBe(218e6);
    expect(tl.roas).toBeCloseTo(549 / 218, 6);
    expect(tl.dg).toBe('Gánh được ads');
    const td = R.lines.find((x: { k: string }) => x.k === 'TD');
    expect(td.dg).toBe('Dưới hòa vốn');
    expect(R.lines[R.lines.length - 1].k).toBe('KH');
    expect(R.unk.qcT).toBeCloseTo(55e6, 0);
  });
});

describe('fbbc: tuần và cảnh báo', () => {
  it('so 2 khối 7 ngày đủ số: hoàn tăng, doanh thu tăng', () => {
    const W = T.fbbcWeeks(sep, '2026-09', () => 20e6);
    const L2 = T.fbbcLast2(W);
    expect([L2[0].a, L2[1].a]).toEqual([15, 22]);
    const A = T.fbbcAlerts({ last2: L2, adsMax: 0.38 });
    expect(A.canh[0].t).toContain('Đơn hoàn tăng 46,7%');
    expect(A.canh.some((x: { t: string }) => x.t.startsWith('Quảng cáo'))).toBe(true);
    expect(A.de.some((x: { t: string }) => x.t.startsWith('Doanh thu chốt tuần +'))).toBe(true);
  });
  it('tháng: quảng cáo vượt ngưỡng, hoàn, người hủy cao, đề xuất dồn quảng cáo', () => {
    const L = T.fbbcLines({
      prods: [{ n: 'Lau sàn 5kg', g: 'Lau sàn', q: 1, dt: 123e6, gv: 34e6 }, { n: 'Tinh dầu', g: 'Tinh dầu giặt sấy', q: 1, dt: 197e6, gv: 32e6 }],
      camps: [{ prod: 'LS', spend: 30e6, rev: 140e6 }, { prod: 'TINHDAU', spend: 150e6, rev: 250e6 }], tax: 1.1, ship: 0.117,
    });
    const people = [{ n: 'Mai Hương', tao: 3705, huy: 873, hoan: 252, giao: 2545 }, { n: 'Việt Nam (tài khoản quản lý)', tao: 2000, huy: 100, hoan: 388, giao: 1630 }];
    const A = T.fbbcAlerts({ M: { dt: 1210e6, qcT: 542e6, tao: 10354, huy: 1659, hoan: 1012, giao: 7651 }, L, people, kpi: ['Mai Hương'], adsMax: 0.38 });
    const t = A.canh.map((x: { t: string }) => x.t).join(' | ');
    expect(t).toContain('Quảng cáo 44,8% doanh thu');
    expect(t).toContain('Hoàn 11,7%');
    expect(t).toContain('Mai Hương hủy 23,6%');
    expect(t).toContain('Việt Nam (tài khoản quản lý): hoàn 19,2%');
    expect(t).toContain('Tinh dầu giặt sấy: dưới hòa vốn');
    expect(A.de[0].t).toBe('Dồn quảng cáo sang Lau sàn');
    expect(T.fbbcTodo(A)).toHaveLength(4);
  });
});

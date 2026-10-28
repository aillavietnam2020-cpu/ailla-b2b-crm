import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Trang Shopee bản mới (hub/src/spebc.js): gộp shop, sản phẩm, số tuần, cảnh báo. Số mẫu gần số thật T10/2026 đến 25/10. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(`${readFileSync('hub/src/spebc.js', 'utf8')}
  return {speBcMonth,speBcWeeks,speBcLast2,speBcAlerts,speBcTodo,speBcName,speBcKey,speBcPri};`)();

const day = (dt: number, don: number, ads: number) => [dt, -dt * 0.35, dt * 0.2, dt * 0.45, don, ads];
const days = (w: number[]) => {
  const o: Record<string, number[]> = {};
  for (let d = 1; d <= 28; d++) o['2026-10-' + String(d).padStart(2, '0')] = day(w[Math.floor((d - 1) / 7)], 10, 50000);
  return o;
};
const A1 = {
  ky: '2026-10', shop: 'aillavn1', den: '2026-10-28', dt: 98155491, gv: 19107475, phi: -34114794, lg: 44933222, ads: 16693291, don: 838, mon: 1007,
  hh: 13520000, koc: 31289551, vou: -2194059, dtUocGv: 81598237, fees: [['Hoa hồng cố định', -13314933], ['Hoa hồng affiliate', -2961959]],
  days: days([4e6, 4e6, 4e6, 4e6]),
};
const MALL = {
  ky: '2026-10', shop: 'aillavn', den: '2026-10-28', dt: 96397000, gv: 18766000, phi: -33505000, lg: 44126000, ads: 18473676, don: 788, mon: 925,
  hh: 18958000, koc: 0, vou: 0, dtUocGv: 0, fees: [['Hoa hồng cố định', -14000000]], days: days([4e6, 4e6, 3.6e6, 2.6e6]),
};
const rows1 = [
  { pn: '[ SẢN PHẨM MỚI ] Tinh Dầu Giặt Sấy AILLA 80ml 🧺 Thơm', q: 210, dt: 24327436, lg: 12306436, uoc: true },
  { pn: 'Chai Tẩy Mốc Gioăng', q: 20, dt: 1407495, lg: 326432, uoc: true },
  { pn: 'Body Mist', q: 1, dt: -33737, lg: -118490, uoc: true },
];
const rowsM = [{ pn: '[BÁN CHẠY] Tinh Dầu Giặt Sấy AILLA 80ml 🧺 Thơm', q: 198, dt: 26920000, lg: 13000000, uoc: false }];

describe('spebc: gộp 2 shop', () => {
  it('tổng, phí sàn theo nhóm, so sánh shop, sản phẩm cùng tên ở 2 shop gộp một dòng', () => {
    const M = T.speBcMonth([{ s: A1, rows: rows1 }, { s: MALL, rows: rowsM }]);
    expect(M.dt).toBe(194552491);
    expect(M.lai).toBe(44933222 + 44126000 - 16693291 - 18473676);
    expect(M.fees[0]).toEqual({ n: 'Hoa hồng cố định', t: 27314933 });
    expect(M.hhAff).toBe(2961959);
    expect(M.shops.map((s: { shop: string }) => s.shop)).toEqual(['aillavn1', 'aillavn']);
    expect(M.shops[0].aff).toBe(2961959);
    expect(M.sp[0]).toMatchObject({ n: 'Tinh Dầu Giặt Sấy AILLA 80ml Thơm', q: 408, dg: 'Gánh được ads' });
    expect(Object.keys(M.sp[0].by)).toEqual(['aillavn1', 'aillavn']);
    expect(M.sp.find((p: { n: string }) => p.n === 'Chai Tẩy Mốc Gioăng').dg).toBe('Biên mỏng');
    expect(M.sp.find((p: { n: string }) => p.n === 'Body Mist').pri).toBe('Dừng quảng cáo');
  });
  it('tuần: so 2 khối 7 ngày đủ số; shop giảm quá 25% là cảnh báo đỏ', () => {
    const W = T.speBcWeeks([A1, MALL], '2026-10');
    expect(W.map((w: { a: number }) => w.a)).toEqual([1, 8, 15, 22, 29]);
    const L2 = T.speBcLast2(W);
    expect([L2[0].a, L2[1].a]).toEqual([15, 22]);
    const A = T.speBcAlerts({ last2: L2 });
    expect(A.canh).toHaveLength(1);
    expect(A.canh[0]).toMatchObject({ lv: 'r' });
    expect(A.canh[0].t).toContain('aillavn:');
    expect(T.speBcTodo(A)[0].team).toBe('Team Shopee');
  });
  it('tháng: hủy/hoàn, giá vốn ước, shop thiếu báo cáo, đề xuất quảng cáo và KOC', () => {
    const M = T.speBcMonth([{ s: A1, rows: rows1 }, { s: MALL, rows: rowsM }]);
    const A = T.speBcAlerts({ M, miss: ['khac'], adsMax: 0.38 });
    const t = A.canh.map((x: { t: string }) => x.t).join(' | ');
    expect(t).toContain('aillavn hủy/hoàn 16,4%');
    expect(t).toContain('doanh thu đang ước giá vốn');
    expect(t).toContain('Chưa có báo cáo khac');
    const d = A.de.map((x: { t: string }) => x.t).join(' | ');
    expect(d).toContain('Còn dư địa tăng quảng cáo');
    expect(d).toContain('Mở tiếp thị liên kết cho aillavn');
  });
});

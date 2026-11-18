import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Đối soát tiền về Facebook (hub/src/fbdscalc.js): cách chị Huệ dạy agent kế toán trưởng 18/11/2026. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const F: any = new Function(`${readFileSync('hub/src/fbdscalc.js', 'utf8')}\nreturn {fdsBuild,fdsSummary};`)();

const FB = [
  ['STT', 'Trạng thái VC', 'Mã vận đơn', 'COD', 'Trạng thái', 'Mã đơn hàng đầy đủ', 'Sản phẩm', 'Số lượng', 'Đơn giá'],
  [1, 'Giao hàng thành công', 'SPXVN1', 99000, 'Đã nhận', 'S1', 'Túi tẩy lồng', 3, 50000],
  [null, null, null, null, null, null, 'Hộp', 1, 0], // dòng sản phẩm phụ cùng đơn S1: không cộng COD lần nữa
  [2, 'Giao hàng thành công', '848001', 209000, 'Đã nhận', 'S2', 'Lau sàn 5kg', 1, 209000], // Best, lệch COD
  [3, 'Giao hàng thành công', 'SPXVN3', 149000, 'Đã nhận', 'S3', 'Xịt muỗi', 1, 149000], // chưa về tiền
  [4, 'Đã hoàn', 'SPXVN4', 99000, 'Đã hoàn', 'S4', 'Túi tẩy lồng', 3, 50000], // hoàn: không tính, phí vẫn tính
  [5, 'Giao hàng thành công', 'SPXVN5', 0, 'Đã nhận', 'S5', 'Quà', 1, 0], // hãng trả COD 0: coi như hoàn
];
const SPX = [
  ['Báo cáo tiền về'],
  ['Mã vận đơn', 'Trạng thái vận đơn', 'Tiền thu hộ (VND)(A)', 'Tổng phí phải trả (VND)(C)(1+2+3)', 'Thời gian hoàn thành'],
  ['SPXVN1', 'Đã giao hàng', 99000, 12000, '2026/11/05'],
  ['SPXVN4', 'Hoàn hàng', 0, 15000, '2026/11/06'],
  ['SPXVN5', 'Đã giao hàng', 0, 8000, '2026/11/06'],
];
const BEST = [[['Kỳ 1'], ['Mã vận đơn', 'Số tiền COD trên phiếu thanh toán', 'Tổng cước vận chuyển', 'Trạng thái ký nhận'], ['848001', 200000, 20000, 'Đã ký']]];

describe('đối soát tiền về Facebook', () => {
  it('doanh thu = COD hãng trả của đơn COD > 0, không cộng đơn hoàn / chưa về tiền', () => {
    const R = F.fdsBuild(FB, [{ name: 'SPX TK1.xlsx', rows: SPX }], [{ name: 'Best ông A.xlsx', sheets: BEST }]);
    expect(R.sum.don).toBe(2);
    expect(R.sum.dt).toBe(99000 + 200000);
    expect(R.sum.ship).toBe(12000 + 15000 + 8000 + 20000);
    expect(R.sum.tong).toBe(5);
    expect(R.sum.codFb).toBe(99000 + 209000 + 149000 + 99000);
    expect(R.sum.g.lech[0]).toBe(1);
    expect(R.sum.g.chua[0]).toBe(1);
    expect(R.sum.g.hoan[0]).toBe(1);
    expect(R.sum.g.cod0[0]).toBe(1);
    expect(R.list.find((o: { id: string }) => o.id === 'S2').src).toBe('Best ông A');
    expect(R.list.find((o: { id: string }) => o.id === 'S1').sp.length).toBe(2);
    const s = F.fdsSummary(R, '2026-10', ['a.xlsx']);
    expect(s).toMatchObject({ ky: '2026-10', don: 2, dt: 299000, ship: 55000 });
    expect(JSON.stringify(s)).not.toContain('S1'); // bản lưu không có mã đơn
  });
  it('dùng đơn web kéo hằng ngày thay file đơn FB: cùng kết quả', () => {
    const web = [
      { id: '1', track: 'SPXVN1', cod: 99000, hoan: false },
      { id: '2', track: '848001', cod: 209000, hoan: false },
      { id: '3', track: 'SPXVN3', cod: 149000, hoan: false },
      { id: '4', track: 'SPXVN4', cod: 99000, hoan: true },
      { id: '5', track: 'SPXVN5', cod: 0, hoan: false },
    ];
    const R = F.fdsBuild({ web }, [{ name: 'SPX TK1.xlsx', rows: SPX }], [{ name: 'Best ông A.xlsx', sheets: BEST }]);
    expect(R.sum).toMatchObject({ don: 2, dt: 299000, ship: 55000, tong: 5 });
    expect(R.sum.g.hoan[0]).toBe(1);
    expect(R.sum.g.chua[0]).toBe(1);
  });
  it('báo lỗi khi file đơn FB thiếu cột', () => {
    expect(() => F.fdsBuild([['A', 'B']], [], [])).toThrow(/thiếu cột/);
  });
});

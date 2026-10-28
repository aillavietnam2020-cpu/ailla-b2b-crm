import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/** Báo cáo Shopee (hub/src/specalc.js, dùng hàm đọc chung của ttcalc.js): đọc file Shopee, tính số tháng từng shop. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(
  `${readFileSync('hub/src/ttcalc.js', 'utf8')}${readFileSync('hub/src/specalc.js', 'utf8')}
  return {ttSheets,ttCsv,speKind,speOrderSheet,speReadOrders,speGuessKy,speReadFin,speReadAds,speBuildMonth,speSummary,speRowsPack,speDayd,speCoverage,speKey};`,
)();

const ORD_HEAD = ['Mã đơn hàng', 'Ngày đặt hàng', 'Trạng Thái Đơn Hàng', 'SKU sản phẩm', 'Tên sản phẩm', 'SKU phân loại hàng', 'Tên phân loại hàng',
  'Giá gốc', 'Người bán trợ giá', 'Số lượng', 'Số lượng sản phẩm được hoàn trả', 'Tên Người nhận', 'Số điện thoại'];
const ord = (o: string, day: string, st: string, pn: string, vr: string, goc: number, tro: number, q: number, rq = 0) =>
  [o, `${day} 10:00`, st, '', pn, '', vr, `${goc}.00`, `${tro}.00`, String(q), String(rq), 'N******A', '******90'];
const ordersSheets = () => ({
  orders: [
    ORD_HEAD,
    ord('A1', '2026-09-02', 'Hoàn thành', 'Tẩy lồng', 'Chai 300g', 100000, 20000, 1),
    ord('A1', '2026-09-02', 'Hoàn thành', 'Xịt muỗi', '', 50000, 10000, 2),
    ord('A2', '2026-09-03', 'Đã hủy', 'Tẩy lồng', 'Chai 300g', 100000, 0, 1),
    ord('A3', '2026-09-05', 'Hoàn thành', 'Tẩy lồng', 'Chai 300g', 100000, 0, 1),
    ord('A4', '2026-09-30', 'Đang giao', 'Xịt muỗi', '', 60000, 0, 1),
    ord('B9', '2026-08-31', 'Hoàn thành', 'Xịt muỗi', '', 60000, 0, 1),
  ],
});
const FIN_HEAD = ['Mã giao dịch', 'Đơn hàng / Sản phẩm', 'Mã đơn hàng', 'Ngày đặt hàng', 'Giá sản phẩm', 'Số tiền hoàn lại',
  'Mã ưu đãi do Người Bán chịu', 'Phí cố định', 'Phí Dịch Vụ', 'Phí xử lý giao dịch', 'Phí hoa hồng Tiếp thị liên kết',
  'Phí vận chuyển Người mua trả', 'Phí vận chuyển thực tế', 'Thuế GTGT'];
const finSheets = (to = '2026-10-09') => ({
  Summary: [['Bao cáo doanh thu'], [], ['Người Bán', 'aillavn']],
  Adjustment: [['Ghi chú'], ['Người Bán', 'aillavn'], ['Từ', '2026-09-01', 'Đến', to]],
  'Doanh thu': [
    ['Thông tin đơn hàng'],
    [''],
    FIN_HEAD,
    [1, 'Order', 'A1', '2026-09-02', 160000, 0, -10000, -15000, -5000, -3000, -8000, 6000, -6000, -1000],
    [2, 'Sku', 'A1', '2026-09-02', 160000, 0, -10000, -15000, -5000, -3000, -8000, 6000, -6000, -1000],
    [3, 'Order', 'A3', '2026-09-05', 100000, -100000, 0, 0, 0, 0, 0, 0, -20000, 0],
  ],
});
const adsCsv = () =>
  T.ttCsv(`\uFEFFLịch sử giao dịch Dịch vụ Hiển thị Shopee
Tiền tệ:,VND
Tên đăng nhập:,aillavn
Khoảng thời gian:,01/09/2026 -- 30/09/2026

Thứ tự,Thời gian,Mô tả,Số tiền,Nhận xét
1,30/09/2026,Khấu trừ chi phí Dịch vụ Hiển thị Shop,-20000,-
2,05/09/2026,Tiền Dịch vụ Hiển thị đã nạp,500000,-
3,05/09/2026,Chiến dịch Tự Động Chọn Sản phẩm (cấp độ Shop),-30000,-
4,02/10/2026,Khấu trừ chi phí Dịch vụ Hiển thị Shop,-99999,-
`);

function build(opts: { to?: string; ads?: boolean; costOf?: unknown } = {}) {
  const O = T.speReadOrders(T.speOrderSheet(ordersSheets()), '2026-09');
  const F = T.speReadFin(finSheets(opts.to), '2026-09');
  const A = opts.ads === false ? null : T.speReadAds(adsCsv());
  return T.speBuildMonth({ ky: '2026-09', shop: F.shop, orders: O, fin: F, ads: A, costOf: opts.costOf ?? null });
}

describe('specalc: đọc file Shopee', () => {
  it('nhận đúng loại file theo nội dung', () => {
    expect(T.speKind(ordersSheets())).toBe('orders');
    expect(T.speKind(finSheets())).toBe('fin');
    expect(T.speKind({ csv: adsCsv() })).toBe('ads');
    expect(T.speKind({ x: [['abc']] })).toBe('');
  });
  it('file đơn: chỉ lấy đơn đặt trong tháng, doanh thu = giá gốc − người bán trợ giá, không giữ tên/số điện thoại khách', () => {
    const O = T.speReadOrders(T.speOrderSheet(ordersSheets()), '2026-09');
    expect(O.outside).toBe(1);
    expect(O.lines).toHaveLength(5);
    expect(O.lines[0]).toMatchObject({ o: 'A1', d: '2026-09-02', dt: 80000, q: 1, huy: false });
    expect(O.lines[2].huy).toBe(true);
    expect(JSON.stringify(O.lines)).not.toMatch(/N\*+A|\*+90/);
    expect(T.speGuessKy(T.speOrderSheet(ordersSheets()))).toBe('2026-09');
  });
  it('file Tài chính: tên shop, khoảng ngày, báo cáo giữa tháng khi chưa tới hết ngày 09 tháng sau', () => {
    const F = T.speReadFin(finSheets(), '2026-09');
    expect(F.shop).toBe('aillavn');
    expect(F.range).toEqual({ from: '2026-09-01', to: '2026-10-09' });
    expect(T.speReadFin(finSheets('2026-10-08'), '2026-09').partial).toBe(true);
    expect(F.partial).toBe(false);
    expect(F.ord.A1.f.reduce((a: number, b: number) => a + b, 0)).toBe(-15000 - 5000 - 3000 - 8000 + 6000 - 6000 - 1000);
    expect(F.ord.A1.vou).toBe(-10000);
    expect(F.ord.A1.aff).toBe(true);
    expect(T.speReadFin(finSheets('2026-09-27'), '2026-09').partial).toBe(true);
    expect(T.speReadFin(finSheets(), '2026-11').err).toMatch(/chỉ tới 09\/10\/2026/);
    expect(T.speReadFin({ ...finSheets(), Adjustment: [['Từ', '2026-09-05', 'Đến', '2026-10-08']] }, '2026-09').err).toMatch(/phải từ 01\/09/);
  });
  it('file quảng cáo: bỏ dòng nạp ví, cộng chi theo ngày', () => {
    const A = T.speReadAds(adsCsv());
    expect(A.shop).toBe('aillavn');
    expect(A.nap).toBe(500000);
    expect(A.days).toEqual({ '2026-09-30': 20000, '2026-09-05': 30000, '2026-10-02': 99999 });
  });
});

describe('specalc: số tháng một shop', () => {
  it('mã ưu đãi trừ vào doanh thu, đơn hoàn theo Tài chính bị loại, đơn chưa quyết toán dùng phí bình quân', () => {
    const M = build();
    // A1: 80.000 + 40.000×2… giá gốc 50.000 − 10.000 trợ giá cho cả dòng = 40.000 → 120.000, mã ưu đãi −10.000 → 110.000
    // A3 hoàn toàn bộ theo Tài chính (160 − 160 = 0) → loại. A4 chưa quyết toán: phí và mã ưu đãi theo tỷ lệ của A1.
    const rateFee = -32000 / 120000, rateV = -10000 / 120000;
    expect(M.lech).toBe(1);
    expect(M.don).toBe(2);
    expect(M.dt).toBe(110000 + Math.round(60000 + 60000 * rateV));
    expect(M.phi).toBe(-32000 + Math.round(60000 * rateFee));
    expect(M.hh).toBe(100000 + 100000);
    expect(M.koc).toBe(110000);
    expect(M.ads).toBe(50000);
    expect(M.den).toBe(null);
    expect(M.fees.find((f: [string, number]) => f[0] === 'Hoa hồng affiliate')[1]).toBe(-8000 + Math.round(60000 * (-8000 / 120000)));
  });
  it('giá vốn theo mã đã quy đổi; mã thiếu giá KHÔNG ước: giá vốn 0, đánh dấu chưa tính', () => {
    const M = build({ costOf: (s: { pn: string }) => (s.pn === 'Tẩy lồng' ? { u: 30000 } : { u: null, why: 'Chưa quy đổi mã' }) });
    const tl = M.rows.find((r: { pn: string }) => r.pn === 'Tẩy lồng'), xm = M.rows.find((r: { pn: string }) => r.pn === 'Xịt muỗi');
    expect(tl.gv).toBe(30000);
    expect(xm.uoc).toBe(true);
    expect(xm.gv).toBe(0);
    expect(M.gv).toBe(tl.gv);
    expect(M.dtUocGv).toBe(xm.dt);
    const day = Object.values(M.days).reduce((a: number, d) => a + (d as { gv: number }).gv, 0);
    expect(Math.abs((day as number) - M.gv)).toBeLessThanOrEqual(2);
  });
  it('báo cáo giữa tháng: số đến ngày đơn mới nhất, quảng cáo cắt đến ngày đó', () => {
    const M = build({ to: '2026-09-27' });
    expect(M.den).toBe('2026-09-30');
    expect(M.ads).toBe(50000);
  });
  it('tóm tắt theo ngày đúng dạng DAYD.spe [doanh thu, phí (âm), giá vốn, lãi gộp, đơn]; gộp nhiều shop', () => {
    const S = T.speSummary(build());
    const d = S.days['2026-09-02'];
    expect(d[3]).toBe(d[0] + d[1] - d[2]);
    expect(d[4]).toBe(1);
    expect(S.days['2026-09-05'][5]).toBe(30000);
    const D = T.speDayd([S, { ...S, shop: 'aillavn1' }]);
    expect(D['2026-09-02']).toEqual([d[0] * 2, d[1] * 2, d[2] * 2, d[3] * 2, 2]);
    expect(JSON.stringify(T.speRowsPack(build()))).not.toMatch(/A1|A3/);
  });
  it('không ghép được đơn nào thì báo lỗi', () => {
    const O = T.speReadOrders(T.speOrderSheet(ordersSheets()), '2026-09');
    const F = { ...T.speReadFin(finSheets(), '2026-09'), ord: {} };
    expect(T.speBuildMonth({ ky: '2026-09', shop: 'x', orders: O, fin: F }).err).toMatch(/không ghép được/);
  });
});

describe('specalc: kỳ đã có báo cáo của mọi shop', () => {
  const sums = [
    { ky: '2026-09', shop: 'aillavn', den: null },
    { ky: '2026-09', shop: 'aillavn1', den: null },
    { ky: '2026-10', shop: 'aillavn', den: '2026-10-25' },
  ];
  it('tháng đủ cả hai shop thì không thiếu', () => {
    expect(T.speCoverage(sums, ['aillavn', 'aillavn1'], '2026-09-01', '2026-09-30', '2026-10-27')).toEqual({ den: '2026-09-30', miss: [] });
  });
  it('tháng chưa đủ: chỉ ra shop và ngày còn thiếu, cắt tới hôm nay', () => {
    const C = T.speCoverage(sums, ['aillavn', 'aillavn1'], '2026-10-01', '2026-10-31', '2026-10-27');
    expect(C.miss).toEqual([
      { shop: 'aillavn', from: '2026-10-26', to: '2026-10-27' },
      { shop: 'aillavn1', from: '2026-10-01', to: '2026-10-27' },
    ]);
    expect(C.den).toBe('');
  });
});

/* Số thật T07/2026 shop Mall (file trên máy kế toán): khớp báo cáo quản trị đã chốt theo skill. */
const DIR = 'F:/QUẢN LÝ NỘI BỘ/BÁO CÁO SHOPEE/';
const REAL = [`${DIR}Đơn shopee mall tháng 07.2026.xlsx`, `${DIR}Tài chính shopeemall từ 01.7-8.8.2026.xlsx`, `${DIR}aillavn_adwords_bill_2026-08-26.csv`];
describe.skipIf(!REAL.every((p) => existsSync(p)))('specalc: số thật T07/2026 Shopee Mall', () => {
  it('doanh thu 118.854.796 (lệch làm tròn ≤ 5đ), phí sàn 39.927.589, ads 23.339.193, 968 đơn', () => {
    const XLSX = createRequire(import.meta.url)('xlsx');
    const rd = (p: string) => T.ttSheets(XLSX, XLSX.read(readFileSync(p), { type: 'buffer' }));
    const O = T.speReadOrders(T.speOrderSheet(rd(REAL[0])), '2026-07');
    const F = T.speReadFin(rd(REAL[1]), '2026-07');
    const A = T.speReadAds(T.ttCsv(readFileSync(REAL[2], 'utf8')));
    const M = T.speBuildMonth({ ky: '2026-07', shop: F.shop, orders: O, fin: F, ads: A });
    expect(Math.abs(M.dt - 118854796)).toBeLessThanOrEqual(5);
    expect(M.phi).toBe(-39927589);
    expect(M.ads).toBe(23339193);
    expect(M.don).toBe(968);
    expect(M.mon).toBe(1160);
  }, 120000);
});

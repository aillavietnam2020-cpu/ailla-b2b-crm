import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/** File tính toán Shopee (hub/src/bcfile.js speCalcBook): mỗi đơn một dòng, cộng lại phải ra đúng số web; đơn bị loại có lý do. */
const XLSX = createRequire(import.meta.url)('xlsx');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(
  'XLSX',
  `const SPE_SHOPS={aillavn:"Shopee Mall"};const speShopL=s=>SPE_SHOPS[s]||s;
  ${readFileSync('hub/src/ttcalc.js', 'utf8')}${readFileSync('hub/src/specalc.js', 'utf8')}${readFileSync('hub/src/bcfile.js', 'utf8')}
  return {ttCsv,speOrderSheet,speReadOrders,speReadFin,speReadAds,speBuildMonth,speCalcBook};`,
)(XLSX);

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


describe('bcfile: file tính toán Shopee', () => {
  it('trang Tổng cộng lại từ từng đơn khớp số web, đơn bị loại có lý do', () => {
    const M = build({ costOf: () => ({ u: 10000 }) });
    const b = T.speCalcBook({ M, files: { orders: 'don.xlsx', fin: 'tc.xlsx', ads: '' } });
    expect(b.name).toMatch(/^Shopee Shopee Mall 2026-09 tinh toan/);
    const wb = XLSX.read(b.data, { type: 'base64' });
    expect(wb.SheetNames).toEqual(['Tong', 'Tung don', 'Don bi loai - uoc', 'Cach tinh']);
    const tong = XLSX.utils.sheet_to_json(wb.Sheets.Tong, { header: 1 }) as unknown[][];
    const row = (k: string) => tong.find((r) => String(r[0]).startsWith(k))!;
    expect(row('Số đơn')[1]).toBe(M.don);
    expect(row('Số đơn')[3]).toBe(0);
    expect(Math.abs(Number(row('Doanh thu')[3]))).toBeLessThanOrEqual(2);
    expect(row('Cộng phí')[3]).toBe(0);
    const don = XLSX.utils.sheet_to_json(wb.Sheets['Tung don'], { header: 1 }) as unknown[][];
    const by = (id: string) => don.find((r) => r[0] === id)!;
    expect(by('A2')[5]).toBe('Không');
    expect(String(by('A2')[6])).toMatch(/đơn hủy/);
    expect(by('A4')[4]).toBe('Không');
    expect(String(by('A4')[6])).toMatch(/Chưa có trong Tài chính/);
    expect(JSON.stringify(don)).not.toMatch(/N\*+A|\*+90/);
  });
});

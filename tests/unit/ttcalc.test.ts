import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/** Báo cáo TikTok Shop (hub/src/ttcalc.js): đọc file xuất từ TikTok và tính lãi lỗ tháng. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(
  `${readFileSync('hub/src/ttcalc.js', 'utf8')}
  return {ttNum,ttIsoDay,ttCsv,ttSheets,ttReadOrders,ttReadIncome,ttCheckIncomeRange,ttReadCampaign,ttReadKeyMetrics,ttReadLive,
    ttReadKoc,ttReadCreators,ttBuildMonth,ttPL,ttSummary,ttMakeCostOf,ttTodo,ttDaydRow,ttGuessKy,ttKind,ttPackPL,ttUnpackPL,TT_LANES,ttReadVideoDays,ttReadVideoList};`,
)();

const ORDER_HEAD = ['Order ID', 'Order Status', 'SKU ID', 'Seller SKU', 'Product Name', 'Variation', 'Quantity',
  'Sku Quantity of return', 'SKU Subtotal Before Discount', 'SKU Seller Discount', 'Created Time', 'Recipient', 'Phone #'];
const order = (o: string, st: string, sku: string, q: number, before: number, disc: number, day: string, ret = 0) =>
  [`${o}\t`, st, `${sku}\t`, `SS${sku}`, `SP ${sku}`, 'Mặc định', q, ret, before, disc, `${day} 10:00:00\t`, 'Nguyễn Văn A', '0900000000'];
const INC_HEAD = ['ID đơn hàng/điều chỉnh', 'Loại giao dịch', 'Thời gian tạo đơn hàng', 'Thời gian quyết toán đơn hàng',
  'Tổng phí', 'Phí hoa hồng của TikTok Shop', 'Phí giao dịch', 'Phí vận chuyển thực tế', 'Phí vận chuyển của người bán', 'Số tiền điều chỉnh'];
const incomeSheets = (range = '2026/09/01-2026/10/09') => ({
  'Chi tiết đơn hàng': [
    INC_HEAD,
    ['1000001', 'Đơn hàng', '2026/09/02', '2026/09/10', '-30000', '-20000', '-5000', '-4000', '-999999', '0'],
    ['1000002', 'Đơn hàng', '2026/09/30', '2026/10/05', '-10000', '-6000', '-2000', '0', '0', '0'],
    ['1000003', 'Đơn hàng', '2026/09/15', '2026/09/20', '-1000', '-1000', '0', '0', '0', '0'],
    ['9000001', 'GMV thanh toán cho Quảng cáo TikTok', '2026/09/30', '2026/09/30', '0', '0', '0', '0', '0', '-500000'],
    ['9000002', 'GMV thanh toán cho Quảng cáo TikTok', '2026/10/03', '2026/10/03', '0', '0', '0', '0', '0', '-200000'],
    ['9000003', 'Bồi thường', '2026/09/12', '2026/09/12', '0', '0', '0', '0', '0', '15000'],
  ],
  'Báo cáo': [[null, 'Khoảng thời gian', null, null, null, range]],
});
const ORDERS = [
  ORDER_HEAD,
  ['Platform unique order ID', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
  order('1000001', 'Đã hoàn tất', '111', 2, 200000, 20000, '02/09/2026'), // đơn 2 dòng, đã quyết toán
  order('1000001', 'Đã hoàn tất', '222', 1, 60000, 0, '02/09/2026'),
  order('1000002', 'Đã hoàn tất', '111', 1, 100000, 0, '30/09/2026'), // quyết toán đầu tháng sau
  order('1000003', 'Đã hủy', '222', 1, 60000, 0, '15/09/2026'), // hủy
  order('1000004', 'Đang giao', '333', 1, 80000, 0, '29/09/2026'), // chưa quyết toán → phí ước tính
  order('1000005', 'Đã hoàn tất', '111', 1, 100000, 0, '01/10/2026'), // ngoài tháng
];
const CAMP = [
  ['Theo ngày', 'Chi phí', 'Số lượng đơn hàng SKU (Cửa hàng hiện tại)', 'Doanh thu gộp (Cửa hàng hiện tại)'],
  ['2026-09-01 00:00:00', 100000, 3, 500000],
  ['2026-09-02 00:00:00', 50001, 1, 200000],
  ['2026-10-01 00:00:00', 70000, 1, 100000],
  ['-', 220001, 5, 800000],
];

function build() {
  const orders = T.ttReadOrders(ORDERS, '2026-09');
  const income = T.ttReadIncome(incomeSheets(), '2026-09');
  const camp = T.ttReadCampaign(CAMP);
  return { orders, income, camp, M: T.ttBuildMonth({ ky: '2026-09', orders, income, camp }) };
}

describe('TikTok: đọc số, ngày, CSV', () => {
  it('đọc số kiểu TikTok', () => {
    expect(T.ttNum('527.153.157₫')).toBe(527153157);
    expect(T.ttNum('1.59%')).toBeCloseTo(0.0159);
    expect(T.ttNum('4.51')).toBe(4.51);
    expect(T.ttNum('--')).toBe(0);
    expect(T.ttNum('-11000000')).toBe(-11000000);
    expect(T.ttNum('1,234,567')).toBe(1234567);
  });
  it('đọc ngày nhiều dạng', () => {
    expect(T.ttIsoDay('30/09/2026 23:47:21\t')).toBe('2026-09-30');
    expect(T.ttIsoDay('2026/10/08')).toBe('2026-10-08');
    expect(T.ttIsoDay('2026-09-01 00:00:00')).toBe('2026-09-01');
    expect(T.ttIsoDay(46296)).toBe('2026-10-01');
  });
  it('CSV có ngoặc kép, dấu phẩy và xuống dòng trong ô', () => {
    const a = T.ttCsv('\ufeffa,b,c\n"x, y","dòng 1\ndòng 2","có ""ngoặc"""\r\n1,2,3');
    expect(a).toEqual([['a', 'b', 'c'], ['x, y', 'dòng 1\ndòng 2', 'có "ngoặc"'], ['1', '2', '3']]);
  });
});

describe('TikTok: file đơn và quyết toán', () => {
  it('chỉ lấy đơn tạo trong tháng, không giữ tên/số điện thoại khách', () => {
    const { orders } = build();
    expect(orders.lines).toHaveLength(5);
    expect(orders.outside).toBe(1);
    expect(JSON.stringify(orders.lines)).not.toMatch(/Nguyễn|0900000000/);
    expect(T.ttGuessKy(ORDERS)).toBe('2026-09');
    expect(T.ttKind({ csv: ORDERS })).toBe('orders');
  });
  it('từ chối file income sai kỳ', () => {
    // Tới trước hết ngày 09 tháng sau = báo cáo giữa tháng (được nhận, đánh dấu partial); chưa vào tháng thì từ chối.
    expect(T.ttReadIncome(incomeSheets('2026/09/01-2026/09/30'), '2026-09').partial).toBe(true);
    expect(T.ttReadIncome(incomeSheets('2026/08/01-2026/08/31'), '2026-09').err).toMatch(/chưa vào tháng/);
    expect(T.ttReadIncome(incomeSheets(), '2026-09').partial).toBe(false);
    expect(T.ttReadIncome(incomeSheets('2026/09/02-2026/10/08'), '2026-09').err).toMatch(/01\/09\/2026/);
    expect(T.ttCheckIncomeRange({ from: '2026-08-25', to: '2026-10-10' }, '2026-09')).toBe('');
    expect(T.ttReadIncome({ 'Chi tiết đơn hàng': [] }, '2026-09').err).toMatch(/Khoảng thời gian/);
  });
  it('báo cáo giữa tháng: số đến ngày đơn mới nhất, quảng cáo cắt đến ngày đó, có số theo ngày để ghép', () => {
    const orders = T.ttReadOrders(ORDERS, '2026-09');
    const income = T.ttReadIncome(incomeSheets('2026/09/01-2026/09/20'), '2026-09');
    const camp = T.ttReadCampaign([...CAMP.slice(0, 3), ['2026-09-30 00:00:00', 999, 1, 1]]);
    const M = T.ttBuildMonth({ ky: '2026-09', orders, income, camp });
    expect(M.den).toBe('2026-09-30');
    expect(M.ads.chi).toBe(100000 + 50001 + 999);
    const P = T.ttPL(M, () => ({ u: 1000 }), []);
    const S = T.ttSummary(P);
    expect(S.den).toBe('2026-09-30');
    expect(Object.values(S.days).reduce((a: number, d: any) => a + d[0], 0)).toBe(P.dt);
    expect(P.checks[0][1]).toMatch(/giữa tháng/);
  });
  it('quảng cáo: cắt ngày 1–8 tháng sau, lấy theo kỳ chi tiêu cộng VAT 10%', () => {
    const { income, M } = build();
    expect(income.adsVi).toBe(-500000);
    expect(income.cut).toBe(-200000);
    expect(income.adj).toBe(15000);
    expect(M.ads.chi).toBe(150001);
    expect(M.ads.vat).toBe(165001);
    expect(M.ads.nDays).toBe(2);
  });
});

describe('TikTok: chia phí và lãi lỗ', () => {
  it('chia phí theo tỷ trọng doanh thu trong đơn, đơn chưa quyết toán ước tính theo tỷ lệ bình quân', () => {
    const { M } = build();
    // Đơn 1000001: SKU 111 doanh thu 180.000, SKU 222 60.000 → tỷ trọng 75% / 25% của phí -30.000
    // Phí vận chuyển của người bán (số ròng) KHÔNG cộng vào; phần chênh với Tổng phí vào "Phí khác".
    const s111 = M.sku['111'];
    expect(s111.dt).toBe(280000);
    expect(s111.f[0]).toBe(-15000 - 6000); // hoa hồng: 75% × -20.000 + đơn 1000002
    expect(s111.f[6]).toBe(-750 - 2000); // phí khác: đơn 1: 75% × (-30.000 - (-29.000)); đơn 2: -10.000 - (-8.000)
    const tot = Object.values(M.sku).reduce((a: number, s: any) => a + s.f.reduce((x: number, y: number) => x + y, 0), 0);
    const rate = -40000 / 340000; // phí bình quân trên doanh thu đã quyết toán (đơn hủy không tính)
    expect(Math.abs(tot - (-40000 + 80000 * rate))).toBeLessThan(5);
    expect(M.dtUoc).toBe(80000);
    expect(M.don).toBe(3);
    expect(M.hh).toBe(60000);
  });
  it('lãi lỗ: thiếu giá vốn thì ước tính theo tỷ lệ bình quân và đưa vào việc kế toán', () => {
    const { M } = build();
    const P = T.ttPL(M, (id: string) => (id === '111' ? { u: 50000, src: 'x' } : id === '222' ? { u: null, why: 'Chưa quy đổi mã' } : { u: 20000 }), [
      { n: 'Agency', v: 10000 },
    ]);
    expect(P.dt).toBe(420000);
    const r222 = P.rows.find((r: any) => r.id === '222');
    expect(r222.uoc).toBe(true);
    expect(r222.gv).toBe(Math.round(60000 * ((3 * 50000 + 20000) / (280000 + 80000))));
    expect(P.lai).toBe(P.lg - P.ads + P.adj - 10000);
    expect(P.g3.map((r: any) => r.id)).toEqual(['222']);
    expect(P.checks).toHaveLength(6);
    expect(T.ttTodo(P).noMap.map((r: any) => r.id)).toEqual(['222']);
    const back = T.ttUnpackPL(JSON.parse(JSON.stringify(T.ttPackPL(P))));
    expect(back.g3[0].id).toBe('222');
    expect(T.ttSummary(P).lai).toBe(P.lai);
  });
  it('giá vốn từ Quy đổi mã các sàn + Giá vốn SKU (bao bì chưa giá không chặn, hàng thiếu giá thì chặn)', () => {
    const costOf = T.ttMakeCostOf({
      ky: '2026-09',
      mapRows: [
        { sku: '111', variant: '', from_day: '', item_label: 'TDHY - Tinh dầu Hygen', qty: 1 },
        { sku: '111', variant: '', from_day: '', item_label: 'HOP1 - Hộp', qty: 1 },
        { sku: '111', variant: '', from_day: '2026-10-01', item_label: 'TDLU - Tinh dầu Luxury', qty: 9 },
        { sku: 'COMBO2', variant: '', from_day: '', item_label: 'TDHY - Tinh dầu Hygen', qty: 2 },
        { sku: 'COMBO2', variant: '', from_day: '', item_label: 'BỎ QUA', qty: 1 },
        { sku: '444', variant: '', from_day: '', item_label: 'MOI - Hàng mới', qty: 1 },
      ],
      skus: [{ ma: 'TDHY', giaVon: { '2026-07': 11000, '2026-08': 12000, '2026-10': 99999 } }],
      khoCost: { MOIX: 5 },
      isPack: (c: string) => c === 'HOP1',
    });
    const a = costOf('111', 'x', '');
    expect(a.u).toBe(12000);
    expect(a.pack).toEqual(['HOP1']);
    expect(costOf('999', 'COMBO2', '').u).toBe(24000);
    expect(costOf('444', '', '').u).toBeNull();
    expect(costOf('444', '', '').why).toMatch(/MOI/);
    expect(costOf('555', '', '').why).toBe('Chưa quy đổi mã');
  });
});

describe('TikTok: file của team TikTok', () => {
  it('Key metrics: 5 làn theo ngày', () => {
    const km = T.ttReadKeyMetrics([
      ['Ngày phân tích: 01/09/2026-30/09/2026'],
      ['Dữ liệu theo ngày'],
      ['Ngày', 'GMV', 'Đơn hàng', ...T.TT_LANES.map((l: string[]) => l[2])],
      ['01/09/2026', '1000', '3', '500', '200', '200', '80', '20'],
    ]);
    expect(km.days['2026-09-01']).toMatchObject({ gmv: 1000, don: 3, vInh: 500, vKoc: 200, the: 200, lShop: 80, lKoc: 20 });
    expect(T.ttDaydRow({ km: km.days['2026-09-01'], ads: { chi: 100 } })).toEqual([1000, 3, 0, 0, 0, 80, 20, 200, 500, 200, 110]);
  });
  it('KOC và nhà sáng tạo lấy khoảng ngày từ tên file', () => {
    const k = T.ttReadKoc([['GMV nhờ nhà sáng tạo', 'Video'], ['giải thích dài '.repeat(5), 'x'], ['527.153.157₫', '959']], 'Transaction_Analysis_Core_Metrics_20260901-20260930.xlsx');
    expect(k.range).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(k.m['GMV nhờ nhà sáng tạo']).toBe(527153157);
    expect(T.ttReadKoc([['GMV nhờ nhà sáng tạo'], ['1']], 'abc.xlsx').err).toMatch(/khoảng ngày/);
    const c = T.ttReadCreators([['Tên người dùng của nhà sáng tạo', 'GMV liên kết'], ['a', '10'], ['b', '30'], ['c', '0']], 'Creator_List_20260901-20260930_x.xlsx');
    expect(c.top.map((x: any) => x.u)).toEqual(['b', 'a']);
    expect(c.nCo).toBe(2);
  });
});

/* Đối chiếu đủ số tháng 9/2026 với file Excel cũ (chỉ chạy trên máy có thư mục dữ liệu tải về). */
const DIR = 'C:/Users/ADMIN/Downloads/TikTok_T9_2026/';
describe.skipIf(!existsSync(DIR + 'OrderSKUList_T9_2026.csv'))('TikTok: số tháng 9/2026 khớp file Excel', () => {
  it('ra đúng các số đối chiếu', () => {
    const X = createRequire(import.meta.url)('xlsx');
    const sh = (f: string) => T.ttSheets(X, X.readFile(DIR + f));
    const first = (o: Record<string, unknown[]>) => o[Object.keys(o)[0]];
    const orders = T.ttReadOrders(T.ttCsv(readFileSync(DIR + 'OrderSKUList_T9_2026.csv', 'utf8')), '2026-09');
    const income = T.ttReadIncome(sh('income_T9_2026_0109-0810.xlsx'), '2026-09');
    const camp = T.ttReadCampaign(first(sh('Campaign overview data 20260901 - 20260930.xlsx')));
    const M = T.ttBuildMonth({ ky: '2026-09', orders, income, camp });
    const map: Record<string, number> = {};
    (sh('AILLA_BaoCao_QuanTri_TikTok_2026-09.xlsx').MAP_SKU as unknown[][]).slice(4).forEach((r) => {
      if (r && r[0] && typeof r[16] === 'number') map[String(r[0])] = r[16] as number;
    });
    const P = T.ttPL(M, (id: string) => (id in map ? { u: map[id] } : null), []);
    expect(P.dt).toBe(1392110100);
    expect(P.gv).toBe(240643848);
    expect(-P.phi).toBe(415466276);
    expect(P.lg).toBe(735999976);
    expect(P.ads).toBe(364658750);
    expect(P.lai).toBe(371517226);
    expect(P.don).toBe(12350);
    expect((P.hhRate * 100).toFixed(2)).toBe('11.29');
    expect(P.adsVi).toBe(315886241);
    expect(P.fees.map((f: unknown[]) => f[1])).toEqual([-181702105, -70628452, -106008494, -34655085, -1594296, -20877844, 0]);
    const km = T.ttReadKeyMetrics(first(sh('Shop Analytics_Key metrics_20261024 (1).xlsx')));
    const s = (k: string) => Object.values(km.days).reduce((a: number, d: any) => a + d[k], 0);
    expect(s('gmv')).toBe(1538012277);
    expect([s('vInh'), s('vKoc'), s('the'), s('lShop'), s('lKoc')]).toEqual([895475505, 358365742, 260159896, 23444263, 566871]);
  });
});

describe('TikTok: giá trị hoàn sau khi giao (để tính doanh thu dự kiến)', () => {
  it('tách hoàn sau giao khỏi hủy trước giao; lưu cùng doanh thu chưa quyết toán', () => {
    const orders = T.ttReadOrders([...ORDERS, order('1000006', 'Đã hoàn tất', '111', 1, 90000, 0, '10/09/2026', 1)], '2026-09');
    const M = T.ttBuildMonth({ ky: '2026-09', orders, income: T.ttReadIncome(incomeSheets(), '2026-09'), camp: T.ttReadCampaign(CAMP) });
    expect(M.hoanGiao).toBe(90000);
    expect(M.hh).toBe(60000 + 90000);
    const S = T.ttSummary(T.ttPL(M, () => ({ u: 1000 }), []));
    expect(S.hoanGiao).toBe(90000);
    expect(S.dtUoc).toBe(80000);
  });
});

describe('TikTok: file Video (Hiệu suất theo ngày, Chi tiết từng video)', () => {
  const VLIST = [
    ['[Phạm vi ngày]: 2026-10-01 ~ 2026-10-25\n'],
    [],
    ['Tên nhà sáng tạo', 'ID video', 'Thông tin video', 'Thời gian', 'Sản phẩm', 'VV', 'Đơn hàng SKU đã ghi nhận', 'GMV đến từ video (₫)'],
    ['shop', '111', 'Video cũ bán chạy', '2026/05/30 10:45:00', 'Tinh dầu', '2040840', '5406', '307868218'],
    ['shop', '222', 'Video mới có đơn', '2026/10/05 09:00:00', 'Xịt muỗi', '1000', '3', '300000'],
    ['shop', '333', 'Video mới chưa đơn', '2026/10/20 09:00:00', 'Xịt ruồi', '500', '0', '0'],
  ];
  it('nhận đúng loại file', () => {
    expect(T.ttKind({ Sheet1: VLIST })).toBe('videos');
    expect(T.ttKind({ Sheet1: [['[Phạm vi ngày]: 2026-10-01 ~ 2026-10-25'], [], ['Thời gian', 'GMV đến từ video (₫)', 'VV']] })).toBe('vdays');
  });
  it('Chi tiết: đếm video đăng trong kỳ, video ra đơn, top theo GMV', () => {
    const R = T.ttReadVideoList(VLIST);
    expect(R.range).toEqual({ from: '2026-10-01', to: '2026-10-25' });
    expect([R.n, R.nDang, R.nCoDon, R.nDangCoDon]).toEqual([3, 2, 2, 1]);
    expect(R.gmv).toBe(307868218 + 300000);
    expect(R.top[0].id).toBe('111');
    expect(R.top[1].post).toBe('2026-10-05');
  });
  it('Hiệu suất: số theo ngày', () => {
    const R = T.ttReadVideoDays([['[Phạm vi ngày]: 2026-10-01 ~ 2026-10-02'], [], ['Thời gian', 'GMV đến từ video (₫)', 'VV', 'Đơn hàng SKU đã ghi nhận'], ['2026-10-01', '40042598', '258097', '714']]);
    expect(R.days['2026-10-01']).toMatchObject({ gmv: 40042598, vv: 258097, don: 714 });
  });
});

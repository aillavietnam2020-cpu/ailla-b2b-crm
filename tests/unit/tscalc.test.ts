import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Luật khấu hao / phân bổ của trang Tài sản & CCDC (hub/src/tscalc.js). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = new Function(
  `${readFileSync('hub/src/tscalc.js', 'utf8')}
  return {tsLich,tsThang,tsLuyKe,tsConLai,tsTrangThai,tsBpTai,tsChiaPct,tsDongThang,tsKhoa,tsThanhLy,tsSo,tsNgayDoc,tsDocBang,tsDienDauKy,tsAddM};`,
)();
const tong = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const bon = { id: 'a1', kind: 'TS', ma: 'BONKHUAY', ten: 'Bồn khuấy', d: '2024-12-01', s: '2024-12-01', ng: 55000000, gk: 55000000, n: 60, bp: [{ o: 'sx', p: 100 }] };

describe('Khấu hao đường thẳng theo ngày', () => {
  it('bắt đầu ngày 01: mỗi tháng bằng nhau, đủ 60 tháng, cộng đúng nguyên giá', () => {
    const L = C.tsLich(bon);
    expect(Object.keys(L).length).toBe(60);
    expect(L['2024-12']).toBe(916667);
    expect(L['2029-11']).toBeGreaterThan(0);
    expect(L['2029-12']).toBeUndefined();
    expect(tong(L)).toBe(55000000);
    expect(C.tsLuyKe(bon, '2026-10')).toBe(916667 * 23);
  });
  it('bắt đầu giữa tháng: tháng đầu tính theo ngày, phần lẻ dồn tháng cuối', () => {
    const a = { ...bon, s: '2026-11-05', d: '2026-11-05', gk: 45000000, n: 60 };
    const L = C.tsLich(a);
    expect(L['2026-11']).toBe(650000); // 750.000 × 26/30
    expect(L['2026-12']).toBe(750000);
    expect(L['2031-11']).toBe(100000); // 4 ngày cuối
    expect(tong(L)).toBe(45000000);
  });
  it('ghi giảm: dừng trước ngày ghi giảm, không tính các tháng sau', () => {
    const a = { ...bon, gg: { d: '2026-11-20' } };
    expect(C.tsThang(a, '2026-11')).toBe(Math.round((55000000 / 60) * 19 / 30));
    expect(C.tsThang(a, '2026-12')).toBe(0);
    expect(C.tsTrangThai(a, '2026-11')).toBe('GIAM');
    const t = C.tsThanhLy(bon, '2026-11-20', 20000000);
    expect(t.con + t.lk).toBe(55000000);
  });
  it('không tính khấu hao thì lịch rỗng', () => {
    expect(tong(C.tsLich({ ...bon, kkh: true }))).toBe(0);
  });
  it('CCDC 1 tháng vào hết tháng mua; CCDC nhiều kỳ cộng đúng giá trị', () => {
    const keo = { id: 'c1', kind: 'CC', ma: 'K', ten: 'Kéo', s: '2026-10-08', gk: 650000, n: 1, bp: [{ o: 'sx', p: 100 }] };
    expect(C.tsLich(keo)).toEqual({ '2026-10': 650000 });
    const noi = { ...keo, gk: 8500000, n: 12, s: '2026-09-12' };
    expect(tong(C.tsLich(noi))).toBe(8500000);
  });
  it('khai báo đầu kỳ: chia đều phần còn lại cho số tháng còn lại từ tháng web làm chuẩn', () => {
    const a = { ...bon, dk: { tu: '2026-11', lk: 21083341, con: 37 } };
    const L = C.tsLich(a);
    expect(Object.keys(L)[0]).toBe('2026-11');
    expect(Object.keys(L).length).toBe(37);
    expect(tong(L)).toBe(55000000 - 21083341);
    expect(C.tsLuyKe(a, '2026-10')).toBe(21083341);
    expect(C.tsConLai(a, '2029-11')).toBe(0);
    expect(C.tsTrangThai(a, '2026-10')).toBe('DUNG'); // tài sản đầu kỳ vẫn là đang dùng trước tháng web làm chuẩn
  });
  it('thiếu hao mòn / số tháng còn lại thì web tự điền theo lịch gốc', () => {
    const a = C.tsDienDauKy({ ...bon, dk: { tu: '2026-11', lk: null, con: null } });
    expect(a.dk.lk).toBe(916667 * 23);
    expect(a.dk.con).toBe(37);
  });
});

describe('Chia chi phí và ghi sổ tháng', () => {
  it('chia % tròn đồng, tổng không đổi', () => {
    const r = C.tsChiaPct(1000001, [{ o: 'sx', p: 70 }, { o: 'ql', p: 30 }]);
    expect(r.reduce((t: number, x: { v: number }) => t + x.v, 0)).toBe(1000001);
  });
  it('dòng tháng: TSCĐ có TK 2141 nhóm G25, CCDC có TK 242 nhóm G14; chưa đủ 100% thì báo lỗi', () => {
    const cc = { id: 'c2', kind: 'CC', ma: 'THUE', ten: 'Thuê xưởng', s: '2026-07-01', gk: 54000000, n: 6, bp: [{ o: 'sx', p: 70 }, { o: 'ql', p: 30 }] };
    const sai = { ...bon, id: 'x', ma: 'SAI', bp: [{ o: 'sx', p: 50 }] };
    const r = C.tsDongThang([bon, cc, sai], '2026-10');
    expect(r.loi.length).toBe(1);
    const ts = r.dong.find((x: { ma: string }) => x.ma === 'BONKHUAY');
    expect([ts.tkc, ts.g, ts.k, ts.tkn]).toEqual(['2141', 'G25', 'Sản xuất', '154']);
    const ql = r.dong.find((x: { o: string }) => x.o === 'ql');
    expect([ql.tkc, ql.g, ql.k, ql.tkn, ql.t]).toEqual(['242', 'G14', 'Chung', '6422', 2700000]);
  });
  it('điều chuyển có hiệu lực từ tháng ghi', () => {
    const a = { ...bon, dc: [{ tu: '2026-12', bp: [{ o: 'sx', p: 60 }, { o: 'ql', p: 40 }] }] };
    expect(C.tsBpTai(a, '2026-11')).toEqual([{ o: 'sx', p: 100 }]);
    expect(C.tsBpTai(a, '2027-01').length).toBe(2);
  });
  it('tháng khóa sau ngày 10 tháng sau', () => {
    expect(C.tsKhoa('2026-10', '2026-11-10')).toBe(false);
    expect(C.tsKhoa('2026-10', '2026-11-11')).toBe(true);
    expect(C.tsKhoa('2026-12', '2027-01-11')).toBe(true);
  });
});

describe('Nạp file MISA', () => {
  it('đọc số và ngày kiểu Việt Nam', () => {
    expect(C.tsSo('55.000.000')).toBe(55000000);
    expect(C.tsSo('1,234,567')).toBe(1234567);
    expect(C.tsSo('(1.000)')).toBe(-1000);
    expect(C.tsNgayDoc('01/12/2024')).toBe('2024-12-01');
    expect(C.tsNgayDoc(45627)).toBe('2024-12-01');
  });
  it('tìm dòng tiêu đề, bỏ dòng cộng, lấy hao mòn từ giá trị còn lại khi thiếu', () => {
    const rows = [
      ['SỔ TÀI SẢN CỐ ĐỊNH'],
      [],
      ['Ngày ghi tăng', 'Mã tài sản', 'Tên tài sản', 'Loại tài sản', 'Đơn vị sử dụng', 'Nguyên giá', 'Thời gian sử dụng (tháng)', 'Giá trị còn lại'],
      ['01/12/2024', 'BONKHUAY', 'Bồn khuấy', 'Máy móc, thiết bị', 'Bộ phận sản xuất', '55.000.000', 60, '33.916.659'],
      ['', '', 'Tổng cộng', '', '', '330.712.000', '', ''],
    ];
    const r = C.tsDocBang(rows, 'TS', '2026-11');
    expect(r.items.length).toBe(1);
    const a = r.items[0];
    expect([a.ma, a.d, a.ng, a.n, a.bp[0].o]).toEqual(['BONKHUAY', '2024-12-01', 55000000, 60, 'sx']);
    expect(a.dk.lk).toBe(21083341);
    expect(C.tsDocBang([['a', 'b']], 'TS', '2026-11').err).toBeTruthy();
  });
});

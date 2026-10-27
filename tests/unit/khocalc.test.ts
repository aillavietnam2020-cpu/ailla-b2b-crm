import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dangSanXuat, khoAmTu, khoNhom, khoTrangThai } from '../../src/server/services/khoTon';

/** Luật tồn kho một cách tính: hub/src/khocalc.js (trình duyệt) và src/server/services/khoTon.ts (máy chủ) phải ra cùng kết quả. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = new Function(
  `${readFileSync('hub/src/khocalc.js', 'utf8')}
  return {KHO_NHOM,KHO_TT,KHO_DN,kc6,khoNhom,khoTrangThai,khoGiaTri,khoTongHop,khoDcKhop,khoDcLyDo};`,
)();

describe('Tồn kho: nhóm và trạng thái', () => {
  it('vỏ can chai tách khỏi nguyên vật liệu, thành phẩm gồm hàng hóa và combo', () => {
    expect(khoNhom('NVL', 'Vỏ can, chai, túi', false)).toBe('VO');
    expect(khoNhom('NVL', 'Tem nhãn', true)).toBe('VO');
    expect(khoNhom('NVL', 'Hóa chất, hương liệu', false)).toBe('NVL');
    expect(khoNhom('CCDC', 'Công cụ dụng cụ', false)).toBe('NVL');
    expect(khoNhom('BTP', '', false)).toBe('BTP');
    expect(khoNhom('TP', 'Thành phẩm', false)).toBe('TP');
    expect(khoNhom('HH', '', false)).toBe('TP');
    expect(khoNhom('COMBO', 'Combo', false)).toBe('TP');
  });
  it('âm kho = tồn thực tế < 0; sắp hết = có định mức an toàn và khả dụng dưới định mức', () => {
    expect(khoTrangThai(-1, -1, 0)).toBe('AM');
    expect(khoTrangThai(-1e-9, 0, 0)).toBe('DU'); // sai số làm tròn không tính là âm
    expect(khoTrangThai(10, 4, 5)).toBe('SAP_HET'); // còn 10 nhưng đã giữ 6 cho đơn
    expect(khoTrangThai(10, 10, 5)).toBe('DU');
    expect(khoTrangThai(3, 3, 0)).toBe('DU'); // chưa đặt định mức thì không báo sắp hết
    expect(khoTrangThai(-2, -2, 5)).toBe('AM'); // âm thì báo âm, không báo sắp hết
  });
  it('trình duyệt và máy chủ cùng luật', () => {
    const cases: Array<[string, string, boolean]> = [['NVL', 'Vỏ can, chai, túi', false], ['NVL', 'NVL khác', false], ['TP', '', false], ['BTP', '', false], ['HH', 'Hàng hóa', false], ['NVL', '', true]];
    for (const [a, b, v] of cases) expect(C.khoNhom(a, b, v)).toBe(khoNhom(a, b, v));
    const t: Array<[number, number, number]> = [[-1, -1, 0], [0, 0, 0], [10, 4, 5], [5, 5, 5], [4.9999999, 4.9999999, 5], [-1e-9, 0, 1]];
    for (const [a, b, m] of t) expect(C.khoTrangThai(a, b, m)).toBe(khoTrangThai(a, b, m));
  });
});

describe('Tồn kho: tổng hợp, giá trị, đối chiếu', () => {
  const rows = [
    { code: 'A', nhom: 'TP', ton: -5, kha_dung: -5, dang_sx: 0, trang_thai: 'AM', active: 1 },
    { code: 'B', nhom: 'TP', ton: 20, kha_dung: 20, dang_sx: 50, trang_thai: 'DU', active: 1 },
    { code: 'C', nhom: 'NVL', ton: 100, kha_dung: 100, dang_sx: 0, trang_thai: 'DU', active: 1 },
    { code: 'D', nhom: 'VO', ton: 3, kha_dung: 3, dang_sx: 0, trang_thai: 'SAP_HET', active: 1 },
    { code: 'E', nhom: 'VO', ton: -1, kha_dung: -1, dang_sx: 0, trang_thai: 'AM', active: 0 },
  ];
  it('đếm theo nhóm: âm tính cả mã ngừng dùng, giá trị chỉ lấy phần tồn dương', () => {
    const T = C.khoTongHop(rows, (c: string) => ({ C: 2000, D: 500 } as Record<string, number>)[c]);
    expect(T.all.am).toBe(2);
    expect(T.by.VO.am).toBe(1);
    expect(T.by.TP.coTon).toBe(1);
    expect(T.by.TP.dangSx).toBe(50);
    expect(T.all.sapHet).toBe(1);
    expect(T.all.giaTri).toBe(100 * 2000 + 3 * 500);
    expect(T.by.TP.chuaGia).toBe(1); // B có tồn nhưng chưa có giá; A âm không tính
    expect(T.all.ma).toBe(4); // E ngừng dùng
  });
  it('giá trị: tồn âm hoặc 0 thì 0, chưa có giá thì null', () => {
    expect(C.khoGiaTri(-3, 100)).toBe(0);
    expect(C.khoGiaTri(2, 0)).toBeNull();
    expect(C.khoGiaTri(2, 150)).toBe(300);
  });
  it('đầu + nhập − xuất = cuối, và lý do âm đọc từ chứng từ', () => {
    expect(C.khoDcKhop({ dau: 10, nhap: 5, xuat: 20, cuoi: -5 })).toBe(true);
    expect(C.khoDcKhop({ dau: 10, nhap: 5, xuat: 20, cuoi: -4 })).toBe(false);
    const r = { cuoi: -960, nhap_truoc: 0, td: 0, am_tu: '2026-10-16', am_phieu: 'XB-DH001' };
    expect(C.khoDcLyDo(r)).toContain('chưa có phiếu nhập nào');
    expect(C.khoDcLyDo(r)).toContain('XB-DH001');
    expect(C.khoDcLyDo({ ...r, nhap_truoc: 2 })).toContain('Chưa có tồn đầu kỳ');
    expect(C.khoDcLyDo({ ...r, nhap_truoc: 2, td: 1 })).toContain('thiếu phiếu nhập');
    expect(C.khoDcLyDo({ cuoi: 3 })).toBe('');
  });
});

describe('Tồn kho: mã âm do phiếu nào, đang sản xuất', () => {
  it('phiếu đầu tiên của lần âm cuối cùng', () => {
    const L = [
      { item: 'A', doc_date: '2026-10-16', doc_no: 'XB-1', qty: -5 },
      { item: 'A', doc_date: '2026-10-17', doc_no: 'PN-1', qty: 10 },
      { item: 'A', doc_date: '2026-10-18', doc_no: 'XB-2', qty: -8 },
      { item: 'A', doc_date: '2026-10-19', doc_no: 'XB-3', qty: -1 },
      { item: 'B', doc_date: '2026-10-16', doc_no: 'XB-4', qty: -2 },
      { item: 'B', doc_date: '2026-10-20', doc_no: 'PN-2', qty: 5 },
      { item: 'C', doc_date: '2026-10-16', doc_no: 'XB-5', qty: -1 },
    ];
    const m = khoAmTu(L);
    expect(m.get('A')).toEqual({ doc_date: '2026-10-18', doc_no: 'XB-2' });
    expect(m.has('B')).toBe(false);
    expect(m.get('C')).toEqual({ doc_date: '2026-10-16', doc_no: 'XB-5' });
  });
  it('đang sản xuất: phiếu đang làm trừ phần đã ra lô, cộng lô chưa nhập kho', () => {
    const m = dangSanXuat({
      requests: [
        { id: 'R1', sp: 'TP1', sl: 100, st: 'DANG_LAM' },
        { id: 'R2', sp: 'TP2', sl: 50, st: 'CAN_LAM' },
        { id: 'R3', sp: 'TP3', sl: 30, st: 'HOAN_TAT' },
      ],
      batches: [
        { sp: 'TP1', st: 'CHO_KIEM', req: 'R1', baoSL: 40 },
        { sp: 'TP1', st: 'SAN_SANG', req: 'R1', dat: 20 },
        { sp: 'TP3', st: 'HUY', req: 'R3', dat: 30 },
      ],
    });
    expect(m.get('TP1')).toBe(40 + (100 - 60));
    expect(m.has('TP2')).toBe(false);
    expect(m.has('TP3')).toBe(false);
    expect(dangSanXuat(null).size).toBe(0);
  });
});

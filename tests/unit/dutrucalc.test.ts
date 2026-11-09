import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Dự trù giá bán (hub/src/dutrucalc.js): công thức theo Google Sheet mẫu chị Hoa. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(
  `${readFileSync('hub/src/dutrucalc.js', 'utf8')}
  return {dzCalc,dzMax,dzPromoCmp,dzCostParts,dzAssume,DZ_DEF};`,
)();

const sap = { ten: 'Sáp thơm', kenh: 'tiktok', gia: 55000, gvSp: 14000, gvQua: 0, aff: 5, cpqc: 20 };

describe('dutrucalc', () => {
  it('khớp ví dụ Sáp thơm TikTok trong sheet', () => {
    const x = T.dzCalc(sap);
    expect(x.pct).toBeCloseTo(55.3, 5);
    expect(Math.round(x.tong)).toBe(47415);
    expect(Math.round(x.ln)).toBe(7585);
    expect(x.bien).toBeCloseTo(13.79, 1);
    expect(x.hoaVon).toBeCloseTo(33.79, 1);
    expect(x.tran).toBeCloseTo(15.29, 1);
    expect(x.roasHV).toBeCloseTo(2.96, 2);
    expect(x.roasTran).toBeCloseTo(6.54, 2);
    expect(x.tt).toBe('thap');
  });
  it('Facebook không có phí sàn, voucher, xử lý đơn', () => {
    const x = T.dzCalc({ ...sap, kenh: 'facebook' });
    expect(x.pct).toBeCloseTo(9.2 + 1.5 + 8.1 + 1.3 + 25, 5);
    expect(x.xuLy).toBe(0);
  });
  it('chưa có giá vốn thì không tính, không ước số', () => {
    const x = T.dzCalc({ ...sap, gvSp: null });
    expect(x.ok).toBe(false);
    expect(x.why).toBe('Chưa có giá vốn');
  });
  it('lỗ được đánh dấu lo', () => {
    expect(T.dzCalc({ ...sap, gia: 30000 }).tt).toBe('lo');
  });
  it('giả định sửa được', () => {
    const x = T.dzCalc(sap, { tiktok: { phiSan: 10 } });
    expect(x.pct).toBeCloseTo(48.3, 5);
  });
  it('mức giá tối thiểu đạt biên mục tiêu', () => {
    const m = T.dzMax(sap);
    expect(m.kho).toBe(false);
    expect(m.daDat).toBe(false);
    expect(m.giamD).toBe(0);
    // giá tối thiểu: (14000+3000)/(1-0.553-0.185)
    expect(Math.round(m.pmin)).toBe(Math.round(17000 / 0.262));
    const ok = T.dzCalc({ ...sap, gia: m.pmin });
    expect(ok.bien).toBeCloseTo(18.5, 3);
  });
  it('khuyến mại: giảm % làm biên giảm, giảm tối đa còn đạt mục tiêu', () => {
    const r = { ...sap, cpqc: 5 };
    const m = T.dzMax(r);
    expect(m.daDat).toBe(true);
    const c = T.dzPromoCmp(r, { k: 'pct', v: m.giamPct });
    expect(c.sau.bien).toBeCloseTo(18.5, 2);
    const c2 = T.dzPromoCmp(r, { k: 'pct', v: 90 });
    expect(c2.sau.tt).toBe('lo');
    expect(c2.canhBao).toMatch(/Lỗ/);
  });
  it('voucher có trần, mua X tặng quà cộng vốn quà, flash đặt giá', () => {
    const r = { ...sap, cpqc: 5 };
    expect(T.dzPromoCmp(r, { k: 'voucher', v: 50, max: 4000 }).giam).toBe(4000);
    expect(T.dzPromoCmp(r, { k: 'qua', v: 3000 }).sau.gvQua).toBe(3000);
    expect(T.dzPromoCmp(r, { k: 'flash', v: 45000 }).sau.gia).toBe(45000);
  });
  it('giá vốn từ các món, thiếu giá thì báo mã thiếu', () => {
    const g = { a: { u: 1000 }, q: { u: 500 } };
    const c = T.dzCostParts([{ code: 'A', qty: 2, kind: 'sp' }, { code: 'Q', qty: 1, kind: 'gift' }, { code: 'HOP', qty: 1, kind: 'pack' }], g);
    expect(c.gvSp).toBe(2000);
    expect(c.gvQua).toBe(500);
    const d = T.dzCostParts([{ code: 'B', qty: 1, kind: 'sp' }], g);
    expect(d.gvSp).toBeNull();
    expect(d.miss).toEqual(['B']);
  });
});

describe('dutrucalc giá thành MISA', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const P: any = new Function(`${readFileSync('hub/src/dutrucalc.js', 'utf8')} return {dzParseGiaThanh,dzMergeGiaThanh};`)();
  const aoa = [
    ['BẢNG TÍNH GIÁ THÀNH', '', ''],
    ['Kỳ tính giá thành: Tính giá thành phẩm tháng 09.2026', '', ''],
    ['Mã thành phẩm', 'Tên thành phẩm', 'Tổng', 'Số lượng thành phẩm', 'Giá thành đơn vị'],
    ['AILLASAP', 'Sáp thơm', 1000, 10, 100],
    ['XX', 'Không giá', 0, 0, ''],
    ['Số dòng = 2', '', 0, 0, ''],
  ];
  it('đọc kỳ và dòng giá thành đơn vị', () => {
    const r = P.dzParseGiaThanh(aoa);
    expect(r.ky).toBe('2026-09');
    expect(r.rows).toEqual([{ code: 'AILLASAP', name: 'Sáp thơm', dv: 100, sl: 10 }]);
  });
  it('giữ giá nguồn SKU kế toán, thêm mã mới từ bảng giá thành', () => {
    const f = P.dzParseGiaThanh(aoa);
    const m = P.dzMergeGiaThanh({}, f, { aillasap: { u: 5 } });
    expect(m.aillasap).toBeUndefined();
    const m2 = P.dzMergeGiaThanh({}, f, {});
    expect(m2.aillasap.u).toBe(100);
    expect(m2.aillasap.src).toContain('09/2026');
  });
});

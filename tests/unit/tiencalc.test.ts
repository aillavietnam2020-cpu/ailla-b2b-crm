import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { acctOf } from '../../src/server/services/tienCongNo';
import { chiaTuoiNo } from '../../src/server/services/debts';

/** Luật tiền & công nợ một cách tính: hub/src/tiencalc.js (trình duyệt) và máy chủ (debts.ts, tienCongNo.ts). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = new Function(
  `${readFileSync('hub/src/tiencalc.js', 'utf8')}
  return {TCN_DN,tcnSoDu,tcnSoDuTinh,tcnChiNgay,tcnRunway,tcnAcctOf,tcnCuoi,tcnKhop,tcnTong};`,
)();

describe('Tiền: số dư, chi bình quân, đủ dùng', () => {
  const B = [
    { id: 'a', acct: 'mb', ngay: '2026-10-01', tien: 100 },
    { id: 'b', acct: 'mb', ngay: '2026-10-20', tien: 300 },
    { id: 'c', acct: 'mb', ngay: '2026-10-20', tien: 310 },
    { id: 'd', acct: 'tm', ngay: '2026-10-05', tien: 50 },
  ];
  it('số dư thật = lần nhập mới nhất tới ngày xem (cùng ngày lấy lần nhập sau)', () => {
    expect(C.tcnSoDu(B, 'mb', '2026-10-19').tien).toBe(100);
    expect(C.tcnSoDu(B, 'mb', '2026-10-31').tien).toBe(310);
    expect(C.tcnSoDu(B, 'mb', '2026-09-30')).toBeNull();
  });
  it('số dư tính = mốc + thu − chi sau ngày mốc tới ngày xem', () => {
    const docs = [{ date: '2026-10-01', amount: 999 }, { date: '2026-10-02', amount: 500 }, { date: '2026-10-03', amount: -200 }, { date: '2026-10-25', amount: 7 }];
    expect(C.tcnSoDuTinh(B[0], docs, '2026-10-20')).toEqual({ dau: 100, mocNgay: '2026-10-01', thu: 500, chi: 200, tinh: 400 });
    expect(C.tcnSoDuTinh(null, docs, '2026-10-20').tinh).toBeNull();
  });
  it('chi bình quân: nhập tay ưu tiên; không thì tiền chi tháng trước ÷ số ngày', () => {
    expect(C.tcnChiNgay(2_000_000, 90_000_000, '2026-09').v).toBe(2_000_000);
    expect(C.tcnChiNgay(0, 90_000_000, '2026-09').v).toBe(3_000_000);
    expect(C.tcnChiNgay(0, 0, '2026-09').v).toBe(0);
  });
  it('đủ dùng = tiền ÷ chi/ngày; chưa có chi thì chưa tính', () => {
    expect(C.tcnRunway(30_000_000, 1_000_000, 10_000_000, 4_000_000)).toEqual({ co: 30_000_000, ngay: 30, ngay2: 36 });
    expect(C.tcnRunway(30_000_000, 0, 0, 0).ngay).toBeNull();
  });
  it('nhận tài khoản từ chữ trên phiếu giống máy chủ', () => {
    const A = [{ id: 'acc-mb', account_no: '0123456789' }];
    for (const [t, m] of [['MB · 0123456789 · CTY', 'CHUYEN_KHOAN'], ['Tiền mặt tại công ty', ''], ['', 'TIEN_MAT'], ['Techcombank 999', 'CHUYEN_KHOAN']]) {
      const s = acctOf(t, m, A);
      if (m !== 'TIEN_MAT') expect(C.tcnAcctOf(t, A)).toBe(s);
    }
    expect(C.tcnAcctOf('', A, '1111')).toBe('TIEN_MAT');
  });
});

describe('Công nợ: đối chiếu, tổng, tuổi nợ', () => {
  it('nợ đầu + phát sinh − đã trả − trả lại = nợ cuối, và phải bằng số đang hiện', () => {
    const r = { dau: 3, phat_sinh: 3, da_tra: 1.7, tra_lai: 0.3, cuoi: 4, hien: 4 };
    expect(C.tcnCuoi(r)).toBeCloseTo(4);
    expect(C.tcnKhop(r)).toBe(true);
    expect(C.tcnKhop({ ...r, hien: 5 })).toBe(false);
  });
  it('phải thu chỉ cộng nợ dương; trả thừa để riêng', () => {
    expect(C.tcnTong([{ v: 5 }, { v: -2 }, { v: 3 }], 'v')).toEqual({ duong: 8, am: 2, rong: 6 });
  });
  it('tuổi nợ: phần còn nợ nằm ở chứng từ mới nhất; thiếu chứng từ là nợ đầu kỳ', () => {
    const r = chiaTuoiNo(1_000, [{ date: '2026-10-20', amount: 300 }, { date: '2026-08-01', amount: 500 }], '2026-10-27');
    expect(r).toMatchObject({ b30: 300, b90: 500, old: 200, oldest_days: 87 });
  });
  it('mỗi chỉ số có định nghĩa', () => {
    expect(C.TCN_DN.map((x: string[]) => x[0])).toEqual(expect.arrayContaining(['Phải thu khách', 'DSO', 'Phải trả nhà cung cấp', 'Số dư tính', 'Tiền đủ dùng']));
  });
});

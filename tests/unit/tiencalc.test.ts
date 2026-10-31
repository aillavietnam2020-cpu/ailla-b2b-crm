import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { acctOf } from '../../src/server/services/tienCongNo';
import { chiaTuoiNo } from '../../src/server/services/debts';

/** Luật tiền & công nợ một cách tính: hub/src/tiencalc.js (trình duyệt) và máy chủ (debts.ts, tienCongNo.ts). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = new Function(
  `${readFileSync('hub/src/tiencalc.js', 'utf8')}
  return {TCN_DN,TCN_LC,tcnSoDu,tcnSoDuTinh,tcnChiNgay,tcnRunway,tcnAcctOf,tcnCuoi,tcnKhop,tcnTong,tcnLcKey,tcnLctt,tcnSoDuCong,tcnTuan,tcnChiaTuan,tcnTuanCua,tcnDuBao,tcnCkDocs};`,
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

describe('Dòng tiền: lưu chuyển tiền tệ trực tiếp, dự báo 4 tuần', () => {
  const docs = [
    { date: '2026-10-02', loai: 'THU', kenh: 'B2B', amount: 100 },
    { date: '2026-10-03', loai: 'THU', kenh: 'GIA_CONG', amount: 40 },
    { date: '2026-10-04', loai: 'THU_SO', nguon: 'sanrut', amount: 30 },
    { date: '2026-10-04', loai: 'THU_SO', nguon: 'gc', amount: 5 },
    { date: '2026-10-05', loai: 'CHI_NCC', amount: -60 },
    { date: '2026-10-06', loai: 'CHI_SO', g: 'G01', amount: -20 },
    { date: '2026-10-06', loai: 'CHI_SO', g: 'G07', amount: -15 },
    { date: '2026-10-07', loai: 'CHI_SO', g: 'G28', amount: -25 },
    { date: '2026-10-07', loai: 'CHI_VC', amount: -3 },
    { date: '2026-10-08', loai: 'HOAN', amount: -2 },
    { date: '2026-10-09', loai: 'TS_TL', amount: 7 },
    { date: '2026-11-01', loai: 'THU', kenh: 'B2B', amount: 999 },
  ];
  it('xếp chứng từ vào dòng; dòng web chưa có chỗ ghi để trống (không ước)', () => {
    const A = C.tcnLctt(docs, '2026-10-01', '2026-10-31');
    expect(A.v).toMatchObject({ kpp: 100, oem: 45, sanrut: 30, ncc: -60, qc: -20, luong: -15, vc: -3, hoan: -2, mua_ts: -25, thanh_ly: 7 });
    expect(A.v.tts).toBe(0);
    expect(A.v.vay).toBeNull();
    expect(A.v.thue).toBeNull();
    expect(A.thu).toBe(175);
    expect(A.kd).toBe(175 - 100);
    expect(A.dt).toBe(-18);
    expect(A.net).toBe(57);
    expect(A.vao - A.ra).toBe(A.net);
  });
  it('mỗi dòng có tên, nguồn và nhóm hợp lệ', () => {
    for (const r of C.TCN_LC) expect(['KD', 'DT', 'TC']).toContain(r[1]);
  });
  it('số dư nhiều tài khoản: thiếu tài khoản nào thì báo', () => {
    const B = [{ id: 'a', acct: 'mb', ngay: '2026-09-30', tien: 500 }];
    expect(C.tcnSoDuCong(B, ['mb', 'TIEN_MAT'], '2026-09-30')).toEqual({ tien: 500, thieu: ['TIEN_MAT'], co: 1 });
    expect(C.tcnSoDuCong(B, ['mb'], '2026-09-29').tien).toBeNull();
  });
  it('4 tuần tính từ hôm nay; ngân sách tháng chia theo ngày', () => {
    const W = C.tcnTuan('2026-10-31');
    expect(W[0]).toEqual({ tu: '2026-10-31', den: '2026-11-06' });
    expect(W[3].den).toBe('2026-11-27');
    expect(C.tcnTuanCua(W, '2026-11-10')).toBe(1);
    const v = C.tcnChiaTuan(W, (ym: string) => (ym === '2026-11' ? 30_000_000 : 31_000_000));
    expect(v[0]).toBe(1_000_000 + 6 * 1_000_000);
    expect(v[1]).toBe(7_000_000);
  });
  it('dự báo: tiền cuối tuần so mức tối thiểu', () => {
    const F = C.tcnDuBao(100, [{ v: [10, 0, 0, 0] }, { v: null }], [{ v: [20, 30, 5, 0] }], 70);
    expect(F.close).toEqual([90, 60, 55, 55]);
    expect(F.st).toEqual(['DU', 'THIEU', 'THIEU', 'THIEU']);
    expect(C.tcnDuBao(100, [], [{ v: [32, 0, 0, 0] }], 70).st[0]).toBe('SAT');
    expect(C.tcnDuBao(null, [], [], 70).close[0]).toBeNull();
  });
});

describe('Chuyển tiền nội bộ', () => {
  const L = [
    { id: 'a', ngay: '2026-10-10', tu: 'acc-mb', den: 'TIEN_MAT', tien: 50 },
    { id: 'b', ngay: '2026-10-11', tu: 'VI_TT', den: 'acc-mb', tien: 80 },
    { id: 'c', ngay: '2026-10-12', tu: 'VI_SPE', den: 'acc-mb', tien: 20 },
    { id: 'd', ngay: '2026-10-12', tu: 'acc-mb', den: 'acc-mb', tien: 9 },
  ];
  it('ngân hàng ↔ tiền mặt: tài khoản đi trừ, đến cộng; không tính vào tiền vào / ra', () => {
    const D = C.tcnCkDocs(L, '2026-10-01', '2026-10-31');
    expect(D.filter((d: { acct: string }) => d.acct === 'acc-mb').reduce((t: number, d: { amount: number }) => t + d.amount, 0)).toBe(-50 + 80 + 20);
    expect(D.filter((d: { acct: string }) => d.acct === 'TIEN_MAT')[0].amount).toBe(50);
    const A = C.tcnLctt(D, '2026-10-01', '2026-10-31');
    expect(A.v.tts).toBe(80);
    expect(A.v.spe).toBe(20);
    expect(A.net).toBe(100);
    expect(A.vao).toBe(100);
  });
});

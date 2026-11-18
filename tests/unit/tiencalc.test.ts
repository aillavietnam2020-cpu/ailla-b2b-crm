import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { acctOf } from '../../src/server/services/tienCongNo';
import { chiaTuoiNo } from '../../src/server/services/debts';

/** Luật tiền & công nợ một cách tính: hub/src/tiencalc.js (trình duyệt) và máy chủ (debts.ts, tienCongNo.ts). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = new Function(
  `${readFileSync('hub/src/tiencalc.js', 'utf8')}
  return {TCN_DN,TCN_LC,tcnSoDu,tcnSoDuTinh,tcnChiNgay,tcnRunway,tcnAcctOf,tcnCuoi,tcnKhop,tcnTong,tcnLcKey,tcnLctt,tcnSoDuCong,tcnTuan,tcnChiaTuan,tcnTuanCua,tcnDuBao,tcnCkDocs,TCN_B03,TCN_B03_MA,TCN_TCP,tcnB03Of,tcnGan,tcnB03,tcnSoNgay,tcnSoDuNgay,tcnChotLyDo,TCN_MOC};`,
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
    expect(A.v.vay).toBe(0);
    expect(A.v.thue).toBe(0);
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

describe('Dòng tiền quản trị: mẫu B03-DNN, sổ ngày, chốt sổ', () => {
  it('mẫu B03 đủ mã như MISA', () => {
    const ma = C.TCN_B03.map((r: string[]) => r[0]).filter((c: string) => /^\d\d$/.test(c));
    expect(ma).toEqual(['01', '02', '03', '04', '05', '06', '07', '20', '21', '22', '23', '24', '25', '30', '31', '32', '33', '34', '35', '40', '50', '60', '61', '70']);
  });
  it('mã B03 mặc định theo loại phiếu; chuyển nội bộ không vào báo cáo', () => {
    expect(C.tcnB03Of({ loai: 'THU' })).toBe('01');
    expect(C.tcnB03Of({ loai: 'SAN_RUT' })).toBe('01');
    expect(C.tcnB03Of({ loai: 'CHI_NCC' })).toBe('02');
    expect(C.tcnB03Of({ loai: 'CHI_LUONG' })).toBe('03');
    expect(C.tcnB03Of({ loai: 'CHI_SO', g: 'G07' })).toBe('03');
    expect(C.tcnB03Of({ loai: 'CHI_SO', g: 'G28' })).toBe('21');
    expect(C.tcnB03Of({ loai: 'CHI_SO', g: 'G23' })).toBeNull();
    expect(C.tcnB03Of({ loai: 'TCP', tcp: 'vay' })).toBe('33');
    expect(C.tcnB03Of({ loai: 'TCP', tcp: 'san_tt' })).toBe('01');
    expect(C.tcnLcKey({ loai: 'TCP', tcp: 'san_spe', amount: 5 })).toBe('spe');
    expect(C.tcnB03Of({ loai: 'TCP', tcp: 'thue_tndn' })).toBe('05');
    expect(C.tcnB03Of({ loai: 'CK_RA' })).toBe('noibo');
    expect(C.tcnB03Of({ loai: 'THU_SO', nguon: 'hoan' })).toBe('06');
  });
  it('kế toán gán đè tài khoản / mã, không sửa phiếu gốc', () => {
    const d = [{ id: 'po:1', loai: 'CHI_NCC', acct: '', amount: -5 }];
    const g = C.tcnGan(d, { 'po:1': { acct: 'mb', code: '07' } });
    expect(g[0]).toMatchObject({ acct: 'mb', code: '07' });
    expect(d[0].acct).toBe('');
  });
  it('B03: 20 + 30 + 40 = 50; 70 = 50 + 60', () => {
    const docs = C.tcnGan([
      { id: 'a', date: '2026-11-02', loai: 'THU', amount: 200 },
      { id: 'b', date: '2026-11-05', loai: 'CHI_NCC', amount: -60 },
      { id: 'c', date: '2026-11-06', loai: 'CHI_SO', g: 'G28', amount: -30 },
      { id: 'd', date: '2026-11-07', loai: 'TCP', tcp: 'vay', amount: 100 },
      { id: 'e', date: '2026-11-08', loai: 'CK_RA', amount: -50 },
      { id: 'f', date: '2026-12-01', loai: 'THU', amount: 999 },
    ], {});
    const r = C.tcnB03(docs, '2026-11-01', '2026-11-30', 1000);
    expect(r.v).toMatchObject({ '01': 200, '02': -60, '21': -30, '33': 100, '20': 140, '30': -30, '40': 100, '50': 210, '60': 1000, '70': 1210 });
    expect(C.tcnB03(docs, '2026-11-01', '2026-11-30', null).v['70']).toBeNull();
  });
  it('sổ ngày: đầu ngày + thu − chi = cuối ngày, nối tiếp từng ngày', () => {
    const R = C.tcnSoNgay([{ date: '2026-11-02', amount: 50 }, { date: '2026-11-02', amount: -20 }, { date: '2026-11-04', amount: -10 }, { date: '2026-10-30', amount: 7 }], 100, '2026-11-01', '2026-11-30');
    expect(R).toEqual([{ d: '2026-11-02', dau: 100, thu: 50, chi: 20, cuoi: 130, n: 2 }, { d: '2026-11-04', dau: 130, thu: 0, chi: 10, cuoi: 120, n: 1 }]);
    expect(C.tcnSoDuNgay(100, [{ date: '2026-09-30', amount: 5 }, { date: '2026-10-01', amount: 7 }, { date: '2026-11-01', amount: 9 }], '2026-10-31')).toBe(107);
  });
  it('chốt sổ: phải có sao kê khớp và không còn phiếu cần gán', () => {
    expect(C.tcnChotLyDo([{ n: 'MB', cuoi: 100, sk: 100 }], 0)).toEqual([]);
    expect(C.tcnChotLyDo([{ n: 'MB', cuoi: 100, sk: null }], 0)[0]).toMatch(/chưa nhập/);
    expect(C.tcnChotLyDo([{ n: 'MB', cuoi: 100, sk: 90 }], 2).length).toBe(2);
  });
});

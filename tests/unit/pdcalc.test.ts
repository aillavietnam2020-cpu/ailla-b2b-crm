import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Trang Phê duyệt (hub/src/pdcalc.js): gom việc chờ duyệt từ các nguồn và chỉ giữ việc người xem duyệt được. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(
  `${readFileSync('hub/src/pdcalc.js', 'utf8')}
  return {pdBuild,pdFilter,pdCounts,pdAge,pdTs,pdRights};`,
)();

const NOW = Date.parse('2026-10-27T10:00:00Z');
const S = {
  approvals: [
    { id: 'a1', entity_type: 'ORDER', entity_id: 'o1', rule_code: 'PRICE_OVERRIDE_MANAGER', required_role: 'MANAGER', status: 'PENDING', reason: 'Giá dưới bảng', requester_name: 'Sale A', entity_label: 'DH-01 · NPP Hà Nội', order_total: 5000000, created_at: '2026-10-26T10:00:00Z' },
    { id: 'a2', entity_type: 'ORDER', entity_id: 'o2', rule_code: 'DEBT_LIMIT_EXCEEDED', required_role: 'CEO', status: 'PENDING', reason: 'Vượt hạn mức nợ', requester_name: 'Sale B', created_at: '2026-10-27T08:00:00Z' },
    { id: 'a3', entity_type: 'ORDER', entity_id: 'o3', rule_code: 'X', required_role: 'MANAGER', status: 'APPROVED', created_at: '2026-10-20T08:00:00Z' },
  ],
  shipEdits: [{ id: 's1', order_id: 'o9', order_no: 'DH-09', customer_name: 'NPP X', reason: 'nhập nhầm 20 thành 2', status: 'CHO_DUYET', requested_by_name: 'Kho', requested_at: '2026-10-25 09:00:00' }],
  proposals: [{ id: 'p1', title: 'Giao bổ sung', entity_type: 'ORDER', entity_id: 'o1', status: 'PENDING', agent_name: 'Agent kho', created_at: '2026-10-27T09:00:00Z' }],
  gifts: [
    { id: 'g1', voucher_no: 'PQ-1', customer_name: 'NPP Y', status: 'CHO_DUYET', items: '[{"name":"Áo","qty":2}]', created_at: '2026-10-24T00:00:00Z' },
    { id: 'g2', voucher_no: 'PQ-2', status: 'DA_DUYET', created_at: '2026-10-24T00:00:00Z' },
  ],
  cash: [
    { id: 'c1', voucher_no: 'PC-1', customer_name: 'NPP Y', amount: 2000000, status: 'CHO_DUYET', created_by: 'u_mgr', created_by_name: 'Thảo', created_at: '2026-10-26T00:00:00Z' },
    { id: 'c2', voucher_no: 'PC-2', customer_name: 'NPP Z', amount: 1000000, status: 'CHO_DUYET', created_by: 'u_other', created_by_name: 'Sale', created_at: '2026-10-26T00:00:00Z' },
  ],
  pcCho: [{ id: 'pc1', dg: 'Cước xe NPP', t: 300000, ct: 'PC-2026-10-0001', k: 'NPP', by: 'Thảo', at: NOW - 2 * 3600e3 }],
  costsCho: [
    { id: 'cp1', note: 'Mua quạt', tien: 500000, by: 'Thảo', at: NOW - 3600e3, de: { cat: 'TBI', chac: true, ly: 'mua sắm thiết bị' } },
    { id: 'cp2', note: 'Khoản lạ', tien: 100000, by: 'Thảo', at: NOW - 3600e3, de: { cat: 'CHUA-ROAT', chac: false } },
  ],
  thuCho: [{ id: 't1', note: 'Khách lẻ CK', tien: 800000, by: 'Thảo', at: NOW - 600e3 }],
  hrDon: [
    { id: 'd1', ma: 'NV01', loai: 'Tạm ứng lương', tu: '2026-10-27', den: '2026-10-27', sl: 2000000, tt: 'cho', gui: '09:15:00 27/10/2026', by: 'Lan' },
    { id: 'd2', ma: 'NV02', loai: 'Nghỉ ốm', tt: 'duyet' },
  ],
  hrTu: [],
  staffName: (ma: string) => ({ NV01: 'Nguyễn Lan' } as Record<string, string>)[ma] ?? ma,
};

const kinds = (rows: Array<{ k: string }>) => [...new Set(rows.map((r) => r.k))].sort();
const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort();

describe('Phê duyệt: lọc theo quyền', () => {
  it('CEO thấy mọi việc chờ, bỏ việc đã xử lý', () => {
    const r = T.pdBuild(S, { role: 'CEO', uid: 'u_ceo', perms: ['order.approve.normal', 'order.approve.exception', 'order.accounting.confirm'], admin: true, ns: true });
    expect(kinds(r)).toEqual(['chi', 'don', 'dx', 'ns', 'thu', 'thuong', 'xuat']);
    expect(ids(r).filter((x) => x.startsWith('ap:'))).toEqual(['ap:a1', 'ap:a2']);
    expect(r.some((x: { id: string }) => x.id === 'gi:g2' || x.id === 'dn:d2')).toBe(false);
  });

  it('quản lý duyệt đơn: không thấy yêu cầu cấp CEO, không thấy phiếu chi thưởng do mình lập, không thấy chi phí / nhân sự', () => {
    const r = T.pdBuild(S, { role: 'MANAGER', uid: 'u_mgr', perms: ['order.approve.normal'], admin: false, ns: false });
    expect(ids(r)).toEqual(['ap:a1', 'ca:c2', 'dx:p1', 'gi:g1', 'se:s1']);
  });

  it('quản lý có quyền duyệt ngoại lệ thì thấy cả yêu cầu cấp CEO', () => {
    const r = T.pdBuild(S, { role: 'MANAGER', uid: 'u_mgr', perms: ['order.approve.exception'], admin: false, ns: false });
    expect(ids(r).filter((x) => x.startsWith('ap:'))).toEqual(['ap:a1', 'ap:a2']);
    expect(r.some((x: { k: string }) => x.k === 'xuat' || x.k === 'thuong')).toBe(false);
  });

  it('kế toán (nhân viên + quyền xác nhận kế toán): chỉ phiếu chi, phiếu thu; không đơn hàng', () => {
    const r = T.pdBuild({ ...S, proposals: [] }, { role: 'EMPLOYEE', uid: 'u_kt', perms: ['order.accounting.confirm', 'order.approve.normal'], admin: false, ns: false });
    expect(kinds(r)).toContain('chi');
    expect(kinds(r)).toContain('thu');
    expect(r.some((x: { k: string }) => x.k === 'don')).toBe(false); // vai nhân viên: máy chủ không cho duyệt yêu cầu đơn
  });

  it('người duyệt nhân sự chỉ thấy đơn nhân sự (máy chủ đã lọc đề xuất theo người duyệt)', () => {
    const r = T.pdBuild({ ...S, proposals: [] }, { role: 'EMPLOYEE', uid: 'u_hr', perms: [], admin: false, ns: true });
    expect(ids(r)).toEqual(['dn:d1']);
    expect(r[0].nd).toBe('Nguyễn Lan');
    expect(r[0].tien).toBe(2000000);
    expect(r[0].act).toBe(''); // chưa có nút duyệt dùng chung: chỉ mở trang gốc
  });

  it('người không có quyền duyệt nào: danh sách trống', () => {
    expect(T.pdBuild({ ...S, proposals: [] }, { role: 'EMPLOYEE', uid: 'x', perms: ['debt.read.own'], admin: false, ns: false })).toEqual([]);
  });
});

describe('Phê duyệt: nội dung dòng', () => {
  const r = T.pdBuild(S, { role: 'CEO', uid: 'u_ceo', perms: ['order.approve.normal', 'order.approve.exception', 'order.accounting.confirm'], admin: true, ns: true });
  const by = (id: string) => r.find((x: { id: string }) => x.id === id);

  it('đơn hàng có số tiền, người gửi, mở đúng đơn gốc; yêu cầu cấp CEO ghi rõ', () => {
    expect(by('ap:a1')).toMatchObject({ tien: 5000000, by: 'Sale A', act: 'api', open: { page: 'cr_dn', path: '/admin/orders/o1' } });
    expect(by('ap:a2').loai).toContain('CEO duyệt');
  });

  it('chi phí chờ phân bổ: chỉ dòng web đoán chắc mới có nút Duyệt; phiếu thu chỉ mở trang gốc', () => {
    expect(by('cp:cp1').act).toBe('fn');
    expect(by('cp:cp2').act).toBe('');
    expect(by('th:t1').act).toBe('');
    expect(by('pc:pc1')).toMatchObject({ act: 'fn', tien: 300000 });
  });

  it('chờ lâu nhất lên đầu, đọc được giờ SQLite và giờ kiểu Việt Nam', () => {
    expect(r[0].id).toBe('gi:g1');
    expect(T.pdTs('2026-10-25 09:00:00')).toBe(Date.parse('2026-10-25T09:00:00Z'));
    expect(T.pdTs('09:15:00 27/10/2026')).toBe(Date.parse('2026-10-27T02:15:00Z'));
    expect(T.pdTs('không rõ')).toBe(0);
  });

  it('lọc theo loại và đếm', () => {
    expect(T.pdFilter(r, 'thuong').map((x: { id: string }) => x.id).sort()).toEqual(['ca:c1', 'ca:c2', 'gi:g1']);
    expect(T.pdCounts(r)).toMatchObject({ don: 2, xuat: 1, dx: 1, thuong: 3, chi: 3, thu: 1, ns: 1 });
    expect(T.pdAge(NOW - 30 * 60e3, NOW)).toBe('30 phút');
    expect(T.pdAge(NOW - 5 * 3600e3, NOW)).toBe('5 giờ');
    expect(T.pdAge(NOW - 3 * 864e5, NOW)).toBe('3 ngày');
  });
});

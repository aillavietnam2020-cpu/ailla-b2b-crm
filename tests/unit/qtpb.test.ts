import { describe, expect, it } from 'vitest';
import { applyUndo, diffForLog, isHardPerm, leadOf, protectQtpb } from '../../src/server/lib/qtpb';
import { protectUsers, type GuardUser } from '../../src/server/lib/stateGuard';

const users = (): GuardUser[] => [
  { id: 'u_ceo', crm: 'c_ceo', role: 'admin', perms: [], phongBan: '', active: true, name: 'CEO' },
  { id: 'u_lead', crm: 'c_lead', role: 'lead', perms: ['cv.xem', 'viec.giao', 'kho.gan', 'pl.xem'], phongBan: 'CM', active: true, name: 'Lead Content' },
  { id: 'u_nv', crm: 'c_nv', role: 'content', perms: ['cv.xem', 'luong.quanly'], phongBan: 'CM', active: true, name: 'NV Content' },
  { id: 'u_lead2', crm: 'c_lead2', role: 'truongphong', perms: ['cv.xem'], phongBan: 'CM', active: true, name: 'Lead khác' },
  { id: 'u_ads', crm: 'c_ads', role: 'digital', perms: ['cv.xem'], phongBan: 'ADS', active: true, name: 'NV Ads' },
];
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('Quản trị phòng: ai là Lead', () => {
  it('Lead phòng đã mở (mặc định Content & Media)', () => {
    expect(leadOf(users(), 'c_lead', undefined)?.dept).toBe('CM');
  });
  it('phòng chưa mở hoặc không phải Lead thì không', () => {
    expect(leadOf(users(), 'c_lead', { cfg: { depts: ['ADS'] } })).toBeNull();
    expect(leadOf(users(), 'c_nv', undefined)).toBeNull();
  });
  it('quyền tiền, lương, giá vốn, lợi nhuận là khóa cứng; quyền kho video cũ thì không', () => {
    for (const p of ['pl.xem', 'luong.quanly', 'gia.xem_von', 'chiphi.xem', 'sx.kiemke', 'caidat.quanly', 'nhansu.quanly', 'kho.hoan']) expect(isHardPerm(p)).toBe(true);
    for (const p of ['kho.xem', 'kho.gan', 'viec.giao', 'lich.xem']) expect(isHardPerm(p)).toBe(false);
  });
});

describe('Quản trị phòng: Lead sửa người trong phòng', () => {
  const lead = leadOf(users(), 'c_lead', undefined)!;
  it('cấp được quyền Lead có, không cấp được quyền khóa cứng hay quyền Lead không có', () => {
    const inc = clone(users());
    inc[2]!.perms = ['cv.xem', 'viec.giao', 'pl.xem', 'research.duyet'];
    const out = protectUsers(inc, users(), 'c_lead', false, { lead });
    const nv = out.find((u) => u.id === 'u_nv')!;
    expect(nv.perms).toContain('viec.giao');
    expect(nv.perms).not.toContain('pl.xem');
    expect(nv.perms).not.toContain('research.duyet');
    // quyền khóa cứng đang có (CEO cấp) giữ nguyên, Lead không gỡ được
    expect(nv.perms).toContain('luong.quanly');
  });
  it('không đụng được Lead khác, người phòng khác, chính mình', () => {
    const inc = clone(users());
    inc[3]!.perms = ['cv.xem', 'viec.giao'];
    inc[4]!.perms = ['cv.xem', 'viec.giao'];
    inc[1]!.perms = ['cv.xem', 'viec.giao', 'kho.gan', 'pl.xem', 'luong.quanly'];
    const out = protectUsers(inc, users(), 'c_lead', false, { lead });
    expect(out.find((u) => u.id === 'u_lead2')!.perms).toEqual(['cv.xem']);
    expect(out.find((u) => u.id === 'u_ads')!.perms).toEqual(['cv.xem']);
    expect(out.find((u) => u.id === 'u_lead')!.perms).not.toContain('luong.quanly');
  });
  it('khóa được người nghỉ trong phòng, không mở lại được', () => {
    const inc = clone(users());
    inc[2]!.active = false;
    const out = protectUsers(inc, users(), 'c_lead', false, { lead });
    expect(out.find((u) => u.id === 'u_nv')!.active).toBe(false);
    const locked = clone(out);
    const again = clone(out);
    again.find((u) => u.id === 'u_nv')!.active = true;
    expect(protectUsers(again, locked, 'c_lead', false, { lead }).find((u) => u.id === 'u_nv')!.active).toBe(false);
  });
  it('không phải Lead thì quyền vẫn bị giữ nguyên như cũ', () => {
    const inc = clone(users());
    inc[2]!.perms = ['cv.xem', 'viec.giao'];
    expect(protectUsers(inc, users(), 'c_nv', false).find((u) => u.id === 'u_nv')!.perms).toEqual(['cv.xem', 'luong.quanly']);
  });
});

describe('Quản trị phòng: HCNS thêm người đã duyệt', () => {
  it('gắn được tài khoản đã duyệt, quyền trống, vai trò người thường', () => {
    const inc = [...clone(users()), { id: 'u_new', crm: 'c_new', role: 'content', perms: ['pl.xem'], phongBan: 'CM', name: 'Người mới', needPerm: true }];
    const out = protectUsers(inc, users(), 'c_hr', true, { approvedCrm: new Set(['c_new']) });
    const n = out.find((u) => u.id === 'u_new')!;
    expect(n.crm).toBe('c_new');
    expect(n.perms).toEqual([]);
    expect(n.role).toBe('content');
  });
  it('tài khoản chưa duyệt hoặc vai trò quản trị thì không gắn', () => {
    const inc = [...clone(users()), { id: 'u_x', crm: 'c_x', role: 'admin', perms: [], phongBan: 'CM', name: 'X' }];
    const n = protectUsers(inc, users(), 'c_hr', true, { approvedCrm: new Set() }).find((u) => u.id === 'u_x')!;
    expect(n.crm).toBe('');
    expect(n.role).toBe('nhanvien');
  });
});

describe('Quản trị phòng: menu, mẫu quyền, nhật ký, hoàn tác', () => {
  const lead = leadOf(users(), 'c_lead', undefined)!;
  it('Lead chỉ sửa phòng mình, không đổi cấu hình CEO; mẫu bỏ quyền ngoài phạm vi', () => {
    const old = { cfg: { depts: ['CM'] }, dept: { ADS: { hide: ['lich'] } } };
    const inc = { cfg: { depts: ['CM', 'ADS', 'KT'] }, dept: { ADS: { hide: [] }, CM: { hide: ['win'], tpl: { 'Nhân viên Content': ['cv.xem', 'pl.xem', 'viec.giao'] } } } };
    const out = protectQtpb(inc, old, false, lead) as { cfg: { depts: string[] }; dept: Record<string, { hide: string[]; tpl: Record<string, string[]> }> };
    expect(out.cfg.depts).toEqual(['CM']);
    expect(out.dept.ADS!.hide).toEqual(['lich']);
    expect(out.dept.CM!.hide).toEqual(['win']);
    expect(out.dept.CM!.tpl['Nhân viên Content']).toEqual(['cv.xem', 'viec.giao']);
    expect(protectQtpb(inc, old, false, null)).toEqual(old);
  });
  it('ghi nhật ký đổi quyền + khóa + menu, rồi hoàn tác trả về như cũ', () => {
    const prev = users();
    const next = clone(prev);
    next[2]!.perms = ['cv.xem', 'luong.quanly', 'viec.giao'];
    next[2]!.active = false;
    const rows = diffForLog(prev, next, {}, { dept: { CM: { hide: ['win'] } } }, 'CM');
    expect(rows.map((r) => r.action).sort()).toEqual(['lock', 'menu', 'perms']);
    const data = { users: clone(next), qtpb: { dept: { CM: { hide: ['win'] } } } };
    for (const r of rows) expect(applyUndo(data, r)).toBe(true);
    expect(data.users.find((u) => u.id === 'u_nv')!.perms).toEqual(['cv.xem', 'luong.quanly']);
    expect(data.users.find((u) => u.id === 'u_nv')!.active).toBe(true);
    expect(data.qtpb.dept.CM!.hide).toEqual([]);
  });
});

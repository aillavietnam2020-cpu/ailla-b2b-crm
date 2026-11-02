import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Đồng bộ Tài khoản & phân quyền ↔ hồ sơ Nhân sự (hub/src/nsdongbo.js), chị Hoa 02/11/2026. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(`${readFileSync('hub/src/nsdongbo.js', 'utf8')}\nreturn {nsdbFromUser,nsdbFromStaff,nsdbToast};`)();

/* eslint-disable @typescript-eslint/no-explicit-any */
const base = (): any => ({
  departments: [
    { k: 'CM', n: 'Content', khoi: 'Văn phòng' },
    { k: 'KHO', n: 'Kho', khoi: 'Sản xuất' },
  ],
  users: [
    { id: 'u1', name: 'Nguyễn Thị Lan', role: 'nhanvien', phongBan: 'CM', title: 'Content', active: true, maNS: 'NV001', crm: 'c1' },
    { id: 'u2', name: 'Trần Văn Bình', role: 'nhanvien', phongBan: 'CM', title: '', active: true, crm: 'c2' },
    { id: 'ceo', name: 'Chị Hoa', role: 'admin', phongBan: 'BDH', active: true, crm: 'c0' },
  ],
  staff: [
    { ma: 'NV001', ten: 'Nguyễn Thị Lan', pb: 'CM', khoi: 'Văn phòng', viTri: 'Content', tt: 'Thử việc' },
    { ma: 'NV002', ten: 'Tran Van Binh', pb: '', khoi: '', viTri: 'Kho', tt: 'Chính thức' },
  ],
});

describe('Tài khoản → hồ sơ Nhân sự', () => {
  it('đổi phòng ban, chức vụ thì hồ sơ đổi theo (kèm khối)', () => {
    const d = base();
    d.users[0].phongBan = 'KHO';
    d.users[0].title = 'Thủ kho';
    T.nsdbFromUser(d, 'u1', ['pb', 'title']);
    expect(d.staff[0]).toMatchObject({ pb: 'KHO', khoi: 'Sản xuất', viTri: 'Thủ kho', tt: 'Thử việc' });
  });

  it('trạng thái: nghỉ phép, thai sản, đã nghỉ, quay lại làm', () => {
    const d = base();
    d.users[0].tt = 'thaisan';
    T.nsdbFromUser(d, 'u1', ['tt']);
    expect(d.staff[0].tt).toBe('Nghỉ thai sản');
    d.users[0].active = false;
    d.users[0].tt = '';
    T.nsdbFromUser(d, 'u1', ['tt']);
    expect(d.staff[0].tt).toBe('Đã nghỉ');
    d.users[0].active = true;
    T.nsdbFromUser(d, 'u1', ['tt']);
    expect(d.staff[0].tt).toBe('Chính thức');
  });

  it('đổi phòng ban không đụng trạng thái hồ sơ', () => {
    const d = base();
    d.staff[0].tt = 'Tạm nghỉ';
    d.users[0].phongBan = 'KHO';
    T.nsdbFromUser(d, 'u1', ['pb']);
    expect(d.staff[0].tt).toBe('Tạm nghỉ');
  });

  it('tài khoản chưa nối: nối với hồ sơ trùng tên (không dấu), không tạo trùng', () => {
    const d = base();
    const r = T.nsdbFromUser(d, 'u2', null, '2026-11-02');
    expect(r.created).toBe(false);
    expect(d.users[1].maNS).toBe('NV002');
    expect(d.staff).toHaveLength(2);
    expect(d.staff[1].pb).toBe('CM');
  });

  it('người mới thêm ở Tài khoản thì có luôn hồ sơ Nhân sự', () => {
    const d = base();
    d.users.push({ id: 'u3', name: 'Lê Mới', role: 'nhanvien', phongBan: 'KHO', title: 'Kho', active: true, crm: 'c3' });
    const r = T.nsdbFromUser(d, 'u3', null, '2026-11-02');
    expect(r.created).toBe(true);
    expect(d.users[3].maNS).toBe('NV003');
    expect(d.staff[2]).toMatchObject({ ma: 'NV003', ten: 'Lê Mới', pb: 'KHO', khoi: 'Sản xuất', viTri: 'Kho', tt: 'Thử việc', ngayVao: '2026-11-02' });
  });

  it('không tạo hồ sơ cho tài khoản đã khóa hay tài khoản quản trị', () => {
    const d = base();
    expect(T.nsdbFromUser(d, 'ceo', null)).toBeNull();
    d.users[1].active = false;
    d.staff = [];
    expect(T.nsdbFromUser(d, 'u2', null)).toBeNull();
  });
});

describe('Hồ sơ Nhân sự → tài khoản', () => {
  it('Đã nghỉ thì khóa tài khoản; nghỉ phép / thai sản giữ tài khoản', () => {
    const d = base();
    d.staff[0].tt = 'Nghỉ phép';
    expect(T.nsdbFromStaff(d, 'NV001', ['tt'], false)).toMatchObject({ lock: false });
    expect(d.users[0]).toMatchObject({ active: true, tt: 'phep' });
    d.staff[0].tt = 'Đã nghỉ';
    const r = T.nsdbFromStaff(d, 'NV001', ['tt'], false);
    expect(r.lock).toBe(true);
    expect(d.users[0].active).toBe(false);
    expect(T.nsdbToast(r)).toContain('đã khóa');
  });

  it('quay lại làm: CEO mở lại tài khoản, người khác thì tài khoản vẫn khóa', () => {
    const d = base();
    d.users[0].active = false;
    d.staff[0].tt = 'Chính thức';
    const held = T.nsdbFromStaff(d, 'NV001', ['tt'], false);
    expect(held.held).toBe(true);
    expect(d.users[0].active).toBe(false);
    const open = T.nsdbFromStaff(d, 'NV001', ['tt'], true);
    expect(open.unlock).toBe(true);
    expect(d.users[0]).toMatchObject({ active: true, tt: '' });
  });

  it('phòng ban, vị trí chép sang tài khoản; hồ sơ chưa nối tài khoản thì thôi', () => {
    const d = base();
    d.staff[0].pb = 'KHO';
    d.staff[0].viTri = 'Thủ kho';
    T.nsdbFromStaff(d, 'NV001', ['pb', 'viTri'], false);
    expect(d.users[0]).toMatchObject({ phongBan: 'KHO', title: 'Thủ kho', active: true });
    expect(T.nsdbFromStaff(d, 'NV002', ['tt'], false)).toBeNull();
  });
});

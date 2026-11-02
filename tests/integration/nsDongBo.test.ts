import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Nhân sự "Đã nghỉ" thì khóa tài khoản đăng nhập; nhân viên thường không tự đổi được trạng thái (chị Hoa 02/11/2026). */
let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

/* eslint-disable @typescript-eslint/no-explicit-any */
const state = (): any => ({
  users: [
    { id: 'u_chi', name: 'Chị Hoa', role: 'admin', crm: 'user-ceo', phongBan: '', perms: [], active: true },
    { id: 'u_thao', name: 'Thảo', role: 'nhanvien', crm: 'user-thao', phongBan: 'KD', perms: [], active: true, maNS: 'NV1' },
    { id: 'u_hr', name: 'Nhân sự', role: 'nhanvien', crm: 'user-huyen', phongBan: 'HCNS', perms: [], active: true, maNS: 'NV2' },
    { id: 'u_ql', name: 'Quản lý', role: 'truongphong', crm: 'user-manager', phongBan: 'KD', perms: [], active: true, maNS: 'NV3' },
  ],
  staff: [
    { ma: 'NV1', ten: 'Thảo', pb: 'KD', tt: 'Chính thức' },
    { ma: 'NV2', ten: 'Nhân sự', pb: 'HCNS', tt: 'Chính thức' },
    { ma: 'NV3', ten: 'Quản lý', pb: 'KD', tt: 'Chính thức' },
  ],
  cards: [],
  hr: { loaded: true, ns: { NV1: { luong: 1 } } },
});

async function init() {
  for (const id of ['user-thao', 'user-huyen', 'user-manager']) {
    await ctx.request(`/api/admin/users/${id}/marketing`, { as: USERS.ceo, body: { mode: 'only' } });
  }
  const put = await ctx.request('/api/hub/state', { as: USERS.ceo, method: 'PUT', body: { version: 0, data: state() } });
  expect(put.status).toBe(200);
}

async function save(as: string, edit: (d: any) => void, withHr = false) {
  const s = await ctx.request('/api/hub/state', { as });
  const d = s.body.data.data;
  edit(d);
  const res = await ctx.request('/api/hub/state', {
    as,
    method: 'PUT',
    body: { version: s.body.data.version, data: d, hr: withHr ? 1 : undefined },
  });
  expect(res.status).toBe(200);
}

const status = async (id: string) =>
  (await ctx.db.prepare('SELECT status FROM users WHERE id = ?').bind(id).first<{ status: string }>())?.status;

describe('Đồng bộ Tài khoản & phân quyền ↔ Nhân sự', () => {
  it('người làm nhân sự chuyển một người sang Đã nghỉ: tài khoản bị khóa, không vào web được nữa', async () => {
    await init();
    expect((await ctx.request('/api/hub/state', { as: USERS.thao })).status).toBe(200);
    await save(USERS.huyen, (d) => {
      d.staff[0].tt = 'Đã nghỉ';
      Object.assign(d.users[1], { active: false, tt: '' });
    }, true);
    expect(await status('user-thao')).toBe('DISABLED');
    expect((await ctx.request('/api/hub/state', { as: USERS.thao })).status).toBeGreaterThanOrEqual(401);
    const ceo = await ctx.request('/api/hub/state', { as: USERS.ceo });
    expect(ceo.body.data.data.users[1].active).toBe(false);
    expect(ceo.body.data.data.staff[0].tt).toBe('Đã nghỉ');
  });

  it('người làm nhân sự không mở lại được tài khoản đã khóa; CEO mở lại thì đăng nhập được', async () => {
    await init();
    await save(USERS.ceo, (d) => Object.assign(d.users[1], { active: false }));
    expect(await status('user-thao')).toBe('DISABLED');
    await save(USERS.huyen, (d) => {
      d.staff[0].tt = 'Chính thức';
      d.users[1].active = true;
    }, true);
    expect(await status('user-thao')).toBe('DISABLED');
    expect((await ctx.request('/api/hub/state', { as: USERS.ceo })).body.data.data.users[1].active).toBe(false);
    await save(USERS.ceo, (d) => Object.assign(d.users[1], { active: true }));
    expect(await status('user-thao')).toBe('ACTIVE');
  });

  it('người làm nhân sự đổi được phòng ban, nghỉ phép / thai sản của người khác', async () => {
    await init();
    await save(USERS.huyen, (d) => {
      d.staff[2].pb = 'CM';
      d.staff[2].tt = 'Nghỉ thai sản';
      Object.assign(d.users[3], { phongBan: 'CM', tt: 'thaisan' });
    }, true);
    const d = (await ctx.request('/api/hub/state', { as: USERS.ceo })).body.data.data;
    expect(d.users[3]).toMatchObject({ phongBan: 'CM', tt: 'thaisan', active: true });
    expect(d.staff[2]).toMatchObject({ pb: 'CM', tt: 'Nghỉ thai sản' });
    expect(await status('user-manager')).toBe('ACTIVE');
  });

  it('nhân viên thường không tự đổi được trạng thái, phòng ban, mã nhân sự, hồ sơ của ai', async () => {
    await init();
    await save(USERS.thao, (d) => {
      d.staff[2].tt = 'Đã nghỉ';
      d.staff[0].pb = 'HCNS';
      Object.assign(d.users[3], { active: false });
      Object.assign(d.users[1], { phongBan: 'HCNS', tt: 'phep', maNS: 'NV2' });
    });
    expect(await status('user-manager')).toBe('ACTIVE');
    const d = (await ctx.request('/api/hub/state', { as: USERS.ceo })).body.data.data;
    expect(d.users[3].active).toBe(true);
    expect(d.users[1]).toMatchObject({ phongBan: 'KD', maNS: 'NV1' });
    expect(d.users[1].tt).toBeUndefined();
    expect(d.staff[2].tt).toBe('Chính thức');
    expect(d.staff[0].pb).toBe('KD');
  });

  it('người làm nhân sự bị khóa thì mất luôn quyền xem nhân sự', async () => {
    await init();
    await save(USERS.ceo, (d) => Object.assign(d.users[3], { phongBan: 'HCNS' }));
    expect((await ctx.request('/api/hub/state', { as: USERS.huyen })).body.data.hr_ok).toBe(true);
    await save(USERS.manager, (d) => Object.assign(d.users[2], { active: false }), true);
    expect(await status('user-huyen')).toBe('DISABLED');
    const grant = await ctx.db.prepare("SELECT data FROM hub_blobs WHERE key = 'hr_grant'").first<{ data: string }>();
    expect(JSON.parse(grant!.data)).not.toContain('user-huyen');
  });

  it('không ai khóa được tài khoản CEO qua bản chung', async () => {
    await init();
    await save(USERS.huyen, (d) => Object.assign(d.users[0], { active: false }), true);
    expect(await status('user-ceo')).toBe('ACTIVE');
  });
});

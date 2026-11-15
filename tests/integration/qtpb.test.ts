import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Quản trị phòng ban đợt 1 (CEO duyệt demo 14/11/2026): Lead tự quản nhân sự phòng mình, HCNS duyệt người mới, CEO hoàn tác. */
let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

/* eslint-disable @typescript-eslint/no-explicit-any */
const state = (): any => ({
  users: [
    { id: 'u_chi', name: 'CEO', role: 'admin', crm: 'user-ceo', phongBan: '', perms: [], active: true },
    { id: 'u_lead', name: 'Lead Content', role: 'lead', crm: 'user-manager', phongBan: 'CM', perms: ['cv.xem', 'viec.giao', 'kho.gan', 'pl.xem'], active: true, maNS: 'NV3' },
    { id: 'u_nv', name: 'NV Content', role: 'content', crm: 'user-thao', phongBan: 'CM', perms: ['cv.xem'], active: true, maNS: 'NV1' },
    { id: 'u_hr', name: 'HCNS', role: 'nhanvien', crm: 'user-huyen', phongBan: 'HCNS', perms: [], active: true, maNS: 'NV2' },
  ],
  staff: [
    { ma: 'NV1', ten: 'NV Content', pb: 'CM', tt: 'Chính thức' },
    { ma: 'NV2', ten: 'HCNS', pb: 'HCNS', tt: 'Chính thức' },
    { ma: 'NV3', ten: 'Lead Content', pb: 'CM', tt: 'Chính thức' },
  ],
  cards: [],
  tasks: [],
  hr: { loaded: true, ns: {} },
});

async function init() {
  for (const id of ['user-thao', 'user-huyen', 'user-manager']) {
    await ctx.request(`/api/admin/users/${id}/marketing`, { as: USERS.ceo, body: { mode: 'only' } });
  }
  expect((await ctx.request('/api/hub/state', { as: USERS.ceo, method: 'PUT', body: { version: 0, data: state() } })).status).toBe(200);
}
async function save(as: string, edit: (d: any) => void, withHr = false) {
  const s = await ctx.request('/api/hub/state', { as });
  const d = s.body.data.data;
  edit(d);
  const res = await ctx.request('/api/hub/state', { as, method: 'PUT', body: { version: s.body.data.version, data: d, hr: withHr ? 1 : undefined } });
  expect(res.status).toBe(200);
}
const ceoData = async () => (await ctx.request('/api/hub/state', { as: USERS.ceo })).body.data.data;
const status = async (id: string) => (await ctx.db.prepare('SELECT status FROM users WHERE id = ?').bind(id).first<{ status: string }>())?.status;

describe('Quản trị phòng ban', () => {
  it('Lead gửi đề nghị → HCNS duyệt → có tài khoản; HCNS gắn vào bản chung với quyền trống', async () => {
    await init();
    const body = { name: 'Người mới', email: 'nguoimoi@ailla.vn', title: 'Nhân viên Media', cap: 'Thực tập sinh' };
    expect((await ctx.request('/api/hub/qtpb/requests', { as: USERS.thao, method: 'POST', body })).status).toBe(403);
    expect((await ctx.request('/api/hub/qtpb/requests', { as: USERS.manager, method: 'POST', body })).status).toBe(200);
    expect((await ctx.request('/api/hub/qtpb/requests', { as: USERS.thao })).status).toBe(403);
    const list = await ctx.request('/api/hub/qtpb/requests', { as: USERS.huyen });
    expect(list.status).toBe(200);
    const r = list.body.data.rows.find((x: any) => x.email === 'nguoimoi@ailla.vn');
    expect(r.status).toBe('PENDING');
    // Lead không tự duyệt được
    expect((await ctx.request(`/api/hub/qtpb/requests/${r.id}/decide`, { as: USERS.manager, method: 'POST', body: { approve: true } })).status).toBe(403);
    const dec = await ctx.request(`/api/hub/qtpb/requests/${r.id}/decide`, { as: USERS.huyen, method: 'POST', body: { approve: true } });
    expect(dec.status).toBe(200);
    const crm = dec.body.data.crm_id;
    expect(dec.body.data.password).toMatch(/[A-Za-z]/);
    expect(await status(crm)).toBe('ACTIVE');
    await save(USERS.huyen, (d) => {
      d.users.push({ id: 'u_new', name: 'Người mới', role: 'content', crm, phongBan: 'CM', perms: ['pl.xem'], active: true, needPerm: true });
    }, true);
    const n = (await ceoData()).users.find((u: any) => u.id === 'u_new');
    expect(n).toMatchObject({ crm, perms: [], role: 'content', needPerm: true });
  });

  it('Lead cấp quyền trong phạm vi, khóa người nghỉ; nhật ký ghi lại; CEO hoàn tác mở lại tài khoản', async () => {
    await init();
    await save(USERS.manager, (d) => {
      const nv = d.users.find((u: any) => u.id === 'u_nv');
      nv.perms = ['cv.xem', 'viec.giao', 'pl.xem', 'luong.quanly'];
      nv.active = false;
      d.qtpb = { cfg: { depts: ['CM', 'ADS'] }, dept: { CM: { hide: ['win'], tpl: {} } } };
    });
    const d = await ceoData();
    const nv = d.users.find((u: any) => u.id === 'u_nv');
    expect(nv.perms.sort()).toEqual(['cv.xem', 'viec.giao']);
    expect(nv.active).toBe(false);
    expect(await status('user-thao')).toBe('DISABLED');
    expect(d.qtpb.cfg).toBeUndefined(); // Lead không đổi được cấu hình của CEO
    expect(d.qtpb.dept.CM.hide).toEqual(['win']);

    const log = await ctx.request('/api/hub/qtpb/log', { as: USERS.manager });
    expect(log.status).toBe(200);
    const acts = log.body.data.rows.map((x: any) => x.action).sort();
    expect(acts).toEqual(['lock', 'menu', 'perms']);
    const lock = log.body.data.rows.find((x: any) => x.action === 'lock');
    // Lead, HCNS không hoàn tác được
    expect((await ctx.request(`/api/hub/qtpb/log/${lock.id}/undo`, { as: USERS.manager, method: 'POST' })).status).toBe(403);
    expect((await ctx.request(`/api/hub/qtpb/log/${lock.id}/undo`, { as: USERS.ceo, method: 'POST' })).status).toBe(200);
    expect(await status('user-thao')).toBe('ACTIVE');
    expect((await ceoData()).users.find((u: any) => u.id === 'u_nv').active).toBe(true);
    expect((await ctx.request(`/api/hub/qtpb/log/${lock.id}/undo`, { as: USERS.ceo, method: 'POST' })).status).toBe(400);
  });

  it('Quản lý có quyền hoàn tác thì hoàn tác được; phòng chưa mở thì Lead không sửa được gì', async () => {
    await init();
    await save(USERS.ceo, (d) => {
      d.users.find((u: any) => u.id === 'u_hr').perms = ['qtpb.hoantac'];
    });
    await save(USERS.manager, (d) => {
      d.users.find((u: any) => u.id === 'u_nv').perms = ['cv.xem', 'kho.gan'];
    });
    const log = await ctx.request('/api/hub/qtpb/log', { as: USERS.huyen });
    const row = log.body.data.rows.find((x: any) => x.action === 'perms');
    expect((await ctx.request(`/api/hub/qtpb/log/${row.id}/undo`, { as: USERS.huyen, method: 'POST' })).status).toBe(200);
    expect((await ceoData()).users.find((u: any) => u.id === 'u_nv').perms).toEqual(['cv.xem']);

    await save(USERS.ceo, (d) => {
      d.qtpb = { cfg: { depts: ['ADS'] } };
    });
    await save(USERS.manager, (d) => {
      d.users.find((u: any) => u.id === 'u_nv').perms = ['cv.xem', 'kho.gan'];
    });
    expect((await ceoData()).users.find((u: any) => u.id === 'u_nv').perms).toEqual(['cv.xem']);
  });
});

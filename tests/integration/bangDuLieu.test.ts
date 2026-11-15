import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Bảng dữ liệu (Quản trị phòng ban đợt 3): Lead tạo bảng, nhân sự phòng thêm / sửa dòng theo quyền, CEO hoàn tác. */
let ctx: TestContext;
beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
  for (const id of ['user-thao', 'user-huyen', 'user-manager']) {
    await ctx.request(`/api/admin/users/${id}/marketing`, { as: USERS.ceo, body: { mode: 'only' } });
  }
  const data = {
    users: [
      { id: 'u_chi', name: 'CEO', role: 'admin', crm: 'user-ceo', phongBan: '', perms: [], active: true },
      { id: 'u_lead', name: 'Lead Content', role: 'lead', crm: 'user-manager', phongBan: 'CM', perms: ['cv.xem'], active: true },
      { id: 'u_nv', name: 'NV Content', role: 'content', crm: 'user-thao', phongBan: 'CM', perms: ['cv.xem'], active: true },
      { id: 'u_hr', name: 'HCNS', role: 'nhanvien', crm: 'user-huyen', phongBan: 'HCNS', perms: [], active: true },
    ],
    staff: [],
    cards: [],
    tasks: [],
    hr: { loaded: true, ns: {} },
  };
  expect((await ctx.request('/api/hub/state', { as: USERS.ceo, method: 'PUT', body: { version: 0, data } })).status).toBe(200);
});

const DEF = {
  cols: [
    { k: 'cy', t: 'Ý tưởng', ty: 'text' },
    { k: 'cst', t: 'Trạng thái', ty: 'sel', opts: ['Ý tưởng', 'Đã quay'] },
    { k: 'cng', t: 'Người phụ trách', ty: 'user' },
  ],
  metrics: [{ t: 'Đã quay', kind: 'dem', fc: 'cst', fv: 'Đã quay' }],
  xem: { mode: 'phong', them: [] },
  sua: 'phutrach',
  kan: 'cst',
};

describe('Bảng dữ liệu', () => {
  it('Lead tạo bảng; nhân viên phòng thêm, sửa dòng của mình; phòng khác không thấy; CEO hoàn tác đổi cột', async () => {
    expect((await ctx.request('/api/hub/qtpb/bang', { as: USERS.thao, method: 'POST', body: { name: 'X', def: DEF } })).status).toBe(403);
    const cr = await ctx.request('/api/hub/qtpb/bang', { as: USERS.manager, method: 'POST', body: { name: 'Kho ý tưởng hook', def: DEF } });
    expect(cr.status).toBe(200);
    const id = cr.body.data.table.id as string;
    expect(cr.body.data.table.dept).toBe('CM');

    // nhân viên phòng thấy bảng, thêm dòng
    const list = await ctx.request('/api/hub/qtpb/bang', { as: USERS.thao });
    expect(list.body.data.tables.map((t: { id: string }) => t.id)).toEqual([id]);
    expect(list.body.data.tables[0].design).toBe(false);
    const add = await ctx.request(`/api/hub/qtpb/bang/${id}/rows`, { as: USERS.thao, method: 'POST', body: { data: { cy: 'Hook 1', cst: 'Ý tưởng' } } });
    expect(add.status).toBe(200);
    const rid = add.body.data.row.id as string;
    // Lead thêm dòng giao cho người khác: nhân viên không sửa được
    const add2 = await ctx.request(`/api/hub/qtpb/bang/${id}/rows`, { as: USERS.manager, method: 'POST', body: { data: { cy: 'Hook 2', cng: 'u_lead' } } });
    const rid2 = add2.body.data.row.id as string;
    expect((await ctx.request(`/api/hub/qtpb/bang/${id}/rows/${rid}`, { as: USERS.thao, method: 'PUT', body: { data: { cst: 'Đã quay' } } })).status).toBe(200);
    expect((await ctx.request(`/api/hub/qtpb/bang/${id}/rows/${rid2}`, { as: USERS.thao, method: 'PUT', body: { data: { cst: 'Đã quay' } } })).status).toBe(403);
    expect((await ctx.request(`/api/hub/qtpb/bang/${id}`, { as: USERS.thao, method: 'PUT', body: { def: { ...DEF, sua: 'phong' } } })).status).toBe(403);

    // HCNS (phòng khác) không thấy, không thêm được
    expect((await ctx.request('/api/hub/qtpb/bang', { as: USERS.huyen })).body.data.tables).toHaveLength(0);
    expect((await ctx.request(`/api/hub/qtpb/bang/${id}`, { as: USERS.huyen })).status).toBe(403);
    // Lead mời HCNS xem: thấy nhưng không thêm dòng
    expect((await ctx.request(`/api/hub/qtpb/bang/${id}`, { as: USERS.manager, method: 'PUT', body: { def: { ...DEF, xem: { mode: 'phong', them: ['HCNS'] } } } })).status).toBe(200);
    expect((await ctx.request('/api/hub/state', { as: USERS.huyen })).body.data.data.qtpb.bangXem).toEqual(['HCNS']);
    const hv = await ctx.request(`/api/hub/qtpb/bang/${id}`, { as: USERS.huyen });
    expect(hv.status).toBe(200);
    expect(hv.body.data.rows).toHaveLength(2);
    expect((await ctx.request(`/api/hub/qtpb/bang/${id}/rows`, { as: USERS.huyen, method: 'POST', body: { data: { cy: 'x' } } })).status).toBe(403);

    // Lead bỏ cột Trạng thái → dữ liệu ô vẫn giữ; CEO hoàn tác → cột quay lại cùng dữ liệu
    const noSt = { ...DEF, cols: DEF.cols.filter((c) => c.k !== 'cst'), metrics: [], kan: '', xem: { mode: 'phong', them: ['HCNS'] } };
    expect((await ctx.request(`/api/hub/qtpb/bang/${id}`, { as: USERS.manager, method: 'PUT', body: { def: noSt } })).status).toBe(200);
    const log = await ctx.request('/api/hub/qtpb/log', { as: USERS.manager });
    const rows = log.body.data.rows.filter((r: { action: string }) => r.action === 'bang');
    expect(rows.map((r: { summary: string }) => r.summary)).toContain('Bảng "Kho ý tưởng hook": bỏ cột "Trạng thái"; sửa chỉ số tự tính; đổi cột chia thẻ');
    const last = rows[0];
    expect((await ctx.request(`/api/hub/qtpb/log/${last.id}/undo`, { as: USERS.manager, method: 'POST' })).status).toBe(403);
    expect((await ctx.request(`/api/hub/qtpb/log/${last.id}/undo`, { as: USERS.ceo, method: 'POST' })).status).toBe(200);
    const back = await ctx.request(`/api/hub/qtpb/bang/${id}`, { as: USERS.manager });
    expect(back.body.data.table.def.cols.map((c: { k: string }) => c.k)).toContain('cst');
    expect(back.body.data.table.def.kan).toBe('cst');

    // hoàn tác việc mời HCNS (làm trước) không làm mất cột Trạng thái vừa khôi phục, chỉ bỏ quyền xem của HCNS
    const inv = rows.find((r: { summary: string }) => r.summary === 'Bảng "Kho ý tưởng hook": đổi ai được xem');
    expect((await ctx.request(`/api/hub/qtpb/log/${inv.id}/undo`, { as: USERS.ceo, method: 'POST' })).status).toBe(200);
    const b2 = await ctx.request(`/api/hub/qtpb/bang/${id}`, { as: USERS.manager });
    expect(b2.body.data.table.def.xem.them).toEqual([]);
    expect(b2.body.data.table.def.cols.map((c: { k: string }) => c.k)).toEqual(['cy', 'cst', 'cng']);
    expect((await ctx.request(`/api/hub/qtpb/bang/${id}`, { as: USERS.huyen })).status).toBe(403);
    expect((await ctx.request(`/api/hub/qtpb/bang/${id}`, { as: USERS.manager, method: 'PUT', body: { def: { ...DEF, xem: { mode: 'phong', them: ['HCNS'] } } } })).status).toBe(200);
    expect(back.body.data.rows.find((r: { id: string }) => r.id === rid).data.cst).toBe('Đã quay');

    // Lead xóa bảng → CEO hoàn tác → bảng quay lại
    expect((await ctx.request(`/api/hub/qtpb/bang/${id}`, { as: USERS.manager, method: 'DELETE' })).status).toBe(200);
    expect((await ctx.request('/api/hub/qtpb/bang', { as: USERS.thao })).body.data.tables).toHaveLength(0);
    expect((await ctx.request('/api/hub/state', { as: USERS.ceo })).body.data.data.qtpb.bangXem).toEqual([]);
    const log2 = await ctx.request('/api/hub/qtpb/log', { as: USERS.ceo });
    const del = log2.body.data.rows.find((r: { summary: string }) => r.summary === 'Xóa bảng "Kho ý tưởng hook"');
    expect((await ctx.request(`/api/hub/qtpb/log/${del.id}/undo`, { as: USERS.ceo, method: 'POST' })).status).toBe(200);
    expect((await ctx.request('/api/hub/qtpb/bang', { as: USERS.thao })).body.data.tables).toHaveLength(1);
  });
});

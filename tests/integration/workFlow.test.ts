import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, type TestContext } from '../helpers/app';
import { pack, unpack } from '../../src/server/lib/pack';
import { flowCron } from '../../src/server/services/flowGate';

/** Work Flow của phòng (như demo 14/11/2026): Lead đặt nhân viên duyệt bước 1, Lead duyệt bước cuối; quá hạn báo Lead. */
let ctx: TestContext;
const NOW = '2026-11-14T01:00:00.000Z';
const NV = 'nv@ailla.vn';
const NV2 = 'nv2@ailla.vn';
const LEAD = 'lead@ailla.vn';
const KHO = 'kho@ailla.vn';

async function addUser(id: string, email: string, name: string, perms: string[]) {
  await ctx.db.prepare("INSERT INTO users (id, email, display_name, role, status, created_at, updated_at) VALUES (?, ?, ?, 'EMPLOYEE', 'ACTIVE', ?, ?)").bind(id, email, name, NOW, NOW).run();
  for (const p of ['hub.access', ...perms])
    await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(id, p, 'user-ceo', NOW).run();
}
const req = (path: string, as: string, body?: unknown, method?: string) => ctx.request(path, { as, body, method } as never);
const notifs = async () => {
  const r = await ctx.db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  return (JSON.parse(await unpack(r!.data)).notifs ?? []) as Array<{ to: string; text: string }>;
};

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await addUser('user-nv', NV, 'NV Content', []);
  await addUser('user-nv2', NV2, 'Chuyên viên Content', []);
  await addUser('user-lead', LEAD, 'Lead Content', []);
  await addUser('user-kho', KHO, 'Kế toán kho', ['sx.kiemke']);
  const main = {
    users: [
      { id: 'u_ceo', crm: 'user-ceo', name: 'CEO', role: 'admin', phongBan: 'BDH' },
      { id: 'u_nv', crm: 'user-nv', name: 'NV Content', role: 'content', phongBan: 'CM' },
      { id: 'u_nv2', crm: 'user-nv2', name: 'Chuyên viên Content', role: 'content', phongBan: 'CM' },
      { id: 'u_lead', crm: 'user-lead', name: 'Lead Content', role: 'lead', phongBan: 'CM' },
      { id: 'u_kho', crm: 'user-kho', name: 'Kho', role: 'nhanvien', phongBan: 'KV' },
    ],
    notifs: [],
    qtpb: {
      cfg: { depts: ['CM'] },
      dept: {
        CM: {
          flow: { mau: { steps: [{ ai: 'u:u_nv2', han: 1 }, { ai: 'lead', han: 0 }], qh: 'lead' } },
          cflows: [{ id: 'nkoc01', ten: 'Xin booking KOC', steps: [{ ai: 'u:u_nv2', han: 0 }, { ai: 'lead', han: 0 }], qh: 'nhac' }],
        },
      },
    },
  };
  await ctx.db.prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('main', 1, ?, ?)").bind(await pack(JSON.stringify(main)), NOW).run();
  await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES ('TDGS500', 'Tinh dầu giặt sấy 500ml', 'chai', 'TP', '', 0, 1, ?)").bind(NOW).run();
});

describe('Work Flow của phòng', () => {
  it('hàng mẫu: nhân viên được đặt duyệt bước 1 → Lead duyệt bước cuối → sang kho', async () => {
    const r = await req('/api/hub/dodung/mau', NV, { noi: 'vp', kho_code: 'TDGS500', sl: 2, shoot_txt: 'quay so sánh' });
    expect(r.status).toBe(200);
    const id = r.body.data.id;
    const cho = await req('/api/hub/qtpb/flow/cho', NV2);
    expect(cho.body.data.d1.map((x: { id: string }) => x.id)).toEqual([id]);
    expect((await req('/api/hub/qtpb/flow/cho', LEAD)).body.data.d1).toHaveLength(0);
    const a = await req(`/api/hub/dodung/mau/${id}/duyet`, NV2, { ok: true }, 'POST');
    expect(a.status).toBe(200);
    expect(a.body.data).toMatchObject({ st: 'lead', buoc: 1 });
    expect((await notifs()).some((n) => n.to === 'u_lead' && /chuyển bạn duyệt/.test(n.text))).toBe(true);
    expect((await req(`/api/hub/dodung/mau/${id}/duyet`, NV2, { ok: true }, 'POST')).status).toBe(403);
    expect((await req('/api/hub/qtpb/flow/cho', NV2)).body.data.d1).toHaveLength(0);
    const b = await req(`/api/hub/dodung/mau/${id}/duyet`, LEAD, { ok: true }, 'POST');
    expect(b.body.data.st).toBe('kho');
  });

  it('đề xuất theo Work Flow mới: gửi → nhân viên duyệt bước 1 → Lead duyệt → xong; người khác không duyệt được', async () => {
    const r = await req('/api/hub/qtpb/flow/items', NV, { flow_id: 'nkoc01', tieu_de: 'Booking KOC A', noi_dung: 'Giá 2 triệu' }, 'POST');
    expect(r.status).toBe(200);
    const id = r.body.data.id;
    expect((await req(`/api/hub/qtpb/flow/items/${id}/duyet`, NV, { ok: true }, 'POST')).status).toBe(403);
    expect((await req(`/api/hub/qtpb/flow/items/${id}/duyet`, NV2, { ok: true }, 'POST')).body.data).toMatchObject({ st: 'cho', buoc: 2 });
    expect((await req(`/api/hub/qtpb/flow/items/${id}/duyet`, NV2, { ok: true }, 'POST')).status).toBe(403);
    expect((await req(`/api/hub/qtpb/flow/items/${id}/duyet`, LEAD, { ok: true }, 'POST')).body.data.st).toBe('xong');
    const mine = (await req('/api/hub/qtpb/flow/cho', NV)).body.data.mine;
    expect(mine[0].st).toBe('xong');
  });

  it('quá hạn bước của nhân viên: máy chủ báo người duyệt và Lead (quá hạn thì báo Lead), không báo lặp', async () => {
    const id = (await req('/api/hub/dodung/mau', NV, { noi: 'vp', kho_code: 'TDGS500', sl: 1, shoot_txt: 'x' })).body.data.id;
    await ctx.db.prepare('UPDATE dd_mau SET created_at = ? WHERE id = ?').bind(new Date(Date.now() - 3 * 3_600_000).toISOString(), id).run();
    const r1 = await flowCron(ctx.db as never);
    expect(r1).toEqual({ moi: 1, quaHan: 1 });
    const n = await notifs();
    expect(n.some((x) => x.to === 'u_nv2' && /Bạn có việc cần duyệt/.test(x.text))).toBe(true);
    expect(n.some((x) => x.to === 'u_lead' && /Quá hạn duyệt 1 giờ/.test(x.text))).toBe(true);
    expect(await flowCron(ctx.db as never)).toEqual({ moi: 0, quaHan: 0 });
  });
});

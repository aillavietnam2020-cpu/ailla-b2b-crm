import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

async function createAccount(email: string) {
  const r = await ctx.request('/api/admin/users', {
    as: USERS.ceo,
    body: { email, display_name: 'Nhân sự thử', role: 'EMPLOYEE', password: 'Matkhau123' },
  });
  expect(r.status).toBe(201);
  return r.body.data.id as string;
}

describe('Sửa email và xóa tài khoản nhập nhầm', () => {
  it('sửa email gõ sai, không cho trùng email khác', async () => {
    const id = await createAccount('sai@gmial.com');
    const ok = await ctx.request(`/api/admin/users/${id}`, {
      as: USERS.ceo,
      method: 'PATCH',
      body: { email: 'Dung@Gmail.com' },
    });
    expect(ok.status).toBe(200);
    const row = await ctx.db.prepare('SELECT email FROM users WHERE id = ?').bind(id).first<{ email: string }>();
    expect(row?.email).toBe('dung@gmail.com');

    const other = await createAccount('khac@gmail.com');
    const clash = await ctx.request(`/api/admin/users/${other}`, {
      as: USERS.ceo,
      method: 'PATCH',
      body: { email: 'dung@gmail.com' },
    });
    expect(clash.status).toBe(400);
    expect(clash.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('xóa tài khoản chưa có dữ liệu và tạo lại được đúng email đó; tài khoản đang phụ trách đơn thì không xóa', async () => {
    const id = await createAccount('nham@gmail.com');
    const del = await ctx.request(`/api/admin/users/${id}`, { as: USERS.ceo, method: 'DELETE' });
    expect(del.status).toBe(200);
    const list = await ctx.request('/api/admin/users', { as: USERS.ceo });
    expect((list.body.data as Array<{ id: string }>).some((u) => u.id === id)).toBe(false);
    // Email được giải phóng: tạo lại đúng địa chỉ đó được.
    await createAccount('nham@gmail.com');

    // Tài khoản của Thảo đang phụ trách khách/đơn thì chặn.
    const thao = await ctx.db.prepare("SELECT id FROM users WHERE email = ?").bind(USERS.thao).first<{ id: string }>();
    const blocked = await ctx.request(`/api/admin/users/${thao!.id}`, { as: USERS.ceo, method: 'DELETE' });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.code).toBe('USER_IN_USE');

    // Không tự xóa mình.
    const me = await ctx.db.prepare("SELECT id FROM users WHERE email = ?").bind(USERS.ceo).first<{ id: string }>();
    const self = await ctx.request(`/api/admin/users/${me!.id}`, { as: USERS.ceo, method: 'DELETE' });
    expect(self.status).toBe(400);
  });
});

describe('Bật gói Kế toán / Kho thì cấp luôn quyền vào Trang quản trị', () => {
  it('kế toán và kế toán kho có hub.access để thấy khối Sản xuất & kho', async () => {
    const hasHub = async (id: string) =>
      (await ctx.db
        .prepare("SELECT COUNT(*) AS n FROM user_permissions WHERE user_id = ? AND permission = 'hub.access'")
        .bind(id)
        .first<{ n: number }>())!.n;
    const a = await createAccount('ketoan@gmail.com');
    expect(await hasHub(a)).toBe(0);
    const r1 = await ctx.request(`/api/admin/users/${a}/accountant`, { as: USERS.ceo, body: { enabled: true } });
    expect(r1.status).toBe(200);
    expect(await hasHub(a)).toBe(1);

    const b = await createAccount('khokt@gmail.com');
    const r2 = await ctx.request(`/api/admin/users/${b}/warehouse`, { as: USERS.ceo, body: { enabled: true } });
    expect(r2.status).toBe(200);
    expect(await hasHub(b)).toBe(1);
  });
});

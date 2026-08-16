import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '@server/lib/password';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

const PASSWORD = 'ailla2026';

/** Đặt mật khẩu thật cho các tài khoản seed để test luồng đăng nhập bằng mật khẩu. */
async function setPassword(email: string, password: string, mustChange = 0) {
  const hash = await hashPassword(password);
  await ctx.db
    .prepare(
      `UPDATE users SET password_hash = ?, must_change_password = ?, password_updated_at = ?
       WHERE lower(email) = lower(?)`,
    )
    .bind(hash, mustChange, '2026-08-16T00:00:00.000Z', email)
    .run();
}

function cookieFrom(setCookie: string | null): string {
  return (setCookie ?? '').split(';')[0];
}

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

describe('Đăng nhập bằng mật khẩu', () => {
  it('đăng nhập đúng mật khẩu thì nhận được cookie phiên và gọi được API', async () => {
    await setPassword(USERS.thao, PASSWORD);

    const login = await ctx.request('/api/auth/login', {
      body: { email: USERS.thao, password: PASSWORD },
    });
    expect(login.status).toBe(200);
    expect(login.setCookie).toContain('ailla_session=');
    expect(login.setCookie).toContain('HttpOnly');
    expect(login.setCookie).toContain('SameSite=Lax');

    const me = await ctx.request('/api/me', { cookie: cookieFrom(login.setCookie) });
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(USERS.thao);
    expect(me.body.data.scope).toBe('OWN');
  });

  it('sai mật khẩu bị từ chối và không nói rõ email có tồn tại hay không', async () => {
    await setPassword(USERS.thao, PASSWORD);

    const wrongPassword = await ctx.request('/api/auth/login', {
      body: { email: USERS.thao, password: 'sai-mat-khau-1' },
    });
    const unknownEmail = await ctx.request('/api/auth/login', {
      body: { email: 'khongcoai@ailla.vn', password: 'sai-mat-khau-1' },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('nhập sai 5 lần thì khoá tạm tài khoản', async () => {
    await setPassword(USERS.thao, PASSWORD);
    for (let i = 0; i < 5; i += 1) {
      await ctx.request('/api/auth/login', { body: { email: USERS.thao, password: 'sai-roi-1' } });
    }
    const blocked = await ctx.request('/api/auth/login', {
      body: { email: USERS.thao, password: PASSWORD },
    });
    expect(blocked.status).toBe(401);
    expect(blocked.body.error.message).toContain('tạm khoá');
  });

  it('đăng xuất thì cookie cũ không dùng được nữa', async () => {
    await setPassword(USERS.thao, PASSWORD);
    const login = await ctx.request('/api/auth/login', {
      body: { email: USERS.thao, password: PASSWORD },
    });
    const cookie = cookieFrom(login.setCookie);

    await ctx.request('/api/auth/logout', { cookie, method: 'POST' });
    const after = await ctx.request('/api/me', { cookie });
    expect(after.status).toBe(401);
  });

  it('tài khoản bị khoá thì không đăng nhập được', async () => {
    await setPassword(USERS.huyen, PASSWORD);
    await ctx.db.prepare(`UPDATE users SET status = 'DISABLED' WHERE email = ?`).bind(USERS.huyen).run();

    const res = await ctx.request('/api/auth/login', {
      body: { email: USERS.huyen, password: PASSWORD },
    });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('khoá');
  });

  it('đổi mật khẩu xong thì mọi phiên cũ bị thu hồi', async () => {
    await setPassword(USERS.thao, PASSWORD);
    const login = await ctx.request('/api/auth/login', {
      body: { email: USERS.thao, password: PASSWORD },
    });
    const cookie = cookieFrom(login.setCookie);

    const changed = await ctx.request('/api/auth/change-password', {
      cookie,
      body: { current_password: PASSWORD, new_password: 'matkhaumoi2026' },
    });
    expect(changed.status).toBe(200);

    const oldSession = await ctx.request('/api/me', { cookie });
    expect(oldSession.status).toBe(401);

    const relogin = await ctx.request('/api/auth/login', {
      body: { email: USERS.thao, password: 'matkhaumoi2026' },
    });
    expect(relogin.status).toBe(200);
  });

  it('mật khẩu yếu bị từ chối', async () => {
    await setPassword(USERS.thao, PASSWORD);
    const login = await ctx.request('/api/auth/login', {
      body: { email: USERS.thao, password: PASSWORD },
    });
    const res = await ctx.request('/api/auth/change-password', {
      cookie: cookieFrom(login.setCookie),
      body: { current_password: PASSWORD, new_password: '123' },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('WEAK_PASSWORD');
  });
});

describe('Quản lý tài khoản nhân sự', () => {
  it('nhân viên không được xem hoặc tạo tài khoản', async () => {
    const list = await ctx.request('/api/admin/users', { as: USERS.thao });
    expect(list.status).toBe(403);

    const create = await ctx.request('/api/admin/users', {
      as: USERS.thao,
      body: { email: 'moi@ailla.vn', display_name: 'Người mới', role: 'EMPLOYEE', password: 'matkhau123' },
    });
    expect(create.status).toBe(403);
  });

  it('quản lý tạo được tài khoản nhân viên, người mới phải đổi mật khẩu khi vào', async () => {
    const created = await ctx.request('/api/admin/users', {
      as: USERS.manager,
      body: {
        email: 'saleMoi@ailla.vn',
        display_name: 'Sale mới',
        role: 'EMPLOYEE',
        legacy_name: 'Mới',
        password: 'matkhau123',
      },
    });
    expect(created.status).toBe(201);

    const login = await ctx.request('/api/auth/login', {
      body: { email: 'salemoi@ailla.vn', password: 'matkhau123' },
    });
    expect(login.status).toBe(200);
    expect(login.body.data.must_change_password).toBe(true);
  });

  it('quản lý không được tạo tài khoản CEO', async () => {
    const res = await ctx.request('/api/admin/users', {
      as: USERS.manager,
      body: { email: 'ceo2@ailla.vn', display_name: 'CEO 2', role: 'CEO', password: 'matkhau123' },
    });
    expect(res.status).toBe(403);
  });

  it('khoá tài khoản thì phiên đang đăng nhập bị đá ra ngay', async () => {
    await setPassword(USERS.huyen, PASSWORD);
    const login = await ctx.request('/api/auth/login', {
      body: { email: USERS.huyen, password: PASSWORD },
    });
    const cookie = cookieFrom(login.setCookie);
    expect((await ctx.request('/api/me', { cookie })).status).toBe(200);

    const target = await ctx.db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(USERS.huyen)
      .first<{ id: string }>();
    const disabled = await ctx.request(`/api/admin/users/${target!.id}`, {
      as: USERS.manager,
      method: 'PATCH',
      body: { status: 'DISABLED' },
    });
    expect(disabled.status).toBe(200);

    const after = await ctx.request('/api/me', { cookie });
    expect(after.status).toBe(401);
  });

  it('CEO đặt lại mật khẩu cho nhân viên và bắt đổi ở lần đăng nhập kế tiếp', async () => {
    const target = await ctx.db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(USERS.thao)
      .first<{ id: string }>();

    const res = await ctx.request(`/api/admin/users/${target!.id}/set-password`, {
      as: USERS.ceo,
      body: { password: 'matkhaucapmoi1' },
    });
    expect(res.status).toBe(200);

    const login = await ctx.request('/api/auth/login', {
      body: { email: USERS.thao, password: 'matkhaucapmoi1' },
    });
    expect(login.status).toBe(200);
    expect(login.body.data.must_change_password).toBe(true);
  });
});

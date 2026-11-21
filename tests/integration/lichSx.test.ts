import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Lịch sản xuất đề xuất: câu lấy dữ liệu chạy được trên cơ sở dữ liệu thật, đúng quyền. */
let ctx: TestContext;
const grant = (u: string, p: string) =>
  ctx.db.prepare("INSERT INTO user_permissions (user_id, permission, created_at) VALUES (?, ?, '2026-11-21T00:00:00.000Z')").bind(u, p).run();
beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await grant('user-manager', 'hub.access');
  await grant('user-thao', 'hub.access');
});

describe('GET /api/hub/kho/lich-sx', () => {
  it('CEO và quản lý xem được, trả về 5 ngày', async () => {
    for (const u of [USERS.ceo, USERS.manager]) {
      const r = await ctx.request('/api/hub/kho/lich-sx', { as: u, method: 'GET' });
      expect([u, r.status]).toEqual([u, 200]);
      expect(r.body.data.days).toHaveLength(5);
    }
  });
  it('nhân viên khác không xem được', async () => {
    const r = await ctx.request('/api/hub/kho/lich-sx', { as: USERS.thao, method: 'GET' });
    expect(r.status).toBe(403);
  });
});

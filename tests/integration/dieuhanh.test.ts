import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Phòng điều hành: bảng giá bán để so với giá thành chỉ CEO / kế toán đọc được. */
let ctx: TestContext;
const NOW = '2026-10-24T01:00:00.000Z';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await ctx.db
    .prepare("INSERT INTO users (id, email, display_name, role, status, created_at, updated_at) VALUES ('user-nv', 'nv@ailla.vn', 'NV', 'EMPLOYEE', 'ACTIVE', ?, ?)")
    .bind(NOW, NOW)
    .run();
  await ctx.db.prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES ('user-nv', 'hub.access', 'user-ceo', ?)").bind(NOW).run();
});

describe('Phòng điều hành: giá bán', () => {
  it('nhân viên không xem được, CEO xem được', async () => {
    expect((await ctx.request('/api/hub/dieuhanh/sell-prices', { as: 'nv@ailla.vn' })).status).toBe(403);
    const r = await ctx.request('/api/hub/dieuhanh/sell-prices', { as: USERS.ceo });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.tier_prices)).toBe(true);
    expect(Array.isArray(r.body.data.customer_prices)).toBe(true);
  });
});

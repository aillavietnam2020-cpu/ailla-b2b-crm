import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, type TestContext } from '../helpers/app';

let ctx: TestContext;
const NOW = '2026-10-16T01:00:00.000Z';
const CHUC = 'chuc2@ailla.vn';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await ctx.db
    .prepare(
      `INSERT INTO users (id, email, display_name, role, status, created_at, updated_at)
       VALUES ('user-chuc2', ?, 'Chúc (test)', 'EMPLOYEE', 'ACTIVE', ?, ?)`,
    )
    .bind(CHUC, NOW, NOW)
    .run();
  await ctx.db
    .prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES ('user-chuc2', 'hub.access', 'user-ceo', ?)")
    .bind(NOW)
    .run();
});

describe('Quyền kho của kế toán kho (Chúc)', () => {
  it('chỉ có hub.access thì chưa quét/đồng bộ hàng hoàn được', async () => {
    const r = await ctx.request('/api/hub/kho/ret/sync', { as: CHUC, body: { channel: 'SHOPEE', day: '2026-10-01' } });
    expect(r.status).toBe(403);
  });

  it('có quyền kiểm kê (sx.kiemke) thì qua được cổng quyền', async () => {
    await ctx.db
      .prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES ('user-chuc2', 'sx.kiemke', 'user-ceo', ?)")
      .bind(NOW)
      .run();
    const r = await ctx.request('/api/hub/kho/ret/sync', { as: CHUC, body: { channel: 'SHOPEE', day: '2026-10-01' } });
    expect(r.status).not.toBe(403);
  });
});

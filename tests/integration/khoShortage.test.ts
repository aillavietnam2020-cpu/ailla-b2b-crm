import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Tạo yêu cầu pha chế / phiếu sản xuất mà tồn không đủ (06/11): sinh việc cho phụ trách mua hàng. */
let ctx: TestContext;
beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
});

describe('thiếu vật tư khi tạo phiếu', () => {
  it('sinh việc đặt hàng / kiểm tra tồn lệch', async () => {
    const r = await ctx.request('/api/hub/kho/shortage-task', { as: USERS.ceo, body: { ref: 'YCPC2611-009', lines: [{ item: 'NVL1', name: 'Hương chanh', unit: 'kg', thieu: 12.5 }] } });
    expect(r.status).toBe(200);
    const t = await ctx.db.prepare("SELECT title FROM tasks WHERE status = 'OPEN' AND title LIKE 'Thiếu vật tư cho YCPC2611-009:%'").all<{ title: string }>();
    expect(t.results.length).toBeGreaterThan(0);
    expect(t.results[0].title).toContain('Hương chanh thiếu 12,5 kg');
  });
  it('thiếu thông tin thì báo lỗi', async () => {
    const r = await ctx.request('/api/hub/kho/shortage-task', { as: USERS.ceo, body: { ref: 'X', lines: [] } });
    expect(r.status).toBe(400);
  });
});

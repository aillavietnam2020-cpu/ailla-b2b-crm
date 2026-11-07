import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Quy tắc kế toán (07/11): mặc định cho xuất âm kho; tắt thì phiếu làm âm bị chặn; khóa sổ chặn phiếu cũ; có nhật ký. */
let ctx: TestContext;
const NOW = '2026-11-01T01:00:00.000Z';
beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES ('VT', 'Vật tư', 'kg', 'NVL', '', 0, 1, ?)").bind(NOW).run();
});
const xuat = (date: string) => ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'XK', date, lines: [{ item: 'VT', qty: 5 }] } });

describe('quy tắc kế toán', () => {
  it('mặc định cho xuất âm, tắt thì chặn, có nhật ký', async () => {
    const g = await ctx.request('/api/acc-rules', { as: USERS.ceo, method: 'GET' });
    expect(g.body.data.rules.allow_negative).toBe(true);
    const a = await xuat('2026-11-05');
    expect(a.status).toBe(200);
    const p = await ctx.request('/api/acc-rules', { as: USERS.ceo, method: 'PUT', body: { allow_negative: false } });
    expect(p.status).toBe(200);
    const b = await xuat('2026-11-05');
    expect(b.status).toBe(409);
    const g2 = await ctx.request('/api/acc-rules', { as: USERS.ceo, method: 'GET' });
    expect(g2.body.data.log.length).toBe(1);
  });
  it('khóa sổ chặn phiếu có ngày cũ', async () => {
    await ctx.request('/api/acc-rules', { as: USERS.ceo, method: 'PUT', body: { lock_date: '2026-11-03' } });
    expect((await xuat('2026-11-03')).status).toBe(409);
    expect((await xuat('2026-11-04')).status).toBe(200);
  });
});

describe('ai sửa được quy tắc kế toán', () => {
  it('nhân viên thường không sửa được; có quyền xác nhận kế toán hoặc quyền riêng thì sửa được', async () => {
    expect((await ctx.request('/api/acc-rules', { as: USERS.huyen, method: 'PUT', body: { allow_negative: false } })).status).toBe(403);
    await ctx.db.prepare("INSERT INTO user_permissions (user_id, permission, created_at) VALUES ('user-huyen', 'order.accounting.confirm', '2026-11-07T00:00:00.000Z')").run();
    expect((await ctx.request('/api/acc-rules', { as: USERS.huyen, method: 'PUT', body: { allow_negative: false } })).status).toBe(200);
    await ctx.db.prepare("INSERT INTO user_permissions (user_id, permission, created_at) VALUES ('user-thao', 'accounting.rules.edit', '2026-11-07T00:00:00.000Z')").run();
    expect((await ctx.request('/api/acc-rules', { as: USERS.thao, method: 'PUT', body: { allow_negative: true } })).status).toBe(200);
  });
});

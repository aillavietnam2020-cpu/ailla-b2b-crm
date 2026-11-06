import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Sửa ngày đặt đơn (06/11): sale tạo nhầm ngày thì sửa được, không cho ngày tương lai, có nhật ký. */
let ctx: TestContext;
beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

describe('POST /api/orders/:id/order-date', () => {
  it('đổi ngày đơn, chặn ngày tương lai, ghi nhật ký', async () => {
    const created = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 10 }] },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await ctx.request(`/api/orders/${id}/order-date`, { as: USERS.thao, body: { order_date: '2099-01-01' } })).status).toBe(422);
    const r = await ctx.request(`/api/orders/${id}/order-date`, { as: USERS.thao, body: { order_date: '2026-11-01', reason: 'tạo nhầm ngày' } });
    expect(r.status).toBe(200);
    const d = await ctx.request(`/api/orders/${id}`, { as: USERS.thao });
    expect(d.body.data.order_date).toBe('2026-11-01');
    const log = await ctx.db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'ORDER_DATE_EDITED' AND entity_id = ?").bind(id).first<{ n: number }>();
    expect(log?.n).toBe(1);
  });
});

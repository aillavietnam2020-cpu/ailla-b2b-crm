import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
  await ctx.db.prepare("UPDATE customers SET tier_id = 'tier-khac' WHERE id = 'cus-thao-1'").run();
});

describe('Cấp giá "Khác": giá tự thỏa thuận, không cảnh báo, không bắt duyệt giá', () => {
  it('có cấp Khác trong danh sách cấp nhưng không nằm trong bảng giá 8 cấp', async () => {
    const tiers = await ctx.request('/api/tiers', { as: USERS.thao });
    expect(tiers.body.data.some((t: { code: string }) => t.code === 'KHAC')).toBe(true);
  });

  it('tạo đơn cho khách cấp Khác: nhập giá nào lưu giá đó, không đánh dấu lệch giá', async () => {
    const created = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: {
        customer_id: 'cus-thao-1',
        items: [{ product_id: 'prod-full', qty: 3, applied_price: 87000 }],
        discount_amount: 0,
        shipping_fee: 0,
      },
    });
    expect(created.status).toBe(201);
    const detail = await ctx.request(`/api/orders/${created.body.data.id}`, { as: USERS.thao });
    const item = detail.body.data.items[0];
    expect(item.applied_price).toBe(87000);
    expect(item.price_override).toBeFalsy();
    expect(detail.body.data.subtotal).toBe(261000);
  });

  it('không nhập giá thì báo cần nhập giá', async () => {
    const res = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 1 }], discount_amount: 0, shipping_fee: 0 },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

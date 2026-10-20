import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

const preview = async (date = '2026-10-14') => {
  const r = await ctx.request('/api/orders/preview', {
    as: USERS.thao,
    body: { customer_id: 'cus-thao-1', order_date: date, items: [{ product_id: 'prod-full', qty: 2 }] },
  });
  expect(r.status).toBe(200);
  return r.body.data.lines[0] as { base_price: number; applied_price: number };
};

const add = (body: Record<string, unknown>) => ctx.request('/api/price-adjustments', { as: USERS.ceo, body });

describe('Giá điều chỉnh / khuyến mại', () => {
  it('chọn nhiều mã; áp cả nhóm / mọi sản phẩm nhưng loại trừ mã không tăng', async () => {
    const before = (await preview()).base_price;
    // Áp mọi sản phẩm +10% nhưng loại trừ mã này: giá giữ nguyên.
    const r1 = await add({ label: 'Tăng chung', scope: 'ALL', exclude_ids: ['prod-full'], kind: 'PERCENT', value: 10, round_to: 1, valid_from: '2026-10-01' });
    expect(r1.status).toBe(200);
    expect((await preview()).base_price).toBe(before);
    // Chọn nhiều mã (có mã này): mã được tăng.
    const r2 = await add({ label: 'Nhiều mã', scope: 'PRODUCT', product_ids: ['prod-full', 'prod-missing'], kind: 'PERCENT', value: 5, round_to: 1, valid_from: '2026-10-01' });
    expect(r2.status).toBe(200);
    expect((await preview()).base_price).toBe(Math.round(before * 1.05));
    // Danh sách trả đủ tên các mã đã chọn và mã loại trừ.
    const list = await ctx.request('/api/price-adjustments', { as: USERS.ceo });
    const multi = list.body.data.find((x: { label: string }) => x.label === 'Nhiều mã');
    expect(multi.products.length).toBe(2);
    const chung = list.body.data.find((x: { label: string }) => x.label === 'Tăng chung');
    expect(chung.excludes.map((p: { id: string }) => p.id)).toEqual(['prod-full']);
    // Thiếu mã thì báo lỗi.
    const bad = await add({ label: 'Thiếu', scope: 'PRODUCT', product_ids: [], kind: 'PERCENT', value: 5, valid_from: '2026-10-01' });
    expect(bad.status).toBe(422);
  });

  it('+1% tạm thời áp vào giá đơn; tắt hoặc hết hạn thì về giá gốc', async () => {
    const before = (await preview()).base_price;
    const r = await add({
      label: 'Nguyên liệu tăng giá',
      scope: 'PRODUCT',
      product_id: 'prod-full',
      kind: 'PERCENT',
      value: 10,
      round_to: 1,
      valid_from: '2026-10-01',
    });
    expect(r.status).toBe(200);
    const after = await preview();
    expect(after.base_price).toBe(Math.round(before * 1.1));
    expect(after.applied_price).toBe(after.base_price);

    // Ngày trước khi điều chỉnh có hiệu lực: giá gốc.
    expect((await preview('2026-09-20')).base_price).toBe(before);

    // Tắt: về giá gốc ngay.
    const list = await ctx.request('/api/price-adjustments', { as: USERS.ceo });
    expect(list.body.data[0].state).toBe('DANG_AP_DUNG');
    await ctx.request(`/api/price-adjustments/${list.body.data[0].id}/toggle`, { as: USERS.ceo, body: { active: false } });
    expect((await preview()).base_price).toBe(before);
  });

  it('hết hạn thì về giá gốc; mã cụ thể thắng điều chỉnh chung; chỉ CEO thêm', async () => {
    const before = (await preview()).base_price;
    await add({ label: 'Chung', scope: 'ALL', kind: 'AMOUNT', value: 5000, round_to: 1, valid_from: '2026-10-01', valid_to: '2026-10-10' });
    expect((await preview('2026-10-14')).base_price).toBe(before); // đã hết hạn
    expect((await preview('2026-10-05')).base_price).toBe(before + 5000);

    await add({ label: 'Riêng mã', scope: 'PRODUCT', product_id: 'prod-full', kind: 'FIXED', value: 90000, round_to: 1, valid_from: '2026-10-01' });
    expect((await preview('2026-10-05')).base_price).toBe(90000); // mã cụ thể thắng ALL

    const denied = await ctx.request('/api/price-adjustments', {
      as: USERS.manager,
      body: { label: 'x', scope: 'ALL', kind: 'PERCENT', value: 1 },
    });
    expect(denied.status).toBe(403);
  });

  it('danh mục trả giá đang áp (eff_prices) bên cạnh giá gốc', async () => {
    await add({ label: 'Tăng 10%', scope: 'ALL', kind: 'PERCENT', value: 10, round_to: 1, valid_from: '2026-01-01' });
    const r = await ctx.request('/api/prices', { as: USERS.thao });
    const p = r.body.data.products.find((x: { sku: string }) => x.sku === 'TEST-FULL');
    expect(p.eff_prices.DL_C1).toBe(Math.round(p.prices.DL_C1 * 1.1));
    expect(p.adjusted.length).toBeGreaterThan(0);
  });
});

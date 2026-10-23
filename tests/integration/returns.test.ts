import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';
import { getCustomerDebt } from '../../src/server/services/debts';

let ctx: TestContext;
const CHUC = 'chuc@ailla.vn';
const NOW = '2026-10-01T01:00:00.000Z';

async function seedKho() {
  const db = ctx.db;
  await db
    .prepare(
      `INSERT INTO users (id, email, display_name, role, status, created_at, updated_at)
       VALUES ('user-chuc', ?, 'Chúc kế toán kho (test)', 'EMPLOYEE', 'ACTIVE', ?, ?)`,
    )
    .bind(CHUC, NOW, NOW)
    .run();
  await db
    .prepare(
      `INSERT INTO user_permissions (user_id, permission, granted_by, created_at)
       VALUES ('user-chuc', 'order.kho.process', 'user-ceo', ?)`,
    )
    .bind(NOW)
    .run();
  await db
    .prepare("INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES ('TP-FULL', 'Nước giặt 5L (TP)', 'Can', 'TP', ?)")
    .bind(NOW)
    .run();
  await db.prepare("INSERT INTO kho_map (crm_sku, misa_code, factor) VALUES ('TEST-FULL', 'TP-FULL', 1)").run();
  await db.prepare("INSERT INTO kho_cfg (k, v) VALUES ('b2b_from', '2026-01-01')").run();
}

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
  await seedKho();
});

const stock = async () =>
  (await ctx.db.prepare("SELECT COALESCE(SUM(qty), 0) AS n FROM kho_ledger WHERE item = 'TP-FULL'").first<{ n: number }>())!.n;

async function createReturn(as = USERS.thao, qty = 2) {
  return ctx.request('/api/returns', {
    as,
    body: {
      customer_id: 'cus-thao-1',
      reason: 'Khách trả vì sai quy cách',
      items: [{ product_id: 'prod-full', qty, unit_price: 100000 }],
    },
  });
}

describe('Phiếu hàng trả lại', () => {
  it('đi trọn luồng: sale tạo → kho nhận (tăng tồn) → kế toán xác nhận (giảm công nợ)', async () => {
    const before = await getCustomerDebt(ctx.db as unknown as D1Database, 'cus-thao-1');
    const stockBefore = await stock();

    const created = await createReturn();
    expect(created.status).toBe(200);
    const r = created.body.data;
    expect(r.status).toBe('CHO_KHO');
    expect(r.claimed_amount).toBe(200000);
    expect(r.return_no).toMatch(/^TH\d{6}-0001$/);

    // Chưa nhận hàng thì chưa đổi tồn, chưa đổi công nợ.
    expect(await stock()).toBe(stockBefore);
    expect((await getCustomerDebt(ctx.db as unknown as D1Database, 'cus-thao-1')).official_debt).toBe(before.official_debt);

    // Sale / quản lý không nhận hàng thay kho.
    const lines = r.items.map((l: { id: string }) => ({ line_id: l.id, received_qty: 2, condition: 'CON_BAN_DUOC' }));
    expect((await ctx.request(`/api/returns/${r.id}/receive`, { as: USERS.thao, body: { lines } })).status).toBe(403);

    const received = await ctx.request(`/api/returns/${r.id}/receive`, { as: CHUC, body: { lines, note: 'Hàng nguyên seal' } });
    expect(received.status).toBe(200);
    expect(received.body.data.status).toBe('DA_NHAN_KHO');
    expect(received.body.data.credit_amount).toBe(200000);
    expect(await stock()).toBe(stockBefore + 2);
    // Kho nhận xong mới "chờ ghi giảm": chỉ giảm công nợ dự kiến, chưa giảm chính thức.
    const mid = await getCustomerDebt(ctx.db as unknown as D1Database, 'cus-thao-1');
    expect(mid.official_debt).toBe(before.official_debt);
    expect(mid.projected_debt).toBe(before.projected_debt - 200000);

    // Kho không tự xác nhận giảm nợ thay kế toán.
    expect((await ctx.request(`/api/returns/${r.id}/confirm`, { as: CHUC, body: { resolution: 'TRU_CONG_NO' } })).status).toBe(403);
    const done = await ctx.request(`/api/returns/${r.id}/confirm`, {
      as: USERS.manager,
      body: { resolution: 'TRU_CONG_NO' },
    });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('DA_GIAM_NO');
    const after = await getCustomerDebt(ctx.db as unknown as D1Database, 'cus-thao-1');
    expect(after.official_debt).toBe(before.official_debt - 200000);
    expect(after.projected_debt).toBe(before.projected_debt - 200000);
    expect(done.body.data.log.map((l: { action: string }) => l.action)).toEqual([
      'TAO_PHIEU',
      'KHO_NHAN_HANG',
      'KE_TOAN_XAC_NHAN',
    ]);
  });

  it('hàng hỏng thì không nhập lại tồn nhưng vẫn giảm công nợ theo số nhận', async () => {
    const stockBefore = await stock();
    const r = (await createReturn()).body.data;
    const lines = r.items.map((l: { id: string }) => ({ line_id: l.id, received_qty: 1, condition: 'HONG' }));
    const received = await ctx.request(`/api/returns/${r.id}/receive`, { as: CHUC, body: { lines } });
    expect(received.body.data.credit_amount).toBe(100000);
    expect(await stock()).toBe(stockBefore);
  });

  it('không nhận nhiều hơn khách báo trả; phải ghi đủ mọi dòng', async () => {
    const r = (await createReturn()).body.data;
    const over = await ctx.request(`/api/returns/${r.id}/receive`, {
      as: CHUC,
      body: { lines: [{ line_id: r.items[0].id, received_qty: 3, condition: 'CON_BAN_DUOC' }] },
    });
    expect(over.status).toBe(400);
    expect(over.body.error.code).toBe('RECEIVED_EXCEEDS');
  });

  it('huỷ phiếu chưa giảm nợ thì tồn và công nợ không đổi; phiếu đã giảm nợ thì không huỷ được', async () => {
    const stockBefore = await stock();
    const r = (await createReturn()).body.data;
    const lines = r.items.map((l: { id: string }) => ({ line_id: l.id, received_qty: 2, condition: 'CON_BAN_DUOC' }));
    await ctx.request(`/api/returns/${r.id}/receive`, { as: CHUC, body: { lines } });
    expect(await stock()).toBe(stockBefore + 2);
    const cancel = await ctx.request(`/api/returns/${r.id}/cancel`, { as: USERS.thao, body: { reason: 'nhầm' } });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('HUY');
    expect(await stock()).toBe(stockBefore);

    const r2 = (await createReturn()).body.data;
    await ctx.request(`/api/returns/${r2.id}/receive`, {
      as: CHUC,
      body: { lines: r2.items.map((l: { id: string }) => ({ line_id: l.id, received_qty: 2, condition: 'CON_BAN_DUOC' })) },
    });
    await ctx.request(`/api/returns/${r2.id}/confirm`, { as: USERS.manager, body: { resolution: 'HOAN_TIEN' } });
    expect((await ctx.request(`/api/returns/${r2.id}/cancel`, { as: USERS.manager, body: {} })).status).toBe(400);
  });

  it('sale chỉ tạo phiếu cho khách của mình và chỉ thấy phiếu của mình', async () => {
    const r = await ctx.request('/api/returns', {
      as: USERS.huyen,
      body: { customer_id: 'cus-thao-1', reason: 'thử', items: [{ product_id: 'prod-full', qty: 1, unit_price: 1 }] },
    });
    expect(r.status).toBe(404);
    const mine = (await createReturn()).body.data;
    const list = await ctx.request('/api/returns', { as: USERS.huyen });
    expect(list.body.data.find((x: { id: string }) => x.id === mine.id)).toBeUndefined();
    expect((await ctx.request(`/api/returns/${mine.id}`, { as: USERS.huyen })).status).toBe(404);
    expect((await ctx.request('/api/returns', { as: USERS.thao })).body.data).toHaveLength(1);
  });
  it('hàng lỗi không thu về: không qua kho, không đổi tồn, kế toán xác nhận thẳng thì giảm công nợ', async () => {
    const before = await getCustomerDebt(ctx.db as unknown as D1Database, 'cus-thao-1');
    const stockBefore = await stock();
    const short = await ctx.request('/api/returns', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', reason: 'lỗi', no_collect: true, items: [{ product_id: 'prod-full', qty: 2, unit_price: 100000 }] },
    });
    expect(short.status).toBe(400);
    const created = await ctx.request('/api/returns', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', reason: 'Hàng móp vỡ, khách không gửi trả, bù cho khách', no_collect: true, items: [{ product_id: 'prod-full', qty: 2, unit_price: 100000 }] },
    });
    expect(created.status).toBe(200);
    const r = created.body.data;
    expect(r.status).toBe('DA_NHAN_KHO');
    expect(r.no_collect).toBe(1);
    expect(r.credit_amount).toBe(200000);
    expect(await stock()).toBe(stockBefore);
    const done = await ctx.request(`/api/returns/${r.id}/confirm`, { as: USERS.manager, body: { resolution: 'TRU_CONG_NO' } });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('DA_GIAM_NO');
    const after = await getCustomerDebt(ctx.db as unknown as D1Database, 'cus-thao-1');
    expect(after.official_debt).toBe(before.official_debt - 200000);
    expect(await stock()).toBe(stockBefore);
  });
  it('trả hàng của đơn có hàng tặng: phần hàng bán hoàn tiền, phần hàng tặng trả lại không hoàn tiền', async () => {
    const created = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', order_date: '2026-08-16', items: [{ product_id: 'prod-full', qty: 10 }, { product_id: 'prod-full', qty: 2, is_gift: true }] },
    });
    expect(created.status).toBe(201);
    const orderId = created.body.data.id as string;
    const price = (await ctx.db.prepare('SELECT applied_price FROM order_items WHERE order_id = ?').bind(orderId).first<{ applied_price: number }>())!.applied_price;
    const r = await ctx.request('/api/returns', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', order_id: orderId, reason: 'Khách trả cả hàng bán lẫn hàng tặng', items: [{ product_id: 'prod-full', qty: 12 }] },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.claimed_amount).toBe(price * 10);
    const qtys = (r.body.data.items as Array<{ qty: number; unit_price: number }>).map((l) => [l.qty, l.unit_price]);
    expect(qtys).toEqual([[10, price], [2, 0]]);
  });
});

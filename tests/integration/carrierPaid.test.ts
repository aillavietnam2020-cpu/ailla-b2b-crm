import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const T = '2026-10-14T00:00:00.000Z';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
  await ctx.db
    .prepare(
      `INSERT INTO orders (id, order_no, customer_id, owner_id, order_date, subtotal, total_amount,
         approval_status, delivery_status, payment_status, accounting_status, created_at, updated_at)
       VALUES ('o-c', 'DH-CUOC', 'cus-thao-1', 'user-thao', '2026-10-14', 10000000, 10000000,
         'APPROVED', 'DA_GIAO', 'CHUA_THU', 'CHUA_XAC_NHAN', ?, ?)`,
    )
    .bind(T, T)
    .run();
});

describe('Khách trả cước nhà xe hộ (miễn ship, trừ vào tiền đơn)', () => {
  it('ghi một phiếu thu bù trừ vào đơn và một phiếu chi vận chuyển', async () => {
    const r = await ctx.request('/api/orders/o-c/carrier-paid', {
      as: USERS.thao,
      body: { amount: 300000, carrier: 'Nhà xe Hà Thành 29C-123.45', note: 'Giao NPP Hải Dương' },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.voucher_no).toMatch(/^PCVC\d{4}-001$/);

    const pay = await ctx.db
      .prepare('SELECT amount, method, accounting_status, customer_id FROM payments WHERE id = ?')
      .bind(r.body.data.payment_id)
      .first<{ amount: number; method: string; accounting_status: string; customer_id: string }>();
    expect(pay).toMatchObject({ amount: 300000, method: 'Bù trừ cước vận chuyển', accounting_status: 'CHUA_XAC_NHAN', customer_id: 'cus-thao-1' });
    const alloc = await ctx.db
      .prepare('SELECT amount FROM payment_allocations WHERE payment_id = ? AND order_id = ?')
      .bind(r.body.data.payment_id, 'o-c')
      .first<{ amount: number }>();
    expect(alloc?.amount).toBe(300000);

    const v = await ctx.db
      .prepare('SELECT amount, method, order_refs, carrier, status FROM shipping_vouchers WHERE voucher_no = ?')
      .bind(r.body.data.voucher_no)
      .first<{ amount: number; method: string; order_refs: string; carrier: string; status: string }>();
    expect(v).toMatchObject({ amount: 300000, method: 'KHAC', order_refs: 'DH-CUOC', status: 'OK' });
  });

  it('người có quyền kế toán (Thảo) ghi cước thì phiếu thu bù trừ được xác nhận luôn', async () => {
    const r = await ctx.request('/api/orders/o-c/carrier-paid', {
      as: USERS.manager,
      body: { amount: 300000, carrier: 'Nhà xe Hà Thành' },
    });
    expect(r.status).toBe(200);
    const pay = await ctx.db
      .prepare('SELECT accounting_status FROM payments WHERE id = ?')
      .bind(r.body.data.payment_id)
      .first<{ accounting_status: string }>();
    expect(pay?.accounting_status).toBe('DA_XAC_NHAN');
  });

  it('thiếu số tiền / nhà xe thì báo lỗi, không ghi gì', async () => {
    const a = await ctx.request('/api/orders/o-c/carrier-paid', { as: USERS.thao, body: { amount: 0, carrier: 'Xe A' } });
    expect(a.status).toBe(422);
    const b = await ctx.request('/api/orders/o-c/carrier-paid', { as: USERS.thao, body: { amount: 100000, carrier: '' } });
    expect(b.status).toBe(422);
    const n = await ctx.db.prepare('SELECT COUNT(*) AS n FROM shipping_vouchers').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });
});

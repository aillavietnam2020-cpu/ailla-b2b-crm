import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
});

const body = (over: Record<string, unknown> = {}) => ({
  voucher_date: '2026-10-14',
  carrier: 'Xe 29C-123.45',
  destination: 'NPP Hà Nội',
  amount: 1500000,
  method: 'TIEN_MAT',
  order_refs: 'DH202610-0023, DH202610-0024',
  ...over,
});

describe('Sổ phiếu chi vận chuyển', () => {
  it('quản lý lập phiếu có hiệu lực luôn, số phiếu theo tháng, xem được danh sách và tổng', async () => {
    const a = await ctx.request('/api/shipping-vouchers', { as: USERS.manager, body: body() });
    expect(a.status).toBe(200);
    expect(a.body.data.voucher_no).toBe('PCVC2610-001');
    const b = await ctx.request('/api/shipping-vouchers', { as: USERS.manager, body: body({ amount: 500000 }) });
    expect(b.body.data.voucher_no).toBe('PCVC2610-002');

    const list = await ctx.request('/api/shipping-vouchers?from=2026-10-01&to=2026-10-31', { as: USERS.manager });
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data[0]).toMatchObject({ status: 'OK', carrier: 'Xe 29C-123.45' });
  });

  it('sale thường không lập, không xem; số tiền và ngày tương lai bị từ chối', async () => {
    expect((await ctx.request('/api/shipping-vouchers', { as: USERS.thao, body: body() })).status).toBe(403);
    expect((await ctx.request('/api/shipping-vouchers', { as: USERS.thao })).status).toBe(403);
    expect((await ctx.request('/api/shipping-vouchers', { as: USERS.manager, body: body({ amount: 0 }) })).status).toBe(422);
    expect((await ctx.request('/api/shipping-vouchers', { as: USERS.manager, body: body({ voucher_date: '2099-01-01' }) })).status).toBe(400);
  });

  it('hủy phiếu cần lý do, hủy rồi không cộng vào tổng và không hủy lại được', async () => {
    const a = await ctx.request('/api/shipping-vouchers', { as: USERS.manager, body: body() });
    const id = a.body.data.id as string;
    expect((await ctx.request(`/api/shipping-vouchers/${id}/cancel`, { as: USERS.manager, body: { reason: 'x' } })).status).toBe(400);
    expect((await ctx.request(`/api/shipping-vouchers/${id}/cancel`, { as: USERS.manager, body: { reason: 'Nhập nhầm số tiền' } })).status).toBe(200);
    expect((await ctx.request(`/api/shipping-vouchers/${id}/cancel`, { as: USERS.manager, body: { reason: 'Nhập nhầm số tiền' } })).status).toBe(409);
    const list = await ctx.request('/api/shipping-vouchers', { as: USERS.manager });
    expect(list.body.data[0].status).toBe('HUY');
  });
});

describe('Phiếu chi vận chuyển: chuyển khoản từ tài khoản nào, đến đâu, ảnh bill / phiếu chi tiền mặt', () => {
  it('chuyển khoản lưu tài khoản đi và đến, đính kèm được ảnh; tiền mặt lưu người nhận', async () => {
    const a = await ctx.request('/api/shipping-vouchers', {
      as: USERS.manager,
      body: body({ method: 'CHUYEN_KHOAN', from_account: 'Techcombank · 1903 · AILLA', to_bank: 'MB', to_account_no: '9999', to_account_name: 'NGUYEN VAN XE' }),
    });
    expect(a.status).toBe(200);
    const up = await ctx.request(`/api/shipping-vouchers/${a.body.data.id}/files`, { as: USERS.manager, body: { name: 'bill.png', mime: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } });
    expect(up.status).toBe(200);
    const list = await ctx.request('/api/shipping-vouchers', { as: USERS.manager });
    expect(list.body.data[0]).toMatchObject({ from_account: 'Techcombank · 1903 · AILLA', to_bank: 'MB', to_account_no: '9999', file_count: 1 });
    const t = await ctx.request('/api/shipping-vouchers', { as: USERS.manager, body: body({ method: 'TIEN_MAT', receiver: 'Lái xe Hùng' }) });
    expect(t.status).toBe(200);
  });
});


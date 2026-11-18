import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Nợ đầu kỳ của khách gia công / khách mới (chị Hoa 18/11/2026): kế toán, CEO nhập theo sổ MISA, có nhật ký. */
let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

describe('PUT /api/customers/:id/opening-debt', () => {
  it('CEO nhập nợ đầu kỳ: công nợ chính thức cộng thêm đúng số đó, có nhật ký trước/sau', async () => {
    const before = await ctx.request('/api/customers/cus-thao-1', { as: USERS.ceo });
    const r = await ctx.request('/api/customers/cus-thao-1/opening-debt', {
      as: USERS.ceo,
      method: 'PUT',
      body: { amount: 155295438, note: 'Số dư đầu kỳ MISA tháng 10/2026' },
    });
    expect(r.status).toBe(200);
    const after = await ctx.request('/api/customers/cus-thao-1', { as: USERS.ceo });
    expect(after.body.data.debt.opening_debt).toBe(155295438);
    expect(after.body.data.debt.official_debt - before.body.data.debt.official_debt).toBe(155295438 - before.body.data.debt.opening_debt);
    const log = await ctx.db
      .prepare("SELECT reason, after_json FROM audit_logs WHERE action = 'CUSTOMER_OPENING_DEBT_SET' AND entity_id = 'cus-thao-1'")
      .first<{ reason: string; after_json: string }>();
    expect(log?.reason).toBe('Số dư đầu kỳ MISA tháng 10/2026');
    expect(JSON.parse(log!.after_json)).toEqual({ opening_debt: 155295438 });
  });

  it('bắt buộc ghi nguồn số; sale không có quyền kế toán thì bị chặn', async () => {
    const noNote = await ctx.request('/api/customers/cus-thao-1/opening-debt', { as: USERS.ceo, method: 'PUT', body: { amount: 1000 } });
    expect(noNote.status).toBe(400);
    const sale = await ctx.request('/api/customers/cus-thao-1/opening-debt', {
      as: USERS.thao,
      method: 'PUT',
      body: { amount: 1000, note: 'thử quyền sale' },
    });
    expect(sale.status).toBe(403);
  });
});

describe('Thu nhập khác của khách (VAT khách lấy hóa đơn...)', () => {
  it('cộng vào công nợ, có trong sổ chi tiết, không tính doanh thu; xóa phải có lý do và trừ lại', async () => {
    const before = (await ctx.request('/api/customers/cus-thao-1', { as: USERS.ceo })).body.data;
    const noDesc = await ctx.request('/api/customers/cus-thao-1/other-charges', {
      as: USERS.ceo,
      body: { charge_date: '2026-10-25', amount: 13600000, description: '' },
    });
    expect(noDesc.status).toBe(400);
    const add = await ctx.request('/api/customers/cus-thao-1/other-charges', {
      as: USERS.ceo,
      body: { charge_date: '2026-10-25', amount: 13600000, description: 'Tiền thuế VAT hóa đơn số 94 ngày 18/10/2026', doc_no: 'NVK1728' },
    });
    expect(add.status).toBe(200);
    const after = (await ctx.request('/api/customers/cus-thao-1', { as: USERS.ceo })).body.data;
    expect(after.debt.official_debt - before.debt.official_debt).toBe(13600000);
    expect(after.debt.other_charges).toBe(13600000);
    const list = (await ctx.request('/api/customers?page_size=200', { as: USERS.ceo })).body.data.find((c: { id: string }) => c.id === 'cus-thao-1');
    const listBefore = before.debt.posted_charges;
    expect(list.revenue_total).toBe(listBefore);
    expect(list.other_charges).toBe(13600000);
    const sale = await ctx.request('/api/customers/cus-thao-1/other-charges', {
      as: USERS.thao,
      body: { charge_date: '2026-10-25', amount: 1000, description: 'thử quyền sale' },
    });
    expect(sale.status).toBe(403);
    const rows = (await ctx.request('/api/customers/cus-thao-1/other-charges', { as: USERS.ceo })).body.data;
    expect(rows).toHaveLength(1);
    const del0 = await ctx.request(`/api/customers/cus-thao-1/other-charges/${rows[0].id}/delete`, { as: USERS.ceo, body: {} });
    expect(del0.status).toBe(400);
    const del = await ctx.request(`/api/customers/cus-thao-1/other-charges/${rows[0].id}/delete`, { as: USERS.ceo, body: { reason: 'Ghi nhầm khách' } });
    expect(del.status).toBe(200);
    const end = (await ctx.request('/api/customers/cus-thao-1', { as: USERS.ceo })).body.data;
    expect(end.debt.official_debt).toBe(before.debt.official_debt);
  });
});

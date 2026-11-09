import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';
import { runChecks } from '../../src/server/services/dataChecks';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

const body = {
  customer_id: 'cus-thao-1',
  order_date: '2026-08-16',
  items: [{ product_id: 'prod-full', qty: 10 }],
  shipping_fee: 200000,
};

describe('Đơn nháp tự lưu khi đang nhập', () => {
  it('tự lưu nhiều lần: vẫn là Nháp, không sinh bản sửa, số đơn giữ nguyên, nội dung cập nhật', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body });
    const id = created.body.data.id as string;
    const orderNo = created.body.data.order_no as string;

    for (const qty of [4, 6]) {
      const res = await ctx.request(`/api/orders/${id}`, {
        method: 'PUT',
        as: USERS.thao,
        body: { items: [{ product_id: 'prod-full', qty }], shipping_fee: 0, autosave: true },
      });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('DRAFT');
    }
    const detail = await ctx.request(`/api/orders/${id}`, { as: USERS.thao });
    expect(detail.body.data.order_no).toBe(orderNo);
    expect(detail.body.data.approval_status).toBe('DRAFT');
    expect(detail.body.data.items[0].qty).toBe(6);
    expect(detail.body.data.revisions).toHaveLength(0);
  });

  it('số đơn tiếp theo vẫn là số lớn nhất + 1 (đơn nháp không làm lệch)', async () => {
    const a = await ctx.request('/api/orders', { as: USERS.thao, body });
    const b = await ctx.request('/api/orders', { as: USERS.thao, body });
    const n = (s: string) => Number(s.slice(-4));
    expect(n(b.body.data.order_no)).toBe(n(a.body.data.order_no) + 1);
  });

  it('đơn nháp hiện trong danh sách đơn của người tạo', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body });
    const list = await ctx.request('/api/orders?approval_status=DRAFT', { as: USERS.thao });
    expect(list.status).toBe(200);
    const ids = (list.body.data as Array<{ id: string }>).map((o) => o.id);
    expect(ids).toContain(created.body.data.id);
  });

  it('đơn nháp không vào công nợ, Phê duyệt, Máy soát số liệu', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body });
    const orderNo = created.body.data.order_no as string;

    const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
    expect(approvals.body.data).toHaveLength(0);

    const row = await ctx.db
      .prepare(
        "SELECT COUNT(*) AS n FROM orders WHERE id = ? AND approval_status = 'APPROVED'",
      )
      .bind(created.body.data.id)
      .first<{ n: number }>();
    expect(row?.n).toBe(0);

    const soat = await runChecks(ctx.db as unknown as D1Database);
    for (const f of soat.findings) {
      expect(JSON.stringify(f)).not.toContain(orderNo);
    }
  });
});

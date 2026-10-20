import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

describe('Xóa khách hàng', () => {
  it('xóa được khách chưa phát sinh gì, khách biến khỏi danh sách', async () => {
    const created = await ctx.request('/api/customers', {
      as: USERS.ceo,
      body: { name: 'Khách test xóa', phone_text: '0912345678', province: 'Hà Nội' },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const r = await ctx.request('/api/customers/' + id, { as: USERS.ceo, method: 'DELETE' });
    expect(r.status).toBe(200);
    const list = await ctx.request('/api/customers?page_size=200', { as: USERS.ceo });
    expect(list.body.data.some((c: { id: string }) => c.id === id)).toBe(false);
    const tasks = await ctx.db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE customer_id = ? AND status = 'OPEN'").bind(id).first<{ n: number }>();
    expect(tasks?.n).toBe(0);
  });

  it('khách còn dư nợ cũ thì không xóa được; xóa hàng loạt báo lý do từng khách', async () => {
    const one = await ctx.request('/api/customers/cus-thao-2', { as: USERS.ceo, method: 'DELETE' });
    expect(one.status).toBe(409);
    const bulk = await ctx.request('/api/customers/bulk-delete', {
      as: USERS.ceo,
      body: { ids: ['cus-thao-1', 'cus-thao-2', 'khong-co'] },
    });
    expect(bulk.status).toBe(200);
    expect(bulk.body.data.done.map((x: { id: string }) => x.id)).toEqual(['cus-thao-1']);
    expect(bulk.body.data.blocked[0].id).toBe('cus-thao-2');
    expect(bulk.body.data.blocked[0].reasons.join(' ')).toContain('dư nợ cũ');
    expect(bulk.body.data.missing).toEqual(['khong-co']);
  });

  it('chỉ CEO xóa được khách', async () => {
    const r = await ctx.request('/api/customers/cus-thao-1', { as: USERS.thao, method: 'DELETE' });
    expect(r.status).toBe(403);
    const m = await ctx.request('/api/customers/cus-thao-1', { as: USERS.manager, method: 'DELETE' });
    expect(m.status).toBe(403);
  });

  it('khách chỉ còn đơn đã hủy thì xóa được, đơn đã hủy đi cùng; còn đơn hiệu lực thì không', async () => {
    const mk = async (id: string, status: string) => {
      await ctx.db
        .prepare(
          `INSERT INTO orders (id, order_no, customer_id, owner_id, order_date, approval_status, delivery_status, payment_status,
             subtotal, discount_amount, total_amount, created_at, updated_at)
           VALUES (?, ?, 'cus-thao-1', 'user-thao', '2026-10-14', ?, 'CHUA_XUAT', 'CHUA_THU', 100, 0, 100, '2026-10-14T01:00:00.000Z', '2026-10-14T01:00:00.000Z')`,
        )
        .bind(id, 'T-' + id, status)
        .run();
    };
    await mk('o-live', 'APPROVED');
    const blocked = await ctx.request('/api/customers/cus-thao-1', { as: USERS.ceo, method: 'DELETE' });
    expect(blocked.status).toBe(409);
    await ctx.db.prepare("UPDATE orders SET approval_status = 'CANCELLED' WHERE id = 'o-live'").run();
    const ok = await ctx.request('/api/customers/cus-thao-1', { as: USERS.ceo, method: 'DELETE' });
    expect(ok.status).toBe(200);
    const o = await ctx.db.prepare("SELECT deleted_at FROM orders WHERE id = 'o-live'").first<{ deleted_at: string | null }>();
    expect(o?.deleted_at).toBeTruthy();
  });
});

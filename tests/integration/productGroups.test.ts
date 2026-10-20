import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const NOW = '2026-10-19T01:00:00.000Z';

async function addProduct(id: string, sku: string) {
  await ctx.db
    .prepare("INSERT INTO products (id, sku, name, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)")
    .bind(id, sku, 'Sản phẩm ' + sku, NOW, NOW)
    .run();
}

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await addProduct('p1', 'SKU1');
  await addProduct('p2', 'SKU2');
});

describe('Nhóm sản phẩm: thêm, đổi tên, chuyển sản phẩm, xóa', () => {
  it('thêm nhóm chỉ cần tên, mã tự sinh', async () => {
    const r = await ctx.request('/api/product-groups', { as: USERS.ceo, body: { name: 'Nước giặt rẻ' } });
    expect(r.status).toBe(200);
    const list = await ctx.request('/api/product-groups', { as: USERS.ceo });
    expect(list.body.data.find((g: { name: string }) => g.name === 'Nước giặt rẻ').code).toBe('NUOC-GIAT-RE');
  });

  it('đổi tên, chuyển nhiều sản phẩm vào nhóm, rồi xóa nhóm thì sản phẩm về "chưa có nhóm"', async () => {
    const created = await ctx.request('/api/product-groups', { as: USERS.ceo, body: { name: 'Nhóm A' } });
    const gid = created.body.data.id as string;

    const ren = await ctx.request(`/api/product-groups/${gid}`, { as: USERS.ceo, method: 'PATCH', body: { name: 'Nhóm B' } });
    expect(ren.status).toBe(200);

    const mv = await ctx.request('/api/products/bulk-group', { as: USERS.ceo, body: { ids: ['p1', 'p2'], group_id: gid } });
    expect(mv.status).toBe(200);
    expect(mv.body.data.count).toBe(2);
    const g1 = await ctx.db.prepare('SELECT group_id FROM products WHERE id = ?').bind('p1').first<{ group_id: string | null }>();
    expect(g1?.group_id).toBe(gid);

    const del = await ctx.request(`/api/product-groups/${gid}`, { as: USERS.ceo, method: 'DELETE' });
    expect(del.status).toBe(200);
    expect(del.body.data.moved).toBe(2);
    const g2 = await ctx.db.prepare('SELECT group_id FROM products WHERE id = ?').bind('p1').first<{ group_id: string | null }>();
    expect(g2?.group_id).toBeNull();
    const gone = await ctx.db.prepare('SELECT id FROM product_groups WHERE id = ?').bind(gid).first();
    expect(gone).toBeNull();
  });

  it('trùng tên nhóm bị từ chối', async () => {
    await ctx.request('/api/product-groups', { as: USERS.ceo, body: { name: 'Nhóm A' } });
    const b = await ctx.request('/api/product-groups', { as: USERS.ceo, body: { name: 'Nhóm B' } });
    const dup = await ctx.request(`/api/product-groups/${b.body.data.id}`, { as: USERS.ceo, method: 'PATCH', body: { name: 'Nhóm A' } });
    expect(dup.status).toBe(400);
  });

  it('nhóm đang dùng trong giá điều chỉnh thì chưa xóa được', async () => {
    const created = await ctx.request('/api/product-groups', { as: USERS.ceo, body: { name: 'Nhóm C' } });
    const gid = created.body.data.id as string;
    await ctx.db
      .prepare(
        `INSERT INTO price_adjustments (id, scope, group_id, group_ids, kind, value, valid_from, status, created_by, created_at, updated_at)
         VALUES ('adj1', 'GROUP', ?, '[]', 'PERCENT', 1, '2026-10-01', 'ACTIVE', 'user-ceo', ?, ?)`,
      )
      .bind(gid, NOW, NOW)
      .run();
    const del = await ctx.request(`/api/product-groups/${gid}`, { as: USERS.ceo, method: 'DELETE' });
    expect(del.status).toBe(400);
  });
});

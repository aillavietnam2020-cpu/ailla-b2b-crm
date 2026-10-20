import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const NOW = '2026-10-14T01:00:00.000Z';
const NOTE = '❓ CẦN KẾ TOÁN XÁC NHẬN: chưa có trong bảng giá thành';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  for (const [code, name] of [
    ['MISA-A', 'Sản phẩm A'],
    ['MISA-B', 'Sản phẩm B'],
  ]) {
    await ctx.db
      .prepare('INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(code, name, 'Chai', 'TP', NOW)
      .run();
  }
  for (const [item, qty] of [
    ['MISA-A - Sản phẩm A', 1],
    ['MISA-B - Sản phẩm B', 2],
  ] as const) {
    await ctx.db
      .prepare(
        `INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, note, updated_at)
         VALUES ('TIKTOK', 'COMBO-1', '', '', ?, ?, ?, ?)`,
      )
      .bind(item, qty, NOTE, NOW)
      .run();
  }
});

const rows = async () =>
  (
    await ctx.db
      .prepare("SELECT item_label, qty, note FROM channel_map WHERE sku = 'COMBO-1' ORDER BY item_label")
      .all<{ item_label: string; qty: number; note: string }>()
  ).results ?? [];

const post = (path: string, as: string, body: unknown) =>
  ctx.request(`/api/hub/kho/online/map/${path}`, { as, body });

describe('Quy đổi combo bán sàn: kế toán sửa và xác nhận', () => {
  it('xác nhận combo thì bỏ cờ "cần kế toán xác nhận", số lượng giữ nguyên', async () => {
    const r = await post('confirm', USERS.ceo, { channel: 'TIKTOK', sku: 'COMBO-1', variant: '', from_day: '' });
    expect(r.status).toBe(200);
    expect(r.body.data.confirmed_rows).toBe(2);
    const after = await rows();
    expect(after.every((x) => x.note === '')).toBe(true);
    expect(after.map((x) => x.qty)).toEqual([1, 2]);
  });

  it('đổi mã MISA của một dòng: giữ số lượng, bỏ cờ cả combo; gộp khi trùng mã', async () => {
    const r = await post('swap', USERS.ceo, {
      channel: 'TIKTOK',
      sku: 'COMBO-1',
      variant: '',
      from_day: '',
      old_label: 'MISA-A - Sản phẩm A',
      new_label: 'MISA-B - Sản phẩm B',
    });
    expect(r.status).toBe(200);
    const after = await rows();
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ item_label: 'MISA-B - Sản phẩm B', qty: 3, note: '' });
  });

  it('người không có quyền kế toán/điều phối không sửa được bảng quy đổi', async () => {
    const r = await post('confirm', USERS.thao, { channel: 'TIKTOK', sku: 'COMBO-1', variant: '', from_day: '' });
    expect(r.status).toBe(403);
    expect((await rows()).every((x) => x.note === NOTE)).toBe(true);
  });
});

describe('Thêm mã MISA mới', () => {
  it('CEO / điều phối / kế toán thêm được; người khác bị chặn; mã trùng báo lỗi', async () => {
    const add = (as: string, code: string) =>
      ctx.request('/api/hub/kho/items', { as, body: { code, name: 'Tinh dầu giặt sấy 500ml Luxury', unit: 'Chai', cls: 'TP' } });
    // Quản lý điều phối được vào Trang quản trị (hub.access) và có quyền duyệt nên thêm được mã.
    const mgr = await ctx.db.prepare('SELECT id FROM users WHERE email = ?').bind(USERS.manager).first<{ id: string }>();
    await ctx.db
      .prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, 'hub.access', ?, ?)")
      .bind(mgr!.id, mgr!.id, NOW)
      .run();
    expect((await add(USERS.thao, 'AILLATDGSLUXURY500ML')).status).toBe(403);
    expect((await add(USERS.ceo, 'AILLATDGSLUXURY500ML')).status).toBe(200);
    expect((await add(USERS.manager, 'AILLATDGSLUXURY500ML')).status).toBe(409);
    expect((await add(USERS.manager, 'MA-KHAC')).status).toBe(200);
  });
});

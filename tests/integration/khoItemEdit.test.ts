import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Sửa danh mục mã (05/11): sửa tên / ĐVT / loại, đổi mã chuyển cả sổ kho, định mức, quy đổi sang mã mới. */
let ctx: TestContext;
const NOW = '2026-11-05T01:00:00.000Z';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  for (const [c, cls] of [['HOP1', 'NVL'], ['SP1', 'TP']]) {
    await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, 'Cái', ?, '', 0, 1, ?)").bind(c, `Mã ${c}`, cls, NOW).run();
  }
  await ctx.db.prepare("INSERT INTO kho_bom (product, item, qty, kind, note, sort) VALUES ('SP1', 'HOP1', 1, '', '', 1)").run();
});

describe('sửa danh mục mã', () => {
  it('sửa tên, ĐVT, loại giữ nguyên mã', async () => {
    const r = await ctx.request('/api/hub/kho/items/HOP1/edit', { as: USERS.ceo, body: { name: 'Hộp đóng 1 tẩy lồng', unit: 'Hộp', cls: 'NVL' } });
    expect(r.status).toBe(200);
    const it = await ctx.db.prepare('SELECT name, unit FROM kho_items WHERE code = ?').bind('HOP1').first<{ name: string; unit: string }>();
    expect(it).toEqual({ name: 'Hộp đóng 1 tẩy lồng', unit: 'Hộp' });
  });

  it('đổi mã: tồn kho và định mức chuyển sang mã mới, mã cũ hết; trùng mã thì chặn', async () => {
    expect((await ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'PN', date: '2026-11-02', lines: [{ item: 'HOP1', qty: 30 }] } })).status).toBe(200);
    expect((await ctx.request('/api/hub/kho/items/HOP1/edit', { as: USERS.ceo, body: { code: 'SP1' } })).status).toBe(409);
    const r = await ctx.request('/api/hub/kho/items/HOP1/edit', { as: USERS.ceo, body: { code: 'HOP1TL' } });
    expect(r.status).toBe(200);
    expect(r.body.data.code).toBe('HOP1TL');
    expect(await ctx.db.prepare("SELECT 1 FROM kho_items WHERE code = 'HOP1'").first()).toBeNull();
    const ton = await ctx.db.prepare("SELECT SUM(qty) AS q FROM kho_ledger WHERE item = 'HOP1TL'").first<{ q: number }>();
    expect(ton?.q).toBe(30);
    const bom = await ctx.db.prepare("SELECT item FROM kho_bom WHERE product = 'SP1'").first<{ item: string }>();
    expect(bom?.item).toBe('HOP1TL');
  });
});

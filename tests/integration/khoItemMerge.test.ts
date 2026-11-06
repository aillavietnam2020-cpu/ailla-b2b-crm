import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Gộp mã (06/11): sáp thơm có mã lọ (NVL, có phiếu nhập) và mã hộp (TP, có số bán sàn, quy đổi, định mức lọ + tem).
 * Gộp mã lọ vào mã hộp: tồn chuyển sang mã chung, không cộng / trừ hai lần; bán sàn cùng ngày cộng dồn; mã lọ, tem ngừng dùng. */
let ctx: TestContext;
const NOW = '2026-11-01T01:00:00.000Z';
const item = (code: string, cls: string, unit: string) =>
  ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, ?, ?, '', 0, 1, ?)").bind(code, `Mã ${code}`, unit, cls, NOW).run();
const ton = async (code: string) => (await ctx.db.prepare('SELECT COALESCE(SUM(qty), 0) AS q FROM kho_ledger WHERE item = ?').bind(code).first<{ q: number }>())?.q ?? 0;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await item('LO', 'NVL', 'Lọ');
  await item('HOP', 'TP', 'Hộp');
  await item('TEM', 'NVL', 'Cái');
  await ctx.db.prepare("INSERT INTO kho_bom (product, item, qty, kind, note, sort) VALUES ('HOP', 'LO', 1, '', '', 1), ('HOP', 'TEM', 1, '', '', 2)").run();
  await ctx.db.prepare("INSERT INTO kho_cfg (k, v) VALUES ('online_from', '2026-10-01')").run();
});

describe('gộp mã', () => {
  it('chuyển phiếu nhập, cộng bán sàn cùng ngày, bỏ định mức, mã lọ và tem ngừng dùng', async () => {
    expect((await ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'PN', date: '2026-11-02', lines: [{ item: 'LO', qty: 2016 }] } })).status).toBe(200);
    await ctx.db.prepare("INSERT INTO channel_out (channel, day, item, qty) VALUES ('TIKTOK', '2026-11-03', 'HOP', 5), ('TIKTOK', '2026-11-03', 'LO', 2), ('SHOPEE', '2026-11-03', 'LO', 1)").run();
    const before = (await ton('LO')) + (await ton('HOP'));
    const r = await ctx.request('/api/hub/kho/items/LO/merge', { as: USERS.ceo, body: { into: 'HOP', as_goods: true } });
    expect(r.status).toBe(200);
    expect(await ton('LO')).toBe(0);
    expect(await ton('HOP')).toBe(before);
    expect(await ton('HOP')).toBe(2016 - 5 - 2 - 1);
    const tt = await ctx.db.prepare("SELECT qty FROM channel_out WHERE channel = 'TIKTOK' AND day = '2026-11-03' AND item = 'HOP'").first<{ qty: number }>();
    expect(tt?.qty).toBe(7);
    expect(await ctx.db.prepare("SELECT 1 FROM kho_bom WHERE product = 'HOP'").first()).toBeNull();
    const it = await ctx.db.prepare("SELECT code, cls, active FROM kho_items ORDER BY code").all<{ code: string; cls: string; active: number }>();
    expect(it.results).toEqual([
      { code: 'HOP', cls: 'HH', active: 1 },
      { code: 'LO', cls: 'NVL', active: 0 },
      { code: 'TEM', cls: 'NVL', active: 0 },
    ]);
  });

  it('không gộp vào chính nó; người không có quyền bị chặn', async () => {
    expect((await ctx.request('/api/hub/kho/items/LO/merge', { as: USERS.ceo, body: { into: 'LO' } })).status).toBe(400);
    expect((await ctx.request('/api/hub/kho/items/LO/merge', { as: USERS.thao, body: { into: 'HOP' } })).status).toBe(403);
  });
});

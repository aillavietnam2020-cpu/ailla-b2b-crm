import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Thành phẩm chưa có định mức (06/11): ghi kho vẫn được, báo kế toán (việc), khai định mức xong thì trừ bù vật tư cho lô cũ đúng một lần. */
let ctx: TestContext;
const NOW = '2026-11-01T01:00:00.000Z';
const ton = async (code: string) => (await ctx.db.prepare('SELECT COALESCE(SUM(qty), 0) AS q FROM kho_ledger WHERE item = ?').bind(code).first<{ q: number }>())?.q ?? 0;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  for (const [c, cls] of [['SP', 'TP'], ['VO', 'NVL'], ['TEM', 'NVL']]) {
    await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, 'Cái', ?, '', 0, 1, ?)").bind(c, `Mã ${c}`, cls, NOW).run();
  }
});

describe('thành phẩm chưa có định mức', () => {
  it('ghi kho, sinh việc khai định mức; khai xong trừ bù vật tư lô cũ, đóng việc, không trừ lần hai', async () => {
    const ks = await ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'KS', date: '2026-11-02', lines: [{ item: 'SP', qty: 100, good_qty: 98 }] } });
    expect(ks.status).toBe(200);
    expect(await ton('SP')).toBe(98);
    expect(await ton('VO')).toBe(0);
    const t = await ctx.db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status = 'OPEN' AND title LIKE 'Khai định mức cho % (SP):%'").first<{ n: number }>();
    expect(t?.n).toBeGreaterThan(0);

    const bom = { lines: [{ item: 'VO', qty: 1 }, { item: 'TEM', qty: 2 }] };
    const r = await ctx.request('/api/hub/kho/bom/SP', { as: USERS.ceo, method: 'PUT', body: bom });
    expect(r.status).toBe(200);
    expect(r.body.data.backfilled).toBe(1);
    expect(await ton('VO')).toBe(-100); // trừ theo tổng đã đóng (kể cả hàng lỗi)
    expect(await ton('TEM')).toBe(-200);
    const t2 = await ctx.db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status = 'OPEN' AND title LIKE 'Khai định mức cho % (SP):%'").first<{ n: number }>();
    expect(t2?.n).toBe(0);

    // sửa định mức lần nữa: không trừ bù lại
    const r2 = await ctx.request('/api/hub/kho/bom/SP', { as: USERS.ceo, method: 'PUT', body: bom });
    expect(r2.body.data.backfilled).toBe(0);
    expect(await ton('VO')).toBe(-100);
  });
});

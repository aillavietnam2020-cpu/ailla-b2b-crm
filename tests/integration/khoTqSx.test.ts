import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Tổng quan sản xuất (05/11): gói số bán 14 ngày, bán 7 ngày từng mã, đơn mua chờ về, việc chờ. Chỉ đọc. */
let ctx: TestContext;
beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES ('A', 'Mã A', 'Can', 'TP', '', 0, 1, '2026-10-01T00:00:00Z')").run();
});

describe('GET /kho/tq-sx', () => {
  it('trả số bán theo ngày, theo kênh và bán 7 ngày từng mã', async () => {
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    await ctx.db.prepare("INSERT INTO kho_cfg (k, v) VALUES ('online_from', '2026-01-01')").run().catch(() => undefined);
    await ctx.db.prepare("INSERT INTO channel_out (channel, day, item, qty) VALUES ('TIKTOK', ?, 'A', 7)").bind(today).run();
    const r = await ctx.request('/api/hub/kho/tq-sx', { as: USERS.ceo });
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.today).toBe(today);
    expect(d.days).toEqual([{ day: today, channel: 'TIKTOK', qty: 7 }]);
    expect(d.ban7.find((x: { item: string }) => x.item === 'A')?.qty).toBe(7);
    expect(d.cho_xuat).toBe(0);
    expect(d.lech).toEqual({ cho: 0, xong: 0 });
  });
});

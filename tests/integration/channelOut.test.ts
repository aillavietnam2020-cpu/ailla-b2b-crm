import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const NOW = '2026-10-01T01:00:00.000Z';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  const items: Array<[string, string]> = [
    ['AILLATLGSX', 'Tẩy lồng máy giặt Ailla 300g'],
    ['AILLATDGS80HYDEN', 'Tinh dầu giặt sấy 80ml hyden'],
    ['CON30ML', 'Cồn 30ml'],
    ['phaoloccan', 'Phao lọc cặn'],
    ['AILLAXITKINH', 'Xịt kính Ailla 500ml'],
  ];
  for (const [code, name] of items) {
    await ctx.db
      .prepare("INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES (?, ?, 'Chai', 'TP', ?)")
      .bind(code, name, NOW)
      .run();
  }
  // Seed migration đã có sẵn bảng gán tên (Cồn thơm 30ml, Phao lọc cặn).
});

const stock = async (code: string) =>
  (await ctx.db.prepare('SELECT COALESCE(SUM(qty), 0) AS n FROM kho_ledger WHERE item = ?').bind(code).first<{ n: number }>())!.n;

const importDay = (channel: string, day: string, lines: Array<{ label: string; qty: number }>, orders = 5) =>
  ctx.request('/api/hub/kho/online/import', { as: USERS.ceo, body: { channel, days: [{ day, orders, lines }] } });

describe('Hàng bán qua sàn trừ kho', () => {
  it('chưa đặt ngày bắt đầu thì chưa trừ; đặt rồi thì trừ đúng mã, tên "MÃ - Tên" và tên đã gán', async () => {
    const res = await importDay('TIKTOK', '2026-10-06', [
      { label: 'AILLATLGSX - Tẩy lồng máy giặt Ailla 300g', qty: 7 },
      { label: 'AILLATDGS80HYDEN - Tinh dầu giặt sấy 80ml hyden', qty: 93 },
      { label: 'Cồn thơm 30ml', qty: 29 },
      { label: '(chưa có mã) Tinh dầu giặt sấy 80ml Ban Mê', qty: 2 },
      { label: 'BỎ QUA', qty: 5 },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.data.unmapped_labels).toEqual(['(chưa có mã) Tinh dầu giặt sấy 80ml Ban Mê']);
    expect(await stock('AILLATLGSX')).toBe(0); // chưa đặt ngày bắt đầu → chưa trừ

    const from = await ctx.request('/api/hub/kho/cfg/online-from', { as: USERS.ceo, method: 'PUT', body: { date: '2026-10-06' } });
    expect(from.status).toBe(200);
    expect(await stock('AILLATLGSX')).toBe(-7);
    expect(await stock('AILLATDGS80HYDEN')).toBe(-93);
    expect(await stock('CON30ML')).toBe(-29);
  });

  it('nạp lại cùng ngày thì thay chứ không cộng dồn; ngày trước ngày bắt đầu không trừ', async () => {
    await ctx.request('/api/hub/kho/cfg/online-from', { as: USERS.ceo, method: 'PUT', body: { date: '2026-10-06' } });
    await importDay('SHOPEE', '2026-10-06', [{ label: 'AILLATLGSX - Tẩy lồng', qty: 10 }]);
    await importDay('SHOPEE', '2026-10-06', [{ label: 'AILLATLGSX - Tẩy lồng', qty: 4 }]);
    await importDay('SHOPEE', '2026-10-05', [{ label: 'AILLATLGSX - Tẩy lồng', qty: 50 }]);
    expect(await stock('AILLATLGSX')).toBe(-4);
  });

  it('gán mã cho tên chưa có mã thì các dòng đang chờ được trừ kho', async () => {
    await ctx.request('/api/hub/kho/cfg/online-from', { as: USERS.ceo, method: 'PUT', body: { date: '2026-10-01' } });
    await importDay('TIKTOK', '2026-10-06', [{ label: '(chưa có mã) Nước lau kính Ailla 500ml', qty: 3 }]);
    await importDay('TIKTOK', '2026-10-07', [{ label: '(chưa có mã) Nước lau kính Ailla 500ml', qty: 2 }]);
    const overview = await ctx.request('/api/hub/kho/online', { as: USERS.ceo });
    expect(overview.body.data.unmapped[0]).toMatchObject({ label: '(chưa có mã) Nước lau kính Ailla 500ml', qty: 5 });

    const set = await ctx.request('/api/hub/kho/online/alias', {
      as: USERS.ceo,
      method: 'PUT',
      body: { label: '(chưa có mã) Nước lau kính Ailla 500ml', item: 'AILLAXITKINH' },
    });
    expect(set.status).toBe(200);
    expect(set.body.data.moved).toBe(2);
    expect(await stock('AILLAXITKINH')).toBe(-5);
    const after = await ctx.request('/api/hub/kho/online', { as: USERS.ceo });
    expect(after.body.data.unmapped).toHaveLength(0);
  });

  it('chỉ CEO hoặc kế toán kho mới nạp và gán mã', async () => {
    const res = await ctx.request('/api/hub/kho/online/import', {
      as: USERS.thao,
      body: { channel: 'TIKTOK', days: [{ day: '2026-10-06', lines: [{ label: 'AILLATLGSX', qty: 1 }] }] },
    });
    expect([401, 403]).toContain(res.status);
  });
});

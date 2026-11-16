import { beforeEach, expect, it } from 'vitest';
import { pack } from '@server/lib/pack';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Agent đọc combo (16/11): combo ghi rõ bộ phận Ads / CSKH (không chạy ads), kèm giá chương trình đang trong hạn. */
let ctx: TestContext;
beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
});

it('mkt/combos: có bộ phận và giá chương trình', async () => {
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const fbCat = {
    sp: [{ id: 'p1', ten: 'Tẩy lồng', loai: 'run', bt: [{ id: 'v1', ma: 'TLG', dt: '300g', pl: '', on: true }] }],
    combos: [
      { id: 'a', nhom: 'Tẩy lồng', gom: [{ ma: 'TLG', sl: 2 }], tang: [], gia: 150000, tu: '2026-11-01', tt: 'ok' },
      { id: 'b', nhom: 'Tẩy lồng', gom: [{ ma: 'TLG', sl: 1 }], tang: [], gia: 89000, tu: '2026-11-01', tt: 'ok', bp: 'CSKH' },
    ],
    gia: [
      { bp: 'CSKH', ma: 'TLG', gia: 80000, tu: '2026-11-01' },
      { bp: 'ADS', ma: 'TLG', gia: 90000, den: '2026-01-01' },
    ],
  };
  await ctx.db.prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('main', 1, ?, ?)").bind(await pack(JSON.stringify({ fbCat })), today).run();
  const made = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name: 'CSKH', scopes: ['mkt_digital'], can_propose: false } });
  const res = await ctx.app.fetch(
    new Request('http://localhost/api/agent/mkt/combos', { headers: { Authorization: `Bearer ${made.body.data.token}` } }),
    ctx.env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
  );
  const body = (await res.json()) as { data: Array<{ bo_phan: string; gia: number }>; meta: { gia_chuong_trinh: Array<Record<string, unknown>> } };
  expect(res.status).toBe(200);
  expect(body.data.map((x) => [x.bo_phan, x.gia])).toEqual([['Ads', 150000], ['CSKH (không chạy ads)', 89000]]);
  expect(body.meta.gia_chuong_trinh).toEqual([{ bo_phan: 'CSKH', ma: 'TLG', ten: 'Tẩy lồng 300g', gia: 80000, tu: '2026-11-01', den: '' }]);
});


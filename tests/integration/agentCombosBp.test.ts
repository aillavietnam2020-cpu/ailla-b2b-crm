import { beforeEach, expect, it } from 'vitest';
import { pack } from '@server/lib/pack';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Agent đọc combo (16/11): combo ghi rõ bộ phận Ads / CSKH (không chạy ads), kèm khuyến mại đã duyệt đang trong hạn. */
let ctx: TestContext;
beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
});

it('mkt/combos: có bộ phận và khuyến mại đã duyệt', async () => {
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const fbCat = {
    sp: [{ id: 'p1', ten: 'Tẩy lồng', loai: 'run', bt: [{ id: 'v1', ma: 'TLG', dt: '300g', pl: '', on: true }] }],
    combos: [
      { id: 'a', nhom: 'Tẩy lồng', gom: [{ ma: 'TLG', sl: 2 }], tang: [], gia: 150000, tu: '2026-11-01', tt: 'ok' },
    ],
  };
  // Khuyến mại: chỉ chương trình kế toán đã duyệt, đang trong hạn
  const kmCat = [
    { id: 'k1', bp: 'cskh', ten: 'Khách cũ', ap: 'Tẩy lồng 300g', gia: 80000, tu: '2026-11-01', tt: 'ok' },
    { id: 'k2', bp: 'ads', ten: 'Chờ duyệt', ap: 'x', gia: 1, tu: '2026-11-01', tt: 'cho' },
    { id: 'k3', bp: 'ads', ten: 'Hết hạn', ap: 'x', gia: 1, den: '2026-01-01', tt: 'ok' },
  ];
  // Combo CSKH nằm ở kho riêng cskhCat (16/11)
  const cskhCat = { sp: [], combos: [{ id: 'b', nhom: 'Tẩy lồng', gom: [{ ma: 'TLG', sl: 1 }], tang: [], gia: 89000, tu: '2026-11-01', tt: 'ok' }] };
  await ctx.db.prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('main', 1, ?, ?)").bind(await pack(JSON.stringify({ fbCat, cskhCat, kmCat })), today).run();
  const made = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name: 'CSKH', scopes: ['mkt_digital'], can_propose: false } });
  const res = await ctx.app.fetch(
    new Request('http://localhost/api/agent/mkt/combos', { headers: { Authorization: `Bearer ${made.body.data.token}` } }),
    ctx.env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
  );
  const body = (await res.json()) as { data: Array<{ bo_phan: string; gia: number }>; meta: { khuyen_mai: Array<Record<string, unknown>> } };
  expect(res.status).toBe(200);
  expect(body.data.map((x) => [x.bo_phan, x.gia])).toEqual([['Ads', 150000], ['CSKH (không chạy ads)', 89000]]);
  expect(body.meta.khuyen_mai).toEqual([{ bo_phan: 'CSKH', ten: 'Khách cũ', ap_dung: 'Tẩy lồng 300g', gia: 80000, tu: '2026-11-01', den: '' }]);
});


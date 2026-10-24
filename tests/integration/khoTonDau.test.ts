import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const NOW = '2026-10-14T01:00:00.000Z';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  // 30 mã để buộc chia nhóm khi ghi dòng của phiếu.
  for (let i = 1; i <= 30; i++) {
    await ctx.db
      .prepare('INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(`M${String(i).padStart(2, '0')}`, `Mã ${i}`, 'Cái', 'NVL', NOW)
      .run();
  }
});

const td = (lines: Array<{ item: string; qty: number }>, extra: Record<string, unknown> = {}) =>
  ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'TD', date: '2026-10-15', lines, ...extra } });

describe('nạp tồn đầu kỳ (phiếu TD)', () => {
  it('ghi một phiếu nhiều dòng, tồn cộng đúng', async () => {
    const lines = Array.from({ length: 30 }, (_, i) => ({ item: `M${String(i + 1).padStart(2, '0')}`, qty: i + 1 }));
    const r = await td(lines);
    expect(r.status).toBe(200);
    const n = await ctx.db.prepare('SELECT COUNT(*) AS n FROM kho_moves WHERE doc_id = ?').bind(r.body.data.id).first<{ n: number }>();
    expect(n!.n).toBe(30);
    const st = await ctx.request('/api/hub/kho/stock', { as: USERS.ceo });
    const m30 = (st.body.data as Array<{ code: string; qty: number }>).find((x) => x.code === 'M30');
    expect(m30!.qty).toBe(30);
  });

  it('đã có phiếu tồn đầu kỳ thì chặn nạp thêm trừ khi xác nhận; mã lặp bị từ chối', async () => {
    expect((await td([{ item: 'M01', qty: 5 }])).status).toBe(200);
    const again = await td([{ item: 'M02', qty: 5 }]);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('TD_EXISTS');
    expect((await td([{ item: 'M02', qty: 5 }], { allow_more: true })).status).toBe(200);
    const dup = await td([{ item: 'M03', qty: 1 }, { item: 'M03', qty: 2 }], { allow_more: true });
    expect(dup.status).toBe(400);
  });

  it('chỉ CEO nhập và hủy phiếu tồn đầu kỳ', async () => {
    const denied = await ctx.request('/api/hub/kho/docs', {
      as: USERS.manager,
      body: { type: 'TD', date: '2026-10-15', lines: [{ item: 'M01', qty: 1 }] },
    });
    expect(denied.status).toBe(403);
    const ok = await td([{ item: 'M01', qty: 1 }]);
    const cancelDenied = await ctx.request(`/api/hub/kho/docs/${ok.body.data.id}/cancel`, {
      as: USERS.manager,
      body: { reason: 'thử hủy' },
    });
    expect(cancelDenied.status).toBe(403);
    const cancelOk = await ctx.request(`/api/hub/kho/docs/${ok.body.data.id}/cancel`, {
      as: USERS.ceo,
      body: { reason: 'nạp nhầm file' },
    });
    expect(cancelOk.status).toBe(200);
  });
  it('Nhập – xuất – tồn: bấm vào một mã thấy từng phiếu (số phiếu, ngày, nhập/xuất) làm đổi tồn của mã đó', async () => {
    const r = await td([{ item: 'M05', qty: 7 }]);
    expect(r.status).toBe(200);
    const d = await ctx.request('/api/hub/kho/nxt/detail?item=M05&from=2026-10-01&to=2026-10-31', { as: USERS.ceo });
    expect(d.status).toBe(200);
    expect(d.body.data.opening).toBe(0);
    expect(d.body.data.rows).toHaveLength(1);
    expect(d.body.data.rows[0].doc_id).toBe(r.body.data.id);
    expect(d.body.data.rows[0].doc_no).toBe(r.body.data.no);
    expect(d.body.data.rows[0].qty).toBe(7);
    const later = await ctx.request('/api/hub/kho/nxt/detail?item=M05&from=2026-11-01&to=2026-11-30', { as: USERS.ceo });
    expect(later.body.data.opening).toBe(7);
    expect(later.body.data.rows).toHaveLength(0);
  });
  it('Xuất B2C: bấm một ngày thấy phiếu xuất bán lẻ của từng kênh (XL-<kênh>-<ngày>) với các dòng đã trừ kho', async () => {
    await ctx.db.prepare("INSERT INTO channel_out (channel, day, item, qty) VALUES ('TIKTOK', '2026-10-23', 'M07', 12)").run();
    await ctx.db.prepare("INSERT INTO channel_out (channel, day, item, qty) VALUES ('FACEBOOK', '2026-10-23', 'M07', 3)").run();
    const r = await ctx.request('/api/hub/kho/online/day?day=2026-10-23', { as: USERS.ceo });
    expect(r.status).toBe(200);
    const v = r.body.data.vouchers as Array<{ channel: string; no: string; lines: Array<{ code: string; qty: number }> }>;
    expect(v.map((x) => x.no)).toEqual(['XL-TT-20261023', 'XL-SP-20261023', 'XL-FB-20261023']);
    expect(v[0].lines[0]).toMatchObject({ code: 'M07', qty: 12 });
    expect(v[1].lines).toHaveLength(0);
    expect(v[2].lines[0].qty).toBe(3);
    expect((await ctx.request('/api/hub/kho/online/day?day=abc', { as: USERS.ceo })).status).toBe(400);
  });
});

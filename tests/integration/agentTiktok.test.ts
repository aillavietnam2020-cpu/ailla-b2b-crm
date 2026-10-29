/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Agent Kế toán trưởng nạp báo cáo TikTok hằng tuần (chị Hoa duyệt 25/10/2026). */
let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
});

async function agentCall(token: string, path: string, method = 'GET', body?: unknown) {
  const res = await ctx.app.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    ctx.env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
async function makeAgent(name: string, scopes: string[]) {
  const res = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name, scopes } });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; token: string };
}
const month = (ky: string, den: string | null, dt = 100) => ({ data: { ky, M: { den } }, summary: { ky, den, dt, don: 1 }, files: { orders: 'a.xlsx' } });

describe('Agent nạp báo cáo TikTok', () => {
  it('agent không có phạm vi Báo cáo sàn thì không đọc, không ghi được', async () => {
    const a = await makeAgent('Kế toán thử', ['orders', 'debts']);
    expect((await agentCall(a.token, '/api/agent/tiktok/months')).status).toBe(403);
    expect((await agentCall(a.token, '/api/agent/tiktok/month/2026-10', 'PUT', month('2026-10', '2026-10-21'))).status).toBe(403);
  });

  it('bản giữa tháng ghi được, bản mới hơn thay bản cũ, có nhật ký người làm là agent', async () => {
    const a = await makeAgent('Kế toán trưởng thử', ['baocao_san']);
    expect((await agentCall(a.token, '/api/agent/tiktok/inputs?ky=2026-10')).status).toBe(200);
    expect((await agentCall(a.token, '/api/agent/tiktok/month/2026-10', 'PUT', month('2026-10', '2026-10-14'))).status).toBe(200);
    expect((await agentCall(a.token, '/api/agent/tiktok/month/2026-10', 'PUT', month('2026-10', '2026-10-21', 200))).status).toBe(200);
    expect((await agentCall(a.token, '/api/agent/tiktok/month/2026-10', 'PUT', month('2026-10', '2026-10-07'))).status).toBe(409);
    const ms = await agentCall(a.token, '/api/agent/tiktok/months');
    expect(ms.body.data[0]).toMatchObject({ ky: '2026-10', den: '2026-10-21', dt: 200, locked: false });
    const log = await ctx.db.prepare("SELECT actor_type, source FROM audit_logs WHERE action = 'TTS_MONTH_SAVE'").all<any>();
    expect(log.results).toHaveLength(2);
    expect(log.results[0]).toMatchObject({ actor_type: 'AGENT', source: 'agent-tiktok' });
    const days = await agentCall(a.token, '/api/agent/tiktok/days', 'PUT', { src: 'ads', days: { '2026-10-01': { chi: 1000 }, x: {} } });
    expect(days.body.data).toMatchObject({ n: 1 });
  });

  it('agent nạp số Video (theo ngày + từng video) và KOC theo khoảng ngày, chỉ giữ số và tên video', async () => {
    const a = await makeAgent('Kế toán trưởng video', ['baocao_san']);
    expect((await agentCall(a.token, '/api/agent/tiktok/days', 'PUT', { src: 'video', days: { '2026-10-01': { gmv: 5, vv: 9 } } })).status).toBe(200);
    const v = { n: 3, nDang: 2, nCoDon: 2, gmv: 10, top: [{ id: '111', t: 'Video A', post: '2026-10-05', sp: 'Tinh dầu', gmv: 9, vv: 100, ghi: 'x' }], la: 'chữ' };
    expect((await agentCall(a.token, '/api/agent/tiktok/range', 'PUT', { kind: 'videos', from: '2026-10-01', to: '2026-10-25', data: v })).status).toBe(200);
    expect((await agentCall(a.token, '/api/agent/tiktok/range', 'PUT', { kind: 'xyz', from: '2026-10-01', to: '2026-10-25', data: {} })).status).toBe(400);
    const row = await ctx.db.prepare("SELECT data FROM tts_range WHERE kind = 'videos'").first<{ data: string }>();
    const d = JSON.parse(row!.data);
    expect(d).toMatchObject({ n: 3, nDang: 2, gmv: 10 });
    expect(d.la).toBeUndefined();
    expect(d.top[0]).toEqual({ id: '111', t: 'Video A', post: '2026-10-05', sp: 'Tinh dầu', gmv: 9, vv: 100 });
  });

  it('không thay bản chốt sổ đầy đủ, không ghi tháng đã khoá sổ, không có đường khoá sổ', async () => {
    const a = await makeAgent('Kế toán trưởng thử', ['baocao_san']);
    expect((await agentCall(a.token, '/api/agent/tiktok/month/2026-09', 'PUT', month('2026-09', null))).status).toBe(200);
    expect((await agentCall(a.token, '/api/agent/tiktok/month/2026-09', 'PUT', month('2026-09', '2026-09-20'))).status).toBe(409);
    expect((await agentCall(a.token, '/api/agent/tiktok/month/2026-09/lock', 'POST', { lock: true })).status).toBe(404);
    await ctx.db.prepare("UPDATE tts_month SET locked_at = '2026-10-08T00:00:00Z' WHERE ky = '2026-09'").run();
    expect((await agentCall(a.token, '/api/agent/tiktok/month/2026-09', 'PUT', month('2026-09', null))).status).toBe(409);
    expect((await agentCall(a.token, '/api/agent/tiktok/month/2026-11', 'PUT', month('2026-11', '2026-10-30'))).status).toBe(400);
  });

  it('công cụ của agent dùng đúng công thức của trang Tải file tháng', () => {
    expect(readFileSync('vps-skill/nap-bao-cao-tiktok/ttcalc.js', 'utf8')).toBe(readFileSync('hub/src/ttcalc.js', 'utf8'));
    for (const f of ['specalc.js'])
      expect(readFileSync(`vps-skill/nap-bao-cao-tiktok/${f}`, 'utf8')).toBe(readFileSync(`hub/src/${f}`, 'utf8'));
  });
});

describe('Agent nạp báo cáo Shopee', () => {
  const spe = (ky: string, shop: string, den: string | null, dt = 100) => ({
    data: { rows: [] },
    summary: { ky, shop, den, dt, days: { [`${ky}-01`]: [dt, -10, 30, 60, 1, 5], 'x': [1] } },
    files: { orders: 'a.xlsx' },
  });
  it('cần phạm vi Báo cáo sàn; ghi đúng bảng spe_month, chặn bản cũ hơn và bản giữa tháng đè bản đủ tháng', async () => {
    const no = await makeAgent('Không quyền', ['orders']);
    expect((await agentCall(no.token, '/api/agent/shopee/months')).status).toBe(403);
    const a = await makeAgent('Kế toán trưởng Shopee', ['baocao_san']);
    await ctx.db.prepare("INSERT INTO channel_order_lines (channel, order_id, line_no, day, shipped_at, shop, sku, variant, name, qty) VALUES ('SHOPEE', '2610ABC', 0, '2026-11-02', '2026-11-02T01:00:00Z', 'Ailla VN', '238314716093', '1 can 10kg', 'Arila', 1), ('SHOPEE', '2612ZZZ', 0, '2026-12-20', '2026-12-20T01:00:00Z', 'Ailla VN', 'x', '', 'x', 1), ('TIKTOK', 'T1', 0, '2026-10-05', '2026-10-05T01:00:00Z', 't', 'y', '', 'y', 1)").run();
    const inp = await agentCall(a.token, '/api/agent/shopee/inputs?ky=2026-10');
    expect(inp.status).toBe(200);
    // Giá vốn theo hàng xuất kho: đơn Poscake Shopee xuất trong 45 ngày từ đầu tháng (đơn đặt cuối tháng xuất đầu tháng sau).
    expect(inp.body.data.pos).toEqual([{ order_id: '2610ABC', sku: '238314716093', variant: '1 can 10kg' }]);
    expect((await agentCall(a.token, '/api/agent/shopee/month/2026-10/aillavn1', 'PUT', spe('2026-10', 'aillavn1', '2026-10-25'))).status).toBe(200);
    expect((await agentCall(a.token, '/api/agent/shopee/month/2026-10/aillavn1', 'PUT', spe('2026-10', 'aillavn1', '2026-10-20'))).status).toBe(409);
    expect((await agentCall(a.token, '/api/agent/shopee/month/2026-10/aillavn1', 'PUT', spe('2026-10', 'aillavn', '2026-10-25'))).status).toBe(400);
    expect((await agentCall(a.token, '/api/agent/shopee/month/2026-10/aillavn1', 'PUT', spe('2026-10', 'aillavn1', null, 300))).status).toBe(200);
    expect((await agentCall(a.token, '/api/agent/shopee/month/2026-10/aillavn1', 'PUT', spe('2026-10', 'aillavn1', '2026-10-30'))).status).toBe(409);
    const ms = await agentCall(a.token, '/api/agent/shopee/months');
    expect(ms.body.data).toEqual([expect.objectContaining({ ky: '2026-10', shop: 'aillavn1', den: null, dt: 300 })]);
    const web = await ctx.request('/api/hub/shopee/months', { as: USERS.ceo });
    expect(web.body.data[0].summary.days).toEqual({ '2026-10-01': [300, -10, 30, 60, 1, 5] });
    const log = await ctx.db.prepare("SELECT actor_type, source FROM audit_logs WHERE action = 'SPE_MONTH_SAVE'").all<any>();
    expect(log.results[0]).toMatchObject({ actor_type: 'AGENT', source: 'agent-shopee' });
  });
});

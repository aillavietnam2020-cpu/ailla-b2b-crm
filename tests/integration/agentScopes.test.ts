/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { pack } from '@server/lib/pack';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

async function agentCall(token: string, path: string) {
  const res = await ctx.app.fetch(
    new Request(`http://localhost${path}`, { headers: { Authorization: `Bearer ${token}` } }),
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

const status = async (token: string, path: string) => (await agentCall(token, path)).status;

describe('Phạm vi đọc của agent theo vai', () => {
  it('agent không có phạm vi nào thì không đọc được gì', async () => {
    const a = await makeAgent('Agent trống', []);
    for (const p of ['/api/agent/orders', '/api/agent/kho/stock', '/api/agent/events', '/api/agent/mkt/cards', '/api/agent/xuong']) {
      expect(await status(a.token, p)).toBe(403);
    }
    expect(await status(a.token, '/api/agent/me')).toBe(200);
  });

  it('kế toán: đơn và công nợ, không thấy kho', async () => {
    const a = await makeAgent('Kế toán thử', ['orders', 'debts']);
    expect(await status(a.token, '/api/agent/orders')).toBe(200);
    expect(await status(a.token, '/api/agent/events')).toBe(200);
    expect(await status(a.token, '/api/agent/kho/stock')).toBe(403);
    expect(await status(a.token, '/api/agent/kho/pha-che')).toBe(403);
    expect(await status(a.token, '/api/agent/mkt/cards')).toBe(403);
  });

  it('kế toán kho: kho và đơn chờ kho, không thấy công nợ khách', async () => {
    const a = await makeAgent('Kho thử', ['kho', 'orders_kho']);
    expect(await status(a.token, '/api/agent/kho/stock')).toBe(200);
    expect(await status(a.token, '/api/agent/kho/pha-che')).toBe(200);
    expect(await status(a.token, '/api/agent/orders')).toBe(200);
    expect(await status(a.token, '/api/agent/orders/abc')).toBe(403);
    expect(await status(a.token, '/api/agent/customers/abc')).toBe(403);
  });

  it('Marketing: Content thấy thẻ video, Digital thấy order Digital, không chéo team', async () => {
    const data = {
      users: [{ id: 'u1', name: 'Quỳnh' }],
      cards: [{ id: 'TT-0001', kenh: 'TikTok chính', sku: 'BT', step: 'kb', nguoi: 'u1', yTuong: 'Ý tưởng thử', day: 5 }],
      orders: [{ ma: 'ORD-0001', ngay: '02/10', kenh: 'Facebook Ads', sku: 'BT', muc: 'Test hook', sl: 3, han: 6, trangThai: 'Mới', nguoiOrder: 'u1' }],
    };
    await ctx.db
      .prepare(`INSERT INTO hub_state (id, version, data, updated_at, updated_by) VALUES ('main', 1, ?, '2026-10-20T00:00:00Z', NULL)`)
      .bind(await pack(JSON.stringify(data)))
      .run();
    const content = await makeAgent('Content thử', ['mkt_content', 'xuong']);
    const digital = await makeAgent('Digital thử', ['mkt_digital']);

    const cards = await agentCall(content.token, '/api/agent/mkt/cards');
    expect(cards.status).toBe(200);
    expect(cards.body.data[0]).toMatchObject({ id: 'TT-0001', buoc: 'Viết kịch bản', nguoi: 'Quỳnh' });
    expect(await status(content.token, '/api/agent/mkt/orders')).toBe(403);
    expect(await status(content.token, '/api/agent/xuong')).toBe(200);

    const orders = await agentCall(digital.token, '/api/agent/mkt/orders');
    expect(orders.status).toBe(200);
    expect(orders.body.data[0]).toMatchObject({ ma: 'ORD-0001', nguoi_order: 'Quỳnh' });
    expect(await status(digital.token, '/api/agent/mkt/cards')).toBe(403);
    expect(await status(digital.token, '/api/agent/xuong')).toBe(403);
    expect(await status(digital.token, '/api/agent/orders')).toBe(403);
  });

  it('CEO đổi phạm vi của agent và có hiệu lực ngay', async () => {
    const a = await makeAgent('Đổi quyền', ['kho']);
    expect(await status(a.token, '/api/agent/kho/stock')).toBe(200);
    const set = await ctx.request(`/api/admin/agents/${a.id}/scopes`, { as: USERS.ceo, method: 'PUT', body: { scopes: ['orders'] } });
    expect(set.status).toBe(200);
    expect(await status(a.token, '/api/agent/kho/stock')).toBe(403);
    expect(await status(a.token, '/api/agent/orders')).toBe(200);
    const bad = await ctx.request(`/api/admin/agents/${a.id}/scopes`, { as: USERS.ceo, method: 'PUT', body: { scopes: ['hack'] } });
    expect(bad.status).toBe(422);
    const denied = await ctx.request(`/api/admin/agents/${a.id}/scopes`, { as: USERS.manager, method: 'PUT', body: { scopes: ['orders'] } });
    expect(denied.status).toBe(403);
  });
});

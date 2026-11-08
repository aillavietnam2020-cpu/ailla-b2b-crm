/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Agent CSKH B2B (08/11): đọc đơn, khách sỉ, công nợ, bảng giá, thưởng; chỉ lập đơn mới khi Thảo hoặc CEO ra lệnh. */
let ctx: TestContext;
const CHAT_AGENT = 'cskh-b2b-ailla';
const RELAY = 'relay-test-key-123';

beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.AGENT_RELAY_KEY = RELAY;
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

async function call(token: string, method: string, path: string, body?: unknown, dlg?: string) {
  const res = await ctx.app.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(dlg ? { 'X-Delegation': dlg } : {}) },
      body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body),
    }),
    ctx.env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
async function pull() {
  const r = await ctx.app.fetch(new Request('http://x/api/agent-relay/pull', { method: 'POST', headers: { 'X-Relay-Key': RELAY, 'Content-Type': 'application/json' }, body: '{}' }), ctx.env);
  return ((await r.json()) as any).data as any[];
}
const uid = async (email: string) => (await ctx.db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>())!.id;

async function setup() {
  const made = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name: 'CSKH B2B', scopes: ['cskh_b2b'], can_propose: false } });
  const agent = made.body.data as { id: string; token: string };
  const mgr = await uid(USERS.manager);
  const ceo = await uid(USERS.ceo);
  await ctx.db.prepare('INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(mgr, 'order.approve.normal', ceo, '2026-11-08T00:00:00Z').run();
  return { agent, mgr, ceo };
}

describe('Agent CSKH B2B', () => {
  it('đọc được đơn, khách, công nợ, cấp giá, thưởng; không đọc kho hay Marketing', async () => {
    const { agent } = await setup();
    for (const p of ['/api/agent/orders', '/api/agent/customers', '/api/agent/debts', '/api/agent/tiers', '/api/agent/bonus-policy', '/api/agent/products?q=test']) {
      expect((await call(agent.token, 'GET', p)).status, p).toBe(200);
    }
    for (const p of ['/api/agent/kho/stock', '/api/agent/mkt/cards', '/api/agent/xuong']) {
      expect((await call(agent.token, 'GET', p)).status, p).toBe(403);
    }
    // Agent không vào được trang web thường (lương, tài chính...) khi không có giấy ủy quyền
    expect((await call(agent.token, 'GET', '/api/hub/hr/payroll')).status).toBeGreaterThanOrEqual(400);
  });

  it('khách là nhân viên mua hàng thì agent không thấy', async () => {
    const { agent } = await setup();
    const t = await ctx.db.prepare("SELECT id FROM price_tiers WHERE code = 'NHAN_VIEN'").first<{ id: string }>();
    if (!t) return; // bộ dữ liệu thử không có cấp nhân viên
    await ctx.db.prepare("UPDATE customers SET tier_id = ? WHERE id = 'cus-thao-1'").bind(t.id).run();
    const list = await call(agent.token, 'GET', '/api/agent/customers?q=');
    expect(list.body.data.some((x: any) => x.id === 'cus-thao-1')).toBe(false);
    expect((await call(agent.token, 'GET', '/api/agent/customers/cus-thao-1')).status).toBe(404);
  });

  it('CEO được chọn làm người ra lệnh; Telegram đã nối ở agent khác được giữ', async () => {
    const { agent, mgr, ceo } = await setup();
    const other = (await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name: 'Kế toán trưởng', scopes: ['orders'] } })).body.data.id;
    await ctx.db.prepare("INSERT INTO agent_delegators (agent_id, chat_agent, user_id, granted_by, created_at, telegram_id) VALUES (?, 'ke-toan-truong-ailla', ?, ?, '2026-11-01', 'tg-123')").bind(other, mgr, ceo).run();
    const r = await ctx.request(`/api/admin/agents/${agent.id}/delegators`, { method: 'PUT', as: USERS.ceo, body: { user_ids: [mgr, ceo] } });
    expect(r.status).toBe(200);
    expect(r.body.data.chat_agent).toBe(CHAT_AGENT);
    const tg = await ctx.db.prepare('SELECT telegram_id FROM agent_delegators WHERE agent_id = ? AND user_id = ?').bind(agent.id, mgr).first<{ telegram_id: string }>();
    expect(tg?.telegram_id).toBe('tg-123');
  });

  it('lập đơn mới khi được lệnh, ghi người yêu cầu; không sửa, hủy đơn hay ghi tiền', async () => {
    const { agent, mgr } = await setup();
    await ctx.request(`/api/admin/agents/${agent.id}/delegators`, { method: 'PUT', as: USERS.ceo, body: { user_ids: [mgr] } });
    const order = { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 5 }], note: 'giao thứ 7' };
    // Không có lệnh thì không ghi được
    expect((await call(agent.token, 'POST', '/api/orders', order)).status).toBe(403);

    await ctx.request('/api/agent-chat', { as: USERS.manager, body: { agent: CHAT_AGENT, body: 'lên đơn giúp' } });
    const dlg = (await pull())[0].delegation as string;
    expect(dlg).toMatch(/^dlg_/);
    expect((await call(agent.token, 'POST', '/api/orders/preview', order, dlg)).status).toBe(200);
    const made = await call(agent.token, 'POST', '/api/orders', order, dlg);
    expect(made.status).toBe(201);
    const o = await ctx.db.prepare('SELECT note, approval_status, created_by FROM orders WHERE id = ?').bind(made.body.data.id).first<{ note: string; approval_status: string; created_by: string }>();
    expect(o?.note).toContain('lập theo yêu cầu của');
    expect(o?.note).toContain('giao thứ 7');
    expect(o?.approval_status).toBe('DRAFT');
    expect(o?.created_by).toBe(mgr);
    const log = await ctx.db.prepare("SELECT after_json FROM audit_logs WHERE action = 'AGENT_ACT' AND entity_id = '/api/orders'").first<{ after_json: string }>();
    expect(log?.after_json).toContain('on_behalf_of');

    const id = made.body.data.id;
    expect((await call(agent.token, 'PUT', `/api/orders/${id}`, { items: [{ product_id: 'prod-full', qty: 1 }] }, dlg)).status).toBe(403);
    expect((await call(agent.token, 'POST', `/api/orders/${id}/cancel`, { reason: 'x' }, dlg)).status).toBe(403);
    expect((await call(agent.token, 'POST', '/api/payments', { customer_id: 'cus-thao-1', amount: 1000 }, dlg)).status).toBe(403);
    expect((await call(agent.token, 'POST', `/api/orders/${id}/submit`, {}, dlg)).status).toBeLessThan(403);
  });
});

describe('Quyền ghi chia nhỏ + mẫu theo vị trí (08/11)', () => {
  it('tạo agent kèm mẫu quyền; chỉ ghi được đúng mục đã tick; đổi quyền có nhật ký trước/sau', async () => {
    const made = await ctx.request('/api/admin/agents', {
      as: USERS.ceo,
      body: { name: 'Sale B2B', scopes: ['orders', 'debts'], writes: ['agent.w.order', 'agent.propose'] },
    });
    const agent = made.body.data as { id: string; token: string };
    const mgr = await uid(USERS.manager);
    const ceo = await uid(USERS.ceo);
    await ctx.db.prepare('INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(mgr, 'order.approve.normal', ceo, '2026-11-08T00:00:00Z').run();
    const list = await ctx.request('/api/admin/agents', { as: USERS.ceo });
    const row = list.body.data.find((a: any) => a.id === agent.id);
    expect(row.writes.sort()).toEqual(['agent.propose', 'agent.w.order']);

    await ctx.request(`/api/admin/agents/${agent.id}/delegators`, { method: 'PUT', as: USERS.ceo, body: { user_ids: [mgr] } });
    await ctx.request('/api/agent-chat', { as: USERS.manager, body: { agent: 'sale-b2b-ailla', body: 'lên đơn' } });
    const dlg = (await pull())[0].delegation as string;
    const order = { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 5 }] };
    const made2 = await call(agent.token, 'POST', '/api/orders', order, dlg);
    expect(made2.status).toBe(201);
    // Chưa tick "Gửi đơn đi duyệt" thì không gửi được
    expect((await call(agent.token, 'POST', `/api/orders/${made2.body.data.id}/submit`, {}, dlg)).status).toBe(403);
    expect((await call(agent.token, 'POST', '/api/payments', { customer_id: 'cus-thao-1', amount: 1000 }, dlg)).status).toBe(403);

    expect((await ctx.request(`/api/admin/agents/${agent.id}/writes`, { method: 'PUT', as: USERS.ceo, body: { writes: ['agent.xoa'] } })).status).toBe(422);
    expect((await ctx.request(`/api/admin/agents/${agent.id}/writes`, { method: 'PUT', as: USERS.manager, body: { writes: [] } })).status).toBe(403);
    expect((await ctx.request(`/api/admin/agents/${agent.id}/writes`, { method: 'PUT', as: USERS.ceo, body: { writes: ['agent.w.order', 'agent.w.submit'] } })).status).toBe(200);
    expect((await call(agent.token, 'POST', `/api/orders/${made2.body.data.id}/submit`, {}, dlg)).status).toBeLessThan(403);
    const log = await ctx.db.prepare("SELECT before_json, after_json FROM audit_logs WHERE action = 'AGENT_WRITES_SET'").first<{ before_json: string; after_json: string }>();
    expect(log?.before_json).toContain('agent.w.order');
    expect(log?.after_json).toContain('agent.w.submit');
  });
});

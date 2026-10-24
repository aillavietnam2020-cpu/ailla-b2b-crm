/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const CHAT_AGENT = 'ke-toan-truong-ailla';
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
  const made = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name: 'Kế toán trưởng', scopes: ['orders', 'debts', 'kho'] } });
  const agent = made.body.data as { id: string; token: string };
  const ceo = await uid(USERS.ceo);
  const mgr = await uid(USERS.manager);
  await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(agent.id, 'agent.act', ceo, '2026-10-21T00:00:00Z').run();
  await ctx.db.prepare('INSERT INTO agent_delegators (agent_id, chat_agent, user_id, granted_by, created_at) VALUES (?, ?, ?, ?, ?)').bind(agent.id, CHAT_AGENT, mgr, ceo, '2026-10-21T00:00:00Z').run();
  for (const perm of ['hub.access', 'order.approve.normal']) {
    await ctx.db.prepare('INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(mgr, perm, ceo, '2026-10-21T00:00:00Z').run();
  }
  for (const e of [USERS.manager, USERS.thao]) {
    await ctx.db.prepare('INSERT INTO agent_chat_access (user_id, agent, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(await uid(e), CHAT_AGENT, ceo, '2026-10-21T00:00:00Z').run();
  }
  return { agent, mgr };
}

describe('Agent ghi dữ liệu thay người, chỉ khi người được chỉ định ra lệnh', () => {
  it('chỉ tin của chị Thảo (quản lý) sinh giấy ủy quyền; tin của người khác và của CEO thì không', async () => {
    await setup();
    await ctx.request('/api/agent-chat', { as: USERS.thao, body: { agent: CHAT_AGENT, body: 'ghi phiếu giúp' } });
    await ctx.request('/api/agent-chat', { as: USERS.ceo, body: { agent: CHAT_AGENT, body: 'ghi phiếu giúp' } });
    const other = await pull();
    expect(other.every((m) => !m.delegation)).toBe(true);
    await ctx.request('/api/agent-chat', { as: USERS.manager, body: { agent: CHAT_AGENT, body: 'tạo nhà cung cấp NCC test' } });
    const mine = await pull();
    expect(mine).toHaveLength(1);
    expect(mine[0].delegation).toMatch(/^dlg_/);
  });

  it('không có giấy, giấy giả, giấy hết hạn hoặc hết lượt thì mọi lệnh ghi bị từ chối', async () => {
    const { agent } = await setup();
    const sup = { name: 'NCC thử' };
    expect((await call(agent.token, 'POST', '/api/hub/kho/mh/suppliers', sup)).status).toBe(403);
    expect((await call(agent.token, 'POST', '/api/hub/kho/mh/suppliers', sup, 'dlg_giagiagia')).status).toBe(403);
    await ctx.request('/api/agent-chat', { as: USERS.manager, body: { agent: CHAT_AGENT, body: 'tạo nhà cung cấp' } });
    const dlg = (await pull())[0].delegation as string;
    const ok = await call(agent.token, 'POST', '/api/hub/kho/mh/suppliers', sup, dlg);
    expect(ok.status).toBe(200);
    const log = await ctx.db.prepare("SELECT actor_type, result FROM audit_logs WHERE action = 'AGENT_ACT'").first<{ actor_type: string; result: string }>();
    expect(log).toEqual({ actor_type: 'AGENT', result: 'OK' });
    // hết lượt
    await ctx.db.prepare('UPDATE agent_delegations SET max_uses = uses').run();
    expect((await call(agent.token, 'POST', '/api/hub/kho/mh/suppliers', { name: 'NCC hai' }, dlg)).status).toBe(403);
    // hết hạn
    await ctx.db.prepare("UPDATE agent_delegations SET max_uses = 40, expires_at = '2020-01-01T00:00:00Z'").run();
    expect((await call(agent.token, 'POST', '/api/hub/kho/mh/suppliers', { name: 'NCC ba' }, dlg)).status).toBe(403);
  });

  it('chỉ làm trong danh sách cho phép; quản trị người dùng, nhân sự, xóa cứng đều bị chặn', async () => {
    const { agent } = await setup();
    await ctx.request('/api/agent-chat', { as: USERS.manager, body: { agent: CHAT_AGENT, body: 'làm việc' } });
    const dlg = (await pull())[0].delegation as string;
    for (const [m, p] of [
      ['POST', '/api/admin/users'],
      ['GET', '/api/admin/agents'],
      ['POST', '/api/hub/hr/employees'],
      ['DELETE', '/api/hub/kho/items/NVL1'],
      ['POST', '/api/payments/abc/delete'],
      ['POST', '/api/agent-chat'],
    ] as const) {
      expect((await call(agent.token, m, p, {}, dlg)).status, `${m} ${p}`).toBe(403);
    }
    expect((await call(agent.token, 'GET', '/api/hub/kho/mh/orders', undefined, dlg)).status).toBe(200);
  });

  it('lập và hủy được phiếu chi vận chuyển (lái xe) theo lệnh chị Thảo', async () => {
    const { agent } = await setup();
    await ctx.request('/api/agent-chat', { as: USERS.manager, body: { agent: CHAT_AGENT, body: 'chi cước' } });
    const dlg = (await pull())[0].delegation as string;
    const r = await call(agent.token, 'POST', '/api/shipping-vouchers', { voucher_date: '2026-10-01', carrier: 'Vũ Thanh Tâm', amount: 750000, method: 'CHUYEN_KHOAN' }, dlg);
    expect(r.status).toBe(200);
    const id = (r.body as { data: { id: string } }).data.id;
    expect((await call(agent.token, 'GET', '/api/shipping-vouchers', undefined, dlg)).status).toBe(200);
    expect((await call(agent.token, 'POST', `/api/shipping-vouchers/${id}/cancel`, { reason: 'nhập nhầm' }, dlg)).status).toBe(200);
  });

  it('agent chưa được cấp quyền ghi thì giấy cũng vô dụng; quyền chỉ bằng quyền của người ra lệnh', async () => {
    const { agent, mgr } = await setup();
    await ctx.db.prepare("DELETE FROM user_permissions WHERE user_id = ? AND permission = 'agent.act'").bind(agent.id).run();
    await ctx.request('/api/agent-chat', { as: USERS.manager, body: { agent: CHAT_AGENT, body: 'làm việc' } });
    const dlg = (await pull())[0].delegation as string;
    expect((await call(agent.token, 'POST', '/api/hub/kho/mh/suppliers', { name: 'NCC X' }, dlg)).status).toBe(403);
    // gỡ người ra lệnh khỏi danh sách chỉ định thì giấy mất hiệu lực ngay
    await ctx.db.prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, 'agent.act', ?, '2026-10-21T00:00:00Z')").bind(agent.id, mgr).run();
    expect((await call(agent.token, 'POST', '/api/hub/kho/mh/suppliers', { name: 'NCC Y' }, dlg)).status).toBe(200);
    await ctx.db.prepare('DELETE FROM agent_delegators').run();
    expect((await call(agent.token, 'POST', '/api/hub/kho/mh/suppliers', { name: 'NCC Z' }, dlg)).status).toBe(403);
  });
});

describe('Trợ lý toàn diện: đọc mọi trang như chủ, tuyệt đối không ghi', () => {
  async function readAll(token: string, method: string, path: string) {
    const res = await ctx.app.fetch(
      new Request(`http://localhost${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'X-Read-All': '1', 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' }),
      ctx.env,
      { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
    );
    return res.status;
  }

  it('chỉ đọc được khi agent có quyền readall; không ghi, không đọc khóa/đăng nhập', async () => {
    const made = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name: 'Trợ lý chị', scopes: [] } });
    const agent = made.body.data as { id: string; token: string };
    expect(await readAll(agent.token, 'GET', '/api/customers')).toBe(403); // chưa có quyền
    await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(agent.id, 'agent.readall', await uid(USERS.ceo), '2026-10-23T00:00:00Z').run();
    expect(await readAll(agent.token, 'GET', '/api/customers')).toBe(200);
    expect(await readAll(agent.token, 'GET', '/api/admin/users')).toBe(200);
    expect(await readAll(agent.token, 'POST', '/api/customers')).toBe(403);
    expect(await readAll(agent.token, 'PUT', '/api/admin/users/x')).toBe(403);
    expect(await readAll(agent.token, 'GET', '/api/admin/agents')).toBe(403);
    expect(await readAll(agent.token, 'GET', '/api/auth/me')).toBe(403);
    expect(await readAll(agent.token, 'GET', '/api/agent-chat/agents')).toBe(403);
  });
});

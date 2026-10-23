/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const CHAT_AGENT = 'sale-b2b-ailla';
const RELAY = 'relay-test-key-123';
const TG_MANAGER = '555000111';

beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.AGENT_RELAY_KEY = RELAY;
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

async function agentCall(token: string, method: string, path: string, body?: unknown, dlg?: string) {
  const res = await ctx.app.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(dlg ? { 'X-Delegation': dlg } : {}) },
      body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body),
    }),
    ctx.env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
  );
  return res.status;
}

async function relayTg(items: unknown[]) {
  const r = await ctx.app.fetch(
    new Request('http://x/api/agent-relay/delegate-tg', { method: 'POST', headers: { 'X-Relay-Key': RELAY, 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) }),
    ctx.env,
  );
  return ((await r.json()) as any).data.made as number;
}

const uid = async (email: string) => (await ctx.db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>())!.id;

describe('Ra lệnh ghi qua Telegram: định danh do cầu nối xác nhận', () => {
  it('chỉ tin Telegram mới của người được chỉ định sinh giấy; người lạ, tin cũ thì không', async () => {
    const made = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name: 'Sale B2B', scopes: ['orders'] } });
    const agent = made.body.data as { id: string; token: string };
    const ceo = await uid(USERS.ceo);
    const mgr = await uid(USERS.manager);
    await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(agent.id, 'agent.act', ceo, '2026-10-22T00:00:00Z').run();
    for (const perm of ['hub.access', 'order.approve.normal']) {
      await ctx.db.prepare('INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(mgr, perm, ceo, '2026-10-22T00:00:00Z').run();
    }
    await ctx.db.prepare('INSERT INTO agent_delegators (agent_id, chat_agent, user_id, telegram_id, granted_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(agent.id, CHAT_AGENT, mgr, TG_MANAGER, ceo, '2026-10-22T00:00:00Z').run();
    const sup = { name: 'NCC Telegram' };

    // chưa có tin nào: "tg" bị từ chối
    expect(await agentCall(agent.token, 'POST', '/api/hub/kho/mh/suppliers', sup, 'tg')).toBe(403);
    // người lạ gửi tin Telegram
    expect(await relayTg([{ chat_agent: CHAT_AGENT, sender_id: '999', ext_id: 'a:1', ts: Date.now() }])).toBe(0);
    expect(await agentCall(agent.token, 'POST', '/api/hub/kho/mh/suppliers', sup, 'tg')).toBe(403);
    // tin cũ (đồng bộ lại lịch sử) của người được chỉ định
    expect(await relayTg([{ chat_agent: CHAT_AGENT, sender_id: TG_MANAGER, ext_id: 'a:2', ts: Date.now() - 3_600_000 }])).toBe(0);
    expect(await agentCall(agent.token, 'POST', '/api/hub/kho/mh/suppliers', sup, 'tg')).toBe(403);
    // tin mới của người được chỉ định
    expect(await relayTg([{ chat_agent: CHAT_AGENT, sender_id: TG_MANAGER, ext_id: 'a:3', ts: Date.now() }])).toBe(1);
    expect(await agentCall(agent.token, 'POST', '/api/hub/kho/mh/suppliers', sup, 'tg')).toBe(200);
    // sai mã agent trong tin thì không sinh giấy cho agent khác
    expect(await relayTg([{ chat_agent: 'ke-toan-truong-ailla', sender_id: TG_MANAGER, ext_id: 'a:4', ts: Date.now() }])).toBe(0);
    // quá hạn thì hết hiệu lực
    await ctx.db.prepare("UPDATE agent_delegations SET expires_at = '2020-01-01T00:00:00Z'").run();
    expect(await agentCall(agent.token, 'POST', '/api/hub/kho/mh/suppliers', { name: 'NCC hai' }, 'tg')).toBe(403);
  });
});

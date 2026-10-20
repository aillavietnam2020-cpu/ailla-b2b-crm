/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.AGENT_RELAY_KEY = 'relay-test-key-123';
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

const relay = async (path: string, body: unknown, key = 'relay-test-key-123') => {
  const r = await ctx.app.fetch(
    new Request('http://x/api/agent-relay' + path, {
      method: 'POST',
      headers: { 'X-Relay-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx.env,
  );
  return { status: r.status, body: (await r.json()) as { data: any } };
};

describe('Nhắn agent trên web', () => {
  it('chỉ CEO nhắn được; nhân viên bị chặn', async () => {
    const res = await ctx.request('/api/agent-chat', { as: USERS.thao, body: { agent: 'main', body: 'chào' } });
    expect(res.status).toBe(403);
  });

  it('agent lạ hoặc tin rỗng bị từ chối', async () => {
    expect((await ctx.request('/api/agent-chat', { as: USERS.ceo, body: { agent: 'la', body: 'x' } })).status).toBe(400);
    expect((await ctx.request('/api/agent-chat', { as: USERS.ceo, body: { agent: 'main', body: '  ' } })).status).toBe(400);
  });

  it('cầu nối sai khoá bị từ chối', async () => {
    expect((await relay('/pull', {}, 'sai')).status).toBe(401);
  });

  it('vòng đi: chị gửi → cầu nối lấy → trả lời → chị thấy', async () => {
    const sent = await ctx.request('/api/agent-chat', {
      as: USERS.ceo,
      body: { agent: 'main', body: 'Tồn kho hôm nay?', tg: true },
    });
    expect(sent.status).toBe(200);

    const pulled = await relay('/pull', {});
    expect(pulled.body.data).toHaveLength(1);
    expect(pulled.body.data[0]).toMatchObject({ agent: 'main', body: 'Tồn kho hôm nay?', tg: 1 });
    // Lấy lần hai thì không trùng.
    expect((await relay('/pull', {})).body.data).toHaveLength(0);

    const id = pulled.body.data[0].id;
    expect((await relay('/push', { id, reply: 'Kho ổn.' })).status).toBe(200);

    const list = await ctx.request('/api/agent-chat?agent=main', { as: USERS.ceo });
    expect(list.body.data.map((m: any) => [m.role, m.body, m.status])).toEqual([
      ['USER', 'Tồn kho hôm nay?', 'done'],
      ['AGENT', 'Kho ổn.', 'done'],
    ]);
    const agents = await ctx.request('/api/agent-chat/agents', { as: USERS.ceo });
    expect(agents.body.data.relay_online).toBe(true);
    expect(agents.body.data.agents.find((a: any) => a.id === 'main').pending).toBe(0);
  });

  it('agent lỗi thì tin báo lỗi hiện cho chị', async () => {
    await ctx.request('/api/agent-chat', { as: USERS.ceo, body: { agent: 'lead-sale-ailla', body: 'hi' } });
    const id = (await relay('/pull', {})).body.data[0].id;
    await relay('/push', { id, error: 'Agent không phản hồi' });
    const list = await ctx.request('/api/agent-chat?agent=lead-sale-ailla', { as: USERS.ceo });
    expect(list.body.data[0].status).toBe('error');
    expect(list.body.data[1].role).toBe('SYSTEM');
  });
});

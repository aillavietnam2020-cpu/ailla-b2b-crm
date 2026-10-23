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

  it('agent gửi kèm ảnh: chị xem được ảnh, người khác thì không', async () => {
    await ctx.request('/api/agent-chat', { as: USERS.ceo, body: { agent: 'media-ailla-agent', body: 'tạo ảnh' } });
    const id = (await relay('/pull', {})).body.data[0].id;
    const tiny = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const pushed = await relay('/push', {
      id,
      reply: 'Đây là ảnh',
      files: [
        { name: 'a.png', mime: 'image/png', b64: tiny },
        { name: 'x.html', mime: 'text/html', b64: tiny },
      ],
    });
    expect(pushed.body.data.files).toBe(1);
    const list = await ctx.request('/api/agent-chat?agent=media-ailla-agent', { as: USERS.ceo });
    const files = list.body.data[1].files;
    expect(files).toHaveLength(1);
    const img = await ctx.app.fetch(
      new Request(`http://x/api/agent-chat/file/${files[0].id}`, { headers: { 'X-Dev-Email': USERS.ceo } }),
      ctx.env,
    );
    expect(img.status).toBe(200);
    expect(img.headers.get('Content-Type')).toBe('image/png');
    const denied = await ctx.app.fetch(
      new Request(`http://x/api/agent-chat/file/${files[0].id}`, { headers: { 'X-Dev-Email': USERS.thao } }),
      ctx.env,
    );
    // Người không phải chủ của tin thì không thấy ảnh (che luôn việc ảnh có tồn tại hay không).
    expect(denied.status).toBe(404);
  });

  it('cấp quyền cho nhân sự: chỉ thấy agent được cấp và cuộc trò chuyện của chính mình', async () => {
    // Chưa cấp quyền thì không thấy agent nào, không nhắn được.
    expect((await ctx.request('/api/agent-chat/agents', { as: USERS.thao })).body.data.agents).toHaveLength(0);
    expect((await ctx.request('/api/agent-chat', { as: USERS.thao, body: { agent: 'ke-toan-truong-ailla', body: 'chào' } })).status).toBe(403);
    // Nhân sự không tự cấp quyền được.
    expect((await ctx.request('/api/agent-chat/access/user-thao', { as: USERS.thao, method: 'PUT', body: { agents: ['main'] } })).status).toBe(403);
    // Chị Hoa cấp quyền.
    const set = await ctx.request('/api/agent-chat/access/user-thao', { as: USERS.ceo, method: 'PUT', body: { agents: ['ke-toan-truong-ailla', 'khong-co'] } });
    expect(set.body.data.agents).toEqual(['ke-toan-truong-ailla']);
    const me = await ctx.request('/api/me', { as: USERS.thao });
    expect(me.body.data.agent_chat).toEqual(['ke-toan-truong-ailla']);
    const roster = await ctx.request('/api/agent-chat/agents', { as: USERS.thao });
    expect(roster.body.data.agents.map((a: any) => a.id)).toEqual(['ke-toan-truong-ailla']);
    expect((await ctx.request('/api/agent-chat?agent=main', { as: USERS.thao })).status).toBe(403);

    // Tin của chị Hoa với cùng agent không lộ cho nhân sự.
    await ctx.request('/api/agent-chat', { as: USERS.ceo, body: { agent: 'ke-toan-truong-ailla', body: 'tin của chị Hoa' } });
    await ctx.request('/api/agent-chat', { as: USERS.thao, body: { agent: 'ke-toan-truong-ailla', body: 'tin của Thảo', tg: true } });
    const pulled = (await relay('/pull', {})).body.data;
    const mine = pulled.find((m: any) => m.body === 'tin của Thảo');
    expect(mine.who_name).toContain('Nguyễn Thu Thảo');
    expect(mine.who_role).toBe('EMPLOYEE');
    expect(mine.tg).toBe(0); // nhân sự không gửi kèm Telegram của chị
    await relay('/push', { id: mine.id, reply: 'Dạ chào Thảo' });
    const list = await ctx.request('/api/agent-chat?agent=ke-toan-truong-ailla', { as: USERS.thao });
    expect(list.body.data.map((m: any) => m.body)).toEqual(['tin của Thảo', 'Dạ chào Thảo']);
    const ceoList = await ctx.request('/api/agent-chat?agent=ke-toan-truong-ailla', { as: USERS.ceo });
    expect(ceoList.body.data.map((m: any) => m.body)).toEqual(['tin của chị Hoa']);
  });

  it('chị dán ảnh vào tin: ảnh lưu kèm, cầu nối tải được, tin chỉ có ảnh vẫn gửi được', async () => {
    const tiny = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const none = await ctx.request('/api/agent-chat', { as: USERS.ceo, body: { agent: 'main', body: '   ' } });
    expect(none.status).toBe(400);
    const sent = await ctx.request('/api/agent-chat', {
      as: USERS.ceo,
      body: {
        agent: 'main',
        body: '',
        files: [
          { name: 'a.jpg', mime: 'image/jpeg', b64: tiny },
          { name: 'bad.html', mime: 'text/html', b64: tiny },
        ],
      },
    });
    expect(sent.status).toBe(200);
    const pulled = (await relay('/pull', {})).body.data;
    expect(pulled).toHaveLength(1);
    expect(pulled[0].body).toBe('(gửi ảnh)');
    expect(pulled[0].files).toHaveLength(1);
    const r = await ctx.app.fetch(
      new Request(`http://x/api/agent-relay/file/${pulled[0].files[0].id}`, { headers: { 'X-Relay-Key': 'relay-test-key-123' } }),
      ctx.env,
    );
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { b64: string } }).data.b64).toBe(tiny);
    const wrong = await ctx.app.fetch(new Request(`http://x/api/agent-relay/file/1`, { headers: { 'X-Relay-Key': 'sai' } }), ctx.env);
    expect(wrong.status).toBe(401);
  });

  it('đồng bộ tin Telegram: hiện trên web, gửi lại không bị trùng, không vào hàng đợi agent', async () => {
    const items = [
      { agent: 'main', role: 'USER', body: 'tồn kho hôm nay?', ext_id: 'S1:4', ts: 1792480000000 },
      { agent: 'main', role: 'AGENT', body: 'Dạ kho ổn chị ạ', ext_id: 'S1:8', ts: 1792480005000 },
      { agent: 'khong-co', role: 'USER', body: 'x', ext_id: 'S1:9', ts: 1792480006000 },
    ];
    expect((await relay('/sync', { items })).body.data.added).toBe(2);
    expect((await relay('/sync', { items })).body.data.added).toBe(0);
    const list = await ctx.request('/api/agent-chat?agent=main', { as: USERS.ceo });
    expect(list.body.data.map((m: any) => [m.role, m.source, m.body])).toEqual([
      ['USER', 'TELEGRAM', 'tồn kho hôm nay?'],
      ['AGENT', 'TELEGRAM', 'Dạ kho ổn chị ạ'],
    ]);
    // Tin chép từ Telegram không biến thành việc chờ agent làm.
    expect((await relay('/pull', {})).body.data).toHaveLength(0);
    expect((await relay('/sync', { items }, 'sai')).status).toBe(401);
  });

  it('agent lỗi thì tin báo lỗi hiện cho chị', async () => {
    await ctx.request('/api/agent-chat', { as: USERS.ceo, body: { agent: 'lead-sale-ailla', body: 'hi' } });
    const id = (await relay('/pull', {})).body.data[0].id;
    await relay('/push', { id, error: 'Agent không phản hồi' });
    const list = await ctx.request('/api/agent-chat?agent=lead-sale-ailla', { as: USERS.ceo });
    expect(list.body.data[0].status).toBe('error');
    expect(list.body.data[1].role).toBe('SYSTEM');
  });

  it('tải file (Excel/PDF...) chia mảnh: gửi kèm tin, cầu nối lấy đủ mảnh, người khác không tải được', async () => {
    const bad = await ctx.request('/api/agent-chat/doc', { as: USERS.ceo, body: { name: 'virus.exe', size: 10 } });
    expect(bad.status).toBe(400);
    const big = await ctx.request('/api/agent-chat/doc', { as: USERS.ceo, body: { name: 'a.mp4', size: 26 * 1024 * 1024 } });
    expect(big.status).toBe(400);
    const start = await ctx.request('/api/agent-chat/doc', { as: USERS.ceo, body: { name: 'bang gia.xlsx', size: 1_000_000 } });
    expect(start.body.data.nparts).toBe(2);
    const id = start.body.data.id;
    // chưa đủ mảnh thì chưa gửi được
    await ctx.request(`/api/agent-chat/doc/${id}/0`, { as: USERS.ceo, method: 'PUT', body: { b64: btoa('mảnh một'.replace(/[^ -]/g, 'x')) } });
    const early = await ctx.request('/api/agent-chat', { as: USERS.ceo, body: { agent: 'main', body: 'xem file', docs: [id] } });
    expect(early.status).toBe(400);
    await ctx.request(`/api/agent-chat/doc/${id}/1`, { as: USERS.ceo, method: 'PUT', body: { b64: btoa('manh hai') } });
    expect((await ctx.request(`/api/agent-chat/doc/${id}/5`, { as: USERS.ceo, method: 'PUT', body: { b64: 'QQ==' } })).status).toBe(400);
    const sent = await ctx.request('/api/agent-chat', { as: USERS.ceo, body: { agent: 'main', body: '', docs: [id] } });
    expect(sent.status).toBe(200);

    const pulled = await relay('/pull', {});
    expect(pulled.body.data[0].body).toBe('(gửi file)');
    expect(pulled.body.data[0].docs).toEqual([{ id, name: 'bang gia.xlsx', size: 1_000_000, nparts: 2 }]);
    const part = await ctx.app.fetch(new Request(`http://x/api/agent-relay/doc/${id}/1`, { headers: { 'X-Relay-Key': 'relay-test-key-123' } }), ctx.env);
    expect(((await part.json()) as any).data.b64).toBe(btoa('manh hai'));

    const other = await ctx.request(`/api/agent-chat/doc/${id}`, { as: USERS.thao });
    expect(other.status).toBe(404);
    const list = await ctx.request('/api/agent-chat?agent=main', { as: USERS.ceo });
    expect(list.body.data[0].docs[0].name).toBe('bang gia.xlsx');
  });

  it('ba tin gửi dồn: agent nhận lần lượt từng tin, tin sau chờ tin trước xong', async () => {
    for (const b of ['một', 'hai', 'ba']) await ctx.request('/api/agent-chat', { as: USERS.ceo, body: { agent: 'main', body: b } });
    const p1 = await relay('/pull', {});
    expect(p1.body.data.map((m: any) => m.body)).toEqual(['một']);
    expect((await relay('/pull', {})).body.data).toHaveLength(0); // tin 1 đang làm, tin 2 và 3 vẫn đang chờ
    await relay('/push', { id: p1.body.data[0].id, reply: 'ok 1' });
    const p2 = await relay('/pull', {});
    expect(p2.body.data.map((m: any) => m.body)).toEqual(['hai']);
    // cầu nối khởi động lại giữa chừng: tin đang làm dở báo lỗi, tin sau chạy tiếp
    const r = await relay('/reset-taken', {});
    expect(r.body.data.reset).toBe(1);
    expect((await relay('/pull', {})).body.data.map((m: any) => m.body)).toEqual(['ba']);
  });
});

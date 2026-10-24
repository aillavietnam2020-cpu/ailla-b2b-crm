/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const KEY = 'khoa-thu-worker-1234567890';

beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.WORKER_KEY = KEY;
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

const worker = async (path: string, body: unknown, key = KEY) => {
  const r = await ctx.app.fetch(
    new Request('http://x/api/stt-worker' + path, { method: 'POST', headers: { 'X-Worker-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    ctx.env,
  );
  return { status: r.status, body: (await r.json()) as { data: any } };
};

describe('Ghi âm Whisper', () => {
  it('máy nghe sai khoá bị từ chối; chưa có máy nghe thì báo tắt', async () => {
    expect((await worker('/pull', {}, 'sai')).status).toBe(401);
    const st = await ctx.request('/api/agent-chat/stt/status', { as: USERS.ceo });
    expect((st.body as any).data.online).toBe(false);
  });

  it('gửi âm thanh, máy nghe lấy về, trả chữ, người gửi đọc được và âm thanh bị xóa', async () => {
    const up = await ctx.request('/api/agent-chat/stt', { as: USERS.ceo, body: { audio_b64: 'QUJD', mime: 'audio/webm;codecs=opus' } });
    expect(up.status).toBe(200);
    const id = (up.body as any).data.id;
    expect(((await ctx.request(`/api/agent-chat/stt/${id}`, { as: USERS.ceo })).body as any).data.status).toBe('queued');
    const pulled = await worker('/pull', {});
    expect(pulled.body.data.id).toBe(id);
    expect(pulled.body.data.audio).toBe('QUJD');
    expect((await worker('/pull', {})).body.data).toBeNull();
    expect(((await ctx.request('/api/agent-chat/stt/status', { as: USERS.ceo })).body as any).data.online).toBe(true);
    await worker('/push', { id, text: 'Xin chào chị Hoa.' });
    const done = ((await ctx.request(`/api/agent-chat/stt/${id}`, { as: USERS.ceo })).body as any).data;
    expect(done).toMatchObject({ status: 'done', text: 'Xin chào chị Hoa.' });
    const left = await ctx.db.prepare('SELECT audio FROM agent_stt_jobs WHERE id = ?').bind(id).first();
    expect((left as any).audio).toBeNull();
  });

  it('người khác không đọc được kết quả; nhân viên chưa được cấp agent không gửi được; định dạng lạ bị từ chối', async () => {
    const up = await ctx.request('/api/agent-chat/stt', { as: USERS.ceo, body: { audio_b64: 'QUJD', mime: 'audio/webm' } });
    const id = (up.body as any).data.id;
    expect((await ctx.request(`/api/agent-chat/stt/${id}`, { as: USERS.thao })).status).toBe(404);
    expect((await ctx.request('/api/agent-chat/stt', { as: USERS.thao, body: { audio_b64: 'QUJD', mime: 'audio/webm' } })).status).toBe(400);
    expect((await ctx.request('/api/agent-chat/stt', { as: USERS.ceo, body: { audio_b64: 'QUJD', mime: 'video/mp4' } })).status).toBe(400);
  });
});

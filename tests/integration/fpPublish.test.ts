import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const KEY = 'khoa-thu-fanpage-1234567890';

beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.FP_KEY = KEY;
  await seedUsers(ctx.db);
});

const vn = () => new Date(Date.now() + 7 * 3600 * 1000);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
const due = async (): Promise<J> => (await agent('due')).json();
const agent = (path: string, body: unknown = {}) =>
  ctx.app.fetch(
    new Request(`http://localhost/api/fp/${path}`, {
      method: 'POST',
      headers: { 'X-Fp-Key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx.env,
  );

async function seedCard(pageId: string) {
  const t = vn();
  const card = {
    id: 'FP1', kenh: 'Fanpage chính', step: 'dang', day: t.getUTCDate(), thang: `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`,
    pageId, gio: `${String(t.getUTCHours()).padStart(2, '0')}:00`, noiDung: 'Bài thử', dangVideo: 'Ảnh',
  };
  const init = await ctx.request('/api/hub/state', { as: USERS.ceo, method: 'PUT', body: { version: 0, data: { cards: [card], settings: { today: t.getUTCDate() } } } });
  expect(init.status).toBe(200);
}
const cardNow = async () => {
  const st = await ctx.request('/api/hub/state', { as: USERS.ceo });
  return st.body.data.data.cards[0];
};
const addPage = (id: string, test: boolean) =>
  ctx.request('/api/hub/fp-publish/pages', { as: USERS.ceo, body: { page_id: id, name: 'Page ' + id, is_test: test } });
const setMode = (mode: string) => ctx.request('/api/hub/fp-publish/mode', { as: USERS.ceo, body: { mode } });

describe('Đăng bài Fanpage qua agent', () => {
  it('mặc định tắt: agent hỏi không nhận bài nào', async () => {
    await addPage('100000000001', true);
    await seedCard('100000000001');
    const r = await due();
    expect(r.data.mode).toBe('off');
    expect(r.data.posts).toHaveLength(0);
  });

  it('chế độ thử: nhận bài page thử đúng một lần, báo xong thì bài thành Đã đăng', async () => {
    await addPage('100000000001', true);
    await seedCard('100000000001');
    await setMode('test');
    const a = await due();
    expect(a.data.posts).toHaveLength(1);
    expect(a.data.posts[0]).toMatchObject({ card_id: 'FP1', page_id: '100000000001', kind: 'feed', message: 'Bài thử' });
    const b = await due();
    expect(b.data.posts).toHaveLength(0); // không đăng đôi
    expect((await cardNow()).fbState).toBe('sending');

    const done = await agent('done', { card_id: 'FP1', ok: true, fb_post_id: '100_200' });
    expect(done.status).toBe(200);
    const c = await cardNow();
    expect(c.step).toBe('xong');
    expect(c.linkDang).toContain('100_200');
  });

  it('chế độ thử: bài của page thật chưa được giao cho agent', async () => {
    await addPage('100000000002', false);
    await seedCard('100000000002');
    await setMode('test');
    expect((await due()).data.posts).toHaveLength(0);
    await setMode('on');
    expect((await due()).data.posts).toHaveLength(1);
  });

  it('agent báo lỗi thì bài đánh dấu lỗi, không tự đăng lại', async () => {
    await addPage('100000000001', true);
    await seedCard('100000000001');
    await setMode('test');
    await agent('due');
    await agent('done', { card_id: 'FP1', ok: false, error: 'Hết hạn mã' });
    const c = await cardNow();
    expect(c.fbState).toBe('error');
    expect((await due()).data.posts).toHaveLength(0);
  });

  it('chỉ CEO đổi công tắc và thêm page; sai khóa agent bị chặn', async () => {
    const r = await ctx.request('/api/hub/fp-publish/mode', { as: USERS.manager, body: { mode: 'on' } });
    expect(r.status).toBe(403);
    const bad = await ctx.app.fetch(new Request('http://localhost/api/fp/due', { method: 'POST', headers: { 'X-Fp-Key': 'sai' } }), ctx.env);
    expect(bad.status).toBe(401);
  });
});

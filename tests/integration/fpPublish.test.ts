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

describe('Agent tự lên bài vào lịch (/api/fp/draft)', () => {
  const tomorrow = () => new Date(Date.now() + 7 * 3600 * 1000 + 86_400_000).toISOString().slice(0, 10);
  const draft = (posts: unknown[]) => agent('draft', { task_id: 'WT-1', posts });
  const cards = async () => (await ctx.request('/api/hub/state', { as: USERS.ceo })).body.data.data.cards as J[];

  it('tạo bài ở Chờ duyệt, không tự duyệt, giờ làm tròn 15 phút', async () => {
    await addPage('100000000001', true);
    await seedCard('100000000001');
    const r: J = await (await draft([{ page_id: '100000000001', date: tomorrow(), time: '9:47', text: 'Bài agent viết', format: 'photo', media_url: 'https://x.vn/a.jpg', comment: 'Mua tại https://ailla.vn' }])).json();
    expect(r.data.created).toBe(1);
    const c = (await cards()).find((x) => x.id !== 'FP1');
    expect(c.step).toBe('dvd');
    expect(c.gio).toBe('09:45');
    expect(c.pdate).toBe(tomorrow());
    expect(c.firstComment).toContain('ailla.vn');
    expect(c.fpAgentTask).toBe('WT-1');
  });

  it('gửi lại cùng bài thì không nhân đôi; bài sai bị bỏ kèm lý do', async () => {
    await addPage('100000000001', true);
    await seedCard('100000000001');
    const good = { page_id: '100000000001', date: tomorrow(), time: '10:00', text: 'Bài A' };
    await draft([good]);
    const r2: J = await (await draft([good, { page_id: '999', date: tomorrow(), time: '10:00', text: 'x' }, { page_id: '100000000001', date: '2020-01-01', time: '10:00', text: 'x' }, { page_id: '100000000001', date: tomorrow(), time: '25:00', text: 'x' }, { page_id: '100000000001', date: tomorrow(), time: '10:00', text: '' }])).json();
    expect(r2.data.created).toBe(0);
    expect(r2.data.skipped.length).toBeGreaterThanOrEqual(4);
    expect((await cards()).filter((x) => x.id !== 'FP1')).toHaveLength(1);
  });

  it('bài agent tạo muốn đăng phải được duyệt trước: chưa duyệt thì /due không giao', async () => {
    await addPage('100000000001', true);
    await seedCard('100000000001');
    await setMode('test');
    await draft([{ page_id: '100000000001', date: tomorrow(), time: '10:00', text: 'Bài mai' }]);
    const posts = (await due()).data.posts as J[];
    expect(posts.every((p) => p.card_id === 'FP1')).toBe(true);
  });
});

describe('Agent báo đã đăng (kể cả đăng tay theo lệnh trong chat)', () => {
  it('draft trả mã bài; /done ghi link bài, nội dung, ảnh và bình luận đã đăng', async () => {
    await addPage('100000000001', true);
    await seedCard('100000000001');
    const tomorrow = new Date(Date.now() + 7 * 3600 * 1000 + 86_400_000).toISOString().slice(0, 10);
    const r: J = await (await agent('draft', { task_id: 'WT-2', posts: [{ page_id: '100000000001', date: tomorrow, time: '09:00', text: 'Nháp ban đầu' }] })).json();
    const id = r.data.ids[0].id as string;
    expect(id).toMatch(/^FPA-/);
    const d = await agent('done', {
      card_id: id, ok: true, fb_post_id: '123_456', post_url: 'https://www.facebook.com/123_456', text: 'Nội dung đã đăng thật',
      media_url: 'https://x.vn/a.jpg', comments: [{ text: 'Mua tại ailla.vn', image: 'https://x.vn/c.jpg' }, { text: '', image: '' }],
    });
    expect(d.status).toBe(200);
    const c = (await ctx.request('/api/hub/state', { as: USERS.ceo })).body.data.data.cards.find((x: J) => x.id === id);
    expect(c.step).toBe('xong');
    expect(c.linkDang).toBe('https://www.facebook.com/123_456');
    expect(c.noiDung).toBe('Nội dung đã đăng thật');
    expect(c.mediaUrl).toBe('https://x.vn/a.jpg');
    expect(c.cmDaDang).toHaveLength(1);
  });
});

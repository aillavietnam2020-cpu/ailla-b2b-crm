import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';
import { aiMask, aiSensitive, responseStats } from '@shared/zalo';
import { zaloWaitBell } from '@server/routes/zaloInsight';

/** Zalo trong CRM, đợt 2 (27/11): chat đầy đủ, AI soạn nháp, đo sale. */
let ctx: TestContext;
let nick = '';
let conv = '';
beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.AGENT_RELAY_KEY = 'khoa-thu';
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
  await ctx.db.prepare("UPDATE customers SET phone_normalized = '0912345678' WHERE id = 'cus-thao-1'").run();
  const r = await ctx.request('/api/zalo/nicks', { as: USERS.ceo, body: { name: 'Zalo Sale 1', owner_id: 'user-thao' } });
  nick = r.body.data.id;
  await relay('/state', { nick_id: nick, status: 'ON' });
  await relay('/events', { nick_id: nick, events: [msg()] });
  conv = (await ctx.request('/api/zalo/convs', { as: USERS.thao })).body.data[0].id;
});
afterEach(() => vi.unstubAllGlobals());

/* eslint-disable @typescript-eslint/no-explicit-any */
const relay = async (path: string, body?: unknown): Promise<{ status: number; body: any; raw: Response }> => {
  const r = await ctx.app.fetch(
    new Request(`http://localhost/api/zalo-nick-relay${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'X-Relay-Key': 'khoa-thu', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    ctx.env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
  );
  const ct = r.headers.get('content-type') ?? '';
  return { status: r.status, body: ct.includes('json') ? await r.json() : null, raw: r };
};
/* eslint-enable @typescript-eslint/no-explicit-any */
const msg = (over: Record<string, unknown> = {}) => ({
  type: 'msg',
  thread_id: 'u-khach',
  thread_name: 'Anh Minh',
  peer_phone: '0912345678',
  msg_id: 'm1',
  cli_msg_id: 'c1',
  from_me: false,
  sender_uid: 'u-khach',
  sender_name: 'Anh Minh',
  kind: 'text',
  text: 'Nước giặt 3.6kg giá sao em?',
  raw: JSON.stringify({ msgType: 'webchat', content: 'Nước giặt 3.6kg giá sao em?', ts: '1' }),
  at: Date.parse('2026-11-27T01:10:00Z'),
  ...over,
});
const firstRow = async (id = 'm1') => (await ctx.db.prepare('SELECT id FROM zalo_msgs WHERE msg_id = ?').bind(id).first<{ id: string }>())!.id;
const takeCmds = async () => (await relay('/poll')).body.data.cmds as Array<{ id: string; kind: string; payload: string; thread_id: string }>;

describe('tính toán đợt 2', () => {
  it('che số điện thoại / số tài khoản trước khi gửi AI', () => {
    expect(aiMask('gọi 0912 345 678 hoặc +84912345678, STK 1903456789012, giá 95.000')).toBe('gọi [SĐT] hoặc [SĐT], STK [số], giá 95.000');
  });
  it('từ nhạy cảm (bỏ dấu khi so), "kiện hàng" không tính', () => {
    expect(aiSensitive('em muốn HOAN TIEN')).toBe('hoàn tiền');
    expect(aiSensitive('giao 2 kiện hàng nhé')).toBeNull();
  });
  it('thời gian trả lời tính từ tin khách đầu tiên chưa trả lời', () => {
    const t = (m: number) => new Date(Date.UTC(2026, 10, 27, 1, m)).toISOString();
    const s = responseStats([
      { conv_id: 'a', from_me: 0, at: t(0), owner_id: 'u1' },
      { conv_id: 'a', from_me: 0, at: t(5), owner_id: 'u1' },
      { conv_id: 'a', from_me: 1, at: t(10), owner_id: 'u1' },
      { conv_id: 'b', from_me: 0, at: t(0), owner_id: 'u1' },
      { conv_id: 'b', from_me: 1, at: t(90), owner_id: 'u1' },
    ]);
    expect(s.u1!.replies).toBe(2);
    expect(s.u1!.medianMin).toBe(50);
    expect(s.u1!.within15).toBe(50);
    expect(s.u1!.over60).toBe(1);
  });
});

describe('chat đầy đủ', () => {
  it('trả lời trích dẫn: lệnh mang dữ liệu tin gốc, tin gửi xong hiện khối trích dẫn', async () => {
    const id = await firstRow();
    const s = await ctx.request(`/api/zalo/convs/${conv}/send`, { as: USERS.thao, body: { text: 'Dạ 95k ạ', quote_id: id } });
    expect(s.status).toBe(200);
    const cmd = (await takeCmds())[0]!;
    const pl = JSON.parse(cmd.payload);
    expect(pl.quote.msg_id).toBe('m1');
    expect(JSON.parse(pl.quote.raw).msgType).toBe('webchat');
    await relay(`/cmd/${cmd.id}/done`, { ok: true, msg_id: 'm2', cli_msg_id: 'c2' });
    const d = await ctx.request(`/api/zalo/convs/${conv}`, { as: USERS.thao });
    expect(d.body.data.msgs[1].quote_text).toBe('Nước giặt 3.6kg giá sao em?');
  });

  it('gửi ảnh: tải lên, máy Zalo lấy tệp, gửi xong xóa nội dung tệp', async () => {
    const up = await ctx.request('/api/zalo/files', { as: USERS.thao, body: { nick_id: nick, name: 'bao-gia.png', mime: 'image/png', b64: btoa('PNGDATA') } });
    expect(up.status).toBe(200);
    expect((await ctx.request('/api/zalo/files', { as: USERS.huyen, body: { nick_id: nick, name: 'x', b64: btoa('x') } })).status).toBe(403);
    await ctx.request(`/api/zalo/convs/${conv}/send`, { as: USERS.thao, body: { text: '', file_id: up.body.data.id } });
    const cmd = (await takeCmds())[0]!;
    const f = await relay(`/file/${JSON.parse(cmd.payload).file.id}`);
    expect(f.status).toBe(200);
    expect(await f.raw.text()).toBe('PNGDATA');
    await relay(`/cmd/${cmd.id}/done`, { ok: true, msg_id: 'm3' });
    expect((await relay(`/file/${JSON.parse(cmd.payload).file.id}`)).status).toBe(404);
    const d = await ctx.request(`/api/zalo/convs/${conv}`, { as: USERS.thao });
    expect(d.body.data.msgs[1].kind).toBe('image');
  });

  it('thu hồi tin mình gửi, thả cảm xúc, ẩn phía mình (Lead vẫn thấy)', async () => {
    await relay('/events', { nick_id: nick, events: [msg({ msg_id: 'm5', cli_msg_id: 'c5', from_me: true, text: 'nhầm giá' })] });
    const mine = await firstRow('m5');
    expect((await ctx.request(`/api/zalo/msgs/${await firstRow()}/undo`, { as: USERS.thao, body: {} })).status).toBe(400); // tin khách
    expect((await ctx.request(`/api/zalo/msgs/${mine}/undo`, { as: USERS.thao, body: {} })).status).toBe(200);
    expect((await ctx.request(`/api/zalo/msgs/${await firstRow()}/react`, { as: USERS.thao, body: { icon: '/-heart' } })).status).toBe(200);
    for (const c of await takeCmds()) await relay(`/cmd/${c.id}/done`, { ok: true });
    // khách thả cảm xúc vào tin mình
    await relay('/events', { nick_id: nick, events: [{ type: 'react', thread_id: 'u-khach', msg_id: 'm5', uid: 'u-khach', name: 'Anh Minh', icon: '/-strong' }] });
    const d = await ctx.request(`/api/zalo/convs/${conv}`, { as: USERS.thao });
    const byId = Object.fromEntries(d.body.data.msgs.map((m: { id: string }) => [m.id, m]));
    expect(byId[mine].recalled).toBe(true);
    expect(byId[mine].reacts[0].icon).toBe('/-strong');
    expect(byId[await firstRow()].reacts[0]).toMatchObject({ icon: '/-heart', from_me: 1 });
    await ctx.request(`/api/zalo/msgs/${mine}/hide`, { as: USERS.thao, body: {} });
    expect((await ctx.request(`/api/zalo/convs/${conv}`, { as: USERS.thao })).body.data.msgs).toHaveLength(1);
    expect((await ctx.request(`/api/zalo/convs/${conv}`, { as: USERS.ceo })).body.data.msgs).toHaveLength(2);
  });

  it('chuyển tiếp sang hội thoại khác; ghim lên đầu', async () => {
    await relay('/events', { nick_id: nick, events: [msg({ thread_id: 'u-2', thread_name: 'Chị Hà', peer_phone: '', msg_id: 'n1', at: Date.parse('2026-11-27T02:00:00Z') })] });
    const list = (await ctx.request('/api/zalo/convs', { as: USERS.thao })).body.data;
    const other = list.find((x: { id: string }) => x.id !== conv).id;
    const f = await ctx.request(`/api/zalo/msgs/${await firstRow()}/forward`, { as: USERS.thao, body: { conv_ids: [other] } });
    expect(f.body.data.ids).toHaveLength(1);
    const cmd = (await takeCmds())[0]!;
    expect(cmd.thread_id).toBe('u-2');
    await ctx.request(`/api/zalo/convs/${conv}/pin`, { as: USERS.thao, body: { on: true } });
    expect((await ctx.request('/api/zalo/convs', { as: USERS.thao })).body.data[0].id).toBe(conv);
  });

  it('kết bạn: người bấm gửi lời mời; lời mời đến thì Đồng ý; danh bạ, nhóm, tin cũ, đang gõ', async () => {
    expect((await ctx.request(`/api/zalo/convs/${conv}/friend`, { as: USERS.thao, body: {} })).status).toBe(200);
    await relay('/events', {
      nick_id: nick,
      events: [
        { type: 'fr_req', thread_id: 'u-moi', name: 'Đại lý Mới', text: 'Kết bạn với em nhé' },
        { type: 'friends', thread_id: 'list', list: [{ uid: 'u-khach', name: 'Anh Minh', phone: '84912345678' }] },
        { type: 'groups', thread_id: 'list', list: [{ id: 'g-1', name: 'AILLA – Đại lý miền Bắc' }] },
        msg({ msg_id: 'old1', text: 'tin cũ', old: true, at: Date.parse('2026-10-01T01:00:00Z') }),
        { type: 'typing', thread_id: 'u-khach' },
      ],
    });
    const reqs = (await ctx.request('/api/zalo/friend-reqs', { as: USERS.thao })).body.data;
    expect(reqs[0]).toMatchObject({ uid: 'u-moi', name: 'Đại lý Mới' });
    expect((await ctx.request('/api/zalo/friend-reqs', { as: USERS.huyen })).body.data).toHaveLength(0);
    await ctx.request(`/api/zalo/friend-reqs/${nick}/u-moi`, { as: USERS.thao, body: { accept: true } });
    const cmds = await takeCmds();
    expect(cmds.map((c) => c.kind).sort()).toEqual(['FRIEND_ACCEPT', 'FRIEND_REQ']);
    for (const c of cmds) await relay(`/cmd/${c.id}/done`, { ok: true });
    expect((await ctx.request('/api/zalo/friend-reqs', { as: USERS.thao })).body.data).toHaveLength(0);
    const list = (await ctx.request('/api/zalo/convs', { as: USERS.thao })).body.data;
    const k = list.find((x: { id: string }) => x.id === conv);
    expect(k.is_friend).toBe(1);
    expect(k.unread).toBe(1); // tin cũ không cộng chưa đọc
    expect(k.typing_at).toBeTruthy();
    expect(list.some((x: { is_group: number; name: string }) => x.is_group && x.name.includes('miền Bắc'))).toBe(true);
  });
});

describe('AI và đo sale', () => {
  it('AI soạn nháp có bảng giá đúng cấp, che SĐT; giữ nháp, soạn lại khi bấm', async () => {
    ctx.env.AI_BASE_URL = 'https://ai.test';
    ctx.env.AI_API_KEY = 'k';
    const fake = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '"Dạ 20 thùng em để 110.000đ/thùng ạ."' } }] })));
    vi.stubGlobal('fetch', fake);
    await relay('/events', { nick_id: nick, events: [msg({ msg_id: 'm7', text: 'số anh 0987 654 321 nhé', at: Date.parse('2026-11-27T01:20:00Z') })] });
    const r = await ctx.request(`/api/zalo/convs/${conv}/ai`, { as: USERS.thao });
    expect(r.body.data.text).toBe('Dạ 20 thùng em để 110.000đ/thùng ạ.');
    const prompt = JSON.parse((fake.mock.calls[0] as unknown as [string, { body: string }])[1].body).messages[0].content[0].text as string;
    expect(prompt).toContain('Nước giặt test 5L');
    expect(prompt).toContain('[SĐT]');
    expect(prompt).not.toContain('0987 654 321');
    await ctx.request(`/api/zalo/convs/${conv}/ai`, { as: USERS.thao });
    expect(fake).toHaveBeenCalledTimes(1); // dùng lại nháp
    await ctx.request(`/api/zalo/convs/${conv}/ai?redo=1`, { as: USERS.thao });
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it('tin nhạy cảm thì AI không soạn', async () => {
    ctx.env.AI_BASE_URL = 'https://ai.test';
    ctx.env.AI_API_KEY = 'k';
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    await relay('/events', { nick_id: nick, events: [msg({ msg_id: 'm8', text: 'hàng lỗi, chị muốn hoàn tiền' })] });
    const r = await ctx.request(`/api/zalo/convs/${conv}/ai`, { as: USERS.thao });
    expect(r.body.data.text).toBe('');
    expect(r.body.data.note).toContain('hoàn tiền');
    expect(fake).not.toHaveBeenCalled();
  });

  it('khách hôm nay, đo sale (chỉ Lead), chuông khách chờ quá 30 phút', async () => {
    const b = await ctx.request('/api/zalo/brief', { as: USERS.thao });
    expect(b.body.data.waiting).toHaveLength(1);
    expect((await ctx.request('/api/zalo/report', { as: USERS.thao })).status).toBe(403);
    await relay('/events', { nick_id: nick, events: [msg({ msg_id: 'm9', from_me: true, text: 'Dạ', at: Date.parse('2026-11-27T01:25:00Z') })] });
    const rep = await ctx.request('/api/zalo/report?from=2026-11-27&to=2026-11-27', { as: USERS.manager });
    const p = rep.body.data.people.find((x: { owner_id: string }) => x.owner_id === 'user-thao');
    expect(p.replies).toBe(1);
    expect(p.medianMin).toBe(15);
    // chờ lại, quá 30 phút thì chuông (một lần mỗi đợt chờ)
    await relay('/events', { nick_id: nick, events: [msg({ msg_id: 'm10', text: 'em ơi', at: Date.now() - 40 * 60_000 })] });
    expect(await zaloWaitBell(ctx.env.DB)).toBe(1);
    expect(await zaloWaitBell(ctx.env.DB)).toBe(0);
  });
});

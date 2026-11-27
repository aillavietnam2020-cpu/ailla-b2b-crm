import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';
import { msgForViewer, sendAllowed, zaloPhone } from '@shared/zalo';

/** Zalo trong CRM, đợt 1 (27/11): nick, hộp tin, gắn khách, thu hồi, quyền, trần gửi. */
let ctx: TestContext;
beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.AGENT_RELAY_KEY = 'khoa-thu';
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
  await ctx.db.prepare("UPDATE customers SET phone_normalized = '0912345678' WHERE id = 'cus-thao-1'").run();
});

/* eslint-disable @typescript-eslint/no-explicit-any */
const relay = async (path: string, body?: unknown, key = 'khoa-thu'): Promise<{ status: number; body: any }> => {
  const r = await ctx.app.fetch(
    new Request(`http://localhost/api/zalo-nick-relay${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'X-Relay-Key': key, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    ctx.env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
  );
  return { status: r.status, body: await r.json() };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

async function nickOn(owner = 'user-thao'): Promise<string> {
  const r = await ctx.request('/api/zalo/nicks', { as: USERS.ceo, body: { name: 'Zalo Sale 1', owner_id: owner } });
  expect(r.status).toBe(200);
  const id = r.body.data.id as string;
  await relay('/state', { nick_id: id, status: 'ON', zalo_uid: 'z-self', zalo_name: 'AILLA Sale 1' });
  return id;
}
const msg = (over: Record<string, unknown> = {}) => ({
  type: 'msg',
  thread_id: 'u-khach',
  thread_name: 'Anh Minh',
  peer_phone: '+84 912 345 678',
  msg_id: 'm1',
  cli_msg_id: 'c1',
  from_me: false,
  sender_uid: 'u-khach',
  sender_name: 'Anh Minh',
  kind: 'text',
  text: 'Nước giặt 3.6kg giá sao em?',
  at: Date.parse('2026-11-27T01:10:00Z'),
  ...over,
});

describe('tính toán', () => {
  it('trần 5 tin / 30 giây', () => {
    const now = 100_000;
    expect(sendAllowed([now - 1000, now - 2000, now - 3000, now - 4000], now).ok).toBe(true);
    const r = sendAllowed([now - 1000, now - 2000, now - 3000, now - 4000, now - 25_000], now);
    expect(r.ok).toBe(false);
    expect(r.waitSec).toBe(5);
    expect(sendAllowed([now - 31_000, now - 1, now - 2, now - 3, now - 4], now).ok).toBe(true);
  });
  it('chuẩn số Zalo', () => {
    expect(zaloPhone('+84 912 345 678')).toBe('0912345678');
    expect(zaloPhone('912345678')).toBe('0912345678');
    expect(zaloPhone('abc')).toBe('');
  });
  it('tin thu hồi: chỉ Lead thấy nội dung', () => {
    const m = { id: '1', from_me: 0, sender_name: '', kind: 'text', text: 'bên kia 92k', url: '', at: '', recalled_at: 'x', seen_at: null };
    expect(msgForViewer(m, true).text).toBe('bên kia 92k');
    expect(msgForViewer(m, false).text).toBe('');
    expect(msgForViewer(m, false).recalled).toBe(true);
  });
});

describe('nick Zalo và hộp tin', () => {
  it('sai khóa cầu nối thì bị chặn', async () => {
    expect((await relay('/poll', undefined, 'sai')).status).toBe(401);
  });

  it('thêm nick bằng QR: web xin mã, VPS trả ảnh, quét xong thành Đang chạy', async () => {
    const add = await ctx.request('/api/zalo/nicks', { as: USERS.thao, body: { name: 'x' } });
    expect(add.status).toBe(403); // sale không tự thêm nick
    const r = await ctx.request('/api/zalo/nicks', { as: USERS.ceo, body: { name: 'Zalo Sale 1', owner_id: 'user-thao' } });
    const id = r.body.data.id;
    expect((await ctx.request(`/api/zalo/nicks/${id}/qr`, { as: USERS.thao, body: {} })).status).toBe(200);
    expect((await ctx.request(`/api/zalo/nicks/${id}/qr`, { as: USERS.huyen, body: {} })).status).toBe(403);
    const poll = await relay('/poll');
    expect(poll.body.data.cmds).toHaveLength(1);
    expect(poll.body.data.cmds[0].kind).toBe('LOGIN_QR');
    expect((await relay('/poll')).body.data.cmds).toHaveLength(0); // đã nhận thì không lấy trùng
    await relay('/state', { nick_id: id, status: 'QR', qr_image: 'iVBORw0KGgo=' });
    const st = await ctx.request(`/api/zalo/nicks/${id}`, { as: USERS.thao });
    expect(st.body.data.qr_image).toBe('iVBORw0KGgo=');
    await relay('/state', { nick_id: id, status: 'ON', zalo_name: 'AILLA Sale 1' });
    const st2 = await ctx.request(`/api/zalo/nicks/${id}`, { as: USERS.thao });
    expect(st2.body.data.status).toBe('ON');
    expect(st2.body.data.qr_image).toBeNull();
    const cmd = await ctx.db.prepare("SELECT status FROM zalo_cmds WHERE kind = 'LOGIN_QR'").first<{ status: string }>();
    expect(cmd?.status).toBe('DONE');
  });

  it('tin đến tự gắn khách theo SĐT, đang chờ trả lời; sale khác không thấy', async () => {
    const id = await nickOn();
    const ev = await relay('/events', { nick_id: id, events: [msg(), msg()] });
    expect(ev.body.data.added).toBe(1); // tin trùng không ghi hai lần
    const me = await ctx.request('/api/zalo/me', { as: USERS.thao });
    expect(me.body.data.unread).toBe(1);
    expect(me.body.data.wait).toBe(1);
    const list = await ctx.request('/api/zalo/convs?f=wait', { as: USERS.thao });
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].customer_id).toBe('cus-thao-1');
    expect((await ctx.request('/api/zalo/convs', { as: USERS.huyen })).body.data).toHaveLength(0);
    expect((await ctx.request(`/api/zalo/convs/${list.body.data[0].id}`, { as: USERS.huyen })).status).toBe(403);
    expect((await ctx.request('/api/zalo/convs', { as: USERS.ceo })).body.data).toHaveLength(1);

    const stt = await ctx.request('/api/zalo/status/customers', { as: USERS.thao });
    expect(stt.body.data.rows[0].key).toBe('cus-thao-1');
    expect(stt.body.data.rows[0].wait_since).toBe('2026-11-27T01:10:00.000Z');
    const cus = await ctx.request('/api/customers?zalo=wait', { as: USERS.thao });
    expect(cus.body.data.map((x: { id: string }) => x.id)).toEqual(['cus-thao-1']);
  });

  it('khách thu hồi tin: giữ nội dung, chỉ Lead / CEO đọc được', async () => {
    const id = await nickOn();
    await relay('/events', { nick_id: id, events: [msg(), { type: 'undo', thread_id: 'u-khach', msg_id: 'm1', cli_msg_id: 'c1' }] });
    const conv = (await ctx.request('/api/zalo/convs', { as: USERS.thao })).body.data[0];
    const sale = await ctx.request(`/api/zalo/convs/${conv.id}`, { as: USERS.thao });
    expect(sale.body.data.msgs[0].recalled).toBe(true);
    expect(sale.body.data.msgs[0].text).toBe('');
    const ceo = await ctx.request(`/api/zalo/convs/${conv.id}`, { as: USERS.ceo });
    expect(ceo.body.data.msgs[0].text).toBe('Nước giặt 3.6kg giá sao em?');
  });

  it('gửi tin: người bấm gửi, VPS gửi xong ghi vào hội thoại, hết "đang chờ"; trần 5 tin / 30 giây', async () => {
    const id = await nickOn();
    await relay('/events', { nick_id: id, events: [msg()] });
    const conv = (await ctx.request('/api/zalo/convs', { as: USERS.thao })).body.data[0];
    expect((await ctx.request(`/api/zalo/convs/${conv.id}/send`, { as: USERS.huyen, body: { text: 'x' } })).status).toBe(403);
    const s = await ctx.request(`/api/zalo/convs/${conv.id}/send`, { as: USERS.thao, body: { text: 'Dạ 95k/thùng ạ' } });
    expect(s.status).toBe(200);
    const poll = await relay('/poll');
    const cmd = poll.body.data.cmds.find((x: { kind: string }) => x.kind === 'SEND');
    expect(cmd.thread_id).toBe('u-khach');
    await relay(`/cmd/${cmd.id}/done`, { ok: true, msg_id: 'm2' });
    // Zalo dội lại chính tin đó: không ghi trùng
    await relay('/events', { nick_id: id, events: [msg({ msg_id: 'm2', from_me: true, text: 'Dạ 95k/thùng ạ' })] });
    const d = await ctx.request(`/api/zalo/convs/${conv.id}`, { as: USERS.thao });
    expect(d.body.data.msgs).toHaveLength(2);
    expect(d.body.data.msgs[1].sent_by_name).toContain('Thảo');
    expect(d.body.data.conv.waiting_since).toBeNull();
    await relay('/events', { nick_id: id, events: [{ type: 'seen', thread_id: 'u-khach', msg_ids: ['m2'] }] });
    const d2 = await ctx.request(`/api/zalo/convs/${conv.id}`, { as: USERS.thao });
    expect(d2.body.data.msgs[1].seen_at).toBeTruthy();

    for (let i = 0; i < 4; i++) expect((await ctx.request(`/api/zalo/convs/${conv.id}/send`, { as: USERS.thao, body: { text: 'tin ' + i } })).status).toBe(200);
    const slow = await ctx.request(`/api/zalo/convs/${conv.id}/send`, { as: USERS.thao, body: { text: 'tin 6' } });
    expect(slow.status).toBe(400);
    expect(slow.body.error.code).toBe('ZALO_SLOW');
  });

  it('nhắn từ hồ sơ khách chưa có hội thoại: tìm theo số, gắn đúng khách; lịch sử chăm sóc theo ngày', async () => {
    const id = await nickOn();
    expect((await ctx.request('/api/zalo/send-new', { as: USERS.thao, body: { nick_id: id, phone: '0987000111', text: 'Chào anh', customer_id: 'cus-huyen-1' } })).status).toBe(403);
    const s = await ctx.request('/api/zalo/send-new', { as: USERS.thao, body: { nick_id: id, phone: '0987000111', text: 'Chào anh', customer_id: 'cus-thao-2' } });
    expect(s.status).toBe(200);
    const cmd = (await relay('/poll')).body.data.cmds[0];
    expect(cmd.to_phone).toBe('0987000111');
    const done = await relay(`/cmd/${cmd.id}/done`, { ok: true, msg_id: 'm9', thread_id: 'u-moi', thread_name: 'Chị Hà' });
    expect(done.body.data.conv_id).toBeTruthy();
    const th = await ctx.request('/api/zalo/thread?customer_id=cus-thao-2', { as: USERS.thao });
    expect(th.body.data.convs).toHaveLength(1);
    expect(th.body.data.msgs[0].text).toBe('Chào anh');
    expect(th.body.data.days[0].out).toBe(1);
    expect((await ctx.request('/api/zalo/thread?customer_id=cus-thao-2', { as: USERS.huyen })).body.data.convs).toHaveLength(0);
  });

  it('nick chưa nối thì không cho gửi; tin mẫu chỉ Lead sửa', async () => {
    const r = await ctx.request('/api/zalo/nicks', { as: USERS.ceo, body: { name: 'Zalo Sale 2', owner_id: 'user-thao' } });
    const s = await ctx.request('/api/zalo/send-new', { as: USERS.thao, body: { nick_id: r.body.data.id, phone: '0987000111', text: 'x' } });
    expect(s.body.error.code).toBe('NICK_OFF');
    expect((await ctx.request('/api/zalo/templates', { method: 'PUT', as: USERS.thao, body: { items: [] } })).status).toBe(403);
    await ctx.request('/api/zalo/templates', { method: 'PUT', as: USERS.manager, body: { items: [{ code: '/chao', text: 'Dạ AILLA xin chào' }] } });
    const t = await ctx.request('/api/zalo/templates', { as: USERS.thao });
    expect(t.body.data).toEqual([{ code: 'chao', text: 'Dạ AILLA xin chào' }]);
  });
});

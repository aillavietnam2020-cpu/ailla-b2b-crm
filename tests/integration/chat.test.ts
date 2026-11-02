import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  for (const id of ['user-thao', 'user-huyen']) await ctx.request(`/api/admin/users/${id}/marketing`, { as: USERS.ceo, body: { mode: 'with_b2b' } });
});

const DM = 'dm:user-ceo~user-thao';

describe('Tin nhắn (/api/hub/chat)', () => {
  it('nhóm phòng: ai vào web vận hành cũng đọc, viết được; số chưa đọc giảm khi đã đọc', async () => {
    const s = await ctx.request('/api/hub/chat/msgs', { as: USERS.thao, body: { room: 'g:content', body: 'Chào cả nhóm @CEO' } });
    expect(s.status).toBe(200);
    const sum = await ctx.request('/api/hub/chat/summary', { as: USERS.huyen });
    const r = sum.body.data.rooms.find((x: { room: string }) => x.room === 'g:content');
    expect(r.unread).toBe(1);
    expect(r.last.body).toBe('Chào cả nhóm @CEO');
    const list = await ctx.request('/api/hub/chat/msgs?room=g:content', { as: USERS.huyen });
    expect(list.body.data).toHaveLength(1);
    await ctx.request('/api/hub/chat/read', { as: USERS.huyen, body: { room: 'g:content', last_id: list.body.data[0].id } });
    const sum2 = await ctx.request('/api/hub/chat/summary', { as: USERS.huyen });
    expect(sum2.body.data.rooms.find((x: { room: string }) => x.room === 'g:content').unread).toBe(0);
  });

  it('nhắn riêng: chỉ hai người đọc, viết được; người thứ ba bị chặn và không thấy trong danh sách', async () => {
    const s = await ctx.request('/api/hub/chat/msgs', { as: USERS.ceo, body: { room: DM, body: 'Em gửi chị file nhé' } });
    expect(s.status).toBe(200);
    expect((await ctx.request(`/api/hub/chat/msgs?room=${DM}`, { as: USERS.thao })).body.data).toHaveLength(1);
    expect((await ctx.request(`/api/hub/chat/msgs?room=${DM}`, { as: USERS.huyen })).status).toBe(403);
    expect((await ctx.request('/api/hub/chat/msgs', { as: USERS.huyen, body: { room: DM, body: 'xen vào' } })).status).toBe(403);
    const sum = await ctx.request('/api/hub/chat/summary', { as: USERS.huyen });
    expect(sum.body.data.rooms.some((x: { room: string }) => x.room === DM)).toBe(false);
    expect((await ctx.request('/api/hub/chat/msgs', { as: USERS.thao, body: { room: 'dm:user-thao~user-ceo', body: 'sai thứ tự' } })).status).toBe(403);
    expect((await ctx.request('/api/hub/chat/msgs', { as: USERS.thao, body: { room: 'g:Bad Room', body: 'x' } })).status).toBe(400);
  });

  it('nhóm dự án liên phòng: người các phòng cùng đọc, viết', async () => {
    expect((await ctx.request('/api/hub/chat/msgs', { as: USERS.thao, body: { room: 'p:DA-07', body: 'Hook xong rồi' } })).status).toBe(200);
    const sum = await ctx.request('/api/hub/chat/summary', { as: USERS.huyen });
    expect(sum.body.data.rooms.find((x: { room: string }) => x.room === 'p:DA-07').unread).toBe(1);
  });

  it('ảnh / tệp: gửi vào phòng thành tin loại tệp, nhắn riêng thì người ngoài không mở được', async () => {
    const f = new FormData();
    f.set('room', DM);
    f.set('file', new File([new Uint8Array(500).fill(3)], 'bao-cao.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const up = await ctx.request('/api/hub/chat/files', { as: USERS.ceo, method: 'POST', formData: f });
    expect(up.status).toBe(200);
    expect(up.body.data.msg.kind).toBe('file');
    const id = up.body.data.file.id as string;
    const get = await ctx.app.fetch(new Request(`http://local/api/hub/chat/files/${id}`, { headers: { 'X-Dev-Email': USERS.thao } }), ctx.env);
    expect(get.status).toBe(200);
    expect((await get.arrayBuffer()).byteLength).toBe(500);
    const other = await ctx.app.fetch(new Request(`http://local/api/hub/chat/files/${id}`, { headers: { 'X-Dev-Email': USERS.huyen } }), ctx.env);
    expect(other.status).toBe(403);
    const list = await ctx.request(`/api/hub/chat/files?room=${DM}`, { as: USERS.thao });
    expect(list.body.data.map((x: { name: string }) => x.name)).toEqual(['bao-cao.xlsx']);
    const bad = new FormData();
    bad.set('room', 'g:content');
    bad.set('file', new File([new Uint8Array(10)], 'x.exe', { type: 'application/x-msdownload' }));
    expect((await ctx.request('/api/hub/chat/files', { as: USERS.thao, method: 'POST', formData: bad })).status).toBe(400);
  });

  it('thẻ giao việc: lưu loại tin và mã việc', async () => {
    const s = await ctx.request('/api/hub/chat/msgs', { as: USERS.ceo, body: { room: 'g:content', body: 'Làm 30 hook tinh dầu', kind: 'task', ref: 'task:cv_1' } });
    expect(s.body.data.kind).toBe('task');
    expect(s.body.data.ref).toBe('task:cv_1');
  });

  it('nhắc việc: đến giờ người được nhắc nhận đúng một lần; người khác không xóa được', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const r = await ctx.request('/api/hub/chat/reminders', { as: USERS.ceo, body: { user_id: 'user-thao', due_at: past, text: 'Nộp bản dựng', room: DM } });
    expect(r.status).toBe(200);
    expect((await ctx.request('/api/hub/chat/reminders', { as: USERS.ceo, body: { due_at: 'abc', text: 'x' } })).status).toBe(400);
    const future = await ctx.request('/api/hub/chat/reminders', { as: USERS.thao, body: { due_at: new Date(Date.now() + 3600_000).toISOString(), text: 'Họp team' } });
    expect((await ctx.request('/api/hub/chat/reminders/due', { as: USERS.ceo })).body.data).toHaveLength(0);
    const due = await ctx.request('/api/hub/chat/reminders/due', { as: USERS.thao });
    expect(due.body.data.map((x: { text: string }) => x.text)).toEqual(['Nộp bản dựng']);
    expect((await ctx.request('/api/hub/chat/reminders/due', { as: USERS.thao })).body.data).toHaveLength(0);
    const del = await ctx.request(`/api/hub/chat/reminders/${future.body.data.id}`, { as: USERS.huyen, method: 'DELETE' });
    expect(del.body.data.deleted).toBe(0);
    const del2 = await ctx.request(`/api/hub/chat/reminders/${future.body.data.id}`, { as: USERS.thao, method: 'DELETE' });
    expect(del2.body.data.deleted).toBe(1);
  });
});

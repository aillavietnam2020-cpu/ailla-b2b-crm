import { beforeEach, describe, expect, it } from 'vitest';
import { pack } from '../../src/server/lib/pack';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  for (const id of ['user-thao', 'user-huyen', 'user-manager']) await ctx.request(`/api/admin/users/${id}/marketing`, { as: USERS.ceo, body: { mode: 'with_b2b' } });
  /* dữ liệu chung: Thảo, Huyền phòng Content (CM); Quản lý phòng Digital (ADS); dự án DA-07 của Content */
  const hub = {
    users: [
      { id: 'u_thao', crm: 'user-thao', role: 'content', phongBan: 'CM' },
      { id: 'u_huyen', crm: 'user-huyen', role: 'nhanvien', phongBan: 'CM' },
      { id: 'u_ql', crm: 'user-manager', role: 'lead', phongBan: 'ADS' },
      { id: 'u_chi', crm: 'user-ceo', role: 'admin', phongBan: 'BDH' },
    ],
    projects: [{ id: 'DA-07', team: 'content', teams: [], owner: 'u_thao', tv: [] }],
    chatAgents: { 'g:content': ['lead-content-ailla'] },
  };
  await ctx.db.prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('main', 1, ?, ?)").bind(await pack(JSON.stringify(hub)), '2026-11-03T00:00:00Z').run();
});

const DM = 'dm:user-ceo~user-thao';

describe('Tin nhắn (/api/hub/chat)', () => {
  it('nhóm phòng: người trong phòng đọc, viết được; số chưa đọc giảm khi đã đọc', async () => {
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

  it('nhóm dự án: người phòng tham gia đọc, viết; phòng khác bị chặn', async () => {
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

  it('nhóm phòng chỉ người phòng đó và CEO thấy; nhóm dự án chặn phòng không tham gia', async () => {
    await ctx.request('/api/hub/chat/msgs', { as: USERS.thao, body: { room: 'g:content', body: 'Việc riêng team Content' } });
    expect((await ctx.request('/api/hub/chat/msgs?room=g:content', { as: USERS.manager })).status).toBe(403);
    expect((await ctx.request('/api/hub/chat/msgs', { as: USERS.manager, body: { room: 'g:content', body: 'xen vào' } })).status).toBe(403);
    const sum = await ctx.request('/api/hub/chat/summary', { as: USERS.manager });
    expect(sum.body.data.rooms.some((x: { room: string }) => x.room === 'g:content')).toBe(false);
    expect((await ctx.request('/api/hub/chat/msgs?room=g:content', { as: USERS.ceo })).status).toBe(200);
    expect((await ctx.request('/api/hub/chat/msgs?room=p:DA-07', { as: USERS.manager })).status).toBe(403);
    expect((await ctx.request('/api/hub/chat/msgs', { as: USERS.manager, body: { room: 'g:chung', body: 'chào cả công ty' } })).status).toBe(200);
  });

  it('nhóm phối hợp tự tạo (Team Content – Digital): chỉ thành viên thấy; nhân viên không tạo được nhóm', async () => {
    expect((await ctx.request('/api/hub/chat/groups', { as: USERS.huyen, body: { name: 'Nhóm lạ', members: ['user-thao'] } })).status).toBe(403);
    const g = await ctx.request('/api/hub/chat/groups', { as: USERS.manager, body: { name: 'Team Content – Digital', members: ['user-thao'] } });
    expect(g.status).toBe(200);
    const room = 'n:' + g.body.data.id;
    expect((await ctx.request('/api/hub/chat/msgs', { as: USERS.thao, body: { room, body: 'Ads cần thêm 5 video' } })).status).toBe(200);
    expect((await ctx.request(`/api/hub/chat/msgs?room=${room}`, { as: USERS.huyen })).status).toBe(403);
    expect((await ctx.request('/api/hub/chat/groups', { as: USERS.huyen })).body.data).toHaveLength(0);
    expect((await ctx.request('/api/hub/chat/groups', { as: USERS.thao })).body.data.map((x: { name: string }) => x.name)).toEqual(['Team Content – Digital']);
    expect((await ctx.request(`/api/hub/chat/groups/${g.body.data.id}`, { as: USERS.thao, method: 'PUT', body: { name: 'Đổi', members: [] } })).status).toBe(403);
    const up = await ctx.request(`/api/hub/chat/groups/${g.body.data.id}`, { as: USERS.manager, method: 'PUT', body: { name: 'Team Content – Digital', members: ['user-thao', 'user-huyen'] } });
    expect(up.status).toBe(200);
    expect((await ctx.request(`/api/hub/chat/msgs?room=${room}`, { as: USERS.huyen })).status).toBe(200);
  });

  it('agent trong nhóm: chỉ trả lời khi được gọi @tên, nhận tin gần đây làm bối cảnh, câu trả lời về đúng nhóm', async () => {
    ctx.env.AGENT_RELAY_KEY = 'relay-k';
    await ctx.request('/api/hub/chat/msgs', { as: USERS.huyen, body: { room: 'g:content', body: 'Tuần này quay 30 video tinh dầu' } });
    await ctx.request('/api/hub/chat/msgs', { as: USERS.thao, body: { room: 'g:content', body: 'Không gọi ai cả' } });
    expect((await ctx.db.prepare("SELECT COUNT(*) AS n FROM agent_chat").first<{ n: number }>())!.n).toBe(0);
    await ctx.request('/api/hub/chat/msgs', { as: USERS.thao, body: { room: 'g:content', body: '@Lead Content chia việc giúp nhóm' } });
    const q = await ctx.db.prepare("SELECT id, agent, body, owner_id FROM agent_chat WHERE role = 'USER'").first<{ id: number; agent: string; body: string; owner_id: string }>();
    expect(q!.agent).toBe('lead-content-ailla');
    expect(q!.body).toContain('Tuần này quay 30 video tinh dầu');
    expect(q!.owner_id).toBe('user-thao');
    const push = await ctx.app.fetch(new Request('http://x/api/agent-relay/push', { method: 'POST', headers: { 'X-Relay-Key': 'relay-k', 'Content-Type': 'application/json' }, body: JSON.stringify({ id: q!.id, reply: 'Quỳnh 15 video, May 15 video' }) }), ctx.env);
    expect(push.status).toBe(200);
    const list = await ctx.request('/api/hub/chat/msgs?room=g:content', { as: USERS.huyen });
    const last = list.body.data[list.body.data.length - 1];
    expect(last.user_id).toBe('agent:lead-content-ailla');
    expect(last.body).toBe('Quỳnh 15 video, May 15 video');
    // agent không thuộc nhóm thì gọi tên cũng không gửi
    await ctx.request('/api/hub/chat/msgs', { as: USERS.thao, body: { room: 'g:content', body: '@Kế toán trưởng xem giúp' } });
    expect((await ctx.db.prepare("SELECT COUNT(*) AS n FROM agent_chat WHERE agent = 'ke-toan-truong-ailla'").first<{ n: number }>())!.n).toBe(0);
  });

  it('trả lời, chuyển tiếp, ghim, thu hồi: chỉ người gửi hoặc CEO thu hồi được, tin còn dòng đã thu hồi', async () => {
    const a = await ctx.request('/api/hub/chat/msgs', { as: USERS.thao, body: { room: 'g:content', body: 'Hook buổi quay mai' } });
    const id = a.body.data.id;
    const rp = await ctx.request('/api/hub/chat/msgs', { as: USERS.huyen, body: { room: 'g:content', body: 'Ok chị', ref: `q:${id}:buổi quay mai` } });
    expect(rp.status).toBe(200);
    expect(rp.body.data.ref).toBe(`q:${id}:buổi quay mai`);
    expect((await ctx.request('/api/hub/chat/msgs', { as: USERS.huyen, body: { room: 'g:content', body: 'x', ref: 'task:abc' } })).status).toBe(400);
    expect((await ctx.request('/api/hub/chat/msgs', { as: USERS.huyen, body: { room: 'g:content', body: 'Hook buổi quay mai', ref: 'fw:Thảo' } })).status).toBe(200);
    expect((await ctx.request('/api/hub/chat/msgs', { as: USERS.huyen, body: { room: 'g:content', body: '', kind: 'pin', ref: `p:${id}` } })).status).toBe(200);
    expect((await ctx.request(`/api/hub/chat/msgs/${id}/recall`, { as: USERS.huyen, body: {} })).status).toBe(403);
    expect((await ctx.request(`/api/hub/chat/msgs/${id}/recall`, { as: USERS.thao, body: {} })).status).toBe(200);
    const L = (await ctx.request('/api/hub/chat/msgs?room=g:content', { as: USERS.huyen })).body.data as { id: number; kind: string; body: string; ref: string }[];
    const m = L.find((x) => x.id === id)!;
    expect(m.kind).toBe('recall');
    expect(m.body).toBe('');
    expect(L.some((x) => x.kind === 'unsend' && x.ref === `x:${id}`)).toBe(true);
    /* người ngoài phòng không thu hồi được, kể cả biết mã tin */
    const dm = await ctx.request('/api/hub/chat/msgs', { as: USERS.ceo, body: { room: DM, body: 'riêng' } });
    expect((await ctx.request(`/api/hub/chat/msgs/${dm.body.data.id}/recall`, { as: USERS.huyen, body: {} })).status).toBe(403);
    expect((await ctx.request(`/api/hub/chat/msgs/${dm.body.data.id}/recall`, { as: USERS.ceo, body: {} })).status).toBe(200);
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

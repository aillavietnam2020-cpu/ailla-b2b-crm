/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';
import { cleanCrons, cleanStatus } from '../../src/server/routes/agentOps';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.AGENT_RELAY_KEY = 'relay-test-key-123';
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

const relay = async (body: unknown, key = 'relay-test-key-123') => {
  const r = await ctx.app.fetch(
    new Request('http://x/api/agent-relay-ops/status', {
      method: 'POST',
      headers: { 'X-Relay-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx.env,
  );
  return { status: r.status, body: (await r.json()) as { data: any } };
};

describe('Điều hành agent: sơ đồ tổ chức + bộ não phòng ban', () => {
  it('chỉ CEO xem được', async () => {
    expect((await ctx.request('/api/agent-ops', { as: USERS.thao })).status).toBe(403);
    expect((await ctx.request('/api/agent-ops', { as: USERS.ceo })).status).toBe(200);
  });

  it('có sẵn 4 phòng, agent xếp đúng phòng, skill thật ngày 06/11', async () => {
    const r = await ctx.request('/api/agent-ops', { as: USERS.ceo });
    const d = r.body.data;
    expect(d.depts.map((x: any) => x.id)).toEqual(['dh', 'kd', 'mk', 'kt']);
    const dang = d.agents.find((a: any) => a.id === 'ailla-tiktok-shop');
    expect(dang).toMatchObject({ name: 'Đăng', dept: 'kd', parent: 'lead-sale-ailla', chat: true });
    expect(d.agents.find((a: any) => a.id === 'ke-toan-truong-ailla').skills).toHaveLength(13);
    expect(d.status_fresh).toBe(false);
  });

  it('cầu nối sai khoá bị từ chối', async () => {
    expect((await relay({ agents: [] }, 'sai-khoa')).status).toBe(401);
    expect((await relay({}, 'sai-khoa')).status).toBe(401);
    expect((await relay({}, '')).status).toBe(401);
    expect((await relay({}, 'relay-test-key-12X')).status).toBe(401);
  });

  it('máy chủ gửi trạng thái, năng lực, nhật ký → CEO thấy', async () => {
    const at = new Date().toISOString();
    const res = await relay({
      agents: [
        { id: 'media-ailla-agent', state: 'work', task: 'Dựng 2 video', by: 'Lead Content', with: ['lead-content-ailla'], tokens_today: 38000 },
        { id: 'duan-ads-agent', state: 'nổ tung', last_error: 'hết hạn mức' },
        { id: 'Sai Mã!', state: 'work' },
      ],
      profiles: [{ id: 'media-ailla-agent', skills: ['abos-web', 'tao-anh'], knowledge: ['AGENTS.md'], crons: [{ name: 'Dựng video', when: '10:20', steps: ['a', 'b'] }] }],
      logs: [
        { agent: 'lead-content-ailla', at, kind: 'giao', text: 'Giao Media dựng 2 video', to: 'media-ailla-agent' },
        { agent: 'x', at: 'không phải ngày', text: 'bỏ' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.logs).toBe(1);
    const d = (await ctx.request('/api/agent-ops', { as: USERS.ceo })).body.data;
    expect(d.status_fresh).toBe(true);
    const media = d.agents.find((a: any) => a.id === 'media-ailla-agent');
    expect(media.status).toMatchObject({ state: 'work', task: 'Dựng 2 video', with: ['lead-content-ailla'], tokens_today: 38000 });
    expect(media.skills).toEqual(['abos-web', 'tao-anh']);
    expect(media.crons[0]).toMatchObject({ name: 'Dựng video', steps: ['a', 'b'] });
    // trạng thái lạ quy về rảnh
    expect(d.agents.find((a: any) => a.id === 'duan-ads-agent').status.state).toBe('idle');
    expect(d.agents.some((a: any) => a.id === 'Sai Mã!')).toBe(false);
    expect(d.logs).toHaveLength(1);
    expect(d.logs[0]).toMatchObject({ agent: 'lead-content-ailla', kind: 'giao', to_agent: 'media-ailla-agent' });
  });

  it('CEO thêm, sửa, xoá ghi chú phòng; sửa phòng; xếp agent', async () => {
    const add = await ctx.request('/api/agent-ops/note', { as: USERS.ceo, body: { dept: 'mk', kind: 'kn', title: 'Màu da chuẩn video', body: 'L174 a144 b146' } });
    expect(add.status).toBe(200);
    const id = add.body.data.id;
    expect((await ctx.request('/api/agent-ops/note', { as: USERS.ceo, body: { dept: 'mk', kind: 'xyz', title: 'a' } })).status).toBe(400);
    expect((await ctx.request('/api/agent-ops/note', { as: USERS.ceo, body: { dept: 'khong-co', kind: 'kn', title: 'a' } })).status).toBe(404);
    expect((await ctx.request(`/api/agent-ops/note/${id}`, { as: USERS.ceo, method: 'PUT', body: { title: 'Màu da chuẩn' } })).status).toBe(200);
    let d = (await ctx.request('/api/agent-ops', { as: USERS.ceo })).body.data;
    expect(d.notes.find((n: any) => n.id === id).title).toBe('Màu da chuẩn');
    expect((await ctx.request(`/api/agent-ops/note/${id}`, { as: USERS.ceo, method: 'DELETE' })).status).toBe(200);

    expect((await ctx.request('/api/agent-ops/dept/cskh', { as: USERS.ceo, method: 'PUT', body: { name: 'CSKH', icon: '💬', goal: 'Trả lời trong 30 phút' } })).status).toBe(200);
    expect((await ctx.request('/api/agent-ops/member/sale-b2b-ailla', { as: USERS.ceo, method: 'PUT', body: { dept: 'cskh' } })).status).toBe(200);
    d = (await ctx.request('/api/agent-ops', { as: USERS.ceo })).body.data;
    expect(d.notes.some((n: any) => n.id === id)).toBe(false);
    expect(d.depts.find((x: any) => x.id === 'cskh').name).toBe('CSKH');
    expect(d.agents.find((a: any) => a.id === 'sale-b2b-ailla').dept).toBe('cskh');
    // nhân viên không sửa được
    expect((await ctx.request('/api/agent-ops/note', { as: USERS.thao, body: { dept: 'mk', kind: 'kn', title: 'x' } })).status).toBe(403);
  });

  it('chuẩn hoá dữ liệu máy chủ gửi', () => {
    expect(cleanStatus({ id: 'main', state: 'err', task: 'x'.repeat(500) })?.task).toHaveLength(300);
    expect(cleanStatus({ id: '../etc' })).toBeNull();
    expect(cleanCrons([{ name: '' }, { name: 'A', steps: 'không phải mảng' }])).toEqual([{ name: 'A', when: '', next: null, last: null, steps: [] }]);
  });
});

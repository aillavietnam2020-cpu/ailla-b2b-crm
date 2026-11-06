/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { pack, unpack } from '../../src/server/lib/pack';
import { guessSku } from '../../src/server/routes/videoLinks';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Nhập nhanh link video vào ② Điều phối (chị Hoa duyệt 06/11/2026): nút trên web + agent Lead Content theo lệnh nhân sự. */
let ctx: TestContext;
const T0 = '2026-11-06T00:00:00Z';
const CHAT_AGENT = 'lead-content-ailla';
const RELAY = 'relay-test-key-123';
const uid = async (email: string) => (await ctx.db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>())!.id;
const L = (id: string) => `https://drive.google.com/file/d/${id}/view?usp=sharing`;

async function seedHub() {
  const mgr = await uid(USERS.manager);
  const card = (id: string, sku: string, over: Record<string, unknown> = {}) => ({ id, sku, kenh: 'TikTok chính', step: 'cg', mix: 'oneshot', ...over });
  const d = {
    users: [
      { id: 'u_q', crm: mgr, name: 'Nhân sự Content', role: 'content', active: true },
      { id: 'u_lead', crm: 'x-lead', name: 'Lead Content', role: 'lead', active: true },
    ],
    products: [
      { k: 'AR', n: 'Arila' },
      { k: 'BT', n: 'Bột Tẩy Vạn Năng' },
      { k: 'TLA', n: 'Tẩy lồng Ailla' },
      { k: 'TLB', n: 'Tẩy lồng AiBio' },
    ],
    cards: [
      card('TT-0770', 'AR'),
      card('TT-0771', 'AR', { step: 'edit', nguoi: 'u_q' }),
      card('TT-0772', 'AR', { linkVideo: L('1oldOLDold01') , step: 'dvd' }),
      card('TT-0780', 'BT'),
      card('TT-0790', 'AR', { kenh: 'TikTok Via 1' }),
    ],
    kho: [],
    notifs: [],
    activity: [],
  };
  await ctx.db.prepare("INSERT INTO hub_state (id, version, data, updated_at, updated_by) VALUES ('main', 1, ?, ?, ?)").bind(await pack(JSON.stringify(d)), T0, mgr).run();
  await ctx.db.prepare('INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(mgr, 'hub.access', await uid(USERS.ceo), T0).run();
}
const hub = async () => JSON.parse(await unpack((await ctx.db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>())!.data));

beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.AGENT_RELAY_KEY = RELAY;
  await seedUsers(ctx.db);
  await seedHub();
});

describe('Đoán sản phẩm từ tên file', () => {
  const P = [
    { k: 'AR', n: 'Arila' },
    { k: 'BT', n: 'Bột Tẩy Vạn Năng' },
    { k: 'TLA', n: 'Tẩy lồng Ailla' },
    { k: 'TLB', n: 'Tẩy lồng AiBio' },
  ];
  it('khớp tên đủ, 2 chữ đầu, không phân biệt dấu / hoa thường', () => {
    expect(guessSku('ARILA hook 1 - Quynh.mp4', P)).toBe('AR');
    expect(guessSku('bot tay van nang tay lon.mp4', P)).toBe('BT');
    expect(guessSku('Bột tẩy hook 2.mp4', P)).toBe('BT');
    expect(guessSku('tay long aibio final.mp4', P)).toBe('TLB');
  });
  it('mơ hồ hoặc không có tên sản phẩm thì để trống cho người chọn', () => {
    expect(guessSku('tay long hook 3.mp4', P)).toBe('');
    expect(guessSku('video 0611 final.mp4', P)).toBe('');
  });
});

describe('Nhập nhanh link video', () => {
  it('xem trước: chữ của agent / sản phẩm chọn tay, xếp dòng của chính người nộp trước, đúng kênh; link trùng bỏ qua', async () => {
    const r = await ctx.request('/api/hub/video-links', {
      as: USERS.manager,
      body: { kenh: 'TikTok chính', dry: true, items: [{ url: L('1newNEWnew01'), sp: 'Arila' }, { url: L('1newNEWnew02'), sp: 'AR' }, { url: L('1newNEWnew03'), sp: 'arila' }, { url: L('1oldOLDold01') }, { url: L('1newNEWnew04') }] },
    });
    expect(r.status).toBe(200);
    const p = r.body.data.plan;
    expect(p.map((x: any) => [x.to, x.st])).toEqual([
      ['TT-0771', 'ok'],
      ['TT-0770', 'ok'],
      ['', 'full'],
      ['', 'dup'],
      ['', 'nosku'],
    ]);
    expect(r.body.data.saved).toBe(0);
    expect((await hub()).cards[0].step).toBe('cg');
  });

  it('lưu: điền link, sang Chờ duyệt V1, Lead nhận một thông báo gộp', async () => {
    const r = await ctx.request('/api/hub/video-links', {
      as: USERS.manager,
      body: { kenh: 'TikTok chính', items: [{ url: L('1newNEWnew01'), sp: 'AR', to: 'TT-0770' }, { url: L('1newNEWnew05'), sp: 'BT' }] },
    });
    expect(r.body.data.saved).toBe(2);
    const d = await hub();
    const c = (id: string) => d.cards.find((x: any) => x.id === id);
    expect(c('TT-0770')).toMatchObject({ step: 'dvd', linkVideo: L('1newNEWnew01'), nguoiEdit: 'u_q' });
    expect(c('TT-0780')).toMatchObject({ step: 'dvd', linkVideo: L('1newNEWnew05') });
    expect(c('TT-0771').step).toBe('edit');
    expect(d.notifs).toHaveLength(1);
    expect(d.notifs[0]).toMatchObject({ to: 'u_lead' });
    expect(d.notifs[0].text).toContain('gửi duyệt 2 video');
  });

  it('người ngoài team Content không nhập được', async () => {
    const d = await hub();
    d.users[0].role = 'sale';
    await ctx.db.prepare("UPDATE hub_state SET data = ? WHERE id = 'main'").bind(await pack(JSON.stringify(d))).run();
    const r = await ctx.request('/api/hub/video-links', { as: USERS.manager, body: { items: [{ url: L('1newNEWnew01'), sp: 'AR' }] } });
    expect(r.status).toBe(403);
  });

  it('agent Lead Content nhập thay khi chính nhân sự đó nhắn lệnh (giấy ủy quyền)', async () => {
    const made = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name: 'Lead Content', scopes: ['mkt_content'] } });
    const agent = made.body.data as { id: string; token: string };
    const ceo = await uid(USERS.ceo);
    const mgr = await uid(USERS.manager);
    // CEO chọn nhân sự Content làm người ra lệnh ở Quyền agent: agent tự được ghi thay (agent.act)
    const cand = await ctx.request('/api/admin/agents/delegator-candidates', { as: USERS.ceo });
    expect(cand.body.data.find((u: any) => u.id === mgr)).toBeTruthy();
    const put = await ctx.request(`/api/admin/agents/${agent.id}/delegators`, { as: USERS.ceo, method: 'PUT', body: { user_ids: [mgr], chat_agent: CHAT_AGENT } });
    expect(put.status).toBe(200);
    expect(await ctx.db.prepare("SELECT 1 AS x FROM user_permissions WHERE user_id = ? AND permission = 'agent.act'").bind(agent.id).first()).toBeTruthy();
    void ceo;
    await ctx.request('/api/agent-chat', { as: USERS.manager, body: { agent: CHAT_AGENT, body: 'nhập link video hôm nay' } });
    const pr = await ctx.app.fetch(new Request('http://x/api/agent-relay/pull', { method: 'POST', headers: { 'X-Relay-Key': RELAY, 'Content-Type': 'application/json' }, body: '{}' }), ctx.env);
    const dlg = ((await pr.json()) as any).data[0].delegation as string;
    const res = await ctx.app.fetch(
      new Request('http://localhost/api/hub/video-links', {
        method: 'POST',
        headers: { Authorization: `Bearer ${agent.token}`, 'Content-Type': 'application/json', 'X-Delegation': dlg },
        body: JSON.stringify({ items: [{ url: L('1newNEWnew09'), sp: 'Arila' }] }),
      }),
      ctx.env,
      { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const d = await hub();
    expect(d.cards.find((x: any) => x.id === 'TT-0771')).toMatchObject({ step: 'dvd', linkVideo: L('1newNEWnew09') });
    expect(d.notifs[0].text).toMatch(/(qua .*Lead Content)/);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Agent Kế toán trưởng lập phiếu pha chế NHÁP thay người được chỉ định (chị Hoa đồng ý 16/11/2026). */
let ctx: TestContext;
const CHAT_AGENT = 'ke-toan-truong-ailla';
const RELAY = 'relay-test-key-123';
const T0 = '2026-11-16T00:00:00Z';

beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.AGENT_RELAY_KEY = RELAY;
  await seedUsers(ctx.db);
  // Một tài khoản Kế toán được cấp riêng quyền xác nhận kế toán (để danh sách kế toán không rơi về danh sách người duyệt).
  await ctx.db.prepare("INSERT INTO users (id, email, display_name, role, status, created_at, updated_at) VALUES ('user-kt-acc', 'ketoan@ailla.vn', 'Kế toán (test)', 'EMPLOYEE', 'ACTIVE', ?, ?)").bind(T0, T0).run();
  await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind('user-kt-acc', 'order.accounting.confirm', 'user-ceo', T0).run();
  const items: Array<[string, string, string]> = [['BTP1', 'BTP nước giặt', 'BTP'], ['BTP2', 'BTP chưa công thức', 'BTP'], ['SLES', 'SLES', 'NVL'], ['LAS', 'LAS', 'NVL']];
  for (const [c, n, cls] of items) {
    await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, 'kg', ?, '', 0, 1, ?)").bind(c, n, cls, T0).run();
  }
  expect((await ctx.request('/api/hub/phache/ct', { as: USERS.ceo, body: { btp: 'BTP1', lines: [{ item: 'SLES', qty: 0.1 }, { item: 'LAS', qty: 0.02 }], ly_do: 'đầu' } })).status).toBe(200);
});

async function call(token: string, method: string, path: string, body?: unknown, dlg?: string) {
  const res = await ctx.app.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(dlg ? { 'X-Delegation': dlg } : {}) },
      body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body),
    }),
    ctx.env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const uid = async (email: string) => (await ctx.db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>())!.id;

async function setup(writes: string[], keToan = true) {
  const made = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name: 'Kế toán trưởng', scopes: ['orders'] } });
  const agent = made.body.data as { id: string; token: string };
  const ceo = await uid(USERS.ceo);
  const mgr = await uid(USERS.manager);
  await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(agent.id, 'agent.act', ceo, T0).run();
  await ctx.db.prepare('INSERT INTO agent_delegators (agent_id, chat_agent, user_id, granted_by, created_at) VALUES (?, ?, ?, ?, ?)').bind(agent.id, CHAT_AGENT, mgr, ceo, T0).run();
  for (const p of keToan ? ['hub.access', 'order.accounting.confirm'] : ['hub.access']) await ctx.db.prepare('INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(mgr, p, ceo, T0).run();
  await ctx.db.prepare('INSERT INTO agent_chat_access (user_id, agent, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(mgr, CHAT_AGENT, ceo, T0).run();
  if (writes.length) expect((await ctx.request(`/api/admin/agents/${agent.id}/writes`, { method: 'PUT', as: USERS.ceo, body: { writes } } as never)).status).toBe(200);
  await ctx.request('/api/agent-chat', { as: USERS.manager, body: { agent: CHAT_AGENT, body: 'nhập phiếu pha chế' } });
  const r = await ctx.app.fetch(new Request('http://x/api/agent-relay/pull', { method: 'POST', headers: { 'X-Relay-Key': RELAY, 'Content-Type': 'application/json' }, body: '{}' }), ctx.env);
  const dlg = ((await r.json()) as any).data[0].delegation as string;
  return { agent, dlg };
}

const nhap = (over: Record<string, unknown> = {}) => ({ btp: 'BTP1', lit_bon: 100, ngay: '2026-11-16', nguoi: ['Kỹ thuật A'], lines: [{ item: 'SLES', qty: 10 }, { item: 'LAS', qty: 2 }], ...over });

describe('agent lập phiếu pha chế nháp', () => {
  it('có quyền "Lập phiếu pha chế": lập nháp được, giữ luật công thức và lý do lệch; không ghi thẳng phiếu kho', async () => {
    const { agent, dlg } = await setup(['agent.w.phache']);
    expect((await call(agent.token, 'POST', '/api/hub/phache/nhap', nhap())).status).toBe(403); // thiếu giấy ủy quyền
    expect((await call(agent.token, 'POST', '/api/hub/phache/nhap', nhap({ btp: 'BTP2' }), dlg)).body.error.code).toBe('NO_CT');
    expect((await call(agent.token, 'POST', '/api/hub/phache/nhap', nhap({ lines: [{ item: 'SLES', qty: 12 }, { item: 'LAS', qty: 2 }] }), dlg)).body.error.code).toBe('NO_REASON');
    const ok = await call(agent.token, 'POST', '/api/hub/phache/nhap', nhap({ lines: [{ item: 'SLES', qty: 12 }] , ly_do_lech: 'SLES đặc' }), dlg);
    expect(ok.status).toBe(200);
    expect(ok.body.data.lech).toEqual(['SLES', 'LAS']); // LAS thiếu số → ghi 0, cũng lệch
    expect(ok.body.data.warnings.join(' ')).toContain('LAS');
    const row = await ctx.db.prepare('SELECT status, created_by_name, agent_name, lines FROM pc_nhap WHERE id = ?').bind(ok.body.data.id).first<any>();
    expect(row.status).toBe('CHO');
    expect(row.agent_name).toContain('Kế toán trưởng');
    expect(JSON.parse(row.lines)).toEqual([{ item: 'SLES', qty: 12, std_qty: 10 }, { item: 'LAS', qty: 0, std_qty: 2 }]);
    // Không ghi thẳng phiếu pha chế vào kho, không tự xử lý / hủy nháp.
    const pc = await call(agent.token, 'POST', '/api/hub/kho/docs', { type: 'PC', date: '2026-11-16', btp: 'BTP1', liters: 100, lines: [{ item: 'SLES', qty: 10, std_qty: 10 }] }, dlg);
    expect(pc.status).toBe(403);
    expect((await call(agent.token, 'POST', `/api/hub/phache/nhap/${ok.body.data.id}/huy`, { ly_do: 'x' }, dlg)).status).toBe(403);
    expect((await ctx.db.prepare('SELECT COUNT(*) AS n FROM kho_docs').first<{ n: number }>())!.n).toBe(0);
  });

  it('người ra lệnh không phải Kế toán / CEO thì agent không lập được nháp', async () => {
    const { agent, dlg } = await setup(['agent.w.phache'], false);
    expect((await call(agent.token, 'POST', '/api/hub/phache/nhap', nhap(), dlg)).status).toBe(403);
  });

  it('chưa tick "Lập phiếu pha chế" thì không lập được nháp', async () => {
    const { agent, dlg } = await setup(['agent.w.kho']);
    expect((await call(agent.token, 'POST', '/api/hub/phache/nhap', nhap(), dlg)).status).toBe(403);
  });

  it('kỹ thuật ghi phiếu từ nháp thì nháp thành Đã ghi; hủy phải có lý do', async () => {
    const a = await ctx.request('/api/hub/phache/nhap', { as: USERS.ceo, body: nhap() });
    const b = await ctx.request('/api/hub/phache/nhap', { as: USERS.ceo, body: nhap() });
    const doc = await ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'PC', date: '2026-11-16', btp: 'BTP1', liters: 100, lines: [{ item: 'SLES', qty: 10, std_qty: 10 }, { item: 'LAS', qty: 2, std_qty: 2 }] } });
    expect(doc.status).toBe(200);
    expect((await ctx.request(`/api/hub/phache/nhap/${a.body.data.id}/xong`, { as: USERS.ceo, body: { doc_id: doc.body.data.id } })).status).toBe(200);
    expect((await ctx.request(`/api/hub/phache/nhap/${b.body.data.id}/huy`, { as: USERS.ceo, body: {} })).body.error.code).toBe('NO_REASON');
    expect((await ctx.request(`/api/hub/phache/nhap/${b.body.data.id}/huy`, { as: USERS.ceo, body: { ly_do: 'trùng' } })).status).toBe(200);
    const L = (await ctx.request('/api/hub/phache/nhap', { as: USERS.ceo })).body.data.rows as Array<{ id: number; status: string; doc_no: string | null }>;
    expect(L.find((x) => x.id === a.body.data.id)).toMatchObject({ status: 'DA_GHI', doc_no: doc.body.data.no });
    expect(L.find((x) => x.id === b.body.data.id)!.status).toBe('HUY');
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { pack, unpack } from '../../src/server/lib/pack';
import { findDuplicate, normPayee } from '../../src/server/services/agentSpend';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Agent Kế toán trưởng tự lập phiếu chi khi chị Thảo ra lệnh (chị Hoa đồng ý 27/10/2026). */
let ctx: TestContext;
const CHAT_AGENT = 'ke-toan-truong-ailla';
const RELAY = 'relay-test-key-123';
const T0 = '2026-10-27T00:00:00Z';

beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.AGENT_RELAY_KEY = RELAY;
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
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

/** Agent Kế toán trưởng có quyền ghi, người được chỉ định là "chị Thảo" (tài khoản quản lý điều phối), đã bật công tắc phiếu chi. */
async function setup(phieuChi = true) {
  const made = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name: 'Kế toán trưởng', scopes: ['orders', 'debts'] } });
  const agent = made.body.data as { id: string; token: string };
  const ceo = await uid(USERS.ceo);
  const mgr = await uid(USERS.manager);
  await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(agent.id, 'agent.act', ceo, T0).run();
  await ctx.db.prepare('INSERT INTO agent_delegators (agent_id, chat_agent, user_id, granted_by, created_at) VALUES (?, ?, ?, ?, ?)').bind(agent.id, CHAT_AGENT, mgr, ceo, T0).run();
  for (const perm of ['hub.access', 'order.approve.normal']) {
    await ctx.db.prepare('INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(mgr, perm, ceo, T0).run();
  }
  await ctx.db.prepare('INSERT INTO agent_chat_access (user_id, agent, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(mgr, CHAT_AGENT, ceo, T0).run();
  if (phieuChi) {
    expect((await ctx.request(`/api/admin/agents/${agent.id}/phieuchi`, { as: USERS.ceo, body: { enabled: true } })).status).toBe(200);
  }
  await ctx.request('/api/agent-chat', { as: USERS.manager, body: { agent: CHAT_AGENT, body: 'lập phiếu chi cước anh Tâm' } });
  const r = await ctx.app.fetch(new Request('http://x/api/agent-relay/pull', { method: 'POST', headers: { 'X-Relay-Key': RELAY, 'Content-Type': 'application/json' }, body: '{}' }), ctx.env);
  const dlg = ((await r.json()) as any).data[0].delegation as string;
  return { agent, dlg };
}

const vc = (over: Record<string, unknown> = {}) => ({ voucher_date: '2026-10-01', carrier: 'Vũ Thanh Tâm', amount: 750_000, method: 'TIEN_MAT', receiver: 'Vũ Thanh Tâm', note: '3 chuyến 250k', ...over });

describe('So trùng người nhận', () => {
  it('bỏ dấu, hoa thường, khoảng trắng; phải cùng ngày và cùng số tiền', () => {
    expect(normPayee('Vũ Thanh Tâm')).toBe(normPayee('vu  thanh tam'));
    expect(normPayee('Đặng')).toBe('dang');
    const rows = [{ no: 'PCVC2610-001', date: '2026-10-01', amount: 750_000, payees: ['VU THANH TAM', ''] }];
    expect(findDuplicate(rows, { date: '2026-10-01', amount: 750_000, payees: ['Vũ Thanh Tâm'] })?.no).toBe('PCVC2610-001');
    expect(findDuplicate(rows, { date: '2026-10-02', amount: 750_000, payees: ['Vũ Thanh Tâm'] })).toBeNull();
    expect(findDuplicate(rows, { date: '2026-10-01', amount: 250_000, payees: ['Vũ Thanh Tâm'] })).toBeNull();
    expect(findDuplicate(rows, { date: '2026-10-01', amount: 750_000, payees: [''] })).toBeNull();
  });
});

describe('Agent lập phiếu chi vận chuyển theo lệnh chị Thảo', () => {
  it('phiếu nhỏ: có hiệu lực như phiếu người ghi, ghi rõ agent lập theo lệnh ai, lúc nào', async () => {
    const { agent, dlg } = await setup();
    const r = await call(agent.token, 'POST', '/api/shipping-vouchers', vc(), dlg);
    expect(r.status).toBe(200);
    expect(r.body.data.ceo_status).toBe('');
    const row = await ctx.db.prepare('SELECT note, created_by, status FROM shipping_vouchers WHERE id = ?').bind(r.body.data.id).first<any>();
    expect(row.status).toBe('OK');
    expect(row.created_by).toBe(await uid(USERS.manager));
    expect(row.note).toMatch(/^\[Agent Kế toán trưởng lập theo lệnh Quản lý kinh doanh \(test\), lúc \d{2}:\d{2} \d{2}\/\d{2}\/\d{4}\] 3 chuyến 250k$/);
  });

  it('khoản từ ngưỡng (lấy ở Cấu hình, không viết cứng) vào Phê duyệt CEO; agent không tự duyệt được', async () => {
    const { agent, dlg } = await setup();
    await ctx.db.prepare("INSERT INTO app_settings (key, value_json, version, updated_at) VALUES ('spend.ceo_threshold_vnd', '2000000', 1, ?)").bind(T0).run();
    const big = await call(agent.token, 'POST', '/api/shipping-vouchers', vc({ amount: 3_000_000, carrier: 'Xe 29C', receiver: 'Anh Tuấn' }), dlg);
    expect(big.body.data.ceo_status).toBe('CHO');
    const pend = await ctx.request('/api/ceo-spend/pending', { as: USERS.ceo });
    expect(pend.body.data.map((x: any) => x.id)).toEqual([big.body.data.id]);
    expect((await call(agent.token, 'POST', `/api/ceo-spend/ship/${big.body.data.id}/approve`, {}, dlg)).status).toBe(403);
  });

  it('chặn trùng: cùng người nhận, cùng số tiền, cùng ngày thì báo lại, không tạo', async () => {
    const { agent, dlg } = await setup();
    expect((await call(agent.token, 'POST', '/api/shipping-vouchers', vc(), dlg)).status).toBe(200);
    const dup = await call(agent.token, 'POST', '/api/shipping-vouchers', vc({ carrier: 'vu thanh tam', receiver: '' }), dlg);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PHIEU_TRUNG');
    expect(dup.body.error.message).toContain('PCVC2610-001');
    expect((await ctx.db.prepare('SELECT COUNT(*) AS n FROM shipping_vouchers').first<{ n: number }>())!.n).toBe(1);
    // khác ngày thì vẫn lập được; người tự ghi thì không bị chặn như cũ
    expect((await call(agent.token, 'POST', '/api/shipping-vouchers', vc({ voucher_date: '2026-10-02' }), dlg)).status).toBe(200);
    expect((await ctx.request('/api/shipping-vouchers', { as: USERS.manager, body: vc() })).status).toBe(200);
  });

  it('công tắc trong Quyền agent: tắt thì bị từ chối, bật lại thì làm được', async () => {
    const { agent, dlg } = await setup(false);
    const off = await call(agent.token, 'POST', '/api/shipping-vouchers', vc(), dlg);
    expect(off.status).toBe(403);
    expect(off.body.error.code).toBe('AGENT_PHIEU_CHI_OFF');
    const list = await ctx.request('/api/admin/agents', { as: USERS.ceo });
    const row = list.body.data.find((a: any) => a.id === agent.id);
    expect(row.can_phieuchi).toBe(0);
    expect(row.delegators).toBe('Quản lý kinh doanh (test)');
    expect((await ctx.request(`/api/admin/agents/${agent.id}/phieuchi`, { as: USERS.manager, body: { enabled: true } })).status).toBe(403);
    await ctx.request(`/api/admin/agents/${agent.id}/phieuchi`, { as: USERS.ceo, body: { enabled: true } });
    expect((await call(agent.token, 'POST', '/api/shipping-vouchers', vc(), dlg)).status).toBe(200);
  });

  it('agent đã được lập phiếu chi thì không gửi đề xuất "lập phiếu chi" nữa', async () => {
    const { agent } = await setup();
    await ctx.db.prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, 'agent.propose', NULL, ?) ON CONFLICT DO NOTHING").bind(agent.id, T0).run();
    const p = { kind: 'PAYMENT_FOLLOWUP', route_to: 'KE_TOAN', entity_type: 'CUSTOMER', entity_id: 'cus-thao-1', dedupe_key: 'pc-tam-1' };
    const r = await call(agent.token, 'POST', '/api/agent/proposals', { ...p, title: 'Lập phiếu chi cước 750.000đ anh Vũ Thanh Tâm' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('USE_PHIEU_CHI');
    expect((await call(agent.token, 'POST', '/api/agent/proposals', { ...p, dedupe_key: 'nhac-1', title: 'Nhắc khách trả nợ' })).status).toBe(201);
  });
});

describe('Agent lập phiếu chi nhà cung cấp và Chi phí khác', () => {
  it('phiếu chi nhà cung cấp: từ ngưỡng chờ CEO, ghi nguồn, chặn trùng', async () => {
    const { agent, dlg } = await setup();
    const sup = await call(agent.token, 'POST', '/api/hub/kho/mh/suppliers', { name: 'NCC thử' }, dlg);
    const sid = sup.body.data.id;
    const body = { supplier_id: sid, pay_date: '2026-10-20', amount: 6_000_000, kind: 'CHI', general: true, method: 'TIEN_MAT', receiver: 'Anh B', note: 'trả nợ cũ' };
    const r = await call(agent.token, 'POST', '/api/hub/kho/mh/payments', body, dlg);
    expect(r.status).toBe(200);
    expect(r.body.data.ceo_status).toBe('CHO');
    const row = await ctx.db.prepare('SELECT note FROM po_payments WHERE id = ?').bind(r.body.data.id).first<{ note: string }>();
    expect(row!.note).toMatch(/^\[Agent Kế toán trưởng lập theo lệnh .+\] trả nợ cũ$/);
    const dup = await call(agent.token, 'POST', '/api/hub/kho/mh/payments', body, dlg);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PHIEU_TRUNG');
  });

  it('Chi phí khác: vào hàng chờ chị Huệ duyệt (không tự vào sổ), ghi nguồn, chặn trùng cả với sổ', async () => {
    const { agent, dlg } = await setup();
    await ctx.db
      .prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('main', 1, ?, ?)")
      .bind(await pack(JSON.stringify({ pcCho: [], activity: [] })), T0)
      .run();
    await ctx.db
      .prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('secure', 1, ?, ?)")
      .bind(await pack(JSON.stringify({ fin: { nkc: [{ id: 'nk1', d: '2026-10-05', ct: 'PC-2026-10-0001', t: 1_200_000, nn: 'Điện lực Hà Nội' }] } })), T0)
      .run();
    const body = { pay_date: '2026-10-21', amount: 6_500_000, content: 'Thuê kho tháng 10', payee: 'Cty Kho Xanh', method: 'CHUYEN_KHOAN', from_account: 'MB 0929', to_account: 'VCB 123' };
    const r = await call(agent.token, 'POST', '/api/hub/so-chi/phieu-chi', body, dlg);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ ct: 'PC-2026-10-0002', st: 'Chờ duyệt' });
    const st = await ctx.db.prepare("SELECT version, data FROM hub_state WHERE id = 'main'").first<{ version: number; data: string }>();
    const d = JSON.parse(await unpack(st!.data));
    expect(st!.version).toBe(2);
    expect(d.pcCho).toHaveLength(1);
    expect(d.pcCho[0]).toMatchObject({ st: 'Chờ duyệt', t: 6_500_000, nn: 'Cty Kho Xanh', ht: 'Chuyển khoản', tk: '1121', agent: 'Kế toán trưởng', theoLenh: 'Quản lý kinh doanh (test)' });
    expect(d.pcCho[0].ceoCho).toBeUndefined();
    expect(d.pcCho[0].gc).toMatch(/^\[Agent Kế toán trưởng lập theo lệnh/);
    expect(d.activity[0].msg).toBe('ghi phiếu chi chờ duyệt PC-2026-10-0002');
    // trùng với phiếu đang chờ, và trùng với dòng đã vào sổ
    expect((await call(agent.token, 'POST', '/api/hub/so-chi/phieu-chi', body, dlg)).body.error.code).toBe('PHIEU_TRUNG');
    const old = await call(agent.token, 'POST', '/api/hub/so-chi/phieu-chi', { ...body, pay_date: '2026-10-05', amount: 1_200_000, payee: 'dien luc ha noi', content: 'Tiền điện' }, dlg);
    expect(old.status).toBe(409);
    expect(old.body.error.message).toContain('PC-2026-10-0001');
  });
});

describe('Chị Hoa chọn thêm người ra lệnh cho agent (chị Huệ như chị Thảo)', () => {
  it('người kế toán được thêm: được nhắn agent, tin của người đó kèm giấy ủy quyền và lập được phiếu', async () => {
    const { agent } = await setup();
    const ceo = await uid(USERS.ceo);
    const hue = await uid(USERS.thao); // tài khoản thử đóng vai kế toán
    await ctx.db.prepare('INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(hue, 'order.accounting.confirm', ceo, T0).run();
    const cand = await ctx.request('/api/admin/agents/delegator-candidates', { as: USERS.ceo });
    expect(cand.body.data.map((u: any) => u.id)).toContain(hue);
    const mgr = await uid(USERS.manager);
    const put = await ctx.request(`/api/admin/agents/${agent.id}/delegators`, { as: USERS.ceo, method: 'PUT', body: { user_ids: [mgr, hue] } });
    expect(put.status).toBe(200);
    const list = await ctx.request('/api/admin/agents', { as: USERS.ceo });
    expect(list.body.data.find((a: any) => a.id === agent.id).delegator_ids.sort()).toEqual([mgr, hue].sort());
    expect(await ctx.db.prepare('SELECT 1 FROM agent_chat_access WHERE user_id = ? AND agent = ?').bind(hue, CHAT_AGENT).first()).toBeTruthy();
    await ctx.request('/api/agent-chat', { as: USERS.thao, body: { agent: CHAT_AGENT, body: 'lập phiếu chi cước' } });
    const r = await ctx.app.fetch(new Request('http://x/api/agent-relay/pull', { method: 'POST', headers: { 'X-Relay-Key': RELAY, 'Content-Type': 'application/json' }, body: '{}' }), ctx.env);
    const dlg = ((await r.json()) as any).data.find((m: any) => m.delegation)?.delegation as string;
    expect(dlg).toBeTruthy();
    const v = await call(agent.token, 'POST', '/api/shipping-vouchers', vc({ carrier: 'Lái xe B', receiver: 'Lái xe B' }), dlg);
    expect(v.status).toBe(200);
  });

  it('không chọn được người không làm kế toán; bỏ chọn thì mất quyền; chỉ CEO được đổi', async () => {
    const { agent } = await setup();
    const huyen = await uid(USERS.huyen);
    expect((await ctx.request(`/api/admin/agents/${agent.id}/delegators`, { as: USERS.ceo, method: 'PUT', body: { user_ids: [huyen] } })).status).toBe(422);
    expect((await ctx.request(`/api/admin/agents/${agent.id}/delegators`, { as: USERS.manager, method: 'PUT', body: { user_ids: [] } })).status).toBe(403);
    expect((await ctx.request(`/api/admin/agents/${agent.id}/delegators`, { as: USERS.ceo, method: 'PUT', body: { user_ids: [] } })).status).toBe(200);
    expect(await ctx.db.prepare('SELECT 1 FROM agent_delegators WHERE agent_id = ?').bind(agent.id).first()).toBeNull();
  });
});

it('agent chưa có ai ra lệnh: vẫn chọn được người (ghép agent theo tên)', async () => {
  const made = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name: 'Kế toán trưởng' } });
  const id = made.body.data.id as string;
  const list = await ctx.request('/api/admin/agents', { as: USERS.ceo });
  expect(list.body.data.find((a: any) => a.id === id).chat_agent).toBe(CHAT_AGENT);
  const ceo = await uid(USERS.ceo);
  const hue = await uid(USERS.thao);
  await ctx.db.prepare('INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(hue, 'order.accounting.confirm', ceo, T0).run();
  const put = await ctx.request(`/api/admin/agents/${id}/delegators`, { as: USERS.ceo, method: 'PUT', body: { user_ids: [hue] } });
  expect(put.status).toBe(200);
  expect(put.body.data.chat_agent).toBe(CHAT_AGENT);
});

import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
  await ctx.db.prepare("INSERT INTO kho_cfg (k, v) VALUES ('flow_on', '1')").run();
});

async function agentCall(token: string, path: string, method = 'GET', body?: unknown) {
  const res = await ctx.app.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }),
    ctx.env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function createAgent(name = 'Agent kho thử') {
  const res = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name, purpose: 'Hỗ trợ kho', scopes: ['orders', 'debts', 'kho'] } });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; token: string };
}

async function placeOrder(qty = 5) {
  const created = await ctx.request('/api/orders', {
    as: USERS.thao,
    body: { customer_id: 'cus-thao-1', order_date: '2026-08-16', items: [{ product_id: 'prod-full', qty }] },
  });
  const id = created.body.data.id as string;
  await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
  return id;
}

describe('Nền cho AI agent', () => {
  it('chỉ CEO tạo agent; khóa chỉ hiện một lần; agent vào được /api/agent nhưng không vào API của người', async () => {
    const denied = await ctx.request('/api/admin/agents', { as: USERS.manager, body: { name: 'X agent' } });
    expect(denied.status).toBe(403);

    const agent = await createAgent();
    expect(agent.token.startsWith('agt_')).toBe(true);

    const list = await ctx.request('/api/admin/agents', { as: USERS.ceo });
    expect(list.body.data).toHaveLength(1);
    expect(JSON.stringify(list.body.data)).not.toContain(agent.token);

    const me = await agentCall(agent.token, '/api/agent/me');
    expect(me.status).toBe(200);
    expect(me.body.data.permissions.filter((p: string) => !p.startsWith('agent.scope.')).sort()).toEqual(['agent.propose', 'agent.read']);
    expect(me.body.data.policy['order.approve']).toBe('PROPOSE');

    // Agent không dùng được API của người, dù có khóa hợp lệ.
    const human = await agentCall(agent.token, '/api/orders');
    expect(human.status).toBe(403);
    const approve = await agentCall(agent.token, '/api/approvals?status=PENDING');
    expect(approve.status).toBe(403);

    // Khóa sai.
    const bad = await agentCall('agt_000000', '/api/agent/me');
    expect(bad.status).toBe(401);

    // Người thường không có quyền agent.read.
    const sale = await ctx.request('/api/agent/orders', { as: USERS.thao });
    expect(sale.status).toBe(403);
  });

  it('agent không hiện trong danh sách người dùng', async () => {
    await createAgent();
    const users = await ctx.request('/api/admin/users', { as: USERS.ceo });
    expect(JSON.stringify(users.body.data)).not.toContain('agents.ailla.local');
    const staff = await ctx.request('/api/users', { as: USERS.manager });
    expect(JSON.stringify(staff.body.data)).not.toContain('Agent');
  });

  it('đổi khóa thì khóa cũ hết hiệu lực; khóa agent thì không vào được', async () => {
    const agent = await createAgent();
    const rotated = await ctx.request(`/api/admin/agents/${agent.id}/rotate`, { as: USERS.ceo, body: {} });
    expect(rotated.status).toBe(200);
    expect((await agentCall(agent.token, '/api/agent/me')).status).toBe(401);
    const fresh = rotated.body.data.token as string;
    expect((await agentCall(fresh, '/api/agent/me')).status).toBe(200);

    await ctx.request(`/api/admin/agents/${agent.id}/status`, { as: USERS.ceo, body: { enabled: false } });
    expect((await agentCall(fresh, '/api/agent/me')).status).toBe(401);
  });

  it('sự kiện: mỗi bước của đơn ghi một sự kiện có ID đối tượng và loại tác nhân; agent đọc theo con trỏ', async () => {
    const agent = await createAgent();
    const id = await placeOrder();

    const feed = await agentCall(agent.token, '/api/agent/events?limit=100');
    expect(feed.status).toBe(200);
    const types = feed.body.data.map((e: { type: string }) => e.type);
    expect(types).toContain('ORDER_CREATED');
    expect(types).toContain('ORDER_SUBMITTED');
    expect(types).toContain('ORDER_STEP_CHANGED');
    const step = feed.body.data.find((e: { type: string }) => e.type === 'ORDER_STEP_CHANGED');
    expect(step.entity_id).toBe(id);
    expect(step.actor_type).toBe('USER');
    expect(step.payload.to).toBe('CHO_DIEU_PHOI');
    expect(step.payload.waiting_for).toBe('DIEU_PHOI');

    // Con trỏ: chưa có gì mới thì trả rỗng.
    const cursor = feed.body.meta.next_cursor as number;
    const more = await agentCall(agent.token, `/api/agent/events?after=${cursor}`);
    expect(more.body.data).toHaveLength(0);

    // Một thay đổi mới sinh sự kiện mới.
    await ctx.request(`/api/orders/${id}/flow/to-kho`, { as: USERS.manager, body: {} });
    const later = await agentCall(agent.token, `/api/agent/events?after=${cursor}`);
    expect(later.body.data.length).toBeGreaterThan(0);
    expect(later.body.data[0].payload.to).toBe('CHO_KIEM_KHO');
  });

  it('agent đọc đơn theo ID, kèm người đang chờ và tuổi của bước', async () => {
    const agent = await createAgent();
    const id = await placeOrder();
    const list = await agentCall(agent.token, '/api/agent/orders?flow=1');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(id);
    expect(list.body.data[0].waiting_for).toBe('DIEU_PHOI');
    expect(list.body.data[0].step_age_hours).toBeGreaterThanOrEqual(0);

    const detail = await agentCall(agent.token, `/api/agent/orders/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.order.id).toBe(id);
    expect(detail.body.data.order.items).toHaveLength(1);

    const cust = await agentCall(agent.token, '/api/agent/customers/cus-thao-1');
    expect(cust.status).toBe(200);
    expect(cust.body.data.orders.length).toBe(1);
  });

  it('đề xuất: chống trùng, kiểm ID, chỉ đúng người xem xét thấy và quyết định', async () => {
    const agent = await createAgent();
    const id = await placeOrder();
    const body = {
      kind: 'REMINDER',
      route_to: 'DIEU_PHOI',
      entity_type: 'ORDER',
      entity_id: id,
      title: 'Đơn chờ điều phối quá lâu',
      body: 'Đã 26 giờ chưa chuyển kho',
      dedupe_key: `stuck:${id}:2026-08-16`,
    };
    const first = await agentCall(agent.token, '/api/agent/proposals', 'POST', body);
    expect(first.status).toBe(201);
    const again = await agentCall(agent.token, '/api/agent/proposals', 'POST', body);
    expect(again.status).toBe(200);
    expect(again.body.data.duplicate).toBe(true);
    expect(again.body.data.id).toBe(first.body.data.id);

    // ID không tồn tại, loại không hợp lệ.
    const noEntity = await agentCall(agent.token, '/api/agent/proposals', 'POST', {
      ...body,
      entity_id: 'khong-co',
      dedupe_key: 'x1',
    });
    expect(noEntity.status).toBe(404);
    const badKind = await agentCall(agent.token, '/api/agent/proposals', 'POST', { ...body, kind: 'XOA_DON', dedupe_key: 'x2' });
    expect(badKind.status).toBe(422);

    // Sale không phải người xem xét đề xuất gửi cho điều phối.
    const saleView = await ctx.request('/api/proposals', { as: USERS.thao });
    expect(saleView.body.data).toHaveLength(0);
    const mgrView = await ctx.request('/api/proposals', { as: USERS.manager });
    expect(mgrView.body.data).toHaveLength(1);
    expect(mgrView.body.data[0].entity_label).toBeTruthy();

    const saleDecide = await ctx.request(`/api/proposals/${first.body.data.id}/decide`, {
      as: USERS.thao,
      body: { decision: 'ACCEPTED' },
    });
    expect(saleDecide.status).toBe(403);
    const ok = await ctx.request(`/api/proposals/${first.body.data.id}/decide`, {
      as: USERS.manager,
      body: { decision: 'ACCEPTED', note: 'Đã nhắc kho' },
    });
    expect(ok.status).toBe(200);
    const twice = await ctx.request(`/api/proposals/${first.body.data.id}/decide`, {
      as: USERS.manager,
      body: { decision: 'REJECTED' },
    });
    expect(twice.status).toBe(400);

    // Nhật ký phân biệt agent đề xuất và người duyệt.
    const audit = await ctx.db
      .prepare("SELECT action, actor_type, source, approved_by FROM audit_logs WHERE action IN ('PROPOSAL_CREATED','PROPOSAL_ACCEPTED') ORDER BY created_at")
      .all<{ action: string; actor_type: string; source: string | null; approved_by: string | null }>();
    const created = audit.results.find((a) => a.action === 'PROPOSAL_CREATED');
    const accepted = audit.results.find((a) => a.action === 'PROPOSAL_ACCEPTED');
    expect(created?.actor_type).toBe('AGENT');
    expect(accepted?.actor_type).toBe('USER');
    expect(accepted?.approved_by).toBe('user-manager');
    expect(accepted?.source).toContain('proposal:');
  });

  it('agent chỉ đọc: không có đường nào để đổi trạng thái đơn', async () => {
    const agent = await createAgent();
    const id = await placeOrder();
    for (const path of [`/api/orders/${id}/flow/to-kho`, `/api/orders/${id}/cancel`, `/api/orders/${id}/accounting`]) {
      const res = await agentCall(agent.token, path, 'POST', { reason: 'thử', accounting_status: 'DA_XAC_NHAN' });
      expect(res.status).toBe(403);
    }
    const o = await ctx.request(`/api/orders/${id}`, { as: USERS.ceo });
    expect(o.body.data.kho_status).toBe('CHO_DIEU_PHOI');
  });
});

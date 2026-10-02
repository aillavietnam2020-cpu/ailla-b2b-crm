import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

const marketing = (id: string, mode: string) =>
  ctx.request(`/api/admin/users/${id}/marketing`, { as: USERS.ceo, body: { mode } });

describe('Khu Marketing (/api/hub)', () => {
  it('chưa được cấp quyền Marketing thì không đọc được dữ liệu', async () => {
    const res = await ctx.request('/api/hub/state', { as: USERS.thao });
    expect(res.status).toBe(403);
  });

  it('CEO khởi tạo, nhân viên được cấp quyền đọc và ghi theo số phiên bản', async () => {
    const empty = await ctx.request('/api/hub/state', { as: USERS.ceo });
    expect(empty.body.data).toEqual({ version: 0, data: null, updated_at: null });

    await marketing('user-thao', 'with_b2b');
    // Nhân viên không được tạo kho đầu tiên.
    const staffInit = await ctx.request('/api/hub/state', {
      as: USERS.thao,
      method: 'PUT',
      body: { version: 0, data: { cards: [] } },
    });
    expect(staffInit.status).toBe(403);

    const init = await ctx.request('/api/hub/state', {
      as: USERS.ceo,
      method: 'PUT',
      body: { version: 0, data: { cards: [{ id: 'C1', ten: 'Tinh dầu giặt sấy' }] } },
    });
    expect(init.body.data.version).toBe(1);

    const read = await ctx.request('/api/hub/state', { as: USERS.thao });
    expect(read.body.data.version).toBe(1);
    expect(read.body.data.data.cards[0].ten).toBe('Tinh dầu giặt sấy');

    const save = await ctx.request('/api/hub/state', {
      as: USERS.thao,
      method: 'PUT',
      body: { version: 1, data: { cards: [] } },
    });
    expect(save.body.data.version).toBe(2);

    // Cầm số phiên bản cũ thì bị từ chối, không ghi đè việc người khác vừa làm.
    const stale = await ctx.request('/api/hub/state', {
      as: USERS.ceo,
      method: 'PUT',
      body: { version: 1, data: { cards: [{ id: 'X' }] } },
    });
    expect(stale.status).toBe(409);
    const ver = await ctx.request('/api/hub/state/version', { as: USERS.ceo });
    expect(ver.body.data.version).toBe(2);
  });

  it('tài khoản "chỉ Marketing" bị chặn khỏi dữ liệu B2B', async () => {
    await marketing('user-huyen', 'only');
    const me = await ctx.request('/api/me', { as: USERS.huyen });
    expect(me.body.data.permissions).toEqual(['hub.access']);
    expect((await ctx.request('/api/customers', { as: USERS.huyen })).status).toBe(403);
    expect((await ctx.request('/api/hub/state', { as: USERS.huyen })).status).toBe(200);

    await marketing('user-huyen', 'off');
    expect((await ctx.request('/api/hub/state', { as: USERS.huyen })).status).toBe(403);
    expect((await ctx.request('/api/customers', { as: USERS.huyen })).status).toBe(200);
  });

  it('dữ liệu báo cáo nạp sẵn chỉ CEO xem được khi đánh dấu riêng tư', async () => {
    await marketing('user-thao', 'with_b2b');
    const put = await ctx.request('/api/hub/blob/kd', {
      as: USERS.ceo,
      method: 'PUT',
      body: { data: { tts: [1, 2, 3] } },
    });
    expect(put.status).toBe(200);
    expect((await ctx.request('/api/hub/blob/kd', { as: USERS.ceo })).body.data).toEqual({ tts: [1, 2, 3] });
    expect((await ctx.request('/api/hub/blob/kd', { as: USERS.thao })).status).toBe(403);
    expect((await ctx.request('/api/hub/blob/khac', { as: USERS.ceo })).status).toBe(404);
  });

  it('trợ lý AI báo rõ khi máy chủ chưa nối 9router', async () => {
    const res = await ctx.request('/api/hub/ai', { as: USERS.ceo, body: { user: 'Chào' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
  });
});

describe('Số tài chính trong khu Marketing', () => {
  it('giá vốn, chi phí, mục tiêu doanh số chỉ CEO và kế toán thấy; nhân viên gửi lên cũng bị bỏ qua', async () => {
    await ctx.request('/api/admin/users/user-thao/marketing', { as: USERS.ceo, body: { mode: 'with_b2b' } });
    await ctx.request('/api/hub/state', {
      as: USERS.ceo,
      method: 'PUT',
      body: { version: 0, data: { cards: [], skus: [{ ma: 'A', giaVon: 1000 }], costs: [{ tien: 5 }] } },
    });
    const staff = await ctx.request('/api/hub/state', { as: USERS.thao });
    expect(staff.body.data.data.cards).toEqual([]);
    expect(staff.body.data.data.skus).toBeUndefined();
    expect(staff.body.data.data.costs).toBeUndefined();

    // Nhân viên ghi đè bằng bản không có (hoặc có giả) số tài chính: số thật của CEO vẫn còn.
    await ctx.request('/api/hub/state', {
      as: USERS.thao,
      method: 'PUT',
      body: { version: 1, data: { cards: [{ id: 'C1' }], skus: [] } },
    });
    const ceo = await ctx.request('/api/hub/state', { as: USERS.ceo });
    expect(ceo.body.data.data.cards).toEqual([{ id: 'C1' }]);
    expect(ceo.body.data.data.skus).toEqual([{ ma: 'A', giaVon: 1000 }]);
  });
});

describe('Kho Sản xuất trừ tồn theo đơn B2B', () => {
  it('chỉ đơn đã duyệt và đã xuất kho / đã giao, từ ngày bắt đầu trừ, mới tính', async () => {
    const T = '2026-10-02T03:00:00.000Z';
    const order = (id: string, delivery: string, approval: string, deliveredAt: string | null) =>
      ctx.db
        .prepare(
          `INSERT INTO orders (id, order_no, customer_id, order_date, approval_status, delivery_status, delivered_at, created_at, updated_at)
           VALUES (?, ?, (SELECT id FROM customers LIMIT 1), '2026-10-02', ?, ?, ?, ?, ?)`,
        )
        .bind(id, 'DH-' + id, approval, delivery, deliveredAt, T, T)
        .run();
    const line = (id: string, order: string, qty: number) =>
      ctx.db
        .prepare(
          `INSERT INTO order_items (id, order_id, product_id, qty, applied_price, line_total, created_at)
           VALUES (?, ?, 'prod-full', ?, 1000, ?, ?)`,
        )
        .bind(id, order, qty, qty * 1000, T)
        .run();
    await order('o1', 'DA_XUAT_KHO', 'APPROVED', T);
    await line('l1', 'o1', 3);
    await order('o2', 'CHUA_XUAT', 'APPROVED', null);
    await line('l2', 'o2', 5);
    await order('o3', 'DA_GIAO', 'APPROVED', '2026-09-01T03:00:00.000Z');
    await line('l3', 'o3', 7);

    const res = await ctx.request('/api/hub/b2b-out?from=2026-10-01', { as: USERS.ceo });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ sku: 'TEST-FULL', qty: 3, delivery_status: 'DA_XUAT_KHO' });
    expect(res.body.data[0].applied_price).toBeUndefined();
  });
});

describe('Hàng việc gửi Worker dựng video', () => {
  it('trang quản trị tạo việc, Worker lấy bằng khoá riêng và gửi kết quả lên', async () => {
    ctx.env.WORKER_KEY = 'khoa-thu-worker-1234567890';
    const create = await ctx.request('/api/hub/worker-tasks', {
      as: USERS.ceo,
      body: { kind: 'win_analyze', ref: 'VW-1', payload: { link: 'https://www.tiktok.com/@a/video/1', sku: 'tinh-dau-giat-say', variants: 5 } },
    });
    expect(create.status).toBe(200);
    const id = create.body.data.id;

    // Không có khoá hoặc sai khoá: bị chặn.
    expect((await ctx.request('/api/worker/pull', { body: {} })).status).toBe(401);

    const pull = async () => {
      const res = await ctx.app.fetch(
        new Request('http://localhost/api/worker/pull', { method: 'POST', headers: { 'X-Worker-Key': 'khoa-thu-worker-1234567890' } }),
        ctx.env,
        { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
      );
      return { status: res.status, body: (await res.json()) as { data: Array<{ id: string; payload: { sku: string } }> } };
    };
    const first = await pull();
    expect(first.status).toBe(200);
    expect(first.body.data.map((t) => t.id)).toEqual([id]);
    expect(first.body.data[0].payload.sku).toBe('tinh-dau-giat-say');
    expect((await pull()).body.data).toEqual([]); // đã nhận thì không trả lại lần nữa

    const push = await ctx.app.fetch(
      new Request('http://localhost/api/worker/push', {
        method: 'POST',
        headers: { 'X-Worker-Key': 'khoa-thu-worker-1234567890', 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'review', worker_job: 'WIN-002', result: { variants: [{ id: 'V1' }] } }),
      }),
      ctx.env,
      { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
    );
    expect(push.status).toBe(200);
    const list = await ctx.request('/api/hub/worker-tasks', { as: USERS.ceo });
    expect(list.body.data[0]).toMatchObject({ id, status: 'review', worker_job: 'WIN-002', result: { variants: [{ id: 'V1' }] } });
  });
});

describe('Cửa qt.ailla.vn tự cập nhật theo tài khoản', () => {
  it('thêm tài khoản thì gửi đủ email đang hoạt động; khoá thì rút ra; chưa cấu hình thì bỏ qua', async () => {
    const off = await ctx.request('/api/admin/users/access-sync', { as: USERS.ceo });
    expect(off.body.data.configured).toBe(false);

    Object.assign(ctx.env, { CF_ACCOUNT_ID: 'acc', ACCESS_APP_ID: 'app', ACCESS_POLICY_ID: 'pol', CF_ACCESS_TOKEN: 'tok' });
    const calls: { url: string; emails: string[] }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ url, emails: body.include.map((x: { email: { email: string } }) => x.email.email) });
      return new Response('{"success":true}', { status: 200 });
    }) as typeof fetch;
    try {
      const created = await ctx.request('/api/admin/users', {
        as: USERS.ceo,
        body: { email: 'Moi@Ailla.vn', display_name: 'Nhân sự mới', role: 'EMPLOYEE', password: 'abc12345' },
      });
      expect(created.status).toBe(201);
      expect(created.body.data.access.ok).toBe(true);
      expect(calls[0].url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/access/apps/app/policies/pol');
      expect(calls[0].emails).toContain('moi@ailla.vn');
      expect(calls[0].emails).toContain(USERS.ceo.toLowerCase());

      const lock = await ctx.request(`/api/admin/users/${created.body.data.id}`, {
        as: USERS.ceo,
        method: 'PATCH',
        body: { status: 'DISABLED' },
      });
      expect(lock.body.data.access.ok).toBe(true);
      expect(calls[1].emails).not.toContain('moi@ailla.vn');

      // Nhân viên không tự đồng bộ được.
      const staff = await ctx.request('/api/admin/users/access-sync', { as: USERS.thao, method: 'POST' });
      expect(staff.status).toBe(403);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

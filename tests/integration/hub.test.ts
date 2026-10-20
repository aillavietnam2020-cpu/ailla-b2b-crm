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

describe('Bảo vệ bản dữ liệu chung và hồ sơ nhân sự', () => {
  const ceoState = (extra: Record<string, unknown> = {}) => ({
    users: [
      { id: 'u_chi', name: 'Chị Hoa', role: 'admin', crm: 'user-ceo', phongBan: '', perms: [], active: true },
      { id: 'u_thao', name: 'Thảo', role: 'nhanvien', crm: 'user-thao', phongBan: 'KD', perms: [], active: true },
      { id: 'u_hr', name: 'Nhân sự', role: 'nhanvien', crm: 'user-huyen', phongBan: 'HCNS', perms: [], active: true },
    ],
    cards: [],
    hr: { loaded: true, ns: { NV1: { ten: 'Nguyễn Văn A', luong: 12000000 } } },
    ...extra,
  });

  async function init() {
    await ctx.request('/api/admin/users/user-thao/marketing', { as: USERS.ceo, body: { mode: 'only' } });
    await ctx.request('/api/admin/users/user-huyen/marketing', { as: USERS.ceo, body: { mode: 'only' } });
    const put = await ctx.request('/api/hub/state', {
      as: USERS.ceo,
      method: 'PUT',
      body: { version: 0, data: ceoState() },
    });
    expect(put.status).toBe(200);
  }

  it('nhân viên tự sửa mình thành "HCNS" / có quyền lương vẫn không xem được nhân sự', async () => {
    await init();
    const before = await ctx.request('/api/hub/state', { as: USERS.thao });
    expect(before.body.data.hr_ok).toBe(false);
    expect(before.body.data.data.hr.ns).toBeUndefined();

    const forged = ceoState();
    forged.users[1] = { ...forged.users[1], phongBan: 'HCNS', perms: ['luong.quanly', 'nhansu.quanly'], role: 'admin' } as never;
    const res = await ctx.request('/api/hub/state', {
      as: USERS.thao,
      method: 'PUT',
      body: { version: before.body.data.version, data: forged },
    });
    expect(res.status).toBe(200);

    const after = await ctx.request('/api/hub/state', { as: USERS.thao });
    expect(after.body.data.hr_ok).toBe(false);
    expect(after.body.data.data.hr.ns).toBeUndefined();
    const me = after.body.data.data.users.find((u: { id: string }) => u.id === 'u_thao');
    expect(me.phongBan).toBe('KD');
    expect(me.role).toBe('nhanvien');
    expect(me.perms).toEqual([]);
    // Cửa tệp đính kèm hồ sơ cũng đóng.
    expect((await ctx.request('/api/hub/hr/files', { as: USERS.thao })).status).toBe(403);
  });

  it('người làm nhân sự do CEO duyệt xem được; CEO đổi danh sách thì có hiệu lực', async () => {
    await init();
    const hr = await ctx.request('/api/hub/state', { as: USERS.huyen });
    expect(hr.body.data.hr_ok).toBe(true);
    expect(hr.body.data.data.hr.ns.NV1.luong).toBe(12000000);

    // CEO gỡ phòng HCNS của người này: mất quyền ngay.
    const s = await ctx.request('/api/hub/state', { as: USERS.ceo });
    const next = ceoState();
    next.users[2] = { ...next.users[2], phongBan: 'KD' } as never;
    await ctx.request('/api/hub/state', { as: USERS.ceo, method: 'PUT', body: { version: s.body.data.version, data: next } });
    const gone = await ctx.request('/api/hub/state', { as: USERS.huyen });
    expect(gone.body.data.hr_ok).toBe(false);
  });

  it('nhân viên không thêm được tài khoản, không đổi tên người khác', async () => {
    await init();
    const s = await ctx.request('/api/hub/state', { as: USERS.thao });
    const forged = ceoState();
    forged.users.push({ id: 'u_x', name: 'Giả', role: 'admin', crm: 'user-thao', phongBan: 'HCNS', perms: ['luong.quanly'], active: true } as never);
    forged.users[0] = { ...forged.users[0], name: 'Tên bị đổi' } as never;
    await ctx.request('/api/hub/state', { as: USERS.thao, method: 'PUT', body: { version: s.body.data.version, data: forged } });
    const after = await ctx.request('/api/hub/state', { as: USERS.thao });
    const users = after.body.data.data.users as Array<{ id: string; name: string }>;
    expect(users.some((u) => u.id === 'u_x')).toBe(false);
    expect(users.find((u) => u.id === 'u_chi')?.name).toBe('Chị Hoa');
  });

  it('mở thẻ HTML trong dữ liệu bị đổi thành ký tự vô hại', async () => {
    await init();
    const s = await ctx.request('/api/hub/state', { as: USERS.thao });
    const evil = ceoState({ cards: [{ id: 'C1', ten: '<img src=x onerror=alert(1)> và </script> a < b' }] });
    await ctx.request('/api/hub/state', { as: USERS.thao, method: 'PUT', body: { version: s.body.data.version, data: evil } });
    const after = await ctx.request('/api/hub/state', { as: USERS.thao });
    const ten = after.body.data.data.cards[0].ten as string;
    expect(ten).not.toMatch(/<img|<\/script/i);
    expect(ten).toContain('a < b');
  });

  it('tài khoản đang bị bắt đổi mật khẩu thì máy chủ chặn mọi dữ liệu', async () => {
    await ctx.request('/api/admin/users/user-thao/marketing', { as: USERS.ceo, body: { mode: 'only' } });
    await ctx.db
      .prepare("UPDATE users SET must_change_password = 1 WHERE id = 'user-thao'")
      .run();
    expect((await ctx.request('/api/hub/state', { as: USERS.thao })).status).toBe(403);
    expect((await ctx.request('/api/me', { as: USERS.thao })).status).toBe(200);
  });
});

describe('Tệp đính kèm hồ sơ nhân sự', () => {
  it('tệp HTML bị ép tải về, không mở ngay trong trình duyệt; ảnh thì mở được', async () => {
    const up = async (name: string, type: string, body: string) => {
      const form = new FormData();
      form.append('file', new File([body], name, { type }));
      form.append('ma', 'NV1');
      form.append('kind', 'khac');
      const res = await ctx.app.fetch(
        new Request('http://localhost/api/hub/hr/files', { method: 'POST', body: form, headers: { 'X-Dev-Email': USERS.ceo } }),
        ctx.env,
      );
      return (await res.json()) as { data: { id: string } };
    };
    const html = await up('doc.html', 'text/html', '<script>alert(1)</script>');
    const img = await up('a.png', 'image/png', 'PNG');
    const getFile = async (id: string) =>
      ctx.app.fetch(new Request('http://localhost/api/hub/hr/files/' + id, { headers: { 'X-Dev-Email': USERS.ceo } }), ctx.env);
    const r1 = await getFile(html.data.id);
    expect(r1.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(r1.headers.get('Content-Disposition')).toMatch(/^attachment/);
    const r2 = await getFile(img.data.id);
    expect(r2.headers.get('Content-Type')).toBe('image/png');
    expect(r2.headers.get('Content-Disposition')).toMatch(/^inline/);
  });
});

describe('Tách trang vận hành và trang quản trị', () => {
  const ADMIN = 'quantri.test';
  const call = async (host: string, path: string, email: string, init: { method?: string; body?: unknown } = {}) => {
    const env = { ...ctx.env, ADMIN_HOST: ADMIN, OPS_HOST: 'qt.test' };
    const res = await ctx.app.fetch(
      new Request(`http://${host}${path}`, {
        method: init.method ?? 'GET',
        headers: { 'X-Dev-Email': email, 'Content-Type': 'application/json' },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
      env,
    );
    return res;
  };

  beforeEach(async () => {
    // Cấp quyền trước khi bật cơ chế tách (lúc đó chưa chặn theo địa chỉ).
    await ctx.request('/api/admin/users/user-thao/marketing', { as: USERS.ceo, body: { mode: 'with_b2b' } });
    await ctx.request('/api/admin/users/user-huyen/accountant', { as: USERS.ceo, body: { enabled: true } });
    await ctx.request('/api/admin/users/user-huyen/marketing', { as: USERS.ceo, body: { mode: 'with_b2b' } });
  });

  it('thao tác quản trị chỉ làm được ở địa chỉ quản trị', async () => {
    expect((await call('qt.test', '/api/admin/users', USERS.ceo)).status).toBe(403);
    expect((await call(ADMIN, '/api/admin/users', USERS.ceo)).status).toBe(200);
    expect((await call('qt.test', '/api/settings', USERS.ceo, { method: 'PATCH', body: { 'ui.test': 1 } })).status).toBe(403);
  });

  it('địa chỉ quản trị chỉ cho CEO và kế toán', async () => {
    expect((await call(ADMIN, '/api/hub/state', USERS.thao)).status).toBe(403);
    expect((await call(ADMIN, '/api/hub/state', USERS.manager)).status).toBe(403);
    expect((await call(ADMIN, '/api/hub/state', USERS.huyen)).status).toBe(200); // kế toán
    expect((await call(ADMIN, '/api/hub/state', USERS.ceo)).status).toBe(200);
    // vẫn đọc được /api/me để giao diện hiện thông báo
    expect((await call(ADMIN, '/api/me', USERS.thao)).status).toBe(200);
  });

  it('kế toán không tạo được tài khoản hay phân quyền, chỉ CEO', async () => {
    const res = await call(ADMIN, '/api/admin/users/user-thao/accountant', USERS.huyen, { method: 'POST', body: { enabled: true } });
    expect(res.status).toBe(403);
    const ok = await call(ADMIN, '/api/admin/users/user-thao/accountant', USERS.ceo, { method: 'POST', body: { enabled: true } });
    expect(ok.status).toBe(200);
  });
});

describe('Phân vai và phân quyền chỉ CEO', () => {
  it('người làm nhân sự không tự đổi vai trò, quyền; chỉ sửa tên, chức vụ; người mới ở mức thấp nhất', async () => {
    await ctx.request('/api/admin/users/user-huyen/marketing', { as: USERS.ceo, body: { mode: 'only' } });
    const base = {
      users: [
        { id: 'u_chi', name: 'Chị Hoa', role: 'admin', crm: 'user-ceo', phongBan: '', perms: [], active: true },
        { id: 'u_thao', name: 'Thảo', role: 'nhanvien', crm: 'user-thao', phongBan: 'KD', perms: [], title: 'Sale', active: true },
        { id: 'u_hr', name: 'Nhân sự', role: 'nhanvien', crm: 'user-huyen', phongBan: 'HCNS', perms: [], active: true },
      ],
      cards: [],
    };
    await ctx.request('/api/hub/state', { as: USERS.ceo, method: 'PUT', body: { version: 0, data: base } });
    const s = await ctx.request('/api/hub/state', { as: USERS.huyen });
    const edit = JSON.parse(JSON.stringify(base));
    edit.users[1] = { ...edit.users[1], role: 'admin', perms: ['kehoach.duyet'], team: 'ads', phongBan: 'HCNS', title: 'Kế toán', name: 'Thảo A', active: false };
    edit.users.push({ id: 'u_new', name: 'Mới', role: 'admin', perms: ['luong.quanly'], phongBan: 'HCNS', active: true });
    await ctx.request('/api/hub/state', { as: USERS.huyen, method: 'PUT', body: { version: s.body.data.version, data: edit } });
    const after = await ctx.request('/api/hub/state', { as: USERS.huyen });
    const us = after.body.data.data.users as Array<Record<string, unknown>>;
    const thao = us.find((u) => u.id === 'u_thao')!;
    expect(thao.role).toBe('nhanvien');
    expect(thao.perms).toEqual([]);
    expect(thao.phongBan).toBe('KD');
    expect(thao.active).toBe(true);
    expect(thao.title).toBe('Kế toán');
    expect(thao.name).toBe('Thảo A');
    const nu = us.find((u) => u.id === 'u_new')!;
    expect(nu.role).toBe('nhanvien');
    expect(nu.perms).toEqual([]);
    expect(us.find((u) => u.id === 'u_chi')!.role).toBe('admin');
  });
});

describe('Sản xuất có ngăn dữ liệu riêng (/api/hub/sx)', () => {
  it('chép từ bản chung sang ngăn riêng, hai bên ghi độc lập, trang cũ bị bắt tải lại', async () => {
    await marketing('user-thao', 'with_b2b');
    const init = await ctx.request('/api/hub/state', {
      as: USERS.ceo,
      method: 'PUT',
      body: {
        version: 0,
        data: { cards: [{ id: 'C1' }], sx: { requests: [{ id: 'PSX2610-001', st: 'CAN_LAM' }], batches: [] } },
      },
    });
    expect(init.status).toBe(200);

    // Lần đọc đầu tiên chép d.sx sang ngăn riêng.
    const first = await ctx.request('/api/hub/sx', { as: USERS.thao });
    expect(first.body.data.version).toBe(1);
    expect(first.body.data.data.requests).toHaveLength(1);

    // Bản chung không còn mang theo sx; số phiên bản sx hiện ở /state/version.
    const state = await ctx.request('/api/hub/state', { as: USERS.thao });
    expect(state.body.data.data.sx).toBeUndefined();
    const ver = await ctx.request('/api/hub/state/version', { as: USERS.thao });
    expect(ver.body.data.sx_version).toBe(1);

    // Ghi Sản xuất không đổi số phiên bản Marketing, và ngược lại.
    const sxPut = await ctx.request('/api/hub/sx', {
      as: USERS.thao,
      method: 'PUT',
      body: { version: 1, data: { requests: [{ id: 'PSX2610-001', st: 'DANG_LAM' }], batches: [] } },
    });
    expect(sxPut.body.data.version).toBe(2);
    const mainPut = await ctx.request('/api/hub/state', {
      as: USERS.thao,
      method: 'PUT',
      body: { version: 1, data: { cards: [{ id: 'C1' }, { id: 'C2' }] } },
    });
    expect(mainPut.status).toBe(200);
    expect(mainPut.body.data.version).toBe(2);
    const sxAfter = await ctx.request('/api/hub/sx', { as: USERS.ceo });
    expect(sxAfter.body.data.version).toBe(2);
    expect(sxAfter.body.data.data.requests[0].st).toBe('DANG_LAM');

    // Số phiên bản cũ thì 409, không ghi đè.
    const stale = await ctx.request('/api/hub/sx', {
      as: USERS.ceo,
      method: 'PUT',
      body: { version: 1, data: { requests: [], batches: [] } },
    });
    expect(stale.status).toBe(409);

    // Trang cũ còn gửi kèm sx trong bản chung: bị chặn, không ghi đè phiếu sản xuất.
    const old = await ctx.request('/api/hub/state', {
      as: USERS.thao,
      method: 'PUT',
      body: { version: 2, data: { cards: [], sx: { requests: [] } } },
    });
    expect(old.status).toBe(426);
    expect(old.body.error.code).toBe('CLIENT_OUTDATED');
  });

  it('chữ có dạng thẻ HTML trong dữ liệu sản xuất bị vô hiệu hoá', async () => {
    await marketing('user-thao', 'with_b2b');
    const init = await ctx.request('/api/hub/sx', {
      as: USERS.thao,
      method: 'PUT',
      body: { version: 0, data: { requests: [{ id: 'X', ghiChu: '<img src=x onerror=alert(1)>' }] } },
    });
    expect(init.status).toBe(200);
    const read = await ctx.request('/api/hub/sx', { as: USERS.thao });
    expect(read.body.data.data.requests[0].ghiChu).not.toContain('<img');
  });
});

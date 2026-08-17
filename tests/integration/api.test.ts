import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

describe('Xác thực và phạm vi dữ liệu', () => {
  it('không có danh tính thì không gọi được API', async () => {
    const res = await ctx.request('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('email chưa được cấp tài khoản thì bị từ chối', async () => {
    const res = await ctx.request('/api/me', { as: 'nguoila@ailla.vn' });
    expect(res.status).toBe(403);
  });

  it('/api/me trả đúng vai trò và phạm vi', async () => {
    const employee = await ctx.request('/api/me', { as: USERS.thao });
    expect(employee.body.data.user.role).toBe('EMPLOYEE');
    expect(employee.body.data.scope).toBe('OWN');

    const ceo = await ctx.request('/api/me', { as: USERS.ceo });
    expect(ceo.body.data.scope).toBe('ALL');
  });

  it('nhân viên chỉ thấy khách của mình', async () => {
    const res = await ctx.request('/api/customers', { as: USERS.thao });
    const names = res.body.data.map((c: { id: string }) => c.id);
    expect(names).toContain('cus-thao-1');
    expect(names).not.toContain('cus-huyen-1');
  });

  it('quản lý thấy toàn đội', async () => {
    const res = await ctx.request('/api/customers', { as: USERS.manager });
    const ids = res.body.data.map((c: { id: string }) => c.id);
    expect(ids).toContain('cus-thao-1');
    expect(ids).toContain('cus-huyen-1');
  });

  it('mọi phản hồi đều có request_id', async () => {
    const res = await ctx.request('/api/me', { as: USERS.thao });
    expect(res.body.request_id).toBeTruthy();
  });
});

describe('Khách hàng và chăm sóc', () => {
  it('tạo khách sẽ tự tạo việc liên hệ đầu tiên và ghi audit', async () => {
    const created = await ctx.request('/api/customers', {
      as: USERS.thao,
      body: { name: 'Khách mới test', phone_text: '0912345678', province: 'Hà Nội' },
    });
    expect(created.status).toBe(201);

    const tasks = await ctx.request('/api/tasks?filter=open', { as: USERS.thao });
    expect(
      tasks.body.data.some((t: { customer_name: string }) => t.customer_name === 'Khách mới test'),
    ).toBe(true);

    const audit = await ctx.request('/api/audit?entity_type=CUSTOMER', { as: USERS.thao });
    expect(audit.body.data.some((a: { action: string }) => a.action === 'CUSTOMER_CREATED')).toBe(true);
  });

  it('trùng số điện thoại thì cảnh báo thay vì tạo bản ghi rác', async () => {
    await ctx.request('/api/customers', {
      as: USERS.thao,
      body: { name: 'Khách A', phone_text: '0911111111' },
    });
    const second = await ctx.request('/api/customers', {
      as: USERS.thao,
      body: { name: 'Khách B', phone_text: '0911111111' },
    });
    expect(second.status).toBe(422);
    expect(second.body.error.code).toBe('DUPLICATE_PHONE');
  });

  it('ghi chăm sóc sẽ cập nhật giai đoạn và mở việc tiếp theo', async () => {
    const res = await ctx.request('/api/customers/cus-thao-1/activities', {
      as: USERS.thao,
      body: {
        channel: 'Gọi điện',
        result: 'Đã trao đổi',
        content: 'Khách đồng ý xem bảng giá đại lý cấp 1.',
        next_action: 'Gửi báo giá và hẹn chốt',
        next_date: '2026-08-20',
      },
    });
    expect(res.status).toBe(201);

    const detail = await ctx.request('/api/customers/cus-thao-1', { as: USERS.thao });
    expect(detail.body.data.next_follow_up_at).toBe('2026-08-20');
    expect(detail.body.data.activities.length).toBe(1);
    expect(detail.body.data.tasks.some((t: { status: string }) => t.status === 'OPEN')).toBe(true);
  });

  it('chuyển sale bắt buộc có lý do và được ghi nhật ký', async () => {
    const missingReason = await ctx.request('/api/customers/cus-thao-1/reassign', {
      as: USERS.manager,
      body: { owner_id: 'user-huyen' },
    });
    expect(missingReason.status).toBe(400);

    const ok = await ctx.request('/api/customers/cus-thao-1/reassign', {
      as: USERS.manager,
      body: { owner_id: 'user-huyen', reason: 'Cân đối tải công việc giữa hai bạn' },
    });
    expect(ok.status).toBe(200);

    const audit = await ctx.request('/api/audit?entity_type=CUSTOMER&entity_id=cus-thao-1', {
      as: USERS.manager,
    });
    const entry = audit.body.data.find((a: { action: string }) => a.action === 'CUSTOMER_REASSIGNED');
    expect(entry.reason).toContain('Cân đối tải');
    expect(JSON.parse(entry.before_json).owner_id).toBe('user-thao');
    expect(JSON.parse(entry.after_json).owner_id).toBe('user-huyen');
  });

  it('nhân viên không được chuyển sale', async () => {
    const res = await ctx.request('/api/customers/cus-thao-1/reassign', {
      as: USERS.thao,
      body: { owner_id: 'user-huyen', reason: 'Muốn chuyển' },
    });
    expect(res.status).toBe(403);
  });
});

describe('Bảng giá', () => {
  it('trả đủ 8 cấp và đánh dấu cấp thiếu giá', async () => {
    const res = await ctx.request('/api/prices', { as: USERS.thao });
    expect(res.body.data.tiers.length).toBe(8);
    const missing = res.body.data.products.find((p: { sku: string }) => p.sku === 'TEST-MISSING');
    expect(missing.prices.BAN_LE).toBeNull();
    expect(missing.missing_tiers.length).toBeGreaterThan(0);
  });
});

describe('Đơn hàng', () => {
  const orderBody = {
    customer_id: 'cus-thao-1',
    order_date: '2026-08-16',
    items: [{ product_id: 'prod-full', qty: 10 }],
    shipping_fee: 200000,
  };

  it('tạo đơn áp giá theo cấp khách và lưu snapshot base/applied', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body: orderBody });
    expect(created.status).toBe(201);

    const detail = await ctx.request(`/api/orders/${created.body.data.id}`, { as: USERS.thao });
    const item = detail.body.data.items[0];
    expect(item.base_price).toBe(125000); // tier-dlc1 = 100000 + 5*5000
    expect(item.applied_price).toBe(125000);
    expect(detail.body.data.subtotal).toBe(1250000);
    expect(detail.body.data.total_amount).toBe(1450000);
  });

  it('nhân viên không tạo được đơn cho khách của người khác', async () => {
    const res = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { ...orderBody, customer_id: 'cus-huyen-1' },
    });
    expect(res.status).toBe(404);
  });

  it('đơn trong ngưỡng vẫn phải qua duyệt của Quản lý', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body: orderBody });
    const submitted = await ctx.request(`/api/orders/${created.body.data.id}/submit`, {
      as: USERS.thao,
      body: {},
    });
    expect(submitted.body.data.status).toBe('PENDING_APPROVAL');
    expect(submitted.body.data.approvals[0].rule_code).toBe('ORDER_STANDARD');

    const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
    const approvalId = approvals.body.data[0].id;
    const decided = await ctx.request(`/api/approvals/${approvalId}/decide`, {
      as: USERS.manager,
      body: { decision: 'APPROVED', note: 'Đơn hợp lệ' },
    });
    expect(decided.body.data.order_status).toBe('APPROVED');

    const detail = await ctx.request(`/api/orders/${created.body.data.id}`, { as: USERS.thao });
    expect(detail.body.data.approval_status).toBe('APPROVED');
  });

  it('từ chối duyệt sẽ trả đơn về trạng thái REJECTED kèm lý do', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body: orderBody });
    await ctx.request(`/api/orders/${created.body.data.id}/submit`, { as: USERS.thao, body: {} });
    const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
    await ctx.request(`/api/approvals/${approvals.body.data[0].id}/decide`, {
      as: USERS.manager,
      body: { decision: 'REJECTED', note: 'Khách còn nợ quá hạn' },
    });

    const detail = await ctx.request(`/api/orders/${created.body.data.id}`, { as: USERS.thao });
    expect(detail.body.data.approval_status).toBe('REJECTED');
    expect(detail.body.data.rejected_reason).toContain('nợ quá hạn');
  });

  it('nhân viên không được tự duyệt đơn của mình', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body: orderBody });
    await ctx.request(`/api/orders/${created.body.data.id}/submit`, { as: USERS.thao, body: {} });
    const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
    const res = await ctx.request(`/api/approvals/${approvals.body.data[0].id}/decide`, {
      as: USERS.thao,
      body: { decision: 'APPROVED' },
    });
    expect(res.status).toBe(403);
  });

  it('CEO có toàn quyền nên tạo được đơn, và thao tác vẫn vào nhật ký', async () => {
    const res = await ctx.request('/api/orders', { as: USERS.ceo, body: orderBody });
    expect(res.status).toBe(201);

    const audit = await ctx.db
      .prepare(`SELECT actor_id FROM audit_logs WHERE action = 'ORDER_CREATED' ORDER BY created_at DESC LIMIT 1`)
      .first<{ actor_id: string }>();
    expect(audit?.actor_id).toBe('user-ceo');
  });
});

describe('Công nợ', () => {
  it('tách chính thức và dự kiến theo trạng thái kế toán', async () => {
    // Đơn đã giao + kế toán xác nhận -> vào công nợ chính thức
    await ctx.db
      .prepare(
        `INSERT INTO orders (id, order_no, customer_id, owner_id, order_date, subtotal, total_amount,
           approval_status, delivery_status, payment_status, accounting_status, created_at, updated_at)
         VALUES ('o-posted', 'DH-POSTED', 'cus-thao-1', 'user-thao', '2026-08-01', 1000000, 1000000,
           'APPROVED', 'DA_GIAO', 'CHUA_THU', 'DA_XAC_NHAN', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
      )
      .run();
    // Đơn đã giao nhưng kế toán chưa xác nhận -> chỉ vào "chờ ghi nợ"
    await ctx.db
      .prepare(
        `INSERT INTO orders (id, order_no, customer_id, owner_id, order_date, subtotal, total_amount,
           approval_status, delivery_status, payment_status, accounting_status, created_at, updated_at)
         VALUES ('o-pending', 'DH-PENDING', 'cus-thao-1', 'user-thao', '2026-08-05', 400000, 400000,
           'APPROVED', 'DA_GIAO', 'CHUA_THU', 'CHUA_XAC_NHAN', '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z')`,
      )
      .run();

    const res = await ctx.request('/api/debts', { as: USERS.thao });
    const debt = res.body.data.find((d: { customer_id: string }) => d.customer_id === 'cus-thao-1');
    expect(debt.official_debt).toBe(1_000_000);
    expect(debt.pending_charges).toBe(400_000);
    expect(debt.projected_debt).toBe(1_400_000);
  });

  it('thu thừa thành credit balance, không dùng số âm', async () => {
    await ctx.db
      .prepare(
        `INSERT INTO orders (id, order_no, customer_id, owner_id, order_date, subtotal, total_amount,
           approval_status, delivery_status, payment_status, accounting_status, created_at, updated_at)
         VALUES ('o-pay', 'DH-PAY', 'cus-thao-1', 'user-thao', '2026-08-01', 1000000, 1000000,
           'APPROVED', 'DA_GIAO', 'CHUA_THU', 'DA_XAC_NHAN', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
      )
      .run();
    await ctx.db
      .prepare(
        `INSERT INTO payments (id, external_receipt_no, source, external_row_key, customer_id, amount, paid_at,
           accounting_status, review_status, is_general_repayment, created_at, updated_at)
         VALUES ('p-1', 'PT-1', 'MANUAL', 'k1', 'cus-thao-1', 1500000, '2026-08-10', 'DA_XAC_NHAN', 'OK', 0,
           '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z')`,
      )
      .run();

    const res = await ctx.request('/api/payments/p-1/allocate', {
      as: USERS.manager,
      body: { allocations: [{ order_id: 'o-pay', amount: 1500000 }] },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.allocated).toBe(1_000_000);
    expect(res.body.data.credit_balance).toBe(500_000);

    const order = await ctx.request('/api/orders/o-pay', { as: USERS.manager });
    expect(order.body.data.payment_status).toBe('DA_THU_DU');
  });

  it('không phân bổ vượt số tiền phiếu thu', async () => {
    await ctx.db
      .prepare(
        `INSERT INTO orders (id, order_no, customer_id, owner_id, order_date, subtotal, total_amount,
           approval_status, delivery_status, payment_status, accounting_status, created_at, updated_at)
         VALUES ('o-x', 'DH-X', 'cus-thao-1', 'user-thao', '2026-08-01', 5000000, 5000000,
           'APPROVED', 'DA_GIAO', 'CHUA_THU', 'DA_XAC_NHAN', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
      )
      .run();
    await ctx.db
      .prepare(
        `INSERT INTO payments (id, external_receipt_no, source, external_row_key, customer_id, amount, paid_at,
           accounting_status, review_status, is_general_repayment, created_at, updated_at)
         VALUES ('p-2', 'PT-2', 'MANUAL', 'k2', 'cus-thao-1', 1000000, '2026-08-10', 'DA_XAC_NHAN', 'OK', 0,
           '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z')`,
      )
      .run();

    const res = await ctx.request('/api/payments/p-2/allocate', {
      as: USERS.manager,
      body: { allocations: [{ order_id: 'o-x', amount: 2000000 }] },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ALLOCATION_EXCEEDS_PAYMENT');
  });
});

describe('Dashboard', () => {
  it('nhân viên không gọi được dashboard quản lý và CEO', async () => {
    expect((await ctx.request('/api/dashboards/manager', { as: USERS.thao })).status).toBe(403);
    expect((await ctx.request('/api/dashboards/ceo', { as: USERS.thao })).status).toBe(403);
  });

  it('quản lý không mở được bàn điều hành CEO', async () => {
    expect((await ctx.request('/api/dashboards/ceo', { as: USERS.manager })).status).toBe(403);
  });

  it('CEO xem được số liệu toàn công ty', async () => {
    const res = await ctx.request('/api/dashboards/ceo', { as: USERS.ceo });
    expect(res.status).toBe(200);
    expect(res.body.data.customers_total).toBe(4);
  });

  it('kết quả cá nhân của nhân viên luôn là của chính mình', async () => {
    const res = await ctx.request('/api/dashboards/me?user_id=user-huyen', { as: USERS.thao });
    expect(res.body.data.customers).toBe(3); // 3 khách của Thảo, không phải của Huyền
  });
});

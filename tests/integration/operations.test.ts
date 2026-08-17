import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

describe('Hồ sơ khách hàng', () => {
  it('nhân viên sửa được thông tin khách của mình nhưng không đổi được cấp giá', async () => {
    const ok = await ctx.request('/api/customers/cus-thao-1', {
      as: USERS.thao,
      method: 'PATCH',
      body: { province: 'Bắc Ninh', reorder_cycle_days: 21 },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.province).toBe('Bắc Ninh');

    const tierChange = await ctx.request('/api/customers/cus-thao-1', {
      as: USERS.thao,
      method: 'PATCH',
      body: { tier_id: 'tier-banle' },
    });
    expect(tierChange.status).toBe(403);
  });

  it('quản lý đổi cấp giá được và thao tác này vào nhật ký', async () => {
    const res = await ctx.request('/api/customers/cus-thao-1', {
      as: USERS.manager,
      method: 'PATCH',
      body: { tier_id: 'tier-banle' },
    });
    expect(res.status).toBe(200);

    const audit = await ctx.request('/api/audit?entity_type=CUSTOMER&entity_id=cus-thao-1', {
      as: USERS.ceo,
    });
    const actions = audit.body.data.map((a: { action: string }) => a.action);
    expect(actions).toContain('CUSTOMER_TIER_CHANGED');
  });

  it('sale sửa được giai đoạn về đúng thực tế của khách cũ', () => 
    ctx
      .request('/api/customers/cus-thao-1', {
        as: USERS.manager,
        method: 'PATCH',
        body: { stage: 'REGULAR' },
      })
      .then((res) => {
        // Khách nhập từ file cũ đang là 'Mới tiếp cận' dù đã mua nhiều năm, phải sửa được ngay.
        expect(res.status).toBe(200);
        expect(res.body.data.stage).toBe('REGULAR');
      }));

  it('chuyển sang Mất khách bắt buộc ghi lý do', async () => {
    const missing = await ctx.request('/api/customers/cus-thao-1', {
      as: USERS.manager,
      method: 'PATCH',
      body: { stage: 'LOST' },
    });
    expect(missing.status).toBe(422);

    const withReason = await ctx.request('/api/customers/cus-thao-1', {
      as: USERS.manager,
      method: 'PATCH',
      body: { stage: 'LOST', lost_reason: 'Khách chuyển sang nhà cung cấp khác' },
    });
    expect(withReason.status).toBe(200);
  });

  it('sắp xếp danh sách theo tên hoạt động', async () => {
    const res = await ctx.request('/api/customers?sort=name', { as: USERS.manager });
    const names = res.body.data.map((c: { name: string }) => c.name);
    expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b, 'vi')));
  });
});

describe('Sản phẩm và bảng giá', () => {
  it('nhân viên không thêm được sản phẩm', async () => {
    const res = await ctx.request('/api/products', {
      as: USERS.thao,
      body: { sku: 'TEST-NEW', name: 'Hàng mới' },
    });
    expect(res.status).toBe(403);
  });

  it('CEO đặt giá là có hiệu lực ngay', async () => {
    const res = await ctx.request('/api/prices', {
      as: USERS.ceo,
      body: { product_id: 'prod-missing', tier_id: 'tier-banle', amount: 99000, valid_from: '2026-08-16' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');

    const table = await ctx.request('/api/prices?date=2026-08-16', { as: USERS.thao });
    const product = table.body.data.products.find((p: { id: string }) => p.id === 'prod-missing');
    expect(product.prices.BAN_LE).toBe(99000);
  });

  it('quản lý đặt giá thì thành đề nghị chờ CEO duyệt, giá cũ chưa đổi', async () => {
    const res = await ctx.request('/api/prices', {
      as: USERS.manager,
      body: { product_id: 'prod-full', tier_id: 'tier-banle', amount: 111000, valid_from: '2026-08-16' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.approval_id).toBeTruthy();

    const table = await ctx.request('/api/prices?date=2026-08-16', { as: USERS.thao });
    const product = table.body.data.products.find((p: { id: string }) => p.id === 'prod-full');
    expect(product.prices.BAN_LE).not.toBe(111000);

    const decided = await ctx.request(`/api/approvals/${res.body.data.approval_id}/decide`, {
      as: USERS.ceo,
      body: { decision: 'APPROVED', note: 'Đồng ý bảng giá mới' },
    });
    expect(decided.status).toBe(200);

    const after = await ctx.request('/api/prices?date=2026-08-16', { as: USERS.thao });
    const updated = after.body.data.products.find((p: { id: string }) => p.id === 'prod-full');
    expect(updated.prices.BAN_LE).toBe(111000);
  });

  it('thêm sản phẩm mới thì mọi cấp giá đều là "chưa có"', async () => {
    const created = await ctx.request('/api/products', {
      as: USERS.manager,
      body: { sku: 'TEST-NEW', name: 'Nước lau sàn test', unit: 'Can' },
    });
    expect(created.status).toBe(200);

    const table = await ctx.request('/api/prices', { as: USERS.manager });
    const product = table.body.data.products.find((p: { sku: string }) => p.sku === 'TEST-NEW');
    expect(product.missing_tiers.length).toBe(8);
  });
});

describe('Khuyến mại và vận hành đơn hàng', () => {
  async function createOrderWithGift() {
    return ctx.request('/api/orders', {
      as: USERS.thao,
      idempotencyKey: crypto.randomUUID(),
      body: {
        customer_id: 'cus-thao-1',
        items: [
          { product_id: 'prod-full', qty: 10 },
          { product_id: 'prod-full', qty: 1, is_gift: true, promotion_note: 'Mua 10 tặng 1' },
        ],
        promotion_code: 'KM-T8',
        promotion_note: 'Mua 10 tặng 1',
        discount_amount: 50000,
      },
    });
  }

  it('hàng tặng không tính vào tiền hàng nhưng vẫn là một dòng của đơn', async () => {
    const created = await createOrderWithGift();
    expect(created.status).toBe(201);

    const detail = await ctx.request(`/api/orders/${created.body.data.id}`, { as: USERS.thao });
    const items = detail.body.data.items;
    expect(items.length).toBe(2);

    const gift = items.find((i: { is_gift: boolean }) => i.is_gift);
    const sold = items.find((i: { is_gift: boolean }) => !i.is_gift);
    expect(gift.applied_price).toBe(0);
    expect(gift.line_total).toBe(0);
    expect(detail.body.data.promotion_code).toBe('KM-T8');
    // Tiền hàng chỉ tính dòng bán, dòng tặng không cộng tiền; chiết khấu trừ vào tổng phải thu.
    expect(detail.body.data.subtotal).toBe(sold.applied_price * 10);
    expect(detail.body.data.total_amount).toBe(sold.applied_price * 10 - 50000);
  });

  it('đơn có hàng tặng vẫn gửi duyệt được (không đòi giá cho dòng tặng)', async () => {
    const created = await createOrderWithGift();
    const submitted = await ctx.request(`/api/orders/${created.body.data.id}/submit`, {
      as: USERS.thao,
      idempotencyKey: crypto.randomUUID(),
      body: {},
    });
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe('PENDING_APPROVAL');
  });

  it('kế toán chỉ xác nhận được đơn đã giao', async () => {
    const created = await createOrderWithGift();
    const orderId = created.body.data.id;
    await ctx.request(`/api/orders/${orderId}/submit`, {
      as: USERS.thao,
      idempotencyKey: crypto.randomUUID(),
      body: {},
    });
    const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
    for (const approval of approvals.body.data) {
      await ctx.request(`/api/approvals/${approval.id}/decide`, {
        as: USERS.manager,
        body: { decision: 'APPROVED' },
      });
    }

    const tooEarly = await ctx.request(`/api/orders/${orderId}/accounting`, {
      as: USERS.manager,
      body: { accounting_status: 'DA_XAC_NHAN' },
    });
    expect(tooEarly.status).toBe(400);

    await ctx.request(`/api/orders/${orderId}/delivery`, {
      as: USERS.manager,
      body: { delivery_status: 'DA_GIAO' },
    });
    const confirmed = await ctx.request(`/api/orders/${orderId}/accounting`, {
      as: USERS.manager,
      body: { accounting_status: 'DA_XAC_NHAN' },
    });
    expect(confirmed.status).toBe(200);
  });

  it('ghi nhận tiền về trừ đúng công nợ và tiền thừa thành số dư có', async () => {
    const created = await createOrderWithGift();
    const orderId = created.body.data.id;
    await ctx.request(`/api/orders/${orderId}/submit`, {
      as: USERS.thao,
      idempotencyKey: crypto.randomUUID(),
      body: {},
    });
    const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
    for (const approval of approvals.body.data) {
      await ctx.request(`/api/approvals/${approval.id}/decide`, {
        as: USERS.manager,
        body: { decision: 'APPROVED' },
      });
    }

    const before = await ctx.request(`/api/orders/${orderId}`, { as: USERS.thao });
    const total = before.body.data.total_amount as number;
    const payment = await ctx.request('/api/payments', {
      as: USERS.manager,
      body: {
        customer_id: 'cus-thao-1',
        amount: total + 100000,
        method: 'Chuyển khoản',
        external_receipt_no: 'PT-001',
        accounting_confirmed: true,
        allocations: [{ order_id: orderId, amount: total + 100000 }],
      },
    });
    expect(payment.status).toBe(200);

    const detail = await ctx.request(`/api/orders/${orderId}`, { as: USERS.thao });
    expect(detail.body.data.payment_status).toBe('DA_THU_DU');

    const credit = await ctx.db
      .prepare('SELECT amount FROM customer_credit_balances WHERE customer_id = ?')
      .bind('cus-thao-1')
      .first<{ amount: number }>();
    expect(credit?.amount).toBe(100000);
  });

  it('sale tích được tiền về nhưng khoản đó CHƯA vào công nợ chính thức', async () => {
    const res = await ctx.request('/api/payments', {
      as: USERS.thao,
      body: {
        customer_id: 'cus-thao-1',
        amount: 100000,
        // Sale có tick "kế toán đã xác nhận" thì hệ thống vẫn bỏ qua.
        accounting_confirmed: true,
      },
    });
    expect(res.status).toBe(200);

    const payment = await ctx.db
      .prepare('SELECT accounting_status FROM payments WHERE id = ?')
      .bind(res.body.data.id)
      .first<{ accounting_status: string }>();
    expect(payment?.accounting_status).toBe('CHUA_XAC_NHAN');
  });

  it('kế toán xác nhận thì khoản tiền mới được tính vào công nợ chính thức', async () => {
    const ghiNhan = await ctx.request('/api/payments', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', amount: 100000 },
    });
    const paymentId = ghiNhan.body.data.id;

    // Nhân viên thường không xác nhận được.
    const saleTuXacNhan = await ctx.request(`/api/payments/${paymentId}/confirm`, {
      as: USERS.thao,
      body: { confirmed: true },
    });
    expect(saleTuXacNhan.status).toBe(403);

    // Cấp gói quyền kế toán cho Huyền rồi xác nhận.
    const huyen = await ctx.db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(USERS.huyen)
      .first<{ id: string }>();
    const capQuyen = await ctx.request(`/api/admin/users/${huyen!.id}/accountant`, {
      as: USERS.ceo,
      body: { enabled: true },
    });
    expect(capQuyen.status).toBe(200);

    const xacNhan = await ctx.request(`/api/payments/${paymentId}/confirm`, {
      as: USERS.huyen,
      body: { confirmed: true },
    });
    expect(xacNhan.status).toBe(200);

    const payment = await ctx.db
      .prepare('SELECT accounting_status FROM payments WHERE id = ?')
      .bind(paymentId)
      .first<{ accounting_status: string }>();
    expect(payment?.accounting_status).toBe('DA_XAC_NHAN');
  });
});

describe('Dashboard kinh doanh', () => {
  it('nhân viên chỉ xem được số của chính mình', async () => {
    const res = await ctx.request('/api/dashboards/sales?period=2026-08&user_id=user-huyen', {
      as: USERS.thao,
    });
    expect(res.status).toBe(200);
    const ids = res.body.data.by_sale.map((r: { user_id: string }) => r.user_id);
    expect(ids).toEqual(['user-thao']);
  });

  it('trả đủ 4 khối theo sheet DASHBOARD_SALE', async () => {
    const res = await ctx.request('/api/dashboards/sales?period=2026-08', { as: USERS.ceo });
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.overview).toBeTruthy();
    expect(Array.isArray(d.by_sale)).toBe(true);
    expect(Array.isArray(d.by_product_group)).toBe(true);
    expect(Array.isArray(d.funnel)).toBe(true);
    // Tổng quan phải có đủ các chỉ số công ty đang theo dõi.
    for (const key of ['revenue', 'orders', 'aov', 'close_rate', 'repeat_rate']) {
      expect(d.overview).toHaveProperty(key);
    }
  });
});

describe('Bút toán đảo (khoản điều chỉnh giảm)', () => {
  async function approvedOrder() {
    const created = await ctx.request('/api/orders', {
      as: USERS.thao,
      idempotencyKey: crypto.randomUUID(),
      body: { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 5 }] },
    });
    await ctx.request(`/api/orders/${created.body.data.id}/submit`, {
      as: USERS.thao,
      idempotencyKey: crypto.randomUUID(),
      body: {},
    });
    const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
    for (const approval of approvals.body.data) {
      await ctx.request(`/api/approvals/${approval.id}/decide`, {
        as: USERS.manager,
        body: { decision: 'APPROVED' },
      });
    }
    return created.body.data.id as string;
  }

  it('số tiền âm bị từ chối nếu không đánh dấu là bút toán đảo', async () => {
    const orderId = await approvedOrder();
    const res = await ctx.request('/api/payments', {
      as: USERS.manager,
      body: {
        customer_id: 'cus-thao-1',
        amount: -1000000,
        allocations: [{ order_id: orderId, amount: -1000000 }],
      },
    });
    // Sai quy tắc dữ liệu đầu vào -> 400 kèm chi tiết từng trường.
    expect(res.status).toBe(400);
    expect(res.body.error.fields?.amount).toContain('bút toán đảo');
  });

  it('bút toán đảo bắt buộc ghi lý do và phải chỉ rõ đơn', async () => {
    const thieuLyDo = await ctx.request('/api/payments', {
      as: USERS.manager,
      body: { customer_id: 'cus-thao-1', amount: -1000000, is_adjustment: true },
    });
    expect(thieuLyDo.status).toBe(400);
    expect(thieuLyDo.body.error.fields?.adjustment_reason).toBeTruthy();
  });

  it('bút toán đảo trừ đúng số tiền đã ghi nhận của đơn', async () => {
    const orderId = await approvedOrder();
    const detail = await ctx.request(`/api/orders/${orderId}`, { as: USERS.thao });
    const total = detail.body.data.total_amount as number;

    await ctx.request('/api/payments', {
      as: USERS.manager,
      body: {
        customer_id: 'cus-thao-1',
        amount: total,
        external_receipt_no: 'PT-100',
        accounting_confirmed: true,
        allocations: [{ order_id: orderId, amount: total }],
      },
    });
    const daThu = await ctx.request(`/api/orders/${orderId}`, { as: USERS.thao });
    expect(daThu.body.data.payment_status).toBe('DA_THU_DU');

    // Kế toán đảo lại toàn bộ khoản thu đó.
    const dao = await ctx.request('/api/payments', {
      as: USERS.manager,
      body: {
        customer_id: 'cus-thao-1',
        amount: total,
        is_adjustment: true,
        adjustment_reason: 'Huỷ khoản thu ghi nhầm',
        accounting_confirmed: true,
        allocations: [{ order_id: orderId, amount: total }],
      },
    });
    expect(dao.status).toBe(200);

    const sauKhiDao = await ctx.request(`/api/orders/${orderId}`, { as: USERS.thao });
    expect(sauKhiDao.body.data.payment_status).toBe('CHUA_THU');
    expect(sauKhiDao.body.data.received_amount).toBe(0);

    // Không được biến thành số dư có: đây là huỷ khoản thu, không phải thu thừa.
    const credit = await ctx.db
      .prepare('SELECT amount FROM customer_credit_balances WHERE customer_id = ?')
      .bind('cus-thao-1')
      .first<{ amount: number }>();
    expect(credit?.amount ?? 0).toBe(0);
  });
});

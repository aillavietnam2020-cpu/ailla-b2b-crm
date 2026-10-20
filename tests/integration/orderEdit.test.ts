import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

const baseOrder = {
  customer_id: 'cus-thao-1',
  order_date: '2026-08-16',
  items: [{ product_id: 'prod-full', qty: 10 }],
  shipping_fee: 200000,
};

/** Tạo đơn, gửi duyệt, quản lý duyệt, đánh dấu đã xuất kho. */
async function makeApprovedOrder(delivered = false): Promise<string> {
  const created = await ctx.request('/api/orders', { as: USERS.thao, body: baseOrder });
  const id = created.body.data.id as string;
  await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
  const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
  await ctx.request(`/api/approvals/${approvals.body.data[0].id}/decide`, {
    as: USERS.manager,
    body: { decision: 'APPROVED' },
  });
  if (delivered) {
    await ctx.request(`/api/orders/${id}/delivery`, {
      as: USERS.manager,
      body: { delivery_status: 'DA_XUAT_KHO' },
    });
  }
  return id;
}

describe('Sửa đơn hàng', () => {
  it('đơn nháp sửa tự do, tính lại tiền, không cần lý do', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body: baseOrder });
    const id = created.body.data.id as string;

    const res = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: USERS.thao,
      body: { items: [{ product_id: 'prod-full', qty: 4 }], shipping_fee: 0 },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.total_before).toBe(1450000);
    expect(res.body.data.total_after).toBe(500000);

    const detail = await ctx.request(`/api/orders/${id}`, { as: USERS.thao });
    expect(detail.body.data.total_amount).toBe(500000);
    expect(detail.body.data.items).toHaveLength(1);
    expect(detail.body.data.items[0].qty).toBe(4);
    expect(detail.body.data.revisions).toHaveLength(1);
    expect(detail.body.data.revisions[0].before.total_amount).toBe(1450000);
    expect(detail.body.data.revisions[0].after.total_amount).toBe(500000);
  });

  it('đơn đã duyệt bắt buộc ghi lý do sửa', async () => {
    const id = await makeApprovedOrder();
    const res = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: USERS.thao,
      body: { items: [{ product_id: 'prod-full', qty: 8 }] },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EDIT_REASON_REQUIRED');
  });

  it('đơn đã duyệt: kho hết hàng nên giảm số lượng, giữ nguyên Đã duyệt, lưu lịch sử', async () => {
    const id = await makeApprovedOrder();
    const res = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: USERS.thao,
      body: {
        items: [{ product_id: 'prod-full', qty: 8 }],
        shipping_fee: 200000,
        reason: 'Kho báo hết hàng, khách đồng ý lấy 8',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.needs_approval).toBe(false);

    const detail = await ctx.request(`/api/orders/${id}`, { as: USERS.thao });
    expect(detail.body.data.approval_status).toBe('APPROVED');
    expect(detail.body.data.total_amount).toBe(1200000);
    expect(detail.body.data.revisions[0].reason).toContain('hết hàng');
    expect(detail.body.data.revisions[0].edited_by_name).toBeTruthy();
  });

  it('kho xuất sai: sửa sau khi đã xuất kho thì công nợ chờ ghi tính lại theo tiền mới', async () => {
    const id = await makeApprovedOrder(true);
    const before = await ctx.request('/api/debts', { as: USERS.manager });
    const debtBefore = before.body.data.find((d: { customer_id: string }) => d.customer_id === 'cus-thao-1');
    // Kho đã xuất thì đơn tự vào công nợ chính thức (không còn chờ kế toán xác nhận).
    expect(debtBefore.pending_charges).toBe(0);
    expect(debtBefore.official_debt).toBeGreaterThanOrEqual(1450000);

    const res = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: USERS.thao,
      body: {
        items: [{ product_id: 'prod-full', qty: 9 }],
        shipping_fee: 200000,
        reason: 'Kho xuất 9 can thay vì 10',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');

    const after = await ctx.request('/api/debts', { as: USERS.manager });
    const debtAfter = after.body.data.find((d: { customer_id: string }) => d.customer_id === 'cus-thao-1');
    expect(debtAfter.pending_charges).toBe(0);
    expect(debtBefore.official_debt - debtAfter.official_debt).toBe(125000);
  });

  it('bật yêu cầu duyệt giá: sửa giá lệch chuẩn trên đơn đã duyệt thì quay về Chờ duyệt và tạo yêu cầu mới', async () => {
    await ctx.db
      .prepare(
        "INSERT INTO app_settings (key, value_json, updated_at) VALUES ('approval.price_override_required', 'true', '2026-08-16T01:00:00.000Z')",
      )
      .run();
    const id = await makeApprovedOrder();
    const res = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: USERS.thao,
      body: {
        items: [{ product_id: 'prod-full', qty: 10, applied_price: 100000, price_override_reason: 'Khách quen' }],
        shipping_fee: 200000,
        reason: 'Khách xin giảm giá',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING_APPROVAL');
    expect(res.body.data.needs_approval).toBe(true);
    expect(res.body.data.approvals[0].rule_code).toBe('PRICE_OVERRIDE');

    const pending = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
    expect(pending.body.data.length).toBeGreaterThan(0);
  });

  it('đơn kế toán đã xác nhận thì khoá, phải bỏ xác nhận mới sửa được', async () => {
    const id = await makeApprovedOrder(true);
    await ctx.request(`/api/orders/${id}/accounting`, {
      as: USERS.manager,
      body: { accounting_status: 'DA_XAC_NHAN' },
    });

    const locked = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: USERS.thao,
      body: { items: [{ product_id: 'prod-full', qty: 9 }], reason: 'Kho xuất thiếu 1 can' },
    });
    expect(locked.status).toBe(400);
    expect(locked.body.error.code).toBe('ORDER_ACCOUNTING_LOCKED');

    await ctx.request(`/api/orders/${id}/accounting`, {
      as: USERS.manager,
      body: { accounting_status: 'CHUA_XAC_NHAN', note: 'Sửa đơn theo kho' },
    });
    const ok = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: USERS.thao,
      body: { items: [{ product_id: 'prod-full', qty: 9 }], reason: 'Kho xuất thiếu 1 can' },
    });
    expect(ok.status).toBe(200);
  });

  it('đơn đã huỷ không sửa được; nhân viên không sửa đơn của người khác', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body: baseOrder });
    const id = created.body.data.id as string;

    const other = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: USERS.huyen,
      body: { items: [{ product_id: 'prod-full', qty: 2 }] },
    });
    expect(other.status).toBe(404);

    await ctx.request(`/api/orders/${id}/cancel`, { as: USERS.thao, body: { reason: 'Khách huỷ đơn' } });
    const res = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: USERS.thao,
      body: { items: [{ product_id: 'prod-full', qty: 2 }], reason: 'Sửa đơn đã huỷ' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ORDER_CANCELLED');
  });
});

describe('Bảng giá riêng khách gia công', () => {
  async function makeCustomCustomer() {
    // Khách gia công không cần cấp giá.
    await ctx.db
      .prepare(`UPDATE customers SET price_mode = 'CUSTOM', tier_id = NULL WHERE id = 'cus-thao-1'`)
      .run();
  }

  it('khách gia công chưa có giá riêng thì không bán được, kể cả khi mã có giá theo cấp', async () => {
    await makeCustomCustomer();
    const res = await ctx.request('/api/orders', { as: USERS.thao, body: baseOrder });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body.error)).toContain('bảng giá riêng');
  });

  it('CEO đặt giá riêng cho khách thì đơn lấy đúng giá riêng đó', async () => {
    await makeCustomCustomer();
    const set = await ctx.request('/api/customer-prices/cus-thao-1/item', {
      method: 'PUT',
      as: USERS.ceo,
      body: { product_id: 'prod-full', amount: 41980, valid_from: '2026-07-21' },
    });
    expect(set.status).toBe(200);

    const created = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { ...baseOrder, items: [{ product_id: 'prod-full', qty: 6 }], shipping_fee: 0 },
    });
    expect(created.status).toBe(201);
    const detail = await ctx.request(`/api/orders/${created.body.data.id}`, { as: USERS.thao });
    expect(detail.body.data.items[0].base_price).toBe(41980);
    expect(detail.body.data.total_amount).toBe(251880);
  });

  it('giá đổi theo ngày hiệu lực; đơn cũ giữ giá đã chốt', async () => {
    await makeCustomCustomer();
    await ctx.request('/api/customer-prices/cus-thao-1/item', {
      method: 'PUT',
      as: USERS.ceo,
      body: { product_id: 'prod-full', amount: 40000, valid_from: '2026-01-01' },
    });
    const oldOrder = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { ...baseOrder, items: [{ product_id: 'prod-full', qty: 1 }], shipping_fee: 0 },
    });
    await ctx.request('/api/customer-prices/cus-thao-1/item', {
      method: 'PUT',
      as: USERS.ceo,
      body: { product_id: 'prod-full', amount: 45000, valid_from: '2026-08-20' },
    });
    const list = await ctx.request('/api/customer-prices/cus-thao-1?date=2026-08-25', { as: USERS.thao });
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].amount).toBe(45000);

    const detail = await ctx.request(`/api/orders/${oldOrder.body.data.id}`, { as: USERS.thao });
    expect(detail.body.data.items[0].base_price).toBe(40000);
  });

  it('tải hàng loạt: xem trước, tạo mã mới, rồi áp dụng', async () => {
    await makeCustomCustomer();
    const rows = [
      { sku: 'TEST-FULL', amount: 52000 },
      { sku: '3.5suongmai', amount: 41980, name: 'Nước giặt 3.5kg', unit: 'Thùng', pack_qty: 6 },
      { sku: 'KHONG-CO', amount: 1000 },
    ];

    const dry = await ctx.request('/api/customer-prices/cus-thao-1/import', {
      as: USERS.ceo,
      body: { rows, dry_run: true, create_missing: false },
    });
    expect(dry.status).toBe(200);
    expect(dry.body.data.matched).toBe(1);
    expect(dry.body.data.unknown_skus.map((s: { sku: string }) => s.sku)).toEqual(['3.5suongmai', 'KHONG-CO']);
    const none = await ctx.db.prepare('SELECT COUNT(*) AS n FROM customer_prices').first<{ n: number }>();
    expect(none?.n).toBe(0);

    const applied = await ctx.request('/api/customer-prices/cus-thao-1/import', {
      as: USERS.ceo,
      body: { rows: rows.slice(0, 2), create_missing: true, valid_from: '2026-07-21' },
    });
    expect(applied.status).toBe(200);
    expect(applied.body.data.products_created).toBe(1);
    expect(applied.body.data.created_price).toBe(2);

    const product = await ctx.db
      .prepare(`SELECT unit, pack_size, price_scope FROM products WHERE sku = '3.5suongmai'`)
      .first<{ unit: string; pack_size: string; price_scope: string }>();
    expect(product?.unit).toBe('Can');
    expect(product?.pack_size).toBe('6 can/thùng');
    expect(product?.price_scope).toBe('CUSTOM');

    // Sản phẩm gia công không làm hiện cảnh báo thiếu giá 8 cấp.
    const tiers = await ctx.request('/api/prices', { as: USERS.thao });
    const gc = tiers.body.data.products.find((p: { sku: string }) => p.sku === '3.5suongmai');
    expect(gc.missing_tiers).toHaveLength(0);

    const again = await ctx.request('/api/customer-prices/cus-thao-1/import', {
      as: USERS.ceo,
      body: { rows: rows.slice(0, 2), valid_from: '2026-07-21' },
    });
    expect(again.body.data.unchanged).toBe(2);
  });

  it('nhân viên không được sửa giá riêng của khách', async () => {
    const res = await ctx.request('/api/customer-prices/cus-thao-1/item', {
      method: 'PUT',
      as: USERS.thao,
      body: { product_id: 'prod-full', amount: 1000 },
    });
    expect(res.status).toBe(403);
  });
});

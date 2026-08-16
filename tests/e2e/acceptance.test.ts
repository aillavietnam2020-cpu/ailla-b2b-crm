/**
 * Kịch bản nghiệm thu AC-01 → AC-15 của mục 16.
 * Chạy trên toàn bộ stack backend thật (Hono + SQL migration thật + RBAC thật).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';
import { buildWorkbookBytes } from '../fixtures/workbook';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
});

function workbookForm(bytes: Uint8Array, extra?: Record<string, string>): FormData {
  const form = new FormData();
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer]);
  form.append('file', new File([blob], '01-CRM-B2B-AILLA.xlsx'));
  for (const [key, value] of Object.entries(extra ?? {})) form.append(key, value);
  return form;
}

describe('AC-01 · Đăng nhập đúng vai trò', () => {
  it('nhân viên gọi API khu quản trị thì bị chặn ở backend', async () => {
    await seedBusinessData(ctx.db);
    expect((await ctx.request('/api/dashboards/manager', { as: USERS.thao })).status).toBe(403);
    expect((await ctx.request('/api/dashboards/ceo', { as: USERS.thao })).status).toBe(403);
    expect((await ctx.request('/api/imports', { as: USERS.thao })).status).toBe(403);
    expect((await ctx.request('/api/approvals', { as: USERS.thao })).status).toBe(403);
  });
});

describe('AC-02 · Data scope', () => {
  it('Thảo mở khách của Huyền thì nhận 404 và không lộ dữ liệu', async () => {
    await seedBusinessData(ctx.db);
    const res = await ctx.request('/api/customers/cus-huyen-1', { as: USERS.thao });
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('Cửa hàng Test C');
  });
});

describe('AC-03 · Import sản phẩm (preview)', () => {
  it('preview thấy 134 SKU và 11 mã cảnh báo thiếu giá', async () => {
    const bytes = buildWorkbookBytes();
    const res = await ctx.request('/api/imports/preview', {
      as: USERS.manager,
      formData: workbookForm(bytes),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.totals.products).toBe(134);
    const missingPriceIssues = res.body.data.issues.filter(
      (i: { code: string }) => i.code === 'MISSING_PRICE',
    );
    expect(missingPriceIssues.length).toBe(11);
  });

  it('preview KHÔNG ghi dữ liệu nghiệp vụ', async () => {
    await ctx.request('/api/imports/preview', {
      as: USERS.manager,
      formData: workbookForm(buildWorkbookBytes()),
    });
    const products = await ctx.db.prepare('SELECT COUNT(*) AS n FROM products').first<{ n: number }>();
    expect(products?.n).toBe(0);
  });

  it('sheet CANH_BAO bị bỏ qua vì chứa công thức lỗi', async () => {
    const res = await ctx.request('/api/imports/preview', {
      as: USERS.manager,
      formData: workbookForm(buildWorkbookBytes()),
    });
    expect(res.body.data.issues.some((i: { code: string }) => i.code === 'SHEET_SKIPPED')).toBe(true);
  });
});

describe('AC-04 · Import khách hàng (commit)', () => {
  it('62 khách, Thảo 48 / Huyền 14, điện thoại lưu dạng TEXT giữ số 0', async () => {
    const bytes = buildWorkbookBytes();
    const preview = await ctx.request('/api/imports/preview', {
      as: USERS.manager,
      formData: workbookForm(bytes),
    });
    const commit = await ctx.request('/api/imports/commit', {
      as: USERS.manager,
      formData: workbookForm(bytes, { batch_id: preview.body.data.batch_id }),
    });
    expect(commit.status).toBe(200);

    const total = await ctx.db.prepare('SELECT COUNT(*) AS n FROM customers').first<{ n: number }>();
    expect(total?.n).toBe(62);

    const byThao = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM customers WHERE owner_id = 'user-thao'`)
      .first<{ n: number }>();
    const byHuyen = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM customers WHERE owner_id = 'user-huyen'`)
      .first<{ n: number }>();
    expect(byThao?.n).toBe(48);
    expect(byHuyen?.n).toBe(14);

    const phoneRow = await ctx.db
      .prepare(`SELECT phone_text FROM customers WHERE legacy_code = 'kh-001'`)
      .first<{ phone_text: string }>();
    expect(typeof phoneRow?.phone_text).toBe('string');
    expect(phoneRow?.phone_text.startsWith('0')).toBe(true);
    expect(phoneRow?.phone_text.length).toBe(10);

    // 2 khách thiếu số, 5 thiếu tỉnh, 2 cấp "Khác" -> phải là NEEDS_REVIEW, không bịa dữ liệu
    const review = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM customers WHERE data_quality = 'NEEDS_REVIEW'`)
      .first<{ n: number }>();
    expect((review?.n ?? 0)).toBeGreaterThanOrEqual(9);

    const unknownTier = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM customers WHERE tier_id IS NULL AND legacy_tier_label = 'Khác'`)
      .first<{ n: number }>();
    expect(unknownTier?.n).toBe(2);
  });
});

describe('AC-05 · Import đơn hàng', () => {
  it('35 đơn nguồn / 206 dòng, 34 đơn quản lý, dòng chưa khai báo đơn vào hàng chờ', async () => {
    const bytes = buildWorkbookBytes();
    const preview = await ctx.request('/api/imports/preview', {
      as: USERS.manager,
      formData: workbookForm(bytes),
    });
    expect(preview.body.data.totals.source_orders).toBe(35);
    expect(preview.body.data.totals.source_order_lines).toBe(206);
    expect(preview.body.data.totals.managed_orders).toBe(34);

    await ctx.request('/api/imports/commit', {
      as: USERS.manager,
      formData: workbookForm(bytes, { batch_id: preview.body.data.batch_id }),
    });

    const orders = await ctx.db.prepare('SELECT COUNT(*) AS n FROM orders').first<{ n: number }>();
    expect(orders?.n).toBe(35);

    const lines = await ctx.db.prepare('SELECT COUNT(*) AS n FROM order_items').first<{ n: number }>();
    expect(lines?.n).toBe(205); // 206 dòng - 1 dòng chưa khai báo mã đơn

    const pending = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM import_errors WHERE code = 'ORDER_CODE_MISSING'`)
      .first<{ n: number }>();
    expect((pending?.n ?? 0)).toBeGreaterThanOrEqual(1); // dòng đó KHÔNG bị mất
  });
});

describe('AC-06 · Đối soát công nợ', () => {
  it('ba tổng khớp mốc tài liệu thì batch được đánh dấu RECONCILED', async () => {
    const bytes = buildWorkbookBytes();
    const preview = await ctx.request('/api/imports/preview', {
      as: USERS.manager,
      formData: workbookForm(bytes),
    });
    expect(preview.body.data.reconciliation.ok).toBe(true);
    const lines = preview.body.data.reconciliation.lines as Array<{ key: string; expected: number; actual: number }>;
    expect(lines.find((l) => l.key === 'payments_total')?.actual).toBe(180_073_600);
    expect(lines.find((l) => l.key === 'opening_debt_total')?.actual).toBe(1_256_920_982);
    expect(lines.find((l) => l.key === 'official_debt_total')?.actual).toBe(1_168_465_995);
    expect(lines.find((l) => l.key === 'projected_debt_total')?.actual).toBe(1_397_046_765);

    const commit = await ctx.request('/api/imports/commit', {
      as: USERS.manager,
      formData: workbookForm(bytes, { batch_id: preview.body.data.batch_id }),
    });
    expect(commit.body.data.status).toBe('RECONCILED');
  });

  it('lệch tổng thì KHÔNG được đánh dấu RECONCILED và sinh cảnh báo', async () => {
    const bytes = buildWorkbookBytes({ breakReconciliation: true });
    const preview = await ctx.request('/api/imports/preview', {
      as: USERS.manager,
      formData: workbookForm(bytes),
    });
    expect(preview.body.data.reconciliation.ok).toBe(false);

    const commit = await ctx.request('/api/imports/commit', {
      as: USERS.manager,
      formData: workbookForm(bytes, { batch_id: preview.body.data.batch_id }),
    });
    expect(commit.body.data.status).toBe('COMMITTED');

    const alert = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM alerts WHERE code = 'IMPORT_RECONCILIATION_FAILED'`)
      .first<{ n: number }>();
    expect(alert?.n).toBe(1);
  });
});

describe('AC-07 · Giá trống', () => {
  it('chọn SKU/cấp có giá NULL thì không thêm được dòng và nêu đúng mã, cấp', async () => {
    await seedBusinessData(ctx.db);
    // cus-huyen-1 ở cấp NPP; prod-missing chỉ có giá ở cấp Đại lý cấp 1
    const res = await ctx.request('/api/orders', {
      as: USERS.huyen,
      body: { customer_id: 'cus-huyen-1', items: [{ product_id: 'prod-missing', qty: 1 }] },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ORDER_LINE_BLOCKED');
    expect(JSON.stringify(res.body.error.fields)).toContain('TEST-MISSING');
  });

  it('khách chưa map cấp giá cũng bị chặn tạo đơn', async () => {
    await seedBusinessData(ctx.db);
    const res = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { customer_id: 'cus-no-tier', items: [{ product_id: 'prod-full', qty: 1 }] },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TIER_UNKNOWN');
  });
});

describe('AC-08 · Giá thoả thuận', () => {
  it('sửa đơn giá sẽ tạo yêu cầu duyệt và giữ cả base lẫn applied price', async () => {
    await seedBusinessData(ctx.db);
    const created = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: {
        customer_id: 'cus-thao-1',
        items: [{ product_id: 'prod-full', qty: 10, applied_price: 100000, price_override_reason: 'Khách lấy sỉ lớn' }],
      },
    });
    expect(created.status).toBe(201);

    const detail = await ctx.request(`/api/orders/${created.body.data.id}`, { as: USERS.thao });
    expect(detail.body.data.items[0].base_price).toBe(125000);
    expect(detail.body.data.items[0].applied_price).toBe(100000);
    expect(detail.body.data.items[0].price_override).toBe(true);

    const submitted = await ctx.request(`/api/orders/${created.body.data.id}/submit`, {
      as: USERS.thao,
      body: {},
    });
    const rule = submitted.body.data.approvals.find(
      (a: { rule_code: string }) => a.rule_code === 'PRICE_OVERRIDE',
    );
    expect(rule).toBeTruthy();
    expect(rule.required_role).toBe('CEO'); // lệch 20% > ngưỡng CEO 15%

    // Quản lý không được duyệt ngoại lệ vượt ngưỡng
    const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
    const priceApproval = approvals.body.data.find(
      (a: { rule_code: string }) => a.rule_code === 'PRICE_OVERRIDE',
    );
    const byManager = await ctx.request(`/api/approvals/${priceApproval.id}/decide`, {
      as: USERS.manager,
      body: { decision: 'APPROVED' },
    });
    expect(byManager.status).toBe(403);

    const byCeo = await ctx.request(`/api/approvals/${priceApproval.id}/decide`, {
      as: USERS.ceo,
      body: { decision: 'APPROVED', note: 'Đồng ý cho khách sỉ lớn' },
    });
    expect(byCeo.status).toBe(200);
  });
});

describe('AC-09 · Công nợ vượt hạn mức', () => {
  it('đơn làm vượt hạn mức phải gửi đúng cấp duyệt (CEO)', async () => {
    await seedBusinessData(ctx.db);
    // cus-thao-2 dư nợ cũ 4.900.000đ, cấp Đại lý cấp 1 có hạn mức 5.000.000đ
    const created = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-2', items: [{ product_id: 'prod-full', qty: 10 }] },
    });
    const submitted = await ctx.request(`/api/orders/${created.body.data.id}/submit`, {
      as: USERS.thao,
      body: {},
    });
    const debtRule = submitted.body.data.approvals.find((a: { rule_code: string }) =>
      a.rule_code.includes('DEBT'),
    );
    expect(debtRule).toBeTruthy();
    expect(debtRule.required_role).toBe('CEO');

    const detail = await ctx.request(`/api/orders/${created.body.data.id}`, { as: USERS.thao });
    expect(detail.body.data.approval_status).toBe('PENDING_APPROVAL');
  });
});

describe('AC-10 · Chăm sóc thiếu lịch tiếp', () => {
  it('lưu activity mà thiếu lịch tiếp thì bị chặn', async () => {
    await seedBusinessData(ctx.db);
    const res = await ctx.request('/api/customers/cus-thao-1/activities', {
      as: USERS.thao,
      body: { channel: 'Gọi điện', result: 'Đã trao đổi', content: 'Khách nói để xem lại' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.next_date).toBeTruthy();
  });

  it('đóng khách kèm mã lý do thì được lưu', async () => {
    await seedBusinessData(ctx.db);
    const res = await ctx.request('/api/customers/cus-thao-1/activities', {
      as: USERS.thao,
      body: {
        channel: 'Gọi điện',
        result: 'Mất khách',
        content: 'Khách đã ký với nhà phân phối khác',
        reason_code: 'DA_CO_NPP_KHAC',
      },
    });
    expect(res.status).toBe(201);
    const detail = await ctx.request('/api/customers/cus-thao-1', { as: USERS.thao });
    expect(detail.body.data.stage).toBe('LOST');
  });
});

describe('AC-11 · Payment trả nợ chung', () => {
  it('import khoản trả nợ chung vào hàng chờ, chưa trừ từng đơn', async () => {
    const bytes = buildWorkbookBytes();
    const preview = await ctx.request('/api/imports/preview', {
      as: USERS.manager,
      formData: workbookForm(bytes),
    });
    await ctx.request('/api/imports/commit', {
      as: USERS.manager,
      formData: workbookForm(bytes, { batch_id: preview.body.data.batch_id }),
    });

    const payments = await ctx.db.prepare('SELECT COUNT(*) AS n FROM payments').first<{ n: number }>();
    expect(payments?.n).toBe(26);

    const pending = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM payment_allocations_pending WHERE status = 'PENDING'`)
      .first<{ n: number }>();
    expect(pending?.n).toBe(16);

    const generalAllocations = await ctx.db
      .prepare(
        `SELECT COUNT(*) AS n FROM payment_allocations a
         JOIN payments p ON p.id = a.payment_id WHERE p.is_general_repayment = 1`,
      )
      .first<{ n: number }>();
    expect(generalAllocations?.n).toBe(0);

    const needsReview = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM payments WHERE review_status = 'NEEDS_REVIEW'`)
      .first<{ n: number }>();
    expect((needsReview?.n ?? 0)).toBeGreaterThanOrEqual(19); // 19 dòng thiếu mã phiếu thu
  });
});

describe('AC-12 · Audit khi đổi owner', () => {
  it('ghi đủ before/after, actor, thời gian, lý do và request_id', async () => {
    await seedBusinessData(ctx.db);
    await ctx.request('/api/customers/cus-thao-1/reassign', {
      as: USERS.manager,
      body: { owner_id: 'user-huyen', reason: 'Chuyển theo địa bàn' },
    });

    const audit = await ctx.request('/api/audit?entity_type=CUSTOMER&entity_id=cus-thao-1', {
      as: USERS.ceo,
    });
    const entry = audit.body.data.find((a: { action: string }) => a.action === 'CUSTOMER_REASSIGNED');
    expect(entry.actor_name).toContain('Quản lý');
    expect(JSON.parse(entry.before_json).owner_id).toBe('user-thao');
    expect(JSON.parse(entry.after_json).owner_id).toBe('user-huyen');
    expect(entry.reason).toBe('Chuyển theo địa bàn');
    expect(entry.request_id).toBeTruthy();
    expect(entry.created_at).toBeTruthy();
  });
});

describe('AC-13 · Idempotency', () => {
  it('gửi tạo đơn hai lần với cùng Idempotency-Key chỉ tạo một bản ghi', async () => {
    await seedBusinessData(ctx.db);
    const body = { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 3 }] };
    const key = 'test-key-order-001';

    const first = await ctx.request('/api/orders', { as: USERS.thao, body, idempotencyKey: key });
    const second = await ctx.request('/api/orders', { as: USERS.thao, body, idempotencyKey: key });

    expect(first.body.data.id).toBe(second.body.data.id);
    const count = await ctx.db.prepare('SELECT COUNT(*) AS n FROM orders').first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it('tạo khách hai lần cùng key cũng chỉ tạo một khách', async () => {
    const body = { name: 'Khách idempotent', phone_text: '0933333333' };
    const key = 'test-key-customer-001';
    const first = await ctx.request('/api/customers', { as: USERS.thao, body, idempotencyKey: key });
    const second = await ctx.request('/api/customers', { as: USERS.thao, body, idempotencyKey: key });
    expect(first.body.data.id).toBe(second.body.data.id);

    const count = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM customers WHERE name = 'Khách idempotent'`)
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it('dùng lại key cho nội dung khác thì bị từ chối', async () => {
    await seedBusinessData(ctx.db);
    const key = 'test-key-conflict';
    await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 1 }] },
      idempotencyKey: key,
    });
    const res = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 9 }] },
      idempotencyKey: key,
    });
    expect(res.status).toBe(409);
  });

  it('import cùng một file hai lần không tạo payment trùng', async () => {
    const bytes = buildWorkbookBytes();
    const p1 = await ctx.request('/api/imports/preview', {
      as: USERS.manager,
      formData: workbookForm(bytes),
    });
    await ctx.request('/api/imports/commit', {
      as: USERS.manager,
      formData: workbookForm(bytes, { batch_id: p1.body.data.batch_id }),
    });
    const p2 = await ctx.request('/api/imports/preview', {
      as: USERS.manager,
      formData: workbookForm(bytes),
    });
    const secondCommit = await ctx.request('/api/imports/commit', {
      as: USERS.manager,
      formData: workbookForm(bytes, { batch_id: p2.body.data.batch_id }),
    });
    expect(secondCommit.status).toBe(200);

    const payments = await ctx.db.prepare('SELECT COUNT(*) AS n FROM payments').first<{ n: number }>();
    expect(payments?.n).toBe(26); // external_row_key chống trùng
    const customers = await ctx.db.prepare('SELECT COUNT(*) AS n FROM customers').first<{ n: number }>();
    expect(customers?.n).toBe(62);
  });
});

describe('Rollback batch import', () => {
  it('rollback xoá dữ liệu của batch và giữ lại lịch sử', async () => {
    const bytes = buildWorkbookBytes();
    const preview = await ctx.request('/api/imports/preview', {
      as: USERS.manager,
      formData: workbookForm(bytes),
    });
    const batchId = preview.body.data.batch_id;
    await ctx.request('/api/imports/commit', {
      as: USERS.manager,
      formData: workbookForm(bytes, { batch_id: batchId }),
    });

    const res = await ctx.request(`/api/imports/${batchId}/rollback`, {
      as: USERS.manager,
      method: 'POST',
    });
    expect(res.status).toBe(200);

    const orders = await ctx.db.prepare('SELECT COUNT(*) AS n FROM orders').first<{ n: number }>();
    expect(orders?.n).toBe(0);
    const customers = await ctx.db.prepare('SELECT COUNT(*) AS n FROM customers').first<{ n: number }>();
    expect(customers?.n).toBe(0);
    const batch = await ctx.db
      .prepare('SELECT status FROM import_batches WHERE id = ?')
      .bind(batchId)
      .first<{ status: string }>();
    expect(batch?.status).toBe('ROLLED_BACK');
  });
});

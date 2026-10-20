import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

describe('Thêm / xóa sản phẩm', () => {
  it('thêm sản phẩm rồi xóa mềm: biến khỏi bảng giá; xóa lại báo không tìm thấy', async () => {
    const add = await ctx.request('/api/products', { as: USERS.ceo, body: { sku: 'XOA-TEST', name: 'Sản phẩm xóa thử 1 lít', unit: 'Chai' } });
    expect(add.status).toBe(200);
    const id = add.body.data.id as string;
    const before = await ctx.request('/api/prices?limit=1000', { as: USERS.ceo });
    expect(before.body.data.products.some((p: { sku: string }) => p.sku === 'XOA-TEST')).toBe(true);
    const del = await ctx.request(`/api/products/${id}`, { as: USERS.ceo, method: 'DELETE' });
    expect(del.status).toBe(200);
    const after = await ctx.request('/api/prices?limit=1000', { as: USERS.ceo });
    expect(after.body.data.products.some((p: { sku: string }) => p.sku === 'XOA-TEST')).toBe(false);
    expect((await ctx.request(`/api/products/${id}`, { as: USERS.ceo, method: 'DELETE' })).status).toBe(404);
  });

  it('sale thường không xóa được sản phẩm', async () => {
    const r = await ctx.request('/api/products/prod-full', { as: USERS.thao, method: 'DELETE' });
    expect(r.status).toBe(403);
  });
});

describe('Ảnh sản phẩm', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  it('tải ảnh lên, danh sách có ảnh, lấy lại được, xóa được', async () => {
    const up = await ctx.request('/api/products/prod-full/photo', { as: USERS.ceo, method: 'PUT', body: { image: PNG } });
    expect(up.status).toBe(200);
    const list = await ctx.request('/api/products/photos', { as: USERS.ceo });
    expect(list.body.data.map((r: { product_id: string }) => r.product_id)).toContain('prod-full');
    const bad = await ctx.request('/api/products/prod-full/photo', { as: USERS.ceo, method: 'PUT', body: { image: 'not-an-image' } });
    expect(bad.status).toBe(400);
    expect((await ctx.request('/api/products/prod-full/photo', { as: USERS.thao, method: 'PUT', body: { image: PNG } })).status).toBe(403);
    await ctx.request('/api/products/prod-full/photo', { as: USERS.ceo, method: 'DELETE' });
    const after = await ctx.request('/api/products/photos', { as: USERS.ceo });
    expect(after.body.data.length).toBe(0);
  });
});

describe('NPP có bảng giá riêng: mã không có trong bảng riêng tính theo cấp', () => {
  it('có mã trong bảng riêng thì dùng giá riêng, không có thì dùng giá cấp', async () => {
    const prev = async () => {
      const r = await ctx.request('/api/orders/preview', {
        as: USERS.thao,
        body: { customer_id: 'cus-thao-1', order_date: '2026-10-14', items: [{ product_id: 'prod-full', qty: 1 }] },
      });
      expect(r.status).toBe(200);
      return r.body.data.lines[0] as { base_price: number | null };
    };
    const tierPrice = (await prev()).base_price;
    expect(tierPrice).toBeGreaterThan(0);
    await ctx.db.prepare("UPDATE customers SET price_mode = 'CUSTOM' WHERE id = 'cus-thao-1'").run();
    // Chưa có trong bảng riêng: vẫn ra giá cấp của khách.
    expect((await prev()).base_price).toBe(tierPrice);
    await ctx.db
      .prepare(
        `INSERT INTO customer_prices (id, customer_id, product_id, amount, valid_from, valid_to, created_at, updated_at)
         VALUES ('cp-test', 'cus-thao-1', 'prod-full', 12345, '2026-01-01', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
      )
      .run();
    expect((await prev()).base_price).toBe(12345);
  });
});

describe('Quyền duyệt giá cấp thêm cho quản lý', () => {
  it('quản lý được cấp price.approve thì sửa giá có hiệu lực ngay, không phải chờ CEO', async () => {
    const tier = await ctx.db.prepare("SELECT id FROM price_tiers WHERE code = 'BAN_LE'").first<{ id: string }>();
    const body = { product_id: 'prod-full', tier_id: tier!.id, amount: 77700, valid_from: '2026-10-01' };
    // Chưa có quyền duyệt: chờ CEO.
    const before = await ctx.request('/api/prices', { as: USERS.manager, body });
    expect(before.status).toBe(200);
    expect(before.body.data.status).toBe('DRAFT');
    await ctx.db
      .prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) SELECT id, 'price.approve', id, '2026-10-17T00:00:00Z' FROM users WHERE email = ?")
      .bind(USERS.manager)
      .run();
    const after = await ctx.request('/api/prices', { as: USERS.manager, body: { ...body, amount: 88800, valid_from: '2026-10-02' } });
    expect(after.status).toBe(200);
    expect(after.body.data.status).toBe('ACTIVE');
  });
});

describe('Duyệt yêu cầu vượt ngưỡng Quản lý', () => {
  it('quản lý được cấp order.approve.exception thì duyệt được yêu cầu cấp CEO', async () => {
    const mk = async () => {
      const id = `ap-${Math.random().toString(36).slice(2, 8)}`;
      await ctx.db
        .prepare(
          `INSERT INTO approvals (id, entity_type, entity_id, rule_code, requester_id, required_role, status, reason, created_at)
           VALUES (?, 'OTHER', 'x', 'PRICE_OVERRIDE', 'user-thao', 'CEO', 'PENDING', 'test', '2026-10-16T00:00:00Z')`,
        )
        .bind(id)
        .run();
      return id;
    };
    const id1 = await mk();
    const denied = await ctx.request(`/api/approvals/${id1}/decide`, { as: USERS.manager, body: { decision: 'APPROVED' } });
    expect(denied.status).toBe(403);
    await ctx.db
      .prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) SELECT id, 'order.approve.exception', id, '2026-10-17T00:00:00Z' FROM users WHERE email = ?")
      .bind(USERS.manager)
      .run();
    const ok = await ctx.request(`/api/approvals/${id1}/decide`, { as: USERS.manager, body: { decision: 'APPROVED' } });
    expect(ok.status).toBe(200);
  });
});

import { effectivePermissions } from '../../src/shared/permissions';
describe('Dấu chỉ Marketing và quyền kho', () => {
  it('chỉ Marketing thì còn mỗi quyền vào hub; có quyền kho thì giữ quyền kho', () => {
    expect(effectivePermissions('EMPLOYEE', ['hub.only', 'hub.access'])).toEqual(['hub.access']);
    const wh = effectivePermissions('EMPLOYEE', ['hub.only', 'hub.access', 'order.kho.process', 'sx.kiemke']);
    expect(wh).toContain('order.kho.process');
    expect(wh).toContain('sx.kiemke');
  });
});

describe('Vật tư bán kèm cho khách gia công', () => {
  it('tìm vật tư trong kho, thêm vào đơn với giá tự điền, không hiện trong bảng giá', async () => {
    await ctx.db.prepare("UPDATE customers SET price_mode = 'CUSTOM' WHERE id = 'cus-thao-1'").run();
    await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, created_at) VALUES ('VO-THUNG-20', 'Vỏ thùng carton 20 chai', 'Cái', 'NVL', 'vỏ thùng', '2026-10-01T00:00:00Z')").run();
    const found = await ctx.request('/api/supplies?q=th%C3%B9ng', { as: USERS.thao });
    expect(found.status).toBe(200);
    expect(found.body.data.some((x: { code: string }) => x.code === 'VO-THUNG-20')).toBe(true);
    const ens = await ctx.request('/api/supplies/ensure', { as: USERS.thao, body: { code: 'VO-THUNG-20' } });
    expect(ens.status).toBe(200);
    const pid = ens.body.data.id as string;
    // Kho tự trừ đúng mã vật tư khi xuất.
    const map = await ctx.db.prepare("SELECT misa_code FROM kho_map WHERE crm_sku = 'VO-THUNG-20'").first<{ misa_code: string }>();
    expect(map?.misa_code).toBe('VO-THUNG-20');
    // Thiếu giá thì báo, có giá thì lưu đúng giá đã điền.
    const noPrice = await ctx.request('/api/orders', { as: USERS.thao, body: { customer_id: 'cus-thao-1', order_date: '2026-10-19', items: [{ product_id: pid, qty: 10 }] } });
    expect(noPrice.status).toBe(422);
    const ok = await ctx.request('/api/orders', { as: USERS.thao, body: { customer_id: 'cus-thao-1', order_date: '2026-10-19', items: [{ product_id: pid, qty: 10, applied_price: 4500 }] } });
    expect(ok.status).toBe(201);
    const d = await ctx.request(`/api/orders/${ok.body.data.id}`, { as: USERS.thao });
    expect(d.body.data.items[0].applied_price).toBe(4500);
    expect(d.body.data.total_amount).toBe(45000);
    // Không lẫn vào bảng giá.
    const tbl = await ctx.request('/api/prices?limit=1000', { as: USERS.ceo });
    expect(tbl.body.data.products.some((p: { sku: string }) => p.sku === 'VO-THUNG-20')).toBe(false);
  });
});

describe('Khách NPP lên cấp: đơn đạt thì đổi luôn, chưa đạt thì xin Quản lý duyệt', () => {
  async function tiers() {
    const cur = await ctx.db.prepare("SELECT t.rank, c.tier_id FROM customers c JOIN price_tiers t ON t.id = c.tier_id WHERE c.id = 'cus-thao-1'").first<{ rank: number; tier_id: string }>();
    const up = await ctx.db.prepare("SELECT id FROM price_tiers WHERE code <> 'KHAC' AND rank < ? ORDER BY rank DESC LIMIT 1").bind(cur!.rank).first<{ id: string }>();
    return { cur: cur!, up: up! };
  }

  it('đơn đạt điều kiện: sale lên cấp ngay trên đơn, hồ sơ khách đổi theo, có nhật ký', async () => {
    const { cur, up } = await tiers();
    await ctx.db.prepare("INSERT INTO tier_upgrade_rules (tier_id, min_order_amount, updated_at) VALUES (?, 1000, '2026-10-20T00:00:00Z')").bind(up.id).run();
    const base = { customer_id: 'cus-thao-1', order_date: '2026-10-19', items: [{ product_id: 'prod-full', qty: 2 }], customer_tier_id: up.id };
    const ok = await ctx.request('/api/orders', { as: USERS.thao, body: base });
    expect(ok.status).toBe(201);
    expect(ok.body.data.tier_request).toBe(false);
    const t1 = await ctx.db.prepare("SELECT tier_id FROM customers WHERE id = 'cus-thao-1'").first<{ tier_id: string }>();
    expect(t1?.tier_id).toBe(up.id);
    const log = await ctx.db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'CUSTOMER_TIER_CHANGED' AND entity_id = 'cus-thao-1'").first<{ n: number }>();
    expect(log?.n).toBe(1);
    expect(cur.tier_id).not.toBe(up.id);
  });

  it('đơn chưa đạt: vẫn tạo được đơn nháp (giá cấp mới, gửi khách được), gửi yêu cầu xin duyệt; chưa gửi duyệt đơn được; quản lý duyệt thì cấp đổi và đơn gửi duyệt được', async () => {
    const { cur, up } = await tiers();
    await ctx.db.prepare("INSERT INTO tier_upgrade_rules (tier_id, min_order_amount, updated_at) VALUES (?, 999999999, '2026-10-20T00:00:00Z')").bind(up.id).run();
    const base = { customer_id: 'cus-thao-1', order_date: '2026-10-19', items: [{ product_id: 'prod-full', qty: 2 }], customer_tier_id: up.id };
    const created = await ctx.request('/api/orders', { as: USERS.thao, body: base });
    expect(created.status).toBe(201);
    expect(created.body.data.tier_request).toBe(true);
    // Khách chưa đổi cấp; có đúng một yêu cầu chờ duyệt.
    const t0 = await ctx.db.prepare("SELECT tier_id FROM customers WHERE id = 'cus-thao-1'").first<{ tier_id: string }>();
    expect(t0?.tier_id).toBe(cur.tier_id);
    const pend = await ctx.db.prepare("SELECT id FROM approvals WHERE entity_type = 'CUSTOMER_TIER' AND status = 'PENDING'").all<{ id: string }>();
    expect(pend.results).toHaveLength(1);
    // Đơn nháp thì đọc / in được, nhưng chưa gửi duyệt được.
    const sub = await ctx.request(`/api/orders/${created.body.data.id}/submit`, { as: USERS.thao, body: {} });
    expect(sub.status).toBe(422);
    expect(sub.body.error.code).toBe('TIER_PENDING');
    // Sale không tự duyệt được yêu cầu; quản lý duyệt thì khách đổi cấp.
    const own = await ctx.request(`/api/approvals/${pend.results![0].id}/decide`, { as: USERS.thao, body: { decision: 'APPROVED' } });
    expect(own.status).toBe(403);
    const ok = await ctx.request(`/api/approvals/${pend.results![0].id}/decide`, { as: USERS.manager, body: { decision: 'APPROVED' } });
    expect(ok.status).toBe(200);
    const t1 = await ctx.db.prepare("SELECT tier_id FROM customers WHERE id = 'cus-thao-1'").first<{ tier_id: string }>();
    expect(t1?.tier_id).toBe(up.id);
    const sub2 = await ctx.request(`/api/orders/${created.body.data.id}/submit`, { as: USERS.thao, body: {} });
    expect(sub2.status).toBe(200);
  });

  it('ở hồ sơ khách: sale không tự đổi cấp nhưng xin được; không tạo trùng; quản lý đổi thẳng', async () => {
    const { cur, up } = await tiers();
    const direct = await ctx.request('/api/customers/cus-thao-1', { as: USERS.thao, method: 'PATCH', body: { tier_id: up.id } });
    expect(direct.status).toBe(403);
    const r1 = await ctx.request('/api/customers/cus-thao-1/tier-request', { as: USERS.thao, body: { tier_id: up.id, reason: 'NPP nhập nhiều' } });
    expect(r1.status).toBe(200);
    expect(r1.body.data.duplicate).toBe(false);
    const r2 = await ctx.request('/api/customers/cus-thao-1/tier-request', { as: USERS.thao, body: { tier_id: up.id } });
    expect(r2.body.data.duplicate).toBe(true);
    const profileMgr = await ctx.request('/api/customers/cus-thao-1', { as: USERS.manager, method: 'PATCH', body: { tier_id: up.id } });
    expect(profileMgr.status).toBe(200);
    expect(cur.tier_id).not.toBe(up.id);
  });
  it('điều kiện lên cấp: quản lý điền trong bảng giá, sale không sửa được; điền rồi thì đơn đạt tự đổi cấp', async () => {
    const { up } = await tiers();
    const denied = await ctx.request(`/api/tiers/${up.id}/upgrade-rule`, { as: USERS.thao, method: 'PUT', body: { min_order_amount: 1000 } });
    expect(denied.status).toBe(403);
    const bad = await ctx.request(`/api/tiers/${up.id}/upgrade-rule`, { as: USERS.manager, method: 'PUT', body: { min_order_amount: -5 } });
    expect(bad.status).toBe(400);
    const ok = await ctx.request(`/api/tiers/${up.id}/upgrade-rule`, { as: USERS.manager, method: 'PUT', body: { min_order_amount: 1000 } });
    expect(ok.status).toBe(200);
    const list = await ctx.request('/api/tiers', { as: USERS.thao });
    expect(list.body.data.find((x: { id: string }) => x.id === up.id).min_order_amount).toBe(1000);
    const order = await ctx.request('/api/orders', { as: USERS.thao, body: { customer_id: 'cus-thao-1', order_date: '2026-10-19', items: [{ product_id: 'prod-full', qty: 2 }], customer_tier_id: up.id } });
    expect(order.status).toBe(201);
    expect(order.body.data.tier_request).toBe(false);
  });
  it('cấp Nhân viên: mã chưa có giá thì gõ giá trực tiếp trên đơn, không cần duyệt; có giá ở bảng giá thì lấy giá đó; không tính vào cảnh báo thiếu giá', async () => {
    const tier = await ctx.db.prepare("SELECT id FROM price_tiers WHERE code = 'NHAN_VIEN'").first<{ id: string }>();
    expect(tier).toBeTruthy();
    await ctx.db.prepare("UPDATE customers SET tier_id = ?, price_mode = 'TIER' WHERE id = 'cus-thao-1'").bind(tier!.id).run();
    const items = (price?: number) => [{ product_id: 'prod-full', qty: 3, ...(price ? { applied_price: price } : {}) }];
    const noPrice = await ctx.request('/api/orders', { as: USERS.manager, body: { customer_id: 'cus-thao-1', order_date: '2026-10-19', items: items() } });
    expect(noPrice.status).toBe(422);
    const typed = await ctx.request('/api/orders', { as: USERS.manager, body: { customer_id: 'cus-thao-1', order_date: '2026-10-19', items: items(80_000) } });
    expect(typed.status).toBe(201);
    const d = await ctx.request(`/api/orders/${typed.body.data.id}`, { as: USERS.manager });
    expect(d.body.data.total_amount).toBe(240_000);
    const sub = await ctx.request(`/api/orders/${typed.body.data.id}/submit`, { as: USERS.manager, body: {} });
    expect(sub.status).toBe(200);
    // Bảng giá không báo thiếu giá cấp Nhân viên.
    const tbl = await ctx.request('/api/prices?limit=1000', { as: USERS.ceo });
    const p = tbl.body.data.products.find((x: { sku: string }) => x.sku === 'TEST-FULL');
    expect(p?.missing_tiers ?? []).not.toContain('Nhân viên');
  });

  it('nhân viên mua hàng trừ lương: sale không lập đơn được; đơn đã xuất kho thì hiện theo mã nhân sự, chốt thì ghi Trừ lương, chốt lại không ghi trùng', async () => {
    const tier = await ctx.db.prepare("SELECT id FROM price_tiers WHERE code = 'NHAN_VIEN'").first<{ id: string }>();
    await ctx.db.prepare("UPDATE customers SET tier_id = ?, price_mode = 'TIER', staff_code = 'NS999' WHERE id = 'cus-thao-1'").bind(tier!.id).run();
    const body = { customer_id: 'cus-thao-1', order_date: '2026-10-19', items: [{ product_id: 'prod-full', qty: 2, applied_price: 50_000 }] };
    const denied = await ctx.request('/api/orders', { as: USERS.thao, body });
    expect(denied.status).toBe(403);
    const made = await ctx.request('/api/orders', { as: USERS.manager, body });
    expect(made.status).toBe(201);
    await ctx.db
      .prepare("UPDATE orders SET approval_status = 'APPROVED', delivery_status = 'DA_GIAO', delivered_at = '2026-10-19T03:00:00.000Z' WHERE id = ?")
      .bind(made.body.data.id)
      .run();
    const list = await ctx.request('/api/staff-purchases?month=2026-10', { as: USERS.ceo });
    expect(list.status).toBe(200);
    const row = list.body.data.find((x: { staff_code: string }) => x.staff_code === 'NS999');
    expect(row.total).toBe(100_000);
    const closed = await ctx.request('/api/staff-purchases/close', { as: USERS.ceo, body: { month: '2026-10' } });
    expect(closed.status).toBe(200);
    expect(closed.body.data.total).toBe(100_000);
    const again = await ctx.request('/api/staff-purchases/close', { as: USERS.ceo, body: { month: '2026-10' } });
    expect(again.body.data.total).toBe(0);
    const pay = await ctx.db.prepare("SELECT COUNT(*) AS n, SUM(amount) AS s FROM payments WHERE customer_id = 'cus-thao-1' AND method = 'Trừ lương'").first<{ n: number; s: number }>();
    expect(pay!.n).toBe(1);
    expect(pay!.s).toBe(100_000);
  });
});

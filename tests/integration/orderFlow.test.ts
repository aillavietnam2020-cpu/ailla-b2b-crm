import { beforeEach, describe, expect, it } from 'vitest';
import { pack, unpack } from '../../src/server/lib/pack';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const CHUC = 'chuc@ailla.vn';
const NOW = '2026-08-16T01:00:00.000Z';

/** Kho: 20 can thành phẩm, BTP/NVL/vỏ đủ làm thêm một ít; map mã CRM → mã kho. Bật luồng kho. */
async function seedKho() {
  const db = ctx.db;
  await db
    .prepare(
      `INSERT INTO users (id, email, display_name, role, status, created_at, updated_at)
       VALUES ('user-chuc', ?, 'Chúc kế toán kho (test)', 'EMPLOYEE', 'ACTIVE', ?, ?)`,
    )
    .bind(CHUC, NOW, NOW)
    .run();
  await db
    .prepare(
      `INSERT INTO user_permissions (user_id, permission, granted_by, created_at)
       VALUES ('user-chuc', 'order.kho.process', 'user-ceo', ?), ('user-chuc', 'hub.access', 'user-ceo', ?)`,
    )
    .bind(NOW, NOW)
    .run();

  const items: Array<[string, string, string, string]> = [
    ['TP-FULL', 'Nước giặt 5L (TP)', 'Can', 'TP'],
    ['BTP-1', 'BTP nước giặt', 'Lít', 'BTP'],
    ['NVL-1', 'Hóa chất A', 'Kg', 'NVL'],
    ['VO-1', 'Vỏ can 5L', 'Cái', 'NVL'],
  ];
  for (const [code, name, unit, cls] of items) {
    await db
      .prepare('INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(code, name, unit, cls, NOW)
      .run();
  }
  await db.prepare("INSERT INTO kho_bom (product, item, qty, kind) VALUES ('TP-FULL', 'BTP-1', 5, 'Bán thành phẩm')").run();
  await db.prepare("INSERT INTO kho_bom (product, item, qty, kind) VALUES ('TP-FULL', 'VO-1', 1, 'Vỏ can')").run();
  await db.prepare("INSERT INTO kho_bom (product, item, qty, kind) VALUES ('BTP-1', 'NVL-1', 0.3, 'NVL')").run();
  await db.prepare("INSERT INTO kho_map (crm_sku, misa_code, factor) VALUES ('TEST-FULL', 'TP-FULL', 1)").run();
  await db.prepare("INSERT INTO kho_cfg (k, v) VALUES ('b2b_from', '2026-01-01')").run();
  await db.prepare("INSERT INTO kho_cfg (k, v) VALUES ('flow_on', '1')").run();

  await db
    .prepare(
      `INSERT INTO kho_docs (no, type, doc_date, status, created_at) VALUES ('TD2608-001', 'TD', '2026-08-01', 'OK', ?)`,
    )
    .bind(NOW)
    .run();
  const doc = await db.prepare("SELECT id FROM kho_docs WHERE no = 'TD2608-001'").first<{ id: number }>();
  const moves: Array<[string, number]> = [
    ['TP-FULL', 20],
    ['BTP-1', 10],
    ['NVL-1', 100],
    ['VO-1', 100],
  ];
  for (const [item, qty] of moves) {
    await db
      .prepare("INSERT INTO kho_moves (doc_id, item, qty, role) VALUES (?, ?, ?, 'IN')")
      .bind(doc!.id, item, qty)
      .run();
  }
}

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
  await seedKho();
});

const baseOrder = (qty: number) => ({
  customer_id: 'cus-thao-1',
  order_date: '2026-08-16',
  items: [{ product_id: 'prod-full', qty }],
});

async function newOrder(qty = 10, as = USERS.thao, customer = 'cus-thao-1') {
  const created = await ctx.request('/api/orders', { as, body: { ...baseOrder(qty), customer_id: customer } });
  expect(created.status).toBe(201);
  return created.body.data.id as string;
}

async function status(id: string) {
  const d = await ctx.request(`/api/orders/${id}`, { as: USERS.ceo });
  return d.body.data;
}

const post = (id: string, path: string, as: string, body: unknown = {}) =>
  ctx.request(`/api/orders/${id}/flow/${path}`, { as, body });

describe('Luồng đơn B2B qua kho', () => {
  it('đi trọn luồng: gửi → điều phối → kho kiểm đủ → duyệt + lịch xuất → xuất → xác nhận → sửa đơn → chốt tiền → kế toán', async () => {
    const id = await newOrder(10);
    expect((await status(id)).flow_on).toBe(1);

    const submit = await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
    expect(submit.status).toBe(200);
    expect((await status(id)).kho_status).toBe('CHO_DIEU_PHOI');

    // Chỉ quản lý chuyển kho được.
    expect((await post(id, 'to-kho', USERS.thao)).status).toBe(403);
    expect((await post(id, 'to-kho', USERS.manager, { note: 'Khách cần gấp thứ 6' })).status).toBe(200);
    expect((await status(id)).kho_status).toBe('CHO_KIEM_KHO');

    // Kế toán kho thấy đơn của người khác và có số tồn.
    const chk = await ctx.request(`/api/orders/${id}/kho-check`, { as: CHUC });
    expect(chk.status).toBe(200);
    const line = chk.body.data.lines[0];
    expect(line.misa_code).toBe('TP-FULL');
    expect(line.stock).toBe(20);
    expect(line.available).toBe(20);
    expect(line.short).toBe(0);

    // Sale / quản lý không báo kết quả kho thay kho.
    const body = { lines: [{ product_id: 'prod-full', status: 'DU' }] };
    expect((await post(id, 'kho-report', USERS.thao, body)).status).toBe(403);
    expect((await post(id, 'kho-report', CHUC, body)).status).toBe(200);
    expect((await status(id)).kho_status).toBe('DU_HANG');

    // Quản lý duyệt + lịch xuất.
    const ap = await post(id, 'approve', USERS.manager, { ship_date: '2026-08-20' });
    expect(ap.status).toBe(200);
    let o = await status(id);
    expect(o.approval_status).toBe('APPROVED');
    expect(o.kho_status).toBe('CHO_XUAT');
    expect(o.ship_date).toBe('2026-08-20');

    // Hàng đã giữ: đơn khác thấy tồn còn dùng được giảm.
    const other = await newOrder(5);
    const chk2 = await ctx.request(`/api/orders/${other}/kho-check`, { as: CHUC });
    expect(chk2.body.data.lines[0].reserved).toBe(10);
    expect(chk2.body.data.lines[0].available).toBe(10);

    // Quản lý không bấm tắt "đã xuất kho" được cho đơn theo luồng kho.
    const shortcut = await ctx.request(`/api/orders/${id}/delivery`, {
      as: USERS.manager,
      body: { delivery_status: 'DA_XUAT_KHO' },
    });
    expect(shortcut.status).toBe(400);
    expect(shortcut.body.error.code).toBe('USE_FLOW_SHIP');

    // Kho xuất 9 can (thiếu 1).
    expect((await post(id, 'ship', USERS.manager, {})).status).toBe(403);
    const ship = await post(id, 'ship', CHUC, { lines: [{ product_id: 'prod-full', shipped_qty: 9 }] });
    expect(ship.status).toBe(200);
    expect(ship.body.data.diff).toEqual([
      expect.objectContaining({ sku: 'TEST-FULL', ordered: 10, shipped: 9 }),
    ]);
    o = await status(id);
    expect(o.kho_status).toBe('DA_XUAT');
    expect(o.delivery_status).toBe('DA_XUAT_KHO');

    // Tồn kho trừ theo SỐ THỰC XUẤT (9), không phải 10.
    const stock = await ctx.db
      .prepare("SELECT SUM(qty) AS s FROM kho_ledger WHERE item = 'TP-FULL'")
      .first<{ s: number }>();
    expect(stock?.s).toBe(11);

    // Kế toán chưa xác nhận được khi sale chưa chốt tiền.
    // Quản lý xác nhận đã xuất: số thực xuất tự áp vào đơn, sale được báo in lại phiếu gửi khách.
    const cf = await post(id, 'confirm-shipped', USERS.manager);
    expect(cf.status).toBe(200);
    expect(cf.body.data.diff).toHaveLength(0);
    expect(cf.body.data.adjusted).toEqual([
      expect.objectContaining({ sku: 'TEST-FULL', ordered: 10, shipped: 9 }),
    ]);
    const after = await status(id);
    expect(after.kho_status).toBe('CHO_CHOT_TIEN');
    expect(after.total_amount).toBe(9 * 125000);
    expect(after.items[0].qty).toBe(9);
    expect((after.revisions as Array<{ reason: string }>)[0].reason).toContain('Tự áp số thực xuất');
    const task = await ctx.db
      .prepare("SELECT title, status FROM tasks WHERE assignee_id = ? AND title LIKE '%in lại phiếu%'")
      .bind(after.owner_id)
      .first<{ title: string; status: string }>();
    expect(task?.status).toBe('OPEN');

    // Chưa chốt tiền thì kế toán chưa xác nhận được.
    const acctEarly = await ctx.request(`/api/orders/${id}/accounting`, {
      as: USERS.manager,
      body: { accounting_status: 'DA_XAC_NHAN' },
    });
    expect(acctEarly.status).toBe(400);
    expect(acctEarly.body.error.code).toBe('ORDER_MONEY_NOT_LOCKED');

    // Sale in lại phiếu cho khách rồi chốt tiền (không còn phải sửa đơn tay).
    expect((await post(id, 'lock-money', USERS.thao)).status).toBe(200);
    expect((await status(id)).kho_status).toBe('DA_CHOT_TIEN');

    const acct = await ctx.request(`/api/orders/${id}/accounting`, {
      as: USERS.manager,
      body: { accounting_status: 'DA_XAC_NHAN' },
    });
    expect(acct.status).toBe(200);

    // Lịch sử từng bước có đủ.
    const log = (await status(id)).flow_log as Array<{ action: string }>;
    const actions = log.map((l) => l.action);
    for (const a of ['GUI_DON', 'CHUYEN_KHO', 'KHO_BAO_DU', 'DUYET_LICH_XUAT', 'KHO_XUAT', 'XAC_NHAN_XUAT', 'CHOT_TIEN']) {
      expect(actions).toContain(a);
    }
  });

  it('duyệt thẳng không cần kho báo trên web, ngày hẹn không bắt buộc; đơn hiện ở danh sách chờ xuất', async () => {
    const id = await newOrder(5);
    expect((await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} })).status).toBe(200);
    // Chưa qua kiểm kho vẫn duyệt được, không cần ngày hẹn.
    const ap = await post(id, 'approve', USERS.manager, {});
    expect(ap.status).toBe(200);
    expect((await status(id)).kho_status).toBe('CHO_XUAT');
    const q = await ctx.request('/api/hub/kho/b2b-pending', { as: CHUC });
    expect(q.status).toBe(200);
    const row = q.body.data.find((o: { id: string }) => o.id === id);
    expect(row).toBeTruthy();
    expect(row.lines.length).toBeGreaterThan(0);
    // Sale thường không xem được danh sách này.
    expect((await ctx.request('/api/hub/kho/b2b-pending', { as: USERS.thao })).status).toBe(403);
    const ship = await post(id, 'ship', CHUC, { ship_day: '2026-08-14', shipped_by_name: 'Nguyễn Văn Kho' });
    expect(ship.status).toBe(200);
    const sh = await ctx.db.prepare('SELECT delivered_at, shipped_by_name FROM orders WHERE id = ?').bind(id).first<{ delivered_at: string; shipped_by_name: string }>();
    expect(sh!.delivered_at.slice(0, 10)).toBe('2026-08-14');
    expect(sh!.shipped_by_name).toBe('Nguyễn Văn Kho');
    // Người duyệt sửa lại ngày xuất; sale thường không sửa được; không được ghi ngày tương lai.
    expect((await ctx.request(`/api/orders/${id}/ship-info`, { as: USERS.thao, body: { ship_day: '2026-08-13', shipped_by_name: 'Kho A' } })).status).toBe(403);
    expect((await ctx.request(`/api/orders/${id}/ship-info`, { as: USERS.manager, body: { ship_day: '2999-01-01', shipped_by_name: 'Kho A' } })).status).toBe(422);
    const ed = await ctx.request(`/api/orders/${id}/ship-info`, { as: USERS.manager, body: { ship_day: '2026-08-13', shipped_by_name: 'Kho A', note: 'xuất hôm trước' } });
    expect(ed.status).toBe(200);
    const sh2 = await ctx.db.prepare('SELECT delivered_at, shipped_by_name FROM orders WHERE id = ?').bind(id).first<{ delivered_at: string; shipped_by_name: string }>();
    expect(sh2!.delivered_at.slice(0, 10)).toBe('2026-08-13');
    // Kho (Chúc) không tự sửa ngày xuất: gửi yêu cầu có lý do; quản lý tự sửa thì áp ngay.
    expect((await ctx.request(`/api/orders/${id}/ship-info`, { as: CHUC, body: { ship_day: '2026-08-12', shipped_by_name: 'Kho A' } })).status).toBe(403);
    const askDay = await ctx.request(`/api/orders/${id}/ship-edits`, { as: CHUC, body: { ship_day: '2026-08-12', reason: 'xuất sớm hơn một ngày' } });
    expect(askDay.status).toBe(200);
    expect(askDay.body.data.applied).toBe(false);
    expect((await ctx.request(`/api/orders/ship-edits/${askDay.body.data.id}/decide`, { as: USERS.manager, body: { decision: 'APPROVED' } })).status).toBe(200);
    const sh3 = await ctx.db.prepare('SELECT delivered_at FROM orders WHERE id = ?').bind(id).first<{ delivered_at: string }>();
    expect(sh3!.delivered_at.slice(0, 10)).toBe('2026-08-12');
    const self = await ctx.request(`/api/orders/${id}/ship-edits`, { as: USERS.manager, body: { ship_day: '2026-08-11', reason: 'sửa lại cho đúng ngày thực' } });
    expect(self.body.data.applied).toBe(true);
    const sh4 = await ctx.db.prepare('SELECT delivered_at FROM orders WHERE id = ?').bind(id).first<{ delivered_at: string }>();
    expect(sh4!.delivered_at.slice(0, 10)).toBe('2026-08-11');
    expect(sh2!.shipped_by_name).toBe('Kho A');
    const q2 = await ctx.request('/api/hub/kho/b2b-pending', { as: CHUC });
    expect(q2.body.data.some((o: { id: string }) => o.id === id)).toBe(false);
  });

  it('xuất đúng đơn: tự chốt tiền và vào công nợ; xuất lệch: chờ sale xử lý, sale đồng ý thì đơn sửa theo số thực xuất', async () => {
    const mk = async (qty: number) => {
      const id = await newOrder(qty);
      await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
      expect((await post(id, 'approve', USERS.manager, {})).status).toBe(200);
      return id;
    };
    // Khớp đơn
    const a = await mk(4);
    const r1 = await post(a, 'ship', CHUC, { ship_day: '2026-08-14', shipped_by_name: 'Kho A' });
    expect(r1.status).toBe(200);
    expect(r1.body.data.kho_status).toBe('DA_CHOT_TIEN');
    const sa = await ctx.db.prepare('SELECT accounting_status, accounting_auto FROM orders WHERE id = ?').bind(a).first<{ accounting_status: string; accounting_auto: number }>();
    expect(sa!.accounting_status).toBe('DA_XAC_NHAN');
    expect(sa!.accounting_auto).toBe(1);

    // Lệch đơn: giữ nguyên tiền, báo sale
    const b = await mk(5);
    const items = (await ctx.request(`/api/orders/${b}`, { as: USERS.thao })).body.data.items as Array<{ product_id: string; qty: number }>;
    const r2 = await post(b, 'ship', CHUC, { ship_day: '2026-08-14', shipped_by_name: 'Kho A', lines: [{ product_id: items[0].product_id, shipped_qty: items[0].qty - 1 }] });
    expect(r2.status).toBe(200);
    expect(r2.body.data.kho_status).toBe('DA_XUAT');
    expect(r2.body.data.diff.length).toBe(1);
    const before = await ctx.db.prepare('SELECT total_amount, accounting_status FROM orders WHERE id = ?').bind(b).first<{ total_amount: number; accounting_status: string }>();
    expect(before!.accounting_status).toBe('CHUA_XAC_NHAN');
    const task = await ctx.db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE title LIKE 'Kho xuất lệch đơn%'").first<{ n: number }>();
    expect(task!.n).toBeGreaterThan(0);
    // Sale phụ trách đồng ý: đơn sửa theo số thực xuất, vào công nợ.
    const acc = await post(b, 'accept-shipped', USERS.thao, {});
    expect(acc.status).toBe(200);
    const after = await ctx.db.prepare('SELECT total_amount, accounting_status, kho_status FROM orders WHERE id = ?').bind(b).first<{ total_amount: number; accounting_status: string; kho_status: string }>();
    expect(after!.kho_status).toBe('DA_CHOT_TIEN');
    expect(after!.accounting_status).toBe('DA_XAC_NHAN');
    expect(after!.total_amount).toBeLessThan(before!.total_amount);
  });

  it('kho báo thiếu: tính khả năng sản xuất, sale sửa đơn rồi gửi lại; hoặc giữ chờ hàng', async () => {
    const id = await newOrder(30);
    await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
    await post(id, 'to-kho', USERS.manager);

    const chk = await ctx.request(`/api/orders/${id}/kho-check`, { as: CHUC });
    const l = chk.body.data.lines[0];
    expect(l.available).toBe(20);
    expect(l.short).toBe(10);
    // BTP còn 10 lít (2 can) + NVL 100kg làm thêm 333 lít BTP; vỏ 100 → làm được nhiều hơn 10.
    expect(l.can_make).toBeGreaterThanOrEqual(10);
    expect(l.missing_components).toHaveLength(0);

    const rep = await post(id, 'kho-report', CHUC, {
      lines: [{ product_id: 'prod-full', status: 'THIEU', ok_qty: 20, eta_date: '2026-08-25', note: 'Sản xuất xong 25/8' }],
    });
    expect(rep.status).toBe(200);
    expect((await status(id)).kho_status).toBe('THIEU_HANG');

    // Nhánh 1: khách đổi đơn → sale sửa → gửi lại.
    const edit = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: USERS.thao,
      body: { items: [{ product_id: 'prod-full', qty: 20 }], reason: 'Khách lấy bớt còn 20 can' },
    });
    expect(edit.status).toBe(200);
    expect((await post(id, 'send', USERS.thao)).status).toBe(200);
    expect((await status(id)).kho_status).toBe('CHO_DIEU_PHOI');

    // Nhánh 2: giữ chờ hàng (đơn khác).
    const id2 = await newOrder(30);
    await ctx.request(`/api/orders/${id2}/submit`, { as: USERS.thao, body: {} });
    await post(id2, 'to-kho', USERS.manager);
    await post(id2, 'kho-report', CHUC, {
      lines: [{ product_id: 'prod-full', status: 'THIEU', ok_qty: 20, note: 'hết' }],
    });
    expect((await post(id2, 'hold', USERS.thao, { hold_until: '2099-01-01' })).status).toBe(403);
    expect((await post(id2, 'hold', USERS.manager, { hold_until: '2099-01-01' })).status).toBe(200);
    expect((await status(id2)).kho_status).toBe('CHO_HANG');

    // Danh sách "cần sản xuất" cho quản lý.
    const sum = await ctx.request('/api/orders/flow/summary', { as: USERS.manager });
    expect(sum.body.data.counts.CHO_HANG).toBe(1);
    expect(sum.body.data.shortages[0].sku).toBe('TEST-FULL');
    expect(sum.body.data.shortages[0].short).toBeGreaterThanOrEqual(10);
  });

  it('tạo lệnh sản xuất từ mã đang thiếu: ghi phiếu vào ngăn Sản xuất, không tạo trùng', async () => {
    const id = await newOrder(30);
    await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
    await post(id, 'to-kho', USERS.manager);
    await post(id, 'kho-report', CHUC, {
      lines: [{ product_id: 'prod-full', status: 'THIEU', ok_qty: 20, note: 'hết' }],
    });
    await post(id, 'hold', USERS.manager, { hold_until: '2099-01-01' });

    // Chưa mở ngăn Sản xuất thì báo rõ, không tự tạo.
    const early = await ctx.request('/api/orders/flow/production-requests', {
      as: USERS.manager,
      body: { items: [{ sku: 'TEST-FULL' }] },
    });
    expect(early.status).toBe(409);

    await ctx.db
      .prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('sx', 1, ?, ?)")
      .bind(await pack(JSON.stringify({ requests: [], log: [] })), NOW)
      .run();

    // Sale không có quyền duyệt thì không làm được lệnh sản xuất.
    const denied = await ctx.request('/api/orders/flow/production-requests', {
      as: USERS.thao,
      body: { items: [{ sku: 'TEST-FULL' }] },
    });
    expect(denied.status).toBe(403);

    const r1 = await ctx.request('/api/orders/flow/production-requests', {
      as: USERS.manager,
      body: { items: [{ sku: 'TEST-FULL' }, { sku: 'KHONG-THIEU' }] },
    });
    expect(r1.status).toBe(200);
    expect(r1.body.data.created).toHaveLength(1);
    expect(r1.body.data.created[0]).toMatchObject({ sku: 'TEST-FULL', item: 'TP-FULL' });
    expect(r1.body.data.created[0].qty).toBeGreaterThanOrEqual(10);
    expect(r1.body.data.skipped[0].sku).toBe('KHONG-THIEU');

    const row = await ctx.db.prepare("SELECT version, data FROM hub_state WHERE id = 'sx'").first<{ version: number; data: string }>();
    expect(row!.version).toBe(2);
    const sx = JSON.parse(await unpack(row!.data));
    expect(sx.requests).toHaveLength(1);
    expect(sx.requests[0]).toMatchObject({ sp: 'TP-FULL', st: 'CAN_LAM', nguon: 'Đơn B2B' });
    expect(sx.requests[0].id).toMatch(/^PSX\d{4}-001$/);

    // Bấm lần nữa: đã có lệnh mở thì bỏ qua.
    const r2 = await ctx.request('/api/orders/flow/production-requests', {
      as: USERS.manager,
      body: { items: [{ sku: 'TEST-FULL' }] },
    });
    expect(r2.body.data.created).toHaveLength(0);
    expect(r2.body.data.skipped[0].code).toBe(sx.requests[0].id);
  });

  it('kho sửa số thực xuất sau khi đã chốt tiền và kế toán đã xác nhận: tồn, đơn, tiền đổi theo', async () => {
    const id = await newOrder(10);
    await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
    await post(id, 'to-kho', USERS.manager);
    await post(id, 'kho-report', CHUC, { lines: [{ product_id: 'prod-full', status: 'DU' }] });
    await post(id, 'approve', USERS.manager, { ship_date: '2026-08-20' });
    const sku = [{ product_id: 'prod-full', shipped_qty: 10 }];
    const stockNow = async () =>
      (await ctx.db.prepare("SELECT SUM(qty) AS s FROM kho_ledger WHERE item = 'TP-FULL'").first<{ s: number }>())!.s;

    // Chưa xuất thì chưa sửa được.
    const early = await post(id, 'correct-shipped', USERS.manager, { lines: sku, reason: 'thử sửa sớm' });
    expect(early.status).toBe(400);

    await post(id, 'ship', CHUC, { lines: sku });
    await post(id, 'confirm-shipped', USERS.manager);
    await post(id, 'lock-money', USERS.thao);
    expect(
      (await ctx.request(`/api/orders/${id}/accounting`, { as: USERS.manager, body: { accounting_status: 'DA_XAC_NHAN' } })).status,
    ).toBe(200);
    expect(await stockNow()).toBe(10);
    const before = await status(id);
    expect(before.kho_status).toBe('DA_CHOT_TIEN');
    expect(before.accounting_status).toBe('DA_XAC_NHAN');

    // Kho không tự sửa: gửi yêu cầu kèm lý do, quản lý điều phối duyệt mới sửa thật. Sale thường không gửi được.
    const fix = { lines: [{ product_id: 'prod-full', shipped_qty: 8 }], reason: 'Gửi nhầm 2 can sang đơn khác' };
    const reqSed = (as: string, body: unknown) => ctx.request(`/api/orders/${id}/ship-edits`, { as, body });
    expect((await post(id, 'correct-shipped', USERS.thao, fix)).status).toBe(403);
    expect((await post(id, 'correct-shipped', CHUC, fix)).status).toBe(403);
    expect((await reqSed(USERS.thao, fix)).status).toBe(403);
    expect((await reqSed(CHUC, { ...fix, reason: 'ab' })).status).toBe(422);
    expect((await reqSed(CHUC, { reason: 'không có gì để sửa' })).status).toBe(400);

    const asked = await reqSed(CHUC, fix);
    expect(asked.status).toBe(200);
    expect(asked.body.data.applied).toBe(false);
    // Chưa duyệt thì chưa đổi gì; không gửi chồng yêu cầu thứ hai; kho không tự duyệt.
    expect(await stockNow()).toBe(10);
    expect((await reqSed(CHUC, fix)).status).toBe(409);
    expect((await ctx.request(`/api/orders/ship-edits/${asked.body.data.id}/decide`, { as: CHUC, body: { decision: 'APPROVED' } })).status).toBe(403);
    const pending = await ctx.request('/api/orders/ship-edits', { as: USERS.manager });
    expect(pending.body.data).toHaveLength(1);
    expect(pending.body.data[0].reason).toContain('Gửi nhầm 2 can');
    // Từ chối phải ghi lý do; từ chối xong thì kho gửi lại được.
    expect((await ctx.request(`/api/orders/ship-edits/${asked.body.data.id}/decide`, { as: USERS.manager, body: { decision: 'REJECTED' } })).status).toBe(422);
    expect((await ctx.request(`/api/orders/ship-edits/${asked.body.data.id}/decide`, { as: USERS.manager, body: { decision: 'REJECTED', note: 'Kiểm lại phiếu đã' } })).status).toBe(200);
    expect(await stockNow()).toBe(10);
    const again = await reqSed(CHUC, fix);
    expect(again.status).toBe(200);

    // Vừa gửi yêu cầu: người duyệt nhận việc, kho (người gửi) không tự nhận.
    const openFor = async (userId: string, like: string) =>
      (await ctx.db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE assignee_id = ? AND status = 'OPEN' AND title LIKE ?").bind(userId, like).first<{ n: number }>())!.n;
    const mgrId = (await ctx.db.prepare("SELECT id FROM users WHERE email = ?").bind(USERS.manager).first<{ id: string }>())!.id;
    const chucId = (await ctx.db.prepare("SELECT id FROM users WHERE email = ?").bind(CHUC).first<{ id: string }>())!.id;
    expect(await openFor(mgrId, 'Duyệt sửa phiếu xuất đơn%')).toBeGreaterThan(0);
    expect(await openFor(chucId, 'Duyệt sửa phiếu xuất đơn%')).toBe(0);
    const pend2 = await ctx.request('/api/work/mine', { as: USERS.manager });
    expect((pend2.body.data as Array<{ key: string; count: number }>).find((x) => x.key === 'ship_edit')?.count).toBe(1);

    const thaoId = (await ctx.db.prepare('SELECT id FROM users WHERE email = ?').bind(USERS.thao).first<{ id: string }>())!.id;
    await ctx.db.prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, 'order.accounting.confirm', ?, '2026-10-01T00:00:00Z')").bind(thaoId, mgrId).run();
    const dec = await ctx.request(`/api/orders/ship-edits/${again.body.data.id}/decide`, { as: USERS.manager, body: { decision: 'APPROVED' } });
    expect(dec.status).toBe(200);
    // Duyệt xong: kho nhận việc báo lại; đơn đã được kế toán xác nhận nên bị mở lại, kế toán/quản lý nhận việc xác nhận lại.
    expect(await openFor(chucId, 'Yêu cầu sửa phiếu xuất đơn%đã được duyệt%')).toBe(1);
    expect(await openFor(thaoId, 'Đơn % đã đổi số thực xuất%')).toBe(1);

    // Tồn kho trả lại 2 can; đơn tự áp số mới; quay lại bước chốt tiền; kế toán phải xác nhận lại.
    expect(await stockNow()).toBe(12);
    const after = await status(id);
    expect(after.items[0].qty).toBe(8);
    expect(after.kho_status).toBe('CHO_CHOT_TIEN');
    expect(after.accounting_status).toBe('CHUA_XAC_NHAN');
    const task = await ctx.db
      .prepare("SELECT status FROM tasks WHERE assignee_id = ? AND title LIKE '%Kho sửa số thực xuất%'")
      .bind(after.owner_id)
      .first<{ status: string }>();
    expect(task?.status).toBe('OPEN');
    const actions = (after.flow_log as Array<{ action: string; note: string | null }>).filter((l) => l.action === 'SUA_SO_XUAT');
    expect(actions).toHaveLength(1);
    expect(actions[0].note).toContain('Gửi nhầm 2 can');

    // Chốt tiền lại + kế toán xác nhận lại được bình thường.
    expect((await post(id, 'lock-money', USERS.thao)).status).toBe(200);
    expect(
      (await ctx.request(`/api/orders/${id}/accounting`, { as: USERS.manager, body: { accounting_status: 'DA_XAC_NHAN' } })).status,
    ).toBe(200);
  });

  it('đơn ngày cũ chưa có giá tại ngày đó thì lấy giá đang hiệu lực, không bị chặn khi sửa/xem trước', async () => {
    const r = await ctx.request('/api/orders/preview', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', order_date: '2000-01-01', items: [{ product_id: 'prod-full', qty: 2 }] },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.lines[0].base_price).toBeGreaterThan(0);
  });

  it('giá thỏa thuận lệch bảng giá: mặc định sale tự điền giá, không bắt duyệt; bật cờ thì quay lại cách cũ', async () => {
    const body = (price: number) => ({
      customer_id: 'cus-thao-1',
      order_date: '2026-08-16',
      items: [{ product_id: 'prod-full', qty: 2, applied_price: price }],
    });
    // Mặc định: sale điền giá lệch 20% vẫn lưu được, không phát sinh yêu cầu duyệt, dòng được đánh dấu.
    const free = await ctx.request('/api/orders/preview', { as: USERS.thao, body: body(100000) });
    expect(free.status).toBe(200);
    expect(free.body.data.approvals).toHaveLength(0);
    expect(free.body.data.lines[0].price_override).toBe(true);
    expect(free.body.data.lines[0].applied_price).toBe(100000);

    // Bật yêu cầu duyệt giá: sale phải qua duyệt, quản lý tự chỉnh trong quyền, lệch lớn cần CEO.
    await ctx.db
      .prepare("INSERT INTO app_settings (key, value_json, updated_at) VALUES ('approval.price_override_required', 'true', ?)")
      .bind(NOW)
      .run();
    const asSale = await ctx.request('/api/orders/preview', { as: USERS.thao, body: body(115000) });
    expect(asSale.body.data.approvals.length).toBeGreaterThan(0);
    const asManager = await ctx.request('/api/orders/preview', { as: USERS.manager, body: body(115000) });
    expect(asManager.body.data.approvals).toHaveLength(0);
    const bigDrop = await ctx.request('/api/orders/preview', { as: USERS.manager, body: body(100000) });
    expect(bigDrop.body.data.approvals.length).toBeGreaterThan(0);
  });

  it('nhập lại đơn của ngày trước: lưu đúng ngày đơn đã chọn, không cho ngày tương lai', async () => {
    const mk = (order_date: string) =>
      ctx.request('/api/orders', {
        as: USERS.thao,
        body: { ...baseOrder(2), customer_id: 'cus-thao-1', order_date },
      });
    const past = await mk('2026-08-01');
    expect(past.status).toBe(201);
    expect((await status(past.body.data.id)).order_date).toBe('2026-08-01');
    expect((await mk('2099-01-01')).status).toBe(422);
  });

  it('một lần bấm: từ đã xuất kho tới chốt tiền và xác nhận ghi nợ (Thảo làm thay kế toán)', async () => {
    const id = await newOrder(10);
    await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
    await post(id, 'to-kho', USERS.manager);
    await post(id, 'kho-report', CHUC, { lines: [{ product_id: 'prod-full', status: 'DU' }] });
    await post(id, 'approve', USERS.manager, { ship_date: '2026-08-20' });

    // Chưa xuất kho thì chưa gộp được.
    expect((await post(id, 'finish', USERS.manager)).status).toBe(422);

    await post(id, 'ship', CHUC, { lines: [{ product_id: 'prod-full', shipped_qty: 9 }] });
    const r = await post(id, 'finish', USERS.manager);
    expect(r.status).toBe(200);
    expect(r.body.data.steps).toEqual(['Xác nhận đã xuất', 'Chốt tiền', 'Xác nhận ghi nợ']);
    const o = await status(id);
    expect(o.kho_status).toBe('DA_CHOT_TIEN');
    expect(o.accounting_status).toBe('DA_XAC_NHAN');
    expect(o.total_amount).toBe(9 * 125000);

    // Sale không có quyền kế toán thì không dùng được nút gộp.
    const id2 = await newOrder(5);
    expect((await post(id2, 'finish', USERS.thao)).status).toBe(403);
  });

  it('khách do quản lý phụ trách: bỏ bước báo điều phối, đi thẳng xuống kho', async () => {
    await ctx.db
      .prepare(
        `INSERT INTO customers (id, legacy_code, name, phone_text, phone_normalized, province, tier_id, owner_id,
           stage, opening_debt, data_quality, created_at, updated_at)
         VALUES ('cus-mgr', 'cus-mgr', 'Khách của quản lý', '0900000009', 'cus-mgr', 'HN', 'tier-dlc1', 'user-manager',
           'NEGOTIATING', 0, 'OK', ?, ?)`,
      )
      .bind(NOW, NOW)
      .run();
    const id = await newOrder(5, USERS.manager, 'cus-mgr');
    await ctx.request(`/api/orders/${id}/submit`, { as: USERS.manager, body: {} });
    expect((await status(id)).kho_status).toBe('CHO_KIEM_KHO');
  });

  it('sửa đơn đã duyệt đang chờ xuất thì quay lại duyệt, kho thả hàng đã giữ', async () => {
    const id = await newOrder(10);
    await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
    await post(id, 'to-kho', USERS.manager);
    await post(id, 'kho-report', CHUC, { lines: [{ product_id: 'prod-full', status: 'DU' }] });
    await post(id, 'approve', USERS.manager, { ship_date: '2026-08-20' });
    expect((await status(id)).kho_status).toBe('CHO_XUAT');

    const edit = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: USERS.thao,
      body: { items: [{ product_id: 'prod-full', qty: 12 }], reason: 'Khách lấy thêm 2 can' },
    });
    expect(edit.status).toBe(200);
    const o = await status(id);
    expect(o.approval_status).toBe('PENDING_APPROVAL');
    expect(o.kho_status).toBe('CHO_DIEU_PHOI');

    const other = await newOrder(5);
    const chk = await ctx.request(`/api/orders/${other}/kho-check`, { as: CHUC });
    expect(chk.body.data.lines[0].reserved).toBe(0);
  });

  it('huỷ đơn đã duyệt (kho đang giữ hàng) thì kho nhả hàng ra; đã xuất kho thì không huỷ được', async () => {
    const id = await newOrder(10);
    await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
    await post(id, 'to-kho', USERS.manager);
    await post(id, 'kho-report', CHUC, { lines: [{ product_id: 'prod-full', status: 'DU' }] });
    await post(id, 'approve', USERS.manager, { ship_date: '2026-08-20' });

    const other = await newOrder(5);
    const held = await ctx.request(`/api/orders/${other}/kho-check`, { as: CHUC });
    expect(held.body.data.lines[0].reserved).toBe(10);

    // Sale (nhân viên) không tự huỷ đơn đã duyệt; quản lý huỷ được.
    const byThao = await ctx.request(`/api/orders/${id}/cancel`, { as: USERS.thao, body: { reason: 'Khách huỷ đơn' } });
    expect(byThao.status).toBe(403);
    const cancel = await ctx.request(`/api/orders/${id}/cancel`, { as: USERS.manager, body: { reason: 'Khách huỷ đơn' } });
    expect(cancel.status).toBe(200);

    const freed = await ctx.request(`/api/orders/${other}/kho-check`, { as: CHUC });
    expect(freed.body.data.lines[0].reserved).toBe(0);
    expect(freed.body.data.lines[0].available).toBe(20);
    const log = ((await status(id)).flow_log as Array<{ action: string }>).map((l) => l.action);
    expect(log).toContain('HUY_DON');

    // Đã xuất kho thì không huỷ được nữa.
    const shipped = await newOrder(4);
    await ctx.request(`/api/orders/${shipped}/submit`, { as: USERS.thao, body: {} });
    await post(shipped, 'to-kho', USERS.manager);
    await post(shipped, 'kho-report', CHUC, { lines: [{ product_id: 'prod-full', status: 'DU' }] });
    await post(shipped, 'approve', USERS.manager, { ship_date: '2026-08-20' });
    await post(shipped, 'ship', CHUC, {});
    const late = await ctx.request(`/api/orders/${shipped}/cancel`, { as: USERS.manager, body: { reason: 'Muốn huỷ' } });
    expect(late.status).toBe(400);
    expect(late.body.error.code).toBe('ORDER_DELIVERED');
  });

  it('phân quyền: sale không thấy đơn người khác, kế toán kho thấy mọi đơn', async () => {
    const id = await newOrder(10);
    const huyen = await ctx.request(`/api/orders/${id}`, { as: USERS.huyen });
    expect(huyen.status).toBe(404);
    const chuc = await ctx.request(`/api/orders/${id}`, { as: CHUC });
    expect(chuc.status).toBe(200);
    const list = await ctx.request('/api/orders', { as: CHUC });
    expect(list.body.data.map((x: { id: string }) => x.id)).toContain(id);
    // Kế toán kho không sửa được đơn.
    const edit = await ctx.request(`/api/orders/${id}`, {
      method: 'PUT',
      as: CHUC,
      body: { items: [{ product_id: 'prod-full', qty: 1 }] },
    });
    expect([403, 404]).toContain(edit.status);
  });

  it('đơn cũ (tạo trước luồng) không bị kéo vào luồng kho', async () => {
    await ctx.db.prepare("DELETE FROM kho_cfg WHERE k = 'flow_on'").run();
    const id = await newOrder(10);
    expect((await status(id)).flow_on).toBe(0);
    const res = await post(id, 'to-kho', USERS.manager);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FLOW');
    // Duyệt theo cách cũ vẫn chạy.
    await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
    const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
    const decided = await ctx.request(`/api/approvals/${approvals.body.data[0].id}/decide`, {
      as: USERS.manager,
      body: { decision: 'APPROVED' },
    });
    expect(decided.status).toBe(200);
  });

  it('đơn cũ đã duyệt, đang chờ xuất: kho vẫn ghi được số thực xuất (đơn tự vào luồng ở bước xuất)', async () => {
    await ctx.db.prepare("DELETE FROM kho_cfg WHERE k = 'flow_on'").run();
    const id = await newOrder(5);
    expect((await status(id)).flow_on).toBe(0);
    await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
    const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
    for (const ap of approvals.body.data) {
      await ctx.request(`/api/approvals/${ap.id}/decide`, { as: USERS.manager, body: { decision: 'APPROVED' } });
    }
    const items = (await ctx.request(`/api/orders/${id}`, { as: USERS.thao })).body.data.items as Array<{ product_id: string; qty: number }>;
    const r = await post(id, 'ship', CHUC, { ship_day: '2026-08-14', shipped_by_name: 'Kho A', lines: [{ product_id: items[0].product_id, shipped_qty: items[0].qty - 2 }] });
    expect(r.status).toBe(200);
    expect(r.body.data.diff.length).toBe(1);
    const o = await ctx.db.prepare('SELECT flow_on, kho_status, delivery_status FROM orders WHERE id = ?').bind(id).first<{ flow_on: number; kho_status: string; delivery_status: string }>();
    expect(o!.flow_on).toBe(1);
    expect(o!.kho_status).toBe('DA_XUAT');
    expect(o!.delivery_status).toBe('DA_XUAT_KHO');
  });

  it('kế toán kho mở đơn thấy điện thoại và địa chỉ khách (để in phiếu xuất kho)', async () => {
    await ctx.db.prepare("UPDATE customers SET phone_text = '0912345678', address = '12 Phố Huế, Hà Nội' WHERE id = 'cus-thao-1'").run();
    const id = await newOrder(3);
    const d = await ctx.request(`/api/orders/${id}`, { as: CHUC });
    expect(d.status).toBe(200);
    expect(d.body.data.customer_phone).toBe('0912345678');
    expect(d.body.data.customer_address).toBe('12 Phố Huế, Hà Nội');
  });

  it('CEO bật/tắt luồng kho cho đơn mới', async () => {
    const off = await ctx.request('/api/orders/flow/enabled', { method: 'PUT', as: USERS.ceo, body: { enabled: false } });
    expect(off.status).toBe(200);
    const sum = await ctx.request('/api/orders/flow/summary', { as: USERS.manager });
    expect(sum.body.data.enabled).toBe(false);
    const sale = await ctx.request('/api/orders/flow/enabled', { method: 'PUT', as: USERS.thao, body: { enabled: true } });
    expect(sale.status).toBe(403);
  });
});

describe('Kho ảnh bill', () => {
  const png = () =>
    new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13])], { type: 'image/png' });

  async function upload(as: string, fields: Record<string, string>) {
    const fd = new FormData();
    fd.set('file', png(), 'bill.png');
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return ctx.request('/api/bills', { as, formData: fd });
  }

  it('sale gửi bill, xem lại, người khác không thấy, lịch sử giao dịch có bill', async () => {
    const id = await newOrder(10);
    const up = await upload(USERS.thao, { customer_id: 'cus-thao-1', order_id: id, amount: '1250000', method: 'Chuyển khoản' });
    expect(up.status).toBe(200);
    const billId = up.body.data.id as string;

    const list = await ctx.request('/api/bills', { as: USERS.thao });
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].customer_name).toBe('Cửa hàng Test A');
    expect(list.body.data[0].order_no).toBeTruthy();

    const hidden = await ctx.request('/api/bills', { as: USERS.huyen });
    expect(hidden.body.data).toHaveLength(0);
    const file = await ctx.app.fetch(
      new Request(`http://localhost/api/bills/${billId}/file`, { headers: { 'X-Dev-Email': USERS.huyen } }),
      ctx.env,
      { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
    );
    expect(file.status).toBe(404);
    const mine = await ctx.app.fetch(
      new Request(`http://localhost/api/bills/${billId}/file`, { headers: { 'X-Dev-Email': USERS.thao } }),
      ctx.env,
      { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
    );
    expect(mine.status).toBe(200);
    expect(mine.headers.get('content-type')).toBe('image/png');

    // Bill kèm đơn + số tiền tự thành khoản tiền về chờ kế toán xác nhận: hiện ngay trong lịch sử giao dịch kèm bill.
    expect(up.body.data.payment_id).toBeTruthy();
    const hist = await ctx.request('/api/bills/history', { as: USERS.thao });
    expect(hist.body.data).toHaveLength(1);
    expect(hist.body.data[0].bill_count).toBe(1);
  });

  it('chặn file lạ và khách ngoài phạm vi', async () => {
    const fd = new FormData();
    fd.set('file', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'x.html');
    fd.set('customer_id', 'cus-thao-1');
    const bad = await ctx.request('/api/bills', { as: USERS.thao, formData: fd });
    expect(bad.status).toBe(400);

    const other = await upload(USERS.thao, { customer_id: 'cus-huyen-1' });
    expect(other.status).toBe(404);
  });
  it('phiếu xuất kho (màn của kho) có thứ tự mã đúng như đơn sale đặt, không xếp lại theo tên', async () => {
    const created = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', order_date: '2026-08-16', items: [{ product_id: 'prod-missing', qty: 3 }, { product_id: 'prod-full', qty: 10 }] },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    await ctx.db.prepare("UPDATE orders SET approval_status = 'APPROVED', flow_on = 1, kho_status = 'CHO_XUAT', approved_at = '2026-08-16T01:00:00Z' WHERE id = ?").bind(id).run();
    const r = await ctx.request('/api/hub/kho/b2b-pending', { as: CHUC });
    expect(r.status).toBe(200);
    const row = (r.body.data as Array<{ id: string; lines: Array<{ sku: string }> }>).find((x) => x.id === id)!;
    expect(row.lines.map((l) => l.sku)).toEqual(['TEST-MISSING', 'TEST-FULL']);
    const d = await ctx.request(`/api/orders/${id}`, { as: USERS.thao });
    expect((d.body.data.items as Array<{ sku: string }>).map((l) => l.sku)).toEqual(['TEST-MISSING', 'TEST-FULL']);
  });
});

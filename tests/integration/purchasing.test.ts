import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const NOW = '2026-10-19T01:00:00.000Z';
const KT = 'kythuat2@ailla.vn';
const BASE = '/api/hub/kho/mh';

async function grant(userId: string, perm: string) {
  await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(userId, perm, 'user-ceo', NOW).run();
}

async function setup() {
  const sup = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo, body: { name: 'NCC Hóa chất A' } });
  const supplierId = sup.body.data.id as string;
  const po = await ctx.request(`${BASE}/orders`, {
    as: USERS.ceo,
    body: { supplier_id: supplierId, order_date: '2026-10-05', lines: [{ item: 'NVL1', qty: 100 }] },
  });
  return { supplierId, poId: po.body.data.id as string, poNo: po.body.data.no as string };
}

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await ctx.db
    .prepare("INSERT INTO users (id, email, display_name, role, status, created_at, updated_at) VALUES ('user-kt2', ?, 'Kỹ thuật (test)', 'EMPLOYEE', 'ACTIVE', ?, ?)")
    .bind(KT, NOW, NOW)
    .run();
  await grant('user-kt2', 'hub.access');
  await grant('user-kt2', 'sx.kiemke');
  await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES ('NVL1', 'Nguyên liệu 1', 'kg', 'NVL', '', 0, 1, ?)").bind(NOW).run();
});

describe('Mua hàng: phiếu mua → nhận hàng → giá, hóa đơn, phiếu chi, công nợ', () => {
  it('lập phiếu mua; đặt khác giao: nhận làm hai lần, trạng thái đổi theo số thực nhận', async () => {
    const { poId, poNo } = await setup();
    expect(poNo).toMatch(/^PM2610-001$/);
    const r1 = await ctx.request(`${BASE}/orders/${poId}/receipts`, { as: KT, body: { receipt_date: '2026-10-07', lines: [{ item: 'NVL1', qty: 60 }] } });
    expect(r1.status).toBe(200);
    let list = await ctx.request(`${BASE}/orders`, { as: KT });
    expect(list.body.data[0].status).toBe('DANG_GIAO');
    expect(list.body.data[0].lines[0].received).toBe(60);
    const r2 = await ctx.request(`${BASE}/orders/${poId}/receipts`, { as: KT, body: { receipt_date: '2026-10-09', lines: [{ item: 'NVL1', qty: 45 }] } });
    expect(r2.status).toBe(200);
    list = await ctx.request(`${BASE}/orders`, { as: KT });
    expect(list.body.data[0].status).toBe('DU');
    const stock = await ctx.db.prepare('SELECT SUM(qty) AS q FROM kho_ledger WHERE item = ?').bind('NVL1').first<{ q: number }>();
    expect(stock?.q).toBe(105);
  });

  it('kỹ thuật không thấy giá và không gọi được hóa đơn, phiếu chi, công nợ', async () => {
    const { poId } = await setup();
    await ctx.request(`${BASE}/orders/${poId}/receipts`, { as: KT, body: { receipt_date: '2026-10-07', lines: [{ item: 'NVL1', qty: 10 }] } });
    const list = await ctx.request(`${BASE}/orders`, { as: KT });
    expect(JSON.stringify(list.body)).not.toContain('unit_price');
    expect((await ctx.request(`${BASE}/invoices`, { as: KT })).status).toBe(403);
    expect((await ctx.request(`${BASE}/payments`, { as: KT })).status).toBe(403);
    expect((await ctx.request(`${BASE}/debts`, { as: KT })).status).toBe(403);
    const sup = await ctx.request(`${BASE}/suppliers`, { as: KT });
    expect(JSON.stringify(sup.body)).not.toContain('opening_debt');
  });

  it('giá lúc giao + phí vận chuyển trên hóa đơn thành giá vốn nhập; hủy hóa đơn thì về giá lúc giao', async () => {
    const { supplierId, poId } = await setup();
    const rc = await ctx.request(`${BASE}/orders/${poId}/receipts`, { as: KT, body: { receipt_date: '2026-10-07', lines: [{ item: 'NVL1', qty: 60 }] } });
    const orders = await ctx.request(`${BASE}/orders`, { as: USERS.ceo });
    const rl = orders.body.data[0].receipts[0].lines[0];
    const receiptId = orders.body.data[0].receipts[0].id as string;
    expect(rc.status).toBe(200);
    const setP = await ctx.request(`${BASE}/receipt-lines/${rl.id}/price`, { as: USERS.ceo, method: 'PUT', body: { unit_price: 1000 } });
    expect(setP.status).toBe(200);
    const price = async () => (await ctx.db.prepare('SELECT price FROM kho_moves WHERE item = ?').bind('NVL1').first<{ price: number | null }>())?.price;
    expect(await price()).toBe(1000);

    const inv = await ctx.request(`${BASE}/invoices`, {
      as: USERS.ceo,
      body: { supplier_id: supplierId, invoice_no: 'HD001', invoice_date: '2026-10-08', receipt_ids: [receiptId], vat_amount: 4800, freight: 6000 },
    });
    expect(inv.status).toBe(200);
    expect(inv.body.data.total).toBe(60000 + 4800 + 6000);
    expect(await price()).toBe(1100); // 1000 + 6000/60, VAT không tính vào giá vốn
    const cancel = await ctx.request(`${BASE}/invoices/${inv.body.data.id}/cancel`, { as: USERS.ceo, body: {} });
    expect(cancel.status).toBe(200);
    expect(await price()).toBe(1000);
  });

  it('công nợ nhà cung cấp có đầu kỳ: đầu kỳ + hóa đơn − đã chi', async () => {
    const { supplierId, poId } = await setup();
    await ctx.request(`${BASE}/suppliers/${supplierId}/opening`, { as: USERS.ceo, method: 'PUT', body: { opening_debt: 500000, opening_date: '2026-09-30' } });
    await ctx.request(`${BASE}/orders/${poId}/receipts`, { as: KT, body: { receipt_date: '2026-10-07', lines: [{ item: 'NVL1', qty: 10 }] } });
    const orders = await ctx.request(`${BASE}/orders`, { as: USERS.ceo });
    await ctx.request(`${BASE}/receipt-lines/${orders.body.data[0].receipts[0].lines[0].id}/price`, { as: USERS.ceo, method: 'PUT', body: { unit_price: 2000 } });
    const inv = await ctx.request(`${BASE}/invoices`, {
      as: USERS.ceo,
      body: { supplier_id: supplierId, invoice_date: '2026-10-08', receipt_ids: [orders.body.data[0].receipts[0].id] },
    });
    expect(inv.body.data.total).toBe(20000);
    const pay = await ctx.request(`${BASE}/payments`, { as: USERS.ceo, body: { supplier_id: supplierId, invoice_id: inv.body.data.id, pay_date: '2026-10-10', amount: 120000, account: 'Vietcombank' } });
    expect(pay.status).toBe(200);
    const debts = await ctx.request(`${BASE}/debts`, { as: USERS.ceo });
    const row = debts.body.data.find((d: { id: string }) => d.id === supplierId);
    expect(row.balance).toBe(500000 + 20000 - 120000);
    const ledger = await ctx.request(`${BASE}/suppliers/${supplierId}/ledger`, { as: USERS.ceo });
    expect(ledger.body.data.entries.at(-1).balance).toBe(400000);
  });

  it('giá nguyên vật liệu tháng là bình quân gia quyền có tồn đầu', async () => {
    const { supplierId, poId } = await setup();
    // tồn đầu 100 kg giá 1000 (phiếu tồn đầu)
    await ctx.db.prepare("INSERT INTO kho_docs (no, type, doc_date, partner, ref_no, note, extra, status, created_at) VALUES ('TD2609-001', 'TD', '2026-09-30', '', '', '', '{}', 'OK', ?)").bind(NOW).run();
    const td = await ctx.db.prepare("SELECT id FROM kho_docs WHERE no = 'TD2609-001'").first<{ id: number }>();
    await ctx.db.prepare("INSERT INTO kho_moves (doc_id, item, qty, price, role, note) VALUES (?, 'NVL1', 100, 1000, 'IN', '')").bind(td?.id).run();
    await ctx.request(`${BASE}/orders/${poId}/receipts`, { as: KT, body: { receipt_date: '2026-10-07', lines: [{ item: 'NVL1', qty: 100 }] } });
    const orders = await ctx.request(`${BASE}/orders`, { as: USERS.ceo });
    await ctx.request(`${BASE}/receipt-lines/${orders.body.data[0].receipts[0].lines[0].id}/price`, { as: USERS.ceo, method: 'PUT', body: { unit_price: 1200 } });
    expect(supplierId).toBeTruthy();
    const r = await ctx.request(`${BASE}/material-prices?month=2026-10`, { as: USERS.ceo });
    const row = r.body.data.rows.find((x: { item: string }) => x.item === 'NVL1');
    expect(row.open_qty).toBe(100);
    expect(row.open_price).toBe(1000);
    expect(row.in_price).toBe(1200);
    expect(row.avg_price).toBe(1100); // (100×1000 + 100×1200) / 200
  });
});

describe('Mua hàng: ngày giao dự kiến, giá đặt, cọc', () => {
  it('phiếu mua có ngày giao dự kiến và giá đặt; kho không thấy giá, quản lý thấy', async () => {
    const sup = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo, body: { name: 'NCC B' } });
    const po = await ctx.request(`${BASE}/orders`, {
      as: USERS.ceo,
      body: { supplier_id: sup.body.data.id, order_date: '2026-10-05', expected_date: '2026-10-12', lines: [{ item: 'NVL1', qty: 50, unit_price: 1500 }] },
    });
    expect(po.status).toBe(200);
    const kt = await ctx.request(`${BASE}/orders`, { as: KT });
    expect(kt.body.data[0].expected_date).toBe('2026-10-12');
    expect(JSON.stringify(kt.body)).not.toContain('unit_price');
    const boss = await ctx.request(`${BASE}/orders`, { as: USERS.ceo });
    expect(boss.body.data[0].lines[0].unit_price).toBe(1500);
  });

  it('ngày giao dự kiến sai định dạng bị từ chối', async () => {
    const sup = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo, body: { name: 'NCC C' } });
    const r = await ctx.request(`${BASE}/orders`, { as: USERS.ceo, body: { supplier_id: sup.body.data.id, order_date: '2026-10-05', expected_date: '12/10', lines: [{ item: 'NVL1', qty: 5 }] } });
    expect(r.status).toBe(400);
  });

  it('cọc trước khi đặt hàng gắn vào phiếu mua và trừ vào công nợ; trả một phần, không cần hết đơn', async () => {
    const sup = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo, body: { name: 'NCC D' } });
    const supplierId = sup.body.data.id as string;
    const po = await ctx.request(`${BASE}/orders`, { as: USERS.ceo, body: { supplier_id: supplierId, order_date: '2026-10-05', lines: [{ item: 'NVL1', qty: 10 }] } });
    const dep = await ctx.request(`${BASE}/payments`, { as: USERS.ceo, body: { supplier_id: supplierId, po_id: po.body.data.id, kind: 'COC', pay_date: '2026-10-05', amount: 300000, account: 'Tiền mặt' } });
    expect(dep.status).toBe(200);
    let debts = await ctx.request(`${BASE}/debts`, { as: USERS.ceo });
    expect(debts.body.data.find((d: { id: string }) => d.id === supplierId).balance).toBe(-300000);
    const ledger = await ctx.request(`${BASE}/suppliers/${supplierId}/ledger`, { as: USERS.ceo });
    expect(ledger.body.data.entries[0].kind).toBe('Đã cọc');
    const pays = await ctx.request(`${BASE}/payments`, { as: USERS.ceo });
    expect(pays.body.data[0].po_no).toMatch(/^PM/);
    // phiếu mua của nhà cung cấp khác thì không gắn được
    const other = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo, body: { name: 'NCC E' } });
    const bad = await ctx.request(`${BASE}/payments`, { as: USERS.ceo, body: { supplier_id: other.body.data.id, po_id: po.body.data.id, pay_date: '2026-10-06', amount: 1000 } });
    expect(bad.status).toBe(400);
    debts = await ctx.request(`${BASE}/debts`, { as: USERS.ceo });
    expect(debts.body.data.find((d: { id: string }) => d.id === supplierId).balance).toBe(-300000);
  });
});

describe('Chứng từ nhà cung cấp: nhập giá + hóa đơn trong một lần, kèm ảnh', () => {
  it('ghi chứng từ nhập giá từng dòng ngay trong form, đính kèm ảnh và tải lại được', async () => {
    const { supplierId, poId } = await setup();
    await ctx.request(`${BASE}/orders/${poId}/receipts`, { as: KT, body: { receipt_date: '2026-10-07', lines: [{ item: 'NVL1', qty: 40 }] } });
    const orders = await ctx.request(`${BASE}/orders`, { as: USERS.ceo });
    const rc = orders.body.data[0].receipts[0];
    const inv = await ctx.request(`${BASE}/invoices`, {
      as: USERS.ceo,
      body: { supplier_id: supplierId, invoice_no: 'HD-77', doc_type: 'HD', invoice_date: '2026-10-08', receipt_ids: [rc.id], prices: { [rc.lines[0].id]: 2500 }, vat_amount: 8000, handling: 4000 },
    });
    expect(inv.status).toBe(200);
    expect(inv.body.data.total).toBe(100000 + 8000 + 4000);
    const price = (await ctx.db.prepare('SELECT price FROM kho_moves WHERE item = ?').bind('NVL1').first<{ price: number | null }>())?.price;
    expect(price).toBe(2600); // 2500 + bốc vác 4000 / 40
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const up = await ctx.request(`${BASE}/invoices/${inv.body.data.id}/files`, { as: USERS.ceo, body: { name: 'bill.png', mime: 'image/png', data: png } });
    expect(up.status).toBe(200);
    const list = await ctx.request(`${BASE}/invoices`, { as: USERS.ceo });
    expect(list.body.data[0].file_count).toBe(1);
    expect(list.body.data[0].doc_type).toBe('HD');
    const bad = await ctx.request(`${BASE}/invoices/${inv.body.data.id}/files`, { as: USERS.ceo, body: { name: 'x.exe', mime: 'application/x-msdownload', data: png } });
    expect(bad.status).toBe(400);
    expect((await ctx.request(`${BASE}/invoices/${inv.body.data.id}/files`, { as: KT })).status).toBe(403);
  });

  it('thiếu giá một dòng thì chưa ghi được chứng từ', async () => {
    const { supplierId, poId } = await setup();
    await ctx.request(`${BASE}/orders/${poId}/receipts`, { as: KT, body: { receipt_date: '2026-10-07', lines: [{ item: 'NVL1', qty: 5 }] } });
    const orders = await ctx.request(`${BASE}/orders`, { as: USERS.ceo });
    const rc = orders.body.data[0].receipts[0];
    const r = await ctx.request(`${BASE}/invoices`, { as: USERS.ceo, body: { supplier_id: supplierId, invoice_date: '2026-10-08', receipt_ids: [rc.id] } });
    expect(r.status).toBe(400);
  });
});

describe('Chứng từ nhập tay theo từng dòng hàng', () => {
  it('ghi chứng từ không gắn lần nhận hàng, nhập nhiều dòng hàng có giá; tiền hàng tự cộng', async () => {
    const sup = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo, body: { name: 'NCC F' } });
    const r = await ctx.request(`${BASE}/invoices`, {
      as: USERS.ceo,
      body: { supplier_id: sup.body.data.id, doc_type: 'PG', invoice_date: '2026-10-08', manual_lines: [{ item: 'NVL1', qty: 10, unit_price: 1000 }, { item: 'NVL1', qty: 5, unit_price: 2000 }], freight: 500 },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(10000 + 10000 + 500);
    const lines = await ctx.request(`${BASE}/invoices/${r.body.data.id}/lines`, { as: USERS.ceo });
    expect(lines.body.data).toHaveLength(2);
    const bad = await ctx.request(`${BASE}/invoices`, { as: USERS.ceo, body: { supplier_id: sup.body.data.id, invoice_date: '2026-10-08', manual_lines: [{ item: 'NVL1', qty: 10 }] } });
    expect(bad.status).toBe(400);
  });
});

describe('Phiếu nhập kho của kho gắn với phiếu mua', () => {
  it('Chúc lập phiếu nhập chọn phiếu mua: phiếu mua nhảy trạng thái; hủy phiếu nhập thì trả về chưa nhận', async () => {
    const { poId } = await setup();
    const pn = await ctx.request('/api/hub/kho/docs', { as: KT, body: { type: 'PN', date: '2026-10-08', partner: 'NCC Hóa chất A', po_id: poId, lines: [{ item: 'NVL1', qty: 60 }] } });
    expect(pn.status).toBe(200);
    let list = await ctx.request(`${BASE}/orders`, { as: KT });
    expect(list.body.data[0].status).toBe('DANG_GIAO');
    expect(list.body.data[0].lines[0].received).toBe(60);
    expect(list.body.data[0].receipts[0].kho_doc_id).toBe(pn.body.data.id);
    const pn2 = await ctx.request('/api/hub/kho/docs', { as: KT, body: { type: 'PN', date: '2026-10-09', po_id: poId, lines: [{ item: 'NVL1', qty: 40 }] } });
    list = await ctx.request(`${BASE}/orders`, { as: KT });
    expect(list.body.data[0].status).toBe('DU');
    const bad = await ctx.request('/api/hub/kho/docs', { as: KT, body: { type: 'PN', date: '2026-10-09', po_id: 'khong-co', lines: [{ item: 'NVL1', qty: 1 }] } });
    expect(bad.status).toBe(400);
    const cancel = await ctx.request(`/api/hub/kho/docs/${pn2.body.data.id}/cancel`, { as: USERS.ceo, body: { reason: 'nhập nhầm' } });
    expect(cancel.status).toBe(200);
    list = await ctx.request(`${BASE}/orders`, { as: KT });
    expect(list.body.data[0].status).toBe('DANG_GIAO');
    expect(list.body.data[0].lines[0].received).toBe(60);
  });

  it('phiếu nhập không chọn phiếu mua vẫn ghi bình thường (có tên nhà cung cấp thì tự gắn vào phiếu mua tự tạo)', async () => {
    const pn = await ctx.request('/api/hub/kho/docs', { as: KT, body: { type: 'PN', date: '2026-10-08', partner: 'Mua lẻ', lines: [{ item: 'NVL1', qty: 5 }] } });
    expect(pn.status).toBe(200);
    expect(await ctx.db.prepare("SELECT COUNT(*) AS n FROM po_receipts r JOIN po_orders o ON o.id = r.po_id WHERE o.source = 'KHO'").first<{ n: number }>()).toEqual({ n: 1 });
  });
});

describe('Hàng về không có phiếu đặt (vỏ can): kho ghi phiếu nhập, web tự tạo phiếu mua, Thảo nhập giá sau', () => {
  it('phiếu nhập NVL không chọn phiếu mua, có tên NCC mới: tự tạo NCC + phiếu mua đủ hàng chưa có giá; nhập giá sau thì giá vốn tính lại', async () => {
    const d = await ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'PN', date: '2026-10-21', partner: 'Vỏ can Minh Phát', note: '', lines: [{ item: 'NVL1', qty: 500 }] } });
    expect(d.status).toBe(200);
    const list = await ctx.request(`${BASE}/orders`, { as: USERS.ceo });
    const po = list.body.data.find((o: { source: string }) => o.source === 'KHO');
    expect(po.supplier_name).toBe('Vỏ can Minh Phát');
    expect(po.status).toBe('DU');
    expect(po.lines[0].unit_price).toBeNull();
    expect(po.receipts).toHaveLength(1);
    expect((await ctx.request(`${BASE}/orders/${po.id}/prices`, { method: 'PUT', as: KT, body: { prices: { [po.lines[0].id]: 3000 } } })).status).toBe(403);
    const p = await ctx.request(`${BASE}/orders/${po.id}/prices`, { method: 'PUT', as: USERS.ceo, body: { prices: { [po.lines[0].id]: 3000 } } });
    expect(p.status).toBe(200);
    const mv = await ctx.db.prepare('SELECT price FROM kho_moves WHERE doc_id = ?').bind(d.body.data.id).first<{ price: number }>();
    expect(mv?.price).toBe(3000);
    const after = (await ctx.request(`${BASE}/orders`, { as: USERS.ceo })).body.data.find((o: { id: string }) => o.id === po.id);
    expect(after.lines[0].unit_price).toBe(3000);
    expect(after.receipts[0].lines[0].unit_price).toBe(3000);
  });

  it('phiếu nhập không ghi nhà cung cấp thì không tạo phiếu mua', async () => {
    const d = await ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'PN', date: '2026-10-21', partner: '', lines: [{ item: 'NVL1', qty: 5 }] } });
    expect(d.status).toBe(200);
    const list = await ctx.request(`${BASE}/orders`, { as: USERS.ceo });
    expect(list.body.data.filter((o: { source: string }) => o.source === 'KHO')).toHaveLength(0);
  });
  it('web vận hành (có tách địa chỉ quản trị): quản lý điều phối và CEO xem được công nợ, giá, chứng từ; kho và sale thì không', async () => {
    await setup();
    const mgr = (await ctx.db.prepare('SELECT id FROM users WHERE email = ?').bind(USERS.manager).first<{ id: string }>())!.id;
    await grant(mgr, 'hub.access');
    const call = (host: string, path: string, email: string) =>
      ctx.app.fetch(
        new Request(`http://${host}${path}`, { method: 'GET', headers: { 'X-Dev-Email': email, 'Content-Type': 'application/json' } }),
        { ...ctx.env, ADMIN_HOST: 'quantri.test', OPS_HOST: 'qt.test' },
      );
    for (const path of ['/api/hub/kho/mh/debts', '/api/hub/kho/mh/invoices', '/api/hub/kho/mh/payments', '/api/hub/kho/mh/material-prices?month=2026-10']) {
      expect((await call('qt.test', path, USERS.manager)).status).toBe(200);
      expect((await call('qt.test', path, USERS.ceo)).status).toBe(200);
      expect((await call('qt.test', path, KT)).status).toBe(403);
      expect((await call('qt.test', path, USERS.thao)).status).toBe(403);
    }
  });
});

describe('Phiếu chi nhà cung cấp: tiền mặt / chuyển khoản, tài khoản đi và đến, ảnh bill', () => {
  it('chuyển khoản ghi rõ chi từ tài khoản nào, chuyển đến đâu; nhà cung cấp nhớ tài khoản; đính kèm ảnh bill', async () => {
    const { supplierId } = await setup();
    const r = await ctx.request(`${BASE}/payments`, {
      as: USERS.ceo,
      body: { supplier_id: supplierId, pay_date: '2026-10-10', amount: 500000, method: 'CHUYEN_KHOAN', from_account: 'Vietcombank · 0451000123 · CTY AILLA', to_bank: 'ACB', to_account_no: '0011', to_account_name: 'CTY HOA CHAT A' },
    });
    expect(r.status).toBe(200);
    const pid = r.body.data.id as string;
    const up = await ctx.request(`${BASE}/payments/${pid}/files`, { as: USERS.ceo, body: { name: 'bill.png', mime: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } });
    expect(up.status).toBe(200);
    expect((await ctx.request(`${BASE}/payments/${pid}/files`, { as: KT })).status).toBe(403);
    const list = await ctx.request(`${BASE}/payments`, { as: USERS.ceo });
    expect(list.body.data[0]).toMatchObject({ method: 'CHUYEN_KHOAN', from_account: 'Vietcombank · 0451000123 · CTY AILLA', to_bank: 'ACB', to_account_no: '0011', file_count: 1 });
    const sups = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo });
    expect(sups.body.data.find((x: { id: string }) => x.id === supplierId)).toMatchObject({ bank: 'ACB', bank_account_no: '0011', bank_account_name: 'CTY HOA CHAT A' });
  });

  it('tiền mặt ghi người nhận, không cần tài khoản', async () => {
    const { supplierId } = await setup();
    const r = await ctx.request(`${BASE}/payments`, { as: USERS.ceo, body: { supplier_id: supplierId, pay_date: '2026-10-10', amount: 200000, method: 'TIEN_MAT', receiver: 'Anh Tuấn giao hàng' } });
    expect(r.status).toBe(200);
    const list = await ctx.request(`${BASE}/payments`, { as: USERS.ceo });
    expect(list.body.data[0]).toMatchObject({ method: 'TIEN_MAT', receiver: 'Anh Tuấn giao hàng', to_account_no: '' });
  });
});

describe('Điều khoản thanh toán nhà cung cấp và ảnh khoản chi', () => {
  it('ghi được điều khoản trước / sau nhận / công nợ N ngày, sửa được, giá trị lạ bị từ chối', async () => {
    const a = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo, body: { name: 'NCC chuyển khoản trước', pay_terms: 'TRUOC' } });
    expect(a.status).toBe(200);
    const b = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo, body: { name: 'NCC công nợ 30 ngày', pay_terms: 'CONG_NO', pay_days: 30 } });
    expect(b.status).toBe(200);
    expect((await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo, body: { name: 'NCC sai', pay_terms: 'LUNG_TUNG' } })).status).toBe(400);
    const put = await ctx.request(`${BASE}/suppliers/${a.body.data.id}`, { method: 'PUT', as: USERS.ceo, body: { pay_terms: 'SAU_NHAN', bank: 'ACB', bank_account_no: '123', bank_account_name: 'CTY A' } });
    expect(put.status).toBe(200);
    const list = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo });
    const x = list.body.data.find((s: { id: string }) => s.id === a.body.data.id);
    expect(x).toMatchObject({ pay_terms: 'SAU_NHAN', pay_days: 0, bank: 'ACB', bank_account_no: '123' });
    expect(list.body.data.find((s: { id: string }) => s.id === b.body.data.id)).toMatchObject({ pay_terms: 'CONG_NO', pay_days: 30 });
    const kho = await ctx.request(`${BASE}/suppliers`, { as: KT });
    expect(kho.body.data[0]).toHaveProperty('pay_terms');
    expect(kho.body.data[0]).not.toHaveProperty('opening_debt');
  });

  it('đính kèm ảnh cho khoản chi nhập tay; đếm ảnh; kho không đụng được', async () => {
    const up = await ctx.request(`${BASE}/costs/cp-abc123/files`, { as: USERS.ceo, body: { name: 'bill.png', mime: 'image/png', data: 'iVBORw0KGgo=' } });
    expect(up.status).toBe(200);
    const cnt = await ctx.request(`${BASE}/costs/file-counts`, { as: USERS.ceo });
    expect(cnt.body.data['cp-abc123']).toBe(1);
    expect((await ctx.request(`${BASE}/costs/cp-abc123/files`, { as: KT })).status).toBe(403);
  });
  it('công nợ cộng ngay theo giá phiếu mua (chưa cần chứng từ); phiếu chi trừ vào luôn; có chứng từ thì chứng từ thay cho giá phiếu mua', async () => {
    const sup = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo, body: { name: 'NCC cộng ngay' } });
    const supplierId = sup.body.data.id as string;
    const po = await ctx.request(`${BASE}/orders`, {
      as: USERS.ceo,
      body: { supplier_id: supplierId, order_date: '2026-10-05', lines: [{ item: 'NVL1', qty: 100, unit_price: 2000 }] },
    });
    expect(po.status).toBe(200);
    const poId = po.body.data.id as string;
    const debt = async () =>
      ((await ctx.request(`${BASE}/debts`, { as: USERS.ceo })).body.data as Array<{ id: string; invoiced: number; po_pending: number; paid: number; balance: number }>).find((d) => d.id === supplierId)!;
    // Chưa nhận hàng, chưa chứng từ: công nợ đã có 200.000 theo giá phiếu mua.
    expect(await debt()).toMatchObject({ invoiced: 0, po_pending: 200000, paid: 0, balance: 200000 });
    // Thảo chi một phần (không cần chứng từ): trừ ngay.
    const pay = await ctx.request(`${BASE}/payments`, { as: USERS.ceo, body: { supplier_id: supplierId, po_id: poId, kind: 'COC', pay_date: '2026-10-06', amount: 50000, account: 'Vietcombank' } });
    expect(pay.status).toBe(200);
    expect(await debt()).toMatchObject({ po_pending: 200000, paid: 50000, balance: 150000 });
    const led = await ctx.request(`${BASE}/suppliers/${supplierId}/ledger`, { as: USERS.ceo });
    expect((led.body.data.entries as Array<{ kind: string }>).some((e) => e.kind.startsWith('Phiếu mua'))).toBe(true);
    // Nhận hàng, ghi chứng từ theo giá thật 2.100: chứng từ thay cho giá phiếu mua, không cộng hai lần.
    await ctx.request(`${BASE}/orders/${poId}/receipts`, { as: KT, body: { receipt_date: '2026-10-07', lines: [{ item: 'NVL1', qty: 100 }] } });
    const orders = await ctx.request(`${BASE}/orders`, { as: USERS.ceo });
    const mine = (orders.body.data as Array<{ id: string; receipts: Array<{ id: string; lines: Array<{ id: string }> }> }>).find((o) => o.id === poId)!;
    await ctx.request(`${BASE}/receipt-lines/${mine.receipts[0].lines[0].id}/price`, { as: USERS.ceo, method: 'PUT', body: { unit_price: 2100 } });
    const inv = await ctx.request(`${BASE}/invoices`, { as: USERS.ceo, body: { supplier_id: supplierId, invoice_date: '2026-10-08', receipt_ids: [mine.receipts[0].id] } });
    expect(inv.body.data.total).toBe(210000);
    expect(await debt()).toMatchObject({ invoiced: 210000, po_pending: 0, paid: 50000, balance: 160000 });
  });
  it('sửa phiếu chi trực tiếp (số tiền, ngày, loại) thì công nợ tính lại, không bị tính hai lần; phiếu đã hủy không sửa được; kho không sửa', async () => {
    const { supplierId, poId } = await setup();
    const pay = await ctx.request(`${BASE}/payments`, { as: USERS.ceo, body: { supplier_id: supplierId, po_id: poId, kind: 'COC', pay_date: '2026-10-06', amount: 50000, account: 'Vietcombank' } });
    const payId = pay.body.data.id as string;
    const bal = async () =>
      ((await ctx.request(`${BASE}/debts`, { as: USERS.ceo })).body.data as Array<{ id: string; paid: number; balance: number }>).find((d) => d.id === supplierId)!;
    expect((await bal()).paid).toBe(50000);
    expect((await ctx.request(`${BASE}/payments/${payId}`, { as: KT, method: 'PUT', body: { amount: 10 } })).status).toBe(403);
    expect((await ctx.request(`${BASE}/payments/${payId}`, { as: USERS.ceo, method: 'PUT', body: { amount: 0 } })).status).toBe(400);
    const ed = await ctx.request(`${BASE}/payments/${payId}`, { as: USERS.ceo, method: 'PUT', body: { amount: 80000, pay_date: '2026-10-07', kind: 'CHI', note: 'Sửa lại số tiền' } });
    expect(ed.status).toBe(200);
    expect(await bal()).toMatchObject({ paid: 80000 });
    const row = await ctx.db.prepare('SELECT pay_date, amount, kind, note FROM po_payments WHERE id = ?').bind(payId).first<{ pay_date: string; amount: number; kind: string; note: string }>();
    expect(row).toMatchObject({ pay_date: '2026-10-07', amount: 80000, kind: 'CHI', note: 'Sửa lại số tiền' });
    const log = await ctx.db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'PO_PAYMENT_EDITED' AND entity_id = ?").bind(payId).first<{ n: number }>();
    expect(log!.n).toBe(1);
    await ctx.request(`${BASE}/payments/${payId}/cancel`, { as: USERS.ceo, body: {} });
    expect((await ctx.request(`${BASE}/payments/${payId}`, { as: USERS.ceo, method: 'PUT', body: { amount: 1000 } })).status).toBe(400);
  });
});


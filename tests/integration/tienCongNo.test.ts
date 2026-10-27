import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Tiền & công nợ: một chỗ tính (routes/tienCongNo.ts) phải ra cùng số với các trang đang dùng. Chỉ đọc. */
let ctx: TestContext;
const NOW = '2026-10-27T01:00:00.000Z';
const API = '/api/hub/dieuhanh/tien';
const ts = (d: string) => d + 'T00:00:00.000Z';

async function order(id: string, cus: string, date: string, amt: number, acct = 'DA_XAC_NHAN', deliv = 'DA_GIAO') {
  await ctx.db
    .prepare(
      `INSERT INTO orders (id, order_no, customer_id, owner_id, order_date, subtotal, total_amount,
         approval_status, delivery_status, payment_status, accounting_status, created_at, updated_at)
       VALUES (?, ?, ?, 'user-thao', ?, ?, ?, 'APPROVED', ?, 'CHUA_THU', ?, ?, ?)`,
    )
    .bind(id, 'DH-' + id, cus, date, amt, amt, deliv, acct, ts(date), ts(date))
    .run();
}
async function pay(id: string, cus: string, date: string, amt: number, extra: { acct?: string; adj?: number; st?: string; method?: string } = {}) {
  await ctx.db
    .prepare(
      `INSERT INTO payments (id, external_receipt_no, source, external_row_key, customer_id, amount, paid_at, method,
         accounting_status, review_status, is_general_repayment, is_adjustment, receiving_account_id, created_at, updated_at)
       VALUES (?, ?, 'MANUAL', ?, ?, ?, ?, ?, ?, 'OK', 0, ?, ?, ?, ?)`,
    )
    .bind(id, 'PT-' + id, id, cus, amt, date, extra.method ?? 'Chuyển khoản', extra.st ?? 'DA_XAC_NHAN', extra.adj ?? 0, extra.acct ?? null, ts(date), ts(date))
    .run();
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
  const db = ctx.db;
  // Khách Kênh OEM: chỉ dùng bảng giá riêng, không có cấp giá.
  await db
    .prepare("INSERT INTO customers (id, name, owner_id, price_mode, tier_id, opening_debt, created_at, updated_at) VALUES ('cus-oem', 'Khách OEM', 'user-thao', 'CUSTOM', NULL, 0, ?, ?)")
    .bind(NOW, NOW)
    .run();
  await db.prepare("UPDATE customers SET opening_debt = 1000000 WHERE id = 'cus-thao-1'").run();
  await db.prepare("INSERT INTO receiving_accounts (id, bank, account_no, account_name, active, created_at) VALUES ('acc-mb', 'MB', '0123456789', 'CTY AILLA', 1, ?)").bind(NOW).run();
  await order('o1', 'cus-thao-1', '2026-06-01', 2_000_000);
  await order('o2', 'cus-thao-1', '2026-10-20', 3_000_000);
  await order('o3', 'cus-thao-1', '2026-10-21', 700_000, 'CHUA_XAC_NHAN'); // chờ ghi nợ, chưa tính
  await order('o4', 'cus-oem', '2026-09-15', 5_000_000);
  await pay('p1', 'cus-thao-1', '2026-10-05', 1_500_000, { acct: 'acc-mb' });
  await pay('p2', 'cus-thao-1', '2026-10-22', 400_000, { st: 'CHUA_XAC_NHAN' }); // chờ tiền về, chưa tính
  await pay('p3', 'cus-oem', '2026-10-10', 1_000_000, { method: 'Tiền mặt' });
  await pay('p4', 'cus-thao-1', '2026-10-23', 200_000, { method: 'Bù trừ cước vận chuyển' }); // trừ nợ, không phải tiền vào
  await db
    .prepare("INSERT INTO order_returns (id, return_no, customer_id, status, return_date, credit_amount, created_at, updated_at) VALUES ('r1', 'TL-1', 'cus-thao-1', 'DA_GIAM_NO', '2026-10-24', 300000, ?, ?)")
    .bind(NOW, NOW)
    .run();
  // Nhà cung cấp: đầu kỳ 2tr chốt 30/9, hóa đơn 10tr, chi 4tr + cọc 1tr (chờ CEO), phiếu mua chưa chứng từ 600k.
  await db.prepare("INSERT INTO suppliers (id, name, opening_debt, opening_date, created_at, updated_at) VALUES ('s1', 'NCC A', 2000000, '2026-09-30', ?, ?)").bind(NOW, NOW).run();
  await db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES ('NVL1', 'NVL 1', 'kg', 'NVL', '', 0, 1, ?)").bind(NOW).run();
  await db.prepare("INSERT INTO po_invoices (id, supplier_id, invoice_no, invoice_date, total, created_at) VALUES ('i1', 's1', 'HD01', '2026-10-02', 10000000, ?)").bind(NOW).run();
  await db.prepare("INSERT INTO po_invoices (id, supplier_id, invoice_no, invoice_date, total, created_at) VALUES ('i0', 's1', 'HD00', '2026-09-01', 9000000, ?)").bind(NOW).run(); // trước ngày chốt: không tính
  await db.prepare("INSERT INTO po_payments (id, supplier_id, pay_date, amount, account, from_account, method, created_at) VALUES ('pp1', 's1', '2026-10-06', 4000000, '', 'MB · 0123456789 · CTY AILLA', 'CHUYEN_KHOAN', ?)").bind(NOW).run();
  await db.prepare("INSERT INTO po_payments (id, supplier_id, pay_date, amount, kind, account, method, ceo_status, created_at) VALUES ('pp2', 's1', '2026-10-25', 1000000, 'COC', '', 'TIEN_MAT', 'CHO', ?)").bind(NOW).run();
  await db.prepare("INSERT INTO po_orders (id, no, order_date, supplier_id, created_at, updated_at) VALUES ('po1', 'PM2610-001', '2026-10-26', 's1', ?, ?)").bind(NOW, NOW).run();
  await db.prepare("INSERT INTO po_lines (id, po_id, item, qty, unit_price) VALUES ('pl1', 'po1', 'NVL1', 3, 200000)").run();
  await db.prepare("INSERT INTO shipping_vouchers (id, voucher_no, voucher_date, carrier, amount, method, from_account, created_at) VALUES ('v1', 'PCVC1', '2026-10-07', 'Nhà xe', 250000, 'TIEN_MAT', '', ?)").bind(NOW).run();
  await db.prepare("INSERT INTO shipping_vouchers (id, voucher_no, voucher_date, carrier, amount, method, created_at) VALUES ('v2', 'PCVC2', '2026-10-23', 'Nhà xe', 200000, 'KHAC', ?)").bind(NOW).run();
});
afterEach(() => vi.useRealTimers());

describe('Tiền & công nợ: một chỗ tính', () => {
  it('nhân viên không xem được', async () => {
    expect((await ctx.request(`${API}/tong-hop`, { as: USERS.thao })).status).toBe(403);
  });

  it('phải thu theo kênh = trang Phải thu (debts/aging) = công nợ chính thức; tuổi nợ từ ngày đơn', async () => {
    const t = (await ctx.request(`${API}/tong-hop`, { as: USERS.ceo })).body.data;
    const a = (await ctx.request('/api/debts/aging', { as: USERS.ceo })).body.data;
    expect(t.khach).toEqual(a);
    const k = t.khach;
    // KPP: 1tr đầu kỳ + 2tr + 3tr − 1,5tr − 0,2tr bù trừ cước − 0,3tr trả lại = 4tr
    const kpp = k.rows.find((r: { customer_id: string }) => r.customer_id === 'cus-thao-1');
    expect(kpp).toMatchObject({ kenh: 'B2B', official_debt: 4_000_000, b30: 3_000_000, b90p: 1_000_000, old: 0 });
    const oem = k.rows.find((r: { customer_id: string }) => r.customer_id === 'cus-oem');
    expect(oem).toMatchObject({ kenh: 'GIA_CONG', official_debt: 4_000_000, b60: 4_000_000 });
    expect(k.by_kenh.B2B.debt + k.by_kenh.GIA_CONG.debt).toBe(k.totals.debt);
    expect(k.by_kenh.GIA_CONG.rev90).toBe(5_000_000);
    expect(k.by_kenh.GIA_CONG.dso).toBe(Math.round((4_000_000 / 5_000_000) * 90));
    const dbt = (await ctx.request('/api/debts', { as: USERS.ceo })).body.data;
    expect(dbt.find((d: { customer_id: string }) => d.customer_id === 'cus-thao-1').official_debt).toBe(4_000_000);
  });

  it('phải trả nhà cung cấp = Mua hàng › Công nợ nhà cung cấp', async () => {
    const t = (await ctx.request(`${API}/tong-hop`, { as: USERS.ceo })).body.data;
    const mh = (await ctx.request('/api/hub/kho/mh/debts', { as: USERS.ceo })).body.data;
    const a = t.ncc.find((r: { id: string }) => r.id === 's1');
    const b = mh.find((r: { id: string }) => r.id === 's1');
    expect(a.balance).toBe(b.balance);
    expect(a).toMatchObject({ invoiced: b.invoiced, paid: b.paid, po_pending: b.po_pending, balance: 7_600_000 });
    // 7,6tr: 600k phiếu mua 26/10 + 7tr hóa đơn 2/10 (25 ngày) → cả hai dưới 30 ngày
    expect(a.b30).toBe(7_600_000);
  });

  it('đối chiếu: nợ đầu + phát sinh − đã trả − trả lại = nợ cuối = số đang hiện', async () => {
    const d = (await ctx.request(`${API}/doi-chieu?from=2026-10-01&to=2026-10-27`, { as: USERS.ceo })).body.data;
    const kpp = d.khach.find((r: { id: string }) => r.id === 'cus-thao-1');
    expect(kpp).toMatchObject({ dau: 3_000_000, phat_sinh: 3_000_000, da_tra: 1_700_000, tra_lai: 300_000, cuoi: 4_000_000, hien: 4_000_000, cho_ghi_no: 700_000, cho_tien_ve: 400_000 });
    const ncc = d.ncc.find((r: { id: string }) => r.id === 's1');
    expect(ncc).toMatchObject({ dau: 2_000_000, phat_sinh: 10_600_000, da_tra: 5_000_000, cuoi: 7_600_000, hien: 7_600_000 });
    // chứng từ tiền: thu đã xác nhận (không gồm bù trừ cước), chi NCC kể cả khoản chờ CEO, chi vận chuyển trừ "khách trả hộ"
    const docs = d.tien.docs as Array<{ loai: string; amount: number; acct: string; ceo: string }>;
    expect(docs.filter((x) => x.loai === 'THU').map((x) => [x.amount, x.acct])).toEqual([[1_500_000, 'acc-mb'], [1_000_000, 'TIEN_MAT']]);
    expect(docs.filter((x) => x.loai === 'CHI_NCC').map((x) => [x.amount, x.acct, x.ceo])).toEqual([[-4_000_000, 'acc-mb', ''], [-1_000_000, 'TIEN_MAT', 'CHO']]);
    expect(docs.filter((x) => x.loai === 'CHI_VC').map((x) => x.amount)).toEqual([-250_000]);
  });

  it('chứng từ từng khách / nhà cung cấp', async () => {
    const k = (await ctx.request(`${API}/chung-tu?kind=kh&id=cus-thao-1`, { as: USERS.ceo })).body.data.rows;
    expect(k.filter((x: { tinh: boolean }) => !x.tinh).length).toBe(2); // đơn chờ ghi nợ + tiền chờ xác nhận
    const n = (await ctx.request(`${API}/chung-tu?kind=ncc&id=s1`, { as: USERS.ceo })).body.data;
    expect(n.rows.find((x: { ref: string }) => x.ref === 'HD00').tinh).toBe(false);
  });
});

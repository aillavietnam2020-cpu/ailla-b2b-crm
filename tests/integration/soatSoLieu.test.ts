import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const NOW = '2026-10-23T01:00:00.000Z';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
});

const soat = async () => {
  const r = await ctx.request('/api/hub/soat', { as: USERS.ceo });
  expect(r.status).toBe(200);
  return r.body.data as {
    summary: { red: number; yellow: number; ok: number };
    findings: Array<{ code: string; severity: string; count: number; rows: Array<Record<string, unknown>> }>;
    passed: Array<{ code: string }>;
    errors: unknown[];
  };
};

describe('Máy soát số liệu', () => {
  it('hệ thống trống: không điểm lệch nào, mọi mục đều soát được', async () => {
    const d = await soat();
    expect(d.findings).toHaveLength(0);
    expect(d.errors).toHaveLength(0);
    expect(d.summary.ok).toBeGreaterThanOrEqual(10);
  });

  it('sale không xem được', async () => {
    const r = await ctx.request('/api/hub/soat', { as: USERS.thao });
    expect(r.status).toBe(403);
  });

  it('K1: tồn kho âm theo sổ kho bị báo', async () => {
    await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES ('VT1', 'Vỏ chai thử', 'Cái', 'NVL', ?)").bind(NOW).run();
    await ctx.db
      .prepare("INSERT INTO kho_docs (no, type, doc_date, status, created_at) VALUES ('PC2610-001', 'PC', '2026-10-20', 'OK', ?)")
      .bind(NOW)
      .run();
    const doc = await ctx.db.prepare("SELECT id FROM kho_docs WHERE no = 'PC2610-001'").first<{ id: number }>();
    await ctx.db.prepare("INSERT INTO kho_moves (doc_id, item, qty, role) VALUES (?, 'VT1', -5, 'USE')").bind(doc?.id).run();
    const d = await soat();
    const k1 = d.findings.find((f) => f.code === 'K1');
    expect(k1?.severity).toBe('DO');
    expect(k1?.rows[0]).toMatchObject({ item: 'VT1', balance: -5 });
    expect(d.summary.red).toBeGreaterThanOrEqual(1);
  });

  it('K3: phiếu kho không có dòng hàng nào bị báo', async () => {
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    await ctx.db
      .prepare("INSERT INTO kho_docs (no, type, doc_date, status, created_at) VALUES ('PN2610-099', 'PN', ?, 'OK', ?)")
      .bind(today, NOW)
      .run();
    const d = await soat();
    expect(d.findings.find((f) => f.code === 'K3')?.rows[0]).toMatchObject({ no: 'PN2610-099' });
  });

  it('H1: gói hoàn quét lâu chưa nhập kho bị báo; gói mới quét thì không', async () => {
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    await ctx.db.prepare("INSERT INTO ret_scans (code, scan_day, scanned_at, channel) VALUES ('CU1', '2020-01-01', ?, 'SHOPEE')").bind(NOW).run();
    await ctx.db.prepare("INSERT INTO ret_scans (code, scan_day, scanned_at, channel) VALUES ('MOI1', ?, ?, 'SHOPEE')").bind(today, NOW).run();
    const d = await soat();
    const h1 = d.findings.find((f) => f.code === 'H1');
    expect(h1?.count).toBe(1);
    expect(h1?.rows[0]).toMatchObject({ code: 'CU1' });
  });

  it('H2: sàn báo đã hoàn quá 3 ngày mà kho chưa quét bị báo', async () => {
    await ctx.db
      .prepare("INSERT INTO ret_orders (channel, order_id, tracking, shop, status, returned_at, synced_at) VALUES ('TIKTOK', 'T9', 'TT9', 'Shop', 5, '2020-01-01T00:00:00.000Z', ?)")
      .bind(NOW)
      .run();
    const d = await soat();
    expect(d.findings.find((f) => f.code === 'H2')?.rows[0]).toMatchObject({ order_id: 'T9' });
    // Kho quét rồi thì hết báo.
    await ctx.db.prepare("INSERT INTO ret_scans (code, scan_day, scanned_at, channel, order_id, state) VALUES ('TT9', '2026-10-22', ?, 'TIKTOK', 'T9', 'NHAP')").bind(NOW).run();
    const d2 = await soat();
    expect(d2.findings.find((f) => f.code === 'H2')).toBeUndefined();
  });

  it('H3: phiếu nhập hoàn có số thực nhập lệch dự kiến bị báo', async () => {
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    await ctx.db
      .prepare("INSERT INTO kho_docs (no, type, doc_date, note, extra, status, created_at) VALUES ('TL2610-001', 'TL', ?, 'Lệch: AAA -1', ?, 'OK', ?)")
      .bind(today, JSON.stringify({ source: 'ret_scans', diff: [{ item: 'AAA', ok: 3, actual: 2, diff: -1 }] }), NOW)
      .run();
    const d = await soat();
    expect(d.findings.find((f) => f.code === 'H3')?.rows[0]).toMatchObject({ no: 'TL2610-001' });
  });

  it('T3: phiếu thu gắn vào đơn nhiều hơn số tiền phiếu bị báo', async () => {
    await seedBusinessData(ctx.db);
    const created = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 2 }] },
    });
    expect(created.status).toBe(201);
    await ctx.db
      .prepare("INSERT INTO payments (id, customer_id, amount, paid_at, created_at, updated_at) VALUES ('pay-x', 'cus-thao-1', 100000, ?, ?, ?)")
      .bind(NOW, NOW, NOW)
      .run();
    await ctx.db
      .prepare("INSERT INTO payment_allocations (id, payment_id, order_id, amount, created_at) VALUES ('pa-x', 'pay-x', ?, 150000, ?)")
      .bind(created.body.data.id, NOW)
      .run();
    const d = await soat();
    const t3 = d.findings.find((f) => f.code === 'T3');
    expect(t3?.severity).toBe('DO');
    expect(t3?.rows[0]).toMatchObject({ amount: 100000, allocated: 150000, over: 50000 });
  });
});

describe('Sổ chi tiết một mã hàng (biết tồn âm từ đâu)', () => {
  it('cho tổng theo loại phiếu và tồn cộng dồn; sale không xem được', async () => {
    await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES ('SP9', 'Sản phẩm thử', 'Chai', 'TP', ?)").bind(NOW).run();
    await ctx.db.prepare("INSERT INTO kho_docs (no, type, doc_date, status, created_at) VALUES ('PN2610-005', 'PN', '2026-10-10', 'OK', ?)").bind(NOW).run();
    await ctx.db.prepare("INSERT INTO kho_docs (no, type, doc_date, status, created_at) VALUES ('XK2610-005', 'XK', '2026-10-12', 'OK', ?)").bind(NOW).run();
    const pn = await ctx.db.prepare("SELECT id FROM kho_docs WHERE no = 'PN2610-005'").first<{ id: number }>();
    const xk = await ctx.db.prepare("SELECT id FROM kho_docs WHERE no = 'XK2610-005'").first<{ id: number }>();
    await ctx.db.prepare("INSERT INTO kho_moves (doc_id, item, qty, role) VALUES (?, 'SP9', 10, 'IN')").bind(pn?.id).run();
    await ctx.db.prepare("INSERT INTO kho_moves (doc_id, item, qty, role) VALUES (?, 'SP9', -25, 'OUT')").bind(xk?.id).run();
    const r = await ctx.request('/api/hub/soat/item/SP9', { as: USERS.ceo });
    expect(r.status).toBe(200);
    expect(r.body.data.balance).toBe(-15);
    expect(r.body.data.by_type).toEqual([
      { type: 'XK', lines: 1, qty: -25 },
      { type: 'PN', lines: 1, qty: 10 },
    ]);
    expect(r.body.data.recent[0]).toMatchObject({ doc_no: 'XK2610-005', balance: -15 });
    expect((await ctx.request('/api/hub/soat/item/SP9', { as: USERS.thao })).status).toBe(403);
    expect((await ctx.request('/api/hub/soat/item/KHONGCO', { as: USERS.ceo })).status).toBe(404);
    // K1 giờ có cả tổng nhập / xuất
    const d = (await ctx.request('/api/hub/soat', { as: USERS.ceo })).body.data;
    expect(d.findings.find((f: { code: string }) => f.code === 'K1').rows[0]).toMatchObject({ item: 'SP9', in_qty: 10, out_qty: 25, balance: -15 });
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { pack } from '@server/lib/pack';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

async function agentCall(token: string, path: string) {
  const res = await ctx.app.fetch(
    new Request(`http://localhost${path}`, { headers: { Authorization: `Bearer ${token}` } }),
    ctx.env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function makeAgent(name: string, scopes: string[]) {
  const res = await ctx.request('/api/admin/agents', { as: USERS.ceo, body: { name, scopes } });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; token: string };
}

const status = async (token: string, path: string) => (await agentCall(token, path)).status;

describe('Phạm vi đọc của agent theo vai', () => {
  it('agent không có phạm vi nào thì không đọc được gì', async () => {
    const a = await makeAgent('Agent trống', []);
    for (const p of ['/api/agent/orders', '/api/agent/kho/stock', '/api/agent/events', '/api/agent/mkt/cards', '/api/agent/xuong']) {
      expect(await status(a.token, p)).toBe(403);
    }
    expect(await status(a.token, '/api/agent/me')).toBe(200);
  });

  it('kế toán: đơn và công nợ, không thấy kho', async () => {
    const a = await makeAgent('Kế toán thử', ['orders', 'debts']);
    expect(await status(a.token, '/api/agent/orders')).toBe(200);
    expect(await status(a.token, '/api/agent/events')).toBe(200);
    expect(await status(a.token, '/api/agent/kho/stock')).toBe(403);
    expect(await status(a.token, '/api/agent/kho/pha-che')).toBe(403);
    expect(await status(a.token, '/api/agent/mkt/cards')).toBe(403);
  });

  it('CRM cho kế toán: tìm khách, công nợ toàn công ty, phiếu thu; agent kho thì không', async () => {
    const acc = await makeAgent('Kế toán CRM', ['orders', 'debts']);
    for (const p of ['/api/agent/customers', '/api/agent/customers?q=a', '/api/agent/debts', '/api/agent/debts?loc=vuot', '/api/agent/payments', '/api/agent/payments?pending=1']) {
      expect(await status(acc.token, p)).toBe(200);
    }
    const debts = await agentCall(acc.token, '/api/agent/debts');
    expect(debts.body.meta.totals).toBeDefined();
    const kho = await makeAgent('Kho CRM', ['kho', 'orders_kho']);
    for (const p of ['/api/agent/customers', '/api/agent/debts', '/api/agent/payments']) {
      expect(await status(kho.token, p)).toBe(403);
    }
  });

  it('kế toán kho: kho và đơn chờ kho, không thấy công nợ khách', async () => {
    const a = await makeAgent('Kho thử', ['kho', 'orders_kho']);
    expect(await status(a.token, '/api/agent/kho/stock')).toBe(200);
    expect(await status(a.token, '/api/agent/kho/pha-che')).toBe(200);
    expect(await status(a.token, '/api/agent/orders')).toBe(200);
    expect(await status(a.token, '/api/agent/orders/abc')).toBe(403);
    expect(await status(a.token, '/api/agent/customers/abc')).toBe(403);
  });

  it('kế toán kho: lọc kho vật tư, nhập–xuất–tồn trong kỳ, đơn chờ kho không có cột tiền', async () => {
    const db = ctx.env.DB;
    const now = '2026-10-01T00:00:00Z';
    for (const [code, name, cls] of [['VT1', 'Vỏ chai 500ml', 'NVL'], ['VT2', 'Nắp chai', 'NVL'], ['TP1', 'Nước giặt 2kg', 'TP']]) {
      await db.prepare('INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES (?, ?, ?, ?, ?)').bind(code, name, 'Cái', cls, now).run();
    }
    const docs: [string, string, string][] = [['PN-A', 'PN', '2026-09-01'], ['PN-B', 'PN', '2026-10-05'], ['XK-A', 'XK', '2026-10-10']];
    const ids: Record<string, number> = {};
    for (const [no, type, date] of docs) {
      await db.prepare('INSERT INTO kho_docs (no, type, doc_date, status, created_at) VALUES (?, ?, ?, ?, ?)').bind(no, type, date, 'OK', now).run();
      ids[no] = (await db.prepare('SELECT id FROM kho_docs WHERE no = ?').bind(no).first<{ id: number }>())!.id;
    }
    const moves: [string, string, number][] = [['PN-A', 'VT1', 100], ['PN-B', 'VT1', 50], ['XK-A', 'VT1', -30], ['XK-A', 'VT2', -5], ['PN-A', 'TP1', 10]];
    for (const [no, item, qty] of moves) {
      await db.prepare('INSERT INTO kho_moves (doc_id, item, qty, role) VALUES (?, ?, ?, ?)').bind(ids[no], item, qty, 'IN').run();
    }
    const a = await makeAgent('Kho vật tư', ['kho', 'orders_kho']);

    const nvl = await agentCall(a.token, '/api/agent/kho/stock?cls=NVL');
    expect(nvl.body.data.map((x: any) => x.code).sort()).toEqual(['VT1', 'VT2']);
    const neg = await agentCall(a.token, '/api/agent/kho/stock?cls=NVL&neg=1');
    expect(neg.body.data.map((x: any) => x.code)).toEqual(['VT2']);
    expect(neg.body.meta.total).toBe(1);
    const one = await agentCall(a.token, '/api/agent/kho/stock?q=Vỏ&limit=1');
    expect(one.body.data).toHaveLength(1);

    const nxt = await agentCall(a.token, '/api/agent/kho/nxt?from=2026-10-01&to=2026-10-31&cls=NVL');
    expect(nxt.status).toBe(200);
    const vt1 = nxt.body.data.find((x: any) => x.code === 'VT1');
    expect([vt1.opening, vt1.qty_in, vt1.qty_out, vt1.closing]).toEqual([100, 50, 30, 120]);
    expect(nxt.body.data.some((x: any) => x.code === 'TP1')).toBe(false);
    expect(await status(a.token, '/api/agent/kho/nxt?from=bad&to=2026-10-31')).toBe(400);

    const created = await ctx.request('/api/orders', {
      as: USERS.thao,
      body: { customer_id: 'cus-thao-1', order_date: '2026-08-16', items: [{ product_id: 'prod-full', qty: 5 }] },
    });
    expect(created.status).toBe(201);
    const oid = created.body.data.id as string;
    await db.prepare("UPDATE orders SET flow_on = 1, kho_status = 'CHO_XUAT' WHERE id = ?").bind(oid).run();
    const orders = await agentCall(a.token, '/api/agent/orders');
    expect(orders.status).toBe(200);
    expect(orders.body.data.length).toBeGreaterThan(0);
    for (const row of orders.body.data) {
      for (const k of ['total_amount', 'payment_status', 'accounting_status']) expect(row).not.toHaveProperty(k);
      expect(row).toHaveProperty('kho_status');
    }
    // Agent có quyền đơn hàng đầy đủ thì vẫn thấy số tiền.
    const full = await makeAgent('Đơn đầy đủ', ['orders']);
    const fullOrders = await agentCall(full.token, '/api/agent/orders');
    expect(fullOrders.body.data[0]).toHaveProperty('total_amount');
  });

  it('kế toán kho: xem phiếu kiểm kê, xuất kho và lô tem; không có đơn giá', async () => {
    const db = ctx.env.DB;
    const now = '2026-10-01T00:00:00Z';
    await db.prepare('INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES (?, ?, ?, ?, ?)').bind('TP9', 'Nước giặt 2kg', 'Túi', 'TP', now).run();
    for (const [no, type, date] of [['KS-1', 'KS', '2026-10-03'], ['XK-1', 'XK', '2026-10-04'], ['PN-1', 'PN', '2026-09-20']]) {
      await db.prepare('INSERT INTO kho_docs (no, type, doc_date, partner, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(no, type, date, 'Nơi nhận A', 'OK', now).run();
    }
    const ks = (await db.prepare("SELECT id FROM kho_docs WHERE no = 'KS-1'").first<{ id: number }>())!.id;
    await db.prepare('INSERT INTO kho_moves (doc_id, item, qty, price, role) VALUES (?, ?, ?, ?, ?)').bind(ks, 'TP9', 40, 12345, 'IN').run();
    const sx = {
      products: [{ ma: 'TP9', ten: 'Nước giặt 2kg' }],
      batches: [
        { id: 'b1', ma: 'L-001', sp: 'TP9', ngay: '2026-10-02', baoSL: 100, tong: 100, dat: 90, loi: 5, cho: 5, st: 'TEM_SAN', kiemBy: 'Huệ',
          containers: [{ c: 'c01', loai: 'Thùng', sl: 50, st: 'OK', in: [] }, { c: 'c02', loai: 'Thùng', sl: 40, st: 'OK', in: [{ at: 'x' }] }] },
        { id: 'b2', ma: 'L-002', sp: 'TP9', ngay: '2026-10-05', baoSL: 10, st: 'CHO_KIEM', containers: [] },
      ],
    };
    await db
      .prepare(`INSERT INTO hub_state (id, version, data, updated_at, updated_by) VALUES ('sx', 1, ?, '2026-10-20T00:00:00Z', NULL)`)
      .bind(await pack(JSON.stringify(sx)))
      .run();
    const a = await makeAgent('Kho phiếu', ['kho', 'orders_kho']);

    const kk = await agentCall(a.token, '/api/agent/kho/docs?type=KS');
    expect(kk.body.data.map((x: any) => x.no)).toEqual(['KS-1']);
    expect(kk.body.data[0].n_lines).toBe(1);
    const range = await agentCall(a.token, '/api/agent/kho/docs?from=2026-10-01&to=2026-10-31');
    expect(range.body.data.map((x: any) => x.no).sort()).toEqual(['KS-1', 'XK-1']);
    expect(await status(a.token, '/api/agent/kho/docs?type=ZZ')).toBe(400);
    const detail = await agentCall(a.token, `/api/agent/kho/docs/${ks}`);
    expect(detail.body.data.lines[0]).toMatchObject({ code: 'TP9', qty: 40 });
    expect(JSON.stringify(detail.body.data)).not.toContain('12345');
    expect(await status(a.token, '/api/agent/kho/docs/99999')).toBe(404);

    const lots = await agentCall(a.token, '/api/agent/kho/lots');
    expect(lots.body.data.map((x: any) => x.ma)).toEqual(['L-002', 'L-001']);
    expect(lots.body.meta.by_status).toEqual({ TEM_SAN: 1, CHO_KIEM: 1 });
    const l1 = lots.body.data.find((x: any) => x.ma === 'L-001');
    expect([l1.dat, l1.loi, l1.cho, l1.tem_da_tao, l1.tem_da_in]).toEqual([90, 5, 5, 2, 1]);
    expect(l1.ten).toBe('Nước giặt 2kg');
    const chosen = await agentCall(a.token, '/api/agent/kho/lots?st=CHO_KIEM');
    expect(chosen.body.data.map((x: any) => x.ma)).toEqual(['L-002']);
    expect(await status(a.token, '/api/agent/kho/lots?st=ZZZ')).toBe(400);

    // Agent không có phạm vi kho thì không đọc được.
    const none = await makeAgent('Không kho', ['orders']);
    for (const pth of ['/api/agent/kho/docs', '/api/agent/kho/lots']) expect(await status(none.token, pth)).toBe(403);
  });

  it('kế toán kho: xem thống kê Xuất B2C theo ngày và kênh, tổng 7 ngày, chưa có mã', async () => {
    const db = ctx.env.DB;
    const rec = '2026-10-10T00:00:00Z';
    await db.prepare('INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES (?, ?, ?, ?, ?)').bind('TP7', 'Tẩy lồng', 'Gói', 'TP', rec).run();
    for (const [ch, day, orders] of [['TIKTOK', '2026-10-09', 10], ['SHOPEE', '2026-10-09', 4], ['TIKTOK', '2026-10-08', 6]] as const) {
      await db.prepare('INSERT INTO channel_runs (channel, day, orders, lines, received_at) VALUES (?, ?, ?, 0, ?)').bind(ch, day, orders, rec).run();
    }
    await db.prepare('INSERT INTO channel_out (channel, day, item, qty) VALUES (?, ?, ?, ?)').bind('TIKTOK', '2026-10-09', 'TP7', 30).run();
    await db.prepare('INSERT INTO channel_unmapped (channel, day, label, qty) VALUES (?, ?, ?, ?)').bind('TIKTOK', '2026-10-09', 'Quà lạ', 3).run();
    const a = await makeAgent('Kho online', ['kho']);
    const r = await agentCall(a.token, '/api/agent/kho/online');
    const d = r.body.data;
    const tt = d.theo_ngay.find((x: any) => x.channel === 'TIKTOK' && x.day === '2026-10-09');
    expect([tt.orders, tt.san_pham, tt.chua_co_ma_vat_tu]).toEqual([10, 33, 3]);
    expect(d.tong_7_ngay_gan_nhat.theo_kenh.TIKTOK.orders).toBe(16);
    expect(d.tong_7_ngay_gan_nhat.san_pham_le_ban).toBe(33);
    expect(d.tong_7_ngay_gan_nhat.chua_co_ma_vat_tu).toBe(3);
    const only = await agentCall(a.token, '/api/agent/kho/online?channel=SHOPEE');
    expect(only.body.data.theo_ngay.map((x: any) => x.channel)).toEqual(['SHOPEE']);
    expect(await status(a.token, '/api/agent/kho/online?channel=ZZ')).toBe(400);
    const none = await makeAgent('Không kho online', ['orders']);
    expect(await status(none.token, '/api/agent/kho/online')).toBe(403);
  });


  it('tra sản phẩm theo tên/mã cho agent đơn hàng; agent không có phạm vi đơn thì không tra được', async () => {
    const a = await makeAgent('Sale tra mã', ['orders']);
    const all = await agentCall(a.token, '/api/agent/products?limit=5');
    expect(all.status).toBe(200);
    expect(Array.isArray(all.body.data)).toBe(true);
    if (all.body.data.length) {
      const one = all.body.data[0];
      const hit = await agentCall(a.token, `/api/agent/products?q=${encodeURIComponent(one.sku)}`);
      expect(hit.body.data.some((x: any) => x.id === one.id)).toBe(true);
    }
    const none = await makeAgent('Không đơn', ['kho']);
    expect(await status(none.token, '/api/agent/products')).toBe(403);
  });

  it('Marketing: Content thấy thẻ video, Digital thấy order Digital, không chéo team', async () => {
    const data = {
      users: [{ id: 'u1', name: 'Quỳnh' }],
      cards: [{ id: 'TT-0001', kenh: 'TikTok chính', sku: 'BT', step: 'kb', nguoi: 'u1', yTuong: 'Ý tưởng thử', day: 5 }],
      orders: [{ ma: 'ORD-0001', ngay: '02/10', kenh: 'Facebook Ads', sku: 'BT', muc: 'Test hook', sl: 3, han: 6, trangThai: 'Mới', nguoiOrder: 'u1' }],
    };
    await ctx.db
      .prepare(`INSERT INTO hub_state (id, version, data, updated_at, updated_by) VALUES ('main', 1, ?, '2026-10-20T00:00:00Z', NULL)`)
      .bind(await pack(JSON.stringify(data)))
      .run();
    const content = await makeAgent('Content thử', ['mkt_content', 'xuong']);
    const digital = await makeAgent('Digital thử', ['mkt_digital']);

    const cards = await agentCall(content.token, '/api/agent/mkt/cards');
    expect(cards.status).toBe(200);
    expect(cards.body.data[0]).toMatchObject({ id: 'TT-0001', buoc: 'Viết kịch bản', nguoi: 'Quỳnh' });
    expect(await status(content.token, '/api/agent/mkt/orders')).toBe(403);
    expect(await status(content.token, '/api/agent/xuong')).toBe(200);

    const orders = await agentCall(digital.token, '/api/agent/mkt/orders');
    expect(orders.status).toBe(200);
    expect(orders.body.data[0]).toMatchObject({ ma: 'ORD-0001', nguoi_order: 'Quỳnh' });
    expect(await status(digital.token, '/api/agent/mkt/cards')).toBe(403);
    expect(await status(digital.token, '/api/agent/xuong')).toBe(403);
    expect(await status(digital.token, '/api/agent/orders')).toBe(403);
  });

  it('CEO đổi phạm vi của agent và có hiệu lực ngay', async () => {
    const a = await makeAgent('Đổi quyền', ['kho']);
    expect(await status(a.token, '/api/agent/kho/stock')).toBe(200);
    const set = await ctx.request(`/api/admin/agents/${a.id}/scopes`, { as: USERS.ceo, method: 'PUT', body: { scopes: ['orders'] } });
    expect(set.status).toBe(200);
    expect(await status(a.token, '/api/agent/kho/stock')).toBe(403);
    expect(await status(a.token, '/api/agent/orders')).toBe(200);
    const bad = await ctx.request(`/api/admin/agents/${a.id}/scopes`, { as: USERS.ceo, method: 'PUT', body: { scopes: ['hack'] } });
    expect(bad.status).toBe(422);
    const denied = await ctx.request(`/api/admin/agents/${a.id}/scopes`, { as: USERS.manager, method: 'PUT', body: { scopes: ['orders'] } });
    expect(denied.status).toBe(403);
  });
});

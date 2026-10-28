import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';
import { syncComboTasks, TASK_PREFIX } from '@server/routes/sanpham';

let ctx: TestContext;
const NOW = '2026-10-28T01:00:00.000Z';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  // Kế toán: chị Thảo được cấp quyền kế toán + vào trang quản trị.
  for (const p of ['order.accounting.confirm', 'hub.access']) {
    await ctx.db
      .prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES ('user-thao', ?, 'user-ceo', ?)")
      .bind(p, NOW)
      .run();
  }
  for (const [code, name, cls, grp] of [
    ['TLG', 'Tẩy lồng giặt', 'TP', 'Thành phẩm'],
    ['CHOI', 'Chổi cọ', 'HH', 'Hàng hóa'],
    ['HOP5', 'Hộp 5kg', 'NVL', 'Hộp, thùng, phụ kiện đóng gói'],
  ]) {
    await ctx.db
      .prepare('INSERT INTO kho_items (code, name, unit, cls, grp, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(code, name, 'Cái', cls, grp, NOW)
      .run();
  }
  const line = (id: string, day: string, sku: string, qty: number) =>
    ctx.db
      .prepare(
        "INSERT INTO channel_order_lines (channel, order_id, line_no, day, shipped_at, shop, sku, variant, name, qty) VALUES ('SHOPEE', ?, 1, ?, ?, 'Ailla VN', ?, '', 'Combo tẩy lồng', ?)",
      )
      .bind(id, day, day + 'T03:00:00.000Z', sku, qty)
      .run();
  await line('A', '2026-10-05', '2TL', 1);
  await line('B', '2026-10-07', '2TL', 2);
});

const put = (as: string, body: unknown) => ctx.request('/api/hub/sanpham/combo', { method: 'PUT', as, body });
const out = async () =>
  (
    await ctx.db
      .prepare("SELECT day, item, qty FROM channel_out WHERE channel = 'SHOPEE' ORDER BY day, item")
      .all<{ day: string; item: string; qty: number }>()
  ).results ?? [];
const COMBO = {
  channel: 'SHOPEE',
  sku: '2TL',
  variant: '',
  parts: [
    { item_label: 'TLG', qty: 2, kind: 'sp' },
    { item_label: 'CHOI', qty: 1, kind: 'gift' },
    { item_label: 'HOP5', qty: 1, kind: 'pack' },
  ],
};

describe('Sản phẩm & combo: luồng ngược (mã mới trên đơn)', () => {
  it('mã chưa quy đổi được liệt kê, báo kế toán; nhập combo xong tự tính lại phiếu xuất và đóng việc', async () => {
    const un = await ctx.request('/api/hub/sanpham/unmapped', { as: USERS.ceo });
    expect(un.status).toBe(200);
    expect(un.body.data).toEqual([expect.objectContaining({ channel: 'SHOPEE', sku: '2TL', orders: 2, shops: ['Ailla VN'] })]);
    const t = await syncComboTasks(ctx.db as unknown as D1Database);
    expect(t).toMatchObject({ codes: 1, orders: 2 });
    const task = await ctx.db.prepare("SELECT title, status FROM tasks WHERE assignee_id = 'user-thao'").first<{ title: string; status: string }>();
    expect(task?.title.startsWith(TASK_PREFIX)).toBe(true);
    // Chạy lại không tạo việc trùng.
    await syncComboTasks(ctx.db as unknown as D1Database);
    expect((await ctx.db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE assignee_id = 'user-thao'").first<{ n: number }>())?.n).toBe(1);

    const r = await put(USERS.thao, COMBO);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ parts: 3, recomputed_days: 2, orders: 2, unmapped_left: 0 });
    expect(await out()).toEqual([
      { day: '2026-10-05', item: 'CHOI', qty: 1 },
      { day: '2026-10-05', item: 'HOP5', qty: 1 },
      { day: '2026-10-05', item: 'TLG', qty: 2 },
      { day: '2026-10-07', item: 'CHOI', qty: 2 },
      { day: '2026-10-07', item: 'HOP5', qty: 2 },
      { day: '2026-10-07', item: 'TLG', qty: 4 },
    ]);
    const rows = (await ctx.db.prepare("SELECT item_label, kind FROM channel_map WHERE sku = '2TL' ORDER BY item_label").all()).results;
    expect(rows).toEqual([
      { item_label: 'CHOI - Chổi cọ', kind: 'gift' },
      { item_label: 'HOP5 - Hộp 5kg', kind: 'pack' },
      { item_label: 'TLG - Tẩy lồng giặt', kind: 'sp' },
    ]);
    expect((await ctx.db.prepare("SELECT status FROM tasks WHERE assignee_id = 'user-thao'").first<{ status: string }>())?.status).toBe('DONE');
    const h = await ctx.request('/api/hub/sanpham/history?channel=SHOPEE&sku=2TL', { as: USERS.ceo });
    expect(h.body.data[0]).toMatchObject({ action: 'SP_COMBO_ADD' });
  });

  it('chỉ CEO và kế toán sửa; món chưa có mã kho bị chặn', async () => {
    expect((await put(USERS.manager, COMBO)).status).toBe(403);
    const bad = await put(USERS.ceo, { ...COMBO, parts: [{ item_label: '(chưa có mã) Vòi xịt', qty: 1, kind: 'sp' }] });
    expect(bad.status).toBe(400);
    expect((await ctx.request('/api/hub/kho/online/map/set', { as: USERS.manager, body: { channel: 'SHOPEE', sku: '2TL', parts: [{ item_label: 'TLG', qty: 1 }] } })).status).toBe(403);
  });

  it('ngừng dùng từ một ngày: ngày trước giữ cách cũ, từ ngày đó về lại "chưa quy đổi"; dùng lại thì tính lại', async () => {
    await put(USERS.ceo, COMBO);
    const s = await ctx.request('/api/hub/sanpham/combo/stop', { as: USERS.ceo, body: { channel: 'SHOPEE', sku: '2TL', variant: '', off_from: '2026-10-06' } });
    expect(s.status).toBe(200);
    expect((await out()).map((x) => x.day)).toEqual(['2026-10-05', '2026-10-05', '2026-10-05']);
    const un = await ctx.request('/api/hub/sanpham/unmapped', { as: USERS.ceo });
    expect(un.body.data[0]).toMatchObject({ sku: '2TL', orders: 1, first_day: '2026-10-07' });
    await ctx.request('/api/hub/sanpham/combo/stop', { as: USERS.ceo, body: { channel: 'SHOPEE', sku: '2TL', variant: '', off_from: '' } });
    expect(await out()).toHaveLength(6);
  });
});

describe('Sản phẩm gốc: thêm một bước', () => {
  it('tạo mã kho + mã bán Kênh phân phối + nối mã', async () => {
    const r = await ctx.request('/api/hub/sanpham/products', {
      as: USERS.thao,
      body: { code: 'AILLALS1Q', name: 'Nước lau sàn 1L Quế', unit: 'Chai', cls: 'TP', kpp: true },
    });
    expect(r.status).toBe(200);
    expect(await ctx.db.prepare("SELECT cls FROM kho_items WHERE code = 'AILLALS1Q'").first()).toEqual({ cls: 'TP' });
    expect(await ctx.db.prepare("SELECT name FROM products WHERE sku = 'AILLALS1Q'").first()).toEqual({ name: 'Nước lau sàn 1L Quế' });
    expect(await ctx.db.prepare("SELECT misa_code, factor FROM kho_map WHERE crm_sku = 'AILLALS1Q'").first()).toEqual({ misa_code: 'AILLALS1Q', factor: 1 });
    const dup = await ctx.request('/api/hub/sanpham/products', { as: USERS.ceo, body: { code: 'ailla ls', name: 'x' } });
    expect(dup.status).toBe(400);
    const again = await ctx.request('/api/hub/sanpham/products', { as: USERS.ceo, body: { code: 'AILLALS1Q', name: 'x' } });
    expect(again.status).toBe(409);
    const off = await ctx.request('/api/hub/sanpham/products/AILLALS1Q', { method: 'PATCH', as: USERS.ceo, body: { active: false } });
    expect(off.status).toBe(200);
    expect(await ctx.db.prepare("SELECT active FROM kho_items WHERE code = 'AILLALS1Q'").first()).toEqual({ active: 0 });
    expect((await ctx.request('/api/hub/sanpham/products', { as: USERS.manager, body: { code: 'X1', name: 'x' } })).status).toBe(403);
  });
});

describe('Chuyển dữ liệu cũ (migration 0190): điền loại món, không mất dòng nào', () => {
  it('quà theo ghi chú / hàng hóa trong combo có thành phẩm, bao bì theo nhóm kho, BỎ QUA', async () => {
    const { readFileSync } = await import('node:fs');
    const ins = (sku: string, label: string, note = '') =>
      ctx.db
        .prepare("INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, note, updated_at) VALUES ('FACEBOOK', ?, '', '', ?, 1, ?, ?)")
        .bind(sku, label, note, NOW)
        .run();
    await ins('C1', 'TLG - Tẩy lồng giặt');
    await ins('C1', 'CHOI - Chổi cọ');
    await ins('C1', 'HOP5 - Hộp 5kg');
    await ins('C2', 'CHOI - Chổi cọ');
    await ins('C3', 'TLG - Tẩy lồng giặt', 'Quà tặng');
    await ins('C4', 'BỎ QUA');
    await ins('C5', '(chưa có mã) Vòi xịt');
    const sql = readFileSync('migrations/0190_san_pham_combo.sql', 'utf8')
      .split(';')
      .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
      .filter((s) => s.startsWith('UPDATE'));
    expect(sql).toHaveLength(3);
    for (const s of sql) await ctx.db.prepare(s).run();
    const rows = (await ctx.db.prepare("SELECT sku, item_label, kind FROM channel_map WHERE channel = 'FACEBOOK' ORDER BY sku, item_label").all()).results;
    expect(rows).toEqual([
      { sku: 'C1', item_label: 'CHOI - Chổi cọ', kind: 'gift' },
      { sku: 'C1', item_label: 'HOP5 - Hộp 5kg', kind: 'pack' },
      { sku: 'C1', item_label: 'TLG - Tẩy lồng giặt', kind: 'sp' },
      { sku: 'C2', item_label: 'CHOI - Chổi cọ', kind: 'sp' },
      { sku: 'C3', item_label: 'TLG - Tẩy lồng giặt', kind: 'gift' },
      { sku: 'C4', item_label: 'BỎ QUA', kind: 'skip' },
      { sku: 'C5', item_label: '(chưa có mã) Vòi xịt', kind: 'sp' },
    ]);
  });
});

describe('Lưu vết giá vốn', () => {
  it('ghi nhật ký giá cũ → mới; người không phải kế toán bị chặn', async () => {
    const r = await ctx.request('/api/hub/sanpham/cost-log', { as: USERS.thao, body: { code: 'TLG', ky: '2026-10', old: 6000, new: 6500 } });
    expect(r.status).toBe(200);
    const h = await ctx.request('/api/hub/sanpham/cost-history?code=TLG', { as: USERS.ceo });
    expect(h.body.data[0]).toMatchObject({ action: 'SP_GIA_VON' });
    expect(JSON.parse(h.body.data[0].after_json)).toEqual({ ky: '2026-10', gia: 6500 });
    expect(JSON.parse(h.body.data[0].before_json)).toEqual({ ky: '2026-10', gia: 6000 });
    expect((await ctx.request('/api/hub/sanpham/cost-log', { as: USERS.manager, body: { code: 'TLG', ky: '2026-10', new: 1 } })).status).toBe(403);
    expect((await ctx.request('/api/hub/sanpham/cost-log', { as: USERS.ceo, body: { code: 'TLG', ky: '2026-10', new: -1 } })).status).toBe(400);
  });
});

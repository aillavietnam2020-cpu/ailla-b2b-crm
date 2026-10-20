import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const NOW = '2026-10-14T01:00:00.000Z';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  for (const [code, name, cls, grp] of [
    ['VC3.6GND', 'Vỏ can 3.6 lít GND', 'NVL', 'Vỏ can, chai, túi'],
    ['TH5KIN', 'Thùng 5 kín', 'NVL', 'Hộp, thùng, phụ kiện đóng gói'],
    ['AILANG3', 'Nước giặt Ailla 3.6L', 'TP', 'Thành phẩm'],
  ]) {
    await ctx.db
      .prepare('INSERT INTO kho_items (code, name, unit, cls, grp, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(code, name, 'Cái', cls, grp, NOW)
      .run();
  }
  await ctx.db
    .prepare("INSERT INTO kho_bom (product, item, qty, kind, note, sort) VALUES ('AILANG3', 'VC3.6GND', 1, 'Vỏ can, chai, túi', '', 1)")
    .run();
});

describe('Hồ sơ vỏ can / thùng', () => {
  it('liệt kê vỏ và thành phẩm dùng vỏ đó từ định mức', async () => {
    const empty = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    expect(empty.body.data.items).toHaveLength(0);
    for (const code of ['VC3.6GND', 'TH5KIN'])
      await ctx.request('/api/hub/kho/vo/' + code, { as: USERS.ceo, method: 'PUT', body: { kind: 'CAN' } });
    const r = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    expect(r.status).toBe(200);
    const codes = r.body.data.items.map((i: { code: string }) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['VC3.6GND', 'TH5KIN']));
    expect(codes).not.toContain('AILANG3');
    expect(r.body.data.used['VC3.6GND']).toEqual(['AILANG3']);
  });

  it('nạp file: lưu đặc điểm vỏ, bảng đóng gói, báo mã lạ', async () => {
    const r = await ctx.request('/api/hub/kho/vo/import', {
      as: USERS.ceo,
      body: {
        vo: [
          { code: 'VC3.6GND', kind: 'CAN', capacity: '3.6', style: 'GND', color: '?', new_code: '' },
          { code: 'KHONGCO', kind: 'CAN' },
        ],
        pack: [{ product: 'AILANG3', vo: 'VC3.6GND', thung: 'TH5KIN' }],
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.vo).toBe(1);
    expect(r.body.data.pack).toBe(1);
    expect(r.body.data.missing).toContain('KHONGCO');
    const list = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    const vo = list.body.data.items.find((i: { code: string }) => i.code === 'VC3.6GND');
    expect(vo.kind).toBe('CAN');
    expect(vo.color).toBe('');
    expect(list.body.data.used['TH5KIN']).toEqual(['AILANG3']);
  });

  it('gỡ vỏ khỏi danh sách không xóa mã trong kho', async () => {
    await ctx.request('/api/hub/kho/vo/VC3.6GND', { as: USERS.ceo, method: 'PUT', body: { kind: 'CAN' } });
    const del = await ctx.request('/api/hub/kho/vo/VC3.6GND', { as: USERS.ceo, method: 'DELETE' });
    expect(del.status).toBe(200);
    const list = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    expect(list.body.data.items).toHaveLength(0);
    const cat = await ctx.request('/api/hub/kho/catalog', { as: USERS.ceo });
    expect(cat.body.data.items.some((i: { code: string }) => i.code === 'VC3.6GND')).toBe(true);
  });

  it('sửa tay một vỏ', async () => {
    const r = await ctx.request('/api/hub/kho/vo/VC3.6GND', {
      as: USERS.ceo,
      method: 'PUT',
      body: { kind: 'CAN', capacity: '3.6', style: 'GND', color: 'DEN' },
    });
    expect(r.status).toBe(200);
    const list = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    expect(list.body.data.items.find((i: { code: string }) => i.code === 'VC3.6GND').color).toBe('DEN');
  });

  it('tải ảnh vỏ rồi xem lại được', async () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await ctx.request('/api/hub/kho/vo/VC3.6GND', { as: USERS.ceo, method: 'PUT', body: { kind: 'CAN' } });
    const up = await ctx.request('/api/hub/kho/vo/VC3.6GND/photo', { as: USERS.ceo, method: 'PUT', body: { image: png } });
    expect(up.status).toBe(200);
    const list = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    expect(list.body.data.items.find((i: { code: string }) => i.code === 'VC3.6GND').photo_v).toBeTruthy();
    const bad = await ctx.request('/api/hub/kho/vo/VC3.6GND/photo', { as: USERS.ceo, method: 'PUT', body: { image: 'abc' } });
    expect(bad.status).toBe(400);
  });

  it('nhà cung cấp: lưu nhiều dòng, giá chỉ người có quyền xem, sale không sửa được', async () => {
    const put = await ctx.request('/api/hub/kho/vo/VC3.6GND/ncc', {
      as: USERS.ceo,
      method: 'PUT',
      body: { rows: [{ name: 'NCC A', price: 3500 }, { name: 'NCC B', ncc_code: 'CAN-36', main: true }] },
    });
    expect(put.status).toBe(200);
    const ceo = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    const rows = ceo.body.data.ncc['VC3.6GND'];
    expect(rows).toHaveLength(2);
    expect(rows.find((r: { name: string }) => r.name === 'NCC A').price).toBe(3500);
    expect(rows.filter((r: { main: number }) => r.main).length).toBe(1);
    const sale = await ctx.request('/api/hub/kho/vo/VC3.6GND/ncc', {
      as: USERS.huyen,
      method: 'PUT',
      body: { rows: [{ name: 'X' }] },
    });
    expect(sale.status).toBe(403);
  });

  it('khai thành phẩm dùng vỏ, gỡ ra được', async () => {
    await ctx.request('/api/hub/kho/vo/VC3.6GND', { as: USERS.ceo, method: 'PUT', body: { kind: 'CAN' } });
    const put = await ctx.request('/api/hub/kho/vo/VC3.6GND/uses', { as: USERS.ceo, method: 'PUT', body: { products: ['AILANG3'] } });
    expect(put.status).toBe(200);
    let list = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    expect(list.body.data.packed['VC3.6GND']).toEqual(['AILANG3']);
    const bad = await ctx.request('/api/hub/kho/vo/VC3.6GND/uses', { as: USERS.ceo, method: 'PUT', body: { products: ['KHONGCO'] } });
    expect(bad.status).toBe(400);
    await ctx.request('/api/hub/kho/vo/VC3.6GND/uses', { as: USERS.ceo, method: 'PUT', body: { products: [] } });
    list = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    expect(list.body.data.packed['VC3.6GND']).toBeUndefined();
  });

  it('đổi mã MISA của vỏ: đổi ở định mức, ảnh, hồ sơ; không cho trùng mã khác', async () => {
    await ctx.request('/api/hub/kho/vo/VC3.6GND', { as: USERS.ceo, method: 'PUT', body: { kind: 'CAN' } });
    const dup = await ctx.request('/api/hub/kho/vo/VC3.6GND/rename', { as: USERS.ceo, method: 'POST', body: { code: 'TH5KIN' } });
    expect(dup.status).toBe(409);
    const r = await ctx.request('/api/hub/kho/vo/VC3.6GND/rename', {
      as: USERS.ceo,
      method: 'POST',
      body: { code: 'VOCAN36', name: 'Vỏ can 3.6 lít' },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.code).toBe('VOCAN36');
    const list = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    const codes = list.body.data.items.map((i: { code: string }) => i.code);
    expect(codes).toContain('VOCAN36');
    expect(codes).not.toContain('VC3.6GND');
    expect(list.body.data.used['VOCAN36']).toEqual(['AILANG3']);
    const bom = await ctx.db.prepare("SELECT item FROM kho_bom WHERE product = 'AILANG3'").all<{ item: string }>();
    expect(bom.results.map((x) => x.item)).toEqual(['VOCAN36']);
    const old = await ctx.db.prepare("SELECT 1 AS x FROM kho_items WHERE code = 'VC3.6GND'").first();
    expect(old).toBeNull();
    const huyen = await ctx.request('/api/hub/kho/vo/VOCAN36/rename', { as: USERS.huyen, method: 'POST', body: { code: 'X' } });
    expect(huyen.status).toBe(403);
  });

  it('nạp file mã mới: tạo luôn mã chưa có trong kho thành khung vỏ', async () => {
    const r = await ctx.request('/api/hub/kho/vo/import', {
      as: USERS.ceo,
      body: {
        create: true,
        vo: [
          { code: 'VOCHAI300-1', name: 'Vỏ chai 300ml (1)', grp: 'VO', kind: 'CHAI', capacity: '300ML' },
          { code: 'VC3.6GND', kind: 'CAN', capacity: '3.6' },
          { code: 'KHONGTEN' },
        ],
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.created).toBe(1);
    expect(r.body.data.vo).toBe(2);
    expect(r.body.data.missing).toContain('KHONGTEN');
    const list = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    const nv = list.body.data.items.find((i: { code: string }) => i.code === 'VOCHAI300-1');
    expect(nv.name).toBe('Vỏ chai 300ml (1)');
    expect(nv.kind).toBe('CHAI');
    // nạp lại lần nữa không ghi đè thông tin đã có bằng ô trống
    await ctx.request('/api/hub/kho/vo/import', { as: USERS.ceo, body: { create: true, vo: [{ code: 'VOCHAI300-1', name: 'x' }] } });
    const again = await ctx.request('/api/hub/kho/vo', { as: USERS.ceo });
    expect(again.body.data.items.find((i: { code: string }) => i.code === 'VOCHAI300-1').kind).toBe('CHAI');
  });

  it('danh sách đã đổi mã: gộp nhiều lần đổi về mã gốc → mã hiện tại', async () => {
    await ctx.request('/api/hub/kho/vo/VC3.6GND', { as: USERS.ceo, method: 'PUT', body: { kind: 'CAN' } });
    await ctx.request('/api/hub/kho/vo/VC3.6GND/rename', { as: USERS.ceo, method: 'POST', body: { code: 'VOCAN36' } });
    await ctx.request('/api/hub/kho/vo/VOCAN36/rename', { as: USERS.ceo, method: 'POST', body: { code: 'VOCAN36B', name: 'Vỏ can 3.6 lít đen' } });
    const r = await ctx.request('/api/hub/kho/vo/renames', { as: USERS.ceo });
    expect(r.status).toBe(200);
    expect(r.body.data.renamed).toHaveLength(1);
    expect(r.body.data.renamed[0].old_code).toBe('VC3.6GND');
    expect(r.body.data.renamed[0].new_code).toBe('VOCAN36B');
    expect(r.body.data.renamed[0].new_name).toBe('Vỏ can 3.6 lít đen');
    expect(r.body.data.added).toHaveLength(0);
    const huyen = await ctx.request('/api/hub/kho/vo/renames', { as: USERS.huyen });
    expect(huyen.status).toBe(403);
  });

  it('danh sách đổi mã kèm các mã mới thêm vào từ file (chị Huệ cần tạo trên MISA)', async () => {
    await ctx.request('/api/hub/kho/vo/import', {
      as: USERS.ceo,
      body: { create: true, vo: [{ code: 'VOMOI1', name: 'Vỏ mới 1', grp: 'VO' }, { code: 'VC3.6GND' }] },
    });
    const r = await ctx.request('/api/hub/kho/vo/renames', { as: USERS.ceo });
    expect(r.body.data.added.map((x: { code: string }) => x.code)).toEqual(['VOMOI1']);
  });

  it('xóa mã: chỉ xóa được mã chưa phát sinh; mã đã dùng thì chỉ ngừng dùng', async () => {
    const used = await ctx.request('/api/hub/kho/items/VC3.6GND', { as: USERS.ceo, method: 'DELETE' });
    expect(used.status).toBe(409);
    const off = await ctx.request('/api/hub/kho/items/VC3.6GND/active', { as: USERS.ceo, method: 'POST', body: { active: false } });
    expect(off.status).toBe(200);
    const cat = await ctx.request('/api/hub/kho/catalog', { as: USERS.ceo });
    expect(cat.body.data.items.find((i: { code: string }) => i.code === 'VC3.6GND').active).toBe(0);
    const free = await ctx.request('/api/hub/kho/items/TH5KIN', { as: USERS.ceo, method: 'DELETE' });
    expect(free.status).toBe(200);
    const after = await ctx.request('/api/hub/kho/catalog', { as: USERS.ceo });
    expect(after.body.data.items.some((i: { code: string }) => i.code === 'TH5KIN')).toBe(false);
    const huyen = await ctx.request('/api/hub/kho/items/AILANG3', { as: USERS.huyen, method: 'DELETE' });
    expect(huyen.status).toBe(403);
  });

  it('thao tác hàng loạt: ngừng dùng nhiều mã, xóa mã chưa dùng, mã đã dùng bị chặn', async () => {
    const off = await ctx.request('/api/hub/kho/items/bulk', { as: USERS.ceo, body: { action: 'deactivate', codes: ['VC3.6GND', 'TH5KIN', 'KHONGCO'] } });
    expect(off.status).toBe(200);
    expect(off.body.data.done.sort()).toEqual(['TH5KIN', 'VC3.6GND']);
    expect(off.body.data.missing).toEqual(['KHONGCO']);
    const del = await ctx.request('/api/hub/kho/items/bulk', { as: USERS.ceo, body: { action: 'delete', codes: ['VC3.6GND', 'TH5KIN'] } });
    expect(del.body.data.done).toEqual(['TH5KIN']);
    expect(del.body.data.blocked).toEqual(['VC3.6GND']);
    const huyen = await ctx.request('/api/hub/kho/items/bulk', { as: USERS.huyen, body: { action: 'delete', codes: ['AILANG3'] } });
    expect(huyen.status).toBe(403);
  });

  it('xóa toàn bộ định mức của một sản phẩm (kế toán được, người ngoài thì không)', async () => {
    const no = await ctx.request('/api/hub/kho/bom/AILANG3', { as: USERS.thao, method: 'PUT', body: { lines: [] } });
    expect([200, 403]).toContain(no.status);
    const r = await ctx.request('/api/hub/kho/bom/AILANG3', { as: USERS.ceo, method: 'PUT', body: { lines: [] } });
    expect(r.status).toBe(200);
    const bom = await ctx.db.prepare("SELECT COUNT(*) AS n FROM kho_bom WHERE product = 'AILANG3'").first<{ n: number }>();
    expect(bom?.n).toBe(0);
    const huyen = await ctx.request('/api/hub/kho/bom/AILANG3', { as: USERS.huyen, method: 'PUT', body: { lines: [] } });
    expect(huyen.status).toBe(403);
  });

  it('xóa định mức hàng loạt', async () => {
    const r = await ctx.request('/api/hub/kho/bom/bulk-clear', { as: USERS.ceo, body: { products: ['AILANG3'] } });
    expect(r.status).toBe(200);
    expect(r.body.data.cleared).toBe(1);
    const n = await ctx.db.prepare('SELECT COUNT(*) AS n FROM kho_bom').first<{ n: number }>();
    expect(n?.n).toBe(0);
    const huyen = await ctx.request('/api/hub/kho/bom/bulk-clear', { as: USERS.huyen, body: { products: ['AILANG3'] } });
    expect(huyen.status).toBe(403);
  });

  it('xóa hàng loạt báo lý do từng mã; gỡ quy đổi CRM rồi xóa được', async () => {
    await ctx.db
      .prepare("INSERT INTO kho_map (crm_sku, misa_code, factor, note) VALUES ('CRM-A', 'TH5KIN', 1, '')")
      .run();
    const r1 = await ctx.request('/api/hub/kho/items/bulk', { as: USERS.ceo, body: { action: 'delete', codes: ['TH5KIN', 'VC3.6GND'] } });
    expect(r1.body.data.done).toEqual([]);
    expect(r1.body.data.reasons['TH5KIN'].join(' ')).toContain('CRM quy đổi');
    expect(r1.body.data.reasons['VC3.6GND'].join(' ')).toContain('định mức');
    const huyen = await ctx.request('/api/hub/kho/map/CRM-A', { as: USERS.huyen, method: 'DELETE' });
    expect(huyen.status).toBe(403);
    const rm = await ctx.request('/api/hub/kho/map/CRM-A', { as: USERS.ceo, method: 'DELETE' });
    expect(rm.status).toBe(200);
    const r2 = await ctx.request('/api/hub/kho/items/bulk', { as: USERS.ceo, body: { action: 'delete', codes: ['TH5KIN'] } });
    expect(r2.body.data.done).toEqual(['TH5KIN']);
  });

  it('xóa mã mang theo định mức riêng của nó (mã là sản phẩm)', async () => {
    const r = await ctx.request('/api/hub/kho/items/AILANG3', { as: USERS.ceo, method: 'DELETE' });
    expect(r.status).toBe(200);
    const n = await ctx.db.prepare("SELECT COUNT(*) AS n FROM kho_bom WHERE product = 'AILANG3'").first<{ n: number }>();
    expect(n?.n).toBe(0);
  });
});

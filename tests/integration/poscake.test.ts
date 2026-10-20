import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';
import { codeFields, guardDay, sealKey, syncChannelDay, syncAllChannels, type FetchFn } from '../../src/server/services/poscake';

let ctx: TestContext;
const SECRET = 'khoa-thu-nghiem';
const NOW = '2026-10-01T01:00:00.000Z';
const db = () => ctx.db as unknown as D1Database;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  for (const [code, name] of [
    ['AILLATLGSX', 'Tẩy lồng máy giặt 300g'],
    ['AILLATDGS80HYDEN', 'Tinh dầu 80ml hyden'],
    ['phaoloccan', 'Phao lọc cặn'],
  ] as const) {
    await ctx.db
      .prepare("INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES (?, ?, 'Chai', 'TP', ?)")
      .bind(code, name, NOW)
      .run();
  }
  await ctx.db.prepare("INSERT INTO kho_cfg (k, v) VALUES ('online_from', '2026-10-06')").run();
});

/** Hai đơn Shopee: một đơn gửi trong ngày 06/10 (giờ VN), một đơn gửi sáng 07/10 (không tính vào 06/10). */
function fakePoscake(): FetchFn {
  const body = {
    success: true,
    total_pages: 1,
    data: [
      {
        id: 1,
        custom_id: 'SP-1',
        account: 1026269,
        status: 2,
        status_history: [{ status: 2, updated_at: '2026-10-06T03:00:00' }],
        items: [
          { quantity: 2, variation_info: { name: 'AILLATLGSX - Tẩy lồng', detail: '' } },
          { quantity: 1, variation_info: { name: '1TL+ 1 Lọc Cặn', detail: '1 Tẩy Lồng + 1LọcCặn' } },
        ],
      },
      {
        id: 2,
        custom_id: 'SP-2',
        account: 1229028516,
        status: 2,
        status_history: [{ status: 2, updated_at: '2026-10-06T20:00:00' }], // 03:00 sáng 07/10 giờ VN
        items: [{ quantity: 5, variation_info: { name: 'AILLATLGSX - Tẩy lồng', detail: '' } }],
      },
    ],
  };
  return async (url: string) => {
    expect(url).toContain('/shops/430024955/orders');
    expect(url).toContain('updateStatus=2');
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
}

describe('Nối Poscake: bán qua sàn', () => {
  it('kéo đơn theo ngày giờ Việt Nam, tách combo theo bảng quy đổi, chưa quy đổi thì báo rõ', async () => {
    // Không có khóa mã hoá thì từ chối lưu (không bao giờ lưu mã API dạng chữ thường).
    const refuse = await ctx.request('/api/hub/kho/online/source', {
      as: USERS.ceo,
      method: 'PUT',
      body: { channel: 'SHOPEE', shop_id: '430024955', api_key: 'KHOA-BI-MAT-123' },
    });
    expect(refuse.status).toBeGreaterThanOrEqual(400);
    await ctx.db
      .prepare("INSERT INTO channel_source (channel, shop_id, api_key, updated_at) VALUES ('SHOPEE', '430024955', ?, ?)")
      .bind(await sealKey('KHOA-BI-MAT-123', SECRET), NOW)
      .run();
    // Mã API không bao giờ trả ra lại.
    const src = await ctx.request('/api/hub/kho/online/source', { as: USERS.ceo });
    expect(JSON.stringify(src.body.data)).not.toContain('KHOA-BI-MAT');
    const stored = await ctx.db.prepare("SELECT api_key FROM channel_source WHERE channel = 'SHOPEE'").first<{ api_key: string }>();
    expect(stored?.api_key).not.toContain('KHOA-BI-MAT');

    const r = await syncChannelDay(db(), SECRET, 'SHOPEE', '2026-10-06', fakePoscake());
    expect(r.orders).toBe(1); // đơn SP-2 gửi sáng 07/10 giờ VN nên không tính vào 06/10
    const out = await ctx.db.prepare("SELECT item, qty FROM channel_out WHERE channel = 'SHOPEE' AND day = '2026-10-06'").all<{ item: string; qty: number }>();
    expect(out.results).toEqual([{ item: 'AILLATLGSX', qty: 2 }]);
    const un = await ctx.db.prepare("SELECT label, qty FROM channel_unmapped WHERE channel = 'SHOPEE' AND day = '2026-10-06'").all<{ label: string; qty: number }>();
    expect(un.results[0]!.label).toContain('[Chưa quy đổi] 1TL+ 1 Lọc Cặn / 1 Tẩy Lồng + 1LọcCặn');

    // Kế toán thêm quy đổi ngay trên web: 1 combo = 1 tẩy lồng + 1 phao lọc cặn → số tự tính lại.
    const add1 = await ctx.request('/api/hub/kho/online/map/add', {
      as: USERS.ceo,
      body: { channel: 'SHOPEE', sku: '1TL+ 1 Lọc Cặn', variant: '1 Tẩy Lồng + 1LọcCặn', item_label: 'AILLATLGSX - Tẩy lồng', qty: 1 },
    });
    expect(add1.status).toBe(200);
    await ctx.request('/api/hub/kho/online/map/add', {
      as: USERS.ceo,
      body: { channel: 'SHOPEE', sku: '1TL+ 1 Lọc Cặn', variant: '1 Tẩy Lồng + 1LọcCặn', item_label: 'phaoloccan - Phao lọc cặn', qty: 1 },
    });
    const out2 = await ctx.db
      .prepare("SELECT item, qty FROM channel_out WHERE channel = 'SHOPEE' AND day = '2026-10-06' ORDER BY item")
      .all<{ item: string; qty: number }>();
    expect(out2.results).toEqual([
      { item: 'AILLATLGSX', qty: 3 },
      { item: 'phaoloccan', qty: 1 },
    ]);
    const left = await ctx.db.prepare("SELECT COUNT(*) AS n FROM channel_unmapped WHERE channel = 'SHOPEE'").first<{ n: number }>();
    expect(left?.n).toBe(0);
    // Từ ngày bắt đầu 06/10 thì kho trừ đúng.
    const stock = await ctx.db.prepare("SELECT COALESCE(SUM(qty),0) AS n FROM kho_ledger WHERE item = 'AILLATLGSX'").first<{ n: number }>();
    expect(stock?.n).toBe(-3);
  });

  it('Sheet cũ đẩy số cùng ngày không đè số đã kéo từ Poscake', async () => {
    await ctx.db
      .prepare("INSERT INTO channel_source (channel, shop_id, api_key, updated_at) VALUES ('SHOPEE', '430024955', ?, ?)")
      .bind(await sealKey('K', SECRET), NOW)
      .run();
    await syncChannelDay(db(), SECRET, 'SHOPEE', '2026-10-06', fakePoscake());
    const res = await ctx.request('/api/hub/kho/online/import', {
      as: USERS.ceo,
      body: { channel: 'SHOPEE', days: [{ day: '2026-10-06', lines: [{ label: 'AILLATLGSX - Tẩy lồng', qty: 999 }] }] },
    });
    expect(res.body.data.days).toBe(0); // ngày đã kéo từ Poscake nên bị bỏ qua
    const row = await ctx.db.prepare("SELECT qty FROM channel_out WHERE channel = 'SHOPEE' AND day = '2026-10-06' AND item = 'AILLATLGSX'").first<{ qty: number }>();
    expect(row?.qty).toBe(2);
  });

  it('chỉ CEO, điều phối, kế toán sửa bảng quy đổi; sale không sửa được; lỗi nguồn được ghi lại', async () => {
    const no = await ctx.request('/api/hub/kho/online/map/add', {
      as: USERS.thao,
      body: { channel: 'SHOPEE', sku: 'X', item_label: 'AILLATLGSX', qty: 1 },
    });
    expect(no.status).toBe(403);
    await ctx.db
      .prepare("INSERT INTO channel_source (channel, shop_id, api_key, updated_at) VALUES ('TIKTOK', '1635334048', ?, ?)")
      .bind(await sealKey('K', SECRET), NOW)
      .run();
    const bad: FetchFn = async () => ({ ok: false, status: 401, text: async () => '' });
    const res = await syncAllChannels(db(), SECRET, ['2026-10-06'], bad);
    expect(res[0]).toMatchObject({ channel: 'TIKTOK', ok: false });
    const row = await ctx.db.prepare("SELECT last_sync_note FROM channel_source WHERE channel = 'TIKTOK'").first<{ last_sync_note: string }>();
    expect(row?.last_sync_note).toContain('LỖI');
  });
});

describe('Đối chiếu quy đổi', () => {
  it('liệt kê từng dòng sàn → mã vật tư, gắn cờ combo ra 1 sản phẩm và dòng chưa quy đổi', async () => {
    const ins = (id: string, sku: string, variant: string, name: string, qty: number) =>
      ctx.db
        .prepare(
          "INSERT INTO channel_order_lines (channel, order_id, line_no, day, shipped_at, shop, sku, variant, name, qty) VALUES ('SHOPEE', ?, 1, '2026-10-06', 0, 'S', ?, ?, ?, ?)",
        )
        .bind(id, sku, variant, name, qty)
        .run();
    await ins('A', 'AILLATLGSX', '', 'Tẩy lồng', 4);
    await ins('B', 'COMBO2', '', 'Combo 2 tẩy lồng', 3);
    await ins('C', 'LA', '', 'Hàng lạ', 2);
    await ctx.db
      .prepare("INSERT INTO channel_map (channel, sku, variant, item_label, qty, updated_at) VALUES ('SHOPEE', 'COMBO2', '', 'AILLATLGSX - Tẩy lồng', 1, ?)")
      .bind(NOW)
      .run();
    const res = await ctx.request('/api/hub/kho/online/recon?channel=SHOPEE&days=14', { as: USERS.ceo });
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.orders).toBe(3);
    expect(d.raw_qty).toBe(9);
    expect(d.out_qty).toBe(7);
    expect(d.unmapped_qty).toBe(2);
    const combo = d.rows.find((r: { sku: string }) => r.sku === 'COMBO2');
    expect(combo.flags.join()).toContain('combo');
    const la = d.rows.find((r: { sku: string }) => r.sku === 'LA');
    expect(la.flags.join()).toContain('Chưa quy đổi');
    expect(d.days).toEqual(['2026-10-06']);
    const tl = d.items.find((i: { label: string }) => i.label.startsWith('AILLATLGSX'));
    expect(tl.total).toBe(7);
    expect(tl.from).toHaveLength(2);
  });
});

describe('Quy đổi theo thời gian (shop đổi combo / đổi quà)', () => {
  it('bản mới áp dụng từ ngày X, các ngày trước X giữ cách quy đổi cũ', async () => {
    const ins = (id: string, day: string, qty: number) =>
      ctx.db
        .prepare(
          "INSERT INTO channel_order_lines (channel, order_id, line_no, day, shipped_at, shop, sku, variant, name, qty) VALUES ('SHOPEE', ?, 1, ?, 0, 'S', 'CB', '', 'Combo tẩy lồng', ?)",
        )
        .bind(id, day, qty)
        .run();
    await ins('A', '2026-10-05', 1);
    await ins('B', '2026-10-07', 1);
    const add = (body: Record<string, unknown>) =>
      ctx.request('/api/hub/kho/online/map/add', { as: USERS.ceo, body: { channel: 'SHOPEE', sku: 'CB', ...body } });
    expect((await add({ item_label: 'AILLATLGSX - Tẩy lồng', qty: 1 })).status).toBe(200);
    // Từ 06/10 shop tặng thêm phao lọc cặn và đóng 2 tẩy lồng.
    const ver = await ctx.request('/api/hub/kho/online/map/version', {
      as: USERS.ceo,
      body: { channel: 'SHOPEE', sku: 'CB', variant: '', from_day: '2026-10-06' },
    });
    expect(ver.status).toBe(200);
    expect((await add({ item_label: 'AILLATLGSX - Tẩy lồng', qty: 2, from_day: '2026-10-06' })).status).toBe(200);
    expect((await add({ item_label: 'phaoloccan - Phao lọc cặn', qty: 1, from_day: '2026-10-06' })).status).toBe(200);
    const q = (day: string) =>
      ctx.db
        .prepare('SELECT item, qty FROM channel_out WHERE channel = ? AND day = ? ORDER BY item')
        .bind('SHOPEE', day)
        .all<{ item: string; qty: number }>();
    expect((await q('2026-10-05')).results).toEqual([{ item: 'AILLATLGSX', qty: 1 }]);
    expect((await q('2026-10-07')).results).toEqual([
      { item: 'AILLATLGSX', qty: 2 },
      { item: 'phaoloccan', qty: 1 },
    ]);
  });
});

describe('Chặn trừ kho sai khi Poscake đổi ngày', () => {
  const one = (day: string): FetchFn => async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        success: true,
        total_pages: 1,
        data: [{ id: 9, custom_id: 'X-9', status: 2, status_history: [{ status: 2, updated_at: day + 'T03:00:00' }], items: [{ quantity: 1, variation_info: { name: 'AILLATLGSX - Tẩy lồng', detail: '' } }] }],
      }),
  });
  it('đơn bị đổi sang ngày khác thì bỏ khỏi ngày cũ, không trừ hai lần', async () => {
    await ctx.db.prepare("INSERT INTO channel_source (channel, shop_id, api_key, updated_at) VALUES ('SHOPEE', '430024955', ?, ?)").bind(await sealKey('K', SECRET), NOW).run();
    await syncChannelDay(db(), SECRET, 'SHOPEE', '2026-10-06', one('2026-10-06'));
    await syncChannelDay(db(), SECRET, 'SHOPEE', '2026-10-08', one('2026-10-08'), { force: true });
    const rows = await ctx.db.prepare("SELECT day, qty FROM channel_out WHERE channel = 'SHOPEE' ORDER BY day").all<{ day: string; qty: number }>();
    expect(rows.results).toEqual([{ day: '2026-10-08', qty: 1 }]);
  });
  it('số đơn cao gấp nhiều lần bình thường thì chưa ghi', async () => {
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-03']) {
      await ctx.db.prepare("INSERT INTO channel_runs (channel, day, orders, lines, received_at, source) VALUES ('TIKTOK', ?, 150, 10, ?, 'POSCAKE')").bind(d, NOW).run();
    }
    await expect(guardDay(db(), 'TIKTOK', '2026-10-12', 5600)).rejects.toThrow('BẤT THƯỜNG');
    await expect(guardDay(db(), 'TIKTOK', '2026-10-12', 160)).resolves.toBeUndefined();
    await expect(guardDay(db(), 'TIKTOK', '2026-10-02', 10)).rejects.toThrow('lần trước');
  });
});

describe('Đối soát dạng Sheet kế toán', () => {
  it('ra đủ các tab như Sheet: số đơn, hàng lẻ theo ngày, mã cần bổ sung', async () => {
    const ins = (id: string, sku: string, qty: number) =>
      ctx.db
        .prepare(
          "INSERT INTO channel_order_lines (channel, order_id, line_no, day, shipped_at, shop, sku, variant, name, qty) VALUES ('SHOPEE', ?, 1, '2026-10-06', '2026-10-06T03:00:00.000Z', 'Ailla Việt Nam', ?, '', 'tên', ?)",
        )
        .bind(id, sku, qty)
        .run();
    await ins('A', 'AILLATLGSX', 2);
    await ins('B', 'LA', 1);
    const res = await ctx.request('/api/hub/kho/online/sheet?channel=SHOPEE&days=7', { as: USERS.ceo });
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.lines).toHaveLength(2);
    expect(d.orders).toEqual([{ day: '2026-10-06', shop: 'Ailla Việt Nam', orders: 2, qty: 3 }]);
    expect(d.daily.find((x: { item: string }) => x.item.startsWith('AILLATLGSX')).qty).toBe(2);
    expect(d.missing[0]).toMatchObject({ sku: 'LA', qty: 1 });
  });
});

describe("Tìm trường mã vận đơn", () => {
  it("lấy trường dạng mã, bỏ tên / điện thoại / địa chỉ khách", () => {
    const f = codeFields({ id: 1, tracking_number: "SPXVN1", partner: { extend_code: "8485", name: "GHN", service_partner: { user_secret: "bi-mat", user_id: "1" } }, shipping_address: { phone_number: "09" }, bill_phone_number: "09" });
    expect(f).toEqual({ tracking_number: "SPXVN1", "partner.extend_code": "8485" });
  });
});

describe('Facebook + nạp chi tiết đơn từ Sheet', () => {
  it('Facebook: nguồn đơn theo landing/page, quy đổi theo tên sản phẩm không phân biệt hoa thường', async () => {
    await ctx.db.prepare("INSERT INTO channel_source (channel, shop_id, api_key, updated_at) VALUES ('FACEBOOK', '30005296', ?, ?)").bind(await sealKey('K', SECRET), NOW).run();
    await ctx.db
      .prepare("INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, updated_at) VALUES ('FACEBOOK', 'Túi tẩy lồng', '', '', 'AILLATLGSX - Tẩy lồng', 2, ?)")
      .bind(NOW)
      .run();
    const fb: FetchFn = async (url: string) => ({
      ok: true,
      status: 200,
      text: async () =>
        url.includes('/order_source')
          ? JSON.stringify({ data: [{ id: 55, name: 'Việt Anh-Muỗi' }] })
          : JSON.stringify({
              total_pages: 1,
              data: [
                { id: 1, account: 55, status: 2, status_history: [{ status: 2, updated_at: '2026-10-06T03:00:00' }], items: [{ quantity: 3, variation_info: { name: 'TÚI TẨY LỒNG', detail: '' } }] },
                { id: 2, page: { name: 'Ailla Việt Nam Store' }, status: 2, status_history: [{ status: 2, updated_at: '2026-10-06T04:00:00' }], items: [{ quantity: 1, variation_info: { name: 'Xịt muỗi - loại to', detail: '' } }] },
              ],
            }),
    });
    await syncChannelDay(db(), SECRET, 'FACEBOOK', '2026-10-06', fb);
    const shops = await ctx.db.prepare("SELECT DISTINCT shop, sku FROM channel_order_lines WHERE channel = 'FACEBOOK' ORDER BY shop").all<{ shop: string; sku: string }>();
    expect(shops.results).toEqual([
      { shop: 'Landing: Việt Anh-Muỗi', sku: 'TÚI TẨY LỒNG' },
      { shop: 'Page: Ailla Việt Nam Store', sku: 'Xịt muỗi - loại to' },
    ]);
    const out = await ctx.db.prepare("SELECT qty FROM channel_out WHERE channel = 'FACEBOOK' AND item = 'AILLATLGSX'").first<{ qty: number }>();
    expect(out?.qty).toBe(6);
  });

  it('TikTok trước 13/10: số Sheet ghi đè được ngày Poscake ra 0; nạp chi tiết đơn từ Sheet được', async () => {
    await ctx.db.prepare("INSERT INTO channel_runs (channel, day, orders, lines, received_at, source) VALUES ('TIKTOK', '2026-10-11', 0, 0, ?, 'POSCAKE')").bind(NOW).run();
    const res = await ctx.request('/api/hub/kho/online/import', {
      as: USERS.ceo,
      body: { channel: 'TIKTOK', days: [{ day: '2026-10-11', lines: [{ label: 'AILLATLGSX - Tẩy lồng', qty: 7 }] }] },
    });
    expect(res.body.data.days).toBe(1);
    const lines = await ctx.request('/api/hub/kho/online/lines', {
      as: USERS.ceo,
      body: { channel: 'TIKTOK', days: [{ day: '2026-10-10', lines: [{ order_id: 'T1', shop: 'S', sku: 'AILLATLGSX', qty: 2 }] }] },
    });
    expect(lines.status).toBe(200);
    const row = await ctx.db.prepare("SELECT qty FROM channel_out WHERE channel = 'TIKTOK' AND day = '2026-10-10'").first<{ qty: number }>();
    expect(row?.qty).toBe(2);
  });
});

describe('Lưu trọn một combo nhiều món', () => {
  it('một lần lưu đủ các món; lưu lại là thay chứ không cộng dồn', async () => {
    await ctx.db
      .prepare("INSERT INTO channel_order_lines (channel, order_id, line_no, day, shipped_at, shop, sku, variant, name, qty) VALUES ('SHOPEE', 'A', 1, '2026-10-06', '', 'S', '1TL+1PL', '', 'Combo', 2)")
      .run();
    const save = (parts: Array<{ item_label: string; qty: number }>) =>
      ctx.request('/api/hub/kho/online/map/set', { as: USERS.ceo, body: { channel: 'SHOPEE', sku: '1TL+1PL', variant: '', parts } });
    expect((await save([{ item_label: 'AILLATLGSX - Tẩy lồng', qty: 1 }, { item_label: 'phaoloccan - Phao', qty: 1 }])).status).toBe(200);
    expect((await save([{ item_label: 'AILLATLGSX - Tẩy lồng', qty: 2 }])).status).toBe(200);
    const out = await ctx.db.prepare("SELECT item, qty FROM channel_out WHERE channel = 'SHOPEE' AND day = '2026-10-06' ORDER BY item").all<{ item: string; qty: number }>();
    expect(out.results).toEqual([{ item: 'AILLATLGSX', qty: 4 }]);
  });
});

describe('Tab kênh: ngày chỉ có số Sheet', () => {
  it('hiện số hàng lẻ Sheet đã đẩy lên khi chưa có từng đơn', async () => {
    await ctx.request('/api/hub/kho/online/import', {
      as: USERS.ceo,
      body: { channel: 'TIKTOK', days: [{ day: '2026-10-09', orders: 3, lines: [{ label: 'AILLATLGSX - Tẩy lồng', qty: 5 }] }] },
    });
    const r = await ctx.request('/api/hub/kho/online/sheet?channel=TIKTOK&days=7', { as: USERS.ceo });
    expect(r.body.data.sheet_days).toEqual(['2026-10-09']);
    expect(r.body.data.daily[0]).toMatchObject({ day: '2026-10-09', qty: 5 });
    expect(r.body.data.orders[0]).toMatchObject({ orders: 3, qty: 5 });
  });
});

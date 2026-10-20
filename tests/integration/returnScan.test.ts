import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';
import { sealKey, type FetchFn } from '../../src/server/services/poscake';
import { normalizeCode, syncReturnsDay } from '../../src/server/services/returnScan';

let ctx: TestContext;
const SECRET = 'khoa-thu-nghiem';
const NOW = '2026-10-01T01:00:00.000Z';
const db = () => ctx.db as unknown as D1Database;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  for (const [code, name] of [
    ['AILLATLGSX', 'Tẩy lồng máy giặt 300g'],
    ['phaoloccan', 'Phao lọc cặn'],
  ] as const) {
    await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES (?, ?, 'Chai', 'TP', ?)").bind(code, name, NOW).run();
  }
  await ctx.db
    .prepare("INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, updated_at) VALUES ('SHOPEE', 'CB', '', '', 'AILLATLGSX - Tẩy lồng', 3, ?)")
    .bind(NOW)
    .run();
  await ctx.db
    .prepare("INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, updated_at) VALUES ('SHOPEE', 'CB', '', '', 'phaoloccan - Phao', 1, ?)")
    .bind(NOW)
    .run();
  await ctx.db
    .prepare("INSERT INTO channel_source (channel, shop_id, api_key, updated_at) VALUES ('SHOPEE', '430024955', ?, ?)")
    .bind(await sealKey('K', SECRET), NOW)
    .run();
});

const fake: FetchFn = async (url: string) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({
      total_pages: 1,
      data: url.includes('updateStatus=5')
        ? [
            {
              id: 7,
              custom_id: 'SP-7',
              status: 5,
              partner: { extend_code: 'spxvn0001a' },
              status_history: [{ status: 5, updated_at: '2026-10-06T03:00:00' }],
              items: [{ quantity: 1, variation_info: { name: 'CB - Combo 3 tẩy lồng + phao', detail: '' } }],
            },
          ]
        : [],
    }),
});

describe('Hàng hoàn các sàn: quét mã vận đơn → nhập kho', () => {
  it('quét ra đúng kênh, đúng món phải về; hỏng không cộng tồn; thiếu thì vào khiếu nại', async () => {
    const s = await syncReturnsDay(db(), SECRET, 'SHOPEE', '2026-10-06', fake);
    expect(s.orders).toBe(1);

    const scan = await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code: ' SPXVN0001A ', day: '2026-10-08' } });
    expect(scan.status).toBe(200);
    const v = scan.body.data;
    expect(v.channel).toBe('SHOPEE');
    expect(v.items).toEqual([
      expect.objectContaining({ item: 'AILLATLGSX', expected: 3, received: 3, good: 3, bad: 0 }),
      expect.objectContaining({ item: 'phaoloccan', expected: 1 }),
    ]);

    // Quét lại cùng mã thì báo trùng.
    const again = await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code: 'SPXVN0001A' } });
    expect(again.status).toBe(409);

    // Gói 3 tẩy lồng: hỏng 2; phao lọc cặn không về.
    const put = await ctx.request(`/api/hub/kho/ret/scans/${v.id}`, {
      as: USERS.ceo,
      method: 'PUT',
      body: { items: [{ item: 'AILLATLGSX', received: 3, bad: 2 }, { item: 'phaoloccan', received: 0, bad: 0 }] },
    });
    expect(put.status).toBe(200);
    expect(put.body.data.claim).toBe('CAN');
    expect(put.body.data.issues).toEqual(expect.arrayContaining(['Thiếu 1', 'Hỏng 2']));

    const rec = await ctx.request('/api/hub/kho/ret/receive', { as: USERS.ceo, body: { day: '2026-10-08' } });
    expect(rec.status).toBe(200);
    expect(rec.body.data[0]).toMatchObject({ channel: 'SHOPEE', packages: 1 });
    const stock = await ctx.db.prepare("SELECT COALESCE(SUM(qty),0) AS n FROM kho_ledger WHERE item = 'AILLATLGSX'").first<{ n: number }>();
    expect(stock?.n).toBe(1); // chỉ 1 chai bán tiếp được cộng tồn

    const recon = await ctx.request('/api/hub/kho/ret/recon', { as: USERS.ceo });
    expect(recon.body.data.claims).toHaveLength(1);
    expect(recon.body.data.summary.find((x: { channel: string }) => x.channel === 'SHOPEE').claims).toBe(1);
  });

  it('mã có dấu tiếng Việt (đang bật Unikey) thì báo quét lại; mã lạ vẫn ghi để xem lại', async () => {
    expect(normalizeCode('TO2026CẢ4R').vietnamese).toBe(true);
    const bad = await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code: 'TO2026CẢ4R' } });
    expect(bad.status).toBe(400);
    const unk = await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code: 'XYZ123456' } });
    expect(unk.status).toBe(200);
    expect(unk.body.data.issues).toContain('Chưa tra ra đơn');
  });

  it('Facebook: kho quét nhận đơn Poscake còn ghi đang hoàn → tính đã hoàn về, nhắc cập nhật Poscake', async () => {
    await ctx.db.prepare("INSERT INTO ret_orders (channel, order_id, tracking, shop, status, returning_at, synced_at, ship_status) VALUES ('FACEBOOK', 'F1', '84859', 'Page: A', 4, ?, ?, 'delivered')").bind(NOW, NOW).run();
    const r = await ctx.request('/api/hub/kho/ret/recon', { as: USERS.ceo });
    expect(r.body.data.waiting).toHaveLength(1);
    // Kho quét nhận → coi là đã hoàn về, chuyển sang danh sách "Poscake chưa cập nhật".
    await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code: '84859' } });
    const r2 = await ctx.request('/api/hub/kho/ret/recon', { as: USERS.ceo });
    expect(r2.body.data.waiting).toHaveLength(0);
    expect(r2.body.data.poscake_lag[0]).toMatchObject({ channel: 'FACEBOOK', order_id: 'F1' });
  });

  it('sale không quét / nhập hàng hoàn được', async () => {
    const r = await ctx.request('/api/hub/kho/ret/scan', { as: USERS.thao, body: { code: 'SPXVN0001A' } });
    expect(r.status).toBe(403);
  });
});

describe('Gói không tra ra đơn: nhập tay', () => {
  it('chọn kênh + thêm món rồi nhập kho được', async () => {
    const s = await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code: 'CU123456', day: '2026-10-09' } });
    const put = await ctx.request(`/api/hub/kho/ret/scans/${s.body.data.id}`, {
      as: USERS.ceo,
      method: 'PUT',
      body: { channel: 'FACEBOOK', items: [{ item: 'AILLATLGSX', name: 'Tẩy lồng', received: 2, bad: 0 }] },
    });
    expect(put.status).toBe(200);
    expect(put.body.data.claim).toBe('');
    const rec = await ctx.request('/api/hub/kho/ret/receive', { as: USERS.ceo, body: { day: '2026-10-09' } });
    expect(rec.body.data[0]).toMatchObject({ channel: 'FACEBOOK', packages: 1 });
    const stock = await ctx.db.prepare("SELECT COALESCE(SUM(qty),0) AS n FROM kho_ledger WHERE item = 'AILLATLGSX'").first<{ n: number }>();
    expect(stock?.n).toBe(2);
  });
});

describe('Nhập gộp hàng của gói chưa tra ra đơn', () => {
  it('ghi tổng sản phẩm cho cả ngày, nhập kho thì các gói chưa tra ra hết cảnh báo', async () => {
    await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code: 'VTPVN9059127408', day: '2026-10-13' } });
    const bulk = await ctx.request('/api/hub/kho/ret/bulk', {
      as: USERS.ceo,
      body: { day: '2026-10-13', channel: 'TIKTOK', items: [{ item: 'AILLATLGSX', received: 3, bad: 1 }] },
    });
    expect(bulk.status).toBe(200);
    const rec = await ctx.request('/api/hub/kho/ret/receive', { as: USERS.ceo, body: { day: '2026-10-13' } });
    expect(rec.status).toBe(200);
    const stock = await ctx.db.prepare("SELECT COALESCE(SUM(qty),0) AS n FROM kho_ledger WHERE item = 'AILLATLGSX'").first<{ n: number }>();
    expect(stock?.n).toBe(2);
    const recon = await ctx.request('/api/hub/kho/ret/recon', { as: USERS.ceo });
    expect(recon.body.data.claims.filter((x: { code: string }) => x.code === 'VTPVN9059127408')).toHaveLength(0);
  });
});

describe('Phiếu nhập hoàn theo ngày + khiếu nại theo kênh', () => {
  it('nhập theo số thực nhập, lệch so với dự kiến thì ghi vào phiếu; Facebook thiếu hàng thì tự chịu, không khiếu nại', async () => {
    await syncReturnsDay(db(), SECRET, 'SHOPEE', '2026-10-06', fake);
    const sc = await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code: 'SPXVN0001A', day: '2026-10-10' } });
    const id = sc.body.data.id;
    // Gói Shopee về thiếu 1 phao: vào cần khiếu nại.
    const put = await ctx.request(`/api/hub/kho/ret/scans/${id}`, {
      as: USERS.ceo,
      method: 'PUT',
      body: { items: [{ item: 'AILLATLGSX', received: 3, bad: 0 }, { item: 'phaoloccan', received: 0, bad: 0 }], claim_amount: 45000 },
    });
    expect(put.body.data.claim).toBe('CAN');
    expect(put.body.data.claim_amount).toBe(45000);

    // Gói Facebook nhập tay thiếu hàng: tự chịu.
    const fb = await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code: 'FB99887766', day: '2026-10-10' } });
    await ctx.db.prepare("UPDATE ret_scans SET order_id = 'F9', channel = 'FACEBOOK' WHERE id = ?").bind(fb.body.data.id).run();
    const fbPut = await ctx.request(`/api/hub/kho/ret/scans/${fb.body.data.id}`, {
      as: USERS.ceo,
      method: 'PUT',
      body: { items: [{ item: 'AILLATLGSX', received: 1, bad: 1 }], problem: 'HONG' },
    });
    expect(fbPut.body.data.claim).toBe('TU_CHIU');

    // Kế toán nhập thực: tẩy lồng 3 (khớp hàng ổn Shopee 3) + 0 (Facebook hỏng 1 không cộng) → dự kiến ổn = 3 + 0.
    const rec = await ctx.request('/api/hub/kho/ret/receive', {
      as: USERS.ceo,
      body: { day: '2026-10-10', actual: [{ item: 'AILLATLGSX', qty: 2 }] },
    });
    expect(rec.status).toBe(200);
    expect(rec.body.data[0].packages).toBe(2);
    expect(rec.body.data[0].diff).toEqual([{ item: 'AILLATLGSX', ok: 3, actual: 2, diff: -1 }]);
    const stock = await ctx.db.prepare("SELECT COALESCE(SUM(qty),0) AS n FROM kho_ledger WHERE item = 'AILLATLGSX'").first<{ n: number }>();
    expect(stock?.n).toBe(2); // đúng số kế toán nhập, không phải số dự kiến

    const recon = await ctx.request('/api/hub/kho/ret/recon', { as: USERS.ceo });
    const fbRow = recon.body.data.summary.find((x: { channel: string }) => x.channel === 'FACEBOOK');
    expect(fbRow.claims).toBe(0); // tự chịu không tính là đang khiếu nại
    expect(fbRow.self_loss).toBeGreaterThan(0);
    const shRow = recon.body.data.summary.find((x: { channel: string }) => x.channel === 'SHOPEE');
    expect(shRow.claim_paid).toBe(45000);
  });
});

describe('Quy tắc nhận sàn theo đầu mã vận đơn', () => {
  it.each([
    ['SPXVN06926384441A', 'SHOPEE'],
    ['862564206441', 'TIKTOK'],
    ['TTVN123456789', 'TIKTOK'],
    ['TO2026101300123', 'TIKTOK'],
    ['VTPVN9059127408', 'TIKTOK'],
    ['84859817175774', 'FACEBOOK'],
    ['ABC123456789', null],
  ])('mã %s → %s', async (code, ch) => {
    const r = await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code } });
    expect(r.status).toBe(200);
    expect(r.body.data.channel).toBe(ch);
  });
});

describe('Chọn vấn đề "Thiếu hàng" mà chưa sửa số thì vẫn vào danh sách khiếu nại', () => {
  it('đơn Shopee: chọn Thiếu hàng → cần khiếu nại; đơn Facebook → tự chịu', async () => {
    await syncReturnsDay(db(), SECRET, 'SHOPEE', '2026-10-06', fake);
    const sc = await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code: 'SPXVN0001A' } });
    const r = await ctx.request(`/api/hub/kho/ret/scans/${sc.body.data.id}`, { as: USERS.ceo, method: 'PUT', body: { problem: 'THIEU' } });
    expect(r.body.data.claim).toBe('CAN');
    expect(r.body.data.issues).toContain('Thiếu hàng');
  });
});

describe('Gói chưa tra ra đơn: kế toán điền mã đơn từ seller', () => {
  it('có đơn trên Poscake thì gắn luôn; chưa có thì lưu mã và tự gắn khi kéo lại', async () => {
    const unk = await ctx.request('/api/hub/kho/ret/scan', { as: USERS.ceo, body: { code: 'VTPVN555000111' } });
    const id = unk.body.data.id;
    const list = await ctx.request('/api/hub/kho/ret/unmatched', { as: USERS.ceo });
    expect(list.body.data.map((x: { id: number }) => x.id)).toContain(id);

    // Chưa có đơn SP-7 trong danh sách hoàn: chỉ lưu mã.
    const save = await ctx.request(`/api/hub/kho/ret/scans/${id}/order-ref`, { as: USERS.ceo, body: { order_ref: 'sp-7', channel: 'SHOPEE' } });
    expect(save.status).toBe(200);
    expect(save.body.data.linked).toBe(false);
    expect(save.body.data.order_ref).toBe('SP-7');

    // Poscake cập nhật: kéo lại rồi gắn lại thì tự khớp, ra các món phải về.
    await syncReturnsDay(db(), SECRET, 'SHOPEE', '2026-10-06', fake);
    const re = await ctx.request('/api/hub/kho/ret/rematch', { as: USERS.ceo, body: {} });
    expect(re.body.data.matched).toBe(1);
    const after = await ctx.request('/api/hub/kho/ret/unmatched', { as: USERS.ceo });
    expect(after.body.data.map((x: { id: number }) => x.id)).not.toContain(id);
  });
});

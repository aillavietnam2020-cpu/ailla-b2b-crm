import { beforeEach, describe, expect, it } from 'vitest';
import { monthRetailByCustomer } from '../../src/server/services/bonus';
import { shortOwner } from '../../src/server/services/customers';
import {
  createTestContext,
  seedBusinessData,
  seedUsers,
  USERS,
  type TestContext,
} from '../helpers/app';

let ctx: TestContext;
const T = '2026-10-05T00:00:00.000Z';

async function order(id: string, qty: number, opts: { gift?: boolean; bonus?: number } = {}) {
  await ctx.db
    .prepare(
      `INSERT INTO orders (id, order_no, customer_id, owner_id, order_date, subtotal, discount_amount, bonus_deduction, total_amount,
         approval_status, delivery_status, payment_status, accounting_status, created_at, updated_at)
       VALUES (?, ?, 'cus-thao-1', 'user-thao', '2026-10-05', 1000, 0, ?, 1000, 'APPROVED', 'DA_GIAO', 'CHUA_THU', 'CHUA_XAC_NHAN', ?, ?)`,
    )
    .bind(id, 'DH-' + id, opts.bonus ?? 0, T, T)
    .run();
  await ctx.db
    .prepare(
      `INSERT INTO order_items (id, order_id, product_id, qty, base_price, applied_price, line_total, price_override, is_gift, created_at)
       VALUES (?, ?, 'prod-full', ?, 100000, 100000, ?, 0, ?, ?)`,
    )
    .bind('i-' + id, id, qty, opts.gift ? 0 : qty * 100000, opts.gift ? 1 : 0, T)
    .run();
}

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

describe('Doanh số lẻ và thưởng NPP', () => {
  it('quy đổi doanh số lẻ theo giá niêm yết bán lẻ, bỏ hàng tặng, tính mốc và còn phải chi', async () => {
    // Giá bán lẻ (cấp Bán lẻ) của prod-full trong dữ liệu thử là 140.000 đ.
    await order('o1', 1000, { bonus: 300000 }); // 1000 × 140.000 = 140 triệu → Mức 1 (500.000)
    await order('o2', 500, { gift: true }); // hàng tặng không tính
    // Dòng quà tặng nhập từ Sheet có đơn giá 0 nhưng chưa tích "hàng tặng": cũng không tính.
    await ctx.db
      .prepare(
        "INSERT INTO order_items (id, order_id, product_id, qty, base_price, applied_price, line_total, price_override, is_gift, created_at) VALUES ('i-zero', 'o1', 'prod-full', 300, 100000, 0, 0, 0, 0, ?)",
      )
      .bind(T)
      .run();
    const r = await ctx.request('/api/bonus/report?month=2026-10', { as: USERS.ceo });
    expect(r.status).toBe(200);
    const row = r.body.data.rows.find(
      (x: { customer_id: string }) => x.customer_id === 'cus-thao-1',
    );
    expect(row.retail_sales).toBe(140_000_000);
    expect(row.month_level).toBe('Mức 1');
    expect(row.month_cash).toBe(500_000);
    expect(row.advanced).toBe(300_000);
    expect(row.payable).toBe(200_000);
    expect(row.policy).toBe('CHUNG');
  });

  it('phiếu chi thưởng bằng tiền: chi tối đa bằng còn phải chi, người lập không tự duyệt, hủy thì trả lại số còn phải chi', async () => {
    await order('o1', 1000, { bonus: 300000 }); // thưởng 500.000, đã trừ vào đơn 300.000 → còn phải chi 200.000
    const payable = async () =>
      (await ctx.request('/api/bonus/report?month=2026-10', { as: USERS.ceo })).body.data.rows.find(
        (x: { customer_id: string }) => x.customer_id === 'cus-thao-1',
      );
    const body = (amount: number) => ({ customer_id: 'cus-thao-1', month: '2026-10', amount, method: 'CHUYEN_KHOAN', note: 'CK thưởng tháng 10' });
    expect((await ctx.request('/api/bonus/cash', { as: USERS.thao, body: body(100000) })).status).toBe(403);
    const over = await ctx.request('/api/bonus/cash', { as: USERS.manager, body: body(250000) });
    expect(over.status).toBe(400);
    const made = await ctx.request('/api/bonus/cash', { as: USERS.manager, body: body(150000) });
    expect(made.status).toBe(200);
    expect(made.body.data.voucher_no).toMatch(/^PCT\d{4}-001$/);
    // Phiếu chờ duyệt đã giữ chỗ: còn phải chi giảm ngay, chi thêm quá số còn lại bị chặn.
    const mid = await payable();
    expect(mid.paid).toBe(150000);
    expect(mid.payable).toBe(50000);
    expect((await ctx.request('/api/bonus/cash', { as: USERS.manager, body: body(100000) })).status).toBe(400);
    // Người lập không tự duyệt; CEO duyệt được.
    expect((await ctx.request(`/api/bonus/cash/${made.body.data.id}/approve`, { as: USERS.manager, body: {} })).status).toBe(403);
    expect((await ctx.request(`/api/bonus/cash/${made.body.data.id}/approve`, { as: USERS.ceo, body: {} })).status).toBe(200);
    const list = await ctx.request('/api/bonus/cash?month=2026-10', { as: USERS.ceo });
    expect(list.body.data[0].status).toBe('DA_CHI');
    // Hủy phải có lý do; hủy xong số còn phải chi trở lại.
    expect((await ctx.request(`/api/bonus/cash/${made.body.data.id}/cancel`, { as: USERS.ceo, body: {} })).status).toBe(400);
    expect((await ctx.request(`/api/bonus/cash/${made.body.data.id}/cancel`, { as: USERS.ceo, body: { reason: 'Chi nhầm khách' } })).status).toBe(200);
    expect((await payable()).payable).toBe(200000);
  });

  it('khách có cơ chế riêng thì dùng riêng; chỉ CEO đặt cơ chế; sale không xem được báo cáo', async () => {
    await order('o1', 1000);
    const put = (as: string) =>
      ctx.request('/api/bonus/policy', {
        as,
        method: 'PUT',
        body: {
          customer_id: 'cus-thao-1',
          period: 'MONTH',
          tiers: [
            {
              label: 'Riêng 1',
              threshold: 50_000_000,
              cash: 2_000_000,
              gift_text: '',
              gift_value: 0,
            },
          ],
        },
      });
    expect((await put(USERS.manager)).status).toBe(403);
    expect((await put(USERS.ceo)).status).toBe(200);
    const r = await ctx.request('/api/bonus/report?month=2026-10', { as: USERS.ceo });
    const row = r.body.data.rows.find(
      (x: { customer_id: string }) => x.customer_id === 'cus-thao-1',
    );
    expect(row).toMatchObject({ policy: 'RIENG', month_level: 'Riêng 1', month_cash: 2_000_000 });
    expect((await ctx.request('/api/bonus/report?month=2026-10', { as: USERS.thao })).status).toBe(
      403,
    );
  });
});

describe('Phiếu xuất quà thưởng', () => {
  it('lập phiếu chưa trừ kho; Thảo duyệt mới ghi phiếu xuất và trừ tồn; hủy thì trả lại', async () => {
    // Kho có sẵn 100 mã quà; Mức 1 đặt quà 5 cái.
    await ctx.db
      .prepare(
        "INSERT INTO kho_items (code, name, unit, cls, created_at) VALUES ('QUA-1', 'Tẩy lồng quà', 'Cái', 'TP', ?)",
      )
      .bind(T)
      .run();
    await ctx.db
      .prepare(
        "INSERT INTO kho_docs (no, type, doc_date, status, created_at) VALUES ('TD2610-001', 'TD', '2026-10-01', 'OK', ?)",
      )
      .bind(T)
      .run();
    const doc = await ctx.db
      .prepare("SELECT id FROM kho_docs WHERE no = 'TD2610-001'")
      .first<{ id: number }>();
    await ctx.db
      .prepare("INSERT INTO kho_moves (doc_id, item, qty, role) VALUES (?, 'QUA-1', 100, 'IN')")
      .bind(doc!.id)
      .run();
    await ctx.db
      .prepare(
        'UPDATE bonus_tiers SET gift_items = \'[{"item":"QUA-1","qty":5}]\' WHERE id = \'bt-m1\'',
      )
      .run();
    await order('o1', 1000);

    const stock = async () =>
      (await ctx.db
        .prepare("SELECT SUM(qty) AS s FROM kho_ledger WHERE item = 'QUA-1'")
        .first<{ s: number }>())!.s;
    const make = await ctx.request('/api/bonus/gifts', {
      as: USERS.ceo,
      body: { customer_id: 'cus-thao-1', month: '2026-10' },
    });
    expect(make.status).toBe(200);
    expect(await stock()).toBe(100); // chưa duyệt thì chưa trừ kho

    const dup = await ctx.request('/api/bonus/gifts', {
      as: USERS.ceo,
      body: { customer_id: 'cus-thao-1', month: '2026-10' },
    });
    expect(dup.status).toBe(409);
    expect(
      (
        await ctx.request(`/api/bonus/gifts/${make.body.data.id}/approve`, {
          as: USERS.thao,
          body: {},
        })
      ).status,
    ).toBe(403);

    const ok = await ctx.request(`/api/bonus/gifts/${make.body.data.id}/approve`, {
      as: USERS.ceo,
      body: {},
    });
    expect(ok.status).toBe(200);
    expect(await stock()).toBe(95);

    const cancel = await ctx.request(`/api/bonus/gifts/${make.body.data.id}/cancel`, {
      as: USERS.ceo,
      body: { reason: 'Lập nhầm tháng' },
    });
    expect(cancel.status).toBe(200);
    expect(await stock()).toBe(100);
  });

  it('mức thưởng chưa khai mã quà thì báo rõ, không tạo phiếu', async () => {
    await order('o1', 1000);
    const r = await ctx.request('/api/bonus/gifts', {
      as: USERS.ceo,
      body: { customer_id: 'cus-thao-1', month: '2026-10' },
    });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('NO_GIFT_ITEMS');
  });
});

describe('Doanh số lẻ theo khách trong danh sách khách', () => {
  it('tính đúng theo tháng, bỏ hàng tặng và dòng giá 0', async () => {
    await order('o1', 100);
    await order('o2', 50, { gift: true });
    const m = await monthRetailByCustomer(ctx.db as unknown as D1Database, '2026-10');
    expect(m.get('cus-thao-1')).toBe(100 * 140000);
    expect(
      (await monthRetailByCustomer(ctx.db as unknown as D1Database, '2026-09')).get('cus-thao-1') ??
        0,
    ).toBe(0);
  });

  it('tên sale rút gọn: ưu tiên tên Sheet, không có thì từ cuối của họ tên', () => {
    expect(shortOwner('Phạm Thị Thu Huyền', 'Huyền')).toBe('Huyền');
    expect(shortOwner('Phạm Thị Thu Huyền', null)).toBe('Huyền');
    expect(shortOwner(null, null)).toBeNull();
  });
});

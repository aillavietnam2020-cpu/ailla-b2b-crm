import { beforeEach, describe, expect, it } from 'vitest';
import { needsCeo, parseCeoSpend } from '../../src/shared/ceoSpend';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Ngưỡng chi phải CEO duyệt (chị Hoa chốt 27/10/2026: khoản chi từ 5 triệu là chị phải duyệt). */
let ctx: TestContext;
const NOW = '2026-10-27T01:00:00.000Z';

async function setThreshold(v: number) {
  await ctx.db
    .prepare("INSERT INTO app_settings (key, value_json, version, updated_at) VALUES ('spend.ceo_threshold_vnd', ?, 1, ?) ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json")
    .bind(JSON.stringify(v), NOW)
    .run();
}

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
});

describe('Ngưỡng chi: quy tắc', () => {
  it('mặc định 5 triệu, từ 5 triệu trở lên mới chờ CEO, CEO tự lập thì không chờ, 0 là tắt', () => {
    expect(parseCeoSpend(undefined)).toBe(5_000_000);
    expect(parseCeoSpend('"abc"')).toBe(5_000_000);
    expect(parseCeoSpend('3000000')).toBe(3_000_000);
    expect(needsCeo(4_999_999, 5_000_000, false)).toBe(false);
    expect(needsCeo(5_000_000, 5_000_000, false)).toBe(true);
    expect(needsCeo(9_000_000, 5_000_000, true)).toBe(false);
    expect(needsCeo(9_000_000, 0, false)).toBe(false);
  });

  it('ai đăng nhập cũng đọc được ngưỡng; danh sách chờ chỉ CEO thấy', async () => {
    expect((await ctx.request('/api/ceo-spend', { as: USERS.manager })).body.data.threshold).toBe(5_000_000);
    await setThreshold(2_000_000);
    expect((await ctx.request('/api/ceo-spend', { as: USERS.thao })).body.data.threshold).toBe(2_000_000);
    expect((await ctx.request('/api/ceo-spend/pending', { as: USERS.manager })).body.data).toEqual([]);
  });
});

describe('Phiếu chi vận chuyển từ ngưỡng', () => {
  const body = (amount: number) => ({ voucher_date: '2026-10-20', carrier: 'Xe 29C', amount, method: 'TIEN_MAT' });

  it('quản lý lập từ 5 triệu: phiếu có hiệu lực, gắn chờ CEO; dưới 5 triệu như cũ; CEO duyệt thì hết chờ', async () => {
    const big = await ctx.request('/api/shipping-vouchers', { as: USERS.manager, body: body(5_000_000) });
    expect(big.body.data.ceo_status).toBe('CHO');
    const small = await ctx.request('/api/shipping-vouchers', { as: USERS.manager, body: body(4_999_000) });
    expect(small.body.data.ceo_status).toBe('');
    const own = await ctx.request('/api/shipping-vouchers', { as: USERS.ceo, body: body(8_000_000) });
    expect(own.body.data.ceo_status).toBe('');

    const pend = await ctx.request('/api/ceo-spend/pending', { as: USERS.ceo });
    expect(pend.body.data.map((x: { id: string; kind: string }) => [x.kind, x.id])).toEqual([['ship', big.body.data.id]]);
    // vẫn tính vào tổng (tiền đã chi thật)
    const list = await ctx.request('/api/shipping-vouchers', { as: USERS.manager });
    expect(list.body.meta.total_amount).toBe(5_000_000 + 4_999_000 + 8_000_000);

    expect((await ctx.request(`/api/ceo-spend/ship/${big.body.data.id}/approve`, { as: USERS.manager, body: {} })).status).toBe(403);
    expect((await ctx.request(`/api/ceo-spend/ship/${big.body.data.id}/approve`, { as: USERS.ceo, body: {} })).status).toBe(200);
    expect((await ctx.request(`/api/ceo-spend/ship/${big.body.data.id}/approve`, { as: USERS.ceo, body: {} })).status).toBe(409);
    expect((await ctx.request('/api/ceo-spend/pending', { as: USERS.ceo })).body.data).toEqual([]);
  });

  it('chị đổi ngưỡng thì áp ngay', async () => {
    await setThreshold(1_000_000);
    expect((await ctx.request('/api/shipping-vouchers', { as: USERS.manager, body: body(1_500_000) })).body.data.ceo_status).toBe('CHO');
    await setThreshold(0);
    expect((await ctx.request('/api/shipping-vouchers', { as: USERS.manager, body: body(50_000_000) })).body.data.ceo_status).toBe('');
  });
});

describe('Phiếu chi nhà cung cấp từ ngưỡng', () => {
  const BASE = '/api/hub/kho/mh';
  it('quản lý ghi từ 5 triệu thì chờ CEO; sửa tăng tiền khoản nhỏ lên trên ngưỡng cũng chờ; CEO duyệt', async () => {
    await ctx.db.prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES ('user-manager', 'hub.access', 'user-ceo', ?)").bind(NOW).run();
    const sup = await ctx.request(`${BASE}/suppliers`, { as: USERS.ceo, body: { name: 'NCC A' } });
    const pay = (amount: number) => ({ supplier_id: sup.body.data.id, pay_date: '2026-10-20', amount, general: true, method: 'KHAC', account: 'TM' });
    const big = await ctx.request(`${BASE}/payments`, { as: USERS.manager, body: pay(6_000_000) });
    expect(big.status).toBe(200);
    expect(big.body.data.ceo_status).toBe('CHO');
    const small = await ctx.request(`${BASE}/payments`, { as: USERS.manager, body: pay(1_000_000) });
    expect(small.body.data.ceo_status).toBe('');
    expect((await ctx.request(`${BASE}/payments/${small.body.data.id}`, { as: USERS.manager, method: 'PUT', body: { amount: 7_000_000 } })).status).toBe(200);
    const pend = await ctx.request('/api/ceo-spend/pending', { as: USERS.ceo });
    expect(pend.body.data.map((x: { id: string }) => x.id).sort()).toEqual([big.body.data.id, small.body.data.id].sort());
    expect((await ctx.request(`/api/ceo-spend/ncc/${big.body.data.id}/approve`, { as: USERS.ceo, body: {} })).status).toBe(200);
    // sửa ghi chú, không đổi tiền: giữ nguyên "CEO đã duyệt"
    expect((await ctx.request(`${BASE}/payments/${big.body.data.id}`, { as: USERS.manager, method: 'PUT', body: { note: 'đã đối chiếu' } })).status).toBe(200);
    expect((await ctx.request('/api/ceo-spend/pending', { as: USERS.ceo })).body.data.map((x: { id: string }) => x.id)).toEqual([small.body.data.id]);
  });
});

describe('Phiếu chi thưởng NPP từ ngưỡng', () => {
  it('quản lý duyệt thì chuyển chờ CEO (chưa thành đã chi), CEO duyệt mới thành đã chi', async () => {
    await seedBusinessData(ctx.db);
    await setThreshold(100_000);
    await ctx.db
      .prepare(
        `INSERT INTO bonus_cash_vouchers (id, voucher_no, customer_id, month, amount, method, note, status, created_by, created_at)
         VALUES ('bc1', 'PCT2610-001', 'cus-thao-1', '2026-10', 150000, 'CHUYEN_KHOAN', '', 'CHO_DUYET', 'user-thao', ?)`,
      )
      .bind(NOW)
      .run();
    const a = await ctx.request('/api/bonus/cash/bc1/approve', { as: USERS.manager, body: {} });
    expect(a.status).toBe(200);
    expect(a.body.data.ceo_status).toBe('CHO');
    let list = await ctx.request('/api/bonus/cash?month=2026-10', { as: USERS.ceo });
    expect(list.body.data[0]).toMatchObject({ status: 'CHO_DUYET', ceo_status: 'CHO' });
    expect((await ctx.request('/api/bonus/cash/bc1/approve', { as: USERS.manager, body: {} })).status).toBe(409);
    expect((await ctx.request('/api/bonus/cash/bc1/approve', { as: USERS.ceo, body: {} })).status).toBe(200);
    list = await ctx.request('/api/bonus/cash?month=2026-10', { as: USERS.ceo });
    expect(list.body.data[0]).toMatchObject({ status: 'DA_CHI', ceo_status: 'DUYET' });
  });
});

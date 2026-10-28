import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Báo cáo Shopee: số tháng từng shop, chỉ CEO / kế toán; bản giữa tháng không đè bản đủ tháng. */
let ctx: TestContext;
const NOW = '2026-10-27T01:00:00.000Z';
const NV = 'shopee@ailla.vn';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await ctx.db
    .prepare(
      `INSERT INTO users (id, email, display_name, role, status, created_at, updated_at)
       VALUES ('user-sp', ?, 'Team Shopee (test)', 'EMPLOYEE', 'ACTIVE', ?, ?)`,
    )
    .bind(NV, NOW, NOW)
    .run();
  await ctx.db
    .prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES ('user-sp', 'hub.access', 'user-ceo', ?)")
    .bind(NOW)
    .run();
});

const body = (den: string | null, dt = 100) => ({
  data: { rows: [{ pn: 'Tẩy lồng', dt }] },
  summary: { ky: '2026-10', shop: 'aillavn', den, dt, days: { '2026-10-01': [dt, -20, 30, 50, 2, 5, 99], '2026-09-30': [1], x: [1], '2026-10-02': 'chữ' } },
});

describe('Shopee: số tháng', () => {
  it('nhân viên không xem, không lưu được', async () => {
    expect((await ctx.request('/api/hub/shopee/months', { as: NV })).status).toBe(403);
    expect((await ctx.request('/api/hub/shopee/month/2026-10/aillavn', { method: 'PUT', as: NV, body: body(null) })).status).toBe(403);
  });
  it('CEO lưu; số theo ngày chỉ giữ ngày trong tháng và 6 con số', async () => {
    expect((await ctx.request('/api/hub/shopee/month/2026-10/aillavn', { method: 'PUT', as: USERS.ceo, body: body('2026-10-25') })).status).toBe(200);
    const r = await ctx.request('/api/hub/shopee/months', { as: USERS.ceo });
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].summary.days).toEqual({ '2026-10-01': [100, -20, 30, 50, 2, 5] });
    expect(r.body.data[0].summary.den).toBe('2026-10-25');
    const one = await ctx.request('/api/hub/shopee/month/2026-10/aillavn', { as: USERS.ceo });
    expect(one.body.data.data.rows[0].pn).toBe('Tẩy lồng');
  });
  it('bản giữa tháng thay bản giữa tháng; bản đủ tháng rồi thì không thay bằng bản giữa tháng', async () => {
    const put = (b: unknown) => ctx.request('/api/hub/shopee/month/2026-10/aillavn', { method: 'PUT', as: USERS.ceo, body: b });
    expect((await put(body('2026-10-20', 50))).status).toBe(200);
    expect((await put(body('2026-10-25', 80))).status).toBe(200);
    expect((await put(body(null, 120))).status).toBe(200);
    expect((await put(body('2026-10-26', 90))).status).toBe(409);
    const r = await ctx.request('/api/hub/shopee/months', { as: USERS.ceo });
    expect(r.body.data[0].summary.dt).toBe(120);
  });
  it('tháng / shop trong thân phải khớp đường dẫn', async () => {
    expect((await ctx.request('/api/hub/shopee/month/2026-09/aillavn', { method: 'PUT', as: USERS.ceo, body: body(null) })).status).toBe(400);
    expect((await ctx.request('/api/hub/shopee/month/2026-10/aillavn1', { method: 'PUT', as: USERS.ceo, body: body(null) })).status).toBe(400);
  });

  it('trang vận hành: nhân viên xem được số bán, ưu tiên quảng cáo; không có lãi, giá vốn, phí sàn', async () => {
    const b = {
      data: { rows: [{ pn: 'Tinh dầu', q: 5, dt: 1000, lg: 500 }, { pn: 'Tinh dầu', q: 1, dt: 200, lg: 100 }, { pn: 'Body mist', q: 1, dt: 100, lg: -10 }] },
      summary: { ky: '2026-10', shop: 'aillavn1', den: '2026-10-25', dt: 1300, gv: 300, lg: 590, ads: 130, don: 7, hh: 50,
        fees: [['Hoa hồng affiliate', -30]], days: { '2026-10-01': [1300, -400, 300, 590, 7, 130] } },
    };
    expect((await ctx.request('/api/hub/shopee/month/2026-10/aillavn1', { method: 'PUT', as: USERS.ceo, body: b })).status).toBe(200);
    const r = await ctx.request('/api/hub/shopee/ops?from=2026-10-01&to=2026-10-31', { as: NV });
    expect(r.status).toBe(200);
    const m = r.body.data.months[0];
    expect(m).toMatchObject({ shop: 'aillavn1', dt: 1300, don: 7, hh: 50, ads: 130, hhAff: 30, den: '2026-10-25' });
    expect(m.days['2026-10-01']).toEqual([1300, 7, 130]);
    expect(m.sp).toEqual([
      { n: 'Tinh dầu', q: 6, dt: 1200, pri: 'Đẩy mạnh' },
      { n: 'Body mist', q: 1, dt: 100, pri: 'Dừng quảng cáo' },
    ]);
    expect(JSON.stringify(m)).not.toMatch(/"gv"|"lg"|"phi"/);
  });
});

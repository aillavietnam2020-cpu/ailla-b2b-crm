import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Báo cáo TikTok Shop: số theo ngày cho team TikTok, số tháng (lãi lỗ) chỉ CEO / kế toán, khoá sổ. */
let ctx: TestContext;
const NOW = '2026-10-24T01:00:00.000Z';
const NV = 'tiktok@ailla.vn';

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await ctx.db
    .prepare(
      `INSERT INTO users (id, email, display_name, role, status, created_at, updated_at)
       VALUES ('user-tt', ?, 'Team TikTok (test)', 'EMPLOYEE', 'ACTIVE', ?, ?)`,
    )
    .bind(NV, NOW, NOW)
    .run();
  await ctx.db
    .prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES ('user-tt', 'hub.access', 'user-ceo', ?)")
    .bind(NOW)
    .run();
});

const month = { data: { ky: '2026-09', M: { ky: '2026-09' }, pl: { rows: [] } }, summary: { dt: 100, lai: 10 } };

describe('TikTok: số theo ngày', () => {
  it('team TikTok tải số theo ngày, tải lại thì ghi đè đúng ngày, chỉ giữ số', async () => {
    let r = await ctx.request('/api/hub/tiktok/days', {
      method: 'PUT',
      as: NV,
      body: { src: 'km', days: { '2026-09-01': { gmv: 100, don: 2, ghi: 'chữ lạ' }, '2026-09-02': { gmv: 50 } } },
    });
    expect(r.status).toBe(200);
    r = await ctx.request('/api/hub/tiktok/days', { method: 'PUT', as: NV, body: { src: 'km', days: { '2026-09-02': { gmv: 70 } } } });
    expect(r.status).toBe(200);
    r = await ctx.request('/api/hub/tiktok/days?from=2026-09-01&to=2026-09-30', { as: NV });
    expect(r.body.data.days['2026-09-01'].km).toEqual({ gmv: 100, don: 2 });
    expect(r.body.data.days['2026-09-02'].km).toEqual({ gmv: 70 });
    const bad = await ctx.request('/api/hub/tiktok/days', { method: 'PUT', as: NV, body: { src: 'xyz', days: { '2026-09-01': {} } } });
    expect(bad.status).toBe(400);
  });
  it('số cả khoảng (KOC) lấy theo khoảng giao với kỳ xem', async () => {
    await ctx.request('/api/hub/tiktok/range', { method: 'PUT', as: NV, body: { kind: 'koc', from: '2026-09-01', to: '2026-09-30', data: { 'GMV nhờ nhà sáng tạo': 5 } } });
    const r = await ctx.request('/api/hub/tiktok/days?from=2026-09-15&to=2026-10-15', { as: NV });
    expect(r.body.data.ranges).toHaveLength(1);
    expect(r.body.data.ranges[0].data['GMV nhờ nhà sáng tạo']).toBe(5);
  });
});

describe('TikTok: số tháng và khoá sổ', () => {
  it('nhân viên không xem, không lưu được lãi lỗ tháng', async () => {
    expect((await ctx.request('/api/hub/tiktok/months', { as: NV })).status).toBe(403);
    expect((await ctx.request('/api/hub/tiktok/month/2026-09', { method: 'PUT', as: NV, body: month })).status).toBe(403);
  });
  it('CEO lưu, khoá sổ; tháng đã khoá không ghi đè; chỉ CEO mở khoá', async () => {
    expect((await ctx.request('/api/hub/tiktok/month/2026-09', { method: 'PUT', as: USERS.ceo, body: month })).status).toBe(200);
    let r = await ctx.request('/api/hub/tiktok/month/2026-09', { as: USERS.ceo });
    expect(r.body.data.data.M.ky).toBe('2026-09');
    r = await ctx.request('/api/hub/tiktok/months', { as: USERS.ceo });
    expect(r.body.data[0].summary.lai).toBe(10);
    expect((await ctx.request('/api/hub/tiktok/month/2026-09/lock', { method: 'POST', as: USERS.ceo, body: { lock: true } })).status).toBe(200);
    expect((await ctx.request('/api/hub/tiktok/month/2026-09', { method: 'PUT', as: USERS.ceo, body: month })).status).toBe(409);
    expect((await ctx.request('/api/hub/tiktok/month/2026-09/lock', { method: 'POST', as: USERS.ceo, body: { lock: false } })).status).toBe(200);
    expect((await ctx.request('/api/hub/tiktok/month/2026-09', { method: 'PUT', as: USERS.ceo, body: month })).status).toBe(200);
  });
  it('tháng trong thân phải khớp tháng trên đường dẫn', async () => {
    const r = await ctx.request('/api/hub/tiktok/month/2026-08', { method: 'PUT', as: USERS.ceo, body: month });
    expect(r.status).toBe(400);
  });
});

describe('TikTok: số tháng cho trang vận hành', () => {
  it('nhân viên xem được doanh thu, đơn, top sản phẩm kèm mức ưu tiên, không có lãi', async () => {
    const m = {
      data: { ky: '2026-09', M: { ky: '2026-09' }, pl: { ng2: 0.36, fees: [['Hoa hồng affiliate/KOC', -34655085]], sp: [{ n: 'Tinh dầu', q: 8628, dt: 876923400, lg: 477861929, bien: 0.545 }, { n: 'Bột tẩy', q: 3, dt: 418500, lg: -185000, bien: -0.44 }] } },
      summary: { dt: 1392110100, don: 12350, mon: 28540, hh: 177e6, hhRate: 0.113, ads: 364658750, lg: 714059914, lai: 349577164, gv: 262583910 },
    };
    expect((await ctx.request('/api/hub/tiktok/month/2026-09', { method: 'PUT', as: USERS.ceo, body: m })).status).toBe(200);
    const r = await ctx.request('/api/hub/tiktok/ops?from=2026-09-01&to=2026-09-30', { as: NV });
    expect(r.status).toBe(200);
    const x = r.body.data[0];
    expect(x).toMatchObject({ ky: '2026-09', dt: 1392110100, don: 12350, mon: 28540, ads: 364658750, hoaHong: 34655085 });
    expect(x.sp.map((p: { pri: string }) => p.pri)).toEqual(['Đẩy mạnh', 'Dừng quảng cáo']);
    expect(JSON.stringify(x)).not.toMatch(/"lg"|"lai"|"gv"|"bien"/);
    expect((await ctx.request('/api/hub/tiktok/ops?from=x&to=y', { as: NV })).status).toBe(400);
  });
});

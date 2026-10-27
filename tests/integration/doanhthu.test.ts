import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Doanh thu thực theo kênh × tháng: số đã chốt đóng băng từ ngày 10 tháng sau, số kế toán nhập tay. */
let ctx: TestContext;
const NOW = '2026-10-27T01:00:00.000Z';
const API = '/api/hub/dieuhanh/doanhthu';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await ctx.db
    .prepare("INSERT INTO users (id, email, display_name, role, status, created_at, updated_at) VALUES ('user-nv', 'nv@ailla.vn', 'NV', 'EMPLOYEE', 'ACTIVE', ?, ?)")
    .bind(NOW, NOW)
    .run();
  await ctx.db.prepare("INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES ('user-nv', 'hub.access', 'user-ceo', ?)").bind(NOW).run();
});
afterEach(() => {
  vi.useRealTimers();
});

const chot = (ym: string, amount: number, extra: Record<string, unknown> = {}) =>
  ctx.request(`${API}/chot`, { method: 'POST', as: USERS.ceo, body: { ym, rows: [{ channel: 'fb', amount, orders: 7651, data: { src: 'Pancake' } }], ...extra } });

describe('Doanh thu thực: chốt số tháng', () => {
  it('nhân viên không xem, không chốt được', async () => {
    expect((await ctx.request(`${API}?from=2026-09&to=2026-10`, { as: 'nv@ailla.vn' })).status).toBe(403);
    expect((await ctx.request(`${API}/chot`, { method: 'POST', as: 'nv@ailla.vn', body: { ym: '2026-09', rows: [] } })).status).toBe(403);
  });

  it('tháng chưa tới ngày 10 tháng sau thì không chốt được', async () => {
    const r = await chot('2026-10', 733_180_000);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('NOT_YET');
  });

  it('chốt một lần rồi đóng băng; chốt lại phải là CEO và có lý do', async () => {
    expect((await chot('2026-09', 1_209_555_000)).body.data.saved).toEqual(['fb']);
    expect((await chot('2026-09', 1_300_000_000)).body.data.saved).toEqual([]);
    let g = await ctx.request(`${API}?from=2026-09&to=2026-09`, { as: USERS.ceo });
    expect(g.body.data[0]).toMatchObject({ ym: '2026-09', channel: 'fb', web_amount: 1_209_555_000, web_orders: 7651 });
    expect((await chot('2026-09', 1_300_000_000, { force: true })).status).toBe(400);
    expect((await chot('2026-09', 1_210_009_000, { force: true, reason: 'Pancake cập nhật đơn giao muộn' })).body.data.saved).toEqual(['fb']);
    g = await ctx.request(`${API}?from=2026-09&to=2026-09`, { as: USERS.ceo });
    expect(g.body.data[0].web_amount).toBe(1_210_009_000);
    const a = await ctx.db.prepare("SELECT action, reason FROM audit_logs WHERE entity_type = 'REVENUE_MONTH' ORDER BY created_at").all<{ action: string; reason: string | null }>();
    expect(a.results.map((x) => x.action)).toEqual(['REVENUE_CLOSE', 'REVENUE_RECLOSE']);
  });

  it('số kế toán nhập tay không đụng số web đã chốt', async () => {
    await chot('2026-09', 1_209_555_000);
    const p = await ctx.request(`${API}/ketoan`, { method: 'PUT', as: USERS.ceo, body: { ym: '2026-09', channel: 'fb', amount: 1_084_300_000, note: 'báo cáo chị Huệ' } });
    expect(p.status).toBe(200);
    await ctx.request(`${API}/ketoan`, { method: 'PUT', as: USERS.ceo, body: { ym: '2026-09', channel: 'gc', amount: 142_300_000 } });
    const g = await ctx.request(`${API}?from=2026-09&to=2026-09`, { as: USERS.ceo });
    const fb = g.body.data.find((x: { channel: string }) => x.channel === 'fb');
    expect(fb).toMatchObject({ web_amount: 1_209_555_000, kt_amount: 1_084_300_000, kt_note: 'báo cáo chị Huệ' });
    expect(g.body.data.find((x: { channel: string }) => x.channel === 'gc')).toMatchObject({ kt_amount: 142_300_000, web_amount: null, closed_at: null });
    expect((await ctx.request(`${API}/ketoan`, { method: 'PUT', as: USERS.ceo, body: { ym: '2026-09', channel: 'npp', amount: 1 } })).status).toBe(400);
  });

  it('danh sách đơn đã duyệt Kênh phân phối của tháng', async () => {
    const r = await ctx.request(`${API}/b2b-orders?ym=2026-09&channel=B2B`, { as: USERS.ceo });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });
});

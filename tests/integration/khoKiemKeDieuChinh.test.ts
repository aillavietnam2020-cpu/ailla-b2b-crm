import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Kiểm kê + phiếu điều chỉnh (chị Hoa 18/11): tồn đầu kỳ do Kế toán lập, CEO duyệt; phiếu kiểm tồn không ghi đè sổ,
 * chênh lệch thành phiếu điều chỉnh (thừa cộng, thiếu trừ), dòng chưa rõ nguyên nhân thì treo. */
let ctx: TestContext;
const NOW = '2026-11-18T01:00:00.000Z';
const KT = 'ketoan@ailla.vn';
const doc = (as: string, body: Record<string, unknown>) => ctx.request('/api/hub/kho/docs', { as, body });
const ton = async () => {
  const r = await ctx.request('/api/hub/kho/ton', { as: USERS.ceo });
  return new Map((r.body.data.rows as Array<{ code: string; ton: number }>).map((x) => [x.code, x.ton]));
};

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await ctx.db
    .prepare("INSERT INTO users (id, email, display_name, role, status, created_at, updated_at) VALUES ('user-kt', ?, 'Kế toán trưởng (test)', 'EMPLOYEE', 'ACTIVE', ?, ?)")
    .bind(KT, NOW, NOW)
    .run();
  for (const p of ['hub.access', 'order.accounting.confirm']) {
    await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind('user-kt', p, 'user-ceo', NOW).run();
  }
  for (const c of ['A', 'B', 'C']) {
    await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, 'Cái', 'NVL', '', 0, 1, ?)").bind(c, `Mã ${c}`, NOW).run();
  }
});

describe('tồn đầu kỳ, kiểm tồn và điều chỉnh', () => {
  it('Kế toán lập tồn đầu kỳ thì chờ CEO duyệt; duyệt xong mới vào sổ và đặt mốc', async () => {
    const r = await doc(KT, { type: 'TD', moc: true, date: '2026-09-30', lines: [{ item: 'A', qty: 100, price: 1000 }] });
    expect(r.status).toBe(200);
    expect((await ton()).get('A') ?? 0).toBe(0);
    expect((await ctx.request(`/api/hub/kho/docs/${r.body.data.id}/duyet`, { as: KT, body: {} })).status).toBe(403);
    expect((await ctx.request(`/api/hub/kho/docs/${r.body.data.id}/duyet`, { as: USERS.ceo, body: {} })).status).toBe(200);
    expect((await ton()).get('A')).toBe(100);
    const moc = await ctx.db.prepare("SELECT v FROM kho_cfg WHERE k = 'ton_moc'").first<{ v: string }>();
    expect(moc?.v).toBe('2026-09-30');
  });

  it('phiếu kiểm tồn không đổi sổ; điều chỉnh đưa sổ về số đếm; dòng treo vẫn vào kho và xử lý được sau', async () => {
    await doc(USERS.ceo, { type: 'TD', moc: true, date: '2026-09-30', lines: [{ item: 'A', qty: 100 }, { item: 'B', qty: 50 }, { item: 'C', qty: 10 }] });
    await doc(USERS.ceo, { type: 'XK', date: '2026-10-20', lines: [{ item: 'A', qty: 30 }] });
    const kk = await doc(KT, { type: 'KK', date: '2026-10-31', lines: [{ item: 'A', qty: 65, price: 1000 }, { item: 'B', qty: 52, price: 500 }, { item: 'C', qty: 10 }] });
    expect(kk.status).toBe(200);
    let T = await ton();
    expect([T.get('A'), T.get('B'), T.get('C')]).toEqual([70, 50, 10]); // kiểm tồn chưa đổi sổ

    const bang = await ctx.request(`/api/hub/kho/kk/${kk.body.data.id}`, { as: KT });
    const rows = new Map((bang.body.data.rows as Array<{ item: string; so: number; dem: number; cl: number }>).map((x) => [x.item, x]));
    expect([rows.get('A')!.so, rows.get('A')!.cl, rows.get('B')!.cl, rows.get('C')!.cl]).toEqual([70, -5, 2, 0]);

    const dc = await ctx.request(`/api/hub/kho/kk/${kk.body.data.id}/dieu-chinh`, { as: KT, body: { treo: { A: 'Chưa tìm ra' }, ly_do: { B: 'Đếm sót tháng trước' } } });
    expect(dc.status).toBe(200);
    expect(dc.body.data.lines).toBe(2);
    T = await ton();
    expect([T.get('A'), T.get('B'), T.get('C')]).toEqual([65, 52, 10]);
    expect((await ctx.request(`/api/hub/kho/kk/${kk.body.data.id}/dieu-chinh`, { as: KT, body: {} })).body.error.code).toBe('DA_DC');

    const treo = await ctx.request('/api/hub/kho/treo', { as: KT });
    expect(treo.body.data).toHaveLength(1);
    expect(treo.body.data[0]).toMatchObject({ item: 'A', qty: -5, st: 'TREO', ly_do: 'Chưa tìm ra' });
    const go = await ctx.request(`/api/hub/kho/dc/${dc.body.data.id}/treo`, { as: KT, body: { item: 'A', action: 'ht', ghi_chu: 'Cuối năm hạch toán' } });
    expect(go.status).toBe(200);
    expect((await ctx.request('/api/hub/kho/treo', { as: KT })).body.data[0].st).toBe('DA_HT');
  });

  it('phiếu tồn cũ sau mốc đổi thành phiếu kiểm tồn: hết ghi đè sổ', async () => {
    await doc(USERS.ceo, { type: 'TD', moc: true, date: '2026-09-30', lines: [{ item: 'A', qty: 100 }] });
    await doc(USERS.ceo, { type: 'XK', date: '2026-10-20', lines: [{ item: 'A', qty: 30 }] });
    const cu = await doc(USERS.ceo, { type: 'TD', allow_more: true, date: '2026-10-31', lines: [{ item: 'A', qty: 60 }] });
    expect((await ton()).get('A')).toBe(60); // phiếu tồn sau mốc đang ghi đè sổ của mã A
    const r = await ctx.request(`/api/hub/kho/docs/${cu.body.data.id}/to-kk`, { as: USERS.ceo, body: {} });
    expect(r.status).toBe(200);
    expect((await ton()).get('A')).toBe(70);
    const bang = await ctx.request(`/api/hub/kho/kk/${cu.body.data.id}`, { as: USERS.ceo });
    expect(bang.body.data.rows[0]).toMatchObject({ item: 'A', so: 70, dem: 60, cl: -10 });
  });
});

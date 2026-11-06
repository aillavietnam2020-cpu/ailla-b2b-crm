import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Mốc tồn (chị Hoa chốt 04/11): phiếu tồn chốt chung 31/10 + kiểm bổ sung từng mã, sổ kho không trừ hai lần. */
let ctx: TestContext;
const NOW = '2026-10-19T01:00:00.000Z';
const CHUC = 'kiemke@ailla.vn';

const doc = (as: string, body: Record<string, unknown>) => ctx.request('/api/hub/kho/docs', { as, body });
const ton = async () => {
  const r = await ctx.request('/api/hub/kho/ton', { as: USERS.ceo });
  return new Map((r.body.data.rows as Array<{ code: string; ton: number; moc: string | null; da_kiem: boolean }>).map((x) => [x.code, x]));
};
const sold = (item: string, day: string, qty: number) =>
  ctx.db.prepare("INSERT INTO channel_out (channel, day, item, qty) VALUES ('TIKTOK', ?, ?, ?)").bind(day, item, qty).run();

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await ctx.db
    .prepare("INSERT INTO users (id, email, display_name, role, status, created_at, updated_at) VALUES ('user-chuc', ?, 'Kế toán kho (test)', 'EMPLOYEE', 'ACTIVE', ?, ?)")
    .bind(CHUC, NOW, NOW)
    .run();
  for (const p of ['hub.access', 'sx.kiemke']) {
    await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind('user-chuc', p, 'user-ceo', NOW).run();
  }
  for (const c of ['A', 'B', 'C', 'D']) {
    await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, 'Can', 'TP', '', 0, 1, ?)").bind(c, `Mã ${c}`, NOW).run();
  }
});

describe('mốc tồn 31/10 và kiểm bổ sung từng mã', () => {
  it('chưa có mốc: không cho kiểm bổ sung, sổ tính như cũ', async () => {
    const r = await doc(CHUC, { type: 'TD', bo_sung: true, date: '2026-11-02', lines: [{ item: 'C', qty: 1 }] });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('NO_MOC');
    expect((await doc(CHUC, { type: 'TD', date: '2026-10-31', lines: [{ item: 'C', qty: 1 }] })).status).toBe(403);
  });

  it('phiếu chốt chung đặt mốc; trước mốc không tính, sau mốc trừ bình thường; mã kiểm bổ sung lấy mốc riêng', async () => {
    expect((await doc(USERS.ceo, { type: 'PN', date: '2026-10-20', lines: [{ item: 'A', qty: 100 }] })).status).toBe(200);
    const chot = await doc(USERS.ceo, { type: 'TD', moc: true, date: '2026-10-31', lines: [{ item: 'A', qty: 50 }, { item: 'B', qty: 20 }] });
    expect(chot.status).toBe(200);
    const cfg = new Map((await ctx.db.prepare('SELECT k, v FROM kho_cfg').all<{ k: string; v: string }>()).results.map((r) => [r.k, r.v]));
    expect(cfg.get('ton_moc')).toBe('2026-10-31');
    expect(cfg.get('online_from')).toBe('2026-11-01');

    await sold('A', '2026-10-31', 5); // trong ngày chốt: đã nằm trong số đếm
    await sold('A', '2026-11-02', 3);
    await sold('C', '2026-11-01', 2);
    await sold('C', '2026-11-03', 4);
    let T = await ton();
    expect(T.get('A')!.ton).toBe(47); // 50 chốt − 3 bán sau mốc; phiếu nhập 20/10 và bán 31/10 không tính lại
    expect(T.get('B')!.ton).toBe(20);
    expect(T.get('C')!.ton).toBe(-6); // chưa kiểm: theo mốc chung
    expect(T.get('C')!.da_kiem).toBe(false);

    // Kế toán kho kiểm bổ sung C ngày 02/11 được 10: bán 01/11, 02/11 đã nằm trong số đếm; chỉ trừ 03/11.
    const bs = await doc(CHUC, { type: 'TD', bo_sung: true, date: '2026-11-02', lines: [{ item: 'C', qty: 10 }, { item: 'D', qty: 0 }] });
    expect(bs.status).toBe(200);
    T = await ton();
    expect(T.get('C')!.ton).toBe(6);
    expect(T.get('C')!.moc).toBe('2026-11-02');
    expect(T.get('C')!.da_kiem).toBe(true);
    expect(T.get('D')!.ton).toBe(0);
    expect(T.get('A')!.moc).toBe('2026-10-31');

    // Nhập – xuất – tồn tháng 11 của C: tồn đầu 0, số kiểm 10, xuất 4.
    const nx = await ctx.request('/api/hub/kho/nxt?from=2026-11-01&to=2026-11-30', { as: USERS.ceo });
    const c = (nx.body.data as Array<Record<string, number | string>>).find((r) => r.code === 'C')!;
    expect([c.opening, c.qty_in, c.qty_out, c.closing]).toEqual([0, 10, 4, 6]);
  });

  it('kiểm lại được khi ngày đếm sau lần kiểm trước; trùng ngày thì chặn; ngày phải sau mốc, không sau hôm nay', async () => {
    await doc(USERS.ceo, { type: 'TD', moc: true, date: '2026-10-31', lines: [{ item: 'A', qty: 50 }] });
    // 06/11: phiếu kiểm tồn kiểm lại được mã đã kiểm, miễn là ngày đếm SAU lần kiểm trước (số mới thay sổ từ ngày đó).
    expect((await doc(CHUC, { type: 'TD', bo_sung: true, date: '2026-11-02', lines: [{ item: 'A', qty: 40 }] })).status).toBe(200);
    expect((await doc(CHUC, { type: 'TD', bo_sung: true, date: '2026-11-02', lines: [{ item: 'C', qty: 5 }] })).status).toBe(200);
    const dup = await doc(CHUC, { type: 'TD', bo_sung: true, date: '2026-11-02', lines: [{ item: 'C', qty: 6 }] });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DA_KIEM');
    expect((await doc(CHUC, { type: 'TD', bo_sung: true, date: '2026-11-03', lines: [{ item: 'C', qty: 6 }] })).status).toBe(200);
    expect((await doc(CHUC, { type: 'TD', bo_sung: true, date: '2026-10-31', lines: [{ item: 'B', qty: 1 }] })).status).toBe(400);
    expect((await doc(CHUC, { type: 'TD', bo_sung: true, date: '2099-01-01', lines: [{ item: 'B', qty: 1 }] })).status).toBe(400);
    const m = await ctx.request('/api/hub/kho/moc', { as: CHUC });
    expect(m.body.data.moc).toBe('2026-10-31');
    expect((m.body.data.counted as Array<{ item: string }>).map((x) => x.item).sort()).toEqual(['A', 'C']);
  });
});

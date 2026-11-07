import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';
import { pack } from '../../src/server/lib/pack';

/** Pha chế (chị Hoa duyệt demo 07/11): yêu cầu ở sổ riêng, công thức có duyệt, báo tồn, hao hụt. */
let ctx: TestContext;
const NOW = '2026-11-07T01:00:00.000Z';
const KT = 'kythuat@ailla.vn';
const TKT = 'truongkt@ailla.vn';

const req = (path: string, as: string, body?: unknown, method?: string) => ctx.request('/api/hub/phache' + path, { as, body, method } as never);

async function addUser(id: string, email: string, name: string) {
  await ctx.db.prepare("INSERT INTO users (id, email, display_name, role, status, created_at, updated_at) VALUES (?, ?, ?, 'EMPLOYEE', 'ACTIVE', ?, ?)").bind(id, email, name, NOW, NOW).run();
  await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(id, 'hub.access', 'user-ceo', NOW).run();
}

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await addUser('user-kt', KT, 'Kỹ thuật (test)');
  await addUser('user-tkt', TKT, 'Trưởng kỹ thuật (test)');
  const main = { users: [{ id: 'u_kt', crm: 'user-kt', perms: ['sx.kythuat'] }, { id: 'u_tkt', crm: 'user-tkt', perms: ['sx.kythuat', 'sx.congthuc'] }] };
  await ctx.db.prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('main', 1, ?, ?)").bind(await pack(JSON.stringify(main)), NOW).run();
  const items: Array<[string, string, string, number]> = [['BTP1', 'BTP nước giặt', 'BTP', 0], ['SLES', 'SLES 70%', 'NVL', 30], ['LAS', 'LAS 96%', 'NVL', 10], ['RO', 'Nước RO', 'NVL', 0]];
  for (const [c, n, cls, min] of items) {
    await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, 'kg', ?, '', ?, 1, ?)").bind(c, n, cls, min, NOW).run();
  }
});

describe('yêu cầu pha chế ở sổ riêng', () => {
  it('chép yêu cầu cũ trong ngăn Sản xuất sang lần đầu, tạo / sửa / hủy, đã pha thì suy ra từ phiếu', async () => {
    const sx = { pcReq: [{ id: 'YCPC2611-001', btp: 'BTP1', lit: 200, litBon: 200, bon: 1, han: '2026-11-08', ghiChu: 'cũ', taoLuc: '2026-11-06', tao: 'QLMH', st: 'CHO_LAM' }] };
    await ctx.db.prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('sx', 1, ?, ?)").bind(await pack(JSON.stringify(sx)), NOW).run();
    let r = await req('/yc', USERS.ceo);
    expect(r.status).toBe(200);
    expect(r.body.data.map((x: { id: string }) => x.id)).toEqual(['YCPC2611-001']);

    r = await req('/yc', USERS.ceo, { ngay: '2026-11-07', han: '2026-11-09', ghi_chu: 'gấp', items: [{ btp: 'BTP1', lit_bon: 500 }] });
    expect(r.status).toBe(200);
    expect(r.body.data[0].id).toBe('YCPC2611-002');
    expect((await req('/yc', USERS.ceo, { items: [{ btp: 'SLES', lit_bon: 5 }] })).body.error.code).toBe('NOT_BTP');

    expect((await req('/yc/YCPC2611-002', USERS.ceo, { btp: 'BTP1', lit_bon: 300, han: '2026-11-10' }, 'PATCH')).status).toBe(200);
    // Kỹ thuật ghi phiếu pha chế gắn mã yêu cầu → đã pha, không sửa hay hủy được nữa.
    const noCt = await ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'PC', date: '2026-11-07', btp: 'BTP1', liters: 300, lines: [{ item: 'SLES', qty: 36, std_qty: 36 }] } });
    expect(noCt.body.error.code).toBe('NO_CT'); // chưa có công thức thì không ghi được phiếu pha chế
    expect((await req('/ct', USERS.ceo, { btp: 'BTP1', lines: [{ item: 'SLES', qty: 0.12 }], ly_do: 'Công thức đầu' })).status).toBe(200);
    const pc = await ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'PC', date: '2026-11-07', btp: 'BTP1', liters: 300, ref_no: 'YCPC2611-002', lines: [{ item: 'SLES', qty: 36, std_qty: 36 }] } });
    expect(pc.status).toBe(200);
    r = await req('/yc', USERS.ceo);
    const y2 = r.body.data.find((x: { id: string }) => x.id === 'YCPC2611-002');
    expect(y2.lit).toBe(300);
    expect(y2.doc_no).toBeTruthy();
    expect((await req('/yc/YCPC2611-002', USERS.ceo, { huy: true, ly_do: 'x' }, 'PATCH')).body.error.code).toBe('DA_PHA');

    expect((await req('/yc/YCPC2611-001', USERS.ceo, { huy: true }, 'PATCH')).body.error.code).toBe('NO_REASON');
    expect((await req('/yc/YCPC2611-001', USERS.ceo, { huy: true, ly_do: 'không cần nữa' }, 'PATCH')).status).toBe(200);
    r = await req('/yc', USERS.ceo);
    expect(r.body.data.find((x: { id: string }) => x.id === 'YCPC2611-001').status).toBe('HUY');
  });
});

describe('công thức của Kỹ thuật', () => {
  it('Kỹ thuật lập thì chờ duyệt, Trưởng kỹ thuật duyệt mới dùng; Trưởng kỹ thuật tự nhập thì dùng ngay; giữ lịch sử', async () => {
    const lines = [{ item: 'SLES', qty: 0.12 }, { item: 'RO', qty: 0.8 }];
    expect((await req('/ct', KT, { btp: 'BTP1', lines })).body.error.code).toBe('NO_REASON');
    let r = await req('/ct', KT, { btp: 'BTP1', lines, huong_dan: 'Cho RO trước\nKhuấy 10 phút', ly_do: 'Công thức đầu' });
    expect(r.body.data.status).toBe('CHO');
    const id1 = r.body.data.id;
    expect((await req('/ct', KT, { btp: 'BTP1', lines, ly_do: 'lập tiếp' })).body.error.code).toBe('CHO_DUYET');
    expect((await req(`/ct/${id1}/duyet`, KT, {})).status).toBe(403);
    r = await req('/ct', KT);
    expect(r.body.data.can_approve).toBe(false);
    expect((await req('/ct', TKT)).body.data.can_approve).toBe(true);
    expect((await req(`/ct/${id1}/duyet`, TKT, {})).status).toBe(200);

    r = await req('/ct', TKT, { btp: 'BTP1', lines: [{ item: 'SLES', qty: 0.1 }, { item: 'RO', qty: 0.8 }], ly_do: 'Giảm SLES' });
    expect(r.body.data).toMatchObject({ status: 'OK', version: 2 });
    r = await req('/ct', KT, { btp: 'BTP1', lines: [{ item: 'SLES', qty: 0.2 }], ly_do: 'thử' });
    const id3 = r.body.data.id;
    expect((await req(`/ct/${id3}/tra`, TKT, {})).body.error.code).toBe('NO_REASON');
    expect((await req(`/ct/${id3}/tra`, TKT, { ly_do: 'Quá nhiều SLES' })).status).toBe(200);

    const rows = (await req('/ct', KT)).body.data.rows as Array<{ version: number; status: string; lines: Array<{ qty: number }>; huong_dan: string }>;
    expect(rows.map((x) => [x.version, x.status])).toEqual([[3, 'TRA'], [2, 'OK'], [1, 'CU']]);
    expect(rows.find((x) => x.version === 2)!.lines[0].qty).toBe(0.1);
    expect(rows.find((x) => x.version === 1)!.huong_dan).toContain('Khuấy');
  });
});

describe('báo tồn tại xưởng', () => {
  it('hết thật thì cần đặt, còn nhiều hơn web thì không đặt, khác sổ thì lệch; không sửa sổ kho', async () => {
    await ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'PN', date: '2026-11-01', lines: [{ item: 'SLES', qty: 38 }, { item: 'LAS', qty: 6.5 }, { item: 'RO', qty: 100 }] } });
    const lines = [{ item: 'SLES', dem: 25 }, { item: 'LAS', dem: 40 }, { item: 'RO', dem: 100 }];
    const p = await req('/ton', KT, { preview: true, lines });
    expect(p.status).toBe(200);
    const by = new Map((p.body.data.lines as Array<{ item: string; dat: boolean; lech: boolean; web_sap_het: boolean }>).map((l) => [l.item, l]));
    expect(by.get('SLES')).toMatchObject({ dat: true, lech: true });
    expect(by.get('LAS')).toMatchObject({ dat: false, lech: true, web_sap_het: true });
    expect(by.get('RO')).toMatchObject({ dat: false, lech: false });
    expect((await ctx.db.prepare('SELECT COUNT(*) AS n FROM pc_count').first<{ n: number }>())!.n).toBe(0);
    const s = await req('/ton', KT, { lines, note: 'gấp' });
    expect(s.status).toBe(200);
    expect((await req('/ton', KT)).body.data[0].note).toBe('gấp');
    const ton = await ctx.request('/api/hub/kho/ton', { as: USERS.ceo });
    expect((ton.body.data.rows as Array<{ code: string; ton: number }>).find((x) => x.code === 'SLES')!.ton).toBe(38);
  });
});

describe('hao hụt', () => {
  it('trả các mẻ pha trong kỳ với số theo công thức, thực tế, lý do lệch', async () => {
    await req('/ct', USERS.ceo, { btp: 'BTP1', lines: [{ item: 'SLES', qty: 0.12 }, { item: 'RO', qty: 0.8 }], ly_do: 'Công thức đầu' });
    await ctx.request('/api/hub/kho/docs', { as: USERS.ceo, body: { type: 'PC', date: '2026-11-05', btp: 'BTP1', liters: 100, nguoi: ['Kỹ thuật A'], lines: [{ item: 'SLES', qty: 13, std_qty: 12, note: 'SLES đặc' }, { item: 'RO', qty: 80, std_qty: 80 }] } });
    const r = await req('/haohut?from=2026-11-01&to=2026-11-30', USERS.ceo);
    expect(r.status).toBe(200);
    expect(r.body.data.docs).toHaveLength(1);
    const use = (r.body.data.moves as Array<{ item: string; role: string; qty: number; std_qty: number; note: string }>).find((m) => m.item === 'SLES' && m.role === 'USE')!;
    expect(use).toMatchObject({ qty: -13, std_qty: 12, note: 'SLES đặc' });
    expect(r.body.data.price).not.toBeNull();
    expect((await req('/haohut?from=2026-11-01&to=2026-11-30', KT)).body.data.price).toBeNull();
  });
});

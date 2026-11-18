import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Nạp lệnh pha chế đã ghi trên MISA (chị Hoa 18/11): số NVL theo MISA, không cần công thức web, mỗi lệnh LX chỉ nạp một lần. */
let ctx: TestContext;
const NOW = '2026-11-18T01:00:00.000Z';
const doc = (as: string, body: Record<string, unknown>) => ctx.request('/api/hub/kho/docs', { as, body });
const lenh = (lx: string, extra: Record<string, unknown> = {}) => ({
  type: 'PC',
  date: '2026-10-01',
  btp: 'BTPLAUSANQUE',
  liters: 570,
  ref_no: lx,
  misa: { lx, pxk: 'PXK6037', pnk: 'PNK02444' },
  lines: [
    { item: 'HCTEA', qty: 1.2, std_qty: 1.2 },
    { item: 'HUONGQUE', qty: 0.86, std_qty: 0.86 },
  ],
  ...extra,
});

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  const items: Array<[string, string, string]> = [
    ['BTPLAUSANQUE', 'Lau sàn quế', 'BTP'],
    ['HCTEA', 'Triethanol Amine', 'NVL'],
    ['HUONGQUE', 'Hương Quế', 'NVL'],
  ];
  for (const [code, name, cls] of items) {
    await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, 'kg', ?, '', 0, 1, ?)").bind(code, name, cls, NOW).run();
  }
  await ctx.db.prepare("INSERT INTO kho_cfg (k, v) VALUES ('ton_moc', '2026-10-31')").run();
});

describe('nạp lệnh pha chế MISA', () => {
  it('ghi phiếu pha chế theo số MISA dù chưa có công thức, không trùng lệnh, không làm đổi tồn sau mốc', async () => {
    const r = await doc(USERS.ceo, lenh('LX1441'));
    expect(r.status).toBe(200);
    const d = await ctx.db.prepare('SELECT ref_no, extra FROM kho_docs WHERE id = ?').bind(r.body.data.id).first<{ ref_no: string; extra: string }>();
    expect(d!.ref_no).toBe('LX1441');
    expect(JSON.parse(d!.extra).misa).toEqual({ lx: 'LX1441', pxk: 'PXK6037', pnk: 'PNK02444' });
    const mv = (await ctx.db.prepare('SELECT item, qty, role FROM kho_moves WHERE doc_id = ? ORDER BY id').bind(r.body.data.id).all<{ item: string; qty: number; role: string }>()).results;
    expect(mv).toEqual([
      { item: 'BTPLAUSANQUE', qty: 570, role: 'PRODUCT' },
      { item: 'HCTEA', qty: -1.2, role: 'USE' },
      { item: 'HUONGQUE', qty: -0.86, role: 'USE' },
    ]);

    const dup = await doc(USERS.ceo, lenh('LX1441'));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DA_NAP');

    const ds = await ctx.request('/api/hub/kho/misa-lx', { as: USERS.ceo });
    expect(ds.body.data.map((x: { lx: string }) => x.lx)).toEqual(['LX1441']);

    // Phiếu ngày 01/10, trước mốc 31/10: tồn hiện tại không đổi.
    const ton = await ctx.request('/api/hub/kho/ton', { as: USERS.ceo });
    const t = new Map((ton.body.data.rows as Array<{ code: string; ton: number }>).map((x) => [x.code, x.ton]));
    expect(t.get('HCTEA') ?? 0).toBe(0);
  });

  it('phiếu pha chế thường vẫn bắt có công thức; số lệnh sai dạng bị chặn', async () => {
    const thuong = await doc(USERS.ceo, { ...lenh('LX1'), misa: undefined });
    expect(thuong.body.error.code).toBe('NO_CT');
    const sai = await doc(USERS.ceo, lenh('1441'));
    expect(sai.body.error.code).toBe('BAD_LX');
  });
});

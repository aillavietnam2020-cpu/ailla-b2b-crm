import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';
import { pack, unpack } from '../../src/server/lib/pack';
import { doDungReminders } from '../../src/server/routes/doDung';

/** Đồ dùng văn phòng & nhà máy (chị Hoa duyệt demo 11/11/2026). */
let ctx: TestContext;
const NOW = '2026-11-11T01:00:00.000Z';
const HCNS = 'hcns@ailla.vn';
const NV = 'nv@ailla.vn';
const LEAD = 'lead@ailla.vn';
const KHO = 'kho@ailla.vn';
const QL = 'qlmh@ailla.vn';

const req = (path: string, as: string, body?: unknown, method?: string) => ctx.request('/api/hub/dodung' + path, { as, body, method } as never);

async function addUser(id: string, email: string, name: string, perms: string[]) {
  await ctx.db.prepare("INSERT INTO users (id, email, display_name, role, status, created_at, updated_at) VALUES (?, ?, ?, 'EMPLOYEE', 'ACTIVE', ?, ?)").bind(id, email, name, NOW, NOW).run();
  for (const p of ['hub.access', ...perms])
    await ctx.db.prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)').bind(id, p, 'user-ceo', NOW).run();
}

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await addUser('user-hcns', HCNS, 'HCNS (test)', []);
  await addUser('user-nv', NV, 'NV Content (test)', []);
  await addUser('user-lead', LEAD, 'Lead Content (test)', []);
  await addUser('user-kho', KHO, 'Kế toán kho (test)', ['sx.kiemke']);
  await addUser('user-ql', QL, 'Quản lý mua hàng (test)', ['order.approve.normal']);
  const main = {
    users: [
      { id: 'u_ceo', crm: 'user-ceo', name: 'CEO', role: 'admin', phongBan: 'BDH' },
      { id: 'u_hcns', crm: 'user-hcns', name: 'HCNS', role: 'nhanvien', phongBan: 'HCNS' },
      { id: 'u_nv', crm: 'user-nv', name: 'NV Content', role: 'content', phongBan: 'CONTENT' },
      { id: 'u_lead', crm: 'user-lead', name: 'Lead Content', role: 'lead', phongBan: 'CONTENT' },
      { id: 'u_kho', crm: 'user-kho', name: 'Kho', role: 'nhanvien', phongBan: 'KHO' },
      { id: 'u_ql', crm: 'user-ql', name: 'QLMH', role: 'nhanvien', phongBan: 'SX' },
    ],
    notifs: [],
  };
  await ctx.db.prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('main', 1, ?, ?)").bind(await pack(JSON.stringify(main)), NOW).run();
  await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES ('TDGS500', 'Tinh dầu giặt sấy 500ml', 'chai', 'TP', '', 0, 1, ?)").bind(NOW).run();
  await ctx.db.prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES ('SLES', 'SLES', 'kg', 'NVL', '', 0, 1, ?)").bind(NOW).run();
});

const all = async (as = HCNS) => (await req('/all', as)).body.data;
const notifs = async () => {
  const r = await ctx.db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  return (JSON.parse(await unpack(r!.data)).notifs ?? []) as Array<{ to: string; text: string }>;
};

describe('danh mục và tồn theo nơi', () => {
  it('HCNS thêm đồ có tồn văn phòng / nhà máy; nhân viên không thêm được; kiểm kê ghi chênh', async () => {
    expect((await req('/item', NV, { ten: 'Đèn', loai: 'tb' })).status).toBe(403);
    let r = await req('/item', HCNS, { ten: 'Đèn LED 60W', loai: 'tb', dvt: 'bộ', ton_vp: 3, ton_nm: 1, gia: 1650000 });
    expect(r.status).toBe(200);
    expect(r.body.data.ma).toBe('TB-001');
    r = await req('/item', HCNS, { loai: 'mau', kho_code: 'TDGS500' });
    expect(r.body.data.ma).toBe('TDGS500');
    expect((await req('/item', HCNS, { loai: 'mau', kho_code: 'TDGS500' })).body.error.code).toBe('DA_CO');
    expect((await req('/item', HCNS, { loai: 'mau', kho_code: 'KHONGCO' })).body.error.code).toBe('BAD_KHO_CODE');
    r = await req('/item', HCNS, { ten: 'Giấy ăn rút', loai: 'th', dvt: 'gói', ton_vp: 18, min_vp: 10 });
    const giay = r.body.data.id;
    const d = await all();
    const den = d.items.find((i: { ma: string }) => i.ma === 'TB-001');
    expect(den.ton).toEqual({ vp: 3, nm: 1 });
    expect(d.me.hr).toBe(true);
    expect((await req('/kk', HCNS, { noi: 'vp', ngay: '2026-11-11', lines: [{ item_id: giay, dem: 14 }] })).body.data.chenh).toBe(1);
    expect((await all()).items.find((i: { id: string }) => i.id === giay).ton.vp).toBe(14);
  });
});

describe('phiếu lấy đồ: ký mượn / trả', () => {
  it('nhân viên xin → HCNS giao (trừ kệ) → người lấy ký nhận → khai trả → HCNS nhận lại; hỏng thì không về kệ', async () => {
    const den = (await req('/item', HCNS, { ten: 'Đèn LED', loai: 'tb', ton_vp: 2 })).body.data.id;
    const mau = (await req('/item', HCNS, { loai: 'mau', kho_code: 'TDGS500', ton_vp: 5 })).body.data.id;
    expect((await req('/lay', NV, { noi: 'vp', lines: [{ item_id: den, sl: 1 }] })).body.error.code).toBe('NO_MUC_DICH');
    expect((await req('/lay', NV, { noi: 'vp', shoot_txt: 'x', lines: [{ item_id: den, sl: 3 }] })).body.error.code).toBe('KHONG_DU');
    let r = await req('/lay', NV, { noi: 'vp', shoot_id: 'sq1', shoot_txt: 'T5 13/11 · Văn phòng', han: '2026-11-13T18:00', lines: [{ item_id: den, sl: 2 }, { item_id: mau, sl: 3 }] });
    expect(r.status).toBe(200);
    const id = r.body.data.id;
    expect(id).toMatch(/^PL\d{4}-001$/);
    expect(r.body.data.st).toBe('cho');
    expect((await notifs()).some((n) => n.to === 'u_hcns' && n.text.includes(id))).toBe(true);
    expect((await req(`/lay/${id}/giao`, NV, {})).status).toBe(403);
    expect((await req(`/lay/${id}/ky`, NV, {})).body.error.code).toBe('SAI_BUOC');
    expect((await req(`/lay/${id}/giao`, HCNS, {})).status).toBe(200);
    let d = await all();
    expect(d.items.find((i: { id: string }) => i.id === den).ton.vp).toBe(0);
    expect((await req(`/lay/${id}/ky`, HCNS, {})).status).toBe(403);
    expect((await req(`/lay/${id}/ky`, NV, {})).status).toBe(200);
    const p = d.lay.find((x: { id: string }) => x.id === id);
    const lDen = p.lines.find((l: { item_id: string }) => l.item_id === den).id;
    const lMau = p.lines.find((l: { item_id: string }) => l.item_id === mau).id;
    // Thiết bị trả thiếu phải ghi Hỏng / Mất.
    expect((await req(`/lay/${id}/tra`, NV, { lines: [{ id: lDen, tra: 1 }, { id: lMau, tra: 1 }] })).body.error.code).toBe('BAD_TRA');
    r = await req(`/lay/${id}/tra`, NV, { lines: [{ id: lDen, tra: 1, tinh: 'Hỏng', note: 'vỡ bóng' }, { id: lMau, tra: 1 }] });
    expect(r.body.data.st).toBe('tra_cho');
    expect((await all()).items.find((i: { id: string }) => i.id === den).ton.vp).toBe(0); // chưa nhận lại thì chưa về kệ
    r = await req(`/lay/${id}/tra`, HCNS, {});
    expect(r.body.data.st).toBe('tra');
    d = await all();
    expect(d.items.find((i: { id: string }) => i.id === den).ton.vp).toBe(1); // 1 tốt về kệ, 1 hỏng bỏ ra
    expect(d.items.find((i: { id: string }) => i.id === mau).ton.vp).toBe(3); // 5 − 3 + 1 trả lại, 2 dùng hết
    const line = d.lay.find((x: { id: string }) => x.id === id).lines.find((l: { id: number }) => l.id === lMau);
    expect(line.dung).toBe(2);
  });

  it('HCNS lập và giao luôn cho người khác; quá hạn thì nhắc 8 giờ', async () => {
    const den = (await req('/item', HCNS, { ten: 'Tripod', loai: 'tb', ton_nm: 1 })).body.data.id;
    const r = await req('/lay', HCNS, { noi: 'nm', user_id: 'user-nv', giao: true, muc_dich: 'Quay nhà máy', han: '2026-11-10T17:00', lines: [{ item_id: den, sl: 1 }] });
    expect(r.body.data.st).toBe('dang');
    const d = await all(NV);
    expect(d.lay[0].user_name).toBe('NV Content');
    expect(d.lay[0].qua_han).toBe(true);
    const k = await doDungReminders(ctx.db as unknown as D1Database, new Date('2026-11-11T01:00:00Z'));
    expect(k.qua_han).toBe(1);
    expect((await notifs()).some((n) => n.to === 'u_nv' && n.text.includes('quá hạn'))).toBe(true);
  });
});

describe('yêu cầu hàng mẫu từ xưởng', () => {
  it('Lead duyệt → kho lập phiếu xuất kho thật (trừ kho thành phẩm) → HCNS nhận về văn phòng', async () => {
    expect((await req('/mau', NV, { noi: 'vp', kho_code: 'SLES', sl: 1, shoot_txt: 'x' })).body.error.code).toBe('BAD_KHO_CODE');
    let r = await req('/mau', NV, { noi: 'vp', kho_code: 'TDGS500', sl: 6, shoot_txt: 'T5 13/11 quay so sánh mùi', can_ngay: '2026-11-12' });
    const id = r.body.data.id;
    expect(r.body.data.st).toBe('lead');
    expect((await notifs()).some((n) => n.to === 'u_lead' && n.text.includes(id))).toBe(true);
    expect((await req(`/mau/${id}/duyet`, HCNS, {})).status).toBe(403);
    expect((await req(`/mau/${id}/duyet`, LEAD, {})).body.data.st).toBe('kho');
    expect((await notifs()).some((n) => n.to === 'u_kho' && n.text.includes(id))).toBe(true);
    expect((await req(`/mau/${id}/nhan`, HCNS, {})).body.error.code).toBe('CHUA_XUAT');
    // Kho lập phiếu xuất khác (XK) ở Kho thành phẩm, gắn mã yêu cầu.
    const xk = await ctx.request('/api/hub/kho/docs', { as: KHO, body: { type: 'XK', date: '2026-11-11', partner: 'Văn phòng (HCNS)', ref_no: id, kind: 'Hàng mẫu Marketing', lines: [{ item: 'TDGS500', qty: 5 }] } } as never);
    expect(xk.status).toBe(200);
    let d = await all();
    expect(d.mau[0].xk.sl).toBe(5);
    expect((await req(`/mau/${id}/huy`, NV, {})).body.error.code).toBe('DA_XUAT');
    const ton = await ctx.db.prepare("SELECT SUM(qty) AS q FROM kho_ledger WHERE item = 'TDGS500'").first<{ q: number }>();
    expect(ton!.q).toBe(-5);
    expect((await req(`/mau/${id}/nhan`, NV, {})).status).toBe(403);
    r = await req(`/mau/${id}/nhan`, HCNS, {});
    expect(r.body.data.sl).toBe(5);
    d = await all();
    expect(d.mau[0].st).toBe('xong');
    const it = d.items.find((i: { kho_code: string }) => i.kho_code === 'TDGS500');
    expect(it.loai).toBe('mau');
    expect(it.ton.vp).toBe(5);
  });

  it('Lead tự xin thì chuyển thẳng kho; trả lại phải có lý do', async () => {
    let r = await req('/mau', LEAD, { noi: 'nm', kho_code: 'TDGS500', sl: 2, ghi_chu: 'mẫu cho khách' });
    expect(r.body.data.st).toBe('kho');
    r = await req('/mau', NV, { noi: 'vp', kho_code: 'TDGS500', sl: 2, shoot_txt: 'x' });
    expect((await req(`/mau/${r.body.data.id}/duyet`, LEAD, { ok: false })).body.error.code).toBe('NO_REASON');
    expect((await req(`/mau/${r.body.data.id}/duyet`, LEAD, { ok: false, ly_do: 'văn phòng còn đủ' })).body.data.st).toBe('tl');
  });
});

describe('đề nghị mua đồ dùng', () => {
  it('Lead phòng → Quản lý mua hàng duyệt → mua về nhập tồn, thêm vào danh mục', async () => {
    let r = await req('/mua', NV, { noi: 'vp', ten: 'Micro không dây', loai: 'tb', sl: 2, gia: 1290000, ly_do: 'Quay 2 người' });
    const id = r.body.data.id;
    expect(r.body.data.st).toBe('lead');
    expect((await req(`/mua/${id}/duyet`, QL, {})).status).toBe(403);
    expect((await req(`/mua/${id}/duyet`, LEAD, {})).body.data.st).toBe('ql');
    expect((await notifs()).some((n) => n.to === 'u_ql' && n.text.includes(id))).toBe(true);
    expect((await req(`/mua/${id}/xong`, HCNS, { thuc_sl: 2, thuc_tien: 2500000 })).body.error.code).toBe('SAI_BUOC');
    expect((await req(`/mua/${id}/duyet`, LEAD, {})).status).toBe(403);
    expect((await req(`/mua/${id}/duyet`, QL, {})).body.data.st).toBe('mua');
    expect((await req(`/mua/${id}/xong`, NV, { thuc_sl: 2, thuc_tien: 2500000 })).status).toBe(403);
    r = await req(`/mua/${id}/xong`, HCNS, { thuc_sl: 2, thuc_tien: 2500000, tra_bang: 'Chuyển khoản', pc_id: 'pc_x1', cho: 'Tủ thiết bị' });
    expect(r.status).toBe(200);
    const d = await all();
    const it = d.items.find((i: { id: string }) => i.id === r.body.data.item_id);
    expect(it.ma).toBe('TB-001');
    expect(it.ton.vp).toBe(2);
    expect(it.gia).toBe(1250000);
    expect(d.mua[0].pc_id).toBe('pc_x1');
  });

  it('Quản lý mua hàng tự đề nghị (không có Lead) thì duyệt luôn; cần sửa rồi gửi lại', async () => {
    let r = await req('/mua', QL, { noi: 'nm', ten: 'Găng tay', sl: 10, gia: 20000, ly_do: 'xưởng' });
    expect(r.body.data.st).toBe('mua');
    r = await req('/mua', NV, { noi: 'vp', ten: 'Giấy A4', sl: 10, gia: 65000, ly_do: 'hết' });
    expect((await req(`/mua/${r.body.data.id}/duyet`, LEAD, { ok: false, ly_do: 'xin báo giá thứ hai' })).body.data.st).toBe('tl');
    expect((await req(`/mua/${r.body.data.id}/gui-lai`, NV, { gia: 60000 })).body.data.st).toBe('lead');
    const c = (await req('/cho', LEAD)).body.data;
    expect(c.mua).toBe(1);
  });

  it('CEO xem được mọi việc', async () => {
    const d = (await req('/all', USERS.ceo)).body.data;
    expect(d.me).toMatchObject({ ceo: true, hr: true, kho: true, ql: true });
  });
});

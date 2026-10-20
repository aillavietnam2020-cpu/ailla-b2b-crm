import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;
const NOW = '2026-10-19T01:00:00.000Z';
const KT = 'kythuat@ailla.vn';

async function grant(userId: string, perm: string) {
  await ctx.db
    .prepare('INSERT INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?, ?, ?, ?)')
    .bind(userId, perm, 'user-ceo', NOW)
    .run();
}

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await ctx.db
    .prepare(
      `INSERT INTO users (id, email, display_name, role, status, created_at, updated_at)
       VALUES ('user-kt', ?, 'Kỹ thuật (test)', 'EMPLOYEE', 'ACTIVE', ?, ?)`,
    )
    .bind(KT, NOW, NOW)
    .run();
  await grant('user-kt', 'hub.access');
  await grant('user-manager', 'hub.access');
  for (const [code, name, cls] of [
    ['TP1', 'Thành phẩm 1', 'TP'],
    ['BTP1', 'Bán thành phẩm 1', 'BTP'],
    ['NVL1', 'Nguyên liệu 1', 'NVL'],
  ]) {
    await ctx.db
      .prepare("INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, 'kg', ?, '', 0, 1, ?)")
      .bind(code, name, cls, NOW)
      .run();
  }
  await ctx.db.prepare("INSERT INTO kho_bom (product, item, qty, kind, note, sort) VALUES ('TP1', 'BTP1', 1.2, 'Bán thành phẩm', '', 0)").run();
  await ctx.db.prepare("INSERT INTO kho_bom (product, item, qty, kind, note, sort) VALUES ('BTP1', 'NVL1', 0.3, '', '', 0)").run();
});

describe('Định mức chỉ người được phép xem nguyên bảng', () => {
  it('kỹ thuật không nhận bảng định mức nhưng biết sản phẩm nào có định mức và BTP của nó', async () => {
    const r = await ctx.request('/api/hub/kho/catalog', { as: KT });
    expect(r.status).toBe(200);
    expect(r.body.data.bom).toEqual([]);
    expect(r.body.data.bom_hidden).toBe(true);
    expect(r.body.data.bom_has).toEqual(expect.arrayContaining(['TP1', 'BTP1']));
    expect(r.body.data.btp_of.TP1).toBe('BTP1');
    expect(JSON.stringify(r.body)).not.toContain('1.2');
  });

  it('CEO và quản lý nhận đủ bảng định mức', async () => {
    for (const who of [USERS.ceo, USERS.manager]) {
      const r = await ctx.request('/api/hub/kho/catalog', { as: who });
      expect(r.status).toBe(200);
      expect(r.body.data.bom).toHaveLength(2);
      expect(r.body.data.bom_hidden).toBe(false);
    }
  });

  it('kỹ thuật vẫn lấy được lượng cần dùng cho đúng số lượng của mẻ', async () => {
    const r = await ctx.request('/api/hub/kho/bom/expand', { as: KT, body: { lines: [{ product: 'TP1', qty: 100 }] } });
    expect(r.status).toBe(200);
    expect(r.body.data[0].rows).toEqual([{ item: 'BTP1', need: 120, kind: 'Bán thành phẩm' }]);
  });

  it('số lượng không hợp lệ bị từ chối', async () => {
    const r = await ctx.request('/api/hub/kho/bom/expand', { as: KT, body: { lines: [{ product: 'TP1', qty: 0 }] } });
    expect(r.status).toBe(400);
  });

  it('chênh lệch so với định mức chỉ người được phép xem', async () => {
    const q = '/api/hub/kho/variance?from=2026-10-01&to=2026-10-31';
    expect((await ctx.request(q, { as: KT })).status).toBe(403);
    expect((await ctx.request(q, { as: USERS.ceo })).status).toBe(200);
  });
});

describe('Gắn mã MISA cho từng mã CRM', () => {
  it('quản lý gắn được một mã; mã MISA lạ hoặc hệ số 0 bị từ chối; kỹ thuật không gắn được', async () => {
    const ok1 = await ctx.request('/api/hub/kho/map/CRM1', { method: 'PUT', as: USERS.manager, body: { misa_code: 'TP1', factor: 1 } });
    expect(ok1.status).toBe(200);
    const row = await ctx.db.prepare("SELECT misa_code, factor FROM kho_map WHERE crm_sku = 'CRM1'").first<{ misa_code: string; factor: number }>();
    expect(row).toEqual({ misa_code: 'TP1', factor: 1 });
    const edit = await ctx.request('/api/hub/kho/map/CRM1', { method: 'PUT', as: USERS.manager, body: { misa_code: 'TP1', factor: 4 } });
    expect(edit.status).toBe(200);
    expect((await ctx.db.prepare("SELECT factor FROM kho_map WHERE crm_sku = 'CRM1'").first<{ factor: number }>())?.factor).toBe(4);
    expect((await ctx.request('/api/hub/kho/map/CRM2', { method: 'PUT', as: USERS.manager, body: { misa_code: 'KHONGCO', factor: 1 } })).status).toBe(400);
    expect((await ctx.request('/api/hub/kho/map/CRM2', { method: 'PUT', as: USERS.manager, body: { misa_code: 'TP1', factor: 0 } })).status).toBe(400);
    expect((await ctx.request('/api/hub/kho/map/CRM2', { method: 'PUT', as: KT, body: { misa_code: 'TP1', factor: 1 } })).status).toBe(403);
  });
});

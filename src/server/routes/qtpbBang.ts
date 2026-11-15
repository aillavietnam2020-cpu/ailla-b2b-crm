import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import {
  canAddRow,
  canDesign,
  canEditRow,
  canView,
  describeDefChange,
  LIMITS,
  sanitizeDef,
  sanitizeRow,
  type BangDef,
  type BangViewer,
} from '../lib/bangDuLieu';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { newId } from '../lib/ids';
import { enabledDepts, leadOf } from '../lib/qtpb';
import { requirePermission } from '../middleware/rbac';
import { writeQtpbLog } from '../services/qtpbStore';
import { loadMain, syncBangXemMain } from './qtpb';

/**
 * BẢNG DỮ LIỆU (Quản trị phòng ban đợt 3): /api/hub/qtpb/bang
 *  - Lead (hoặc CEO) tạo bảng, đặt cột, chỉ số tự tính, ai xem / ai sửa → ghi Nhật ký phòng, CEO / Quản lý hoàn tác được.
 *  - Người trong phòng xem, thêm, sửa dòng theo quyền Lead đặt. Mọi kiểm tra quyền làm ở đây (lib/bangDuLieu.ts).
 */
export const qtpbBangRoutes = new Hono<AppEnv>();
qtpbBangRoutes.use('*', requirePermission('hub.access'));

type TblRow = { id: string; dept: string; name: string; def_json: string; created_name: string | null; created_at: string; updated_at: string; deleted_at: string | null };
type DataRow = { id: string; table_id: string; data_json: string; by_id: string | null; by_name: string | null; created_at: string; updated_at: string; updated_name: string | null };

type Me = BangViewer & { name: string; depts: string[] };

async function viewerOf(db: D1Database, auth: AuthContext): Promise<Me> {
  const main = await loadMain(db);
  const users = main?.data.users ?? [];
  const me = users.find((u) => u?.crm === auth.user.id && u.active !== false);
  const l = leadOf(users, auth.user.id, main?.data.qtpb);
  return {
    hubId: String(me?.id ?? ''),
    dept: String(me?.phongBan ?? ''),
    // CEO tắt "Lead tạo bảng dữ liệu" thì Lead chỉ như người trong phòng
    leadDept: l && !l.off?.has('bang') ? l.dept : '',
    ceo: auth.user.role === 'CEO',
    name: String(me?.name ?? auth.user.display_name ?? ''),
    depts: enabledDepts(main?.data.qtpb),
  };
}

const parseDef = (s: string): BangDef => {
  try {
    return sanitizeDef(JSON.parse(s));
  } catch {
    return sanitizeDef({});
  }
};
const parseData = (s: string): Record<string, unknown> => {
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

async function getTable(db: D1Database, id: string): Promise<TblRow> {
  const t = await db.prepare('SELECT * FROM qtpb_tables WHERE id = ? AND deleted_at IS NULL').bind(id).first<TblRow>();
  if (!t) throw notFound('Không tìm thấy bảng (có thể đã bị xóa)');
  return t;
}

const pub = (t: TblRow, me: Me, rows?: number) => {
  const def = parseDef(t.def_json);
  return {
    id: t.id,
    dept: t.dept,
    name: t.name,
    def,
    created_name: t.created_name,
    updated_at: t.updated_at,
    rows,
    design: canDesign(t.dept, me),
    add: canAddRow(t.dept, def, me),
  };
};
const pubRow = (r: DataRow, t: TblRow, def: BangDef, me: Me) => {
  const data = parseData(r.data_json);
  return { id: r.id, data, by_id: r.by_id, by_name: r.by_name, updated_at: r.updated_at, updated_name: r.updated_name, edit: canEditRow(t.dept, def, me, { by_id: r.by_id, data }) };
};

async function logBang(db: D1Database, me: Me, t: { id: string; dept: string; name: string }, summary: string, before: unknown, after: unknown) {
  await writeQtpbLog(db, [{ dept: t.dept, action: 'bang', target: t.id, target_name: t.name, summary, before, after }], {
    id: me.hubId,
    name: me.name,
    role: me.ceo ? 'ceo' : 'lead',
  });
}

qtpbBangRoutes.get('/', async (c) => {
  const me = await viewerOf(c.env.DB, c.get('auth'));
  const { results } = await c.env.DB.prepare('SELECT * FROM qtpb_tables WHERE deleted_at IS NULL ORDER BY dept, created_at').all<TblRow>();
  const counts = await c.env.DB
    .prepare('SELECT table_id, COUNT(*) AS n FROM qtpb_rows WHERE deleted_at IS NULL GROUP BY table_id')
    .all<{ table_id: string; n: number }>();
  const n = new Map((counts.results ?? []).map((r) => [r.table_id, r.n]));
  const tables = (results ?? []).filter((t) => canView(t.dept, parseDef(t.def_json), me)).map((t) => pub(t, me, n.get(t.id) ?? 0));
  return ok(c, {
    tables,
    me: { ceo: me.ceo, dept: me.dept, leadDept: me.leadDept, hubId: me.hubId, depts: me.depts, create: me.ceo || !!me.leadDept },
  });
});

const tblSchema = z.object({ name: z.string().trim().min(1, 'Đặt tên bảng').max(80), def: z.unknown(), dept: z.string().trim().max(20).optional() });

qtpbBangRoutes.post('/', async (c) => {
  const me = await viewerOf(c.env.DB, c.get('auth'));
  const v = tblSchema.parse(await c.req.json());
  const dept = me.ceo ? v.dept || '' : me.leadDept;
  if (!dept || !canDesign(dept, me)) throw forbidden('Chỉ Lead của phòng đã mở Quản trị phòng (hoặc CEO) tạo được bảng.');
  const cnt = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM qtpb_tables WHERE dept = ? AND deleted_at IS NULL').bind(dept).first<{ n: number }>();
  if ((cnt?.n ?? 0) >= LIMITS.tablesPerDept) throw badRequest('LIMIT', `Mỗi phòng tối đa ${LIMITS.tablesPerDept} bảng. Xóa bớt bảng không dùng nữa.`);
  const def = sanitizeDef(v.def);
  if (!def.cols.length) throw badRequest('NO_COL', 'Bảng cần ít nhất một cột');
  const id = newId();
  const at = nowIso();
  await c.env.DB
    .prepare('INSERT INTO qtpb_tables (id, dept, name, def_json, created_by, created_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, dept, v.name, JSON.stringify(def), me.hubId, me.name, at, at)
    .run();
  await logBang(c.env.DB, me, { id, dept, name: v.name }, `Tạo bảng "${v.name}" (${def.cols.length} cột)`, null, { name: v.name, def });
  await syncBangXemMain(c.env.DB, c.get('auth').user.id);
  const t = await getTable(c.env.DB, id);
  return ok(c, { table: pub(t, me, 0) });
});

qtpbBangRoutes.get('/:id', async (c) => {
  const me = await viewerOf(c.env.DB, c.get('auth'));
  const t = await getTable(c.env.DB, c.req.param('id'));
  const def = parseDef(t.def_json);
  if (!canView(t.dept, def, me)) throw forbidden('Bảng này chưa mở cho bạn xem.');
  const { results } = await c.env.DB
    .prepare('SELECT * FROM qtpb_rows WHERE table_id = ? AND deleted_at IS NULL ORDER BY created_at LIMIT ?')
    .bind(t.id, LIMITS.rows)
    .all<DataRow>();
  const rows = (results ?? []).map((r) => pubRow(r, t, def, me));
  return ok(c, { table: pub(t, me, rows.length), rows });
});

const putSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), def: z.unknown().optional() });

qtpbBangRoutes.put('/:id', async (c) => {
  const me = await viewerOf(c.env.DB, c.get('auth'));
  const t = await getTable(c.env.DB, c.req.param('id'));
  if (!canDesign(t.dept, me)) throw forbidden('Chỉ Lead của phòng (hoặc CEO) sửa được cấu trúc bảng.');
  const v = putSchema.parse(await c.req.json());
  const d0 = parseDef(t.def_json);
  const d1 = v.def === undefined ? d0 : sanitizeDef(v.def);
  if (!d1.cols.length) throw badRequest('NO_COL', 'Bảng cần ít nhất một cột');
  const name = v.name ?? t.name;
  if (name === t.name && JSON.stringify(d0) === JSON.stringify(d1)) return ok(c, { table: pub(t, me) });
  await c.env.DB.prepare('UPDATE qtpb_tables SET name = ?, def_json = ?, updated_at = ? WHERE id = ?').bind(name, JSON.stringify(d1), nowIso(), t.id).run();
  await logBang(c.env.DB, me, t, describeDefChange(t.name, d0, name, d1), { name: t.name, def: d0, deleted_at: null }, { name, def: d1 });
  if (JSON.stringify(d0.xem) !== JSON.stringify(d1.xem)) await syncBangXemMain(c.env.DB, c.get('auth').user.id);
  return ok(c, { table: pub(await getTable(c.env.DB, t.id), me) });
});

qtpbBangRoutes.delete('/:id', async (c) => {
  const me = await viewerOf(c.env.DB, c.get('auth'));
  const t = await getTable(c.env.DB, c.req.param('id'));
  if (!canDesign(t.dept, me)) throw forbidden('Chỉ Lead của phòng (hoặc CEO) xóa được bảng.');
  await c.env.DB.prepare('UPDATE qtpb_tables SET deleted_at = ? WHERE id = ?').bind(nowIso(), t.id).run();
  await logBang(c.env.DB, me, t, `Xóa bảng "${t.name}"`, { name: t.name, def: parseDef(t.def_json), deleted_at: null }, { deleted: true });
  await syncBangXemMain(c.env.DB, c.get('auth').user.id);
  return ok(c, { ok: true });
});

const rowSchema = z.object({ data: z.record(z.string(), z.unknown()) });

qtpbBangRoutes.post('/:id/rows', async (c) => {
  const me = await viewerOf(c.env.DB, c.get('auth'));
  const t = await getTable(c.env.DB, c.req.param('id'));
  const def = parseDef(t.def_json);
  if (!canView(t.dept, def, me) || !canAddRow(t.dept, def, me)) throw forbidden('Bảng này chỉ Lead thêm dòng được.');
  const cnt = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM qtpb_rows WHERE table_id = ? AND deleted_at IS NULL').bind(t.id).first<{ n: number }>();
  if ((cnt?.n ?? 0) >= LIMITS.rows) throw badRequest('LIMIT', `Mỗi bảng tối đa ${LIMITS.rows} dòng.`);
  const v = rowSchema.parse(await c.req.json());
  const data = sanitizeRow(v.data, def);
  const id = newId();
  const at = nowIso();
  await c.env.DB
    .prepare('INSERT INTO qtpb_rows (id, table_id, data_json, by_id, by_name, created_at, updated_at, updated_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, t.id, JSON.stringify(data), me.hubId, me.name, at, at, me.name)
    .run();
  const r = await c.env.DB.prepare('SELECT * FROM qtpb_rows WHERE id = ?').bind(id).first<DataRow>();
  return ok(c, { row: pubRow(r!, t, def, me) });
});

async function getRow(db: D1Database, t: TblRow, rid: string): Promise<DataRow> {
  const r = await db.prepare('SELECT * FROM qtpb_rows WHERE id = ? AND table_id = ? AND deleted_at IS NULL').bind(rid, t.id).first<DataRow>();
  if (!r) throw notFound('Không tìm thấy dòng (có thể đã bị xóa)');
  return r;
}

qtpbBangRoutes.put('/:id/rows/:rid', async (c) => {
  const me = await viewerOf(c.env.DB, c.get('auth'));
  const t = await getTable(c.env.DB, c.req.param('id'));
  const def = parseDef(t.def_json);
  const r = await getRow(c.env.DB, t, c.req.param('rid'));
  const old = parseData(r.data_json);
  if (!canView(t.dept, def, me) || !canEditRow(t.dept, def, me, { by_id: r.by_id, data: old })) throw forbidden('Bạn chưa được sửa dòng này.');
  const v = rowSchema.parse(await c.req.json());
  const data = sanitizeRow(v.data, def, old);
  // Người phụ trách không tự gỡ tên mình rồi mất quyền sửa: vẫn cho, vì Lead xem lại được ở bảng.
  await c.env.DB.prepare('UPDATE qtpb_rows SET data_json = ?, updated_at = ?, updated_name = ? WHERE id = ?').bind(JSON.stringify(data), nowIso(), me.name, r.id).run();
  const r2 = await getRow(c.env.DB, t, r.id);
  return ok(c, { row: pubRow(r2, t, def, me) });
});

qtpbBangRoutes.delete('/:id/rows/:rid', async (c) => {
  const me = await viewerOf(c.env.DB, c.get('auth'));
  const t = await getTable(c.env.DB, c.req.param('id'));
  const def = parseDef(t.def_json);
  const r = await getRow(c.env.DB, t, c.req.param('rid'));
  if (!canView(t.dept, def, me) || !canEditRow(t.dept, def, me, { by_id: r.by_id, data: parseData(r.data_json) })) throw forbidden('Bạn chưa được xóa dòng này.');
  await c.env.DB.prepare('UPDATE qtpb_rows SET deleted_at = ?, updated_name = ? WHERE id = ?').bind(nowIso(), me.name, r.id).run();
  return ok(c, { ok: true });
});

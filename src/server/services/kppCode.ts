import { nowIso } from '@shared/datetime';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, conflict, notFound } from '../lib/http';
import { bellTo } from '../lib/hubBell';
import { newId } from '../lib/ids';
import { approverIds, taskStatements } from '../lib/notifyTasks';

/**
 * Mã bán Kênh phân phối cho hàng hóa / quà chưa có mã (chị Hoa giao 05/11/2026).
 * - Web đề xuất mã: mã kho đã có dạng QUA-… thì dùng luôn, không thì QUA-<MÃ KHO>; trùng thì thêm -2, -3…
 * - Người duyệt mã (CEO / Trưởng phòng có quyền duyệt đơn) tạo thì mã có hiệu lực ngay.
 * - Sale tạo khi lên đơn: vẫn bán được bình thường, mã chờ duyệt (products.code_status = 'CHO_DUYET'),
 *   báo Trưởng phòng ở Việc hôm nay + chuông; duyệt xong (giữ hoặc sửa mã) thì hết chờ.
 * Mã bán nối mã kho hệ số 1 (kho_map) nên xuất kho, giá vốn, công nợ, báo cáo chạy như mọi mã khác.
 */
export const CODE_TASK = 'Duyệt mã bán Kênh phân phối';
export const canApproveCode = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('order.approve.normal');
const SKU_RE = /^[\w.\-+]{2,40}$/;

/** Hàng hóa / quà được tạo mã bán: lớp HH, đang dùng, chưa nối mã bán nào. */
async function itemForCode(db: D1Database, code: string) {
  const it = await db
    .prepare("SELECT code, name, unit, cls, active FROM kho_items WHERE code = ?")
    .bind(code)
    .first<{ code: string; name: string; unit: string; cls: string; active: number }>();
  if (!it || !it.active) throw notFound('Không thấy mã kho này (hoặc đã ngừng dùng)');
  if (it.cls !== 'HH') throw badRequest('NOT_GIFT', 'Chỉ tự tạo mã bán cho hàng hóa / quà. Thành phẩm tạo ở Sản phẩm & combo › Thêm sản phẩm.');
  return it;
}

export async function existingSku(db: D1Database, code: string) {
  return db
    .prepare(
      `SELECT p.id, p.sku, p.name, p.unit, p.code_status FROM kho_map km JOIN products p ON p.sku = km.crm_sku AND p.deleted_at IS NULL
       WHERE km.misa_code = ? LIMIT 1`,
    )
    .bind(code)
    .first<{ id: string; sku: string; name: string; unit: string | null; code_status: string }>();
}

export async function suggestSku(db: D1Database, code: string): Promise<string> {
  const base = (/^QUA-/i.test(code) ? code : 'QUA-' + code).toUpperCase().replace(/[^\w.\-+]/g, '').slice(0, 36);
  for (let i = 1; i < 50; i++) {
    const sku = i === 1 ? base : `${base}-${i}`;
    const used = await db
      .prepare('SELECT 1 FROM products WHERE lower(sku) = lower(?) UNION ALL SELECT 1 FROM kho_map WHERE lower(crm_sku) = lower(?) LIMIT 1')
      .bind(sku, sku)
      .first();
    if (!used) return sku;
  }
  throw conflict('NO_SKU', 'Không tìm được mã bán còn trống');
}

/** Tạo mã bán cho một mã kho. approved = người tạo có quyền duyệt mã. Trả về sản phẩm (có sẵn thì trả luôn). */
export async function createKppCode(
  db: D1Database,
  auth: AuthContext,
  code: string,
  opts: { sku?: string; approved: boolean; requestId?: string; ip?: string | null; source: string },
): Promise<{ id: string; sku: string; name: string; unit: string | null; code_status: string; created: boolean }> {
  const have = await existingSku(db, code);
  if (have) return { ...have, created: false };
  const it = await itemForCode(db, code);
  let sku = String(opts.sku ?? '').trim();
  if (sku) {
    if (!SKU_RE.test(sku)) throw badRequest('BAD_SKU', 'Mã bán chỉ gồm chữ không dấu, số, dấu chấm, gạch (2–40 ký tự)');
    const used = await db
      .prepare('SELECT 1 FROM products WHERE lower(sku) = lower(?) UNION ALL SELECT 1 FROM kho_map WHERE lower(crm_sku) = lower(?) LIMIT 1')
      .bind(sku, sku)
      .first();
    if (used) throw conflict('DUP_SKU', `Mã bán ${sku} đã có, chọn mã khác`);
  } else sku = await suggestSku(db, code);
  const id = newId();
  const now = nowIso();
  const status = opts.approved ? '' : 'CHO_DUYET';
  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO product_groups (id, code, name, created_at, updated_at) VALUES (?, 'QUA_TANG', 'Quà tặng và gia dụng', ?, ?)")
      .bind(newId(), now, now),
    db
      .prepare(
        `INSERT INTO products (id, sku, name, unit, group_id, active, created_at, updated_at, code_status, code_by)
         VALUES (?, ?, ?, ?, (SELECT id FROM product_groups WHERE code = 'QUA_TANG'), 1, ?, ?, ?, ?)`,
      )
      .bind(id, sku, it.name, it.unit || null, now, now, status, auth.user.id),
    db.prepare("INSERT INTO kho_map (crm_sku, misa_code, factor, note) VALUES (?, ?, 1, 'Mã bán hàng hóa / quà (web đề xuất)')").bind(sku, it.code),
    auditStatement(db, {
      actorId: auth.user.id,
      action: opts.approved ? 'KPP_CODE_ADD' : 'KPP_CODE_PROPOSE',
      entityType: 'PRODUCT',
      entityId: id,
      after: { sku, kho: it.code, name: it.name, status, source: opts.source },
      requestId: opts.requestId,
      ip: opts.ip ?? null,
    }),
  ]);
  if (!opts.approved) await notifyApprovers(db, auth, `${CODE_TASK}: ${sku} (${it.name}), do ${auth.user.display_name} tạo khi lên đơn. Quản trị › Phê duyệt hoặc Cấu hình › Sản phẩm & combo`);
  return { id, sku, name: it.name, unit: it.unit || null, code_status: status, created: true };
}

/** Người duyệt mã: quản lý / người có quyền duyệt đơn (Trưởng phòng); CEO xem ở Phê duyệt nên không nhận thêm việc. */
async function codeApprovers(db: D1Database): Promise<string[]> {
  const ids = await approverIds(db);
  if (!ids.length) return ids;
  const ceo = (
    await db.prepare(`SELECT id FROM users WHERE role = 'CEO' AND id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{ id: string }>()
  ).results ?? [];
  const not = new Set(ceo.map((r) => r.id));
  const rest = ids.filter((i) => !not.has(i));
  return rest.length ? rest : ids;
}

async function notifyApprovers(db: D1Database, auth: AuthContext, title: string) {
  const ids = await codeApprovers(db);
  const now = nowIso();
  const stmts = taskStatements(db, ids, { title, createdBy: auth.user.id, now, priority: 'HIGH' });
  if (stmts.length) await db.batch(stmts);
  try {
    await bellTo(db, ids, title, 'spcombo');
  } catch {
    /* chuông là phụ, không chặn việc tạo mã */
  }
}

/** Duyệt mã đang chờ: giữ mã hoặc đổi sang mã khác (đổi cả kho_map), rồi đóng việc "Duyệt mã" khi hết mã chờ. */
export async function approveKppCode(
  db: D1Database,
  auth: AuthContext,
  productId: string,
  newSku: string | undefined,
  meta: { requestId?: string; ip?: string | null },
): Promise<{ sku: string }> {
  const p = await db
    .prepare("SELECT id, sku, name, code_status FROM products WHERE id = ? AND deleted_at IS NULL")
    .bind(productId)
    .first<{ id: string; sku: string; name: string; code_status: string }>();
  if (!p) throw notFound('Không thấy mã bán này');
  if (p.code_status !== 'CHO_DUYET') throw conflict('NOT_PENDING', 'Mã này không còn chờ duyệt');
  const sku = String(newSku ?? '').trim() || p.sku;
  if (!SKU_RE.test(sku)) throw badRequest('BAD_SKU', 'Mã bán chỉ gồm chữ không dấu, số, dấu chấm, gạch (2–40 ký tự)');
  if (sku.toLowerCase() !== p.sku.toLowerCase()) {
    const used = await db
      .prepare('SELECT 1 FROM products WHERE lower(sku) = lower(?) AND id <> ? UNION ALL SELECT 1 FROM kho_map WHERE lower(crm_sku) = lower(?) LIMIT 1')
      .bind(sku, p.id, sku)
      .first();
    if (used) throw conflict('DUP_SKU', `Mã bán ${sku} đã có, chọn mã khác`);
  }
  const now = nowIso();
  await db.batch([
    db.prepare("UPDATE products SET sku = ?, code_status = '', updated_at = ? WHERE id = ?").bind(sku, now, p.id),
    db.prepare('UPDATE kho_map SET crm_sku = ? WHERE crm_sku = ?').bind(sku, p.sku),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'KPP_CODE_APPROVE',
      entityType: 'PRODUCT',
      entityId: p.id,
      before: { sku: p.sku },
      after: { sku, name: p.name },
      requestId: meta.requestId,
      ip: meta.ip ?? null,
    }),
  ]);
  const left = await db.prepare("SELECT COUNT(*) AS n FROM products WHERE code_status = 'CHO_DUYET' AND deleted_at IS NULL").first<{ n: number }>();
  if (!left?.n) {
    await db
      .prepare("UPDATE tasks SET status = 'DONE', completed_at = ?, updated_at = ? WHERE status = 'OPEN' AND title LIKE ?")
      .bind(now, now, CODE_TASK + '%')
      .run();
  }
  return { sku };
}

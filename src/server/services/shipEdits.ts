import { nowIso, shipDayToIso, vnDate } from '@shared/datetime';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { approverIds, taskStatements } from '../lib/notifyTasks';
import { flowCorrectShipped } from './orderFlow';

/**
 * Sửa phiếu xuất kho B2B (số thực xuất, ngày xuất, người xuất) có lý do và có người duyệt:
 *  - Kế toán kho (Chúc) gửi yêu cầu sửa kèm lý do; quản lý điều phối (Thảo) hoặc CEO duyệt thì mới sửa thật.
 *  - Người có quyền duyệt tự sửa thì áp luôn và vẫn ghi lại yêu cầu + lý do.
 */
export interface ShipEditInput {
  ship_day?: string | null;
  shipped_by_name?: string | null;
  lines?: Array<{ product_id: string; shipped_qty: number }> | null;
  reason: string;
}

type Ctx = { requestId: string; ip: string | null };

export const isShipApprover = (auth: AuthContext) => auth.user.role === 'CEO' || auth.permissions.includes('order.approve.normal');
const canRequest = (auth: AuthContext) =>
  isShipApprover(auth) || auth.permissions.includes('order.kho.process') || auth.permissions.includes('order.accounting.confirm');

/** Đổi ngày xuất / người xuất của đơn đã xuất. */
export async function applyShipInfo(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  info: { ship_day: string; shipped_by_name: string; note?: string | null },
  ctx: Ctx,
) {
  if (info.ship_day > vnDate()) throw unprocessable('BAD_SHIP_DAY', 'Ngày xuất kho không được sau hôm nay.');
  const o = await db
    .prepare('SELECT id, delivery_status, delivered_at, shipped_by_name FROM orders WHERE id = ? AND deleted_at IS NULL')
    .bind(orderId)
    .first<{ id: string; delivery_status: string; delivered_at: string | null; shipped_by_name: string | null }>();
  if (!o) throw notFound('Không tìm thấy đơn hàng');
  if (!['DA_XUAT_KHO', 'DA_GIAO'].includes(o.delivery_status)) {
    throw unprocessable('NOT_SHIPPED', 'Đơn chưa xuất kho nên chưa có ngày xuất để sửa.');
  }
  await db.batch([
    db
      .prepare('UPDATE orders SET delivered_at = ?, shipped_by_name = ?, updated_at = ? WHERE id = ?')
      .bind(shipDayToIso(info.ship_day), info.shipped_by_name, nowIso(), orderId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ORDER_SHIP_INFO_EDITED',
      entityType: 'ORDER',
      entityId: orderId,
      before: { delivered_at: o.delivered_at, shipped_by_name: o.shipped_by_name },
      after: { ship_day: info.ship_day, shipped_by_name: info.shipped_by_name },
      reason: info.note ?? null,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
}

async function applyEdit(db: D1Database, approver: AuthContext, orderId: string, e: ShipEditInput, ctx: Ctx) {
  if (e.lines && e.lines.length) {
    await flowCorrectShipped(db, approver, orderId, { lines: e.lines, reason: e.reason }, { requestId: ctx.requestId, ip: ctx.ip });
  }
  if (e.ship_day || e.shipped_by_name) {
    const cur = await db.prepare('SELECT delivered_at, shipped_by_name FROM orders WHERE id = ?').bind(orderId).first<{ delivered_at: string | null; shipped_by_name: string | null }>();
    const day = e.ship_day ?? (cur?.delivered_at ? String(cur.delivered_at).slice(0, 10) : vnDate());
    const name = (e.shipped_by_name ?? cur?.shipped_by_name ?? '').trim();
    if (name.length < 2) throw unprocessable('NO_NAME', 'Ghi tên người xuất kho.');
    await applyShipInfo(db, approver, orderId, { ship_day: day, shipped_by_name: name, note: e.reason }, ctx);
  }
}

export async function requestShipEdit(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  input: ShipEditInput,
  ctx: Ctx,
): Promise<{ id: string; applied: boolean }> {
  if (!canRequest(auth)) throw forbidden('Chỉ kế toán kho, quản lý điều phối, kế toán hoặc CEO sửa phiếu xuất.');
  const reason = (input.reason ?? '').trim();
  if (reason.length < 5) throw unprocessable('REASON_REQUIRED', 'Ghi lý do sửa (tối thiểu 5 ký tự).');
  const hasLines = Boolean(input.lines && input.lines.length);
  if (!hasLines && !input.ship_day && !input.shipped_by_name) throw badRequest('NO_CHANGE', 'Chưa có gì để sửa.');
  if (input.ship_day && input.ship_day > vnDate()) throw unprocessable('BAD_SHIP_DAY', 'Ngày xuất kho không được sau hôm nay.');
  const o = await db.prepare('SELECT id, order_no, delivery_status FROM orders WHERE id = ? AND deleted_at IS NULL').bind(orderId).first<{ id: string; order_no: string; delivery_status: string }>();
  if (!o) throw notFound('Không tìm thấy đơn hàng');
  if (!['DA_XUAT_KHO', 'DA_GIAO'].includes(o.delivery_status)) throw unprocessable('NOT_SHIPPED', 'Đơn chưa xuất kho nên chưa có phiếu xuất để sửa.');
  const pend = await db.prepare("SELECT 1 AS x FROM ship_edit_requests WHERE order_id = ? AND status = 'CHO_DUYET' LIMIT 1").bind(orderId).first();
  if (pend) throw conflict('PENDING', 'Phiếu này đang có một yêu cầu sửa chờ duyệt. Chờ duyệt xong rồi gửi tiếp.');

  const id = newId();
  const now = nowIso();
  const approver = isShipApprover(auth);
  const row = (status: string) =>
    db
      .prepare(
        `INSERT INTO ship_edit_requests (id, order_id, requested_by, requested_at, ship_day, shipped_by_name, lines_json, reason, status, decided_by, decided_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, orderId, auth.user.id, now, input.ship_day ?? null, input.shipped_by_name?.trim() || null, hasLines ? JSON.stringify(input.lines) : null, reason, status, approver ? auth.user.id : null, approver ? now : null);
  if (approver) {
    // Người có quyền duyệt tự sửa: áp ngay (lỗi thì không ghi yêu cầu).
    await applyEdit(db, auth, orderId, { ...input, reason }, ctx);
    await row('DA_DUYET').run();
    return { id, applied: true };
  }
  const more = taskStatements(db, await approverIds(db), {
    title: `Duyệt sửa phiếu xuất đơn ${o.order_no}: ${reason}. Vào Xuất kho › Xuất B2B xem và duyệt.`,
    createdBy: auth.user.id,
    now,
  });
  await db.batch([
    row('CHO_DUYET'),
    ...more,
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'SHIP_EDIT_REQUESTED',
      entityType: 'ORDER',
      entityId: orderId,
      after: { ship_day: input.ship_day ?? null, shipped_by_name: input.shipped_by_name ?? null, lines: input.lines ?? null },
      reason,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
  return { id, applied: false };
}

export async function decideShipEdit(
  db: D1Database,
  auth: AuthContext,
  requestId: string,
  decision: 'APPROVED' | 'REJECTED',
  note: string | null,
  ctx: Ctx,
) {
  if (!isShipApprover(auth)) throw forbidden('Chỉ quản lý điều phối hoặc CEO duyệt yêu cầu sửa phiếu xuất.');
  const r = await db
    .prepare('SELECT id, order_id, requested_by, ship_day, shipped_by_name, lines_json, reason, status FROM ship_edit_requests WHERE id = ?')
    .bind(requestId)
    .first<{ id: string; order_id: string; requested_by: string; ship_day: string | null; shipped_by_name: string | null; lines_json: string | null; reason: string; status: string }>();
  if (!r) throw notFound('Không tìm thấy yêu cầu');
  if (r.status !== 'CHO_DUYET') throw conflict('BAD_STEP', 'Yêu cầu này đã được xử lý rồi.');
  if (decision === 'REJECTED' && (note ?? '').trim().length < 3) throw unprocessable('NOTE_REQUIRED', 'Ghi lý do từ chối.');
  if (decision === 'APPROVED') {
    const lines = r.lines_json ? (JSON.parse(r.lines_json) as Array<{ product_id: string; shipped_qty: number }>) : null;
    await applyEdit(db, auth, r.order_id, { ship_day: r.ship_day, shipped_by_name: r.shipped_by_name, lines, reason: r.reason }, ctx);
  }
  const now = nowIso();
  const ord = await db.prepare('SELECT order_no FROM orders WHERE id = ?').bind(r.order_id).first<{ order_no: string }>();
  const back = taskStatements(db, r.requested_by ? [r.requested_by] : [], {
    title:
      decision === 'APPROVED'
        ? `Yêu cầu sửa phiếu xuất đơn ${ord?.order_no ?? ''} đã được duyệt và sửa xong.`
        : `Yêu cầu sửa phiếu xuất đơn ${ord?.order_no ?? ''} bị từ chối: ${note}`,
    createdBy: auth.user.id,
    now,
    priority: 'NORMAL',
  });
  await db.batch([
    ...back,
    db
      .prepare("UPDATE ship_edit_requests SET status = ?, decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ? AND status = 'CHO_DUYET'")
      .bind(decision === 'APPROVED' ? 'DA_DUYET' : 'TU_CHOI', auth.user.id, now, note, requestId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: decision === 'APPROVED' ? 'SHIP_EDIT_APPROVED' : 'SHIP_EDIT_REJECTED',
      entityType: 'ORDER',
      entityId: r.order_id,
      reason: note,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
  return { ok: true };
}

export async function listShipEdits(db: D1Database, auth: AuthContext, status: string) {
  if (!canRequest(auth)) throw forbidden('Không có quyền xem yêu cầu sửa phiếu xuất.');
  const own = isShipApprover(auth) ? '' : 'AND r.requested_by = ?';
  const st = ['CHO_DUYET', 'DA_DUYET', 'TU_CHOI'].includes(status) ? status : 'CHO_DUYET';
  const q = db.prepare(
    `SELECT r.id, r.order_id, o.order_no, c.name AS customer_name, r.ship_day, r.shipped_by_name, r.lines_json, r.reason, r.status,
            r.requested_at, u.display_name AS requested_by_name, r.decided_at, d.display_name AS decided_by_name, r.decision_note
     FROM ship_edit_requests r JOIN orders o ON o.id = r.order_id JOIN customers c ON c.id = o.customer_id
     LEFT JOIN users u ON u.id = r.requested_by LEFT JOIN users d ON d.id = r.decided_by
     WHERE r.status = ? ${own} ORDER BY r.requested_at DESC LIMIT 100`,
  );
  const rows = await (own ? q.bind(st, auth.user.id) : q.bind(st)).all<Record<string, unknown>>();
  const items = rows.results ?? [];
  // Đính kèm số hiện tại của từng mã để người duyệt thấy "từ ... thành ...".
  const ids = [...new Set(items.map((x) => x.order_id as string))];
  const cur = new Map<string, Array<{ product_id: string; sku: string; name: string; qty: number }>>();
  for (const oid of ids) {
    const l = await db
      .prepare('SELECT oi.product_id, p.sku, p.name, SUM(oi.qty) AS qty FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? GROUP BY oi.product_id, p.sku, p.name')
      .bind(oid)
      .all<{ product_id: string; sku: string; name: string; qty: number }>();
    cur.set(oid, l.results ?? []);
  }
  return items.map((x) => ({
    ...x,
    lines: x.lines_json ? JSON.parse(x.lines_json as string) : null,
    lines_json: undefined,
    current: cur.get(x.order_id as string) ?? [],
  }));
}

import { nowIso, vnDate } from '@shared/datetime';
import type {
  ReturnConfirmInput,
  ReturnCreateInput,
  ReturnDetail,
  ReturnKhoReceiveInput,
  ReturnLineItem,
  ReturnListItem,
  ReturnStatus,
} from '@shared/returns';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { eventStatement } from '../lib/events';
import { badRequest, forbidden, notFound } from '../lib/http';
import { newId } from '../lib/ids';
import { seesAllOrders } from './orderFlow';
import { loadPriceRows } from './pricing';
import { loadCustomerPriceRows } from './customerPrices';
import { resolveEffectivePrice } from '@shared/pricing';

/** Giá bán theo cấp (hoặc bảng giá riêng) của khách tại một ngày, cho từng sản phẩm. */
async function customerPrices(db: D1Database, customerId: string, productIds: string[], onDate: string): Promise<Map<string, number>> {
  const c = await db.prepare('SELECT id, tier_id, price_mode FROM customers WHERE id = ?').bind(customerId).first<{ id: string; tier_id: string | null; price_mode: string | null }>();
  const out = new Map<string, number>();
  if (!c) return out;
  const custom = c.price_mode === 'CUSTOM';
  if (!custom && !c.tier_id) return out;
  const key = custom ? c.id : (c.tier_id as string);
  const rows = custom ? await loadCustomerPriceRows(db, c.id, productIds) : await loadPriceRows(db, productIds, key);
  const tierRows = custom && c.tier_id ? await loadPriceRows(db, productIds, c.tier_id) : [];
  for (const pid of productIds) {
    let a = resolveEffectivePrice(rows, pid, key, onDate).amount;
    if ((a === null || a === undefined) && custom && c.tier_id) a = resolveEffectivePrice(tierRows, pid, c.tier_id, onDate).amount;
    if (a !== null && a !== undefined) out.set(pid, a);
  }
  return out;
}

export { customerPrices };

export interface ReturnCtx {
  requestId: string;
  ip: string | null;
}

const isKho = (auth: AuthContext) => auth.permissions.includes('order.kho.process');
const canConfirm = (auth: AuthContext) => auth.permissions.includes('order.accounting.confirm');
const seesAll = (auth: AuthContext) => auth.user.role !== 'EMPLOYEE' || seesAllOrders(auth);

interface ReturnRow {
  id: string;
  return_no: string;
  customer_id: string;
  customer_name: string;
  owner_id: string | null;
  order_id: string | null;
  order_no: string | null;
  status: ReturnStatus;
  return_date: string;
  reason: string | null;
  note: string | null;
  claimed_amount: number;
  credit_amount: number;
  resolution: ReturnListItem['resolution'];
  no_collect: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  kho_by_name: string | null;
  kho_at: string | null;
  kho_note: string | null;
  acct_by_name: string | null;
  acct_at: string | null;
  acct_note: string | null;
}

const SELECT_RETURN = `
  SELECT r.id, r.return_no, r.customer_id, c.name AS customer_name, c.owner_id AS owner_id,
         r.order_id, o.order_no AS order_no, r.status, r.return_date, r.reason, r.note,
         r.claimed_amount, r.credit_amount, r.resolution, r.no_collect, r.created_by,
         cu.display_name AS created_by_name, r.created_at,
         ku.display_name AS kho_by_name, r.kho_at, r.kho_note,
         au.display_name AS acct_by_name, r.acct_at, r.acct_note
  FROM order_returns r
  JOIN customers c ON c.id = r.customer_id
  LEFT JOIN orders o ON o.id = r.order_id
  LEFT JOIN users cu ON cu.id = r.created_by
  LEFT JOIN users ku ON ku.id = r.kho_by
  LEFT JOIN users au ON au.id = r.acct_by`;

function toListItem(r: ReturnRow): ReturnListItem {
  return {
    id: r.id,
    return_no: r.return_no,
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    order_id: r.order_id,
    order_no: r.order_no,
    status: r.status,
    return_date: r.return_date,
    reason: r.reason,
    claimed_amount: r.claimed_amount,
    credit_amount: r.credit_amount,
    no_collect: r.no_collect,
    resolution: r.resolution,
    created_by_name: r.created_by_name,
    created_at: r.created_at,
  };
}

async function loadRow(db: D1Database, auth: AuthContext, id: string): Promise<ReturnRow> {
  const row = await db.prepare(`${SELECT_RETURN} WHERE r.id = ?`).bind(id).first<ReturnRow>();
  if (!row) throw notFound('Không tìm thấy phiếu trả hàng');
  if (!seesAll(auth) && row.owner_id !== auth.user.id && row.created_by !== auth.user.id) {
    throw notFound('Không tìm thấy phiếu trả hàng');
  }
  return row;
}

export async function listReturns(
  db: D1Database,
  auth: AuthContext,
  filters: { status?: string; customerId?: string; orderId?: string; q?: string; limit?: number },
): Promise<ReturnListItem[]> {
  const where: string[] = ['1=1'];
  const params: unknown[] = [];
  if (!seesAll(auth)) {
    where.push('(c.owner_id = ? OR r.created_by = ?)');
    params.push(auth.user.id, auth.user.id);
  }
  if (filters.status) {
    where.push('r.status = ?');
    params.push(filters.status);
  }
  if (filters.customerId) {
    where.push('r.customer_id = ?');
    params.push(filters.customerId);
  }
  if (filters.orderId) {
    where.push('r.order_id = ?');
    params.push(filters.orderId);
  }
  if (filters.q) {
    where.push('(r.return_no LIKE ? OR c.name LIKE ? OR o.order_no LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  const rows = await db
    .prepare(`${SELECT_RETURN} WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT ?`)
    .bind(...params, Math.min(Math.max(filters.limit ?? 100, 1), 500))
    .all<ReturnRow>();
  return (rows.results ?? []).map(toListItem);
}

export async function getReturn(db: D1Database, auth: AuthContext, id: string): Promise<ReturnDetail> {
  const row = await loadRow(db, auth, id);
  const items = await db
    .prepare(
      `SELECT l.id, l.product_id, p.sku, p.name AS product_name, p.unit, l.qty, l.unit_price, l.deduction,
              l.received_qty, l.condition, l.line_note
       FROM order_return_lines l JOIN products p ON p.id = l.product_id
       WHERE l.return_id = ? ORDER BY l.rowid`,
    )
    .bind(id)
    .all<ReturnLineItem>();
  const log = await db
    .prepare(
      `SELECT g.at, u.display_name AS actor_name, g.action, g.note
       FROM order_return_log g LEFT JOIN users u ON u.id = g.actor_id
       WHERE g.return_id = ? ORDER BY g.id`,
    )
    .bind(id)
    .all<ReturnDetail['log'][number]>();
  return {
    ...toListItem(row),
    note: row.note,
    kho_by_name: row.kho_by_name,
    kho_at: row.kho_at,
    kho_note: row.kho_note,
    acct_by_name: row.acct_by_name,
    acct_at: row.acct_at,
    acct_note: row.acct_note,
    items: items.results ?? [],
    log: log.results ?? [],
  };
}

function logStmt(db: D1Database, id: string, auth: AuthContext, action: string, note: string | null, at: string) {
  return db
    .prepare('INSERT INTO order_return_log (return_id, at, actor_id, action, note) VALUES (?, ?, ?, ?, ?)')
    .bind(id, at, auth.user.id, action, note);
}

function returnEvent(db: D1Database, auth: AuthContext, type: string, id: string, payload: unknown) {
  return eventStatement(db, {
    type,
    entityType: 'RETURN',
    entityId: id,
    actorId: auth.user.id,
    actorType: auth.actorType ?? 'USER',
    payload,
  });
}

export async function createReturn(
  db: D1Database,
  auth: AuthContext,
  input: ReturnCreateInput,
  ctx: ReturnCtx,
): Promise<ReturnDetail> {
  if (!auth.permissions.includes('order.create') && !auth.permissions.includes('order.create.team') && !isKho(auth)) {
    throw forbidden('Bạn không có quyền tạo phiếu trả hàng.');
  }
  const customer = await db
    .prepare('SELECT id, owner_id FROM customers WHERE id = ? AND deleted_at IS NULL')
    .bind(input.customer_id)
    .first<{ id: string; owner_id: string | null }>();
  if (!customer || (!seesAll(auth) && customer.owner_id !== auth.user.id)) {
    throw notFound('Không tìm thấy khách hàng');
  }

  // Đơn gốc (nếu có) phải của đúng khách; lấy giá bán và số lượng đã mua để chặn trả quá.
  const bought = new Map<string, { qty: number; price: number; gift: number }>();
  // Số hàng tặng trong đơn gốc, và số đã trả trước đó của từng mã: hàng tặng trả lại không được hoàn tiền.
  const returnedBefore = new Map<string, number>();
  if (input.order_id) {
    const order = await db
      .prepare('SELECT id FROM orders WHERE id = ? AND customer_id = ? AND deleted_at IS NULL')
      .bind(input.order_id, input.customer_id)
      .first<{ id: string }>();
    if (!order) throw badRequest('ORDER_NOT_OF_CUSTOMER', 'Đơn gốc không thuộc khách này.');
    const oi = await db
      .prepare(
        `SELECT product_id, SUM(qty) AS qty, MAX(applied_price) AS price,
                SUM(CASE WHEN is_gift = 1 THEN qty ELSE gift_qty END) AS gift
         FROM order_items WHERE order_id = ? GROUP BY product_id`,
      )
      .bind(input.order_id)
      .all<{ product_id: string; qty: number; price: number; gift: number }>();
    for (const r of oi.results ?? []) bought.set(r.product_id, { qty: r.qty, price: r.price, gift: r.gift ?? 0 });
    const already = await db
      .prepare(
        `SELECT l.product_id, SUM(l.qty) AS qty FROM order_return_lines l
         JOIN order_returns r ON r.id = l.return_id
         WHERE r.order_id = ? AND r.status <> 'HUY' GROUP BY l.product_id`,
      )
      .bind(input.order_id)
      .all<{ product_id: string; qty: number }>();
    const returned = new Map((already.results ?? []).map((r) => [r.product_id, r.qty]));
    for (const [k, v] of returned) returnedBefore.set(k, v);
    for (const it of input.items) {
      const b = bought.get(it.product_id);
      if (!b) throw badRequest('ITEM_NOT_IN_ORDER', 'Có mặt hàng không nằm trong đơn gốc đã chọn.');
      if ((returned.get(it.product_id) ?? 0) + it.qty > b.qty) {
        throw badRequest('RETURN_EXCEEDS_ORDER', 'Số lượng trả vượt quá số đã mua trong đơn gốc (kể cả các phiếu trả trước).');
      }
    }
  }

  const productIds = [...new Set(input.items.map((i) => i.product_id))];
  const found = await db
    .prepare(`SELECT id FROM products WHERE id IN (${productIds.map(() => '?').join(',')}) AND deleted_at IS NULL`)
    .bind(...productIds)
    .all<{ id: string }>();
  if ((found.results ?? []).length !== productIds.length) {
    throw badRequest('PRODUCT_NOT_FOUND', 'Có sản phẩm không tồn tại.');
  }

  const id = newId();
  const now = nowIso();
  const date = input.return_date ?? vnDate();
  const month = date.slice(0, 7).replace('-', '');
  const seq = await db
    .prepare("SELECT COUNT(*) AS n FROM order_returns WHERE return_no LIKE ?")
    .bind(`TH${month}-%`)
    .first<{ n: number }>();
  const returnNo = `TH${month}-${String((seq?.n ?? 0) + 1).padStart(4, '0')}`;

  // Không chọn đơn gốc và không ghi giá: lấy giá theo cấp (hoặc bảng giá riêng) của khách.
  const tierPrice = input.items.some((it) => it.unit_price === undefined && !bought.has(it.product_id))
    ? await customerPrices(db, input.customer_id, input.items.map((it) => it.product_id), date)
    : new Map<string, number>();
  const noCollect = input.no_collect === true;
  if (noCollect && input.reason.trim().length < 10) {
    throw badRequest('REASON_TOO_SHORT', 'Hàng lỗi không thu về: ghi rõ lý do (hàng gì lỗi, vì sao không gửi trả) để kế toán đối chiếu.');
  }
  let claimed = 0;
  const lineStatements: D1PreparedStatement[] = [];
  // Mã có hàng tặng trong đơn gốc: trả phần hàng bán trước (tính tiền), phần vượt quá là hàng tặng (đơn giá 0, không hoàn tiền).
  const used = new Map<string, number>();
  const expanded: typeof input.items = [];
  for (const it of input.items) {
    const b = bought.get(it.product_id);
    if (!b || b.gift <= 0) {
      expanded.push(it);
      continue;
    }
    const paidCap = Math.max(0, b.qty - b.gift);
    const soFar = (returnedBefore.get(it.product_id) ?? 0) + (used.get(it.product_id) ?? 0);
    const paidQty = Math.min(it.qty, Math.max(0, paidCap - soFar));
    const giftQty = it.qty - paidQty;
    used.set(it.product_id, (used.get(it.product_id) ?? 0) + it.qty);
    if (paidQty > 0) expanded.push({ ...it, qty: paidQty });
    if (giftQty > 0) expanded.push({ ...it, qty: giftQty, unit_price: 0, deduction: 0, line_note: it.line_note ?? 'Hàng tặng, không hoàn tiền' });
  }
  for (const it of expanded) {
    const price = it.unit_price ?? bought.get(it.product_id)?.price ?? tierPrice.get(it.product_id) ?? 0;
    const deduction = it.deduction ?? 0;
    claimed += Math.max(0, Math.round(price * it.qty) - deduction);
    lineStatements.push(
      db
        .prepare(
          `INSERT INTO order_return_lines (id, return_id, product_id, qty, unit_price, deduction, line_note, received_qty, condition)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(newId(), id, it.product_id, it.qty, price, deduction, it.line_note ?? null, noCollect ? it.qty : null, noCollect ? 'HONG' : null),
    );
  }

  await db.batch([
    db
      .prepare(
        `INSERT INTO order_returns (id, return_no, customer_id, order_id, status, return_date, reason, note,
           claimed_amount, created_by, created_at, updated_at, no_collect, credit_amount, kho_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        returnNo,
        input.customer_id,
        input.order_id ?? null,
        noCollect ? 'DA_NHAN_KHO' : 'CHO_KHO',
        date,
        input.reason,
        input.note ?? null,
        claimed,
        auth.user.id,
        now,
        now,
        noCollect ? 1 : 0,
        noCollect ? claimed : 0,
        noCollect ? 'Hàng lỗi, không thu về (không qua kho), bù cho khách' : null,
      ),
    ...lineStatements,
    logStmt(db, id, auth, noCollect ? 'TAO_PHIEU_KHONG_THU_VE' : 'TAO_PHIEU', input.reason, now),
    returnEvent(db, auth, 'RETURN_CREATED', id, { return_no: returnNo, customer_id: input.customer_id, claimed_amount: claimed }),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'RETURN_CREATED',
      entityType: 'RETURN',
      entityId: id,
      after: { return_no: returnNo, claimed_amount: claimed, lines: input.items.length },
      requestId: ctx.requestId,
      ip: ctx.ip,
      actorType: auth.actorType ?? 'USER',
    }),
  ]);
  return getReturn(db, auth, id);
}

/** Kho xác nhận đã nhận hàng: ghi số thực nhận và tình trạng từng dòng. */
export async function khoReceiveReturn(
  db: D1Database,
  auth: AuthContext,
  id: string,
  input: ReturnKhoReceiveInput,
  ctx: ReturnCtx,
): Promise<ReturnDetail> {
  if (!isKho(auth)) throw forbidden('Chỉ kế toán kho mới xác nhận nhận hàng trả.');
  const row = await loadRow(db, auth, id);
  if (row.status !== 'CHO_KHO') {
    throw badRequest('BAD_RETURN_STEP', 'Phiếu này không còn ở bước chờ kho nhận hàng. Tải lại trang để xem.');
  }
  const lines = await db
    .prepare('SELECT id, qty, unit_price, deduction FROM order_return_lines WHERE return_id = ?')
    .bind(id)
    .all<{ id: string; qty: number; unit_price: number; deduction: number }>();
  const byId = new Map((lines.results ?? []).map((l) => [l.id, l]));
  const seen = new Set<string>();
  for (const l of input.lines) {
    if (!byId.has(l.line_id)) throw badRequest('LINE_NOT_FOUND', 'Có dòng không thuộc phiếu này.');
    seen.add(l.line_id);
  }
  if (seen.size !== byId.size) throw badRequest('LINES_INCOMPLETE', 'Cần ghi số thực nhận cho tất cả các dòng (không nhận được thì ghi 0).');

  const now = nowIso();
  let credit = 0;
  const stmts: D1PreparedStatement[] = [];
  for (const l of input.lines) {
    const src = byId.get(l.line_id)!;
    if (l.received_qty > src.qty) {
      throw badRequest('RECEIVED_EXCEEDS', 'Số thực nhận không được lớn hơn số khách báo trả.');
    }
    credit += Math.max(0, Math.round(l.received_qty * src.unit_price) - (l.received_qty > 0 ? src.deduction : 0));
    stmts.push(
      db
        .prepare('UPDATE order_return_lines SET received_qty = ?, condition = ? WHERE id = ?')
        .bind(l.received_qty, l.condition, l.line_id),
    );
  }
  stmts.push(
    db
      .prepare(
        `UPDATE order_returns SET status = 'DA_NHAN_KHO', credit_amount = ?, kho_by = ?, kho_at = ?, kho_note = ?, updated_at = ?
         WHERE id = ? AND status = 'CHO_KHO'`,
      )
      .bind(credit, auth.user.id, now, input.note ?? null, now, id),
    logStmt(db, id, auth, 'KHO_NHAN_HANG', input.note ?? null, now),
    returnEvent(db, auth, 'RETURN_RECEIVED', id, { return_no: row.return_no, credit_amount: credit }),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'RETURN_RECEIVED',
      entityType: 'RETURN',
      entityId: id,
      before: { status: row.status },
      after: { status: 'DA_NHAN_KHO', credit_amount: credit },
      requestId: ctx.requestId,
      ip: ctx.ip,
      actorType: auth.actorType ?? 'USER',
    }),
  );
  await db.batch(stmts);
  return getReturn(db, auth, id);
}

/** Kế toán xác nhận giảm công nợ cho khách theo số kho thực nhận. */
export async function confirmReturn(
  db: D1Database,
  auth: AuthContext,
  id: string,
  input: ReturnConfirmInput,
  ctx: ReturnCtx,
): Promise<ReturnDetail> {
  if (!canConfirm(auth)) throw forbidden('Chỉ kế toán mới xác nhận giảm công nợ.');
  const row = await loadRow(db, auth, id);
  if (row.status !== 'DA_NHAN_KHO') {
    throw badRequest('BAD_RETURN_STEP', 'Phiếu này chưa được kho nhận hàng hoặc đã xử lý rồi.');
  }
  const now = nowIso();
  // Kế toán chỉnh đơn giá / khấu trừ rồi chốt: tính lại số giảm nợ theo số kho thực nhận.
  const edits: D1PreparedStatement[] = [];
  if (input.lines && input.lines.length) {
    const cur = (
      await db
        .prepare('SELECT id, received_qty, unit_price, deduction FROM order_return_lines WHERE return_id = ?')
        .bind(id)
        .all<{ id: string; received_qty: number | null; unit_price: number; deduction: number }>()
    ).results ?? [];
    const patch = new Map(input.lines.map((l) => [l.line_id, l]));
    for (const l of input.lines) if (!cur.some((c) => c.id === l.line_id)) throw badRequest('LINE_NOT_FOUND', 'Có dòng không thuộc phiếu này.');
    let credit = 0;
    for (const c of cur) {
      const p = patch.get(c.id);
      const price = p ? p.unit_price : c.unit_price;
      const ded = p ? p.deduction : c.deduction;
      const q = c.received_qty ?? 0;
      credit += Math.max(0, Math.round(q * price) - (q > 0 ? ded : 0));
      if (p) edits.push(db.prepare('UPDATE order_return_lines SET unit_price = ?, deduction = ? WHERE id = ?').bind(price, ded, c.id));
    }
    edits.push(db.prepare('UPDATE order_returns SET credit_amount = ? WHERE id = ?').bind(credit, id));
    row.credit_amount = credit;
  }
  await db.batch([
    ...edits,
    db
      .prepare(
        `UPDATE order_returns SET status = 'DA_GIAM_NO', resolution = ?, acct_by = ?, acct_at = ?, acct_note = ?, updated_at = ?
         WHERE id = ? AND status = 'DA_NHAN_KHO'`,
      )
      .bind(input.resolution, auth.user.id, now, input.note ?? null, now, id),
    logStmt(db, id, auth, 'KE_TOAN_XAC_NHAN', `${input.resolution}${input.note ? ': ' + input.note : ''}`, now),
    returnEvent(db, auth, 'RETURN_CREDITED', id, {
      return_no: row.return_no,
      customer_id: row.customer_id,
      credit_amount: row.credit_amount,
      resolution: input.resolution,
    }),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'RETURN_CREDITED',
      entityType: 'RETURN',
      entityId: id,
      before: { status: row.status },
      after: { status: 'DA_GIAM_NO', credit_amount: row.credit_amount, resolution: input.resolution },
      requestId: ctx.requestId,
      ip: ctx.ip,
      actorType: auth.actorType ?? 'USER',
    }),
  ]);
  return getReturn(db, auth, id);
}

/** Huỷ phiếu: người tạo hoặc quản lý/kế toán, khi chưa giảm công nợ. */
export async function cancelReturn(
  db: D1Database,
  auth: AuthContext,
  id: string,
  reason: string | null,
  ctx: ReturnCtx,
): Promise<ReturnDetail> {
  const row = await loadRow(db, auth, id);
  if (row.status === 'DA_GIAM_NO' || row.status === 'HUY') {
    throw badRequest('BAD_RETURN_STEP', 'Phiếu đã giảm công nợ hoặc đã huỷ, không huỷ được nữa.');
  }
  const privileged = auth.user.role !== 'EMPLOYEE' || canConfirm(auth) || isKho(auth);
  if (!privileged && row.created_by !== auth.user.id) throw forbidden('Chỉ người tạo phiếu hoặc quản lý mới huỷ được.');
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE order_returns SET status = 'HUY', cancelled_by = ?, cancelled_at = ?, updated_at = ?
         WHERE id = ? AND status IN ('CHO_KHO', 'DA_NHAN_KHO')`,
      )
      .bind(auth.user.id, now, now, id),
    logStmt(db, id, auth, 'HUY_PHIEU', reason, now),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'RETURN_CANCELLED',
      entityType: 'RETURN',
      entityId: id,
      before: { status: row.status },
      after: { status: 'HUY' },
      reason,
      requestId: ctx.requestId,
      ip: ctx.ip,
      actorType: auth.actorType ?? 'USER',
    }),
  ]);
  return getReturn(db, auth, id);
}

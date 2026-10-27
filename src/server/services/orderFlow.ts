import { nowIso, shipDayToIso, vnDate } from '@shared/datetime';
import { KHO_WAITING, type KhoCheckLine, type KhoStatus } from '@shared/flow';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { eventStatement } from '../lib/events';
import { badRequest, forbidden, notFound, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { derivePaymentStatus } from '@shared/orders';
import { RECEIVED_BY_ORDER } from '../lib/sql';
import { decideApproval } from './approvals';

/**
 * Luồng đơn B2B qua kho:
 *   Sale gửi → Quản lý điều phối chuyển kho → Kế toán kho kiểm tồn (đủ/thiếu)
 *   → [thiếu: sale báo khách, sửa đơn, gửi lại | hoặc giữ chờ hàng]
 *   → Quản lý duyệt + lịch xuất (kho giữ hàng) → Kế toán kho xuất (ghi số thực xuất)
 *   → Quản lý xác nhận đã xuất → Sale (hoặc quản lý) đối chiếu, sửa đơn, chốt tiền
 *   → Kế toán xác nhận ghi nợ.
 *
 * Mọi bước đổi trạng thái đều ghi vào order_flow_log ("ai báo ai").
 */

export interface FlowCtx {
  requestId: string;
  ip: string | null;
}

interface FlowOrder {
  id: string;
  order_no: string;
  customer_id: string;
  owner_id: string | null;
  approval_status: string;
  delivery_status: string;
  accounting_status: string;
  kho_status: KhoStatus;
  flow_on: number;
  total_amount: number;
  ship_date: string | null;
  need_date: string | null;
  hold_until: string | null;
}

const isApprover = (auth: AuthContext) => auth.permissions.includes('order.approve.normal');
const isKho = (auth: AuthContext) => auth.permissions.includes('order.kho.process');

/** Ai thấy được đơn của người khác: quản lý/CEO/kế toán và kế toán kho. Sale chỉ thấy đơn của mình. */
export function seesAllOrders(auth: AuthContext): boolean {
  return auth.scope !== 'OWN' || isKho(auth);
}

async function loadFlowOrder(db: D1Database, auth: AuthContext, orderId: string): Promise<FlowOrder> {
  const o = await db
    .prepare(
      `SELECT id, order_no, customer_id, owner_id, approval_status, delivery_status, accounting_status,
              kho_status, flow_on, total_amount, ship_date, need_date, hold_until
       FROM orders WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(orderId)
    .first<FlowOrder>();
  if (!o) throw notFound('Không tìm thấy đơn hàng');
  if (!seesAllOrders(auth) && o.owner_id !== auth.user.id) throw notFound('Không tìm thấy đơn hàng');
  if (o.approval_status === 'CANCELLED') throw badRequest('ORDER_CANCELLED', 'Đơn đã huỷ.');
  if (!o.flow_on) {
    throw badRequest(
      'NO_FLOW',
      'Đơn này tạo trước khi có luồng kho nên đi theo cách cũ (duyệt, xuất kho, giao). Đơn mới tạo sau này mới đi theo luồng kho.',
    );
  }
  return o;
}

function requireStatus(o: FlowOrder, allowed: KhoStatus[], doing: string) {
  if (!allowed.includes(o.kho_status)) {
    throw badRequest(
      'BAD_FLOW_STEP',
      `Không ${doing} được vào lúc này: đơn đang ở bước "${o.kho_status}". Tải lại trang để xem bước hiện tại.`,
    );
  }
}

function stepEvent(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  from: string,
  to: string,
  action: string,
): D1PreparedStatement {
  return eventStatement(db, {
    type: 'ORDER_STEP_CHANGED',
    entityType: 'ORDER',
    entityId: orderId,
    actorId: auth.user.id,
    actorType: auth.actorType ?? 'USER',
    payload: { from, to, action, waiting_for: KHO_WAITING[to as KhoStatus] ?? null },
  });
}

function logStmt(
  db: D1Database,
  orderId: string,
  auth: AuthContext,
  action: string,
  from: string | null,
  to: string | null,
  note: string | null,
  at: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO order_flow_log (order_id, at, actor_id, action, from_status, to_status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(orderId, at, auth.user.id, action, from, to, note);
}

/** Ghi bước đầu tiên khi sale gửi đơn (dùng trong submitOrder). */
export function firstSendStatements(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  from: string,
  now: string,
): D1PreparedStatement[] {
  // Người gửi vốn là quản lý điều phối (khách do chính họ phụ trách) thì bỏ bước "báo điều phối".
  const next: KhoStatus = isApprover(auth) ? 'CHO_KIEM_KHO' : 'CHO_DIEU_PHOI';
  return [
    db
      .prepare('UPDATE orders SET kho_status = ?, kho_note = NULL, updated_at = ? WHERE id = ?')
      .bind(next, now, orderId),
    logStmt(db, orderId, auth, 'GUI_DON', from, next, null, now),
    stepEvent(db, auth, orderId, from, next, 'GUI_DON'),
  ];
}

async function applyTransition(
  db: D1Database,
  auth: AuthContext,
  o: FlowOrder,
  to: KhoStatus,
  action: string,
  note: string | null,
  setSql: string,
  setParams: unknown[],
  extra: D1PreparedStatement[] = [],
  ctx?: FlowCtx,
): Promise<void> {
  const now = nowIso();
  await db.batch([
    db
      .prepare(`UPDATE orders SET kho_status = ?, ${setSql ? setSql + ',' : ''} updated_at = ? WHERE id = ?`)
      .bind(to, ...setParams, now, o.id),
    ...extra,
    logStmt(db, o.id, auth, action, o.kho_status, to, note, now),
    stepEvent(db, auth, o.id, o.kho_status, to, action),
    auditStatement(db, {
      actorId: auth.user.id,
      action: `ORDER_FLOW_${action}`,
      entityType: 'ORDER',
      entityId: o.id,
      before: { kho_status: o.kho_status },
      after: { kho_status: to },
      reason: note,
      requestId: ctx?.requestId,
      ip: ctx?.ip,
    }),
  ]);
}

/** Sale báo lại sau khi kho báo thiếu và đã sửa đơn (hoặc khách chịu chờ xong, gửi kiểm lại). */
export async function flowSend(db: D1Database, auth: AuthContext, orderId: string, note: string | null, ctx: FlowCtx) {
  const o = await loadFlowOrder(db, auth, orderId);
  if (o.owner_id !== auth.user.id && !isApprover(auth)) throw forbidden('Chỉ sale phụ trách đơn hoặc quản lý mới gửi lại được.');
  requireStatus(o, ['THIEU_HANG', 'CHO_HANG'], 'gửi lại đơn');
  const to: KhoStatus = isApprover(auth) ? 'CHO_KIEM_KHO' : 'CHO_DIEU_PHOI';
  await applyTransition(db, auth, o, to, 'GUI_LAI', note, 'hold_until = NULL', [], [], ctx);
  return { kho_status: to };
}

/** Quản lý điều phối chuyển đơn xuống kế toán kho kiểm tồn và sắp lịch sản xuất. */
export async function flowToKho(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  input: { need_date?: string | null; note?: string | null },
  ctx: FlowCtx,
) {
  if (!isApprover(auth)) throw forbidden('Chỉ quản lý điều phối được chuyển đơn xuống kho.');
  const o = await loadFlowOrder(db, auth, orderId);
  requireStatus(o, ['CHO_DIEU_PHOI', 'CHO_HANG'], 'chuyển đơn xuống kho');
  await applyTransition(
    db,
    auth,
    o,
    'CHO_KIEM_KHO',
    'CHUYEN_KHO',
    input.note ?? null,
    'need_date = ?, kho_note = ?, hold_until = NULL',
    [input.need_date ?? o.need_date, input.note ?? null],
    [],
    ctx,
  );
  return { kho_status: 'CHO_KIEM_KHO' as KhoStatus };
}

interface KhoItemRow {
  code: string;
  name: string;
  unit: string;
  cls: string;
}

/** Kiểm tồn từng dòng của đơn: tồn thành phẩm, hàng đã giữ cho đơn khác, khả năng sản xuất theo định mức. */
export async function khoCheck(db: D1Database, auth: AuthContext, orderId: string): Promise<{
  lines: KhoCheckLine[];
  stock_ready: boolean;
}> {
  const o = await db
    .prepare('SELECT id, owner_id, flow_on FROM orders WHERE id = ? AND deleted_at IS NULL')
    .bind(orderId)
    .first<{ id: string; owner_id: string | null; flow_on: number }>();
  if (!o) throw notFound('Không tìm thấy đơn hàng');
  if (!seesAllOrders(auth) && o.owner_id !== auth.user.id) throw notFound('Không tìm thấy đơn hàng');

  const items = (
    await db
      .prepare(
        `SELECT oi.product_id, p.sku, p.name, oi.qty
         FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ? AND oi.is_gift IN (0, 1) ORDER BY oi.created_at`,
      )
      .bind(orderId)
      .all<{ product_id: string; sku: string; name: string; qty: number }>()
  ).results ?? [];

  const skus = items.map((i) => i.sku);
  const maps = new Map<string, { misa_code: string; factor: number }>();
  if (skus.length) {
    const rows = await db
      .prepare(`SELECT crm_sku, misa_code, factor FROM kho_map WHERE crm_sku IN (${skus.map(() => '?').join(',')})`)
      .bind(...skus)
      .all<{ crm_sku: string; misa_code: string; factor: number }>();
    for (const r of rows.results ?? []) maps.set(r.crm_sku, r);
  }
  const codes = [...new Set([...maps.values()].map((m) => m.misa_code))];

  // BOM tầng 1 (vỏ, tem, BTP...) và tầng 2 (NVL của BTP).
  const bom1 = new Map<string, Array<{ item: string; qty: number }>>();
  if (codes.length) {
    const rows = await db
      .prepare(`SELECT product, item, qty FROM kho_bom WHERE product IN (${codes.map(() => '?').join(',')})`)
      .bind(...codes)
      .all<{ product: string; item: string; qty: number }>();
    for (const r of rows.results ?? []) {
      const list = bom1.get(r.product) ?? [];
      list.push({ item: r.item, qty: r.qty });
      bom1.set(r.product, list);
    }
  }
  const comp1 = [...new Set([...bom1.values()].flat().map((r) => r.item))];
  const bom2 = new Map<string, Array<{ item: string; qty: number }>>();
  if (comp1.length) {
    const rows = await db
      .prepare(`SELECT product, item, qty FROM kho_bom WHERE product IN (${comp1.map(() => '?').join(',')})`)
      .bind(...comp1)
      .all<{ product: string; item: string; qty: number }>();
    for (const r of rows.results ?? []) {
      const list = bom2.get(r.product) ?? [];
      list.push({ item: r.item, qty: r.qty });
      bom2.set(r.product, list);
    }
  }
  const comp2 = [...new Set([...bom2.values()].flat().map((r) => r.item))];
  const allCodes = [...new Set([...codes, ...comp1, ...comp2])];

  const stock = new Map<string, number>();
  const meta = new Map<string, KhoItemRow>();
  const reserved = new Map<string, number>();
  for (let i = 0; i < allCodes.length; i += 80) {
    const part = allCodes.slice(i, i + 80);
    const ph = part.map(() => '?').join(',');
    const s = await db
      .prepare(`SELECT item, SUM(qty) AS s FROM kho_ledger WHERE item IN (${ph}) GROUP BY item`)
      .bind(...part)
      .all<{ item: string; s: number }>();
    for (const r of s.results ?? []) stock.set(r.item, r.s);
    const m = await db
      .prepare(`SELECT code, name, unit, cls FROM kho_items WHERE code IN (${ph})`)
      .bind(...part)
      .all<KhoItemRow>();
    for (const r of m.results ?? []) meta.set(r.code, r);
    const rs = await db
      .prepare(
        `SELECT km.misa_code AS item, SUM(oi.qty * km.factor) AS r
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id
         JOIN kho_map km ON km.crm_sku = p.sku
         WHERE o.flow_on = 1 AND o.kho_status = 'CHO_XUAT' AND o.approval_status = 'APPROVED'
           AND o.delivery_status = 'CHUA_XUAT' AND o.deleted_at IS NULL AND o.id <> ?
           AND km.misa_code IN (${ph})
         GROUP BY km.misa_code`,
      )
      .bind(orderId, ...part)
      .all<{ item: string; r: number }>();
    for (const r of rs.results ?? []) reserved.set(r.item, r.r);
  }

  const reports = new Map<
    string,
    { status: 'DU' | 'THIEU'; ok_qty: number | null; eta_date: string | null; note: string | null; shipped_qty: number | null }
  >();
  const rr = await db
    .prepare('SELECT product_id, status, ok_qty, eta_date, note, shipped_qty FROM order_kho_lines WHERE order_id = ?')
    .bind(orderId)
    .all<{ product_id: string; status: 'DU' | 'THIEU'; ok_qty: number | null; eta_date: string | null; note: string | null; shipped_qty: number | null }>();
  for (const r of rr.results ?? []) reports.set(r.product_id, r);

  const cfg = await db.prepare("SELECT v FROM kho_cfg WHERE k = 'b2b_from'").first<{ v: string }>();

  const round = (n: number) => Math.round(n * 1000) / 1000;
  const remaining = new Map<string, number>();
  const out: KhoCheckLine[] = [];

  for (const it of items) {
    const map = maps.get(it.sku) ?? null;
    const rep = reports.get(it.product_id) ?? null;
    const base: KhoCheckLine = {
      product_id: it.product_id,
      sku: it.sku,
      name: it.name,
      qty: it.qty,
      misa_code: map?.misa_code ?? null,
      misa_name: map ? (meta.get(map.misa_code)?.name ?? null) : null,
      factor: map?.factor ?? 1,
      need_kho: map ? round(it.qty * map.factor) : it.qty,
      stock: 0,
      reserved: 0,
      available: 0,
      short: 0,
      can_make: null,
      missing_components: [],
      report: rep ? { status: rep.status, ok_qty: rep.ok_qty, eta_date: rep.eta_date, note: rep.note } : null,
      shipped_qty: rep?.shipped_qty ?? null,
    };
    if (!map) {
      out.push(base);
      continue;
    }
    const code = map.misa_code;
    const st = stock.get(code) ?? 0;
    const rsv = reserved.get(code) ?? 0;
    const left = remaining.has(code) ? (remaining.get(code) as number) : st - rsv;
    const avail = Math.max(0, left);
    const need = base.need_kho;
    const short = Math.max(0, round(need - avail));
    remaining.set(code, left - need);
    base.stock = round(st);
    base.reserved = round(rsv);
    base.available = round(avail);
    base.short = short;

    if (short > 0) {
      const comps = bom1.get(code) ?? [];
      if (comps.length) {
        let canMake = Infinity;
        for (const c of comps) {
          let have = Math.max(0, stock.get(c.item) ?? 0);
          // Bán thành phẩm thiếu thì tính thêm lượng làm được từ nguyên vật liệu.
          const sub = bom2.get(c.item);
          if (sub?.length && meta.get(c.item)?.cls === 'BTP') {
            let btpMake = Infinity;
            for (const s of sub) {
              btpMake = Math.min(btpMake, Math.max(0, stock.get(s.item) ?? 0) / (s.qty || 1));
            }
            if (Number.isFinite(btpMake)) have += btpMake;
          }
          const per = c.qty || 1;
          canMake = Math.min(canMake, have / per);
          const needC = round(c.qty * short);
          if (have + 1e-9 < needC) {
            const m = meta.get(c.item);
            base.missing_components.push({
              code: c.item,
              name: m?.name ?? c.item,
              unit: m?.unit ?? '',
              need: needC,
              have: round(have),
            });
          }
        }
        base.can_make = Number.isFinite(canMake) ? Math.floor(canMake + 1e-9) : null;
      }
    }
    out.push(base);
  }
  return { lines: out, stock_ready: Boolean(cfg?.v) && cfg!.v <= vnDate() };
}

export interface KhoReportInput {
  lines: Array<{
    product_id: string;
    status: 'DU' | 'THIEU';
    ok_qty?: number | null;
    eta_date?: string | null;
    note?: string | null;
  }>;
  note?: string | null;
}

/** Kế toán kho báo kết quả kiểm tồn: từng dòng đủ hay thiếu. */
export async function flowKhoReport(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  input: KhoReportInput,
  ctx: FlowCtx,
) {
  if (!isKho(auth)) throw forbidden('Chỉ kế toán kho được báo kết quả kiểm tồn.');
  const o = await loadFlowOrder(db, auth, orderId);
  requireStatus(o, ['CHO_KIEM_KHO'], 'báo kết quả kiểm kho');

  const items = (
    await db
      .prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?')
      .bind(orderId)
      .all<{ product_id: string; qty: number }>()
  ).results ?? [];
  const byProduct = new Map(input.lines.map((l) => [l.product_id, l]));
  const now = nowIso();
  const statements: D1PreparedStatement[] = [];
  let anyShort = false;

  for (const it of items) {
    const l = byProduct.get(it.product_id);
    if (!l) throw unprocessable('MISSING_LINE', 'Cần báo đủ hay thiếu cho TẤT CẢ các dòng của đơn.', { lines: 'Thiếu một dòng hàng' });
    const short = l.status === 'THIEU';
    if (short) anyShort = true;
    let ok = it.qty;
    if (short) {
      ok = Math.max(0, Math.min(it.qty - 1, Math.floor(Number(l.ok_qty ?? 0))));
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO order_kho_lines (id, order_id, product_id, status, ok_qty, eta_date, note, checked_by, checked_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (order_id, product_id) DO UPDATE SET status = excluded.status, ok_qty = excluded.ok_qty,
             eta_date = excluded.eta_date, note = excluded.note, checked_by = excluded.checked_by,
             checked_at = excluded.checked_at`,
        )
        .bind(newId(), orderId, it.product_id, l.status, ok, short ? (l.eta_date ?? null) : null, l.note ?? null, auth.user.id, now),
    );
  }
  // Dòng không còn trong đơn thì bỏ kết quả kiểm cũ.
  statements.push(
    db
      .prepare(
        `DELETE FROM order_kho_lines WHERE order_id = ? AND shipped_qty IS NULL
         AND product_id NOT IN (SELECT product_id FROM order_items WHERE order_id = ?)`,
      )
      .bind(orderId, orderId),
  );

  // Đơn đã duyệt sẵn (người lập có quyền duyệt): kho báo đủ là đi thẳng sang chờ xuất, hẹn xuất theo ngày khách cần.
  const preApproved = o.approval_status === 'APPROVED';
  const to: KhoStatus = anyShort ? 'THIEU_HANG' : preApproved ? 'CHO_XUAT' : 'DU_HANG';
  await db.batch(statements);
  await applyTransition(
    db,
    auth,
    o,
    to,
    anyShort ? 'KHO_BAO_THIEU' : 'KHO_BAO_DU',
    input.note ?? null,
    preApproved && !anyShort ? 'kho_note = ?, ship_date = COALESCE(ship_date, need_date)' : 'kho_note = ?',
    [input.note ?? null],
    [],
    ctx,
  );
  return { kho_status: to };
}

/** Khách chịu chờ sản xuất: quản lý giữ đơn tới ngày hàng về, tới ngày đơn tự quay lại hàng chờ kiểm kho. */
export async function flowHold(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  input: { hold_until: string; note?: string | null },
  ctx: FlowCtx,
) {
  if (!isApprover(auth)) throw forbidden('Chỉ quản lý điều phối được giữ chờ hàng.');
  const o = await loadFlowOrder(db, auth, orderId);
  requireStatus(o, ['THIEU_HANG'], 'giữ chờ hàng');
  if (input.hold_until < vnDate()) throw unprocessable('BAD_DATE', 'Ngày hàng về phải từ hôm nay trở đi.', { hold_until: 'Ngày không hợp lệ' });
  await applyTransition(db, auth, o, 'CHO_HANG', 'GIU_CHO_HANG', input.note ?? null, 'hold_until = ?', [input.hold_until], [], ctx);
  return { kho_status: 'CHO_HANG' as KhoStatus };
}

/** Tới ngày hàng về thì đơn giữ chờ tự quay lại hàng chờ kiểm kho. */
export async function releaseHeldOrders(db: D1Database): Promise<number> {
  const today = vnDate();
  const due = await db
    .prepare("SELECT id FROM orders WHERE flow_on = 1 AND kho_status = 'CHO_HANG' AND hold_until IS NOT NULL AND hold_until <= ?")
    .bind(today)
    .all<{ id: string }>();
  const ids = (due.results ?? []).map((r) => r.id);
  if (!ids.length) return 0;
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const id of ids) {
    stmts.push(
      db.prepare("UPDATE orders SET kho_status = 'CHO_KIEM_KHO', hold_until = NULL, updated_at = ? WHERE id = ?").bind(now, id),
      db
        .prepare(
          `INSERT INTO order_flow_log (order_id, at, actor_id, action, from_status, to_status, note)
           VALUES (?, ?, NULL, 'HANG_VE', 'CHO_HANG', 'CHO_KIEM_KHO', 'Tới ngày hàng về, tự chuyển kho kiểm lại')`,
        )
        .bind(id, now),
    );
  }
  await db.batch(stmts);
  return ids.length;
}

/** Quản lý duyệt đơn + đặt lịch xuất. Đơn có yêu cầu vượt ngưỡng thì cần CEO duyệt. */
export async function flowApprove(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  input: { ship_date?: string | null; note?: string | null },
  ctx: FlowCtx & { allowSelfApproval?: boolean },
) {
  if (!isApprover(auth)) throw forbidden('Chỉ quản lý được duyệt đơn và đặt lịch xuất.');
  const o = await loadFlowOrder(db, auth, orderId);
  requireStatus(o, ['CHO_DIEU_PHOI', 'CHO_KIEM_KHO', 'THIEU_HANG', 'CHO_HANG', 'DU_HANG'], 'duyệt đơn');
  // Đơn đã duyệt sẵn (người lập có quyền duyệt) mà kho báo thiếu / chờ hàng: bấm duyệt chỉ để đặt lịch xuất.
  if (o.approval_status !== 'PENDING_APPROVAL' && o.approval_status !== 'APPROVED') {
    throw badRequest('NOT_PENDING', 'Đơn này không ở trạng thái chờ duyệt.');
  }
  const pending = await db
    .prepare("SELECT id FROM approvals WHERE entity_type = 'ORDER' AND entity_id = ? AND status = 'PENDING'")
    .bind(orderId)
    .all<{ id: string }>();
  for (const a of pending.results ?? []) {
    await decideApproval(db, auth, a.id, 'APPROVED', input.note ?? null, {
      requestId: ctx.requestId,
      ip: ctx.ip,
      allowSelfApproval: ctx.allowSelfApproval,
    });
  }
  const after = await db
    .prepare('SELECT approval_status, kho_status FROM orders WHERE id = ?')
    .bind(orderId)
    .first<{ approval_status: string; kho_status: string }>();
  if (after?.approval_status !== 'APPROVED') {
    throw badRequest('NOT_APPROVED', 'Đơn chưa được duyệt hết các yêu cầu.');
  }
  const now = nowIso();
  const shipDate = input.ship_date || o.need_date || null;
  await db.batch([
    db.prepare('UPDATE orders SET ship_date = ?, updated_at = ? WHERE id = ?').bind(shipDate, now, orderId),
    logStmt(db, orderId, auth, 'DUYET_LICH_XUAT', o.kho_status, 'CHO_XUAT', `${shipDate ? 'Hẹn xuất ' + shipDate : 'Duyệt'}${input.note ? ' · ' + input.note : ''}`, now),
    stepEvent(db, auth, orderId, o.kho_status, 'CHO_XUAT', 'DUYET_LICH_XUAT'),
  ]);
  return { kho_status: 'CHO_XUAT' as KhoStatus, ship_date: shipDate };
}

/** Kế toán kho xuất hàng: ghi SỐ THỰC XUẤT của từng mã. Kho trừ tồn theo số này. */
export async function flowShip(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  input: {
    lines?: Array<{ product_id: string; shipped_qty: number }>;
    note?: string | null;
    ship_day?: string | null;
    shipped_by_name?: string | null;
  },
  ctx: FlowCtx,
) {
  if (!isKho(auth)) throw forbidden('Chỉ kế toán kho được ghi xuất kho.');
  // Đơn tạo trước khi có luồng kho nhưng đã duyệt, đang chờ xuất: cho vào luồng ngay tại bước xuất để kho ghi được số thực xuất
  // (khớp thì tự vào công nợ, lệch thì báo sale xử lý). Không đụng đơn đã xuất hoặc chưa duyệt.
  await db
    .prepare(
      `UPDATE orders SET flow_on = 1, kho_status = 'CHO_XUAT'
       WHERE id = ? AND flow_on = 0 AND deleted_at IS NULL AND approval_status = 'APPROVED' AND delivery_status = 'CHUA_XUAT'`,
    )
    .bind(orderId)
    .run();
  const o = await loadFlowOrder(db, auth, orderId);
  requireStatus(o, ['CHO_XUAT'], 'xuất kho');
  if (o.approval_status !== 'APPROVED') throw badRequest('NOT_APPROVED', 'Đơn chưa được duyệt.');

  const items = (
    await db
      .prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?')
      .bind(orderId)
      .all<{ product_id: string; qty: number }>()
  ).results ?? [];
  const given = new Map((input.lines ?? []).map((l) => [l.product_id, l.shipped_qty]));
  const now = nowIso();
  if (input.ship_day && input.ship_day > vnDate()) throw unprocessable('BAD_SHIP_DAY', 'Ngày xuất kho không được sau hôm nay.');
  const shipAt = input.ship_day ? shipDayToIso(input.ship_day) : null;
  const stmts: D1PreparedStatement[] = [];
  let total = 0;
  for (const it of items) {
    const raw = given.has(it.product_id) ? given.get(it.product_id) : it.qty;
    const q = Math.floor(Number(raw));
    if (!Number.isFinite(q) || q < 0) {
      throw unprocessable('BAD_QTY', 'Số thực xuất phải là số từ 0 trở lên.', { lines: 'Số lượng không hợp lệ' });
    }
    total += q;
    stmts.push(
      db
        .prepare(
          `INSERT INTO order_kho_lines (id, order_id, product_id, status, ok_qty, shipped_qty, shipped_by, shipped_at)
           VALUES (?, ?, ?, 'DU', ?, ?, ?, ?)
           ON CONFLICT (order_id, product_id) DO UPDATE SET shipped_qty = excluded.shipped_qty,
             shipped_by = excluded.shipped_by, shipped_at = excluded.shipped_at`,
        )
        .bind(newId(), orderId, it.product_id, it.qty, q, auth.user.id, now),
    );
  }
  if (total <= 0) throw unprocessable('NOTHING_SHIPPED', 'Chưa có mã nào được xuất. Ghi số thực xuất của ít nhất một mã.');

  stmts.push(
    db
      .prepare(
        `UPDATE orders SET delivery_status = 'DA_XUAT_KHO', delivered_at = COALESCE(?, delivered_at, ?),
           shipped_by_name = COALESCE(?, shipped_by_name), kho_status = 'DA_XUAT', updated_at = ? WHERE id = ?`,
      )
      .bind(shipAt, now, input.shipped_by_name || null, now, orderId),
    logStmt(db, orderId, auth, 'KHO_XUAT', 'CHO_XUAT', 'DA_XUAT', input.note ?? null, now),
    stepEvent(db, auth, orderId, 'CHO_XUAT', 'DA_XUAT', 'KHO_XUAT'),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ORDER_FLOW_KHO_XUAT',
      entityType: 'ORDER',
      entityId: orderId,
      before: { kho_status: 'CHO_XUAT' },
      after: { kho_status: 'DA_XUAT', shipped_total: total },
      reason: input.note ?? null,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  );
  await db.batch(stmts);
  // Đơn đã đi: trừ tiền cọc còn dư của khách vào đơn này (lỗi thì không chặn việc xuất kho).
  try {
    const { applyDepositsToOrder } = await import('./payments');
    await applyDepositsToOrder(db, auth, orderId, ctx);
  } catch (e) {
    console.error('[deposit] không trừ được cọc', e);
  }

  const diff = await shipDiff(db, orderId);
  const shipped: FlowOrder = { ...o, kho_status: 'DA_XUAT' };
  if (diff.length === 0) {
    // Xuất ĐÚNG đơn: không còn bước nào cần người bấm, tự chốt tiền và đơn vào công nợ chính thức.
    await finishToDebt(db, auth, shipped, 'Kho xuất đúng đơn: tự chốt tiền và vào công nợ', ctx);
    return { kho_status: 'DA_CHOT_TIEN' as KhoStatus, diff };
  }
  // Xuất LỆch so với đơn: không tự đổi tiền. Báo sale phụ trách vào xử lý (báo khách, đồng ý số thực xuất hoặc sửa đơn).
  if (o.owner_id) {
    const nowT = nowIso();
    await db
      .prepare(
        `INSERT INTO tasks (id, customer_id, assignee_id, type, title, due_at, status, priority, created_by, created_at, updated_at)
         VALUES (?, ?, ?, 'FOLLOW_UP', ?, ?, 'OPEN', 'HIGH', ?, ?, ?)`,
      )
      .bind(
        newId(),
        o.customer_id,
        o.owner_id,
        `Kho xuất lệch đơn ${o.order_no} (${diff.length} mã): vào đơn xử lý, báo khách rồi đồng ý số thực xuất`,
        nowT,
        auth.user.id,
        nowT,
        nowT,
      )
      .run();
  }
  return { kho_status: 'DA_XUAT' as KhoStatus, diff };
}

/** Chốt tiền + xác nhận kế toán tự động, đưa đơn vào công nợ chính thức (dùng khi xuất khớp đơn hoặc sale đồng ý số thực xuất). */
async function finishToDebt(
  db: D1Database,
  auth: AuthContext,
  o: FlowOrder,
  note: string,
  ctx: FlowCtx,
  extra: D1PreparedStatement[] = [],
): Promise<void> {
  const now = nowIso();
  await applyTransition(
    db,
    auth,
    o,
    'DA_CHOT_TIEN',
    'CHOT_TIEN',
    note,
    "money_locked_at = ?, money_locked_by = ?, accounting_status = 'DA_XAC_NHAN', accounting_confirmed_at = ?, accounting_auto = 1",
    [now, auth.user.id, now],
    [
      ...extra,
      auditStatement(db, {
        actorId: auth.user.id,
        action: 'ACCOUNTING_CONFIRMED',
        entityType: 'ORDER',
        entityId: o.id,
        before: { accounting_status: 'CHUA_XAC_NHAN' },
        after: { accounting_status: 'DA_XAC_NHAN' },
        reason: note,
        requestId: ctx.requestId,
        ip: ctx.ip,
      }),
    ],
    ctx,
  );
}

/**
 * Sale phụ trách (hoặc quản lý) đồng ý số thực xuất của kho: đơn tự sửa theo số thực xuất (lưu lịch sử sửa), chốt tiền
 * và vào công nợ chính thức trong một lần bấm.
 */
export async function flowAcceptShipped(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  note: string | null,
  ctx: FlowCtx,
) {
  const o = await loadFlowOrder(db, auth, orderId);
  if (o.owner_id !== auth.user.id && !isApprover(auth)) {
    throw forbidden('Chỉ sale phụ trách đơn hoặc quản lý mới đồng ý số thực xuất được.');
  }
  requireStatus(o, ['DA_XUAT', 'CHO_CHOT_TIEN'], 'đồng ý số thực xuất');
  const adj = await buildShippedAdjustment(db, auth, o, nowIso());
  await finishToDebt(db, auth, o, note || 'Sale đồng ý số thực xuất, vào công nợ', ctx, adj.statements);
  return { kho_status: 'DA_CHOT_TIEN' as KhoStatus, adjusted: adj.changes };
}

/**
 * Kế toán kho sửa SỐ THỰC XUẤT sau khi đã xuất, kể cả khi đã chốt tiền / kế toán đã xác nhận (kho ghi nhầm, gửi nhầm hàng).
 * Tồn kho đổi theo ngay (kho_ledger trừ theo số thực xuất). Số thực xuất mới tự áp vào đơn, đơn quay lại bước chốt tiền,
 * kế toán xác nhận lại nếu đã xác nhận; sale được báo qua Việc hôm nay. Mọi thay đổi ghi lý do + lịch sử.
 */
export async function flowCorrectShipped(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  input: { lines: Array<{ product_id: string; shipped_qty: number }>; reason: string },
  ctx: FlowCtx,
) {
  if (!isKho(auth) && !isApprover(auth) && !auth.permissions.includes('order.accounting.confirm')) {
    throw forbidden('Chỉ kế toán kho, quản lý điều phối, kế toán hoặc CEO được sửa số thực xuất.');
  }
  const o = await loadFlowOrder(db, auth, orderId);
  if (!['DA_XUAT', 'CHO_CHOT_TIEN', 'DA_CHOT_TIEN'].includes(o.kho_status)) {
    throw badRequest('NOT_SHIPPED', 'Đơn chưa xuất kho nên chưa có số thực xuất để sửa. Ghi số thực xuất ở bước xuất kho.');
  }
  const reason = input.reason.trim();
  if (reason.length < 5) throw unprocessable('REASON_REQUIRED', 'Ghi lý do sửa (tối thiểu 5 ký tự).');

  const items =
    (
      await db
        .prepare(
          `SELECT oi.product_id, oi.qty, p.sku, okl.shipped_qty AS shipped
           FROM order_items oi JOIN products p ON p.id = oi.product_id
           LEFT JOIN order_kho_lines okl ON okl.order_id = oi.order_id AND okl.product_id = oi.product_id
           WHERE oi.order_id = ?`,
        )
        .bind(orderId)
        .all<{ product_id: string; qty: number; sku: string; shipped: number | null }>()
    ).results ?? [];
  const byId = new Map(items.map((i) => [i.product_id, i]));
  const now = nowIso();
  const changed: Array<{ sku: string; before: number; after: number }> = [];
  const stmts: D1PreparedStatement[] = [];
  for (const l of input.lines) {
    const it = byId.get(l.product_id);
    if (!it) {
      throw unprocessable(
        'ITEM_NOT_IN_ORDER',
        'Mã này không còn trong đơn. Nhờ sale bấm "Sửa đơn" thêm mã đó vào đơn trước, rồi kho sửa số thực xuất.',
      );
    }
    const before = it.shipped ?? it.qty;
    if (before === l.shipped_qty) continue;
    changed.push({ sku: it.sku, before, after: l.shipped_qty });
    stmts.push(
      db
        .prepare(
          `INSERT INTO order_kho_lines (id, order_id, product_id, status, ok_qty, shipped_qty, shipped_by, shipped_at)
           VALUES (?, ?, ?, 'DU', ?, ?, ?, ?)
           ON CONFLICT (order_id, product_id) DO UPDATE SET shipped_qty = excluded.shipped_qty,
             shipped_by = excluded.shipped_by, shipped_at = excluded.shipped_at`,
        )
        .bind(newId(), orderId, l.product_id, it.qty, l.shipped_qty, auth.user.id, now),
    );
  }
  if (!changed.length) throw unprocessable('NO_CHANGE', 'Số thực xuất không đổi so với hiện tại.');
  const newTotalShipped = items.reduce((s, i) => {
    const c = changed.find((x) => x.sku === i.sku);
    return s + (c ? c.after : (i.shipped ?? i.qty));
  }, 0);
  if (newTotalShipped <= 0) {
    throw unprocessable(
      'NOTHING_SHIPPED',
      'Sửa như vậy thì đơn không còn hàng nào xuất. Nếu hàng đã về kho thì lập Phiếu hàng trả lại.',
    );
  }

  await db.batch(stmts);
  // Số thực xuất mới tự áp vào đơn (tiền hàng, tổng phải thu, trạng thái thanh toán) và báo sale.
  const adj = await buildShippedAdjustment(db, auth, o, now);
  const text = changed.map((c) => `${c.sku} ${c.before} → ${c.after}`).join('; ');
  const unlockAcc = o.accounting_status === 'DA_XAC_NHAN';
  const backToMoney = o.kho_status === 'DA_CHOT_TIEN';
  const toStatus: KhoStatus = o.kho_status === 'DA_XUAT' ? 'DA_XUAT' : 'CHO_CHOT_TIEN';
  const tail: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE orders SET kho_status = ?, updated_at = ?,
           money_locked_at = CASE WHEN ? = 1 THEN NULL ELSE money_locked_at END,
           money_locked_by = CASE WHEN ? = 1 THEN NULL ELSE money_locked_by END,
           accounting_status = CASE WHEN ? = 1 THEN 'CHUA_XAC_NHAN' ELSE accounting_status END,
           accounting_confirmed_at = CASE WHEN ? = 1 THEN NULL ELSE accounting_confirmed_at END
         WHERE id = ?`,
      )
      .bind(toStatus, now, backToMoney ? 1 : 0, backToMoney ? 1 : 0, unlockAcc ? 1 : 0, unlockAcc ? 1 : 0, orderId),
    logStmt(
      db,
      orderId,
      auth,
      'SUA_SO_XUAT',
      o.kho_status,
      toStatus,
      `${text}. Lý do: ${reason}${unlockAcc ? ' (kế toán cần xác nhận lại)' : ''}`.slice(0, 480),
      now,
    ),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ORDER_FLOW_SHIPPED_CORRECTED',
      entityType: 'ORDER',
      entityId: orderId,
      before: { kho_status: o.kho_status, accounting_status: o.accounting_status },
      after: { kho_status: toStatus, changes: changed },
      reason,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
    eventStatement(db, {
      type: 'ORDER_SHIPPED_CORRECTED',
      entityType: 'ORDER',
      entityId: orderId,
      actorId: auth.user.id,
      actorType: auth.actorType ?? 'USER',
      payload: { changes: changed, reason, accounting_unlocked: unlockAcc, money_unlocked: backToMoney },
    }),
  ];
  if (o.owner_id) {
    tail.push(
      db
        .prepare(
          `INSERT INTO tasks (id, customer_id, assignee_id, type, title, due_at, status, priority, created_by, created_at, updated_at)
           VALUES (?, ?, ?, 'FOLLOW_UP', ?, ?, 'OPEN', 'HIGH', ?, ?, ?)`,
        )
        .bind(
          newId(),
          o.customer_id,
          o.owner_id,
          `Kho sửa số thực xuất đơn ${o.order_no} (${text}). Lý do: ${reason}. Kiểm tra lại tiền với khách${backToMoney ? ', chốt tiền lại' : ''}${unlockAcc ? ', báo kế toán xác nhận lại' : ''}`.slice(0, 480),
          now,
          auth.user.id,
          now,
          now,
        ),
    );
  }
  if (unlockAcc) {
    const { accountantIds, taskStatements } = await import('../lib/notifyTasks');
    tail.push(
      ...taskStatements(db, await accountantIds(db), {
        title: `Đơn ${o.order_no} đã đổi số thực xuất (${text}), kế toán xác nhận ghi nợ lại. Lý do: ${reason}`,
        customerId: o.customer_id,
        createdBy: auth.user.id,
        now,
      }),
    );
  }
  await db.batch([...adj.statements, ...tail]);
  const total = await db.prepare('SELECT total_amount FROM orders WHERE id = ?').bind(orderId).first<{ total_amount: number }>();
  return {
    kho_status: toStatus,
    changes: changed,
    total_amount: total?.total_amount ?? null,
    accounting_unlocked: unlockAcc,
    money_unlocked: backToMoney,
  };
}

/** Các mã có số thực xuất lệch số trên đơn. */
export async function shipDiff(db: D1Database, orderId: string) {
  const rows = await db
    .prepare(
      `SELECT p.sku, p.name, oi.qty AS ordered, okl.shipped_qty AS shipped
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN order_kho_lines okl ON okl.order_id = oi.order_id AND okl.product_id = oi.product_id
       WHERE oi.order_id = ?`,
    )
    .bind(orderId)
    .all<{ sku: string; name: string; ordered: number; shipped: number | null }>();
  return (rows.results ?? [])
    .filter((r) => (r.shipped ?? r.ordered) !== r.ordered)
    .map((r) => ({ sku: r.sku, name: r.name, ordered: r.ordered, shipped: r.shipped ?? 0 }));
}

/**
 * Kho đã ghi số thực xuất: tự đưa số lượng và tiền của đơn về đúng số thực xuất (lưu lịch sử sửa, ghi nhật ký)
 * và báo sale in lại phiếu gửi khách. Dòng kho xuất 0 thì bỏ khỏi đơn. Không lệch thì không làm gì.
 */
async function buildShippedAdjustment(
  db: D1Database,
  auth: AuthContext,
  o: FlowOrder,
  now: string,
): Promise<{ statements: D1PreparedStatement[]; changes: Array<{ sku: string; name: string; ordered: number; shipped: number }> }> {
  const rows = await db
    .prepare(
      `SELECT oi.id, p.sku, p.name, oi.qty, oi.applied_price, oi.line_total, oi.is_gift, oi.gift_qty, okl.shipped_qty AS shipped
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN order_kho_lines okl ON okl.order_id = oi.order_id AND okl.product_id = oi.product_id
       WHERE oi.order_id = ? ORDER BY oi.rowid`,
    )
    .bind(o.id)
    .all<{
      id: string;
      sku: string;
      name: string;
      qty: number;
      applied_price: number;
      line_total: number;
      is_gift: number;
      gift_qty: number;
      shipped: number | null;
    }>();
  const items = rows.results ?? [];
  const changes = items
    .filter((r) => r.shipped !== null && r.shipped !== r.qty)
    .map((r) => ({ sku: r.sku, name: r.name, ordered: r.qty, shipped: r.shipped as number }));
  if (changes.length === 0) return { statements: [], changes: [] };

  const head = await db
    .prepare(
      `SELECT subtotal, discount_amount, bonus_deduction, shipping_fee, total_amount, cod_amount, note, payment_status,
              COALESCE((SELECT a.received FROM (${RECEIVED_BY_ORDER}) a WHERE a.order_id = orders.id), 0) AS received
       FROM orders WHERE id = ?`,
    )
    .bind(o.id)
    .first<{
      subtotal: number;
      discount_amount: number;
      bonus_deduction: number;
      shipping_fee: number;
      total_amount: number;
      cod_amount: number;
      note: string | null;
      payment_status: string;
      received: number;
    }>();
  if (!head) return { statements: [], changes: [] };

  const snap = (list: Array<{ sku: string; name: string; qty: number; applied_price: number; line_total: number; is_gift: number }>, sub: number, total: number) => ({
    items: list.map((r) => ({
      sku: r.sku,
      name: r.name,
      qty: r.qty,
      applied_price: r.applied_price,
      line_total: r.line_total,
      is_gift: Boolean(r.is_gift),
    })),
    subtotal: sub,
    discount_amount: head.discount_amount,
    bonus_deduction: head.bonus_deduction,
    shipping_fee: head.shipping_fee,
    total_amount: total,
    cod_amount: head.cod_amount,
    note: head.note,
  });

  const stmts: D1PreparedStatement[] = [];
  const after: typeof items = [];
  let subtotal = 0;
  for (const r of items) {
    if (r.shipped === null || r.shipped === r.qty) {
      after.push(r);
      subtotal += r.line_total;
      continue;
    }
    if (r.shipped <= 0) {
      stmts.push(db.prepare('DELETE FROM order_items WHERE id = ?').bind(r.id));
      continue;
    }
    const lineTotal = r.is_gift ? 0 : Math.round(Math.max(0, r.shipped - (r.gift_qty ?? 0)) * r.applied_price);
    stmts.push(
      db.prepare('UPDATE order_items SET qty = ?, line_total = ? WHERE id = ?').bind(r.shipped, lineTotal, r.id),
    );
    after.push({ ...r, qty: r.shipped, line_total: lineTotal });
    subtotal += lineTotal;
  }
  const newTotal = subtotal - head.discount_amount - head.bonus_deduction + head.shipping_fee;
  const payStatus =
    head.received > 0 ? derivePaymentStatus(newTotal, head.received + head.cod_amount) : head.payment_status;
  const revRow = await db
    .prepare('SELECT COALESCE(MAX(revision_no), 0) + 1 AS n FROM order_revisions WHERE order_id = ?')
    .bind(o.id)
    .first<{ n: number }>();
  const reason = 'Tự áp số thực xuất do kho ghi: ' + changes.map((c) => `${c.sku} ${c.ordered} → ${c.shipped}`).join('; ');

  stmts.push(
    db
      .prepare('UPDATE orders SET subtotal = ?, total_amount = ?, payment_status = ?, updated_at = ? WHERE id = ?')
      .bind(subtotal, newTotal, payStatus, now, o.id),
    db
      .prepare(
        `INSERT INTO order_revisions (id, order_id, revision_no, edited_by, reason, stage, before_json, after_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        newId(),
        o.id,
        revRow?.n ?? 1,
        auth.user.id,
        reason.slice(0, 480),
        'KHO_XUAT_THUC_TE',
        JSON.stringify(snap(items, head.subtotal, head.total_amount)),
        JSON.stringify(snap(after, subtotal, newTotal)),
        now,
      ),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ORDER_AUTO_APPLIED_SHIPPED',
      entityType: 'ORDER',
      entityId: o.id,
      before: { total_amount: head.total_amount },
      after: { total_amount: newTotal, changes },
      reason,
    }),
    eventStatement(db, {
      type: 'ORDER_EDITED',
      entityType: 'ORDER',
      entityId: o.id,
      actorId: auth.user.id,
      actorType: auth.actorType ?? 'USER',
      payload: { source: 'KHO_XUAT_THUC_TE', total_before: head.total_amount, total_after: newTotal, changes },
    }),
  );

  // Báo sale phụ trách: việc "In lại phiếu gửi khách" hiện ở Việc hôm nay.
  if (o.owner_id) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO tasks (id, customer_id, assignee_id, type, title, due_at, status, priority, created_by, created_at, updated_at)
           VALUES (?, ?, ?, 'FOLLOW_UP', ?, ?, 'OPEN', 'HIGH', ?, ?, ?)`,
        )
        .bind(
          newId(),
          o.customer_id,
          o.owner_id,
          `Kho xuất lệch đơn ${o.order_no} (${changes.length} mã): in lại phiếu gửi khách để khách xác nhận, rồi chốt tiền`,
          now,
          auth.user.id,
          now,
          now,
        ),
    );
  }
  return { statements: stmts, changes };
}

/** Quản lý xác nhận đã xuất; số thực xuất tự áp vào đơn, sale được báo in lại phiếu gửi khách rồi chốt tiền. */
export async function flowConfirmShipped(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  note: string | null,
  ctx: FlowCtx,
) {
  if (!isApprover(auth)) throw forbidden('Chỉ quản lý điều phối được xác nhận đã xuất.');
  const o = await loadFlowOrder(db, auth, orderId);
  requireStatus(o, ['DA_XUAT'], 'xác nhận đã xuất');
  const adj = await buildShippedAdjustment(db, auth, o, nowIso());
  await applyTransition(db, auth, o, 'CHO_CHOT_TIEN', 'XAC_NHAN_XUAT', note, '', [], adj.statements, ctx);
  return { kho_status: 'CHO_CHOT_TIEN' as KhoStatus, diff: await shipDiff(db, orderId), adjusted: adj.changes };
}

/** Sale (hoặc quản lý nếu khách của quản lý) chốt tiền phải thu sau khi đơn khớp số thực xuất. */
export async function flowLockMoney(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  note: string | null,
  ctx: FlowCtx,
) {
  const o = await loadFlowOrder(db, auth, orderId);
  if (o.owner_id !== auth.user.id && !isApprover(auth)) {
    throw forbidden('Chỉ sale phụ trách đơn hoặc quản lý mới chốt tiền được.');
  }
  requireStatus(o, ['DA_XUAT', 'CHO_CHOT_TIEN'], 'chốt tiền');
  const diff = await shipDiff(db, orderId);
  if (diff.length) {
    throw unprocessable(
      'SHIP_DIFF',
      `Đơn còn lệch số thực xuất ở ${diff.length} mã (${diff.map((d) => d.sku).join(', ')}). Sửa đơn cho khớp số thực xuất rồi chốt tiền.`,
    );
  }
  const now = nowIso();
  await applyTransition(
    db,
    auth,
    o,
    'DA_CHOT_TIEN',
    'CHOT_TIEN',
    note,
    'money_locked_at = ?, money_locked_by = ?, accounting_status = \'DA_XAC_NHAN\', accounting_confirmed_at = ?, accounting_auto = 1',
    [now, auth.user.id, now],
    [
      auditStatement(db, {
        actorId: auth.user.id,
        action: 'ACCOUNTING_CONFIRMED',
        entityType: 'ORDER',
        entityId: orderId,
        before: { accounting_status: 'CHUA_XAC_NHAN' },
        after: { accounting_status: 'DA_XAC_NHAN' },
        reason: 'Tự xác nhận khi sale chốt tiền sau khi kho đã xuất',
        requestId: ctx.requestId,
        ip: ctx.ip,
      }),
    ],
    ctx,
  );
  return { kho_status: 'DA_CHOT_TIEN' as KhoStatus, total_amount: o.total_amount };
}

/** Việc đang chờ từng bước (đếm theo trạng thái) trong phạm vi người xem. */
export async function flowSummary(db: D1Database, auth: AuthContext) {
  const own = seesAllOrders(auth) ? '' : ' AND o.owner_id = ?';
  const params: unknown[] = seesAllOrders(auth) ? [] : [auth.user.id];
  const rows = await db
    .prepare(
      `SELECT o.kho_status AS s, COUNT(*) AS n FROM orders o
       WHERE o.deleted_at IS NULL AND o.flow_on = 1 AND o.approval_status <> 'CANCELLED'
         AND o.kho_status <> 'KHONG' AND o.accounting_status <> 'DA_XAC_NHAN'${own}
       GROUP BY o.kho_status`,
    )
    .bind(...params)
    .all<{ s: string; n: number }>();
  const counts: Record<string, number> = {};
  for (const r of rows.results ?? []) counts[r.s] = r.n;

  // Các mã đang thiếu của đơn chờ kho/đang giữ chờ hàng: danh sách "cần sản xuất" cho quản lý làm lệnh sản xuất.
  const sh = await db
    .prepare(
      `SELECT p.sku, p.name, SUM(oi.qty - COALESCE(okl.ok_qty, 0)) AS short, COUNT(DISTINCT o.id) AS orders,
              MIN(okl.eta_date) AS eta
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       JOIN order_kho_lines okl ON okl.order_id = o.id AND okl.product_id = oi.product_id
       WHERE o.deleted_at IS NULL AND o.flow_on = 1 AND o.kho_status IN ('THIEU_HANG', 'CHO_HANG')
         AND okl.status = 'THIEU'${own}
       GROUP BY p.sku, p.name ORDER BY short DESC LIMIT 100`,
    )
    .bind(...params)
    .all<{ sku: string; name: string; short: number; orders: number; eta: string | null }>();
  const cfg = await db.prepare("SELECT v FROM kho_cfg WHERE k = 'flow_on'").first<{ v: string }>();
  return { counts, shortages: sh.results ?? [], enabled: cfg?.v === '1' };
}

/** Khi đơn bị sửa thì bước kho có thể phải quay lại (nội dung đổi thì kho phải kiểm/duyệt lại). */
export function editFlowStatements(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  from: string,
  to: string,
  note: string,
  now: string,
): D1PreparedStatement[] {
  if (from === to) return [];
  return [
    db
      .prepare(
        `UPDATE orders SET kho_status = ?, updated_at = ?,
           money_locked_at = CASE WHEN ? = 'CHO_CHOT_TIEN' THEN NULL ELSE money_locked_at END,
           money_locked_by = CASE WHEN ? = 'CHO_CHOT_TIEN' THEN NULL ELSE money_locked_by END
         WHERE id = ?`,
      )
      .bind(to, now, to, to, orderId),
    logStmt(db, orderId, auth, 'SUA_DON', from, to, note, now),
  ];
}

/** Quyết định bước kho sau khi sửa đơn (xem updateOrder). */
export function khoAfterEdit(
  auth: AuthContext,
  current: string,
  approvalStatus: string,
): { kho: string; backToApproval: boolean } {
  const back = isApprover(auth) ? 'CHO_KIEM_KHO' : 'CHO_DIEU_PHOI';
  if (approvalStatus === 'PENDING_APPROVAL' && ['CHO_DIEU_PHOI', 'CHO_KIEM_KHO', 'DU_HANG'].includes(current)) {
    return { kho: back, backToApproval: false };
  }
  if (approvalStatus === 'APPROVED' && current === 'CHO_XUAT') return { kho: back, backToApproval: true };
  if (current === 'DA_CHOT_TIEN') return { kho: 'CHO_CHOT_TIEN', backToApproval: false };
  return { kho: current, backToApproval: false };
}

/** CEO bật/tắt luồng kho cho đơn tạo mới. Đơn đã tạo giữ nguyên cách đang đi. */
export async function setFlowEnabled(db: D1Database, auth: AuthContext, enabled: boolean, ctx: FlowCtx) {
  await db.batch([
    db
      .prepare(
        "INSERT INTO kho_cfg (k, v) VALUES ('flow_on', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v",
      )
      .bind(enabled ? '1' : '0'),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ORDER_FLOW_TOGGLED',
      entityType: 'SETTING',
      entityId: 'flow_on',
      after: { enabled },
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
  return { enabled };
}

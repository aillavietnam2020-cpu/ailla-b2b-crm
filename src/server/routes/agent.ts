import { Hono } from 'hono';
import { z } from 'zod';
import { AGENT_PHIEU_CHI, AGENT_SCOPE_PREFIX, AGENT_SCOPES, policyFor } from '@shared/agent';
import { KHO_WAITING } from '@shared/flow';
import type { KhoStatus } from '@shared/flow';
import type { AppEnv } from '../env';
import { AppError, badRequest, forbidden, notFound, ok, unprocessable } from '../lib/http';
import { clientIp } from '../lib/audit';
import { requirePermission } from '../middleware/rbac';
import { zodFieldErrors } from '@shared/schemas';
import { getOrderDetail } from '../services/orders';
import { flowSummary, khoCheck } from '../services/orderFlow';
import { getCustomerDebt, listDebts, totalDebts } from '../services/debts';
import { listPayments } from '../services/payments';
import { createProposal } from '../services/proposals';
import { khoAlerts } from './kho';
import { unpack } from '../lib/pack';

/**
 * Cổng riêng cho AI agent. Agent chỉ có hai quyền: agent.read (đọc) và agent.propose (ghi đề xuất).
 * Không có đường nào để agent tự đổi trạng thái đơn, duyệt, xuất kho, sửa tồn hay sửa công nợ:
 * những việc đó chỉ qua đề xuất rồi người có quyền bấm Chấp nhận (xem shared/agent.ts ACTION_POLICY).
 * Mọi dữ liệu trả về đều kèm ID ổn định để agent tra tiếp theo ID, không cần tìm theo tên.
 */
export const agentRoutes = new Hono<AppEnv>();

/**
 * Phạm vi đọc theo vai (shared/agent.ts AGENT_SCOPES): mỗi agent chỉ thấy đúng phần việc của mình.
 * Phạm vi do CEO cấp riêng cho từng agent; không có phạm vi nào thì không đọc được dữ liệu nghiệp vụ.
 */
const scopesOf = (c: { get: (k: 'auth') => { permissions: string[] } }): string[] =>
  c
    .get('auth')
    .permissions.filter((p) => p.startsWith(AGENT_SCOPE_PREFIX))
    .map((p) => p.slice(AGENT_SCOPE_PREFIX.length));
const hasScope = (c: Parameters<typeof scopesOf>[0], ...need: string[]) => scopesOf(c).some((x) => need.includes(x));
function needScope(c: Parameters<typeof scopesOf>[0], ...need: string[]) {
  if (!hasScope(c, ...need)) throw forbidden('Agent này chưa được phép đọc mục này');
}

agentRoutes.get('/me', requirePermission('agent.read'), (c) => {
  const auth = c.get('auth');
  return ok(c, {
    id: auth.user.id,
    name: auth.user.display_name,
    permissions: auth.permissions,
    scopes: scopesOf(c),
    all_scopes: AGENT_SCOPES,
    // Được lập phiếu chi (vận chuyển, nhà cung cấp, Chi phí khác) khi người được chỉ định ra lệnh, qua lệnh ghi có giấy ủy quyền.
    can_phieu_chi: auth.permissions.includes(AGENT_PHIEU_CHI),
    policy: {
      'proposal.create': policyFor('proposal.create'),
      'order.flow.transition': policyFor('order.flow.transition'),
      'order.approve': policyFor('order.approve'),
      'kho.stock.adjust': policyFor('kho.stock.adjust'),
    },
  });
});

const LIMIT = 200;

/** Đơn đang trong luồng kèm tuổi của bước hiện tại và người đang phải làm bước kế tiếp. */
agentRoutes.get('/orders', requirePermission('agent.read'), async (c) => {
  needScope(c, 'orders', 'orders_kho');
  const where = ["o.deleted_at IS NULL", "o.approval_status <> 'CANCELLED'", "o.accounting_status <> 'DA_XAC_NHAN'"];
  const params: unknown[] = [];
  // Vai kế toán kho: chỉ đơn đang chờ kho (kiểm kho, chờ xuất, giữ chờ hàng, thiếu hàng).
  if (!hasScope(c, 'orders')) {
    where.push("o.flow_on = 1 AND o.kho_status IN ('CHO_KIEM_KHO', 'CHO_XUAT', 'CHO_HANG', 'THIEU_HANG')");
  }
  const khoStatus = c.req.query('kho_status');
  if (khoStatus) {
    where.push('o.flow_on = 1 AND o.kho_status = ?');
    params.push(khoStatus);
  } else if (c.req.query('flow') === '1') {
    where.push("o.flow_on = 1 AND o.kho_status <> 'KHONG'");
  }
  const stuck = Number(c.req.query('stuck_hours') ?? '');
  if (Number.isFinite(stuck) && stuck > 0) {
    where.push("(julianday('now') - julianday(o.updated_at)) * 24 >= ?");
    params.push(stuck);
  }
  const customerId = c.req.query('customer_id');
  if (customerId) {
    where.push('o.customer_id = ?');
    params.push(customerId);
  }
  const rows = await c.env.DB.prepare(
    `SELECT o.id, o.order_no, o.customer_id, c.name AS customer_name, o.owner_id, o.order_date, o.total_amount,
            o.approval_status, o.delivery_status, o.payment_status, o.accounting_status, o.flow_on, o.kho_status,
            o.need_date, o.ship_date, o.hold_until, o.updated_at,
            CAST((julianday('now') - julianday(o.updated_at)) * 24 AS INTEGER) AS step_age_hours
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE ${where.join(' AND ')}
     ORDER BY o.updated_at ASC LIMIT ?`,
  )
    .bind(...params, Math.min(Number(c.req.query('limit') ?? LIMIT), LIMIT))
    .all<Record<string, unknown>>();
  const fullOrders = hasScope(c, 'orders');
  return ok(
    c,
    (rows.results ?? []).map((r) => {
      const row: Record<string, unknown> = {
        ...r,
        waiting_for: r.flow_on ? KHO_WAITING[(r.kho_status as KhoStatus) ?? 'KHONG'] : null,
      };
      // Vai kho (Kế toán kho, trợ lý của Chúc) chỉ làm vận hành: không thấy số tiền, thanh toán, trạng thái kế toán.
      if (!fullOrders) {
        delete row.total_amount;
        delete row.payment_status;
        delete row.accounting_status;
      }
      return row;
    }),
  );
});

/** Hồ sơ một đơn: dòng hàng, trạng thái, lịch sử bước, kiểm tồn từng dòng, bill (chỉ thông tin, không ảnh). */
agentRoutes.get('/orders/:id', requirePermission('agent.read'), async (c) => {
  needScope(c, 'orders');
  const auth = c.get('auth');
  const id = c.req.param('id');
  const order = await getOrderDetail(c.env.DB, auth, id);
  const check = order.flow_on ? await khoCheck(c.env.DB, auth, id) : null;
  const bills = await c.env.DB.prepare(
    `SELECT id, amount, paid_at, method, payment_id, created_at FROM bills
     WHERE order_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
  )
    .bind(id)
    .all();
  return ok(c, { order, kho_check: check?.lines ?? null, bills: bills.results ?? [] });
});

/** Hồ sơ khách theo ID: thông tin chính, công nợ, đơn gần đây, việc đang mở. */
agentRoutes.get('/customers/:id', requirePermission('agent.read'), async (c) => {
  needScope(c, 'debts');
  const id = c.req.param('id');
  const customer = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.owner_id, c.stage, c.price_mode, c.tier_id, c.last_order_date,
            c.reorder_cycle_days, c.credit_limit
     FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL`,
  )
    .bind(id)
    .first();
  if (!customer) throw notFound('Không tìm thấy khách hàng');
  const [debt, orders, tasks] = await Promise.all([
    getCustomerDebt(c.env.DB, id),
    c.env.DB.prepare(
      `SELECT id, order_no, order_date, total_amount, approval_status, delivery_status, accounting_status, kho_status
       FROM orders WHERE customer_id = ? AND deleted_at IS NULL ORDER BY order_date DESC LIMIT 20`,
    )
      .bind(id)
      .all(),
    c.env.DB.prepare(
      `SELECT id, type, title, due_at, status, priority FROM tasks WHERE customer_id = ? AND status = 'OPEN'
       ORDER BY due_at LIMIT 20`,
    )
      .bind(id)
      .all(),
  ]);
  return ok(c, { customer, debt, orders: orders.results ?? [], open_tasks: tasks.results ?? [] });
});

/* ---------- CRM B2B: khách, công nợ toàn công ty, tiền thu (phạm vi debts) ---------- */

/** Tìm khách theo tên hoặc mã. ?q=tên&limit=30 */
agentRoutes.get('/customers', requirePermission('agent.read'), async (c) => {
  needScope(c, 'debts');
  const q = (c.req.query('q') ?? '').trim();
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 30)) || 30), 100);
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const rows = await c.env.DB.prepare(
    `SELECT c.id, c.name, u.display_name AS owner_name, c.stage, c.tier_id, c.credit_limit, c.last_order_date, c.reorder_cycle_days
     FROM customers c LEFT JOIN users u ON u.id = c.owner_id
     WHERE c.deleted_at IS NULL AND (? = '' OR c.name LIKE ? OR c.id = ?)
     ORDER BY c.name COLLATE NOCASE LIMIT ?`,
  )
    .bind(q, like, q, limit)
    .all();
  return ok(c, rows.results ?? []);
});

/**
 * Doanh số đơn B2B theo khách và khoảng ngày (mọi đơn chưa hủy, kể cả đã kế toán xác nhận), có tổng theo tháng.
 * ?customer=<tên hoặc mã khách> &from=YYYY-MM-DD &to=YYYY-MM-DD. Cần quyền Đơn hàng (có tiền).
 */
agentRoutes.get('/sales', requirePermission('agent.read'), async (c) => {
  needScope(c, 'orders');
  const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!isDay(from) || !isDay(to)) throw badRequest('BAD_RANGE', 'Cần from và to dạng YYYY-MM-DD');
  const q = (c.req.query('customer') ?? '').trim().replace(/[%_]/g, '').slice(0, 80);
  const like = `%${q}%`;
  const rows = await c.env.DB.prepare(
    `SELECT o.order_no, o.order_date, c.id AS customer_id, c.name AS customer_name, o.total_amount, o.approval_status, o.delivery_status,
            o.payment_status, o.accounting_status
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.deleted_at IS NULL AND o.approval_status <> 'CANCELLED' AND o.order_date >= ?1 AND o.order_date <= ?2
       AND (?3 = '' OR c.name LIKE ?4 OR c.id = ?3)
     ORDER BY o.order_date, o.order_no LIMIT 1000`,
  )
    .bind(from, to, q, like)
    .all<{ order_date: string; total_amount: number; customer_name: string; customer_id: string }>();
  const list = rows.results ?? [];
  const byMonth: Record<string, { orders: number; total: number }> = {};
  const byCustomer: Record<string, { orders: number; total: number }> = {};
  let total = 0;
  for (const r of list) {
    const m = String(r.order_date).slice(0, 7);
    (byMonth[m] ??= { orders: 0, total: 0 }).orders++;
    byMonth[m].total += r.total_amount ?? 0;
    (byCustomer[r.customer_name] ??= { orders: 0, total: 0 }).orders++;
    byCustomer[r.customer_name].total += r.total_amount ?? 0;
    total += r.total_amount ?? 0;
  }
  return ok(c, { from, to, orders: list.length, total, by_month: byMonth, by_customer: byCustomer, list }, { truncated: list.length >= 1000 });
});

/** Tra sản phẩm theo tên hoặc mã (để lên đơn không phải đoán mã). ?q=chữ &tier=<mã cấp giá> (có thì kèm đơn giá hiện hành của cấp đó). */
agentRoutes.get('/products', requirePermission('agent.read'), async (c) => {
  needScope(c, 'orders');
  const q = (c.req.query('q') ?? '').trim().replace(/[%_]/g, '').slice(0, 60);
  const tier = (c.req.query('tier') ?? '').trim();
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 30)) || 30), 100);
  const like = `%${q}%`;
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const rows = await c.env.DB.prepare(
    `SELECT p.id, p.sku, p.name, p.unit, p.pack_size, g.name AS group_name,
       (SELECT pp.amount FROM product_prices pp WHERE pp.product_id = p.id AND pp.tier_id = ?1 AND pp.status IN ('ACTIVE', 'LOCKED')
          AND pp.valid_from <= ?2 AND (pp.valid_to IS NULL OR pp.valid_to >= ?2) ORDER BY pp.valid_from DESC, pp.version DESC LIMIT 1) AS price
     FROM products p LEFT JOIN product_groups g ON g.id = p.group_id
     WHERE p.deleted_at IS NULL AND p.active = 1 AND (?3 = '' OR p.name LIKE ?4 OR p.sku LIKE ?4)
     ORDER BY p.name COLLATE NOCASE LIMIT ?5`,
  )
    .bind(tier || null, today, q, like, limit)
    .all();
  return ok(c, rows.results ?? []);
});

/** Công nợ toàn công ty: ?loc=vuot (vượt hạn mức) | co-no (đang nợ). Kèm tổng. */
agentRoutes.get('/debts', requirePermission('agent.read'), async (c) => {
  needScope(c, 'debts');
  const loc = c.req.query('loc');
  const list = await listDebts(c.env.DB, '1=1', [], { onlyExceeded: loc === 'vuot', onlyWithDebt: loc === 'co-no' });
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 50)) || 50), 200);
  return ok(c, list.slice(0, limit), { totals: totalDebts(list), total_rows: list.length });
});

/** Phiếu thu tiền khách. ?pending=1 (chưa kế toán xác nhận) &customer_id=...&limit=... */
agentRoutes.get('/payments', requirePermission('agent.read'), async (c) => {
  needScope(c, 'debts');
  const items = await listPayments(c.env.DB, '1=1', [], {
    customerId: c.req.query('customer_id') ?? undefined,
    pendingOnly: c.req.query('pending') === '1',
    limit: Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 50)) || 50), 200),
  });
  return ok(c, items);
});

/** Mã đang thiếu của các đơn chờ kho / giữ chờ hàng, gom theo mã (cho đề xuất sản xuất). */
agentRoutes.get('/shortages', requirePermission('agent.read'), async (c) => {
  needScope(c, 'orders', 'orders_kho', 'kho');
  const s = await flowSummary(c.env.DB, c.get('auth'));
  return ok(c, s.shortages);
});

/** Cảnh báo kho: dưới mức tối thiểu, tồn âm, pha chế lệch định mức. */
agentRoutes.get('/kho/alerts', requirePermission('agent.read'), async (c) => {
  needScope(c, 'kho');
  return ok(c, await khoAlerts(c.env.DB));
});

/** Tồn hiện tại theo mã kho. Lọc: cls (NVL = Kho vật tư, TP, BTP, HH, COMBO, CCDC), q (tên hoặc mã), neg=1 (chỉ tồn âm), nonzero=1 (chỉ tồn khác 0), limit (mặc định 200). */
agentRoutes.get('/kho/stock', requirePermission('agent.read'), async (c) => {
  needScope(c, 'kho');
  const cls = c.req.query('cls') || null;
  const q = (c.req.query('q') ?? '').trim().slice(0, 60);
  const neg = c.req.query('neg') === '1';
  const nonzero = c.req.query('nonzero') === '1';
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 200)) || 200), 2000);
  const where = ['i.active = 1', '(? IS NULL OR i.cls = ?)'];
  const params: unknown[] = [cls, cls];
  if (q) {
    where.push('(i.name LIKE ? OR i.code LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (neg) where.push('COALESCE(s.qty, 0) < 0');
  if (nonzero) where.push('ABS(COALESCE(s.qty, 0)) > 0.0000005');
  const rows = await c.env.DB.prepare(
    `SELECT i.code, i.name, i.unit, i.cls, i.min_stock, ROUND(COALESCE(s.qty, 0), 6) AS qty
     FROM kho_items i LEFT JOIN (SELECT item, SUM(qty) AS qty FROM kho_ledger GROUP BY item) s ON s.item = i.code
     WHERE ${where.join(' AND ')}
     ORDER BY ${neg ? 'COALESCE(s.qty, 0) ASC, ' : ''}i.code LIMIT 2000`,
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  const all = rows.results ?? [];
  return ok(c, all.slice(0, limit), { total: all.length, shown: Math.min(all.length, limit) });
});

/** Nhập – xuất – tồn trong kỳ (giống trang Kho vật tư → Nhập – xuất – tồn). Lọc cls, q; chỉ mã có phát sinh hoặc còn tồn. */
agentRoutes.get('/kho/nxt', requirePermission('agent.read'), async (c) => {
  needScope(c, 'kho');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!isDay(from) || !isDay(to)) throw badRequest('BAD_RANGE', 'Cần from và to dạng YYYY-MM-DD');
  const cls = c.req.query('cls') || null;
  const q = (c.req.query('q') ?? '').trim().slice(0, 60);
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 200)) || 200), 1000);
  const rows = await c.env.DB.prepare(
    `SELECT l.item AS code, COALESCE(i.name, l.item) AS name, i.unit AS unit, i.cls AS cls,
       ROUND(SUM(CASE WHEN l.doc_date < ?1 THEN l.qty ELSE 0 END), 6) AS opening,
       ROUND(SUM(CASE WHEN l.doc_date >= ?1 AND l.doc_date <= ?2 AND l.qty > 0 THEN l.qty ELSE 0 END), 6) AS qty_in,
       ROUND(SUM(CASE WHEN l.doc_date >= ?1 AND l.doc_date <= ?2 AND l.qty < 0 THEN -l.qty ELSE 0 END), 6) AS qty_out,
       ROUND(SUM(CASE WHEN l.doc_date <= ?2 THEN l.qty ELSE 0 END), 6) AS closing
     FROM kho_ledger l LEFT JOIN kho_items i ON i.code = l.item
     WHERE (?3 IS NULL OR i.cls = ?3) AND (?4 = '' OR i.name LIKE ?5 OR l.item LIKE ?5)
     GROUP BY l.item
     HAVING ABS(opening) > 0.0000005 OR qty_in > 0.0000005 OR qty_out > 0.0000005 OR ABS(closing) > 0.0000005
     ORDER BY l.item`,
  )
    .bind(from, to, cls, q, `%${q}%`)
    .all<Record<string, unknown>>();
  const all = rows.results ?? [];
  return ok(c, all.slice(0, limit), { total: all.length, shown: Math.min(all.length, limit), from, to });
});

/** Phiếu kho gần đây: KS kiểm kê · XB xuất B2B · XK xuất khác · PN nhập · PC pha chế · TL, TD. Chỉ đọc, không có đơn giá. */
const KHO_DOC_TYPES = ['PN', 'PC', 'KS', 'XB', 'XK', 'TL', 'TD'];
agentRoutes.get('/kho/docs', requirePermission('agent.read'), async (c) => {
  needScope(c, 'kho');
  const type = c.req.query('type');
  if (type && !KHO_DOC_TYPES.includes(type)) throw badRequest('BAD_TYPE', 'Loại phiếu không đúng');
  const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const from = c.req.query('from');
  const to = c.req.query('to');
  const q = (c.req.query('q') ?? '').trim().slice(0, 60);
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 50)) || 50), 200);
  const where: string[] = [];
  const params: unknown[] = [];
  if (type) {
    where.push('d.type = ?');
    params.push(type);
  }
  if (isDay(from)) {
    where.push('d.doc_date >= ?');
    params.push(from);
  }
  if (isDay(to)) {
    where.push('d.doc_date <= ?');
    params.push(to);
  }
  if (q) {
    where.push('(d.no LIKE ? OR d.partner LIKE ? OR d.ref_no LIKE ? OR d.note LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = await c.env.DB.prepare(
    `SELECT d.id, d.no, d.type, d.doc_date, d.partner, d.ref_no, d.ref_qty, d.note, d.status,
       (SELECT COUNT(*) FROM kho_moves m WHERE m.doc_id = d.id) AS n_lines
     FROM kho_docs d ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY d.doc_date DESC, d.id DESC LIMIT ?`,
  )
    .bind(...params, limit)
    .all<Record<string, unknown>>();
  return ok(c, rows.results ?? []);
});

agentRoutes.get('/kho/docs/:id', requirePermission('agent.read'), async (c) => {
  needScope(c, 'kho');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) throw badRequest('BAD_ID', 'Mã phiếu không đúng');
  const doc = await c.env.DB.prepare(
    'SELECT id, no, type, doc_date, partner, ref_no, ref_qty, note, status FROM kho_docs WHERE id = ?',
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!doc) throw notFound('Không có phiếu này');
  const lines = await c.env.DB.prepare(
    `SELECT m.item AS code, COALESCE(i.name, m.item) AS name, i.unit AS unit, i.cls AS cls, m.qty, m.role, m.note
     FROM kho_moves m LEFT JOIN kho_items i ON i.code = m.item WHERE m.doc_id = ? ORDER BY m.id`,
  )
    .bind(id)
    .all<Record<string, unknown>>();
  return ok(c, { ...doc, lines: lines.results ?? [] });
});

/**
 * Xuất B2C qua sàn (TikTok / Shopee / Facebook), giống trang Kho vật tư → Xuất B2C: từng ngày × kênh có số đơn,
 * sản phẩm lẻ bán (đã có mã + chưa có mã), tổng 7 ngày gần nhất và sản phẩm bán nhiều nhất. Không có tiền.
 */
agentRoutes.get('/kho/online', requirePermission('agent.read'), async (c) => {
  needScope(c, 'kho');
  const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const from = c.req.query('from');
  const to = c.req.query('to');
  const channel = (c.req.query('channel') ?? '').toUpperCase();
  if (channel && !['TIKTOK', 'SHOPEE', 'FACEBOOK'].includes(channel)) throw badRequest('BAD_CHANNEL', 'Kênh phải là TIKTOK, SHOPEE hoặc FACEBOOK');
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 60)) || 60), 400);
  const where: string[] = [];
  const params: unknown[] = [];
  if (channel) {
    where.push('r.channel = ?');
    params.push(channel);
  }
  if (isDay(from)) {
    where.push('r.day >= ?');
    params.push(from);
  }
  if (isDay(to)) {
    where.push('r.day <= ?');
    params.push(to);
  }
  const db = c.env.DB;
  const days = await db
    .prepare(
      `SELECT r.channel, r.day, r.orders,
         COALESCE((SELECT SUM(qty) FROM channel_out o WHERE o.channel = r.channel AND o.day = r.day), 0) AS qty_co_ma,
         COALESCE((SELECT SUM(qty) FROM channel_unmapped u WHERE u.channel = r.channel AND u.day = r.day), 0) AS qty_chua_co_ma
       FROM channel_runs r ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY r.day DESC, r.channel LIMIT ?`,
    )
    .bind(...params, limit)
    .all<{ channel: string; day: string; orders: number; qty_co_ma: number; qty_chua_co_ma: number }>();
  const rows = (days.results ?? []).map((r) => ({
    day: r.day,
    channel: r.channel,
    orders: r.orders,
    san_pham: r.qty_co_ma + r.qty_chua_co_ma,
    chua_co_ma_vat_tu: r.qty_chua_co_ma,
  }));
  // 7 ngày gần nhất có dữ liệu (như các ô tổng trên trang), tính trên toàn bộ kênh dù có lọc ngày hay không
  const recent = await db.prepare('SELECT DISTINCT day FROM channel_runs ORDER BY day DESC LIMIT 7').all<{ day: string }>();
  const rd = (recent.results ?? []).map((r) => r.day);
  const sum7: Record<string, { orders: number; san_pham: number; chua_co_ma_vat_tu: number }> = {};
  if (rd.length) {
    const ph = rd.map(() => '?').join(',');
    const s = await db
      .prepare(
        `SELECT r.channel, SUM(r.orders) AS orders,
           SUM(COALESCE((SELECT SUM(qty) FROM channel_out o WHERE o.channel = r.channel AND o.day = r.day), 0)
             + COALESCE((SELECT SUM(qty) FROM channel_unmapped u WHERE u.channel = r.channel AND u.day = r.day), 0)) AS san_pham,
           SUM(COALESCE((SELECT SUM(qty) FROM channel_unmapped u WHERE u.channel = r.channel AND u.day = r.day), 0)) AS chua
         FROM channel_runs r WHERE r.day IN (${ph}) GROUP BY r.channel`,
      )
      .bind(...rd)
      .all<{ channel: string; orders: number; san_pham: number; chua: number }>();
    for (const r of s.results ?? []) sum7[r.channel] = { orders: r.orders, san_pham: r.san_pham, chua_co_ma_vat_tu: r.chua };
  }
  const top = await db
    .prepare(
      `SELECT o.channel, o.item AS code, i.name, i.unit, ROUND(SUM(o.qty), 0) AS qty
       FROM channel_out o LEFT JOIN kho_items i ON i.code = o.item
       WHERE o.day >= date('now', '+7 hours', '-13 days')
       GROUP BY o.channel, o.item ORDER BY qty DESC LIMIT 30`,
    )
    .all<Record<string, unknown>>();
  const total = (k: 'orders' | 'san_pham' | 'chua_co_ma_vat_tu') => Object.values(sum7).reduce((a, v) => a + (v[k] ?? 0), 0);
  return ok(c, {
    tong_7_ngay_gan_nhat: {
      cac_ngay: rd,
      theo_kenh: sum7,
      san_pham_le_ban: total('san_pham'),
      chua_co_ma_vat_tu: total('chua_co_ma_vat_tu'),
    },
    theo_ngay: rows,
    top_14_ngay_co_ma: top.results ?? [],
  });
});

/** Lô kiểm kê đóng gói và tem (module Sản xuất): trạng thái, số đạt/lỗi/chờ, số tem đã tạo và đã in. Chỉ đọc. */
const LOT_STATUS: Record<string, string> = {
  CHO_KIEM: 'Chờ kiểm kê',
  DA_KIEM: 'Đã kiểm, chờ phân bổ',
  TEM_SAN: 'Đã tạo tem, chờ in',
  DA_IN: 'Đã in tem',
  SAN_SANG: 'Đã nhập kho / bàn giao',
  HUY: 'Đã hủy',
};
agentRoutes.get('/kho/lots', requirePermission('agent.read'), async (c) => {
  needScope(c, 'kho');
  const st = c.req.query('st');
  if (st && !LOT_STATUS[st]) throw badRequest('BAD_STATUS', 'Trạng thái lô không đúng');
  const q = (c.req.query('q') ?? '').trim().toLowerCase().slice(0, 60);
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 30)) || 30), 200);
  const row = await c.env.DB.prepare("SELECT data FROM hub_state WHERE id = 'sx'").first<{ data: string }>();
  if (!row) return ok(c, [], { total: 0, shown: 0, by_status: {} });
  type Cont = { c?: string; loai?: string; sl?: number; viTri?: string; st?: string; in?: unknown[] };
  type Batch = {
    id?: string; ma?: string; sp?: string; ngay?: string; baoSL?: number; tong?: number; dat?: number; loi?: number;
    cho?: number; ghiChu?: string; lechLyDo?: string; kiemBy?: string; kiemLuc?: string; st?: string; containers?: Cont[];
  };
  const sx = JSON.parse(await unpack(row.data)) as { batches?: Batch[]; products?: { ma: string; ten: string }[] };
  const names = new Map((sx.products ?? []).map((p) => [p.ma, p.ten]));
  const all = (sx.batches ?? []).filter((b) => b.ma);
  const byStatus: Record<string, number> = {};
  for (const b of all) byStatus[b.st ?? '?'] = (byStatus[b.st ?? '?'] ?? 0) + 1;
  const picked = all
    .filter((b) => (!st || b.st === st) && (!q || `${b.ma} ${b.sp} ${names.get(b.sp ?? '') ?? ''}`.toLowerCase().includes(q)))
    .sort((a, b) => String(b.ngay ?? '').localeCompare(String(a.ngay ?? '')));
  const items = picked.slice(0, limit).map((b) => {
    const conts = (b.containers ?? []).filter((x) => x.st === 'OK');
    return {
      ma: b.ma,
      sp: b.sp,
      ten: names.get(b.sp ?? '') ?? null,
      ngay: b.ngay,
      st: b.st,
      trang_thai: LOT_STATUS[b.st ?? ''] ?? b.st,
      xuong_bao: b.baoSL,
      tong_kiem: b.tong,
      dat: b.dat,
      loi: b.loi,
      cho: b.cho,
      ghi_chu: b.ghiChu || null,
      ly_do_lech: b.lechLyDo || null,
      nguoi_kiem: b.kiemBy || null,
      kiem_luc: b.kiemLuc || null,
      tem_da_tao: conts.length,
      tem_da_in: conts.filter((x) => (x.in ?? []).length > 0).length,
      vat_chua: conts.slice(0, 30).map((x) => ({ ma: x.c, loai: x.loai, sl: x.sl, vi_tri: x.viTri, da_in: (x.in ?? []).length })),
    };
  });
  return ok(c, items, { total: picked.length, shown: items.length, by_status: byStatus });
});

/** Dòng sự kiện theo con trỏ id: agent nhớ id lớn nhất đã xử lý rồi hỏi tiếp từ đó. */
const EVENT_PREFIXES: Record<string, string[]> = {
  orders: ['ORDER_', 'SHIP_', 'DELIVERY_', 'RETURN_', 'PROPOSAL_'],
  orders_kho: ['ORDER_', 'SHIP_', 'RETURN_', 'KHO_'],
  debts: ['CUSTOMER_', 'PAYMENT_', 'BILL_'],
  kho: ['KHO_', 'ALERT_', 'RETURN_'],
};
agentRoutes.get('/events', requirePermission('agent.read'), async (c) => {
  const allowed = [...new Set(scopesOf(c).flatMap((x) => EVENT_PREFIXES[x] ?? []))];
  if (!allowed.length) throw forbidden('Agent này chưa được phép đọc mục này');
  const after = Math.max(0, Math.floor(Number(c.req.query('after') ?? 0)) || 0);
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 100)) || 100), 500);
  const types = (c.req.query('types') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
  const where = ['id > ?', `(${allowed.map(() => 'type LIKE ?').join(' OR ')})`];
  const params: unknown[] = [after, ...allowed.map((p) => p + '%')];
  if (types.length) {
    where.push(`type IN (${types.map(() => '?').join(',')})`);
    params.push(...types);
  }
  const rows = await c.env.DB.prepare(
    `SELECT id, at, type, entity_type, entity_id, actor_id, actor_type, payload_json
     FROM events WHERE ${where.join(' AND ')} ORDER BY id ASC LIMIT ?`,
  )
    .bind(...params, limit)
    .all<{ id: number; payload_json: string | null } & Record<string, unknown>>();
  const items = (rows.results ?? []).map((r) => ({
    ...r,
    payload: r.payload_json ? JSON.parse(r.payload_json) : null,
    payload_json: undefined,
  }));
  return ok(c, items, { next_cursor: items.length ? items[items.length - 1].id : after });
});


/** Phiếu pha chế gần đây: mẻ nào, dùng nguyên liệu gì, lệch định mức bao nhiêu (chỉ đọc). */
agentRoutes.get('/kho/pha-che', requirePermission('agent.read'), async (c) => {
  needScope(c, 'kho');
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 20)) || 20), 50);
  const docs = await c.env.DB.prepare(
    `SELECT id, no, doc_date, ref_no, ref_qty, note, status FROM kho_docs WHERE type = 'PC' ORDER BY doc_date DESC, id DESC LIMIT ?`,
  )
    .bind(limit)
    .all<{ id: number; no: string; doc_date: string; ref_no: string; ref_qty: number | null; note: string; status: string }>();
  const ids = (docs.results ?? []).map((d) => d.id);
  const moves = ids.length
    ? await c.env.DB.prepare(
        `SELECT m.doc_id, m.item, i.name, i.unit, m.role, ROUND(-m.qty, 6) AS actual_or_qty, m.std_qty
         FROM kho_moves m JOIN kho_items i ON i.code = m.item
         WHERE m.doc_id IN (${ids.map(() => '?').join(',')}) ORDER BY m.id`,
      )
        .bind(...ids)
        .all<Record<string, unknown>>()
    : { results: [] as Record<string, unknown>[] };
  const by = new Map<number, Record<string, unknown>[]>();
  for (const m of moves.results ?? []) {
    const k = m.doc_id as number;
    (by.get(k) ?? by.set(k, []).get(k)!).push(m);
  }
  return ok(c, (docs.results ?? []).map((d) => ({ ...d, lines: by.get(d.id) ?? [] })));
});

/** Đọc bản chung của khu Marketing (thẻ video, order Digital...), đã gói nén trong D1. Chỉ lấy phần cần, không lấy tài chính/nhân sự. */
async function hubData(c: { env: { DB: D1Database } }): Promise<Record<string, unknown>> {
  const row = await c.env.DB.prepare(`SELECT data FROM hub_state WHERE id = 'main'`).first<{ data: string }>();
  if (!row) return {};
  return JSON.parse(await unpack(row.data)) as Record<string, unknown>;
}
const cut = (v: unknown, n = 160) => (typeof v === 'string' ? v.slice(0, n) : v);
const STEP_NAMES: Record<string, string> = {
  cg: 'Chưa giao', kb: 'Viết kịch bản', dkb: 'Người duyệt kịch bản', quay: 'Chờ quay', edit: 'Đang edit',
  worker: 'Worker đang dựng', dvd: 'Người duyệt video', dceo: 'CEO duyệt video', dang: 'Chờ đăng', xong: 'Đã đăng',
};

/** Thẻ video của team Content: kênh, sản phẩm, bước hiện tại, người làm, hạn. ?step=kb&kenh=...&limit=... */
agentRoutes.get('/mkt/cards', requirePermission('agent.read'), async (c) => {
  needScope(c, 'mkt_content');
  const d = await hubData(c);
  const users = new Map(((d.users as Array<{ id: string; name?: string }>) ?? []).map((u) => [u.id, u.name ?? u.id]));
  const step = c.req.query('step');
  const kenh = c.req.query('kenh');
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 60)) || 60), 200);
  const cards = ((d.cards as Array<Record<string, unknown>>) ?? [])
    .filter((x) => (!step || x.step === step) && (!kenh || x.kenh === kenh))
    .slice(-limit)
    .map((x) => ({
      id: x.id, kenh: x.kenh, sku: x.sku, buoc: STEP_NAMES[String(x.step)] ?? x.step, step: x.step, ngay: x.day,
      uu_tien: x.uuTien, nguon: x.nguon, nguoi: users.get(String(x.nguoi)) ?? x.nguoi ?? '', y_tuong: cut(x.yTuong),
      order: x.order || null, co_video: !!x.linkFinal || !!x.linkVideo, da_dang: !!x.linkDang, view: x.view, don: x.don,
    }));
  const count: Record<string, number> = {};
  for (const x of (d.cards as Array<Record<string, unknown>>) ?? []) count[String(x.step)] = (count[String(x.step)] ?? 0) + 1;
  return ok(c, cards, { so_the_theo_buoc: count });
});

/** Order Digital (yêu cầu video quảng cáo) và số quảng cáo mới nhất, cho team Digital. */
agentRoutes.get('/mkt/orders', requirePermission('agent.read'), async (c) => {
  needScope(c, 'mkt_digital');
  const d = await hubData(c);
  const users = new Map(((d.users as Array<{ id: string; name?: string }>) ?? []).map((u) => [u.id, u.name ?? u.id]));
  const orders = ((d.orders as Array<Record<string, unknown>>) ?? []).slice(-100).map((o) => ({
    ma: o.ma, ngay: o.ngay, kenh: o.kenh, sku: o.sku, muc: cut(o.muc), so_luong: o.sl, han: o.han,
    trang_thai: o.trangThai, nguoi_order: users.get(String(o.nguoiOrder)) ?? o.nguoiOrder, giao_cho: users.get(String(o.giao)) ?? o.giao,
    chi: o.chi, don_ads: o.donAds, dt_ads: o.dtAds,
  }));
  return ok(c, orders);
});

agentRoutes.get('/mkt/ads', requirePermission('agent.read'), async (c) => {
  needScope(c, 'mkt_digital');
  const row = await c.env.DB.prepare(`SELECT data FROM hub_blobs WHERE key = 'ads_live' AND admin_only = 0`).first<{ data: string }>();
  if (!row) return ok(c, { at: null, tabs: {} });
  const blob = JSON.parse(await unpack(row.data)) as { at?: string; tabs?: Record<string, unknown> };
  // Mỗi tab (một người chạy Ads) chỉ lấy phần cuối cho gọn.
  const tabs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(blob.tabs ?? {})) tabs[k] = Array.isArray(v) ? v.slice(-40) : v;
  return ok(c, { at: blob.at ?? null, tabs });
});

/** Công xưởng SX video: việc dựng video đang chạy, chờ duyệt, xong, lỗi (không kèm kịch bản hay link riêng). */
agentRoutes.get('/xuong', requirePermission('agent.read'), async (c) => {
  needScope(c, 'xuong');
  const limit = Math.min(Math.max(1, Math.floor(Number(c.req.query('limit') ?? 60)) || 60), 150);
  const rows = await c.env.DB.prepare(
    `SELECT id, kind, ref, status, progress, detail, worker_job, payload, created_at, updated_at
     FROM worker_tasks WHERE kind LIKE 'xuong%' OR kind LIKE 'card%' ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(limit)
    .all<{ id: string; kind: string; ref: string | null; status: string; progress: number; detail: string | null; worker_job: string | null; payload: string; created_at: string; updated_at: string }>();
  return ok(
    c,
    (rows.results ?? []).map((r) => {
      let p: { label?: string; by?: string; order?: { mode?: string; sku?: string } } = {};
      try {
        p = JSON.parse(r.payload || '{}');
      } catch {
        p = {};
      }
      return {
        id: r.id, loai: r.kind, ma: r.worker_job || r.ref, trang_thai: r.status, tien_do: r.progress, ghi_chu: cut(r.detail),
        nhan: cut(p.label), nguoi_dat: p.by ?? null, che_do: p.order?.mode ?? null, san_pham: p.order?.sku ?? null,
        tao_luc: r.created_at, cap_nhat: r.updated_at,
      };
    }),
  );
});

const proposalSchema = z.object({
  kind: z.string().trim().min(1),
  route_to: z.string().trim().min(1),
  entity_type: z.string().trim().min(1),
  entity_id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional().nullable(),
  payload: z.unknown().optional(),
  dedupe_key: z.string().trim().min(1).max(160),
  expires_at: z.string().trim().max(40).optional().nullable(),
});

const PHIEU_CHI_RE = /phi[eế]u\s+chi/i;

/** Agent ghi đề xuất. Gọi lại cùng dedupe_key thì trả đề xuất cũ (duplicate = true), không tạo thêm. */
agentRoutes.post('/proposals', requirePermission('agent.propose'), async (c) => {
  const auth = c.get('auth');
  const raw = await c.req.json().catch(() => null);
  if (!raw) throw badRequest('BAD_JSON', 'Dữ liệu gửi lên không đúng định dạng');
  const parsed = proposalSchema.safeParse(raw);
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  // Agent đã được lập phiếu chi thì không đẻ thẻ đề xuất "lập phiếu chi" nữa (ngày 24/10 ra 3 thẻ trùng cho một khoản cước).
  if (auth.permissions.includes(AGENT_PHIEU_CHI) && PHIEU_CHI_RE.test(`${parsed.data.title} ${parsed.data.body ?? ''}`)) {
    throw new AppError(
      409,
      'USE_PHIEU_CHI',
      'Agent này lập phiếu chi trực tiếp được khi chị Thảo ra lệnh (lệnh ghi có giấy ủy quyền), không gửi đề xuất phiếu chi. Không có lệnh thì báo người nhắn tự ghi phiếu.',
    );
  }
  const result = await createProposal(c.env.DB, auth, parsed.data, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, result, undefined, result.duplicate ? 200 : 201);
});

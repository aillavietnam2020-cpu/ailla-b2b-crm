import { Hono } from 'hono';
import { z } from 'zod';
import { AGENT_SCOPE_PREFIX, AGENT_SCOPES, policyFor } from '@shared/agent';
import { KHO_WAITING } from '@shared/flow';
import type { KhoStatus } from '@shared/flow';
import type { AppEnv } from '../env';
import { badRequest, forbidden, notFound, ok, unprocessable } from '../lib/http';
import { clientIp } from '../lib/audit';
import { requirePermission } from '../middleware/rbac';
import { zodFieldErrors } from '@shared/schemas';
import { getOrderDetail } from '../services/orders';
import { flowSummary, khoCheck } from '../services/orderFlow';
import { getCustomerDebt } from '../services/debts';
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
  return ok(
    c,
    (rows.results ?? []).map((r) => ({
      ...r,
      waiting_for: r.flow_on ? KHO_WAITING[(r.kho_status as KhoStatus) ?? 'KHONG'] : null,
    })),
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

/** Tồn hiện tại theo mã kho (có thể lọc theo lớp NVL/BTP/TP). */
agentRoutes.get('/kho/stock', requirePermission('agent.read'), async (c) => {
  needScope(c, 'kho');
  const cls = c.req.query('cls');
  const rows = await c.env.DB.prepare(
    `SELECT i.code, i.name, i.unit, i.cls, i.min_stock, ROUND(COALESCE(s.qty, 0), 6) AS qty
     FROM kho_items i LEFT JOIN (SELECT item, SUM(qty) AS qty FROM kho_ledger GROUP BY item) s ON s.item = i.code
     WHERE i.active = 1 AND (? IS NULL OR i.cls = ?)
     ORDER BY i.code LIMIT 2000`,
  )
    .bind(cls ?? null, cls ?? null)
    .all();
  return ok(c, rows.results ?? []);
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

/** Agent ghi đề xuất. Gọi lại cùng dedupe_key thì trả đề xuất cũ (duplicate = true), không tạo thêm. */
agentRoutes.post('/proposals', requirePermission('agent.propose'), async (c) => {
  const auth = c.get('auth');
  const raw = await c.req.json().catch(() => null);
  if (!raw) throw badRequest('BAD_JSON', 'Dữ liệu gửi lên không đúng định dạng');
  const parsed = proposalSchema.safeParse(raw);
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const result = await createProposal(c.env.DB, auth, parsed.data, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, result, undefined, result.duplicate ? 200 : 201);
});

import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import { AGENT_ROSTER } from '@shared/agentRoster';
import type { AppEnv, AuthContext } from '../env';
import { ok } from '../lib/http';
import { listProposals } from '../services/proposals';

/**
 * "Thông báo của tôi" (chị Hoa giao 30/10/2026): trình duyệt hỏi khoảng 45–60 giây một lần, chỉ lấy cái MỚI từ mốc `since`
 * (ISO) / `after` (mã tin agent). Trả dòng thô cùng dạng các API trang Phê duyệt đang dùng để trình duyệt lọc quyền bằng
 * đúng pdBuild (pdcalc.js). Máy chủ chỉ trả loại người này có quyền xem, cùng quy tắc với API gốc của từng loại.
 * Chỉ đọc, không ghi gì. Mỗi truy vấn có `created_at > since` + LIMIT nên rất nhẹ.
 */
export const notifyRoutes = new Hono<AppEnv>();

const LIMIT = 30;
const MAX_BACK_MS = 24 * 3_600_000; // mở lại web sau lâu: chỉ báo việc mới trong 24 giờ gần nhất

/** Mốc hợp lệ: ISO, không xa quá 24 giờ. Không có mốc → bây giờ (lần đầu không báo dồn việc cũ). */
export function clampSince(raw: string | undefined, now = Date.now()): string {
  const t = raw ? Date.parse(raw) : NaN;
  const min = now - MAX_BACK_MS;
  return new Date(Number.isFinite(t) ? Math.min(now, Math.max(min, t)) : now).toISOString();
}

type Rows = Record<string, unknown>[];

async function collect(db: D1Database, auth: AuthContext, since: string, after: number) {
  const can = (p: string) => auth.permissions.includes(p);
  const ceo = auth.user.role === 'CEO';
  const apN = can('order.approve.normal');
  const apX = can('order.approve.exception');
  const kt = can('order.accounting.confirm');
  const all = async (sql: string, ...b: unknown[]): Promise<Rows> => (await db.prepare(sql).bind(...b).all<Record<string, unknown>>()).results ?? [];
  const out: Record<string, Rows> = {};

  // Tin agent trả lời / chủ động nhắn trong cuộc trò chuyện CỦA MÌNH (Điều hành agent, Hội thoại).
  const names = new Map(AGENT_ROSTER.map((a) => [a.id, a.name]));
  const ag = after >= 0
    ? await all(
        `SELECT id, agent, body, created_at FROM agent_chat WHERE owner_id = ? AND role = 'AGENT' AND source <> 'TELEGRAM' AND id > ? ORDER BY id LIMIT ${LIMIT}`,
        auth.user.id, after,
      )
    : [];
  out.agent = ag.map((m) => ({ ...m, agent_name: names.get(String(m.agent)) ?? String(m.agent), body: String(m.body ?? '').slice(0, 300) }));
  const last = await db.prepare('SELECT MAX(id) AS id FROM agent_chat WHERE owner_id = ?').bind(auth.user.id).first<{ id: number | null }>();

  // Đề xuất của agent: máy chủ đã lọc người duyệt (canReview).
  out.proposals = (await listProposals(db, auth, { status: 'PENDING', limit: 50 })).filter((p) => p.created_at > since).map((p) => ({ ...p, payload: null }));

  if (apN || apX) {
    out.approvals = await all(
      `SELECT a.id, a.status, a.required_role, a.entity_type, a.entity_id, a.reason, a.created_at, r.display_name AS requester_name,
              trim(COALESCE(o.order_no, '') || CASE WHEN COALESCE(c.name, tc.name) IS NOT NULL THEN ' · ' || COALESCE(c.name, tc.name) ELSE '' END, ' ·') AS entity_label,
              o.total_amount AS order_total
       FROM approvals a JOIN users r ON r.id = a.requester_id
       LEFT JOIN orders o ON o.id = a.entity_id AND a.entity_type = 'ORDER' LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN customers tc ON tc.id = a.entity_id AND a.entity_type = 'CUSTOMER_TIER'
       WHERE a.status = 'PENDING' AND a.created_at > ? ORDER BY a.created_at DESC LIMIT ${LIMIT}`,
      since,
    );
  }
  if (ceo || apN) {
    out.shipEdits = await all(
      `SELECT r.id, r.order_id, o.order_no, c.name AS customer_name, r.reason, r.status, r.requested_at, u.display_name AS requested_by_name
       FROM ship_edit_requests r JOIN orders o ON o.id = r.order_id JOIN customers c ON c.id = o.customer_id LEFT JOIN users u ON u.id = r.requested_by
       WHERE r.status = 'CHO_DUYET' AND r.requested_at > ? ORDER BY r.requested_at DESC LIMIT ${LIMIT}`,
      since,
    );
    out.gifts = await all(
      `SELECT g.id, g.voucher_no, cu.name AS customer_name, g.month, g.level_label, g.status, g.created_at
       FROM bonus_gift_vouchers g JOIN customers cu ON cu.id = g.customer_id
       WHERE g.status = 'CHO_DUYET' AND g.created_at > ? ORDER BY g.created_at DESC LIMIT ${LIMIT}`,
      since,
    );
    out.cash = await all(
      `SELECT v.id, v.voucher_no, cu.name AS customer_name, v.month, v.amount, v.note, v.status, v.created_at, v.created_by, v.ceo_status,
              u.display_name AS created_by_name
       FROM bonus_cash_vouchers v JOIN customers cu ON cu.id = v.customer_id LEFT JOIN users u ON u.id = v.created_by
       WHERE v.status = 'CHO_DUYET' AND v.created_at > ? ORDER BY v.created_at DESC LIMIT ${LIMIT}`,
      since,
    );
  }
  if (ceo) {
    // Khoản chi từ ngưỡng chờ CEO (giống /api/ceo-spend/pending).
    const ship = await all(
      `SELECT 'ship' AS kind, v.id, v.voucher_no AS no, v.voucher_date AS day, v.carrier AS title, v.destination AS sub, v.amount, v.created_at,
              u.display_name AS created_by_name
       FROM shipping_vouchers v LEFT JOIN users u ON u.id = v.created_by
       WHERE v.status = 'OK' AND v.ceo_status = 'CHO' AND v.created_at > ? ORDER BY v.created_at DESC LIMIT ${LIMIT}`,
      since,
    );
    const ncc = await all(
      `SELECT 'ncc' AS kind, p.id, o.no AS no, p.pay_date AS day, s.name AS title, p.note AS sub, p.amount, p.created_at, u.display_name AS created_by_name
       FROM po_payments p JOIN suppliers s ON s.id = p.supplier_id LEFT JOIN po_orders o ON o.id = p.po_id LEFT JOIN users u ON u.id = p.created_by
       WHERE p.status = 'OK' AND p.ceo_status = 'CHO' AND p.created_at > ? ORDER BY p.created_at DESC LIMIT ${LIMIT}`,
      since,
    );
    out.ceoSpend = [...ship, ...ncc];
  }
  if (kt) {
    out.payConfirm = await all(
      `SELECT p.id, c.name AS customer_name, p.amount, p.paid_at AS day, p.note, p.created_at AS entered_at, p.method, p.bank_ref, u.display_name AS entered_by
       FROM payments p JOIN customers c ON c.id = p.customer_id LEFT JOIN users u ON u.id = p.created_by
       WHERE p.accounting_status = 'CHUA_XAC_NHAN' AND p.is_adjustment = 0 AND p.created_at > ? ORDER BY p.created_at DESC LIMIT ${LIMIT}`,
      since,
    );
    out.returns = await all(
      `SELECT r.id, r.return_no, c.name AS customer_name, r.credit_amount, r.status, r.kho_at, r.created_at
       FROM order_returns r JOIN customers c ON c.id = r.customer_id
       WHERE r.status = 'DA_NHAN_KHO' AND r.kho_at > ? ORDER BY r.kho_at DESC LIMIT ${LIMIT}`,
      since,
    );
  }

  // Việc CRM giao cho tôi (chăm sóc khách, nhắc nợ, tái nhập…).
  out.crmTasks = await all(
    `SELECT t.id, t.title, t.type, t.due_at, t.priority, t.created_at, u.display_name AS created_by_name
     FROM tasks t LEFT JOIN users u ON u.id = t.created_by
     WHERE t.assignee_id = ? AND t.status = 'OPEN' AND t.created_at > ? AND COALESCE(t.created_by, '') <> ? ORDER BY t.created_at DESC LIMIT ${LIMIT}`,
    auth.user.id, since, auth.user.id,
  );
  return { ...out, agent_last: last?.id ?? 0 };
}

notifyRoutes.get('/mine', async (c) => {
  const now = nowIso();
  const since = clampSince(c.req.query('since'));
  // Chưa có mốc tin agent (lần đầu) thì -1: chỉ trả mốc mới nhất, không báo dồn tin cũ.
  const a = c.req.query('after');
  const after = a == null || a === '' ? -1 : Math.max(0, Math.floor(Number(a)) || 0);
  return ok(c, { now, since, ...(await collect(c.env.DB, c.get('auth'), since, after)) });
});

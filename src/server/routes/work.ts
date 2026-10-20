import { Hono } from 'hono';
import { vnDate } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { forbidden, ok } from '../lib/http';

/**
 * "Việc của tôi": việc đẩy thẳng tới từng người theo QUYỀN của họ (kế toán, quản lý duyệt, kho, sale), gom cả B2B lẫn B2C,
 * kèm việc đã tồn nhiều ngày. Tính trực tiếp từ dữ liệu thật, không phải ai giao tay, nên làm xong là tự mất.
 */
export const workRoutes = new Hono<AppEnv>();

export interface WorkItem {
  key: string;
  group: string;
  title: string;
  detail: string;
  count: number;
  amount?: number;
  oldest: string | null;
  age_days: number;
  page: string;
}

const dayDiff = (from: string | null, today: string) => {
  if (!from) return 0;
  const a = new Date(from.slice(0, 10) + 'T00:00:00Z').getTime();
  const b = new Date(today + 'T00:00:00Z').getTime();
  return Math.max(0, Math.round((b - a) / 864e5));
};

/** Gom việc theo quyền. asCeo = true: tính như CEO (toàn công ty), dùng cho màn "Toàn cảnh". */
async function collectItems(auth: AuthContext, db: D1Database, today: string, asCeo: boolean): Promise<WorkItem[]> {
  const can = (p: string) => auth.permissions.includes(p);
  const isCeo = asCeo || auth.user.role === 'CEO';
  const items: WorkItem[] = [];
  const add = (it: Omit<WorkItem, 'age_days'>) => {
    if (it.count > 0) items.push({ ...it, age_days: dayDiff(it.oldest, today) });
  };

  // ---- Kế toán
  if (isCeo || can('order.accounting.confirm')) {
    const pay = await db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amt, MIN(paid_at) AS oldest
         FROM payments WHERE accounting_status = 'CHUA_XAC_NHAN' AND is_adjustment = 0`,
      )
      .first<{ n: number; amt: number; oldest: string | null }>();
    add({ key: 'pay_confirm', group: 'Kế toán', title: 'Xác nhận tiền khách đã chuyển', detail: 'Đối chiếu bill rồi bấm xác nhận để trừ công nợ', count: pay?.n ?? 0, amount: pay?.amt ?? 0, oldest: pay?.oldest ?? null, page: 'bill' });
    const ord = await db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS amt, MIN(order_date) AS oldest
         FROM orders WHERE deleted_at IS NULL AND approval_status = 'APPROVED' AND delivery_status IN ('DA_XUAT_KHO', 'DA_GIAO')
           AND accounting_status = 'CHUA_XAC_NHAN' AND (flow_on = 0 OR kho_status = 'DA_CHOT_TIEN')`,
      )
      .first<{ n: number; amt: number; oldest: string | null }>();
    add({ key: 'order_confirm', group: 'Kế toán', title: 'Đơn đã xuất kho, chờ xác nhận ghi nợ', detail: 'Xác nhận để đơn vào công nợ chính thức', count: ord?.n ?? 0, amount: ord?.amt ?? 0, oldest: ord?.oldest ?? null, page: 'don' });
    const ret = await db
      .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(credit_amount), 0) AS amt, MIN(return_date) AS oldest FROM order_returns WHERE status = 'DA_NHAN_KHO'`)
      .first<{ n: number; amt: number; oldest: string | null }>();
    add({ key: 'return_confirm', group: 'Kế toán', title: 'Hàng trả lại, chờ xác nhận giảm công nợ', detail: 'Kho đã nhận hàng, kế toán xác nhận giảm nợ', count: ret?.n ?? 0, amount: ret?.amt ?? 0, oldest: ret?.oldest ?? null, page: 'ret' });
    const free = await db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(p.amount - COALESCE(a.allocated, 0)), 0) AS amt, MIN(p.paid_at) AS oldest
         FROM payments p LEFT JOIN (SELECT payment_id, SUM(amount) AS allocated FROM payment_allocations WHERE reversed_at IS NULL GROUP BY payment_id) a ON a.payment_id = p.id
         WHERE p.is_adjustment = 0 AND p.purpose <> 'DEPOSIT' AND p.amount > COALESCE(a.allocated, 0)
           AND NOT EXISTS (SELECT 1 FROM audit_logs al WHERE al.entity_type = 'PAYMENT' AND al.entity_id = p.id AND al.action = 'PAYMENT_LEFTOVER_SETTLED')`,
      )
      .first<{ n: number; amt: number; oldest: string | null }>();
    add({ key: 'pay_unallocated', group: 'Kế toán', title: 'Tiền đã ghi nhưng chưa trừ vào đơn nào', detail: 'Tiền của khách, chưa chia vào đơn nên đơn vẫn hiện còn nợ', count: free?.n ?? 0, amount: free?.amt ?? 0, oldest: free?.oldest ?? null, page: 'bill' });
  }

  // ---- Quản lý duyệt
  if (isCeo || can('order.approve.normal')) {
    const ap = await db
      .prepare(
        `SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM approvals WHERE status = 'PENDING' ${isCeo ? '' : "AND required_role = 'MANAGER'"}`,
      )
      .first<{ n: number; oldest: string | null }>();
    add({ key: 'approve', group: 'Duyệt', title: 'Yêu cầu chờ duyệt (đơn, giá)', detail: 'Đơn vượt hạn mức, giá khác bảng giá…', count: ap?.n ?? 0, oldest: ap?.oldest ?? null, page: 'don' });
  }

  // ---- Kho
  if (isCeo || can('order.kho.process') || can('sx.kiemke')) {
    const ship = await db
      .prepare(
        `SELECT COUNT(*) AS n, MIN(COALESCE(ship_date, need_date, substr(approved_at, 1, 10), order_date)) AS oldest
         FROM orders WHERE deleted_at IS NULL AND approval_status = 'APPROVED'
           AND ((flow_on = 1 AND kho_status = 'CHO_XUAT') OR (flow_on = 0 AND delivery_status = 'CHUA_XUAT'))`,
      )
      .first<{ n: number; oldest: string | null }>();
    add({ key: 'ship', group: 'Kho', title: 'Đơn NPP đã duyệt, chờ xuất kho', detail: 'In phiếu, xuất hàng, ghi số thực xuất', count: ship?.n ?? 0, oldest: ship?.oldest ?? null, page: 'xuat' });
  }

  // ---- Sale: đơn của mình chưa gửi duyệt / bị từ chối
  if (can('order.create') || can('order.create.team')) {
    const dr = await db
      .prepare(
        `SELECT COUNT(*) AS n, MIN(order_date) AS oldest FROM orders
         WHERE deleted_at IS NULL AND approval_status IN ('DRAFT', 'REJECTED') AND owner_id = ?`,
      )
      .bind(auth.user.id)
      .first<{ n: number; oldest: string | null }>();
    add({ key: 'draft', group: 'Bán hàng', title: 'Đơn của tôi chưa gửi duyệt hoặc bị từ chối', detail: 'Gửi duyệt hoặc sửa lại', count: dr?.n ?? 0, oldest: dr?.oldest ?? null, page: 'don' });
  }

  // ---- Việc CRM giao cho tôi (tái nhập, nhắc nợ, kho xuất lệch…)
  const tk = await db
    .prepare(`SELECT COUNT(*) AS n, MIN(due_at) AS oldest FROM tasks WHERE assignee_id = ? AND status = 'OPEN' AND due_at <= ?`)
    .bind(auth.user.id, today + 'T23:59:59Z')
    .first<{ n: number; oldest: string | null }>();
  add({ key: 'crm_task', group: 'Chăm sóc khách', title: 'Việc chăm sóc khách đến hạn', detail: 'Liên hệ, nhắc nợ, xử lý đơn lệch…', count: tk?.n ?? 0, oldest: tk?.oldest ?? null, page: 'hn' });

  items.sort((a, b) => b.age_days - a.age_days || b.count - a.count);
  return items;
}

workRoutes.get('/mine', async (c) => {
  const today = vnDate();
  return ok(c, await collectItems(c.get('auth'), c.env.DB, today, false), { today });
});

/**
 * Toàn cảnh cho CEO (và người có quyền xem công nợ toàn công ty): mỗi phòng ban một cụm số, kèm số ngày tồn lâu nhất.
 * Chỉ đọc, không ghi gì.
 */
workRoutes.get('/overview', async (c) => {
  const auth = c.get('auth');
  if (!(auth.user.role === 'CEO' || auth.permissions.includes('debt.read.all'))) throw forbidden('Chỉ CEO hoặc người xem công nợ toàn công ty mới xem được toàn cảnh.');
  const db = c.env.DB;
  const today = vnDate();
  const items = (await collectItems(auth, db, today, true)).filter((x) => x.key !== 'draft' && x.key !== 'crm_task');
  const dr = await db
    .prepare(`SELECT COUNT(*) AS n, MIN(order_date) AS oldest FROM orders WHERE deleted_at IS NULL AND approval_status IN ('DRAFT', 'REJECTED')`)
    .first<{ n: number; oldest: string | null }>();
  const tk = await db
    .prepare(`SELECT COUNT(*) AS n, MIN(due_at) AS oldest FROM tasks WHERE status = 'OPEN' AND due_at <= ?`)
    .bind(today + 'T23:59:59Z')
    .first<{ n: number; oldest: string | null }>();
  return ok(
    c,
    {
      items,
      sale: { count: dr?.n ?? 0, age_days: dayDiff(dr?.oldest ?? null, today) },
      cskh: { count: tk?.n ?? 0, age_days: dayDiff(tk?.oldest ?? null, today) },
    },
    { today },
  );
});

/** Danh sách từng khoản cho việc kế toán (xem và bấm xác nhận ngay trong "Việc của tôi"). */
workRoutes.get('/queue/:key', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const key = c.req.param('key');
  if (!(auth.user.role === 'CEO' || auth.permissions.includes('order.accounting.confirm'))) return ok(c, []);
  if (key === 'pay_confirm') {
    const r = await db
      .prepare(
        `SELECT p.id, c.name AS customer_name, p.amount, p.paid_at AS day, p.note AS note, substr(p.created_at, 1, 10) AS entered, p.created_at AS entered_at, p.method, p.bank_ref, p.external_receipt_no AS receipt_no,
                u.display_name AS entered_by,
                (SELECT b.id FROM bills b WHERE b.payment_id = p.id AND b.deleted_at IS NULL ORDER BY b.created_at LIMIT 1) AS bill_id,
                (SELECT o.order_no FROM bills b JOIN orders o ON o.id = b.order_id WHERE b.payment_id = p.id AND b.deleted_at IS NULL LIMIT 1) AS bill_order_no
         FROM payments p JOIN customers c ON c.id = p.customer_id LEFT JOIN users u ON u.id = p.created_by
         WHERE p.accounting_status = 'CHUA_XAC_NHAN' AND p.is_adjustment = 0 ORDER BY p.paid_at ASC LIMIT 200`,
      )
      .all<{ day: string; entered: string }>();
    return ok(c, (r.results ?? []).map((x) => ({ ...x, swap: swappedDate(x.day, x.entered, vnDate()) })));
  }
  if (key === 'order_confirm') {
    const r = await db
      .prepare(
        `SELECT o.id, c.name AS customer_name, o.total_amount AS amount, o.order_date AS day, o.order_no AS note
         FROM orders o JOIN customers c ON c.id = o.customer_id
         WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND o.delivery_status IN ('DA_XUAT_KHO', 'DA_GIAO')
           AND o.accounting_status = 'CHUA_XAC_NHAN' AND (o.flow_on = 0 OR o.kho_status = 'DA_CHOT_TIEN')
         ORDER BY o.order_date ASC LIMIT 200`,
      )
      .all();
    return ok(c, r.results ?? []);
  }
  return ok(c, []);
});

/** Ngày có vẻ bị nhập ngược ngày/tháng (ví dụ 05/10 gõ thành 10/05): đổi chỗ ngày và tháng thì gần ngày nhập hơn và không ở tương lai. */
function swappedDate(day: string, entered: string, today: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day ?? '');
  if (!m || !entered) return null;
  const [, y, mm, dd] = m;
  if (Number(dd) > 12 || mm === dd) return null;
  const sw = `${y}-${dd}-${mm}`;
  const t = (d: string) => new Date(d.slice(0, 10) + 'T00:00:00Z').getTime();
  if (sw > today) return null;
  return Math.abs(t(sw) - t(entered)) + 7 * 864e5 < Math.abs(t(day.slice(0, 10)) - t(entered)) ? sw : null;
}

/** Danh sách khoản tiền chưa trừ hết / chưa xác nhận có ngày nghi nhập ngược ngày-tháng, để kế toán duyệt (không tự sửa). */
workRoutes.get('/date-check', async (c) => {
  const auth = c.get('auth');
  if (!(auth.user.role === 'CEO' || auth.permissions.includes('order.accounting.confirm'))) return ok(c, []);
  const r = await c.env.DB
    .prepare(
      `SELECT p.id, c.name AS customer_name, p.amount, p.paid_at AS day, substr(p.created_at, 1, 10) AS entered, p.accounting_status
       FROM payments p JOIN customers c ON c.id = p.customer_id
       WHERE p.is_adjustment = 0 AND (p.accounting_status = 'CHUA_XAC_NHAN' OR p.amount > COALESCE((SELECT SUM(amount) FROM payment_allocations WHERE payment_id = p.id AND reversed_at IS NULL), 0))
       ORDER BY p.paid_at ASC`,
    )
    .all<{ day: string; entered: string }>();
  const today = vnDate();
  return ok(c, (r.results ?? []).map((x) => ({ ...x, swap: swappedDate(x.day, x.entered, today) })).filter((x) => x.swap || x.day.slice(0, 10) > x.entered));
});

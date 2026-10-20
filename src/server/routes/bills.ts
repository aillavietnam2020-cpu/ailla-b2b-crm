import { Hono } from 'hono';
import { nowIso, vnDate } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import { eventStatement } from '../lib/events';
import { newId } from '../lib/ids';
import { requirePermission } from '../middleware/rbac';
import { seesAllOrders } from '../services/orderFlow';
import { readBillImage } from '../lib/billReader';
import { spanOf } from '../lib/span';
import { recordPayment, suggestOrdersForPayments } from '../services/payments';
import { clientIp } from '../lib/audit';

/**
 * Kho ảnh bill giao dịch: sale gửi ảnh bill khách chuyển khoản, gắn với khách/đơn/khoản tiền về.
 * Lịch sử giao dịch (các khoản tiền về) hiện cạnh bill để kế toán đối chiếu.
 * File nhỏ nên để thẳng trong D1 (R2 chưa bật); trình duyệt thu nhỏ ảnh trước khi gửi.
 */
export const billRoutes = new Hono<AppEnv>();
billRoutes.use('*', requirePermission('debt.read.own', 'order.payment.record'));

const MAX_FILE = 1_500_000;
// Chỉ ảnh và PDF mở ngay trong trình duyệt; loại khác bị chặn ngay lúc tải lên.
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

type Scope = { sql: string; params: unknown[] };

/**
 * Bill gửi kèm đơn + số tiền mà chưa có khoản tiền về nào: tự ghi khoản tiền về CHỜ KẾ TOÁN XÁC NHẬN (gắn đúng đơn),
 * để đơn không cứ "chờ phải thu" dù đã gửi bill. Tiền mặt cần tên người nhận nên không tự ghi (làm ở "Tiền về + bill").
 * Trả về mã khoản tiền, hoặc null nếu không ghi được (bill vẫn được lưu).
 */
async function paymentFromBill(
  c: { env: AppEnv['Bindings'] },
  auth: Parameters<typeof recordPayment>[1],
  billId: string,
  ctx: { requestId: string; ip: string | null },
): Promise<{ payment_id: string | null; reason?: string }> {
  const b = await c.env.DB.prepare(
    'SELECT id, customer_id, order_id, amount, paid_at, method, bank_ref, payment_id, kind FROM bills WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(billId)
    .first<{ id: string; customer_id: string; order_id: string | null; amount: number | null; paid_at: string | null; method: string | null; bank_ref: string | null; payment_id: string | null; kind: string }>();
  if (!b) return { payment_id: null, reason: 'Không thấy bill' };
  if (b.payment_id) return { payment_id: b.payment_id };
  if (!b.order_id || !b.amount || b.amount <= 0) return { payment_id: null, reason: 'Bill chưa có đơn hoặc số tiền' };
  if (b.method === 'Tiền mặt' || b.method === 'COD') return { payment_id: null, reason: 'Tiền mặt / COD cần ghi ở "Tiền về + bill"' };
  try {
    const r = await recordPayment(
      c.env.DB,
      auth,
      {
        customer_id: b.customer_id,
        amount: b.amount,
        paid_at: b.paid_at ?? vnDate(),
        method: b.method ?? 'Chuyển khoản',
        bank_ref: b.bank_ref,
        accounting_confirmed: false,
        explanation: 'Ghi nhận tự động từ bill đã gửi',
        allocations: [{ order_id: b.order_id, amount: b.amount }],
      } as Parameters<typeof recordPayment>[2],
      ctx,
    );
    await c.env.DB.prepare('UPDATE bills SET payment_id = ? WHERE id = ?').bind(r.id, billId).run();
    return { payment_id: r.id };
  } catch (e) {
    return { payment_id: null, reason: e instanceof Error ? e.message : 'Không ghi được' };
  }
}

function scopeOf(auth: { scope: string; user: { id: string }; permissions: string[] }, alias = 'c'): Scope {
  const all = auth.scope !== 'OWN' || auth.permissions.includes('order.kho.process');
  return all ? { sql: '1=1', params: [] } : { sql: `${alias}.owner_id = ?`, params: [auth.user.id] };
}

function isManager(auth: { permissions: string[] }) {
  return auth.permissions.includes('order.approve.normal') || auth.permissions.includes('order.accounting.confirm');
}

billRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const scope = scopeOf(auth);
  const where = ['b.deleted_at IS NULL', scope.sql];
  const params: unknown[] = [...scope.params];
  const q = (name: string) => c.req.query(name) ?? '';
  if (q('customer_id')) {
    where.push('b.customer_id = ?');
    params.push(q('customer_id'));
  }
  if (q('order_id')) {
    where.push('b.order_id = ?');
    params.push(q('order_id'));
  }
  if (q('from')) {
    where.push("substr(COALESCE(b.paid_at, b.created_at), 1, 10) >= ?");
    params.push(q('from'));
  }
  if (q('to')) {
    where.push("substr(COALESCE(b.paid_at, b.created_at), 1, 10) <= ?");
    params.push(q('to'));
  }
  if (q('q')) {
    where.push('(c.name LIKE ? OR b.note LIKE ? OR o.order_no LIKE ?)');
    params.push(`%${q('q')}%`, `%${q('q')}%`, `%${q('q')}%`);
  }
  if (q('unlinked') === '1') where.push('b.payment_id IS NULL');
  const rows = await c.env.DB.prepare(
    `SELECT b.id, b.customer_id, c.name AS customer_name, b.order_id, o.order_no, b.payment_id,
            p.accounting_status AS payment_status, b.amount, b.paid_at, b.method, b.note, b.name, b.mime,
            b.size, u.display_name AS created_by_name, b.created_at
     FROM bills b
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN orders o ON o.id = b.order_id
     LEFT JOIN payments p ON p.id = b.payment_id
     LEFT JOIN users u ON u.id = b.created_by
     WHERE ${where.join(' AND ')}
     ORDER BY b.created_at DESC LIMIT ?`,
  )
    .bind(...params, Math.min(Number(c.req.query('limit') ?? 200), 500))
    .all();
  return ok(c, rows.results ?? []);
});

/** Lịch sử giao dịch: các khoản tiền về kèm đơn đã phân bổ và số bill đính kèm. */
billRoutes.get('/history', async (c) => {
  const auth = c.get('auth');
  const scope = scopeOf(auth);
  const where = [scope.sql];
  const params: unknown[] = [...scope.params];
  const q = (name: string) => c.req.query(name) ?? '';
  if (q('customer_id')) {
    where.push('p.customer_id = ?');
    params.push(q('customer_id'));
  }
  if (q('order_id')) {
    where.push('EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id AND pa.order_id = ? AND pa.reversed_at IS NULL)');
    params.push(q('order_id'));
  }
  if (q('from')) {
    where.push('p.paid_at >= ?');
    params.push(q('from'));
  }
  if (q('to')) {
    where.push('p.paid_at <= ?');
    params.push(q('to'));
  }
  if (q('status') === 'pending') where.push("p.accounting_status = 'CHUA_XAC_NHAN'");
  if (q('status') === 'confirmed') where.push("p.accounting_status = 'DA_XAC_NHAN'");
  const rows = await c.env.DB.prepare(
    `SELECT p.id, p.customer_id, c.name AS customer_name, p.amount, p.is_adjustment, p.paid_at, p.method,
            p.external_receipt_no, p.accounting_status, p.note, p.created_at, u.display_name AS created_by_name,
            (SELECT COUNT(*) FROM bills b WHERE b.payment_id = p.id AND b.deleted_at IS NULL) AS bill_count,
            (SELECT GROUP_CONCAT(o.order_no, ', ') FROM payment_allocations pa
               JOIN orders o ON o.id = pa.order_id
              WHERE pa.payment_id = p.id AND pa.reversed_at IS NULL) AS orders
     FROM payments p
     JOIN customers c ON c.id = p.customer_id
     LEFT JOIN users u ON u.id = p.created_by
     WHERE ${where.join(' AND ')}
     ORDER BY p.paid_at DESC, p.created_at DESC LIMIT ?`,
  )
    .bind(...params, Math.min(Number(c.req.query('limit') ?? 200), 500))
    .all<Record<string, unknown> & { id: string; customer_id: string; amount: number; is_adjustment: number; orders: string | null }>();
  // Khoản chưa gắn đơn nào: gợi ý đơn có số còn phải thu đúng bằng số tiền (chỉ khi duy nhất một đơn).
  const list = rows.results ?? [];
  const sug = await suggestOrdersForPayments(
    c.env.DB,
    list.filter((r) => !r.orders),
  );
  return ok(c, list.map((r) => ({ ...r, suggest: sug.get(r.id) ?? null })));
});


/**
 * Đọc ảnh bill bằng AI để điền sẵn form (số tiền, ngày, số tham chiếu, tài khoản nhận, nội dung).
 * Kết quả chỉ là gợi ý cho sale kiểm lại; kèm đối chiếu danh sách tài khoản nhận hợp lệ và kiểm trùng bill.
 */
billRoutes.post('/read', requirePermission('order.payment.record'), async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw badRequest('MISSING', 'Chưa chọn ảnh bill');
  if (!file.type.startsWith('image/')) {
    return ok(c, { readable: false, reason: 'Chỉ đọc tự động được ảnh (jpg, png, webp). File PDF thì nhập tay.' });
  }
  if (file.size > MAX_FILE) throw badRequest('TOO_LARGE', 'File quá 1,5 MB');
  let read: Awaited<ReturnType<typeof readBillImage>>;
  try {
    read = await readBillImage(c.env, new Uint8Array(await file.arrayBuffer()), file.type);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERR';
    console.error('[bills/read]', code);
    return ok(c, {
      readable: false,
      reason:
        code === 'AI_NOT_CONFIGURED'
          ? 'Máy chủ chưa nối AI đọc bill. Nhập tay.'
          : 'Chưa đọc được ảnh này tự động. Nhập tay hoặc chụp lại rõ hơn.',
    });
  }
  let account: { status: 'MATCH' | 'UNKNOWN' | 'NONE'; id?: string; label?: string } = { status: 'NONE' };
  if (read.to_account) {
    const acc = await c.env.DB.prepare(
      'SELECT id, bank, account_no, account_name FROM receiving_accounts WHERE account_no = ? AND active = 1',
    )
      .bind(read.to_account)
      .first<{ id: string; bank: string; account_no: string; account_name: string }>();
    account = acc
      ? { status: 'MATCH', id: acc.id, label: `${acc.bank} · ${acc.account_no} · ${acc.account_name}` }
      : { status: 'UNKNOWN' };
  }
  let duplicate: { customer_name: string; amount: number | null; paid_at: string | null } | null = null;
  if (read.bank_ref) {
    duplicate = await c.env.DB.prepare(
      `SELECT c.name AS customer_name, p.amount, p.paid_at FROM payments p JOIN customers c ON c.id = p.customer_id
       WHERE p.bank_ref = ?
       UNION ALL
       SELECT c.name, b.amount, b.paid_at FROM bills b JOIN customers c ON c.id = b.customer_id
       WHERE b.bank_ref = ? AND b.deleted_at IS NULL LIMIT 1`,
    )
      .bind(read.bank_ref, read.bank_ref)
      .first();
  }
  return ok(c, { ...read, account, duplicate });
});

/** Báo cáo giao dịch B2B theo tháng: tổng tiền về theo khách, hình thức, mục đích, trạng thái kế toán. */
billRoutes.get('/report', async (c) => {
  const auth = c.get('auth');
  const span = spanOf(c.req.query('month'));
  const month = span.month ?? `${span.from}..${span.to}`;
  const scope = scopeOf(auth);
  const rows = await c.env.DB.prepare(
    `SELECT p.id, p.customer_id, c.name AS customer_name, p.paid_at, p.method, p.purpose, p.explanation,
            p.external_receipt_no, p.bank_ref, p.accounting_status, p.review_status, p.review_reason,
            p.receiver_name, p.is_adjustment, p.note,
            CASE WHEN p.is_adjustment = 1 THEN -p.amount ELSE p.amount END AS amount,
            ra.bank AS account_bank, ra.account_no AS account_no,
            (SELECT COUNT(*) FROM bills b WHERE b.payment_id = p.id AND b.deleted_at IS NULL) AS bill_count,
            (SELECT GROUP_CONCAT(o.order_no, ', ') FROM payment_allocations pa JOIN orders o ON o.id = pa.order_id
              WHERE pa.payment_id = p.id AND pa.reversed_at IS NULL) AS orders
     FROM payments p
     JOIN customers c ON c.id = p.customer_id
     LEFT JOIN receiving_accounts ra ON ra.id = p.receiving_account_id
     WHERE substr(p.paid_at, 1, 10) BETWEEN ? AND ? AND ${scope.sql}
     ORDER BY p.paid_at, p.created_at`,
  )
    .bind(span.from, span.to, ...scope.params)
    .all<{
      customer_id: string;
      customer_name: string;
      method: string | null;
      purpose: string;
      accounting_status: string;
      amount: number;
    }>();
  const list = rows.results ?? [];
  const sum = (arr: typeof list) => arr.reduce((a, r) => a + r.amount, 0);
  const group = (key: (r: (typeof list)[number]) => string) => {
    const m = new Map<string, typeof list>();
    for (const r of list) {
      const k = key(r);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].map(([k, arr]) => ({
      key: k,
      count: arr.length,
      amount: sum(arr),
      confirmed: sum(arr.filter((r) => r.accounting_status === 'DA_XAC_NHAN')),
      pending: sum(arr.filter((r) => r.accounting_status !== 'DA_XAC_NHAN')),
    }));
  };
  return ok(c, {
    month,
    totals: {
      count: list.length,
      amount: sum(list),
      confirmed: sum(list.filter((r) => r.accounting_status === 'DA_XAC_NHAN')),
      pending: sum(list.filter((r) => r.accounting_status !== 'DA_XAC_NHAN')),
    },
    by_customer: group((r) => `${r.customer_id}|${r.customer_name}`)
      .map((g) => ({ ...g, customer_id: g.key.split('|')[0], customer_name: g.key.split('|').slice(1).join('|') }))
      .sort((a, b) => b.amount - a.amount),
    by_method: group((r) => r.method ?? 'Chưa ghi'),
    by_purpose: group((r) => r.purpose),
    rows: list,
  });
});

billRoutes.post('/', requirePermission('order.payment.record'), async (c) => {
  const auth = c.get('auth');
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  const customerId = String(form?.get('customer_id') ?? '').trim();
  if (!file || typeof file === 'string') throw badRequest('MISSING', 'Chưa chọn ảnh bill');
  if (!customerId) throw badRequest('MISSING', 'Chưa chọn khách hàng');
  if (!ALLOWED.includes(file.type)) throw badRequest('BAD_TYPE', 'Chỉ nhận ảnh (jpg, png, webp) hoặc PDF');
  if (file.size > MAX_FILE) throw badRequest('TOO_LARGE', 'File quá 1,5 MB, chụp lại hoặc thu nhỏ giúp em');

  const scope = scopeOf(auth);
  const customer = await c.env.DB.prepare(
    `SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${scope.sql}`,
  )
    .bind(customerId, ...scope.params)
    .first<{ id: string }>();
  if (!customer) throw notFound('Không tìm thấy khách hàng');

  const orderId = String(form?.get('order_id') ?? '').trim() || null;
  if (orderId) {
    const o = await c.env.DB.prepare('SELECT id FROM orders WHERE id = ? AND customer_id = ? AND deleted_at IS NULL')
      .bind(orderId, customerId)
      .first();
    if (!o) throw badRequest('BAD_ORDER', 'Đơn không thuộc khách này');
  }
  const paymentId = String(form?.get('payment_id') ?? '').trim() || null;
  if (paymentId) {
    const p = await c.env.DB.prepare('SELECT id FROM payments WHERE id = ? AND customer_id = ?')
      .bind(paymentId, customerId)
      .first();
    if (!p) throw badRequest('BAD_PAYMENT', 'Khoản tiền không thuộc khách này');
  }
  const amountRaw = Number(form?.get('amount') ?? '');
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? Math.round(amountRaw) : null;
  const paidAtRaw = String(form?.get('paid_at') ?? '').trim();
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(paidAtRaw) ? paidAtRaw : vnDate();
  const method = String(form?.get('method') ?? '').trim().slice(0, 60) || null;
  const note = String(form?.get('note') ?? '').trim().slice(0, 300) || null;
  // Ảnh bill chuyển khoản hay ảnh phiếu thu tiền mặt có chữ ký.
  const kind = String(form?.get('kind') ?? 'BILL') === 'PHIEU_THU' ? 'PHIEU_THU' : 'BILL';
  const bankRef = String(form?.get('bank_ref') ?? '').trim().slice(0, 80) || null;
  const toAccount = String(form?.get('to_account') ?? '').replace(/[^\d]/g, '').slice(0, 24) || null;
  const readJson = String(form?.get('read_json') ?? '').slice(0, 4000) || null;
  if (bankRef && kind === 'BILL') {
    const dup = await c.env.DB.prepare(
      'SELECT id FROM bills WHERE bank_ref = ? AND deleted_at IS NULL AND (payment_id IS NULL OR payment_id <> COALESCE(?, \'\'))',
    )
      .bind(bankRef, paymentId)
      .first();
    if (dup) throw badRequest('DUPLICATE_BILL', `Bill này (số tham chiếu ${bankRef}) đã được gửi trước đó.`);
  }

  const id = newId();
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO bills (id, customer_id, order_id, payment_id, amount, paid_at, method, note, name, mime, size,
         data, created_by, created_at, kind, bank_ref, to_account, read_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      customerId,
      orderId,
      paymentId,
      amount,
      paidAt,
      method,
      note,
      file.name.slice(0, 200),
      file.type,
      file.size,
      new Uint8Array(await file.arrayBuffer()),
      auth.user.id,
      now,
      kind,
      bankRef,
      toAccount,
      readJson,
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'BILL_ADDED',
      entityType: 'BILL',
      entityId: id,
      after: { customer_id: customerId, order_id: orderId, payment_id: paymentId, amount, name: file.name },
    }),
    eventStatement(c.env.DB, {
      type: 'BILL_ADDED',
      entityType: 'BILL',
      entityId: id,
      actorId: auth.user.id,
      actorType: auth.actorType ?? 'USER',
      payload: { customer_id: customerId, order_id: orderId, payment_id: paymentId, amount },
    }),
  ]);
  // Bill kèm đơn + số tiền, chưa gắn khoản tiền về: tự ghi khoản tiền về chờ kế toán xác nhận.
  let payment: { payment_id: string | null; reason?: string } = { payment_id: paymentId };
  if (!paymentId && orderId && amount && kind === 'BILL') {
    payment = await paymentFromBill(c, auth, id, { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) });
  }
  return ok(c, { id, payment_id: payment.payment_id, payment_note: payment.payment_id ? null : (payment.reason ?? null) });
});

/** Ghi nhận tiền về từ một bill đã gửi nhưng chưa thành khoản tiền (nút "Ghi nhận tiền về" ở đơn). */
billRoutes.post('/:id/record-payment', requirePermission('order.payment.record'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const bill = await c.env.DB.prepare('SELECT b.customer_id FROM bills b JOIN customers c ON c.id = b.customer_id WHERE b.id = ? AND b.deleted_at IS NULL')
    .bind(id)
    .first<{ customer_id: string }>();
  if (!bill) throw notFound('Không tìm thấy bill');
  const r = await paymentFromBill(c, auth, id, { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) });
  if (!r.payment_id) throw badRequest('NO_PAYMENT', r.reason ?? 'Không ghi nhận được từ bill này');
  return ok(c, r);
});

async function readBill(c: { env: AppEnv['Bindings'] }, id: string) {
  return c.env.DB.prepare(
    `SELECT b.id, b.customer_id, b.order_id, b.payment_id, b.created_by, c.owner_id,
            p.accounting_status AS payment_status
     FROM bills b JOIN customers c ON c.id = b.customer_id
     LEFT JOIN payments p ON p.id = b.payment_id
     WHERE b.id = ? AND b.deleted_at IS NULL`,
  )
    .bind(id)
    .first<{
      id: string;
      customer_id: string;
      order_id: string | null;
      payment_id: string | null;
      created_by: string | null;
      owner_id: string | null;
      payment_status: string | null;
    }>();
}

billRoutes.get('/:id/file', async (c) => {
  const auth = c.get('auth');
  const meta = await readBill(c, c.req.param('id'));
  if (!meta) throw notFound();
  const all = auth.scope !== 'OWN' || seesAllOrders(auth);
  if (!all && meta.owner_id !== auth.user.id) throw notFound();
  const row = await c.env.DB.prepare('SELECT name, mime, data FROM bills WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ name: string; mime: string; data: unknown }>();
  if (!row) throw notFound();
  const d = row.data;
  const bytes =
    d instanceof Uint8Array
      ? d
      : d instanceof ArrayBuffer
        ? new Uint8Array(d)
        : Array.isArray(d)
          ? Uint8Array.from(d as number[])
          : Uint8Array.from(Object.values(d as object) as number[]);
  const inline = ALLOWED.includes(row.mime);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': inline ? row.mime : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

/** Gắn bill vào đơn/khoản tiền hoặc sửa thông tin. */
billRoutes.patch('/:id', requirePermission('order.payment.record'), async (c) => {
  const auth = c.get('auth');
  const meta = await readBill(c, c.req.param('id'));
  if (!meta) throw notFound();
  const all = auth.scope !== 'OWN' || seesAllOrders(auth);
  if (!all && meta.owner_id !== auth.user.id) throw notFound();
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if ('order_id' in body) {
    const orderId = body.order_id ? String(body.order_id) : null;
    if (orderId) {
      const o = await c.env.DB.prepare('SELECT id FROM orders WHERE id = ? AND customer_id = ? AND deleted_at IS NULL')
        .bind(orderId, meta.customer_id)
        .first();
      if (!o) throw badRequest('BAD_ORDER', 'Đơn không thuộc khách này');
    }
    sets.push('order_id = ?');
    vals.push(orderId);
  }
  if ('payment_id' in body) {
    const paymentId = body.payment_id ? String(body.payment_id) : null;
    if (paymentId) {
      const p = await c.env.DB.prepare('SELECT id FROM payments WHERE id = ? AND customer_id = ?')
        .bind(paymentId, meta.customer_id)
        .first();
      if (!p) throw badRequest('BAD_PAYMENT', 'Khoản tiền không thuộc khách này');
    }
    sets.push('payment_id = ?');
    vals.push(paymentId);
  }
  if ('note' in body) {
    sets.push('note = ?');
    vals.push(String(body.note ?? '').slice(0, 300) || null);
  }
  if ('amount' in body) {
    const n = Number(body.amount);
    sets.push('amount = ?');
    vals.push(Number.isFinite(n) && n > 0 ? Math.round(n) : null);
  }
  if (!sets.length) return ok(c, { id: meta.id });
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE bills SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, meta.id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'BILL_UPDATED', entityType: 'BILL', entityId: meta.id, after: body }),
  ]);
  return ok(c, { id: meta.id });
});

billRoutes.delete('/:id', requirePermission('order.payment.record'), async (c) => {
  const auth = c.get('auth');
  const meta = await readBill(c, c.req.param('id'));
  if (!meta) throw notFound();
  if (meta.created_by !== auth.user.id && !isManager(auth)) {
    throw forbidden('Chỉ người gửi bill hoặc quản lý/kế toán mới xoá được.');
  }
  if (meta.payment_status === 'DA_XAC_NHAN' && !isManager(auth)) {
    throw forbidden('Khoản tiền của bill này đã được kế toán xác nhận nên không xoá được.');
  }
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE bills SET deleted_at = ? WHERE id = ?').bind(nowIso(), meta.id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'BILL_DELETED', entityType: 'BILL', entityId: meta.id }),
  ]);
  return ok(c, { id: meta.id });
});

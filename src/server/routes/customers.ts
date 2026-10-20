import { Hono, type Context } from 'hono';
import type { AppEnv } from '../env';
import { badRequest, conflict, created, notFound, ok } from '../lib/http';
import { nowIso, vnDate } from '@shared/datetime';
import { auditStatement, clientIp } from '../lib/audit';
import { loadConfig } from '../lib/settings';
import { parseInput } from '../lib/validate';
import {
  activityCreateSchema,
  customerCreateSchema,
  customerReassignSchema,
  customerUpdateSchema,
  listQuerySchema,
  taskCompleteSchema,
} from '@shared/schemas';
import { customerScopeClause, requirePermission } from '../middleware/rbac';
import {
  addActivity,
  completeTask,
  createCustomer,
  CUSTOMER_SORT_LABELS,
  getCustomer,
  listCustomers,
  listTasks,
  reassignCustomer,
  updateCustomer,
} from '../services/customers';
import { beginIdempotent, completeIdempotent } from '../lib/idempotency';

export const customerRoutes = new Hono<AppEnv>();

customerRoutes.get('/', requirePermission('customer.read.own'), async (c) => {
  const auth = c.get('auth');
  const query = listQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
  const scope = customerScopeClause(auth);
  const result = await listCustomers(c.env.DB, scope.sql, scope.params, {
    q: query.q,
    stage: query.stage,
    tierId: query.tier_id,
    ownerId: query.owner_id,
    due: query.due,
    dataQuality: query.data_quality,
    sort: query.sort,
    month: c.req.query('month') ?? undefined,
    page: query.page,
    pageSize: query.page_size,
  });
  return ok(c, result.items, {
    total: result.total,
    page: query.page,
    page_size: query.page_size,
    sort: query.sort ?? 'follow_up',
    sort_options: CUSTOMER_SORT_LABELS,
  });
});

/** Sửa hồ sơ khách: cấp giá, giai đoạn, thông tin liên hệ, chu kỳ tái mua. */
customerRoutes.patch('/:id', requirePermission('customer.update'), async (c) => {
  const auth = c.get('auth');
  const input = parseInput(customerUpdateSchema, await c.req.json().catch(() => ({})));
  await updateCustomer(c.env.DB, auth, c.req.param('id'), input as Record<string, unknown>, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, await getCustomer(c.env.DB, auth, c.req.param('id')));
});

customerRoutes.post('/', requirePermission('customer.create'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const input = parseInput(customerCreateSchema, body);
  const key = c.req.header('Idempotency-Key') ?? null;

  const replay = await beginIdempotent(c.env.DB, key, auth.user.id, 'POST /api/customers', body);
  if (replay) return ok(c, replay.response, { idempotent_replay: true });

  const result = await createCustomer(c.env.DB, auth, input, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  await completeIdempotent(c.env.DB, key, result);
  return created(c, result);
});

/**
 * Xóa khách (xóa mềm: khách biến khỏi danh sách, dữ liệu giữ trong hệ thống). Chỉ xóa được khách CHƯA phát sinh:
 * không đơn hàng, không phiếu thu, không trả hàng, không phiếu quà thưởng, không dư nợ cũ.
 * Khách đã phát sinh thì phải giữ để còn lịch sử công nợ.
 */
async function deleteCustomers(c: Context<AppEnv>, ids: string[]) {
  const auth = c.get('auth');
  const db = c.env.DB;
  const found = new Map<string, string>();
  const blocked: Record<string, string[]> = {};
  const why = (id: string, text: string) => (blocked[id] ??= []).push(text);
  for (let i = 0; i < ids.length; i += 60) {
    const part = ids.slice(i, i + 60);
    const ph = part.map(() => '?').join(',');
    const rows = await db
      .prepare(`SELECT id, name, opening_debt FROM customers WHERE deleted_at IS NULL AND id IN (${ph})`)
      .bind(...part)
      .all<{ id: string; name: string; opening_debt: number }>();
    for (const r of rows.results) {
      found.set(r.id, r.name);
      if (r.opening_debt) why(r.id, 'còn dư nợ cũ đầu kỳ');
    }
    const checks: Array<[string, string, string]> = [
      ['orders', 'đã có đơn hàng', "AND deleted_at IS NULL AND approval_status <> 'CANCELLED'"],
      ['payments', 'đã có phiếu thu / thanh toán', ''],
      ['order_returns', 'đã có phiếu trả hàng', ''],
      ['bonus_gift_vouchers', 'đã có phiếu quà thưởng', ''],
    ];
    for (const [table, text, extra] of checks) {
      const r = await db
        .prepare(`SELECT DISTINCT customer_id AS x FROM ${table} WHERE customer_id IN (${ph}) ${extra}`)
        .bind(...part)
        .all<{ x: string }>();
      for (const row of r.results) if (found.has(row.x)) why(row.x, text);
    }
  }
  const done = [...found.keys()].filter((id) => !blocked[id]);
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const id of done) {
    stmts.push(db.prepare('UPDATE customers SET deleted_at = ?, updated_at = ? WHERE id = ?').bind(now, now, id));
    stmts.push(
      db.prepare("UPDATE tasks SET status = 'CANCELLED', updated_at = ? WHERE customer_id = ? AND status = 'OPEN'").bind(now, id),
    );
    // Đơn đã hủy của khách này đi cùng khách (đơn còn hiệu lực thì đã chặn xóa ở trên).
    stmts.push(
      db.prepare("UPDATE orders SET deleted_at = ?, updated_at = ? WHERE customer_id = ? AND approval_status = 'CANCELLED' AND deleted_at IS NULL").bind(now, now, id),
    );
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  if (done.length) {
    await auditStatement(db, {
      actorId: auth.user.id,
      action: 'CUSTOMER_DELETED',
      entityType: 'CUSTOMER',
      entityId: done.length === 1 ? done[0] : 'bulk',
      before: done.slice(0, 50).map((id) => ({ id, name: found.get(id) })),
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }).run();
  }
  return {
    done: done.map((id) => ({ id, name: found.get(id) ?? '' })),
    blocked: Object.entries(blocked).map(([id, reasons]) => ({ id, name: found.get(id) ?? '', reasons })),
    missing: ids.filter((id) => !found.has(id)),
  };
}

customerRoutes.post('/bulk-delete', requirePermission('customer.delete'), async (c) => {
  const b = (await c.req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = [...new Set((Array.isArray(b?.ids) ? b!.ids : []).map((x) => String(x)))].filter(Boolean);
  if (!ids.length) throw badRequest('MISSING', 'Chưa chọn khách nào');
  if (ids.length > 300) throw badRequest('TOO_MANY', 'Mỗi lần tối đa 300 khách');
  return ok(c, await deleteCustomers(c, ids));
});

customerRoutes.delete('/:id', requirePermission('customer.delete'), async (c) => {
  const r = await deleteCustomers(c, [c.req.param('id')]);
  if (r.missing.length) throw notFound('Không tìm thấy khách hàng');
  if (r.blocked.length) {
    throw conflict('CUSTOMER_IN_USE', `Khách này ${r.blocked[0].reasons.join(', ')} nên không xóa được. Giữ khách để còn lịch sử công nợ.`);
  }
  return ok(c, { id: c.req.param('id') });
});

customerRoutes.get('/:id', requirePermission('customer.read.own'), async (c) => {
  const auth = c.get('auth');
  return ok(
    c,
    await getCustomer(c.env.DB, auth, c.req.param('id'), c.req.query('month') ?? undefined),
  );
});

// 13/10: lịch sử giao dịch công nợ (ghi nợ, thanh toán, trả hàng, điều chỉnh) kèm dư nợ sau từng dòng.
customerRoutes.get('/:id/ledger', requirePermission('customer.read.own'), async (c) => {
  const auth = c.get('auth');
  await getCustomer(c.env.DB, auth, c.req.param('id')); // kiểm tra quyền xem khách này
  const { customerLedger } = await import('../services/debts');
  return ok(c, await customerLedger(c.env.DB, c.req.param('id')));
});

// Bảng đối chiếu công nợ để giải thích cho khách (đơn nào còn nợ, mỗi khoản tiền đã trừ vào đâu).
customerRoutes.get('/:id/statement', requirePermission('customer.read.own'), async (c) => {
  const auth = c.get('auth');
  await getCustomer(c.env.DB, auth, c.req.param('id')); // kiểm tra quyền xem khách này
  const { customerStatement } = await import('../services/debts');
  return ok(c, await customerStatement(c.env.DB, c.req.param('id'), vnDate()));
});

// Sale xin đổi cấp giá của khách ở hồ sơ: gửi yêu cầu cho Quản lý / CEO duyệt, duyệt xong cấp mới đổi.
customerRoutes.post('/:id/tier-request', requirePermission('customer.update'), async (c) => {
  const auth = c.get('auth');
  await getCustomer(c.env.DB, auth, c.req.param('id')); // kiểm tra quyền xem khách này
  const b = (await c.req.json().catch(() => null)) as { tier_id?: unknown; reason?: unknown } | null;
  const { requestTierChange } = await import('../services/approvals');
  const r = await requestTierChange(c.env.DB, auth, c.req.param('id'), String(b?.tier_id ?? ''), String(b?.reason ?? '').trim().slice(0, 300), {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, r);
});

customerRoutes.post('/:id/activities', requirePermission('activity.create'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const input = parseInput(activityCreateSchema, body);
  const config = await loadConfig(c.env.DB);
  const key = c.req.header('Idempotency-Key') ?? null;

  const replay = await beginIdempotent(
    c.env.DB,
    key,
    auth.user.id,
    'POST /api/customers/:id/activities',
    body,
  );
  if (replay) return ok(c, replay.response, { idempotent_replay: true });

  const result = await addActivity(c.env.DB, auth, c.req.param('id'), input, config, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  await completeIdempotent(c.env.DB, key, result);
  return created(c, result);
});

customerRoutes.post('/:id/reassign', requirePermission('customer.reassign'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const input = parseInput(customerReassignSchema, body);
  await reassignCustomer(c.env.DB, auth, c.req.param('id'), input.owner_id, input.reason, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, { ok: true });
});

export const taskRoutes = new Hono<AppEnv>();

taskRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const filter = (c.req.query('filter') as 'today' | 'overdue' | 'open') ?? 'today';
  const assigneeParam = c.req.query('assignee_id');
  const assigneeId = auth.user.role === 'EMPLOYEE' ? auth.user.id : (assigneeParam ?? null);
  return ok(c, await listTasks(c.env.DB, assigneeId, filter));
});

taskRoutes.post('/:id/complete', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const input = parseInput(taskCompleteSchema, body);
  await completeTask(c.env.DB, auth, c.req.param('id'), input.note ?? null, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, { ok: true });
});

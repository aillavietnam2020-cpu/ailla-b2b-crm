import { nowIso, vnDate, vnDateOffset } from '@shared/datetime';
import { normalizePhone } from '@shared/phone';
import { canTransition, isOpenStage, requiresManagerToReopen } from '@shared/stages';
import { can } from '@shared/permissions';
import type { CustomerStage } from '@shared/enums';
import { CLOSING_RESULTS } from '@shared/enums';
import type { ActivityCreateInput, CustomerCreateInput } from '@shared/schemas';
import type { ActivityItem, CustomerDetail, CustomerListItem, TaskItem } from '@shared/types';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, forbidden, notFound, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import type { AppConfig } from '../lib/settings';
import { getCustomerDebt } from './debts';

const LIST_SQL = `
SELECT c.id, c.legacy_code, c.name, c.phone_text, c.province, c.tier_id, t.name AS tier_name,
       c.legacy_tier_label, c.owner_id, u.display_name AS owner_name, c.stage, c.source,
       c.next_follow_up_at, c.last_order_date, c.data_quality, c.credit_limit, t.debt_limit
FROM customers c
LEFT JOIN users u ON u.id = c.owner_id
LEFT JOIN price_tiers t ON t.id = c.tier_id
WHERE c.deleted_at IS NULL`;

export interface CustomerFilters {
  q?: string;
  stage?: string;
  tierId?: string;
  ownerId?: string;
  due?: 'today' | 'overdue' | 'upcoming';
  dataQuality?: 'OK' | 'NEEDS_REVIEW';
  sort?: string;
  page: number;
  pageSize: number;
}

/** Các kiểu sắp xếp cho phép. Không ghép chuỗi từ client vào SQL để tránh SQL injection. */
const SORT_OPTIONS: Record<string, string> = {
  follow_up: `CASE WHEN c.next_follow_up_at IS NULL THEN 1 ELSE 0 END, c.next_follow_up_at, c.name COLLATE NOCASE`,
  name: 'c.name COLLATE NOCASE',
  name_desc: 'c.name COLLATE NOCASE DESC',
  newest: 'c.created_at DESC',
  oldest: 'c.created_at',
  last_order: `CASE WHEN c.last_order_date IS NULL THEN 1 ELSE 0 END, c.last_order_date DESC`,
  province: `c.province COLLATE NOCASE, c.name COLLATE NOCASE`,
  tier: 't.rank, c.name COLLATE NOCASE',
  stage: 'c.stage, c.name COLLATE NOCASE',
  owner: 'u.display_name COLLATE NOCASE, c.name COLLATE NOCASE',
};

export const CUSTOMER_SORT_LABELS: Record<string, string> = {
  follow_up: 'Lịch chăm sóc gần nhất',
  name: 'Tên A → Z',
  name_desc: 'Tên Z → A',
  newest: 'Mới thêm trước',
  oldest: 'Thêm lâu nhất trước',
  last_order: 'Đơn gần nhất',
  province: 'Tỉnh/thành',
  tier: 'Cấp giá',
  stage: 'Giai đoạn',
  owner: 'Nhân viên phụ trách',
  debt: 'Công nợ cao nhất',
  revenue: 'Doanh số cao nhất',
};

export async function listCustomers(
  db: D1Database,
  scopeSql: string,
  scopeParams: unknown[],
  filters: CustomerFilters,
): Promise<{ items: CustomerListItem[]; total: number }> {
  const where: string[] = [scopeSql];
  const params: unknown[] = [...scopeParams];
  const today = vnDate();

  if (filters.q) {
    where.push('(c.name LIKE ? OR c.phone_text LIKE ? OR c.province LIKE ? OR c.legacy_code LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like, like);
  }
  if (filters.stage) {
    where.push('c.stage = ?');
    params.push(filters.stage);
  }
  if (filters.tierId) {
    where.push('c.tier_id = ?');
    params.push(filters.tierId);
  }
  if (filters.ownerId) {
    where.push(filters.ownerId === 'UNASSIGNED' ? 'c.owner_id IS NULL' : 'c.owner_id = ?');
    if (filters.ownerId !== 'UNASSIGNED') params.push(filters.ownerId);
  }
  if (filters.dataQuality) {
    where.push('c.data_quality = ?');
    params.push(filters.dataQuality);
  }
  if (filters.due === 'today') {
    where.push('c.next_follow_up_at = ?');
    params.push(today);
  } else if (filters.due === 'overdue') {
    where.push('c.next_follow_up_at IS NOT NULL AND c.next_follow_up_at < ?');
    params.push(today);
  } else if (filters.due === 'upcoming') {
    where.push('c.next_follow_up_at > ?');
    params.push(today);
  }

  const clause = where.join(' AND ');
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM customers c WHERE c.deleted_at IS NULL AND ${clause}`)
    .bind(...params)
    .first<{ n: number }>();

  const offset = (filters.page - 1) * filters.pageSize;
  // "debt"/"revenue" phải sắp xếp sau khi tính xong, nên tạm lấy theo tên rồi sắp lại ở dưới.
  const sortKey = filters.sort ?? 'follow_up';
  const sortByComputed = sortKey === 'debt' || sortKey === 'revenue';
  const orderBy = SORT_OPTIONS[sortByComputed ? 'follow_up' : sortKey] ?? SORT_OPTIONS.follow_up;

  const rows = await db
    .prepare(
      `${LIST_SQL} AND ${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    )
    .bind(...params, sortByComputed ? 500 : filters.pageSize, sortByComputed ? 0 : offset)
    .all<CustomerListItem & { debt_limit: number | null }>();

  const items = rows.results ?? [];
  // Công nợ tính riêng theo từng khách để không nhân bản dòng khi JOIN.
  const debtRows = await Promise.all(items.map((i) => getCustomerDebt(db, i.id)));

  let enriched = items.map((row, index) => ({
    ...row,
    credit_limit: row.credit_limit ?? row.debt_limit ?? 0,
    official_debt: debtRows[index].official_debt,
    projected_debt: debtRows[index].projected_debt,
    revenue_total: debtRows[index].posted_charges,
  }));

  if (sortByComputed) {
    enriched = enriched
      .sort((a, b) =>
        sortKey === 'debt'
          ? b.official_debt - a.official_debt
          : (b.revenue_total ?? 0) - (a.revenue_total ?? 0),
      )
      .slice(offset, offset + filters.pageSize);
  }

  return { total: countRow?.n ?? 0, items: enriched };
}

export async function getCustomer(
  db: D1Database,
  auth: AuthContext,
  customerId: string,
): Promise<CustomerDetail> {
  const row = await db
    .prepare(`${LIST_SQL} AND c.id = ?`)
    .bind(customerId)
    .first<Record<string, unknown>>();
  if (!row) throw notFound('Không tìm thấy khách hàng');
  if (auth.scope === 'OWN' && row.owner_id !== auth.user.id) throw notFound('Không tìm thấy khách hàng');

  const extra = await db
    .prepare(
      `SELECT address, potential, interested_products, reorder_cycle_days, first_contact_date,
              opening_debt, data_quality_note, lost_reason, created_at, updated_at
       FROM customers WHERE id = ?`,
    )
    .bind(customerId)
    .first<Record<string, unknown>>();

  const activities = await db
    .prepare(
      `SELECT a.id, a.customer_id, a.user_id, u.display_name AS user_name, a.channel, a.result,
              a.content, a.next_action, a.next_date, a.reason_code, a.created_at
       FROM customer_activities a JOIN users u ON u.id = a.user_id
       WHERE a.customer_id = ? ORDER BY a.created_at DESC LIMIT 50`,
    )
    .bind(customerId)
    .all<ActivityItem>();

  const tasks = await db
    .prepare(
      `SELECT t.id, t.customer_id, c.name AS customer_name, t.assignee_id, t.type, t.title,
              t.due_at, t.status, t.priority
       FROM tasks t LEFT JOIN customers c ON c.id = t.customer_id
       WHERE t.customer_id = ? ORDER BY t.due_at LIMIT 50`,
    )
    .bind(customerId)
    .all<TaskItem>();

  const orders = await db
    .prepare(
      `SELECT o.id, o.order_no, o.customer_id, c.name AS customer_name, o.owner_id,
              u.display_name AS owner_name, o.order_date, o.total_amount, o.cod_amount,
              o.approval_status, o.delivery_status, o.payment_status, o.accounting_status,
              COALESCE(a.received, 0) AS received_amount
       FROM orders o JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.owner_id
       LEFT JOIN (SELECT order_id, SUM(amount) AS received FROM payment_allocations
                  WHERE reversed_at IS NULL GROUP BY order_id) a ON a.order_id = o.id
       WHERE o.customer_id = ? AND o.deleted_at IS NULL ORDER BY o.order_date DESC LIMIT 50`,
    )
    .bind(customerId)
    .all<Record<string, number>>();

  const debt = await getCustomerDebt(db, customerId);
  const today = vnDate();

  return {
    ...(row as unknown as CustomerListItem),
    ...(extra as unknown as Record<string, never>),
    credit_limit: (row.credit_limit as number) ?? (row.debt_limit as number) ?? 0,
    official_debt: debt.official_debt,
    projected_debt: debt.projected_debt,
    debt,
    activities: activities.results ?? [],
    tasks: (tasks.results ?? []).map((t) => ({ ...t, overdue: t.status === 'OPEN' && t.due_at < today })),
    orders: (orders.results ?? []).map((o) => ({
      ...o,
      remaining_amount: o.total_amount - (o.cod_amount ?? 0) - (o.received_amount ?? 0),
    })),
  } as CustomerDetail;
}

export async function createCustomer(
  db: D1Database,
  auth: AuthContext,
  input: CustomerCreateInput,
  ctx: { requestId: string; ip: string | null },
): Promise<{ id: string }> {
  // Nhân viên luôn tự gán cho mình; Quản lý được chọn owner (mục 4).
  const ownerId = auth.user.role === 'EMPLOYEE' ? auth.user.id : (input.owner_id ?? auth.user.id);
  const phone = normalizePhone(input.phone_text ?? null);
  const now = nowIso();
  const id = newId();
  const nextFollowUp = input.next_follow_up_at ?? vnDate();

  if (phone.normalized) {
    const dup = await db
      .prepare('SELECT id, name FROM customers WHERE phone_normalized = ? AND deleted_at IS NULL')
      .bind(phone.normalized)
      .first<{ id: string; name: string }>();
    if (dup) {
      throw unprocessable(
        'DUPLICATE_PHONE',
        `Số điện thoại này đã thuộc khách "${dup.name}". Kiểm tra lại trước khi tạo mới.`,
        { phone_text: 'Số điện thoại đã tồn tại trong hệ thống' },
      );
    }
  }

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO customers (id, legacy_code, name, phone_text, phone_normalized, province, address,
           tier_id, owner_id, source, stage, potential, interested_products, reorder_cycle_days,
           first_contact_date, next_follow_up_at, opening_debt, data_quality, data_quality_note,
           created_by, created_at, updated_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.name,
        phone.text,
        phone.normalized,
        input.province ?? null,
        input.address ?? null,
        input.tier_id ?? null,
        ownerId,
        input.source ?? null,
        input.stage ?? 'NEW',
        input.potential ?? null,
        input.interested_products ?? null,
        input.reorder_cycle_days ?? null,
        vnDate(),
        nextFollowUp,
        phone.needsReview ? 'NEEDS_REVIEW' : 'OK',
        phone.needsReview ? phone.note ?? null : null,
        auth.user.id,
        now,
        now,
      ),
    // Khách mở phải có việc chăm sóc đầu tiên (mục 7.2)
    db
      .prepare(
        `INSERT INTO tasks (id, customer_id, assignee_id, type, title, due_at, status, priority,
           created_by, created_at, updated_at)
         VALUES (?, ?, ?, 'FIRST_CONTACT', ?, ?, 'OPEN', 'HIGH', ?, ?, ?)`,
      )
      .bind(
        newId(),
        id,
        ownerId,
        `Liên hệ lần đầu: ${input.name}`,
        nextFollowUp,
        auth.user.id,
        now,
        now,
      ),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'CUSTOMER_CREATED',
      entityType: 'CUSTOMER',
      entityId: id,
      after: { name: input.name, owner_id: ownerId, stage: input.stage ?? 'NEW' },
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ];

  await db.batch(statements);
  return { id };
}

/**
 * Sửa hồ sơ khách: thông tin liên hệ, cấp giá, giai đoạn, chu kỳ tái mua...
 * - Nhân viên chỉ sửa được khách của mình và KHÔNG được đổi cấp giá (ảnh hưởng giá bán và hạn mức).
 * - Đổi cấp giá / đổi chủ sở hữu là quyền của Quản lý trở lên, có audit riêng.
 */
export async function updateCustomer(
  db: D1Database,
  auth: AuthContext,
  customerId: string,
  input: Record<string, unknown>,
  ctx: { requestId: string; ip: string | null },
): Promise<void> {
  const before = await db
    .prepare(
      `SELECT id, name, phone_text, province, address, tier_id, owner_id, source, stage, potential,
              interested_products, reorder_cycle_days, next_follow_up_at, credit_limit, data_quality,
              lost_reason
       FROM customers WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(customerId)
    .first<Record<string, unknown>>();
  if (!before) throw notFound('Không tìm thấy khách hàng');
  if (auth.scope === 'OWN' && before.owner_id !== auth.user.id) throw notFound('Không tìm thấy khách hàng');

  const changingTier = input.tier_id !== undefined && input.tier_id !== before.tier_id;
  if (changingTier && !can(auth.user.role, 'customer.tier.change')) {
    throw forbidden('Chỉ Quản lý hoặc CEO được đổi cấp giá của khách hàng.');
  }
  if (input.owner_id !== undefined && input.owner_id !== before.owner_id) {
    throw badRequest('USE_REASSIGN', 'Đổi người phụ trách phải dùng chức năng Chuyển sale (bắt buộc ghi lý do).');
  }

  const stage = input.stage as CustomerStage | undefined;
  if (stage && stage !== before.stage) {
    if (requiresManagerToReopen(before.stage as CustomerStage, stage) && auth.user.role === 'EMPLOYEE') {
      throw forbidden('Chỉ Quản lý được mở lại khách đã mất.');
    }
    if (!canTransition(before.stage as CustomerStage, stage)) {
      throw unprocessable(
        'INVALID_STAGE_TRANSITION',
        `Không thể chuyển từ "${before.stage}" sang "${stage}".`,
        { stage: 'Giai đoạn không hợp lệ theo vòng đời khách hàng' },
      );
    }
    if (stage === 'LOST' && !input.lost_reason) {
      throw unprocessable('LOST_REASON_REQUIRED', 'Chuyển sang Mất khách phải ghi lý do.', {
        lost_reason: 'Bắt buộc ghi lý do mất khách',
      });
    }
  }

  const allowed = [
    'name',
    'phone_text',
    'province',
    'address',
    'tier_id',
    'source',
    'stage',
    'potential',
    'interested_products',
    'reorder_cycle_days',
    'next_follow_up_at',
    'credit_limit',
    'lost_reason',
    'data_quality',
  ];

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (!(key in input) || input[key] === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(input[key]);
  }

  if (input.phone_text !== undefined) {
    const phone = normalizePhone(input.phone_text);
    fields.push('phone_normalized = ?');
    values.push(phone.normalized);
  }

  if (fields.length === 0) return;

  const now = nowIso();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(`UPDATE customers SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`)
      .bind(...values, now, customerId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: changingTier ? 'CUSTOMER_TIER_CHANGED' : 'CUSTOMER_UPDATED',
      entityType: 'CUSTOMER',
      entityId: customerId,
      before,
      after: input,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ];

  await db.batch(statements);
}

export async function reassignCustomer(
  db: D1Database,
  auth: AuthContext,
  customerId: string,
  newOwnerId: string,
  reason: string,
  ctx: { requestId: string; ip: string | null },
): Promise<void> {
  const customer = await db
    .prepare('SELECT id, name, owner_id FROM customers WHERE id = ? AND deleted_at IS NULL')
    .bind(customerId)
    .first<{ id: string; name: string; owner_id: string | null }>();
  if (!customer) throw notFound('Không tìm thấy khách hàng');

  const owner = await db
    .prepare(`SELECT id, display_name FROM users WHERE id = ? AND status = 'ACTIVE'`)
    .bind(newOwnerId)
    .first<{ id: string; display_name: string }>();
  if (!owner) throw badRequest('OWNER_NOT_FOUND', 'Nhân viên nhận khách không tồn tại hoặc đã bị khoá');

  const now = nowIso();
  await db.batch([
    db
      .prepare('UPDATE customers SET owner_id = ?, updated_at = ? WHERE id = ?')
      .bind(newOwnerId, now, customerId),
    db
      .prepare(`UPDATE tasks SET assignee_id = ?, updated_at = ? WHERE customer_id = ? AND status = 'OPEN'`)
      .bind(newOwnerId, now, customerId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'CUSTOMER_REASSIGNED',
      entityType: 'CUSTOMER',
      entityId: customerId,
      before: { owner_id: customer.owner_id },
      after: { owner_id: newOwnerId },
      reason,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
}

/**
 * Ghi nhận chăm sóc (append-only) + cập nhật giai đoạn + tạo task tiếp theo.
 * Khách chưa đóng mà thiếu next_action/next_date đã bị schema chặn từ trước (AC-10).
 */
export async function addActivity(
  db: D1Database,
  auth: AuthContext,
  customerId: string,
  input: ActivityCreateInput,
  _config: AppConfig,
  ctx: { requestId: string; ip: string | null },
): Promise<{ id: string }> {
  const customer = await db
    .prepare('SELECT id, name, owner_id, stage FROM customers WHERE id = ? AND deleted_at IS NULL')
    .bind(customerId)
    .first<{ id: string; name: string; owner_id: string | null; stage: CustomerStage }>();
  if (!customer) throw notFound('Không tìm thấy khách hàng');
  if (auth.scope === 'OWN' && customer.owner_id !== auth.user.id) throw notFound('Không tìm thấy khách hàng');

  const closing = (CLOSING_RESULTS as readonly string[]).includes(input.result);
  let nextStage: CustomerStage = customer.stage;
  if (input.stage && input.stage !== customer.stage) {
    if (requiresManagerToReopen(customer.stage, input.stage) && auth.user.role === 'EMPLOYEE') {
      throw forbidden('Chỉ Quản lý được mở lại khách đã mất.');
    }
    if (!canTransition(customer.stage, input.stage)) {
      throw unprocessable(
        'INVALID_STAGE_TRANSITION',
        `Không thể chuyển từ "${customer.stage}" sang "${input.stage}".`,
        { stage: 'Giai đoạn không hợp lệ theo vòng đời khách hàng' },
      );
    }
    nextStage = input.stage;
  } else if (input.result === 'Mất khách') {
    nextStage = 'LOST';
  }

  if (isOpenStage(nextStage) && !input.next_date) {
    throw unprocessable('NEXT_FOLLOW_UP_REQUIRED', 'Khách chưa đóng bắt buộc phải có lịch chăm sóc tiếp.', {
      next_date: 'Bắt buộc chọn ngày chăm sóc tiếp',
    });
  }

  const now = nowIso();
  const activityId = newId();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO customer_activities (id, customer_id, user_id, channel, result, content,
           next_action, next_date, reason_code, stage_before, stage_after, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        activityId,
        customerId,
        auth.user.id,
        input.channel,
        input.result,
        input.content,
        input.next_action ?? null,
        input.next_date ?? null,
        input.reason_code ?? null,
        customer.stage,
        nextStage,
        now,
      ),
    db
      .prepare(
        `UPDATE customers SET stage = ?, next_follow_up_at = ?, lost_reason = COALESCE(?, lost_reason),
           updated_at = ? WHERE id = ?`,
      )
      .bind(
        nextStage,
        input.next_date ?? null,
        closing ? (input.reason_code ?? null) : null,
        now,
        customerId,
      ),
    // Đóng các việc còn mở của khách này, sau đó mở việc mới theo lịch hẹn tiếp theo.
    db
      .prepare(
        `UPDATE tasks SET status = 'DONE', completed_at = ?, updated_at = ?
         WHERE customer_id = ? AND status = 'OPEN'`,
      )
      .bind(now, now, customerId),
  ];

  if (input.next_date) {
    statements.push(
      db
        .prepare(
          `INSERT INTO tasks (id, customer_id, assignee_id, type, title, due_at, status, priority,
             source_activity_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, 'FOLLOW_UP', ?, ?, 'OPEN', 'NORMAL', ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          customerId,
          customer.owner_id ?? auth.user.id,
          input.next_action ?? `Chăm sóc tiếp: ${customer.name}`,
          input.next_date,
          activityId,
          auth.user.id,
          now,
          now,
        ),
    );
  }

  statements.push(
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ACTIVITY_ADDED',
      entityType: 'CUSTOMER',
      entityId: customerId,
      before: { stage: customer.stage },
      after: { stage: nextStage, result: input.result, next_date: input.next_date ?? null },
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  );

  await db.batch(statements);
  return { id: activityId };
}

/** Danh sách việc hôm nay + quá hạn của một nhân viên (màn hình "Việc hôm nay"). */
export async function listTasks(
  db: D1Database,
  assigneeId: string | null,
  filter: 'today' | 'overdue' | 'open',
): Promise<TaskItem[]> {
  const today = vnDate();
  const where: string[] = [`t.status = 'OPEN'`];
  const params: unknown[] = [];
  if (assigneeId) {
    where.push('t.assignee_id = ?');
    params.push(assigneeId);
  }
  if (filter === 'today') {
    where.push('t.due_at <= ?');
    params.push(today);
  } else if (filter === 'overdue') {
    where.push('t.due_at < ?');
    params.push(today);
  }

  const rows = await db
    .prepare(
      `SELECT t.id, t.customer_id, c.name AS customer_name, t.assignee_id, u.display_name AS assignee_name,
              t.type, t.title, t.due_at, t.status, t.priority
       FROM tasks t
       LEFT JOIN customers c ON c.id = t.customer_id
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE ${where.join(' AND ')}
       ORDER BY t.due_at, t.priority DESC LIMIT 200`,
    )
    .bind(...params)
    .all<TaskItem>();

  return (rows.results ?? []).map((t) => ({ ...t, overdue: t.due_at < today }));
}

export async function completeTask(
  db: D1Database,
  auth: AuthContext,
  taskId: string,
  note: string | null,
  ctx: { requestId: string; ip: string | null },
): Promise<void> {
  const task = await db
    .prepare('SELECT id, assignee_id, status FROM tasks WHERE id = ?')
    .bind(taskId)
    .first<{ id: string; assignee_id: string; status: string }>();
  if (!task) throw notFound('Không tìm thấy công việc');
  if (auth.user.role === 'EMPLOYEE' && task.assignee_id !== auth.user.id) {
    throw forbidden('Chỉ người được giao mới hoàn thành được việc này');
  }
  const now = nowIso();
  await db.batch([
    db
      .prepare(`UPDATE tasks SET status = 'DONE', completed_at = ?, updated_at = ? WHERE id = ?`)
      .bind(now, now, taskId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'TASK_COMPLETED',
      entityType: 'TASK',
      entityId: taskId,
      after: { status: 'DONE' },
      reason: note,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
}

export { vnDateOffset };

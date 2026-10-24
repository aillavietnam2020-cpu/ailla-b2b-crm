import { newId } from './ids';

/** Người nhận việc theo vai trò: quản lý điều phối / CEO duyệt, kế toán xác nhận. */
export async function approverIds(db: D1Database): Promise<string[]> {
  const r = await db
    .prepare(
      `SELECT DISTINCT u.id FROM users u
       WHERE u.status = 'ACTIVE' AND u.deleted_at IS NULL AND u.kind = 'HUMAN'
         AND (u.role IN ('CEO', 'MANAGER') OR EXISTS (SELECT 1 FROM user_permissions p WHERE p.user_id = u.id AND p.permission = 'order.approve.normal'))`,
    )
    .all<{ id: string }>();
  return (r.results ?? []).map((x) => x.id);
}

export async function accountantIds(db: D1Database): Promise<string[]> {
  const r = await db
    .prepare(
      `SELECT DISTINCT u.id FROM users u JOIN user_permissions p ON p.user_id = u.id AND p.permission = 'order.accounting.confirm'
       WHERE u.status = 'ACTIVE' AND u.deleted_at IS NULL AND u.kind = 'HUMAN'`,
    )
    .all<{ id: string }>();
  const ids = (r.results ?? []).map((x) => x.id);
  return ids.length ? ids : approverIds(db);
}

/** Tạo một việc (hiện ở Việc hôm nay của người nhận) cho từng người trong danh sách, trừ chính người đang làm. */
export function taskStatements(
  db: D1Database,
  userIds: string[],
  opts: { title: string; customerId?: string | null; createdBy: string | null; now: string; priority?: 'NORMAL' | 'HIGH' },
): D1PreparedStatement[] {
  return [...new Set(userIds)]
    .filter((id) => id && id !== opts.createdBy)
    .map((id) =>
      db
        .prepare(
          `INSERT INTO tasks (id, customer_id, assignee_id, type, title, due_at, status, priority, created_by, created_at, updated_at)
           VALUES (?, ?, ?, 'FOLLOW_UP', ?, ?, 'OPEN', ?, ?, ?, ?)`,
        )
        .bind(newId(), opts.customerId ?? null, id, opts.title.slice(0, 480), opts.now, opts.priority ?? 'HIGH', opts.createdBy, opts.now, opts.now),
    );
}

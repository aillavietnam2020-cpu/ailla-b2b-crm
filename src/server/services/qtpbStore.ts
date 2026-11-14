/** Quản trị phòng ban: đọc / ghi bảng qtpb_requests, qtpb_log (migration 0330). */
import { nowIso } from '@shared/datetime';
import { newId } from '../lib/ids';
import type { QtpbLogRow } from '../lib/qtpb';

/** Tài khoản đăng nhập của người mới đã được duyệt: HCNS được gắn vào bản chung khi thêm người. */
export async function approvedNewcomers(db: D1Database): Promise<Set<string>> {
  try {
    const { results } = await db
      .prepare("SELECT crm_id FROM qtpb_requests WHERE status = 'APPROVED' AND crm_id IS NOT NULL")
      .all<{ crm_id: string }>();
    return new Set((results ?? []).map((r) => r.crm_id));
  } catch {
    return new Set(); // bảng chưa có (chưa chạy migration) thì coi như chưa duyệt ai
  }
}

export async function writeQtpbLog(
  db: D1Database,
  rows: QtpbLogRow[],
  actor: { id: string; name: string; role: string },
): Promise<void> {
  if (!rows.length) return;
  const at = nowIso();
  await db.batch(
    rows.map((r) =>
      db
        .prepare(
          `INSERT INTO qtpb_log (id, at, actor_id, actor_name, actor_role, dept, action, target, target_name, summary, before_json, after_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          at,
          actor.id,
          actor.name,
          actor.role,
          r.dept,
          r.action,
          r.target,
          r.target_name,
          r.summary,
          JSON.stringify(r.before ?? null),
          JSON.stringify(r.after ?? null),
        ),
    ),
  );
}

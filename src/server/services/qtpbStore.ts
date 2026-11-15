/** Quản trị phòng ban: đọc / ghi bảng qtpb_requests, qtpb_log (migration 0330). */
import { nowIso } from '@shared/datetime';
import { newId } from '../lib/ids';
import { revertDef, sanitizeDef } from '../lib/bangDuLieu';
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

/** Hoàn tác thay đổi cấu trúc bảng (gọi từ /api/hub/qtpb/log/:id/undo). before = null nghĩa là hoàn tác việc tạo bảng. */
export async function undoBang(db: D1Database, tableId: string, before: unknown, after: unknown): Promise<boolean> {
  const t = await db.prepare('SELECT id, name, def_json FROM qtpb_tables WHERE id = ?').bind(tableId).first<{ id: string; name: string; def_json: string }>();
  if (!t) return false;
  if (!before || typeof before !== 'object') {
    await db.prepare('UPDATE qtpb_tables SET deleted_at = ? WHERE id = ?').bind(nowIso(), tableId).run();
    return true;
  }
  const b = before as { name?: string; def?: unknown };
  const a = (after && typeof after === 'object' ? after : {}) as { name?: string; def?: unknown; deleted?: boolean };
  if (a.deleted) {
    await db.prepare('UPDATE qtpb_tables SET deleted_at = NULL, updated_at = ? WHERE id = ?').bind(nowIso(), tableId).run();
    return true;
  }
  let cur = sanitizeDef({});
  try {
    cur = sanitizeDef(JSON.parse(t.def_json));
  } catch {
    /* cấu trúc hỏng thì lấy bản trước */
  }
  const def = revertDef(cur, sanitizeDef(b.def), sanitizeDef(a.def ?? b.def));
  const name = a.name !== undefined && a.name !== b.name ? String(b.name ?? t.name) : t.name;
  await db
    .prepare('UPDATE qtpb_tables SET name = ?, def_json = ?, deleted_at = NULL, updated_at = ? WHERE id = ?')
    .bind(name, JSON.stringify(def.cols.length ? def : sanitizeDef(b.def)), nowIso(), tableId)
    .run();
  return true;
}

/**
 * Phòng nào đang được mời xem ít nhất một bảng của phòng khác: ghi vào bản chung (qtpb.bangXem) để menu
 * "Bảng dữ liệu" hiện cho nhân sự phòng đó mà trình duyệt không phải hỏi máy chủ mỗi lần mở web.
 * Chỉ ghi khi danh sách đổi (tránh làm người khác phải tải lại bản chung).
 */
export async function syncBangXem(
  db: D1Database,
  current: string[] | undefined,
  mutate: (f: (q: { bangXem?: string[] }) => boolean) => Promise<boolean>,
): Promise<void> {
  const { results } = await db.prepare('SELECT def_json FROM qtpb_tables WHERE deleted_at IS NULL').all<{ def_json: string }>();
  const set = new Set<string>();
  for (const r of results ?? []) {
    const d = sanitizeDef(JSON.parse(r.def_json || '{}'));
    if (d.xem.mode === 'phong') d.xem.them.forEach((x) => set.add(x));
  }
  const next = [...set].sort();
  if (JSON.stringify(next) === JSON.stringify([...(current ?? [])].sort())) return;
  await mutate((q) => {
    q.bangXem = next;
    return true;
  });
}

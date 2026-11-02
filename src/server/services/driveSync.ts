import { nowIso } from '@shared/datetime';
import { unpack } from '../lib/pack';
import {
  desiredGrants,
  isActiveStaff,
  normEmail,
  normalizeConfig,
  planSync,
  type DriveConfig,
  type StaffRow,
} from '../lib/driveAccess';
import { addPermission, listPermissions, removePermission, saKey, setPermissionRole } from './gdrive';

/**
 * Cấp quyền Google Drive theo danh sách nhân viên ở trang quản trị (Nhân sự › Nhân viên):
 * phòng ban + trạng thái lấy ở danh sách nhân viên, email lấy ở hồ sơ (ngăn nhân sự). Quy tắc ở lib/driveAccess.ts.
 * Tài khoản của web phải là "Người chỉnh sửa" của thư mục thì mới cấp được quyền cho người khác.
 * Email web đã cấp được nhớ ở hub_blobs 'drive_grants' để lần sau biết người nào web được phép gỡ.
 * Chạy khi CEO bấm "Đồng bộ quyền" và mỗi giờ một lần (cron).
 */
const GRANTS_KEY = 'drive_grants';

type HubUser = { role?: string; maNS?: string; active?: boolean };
export type SyncResult = {
  ok: boolean;
  message?: string;
  folders: { folder_id: string; pb: string; added: string[]; changed: string[]; removed: string[]; error?: string }[];
  no_email: { ma: string; ten: string; pb: string }[];
};

async function readJson<T>(db: D1Database, sql: string, ...bind: string[]): Promise<T | null> {
  const row = await db.prepare(sql).bind(...bind).first<{ data: string }>();
  return row ? (JSON.parse(row.data) as T) : null;
}

export async function loadStaff(db: D1Database): Promise<{ staff: StaffRow[]; names: Map<string, string> }> {
  const main = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  const hr = await db.prepare("SELECT data FROM hub_state WHERE id = 'hr'").first<{ data: string }>();
  const d = main ? (JSON.parse(await unpack(main.data)) as { staff?: { ma: string; ten?: string; pb?: string; tt?: string }[]; users?: HubUser[] }) : {};
  const ns = hr ? ((JSON.parse(await unpack(hr.data)) as { ns?: Record<string, { hs?: { email?: string } }> }).ns ?? {}) : {};
  const leads = new Set((d.users ?? []).filter((u) => u.active !== false && u.maNS && ['lead', 'truongphong'].includes(u.role ?? '')).map((u) => u.maNS as string));
  // Tài khoản web đã khóa ("Đã nghỉ việc" ở Tài khoản & phân quyền) mà có gắn mã nhân viên: coi như đã nghỉ.
  const locked = new Set((d.users ?? []).filter((u) => u.active === false && u.maNS).map((u) => u.maNS as string));
  const names = new Map<string, string>();
  const staff = (d.staff ?? []).map((s) => {
    names.set(s.ma, s.ten ?? s.ma);
    return { ma: s.ma, pb: s.pb ?? '', tt: locked.has(s.ma) ? 'Đã nghỉ' : (s.tt ?? ''), email: ns[s.ma]?.hs?.email ?? '', lead: leads.has(s.ma) };
  });
  return { staff, names };
}

/** Tự đồng bộ mỗi giờ chỉ bật sau khi CEO đã xem trước và bấm "Áp dụng" ít nhất một lần (tránh cấp nhầm khi hồ sơ chưa cập nhật). */
export async function autoSyncEnabled(db: D1Database): Promise<boolean> {
  const row = await db.prepare('SELECT 1 AS x FROM hub_blobs WHERE key = ?').bind(GRANTS_KEY).first<{ x: number }>();
  return !!row;
}

export async function syncDrivePermissions(db: D1Database, saJson: string | undefined, actorId: string | null, dry = false): Promise<SyncResult> {
  const key = saKey(saJson);
  if (!key) return { ok: false, message: 'Web chưa nối Google Drive.', folders: [], no_email: [] };
  const cfg: DriveConfig = normalizeConfig((await readJson<unknown>(db, 'SELECT data FROM hub_blobs WHERE key = ?', 'drive_teams')) ?? {});
  const { staff, names } = await loadStaff(db);
  const grants = (await readJson<Record<string, string[]>>(db, 'SELECT data FROM hub_blobs WHERE key = ?', GRANTS_KEY)) ?? {};
  const want = desiredGrants(cfg, staff);
  const left = new Set(staff.filter((s) => !isActiveStaff(s)).map((s) => normEmail(s.email)).filter(Boolean));
  const self = key.client_email.toLowerCase();
  const pbs = new Set(cfg.teams.map((t) => t.pb));
  const result: SyncResult = {
    ok: true,
    folders: [],
    no_email: staff.filter((s) => isActiveStaff(s) && pbs.has(s.pb) && !normEmail(s.email)).map((s) => ({ ma: s.ma, ten: names.get(s.ma) ?? s.ma, pb: s.pb })),
  };
  for (const t of cfg.teams) {
    // Thư mục chỉ CEO xem (không ai cần cấp, web chưa từng cấp ai): bỏ qua, khỏi cần quyền chỉnh sửa.
    if (!(want.get(t.folderId)?.size) && !(grants[t.folderId]?.length)) continue;
    const row: SyncResult['folders'][number] = { folder_id: t.folderId, pb: t.pb, added: [], changed: [], removed: [] };
    result.folders.push(row);
    const cur = await listPermissions(key, t.folderId);
    if (!cur) {
      row.error = 'Web chưa có quyền chỉnh sửa thư mục này nên không cấp quyền được.';
      continue;
    }
    const managed = new Set(grants[t.folderId] ?? []);
    const plan = planSync(
      cur.filter((p) => p.type === 'user' && (p.emailAddress ?? '').toLowerCase() !== self).map((p) => ({ id: p.id, email: p.emailAddress ?? '', role: p.role })),
      want.get(t.folderId) ?? new Map(),
      managed,
      left,
    );
    if (dry) {
      row.added = plan.add.map((x) => `${x.email} (${x.role === 'writer' ? 'sửa' : 'xem'})`);
      row.changed = plan.update.map((x) => `${x.email} → ${x.role === 'writer' ? 'sửa' : 'xem'}`);
      row.removed = plan.remove.map((x) => x.email);
      continue;
    }
    for (const x of plan.add) if (await addPermission(key, t.folderId, x.email, x.role)) { row.added.push(x.email); managed.add(x.email); }
    for (const x of plan.update) if (await setPermissionRole(key, t.folderId, x.id, x.role)) { row.changed.push(x.email); managed.add(x.email); }
    for (const x of plan.remove) if (await removePermission(key, t.folderId, x.id)) { row.removed.push(x.email); managed.delete(x.email); }
    if (plan.add.length + plan.update.length + plan.remove.length > row.added.length + row.changed.length + row.removed.length) {
      row.error = 'Có quyền chưa cấp / gỡ được (web cần là Người chỉnh sửa của thư mục).';
    }
    grants[t.folderId] = [...managed];
  }
  if (!dry) {
    await db
      .prepare(
        `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)
         ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      )
      .bind(GRANTS_KEY, JSON.stringify(grants), nowIso(), actorId)
      .run();
  }
  return result;
}

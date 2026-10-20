import type { AuthContext } from '../env';
import { nowIso } from '@shared/datetime';
import { unpack } from './pack';

/**
 * Ai được xem dữ liệu nhân sự (lương, CCCD, ngân hàng, hồ sơ, file đính kèm):
 * CEO, kế toán (quyền xem công nợ toàn công ty), và người trong khu quản trị có quyền
 * "quản lý nhân sự" / "bảng lương" hoặc thuộc phòng HCNS.
 *
 * QUAN TRỌNG: danh sách người được xem KHÔNG đọc trực tiếp từ bản dữ liệu chung (bản chung ai trong khu
 * Marketing cũng ghi được, nên không thể tin). Danh sách tin cậy ('hr_grant') chỉ được cập nhật khi CEO ghi
 * bản dữ liệu chung (hub.ts), và lần đầu được dựng từ bản chung đang có.
 */
type HubUser = { id?: string; crm?: string; active?: boolean; phongBan?: string; perms?: string[] };
export const HR_GRANT_KEY = 'hr_grant';

/** Những tài khoản CRM (theo mã đăng nhập) được xem nhân sự, suy ra từ danh sách người dùng của khu Marketing. */
export function hrGrantFromUsers(users: HubUser[] | undefined): string[] {
  const ids = new Set<string>();
  for (const u of users ?? []) {
    if (!u || !u.crm || u.active === false) continue;
    if (u.phongBan === 'HCNS' || u.perms?.some((p) => p === 'nhansu.quanly' || p === 'luong.quanly')) ids.add(u.crm);
  }
  return [...ids];
}

export async function saveHrGrant(db: D1Database, ids: string[], userId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)
       ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    )
    .bind(HR_GRANT_KEY, JSON.stringify(ids), nowIso(), userId)
    .run();
}

async function loadHrGrant(db: D1Database): Promise<string[] | null> {
  const row = await db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(HR_GRANT_KEY).first<{ data: string }>();
  if (!row) return null;
  try {
    const v = JSON.parse(row.data);
    return Array.isArray(v) ? v.map(String) : null;
  } catch {
    return null;
  }
}

export async function canHr(db: D1Database, auth: AuthContext): Promise<boolean> {
  if (auth.user.role === 'CEO' || auth.permissions.includes('debt.read.all')) return true;
  let ids = await loadHrGrant(db);
  if (!ids) {
    // Lần đầu sau khi bật cơ chế này: dựng từ bản chung đang có, rồi từ đó chỉ CEO mới đổi được.
    const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
    if (!row) return false;
    const data = JSON.parse(await unpack(row.data)) as { users?: HubUser[] };
    ids = hrGrantFromUsers(data.users);
    await saveHrGrant(db, ids, auth.user.id);
  }
  return ids.includes(auth.user.id);
}

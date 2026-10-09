import type { AuthContext } from '../env';
import { unpack } from './pack';

/**
 * Ai được xem dữ liệu nhân sự (lương, CCCD, ngân hàng, hồ sơ, file đính kèm):
 * CEO, kế toán (quyền xem công nợ toàn công ty), và người trong khu quản trị có quyền
 * "quản lý nhân sự" / "bảng lương" hoặc thuộc phòng HCNS.
 */
type HubUser = { crm?: string; active?: boolean; phongBan?: string; perms?: string[] };
const cache = new Map<string, { ok: boolean; at: number }>();

export function hrFromUsers(auth: AuthContext, users: HubUser[] | undefined): boolean {
  if (auth.user.role === 'CEO' || auth.permissions.includes('debt.read.all')) return true;
  const u = (users ?? []).find((x) => x && x.crm === auth.user.id && x.active !== false);
  const ok = !!u && (u.phongBan === 'HCNS' || !!u.perms?.some((p) => p === 'nhansu.quanly' || p === 'luong.quanly'));
  cache.set(auth.user.id, { ok, at: Date.now() });
  return ok;
}

export async function canHr(db: D1Database, auth: AuthContext): Promise<boolean> {
  if (auth.user.role === 'CEO' || auth.permissions.includes('debt.read.all')) return true;
  const hit = cache.get(auth.user.id);
  if (hit && Date.now() - hit.at < 60_000) return hit.ok;
  const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  if (!row) return false;
  const data = JSON.parse(await unpack(row.data)) as { users?: HubUser[] };
  return hrFromUsers(auth, data.users);
}

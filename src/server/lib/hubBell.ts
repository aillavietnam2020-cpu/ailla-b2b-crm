import { nowIso } from '@shared/datetime';
import { pack, unpack } from './pack';

/**
 * Chuông thông báo trên web (mảng notifs trong hub_state 'main') gửi từ máy chủ, cùng cách với services/taskReminders.ts.
 * Người nhận theo mã đăng nhập CRM (users.crm trong dữ liệu chung); máy chủ đổi sang mã người dùng web.
 * Trình duyệt tự bật thông báo của máy khi tab đang ẩn (hub/src/thongbao.js).
 */
type HubUser = { id?: string; crm?: string; maNS?: string; name?: string; role?: string; phongBan?: string; active?: boolean };
type Notif = { id: string; to: string; text: string; at: string; ref: string; by: string; read: boolean };
const NT_KEEP = 600;

export async function bellTo(db: D1Database, crmIds: string[], text: string, ref = ''): Promise<number> {
  const want = new Set(crmIds.filter(Boolean));
  if (!want.size) return 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db.prepare("SELECT version, data FROM hub_state WHERE id = 'main'").first<{ version: number; data: string }>();
    if (!row) return 0;
    const d = JSON.parse(await unpack(row.data)) as { users?: HubUser[]; notifs?: Notif[] };
    const to = (d.users ?? []).filter((u) => u.active !== false && u.crm && want.has(u.crm) && u.id).map((u) => u.id as string);
    if (!to.length) return 0;
    const at = nowIso();
    d.notifs = d.notifs ?? [];
    for (const id of new Set(to))
      d.notifs.push({ id: 'nt' + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1e4).toString(36), to: id, text, at, ref, by: '', read: false });
    if (d.notifs.length > NT_KEEP) d.notifs = d.notifs.slice(-NT_KEEP);
    const res = await db
      .prepare("UPDATE hub_state SET version = version + 1, data = ?, updated_at = ? WHERE id = 'main' AND version = ?")
      .bind(await pack(JSON.stringify(d)), at, row.version)
      .run();
    if (res.meta.changes) return to.length;
  }
  return 0;
}

/** Người dùng web (mã đăng nhập → mã nhân sự, tên, phòng, vai trò), giữ 60 giây trong máy chủ. */
export type HubPerson = { crm: string; maNS: string; name: string; role: string; pb: string };
let PEOPLE: { at: number; map: Map<string, HubPerson> } | null = null;
export async function hubPeople(db: D1Database): Promise<Map<string, HubPerson>> {
  if (PEOPLE && Date.now() - PEOPLE.at < 60_000) return PEOPLE.map;
  const map = new Map<string, HubPerson>();
  const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  if (row) {
    const d = JSON.parse(await unpack(row.data)) as { users?: HubUser[] };
    for (const u of d.users ?? [])
      if (u?.crm && u.active !== false)
        map.set(u.crm, { crm: u.crm, maNS: u.maNS ?? '', name: u.name ?? '', role: u.role ?? '', pb: u.phongBan ?? '' });
  }
  PEOPLE = { at: Date.now(), map };
  return map;
}

/** Dữ liệu nhân sự riêng (hub_state 'hr': phép, bảng lương…), chỉ máy chủ đọc để trả đúng phần của từng người. */
export async function hrPrivate(db: D1Database): Promise<{ phep?: Record<string, { huong?: number; da?: number }>; payroll?: Record<string, { st?: string; ph?: string; rows?: { ma?: string }[] }> }> {
  const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'hr'").first<{ data: string }>();
  if (!row) return {};
  try {
    return JSON.parse(await unpack(row.data));
  } catch {
    return {};
  }
}

/**
 * Bảo vệ bản dữ liệu chung của khu Marketing (hub_state 'main').
 * Bản chung ai trong khu Marketing cũng ghi được, nên máy chủ phải tự giữ những thứ không được tin:
 *  - Chỉ CEO đổi được vai trò, quyền, phòng ban, team, khóa/mở của ai (phân quyền làm ở trang quản trị).
 *    Người làm nhân sự chỉ sửa được tên và chức vụ (nhãn), thêm người mới ở mức không quyền.
 *    Mọi người khác không sửa, không thêm bớt tài khoản (chỉ được tự gắn tài khoản đăng nhập của chính mình).
 *  - Mọi chữ có dạng mở thẻ HTML (<abc, </, <!, <?) bị đổi thành dấu ＜ toàn chiều rộng để không ai
 *    chèn được mã chạy trên màn hình người khác.
 */
export type GuardUser = {
  id?: string;
  crm?: string;
  role?: string;
  perms?: string[];
  phongBan?: string;
  active?: boolean;
  team?: string;
  username?: string;
  pw?: string;
  name?: string;
  title?: string;
  [k: string]: unknown;
};

const PROTECT = ['role', 'perms', 'phongBan', 'active', 'team', 'username', 'pw', 'name', 'title'] as const;

export function protectUsers(
  incoming: GuardUser[],
  existing: GuardUser[],
  callerId: string,
  hrAllowed: boolean,
): GuardUser[] {
  const inBy = new Map(incoming.map((u) => [u?.id, u]));
  const oldIds = new Set(existing.map((u) => u?.id));
  const out = existing.map((old) => {
    const inc = inBy.get(old?.id);
    if (!inc) return old;
    const o: GuardUser = { ...inc };
    for (const k of PROTECT) {
      if (k in old) o[k] = old[k] as never;
      else delete o[k];
    }
    // Người làm nhân sự được sửa tên và chức vụ (nhãn) của người thường, không đụng tới tài khoản quản trị.
    if (hrAllowed && old.role !== 'admin') {
      if ('name' in inc) o.name = inc.name;
      if ('title' in inc) o.title = inc.title;
    }
    if (old.crm) o.crm = old.crm;
    else o.crm = inc.crm === callerId ? inc.crm : '';
    return o;
  });
  // Người làm nhân sự thêm người mới thì chỉ ở mức thấp nhất: không quyền, không quản trị, chưa gắn tài khoản.
  if (hrAllowed) {
    for (const inc of incoming) {
      if (inc && !oldIds.has(inc.id)) {
        out.push({ ...inc, role: 'nhanvien', perms: [], crm: '', active: inc.active !== false });
      }
    }
  }
  return out;
}

const TAG_OPEN = /<(?=[A-Za-z/!?])/g;

/** Đổi tại chỗ mọi chuỗi trong cây dữ liệu; trả lại chính nó. */
export function neutralizeTags<T>(v: T): T {
  if (typeof v === 'string') return (v.includes('<') ? v.replace(TAG_OPEN, '＜') : v) as T;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i += 1) v[i] = neutralizeTags(v[i]);
    return v;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) o[k] = neutralizeTags(o[k]);
    return v;
  }
  return v;
}

/**
 * Bảo vệ bản dữ liệu chung của khu Marketing (hub_state 'main').
 * Bản chung ai trong khu Marketing cũng ghi được, nên máy chủ phải tự giữ những thứ không được tin:
 *  - Chỉ CEO đổi được vai trò, quyền, phòng ban, team, khóa/mở của ai (phân quyền làm ở trang quản trị).
 *    Người làm nhân sự sửa được tên, chức vụ (nhãn), phòng ban, mã nhân sự, trạng thái nghỉ phép / thai sản và chuyển
 *    "Đã nghỉ" (khóa) cho người thường — để hồ sơ Nhân sự và Tài khoản & phân quyền đồng bộ hai chiều; mở lại tài khoản
 *    đã khóa thì chỉ CEO. Thêm người mới ở mức không quyền.
 *    Mọi người khác không sửa, không thêm bớt tài khoản (chỉ được tự gắn tài khoản đăng nhập của chính mình).
 *  - Mọi chữ có dạng mở thẻ HTML (<abc, </, <!, <?) bị đổi thành dấu ＜ toàn chiều rộng để không ai
 *    chèn được mã chạy trên màn hình người khác.
 */
import { applyLeadEdits, NEWCOMER_ROLES, type LeadCtx } from './qtpb';

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
  tt?: string;
  maNS?: string;
  [k: string]: unknown;
};

const PROTECT = ['role', 'perms', 'phongBan', 'active', 'team', 'username', 'pw', 'name', 'title', 'tt', 'maNS'] as const;
const LEAVE_TT = ['', 'phep', 'thaisan'];

export function protectUsers(
  incoming: GuardUser[],
  existing: GuardUser[],
  callerId: string,
  hrAllowed: boolean,
  opts: { lead?: LeadCtx | null; approvedCrm?: Set<string> } = {},
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
      // Đồng bộ với hồ sơ Nhân sự (không tự đổi cho chính mình): phòng ban, mã nhân sự, nghỉ phép / thai sản, Đã nghỉ = khóa.
      if (old.crm !== callerId) {
        // Phòng HCNS kéo theo quyền xem lương: chỉ CEO đưa ai vào / ra phòng này.
        if (typeof inc.phongBan === 'string' && inc.phongBan !== 'HCNS' && old.phongBan !== 'HCNS') o.phongBan = inc.phongBan;
        if (typeof inc.maNS === 'string') o.maNS = inc.maNS;
        if (old.active !== false && inc.active === false) o.active = false;
        const tt = typeof inc.tt === 'string' ? inc.tt : '';
        if (LEAVE_TT.includes(tt)) o.tt = o.active === false ? '' : tt;
      }
    }
    if (old.crm) o.crm = old.crm;
    else o.crm = inc.crm === callerId ? inc.crm : '';
    return o;
  });
  // Người làm nhân sự thêm người mới thì chỉ ở mức thấp nhất: không quyền, không quản trị, chưa gắn tài khoản.
  // Người mới đã được HCNS / CEO duyệt ở Quản trị phòng (qtpb_requests) thì gắn luôn tài khoản đăng nhập vừa tạo.
  if (hrAllowed) {
    const usedCrm = new Set(existing.map((u) => u?.crm).filter(Boolean));
    for (const inc of incoming) {
      if (inc && !oldIds.has(inc.id)) {
        const okCrm = typeof inc.crm === 'string' && !!inc.crm && !!opts.approvedCrm?.has(inc.crm) && !usedCrm.has(inc.crm);
        if (okCrm) usedCrm.add(inc.crm as string);
        out.push({
          ...inc,
          role: okCrm && NEWCOMER_ROLES.includes(String(inc.role)) ? String(inc.role) : 'nhanvien',
          perms: [],
          crm: okCrm ? (inc.crm as string) : '',
          active: inc.active !== false,
        });
      }
    }
  }
  return opts.lead ? applyLeadEdits(out, incoming, existing, opts.lead) : out;
}

/**
 * Hồ sơ Nhân sự (data.staff: phòng ban, vị trí, trạng thái) nằm trong bản chung, mà trạng thái "Đã nghỉ" kéo theo khóa
 * tài khoản: người không làm nhân sự (không phải CEO) gửi lên thì giữ nguyên bản đang có.
 */
export function protectStaff(incoming: unknown, existing: unknown, hrAllowed: boolean): unknown {
  if (hrAllowed) return incoming;
  return Array.isArray(existing) ? existing : incoming;
}

/** Tài khoản CRM cần khóa / mở lại sau lần ghi: hub user chuyển active → khóa (hoặc ngược lại, chỉ CEO). */
export function accountChanges(next: GuardUser[], prev: GuardUser[], isCeo: boolean): { lock: string[]; unlock: string[] } {
  const before = new Map(prev.map((u) => [u?.id, u]));
  const lock: string[] = [];
  const unlock: string[] = [];
  for (const u of next) {
    const p = u && before.get(u.id);
    if (!p || !u.crm || u.role === 'admin') continue;
    if (p.active !== false && u.active === false) lock.push(u.crm);
    else if (isCeo && p.active === false && u.active !== false) unlock.push(u.crm);
  }
  return { lock, unlock };
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

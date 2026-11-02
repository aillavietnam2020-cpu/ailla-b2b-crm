/**
 * Thư mục làm việc (Google Drive trên web): ai được xem thư mục Drive của phòng ban nào.
 * Hàm thuần, không gọi Drive hay D1, để kiểm thử được.
 *
 * Quy tắc (chị Hoa 02/11/2026, ghi theo vai trò, không ghi tên người):
 *  - Người trong phòng ban luôn xem được thư mục của phòng mình.
 *  - Mỗi thư mục có thể cho xem thêm: "pb:ADS" = cả phòng Ads/Digital, "lead:CM" = trưởng nhóm / trưởng phòng của
 *    phòng Content, "lead:*" = trưởng nhóm / trưởng phòng mọi phòng.
 *  - Thư mục dùng chung (không thuộc riêng phòng nào, mã bắt đầu bằng "chung"): có tên riêng; "all" = mọi người có tài khoản.
 *  - Thư mục nằm trong thư mục khác: tính theo thư mục gốc GẦN NHẤT, nên thư mục phòng nằm trong thư mục chung vẫn chỉ phòng đó xem.
 *  - CEO thấy tất cả.
 * Phòng ban, vai trò của từng người lấy ở bản dữ liệu chung, nhưng chỉ CEO đổi được hai ô đó (lib/stateGuard.ts),
 * nên dùng làm căn cứ phân quyền được.
 */
export type DriveTeam = { pb: string; folderId: string; viewers: string[]; name?: string };
export type DriveConfig = { teams: DriveTeam[] };
export type DriveUser = { phongBan?: string; role?: string; active?: boolean };

const LEAD_ROLES = ['lead', 'truongphong'];
const ID_RE = /^[A-Za-z0-9_-]{10,80}$/;

/** Lấy mã thư mục từ đường link Drive dán vào (hoặc chính mã). Không nhận ra thì trả null. */
export function folderIdFrom(input: string): string | null {
  const s = String(input ?? '').trim();
  if (!s) return null;
  const m = s.match(/\/folders\/([A-Za-z0-9_-]+)/) ?? s.match(/[?&]id=([A-Za-z0-9_-]+)/);
  const id = m ? m[1] : s;
  return ID_RE.test(id) ? id : null;
}

export function normalizeConfig(raw: unknown): DriveConfig {
  const teams: DriveTeam[] = [];
  const seen = new Set<string>();
  const list = raw && typeof raw === 'object' && Array.isArray((raw as DriveConfig).teams) ? (raw as DriveConfig).teams : [];
  for (const t of list) {
    if (!t || typeof t !== 'object') continue;
    const pb = String(t.pb ?? '').trim();
    const folderId = folderIdFrom(String(t.folderId ?? ''));
    if (!pb || !folderId || seen.has(pb)) continue;
    seen.add(pb);
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(pb)) continue;
    const viewers = Array.isArray(t.viewers)
      ? [...new Set(t.viewers.map(String).filter((v) => /^(all|(pb|lead):[A-Za-z0-9_*-]{1,20})$/.test(v)))]
      : [];
    const name = String(t.name ?? '').trim().slice(0, 60);
    teams.push(name ? { pb, folderId, viewers, name } : { pb, folderId, viewers });
  }
  return { teams };
}

export function canSeeTeam(team: DriveTeam, user: DriveUser | null, isCeo: boolean): boolean {
  if (isCeo) return true;
  if (!user || user.active === false) return false;
  const pb = user.phongBan ?? '';
  const lead = LEAD_ROLES.includes(user.role ?? '');
  if (pb && pb === team.pb) return true;
  return team.viewers.some((v) => {
    if (v === 'all') return true;
    const [kind, code] = v.split(':');
    if (kind === 'pb') return !!pb && code === pb;
    if (kind === 'lead') return lead && (code === '*' || code === pb);
    return false;
  });
}

export const teamsFor = (cfg: DriveConfig, user: DriveUser | null, isCeo: boolean) =>
  cfg.teams.filter((t) => canSeeTeam(t, user, isCeo));

/**
 * Mọi thư mục gốc đã gán → mã phòng; thư mục người này KHÔNG được xem thì mã rỗng ('').
 * Dùng với locate: gốc gần nhất là thư mục bị chặn thì locate trả pb '' và nơi gọi phải từ chối.
 */
export const rootsFor = (cfg: DriveConfig, user: DriveUser | null, isCeo: boolean) =>
  new Map(cfg.teams.map((t) => [t.folderId, canSeeTeam(t, user, isCeo) ? t.pb : '']));

export type DriveMeta = { name: string; parents: string[] };

/**
 * Tìm xem một thư mục / file nằm dưới thư mục gốc nào trong `roots` (mã gốc → phòng ban), bằng cách đi ngược lên cha.
 * Trả về phòng ban và đường dẫn từ gốc xuống (gồm cả chính nó). Không nằm dưới gốc nào thì null.
 * Drive cho một file nhiều cha (hiếm): thử lần lượt, lấy đường đầu tiên tới được gốc.
 */
export async function locate(
  id: string,
  roots: Map<string, string>,
  meta: (id: string) => Promise<DriveMeta | null>,
  maxDepth = 15,
): Promise<{ pb: string; path: { id: string; name: string }[] } | null> {
  const walk = async (cur: string, depth: number, seen: Set<string>): Promise<{ pb: string; path: { id: string; name: string }[] } | null> => {
    if (depth > maxDepth || seen.has(cur)) return null;
    seen.add(cur);
    const m = await meta(cur);
    if (!m) return null;
    const pb = roots.get(cur);
    if (pb !== undefined) return { pb, path: [{ id: cur, name: m.name }] };
    for (const p of m.parents) {
      const up = await walk(p, depth + 1, seen);
      if (up) return { pb: up.pb, path: [...up.path, { id: cur, name: m.name }] };
    }
    return null;
  };
  return walk(id, 0, new Set());
}

/** Nhóm loại file để hiện biểu tượng và lọc. */
export function fileKind(mime: string, name = ''): 'folder' | 'sheet' | 'doc' | 'slide' | 'pdf' | 'vid' | 'img' | 'link' | 'other' {
  const m = mime || '';
  if (m === 'application/vnd.google-apps.folder') return 'folder';
  if (m === 'application/vnd.google-apps.shortcut') return 'link';
  if (m === 'application/vnd.google-apps.spreadsheet' || /spreadsheet|excel|csv/.test(m) || /\.(xlsx?|csv)$/i.test(name)) return 'sheet';
  if (m === 'application/vnd.google-apps.presentation' || /presentation|powerpoint/.test(m)) return 'slide';
  if (m === 'application/vnd.google-apps.document' || /wordprocessing|msword|text\//.test(m)) return 'doc';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('video/')) return 'vid';
  if (m.startsWith('image/')) return 'img';
  return 'other';
}

/* ---------- Đồng bộ quyền trên Drive theo danh sách nhân viên ở trang quản trị (chị Hoa 02/11) ----------
 * Nhân viên đang làm (không "Đã nghỉ") có email trong hồ sơ:
 *  - thư mục của phòng mình: được sửa (writer);
 *  - thư mục khác mình được xem theo cấu hình (thư mục dùng chung "all", trưởng nhóm…): chỉ xem (reader).
 * Nhân viên đã nghỉ, hoặc người web từng cấp mà nay không còn trong danh sách: gỡ quyền.
 * Không bao giờ đụng tới chủ thư mục, tài khoản của web, hay người chị tự chia sẻ tay (web không cấp thì web không gỡ). */
export type StaffRow = { ma: string; pb: string; tt?: string; email?: string; lead?: boolean };
export type DriveRole = 'writer' | 'reader';
export type DrivePerm = { id: string; email: string; role: string };

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
export const normEmail = (e: unknown) => {
  const s = String(e ?? '').trim().toLowerCase();
  return EMAIL_RE.test(s) ? s : '';
};
/** Chỉ người đã nghỉ việc mới mất quyền; nghỉ phép, thai sản, tạm nghỉ vẫn giữ (cùng cách với khóa tài khoản đăng nhập). */
export const isActiveStaff = (s: StaffRow) => !/^đã nghỉ|nghỉ việc/i.test((s.tt ?? '').trim());

/** Quyền cần có trên từng thư mục gốc: mã thư mục → (email → quyền). */
export function desiredGrants(cfg: DriveConfig, staff: StaffRow[]): Map<string, Map<string, DriveRole>> {
  const out = new Map<string, Map<string, DriveRole>>();
  for (const t of cfg.teams) {
    const m = new Map<string, DriveRole>();
    for (const s of staff) {
      const email = normEmail(s.email);
      if (!email || !isActiveStaff(s)) continue;
      if (s.pb === t.pb) m.set(email, 'writer');
      else if (canSeeTeam(t, { phongBan: s.pb, role: s.lead ? 'lead' : 'nhanvien' }, false) && !m.has(email)) m.set(email, 'reader');
    }
    out.set(t.folderId, m);
  }
  return out;
}

/**
 * So quyền đang có trên một thư mục với quyền cần có.
 * `managed`: email web đã từng cấp ở thư mục này; `left`: email của nhân viên đã nghỉ.
 * Chỉ nâng reader → writer; hạ writer → reader chỉ với người web quản lý. Chủ thư mục không bao giờ bị đổi.
 */
export function planSync(current: DrivePerm[], want: Map<string, DriveRole>, managed: Set<string>, left: Set<string>) {
  const add: { email: string; role: DriveRole }[] = [];
  const update: { id: string; email: string; role: DriveRole }[] = [];
  const remove: { id: string; email: string }[] = [];
  const byEmail = new Map(current.filter((p) => p.email).map((p) => [p.email.toLowerCase(), p]));
  for (const [email, role] of want) {
    const p = byEmail.get(email);
    if (!p) add.push({ email, role });
    else if (p.role === 'reader' || p.role === 'commenter') {
      if (role === 'writer') update.push({ id: p.id, email, role });
    } else if (p.role === 'writer' && role === 'reader' && managed.has(email)) update.push({ id: p.id, email, role });
  }
  for (const p of current) {
    const email = (p.email || '').toLowerCase();
    if (!email || p.role === 'owner' || want.has(email)) continue;
    if (managed.has(email) || left.has(email)) remove.push({ id: p.id, email });
  }
  return { add, update, remove };
}

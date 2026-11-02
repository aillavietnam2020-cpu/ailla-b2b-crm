/**
 * Thư mục làm việc (Google Drive trên web): ai được xem thư mục Drive của phòng ban nào.
 * Hàm thuần, không gọi Drive hay D1, để kiểm thử được.
 *
 * Quy tắc (chị Hoa 02/11/2026, ghi theo vai trò, không ghi tên người):
 *  - Người trong phòng ban luôn xem được thư mục của phòng mình.
 *  - Mỗi thư mục có thể cho xem thêm: "pb:ADS" = cả phòng Ads/Digital, "lead:CM" = trưởng nhóm / trưởng phòng của
 *    phòng Content, "lead:*" = trưởng nhóm / trưởng phòng mọi phòng.
 *  - CEO thấy tất cả.
 * Phòng ban, vai trò của từng người lấy ở bản dữ liệu chung, nhưng chỉ CEO đổi được hai ô đó (lib/stateGuard.ts),
 * nên dùng làm căn cứ phân quyền được.
 */
export type DriveTeam = { pb: string; folderId: string; viewers: string[] };
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
    const viewers = Array.isArray(t.viewers)
      ? [...new Set(t.viewers.map(String).filter((v) => /^(pb|lead):[A-Za-z0-9_*-]{1,20}$/.test(v)))]
      : [];
    teams.push({ pb, folderId, viewers });
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
    const [kind, code] = v.split(':');
    if (kind === 'pb') return !!pb && code === pb;
    if (kind === 'lead') return lead && (code === '*' || code === pb);
    return false;
  });
}

export const teamsFor = (cfg: DriveConfig, user: DriveUser | null, isCeo: boolean) =>
  cfg.teams.filter((t) => canSeeTeam(t, user, isCeo));

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
    if (pb) return { pb, path: [{ id: cur, name: m.name }] };
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

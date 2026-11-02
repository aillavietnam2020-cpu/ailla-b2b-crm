import { nowIso } from '@shared/datetime';
import { unpack } from '../lib/pack';

/**
 * Đào tạo & onboarding: ai xem được tài liệu nào, ai soạn được gì (hàm thuần + bản danh sách người tin cậy).
 *
 * Phòng ban, vai trò của từng người nằm trong danh sách người dùng của bản dữ liệu chung (hub_state.users), mà bản chung
 * thì ai trong khu Marketing cũng ghi được. Nên giống quyền xem nhân sự (lib/hrAccess), máy chủ giữ một bản chụp
 * tin cậy 'dt_members' trong hub_blobs, chỉ cập nhật khi CEO hoặc người làm nhân sự ghi bản chung (routes/hub.ts).
 */
export const DT_MEMBERS_KEY = 'dt_members';

type HubUser = { id?: string; crm?: string; name?: string; active?: boolean; role?: string; phongBan?: string; perms?: string[] };
type HubDep = { k?: string; n?: string };
export type Member = { name: string; pb: string; role: string; hr: boolean };
export type Members = { users: Record<string, Member>; deps: { k: string; n: string }[] };

/** Vai trò trên web vận hành được coi là quản lý của phòng mình. */
const MANAGER_ROLES = ['truongphong', 'lead', 'admin'];

export function membersFromHub(data: { users?: HubUser[]; departments?: HubDep[] } | undefined): Members {
  const users: Record<string, Member> = {};
  for (const u of data?.users ?? []) {
    if (!u || !u.crm || u.active === false) continue;
    users[u.crm] = {
      name: String(u.name ?? ''),
      pb: String(u.phongBan ?? ''),
      role: String(u.role ?? ''),
      hr: u.role === 'admin' || u.phongBan === 'HCNS' || !!u.perms?.includes('nhansu.quanly'),
    };
  }
  const deps = (data?.departments ?? []).filter((d) => d && d.k).map((d) => ({ k: String(d.k), n: String(d.n ?? d.k) }));
  return { users, deps };
}

export async function saveMembers(db: D1Database, m: Members, userId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)
       ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    )
    .bind(DT_MEMBERS_KEY, JSON.stringify(m), nowIso(), userId)
    .run();
}

export async function loadMembers(db: D1Database, userId: string): Promise<Members> {
  const row = await db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(DT_MEMBERS_KEY).first<{ data: string }>();
  if (row) {
    try {
      const v = JSON.parse(row.data) as Members;
      if (v && v.users) return v;
    } catch {
      /* dựng lại bên dưới */
    }
  }
  // Lần đầu: dựng từ bản chung đang có, từ đó chỉ CEO / nhân sự ghi mới đổi.
  const st = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  const m = membersFromHub(st ? JSON.parse(await unpack(st.data)) : undefined);
  await saveMembers(db, m, userId);
  return m;
}

/** Người đang xem: CEO, nhân sự, phòng ban của mình, phòng mình quản lý, quyền soạn được giao thêm. */
export type Viewer = { id: string; ceo: boolean; hr: boolean; pb: string; manager: boolean; scopes: string[] };

export function viewerOf(userId: string, serverRole: string, m: Members, granted: string[]): Viewer {
  const me = m.users[userId];
  const ceo = serverRole === 'CEO' || me?.role === 'admin';
  return { id: userId, ceo, hr: ceo || !!me?.hr, pb: me?.pb ?? '', manager: !!me && MANAGER_ROLES.includes(me.role) && !!me.pb, scopes: granted };
}

export type DocLite = { nhom: string; teams: string[]; status: string; created_by?: string };

/** Tài liệu Chung và Sổ tay web: mọi người. Tài liệu team: người trong team (cả quản lý team đó), CEO, nhân sự, người soạn được team đó. */
export function canSeeTeam(v: Viewer, teams: string[]): boolean {
  if (v.ceo || v.hr) return true;
  if (v.pb && teams.includes(v.pb)) return true;
  return teams.some((t) => v.scopes.includes('team:' + t));
}

export function canEditDoc(v: Viewer, d: Pick<DocLite, 'nhom' | 'teams'>): boolean {
  if (v.ceo) return true;
  if (d.nhom === 'chung' || d.nhom === 'web') return v.hr || v.scopes.includes(d.nhom);
  if (d.nhom !== 'team' || !d.teams.length) return false;
  if (v.hr) return true;
  return d.teams.every((t) => v.scopes.includes('team:' + t) || (v.manager && v.pb === t));
}

export function canSeeDoc(v: Viewer, d: DocLite): boolean {
  if (d.status !== 'dang') return canEditDoc(v, d) || (d.status === 'cho_duyet' && v.ceo);
  if (d.nhom === 'team') return canSeeTeam(v, d.teams);
  return true;
}

/** Có soạn được ít nhất một loại tài liệu không (để hiện mục "Soạn tài liệu"). */
export const isEditor = (v: Viewer) => v.ceo || v.hr || (v.manager && !!v.pb) || v.scopes.length > 0;

/** Ai được theo dõi người nào: CEO, nhân sự thấy hết; quản lý thấy người cùng phòng. */
export function canTrack(v: Viewer, target: Member | undefined): boolean {
  if (v.ceo || v.hr) return true;
  return !!target && v.manager && !!v.pb && target.pb === v.pb;
}

/** Tài liệu Chung do người không phải CEO đăng thì phải chờ CEO duyệt. */
export const publishStatus = (v: Viewer, nhom: string) => (nhom === 'chung' && !v.ceo ? 'cho_duyet' : 'dang');

/** Tài liệu này có bắt buộc với người này không (nhân viên mới = đang trong onboarding). */
export function requiredFor(d: { bat_buoc: string }, isNewbie: boolean): boolean {
  return d.bat_buoc === 'tat_ca' || (d.bat_buoc === 'moi' && isNewbie);
}

export type Quiz = { q: string; o: string[]; a: number }[];

/** Chấm câu kiểm tra: trả số câu đúng; đạt khi đúng từ 80% trở lên (5 câu thì 4). */
export function gradeQuiz(quiz: Quiz, answers: unknown): { right: number; total: number; pass: boolean } {
  const arr = Array.isArray(answers) ? answers : [];
  const right = quiz.reduce((n, q, i) => n + (Number(arr[i]) === q.a ? 1 : 0), 0);
  return { right, total: quiz.length, pass: !quiz.length || right / quiz.length >= 0.8 };
}

export const parseJsonArr = <T = string>(s: unknown): T[] => {
  try {
    const v = JSON.parse(String(s ?? '[]'));
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};

/** Mã file từ link Google Docs / Drive (…/d/<mã>/…, ?id=<mã>) hoặc mã dán thẳng. */
export function driveIdFrom(input: string): string | null {
  const s = String(input ?? '').trim();
  if (!s) return null;
  const m = s.match(/\/d\/([A-Za-z0-9_-]{10,})/) ?? s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  const id = m ? m[1] : s;
  return /^[A-Za-z0-9_-]{10,100}$/.test(id) ? id : null;
}

/**
 * Markdown Google Docs xuất ra → kiểu chữ của tài liệu đào tạo (hub/src/daotao.js dtMd):
 * bỏ ảnh nhúng (dữ liệu ảnh rất nặng; xem ảnh thì mở file Drive), bỏ dấu \ thoát ký tự, tiêu đề cấp 3+ thành "## ",
 * "* " thành "- ", chữ nghiêng bỏ dấu. Bảng giữ nguyên dòng "| … |" (trang tự vẽ bảng).
 */
export function fromDriveMarkdown(md: string): string {
  const lines = String(md ?? '').replace(/\r/g, '').split('\n');
  const out: string[] = [];
  for (let raw of lines) {
    if (/^\s*\[[^\]]+\]:\s*<?data:/i.test(raw)) continue;
    raw = raw.replace(/!\[[^\]]*\]\[[^\]]*\]/g, '').replace(/!\[[^\]]*\]\((data:[^)]*|[^)]*)\)/g, '');
    let t = raw.replace(/\\([\\`*_{}[\]()#+\-.!|>~=])/g, '$1').replace(/\s+$/, '');
    t = t.replace(/^#{3,6}\s+/, '## ');
    t = t.replace(/^\s*[*+]\s+/, '- ').replace(/^\s+-\s+/, '- ').replace(/^\s+(\d+[.)]\s+)/, '$1');
    t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2').replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, '$1$2');
    out.push(t);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 200_000);
}

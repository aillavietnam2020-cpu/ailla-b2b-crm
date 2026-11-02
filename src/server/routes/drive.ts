import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { unpack } from '../lib/pack';
import {
  fileKind,
  folderIdFrom,
  locate,
  normalizeConfig,
  rootsFor,
  teamsFor,
  type DriveConfig,
  type DriveUser,
} from '../lib/driveAccess';
import { children, download, meta, recentFiles, saKey, thumbnail, type DriveFile } from '../services/gdrive';
import { syncDrivePermissions } from '../services/driveSync';

/**
 * Thư mục làm việc: xem thư mục Google Drive của phòng ban ngay trên web (chỉ xem; mở file thì sang Drive).
 * Phân quyền ở lib/driveAccess.ts. Cấu hình (mỗi phòng ban một thư mục gốc, ai được xem thêm) chỉ CEO sửa,
 * cất ở hub_blobs 'drive_teams'.
 */
export const driveRoutes = new Hono<AppEnv>();

const CFG_KEY = 'drive_teams';
const isCeo = (a: AuthContext, u: HubUser | null) => a.user.role === 'CEO' || u?.role === 'admin';

type HubUser = DriveUser & { id?: string; crm?: string; name?: string };
type Dept = { k: string; n: string };

/* Danh sách người + phòng ban của khu chung, giữ 60 giây trong máy chủ (bản chung nặng, không giải nén mỗi lượt bấm). */
let HUB: { at: number; users: HubUser[]; depts: Dept[] } | null = null;
async function hubPeople(db: D1Database) {
  if (HUB && Date.now() - HUB.at < 60_000) return HUB;
  const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  let users: HubUser[] = [];
  let depts: Dept[] = [];
  if (row) {
    const d = JSON.parse(await unpack(row.data)) as { users?: HubUser[]; departments?: Dept[] };
    users = Array.isArray(d.users) ? d.users : [];
    depts = Array.isArray(d.departments) ? d.departments.map((p) => ({ k: String(p.k), n: String(p.n) })) : [];
  }
  HUB = { at: Date.now(), users, depts };
  return HUB;
}

async function loadConfig(db: D1Database): Promise<DriveConfig> {
  const row = await db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(CFG_KEY).first<{ data: string }>();
  if (!row) return { teams: [] };
  try {
    return normalizeConfig(JSON.parse(row.data));
  } catch {
    return { teams: [] };
  }
}

async function who(c: { env: AppEnv['Bindings']; get: (k: 'auth') => AuthContext }) {
  const auth = c.get('auth');
  const hub = await hubPeople(c.env.DB);
  const me = hub.users.find((u) => u.crm && u.crm === auth.user.id) ?? null;
  return { auth, me, ceo: isCeo(auth, me), depts: hub.depts };
}

function needKey(env: AppEnv['Bindings']) {
  const k = saKey(env.GDRIVE_SA_JSON);
  if (!k) throw badRequest('DRIVE_NOT_CONNECTED', 'Web chưa được nối với Google Drive. Chị Hoa cần chạy file NOI-GOOGLE-DRIVE.bat một lần.');
  return k;
}

const shape = (f: DriveFile, extra?: Record<string, unknown>) => {
  const target = f.shortcutDetails?.targetMimeType;
  return {
    id: f.id,
    name: f.name,
    kind: fileKind(target && f.mimeType === 'application/vnd.google-apps.shortcut' ? target : f.mimeType, f.name),
    shortcut: f.mimeType === 'application/vnd.google-apps.shortcut',
    modified: f.modifiedTime ?? null,
    by: f.lastModifyingUser?.displayName ?? '',
    size: f.size ? Number(f.size) : null,
    link: f.webViewLink ?? `https://drive.google.com/open?id=${f.shortcutDetails?.targetId ?? f.id}`,
    thumb: f.hasThumbnail ? `/api/drive/thumb/${encodeURIComponent(f.id)}` : null,
    // Tải bản gốc qua web (chỉ file thường: ảnh, video, PDF, Excel…; Google Docs / Sheets mở trên Drive).
    dl: f.mimeType.startsWith('application/vnd.google-apps') ? null : `/api/drive/download/${encodeURIComponent(f.id)}`,
    ...extra,
  };
};

/** Các thư mục phòng ban người này được xem. */
driveRoutes.get('/teams', async (c) => {
  const { me, ceo, depts } = await who(c);
  const cfg = await loadConfig(c.env.DB);
  const name = (pb: string) => depts.find((d) => d.k === pb)?.n ?? pb;
  return ok(c, {
    connected: !!saKey(c.env.GDRIVE_SA_JSON),
    can_manage: ceo,
    my_pb: me?.phongBan ?? '',
    teams: teamsFor(cfg, me, ceo).map((t) => ({ pb: t.pb, name: t.name || name(t.pb), folder_id: t.folderId })),
  });
});

/** Nội dung một thư mục (mặc định thư mục gốc của phòng ban). Chỉ mở được thư mục nằm dưới thư mục gốc của phòng mình được xem. */
driveRoutes.get('/list', async (c) => {
  const key = needKey(c.env);
  const { me, ceo } = await who(c);
  const pb = c.req.query('pb') ?? '';
  const cfg = await loadConfig(c.env.DB);
  const team = teamsFor(cfg, me, ceo).find((t) => t.pb === pb);
  if (!team) throw forbidden('Bạn chưa được xem thư mục của phòng này.');
  const folder = folderIdFrom(c.req.query('folder') ?? '') ?? team.folderId;
  const roots = rootsFor(cfg, me, ceo);
  const where = await locate(folder, roots, (id) => meta(key, id));
  if (!where) {
    if (folder === team.folderId) throw notFound('Web chưa thấy thư mục gốc của phòng này. Kiểm tra thư mục đã chia sẻ cho tài khoản của web chưa.');
    throw forbidden('Thư mục này không nằm trong thư mục của phòng.');
  }
  // Thư mục của phòng khác nằm trong thư mục chung: gốc gần nhất là thư mục bị chặn thì không cho mở.
  if (!where.pb) throw forbidden('Bạn chưa được xem thư mục này.');
  const items = await children(key, folder);
  return ok(c, {
    pb: where.pb,
    path: where.path,
    folders: items
      .filter((f) => f.mimeType === 'application/vnd.google-apps.folder' && roots.get(f.id) !== '')
      .map((f) => ({ id: f.id, name: f.name, modified: f.modifiedTime ?? null })),
    files: items.filter((f) => f.mimeType !== 'application/vnd.google-apps.folder').map((f) => shape(f)),
  });
});

/**
 * Tìm theo tên (q) hoặc xem file mới sửa gần đây, trong mọi thư mục người này được xem (pb để lọc một phòng).
 * Drive không tìm được "trong cây thư mục", nên lấy file tài khoản máy thấy (mới sửa trước) rồi lọc theo đường lên gốc.
 */
driveRoutes.get('/find', async (c) => {
  const key = needKey(c.env);
  const { me, ceo } = await who(c);
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  const pb = c.req.query('pb') ?? '';
  const cfg = await loadConfig(c.env.DB);
  if (!teamsFor(cfg, me, ceo).length) return ok(c, { files: [] });
  const roots = rootsFor(cfg, me, ceo);
  const limit = q ? 40 : 15;
  const out: ReturnType<typeof shape>[] = [];
  for (const f of await recentFiles(key, q, q ? 300 : 200)) {
    const where = await locate(f.id, roots, (id) => meta(key, id));
    if (!where || !where.pb || (pb && where.pb !== pb)) continue;
    out.push(shape(f, { pb: where.pb, where: where.path.slice(0, -1).map((p) => p.name).join(' › '), folder_id: where.path.at(-2)?.id ?? null }));
    if (out.length >= limit) break;
  }
  return ok(c, { files: out });
});

/* ---------- Cấu hình (CEO): mỗi phòng ban một thư mục gốc + ai được xem thêm ---------- */
driveRoutes.get('/config', async (c) => {
  const { ceo, depts } = await who(c);
  if (!ceo) throw forbidden('Chỉ CEO gán thư mục Drive cho phòng ban.');
  const k = saKey(c.env.GDRIVE_SA_JSON);
  const cfg = await loadConfig(c.env.DB);
  const teams = await Promise.all(
    cfg.teams.map(async (t) => {
      const m = k ? await meta(k, t.folderId).catch(() => null) : null;
      return { ...t, folder_name: m?.name ?? null, ok: !!m };
    }),
  );
  return ok(c, { connected: !!k, sa_email: k?.client_email ?? null, depts, teams });
});

driveRoutes.put('/config', async (c) => {
  const { auth, ceo } = await who(c);
  if (!ceo) throw forbidden('Chỉ CEO gán thư mục Drive cho phòng ban.');
  const body = (await c.req.json().catch(() => null)) as { teams?: { pb?: string; folder?: string; viewers?: string[]; name?: string }[] } | null;
  if (!body || !Array.isArray(body.teams)) throw badRequest('INVALID', 'Dữ liệu gửi lên không đúng.');
  for (const t of body.teams) {
    if (t?.folder && !folderIdFrom(t.folder)) throw badRequest('INVALID_FOLDER', `Link thư mục của phòng ${t.pb ?? ''} không đúng dạng link Google Drive.`);
  }
  const cfg = normalizeConfig({ teams: body.teams.map((t) => ({ pb: t?.pb, folderId: t?.folder, viewers: t?.viewers, name: t?.name })) });
  await c.env.DB.prepare(
    `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)
     ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  )
    .bind(CFG_KEY, JSON.stringify(cfg), nowIso(), auth.user.id)
    .run();
  return ok(c, cfg);
});

/** Cấp / gỡ quyền Drive theo danh sách nhân viên (CEO). ?dry=1: chỉ xem trước sẽ đổi gì. */
driveRoutes.post('/sync', async (c) => {
  const { auth, ceo } = await who(c);
  if (!ceo) throw forbidden('Chỉ CEO đồng bộ quyền Drive.');
  return ok(c, await syncDrivePermissions(c.env.DB, c.env.GDRIVE_SA_JSON, auth.user.id, c.req.query('dry') === '1'));
});

/** Ảnh thu nhỏ: chỉ trả khi file nằm trong thư mục người này được xem (cùng quy tắc với /list). */
driveRoutes.get('/thumb/:id', async (c) => {
  const key = needKey(c.env);
  const { me, ceo } = await who(c);
  const id = folderIdFrom(c.req.param('id'));
  if (!id) throw notFound();
  const where = await locate(id, rootsFor(await loadConfig(c.env.DB), me, ceo), (x) => meta(key, x));
  if (!where?.pb) throw forbidden('Bạn chưa được xem file này.');
  const img = await thumbnail(key, id, Number(c.req.query('s')) === 800 ? 800 : 400);
  if (!img) throw notFound();
  return new Response(img.body, {
    headers: { 'Content-Type': img.headers.get('Content-Type') ?? 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
  });
});

/** Tải file gốc về máy: cùng quy tắc quyền với /list; chuyển thẳng dữ liệu từ Drive, không lưu lại trên web. */
driveRoutes.get('/download/:id', async (c) => {
  const key = needKey(c.env);
  const { me, ceo } = await who(c);
  const id = folderIdFrom(c.req.param('id'));
  if (!id) throw notFound();
  const where = await locate(id, rootsFor(await loadConfig(c.env.DB), me, ceo), (x) => meta(key, x));
  if (!where?.pb) throw forbidden('Bạn chưa được xem file này.');
  const f = await download(key, id);
  if (!f) throw notFound('File này không tải về được (file Google Tài liệu / Trang tính thì mở trên Drive).');
  const headers: Record<string, string> = {
    'Content-Type': f.mime,
    'Content-Disposition': `attachment; filename="${f.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    'Cache-Control': 'private, no-store',
  };
  if (f.size) headers['Content-Length'] = f.size;
  return new Response(f.body, { headers });
});

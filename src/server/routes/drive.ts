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
  teamsFor as teamsForAll,
  tmScope,
  type DriveConfig,
  type DriveUser,
} from '../lib/driveAccess';
import { children, createFolder, download, fileInfo, meta, moveItem, recentFiles, saKey, streamVideo, thumbnail, type DriveFile } from '../services/gdrive';
import { setSyncPaused, syncDrivePermissions, syncPaused } from '../services/driveSync';
import { addSubToIdx, moveInIdx, searchIdx, todoFor, weekStats, type IdxFile, type TodoItem } from '../lib/driveIndex';
import { isStale, loadIdx, refreshIdx, saveIdx } from '../services/driveIndex';

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
let HUB: { at: number; users: HubUser[]; depts: Dept[]; vids: Set<string> } | null = null;
async function hubPeople(db: D1Database, fresh = false) {
  if (HUB && !fresh && Date.now() - HUB.at < 60_000) return HUB;
  const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  let users: HubUser[] = [];
  let depts: Dept[] = [];
  const vids = new Set<string>();
  if (row) {
    const d = JSON.parse(await unpack(row.data)) as { users?: HubUser[]; departments?: Dept[]; cards?: { linkVideo?: string; linkFinal?: string; linkCu?: string; gopy?: { link?: string }[] }[]; kho?: { link?: string }[]; tasks?: { kq?: string }[] };
    const add = (l: unknown) => {
      const m = String(l ?? '').match(/\/d\/([A-Za-z0-9_-]{10,})/) ?? String(l ?? '').match(/[?&]id=([A-Za-z0-9_-]{10,})/);
      if (m) vids.add(m[1]);
    };
    // Video tồn trong Kho, link nộp ở việc sửa video, và bản cũ bị góp ý cũng xem được ngay trên web
    for (const k of Array.isArray(d.kho) ? d.kho : []) add(k?.link);
    for (const t of Array.isArray(d.tasks) ? d.tasks : []) add(t?.kq);
    for (const cd of Array.isArray(d.cards) ? d.cards : []) {
      add(cd?.linkCu);
      for (const g of Array.isArray(cd?.gopy) ? cd.gopy : []) add(g?.link);
    }
    for (const cd of Array.isArray(d.cards) ? d.cards : [])
      for (const l of [cd?.linkVideo, cd?.linkFinal]) {
        const m = String(l ?? '').match(/\/d\/([A-Za-z0-9_-]{10,})/) ?? String(l ?? '').match(/[?&]id=([A-Za-z0-9_-]{10,})/);
        if (m) vids.add(m[1]);
      }
    users = Array.isArray(d.users) ? d.users : [];
    depts = Array.isArray(d.departments) ? d.departments.map((p) => ({ k: String(p.k), n: String(p.n) })) : [];
  }
  HUB = { at: Date.now(), users, depts, vids };
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

async function who(c: { env: AppEnv['Bindings']; get: (k: 'auth') => AuthContext; req?: { query: (k: string) => string | undefined; method?: string } }) {
  const auth = c.get('auth');
  const hub = await hubPeople(c.env.DB);
  const me = hub.users.find((u) => u.crm && u.crm === auth.user.id) ?? null;
  const ceo = isCeo(auth, me);
  // CEO kiểm thử "xem như" một nhân sự (?as=<mã người dùng khu chung>): chỉ dùng cho danh sách thư mục, không sửa được gì.
  const as = ceo && c.req?.method === 'GET' ? c.req.query('as') : undefined;
  if (as) {
    const u = hub.users.find((x) => x.id === as);
    if (!u) throw notFound('Không thấy người này.');
    return { auth, me: u, ceo: isCeo({ user: { ...auth.user, role: 'EMPLOYEE' } } as AuthContext, u), depts: hub.depts, viewAs: true };
  }
  return { auth, me, ceo, depts: hub.depts, viewAs: false };
}

/* Thư mục người này thấy trong danh sách; đang tạm ẩn (tmAllowed) thì không thấy thư mục nào. */
const teamsFor = (cfg: DriveConfig, me: HubUser | null, ceo: boolean) => {
  const sc = tmScope(me, ceo);
  const all = teamsForAll(cfg, me, ceo);
  return sc === 'all' ? all : all.filter((t) => sc.includes(t.pb) || t.viewers.some((v) => sc.includes(v)));
};

function needKey(env: AppEnv['Bindings']) {
  const k = saKey(env.GDRIVE_SA_JSON);
  if (!k) throw badRequest('DRIVE_NOT_CONNECTED', 'Web chưa được nối với Google Drive. CEO cần chạy file NOI-GOOGLE-DRIVE.bat một lần.');
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
  const vis = teamsFor(cfg, me, ceo).filter((t) => (!pb || t.pb === pb) && (!q || !t.direct));
  if (!vis.length) return ok(c, { files: [] });
  // Tìm không dấu trong mục lục (16/11). Thư mục chưa có mục lục: quét ngầm, báo số thư mục còn đang đếm.
  if (q) {
    const idxs = await Promise.all(vis.map((t) => loadIdx(c.env.DB, t.pb)));
    const have = idxs.filter((x, i): x is NonNullable<typeof x> => !!x && x.root === vis[i].folderId);
    const miss = vis.filter((t, i) => !idxs[i] || idxs[i]!.root !== t.folderId);
    for (const t of [...miss].sort(() => Math.random() - 0.5).slice(0, 2)) later(c, refreshIdx(c.env.DB, c.env.GDRIVE_SA_JSON, cfg, t.pb));
    const all = have.flatMap((x) => x.files.map((f) => ({ f, pb: x.pb })));
    const hit = new Set(searchIdx(all.map((a) => a.f), q, 60));
    return ok(c, { files: all.filter((a) => hit.has(a.f)).sort((a, b) => (b.f.m ?? '').localeCompare(a.f.m ?? '')).map((a) => fileOut(a.f, a.pb)), counting: miss.length });
  }
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
  return ok(c, { connected: !!k, sa_email: k?.client_email ?? null, depts, teams, sync_paused: await syncPaused(c.env.DB) });
});

driveRoutes.put('/config', async (c) => {
  const { auth, ceo } = await who(c);
  if (!ceo) throw forbidden('Chỉ CEO gán thư mục Drive cho phòng ban.');
  const body = (await c.req.json().catch(() => null)) as { teams?: { pb?: string; folder?: string; viewers?: string[]; name?: string; direct?: boolean }[] } | null;
  if (!body || !Array.isArray(body.teams)) throw badRequest('INVALID', 'Dữ liệu gửi lên không đúng.');
  for (const t of body.teams) {
    if (t?.folder && !folderIdFrom(t.folder)) throw badRequest('INVALID_FOLDER', `Link thư mục của phòng ${t.pb ?? ''} không đúng dạng link Google Drive.`);
  }
  const cfg = normalizeConfig({ teams: body.teams.map((t) => ({ pb: t?.pb, folderId: t?.folder, viewers: t?.viewers, name: t?.name, direct: t?.direct === true })) });
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

/**
 * Xem video ngay trên web (nút "Xem" ở Duyệt video): người có tài khoản web được xem video đã gắn vào một dòng video
 * của Marketing (link video / link thành phẩm). File không gắn vào dòng nào thì không mở qua đường này.
 */
driveRoutes.get('/video/:id', async (c) => {
  const key = needKey(c.env);
  const { me } = await who(c);
  if (!me || me.active === false) throw forbidden('Bạn chưa có tài khoản khu chung.');
  const id = folderIdFrom(c.req.param('id'));
  if (!id) throw notFound();
  if (!(await hubPeople(c.env.DB)).vids.has(id) && !(await hubPeople(c.env.DB, true)).vids.has(id)) throw forbidden('Video này chưa gắn vào dòng video nào.');
  const r = await streamVideo(key, id, c.req.header('Range') ?? null);
  if (!r) throw notFound('Web chưa đọc được video này (tài khoản Drive của web chưa được chia sẻ thư mục chứa video).');
  return r;
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

/* ---------- Mục lục (chị Hoa duyệt demo 16/11): số file, nằm ở đâu, tìm không dấu, việc cần xử lý, báo cáo ---------- */
function later(c: { executionCtx: { waitUntil(p: Promise<unknown>): void } }, job: Promise<unknown>) {
  const safe = job.catch((e) => console.error('[drive idx]', e));
  try {
    c.executionCtx.waitUntil(safe);
  } catch {
    /* chạy thử không có executionCtx */
  }
}
const isShared = (pb: string) => /^chung/.test(pb);
const fileOut = (f: IdxFile, pb: string) => ({
  id: f.i, name: f.n, kind: f.k, sub: f.s, where: f.w, modified: f.m, created: f.c, by: f.b, size: f.z, link: f.l, pb,
  thumb: f.t ? `/api/drive/thumb/${encodeURIComponent(f.i)}` : null,
  dl: f.d ? `/api/drive/download/${encodeURIComponent(f.i)}` : null,
});

/** Tổng quan các thư mục người này được xem: số file từng thư mục con, việc cần xử lý, số 7 ngày; CEO có thêm bảng báo cáo. */
driveRoutes.get('/overview', async (c) => {
  const { me, ceo, depts } = await who(c);
  const cfg = await loadConfig(c.env.DB);
  const teams = teamsFor(cfg, me, ceo);
  const name = (t: (typeof teams)[number]) => t.name || depts.find((d) => d.k === t.pb)?.n || t.pb;
  const now = Date.now();
  const rows = await Promise.all(teams.map(async (t) => ({ t, idx: t.direct ? null : await loadIdx(c.env.DB, t.pb) })));
  // Thư mục chưa có mục lục: quét ngầm tối đa 2 thư mục mỗi lượt mở; còn lại quét dần thư mục cũ nhất.
  // Chọn ngẫu nhiên để một thư mục quét lỗi không chặn mãi các thư mục sau.
  const missing = rows.filter((r) => !r.t.direct && isStale(r.idx, r.t.folderId, Infinity)).sort(() => Math.random() - 0.5).slice(0, 2);
  const stale = rows.filter((r) => !r.t.direct && isStale(r.idx, r.t.folderId)).sort((a, b) => (a.idx?.at ?? '').localeCompare(b.idx?.at ?? ''));
  for (const r of missing.length ? missing : stale.slice(0, 1)) later(c, refreshIdx(c.env.DB, c.env.GDRIVE_SA_JSON, cfg, r.t.pb));
  const todo: TodoItem[] = [];
  const out = rows.map(({ t, idx }) => {
    const ok = idx && idx.root === t.folderId;
    const td = ok ? todoFor(idx, name(t), isShared(t.pb), now) : [];
    todo.push(...td);
    const wk = ok ? weekStats(idx.files, now) : { added: 0, edited: 0 };
    return {
      pb: t.pb, name: name(t), shared: isShared(t.pb), edit: ceo || me?.phongBan === t.pb, direct: !!t.direct, folder_id: t.folderId,
      total: ok ? idx.files.length : null, subs: ok ? idx.subs : [], at: ok ? idx.at : null, cut: ok ? idx.cut : false,
      added: wk.added, edited: wk.edited, todo: td.length,
    };
  });
  return ok(c, { teams: out, todo: todo.slice(0, 500), can_manage: ceo });
});

/** File của một thư mục (từ mục lục), lọc theo thư mục con cấp 1; mục lục cũ hơn 15 phút thì quét lại ngầm. */
driveRoutes.get('/files', async (c) => {
  const { me, ceo } = await who(c);
  const pb = c.req.query('pb') ?? '';
  const cfg = await loadConfig(c.env.DB);
  const team = teamsFor(cfg, me, ceo).find((t) => t.pb === pb);
  if (!team) throw forbidden('Bạn chưa được xem thư mục này.');
  // Đọc thẳng D1: vừa chuyển / xóa / tạo xong thì danh sách phải mới ngay.
  let idx = await loadIdx(c.env.DB, pb, true);
  if (isStale(idx, team.folderId, Infinity) || c.req.query('fresh') === '1') idx = (await refreshIdx(c.env.DB, c.env.GDRIVE_SA_JSON, cfg, pb)) ?? idx;
  else if (isStale(idx, team.folderId)) later(c, refreshIdx(c.env.DB, c.env.GDRIVE_SA_JSON, cfg, pb));
  if (!idx) throw notFound('Web đang đếm file thư mục này lần đầu, bấm Tải lại sau 1 phút. Vẫn không được thì kiểm tra thư mục đã chia sẻ cho tài khoản của web chưa.');
  const sub = c.req.query('sub') ?? '';
  const files = idx.files.filter((f) => !sub || f.s === sub).sort((a, b) => (b.m ?? '').localeCompare(a.m ?? ''));
  return ok(c, { pb, at: idx.at, cut: idx.cut, subs: idx.subs, total: idx.files.length, edit: ceo || me?.phongBan === pb, files: files.slice(0, 500).map((f) => fileOut(f, pb)), more: Math.max(0, files.length - 500) });
});

/**
 * Chuyển một file hoặc một thư mục con cấp 1 sang thư mục gốc / thư mục con cấp 1 của thư mục khác — chuyển thật trên Drive.
 * CEO chuyển được mọi thư mục; nhân viên chỉ chuyển trong thư mục phòng mình (giống quyền "Được sửa").
 * Body: { pb, id, to_pb, to_sub } — to_sub '' là thư mục gốc.
 */
driveRoutes.post('/move', async (c) => {
  const { me, ceo } = await who(c);
  const b = (await c.req.json().catch(() => null)) as { pb?: string; id?: string; to_pb?: string; to_sub?: string } | null;
  const pb = b?.pb ?? '', id = b?.id ?? '', toPb = b?.to_pb ?? '', toSub = b?.to_sub ?? '';
  if (!pb || !id || !toPb) throw badRequest('INVALID', 'Dữ liệu gửi lên không đúng.');
  const cfg = await loadConfig(c.env.DB);
  const mine = teamsFor(cfg, me, ceo);
  const from = mine.find((t) => t.pb === pb), to = mine.find((t) => t.pb === toPb);
  const canEdit = (p: string) => ceo || me?.phongBan === p;
  if (!from || !to || from.direct || to.direct || !canEdit(pb) || !canEdit(toPb)) throw forbidden('Bạn chỉ được chuyển file trong thư mục phòng mình.');
  const src = await loadIdx(c.env.DB, pb, true);
  const dst = toPb === pb ? src : await loadIdx(c.env.DB, toPb, true);
  if (!src || !dst) throw badRequest('NOT_READY', 'Web đang đếm file thư mục này, thử lại sau 1 phút.');
  const target = toSub ? dst.subs.find((x) => x.n === toSub)?.id : to.folderId;
  if (!target) throw badRequest('INVALID', 'Không thấy thư mục đích, bấm Tải lại rồi thử lại.');
  if (target === id) throw badRequest('INVALID', 'Không chuyển thư mục vào chính nó được.');
  const key = needKey(c.env);
  const info = await fileInfo(key, id);
  if (!info) throw notFound('Không thấy file trên Drive (có thể đã bị xóa hoặc chuyển đi). Bấm Tải lại.');
  if (info.parents?.includes(target)) throw badRequest('SAME', 'File đã nằm ở thư mục này rồi.');
  const r = await moveItem(key, id, info.parents ?? [], target);
  if (!r.ok)
    throw badRequest(
      'DRIVE_MOVE',
      r.status === 403
        ? 'Drive không cho chuyển: tài khoản của web chưa có quyền sửa file này (thường là file do người khác tạo). Mở trên Drive để chuyển tay.'
        : 'Drive chưa chuyển được, thử lại sau.',
    );
  const m = moveInIdx(src, dst, id, toSub);
  if (m) {
    await saveIdx(c.env.DB, m.src);
    if (m.dst !== m.src) await saveIdx(c.env.DB, m.dst);
  }
  return ok(c, { moved: true });
});

/** Thư mục được sửa (CEO mọi thư mục, nhân viên thư mục phòng mình) + mục lục của nó. */
async function editable(c: Parameters<typeof who>[0], pb: string) {
  const { me, ceo } = await who(c);
  const cfg = await loadConfig(c.env.DB);
  const team = teamsFor(cfg, me, ceo).find((t) => t.pb === pb);
  if (!team || team.direct || !(ceo || me?.phongBan === pb)) throw forbidden('Bạn chỉ được sửa thư mục phòng mình.');
  const idx = await loadIdx(c.env.DB, pb, true);
  if (!idx || idx.root !== team.folderId) throw badRequest('NOT_READY', 'Web đang đếm file thư mục này, thử lại sau 1 phút.');
  return { team, idx };
}
const driveErr = (status: number, what: string) =>
  badRequest('DRIVE', status === 403 || status === 404 ? `Drive không cho ${what}: tài khoản của web chưa có quyền với file này (thường là file do người khác tạo). Mở trên Drive để làm tay.` : `Drive chưa ${what} được, thử lại sau.`);

/** Tạo thư mục con cấp 1 mới trong thư mục của phòng. Body: { pb, name } */
driveRoutes.post('/folder', async (c) => {
  const b = (await c.req.json().catch(() => null)) as { pb?: string; name?: string } | null;
  const name = (b?.name ?? '').trim().replace(/\s+/g, ' ');
  if (!b?.pb || !name) throw badRequest('INVALID', 'Gõ tên thư mục.');
  if (name.length > 120) throw badRequest('INVALID', 'Tên thư mục dài quá.');
  const { team, idx } = await editable(c, b.pb);
  if (idx.subs.some((s) => s.n.toLowerCase() === name.toLowerCase())) throw badRequest('INVALID', 'Đã có thư mục tên này rồi.');
  const r = await createFolder(needKey(c.env), name, team.folderId);
  if (!r.ok || !r.file) throw driveErr(r.status, 'tạo thư mục');
  await saveIdx(c.env.DB, addSubToIdx(idx, { id: r.file.id, n: r.file.name }));
  return ok(c, { id: r.file.id, name: r.file.name });
});

/** Tạm dừng / bật lại tự cấp quyền mỗi giờ (CEO). */
driveRoutes.put('/sync-pause', async (c) => {
  const { auth, ceo } = await who(c);
  if (!ceo) throw forbidden('Chỉ CEO đổi việc tự cấp quyền.');
  const body = (await c.req.json().catch(() => ({}))) as { paused?: boolean };
  await setSyncPaused(c.env.DB, !!body.paused, auth.user.id);
  return ok(c, { paused: !!body.paused });
});

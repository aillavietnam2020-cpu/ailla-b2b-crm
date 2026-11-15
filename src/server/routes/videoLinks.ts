import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso } from '@shared/datetime';
import { zodFieldErrors } from '@shared/schemas';
import type { AppEnv } from '../env';
import { auditStatement, clientIp } from '../lib/audit';
import { badRequest, conflict, forbidden, ok, unprocessable } from '../lib/http';
import { pack, unpack } from '../lib/pack';
import { children, fileInfo, saKey } from '../services/gdrive';
import { folderIdFrom } from '../lib/driveAccess';
import { requirePermission } from '../middleware/rbac';

/**
 * Nhập nhanh link video (chị Hoa duyệt demo 06/11/2026): cuối ngày nhân sự Content dán một lượt link Google Drive
 * của video làm xong; web đọc tên file để biết sản phẩm, xếp vào dòng video còn trống đầu tiên của sản phẩm đó ở ② Điều phối,
 * chuyển Chờ duyệt V1 và báo Lead Content một thông báo gộp. Cùng một đường cho nút "Nhập nhanh link video" trên web
 * (dry = true để xem trước, rồi gửi kèm "to" đã chọn) và cho agent Lead Content làm theo lệnh của chính người đó
 * (giấy ủy quyền, lib/delegation.ts). Chỉ điền link + gửi duyệt, không duyệt, không xóa, không đổi kênh / sản phẩm của dòng.
 */
export const videoLinkRoutes = new Hono<AppEnv>();
videoLinkRoutes.use('*', requirePermission('hub.access'));

const schema = z.object({
  kenh: z.string().trim().max(80).optional().default(''),
  dry: z.boolean().optional().default(false),
  items: z
    .array(
      z.object({
        url: z.string().trim().min(8).max(600),
        sp: z.string().trim().max(120).optional().default(''),
        to: z.string().trim().max(40).optional().default(''),
        kenh: z.string().trim().max(80).optional().default(''),
        nguon: z.string().trim().max(80).optional().default(''),
        nguoi: z.string().trim().max(40).optional().default(''),
      }),
    )
    .min(1, 'Chưa có link nào')
    .max(60, 'Tối đa 60 link mỗi lần'),
});

type Card = Record<string, unknown> & { id: string; sku?: string; kenh?: string; step?: string; linkVideo?: string; linkFinal?: string; linkDang?: string; nguoi?: string; nguoiEdit?: string; fpId?: string; mix?: string; history?: unknown[] };
type User = { id?: string; crm?: string; name?: string; role?: string; active?: boolean; phongBan?: string };
type Hub = { cards?: Card[]; users?: User[]; products?: { k: string; n: string }[]; kho?: ({ link?: string; ma?: string } & Record<string, unknown>)[]; notifs?: unknown[]; activity?: unknown[] } & Record<string, unknown>;

/** Bước chưa nộp video: dán link là gửi duyệt (giống ô link ở Điều phối, hub/src/bangvideo.js bvGuiDuyet). */
const OPEN = ['cg', 'kb', 'dkb', 'quay', 'edit'];
const ROLES = ['lead', 'content', 'nhanvien', 'truongphong', 'admin'];
const fold = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const driveId = (u: string) => (u.match(/\/d\/([\w-]{10,})/) || u.match(/[?&]id=([\w-]{10,})/) || [])[1] || '';

/** Đoán sản phẩm từ tên file / chữ agent ghi: khớp đủ tên trước, rồi 2 chữ đầu (bỏ qua nếu 2 sản phẩm cùng 2 chữ đầu). */
export function guessSku(text: string, prods: { k: string; n: string }[]): string {
  const f = ' ' + fold(text) + ' ';
  if (!f.trim()) return '';
  const hit = (k: string) => k && f.includes(' ' + k + ' ');
  const full = prods.filter((p) => hit(fold(p.n))).sort((a, b) => fold(b.n).length - fold(a.n).length);
  if (full.length) return full[0].k;
  const code = prods.filter((p) => hit(fold(p.k)) && p.k.length >= 2);
  if (code.length === 1) return code[0].k;
  const two = (p: { n: string }) => fold(p.n).split(' ').slice(0, 2).join(' ');
  const pre = prods.filter((p) => hit(two(p)));
  if (pre.length === 1) return pre[0].k;
  const one = prods.filter((p) => {
    const w = fold(p.n).split(' ');
    return w.length === 1 && hit(w[0]);
  });
  return one.length === 1 ? one[0].k : '';
}

videoLinkRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw unprocessable('VALIDATION', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  const b = parsed.data;
  const key = saKey(c.env.GDRIVE_SA_JSON);
  const names = new Map<string, string>();
  for (const it of b.items) {
    const id = driveId(it.url);
    if (!id || names.has(id) || !key) continue;
    try {
      const f = await fileInfo(key, id);
      names.set(id, f?.name ?? '');
    } catch {
      names.set(id, '');
    }
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await c.env.DB.prepare("SELECT version, data FROM hub_state WHERE id = 'main'").first<{ version: number; data: string }>();
    if (!row) throw badRequest('NO_STATE', 'Chưa có dữ liệu Marketing');
    const d = JSON.parse(await unpack(row.data)) as Hub;
    const me = (d.users ?? []).find((u) => u.crm && u.crm === auth.user.id && u.active !== false);
    if (!me?.id || !(auth.user.role === 'CEO' || ROLES.includes(me.role ?? ''))) throw forbidden('Chỉ team Content nhập link video được');
    const prods = (d.products ?? []).filter((p) => p && p.k);
    const cards = d.cards ?? [];
    const used = new Set<string>();
    const seen = new Set<string>();
    const has = (s: unknown, id: string) => !!id && String(s ?? '').includes(id);
    /** người làm thật của video (có thể khác người được giao dòng, vd. phụ dựng); không hợp lệ thì là người nộp */
    const maker = (id: string) => ((d.users ?? []).some((u) => u.id === id && u.active !== false) ? id : (me.id as string));
    const by0 = me.name || auth.user.display_name;
    const uName = (id: string) => (d.users ?? []).find((u) => u.id === id)?.name ?? by0;
    const plan = b.items.map((it) => {
      const id = driveId(it.url);
      const name = names.get(id) ?? '';
      const dup = !id
        ? false
        : seen.has(id) || cards.some((x) => has(x.linkVideo, id) || has(x.linkFinal, id)) || (d.kho ?? []).some((k) => has(k.link, id));
      if (id) seen.add(id);
      const sku = dup ? '' : (it.sp && (prods.find((p) => p.k === it.sp)?.k || guessSku(it.sp, prods))) || guessSku(name, prods);
      /* Kênh chọn riêng từng link (chị Hoa 07/11): chọn kênh thì điền vào dòng trống của kênh đó; KHÔNG chọn thì
         không tự xếp kênh nữa, video vào Kho video › Chưa phân bổ (chờ Lead duyệt V1, phân bổ kênh sau). */
      const kn = it.kenh || b.kenh; // kenh chung chỉ khi người gọi chọn sẵn (agent); trang web gửi kenh chung rỗng
      const free0 = (x: Card) =>
        x.sku === sku && OPEN.includes(x.step ?? '') && !x.linkVideo && !x.linkFinal && !x.fpId && x.mix !== 'ton';
      const free = (x: Card) => free0(x) && (!kn || x.kenh === kn);
      const kenhs = sku ? [...new Set(cards.filter(free0).map((x) => String(x.kenh ?? '')).filter(Boolean))] : [];
      // dòng giao cho chính người nộp trước, rồi theo mã
      const opts = sku
        ? cards
            .filter(free)
            .sort((x, y) => Number(![x.nguoi, x.nguoiEdit].includes(me.id)) - Number(![y.nguoi, y.nguoiEdit].includes(me.id)) || String(x.id).localeCompare(String(y.id)))
        : [];
      let to = '';
      if (!kn) {
        const st = !id ? 'bad' : dup ? 'dup' : !sku ? 'nosku' : 'kho';
        return { url: it.url, name, sku, sp: sku ? prods.find((p) => p.k === sku)?.n ?? sku : '', to: '', kenh: '', kenhSel: '', nguon: it.nguon, nguoi: maker(it.nguoi), kenhs, st, opts: [] as string[] };
      }
      if (it.to) {
        if (opts.some((x) => x.id === it.to) && !used.has(it.to)) to = it.to;
      } else to = opts.find((x) => !used.has(x.id))?.id ?? '';
      if (to) used.add(to);
      const st = !id ? 'bad' : dup ? 'dup' : !sku ? 'nosku' : !to ? 'full' : 'ok';
      return { url: it.url, name, sku, sp: sku ? prods.find((p) => p.k === sku)?.n ?? sku : '', to, kenh: to ? cards.find((x) => x.id === to)?.kenh ?? '' : '', kenhSel: it.kenh, nguon: it.nguon, nguoi: maker(it.nguoi), kenhs, st, opts: opts.map((x) => x.id) };
    });
    const go = plan.filter((p) => p.st === 'ok' || p.st === 'kho');
    if (b.dry || !go.length) return ok(c, { plan, saved: 0, drive: !!key });

    const at = nowIso();
    const vn = new Date(Date.now() + 7 * 3_600_000).toISOString();
    const hm = vn.slice(11, 16);
    const by = me.name || auth.user.display_name;
    const viaAgent = auth.delegation ? ` (qua ${auth.delegation.agentName})` : '';
    const count: Record<string, number> = {};
    let nAg = 0;
    d.kho = d.kho ?? [];
    const ymd = vn.slice(0, 10);
    for (const p of go) {
      if (p.st === 'kho') {
        let ma = '';
        do ma = 'KHO-NL-' + p.sku + '-' + String(Math.floor(Math.random() * 1e5)).padStart(5, '0');
        while (d.kho.some((k) => k.ma === ma));
        const ag = /agency/i.test(p.nguon ?? '') ? p.nguon || 'Agency' : '';
        d.kho.push({ ma, skuText: p.sp, sku: p.sku, nguoi: ag ? ag : uName(p.nguoi), nguoiId: ag ? undefined : p.nguoi, nopBoi: by, tuyen: '', duyet: ag ? 'Đã Duyệt' : 'Chưa duyệt', choDuyet: !ag, agency: ag || undefined, link: p.url, ten: (p.name || 'Video ' + p.sp).replace(/\.(mp4|mov|m4v)$/i, ''), kenhDeXuat: '', lyDo: 'Nhập nhanh link (chưa chọn kênh)' + viaAgent, ghiChu: '', quyen: 'Chưa kiểm', canSua: 'Đăng nguyên', trangThai: 'Chưa dùng', maDang: '', nguonFile: ag ? 'Agency' : 'Nhập nhanh link', caption: '', ngaySX: ymd });
        if (ag) nAg++;
        count[p.sp] = (count[p.sp] ?? 0) + 1;
        continue;
      }
      const x = cards.find((y) => y.id === p.to);
      if (!x) continue;
      x.linkVideo = p.url;
      const giao0 = x.nguoiEdit || x.nguoi;
      x.nguoiEdit = p.nguoi;
      if (!/agency/i.test(p.nguon ?? '')) x.nguoiLam = p.nguoi;
      /* Video agency giao là đã duyệt (chị Hoa 07/11): vào thẳng Chờ đăng, không gửi Lead/CEO duyệt. */
      const agC = /agency/i.test(p.nguon ?? '') ? p.nguon || 'Agency' : '';
      if (agC) { x.agency = agC; x.linkFinal = p.url; x.duyet = 'Đã duyệt'; x.ceo = 'PASS'; x.step = 'dang'; nAg++; } else x.step = 'dvd';
      x.history = [...(x.history ?? []), { at: vn.slice(11, 16) + ' ' + vn.slice(8, 10) + '/' + vn.slice(5, 7) + '/' + vn.slice(0, 4), by, txt: (/agency/i.test(p.nguon ?? '') ? 'Nhập nhanh link video agency (đã duyệt)' : 'Nhập nhanh link video, gửi Lead duyệt') + ' · người làm: ' + uName(p.nguoi) + (giao0 && giao0 !== p.nguoi ? ' (dòng giao cho ' + uName(String(giao0)) + ')' : '') + viaAgent }];
      count[p.sp] = (count[p.sp] ?? 0) + 1;
    }
    const sum = Object.entries(count)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ');
    const leads = (d.users ?? []).filter((u) => u.active !== false && u.role === 'lead' && u.id).map((u) => u.id as string);
    d.notifs = d.notifs ?? [];
    if (go.length > nAg)
    for (const to of leads)
      if (to !== me.id)
        d.notifs.push({ id: 'nt' + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1e4).toString(36), to, text: `${by} gửi duyệt ${go.length - nAg} video (${sum})${viaAgent}`, at, ref: go[0].to || 'kho', by, read: false });
    if (d.notifs.length > 600) d.notifs = d.notifs.slice(-600);
    d.activity = [{ t: hm, d: `${vn.slice(8, 10)}/${vn.slice(5, 7)}/${vn.slice(0, 4)}`, who: by, msg: `nhập nhanh ${go.length} link video, gửi Lead duyệt${viaAgent}` }, ...(d.activity ?? [])].slice(0, 400);
    const res = await c.env.DB.prepare('UPDATE hub_state SET version = version + 1, data = ?, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?')
      .bind(await pack(JSON.stringify(d)), at, auth.user.id, 'main', row.version)
      .run();
    if (!res.meta.changes) continue;
    await auditStatement(c.env.DB, {
      actorId: auth.delegation?.agentId ?? auth.user.id,
      actorType: auth.delegation ? 'AGENT' : undefined,
      action: 'VIDEO_LINKS_SUBMITTED',
      entityType: 'HUB_CARD',
      entityId: go.map((p) => p.to || 'kho').join(',').slice(0, 200),
      after: { count: go.length, on_behalf_of: auth.delegation ? by : undefined },
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }).run();
    return ok(c, { plan, saved: go.length, drive: !!key });
  }
  throw conflict('BUSY', 'Dữ liệu đang được sửa liên tục, thử lại sau vài giây');
});

/* ---------- Thư mục "Kho video agency" (chị Hoa 07/11): lưu một link thư mục Drive; bấm "Lấy video mới" là web liệt kê
   video trong thư mục (và thư mục con một tầng) chưa có trên web, điền sẵn vào Nhập nhanh với nguồn Agency.
   Agent Lead Content dùng cùng đường: GET /agency rồi POST / với nguon "Agency". ---------- */
const AG_KEY = 'video_agency_folder';
async function agFolder(db: D1Database): Promise<string> {
  const r = await db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(AG_KEY).first<{ data: string }>();
  return r?.data ?? '';
}
videoLinkRoutes.get('/agency', async (c) => {
  const folder = await agFolder(c.env.DB);
  if (!folder) return ok(c, { folder: '', files: [] });
  const key = saKey(c.env.GDRIVE_SA_JSON);
  if (!key) return ok(c, { folder, files: [], err: 'Web chưa nối Google Drive' });
  const isVid = (f: { mimeType?: string; name?: string }) => /^video\//.test(f.mimeType ?? '') || /\.(mp4|mov|m4v|webm)$/i.test(f.name ?? '');
  let all: { id: string; name: string; mimeType?: string; modifiedTime?: string }[] = [];
  try {
    const top = await children(key, folder);
    all = top.filter(isVid);
    for (const sub of top.filter((f) => f.mimeType === 'application/vnd.google-apps.folder').slice(0, 30))
      all = all.concat((await children(key, sub.id)).filter(isVid));
  } catch {
    return ok(c, { folder, files: [], err: 'Web chưa mở được thư mục. Chia sẻ thư mục cho tài khoản của web (như Thư mục làm việc).' });
  }
  const row = await c.env.DB.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  const d = row ? (JSON.parse(await unpack(row.data)) as Hub) : ({} as Hub);
  const has = (s: unknown, id: string) => String(s ?? '').includes(id);
  const seen = (id: string) => (d.cards ?? []).some((x) => has(x.linkVideo, id) || has(x.linkFinal, id)) || (d.kho ?? []).some((k) => has(k.link, id));
  const files = all
    .filter((f) => !seen(f.id))
    .sort((a, b) => String(b.modifiedTime ?? '').localeCompare(String(a.modifiedTime ?? '')))
    .slice(0, 60)
    .map((f) => ({ url: `https://drive.google.com/file/d/${f.id}/view`, name: f.name }));
  return ok(c, { folder, files, total: all.length });
});
videoLinkRoutes.post('/agency', async (c) => {
  const auth = c.get('auth');
  const b = (await c.req.json().catch(() => null)) as { link?: string } | null;
  const id = folderIdFrom(String(b?.link ?? ''));
  if (!id) throw unprocessable('VALIDATION', 'Dán link thư mục Google Drive (có /folders/…)', {});
  const row = await c.env.DB.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  const d = row ? (JSON.parse(await unpack(row.data)) as Hub) : ({} as Hub);
  const me = (d.users ?? []).find((u) => u.crm && u.crm === auth.user.id && u.active !== false);
  if (!(auth.user.role === 'CEO' || ['lead', 'admin', 'truongphong'].includes(me?.role ?? ''))) throw forbidden('Chỉ CEO hoặc Lead đổi thư mục video agency');
  await c.env.DB.prepare(`INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 0, ?, ?)
    ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(AG_KEY, id, nowIso(), auth.user.id).run();
  return ok(c, { folder: id });
});

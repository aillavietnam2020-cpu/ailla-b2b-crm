import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, forbidden, ok } from '../lib/http';
import { pack, unpack } from '../lib/pack';
import { adminOnlyEndpoint } from '../middleware/adminHost';
import { requirePermission } from '../middleware/rbac';
import { loadFbMoney } from '../services/fbCost';

/**
 * Lưu file báo cáo tháng lên Drive (chị Hoa duyệt 16/11/2026): mỗi lần kế toán tải báo cáo kênh lên trang quản trị,
 * web cất nguyên file gốc từ sàn và file tính toán (từng đơn → ra số trên web) vào Drive của chị,
 * thư mục "Báo cáo kênh (web ABOS)" › tháng › kênh/shop › "1. File gốc" | "2. File tính toán".
 * Ghi qua cầu nối Apps Script chạy bằng tài khoản Drive của chị (BC_DRIVE_URL + khóa BC_DRIVE_KEY); cầu nối chỉ thêm file, không xóa, không sửa.
 * Danh sách file đã lưu nằm ở hub_blobs 'bc_files'. Chỉ CEO và kế toán.
 */
export const baocaoFileRoutes = new Hono<AppEnv>();
baocaoFileRoutes.use('*', requirePermission('hub.access'));

const KEY = 'bc_files';
const canMoney = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('debt.read.all');
const KY = /^\d{4}-(0[1-9]|1[0-2])$/;
const KENH = /^(spe|tts|fb)$/;
const MAX_B64 = 28 * 1024 * 1024; // khoảng 20 MB file
const LOAI = { goc: '1. File gốc', tinh: '2. File tính toán' } as const;

export type BcFile = { ky: string; kenh: string; nhom: string; loai: keyof typeof LOAI; name: string; id: string; url: string; folderUrl: string; size: number; at: string; by: string };

const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

async function loadList(db: D1Database): Promise<BcFile[]> {
  const row = await db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(KEY).first<{ data: string }>();
  if (!row) return [];
  try {
    const v = JSON.parse(await unpack(row.data)) as { files?: BcFile[] };
    return Array.isArray(v.files) ? v.files : [];
  } catch {
    return [];
  }
}

baocaoFileRoutes.get('/', async (c) => {
  if (!canMoney(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem file báo cáo');
  const ky = c.req.query('ky');
  const list = await loadList(c.env.DB);
  return ok(c, { ready: !!(c.env.BC_DRIVE_URL && c.env.BC_DRIVE_KEY), files: ky && KY.test(ky) ? list.filter((f) => f.ky === ky) : list });
});

/**
 * Đối soát tiền về Facebook theo tháng (cách chị Huệ, 18/11/2026): kế toán nạp file đơn FB + file tiền về SPX/Best ở trang Facebook,
 * trang tính (fbdscalc.js) rồi lưu bản tóm tắt theo tháng (không mã đơn, không thông tin khách) ở hub_blobs 'fb_doisoat'.
 * Doanh thu Facebook tháng đó trên web lấy theo số này.
 */
const FB_KEY = 'fb_doisoat';
async function loadFb(db: D1Database): Promise<Record<string, unknown>> {
  const row = await db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(FB_KEY).first<{ data: string }>();
  if (!row) return {};
  try {
    const v = JSON.parse(await unpack(row.data)) as Record<string, unknown>;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
baocaoFileRoutes.get('/fb', async (c) => {
  if (!canMoney(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem đối soát Facebook');
  return ok(c, await loadFb(c.env.DB));
});
/**
 * Đơn Facebook TẠO trong tháng ky, lấy từ số web kéo hằng ngày (fb_money): mã đơn, mã vận đơn, tiền hàng (COD), phí hãng,
 * kèm cờ hoàn nếu đơn có trong danh sách hàng hoàn (ret_orders). Thay cho việc nạp lại file đơn FB khi đối soát tiền về.
 */
baocaoFileRoutes.get('/fb-orders', async (c) => {
  if (!canMoney(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem đối soát Facebook');
  const ky = c.req.query('ky') ?? '';
  if (!KY.test(ky)) throw badRequest('BAD_KY', 'Chọn tháng');
  const fm = await loadFbMoney(c.env.DB);
  const list = Object.entries(fm.o)
    .filter(([, v]) => (v[4] ?? '').slice(0, 7) === ky)
    .map(([id, v]) => ({ id, track: v[3] ?? '', cod: v[1], ship: v[2], day: v[4] ?? '' }));
  const hoan = new Set<string>();
  const ids = list.map((x) => x.id);
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90);
    const r = await c.env.DB.prepare(`SELECT order_id FROM ret_orders WHERE channel = 'FACEBOOK' AND order_id IN (${part.map(() => '?').join(',')})`)
      .bind(...part)
      .all<{ order_id: string }>();
    for (const x of r.results ?? []) hoan.add(x.order_id);
  }
  const noCreated = Object.values(fm.o).filter((v) => v[0].slice(0, 7) >= ky && !v[4]).length;
  return ok(c, { ky, at: fm.at, noCreated, orders: list.map((x) => ({ ...x, hoan: hoan.has(x.id) })) });
});

baocaoFileRoutes.put('/fb', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  if (!canMoney(auth)) throw forbidden('Chỉ CEO hoặc kế toán lưu đối soát Facebook');
  const b = (await c.req.json().catch(() => null)) as { ky?: unknown; s?: Record<string, unknown> } | null;
  const ky = String(b?.ky ?? '');
  const s = b?.s;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (!KY.test(ky) || !s || typeof s !== 'object' || !num(s.dt) || !num(s.don) || !num(s.ship)) throw badRequest('BAD_BODY', 'Thiếu tháng hoặc số đối soát');
  const json = JSON.stringify(s);
  if (json.length > 200_000) throw badRequest('TOO_LARGE', 'Bản tóm tắt quá lớn');
  const all = await loadFb(c.env.DB);
  const at = nowIso();
  all[ky] = { ...s, ky, at, by: auth.user.display_name };
  await c.env.DB.prepare(
    `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  )
    .bind(FB_KEY, await pack(JSON.stringify(all)), at, auth.user.id)
    .run();
  return ok(c, all[ky]);
});

baocaoFileRoutes.post('/', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  if (!canMoney(auth)) throw forbidden('Chỉ CEO hoặc kế toán lưu file báo cáo');
  if (!c.env.BC_DRIVE_URL || !c.env.BC_DRIVE_KEY) throw badRequest('NO_DRIVE', 'Chưa nối Drive để lưu file báo cáo');
  const raw = await c.req.text();
  if (raw.length > MAX_B64 + 4096) throw badRequest('TOO_LARGE', 'File quá lớn (tối đa khoảng 20 MB)');
  const b = JSON.parse(raw) as Record<string, unknown>;
  const ky = String(b.ky ?? '');
  const kenh = String(b.kenh ?? '');
  const loai = b.loai === 'tinh' ? 'tinh' : b.loai === 'goc' ? 'goc' : null;
  const nhom = clean(b.nhom, 60);
  const name = clean(b.name, 150);
  const data = String(b.data ?? '');
  if (!KY.test(ky) || !KENH.test(kenh) || !loai || !nhom || !name || !data) throw badRequest('BAD_BODY', 'Thiếu tháng, kênh, loại file hoặc nội dung file');
  const r = await fetch(c.env.BC_DRIVE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: c.env.BC_DRIVE_KEY, path: [ky, nhom, LOAI[loai]], name, mime: /^[\w.+-]+\/[\w.+-]+$/.test(String(b.mime ?? '')) ? String(b.mime) : 'application/octet-stream', data }),
  });
  const res = (await r.json().catch(() => null)) as { id?: string; url?: string; folderUrl?: string; size?: number; error?: string } | null;
  if (!res || res.error || !res.id) throw badRequest('DRIVE_FAIL', `Không lưu được file lên Drive: ${res?.error ?? 'HTTP ' + r.status}`);
  const f: BcFile = { ky, kenh, nhom, loai, name, id: res.id, url: res.url ?? '', folderUrl: res.folderUrl ?? '', size: res.size ?? 0, at: nowIso(), by: auth.user.display_name };
  const list = await loadList(c.env.DB);
  list.push(f);
  await c.env.DB.prepare(
    `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  )
    .bind(KEY, await pack(JSON.stringify({ files: list })), f.at, auth.user.id)
    .run();
  return ok(c, f);
});

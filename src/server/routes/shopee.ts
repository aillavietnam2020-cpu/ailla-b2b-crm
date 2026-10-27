import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, conflict, forbidden, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import { pack, unpack } from '../lib/pack';
import { requirePermission } from '../middleware/rbac';
import { adminOnlyEndpoint } from '../middleware/adminHost';

/**
 * Báo cáo kênh Shopee (2 shop), làm 27/10/2026 theo cách của TikTok.
 * Kế toán tải file đơn + Tài chính + quảng cáo của từng shop ở trang quản trị; trình duyệt tính rồi gửi số tháng lên đây.
 * Số theo ngày trong summary được gộp vào DAYD.spe để Tổng quan, Lãi lỗ, Sổ chi phí, Đối chiếu doanh thu đọc.
 * File đơn chỉ đọc ở trình duyệt; máy chủ không nhận mã đơn, tên, số điện thoại, địa chỉ khách.
 */
export const shopeeRoutes = new Hono<AppEnv>();
shopeeRoutes.use('*', requirePermission('hub.access'));

const canMoney = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('debt.read.all');
const ip = (c: { req: { header: (n: string) => string | undefined } }) => c.req.header('CF-Connecting-IP') ?? null;
const KY = /^\d{4}-\d{2}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SHOP = /^[\w.\-]{2,40}$/;
const MAX_MONTH = 3 * 1024 * 1024;

interface Summary {
  ky?: unknown;
  shop?: unknown;
  den?: unknown;
  days?: unknown;
  [k: string]: unknown;
}

/** Số theo ngày chỉ nhận ngày trong tháng và 6 con số, để không ai cất chữ tuỳ ý vào chỗ các trang đọc. */
function cleanDays(v: unknown, ky: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [d, x] of Object.entries(v as Record<string, unknown>)) {
    if (!DAY.test(d) || d.slice(0, 7) !== ky || !Array.isArray(x)) continue;
    out[d] = x.slice(0, 6).map((n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0));
  }
  return out;
}

shopeeRoutes.get('/months', async (c) => {
  if (!canMoney(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem số Shopee');
  const rows = await c.env.DB.prepare('SELECT ky, shop, summary, updated_at, updated_by FROM spe_month ORDER BY ky, shop').all<{
    ky: string;
    shop: string;
    summary: string;
    updated_at: string;
    updated_by: string | null;
  }>();
  return ok(
    c,
    (rows.results ?? []).map((r) => ({ ...r, summary: JSON.parse(r.summary) })),
  );
});

shopeeRoutes.get('/month/:ky/:shop', async (c) => {
  if (!canMoney(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem số Shopee');
  const { ky, shop } = c.req.param();
  if (!KY.test(ky) || !SHOP.test(shop)) throw badRequest('BAD_KEY', 'Tháng hoặc shop không hợp lệ');
  const row = await c.env.DB.prepare('SELECT data, summary, updated_at, updated_by FROM spe_month WHERE ky = ? AND shop = ?')
    .bind(ky, shop)
    .first<{ data: string; summary: string; updated_at: string; updated_by: string | null }>();
  if (!row) return ok(c, null);
  return ok(c, { ...row, summary: JSON.parse(row.summary), data: JSON.parse(await unpack(row.data)) });
});

/** Lưu số tháng một shop (sau khi xem trước và bấm lưu). Bản giữa tháng không đè bản đủ tháng. */
shopeeRoutes.put('/month/:ky/:shop', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  if (!canMoney(auth)) throw forbidden('Chỉ CEO hoặc kế toán lưu báo cáo Shopee');
  const { ky, shop } = c.req.param();
  if (!KY.test(ky) || !SHOP.test(shop)) throw badRequest('BAD_KEY', 'Tháng hoặc shop không hợp lệ');
  const raw = await c.req.text();
  if (raw.length > MAX_MONTH) throw badRequest('TOO_LARGE', 'Dữ liệu quá lớn');
  const body = JSON.parse(raw) as { data?: unknown; summary?: Summary; files?: unknown };
  const s = body.summary;
  if (!body.data || !s || s.ky !== ky || s.shop !== shop) throw badRequest('BAD_BODY', 'Thiếu số tháng hoặc sai tháng / shop');
  const den = typeof s.den === 'string' && DAY.test(s.den) ? s.den : null;
  const cur = await c.env.DB.prepare('SELECT summary FROM spe_month WHERE ky = ? AND shop = ?').bind(ky, shop).first<{ summary: string }>();
  if (cur && den && !JSON.parse(cur.summary).den)
    throw conflict('FULL_EXISTS', `Shop ${shop} tháng ${ky.slice(5)}/${ky.slice(0, 4)} đã có báo cáo đủ tháng, không thay bằng bản giữa tháng.`);
  const summary = { ...s, den, days: cleanDays(s.days, ky) };
  const at = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO spe_month (ky, shop, data, summary, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (ky, shop) DO UPDATE SET data = excluded.data, summary = excluded.summary,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).bind(ky, shop, await pack(JSON.stringify(body.data)), JSON.stringify(summary), at, auth.user.id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'SPE_MONTH_SAVE',
      entityType: 'SPE_MONTH',
      entityId: `${ky}|${shop}`,
      after: { dt: s.dt ?? null, den, files: body.files ?? null },
      ip: ip(c),
      requestId: c.get('requestId'),
    }),
  ]);
  return ok(c, { ok: true, updated_at: at });
});

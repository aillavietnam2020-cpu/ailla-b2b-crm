import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import { AGENT_SCOPE_PREFIX } from '@shared/agent';
import type { AppEnv } from '../env';
import { badRequest, conflict, forbidden, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import { pack } from '../lib/pack';
import { requirePermission } from '../middleware/rbac';
import { agentInputs } from './agentTiktok';
import { cleanDays } from './shopee';

/**
 * Agent Kế toán trưởng nạp báo cáo Shopee (2 shop) hằng tuần + sáng ngày 10, làm 28/10/2026 theo cách của TikTok.
 * Agent đọc file đơn + Tài chính + quảng cáo trên VPS bằng đúng công thức trang Shopee (hub/src/specalc.js), chỉ gửi số đã tính:
 * không mã đơn, tên, số điện thoại, địa chỉ khách. Ghi vào đúng bảng spe_month mà trang Shopee và các trang tổng hợp đang đọc.
 * Không thay bản đủ tháng bằng bản giữa tháng, không thay bản mới hơn bằng bản cũ hơn.
 */
export const agentShopeeRoutes = new Hono<AppEnv>();
agentShopeeRoutes.use('*', requirePermission('agent.read'));
agentShopeeRoutes.use('*', async (c, next) => {
  if (!c.get('auth').permissions.includes(AGENT_SCOPE_PREFIX + 'baocao_san')) throw forbidden('Agent này chưa được phép nạp báo cáo sàn');
  await next();
});

const KY = /^\d{4}-\d{2}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SHOP = /^[\w.\-]{2,40}$/;
const MAX_MONTH = 3 * 1024 * 1024;
const ip = (c: { req: { header: (n: string) => string | undefined } }) => c.req.header('CF-Connecting-IP') ?? null;

agentShopeeRoutes.get('/inputs', async (c) => {
  const ky = c.req.query('ky') ?? '';
  if (!KY.test(ky)) throw badRequest('BAD_KY', 'Tháng không hợp lệ');
  return ok(c, await agentInputs(c.env.DB, ky, 'SHOPEE'));
});

/** Các tháng đã lưu theo shop: bản đủ tháng (den = null) hay giữa tháng đến ngày nào. */
agentShopeeRoutes.get('/months', async (c) => {
  const rows = await c.env.DB.prepare('SELECT ky, shop, summary, updated_at FROM spe_month ORDER BY ky, shop').all<{
    ky: string;
    shop: string;
    summary: string;
    updated_at: string;
  }>();
  return ok(
    c,
    (rows.results ?? []).map((r) => {
      const s = JSON.parse(r.summary) as { den?: string | null; dt?: number; don?: number };
      return { ky: r.ky, shop: r.shop, den: s.den ?? null, dt: s.dt ?? null, don: s.don ?? null, updated_at: r.updated_at };
    }),
  );
});

agentShopeeRoutes.put('/month/:ky/:shop', async (c) => {
  const auth = c.get('auth');
  const { ky, shop } = c.req.param();
  if (!KY.test(ky) || !SHOP.test(shop)) throw badRequest('BAD_KEY', 'Tháng hoặc shop không hợp lệ');
  const raw = await c.req.text();
  if (raw.length > MAX_MONTH) throw badRequest('TOO_LARGE', 'Dữ liệu quá lớn');
  const body = JSON.parse(raw) as { data?: unknown; summary?: { ky?: unknown; shop?: unknown; den?: unknown; dt?: unknown; days?: unknown }; files?: unknown };
  const s = body.summary;
  if (!body.data || !s || s.ky !== ky || s.shop !== shop) throw badRequest('BAD_BODY', 'Thiếu số tháng hoặc sai tháng / shop');
  const den = s.den == null ? null : String(s.den);
  if (den !== null && !(DAY.test(den) && den.startsWith(ky))) throw badRequest('BAD_DEN', 'Ngày "đến" không thuộc tháng này');
  const cur = await c.env.DB.prepare('SELECT summary FROM spe_month WHERE ky = ? AND shop = ?').bind(ky, shop).first<{ summary: string }>();
  if (cur && den !== null) {
    const old = JSON.parse(cur.summary) as { den?: string | null };
    if (!old.den) throw conflict('HAS_FULL', `Shop ${shop} tháng ${ky.slice(5)}/${ky.slice(0, 4)} đã có báo cáo đủ tháng, không thay bằng bản giữa tháng.`);
    if (old.den > den) throw conflict('OLDER', `Shop ${shop} tháng này đã có bản mới hơn (đến ${old.den}).`);
  }
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
      actorType: 'AGENT',
      source: 'agent-shopee',
      action: 'SPE_MONTH_SAVE',
      entityType: 'SPE_MONTH',
      entityId: `${ky}|${shop}`,
      after: { dt: s.dt ?? null, den, files: body.files ?? null },
      ip: ip(c),
      requestId: c.get('requestId'),
    }),
  ]);
  return ok(c, { ok: true, ky, shop, den, updated_at: at });
});

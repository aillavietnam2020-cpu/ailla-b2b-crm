import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { pack } from '../lib/pack';
import { badRequest, ok, unauthorized } from '../lib/http';
import { CHANNELS, saveChannelDays, type Channel, type ChannelDay } from '../services/channelOut';

/**
 * Nhận số liệu từ VPS (không qua đăng nhập, xác thực bằng khoá riêng INGEST_KEY).
 *  - /ads-live: file "BÁO CÁO DIGITAL MKT 2026 FINAL" (3 tab Ads Việt Anh / Thảo / Duẩn), VPS đọc mỗi sáng 8h.
 */
export const ingestRoutes = new Hono<AppEnv>();

ingestRoutes.use('*', async (c, next) => {
  const key = c.req.header('X-Ingest-Key') ?? '';
  const expected = c.env.INGEST_KEY ?? '';
  if (!expected || key.length !== expected.length) throw unauthorized('Sai khoá');
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) throw unauthorized('Sai khoá');
  await next();
});

ingestRoutes.post('/ads-live', async (c) => {
  const raw = await c.req.text();
  if (raw.length > 3_000_000) throw badRequest('TOO_LARGE', 'Dữ liệu quá lớn');
  const body = JSON.parse(raw) as { tabs?: Record<string, unknown> };
  if (!body.tabs || typeof body.tabs !== 'object') throw badRequest('BAD_DATA', 'Thiếu dữ liệu các tab');
  const data = { at: nowIso(), tabs: body.tabs };
  await c.env.DB.prepare(
    `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES ('ads_live', ?, 0, ?, NULL)
     ON CONFLICT (key) DO UPDATE SET data = excluded.data, admin_only = 0, updated_at = excluded.updated_at, updated_by = NULL`,
  )
    .bind(await pack(JSON.stringify(data)), data.at)
    .run();
  return ok(c, { ok: true, at: data.at });
});

/** Số liệu ngày: chi phí/tin nhắn từ Facebook + đơn/doanh số từ Pancake (theo Nguồn đơn). VPS đẩy mỗi sáng. */
ingestRoutes.post('/ads-fb', async (c) => {
  const raw = await c.req.text();
  if (raw.length > 12_000_000) throw badRequest('TOO_LARGE', 'Dữ liệu quá lớn');
  const body = JSON.parse(raw) as { days?: Record<string, unknown>; billing?: unknown[]; camp_page?: Record<string, string> };
  if (!body.days || typeof body.days !== 'object') throw badRequest('BAD_DATA', 'Thiếu dữ liệu các ngày');
  const data = {
    at: nowIso(),
    days: body.days,
    billing: Array.isArray(body.billing) ? body.billing.slice(0, 5000) : [],
    camp_page: body.camp_page && typeof body.camp_page === 'object' ? body.camp_page : {},
  };
  await c.env.DB.prepare(
    `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES ('ads_fb', ?, 0, ?, NULL)
     ON CONFLICT (key) DO UPDATE SET data = excluded.data, admin_only = 0, updated_at = excluded.updated_at, updated_by = NULL`,
  )
    .bind(await pack(JSON.stringify(data)), data.at)
    .run();
  return ok(c, { ok: true, at: data.at });
});

/**
 * Số hàng lẻ bán qua sàn mỗi ngày (tab "Hàng lẻ theo ngày" của Sheet kế toán kho TikTok / Shopee).
 * Body: { channel: 'TIKTOK' | 'SHOPEE', days: [{ day: 'YYYY-MM-DD', orders?, lines: [{ label, qty }] }] }
 */
ingestRoutes.post('/channel-out', async (c) => {
  const raw = await c.req.text();
  if (raw.length > 2_000_000) throw badRequest('TOO_LARGE', 'Dữ liệu quá lớn');
  const body = JSON.parse(raw) as { channel?: string; days?: ChannelDay[] };
  if (!body.channel || !(CHANNELS as readonly string[]).includes(body.channel)) {
    throw badRequest('BAD_CHANNEL', 'Kênh không đúng');
  }
  if (!Array.isArray(body.days) || body.days.length === 0 || body.days.length > 120) {
    throw badRequest('BAD_DATA', 'Thiếu danh sách ngày');
  }
  for (const d of body.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.day))) throw badRequest('BAD_DATE', 'Ngày không đúng');
  }
  return ok(c, await saveChannelDays(c.env.DB, body.channel as Channel, body.days, 'INGEST'));
});

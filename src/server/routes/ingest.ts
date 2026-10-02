import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { pack } from '../lib/pack';
import { badRequest, ok, unauthorized } from '../lib/http';

/**
 * Nhận số liệu từ VPS (không qua đăng nhập, xác thực bằng khoá riêng INGEST_KEY).
 *  - /ads-live: file "BÁO CÁO DIGITAL MKT 2026 FINAL" (3 tab Ads Việt Anh / Thảo / Duẩn), VPS đọc 5 phút một lần.
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

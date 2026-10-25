import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { requirePermission } from '../middleware/rbac';
import { sealKey } from '../services/poscake';
import { GRAPH, getMode, publishCard, setMode, type FpCard, type PublishMode } from '../services/fpPublish';
import { unpack } from '../lib/pack';

/**
 * Đăng bài Fanpage tự động: nối page, công tắc chung, nút Dừng khẩn, đăng thử ngay một bài.
 * Xem thì ai trong khu Marketing cũng xem được (không có mã truy cập); ghi chỉ CEO.
 */
export const fpPublishRoutes = new Hono<AppEnv>();
fpPublishRoutes.use('*', requirePermission('hub.access'));

const onlyCeo = (c: { get: (k: 'auth') => { user: { role: string } } }) => {
  if (c.get('auth').user.role !== 'CEO') throw forbidden('Chỉ chị Hoa được nối page và bật đăng tự động');
};

fpPublishRoutes.get('/', async (c) => {
  const pages = await c.env.DB.prepare('SELECT page_id, name, is_test, active, created_at FROM fp_pages ORDER BY created_at').all();
  const logs = await c.env.DB.prepare('SELECT card_id, page_id, status, fb_post_id, error, created_at FROM fp_publish_log ORDER BY id DESC LIMIT 30').all();
  return ok(c, { mode: await getMode(c.env.DB), pages: pages.results ?? [], logs: logs.results ?? [] });
});

fpPublishRoutes.post('/mode', async (c) => {
  onlyCeo(c);
  const body = (await c.req.json().catch(() => ({}))) as { mode?: string };
  if (!['off', 'test', 'on'].includes(String(body.mode))) throw badRequest('BAD_MODE', 'Chế độ không hợp lệ');
  await setMode(c.env.DB, body.mode as PublishMode);
  return ok(c, { mode: body.mode });
});

/** Nối page: chị dán mã page + mã truy cập; kiểm tra thật với Facebook rồi mới lưu (mã được mã hóa). */
fpPublishRoutes.post('/pages', async (c) => {
  onlyCeo(c);
  // Mã truy cập là tùy chọn: bình thường agent trên VPS đã nối page và giữ mã, web chỉ biết page nào để xếp bài.
  // Nếu có dán mã thì máy chủ web tự đăng (kiểm tra thật với Facebook, mã được mã hóa).
  const body = (await c.req.json().catch(() => ({}))) as { page_id?: string; name?: string; token?: string; is_test?: boolean };
  const pageId = String(body.page_id ?? '').trim();
  const token = String(body.token ?? '').trim();
  let name = String(body.name ?? '').trim();
  if (!/^\d{5,25}$/.test(pageId)) throw badRequest('BAD_PAGE', 'Mã page phải là dãy số');
  let sealed = '';
  if (token) {
    const res = await fetch(`${GRAPH}/${pageId}?fields=name&access_token=${encodeURIComponent(token)}`);
    const fb = (await res.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };
    if (!res.ok || !fb.name) throw badRequest('FB_REJECT', `Facebook không nhận mã này: ${fb.error?.message ?? res.status}`);
    name = name || fb.name;
    sealed = await sealKey(token, c.env.INGEST_KEY);
  }
  if (!name) throw badRequest('NO_NAME', 'Ghi tên page');
  const j = { name };
  await c.env.DB.prepare(
    `INSERT INTO fp_pages (page_id, name, token, is_test, active, created_at, created_by) VALUES (?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT (page_id) DO UPDATE SET name = excluded.name, token = excluded.token, is_test = excluded.is_test, active = 1`,
  )
    .bind(pageId, j.name, sealed, body.is_test ? 1 : 0, nowIso(), c.get('auth').user.id)
    .run();
  return ok(c, { page_id: pageId, name: j.name });
});

fpPublishRoutes.delete('/pages/:id', async (c) => {
  onlyCeo(c);
  await c.env.DB.prepare('DELETE FROM fp_pages WHERE page_id = ?').bind(c.req.param('id')).run();
  return ok(c, { ok: true });
});

/** Đăng thử ngay một bài đã duyệt (bỏ qua giờ), vẫn theo công tắc chung. */
fpPublishRoutes.post('/post-now', async (c) => {
  onlyCeo(c);
  const body = (await c.req.json().catch(() => ({}))) as { card_id?: string };
  const row = await c.env.DB.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  if (!row) throw notFound('Chưa có dữ liệu');
  const d = JSON.parse(await unpack(row.data)) as { cards?: FpCard[] };
  const card = (d.cards ?? []).find((x) => x.id === body.card_id);
  if (!card) throw notFound('Không thấy bài');
  if (card.step !== 'dang') throw badRequest('NOT_APPROVED', 'Bài chưa được duyệt');
  const pg = await c.env.DB.prepare('SELECT token FROM fp_pages WHERE page_id = ? AND active = 1').bind(card.pageId ?? '').first<{ token: string }>();
  if (pg && !pg.token) return ok(c, { ok: false, detail: 'Page này do agent trên VPS đăng: agent sẽ lấy bài về đăng khi tới giờ đã đặt.' });
  const r = await publishCard(c.env.DB, c.env.INGEST_KEY, card, await getMode(c.env.DB), (u, i) => fetch(u, i));
  return ok(c, r);
});

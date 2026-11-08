import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, ok } from '../lib/http';
import { requirePermission } from '../middleware/rbac';
import { okEndpoint, VAPID_PUBLIC } from '../services/webpush';
import { normPrefs, openUrl, sendToUser } from '../services/pushDispatch';

/**
 * Bật / tắt thông báo đẩy trên từng máy và tùy chọn của mình (Của tôi › Cài đặt thông báo). Mỗi người chỉ thấy, sửa máy của mình.
 */
export const pushRoutes = new Hono<AppEnv>();
pushRoutes.use('*', requirePermission('hub.access'));

const MAX_DEVICES = 8;

pushRoutes.get('/me', async (c) => {
  const uid = c.get('auth').user.id;
  const devs = await c.env.DB.prepare('SELECT endpoint, device, created_at, last_ok_at FROM push_subs WHERE user_id = ? ORDER BY created_at').bind(uid).all();
  const u = await c.env.DB.prepare('SELECT prefs FROM push_users WHERE user_id = ?').bind(uid).first<{ prefs: string }>();
  let prefs = normPrefs({});
  try {
    prefs = normPrefs(JSON.parse(u?.prefs ?? '{}'));
  } catch {
    /* giữ mặc định */
  }
  return ok(c, { key: VAPID_PUBLIC, ready: !!(c.env as { VAPID_JWK?: string }).VAPID_JWK, devices: devs.results ?? [], prefs });
});

pushRoutes.post('/subscribe', async (c) => {
  const uid = c.get('auth').user.id;
  const b = (await c.req.json().catch(() => null)) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; device?: unknown } | null;
  const endpoint = String(b?.endpoint ?? '');
  const p256dh = String(b?.keys?.p256dh ?? '');
  const auth = String(b?.keys?.auth ?? '');
  if (!okEndpoint(endpoint) || endpoint.length > 1000) throw badRequest('BAD_ENDPOINT', 'Trình duyệt này không hỗ trợ thông báo đẩy');
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) throw badRequest('BAD_KEYS', 'Khóa thông báo không hợp lệ');
  const device = String(b?.device ?? '').replace(/[<>]/g, '').slice(0, 60) || 'Máy không rõ';
  await c.env.DB.prepare(
    `INSERT INTO push_subs (endpoint, user_id, p256dh, auth, device, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device`,
  )
    .bind(endpoint, uid, p256dh, auth, device, nowIso())
    .run();
  // Giữ tối đa 8 máy mỗi người: bỏ máy cũ nhất.
  await c.env.DB.prepare(
    `DELETE FROM push_subs WHERE user_id = ?1 AND endpoint NOT IN (SELECT endpoint FROM push_subs WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ${MAX_DEVICES})`,
  )
    .bind(uid)
    .run();
  await c.env.DB.prepare("INSERT INTO push_users (user_id, prefs) VALUES (?, '{}') ON CONFLICT (user_id) DO NOTHING").bind(uid).run();
  return ok(c, { ok: true });
});

pushRoutes.post('/unsubscribe', async (c) => {
  const uid = c.get('auth').user.id;
  const b = (await c.req.json().catch(() => null)) as { endpoint?: unknown } | null;
  await c.env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').bind(String(b?.endpoint ?? ''), uid).run();
  return ok(c, { ok: true });
});

pushRoutes.put('/prefs', async (c) => {
  const uid = c.get('auth').user.id;
  const prefs = normPrefs(await c.req.json().catch(() => ({})));
  await c.env.DB.prepare('INSERT INTO push_users (user_id, prefs) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET prefs = excluded.prefs')
    .bind(uid, JSON.stringify(prefs))
    .run();
  return ok(c, { prefs });
});

pushRoutes.post('/test', async (c) => {
  const uid = c.get('auth').user.id;
  const n = await sendToUser(c.env, uid, { title: '💬 AILLA · Thông báo thử', body: 'Máy này nhận thông báo tốt.', url: openUrl('page:thongbao'), tag: 'ailla-thu' });
  return ok(c, { sent: n });
});

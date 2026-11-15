import type { Env } from '../env';
import { unpack } from '../lib/pack';
import { sendPush, type PushMsg } from './webpush';
import { canRoom, hubCtx, teamKey } from '../routes/chat';

/**
 * Thông báo đẩy về điện thoại (chị Hoa duyệt demo 08/11/2026). Nguồn:
 *  - Chuông của web (hub_state.notifs): mọi chỗ giao việc, nhắc, trả sửa, chờ duyệt… đều ghi vào đây
 *    (trình duyệt ghi khi lưu bản chung; máy chủ ghi khi chạy nhắc việc). Gửi ngay sau mỗi lần lưu + mỗi 15 phút.
 *  - Tin nhắn (bảng chat_msgs): gửi ngay khi có tin.
 * Quy tắc: 5 loại bật / tắt theo từng người; giờ yên lặng (mặc định 22:00–7:00, việc gấp vẫn báo, còn lại báo gộp khi hết giờ);
 * việc chờ duyệt gộp, tối đa 1 thông báo mỗi giờ; một lượt có nhiều hơn 2 thông báo thì gộp thành một.
 */

export type PushType = 'giao' | 'nhac' | 'sua' | 'tin' | 'duyet';
export interface PushPrefs { giao: boolean; nhac: boolean; sua: boolean; tin: boolean; duyet: boolean; quiet: boolean; qFrom: number; qTo: number }
export const DEFAULT_PREFS: PushPrefs = { giao: true, nhac: true, sua: true, tin: true, duyet: true, quiet: true, qFrom: 22, qTo: 7 };

export function normPrefs(v: unknown): PushPrefs {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const b = (k: keyof PushPrefs) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : (DEFAULT_PREFS[k] as boolean));
  const h = (k: 'qFrom' | 'qTo') => (Number.isInteger(o[k]) && (o[k] as number) >= 0 && (o[k] as number) <= 23 ? (o[k] as number) : DEFAULT_PREFS[k]);
  return { giao: b('giao'), nhac: b('nhac'), sua: b('sua'), tin: b('tin'), duyet: b('duyet'), quiet: b('quiet'), qFrom: h('qFrom'), qTo: h('qTo') };
}

/** Giờ Việt Nam đang trong giờ yên lặng của người này. */
export function inQuiet(p: PushPrefs, now = Date.now()): boolean {
  if (!p.quiet || p.qFrom === p.qTo) return false;
  const h = new Date(now + 7 * 3_600_000).getUTCHours();
  return p.qFrom > p.qTo ? h >= p.qFrom || h < p.qTo : h >= p.qFrom && h < p.qTo;
}

/** Xếp một dòng chuông vào 5 loại theo nội dung (các chỗ ghi chuông trên web viết theo mẫu cố định). */
export function classify(text: string, ref: string): PushType {
  const t = text.toLowerCase();
  if (ref.startsWith('room:') || ref.startsWith('tn:')) return 'tin';
  if (t.includes('nhắc')) return 'nhac';
  if (/trả về sửa|trả lại|cần sửa|vẫn cần làm/.test(t)) return 'sua';
  if (/chờ (bạn )?duyệt|cần duyệt|gửi duyệt|nộp kết quả/.test(t)) return 'duyet';
  return 'giao';
}

const TITLE: Record<PushType, string> = { giao: '📋 Giao việc', nhac: '🔔 Nhắc việc', sua: '✏️ Cần sửa', tin: '💬 Tin nhắn', duyet: '✅ Chờ duyệt' };
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
export const openUrl = (ref: string, id = '') => '/hub/#nt=' + encodeURIComponent(id) + '~' + encodeURIComponent(ref);

interface Notif { id: string; to: string; text: string; at: string; ref?: string; read?: boolean }
interface HubData { users?: { id: string; crm?: string; name?: string; active?: boolean }[]; tasks?: { id: string; gap?: boolean }[]; notifs?: Notif[] }
interface Item { key: string; type: PushType; urgent: boolean; title: string; body: string; url: string }
type URow = { user_id: string; prefs: string; pend_duyet: number; last_duyet_at: string | null; pend_dem: number };

const vapid = (env: Env) => (env as Env & { VAPID_JWK?: string }).VAPID_JWK ?? '';

async function subscribers(db: D1Database): Promise<Set<string>> {
  const r = await db.prepare('SELECT DISTINCT user_id FROM push_subs').all<{ user_id: string }>();
  return new Set((r.results ?? []).map((x) => x.user_id));
}
async function userRow(db: D1Database, uid: string): Promise<URow> {
  const r = await db.prepare('SELECT user_id, prefs, pend_duyet, last_duyet_at, pend_dem FROM push_users WHERE user_id = ?').bind(uid).first<URow>();
  return r ?? { user_id: uid, prefs: '{}', pend_duyet: 0, last_duyet_at: null, pend_dem: 0 };
}
async function saveCounts(db: D1Database, u: URow) {
  await db
    .prepare(
      `INSERT INTO push_users (user_id, prefs, pend_duyet, last_duyet_at, pend_dem) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET pend_duyet = excluded.pend_duyet, last_duyet_at = excluded.last_duyet_at, pend_dem = excluded.pend_dem`,
    )
    .bind(u.user_id, u.prefs, u.pend_duyet, u.last_duyet_at, u.pend_dem)
    .run();
}
const parsePrefs = (s: string) => {
  try {
    return normPrefs(JSON.parse(s));
  } catch {
    return normPrefs({});
  }
};

/** Gửi tới mọi máy của một người; máy đã gỡ thì xóa đăng ký. Trả số máy nhận được. */
export async function sendToUser(env: Env, uid: string, msg: PushMsg, urgent = true): Promise<number> {
  const jwk = vapid(env);
  if (!jwk) return 0;
  const subs = (await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = ?').bind(uid).all<{ endpoint: string; p256dh: string; auth: string }>()).results ?? [];
  let n = 0;
  for (const s of subs) {
    const r = await sendPush(jwk, s, msg, urgent);
    if (r === 'gone') await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(s.endpoint).run();
    if (r === 'ok') {
      n++;
      await env.DB.prepare('UPDATE push_subs SET last_ok_at = ? WHERE endpoint = ?').bind(new Date().toISOString(), s.endpoint).run();
    }
  }
  return n;
}

/** Nhận khóa "đã gửi" (chặn trùng). Trả các khóa lượt này được gửi. */
async function claim(db: D1Database, keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const at = new Date().toISOString();
  const res = await db.batch(keys.map((k) => db.prepare('INSERT OR IGNORE INTO push_sent (id, at) VALUES (?, ?)').bind(k, at)));
  return new Set(keys.filter((_, i) => (res[i]?.meta?.changes ?? 0) > 0));
}

/** Một người, một lượt: áp loại, giờ yên lặng, gộp chờ duyệt, gộp khi nhiều. */
async function deliver(env: Env, uid: string, items: Item[]) {
  if (!items.length) return;
  const u = await userRow(env.DB, uid);
  const p = parsePrefs(u.prefs);
  const now = Date.now();
  let L = items.filter((x) => p[x.type]);
  const quiet = inQuiet(p, now);
  let dirty = false;
  if (quiet) {
    const later = L.filter((x) => !x.urgent);
    if (later.length) {
      u.pend_dem += later.length;
      dirty = true;
    }
    L = L.filter((x) => x.urgent);
  }
  const dv = L.filter((x) => x.type === 'duyet' && !x.urgent);
  L = L.filter((x) => !(x.type === 'duyet' && !x.urgent));
  if (dv.length) {
    const fresh = !u.last_duyet_at || now - Date.parse(u.last_duyet_at) >= 3_600_000;
    if (fresh) {
      L.push(dv.length === 1 ? dv[0] : { key: 'dv', type: 'duyet', urgent: false, title: TITLE.duyet, body: `${dv.length} việc mới chờ bạn duyệt · ${cut(dv[0].body, 90)}`, url: openUrl('cvrv') });
      u.last_duyet_at = new Date(now).toISOString();
      u.pend_duyet = 0;
    } else u.pend_duyet += dv.length;
    dirty = true;
  }
  if (dirty) await saveCounts(env.DB, u);
  if (!L.length) return;
  if (L.length > 2) {
    await sendToUser(env, uid, { title: `🔔 ${L.length} thông báo mới`, body: L.slice(0, 3).map((x) => '• ' + cut(x.body, 70)).join('\n'), url: openUrl('page:cv_v'), tag: 'ailla-gop' }, true);
    return;
  }
  for (const x of L) await sendToUser(env, uid, { title: x.title, body: x.body, url: x.url, tag: x.key }, x.urgent || x.type !== 'duyet');
}

/** Chuông mới (chưa đọc, trong 2 giờ gần nhất) của những người đã bật thông báo. */
export async function pushFromHub(env: Env, data?: HubData): Promise<void> {
  if (!vapid(env)) return;
  const subs = await subscribers(env.DB);
  if (!subs.size) return;
  if (!data) {
    const row = await env.DB.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
    if (!row) return;
    data = JSON.parse(await unpack(row.data)) as HubData;
  }
  const crmOf = new Map((data.users ?? []).filter((u) => u.crm).map((u) => [u.id, String(u.crm)]));
  const since = Date.now() - 2 * 3_600_000;
  const N = (data.notifs ?? []).filter((n) => n && !n.read && n.id && Date.parse(n.at) >= since && subs.has(crmOf.get(n.to) ?? ''));
  if (!N.length) return;
  const got = await claim(env.DB, N.map((n) => 'n:' + n.id));
  const gap = new Set((data.tasks ?? []).filter((t) => t.gap).map((t) => 'task:' + t.id));
  const by = new Map<string, Item[]>();
  for (const n of N) {
    if (!got.has('n:' + n.id)) continue;
    const ref = String(n.ref ?? '');
    const type = classify(String(n.text ?? ''), ref);
    const text = String(n.text ?? '').replace(/\s+/g, ' ').trim();
    const uid = crmOf.get(n.to)!;
    const it: Item = { key: n.id, type, urgent: gap.has(ref) || /\bgấp\b/i.test(text), title: TITLE[type], body: cut(text, 180), url: openUrl(ref, n.id) };
    by.set(uid, (by.get(uid) ?? []).concat(it));
  }
  for (const [uid, items] of by) await deliver(env, uid, items).catch((e) => console.error('[push] hub', e));
}

/** Tin nhắn mới: nhắn riêng, nhóm tự tạo, nhóm phòng / dự án có mình; nhóm chung chỉ báo người được gọi tên (@Tên). */
export async function pushChat(env: Env, room: string, from: string, body: string, kind: string): Promise<void> {
  if (!vapid(env) || !['', 'task', 'file'].includes(kind)) return;
  const subs = await subscribers(env.DB);
  subs.delete(from);
  if (!subs.size) return;
  const hub = await hubCtx(env.DB);
  const users = hub.users as { id?: string; crm?: string; name?: string; role?: string; phongBan?: string }[];
  const name = (crm: string) => users.find((u) => u.crm === crm)?.name ?? '';
  let to: string[] = [];
  let where = '';
  if (room.startsWith('dm:')) {
    const [a, b] = room.slice(3).split('~');
    to = [a === from ? b : a];
  } else if (room.startsWith('n:')) {
    const g = await env.DB.prepare('SELECT name, members FROM chat_groups WHERE id = ?').bind(room.slice(2)).first<{ name: string; members: string }>();
    try {
      to = (JSON.parse(g?.members ?? '[]') as unknown[]).map(String);
    } catch {
      to = [];
    }
    where = g?.name ?? 'nhóm';
  } else {
    const called = (crm: string) => {
      const nm = name(crm);
      return !!nm && body.toLowerCase().includes('@' + nm.toLowerCase());
    };
    for (const crm of subs) {
      const hu = users.find((u) => u.crm === crm) ?? null;
      if (room === 'g:chung') {
        if (called(crm)) to.push(crm);
        continue;
      }
      // CEO đọc được mọi nhóm nhưng chỉ nhận thông báo nhóm mình thật sự ở trong, hoặc khi được gọi tên.
      const inRoom = await canRoom(room, { id: crm, hubId: hu?.id ?? '', team: teamKey(hu), ceo: false, lead: false, db: env.DB });
      if (inRoom || called(crm)) to.push(crm);
    }
    where = room === 'g:chung' ? 'nhóm chung' : 'nhóm';
  }
  to = [...new Set(to)].filter((x) => x && x !== from && subs.has(x));
  if (!to.length) return;
  const who = name(from) || 'Có người';
  const text = kind === 'task' ? 'đã giao việc trong tin nhắn' : kind === 'file' ? 'đã gửi một tệp' : body.replace(/\s+/g, ' ').trim();
  const minute = Math.floor(Date.now() / 60_000);
  const got = await claim(env.DB, to.map((u) => `c:${room}:${u}:${minute}`));
  for (const u of to) {
    if (!got.has(`c:${room}:${u}:${minute}`)) continue; // nhiều tin liền nhau: mỗi phút báo một lần mỗi nhóm
    const item: Item = { key: 'tn-' + room, type: 'tin', urgent: false, title: `💬 ${who}${where ? ' · ' + where : ''}`, body: cut(text, 180), url: openUrl('tn:' + room) };
    await deliver(env, u, [item]).catch((e) => console.error('[push] chat', e));
  }
}

/** Chạy mỗi 15 phút: chuông do máy chủ ghi, báo gộp việc chờ duyệt, báo gộp sau giờ yên lặng, dọn khóa cũ. */
export async function pushCron(env: Env): Promise<void> {
  if (!vapid(env)) return;
  await pushFromHub(env).catch((e) => console.error('[push] cron hub', e));
  const rows = (await env.DB.prepare('SELECT user_id, prefs, pend_duyet, last_duyet_at, pend_dem FROM push_users WHERE pend_duyet > 0 OR pend_dem > 0').all<URow>()).results ?? [];
  const now = Date.now();
  for (const u of rows) {
    const p = parsePrefs(u.prefs);
    if (inQuiet(p, now)) continue;
    if (u.pend_dem > 0) {
      await sendToUser(env, u.user_id, { title: '🌙 Thông báo trong giờ yên lặng', body: `Có ${u.pend_dem} thông báo mới, bấm để xem việc của bạn`, url: openUrl('page:cv_v'), tag: 'ailla-dem' });
      u.pend_dem = 0;
    }
    if (u.pend_duyet > 0 && (!u.last_duyet_at || now - Date.parse(u.last_duyet_at) >= 3_600_000)) {
      await sendToUser(env, u.user_id, { title: TITLE.duyet, body: `Có thêm ${u.pend_duyet} việc chờ bạn duyệt`, url: openUrl('cvrv'), tag: 'ailla-duyet' }, false);
      u.pend_duyet = 0;
      u.last_duyet_at = new Date(now).toISOString();
    }
    await saveCounts(env.DB, u);
  }
  await env.DB.prepare('DELETE FROM push_sent WHERE at < ?').bind(new Date(now - 3 * 86_400_000).toISOString()).run();
}

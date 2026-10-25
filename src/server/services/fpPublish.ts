import { pack, unpack } from '../lib/pack';
import { openKey } from './poscake';

/**
 * Đăng bài Fanpage tự động (chạy từ cron mỗi giờ, hoặc CEO bấm "Đăng thử ngay").
 * Chỉ đăng bài người đã duyệt (step = 'dang'), đã chọn page, đã có ngày và giờ, chưa đăng.
 * Công tắc chung app_kv 'fp_publish': off = không đăng gì, test = chỉ đăng page thử, on = đăng mọi page đã nối.
 * Chống đăng đôi: trước khi gọi Facebook, bài được ghi dấu fbState = 'sending'; sau khi gọi mới ghi kết quả.
 * Nếu giữa chừng bị ngắt, bài kẹt ở 'sending' và KHÔNG tự đăng lại, người xem rồi quyết.
 */
export type PublishMode = 'off' | 'test' | 'on';
export const GRAPH = 'https://graph.facebook.com/v21.0';
const LATE_HOURS = 6;
const MAX_PER_RUN = 5;

export interface FpCard {
  id: string;
  kenh?: string;
  step?: string;
  day?: number;
  thang?: string;
  pageId?: string;
  gio?: string; // "HH:00"
  dangVideo?: string;
  hookText?: string;
  noiDung?: string;
  cta?: string;
  linkLanding?: string;
  mediaUrl?: string;
  fbState?: string; // sending | ok | error
  fbPostId?: string;
  fbLoi?: string;
  linkDang?: string;
  ngayDang?: number;
  history?: unknown[];
}
interface HubData { cards?: FpCard[]; settings?: { today?: number } }
export interface PageRow { page_id: string; name: string; token: string; is_test: number; active: number }

export const vnNow = (now: Date) => new Date(now.getTime() + 7 * 3600 * 1000);

/** Bài tới giờ đăng: đã duyệt, có page + giờ, đúng ngày hôm nay (giờ VN), giờ đã qua nhưng chưa quá LATE_HOURS. */
export function pickDue(cards: FpCard[], now: Date): FpCard[] {
  const vn = vnNow(now);
  const monthKey = `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
  const today = vn.getUTCDate();
  const minutes = vn.getUTCHours() * 60 + vn.getUTCMinutes();
  return cards
    .filter((c) => {
      if (c.step !== 'dang' || !c.pageId || !c.gio || c.fbPostId || c.fbState) return false;
      if (+(c.day ?? 0) !== today) return false;
      if (c.thang && c.thang !== monthKey) return false;
      const m = /^(\d{1,2}):(\d{2})$/.exec(c.gio);
      if (!m) return false;
      const slot = +m[1] * 60 + +m[2];
      return minutes >= slot && minutes - slot <= LATE_HOURS * 60;
    })
    .sort((a, b) => String(a.gio).localeCompare(String(b.gio)))
    .slice(0, MAX_PER_RUN);
}

export function buildPost(c: FpCard): { path: string; params: Record<string, string> } {
  const message = [c.noiDung ?? c.hookText ?? '', c.cta ?? ''].map((s) => s.trim()).filter(Boolean).join('\n\n');
  const media = (c.mediaUrl ?? '').trim();
  const isVideo = /video/i.test(c.dangVideo ?? '');
  if (isVideo && media) return { path: 'videos', params: { file_url: media, description: message } };
  if (media) return { path: 'photos', params: { url: media, caption: message } };
  const params: Record<string, string> = { message };
  if ((c.linkLanding ?? '').trim()) params.link = c.linkLanding!.trim();
  return { path: 'feed', params };
}

async function readHub(db: D1Database) {
  const row = await db.prepare("SELECT version, data FROM hub_state WHERE id = 'main'").first<{ version: number; data: string }>();
  if (!row) return null;
  return { version: row.version, d: JSON.parse(await unpack(row.data)) as HubData };
}

/** Sửa các trường của một bài trong dữ liệu chung; ghi theo số phiên bản, có người sửa trước thì đọc lại làm lại. */
export async function patchCard(db: D1Database, id: string, patch: (c: FpCard, today: number) => void): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await readHub(db);
    if (!cur) return false;
    const c = (cur.d.cards ?? []).find((x) => x.id === id);
    if (!c) return false;
    patch(c, cur.d.settings?.today ?? vnNow(new Date()).getUTCDate());
    const res = await db
      .prepare("UPDATE hub_state SET version = version + 1, data = ?, updated_at = ? WHERE id = 'main' AND version = ?")
      .bind(await pack(JSON.stringify(cur.d)), new Date().toISOString(), cur.version)
      .run();
    if (res.meta.changes) return true;
  }
  return false;
}

export async function getMode(db: D1Database): Promise<PublishMode> {
  const r = await db.prepare("SELECT v FROM app_kv WHERE k = 'fp_publish'").first<{ v: string }>();
  return r?.v === 'on' || r?.v === 'test' ? r.v : 'off';
}
export async function setMode(db: D1Database, mode: PublishMode): Promise<void> {
  await db
    .prepare("INSERT INTO app_kv (k, v, updated_at) VALUES ('fp_publish', ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at")
    .bind(mode, new Date().toISOString())
    .run();
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** Đăng một bài. Trả kết quả ngắn gọn; không bao giờ ném lỗi ra ngoài. */
export async function publishCard(
  db: D1Database, secret: string | undefined, card: FpCard, mode: PublishMode, fetchFn: FetchFn,
): Promise<{ ok: boolean; detail: string }> {
  const now = new Date().toISOString();
  const log = (status: string, page: string, post: string | null, err: string | null) =>
    db.prepare('INSERT INTO fp_publish_log (card_id, page_id, status, fb_post_id, error, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(card.id, page, status, post, err, now).run();
  const fail = async (msg: string) => {
    await patchCard(db, card.id, (c) => { c.fbState = 'error'; c.fbLoi = msg.slice(0, 300); });
    await log('error', card.pageId ?? '', null, msg.slice(0, 500));
    return { ok: false, detail: msg };
  };
  if (mode === 'off') return { ok: false, detail: 'Đăng tự động đang tắt' };
  const page = await db.prepare('SELECT * FROM fp_pages WHERE page_id = ? AND active = 1').bind(card.pageId ?? '').first<PageRow>();
  if (!page) return fail('Page chưa nối hoặc đã tắt');
  if (mode === 'test' && !page.is_test) return { ok: false, detail: 'Đang ở chế độ chỉ đăng page thử, bài này thuộc page thật nên chưa đăng' };
  const post = buildPost(card);
  if (post.path === 'feed' && !post.params.message) return fail('Bài chưa có nội dung');

  // Ghi dấu "đang gửi" trước khi gọi Facebook để không bao giờ đăng đôi.
  let claimed = false;
  const okClaim = await patchCard(db, card.id, (c) => {
    if (c.step === 'dang' && !c.fbState && !c.fbPostId) { c.fbState = 'sending'; claimed = true; }
  });
  if (!okClaim || !claimed) return { ok: false, detail: 'Bài không còn ở trạng thái chờ đăng' };

  try {
    const token = await openKey(page.token, secret);
    const body = new URLSearchParams({ ...post.params, access_token: token });
    const res = await fetchFn(`${GRAPH}/${page.page_id}/${post.path}`, { method: 'POST', body });
    const j = (await res.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { message?: string } };
    if (!res.ok || j.error) return fail(j.error?.message ?? `Facebook trả lỗi ${res.status}`);
    const fbId = j.post_id ?? j.id ?? '';
    const link = fbId ? `https://www.facebook.com/${fbId}` : '';
    await patchCard(db, card.id, (c, today) => {
      c.fbState = 'ok'; c.fbPostId = fbId || 'ok'; c.linkDang = link; c.step = 'xong'; c.ngayDang = today;
      c.history = (c.history ?? []).concat({ t: new Date().toLocaleString('vi-VN'), who: 'Đăng tự động', to: 'xong' });
    });
    await log('ok', page.page_id, fbId, null);
    return { ok: true, detail: link };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

/** Cron: đăng các bài tới giờ. */
export async function publishDue(db: D1Database, secret: string | undefined, fetchFn: FetchFn, now: Date = new Date()): Promise<Record<string, unknown>> {
  const mode = await getMode(db);
  if (mode === 'off') return { skipped: 'đăng tự động đang tắt' };
  const cur = await readHub(db);
  if (!cur) return { skipped: 'chưa có dữ liệu' };
  // Page không có mã trên web (agent trên VPS giữ mã) thì để agent tự lấy bài qua /api/fp/due.
  const own = await db.prepare("SELECT page_id FROM fp_pages WHERE active = 1 AND token <> ''").all<{ page_id: string }>();
  const ownIds = new Set((own.results ?? []).map((r) => r.page_id));
  const due = pickDue((cur.d.cards ?? []).filter((c) => ownIds.has(c.pageId ?? '')), now);
  let ok = 0;
  let bad = 0;
  for (const c of due) {
    const r = await publishCard(db, secret, c, mode, fetchFn);
    if (r.ok) ok++;
    else bad++;
  }
  return { due: due.length, ok, bad };
}

/**
 * Agent Fanpage trên VPS (giữ mã các page) hỏi: bài nào tới giờ đăng?
 * Mỗi bài được "nhận" (đánh dấu đang gửi) ngay lúc trả về, nên hỏi lại không bị đăng đôi.
 * Chế độ test: chỉ trả bài của page thử. Chế độ off: không trả gì.
 */
export async function claimDueForAgent(db: D1Database, now: Date = new Date()) {
  const mode = await getMode(db);
  if (mode === 'off') return { mode, posts: [] };
  const cur = await readHub(db);
  if (!cur) return { mode, posts: [] };
  const pages = await db.prepare("SELECT page_id, name, is_test FROM fp_pages WHERE active = 1 AND token = ''").all<{ page_id: string; name: string; is_test: number }>();
  const byId = new Map((pages.results ?? []).map((p) => [p.page_id, p]));
  const eligible = (cur.d.cards ?? []).filter((c) => {
    const p = byId.get(c.pageId ?? '');
    return !!p && (mode === 'on' || !!p.is_test);
  });
  const posts: Array<Record<string, unknown>> = [];
  for (const c of pickDue(eligible, now)) {
    let claimed = false;
    await patchCard(db, c.id, (x) => {
      if (x.step === 'dang' && !x.fbState && !x.fbPostId) {
        x.fbState = 'sending';
        claimed = true;
      }
    });
    if (!claimed) continue;
    const post = buildPost(c);
    posts.push({ card_id: c.id, page_id: c.pageId, page_name: byId.get(c.pageId ?? '')?.name, kind: post.path, ...post.params });
  }
  return { mode, posts };
}

/** Agent báo kết quả đăng một bài. */
export async function agentDone(db: D1Database, body: { card_id?: string; ok?: boolean; fb_post_id?: string; error?: string }) {
  const id = String(body.card_id ?? '');
  const now = new Date().toISOString();
  let page = '';
  const found = await patchCard(db, id, (c, today) => {
    page = c.pageId ?? '';
    if (body.ok) {
      const fb = String(body.fb_post_id ?? '');
      c.fbState = 'ok';
      c.fbPostId = fb || 'ok';
      c.linkDang = fb ? `https://www.facebook.com/${fb}` : (c.linkDang ?? '');
      c.step = 'xong';
      c.ngayDang = today;
      c.history = (c.history ?? []).concat({ t: new Date().toLocaleString('vi-VN'), who: 'Agent Fanpage', to: 'xong' });
    } else {
      c.fbState = 'error';
      c.fbLoi = String(body.error ?? 'Agent báo lỗi').slice(0, 300);
    }
  });
  if (found) {
    await db
      .prepare('INSERT INTO fp_publish_log (card_id, page_id, status, fb_post_id, error, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, page, body.ok ? 'ok' : 'error', body.ok ? String(body.fb_post_id ?? '') : null, body.ok ? null : String(body.error ?? '').slice(0, 500), now)
      .run();
  }
  return found;
}

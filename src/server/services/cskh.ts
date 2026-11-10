/**
 * CSKH khách lẻ (chị Hoa duyệt demo 10/11/2026): phần máy chủ.
 * - Kéo đơn GIAO THÀNH CÔNG của cửa hàng Facebook trên Poscake (mã khóa kênh FACEBOOK đã nối sẵn), gom khách theo số điện thoại.
 * - Mỗi sáng 7h kéo 3 ngày gần nhất; mỗi 15 phút kéo bù dần về ngày bắt đầu CSKH chọn ở Cài đặt.
 * - Khách mới (đơn đầu trong 14 ngày) được chia tự động nếu Cài đặt để "Web tự chia".
 * - Đơn CSKH tạo trên web gửi sang Poscake ở trạng thái Mới (sale / kho vẫn xác nhận trên Poscake như đơn thường).
 */
import { nowIso, vnDate } from '@shared/datetime';
import {
  CSKH_DEFAULTS,
  POS_DELIVERED,
  addDays,
  diffDays,
  mergeSettings,
  parsePosOrder,
  pickOwners,
  type CskhSettings,
  type ParsedOrder,
} from '@shared/cskh';
import type { AuthContext } from '../env';
import { unpack } from '../lib/pack';
import { API, loadSource, openKey, poscakeFrom, vnBounds, type FetchFn } from './poscake';

export type PostFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

/* ------------------------------------------------------------------ cài đặt */
export async function getSetting<T>(db: D1Database, k: string): Promise<T | null> {
  const r = await db.prepare('SELECT v FROM cskh_settings WHERE k = ?').bind(k).first<{ v: string }>();
  if (!r) return null;
  try {
    return JSON.parse(r.v) as T;
  } catch {
    return null;
  }
}
export async function putSetting(db: D1Database, k: string, v: unknown): Promise<void> {
  await db
    .prepare('INSERT INTO cskh_settings (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at')
    .bind(k, JSON.stringify(v), nowIso())
    .run();
}
export async function loadSettings(db: D1Database): Promise<CskhSettings> {
  const s = mergeSettings(await getSetting<Partial<CskhSettings>>(db, 'cfg'));
  return s;
}

/* ------------------------------------------------------------------ ai là CSKH, ai là Lead */
type HubUser = { id?: string; crm?: string; perms?: string[]; role?: string; active?: boolean; name?: string; phongBan?: string };
export interface CskhPerson {
  id: string; // users.id (tài khoản đăng nhập)
  name: string;
  lead: boolean;
}
const SALE_DEPTS = ['CSKH', 'B2C'];
async function hubUsers(db: D1Database): Promise<HubUser[]> {
  try {
    const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
    return row ? ((JSON.parse(await unpack(row.data)) as { users?: HubUser[] }).users ?? []) : [];
  } catch {
    return [];
  }
}
const isLeadUser = (u: HubUser) =>
  u.role === 'admin' || (u.perms ?? []).includes('cskh.quanly') || (SALE_DEPTS.includes(u.phongBan ?? '') && ['lead', 'truongphong'].includes(u.role ?? ''));
const isStaffUser = (u: HubUser) => SALE_DEPTS.includes(u.phongBan ?? '') || (u.perms ?? []).includes('cskh.lam') || (u.perms ?? []).includes('cskh.quanly');

/** Người chăm khách được: phòng CSKH / Sale Kênh bán lẻ, hoặc được cấp quyền CSKH khách lẻ. */
export async function cskhStaff(db: D1Database): Promise<CskhPerson[]> {
  const U = await hubUsers(db);
  return U.filter((u) => u.active !== false && u.crm && u.role !== 'admin' && isStaffUser(u)).map((u) => ({ id: String(u.crm), name: String(u.name ?? ''), lead: isLeadUser(u) }));
}
export interface CskhMe {
  id: string;
  name: string;
  lead: boolean; // Lead Sale / CEO: thấy mọi khách, chia khách, báo cáo, cài đặt
  staff: boolean; // được chăm khách
}
export async function cskhMe(db: D1Database, auth: AuthContext): Promise<CskhMe> {
  const me = (await hubUsers(db)).find((u) => u.crm && u.crm === auth.user.id);
  const ceo = auth.user.role === 'CEO';
  return {
    id: auth.user.id,
    name: String(me?.name ?? auth.user.display_name ?? ''),
    lead: ceo || (!!me && isLeadUser(me)),
    staff: !!me && isStaffUser(me),
  };
}

/* ------------------------------------------------------------------ kéo đơn Poscake */
async function openFacebook(db: D1Database, secret: string | undefined): Promise<{ shop: string; key: string }> {
  const src = await loadSource(db, 'FACEBOOK');
  if (!src) throw new Error('Chưa nối Poscake cho kênh Facebook');
  return { shop: src.shop_id, key: await openKey(src.api_key, secret) };
}
async function sourceNames(fetchFn: FetchFn, shop: string, key: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const r = await fetchFn(`${API}/shops/${encodeURIComponent(shop)}/order_source?api_key=${encodeURIComponent(key)}`);
    if (r.ok) {
      const j = JSON.parse(await r.text()) as { data?: Array<{ id?: string | number; custom_id?: string; name?: string }> };
      for (const x of j.data ?? []) {
        const nm = String(x.name ?? '').trim();
        if (!nm) continue;
        out[String(x.id)] = nm;
        if (x.custom_id) out[String(x.custom_id)] = nm;
      }
    }
  } catch {
    /* không có tên nguồn thì ghi theo mã */
  }
  return out;
}

/** Đơn giao thành công trong một ngày (theo giờ đổi sang "Đã nhận"). */
export async function fetchDeliveredDay(fetchFn: FetchFn, shop: string, key: string, day: string, src: Record<string, string>): Promise<ParsedOrder[]> {
  const { start, end } = vnBounds(day);
  const out = new Map<string, ParsedOrder>();
  let page = 1;
  let total = 1;
  do {
    const url =
      `${API}/shops/${encodeURIComponent(shop)}/orders?api_key=${encodeURIComponent(key)}` +
      `&updateStatus=${POS_DELIVERED}&startDateTime=${Math.floor(start / 1000)}&endDateTime=${Math.floor(end / 1000) - 1}&page_size=100&page_number=${page}`;
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`Poscake trả lỗi ${res.status}`);
    const json = JSON.parse(await res.text()) as { success?: boolean; total_pages?: number; data?: Array<Record<string, unknown>> };
    if (json.success === false) throw new Error('Poscake báo lỗi, kiểm tra mã API cửa hàng Facebook');
    total = json.total_pages || 1;
    for (const raw of json.data ?? []) {
      if (Number(raw.status) !== POS_DELIVERED) continue;
      const p = parsePosOrder(raw, src);
      if (p && p.items.length) out.set(p.id, p);
    }
    page += 1;
  } while (page <= total && page <= 40);
  return [...out.values()];
}

const chunk = <T>(a: T[], k: number): T[][] => {
  const r: T[][] = [];
  for (let i = 0; i < a.length; i += k) r.push(a.slice(i, i + k));
  return r;
};

/** Cập nhật tổng số đơn / tiền / ngày mua của các khách từ bảng đơn. */
export async function refreshAggregates(db: D1Database, phones: string[]): Promise<void> {
  for (const part of chunk([...new Set(phones)], 80)) {
    const q = part.map(() => '?').join(',');
    const agg = await db
      .prepare(`SELECT phone, COUNT(*) AS n, SUM(total) AS t, MIN(day) AS f, MAX(day) AS l FROM cskh_orders WHERE phone IN (${q}) GROUP BY phone`)
      .bind(...part)
      .all<{ phone: string; n: number; t: number; f: string; l: string }>();
    const lastItems = await db
      .prepare(`SELECT phone, items FROM cskh_orders o WHERE phone IN (${q}) AND day = (SELECT MAX(day) FROM cskh_orders x WHERE x.phone = o.phone)`)
      .bind(...part)
      .all<{ phone: string; items: string }>();
    const lp = new Map<string, string>();
    for (const r of lastItems.results ?? []) {
      try {
        const it = JSON.parse(r.items) as Array<{ n: string; p: number }>;
        const top = it.slice().sort((a, b) => b.p - a.p)[0];
        if (top && !lp.has(r.phone)) lp.set(r.phone, top.n);
      } catch {
        /* bỏ qua */
      }
    }
    const now = nowIso();
    const st = (agg.results ?? []).map((r) =>
      db
        .prepare('UPDATE cskh_customers SET order_count = ?, total_spent = ?, first_order_day = ?, last_order_day = ?, last_product = ?, updated_at = ? WHERE phone = ?')
        .bind(r.n, r.t ?? 0, r.f, r.l, lp.get(r.phone) ?? '', now, r.phone),
    );
    if (st.length) await db.batch(st);
  }
}

/** Ghi đơn vào sổ, tạo khách mới, chia khách mới (đơn đầu trong 14 ngày) nếu đang để web tự chia. */
export async function ingestOrders(db: D1Database, orders: ParsedOrder[], today = vnDate()): Promise<{ orders: number; newCustomers: number; assigned: number }> {
  if (!orders.length) return { orders: 0, newCustomers: 0, assigned: 0 };
  const now = nowIso();
  const st = orders.map((p) =>
    db
      .prepare(
        `INSERT INTO cskh_orders (id, phone, day, created_day, items, total, source, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET phone = excluded.phone, day = excluded.day, created_day = excluded.created_day, items = excluded.items,
           total = excluded.total, source = excluded.source, synced_at = excluded.synced_at`,
      )
      .bind(p.id, p.phone, p.day, p.createdDay, JSON.stringify(p.items), p.total, p.source, now),
  );
  for (const part of chunk(st, 50)) await db.batch(part);

  // Khách: tạo mới nếu chưa có; khách đã có thì chỉ điền ô còn trống (không ghi đè hồ sơ CSKH đã sửa).
  const byPhone = new Map<string, ParsedOrder>();
  for (const p of orders.slice().sort((a, b) => a.day.localeCompare(b.day))) byPhone.set(p.phone, p); // giữ đơn mới nhất
  const phones = [...byPhone.keys()];
  const existing = new Set<string>();
  for (const part of chunk(phones, 90)) {
    const r = await db.prepare(`SELECT phone FROM cskh_customers WHERE phone IN (${part.map(() => '?').join(',')})`).bind(...part).all<{ phone: string }>();
    for (const x of r.results ?? []) existing.add(x.phone);
  }
  const firstSrc = new Map<string, string>();
  for (const p of orders.slice().sort((a, b) => b.day.localeCompare(a.day))) if (p.source) firstSrc.set(p.phone, p.source);
  const ins = phones.map((ph) => {
    const p = byPhone.get(ph)!;
    if (!existing.has(ph))
      return db
        .prepare(
          `INSERT INTO cskh_customers (phone, name, addr_street, addr_ward, addr_district, addr_province, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (phone) DO NOTHING`,
        )
        .bind(ph, p.name, p.street, p.ward, p.district, p.province, firstSrc.get(ph) ?? p.source, now, now);
    return db
      .prepare(
        `UPDATE cskh_customers SET name = CASE WHEN name = '' THEN ? ELSE name END,
           addr_street = CASE WHEN addr_street = '' AND addr_province = '' THEN ? ELSE addr_street END,
           addr_ward = CASE WHEN addr_street = '' AND addr_province = '' THEN ? ELSE addr_ward END,
           addr_district = CASE WHEN addr_street = '' AND addr_province = '' THEN ? ELSE addr_district END,
           addr_province = CASE WHEN addr_street = '' AND addr_province = '' THEN ? ELSE addr_province END,
           source = CASE WHEN source = '' THEN ? ELSE source END, updated_at = ? WHERE phone = ?`,
      )
      .bind(p.name, p.street, p.ward, p.district, p.province, p.source, now, ph);
  });
  for (const part of chunk(ins, 50)) await db.batch(part);
  await refreshAggregates(db, phones);
  const assigned = await autoAssign(db, today);
  return { orders: orders.length, newCustomers: phones.length - existing.size, assigned };
}

/** Chia khách mới chưa có người chăm (đơn đầu trong 14 ngày gần đây) khi Cài đặt để "Web tự chia". */
export async function autoAssign(db: D1Database, today = vnDate()): Promise<number> {
  const set = await loadSettings(db);
  if (set.chia !== 'auto') return 0;
  const rows = await db
    .prepare('SELECT phone, owner_prev, last_order_day FROM cskh_customers WHERE owner_id IS NULL AND manual = 0 AND length(stop_reason) = 0 AND first_order_day >= ? ORDER BY first_order_day')
    .bind(addDays(today, -14))
    .all<{ phone: string; owner_prev: string | null; last_order_day: string }>();
  const list = rows.results ?? [];
  if (!list.length) return 0;
  return assignTo(db, list.map((r) => ({ phone: r.phone, prev: r.owner_prev, day: r.last_order_day })), set, today);
}

export async function assignTo(db: D1Database, list: Array<{ phone: string; prev: string | null; day?: string | null }>, set: CskhSettings, today = vnDate(), fixed?: Record<string, string>): Promise<number> {
  const staff = await cskhStaff(db);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  let pick: Record<string, string>;
  if (fixed) pick = fixed;
  else {
    const load: Record<string, number> = {};
    const r = await db.prepare('SELECT owner_id, COUNT(*) AS n FROM cskh_customers WHERE owner_id IS NOT NULL AND assigned_at >= ? GROUP BY owner_id').bind(addDays(today, -30)).all<{ owner_id: string; n: number }>();
    for (const x of r.results ?? []) load[x.owner_id] = x.n;
    pick = pickOwners(list, staff.map((s) => s.id), set, load);
  }
  const now = nowIso();
  const st = list
    .filter((c) => pick[c.phone])
    .map((c) => {
      // Khách mới (đơn đầu vừa giao): hẹn gọi lần đầu sau N ngày giao; khách cũ chia lại thì không đặt hẹn (vào mục Đến kỳ mua lại).
      const first = c.day && diffDays(today, c.day) <= 14 ? addDays(c.day, set.firstCallDays) : null;
      return db
        .prepare(
          `UPDATE cskh_customers SET owner_prev = CASE WHEN owner_id IS NOT NULL AND owner_id <> ? THEN owner_id ELSE owner_prev END,
             owner_id = ?, owner_name = ?, assigned_at = ?, next_call = COALESCE(next_call, ?), updated_at = ? WHERE phone = ?`,
        )
        .bind(pick[c.phone], pick[c.phone], names.get(pick[c.phone]) ?? '', now, first, now, c.phone);
    });
  for (const part of chunk(st, 50)) await db.batch(part);
  return st.length;
}

export async function syncCskhDays(db: D1Database, secret: string | undefined, days: string[], fetchFn: FetchFn): Promise<Array<{ day: string; ok: boolean; note: string }>> {
  const { shop, key } = await openFacebook(db, secret);
  const src = await sourceNames(fetchFn, shop, key);
  const out: Array<{ day: string; ok: boolean; note: string }> = [];
  for (const day of days) {
    try {
      const orders = await fetchDeliveredDay(fetchFn, shop, key, day, src);
      const r = await ingestOrders(db, orders);
      out.push({ day, ok: true, note: `${r.orders} đơn, ${r.newCustomers} khách mới, chia ${r.assigned}` });
    } catch (e) {
      out.push({ day, ok: false, note: e instanceof Error ? e.message : 'lỗi' });
    }
  }
  return out;
}

export interface BackfillState {
  cursor: string; // ngày sớm nhất đã kéo xong
  target: string; // kéo lùi tới ngày này
  from?: string; // khoảng Lead / CEO chọn (để hiện lại)
  to?: string;
  active?: boolean; // chỉ kéo khi Lead / CEO bấm "Bắt đầu kéo" ở Cài đặt (chị Hoa 10/11: không tự kéo dữ liệu cũ)
  at: string;
  last: string;
}
/** Lead / CEO chọn khoảng ngày và bấm kéo: máy chủ kéo lùi dần từ ngày cuối về ngày đầu, mỗi 15 phút vài ngày. */
export async function startBackfill(db: D1Database, from: string, to: string): Promise<BackfillState> {
  const minFb = await poscakeFrom(db, 'FACEBOOK');
  const target = minFb && from < minFb ? minFb : from;
  const st: BackfillState = { cursor: addDays(to, 1), target, from, to, active: true, at: nowIso(), last: '' };
  await putSetting(db, 'backfill', st);
  return st;
}
export async function stopBackfill(db: D1Database): Promise<void> {
  const st = await getSetting<BackfillState>(db, 'backfill');
  if (st) await putSetting(db, 'backfill', { ...st, active: false });
}
/** Một bước kéo (cron mỗi 15 phút, hoặc ngay khi bấm). Không có việc kéo đang bật thì không làm gì. */
export async function backfillStep(db: D1Database, secret: string | undefined, fetchFn: FetchFn, maxDays = 4): Promise<{ done: number; remaining: number; note: string }> {
  const st = await getSetting<BackfillState>(db, 'backfill');
  if (!st || !st.active) return { done: 0, remaining: 0, note: 'không có việc kéo' };
  const target = st.target;
  if (st.cursor <= target) {
    await putSetting(db, 'backfill', { ...st, active: false });
    return { done: 0, remaining: 0, note: 'đã kéo đủ' };
  }
  const days: string[] = [];
  for (let d = addDays(st.cursor, -1); d >= target && days.length < maxDays; d = addDays(d, -1)) days.push(d);
  const res = await syncCskhDays(db, secret, days, fetchFn);
  let cursor = st.cursor;
  for (const r of res) {
    if (!r.ok) break;
    cursor = r.day;
  }
  const latest = await getSetting<BackfillState>(db, 'backfill'); // có thể đã bấm Dừng trong lúc kéo
  await putSetting(db, 'backfill', { ...st, cursor, active: (latest?.active ?? true) && cursor > target, at: nowIso(), last: res.map((r) => `${r.day}: ${r.note}`).join(' · ') });
  return { done: res.filter((r) => r.ok).length, remaining: Math.max(0, diffDays(cursor, target)), note: res.map((r) => `${r.day}: ${r.note}`).join(' · ') };
}

/* ------------------------------------------------------------------ trạng thái đơn CSKH trên Poscake */
/** Mã trạng thái đơn Poscake → chữ. 3 Đã nhận (giao thành công), 5 Đã hoàn, 6 Đã hủy, 7 Đã xóa là đã xong, không hỏi lại. */
export const POS_STATUS: Record<number, string> = {
  0: 'Mới', 17: 'Chờ xác nhận', 1: 'Đã xác nhận', 11: 'Chờ hàng', 20: 'Đã đặt hàng', 12: 'Chờ in', 13: 'Đã in', 8: 'Đang đóng hàng', 9: 'Chờ chuyển hàng',
  2: 'Đã gửi hàng', 3: 'Giao thành công', 16: 'Đã thu tiền', 4: 'Đang hoàn', 15: 'Hoàn một phần', 5: 'Đã hoàn', 6: 'Đã hủy', 7: 'Đã xóa',
};
const POS_FINAL = new Set([3, 5, 6, 7, 16]);
export type PosStatusMap = Record<string, { s: number; at: string; code?: string; carrier?: string }>;
export async function posStatuses(db: D1Database, secret: string | undefined, fetchFn: FetchFn, ids: string[]): Promise<PosStatusMap> {
  const cache = (await getSetting<PosStatusMap>(db, 'pos_status3')) ?? {};
  const now = Date.now();
  const stale = [...new Set(ids)].filter((id) => {
    const x = cache[id];
    return !x || (!POS_FINAL.has(x.s) && now - Date.parse(x.at) > 10 * 60_000);
  }).slice(0, 30);
  if (stale.length) {
    try {
      const { shop, key } = await openFacebook(db, secret);
      const got = await Promise.all(
        stale.map(async (id) => {
          try {
            const r = await fetchFn(`${API}/shops/${encodeURIComponent(shop)}/orders/${encodeURIComponent(id)}?api_key=${encodeURIComponent(key)}`);
            if (!r.ok) return null;
            const j = JSON.parse(await r.text()) as { data?: Record<string, unknown> & { status?: number } };
            // Chẩn đoán (10/11): xem Poscake ghi người tạo / thẻ / nguồn của đơn CSKH thế nào (chỉ tên trường, mã, tên nhân viên).
            const d = j.data ?? {};
            console.info('[cskh] don poscake', id, JSON.stringify({ tags: d.tags, creator: d.creator, assigning_seller: d.assigning_seller, assigning_care: d.assigning_care, assigning_seller_id: d.assigning_seller_id, assigning_care_id: d.assigning_care_id, order_sources: d.order_sources, order_sources_name: d.order_sources_name, account: d.account, keys: Object.keys(d).slice(0, 120) }).slice(0, 3000));
            const st = Number(j.data?.status);
            const pt = (d.partner ?? {}) as Record<string, unknown>;
            const code = String(pt.extend_code ?? pt.partner_order_id ?? pt.order_number_vtp ?? d.tracking_code ?? '').trim();
            const carrier = String(pt.partner_name ?? (pt.partner_id !== undefined ? 'ĐVVC ' + pt.partner_id : '')).trim();
            console.info('[cskh] partner', id, JSON.stringify(pt).slice(0, 1500));
            return Number.isFinite(st) ? ([id, st, code, carrier] as const) : null;
          } catch {
            return null;
          }
        }),
      );
      const at = new Date().toISOString();
      for (const g of got) if (g) cache[g[0]] = { s: g[1], at, code: g[2], carrier: g[3] };
      await putSetting(db, 'pos_status3', cache);
    } catch {
      /* không hỏi được Poscake thì dùng số cũ */
    }
  }
  return cache;
}

/* ------------------------------------------------------------------ sản phẩm để lên đơn */
export interface CskhVariation {
  id: string;
  name: string;
  price: number;
}
export async function loadVariations(db: D1Database, secret: string | undefined, fetchFn: FetchFn, force = false): Promise<{ list: CskhVariation[]; at: string; error?: string }> {
  const cached = await getSetting<{ list: CskhVariation[]; at: string }>(db, 'variations');
  if (cached && !force && Date.now() - Date.parse(cached.at) < 86_400_000) return cached;
  try {
    const { shop, key } = await openFacebook(db, secret);
    const list: CskhVariation[] = [];
    for (let page = 1; page <= 10; page++) {
      const r = await fetchFn(`${API}/shops/${encodeURIComponent(shop)}/products/variations?api_key=${encodeURIComponent(key)}&page_size=100&page_number=${page}`);
      if (!r.ok) throw new Error(`Poscake trả lỗi ${r.status}`);
      const j = JSON.parse(await r.text()) as { data?: Array<Record<string, unknown>>; total_pages?: number };
      for (const v of j.data ?? []) {
        if (v.is_hidden || v.is_removed) continue;
        const prod = (v.product ?? {}) as Record<string, unknown>;
        const fields = Array.isArray(v.fields) ? (v.fields as Array<{ value?: string }>).map((f) => String(f.value ?? '')).filter(Boolean).join(' ') : '';
        const name = [String(v.name ?? prod.name ?? '').trim(), fields].filter(Boolean).join(' - ');
        if (!name || !v.id) continue;
        list.push({ id: String(v.id), name, price: Number(v.retail_price) || 0 });
      }
      if (page >= (j.total_pages || 1)) break;
    }
    if (!list.length) throw new Error('Poscake không trả sản phẩm');
    const out = { list: list.sort((a, b) => a.name.localeCompare(b.name, 'vi')), at: nowIso() };
    await putSetting(db, 'variations', out);
    return out;
  } catch (e) {
    // Không lấy được danh mục Poscake: dùng tên sản phẩm trong đơn đã giao (giá bình quân), đơn tạo ra sẽ chờ lên tay ở Poscake.
    const r = await db.prepare("SELECT items FROM cskh_orders WHERE day >= ? LIMIT 3000").bind(addDays(vnDate(), -90)).all<{ items: string }>();
    const agg = new Map<string, { q: number; p: number }>();
    for (const x of r.results ?? []) {
      try {
        for (const it of JSON.parse(x.items) as Array<{ n: string; q: number; p: number }>) {
          const a = agg.get(it.n) ?? { q: 0, p: 0 };
          a.q += it.q;
          a.p += it.p;
          agg.set(it.n, a);
        }
      } catch {
        /* bỏ qua */
      }
    }
    const list = [...agg.entries()].map(([name, a]) => ({ id: '', name, price: a.q ? Math.round(a.p / a.q / 1000) * 1000 : 0 })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return { list: cached?.list?.length ? cached.list : list, at: cached?.at ?? '', error: e instanceof Error ? e.message : 'lỗi' };
  }
}

/** Gửi đơn sang Poscake (trạng thái Mới). Trả mã đơn Poscake hoặc lỗi. */
export async function sendOrderToPoscake(
  db: D1Database,
  secret: string | undefined,
  postFn: PostFn,
  od: { recv_name: string; recv_phone: string; recv_addr: string; items: Array<{ vid: string; q: number; price: number; n: string }>; ship: number; discount: number; note: string; note_print?: string; paid?: number; payment: string; ref: string },
): Promise<{ pos_id: string | null; error: string }> {
  if (od.items.some((i) => !i.vid)) return { pos_id: null, error: 'Có sản phẩm chưa khớp mã trên Poscake, cần lên đơn tay' };
  try {
    const { shop, key } = await openFacebook(db, secret);
    const body = {
      bill_full_name: od.recv_name,
      bill_phone_number: od.recv_phone,
      shipping_address: { full_name: od.recv_name, phone_number: od.recv_phone, address: od.recv_addr, full_address: od.recv_addr },
      items: od.items.map((i) => ({ variation_id: i.vid, quantity: i.q })),
      shipping_fee: od.ship,
      total_discount: od.discount,
      note: [`CSKH ${od.ref}`, od.paid ? `Khách đã chuyển khoản ${od.paid}` : '', od.note].filter(Boolean).join(' · '),
      note_print: od.note_print ?? '',
      transfer_money: od.paid ?? 0,
      is_free_shipping: od.ship === 0,
    };
    const r = await postFn(`${API}/shops/${encodeURIComponent(shop)}/orders?api_key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let j: { success?: boolean; data?: { id?: string | number; system_id?: string | number }; message?: string } = {};
    try {
      j = JSON.parse(text);
    } catch {
      /* không phải JSON */
    }
    const id = j.data?.id ?? j.data?.system_id;
    if (!r.ok || j.success === false || !id) return { pos_id: null, error: `Poscake không nhận đơn (${r.status}${j.message ? ': ' + j.message : ''})`.slice(0, 300) };
    return { pos_id: String(id), error: '' };
  } catch (e) {
    return { pos_id: null, error: (e instanceof Error ? e.message : 'lỗi').slice(0, 300) };
  }
}

export { CSKH_DEFAULTS };

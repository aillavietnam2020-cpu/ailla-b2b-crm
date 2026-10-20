import { nowIso } from '@shared/datetime';
import { POSCAKE_FROM, saveChannelDays, type Channel, type ChannelLine } from './channelOut';

export { POSCAKE_FROM };

/**
 * Kéo đơn "đã gửi hàng" từ Poscake (Pancake POS) cho TikTok Shop và Shopee, tách combo ra hàng lẻ theo bảng
 * quy đổi, rồi ghi vào channel_out (kho trừ theo ngày bắt đầu). Cách làm giống hệt hai Sheet kế toán kho cũ.
 */
export const API = 'https://pos.pages.fm/api/v1';
const DAY_MS = 86_400_000;
const MAX_PAGES = 60;

export const POSCAKE_CHANNELS: Channel[] = ['TIKTOK', 'SHOPEE', 'FACEBOOK'];
/** Kênh được nối Poscake (Facebook nối để đối soát đơn hoàn, chưa dùng để trừ kho bán). */
export const SOURCE_CHANNELS: Channel[] = ['TIKTOK', 'SHOPEE', 'FACEBOOK'];


export async function poscakeFrom(db: D1Database, channel: string): Promise<string> {
  const r = await db.prepare('SELECT v FROM kho_cfg WHERE k = ?').bind(`poscake_from_${channel}`).first<{ v: string }>();
  return r?.v ?? POSCAKE_FROM[channel] ?? '';
}

/** Trạng thái coi là "đã rời kho". Shopee chỉ lấy "Đã gửi hàng"; TikTok lấy cả các trạng thái nhảy cóc. */
const OUT_STATUSES: Record<string, number[]> = {
  SHOPEE: [2],
  TIKTOK: [2, 3, 4, 5, 15, 16],
  FACEBOOK: [2],
};

const DEFAULT_SHOP_NAMES: Record<string, Record<string, string>> = {
  SHOPEE: { '1026269': 'Ailla Việt Nam', '1229028516': 'Ailla VN' },
};

export type FetchFn = (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export interface SourceRow {
  channel: string;
  shop_id: string;
  api_key: string;
  shop_names: string | null;
  last_sync_at: string | null;
  last_sync_note: string | null;
}

/* ------------------------------------------------------------------ mã hoá mã API */
async function aesKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`poscake:${secret}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function sealKey(plain: string, secret: string | undefined): Promise<string> {
  if (!secret) throw new Error('Máy chủ chưa có khóa mã hoá (INGEST_KEY) nên chưa lưu được mã API');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), new TextEncoder().encode(plain));
  return `gcm:${toB64(iv)}:${toB64(new Uint8Array(enc))}`;
}

export async function openKey(sealed: string, secret: string | undefined): Promise<string> {
  if (sealed.startsWith('plain:')) return sealed.slice(6);
  const [, iv, data] = sealed.split(':');
  if (!secret || !iv || !data) throw new Error('Không giải mã được mã API');
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await aesKey(secret), fromB64(data));
  return new TextDecoder().decode(dec);
}

/* ------------------------------------------------------------------ đọc dữ liệu Poscake */
export function vnBounds(day: string): { start: number; end: number } {
  const start = Date.parse(`${day}T00:00:00+07:00`);
  return { start, end: start + DAY_MS };
}

export function parseUtc(s: unknown): number | null {
  const m = String(s ?? '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? Date.parse(`${m[1]}T${m[2]}Z`) : null;
}

interface PosOrder {
  id?: string | number;
  custom_id?: string;
  system_id?: string | number;
  account?: string | number;
  page?: { name?: string };
  page_id?: string | number;
  status?: number;
  time_send_partner?: string;
  status_history?: Array<{ status?: number; updated_at?: string }>;
  items?: Array<{ quantity?: number; variation_info?: { name?: string; detail?: string } }>;
}

/** Giờ đơn rời kho. Shopee, Facebook: lần gần nhất sang "Đã gửi hàng". TikTok: lần đầu sang một trạng thái rời kho. */
function shippedAt(o: PosOrder, channel: string): number | null {
  const set = new Set(OUT_STATUSES[channel] ?? [2]);
  let t: number | null = null;
  for (const h of o.status_history ?? []) {
    if (!set.has(Number(h.status)) || !h.updated_at) continue;
    const d = parseUtc(h.updated_at);
    if (d === null) continue;
    if (t === null || (channel === 'TIKTOK' ? d < t : d > t)) t = d;
  }
  if (t === null && o.time_send_partner) t = parseUtc(o.time_send_partner);
  return t;
}

export function splitName(name: string): { sku: string; name: string } {
  const i = name.indexOf(' - ');
  if (i > 0) return { sku: name.slice(0, i).trim(), name: name.slice(i + 3).trim() };
  return { sku: name.trim(), name: name.trim() };
}

export interface FetchedLine {
  order_id: string;
  shipped_at: string;
  shop: string;
  sku: string;
  variant: string;
  name: string;
  qty: number;
}

export async function fetchShippedLines(
  fetchFn: FetchFn,
  channel: string,
  shopId: string,
  apiKey: string,
  day: string,
  shopNames: Record<string, string>,
): Promise<{ lines: FetchedLine[]; pages: number }> {
  const { start, end } = vnBounds(day);
  const startSec = Math.floor(start / 1000);
  const endSec = Math.floor(end / 1000) - 1;
  const seen = new Set<string>();
  const out: FetchedLine[] = [];
  let pagesTotal = 0;
  const srcNames: Record<string, string> = {};
  if (channel === 'FACEBOOK') {
    try {
      const r = await fetchFn(`${API}/shops/${encodeURIComponent(shopId)}/order_source?api_key=${encodeURIComponent(apiKey)}`);
      if (r.ok) {
        const j = JSON.parse(await r.text()) as { data?: Array<{ id?: string | number; custom_id?: string; name?: string }> };
        for (const s of j.data ?? []) {
          const n = String(s.name ?? '').trim();
          if (!n) continue;
          srcNames[String(s.id)] = n;
          if (s.custom_id) srcNames[String(s.custom_id)] = n;
        }
      }
    } catch {
      /* không lấy được tên nguồn thì hiện theo mã */
    }
  }
  for (const st of OUT_STATUSES[channel] ?? [2]) {
    let page = 1;
    let totalPages = 1;
    do {
      const url =
        `${API}/shops/${encodeURIComponent(shopId)}/orders?api_key=${encodeURIComponent(apiKey)}` +
        `&updateStatus=${st}&startDateTime=${startSec}&endDateTime=${endSec}&page_size=100&page_number=${page}`;
      const res = await fetchFn(url);
      if (!res.ok) throw new Error(`Poscake trả lỗi ${res.status}`);
      const json = JSON.parse(await res.text()) as { success?: boolean; total_pages?: number; data?: PosOrder[] };
      if (json.success === false) throw new Error('Poscake báo lỗi, kiểm tra lại mã API và cửa hàng');
      totalPages = json.total_pages || 1;
      pagesTotal += 1;
      for (const o of json.data ?? []) {
        const oid = String(o.custom_id || o.id || '');
        if (!oid || seen.has(oid)) continue;
        const t = shippedAt(o, channel);
        if (t === null || t < start || t >= end) continue;
        seen.add(oid);
        const acc = String(o.account ?? '');
        const shop =
          channel === 'FACEBOOK'
            ? o.page?.name?.trim()
              ? `Page: ${o.page.name.trim()}`
              : acc && srcNames[acc]
                ? `Landing: ${srcNames[acc]}`
                : o.page_id
                  ? `Page: ${o.page_id}`
                  : acc
                    ? `Nguồn ${acc}`
                    : 'Không rõ nguồn'
            : (acc && shopNames[acc]) || o.page?.name?.trim() || (acc ? `Shop ${acc}` : '');
        for (const it of o.items ?? []) {
          const v = it.variation_info ?? {};
          const sp = channel === 'FACEBOOK' ? { sku: String(v.name ?? '').trim(), name: String(v.name ?? '').trim() } : splitName(v.name ?? '');
          out.push({
            order_id: oid,
            shipped_at: new Date(t).toISOString(),
            shop,
            sku: sp.sku,
            variant: String(v.detail ?? '').trim(),
            name: sp.name,
            qty: Number(it.quantity) || 0,
          });
        }
      }
      page += 1;
    } while (page <= totalPages && page <= MAX_PAGES);
    if (totalPages > MAX_PAGES) throw new Error(`Poscake trả quá ${MAX_PAGES * 100} đơn cho một trạng thái trong ngày, không kéo để tránh thiếu đơn`);
  }
  return { lines: out, pages: pagesTotal };
}

/* ------------------------------------------------------------------ bảng quy đổi + tính số */
interface MapRow {
  sku: string;
  variant: string;
  item_label: string;
  qty: number;
}

export interface MapVersion {
  from_day: string;
  rows: MapRow[];
}

/** Bảng quy đổi theo phiên bản: mỗi (SKU, phân loại) có thể có nhiều bản, mỗi bản áp dụng từ một ngày. */
export async function loadMapVersions(db: D1Database, channel: string): Promise<Map<string, MapVersion[]>> {
  const rows = await db
    .prepare('SELECT sku, variant, from_day, item_label, qty FROM channel_map WHERE channel = ? ORDER BY from_day')
    .bind(channel)
    .all<MapRow & { from_day: string }>();
  const m = new Map<string, MapVersion[]>();
  for (const r of rows.results ?? []) {
    const k = (r.variant ? `${r.sku}|${r.variant}` : r.sku).toLowerCase();
    const vs = m.get(k) ?? [];
    let v = vs.find((x) => x.from_day === r.from_day);
    if (!v) {
      v = { from_day: r.from_day, rows: [] };
      vs.push(v);
    }
    v.rows.push(r);
    m.set(k, vs);
  }
  return m;
}

/** Cách quy đổi đang hiệu lực của một mã vào một ngày (phân loại cụ thể ưu tiên hơn "mọi loại"). */
export function pickMap(m: Map<string, MapVersion[]>, sku: string, variant: string, day: string): MapVersion | undefined {
  for (const key of [`${sku}|${variant}`.toLowerCase(), sku.toLowerCase()]) {
    const vs = m.get(key);
    if (!vs) continue;
    let best: MapVersion | undefined;
    for (const v of vs) if (v.from_day <= day) best = v;
    if (best) return best;
  }
  return undefined;
}

export function unmappedLabel(sku: string, variant: string): string {
  return `[Chưa quy đổi] ${sku}${variant ? ` / ${variant}` : ''}`;
}

/** Tính lại số hàng lẻ của một (kênh, ngày) từ dòng hàng đã kéo + bảng quy đổi hiện tại. */
export async function recomputeDay(db: D1Database, channel: Channel, day: string, source = 'POSCAKE'): Promise<{ orders: number; lines: number }> {
  const map = await loadMapVersions(db, channel);
  const rows = await db
    .prepare('SELECT order_id, sku, variant, qty FROM channel_order_lines WHERE channel = ? AND day = ?')
    .bind(channel, day)
    .all<{ order_id: string; sku: string; variant: string; qty: number }>();
  // Mã trên đơn trùng đúng mã vật tư trong kho (đơn lẻ, không phải combo) thì tự coi là 1 đổi 1.
  const codes = new Map(
    ((await db.prepare('SELECT code FROM kho_items').all<{ code: string }>()).results ?? []).map((r) => [r.code.toLowerCase(), r.code]),
  );
  const orders = new Set<string>();
  const agg = new Map<string, number>();
  for (const r of rows.results ?? []) {
    orders.add(r.order_id);
    const parts = pickMap(map, r.sku, r.variant, day)?.rows;
    const direct = codes.get(r.sku.toLowerCase());
    const items: Array<{ label: string; qty: number }> = parts
      ? parts.map((p) => ({ label: p.item_label, qty: p.qty }))
      : direct
        ? [{ label: direct, qty: 1 }]
        : [{ label: unmappedLabel(r.sku, r.variant), qty: 1 }];
    for (const p of items) {
      if (p.label.trim().toUpperCase() === 'BỎ QUA') continue;
      agg.set(p.label, (agg.get(p.label) ?? 0) + r.qty * p.qty);
    }
  }
  const lines: ChannelLine[] = [...agg].map(([label, qty]) => ({ label, qty }));
  await saveChannelDays(db, channel, [{ day, orders: orders.size, lines }], source);
  return { orders: orders.size, lines: lines.length };
}

export async function recomputeAll(db: D1Database, channel: Channel): Promise<number> {
  const days = await db
    .prepare('SELECT DISTINCT day FROM channel_order_lines WHERE channel = ? ORDER BY day')
    .bind(channel)
    .all<{ day: string }>();
  let n = 0;
  for (const d of days.results ?? []) {
    await recomputeDay(db, channel, d.day);
    n += 1;
  }
  return n;
}

/* ------------------------------------------------------------------ đồng bộ */
export async function loadSource(db: D1Database, channel: string): Promise<SourceRow | null> {
  return db.prepare('SELECT * FROM channel_source WHERE channel = ?').bind(channel).first<SourceRow>();
}

/**
 * Chặn ghi số bất thường: ngày có số đơn cao gấp nhiều lần bình thường (Poscake đồng bộ lại hàng loạt)
 * hoặc ít hẳn so với lần kéo trước (Poscake đã đổi ngày của đơn). Muốn ghi vẫn được nhưng phải bấm xác nhận.
 */
export async function guardDay(db: D1Database, channel: string, day: string, orders: number): Promise<void> {
  const prev = await db
    .prepare('SELECT orders FROM channel_runs WHERE channel = ? AND day = ?')
    .bind(channel, day)
    .first<{ orders: number | null }>();
  const recent = await db
    .prepare('SELECT orders FROM channel_runs WHERE channel = ? AND day <> ? AND orders > 0 ORDER BY day DESC LIMIT 14')
    .bind(channel, day)
    .all<{ orders: number }>();
  const list = (recent.results ?? []).map((r) => r.orders).sort((a, b) => a - b);
  const typical = list.length >= 3 ? list[Math.floor(list.length / 2)]! : 0;
  if (typical >= 20 && orders > typical * 3) {
    throw new Error(`BẤT THƯỜNG: ngày ${day} có ${orders} đơn, bình thường khoảng ${typical}. Có thể Poscake vừa đồng bộ lại hàng loạt nên chưa ghi.`);
  }
  const before = prev?.orders ?? 0;
  if (before >= 5 && orders < before * 0.5) {
    throw new Error(`BẤT THƯỜNG: ngày ${day} lần trước có ${before} đơn, lần này chỉ ${orders}. Có thể Poscake đã đổi ngày của đơn nên chưa ghi đè.`);
  }
}

export async function syncChannelDay(
  db: D1Database,
  secret: string | undefined,
  channel: Channel,
  day: string,
  fetchFn: FetchFn,
  opts: { force?: boolean } = {},
): Promise<{ day: string; orders: number; lines: number; pages: number }> {
  const src = await loadSource(db, channel);
  if (!src) throw new Error('Chưa nối Poscake cho kênh này');
  const minDay = await poscakeFrom(db, channel);
  if (minDay && day < minDay) throw new Error(`Trước ngày ${minDay} số Poscake của kênh này không tin được (đơn bị đồng bộ lại), không kéo`);
  const apiKey = await openKey(src.api_key, secret);
  let names: Record<string, string> = { ...(DEFAULT_SHOP_NAMES[channel] ?? {}) };
  try {
    if (src.shop_names) names = { ...names, ...(JSON.parse(src.shop_names) as Record<string, string>) };
  } catch {
    /* bỏ qua tên shop hỏng */
  }
  const { lines, pages } = await fetchShippedLines(fetchFn, channel, src.shop_id, apiKey, day, names);
  const ids = [...new Set(lines.map((l) => l.order_id))];
  if (!opts.force) await guardDay(db, channel, day, ids.length);
  // Đơn đã nằm ở ngày khác (Poscake đổi ngày gửi): bỏ khỏi ngày cũ và tính lại ngày cũ, không để trừ kho hai lần.
  const moved = new Set<string>();
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const r = await db
      .prepare(`SELECT DISTINCT day FROM channel_order_lines WHERE channel = ? AND day <> ? AND order_id IN (${chunk.map(() => '?').join(',')})`)
      .bind(channel, day, ...chunk)
      .all<{ day: string }>();
    for (const x of r.results ?? []) moved.add(x.day);
  }
  const stmts: D1PreparedStatement[] = [db.prepare('DELETE FROM channel_order_lines WHERE channel = ? AND day = ?').bind(channel, day)];
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    stmts.push(
      db.prepare(`DELETE FROM channel_order_lines WHERE channel = ? AND order_id IN (${chunk.map(() => '?').join(',')})`).bind(channel, ...chunk),
    );
  }
  const counter = new Map<string, number>();
  for (const l of lines) {
    const n = (counter.get(l.order_id) ?? 0) + 1;
    counter.set(l.order_id, n);
    stmts.push(
      db
        .prepare(
          `INSERT INTO channel_order_lines (channel, order_id, line_no, day, shipped_at, shop, sku, variant, name, qty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (channel, order_id, line_no) DO UPDATE SET day = excluded.day, shipped_at = excluded.shipped_at,
             shop = excluded.shop, sku = excluded.sku, variant = excluded.variant, name = excluded.name, qty = excluded.qty`,
        )
        .bind(channel, l.order_id, n, day, l.shipped_at, l.shop, l.sku, l.variant, l.name, l.qty),
    );
  }
  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
  const r = await recomputeDay(db, channel, day);
  for (const d of moved) await recomputeDay(db, channel, d);
  await db
    .prepare('UPDATE channel_source SET last_sync_at = ?, last_sync_note = ? WHERE channel = ?')
    .bind(nowIso(), `Ngày ${day}: ${r.orders} đơn, ${r.lines} mã`, channel)
    .run();
  return { day, orders: r.orders, lines: r.lines, pages };
}

/** Cron: kéo hôm qua và hôm kia (đơn cập nhật trạng thái muộn) cho các kênh đã nối. */
export async function syncAllChannels(
  db: D1Database,
  secret: string | undefined,
  days: string[],
  fetchFn: FetchFn,
): Promise<Array<{ channel: string; day: string; ok: boolean; note: string }>> {
  const out: Array<{ channel: string; day: string; ok: boolean; note: string }> = [];
  for (const channel of POSCAKE_CHANNELS) {
    if (!(await loadSource(db, channel))) continue;
    for (const day of days) {
      try {
        const r = await syncChannelDay(db, secret, channel, day, fetchFn);
        out.push({ channel, day, ok: true, note: `${r.orders} đơn` });
      } catch (e) {
        const note = e instanceof Error ? e.message : 'lỗi';
        out.push({ channel, day, ok: false, note });
        await db
          .prepare('UPDATE channel_source SET last_sync_at = ?, last_sync_note = ? WHERE channel = ?')
          .bind(nowIso(), `LỖI ${day}: ${note}`.slice(0, 200), channel)
          .run();
      }
    }
  }
  return out;
}

/** Lấy các trường dạng mã (vận đơn, mã đối tác…) trong đơn, tối đa 2 tầng; bỏ thông tin cá nhân của khách. */
export function codeFields(o: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const want = /track|waybill|extend|partner|ship|code|deliver|logistic|transport|bill/i;
  const skip = /phone|tel|name|address|addr|email|note|cus|receiv|bank|avatar|url|link|img|image|secret|token|key|pass|user|auth|sign/i;
  const walk = (v: unknown, path: string, depth: number) => {
    if (!v || typeof v !== 'object' || depth > 2) return;
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      const p = path ? path + '.' + key : key;
      if (skip.test(key)) continue;
      if ((typeof val === 'string' || typeof val === 'number') && want.test(p) && String(val).length <= 60) out[p] = String(val);
      else if (val && typeof val === 'object' && !Array.isArray(val)) walk(val, p, depth + 1);
    }
  };
  walk(o, '', 0);
  return out;
}

/**
 * Chẩn đoán (CEO): với một ngày, mỗi trạng thái Poscake có bao nhiêu đơn được cập nhật trong ngày đó,
 * kèm vài đơn mẫu (trạng thái, lịch sử trạng thái). Dùng khi số kéo về lệch với màn hình Poscake.
 */
export async function probeChannelDay(
  db: D1Database,
  secret: string | undefined,
  channel: Channel,
  day: string,
  fetchFn: FetchFn,
): Promise<Array<{ status: number; orders: number; pages: number; sample: unknown[] }>> {
  const src = await loadSource(db, channel);
  if (!src) throw new Error('Chưa nối Poscake cho kênh này');
  const apiKey = await openKey(src.api_key, secret);
  const { start, end } = vnBounds(day);
  const out: Array<{ status: number; orders: number; pages: number; sample: unknown[] }> = [];
  for (const st of [0, 1, 2, 3, 4, 5, 6, 8, 9, 11, 12, 13, 15, 16, 20]) {
    const url =
      `${API}/shops/${encodeURIComponent(src.shop_id)}/orders?api_key=${encodeURIComponent(apiKey)}` +
      `&updateStatus=${st}&startDateTime=${Math.floor(start / 1000)}&endDateTime=${Math.floor(end / 1000) - 1}&page_size=100&page_number=1`;
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`Poscake trả lỗi ${res.status} ở trạng thái ${st}`);
    const json = JSON.parse(await res.text()) as { total_pages?: number; total_entries?: number; data?: PosOrder[] };
    const n = json.total_entries ?? (json.data?.length ?? 0) + Math.max((json.total_pages ?? 1) - 1, 0) * 100;
    out.push({
      status: st,
      orders: n,
      pages: json.total_pages ?? 1,
      sample: (json.data ?? []).slice(0, 2).map((o) => ({
        id: o.custom_id ?? o.id,
        status: o.status,
        history: (o.status_history ?? []).slice(-4),
        time_send_partner: o.time_send_partner ?? null,
        code_fields: codeFields(o),
      })),
    });
  }
  return out;
}

/**
 * Chẩn đoán (CEO): xem đơn của một kênh có những trường thông tin khách nào và đầy đủ hay bị che.
 * Chỉ trả tỷ lệ và dạng đã che (số → 9, chữ → a), không trả thông tin thật của khách.
 */
export async function probeCustomerFields(
  db: D1Database,
  secret: string | undefined,
  channel: Channel,
  day: string,
  fetchFn: FetchFn,
): Promise<{ orders: number; fields: Array<{ path: string; filled: number; masked: number; shape: string }> }> {
  const src = await loadSource(db, channel);
  if (!src) throw new Error('Chưa nối Poscake cho kênh này');
  const apiKey = await openKey(src.api_key, secret);
  const { start, end } = vnBounds(day);
  const url =
    `${API}/shops/${encodeURIComponent(src.shop_id)}/orders?api_key=${encodeURIComponent(apiKey)}` +
    `&updateStatus=2&startDateTime=${Math.floor(start / 1000)}&endDateTime=${Math.floor(end / 1000) - 1}&page_size=100&page_number=1`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Poscake trả lỗi ${res.status}`);
  const json = JSON.parse(await res.text()) as { data?: unknown[] };
  const rows = json.data ?? [];
  const want = /phone|tel|name|address|addr|email|cus|receiv|buyer|province|district|commune|ward/i;
  const stat = new Map<string, { filled: number; masked: number; shape: string }>();
  const walk = (v: unknown, path: string, depth: number) => {
    if (!v || typeof v !== 'object' || depth > 3 || Array.isArray(v)) return;
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      const p = path ? path + '.' + key : key;
      if (typeof val === 'string' || typeof val === 'number') {
        if (!want.test(p)) continue;
        const s = String(val);
        const e = stat.get(p) ?? { filled: 0, masked: 0, shape: '' };
        if (s.trim()) {
          e.filled++;
          if (/\*|•|x{3,}/i.test(s)) e.masked++;
          if (!e.shape) e.shape = s.slice(0, 40).replace(/\p{L}/gu, 'a').replace(/\d/g, '9');
        }
        stat.set(p, e);
      } else if (val && typeof val === 'object') walk(val, p, depth + 1);
    }
  };
  for (const o of rows) walk(o, '', 0);
  return { orders: rows.length, fields: [...stat.entries()].map(([path, e]) => ({ path, ...e })) };
}

import { nowIso } from '@shared/datetime';
import { type Channel, loadLookups, resolveLabel } from './channelOut';
import {
  API,
  SOURCE_CHANNELS,
  type FetchFn,
  loadMapVersions,
  loadSource,
  openKey,
  parseUtc,
  pickMap,
  splitName,
  unmappedLabel,
  vnBounds,
} from './poscake';

/**
 * Hàng hoàn các sàn: kéo đơn "Đang hoàn" / "Đã hoàn" từ Poscake (theo ngày cập nhật trạng thái),
 * tra mã vận đơn khi kho quét gói hoàn, tách combo ra sản phẩm lẻ phải về.
 */
export const RET_STATUSES = [4, 5, 15] as const; // 4 đang hoàn, 5 đã hoàn, 15 hoàn một phần (TikTok)
export const OVERDUE_RETURNED_DAYS = 3; // sàn báo đã hoàn mà kho chưa quét
export const OVERDUE_RETURNING_DAYS = 20; // đang hoàn quá lâu
const MAX_PAGES = 30;
const SHOP_NAMES: Record<string, string> = { '1026269': 'Ailla Việt Nam', '1229028516': 'Ailla VN' };
const DAY_MS = 86_400_000;

interface RetOrder {
  id?: string | number;
  custom_id?: string;
  status?: number;
  account?: string | number;
  page?: { name?: string };
  partner?: { extend_code?: string; partner_status?: string } | null;
  status_history?: Array<{ status?: number; updated_at?: string }>;
  items?: Array<{ quantity?: number; variation_info?: { name?: string; detail?: string } }>;
}

/** Chuẩn hoá mã quét: bỏ khoảng trắng, viết hoa. Có dấu tiếng Việt = máy đang bật Unikey. */
export function normalizeCode(raw: string): { code: string; vietnamese: boolean } {
  const s = String(raw ?? '').trim();
  const vietnamese = /[à-ỹđ]/i.test(s.normalize('NFC'));
  return { code: s.replace(/\s+/g, '').toUpperCase(), vietnamese };
}

/** Kéo đơn chuyển sang trạng thái hoàn trong một ngày (giờ VN) của một kênh, lưu vào ret_orders / ret_lines. */
export async function syncReturnsDay(
  db: D1Database,
  secret: string | undefined,
  channel: Channel,
  day: string,
  fetchFn: FetchFn,
): Promise<{ channel: string; day: string; orders: number }> {
  const src = await loadSource(db, channel);
  if (!src) throw new Error('Chưa nối Poscake cho kênh này');
  const apiKey = await openKey(src.api_key, secret);
  const { start, end } = vnBounds(day);
  const seen = new Map<string, { o: RetOrder; st: number; t: number }>();
  for (const st of RET_STATUSES) {
    let page = 1;
    let total = 1;
    do {
      const url =
        `${API}/shops/${encodeURIComponent(src.shop_id)}/orders?api_key=${encodeURIComponent(apiKey)}` +
        `&updateStatus=${st}&startDateTime=${Math.floor(start / 1000)}&endDateTime=${Math.floor(end / 1000) - 1}&page_size=100&page_number=${page}`;
      const res = await fetchFn(url);
      if (!res.ok) throw new Error(`Poscake trả lỗi ${res.status}`);
      const json = JSON.parse(await res.text()) as { total_pages?: number; data?: RetOrder[] };
      total = json.total_pages ?? 1;
      for (const o of json.data ?? []) {
        const oid = String(o.custom_id || o.id || '');
        if (!oid) continue;
        const hit = (o.status_history ?? []).filter((h) => h.status === st).map((h) => parseUtc(h.updated_at)).filter((x): x is number => x !== null);
        const t = hit.length ? Math.min(...hit) : start;
        const prev = seen.get(oid);
        if (!prev || st > prev.st) seen.set(oid, { o, st, t });
      }
      page += 1;
    } while (page <= total && page <= MAX_PAGES);
    if (total > MAX_PAGES) throw new Error(`Quá ${MAX_PAGES * 100} đơn hoàn trong một ngày, không kéo để tránh thiếu`);
  }
  await saveRetOrders(db, channel, seen);
  return { channel, day, orders: seen.size };
}

async function saveRetOrders(db: D1Database, channel: Channel, seen: Map<string, { o: RetOrder; st: number; t: number }>) {
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const [oid, { o, st, t }] of seen) {
    const at = new Date(t).toISOString();
    const tracking = String(o.partner?.extend_code ?? '').trim().toUpperCase();
    const shop = o.page?.name?.trim() || (o.account ? SHOP_NAMES[String(o.account)] ?? `Shop ${o.account}` : '');
    stmts.push(
      db
        .prepare(
          `INSERT INTO ret_orders (channel, order_id, tracking, shop, status, returning_at, returned_at, synced_at, ship_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (channel, order_id) DO UPDATE SET
             tracking = CASE WHEN excluded.tracking <> '' THEN excluded.tracking ELSE ret_orders.tracking END,
             shop = excluded.shop, status = excluded.status,
             returning_at = COALESCE(ret_orders.returning_at, excluded.returning_at),
             returned_at = COALESCE(ret_orders.returned_at, excluded.returned_at),
             synced_at = excluded.synced_at,
             ship_status = CASE WHEN excluded.ship_status <> '' THEN excluded.ship_status ELSE ret_orders.ship_status END`,
        )
        .bind(channel, oid, tracking, shop, o.status ?? st, st === 4 ? at : null, st !== 4 ? at : null, now, String(o.partner?.partner_status ?? '').trim()),
      db.prepare('DELETE FROM ret_lines WHERE channel = ? AND order_id = ?').bind(channel, oid),
    );
    (o.items ?? []).forEach((it, i) => {
      const v = it.variation_info ?? {};
      const sp = splitName(v.name ?? '');
      stmts.push(
        db
          .prepare('INSERT INTO ret_lines (channel, order_id, line_no, sku, variant, name, qty) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(channel, oid, i + 1, sp.sku, String(v.detail ?? '').trim(), sp.name, Number(it.quantity) || 0),
      );
    });
  }
  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
}

/** Kéo đơn hoàn các ngày gần đây cho mọi kênh đã nối (cron + nút bấm). */
export async function syncReturns(
  db: D1Database,
  secret: string | undefined,
  days: string[],
  fetchFn: FetchFn,
): Promise<Array<{ channel: string; day: string; ok: boolean; note: string }>> {
  const out: Array<{ channel: string; day: string; ok: boolean; note: string }> = [];
  for (const channel of SOURCE_CHANNELS) {
    if (!(await loadSource(db, channel))) continue;
    for (const day of days) {
      try {
        const r = await syncReturnsDay(db, secret, channel, day, fetchFn);
        out.push({ channel, day, ok: true, note: `${r.orders} đơn hoàn` });
      } catch (e) {
        out.push({ channel, day, ok: false, note: e instanceof Error ? e.message : 'lỗi' });
      }
    }
  }
  return out;
}

export interface RetItem {
  item: string; // mã MISA, hoặc nhãn chưa có mã
  name: string;
  mapped: boolean;
  expected: number;
  received: number;
  good: number;
  bad: number;
}

/** Sản phẩm lẻ phải về của một đơn hoàn (tách combo theo bảng quy đổi của kênh). */
export async function expectedItems(db: D1Database, channel: string, orderId: string): Promise<RetItem[]> {
  const lines = (
    await db
      .prepare('SELECT sku, variant, name, qty FROM ret_lines WHERE channel = ? AND order_id = ? ORDER BY line_no')
      .bind(channel, orderId)
      .all<{ sku: string; variant: string; name: string; qty: number }>()
  ).results ?? [];
  const map = await loadMapVersions(db, channel);
  const lk = await loadLookups(db);
  const names = new Map(
    ((await db.prepare('SELECT code, name FROM kho_items').all<{ code: string; name: string }>()).results ?? []).map((r) => [r.code, r.name]),
  );
  const today = nowIso().slice(0, 10);
  const agg = new Map<string, RetItem>();
  for (const l of lines) {
    const ver = pickMap(map, l.sku, l.variant, today);
    const parts = ver
      ? ver.rows.map((x) => ({ label: x.item_label, qty: x.qty }))
      : [{ label: lk.byLower.has(l.sku.toLowerCase()) ? l.sku : unmappedLabel(l.sku, l.variant) + (l.name ? ` (${l.name})` : ''), qty: 1 }];
    for (const p of parts) {
      if (p.label.trim().toUpperCase() === 'BỎ QUA') continue;
      const code = resolveLabel(p.label, lk);
      const key = code ?? p.label;
      const it = agg.get(key) ?? { item: key, name: code ? names.get(code) ?? '' : p.label, mapped: !!code, expected: 0, received: 0, good: 0, bad: 0 };
      it.expected += l.qty * p.qty;
      agg.set(key, it);
    }
  }
  return [...agg.values()].map((x) => ({ ...x, received: x.expected, good: x.expected, bad: 0 }));
}

export function ageDays(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor((now - t) / DAY_MS) : null;
}

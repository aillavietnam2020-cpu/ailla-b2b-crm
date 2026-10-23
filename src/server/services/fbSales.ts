import { loadSource, openKey, API, type FetchFn } from './poscake';
import { pack, unpack } from '../lib/pack';

/**
 * Số bán hàng kênh Facebook theo người xử lý đơn, lấy thẳng từ Pancake (analytics/sale) bằng mã API đã nối cho kênh FACEBOOK.
 * Cùng cách tính với lệnh ads-fb.py trên máy chủ: đơn tạo, doanh số, giao xong, hoàn, hủy theo ngày giờ Việt Nam.
 */
const VN_MS = 7 * 3_600_000;
const FIELDS = [
  'net_revenue',
  'total_order_count',
  'delivered_count',
  'delivered_revenue',
  'returned_revenue',
  'returned_order_count',
  'canceled_order_count',
];

export function dayBoundsIso(day: string): { since: string; until: string } {
  const start = Date.parse(`${day}T00:00:00Z`) - VN_MS;
  const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return { since: iso(start), until: iso(start + 86_400_000 - 1000) };
}

async function openFacebook(db: D1Database, secret: string | undefined): Promise<{ shop: string; key: string }> {
  const src = await loadSource(db, 'FACEBOOK');
  if (!src) throw new Error('Chưa nối Pancake cho kênh Facebook');
  return { shop: src.shop_id, key: await openKey(src.api_key, secret) };
}

function saleUrl(shop: string, key: string, day: string, dims: string[], extra: Record<string, string>): string {
  const { since, until } = dayBoundsIso(day);
  const p = new URLSearchParams({ api_key: key, since, until, success_status: '1', success_record: 'updated_at', returned_record: 'success_record', ...extra });
  for (const f of FIELDS) p.append('select_fields[]', f);
  for (const d of dims) p.append('split_by[]', d);
  return `${API}/shops/${encodeURIComponent(shop)}/analytics/sale?${p.toString()}`;
}

/** Chẩn đoán (CEO): thử vài kiểu "loại người" để biết Pancake chia số theo người bán hàng bằng tên nào. */
export async function probeSaleSplit(db: D1Database, secret: string | undefined, day: string, fetchFn: FetchFn) {
  const { shop, key } = await openFacebook(db, secret);
  const out: Array<{ user_type: string; ok: boolean; status: number; rows: number; sample: unknown[]; error?: string }> = [];
  for (const ut of ['sale', 'seller', 'assigning_seller', 'assigning_care', 'care', 'creator', 'marketer']) {
    try {
      const res = await fetchFn(saleUrl(shop, key, day, ['User.id'], { user_type: ut }));
      const text = await res.text();
      let rows: unknown[] = [];
      try {
        rows = (JSON.parse(text) as { data?: unknown[] }).data ?? [];
      } catch {
        /* không phải JSON */
      }
      out.push({ user_type: ut, ok: res.ok, status: res.status, rows: rows.length, sample: rows.slice(0, 3), error: res.ok ? undefined : text.slice(0, 160) });
    } catch (e) {
      out.push({ user_type: ut, ok: false, status: 0, rows: 0, sample: [], error: e instanceof Error ? e.message : 'lỗi' });
    }
  }
  let users: unknown[] = [];
  try {
    const r = await fetchFn(`${API}/shops/${encodeURIComponent(shop)}/users?api_key=${encodeURIComponent(key)}`);
    const j = JSON.parse(await r.text()) as { data?: Array<Record<string, unknown>> };
    users = (j.data ?? []).slice(0, 40).map((u) => ({ keys: Object.keys(u).slice(0, 12), name: u.name ?? (u.user as { name?: string } | undefined)?.name, id: u.id ?? (u.user as { id?: string } | undefined)?.id }));
  } catch {
    /* bỏ qua */
  }
  return { day, shop, results: out, users };
}

/* ------------------------------------------------------------------ kéo thật: số theo người, theo ngày */
export interface SaleRow {
  u: string; // mã người xử lý đơn trên Pancake ('' = chưa gán)
  tao: number;
  huy: number;
  hoan: number;
  giao: number;
  dt: number;
  dtGiao: number;
  hoanDt: number;
}
export interface FbSaleBlob {
  at: string;
  names: Record<string, string>;
  days: Record<string, SaleRow[]>;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function userNames(shop: string, key: string, fetchFn: FetchFn): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  try {
    const r = await fetchFn(`${API}/shops/${encodeURIComponent(shop)}/users?api_key=${encodeURIComponent(key)}`);
    const j = JSON.parse(await r.text()) as { data?: Array<Record<string, unknown>> };
    for (const u of j.data ?? []) {
      const inner = (u.user ?? {}) as Record<string, unknown>;
      const name = String(u.name ?? inner.name ?? '').trim();
      if (!name) continue;
      for (const v of [...Object.values(u), ...Object.values(inner)]) if (typeof v === 'string' && v.length === 36) names[v] = name;
    }
  } catch {
    /* không lấy được tên thì hiện theo mã */
  }
  return names;
}

export async function loadFbSaleBlob(db: D1Database): Promise<FbSaleBlob> {
  const row = await db.prepare("SELECT data FROM hub_blobs WHERE key = 'fb_sale_days'").first<{ data: string }>();
  if (!row) return { at: '', names: {}, days: {} };
  return JSON.parse(await unpack(row.data)) as FbSaleBlob;
}

/** Kéo số bán hàng Facebook theo người xử lý đơn cho các ngày, gộp vào blob fb_sale_days (giữ các ngày cũ). */
export async function syncFbSaleDays(
  db: D1Database,
  secret: string | undefined,
  days: string[],
  fetchFn: FetchFn,
): Promise<Array<{ day: string; ok: boolean; note: string }>> {
  const { shop, key } = await openFacebook(db, secret);
  const blob = await loadFbSaleBlob(db);
  const names = await userNames(shop, key, fetchFn);
  const out: Array<{ day: string; ok: boolean; note: string }> = [];
  for (const day of days) {
    try {
      const res = await fetchFn(saleUrl(shop, key, day, ['User.id'], { user_type: 'sale', success_record: 'inserted_at' }));
      if (!res.ok) throw new Error(`Pancake trả lỗi ${res.status}`);
      const json = JSON.parse(await res.text()) as { data?: Array<Record<string, unknown>> };
      const rows: SaleRow[] = (json.data ?? []).map((r) => {
        const x = (r.result ?? {}) as Record<string, unknown>;
        return {
          u: r['User.id'] ? String(r['User.id']) : '',
          tao: num(x.total_order_count),
          huy: num(x.canceled_order_count),
          hoan: num(x.returned_order_count),
          giao: num(x.delivered_count),
          dt: num(x.net_revenue),
          dtGiao: num(x.delivered_revenue),
          hoanDt: num(x.returned_revenue),
        };
      });
      blob.days[day] = rows;
      out.push({ day, ok: true, note: `${rows.length} người, ${rows.reduce((s, r) => s + r.tao, 0)} đơn` });
    } catch (e) {
      out.push({ day, ok: false, note: e instanceof Error ? e.message : 'lỗi' });
    }
  }
  blob.names = { ...blob.names, ...names };
  blob.at = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES ('fb_sale_days', ?, 0, ?, NULL)
       ON CONFLICT (key) DO UPDATE SET data = excluded.data, admin_only = 0, updated_at = excluded.updated_at, updated_by = NULL`,
    )
    .bind(await pack(JSON.stringify(blob)), blob.at)
    .run();
  return out;
}

/** Chẩn đoán (CEO): thử thêm tham số cho analytics/sale để biết Pancake có tính theo ngày tạo đơn không. */
export async function probeSaleExtra(db: D1Database, secret: string | undefined, day: string, extra: Record<string, string>, fetchFn: FetchFn) {
  const { shop, key } = await openFacebook(db, secret);
  const res = await fetchFn(saleUrl(shop, key, day, ['User.id'], { user_type: 'sale', ...extra }));
  const text = await res.text();
  let rows: unknown[] = [];
  try {
    rows = (JSON.parse(text) as { data?: unknown[] }).data ?? [];
  } catch {
    /* không phải JSON */
  }
  return { day, extra, status: res.status, rows: rows.length, data: rows.map((r) => {
    const x = ((r as Record<string, unknown>).result ?? {}) as Record<string, unknown>;
    return { u: String((r as Record<string, unknown>)['User.id'] ?? ''), total: x.total_order_count, order_count: x.order_count, canceled: x.canceled_order_count, returned: x.returned_order_count, delivered: x.delivered_count, net: x.net_revenue, delivered_rev: x.delivered_revenue, returned_rev: x.returned_revenue };
  }), error: res.ok ? undefined : text.slice(0, 200) };
}

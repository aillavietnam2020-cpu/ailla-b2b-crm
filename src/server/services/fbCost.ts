import { fetchShippedLines, loadSource, openKey, type FetchFn } from './poscake';
import { pack, unpack } from '../lib/pack';

/**
 * Tiền đơn Facebook đã gửi hàng theo ngày (cửa hàng Poscake nối cho kênh FACEBOOK), để web tự tính giá vốn và ship Facebook mỗi sáng
 * (chị Hoa duyệt 06/11/2026, thay bản nạp tay fb_cost_days từ Sheet Pancake cũ chỉ có tới 21/10).
 * Mỗi đơn: tiền hàng sau giảm giá, phí trả hãng vận chuyển (partner_fee; shipping_fee trên đơn là ship thu của khách, thường 0).
 * Giá vốn do trang tính: số lượng từng dòng đơn (channel_order_lines FACEBOOK) × giá thành trên web; mã chưa có giá thành thì để trống.
 * Lưu ở hub_blobs 'fb_money': { at, d: { ngày: [số đơn, tiền hàng, ship] }, o: { mã đơn: [ngày, tiền hàng, ship] } }.
 */
export const FB_MONEY_KEY = 'fb_money';
const KEEP_DAYS = 160;

export interface FbMoney {
  at: string;
  d: Record<string, [number, number, number]>;
  o: Record<string, [string, number, number]>;
}

export async function loadFbMoney(db: D1Database): Promise<FbMoney> {
  const row = await db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(FB_MONEY_KEY).first<{ data: string }>();
  try {
    const v = row ? (JSON.parse(await unpack(row.data)) as FbMoney) : null;
    if (v && v.d && v.o) return v;
  } catch {
    /* hỏng thì dựng lại */
  }
  return { at: '', d: {}, o: {} };
}

const money = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

/** Kéo tiền đơn Facebook đã gửi hàng của các ngày, gộp vào blob (giữ ngày cũ, bỏ đơn quá KEEP_DAYS ngày). */
export async function syncFbMoney(db: D1Database, secret: string | undefined, days: string[], fetchFn: FetchFn) {
  const src = await loadSource(db, 'FACEBOOK');
  if (!src) throw new Error('Chưa nối Poscake cho kênh Facebook');
  const key = await openKey(src.api_key, secret);
  const cur = await loadFbMoney(db);
  const out: Array<{ day: string; orders: number; error?: string }> = [];
  for (const day of days) {
    try {
      const o: Record<string, [string, number, number]> = {};
      await fetchShippedLines(fetchFn, 'FACEBOOK', src.shop_id, key, day, {}, (id, x) => {
        o[id] = [day, money(x.total_price_after_sub_discount ?? x.total_price), money(x.partner_fee)];
      });
      for (const [id, v] of Object.entries(cur.o)) if (v[0] === day) delete cur.o[id];
      Object.assign(cur.o, o);
      const vals = Object.values(o);
      cur.d[day] = [vals.length, vals.reduce((a, v) => a + v[1], 0), vals.reduce((a, v) => a + v[2], 0)];
      out.push({ day, orders: vals.length });
    } catch (e) {
      out.push({ day, orders: 0, error: e instanceof Error ? e.message : 'lỗi' });
    }
  }
  const cut = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (const [id, v] of Object.entries(cur.o)) if (v[0] < cut) delete cur.o[id];
  for (const d of Object.keys(cur.d)) if (d < cut) delete cur.d[d];
  cur.at = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, NULL)
       ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind(FB_MONEY_KEY, await pack(JSON.stringify(cur)), cur.at)
    .run();
  return out;
}

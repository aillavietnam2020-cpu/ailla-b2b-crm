import { nowIso } from '@shared/datetime';

export const CHANNELS = ['TIKTOK', 'SHOPEE', 'FACEBOOK'] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABELS: Record<Channel, string> = {
  TIKTOK: 'TikTok Shop',
  SHOPEE: 'Shopee',
  FACEBOOK: 'Facebook',
};

/**
 * Ngày sớm nhất số Poscake được tin. TikTok: 12/10/2026 Poscake đồng bộ lại toàn bộ đơn cũ nên giờ "đã gửi"
 * của mọi đơn trước đó bị ghi thành 12/10; chỉ tin được từ 13/10. Trước mốc này số Sheet luôn được ghi.
 */
export const POSCAKE_FROM: Record<string, string> = { TIKTOK: '2026-10-13' };

export interface ChannelLine {
  label: string;
  qty: number;
}
export interface ChannelDay {
  day: string;
  orders?: number | null;
  lines: ChannelLine[];
}

export interface Lookups {
  byLower: Map<string, string>;
  alias: Map<string, string>;
}

/** Bảng tra: mã vật tư (không phân biệt hoa/thường) và tên gọi riêng đã gán. */
export async function loadLookups(db: D1Database): Promise<Lookups> {
  const [items, aliases] = await Promise.all([
    db.prepare('SELECT code FROM kho_items').all<{ code: string }>(),
    db.prepare('SELECT label, item FROM channel_alias').all<{ label: string; item: string }>(),
  ]);
  const byLower = new Map((items.results ?? []).map((r) => [r.code.toLowerCase(), r.code]));
  const alias = new Map((aliases.results ?? []).map((r) => [r.label.trim().toLowerCase(), r.item]));
  return { byLower, alias };
}

/** "AILLATLGSX - Tẩy lồng ..." → mã AILLATLGSX; hoặc tên đã gán; không ra thì null (kho chưa trừ). */
export function resolveLabel(label: string, lk: Lookups): string | null {
  const clean = label.trim();
  if (!clean) return null;
  const a = lk.alias.get(clean.toLowerCase());
  if (a) {
    const code = lk.byLower.get(a.toLowerCase());
    if (code) return code;
  }
  if (/^\(chưa có mã\)/i.test(clean)) return null;
  const head = clean.split(/\s+-\s+/)[0]!.trim();
  return lk.byLower.get(head.toLowerCase()) ?? lk.byLower.get(clean.toLowerCase()) ?? null;
}

async function runBatches(db: D1Database, stmts: D1PreparedStatement[]) {
  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
}

/**
 * Ghi số xuất một hoặc nhiều ngày của một kênh. Mỗi ngày được thay nguyên cả ngày (nạp lại không trừ trùng).
 */
export async function saveChannelDays(
  db: D1Database,
  channel: Channel,
  days: ChannelDay[],
  source: string,
): Promise<{ days: number; lines: number; mapped_qty: number; unmapped_qty: number; unmapped_labels: string[] }> {
  const lk = await loadLookups(db);
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  // Ngày đã kéo thẳng từ Poscake thì Sheet / nạp tay không được đè lên.
  if (source !== 'POSCAKE' && days.length > 0) {
    const have = await db
      .prepare(
        `SELECT day FROM channel_runs WHERE channel = ? AND source = 'POSCAKE' AND day IN (${days.map(() => '?').join(',')})`,
      )
      .bind(channel, ...days.map((d) => d.day))
      .all<{ day: string }>();
    const minDay = POSCAKE_FROM[channel] ?? '';
    const skip = new Set((have.results ?? []).map((r) => r.day).filter((d) => !minDay || d >= minDay));
    if (skip.size > 0) days = days.filter((d) => !skip.has(d.day));
  }
  let lines = 0;
  let mapped = 0;
  let unmappedQty = 0;
  const unmappedLabels = new Set<string>();
  for (const d of days) {
    stmts.push(
      db.prepare('DELETE FROM channel_out WHERE channel = ? AND day = ?').bind(channel, d.day),
      db.prepare('DELETE FROM channel_unmapped WHERE channel = ? AND day = ?').bind(channel, d.day),
    );
    const out = new Map<string, number>();
    const un = new Map<string, number>();
    for (const l of d.lines) {
      if (!(l.qty > 0)) continue;
      const label = l.label.trim();
      if (!label || /^bỏ qua$/i.test(label)) continue;
      lines += 1;
      const item = resolveLabel(label, lk);
      if (item) {
        out.set(item, (out.get(item) ?? 0) + l.qty);
        mapped += l.qty;
      } else {
        un.set(label, (un.get(label) ?? 0) + l.qty);
        unmappedQty += l.qty;
        unmappedLabels.add(label);
      }
    }
    for (const [item, qty] of out) {
      stmts.push(
        db.prepare('INSERT INTO channel_out (channel, day, item, qty) VALUES (?, ?, ?, ?)').bind(channel, d.day, item, qty),
      );
    }
    for (const [label, qty] of un) {
      stmts.push(
        db
          .prepare('INSERT INTO channel_unmapped (channel, day, label, qty) VALUES (?, ?, ?, ?)')
          .bind(channel, d.day, label, qty),
      );
    }
    stmts.push(
      db
        .prepare(
          `INSERT INTO channel_runs (channel, day, orders, lines, received_at, source) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (channel, day) DO UPDATE SET orders = excluded.orders, lines = excluded.lines,
             received_at = excluded.received_at, source = excluded.source`,
        )
        .bind(channel, d.day, d.orders ?? null, out.size + un.size, now, source),
    );
  }
  await runBatches(db, stmts);
  return {
    days: days.length,
    lines,
    mapped_qty: mapped,
    unmapped_qty: unmappedQty,
    unmapped_labels: [...unmappedLabels],
  };
}

/** Sau khi gán mã cho một tên: chuyển các dòng đang chờ của tên đó sang trừ kho. */
export async function remapUnmapped(db: D1Database): Promise<number> {
  const lk = await loadLookups(db);
  const rows = await db
    .prepare('SELECT channel, day, label, qty FROM channel_unmapped')
    .all<{ channel: string; day: string; label: string; qty: number }>();
  const stmts: D1PreparedStatement[] = [];
  let moved = 0;
  for (const r of rows.results ?? []) {
    const item = resolveLabel(r.label, lk);
    if (!item) continue;
    moved += 1;
    stmts.push(
      db
        .prepare(
          `INSERT INTO channel_out (channel, day, item, qty) VALUES (?, ?, ?, ?)
           ON CONFLICT (channel, day, item) DO UPDATE SET qty = qty + excluded.qty`,
        )
        .bind(r.channel, r.day, item, r.qty),
      db
        .prepare('DELETE FROM channel_unmapped WHERE channel = ? AND day = ? AND label = ?')
        .bind(r.channel, r.day, r.label),
    );
  }
  await runBatches(db, stmts);
  return moved;
}

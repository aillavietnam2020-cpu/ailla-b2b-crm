import { vnDate } from '@shared/datetime';
import { resolveEffectivePrice, type PriceRow } from '@shared/pricing';

/**
 * Thưởng NPP / đại lý theo DOANH SỐ LẺ: số lượng × giá niêm yết bán lẻ (cấp "Bán lẻ"), không phải giá cấp thực bán.
 * Không tính: hàng tặng (kể cả dòng đơn giá 0 nhập từ Sheet), mã trợ giá / flash sale (products.bonus_excluded), đơn hủy / từ chối / hoàn; hàng trả lại đã giảm nợ được trừ.
 */
export interface GiftItem {
  item: string;
  qty: number;
}

export interface BonusTier {
  level_no: number;
  label: string;
  threshold: number;
  cash: number;
  gift_text: string;
  gift_value: number;
  /** Quà thưởng khai theo mã kho + số lượng, để lập phiếu xuất quà. */
  gift_items: GiftItem[];
}

export interface BonusRow {
  customer_id: string;
  customer_name: string;
  tier_name: string | null;
  policy: 'RIENG' | 'CHUNG';
  actual_sales: number;
  retail_sales: number;
  month_level: string;
  month_cash: number;
  month_gift_text: string;
  month_gift_value: number;
  month_gift_items: GiftItem[];
  advanced: number;
  /** Đã chi bằng phiếu chi thưởng (kể cả phiếu đang chờ duyệt). */
  paid: number;
  payable: number;
  year_retail: number;
  year_level: string;
  year_cash: number;
}

export function pickLevel(tiers: BonusTier[], retail: number): BonusTier | null {
  let hit: BonusTier | null = null;
  for (const t of tiers)
    if (retail >= t.threshold && (!hit || t.threshold >= hit.threshold)) hit = t;
  return hit;
}

export async function loadTiers(
  db: D1Database,
): Promise<Map<string, { MONTH: BonusTier[]; YEAR: BonusTier[] }>> {
  const rows =
    (
      await db
        .prepare(
          'SELECT customer_id, period, level_no, label, threshold, cash, gift_text, gift_value, gift_items FROM bonus_tiers ORDER BY customer_id, period, level_no',
        )
        .all<
          Omit<BonusTier, 'gift_items'> & {
            customer_id: string;
            period: 'MONTH' | 'YEAR';
            gift_items: string;
          }
        >()
    ).results ?? [];
  const m = new Map<string, { MONTH: BonusTier[]; YEAR: BonusTier[] }>();
  for (const r of rows) {
    if (!m.has(r.customer_id)) m.set(r.customer_id, { MONTH: [], YEAR: [] });
    let items: GiftItem[] = [];
    try {
      const parsed = JSON.parse(r.gift_items || '[]') as GiftItem[];
      if (Array.isArray(parsed)) items = parsed.filter((g) => g && g.item && g.qty > 0);
    } catch {
      items = [];
    }
    m.get(r.customer_id)![r.period].push({ ...r, gift_items: items });
  }
  return m;
}

export async function bonusReport(
  db: D1Database,
  month: string,
  range?: { from: string; to: string },
): Promise<{ month: string; rows: BonusRow[] }> {
  // Có range thì tính đúng khoảng ngày đó (nhiều tháng: cộng thưởng từng tháng); không thì cả tháng `month`.
  const monthStart = range?.from ?? `${month}-01`;
  const monthEnd = range?.to ?? `${month}-31`;
  const yearEnd = monthEnd.slice(0, 4);
  const yearStart =
    monthStart.slice(0, 4) < yearEnd ? `${monthStart.slice(0, 4)}-01-01` : `${yearEnd}-01-01`;
  const today = vnDate();

  // Giá niêm yết bán lẻ (cấp BAN_LE) của mọi mã; chưa có giá tại ngày đơn thì lấy giá hiệu lực hôm nay.
  const tier = await db
    .prepare("SELECT id FROM price_tiers WHERE code = 'BAN_LE'")
    .first<{ id: string }>();
  const priceRows: PriceRow[] = tier
    ? ((
        await db
          .prepare(
            `SELECT product_id, tier_id, amount, valid_from, valid_to, status FROM product_prices WHERE tier_id = ? AND status <> 'DRAFT'`,
          )
          .bind(tier.id)
          .all<PriceRow>()
      ).results ?? [])
    : [];
  const retailOf = (productId: string, day: string): number => {
    const t = tier?.id ?? '';
    const at = resolveEffectivePrice(priceRows, productId, t, day);
    if (at.found && at.amount) return at.amount;
    return resolveEffectivePrice(priceRows, productId, t, today).amount ?? 0;
  };

  const lines =
    (
      await db
        .prepare(
          `SELECT o.customer_id, substr(o.order_date, 1, 7) AS ym, o.order_date, oi.product_id, (oi.qty - oi.gift_qty) AS qty, oi.line_total
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN products p ON p.id = oi.product_id
           WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND o.delivery_status <> 'HOAN'
             AND o.order_date >= ? AND o.order_date <= ? AND oi.is_gift = 0 AND oi.applied_price > 0 AND p.bonus_excluded = 0`,
        )
        .bind(yearStart, monthEnd)
        .all<{
          customer_id: string;
          ym: string;
          order_date: string;
          product_id: string;
          qty: number;
          line_total: number;
        }>()
    ).results ?? [];

  const returns =
    (
      await db
        .prepare(
          `SELECT r.customer_id, substr(r.return_date, 1, 7) AS ym, r.return_date, l.product_id,
                  COALESCE(l.received_qty, l.qty) AS qty
           FROM order_return_lines l JOIN order_returns r ON r.id = l.return_id
           JOIN products p ON p.id = l.product_id
           WHERE r.status = 'DA_GIAM_NO' AND r.return_date >= ? AND r.return_date <= ? AND p.bonus_excluded = 0`,
        )
        .bind(yearStart, monthEnd)
        .all<{
          customer_id: string;
          ym: string;
          return_date: string;
          product_id: string;
          qty: number;
        }>()
    ).results ?? [];

  const advances =
    (
      await db
        .prepare(
          `SELECT customer_id, SUM(bonus_deduction) AS adv FROM orders
           WHERE deleted_at IS NULL AND approval_status = 'APPROVED' AND order_date >= ? AND order_date <= ?
           GROUP BY customer_id`,
        )
        .bind(monthStart, monthEnd)
        .all<{ customer_id: string; adv: number }>()
    ).results ?? [];
  const advBy = new Map(advances.map((a) => [a.customer_id, a.adv ?? 0]));
  const paidRows =
    (
      await db
        .prepare(
          `SELECT customer_id, SUM(amount) AS paid FROM bonus_cash_vouchers
           WHERE status IN ('CHO_DUYET', 'DA_CHI') AND month >= ? AND month <= ? GROUP BY customer_id`,
        )
        .bind(monthStart.slice(0, 7), monthEnd.slice(0, 7))
        .all<{ customer_id: string; paid: number }>()
    ).results ?? [];
  const paidBy = new Map(paidRows.map((a) => [a.customer_id, a.paid ?? 0]));

  const acc = new Map<
    string,
    { actual: number; retailM: number; retailY: number; byYm: Map<string, number> }
  >();
  const get = (id: string) => {
    if (!acc.has(id)) acc.set(id, { actual: 0, retailM: 0, retailY: 0, byYm: new Map() });
    return acc.get(id)!;
  };
  const inRange = (d: string) => d.slice(0, 10) >= monthStart && d.slice(0, 10) <= monthEnd;
  for (const l of lines) {
    const a = get(l.customer_id);
    const v = l.qty * retailOf(l.product_id, l.order_date);
    if (l.order_date.slice(0, 10) <= monthEnd) a.retailY += v;
    if (inRange(l.order_date)) {
      a.retailM += v;
      a.actual += l.line_total;
      a.byYm.set(l.ym, (a.byYm.get(l.ym) ?? 0) + v);
    }
  }
  for (const r of returns) {
    const a = get(r.customer_id);
    const v = r.qty * retailOf(r.product_id, r.return_date);
    if (r.return_date.slice(0, 10) <= monthEnd) a.retailY -= v;
    if (inRange(r.return_date)) {
      a.retailM -= v;
      a.byYm.set(r.ym, (a.byYm.get(r.ym) ?? 0) - v);
    }
  }

  const tiers = await loadTiers(db);
  const general = tiers.get('') ?? { MONTH: [], YEAR: [] };
  const custs =
    (
      await db
        .prepare(
          `SELECT c.id, c.name, pt.code AS tier_code, pt.name AS tier_name FROM customers c
           LEFT JOIN price_tiers pt ON pt.id = c.tier_id WHERE c.deleted_at IS NULL`,
        )
        .all<{ id: string; name: string; tier_code: string | null; tier_name: string | null }>()
    ).results ?? [];

  const rows: BonusRow[] = [];
  for (const c of custs) {
    const a = acc.get(c.id);
    const own = tiers.get(c.id);
    if (!a) continue; // mọi cấp đều có thưởng theo cơ chế chung (đúng bảng THUONG_THANG của Sheet)
    const pol = {
      MONTH: own && own.MONTH.length ? own.MONTH : general.MONTH,
      YEAR: own && own.YEAR.length ? own.YEAR : general.YEAR,
    };
    const retailM = Math.max(0, Math.round(a.retailM));
    const retailY = Math.max(0, Math.round(a.retailY));
    const multi = a.byYm.size > 1;
    const lm = pickLevel(pol.MONTH, retailM);
    let monthLevel = lm?.label ?? 'Chưa đạt mốc';
    let cash = lm?.cash ?? 0;
    let giftText = lm?.gift_text ?? '';
    let giftValue = lm?.gift_value ?? 0;
    let giftItems = lm?.gift_items ?? [];
    if (multi) {
      // Nhiều tháng: mỗi tháng xét mốc riêng rồi cộng thưởng lại (đúng cách trả thưởng theo tháng).
      cash = 0;
      giftValue = 0;
      const texts: string[] = [];
      const items = new Map<string, number>();
      let hit = 0;
      for (const [ym, v] of [...a.byYm.entries()].sort()) {
        const l = pickLevel(pol.MONTH, Math.max(0, Math.round(v)));
        if (!l) continue;
        hit += 1;
        cash += l.cash;
        giftValue += l.gift_value;
        if (l.gift_text) texts.push(`${ym.slice(5)}: ${l.gift_text}`);
        for (const g of l.gift_items) items.set(g.item, (items.get(g.item) ?? 0) + g.qty);
      }
      monthLevel = hit ? `${hit}/${a.byYm.size} tháng đạt mốc` : 'Chưa đạt mốc';
      giftText = texts.join('; ');
      giftItems = [...items.entries()].map(([item, qty]) => ({ item, qty }));
    }
    const ly = pickLevel(pol.YEAR, retailY);
    const advanced = advBy.get(c.id) ?? 0;
    const paid = paidBy.get(c.id) ?? 0;
    rows.push({
      customer_id: c.id,
      customer_name: c.name,
      tier_name: c.tier_name,
      policy: own ? 'RIENG' : 'CHUNG',
      actual_sales: Math.round(a.actual),
      retail_sales: retailM,
      month_level: monthLevel,
      month_cash: cash,
      month_gift_text: giftText,
      month_gift_value: giftValue,
      month_gift_items: giftItems,
      advanced,
      paid,
      payable: cash - advanced - paid,
      year_retail: retailY,
      year_level: ly?.label ?? 'Chưa đạt mốc',
      year_cash: ly?.cash ?? 0,
    });
  }
  rows.sort((x, y) => y.retail_sales - x.retail_sales);
  return { month, rows };
}

/**
 * Doanh số LẺ của một tháng theo từng khách (cùng quy tắc tính thưởng: số lượng × giá niêm yết bán lẻ, bỏ hàng tặng
 * và dòng đơn giá 0, trừ hàng trả đã giảm nợ). Nhẹ hơn bonusReport: chỉ đọc đơn của đúng tháng đó.
 */
export async function monthRetailByCustomer(
  db: D1Database,
  month: string,
  range?: { from: string; to: string },
): Promise<Map<string, number>> {
  const from = range?.from ?? `${month}-01`;
  const to = range?.to ?? `${month}-31`;
  const today = vnDate();
  const tier = await db
    .prepare("SELECT id FROM price_tiers WHERE code = 'BAN_LE'")
    .first<{ id: string }>();
  const out = new Map<string, number>();
  if (!tier) return out;
  const priceRows =
    (
      await db
        .prepare(
          `SELECT product_id, tier_id, amount, valid_from, valid_to, status FROM product_prices WHERE tier_id = ? AND status <> 'DRAFT'`,
        )
        .bind(tier.id)
        .all<PriceRow>()
    ).results ?? [];
  const retailOf = (pid: string, day: string) => {
    const at = resolveEffectivePrice(priceRows, pid, tier.id, day);
    if (at.found && at.amount) return at.amount;
    return resolveEffectivePrice(priceRows, pid, tier.id, today).amount ?? 0;
  };
  const lines =
    (
      await db
        .prepare(
          `SELECT o.customer_id, o.order_date, oi.product_id, (oi.qty - oi.gift_qty) AS qty
         FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
         WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND o.delivery_status <> 'HOAN'
           AND o.order_date >= ? AND o.order_date <= ? AND oi.is_gift = 0 AND oi.applied_price > 0 AND p.bonus_excluded = 0`,
        )
        .bind(from, to)
        .all<{ customer_id: string; order_date: string; product_id: string; qty: number }>()
    ).results ?? [];
  for (const l of lines)
    out.set(
      l.customer_id,
      (out.get(l.customer_id) ?? 0) + l.qty * retailOf(l.product_id, l.order_date),
    );
  const rets =
    (
      await db
        .prepare(
          `SELECT r.customer_id, r.return_date, l.product_id, COALESCE(l.received_qty, l.qty) AS qty
         FROM order_return_lines l JOIN order_returns r ON r.id = l.return_id JOIN products p ON p.id = l.product_id
         WHERE r.status = 'DA_GIAM_NO' AND r.return_date >= ? AND r.return_date <= ? AND p.bonus_excluded = 0`,
        )
        .bind(from, to)
        .all<{ customer_id: string; return_date: string; product_id: string; qty: number }>()
    ).results ?? [];
  for (const r of rets)
    out.set(
      r.customer_id,
      (out.get(r.customer_id) ?? 0) - r.qty * retailOf(r.product_id, r.return_date),
    );
  for (const [k, v] of out) out.set(k, Math.max(0, Math.round(v)));
  return out;
}

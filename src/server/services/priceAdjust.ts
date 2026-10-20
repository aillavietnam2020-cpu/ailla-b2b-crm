/**
 * Giá điều chỉnh / khuyến mại đặt lên trên bảng giá gốc (không sửa bảng giá gốc).
 * Một mã + một cấp tại một ngày chỉ chịu MỘT điều chỉnh: cụ thể hơn thắng (PRODUCT > GROUP > ALL),
 * cùng mức thì cái tạo sau thắng. Không cộng dồn để giá luôn dễ giải thích.
 */
export interface PriceAdjustment {
  id: string;
  label: string;
  scope: 'ALL' | 'GROUP' | 'PRODUCT';
  product_id: string | null;
  group_id: string | null;
  /** Nhiều mã (scope PRODUCT), nhiều nhóm (scope GROUP), mã loại trừ (scope GROUP / ALL). Đã gộp cả product_id / group_id cũ. */
  product_ids: string[];
  group_ids: string[];
  exclude_ids: string[];
  tier_ids: string[];
  kind: 'PERCENT' | 'AMOUNT' | 'FIXED';
  value: number;
  round_to: number;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
}

export async function loadAdjustments(db: D1Database, day: string): Promise<PriceAdjustment[]> {
  const rows = (
    await db
      .prepare(
        `SELECT id, label, scope, product_id, group_id, product_ids, group_ids, exclude_ids, tier_ids, kind, value, round_to, valid_from, valid_to, created_at
         FROM price_adjustments
         WHERE status = 'ACTIVE' AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)`,
      )
      .bind(day, day)
      .all<Omit<PriceAdjustment, 'tier_ids' | 'product_ids' | 'group_ids' | 'exclude_ids'> & { tier_ids: string; product_ids: string; group_ids: string; exclude_ids: string }>()
  ).results ?? [];
  return rows.map((r) => ({
    ...r,
    tier_ids: parseIds(r.tier_ids),
    product_ids: [...new Set([...parseIds(r.product_ids), ...(r.product_id ? [r.product_id] : [])])],
    group_ids: [...new Set([...parseIds(r.group_ids), ...(r.group_id ? [r.group_id] : [])])],
    exclude_ids: parseIds(r.exclude_ids),
  }));
}

export function parseIds(raw: unknown): string[] {
  try {
    const p = JSON.parse(String(raw || '[]')) as unknown;
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

const SPECIFICITY: Record<PriceAdjustment['scope'], number> = { PRODUCT: 3, GROUP: 2, ALL: 1 };

/** Điều chỉnh đang áp cho (mã, nhóm, cấp); null nếu không có. */
export function pickAdjustment(
  list: PriceAdjustment[],
  productId: string,
  groupId: string | null,
  tierId: string,
): PriceAdjustment | null {
  let best: PriceAdjustment | null = null;
  for (const a of list) {
    if (a.exclude_ids.includes(productId)) continue;
    if (a.scope === 'PRODUCT' && !a.product_ids.includes(productId)) continue;
    if (a.scope === 'GROUP' && (!groupId || !a.group_ids.includes(groupId))) continue;
    if (a.tier_ids.length && !a.tier_ids.includes(tierId)) continue;
    if (
      !best ||
      SPECIFICITY[a.scope] > SPECIFICITY[best.scope] ||
      (SPECIFICITY[a.scope] === SPECIFICITY[best.scope] && a.created_at > best.created_at)
    ) {
      best = a;
    }
  }
  return best;
}

/** Giá sau điều chỉnh (làm tròn theo round_to). FIXED đặt thẳng giá kể cả khi bảng giá gốc chưa có. */
export function applyAdjustment(a: PriceAdjustment, base: number | null): number | null {
  let v: number | null;
  if (a.kind === 'FIXED') v = a.value;
  else if (base === null || base === undefined) return null;
  else if (a.kind === 'PERCENT') v = base * (1 + a.value / 100);
  else v = base + a.value;
  const step = a.round_to > 0 ? a.round_to : 1;
  return Math.max(0, Math.round(v / step) * step);
}

export function adjustedPrice(
  list: PriceAdjustment[],
  productId: string,
  groupId: string | null,
  tierId: string,
  base: number | null,
): { amount: number | null; adjustment: PriceAdjustment | null } {
  const a = pickAdjustment(list, productId, groupId, tierId);
  if (!a) return { amount: base, adjustment: null };
  return { amount: applyAdjustment(a, base), adjustment: a };
}

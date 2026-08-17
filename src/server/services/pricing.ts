import { resolveEffectivePrice, type PriceRow } from '@shared/pricing';
import type { ProductItem } from '@shared/types';
import type { PriceUpsertInput } from '@shared/schemas';
import { nowIso, vnDate } from '@shared/datetime';
import { can } from '@shared/permissions';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { notFound } from '../lib/http';
import { newId } from '../lib/ids';

/**
 * D1 chỉ cho tối đa 100 tham số mỗi câu truy vấn, trong khi bảng giá có tới 134 sản phẩm.
 * Chia nhỏ danh sách để không vỡ truy vấn (trước đây mở bảng giá đầy đủ bị lỗi 500).
 */
const SQL_PARAM_LIMIT = 90;

export async function loadPriceRows(
  db: D1Database,
  productIds: string[],
  tierId?: string | null,
): Promise<PriceRow[]> {
  if (productIds.length === 0) return [];
  const chunkSize = tierId ? SQL_PARAM_LIMIT - 1 : SQL_PARAM_LIMIT;
  const results: PriceRow[] = [];

  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const tierClause = tierId ? ' AND tier_id = ?' : '';
    const params: unknown[] = tierId ? [...chunk, tierId] : [...chunk];
    const rows = await db
      .prepare(
        `SELECT product_id, tier_id, amount, valid_from, valid_to, status
         FROM product_prices
         WHERE product_id IN (${placeholders})${tierClause} AND status <> 'DRAFT'`,
      )
      .bind(...params)
      .all<PriceRow>();
    results.push(...(rows.results ?? []));
  }
  return results;
}

export async function getBasePrice(
  db: D1Database,
  productId: string,
  tierId: string,
  onDate: string,
): Promise<number | null> {
  const rows = await loadPriceRows(db, [productId], tierId);
  return resolveEffectivePrice(rows, productId, tierId, onDate).amount;
}

/**
 * Đặt giá mới cho một ô (sản phẩm × cấp) từ ngày hiệu lực.
 * CEO đặt là có hiệu lực ngay; Quản lý đặt thì thành bản nháp chờ CEO duyệt.
 * Giá cũ KHÔNG bị sửa - chỉ đóng lại bằng valid_to, nên đơn cũ giữ nguyên giá đã chốt.
 */
export async function setPrice(
  db: D1Database,
  auth: AuthContext,
  input: PriceUpsertInput,
  ctx: { requestId: string; ip: string | null },
): Promise<{ id: string; status: 'ACTIVE' | 'DRAFT'; approval_id?: string }> {
  const product = await db
    .prepare('SELECT id, sku, name FROM products WHERE id = ? AND deleted_at IS NULL')
    .bind(input.product_id)
    .first<{ id: string; sku: string; name: string }>();
  if (!product) throw notFound('Không tìm thấy sản phẩm');

  const tier = await db
    .prepare('SELECT id, code, name FROM price_tiers WHERE id = ?')
    .bind(input.tier_id)
    .first<{ id: string; code: string; name: string }>();
  if (!tier) throw notFound('Không tìm thấy cấp giá');

  const validFrom = input.valid_from ?? vnDate();
  const now = nowIso();
  const approved = can(auth.user.role, 'price.approve');
  const status: 'ACTIVE' | 'DRAFT' = approved ? 'ACTIVE' : 'DRAFT';

  const current = await db
    .prepare(
      `SELECT id, amount, valid_from FROM product_prices
       WHERE product_id = ? AND tier_id = ? AND status = 'ACTIVE'
         AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)
       ORDER BY valid_from DESC LIMIT 1`,
    )
    .bind(input.product_id, input.tier_id, validFrom, validFrom)
    .first<{ id: string; amount: number | null; valid_from: string }>();

  const priceId = newId();
  const statements: D1PreparedStatement[] = [];

  if (approved && current) {
    // Đóng phiên bản đang chạy vào ngày liền trước ngày hiệu lực mới.
    const closeAt = new Date(new Date(`${validFrom}T00:00:00Z`).getTime() - 86_400_000)
      .toISOString()
      .slice(0, 10);
    statements.push(
      db
        .prepare('UPDATE product_prices SET valid_to = ?, updated_at = ? WHERE id = ?')
        .bind(closeAt, now, current.id),
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO product_prices (id, product_id, tier_id, amount, valid_from, valid_to, version,
           status, source, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL,
           (SELECT COALESCE(MAX(version), 0) + 1 FROM product_prices WHERE product_id = ? AND tier_id = ?),
           ?, 'MANUAL', ?, ?, ?)
         ON CONFLICT (product_id, tier_id, valid_from) DO UPDATE SET
           amount = excluded.amount, status = excluded.status, updated_at = excluded.updated_at`,
      )
      .bind(
        priceId,
        input.product_id,
        input.tier_id,
        input.amount,
        validFrom,
        input.product_id,
        input.tier_id,
        status,
        auth.user.id,
        now,
        now,
      ),
  );

  let approvalId: string | undefined;
  if (!approved) {
    approvalId = newId();
    statements.push(
      db
        .prepare(
          `INSERT INTO approvals (id, entity_type, entity_id, rule_code, requester_id, required_role,
             status, reason, payload_json, created_at)
           VALUES (?, 'PRICE_VERSION', ?, 'PRICE_VERSION', ?, 'CEO', 'PENDING', ?, ?, ?)`,
        )
        .bind(
          approvalId,
          priceId,
          auth.user.id,
          input.reason ?? null,
          JSON.stringify({
            product_id: product.id,
            sku: product.sku,
            product_name: product.name,
            tier_id: tier.id,
            tier_name: tier.name,
            old_amount: current?.amount ?? null,
            new_amount: input.amount,
            valid_from: validFrom,
          }),
          now,
        ),
    );
  }

  statements.push(
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'PRICE_VERSION_CREATED',
      entityType: 'PRODUCT_PRICE',
      entityId: priceId,
      before: current ? { amount: current.amount, valid_from: current.valid_from } : null,
      after: {
        sku: product.sku,
        tier: tier.name,
        amount: input.amount,
        valid_from: validFrom,
        status,
      },
      reason: input.reason ?? null,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  );

  await db.batch(statements);
  return { id: priceId, status, approval_id: approvalId };
}

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  unit: string | null;
  pack_size: string | null;
  group_id: string | null;
  group_name: string | null;
  active: number;
}

/** Bảng giá 8 cấp theo ngày hiệu lực; giá NULL trả về null để giao diện hiện "Chưa có". */
export async function listPriceTable(
  db: D1Database,
  onDate: string,
  options?: { q?: string; groupId?: string; onlyMissing?: boolean; limit?: number },
): Promise<{ tiers: Array<{ id: string; code: string; name: string; rank: number }>; products: ProductItem[] }> {
  const tierRows = await db
    .prepare('SELECT id, code, name, rank FROM price_tiers ORDER BY rank')
    .all<{ id: string; code: string; name: string; rank: number }>();
  const tiers = tierRows.results ?? [];

  const where: string[] = ['p.deleted_at IS NULL'];
  const params: unknown[] = [];
  if (options?.q) {
    where.push('(p.sku LIKE ? OR p.name LIKE ?)');
    params.push(`%${options.q}%`, `%${options.q}%`);
  }
  if (options?.groupId) {
    where.push('p.group_id = ?');
    params.push(options.groupId);
  }

  const productRows = await db
    .prepare(
      `SELECT p.id, p.sku, p.name, p.unit, p.pack_size, p.group_id, g.name AS group_name, p.active
       FROM products p LEFT JOIN product_groups g ON g.id = p.group_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.sku
       LIMIT ?`,
    )
    .bind(...params, options?.limit ?? 500)
    .all<ProductRow>();

  const products = productRows.results ?? [];
  const priceRows = await loadPriceRows(
    db,
    products.map((p) => p.id),
  );

  // Gom giá theo cặp (sản phẩm, cấp) TRƯỚC khi dò, thay vì quét lại toàn bộ danh sách giá
  // cho từng ô. Với 134 sản phẩm x 8 cấp, cách cũ tốn hàng triệu phép so sánh và làm
  // Cloudflare cắt request (lỗi 500 khi mở bảng giá).
  const rowsByKey = new Map<string, PriceRow[]>();
  for (const row of priceRows) {
    const key = `${row.product_id}|${row.tier_id}`;
    const list = rowsByKey.get(key);
    if (list) list.push(row);
    else rowsByKey.set(key, [row]);
  }

  const items: ProductItem[] = products.map((p) => {
    const prices: Record<string, number | null> = {};
    const missing: string[] = [];
    for (const tier of tiers) {
      const resolved = resolveEffectivePrice(
        rowsByKey.get(`${p.id}|${tier.id}`) ?? [],
        p.id,
        tier.id,
        onDate,
      );
      prices[tier.code] = resolved.amount;
      if (resolved.amount === null || resolved.amount === undefined) missing.push(tier.name);
    }
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      pack_size: p.pack_size,
      group_id: p.group_id,
      group_name: p.group_name,
      active: p.active,
      prices,
      missing_tiers: missing,
    };
  });

  return {
    tiers,
    products: options?.onlyMissing ? items.filter((i) => i.missing_tiers.length > 0) : items,
  };
}

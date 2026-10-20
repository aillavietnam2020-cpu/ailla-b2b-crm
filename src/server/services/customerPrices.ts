import type { PriceRow } from '@shared/pricing';
import type { CustomerPriceImportInput, CustomerPriceSetInput } from '@shared/schemas';
import type { CustomerPriceImportReport, CustomerPriceItem } from '@shared/types';
import { nowIso, vnDate } from '@shared/datetime';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { notFound } from '../lib/http';
import { newId } from '../lib/ids';

/**
 * Bảng giá riêng từng khách (khách gia công): mỗi khách một bảng, giá theo mã hàng và ngày hiệu lực.
 * Giá cũ không bị sửa mà đóng lại bằng valid_to; đơn đã chốt giữ giá đã lưu trong order_items.
 */

/** D1 chỉ cho tối đa 100 tham số mỗi câu truy vấn nên chia nhỏ danh sách mã. */
const SQL_PARAM_LIMIT = 90;
/** Số câu lệnh ghi tối đa trong một lần batch. */
const BATCH_SIZE = 80;

interface PriceRowDb {
  id: string;
  product_id: string;
  amount: number;
  valid_from: string;
  valid_to: string | null;
}

function dayBefore(date: string): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Giá riêng của khách cho một nhóm sản phẩm, dạng PriceRow để dùng chung resolveEffectivePrice. */
export async function loadCustomerPriceRows(
  db: D1Database,
  customerId: string,
  productIds: string[],
): Promise<PriceRow[]> {
  const results: PriceRow[] = [];
  for (const part of chunk(productIds, SQL_PARAM_LIMIT - 1)) {
    const rows = await db
      .prepare(
        `SELECT product_id, amount, valid_from, valid_to
         FROM customer_prices
         WHERE customer_id = ? AND product_id IN (${part.map(() => '?').join(',')})`,
      )
      .bind(customerId, ...part)
      .all<{ product_id: string; amount: number; valid_from: string; valid_to: string | null }>();
    for (const r of rows.results ?? []) {
      results.push({
        product_id: r.product_id,
        tier_id: customerId,
        amount: r.amount,
        valid_from: r.valid_from,
        valid_to: r.valid_to,
        status: 'ACTIVE',
      });
    }
  }
  return results;
}

async function requireCustomer(db: D1Database, customerId: string) {
  const row = await db
    .prepare('SELECT id, name, owner_id, price_mode FROM customers WHERE id = ? AND deleted_at IS NULL')
    .bind(customerId)
    .first<{ id: string; name: string; owner_id: string | null; price_mode: string }>();
  if (!row) throw notFound('Không tìm thấy khách hàng');
  return row;
}

export async function getCustomerForPrices(db: D1Database, auth: AuthContext, customerId: string) {
  const row = await requireCustomer(db, customerId);
  // Nhân viên chỉ xem bảng giá của khách mình phụ trách (404 để không lộ hồ sơ).
  if (auth.scope === 'OWN' && row.owner_id !== auth.user.id) throw notFound('Không tìm thấy khách hàng');
  return row;
}

/** Bảng giá đang hiệu lực của một khách tại một ngày. */
export async function listCustomerPrices(
  db: D1Database,
  customerId: string,
  onDate: string,
  q?: string,
): Promise<CustomerPriceItem[]> {
  const where = [
    'cp.customer_id = ?',
    'p.deleted_at IS NULL',
    'cp.valid_from <= ?',
    '(cp.valid_to IS NULL OR cp.valid_to >= ?)',
  ];
  const params: unknown[] = [customerId, onDate, onDate];
  if (q) {
    where.push('(p.sku LIKE ? OR p.name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  const rows = await db
    .prepare(
      `SELECT cp.product_id, p.sku, p.name, p.unit, p.pack_size, cp.amount, cp.valid_from
       FROM customer_prices cp JOIN products p ON p.id = cp.product_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.sku, cp.valid_from DESC`,
    )
    .bind(...params)
    .all<CustomerPriceItem>();
  const seen = new Set<string>();
  const out: CustomerPriceItem[] = [];
  for (const r of rows.results ?? []) {
    if (seen.has(r.product_id)) continue; // dòng đầu tiên là phiên bản mới nhất còn hiệu lực
    seen.add(r.product_id);
    out.push(r);
  }
  return out;
}

/** Các khách đang dùng bảng giá riêng, kèm số mã đã có giá. */
export async function listCustomPriceCustomers(db: D1Database, onDate: string) {
  const rows = await db
    .prepare(
      `SELECT c.id, c.name, c.phone_text, u.display_name AS owner_name,
              (SELECT COUNT(DISTINCT cp.product_id) FROM customer_prices cp
                WHERE cp.customer_id = c.id AND cp.valid_from <= ?
                  AND (cp.valid_to IS NULL OR cp.valid_to >= ?)) AS price_count
       FROM customers c LEFT JOIN users u ON u.id = c.owner_id
       WHERE c.deleted_at IS NULL AND c.price_mode = 'CUSTOM'
       ORDER BY c.name COLLATE NOCASE`,
    )
    .bind(onDate, onDate)
    .all<{ id: string; name: string; phone_text: string | null; owner_name: string | null; price_count: number }>();
  return rows.results ?? [];
}

type PlanResult = 'created' | 'changed' | 'unchanged' | 'removed' | 'none';

/**
 * Lập các câu lệnh để đưa giá (khách, sản phẩm) về `amount` từ ngày `validFrom`.
 * amount = null nghĩa là bỏ mã khỏi bảng giá từ ngày đó.
 */
function planChange(
  db: D1Database,
  customerId: string,
  productId: string,
  amount: number | null,
  validFrom: string,
  existing: PriceRowDb[],
  actorId: string,
  now: string,
  out: D1PreparedStatement[],
): PlanResult {
  const rows = existing
    .filter((r) => r.product_id === productId)
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from));
  const current = rows.find(
    (r) => r.valid_from <= validFrom && (!r.valid_to || r.valid_to >= validFrom),
  );

  if (amount === null) {
    if (!current) return 'none';
    if (current.valid_from >= validFrom) {
      out.push(db.prepare('DELETE FROM customer_prices WHERE id = ?').bind(current.id));
    } else {
      out.push(
        db
          .prepare('UPDATE customer_prices SET valid_to = ?, updated_at = ? WHERE id = ?')
          .bind(dayBefore(validFrom), now, current.id),
      );
    }
    out.push(
      db
        .prepare('DELETE FROM customer_prices WHERE customer_id = ? AND product_id = ? AND valid_from > ?')
        .bind(customerId, productId, validFrom),
    );
    return 'removed';
  }

  if (current && current.amount === amount && current.valid_from <= validFrom) return 'unchanged';

  const sameDay = rows.find((r) => r.valid_from === validFrom);
  if (sameDay) {
    out.push(
      db
        .prepare('UPDATE customer_prices SET amount = ?, valid_to = NULL, updated_at = ? WHERE id = ?')
        .bind(amount, now, sameDay.id),
    );
    return 'changed';
  }

  if (current) {
    out.push(
      db
        .prepare('UPDATE customer_prices SET valid_to = ?, updated_at = ? WHERE id = ?')
        .bind(dayBefore(validFrom), now, current.id),
    );
  }
  out.push(
    db
      .prepare(
        `INSERT INTO customer_prices (id, customer_id, product_id, amount, valid_from, valid_to,
           created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      )
      .bind(newId(), customerId, productId, amount, validFrom, actorId, now, now),
  );
  return current ? 'changed' : 'created';
}

async function loadExistingRows(
  db: D1Database,
  customerId: string,
  productIds: string[],
): Promise<PriceRowDb[]> {
  const all: PriceRowDb[] = [];
  for (const part of chunk(productIds, SQL_PARAM_LIMIT - 1)) {
    const rows = await db
      .prepare(
        `SELECT id, product_id, amount, valid_from, valid_to FROM customer_prices
         WHERE customer_id = ? AND product_id IN (${part.map(() => '?').join(',')})`,
      )
      .bind(customerId, ...part)
      .all<PriceRowDb>();
    all.push(...(rows.results ?? []));
  }
  return all;
}

async function runInBatches(db: D1Database, statements: D1PreparedStatement[]): Promise<void> {
  for (const part of chunk(statements, BATCH_SIZE)) await db.batch(part);
}

/** Đặt (hoặc bỏ) giá của một mã trong bảng giá riêng của khách. */
export async function setCustomerPrice(
  db: D1Database,
  auth: AuthContext,
  customerId: string,
  input: CustomerPriceSetInput,
  ctx: { requestId: string; ip: string | null },
): Promise<{ result: PlanResult }> {
  const customer = await requireCustomer(db, customerId);
  const product = await db
    .prepare('SELECT id, sku, name FROM products WHERE id = ? AND deleted_at IS NULL')
    .bind(input.product_id)
    .first<{ id: string; sku: string; name: string }>();
  if (!product) throw notFound('Không tìm thấy sản phẩm');

  const validFrom = input.valid_from ?? vnDate();
  const now = nowIso();
  const existing = await loadExistingRows(db, customerId, [product.id]);
  const statements: D1PreparedStatement[] = [];
  const result = planChange(db, customerId, product.id, input.amount, validFrom, existing, auth.user.id, now, statements);
  if (statements.length === 0) return { result };

  statements.push(
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'CUSTOMER_PRICE_SET',
      entityType: 'CUSTOMER',
      entityId: customerId,
      before: null,
      after: { customer: customer.name, sku: product.sku, amount: input.amount, valid_from: validFrom },
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  );
  await db.batch(statements);
  return { result };
}

/** Chuẩn hoá ĐVT trong file: Thùng/Can đều bán theo can, Chai bán theo chai. */
function normalizeUnit(raw: string | null | undefined, name?: string | null): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  const k = v.toLowerCase();
  if (k === 'chai') return 'Chai';
  if (k === 'thùng' || k === 'thung' || k === 'can') {
    // Giá tính theo từng can hoặc chai trong thùng; tên có chữ chai/ml/xịt thì là chai.
    return /chai|ml|xịt/i.test(name ?? '') ? 'Chai' : 'Can';
  }
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/**
 * Tải bảng giá hàng loạt cho một khách. Với dry_run = true chỉ trả báo cáo, không ghi gì
 * để chị xem trước (mã lạ, mã trùng, số giá đổi) rồi mới bấm áp dụng.
 */
export async function importCustomerPrices(
  db: D1Database,
  auth: AuthContext,
  customerId: string,
  input: CustomerPriceImportInput,
  ctx: { requestId: string; ip: string | null },
): Promise<CustomerPriceImportReport> {
  const customer = await requireCustomer(db, customerId);
  const validFrom = input.valid_from ?? vnDate();
  const dry = input.dry_run === true;
  const now = nowIso();

  // Mã trùng trong file: lấy dòng cuối cùng.
  const bySku = new Map<string, CustomerPriceImportInput['rows'][number]>();
  const duplicates = new Set<string>();
  for (const row of input.rows) {
    const key = row.sku.trim().toLowerCase();
    if (bySku.has(key)) duplicates.add(row.sku.trim());
    bySku.set(key, row);
  }
  const keys = [...bySku.keys()];

  const found = new Map<string, { id: string; sku: string }>();
  for (const part of chunk(keys, SQL_PARAM_LIMIT)) {
    const rows = await db
      .prepare(
        `SELECT id, sku FROM products
         WHERE deleted_at IS NULL AND lower(sku) IN (${part.map(() => '?').join(',')})`,
      )
      .bind(...part)
      .all<{ id: string; sku: string }>();
    for (const r of rows.results ?? []) found.set(r.sku.toLowerCase(), r);
  }

  const report: CustomerPriceImportReport = {
    dry_run: dry,
    total_rows: bySku.size,
    matched: 0,
    created_price: 0,
    changed_price: 0,
    unchanged: 0,
    products_created: 0,
    unknown_skus: [],
    duplicate_skus: [...duplicates],
    removed: 0,
  };

  const productStatements: D1PreparedStatement[] = [];
  const priceTargets: Array<{ productId: string; amount: number }> = [];

  for (const [key, row] of bySku) {
    const hit = found.get(key);
    if (hit) {
      priceTargets.push({ productId: hit.id, amount: row.amount });
      continue;
    }
    if (input.create_missing) {
      const id = newId();
      const unit = normalizeUnit(row.unit, row.name);
      const packQty = row.pack_qty ?? 0;
      const packSize = packQty > 1 ? `${packQty} ${(unit ?? 'can').toLowerCase()}/thùng` : null;
      productStatements.push(
        db
          .prepare(
            `INSERT INTO products (id, sku, name, unit, pack_size, group_id, active, price_scope,
               created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NULL, 1, 'CUSTOM', ?, ?)`,
          )
          .bind(id, row.sku.trim(), row.name?.trim() || row.sku.trim(), unit, packSize, now, now),
      );
      priceTargets.push({ productId: id, amount: row.amount });
      report.products_created += 1;
    } else {
      report.unknown_skus.push({ sku: row.sku.trim(), name: row.name ?? null });
    }
  }

  report.matched = priceTargets.length;

  const existing = await loadExistingRows(
    db,
    customerId,
    priceTargets.map((t) => t.productId),
  );
  const priceStatements: D1PreparedStatement[] = [];
  for (const t of priceTargets) {
    const res = planChange(db, customerId, t.productId, t.amount, validFrom, existing, auth.user.id, now, priceStatements);
    if (res === 'created') report.created_price += 1;
    else if (res === 'changed') report.changed_price += 1;
    else if (res === 'unchanged') report.unchanged += 1;
  }

  if (input.replace_all) {
    const keep = new Set(priceTargets.map((t) => t.productId));
    const active = await db
      .prepare(
        `SELECT id, product_id, amount, valid_from, valid_to FROM customer_prices
         WHERE customer_id = ? AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)`,
      )
      .bind(customerId, validFrom, validFrom)
      .all<PriceRowDb>();
    const activeRows = active.results ?? [];
    for (const productId of new Set(activeRows.map((r) => r.product_id))) {
      if (keep.has(productId)) continue;
      const res = planChange(db, customerId, productId, null, validFrom, activeRows, auth.user.id, now, priceStatements);
      if (res === 'removed') report.removed += 1;
    }
  }

  if (dry) return report;

  if (productStatements.length > 0) await runInBatches(db, productStatements);
  if (priceStatements.length > 0) await runInBatches(db, priceStatements);
  await db.batch([
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'CUSTOMER_PRICE_LIST_IMPORTED',
      entityType: 'CUSTOMER',
      entityId: customerId,
      before: null,
      after: {
        customer: customer.name,
        valid_from: validFrom,
        created: report.created_price,
        changed: report.changed_price,
        unchanged: report.unchanged,
        products_created: report.products_created,
        removed: report.removed,
      },
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
  return report;
}

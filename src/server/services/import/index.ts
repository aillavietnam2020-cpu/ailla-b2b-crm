/**
 * Import hai bước bắt buộc (mục 12.1):
 *   Bước 1 PREVIEW  - đọc file, chuẩn hoá, phát hiện lỗi, tính tổng, đối soát. KHÔNG ghi dữ liệu nghiệp vụ.
 *   Bước 2 COMMIT   - chỉ chạy khi người có quyền xác nhận đúng batch đã preview.
 * Batch chỉ được đánh dấu RECONCILED khi toàn bộ mốc đối soát khớp (mục 12.2).
 */
import { nowIso, vnDate } from '@shared/datetime';
import { TIER_ORDER, type TierCode } from '@shared/enums';
import type { ImportIssue, ImportPreviewResult, ReconciliationResult } from '@shared/types';
import type { AuthContext } from '../../env';
import { auditStatement } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http';
import { newId, sha256Hex } from '../../lib/ids';
import type { AppConfig } from '../../lib/settings';
import { parseWorkbook, type ParsedWorkbook } from './parser';

const TIER_ID_BY_CODE: Record<TierCode, string> = {
  GDKD: 'tier-gdkd',
  TPP: 'tier-tpp',
  NPP: 'tier-npp',
  TONG_DL: 'tier-tongdl',
  DL_C1: 'tier-dlc1',
  DL_C2: 'tier-dlc2',
  DAI_SU: 'tier-daisu',
  BAN_LE: 'tier-banle',
};

export interface ImportTotals {
  products: number;
  customers: number;
  source_orders: number;
  source_order_lines: number;
  managed_orders: number;
  payments: number;
  payments_total: number;
  opening_debt_total: number;
  official_debt_total: number;
  projected_debt_total: number;
  products_missing_price: number;
  customers_needs_review: number;
}

export function computeTotals(parsed: ParsedWorkbook): ImportTotals {
  const orderCodes = new Set(
    parsed.orderLines.map((l) => l.order_code).filter((code): code is string => Boolean(code)),
  );
  return {
    products: parsed.products.length,
    customers: parsed.customers.length,
    source_orders: orderCodes.size,
    source_order_lines: parsed.orderLines.length,
    managed_orders: parsed.orderStatuses.length,
    payments: parsed.payments.length,
    payments_total: parsed.payments.reduce((acc, p) => acc + p.amount, 0),
    opening_debt_total: parsed.debts.reduce((acc, d) => acc + (d.opening_debt ?? 0), 0),
    official_debt_total: parsed.debts.reduce((acc, d) => acc + (d.official_debt ?? 0), 0),
    projected_debt_total: parsed.debts.reduce((acc, d) => acc + (d.projected_debt ?? 0), 0),
    products_missing_price: parsed.products.filter((p) => p.missing_tiers.length > 0).length,
    customers_needs_review: parsed.customers.filter((c) => c.needs_review).length,
  };
}

const RECON_LABELS: Record<string, string> = {
  products: 'Số SKU',
  customers: 'Số khách hàng',
  source_orders: 'Số đơn nguồn',
  source_order_lines: 'Số dòng sản phẩm trong đơn',
  managed_orders: 'Số đơn ở sheet quản lý',
  payments: 'Số giao dịch thanh toán',
  payments_total: 'Tổng tiền thanh toán',
  opening_debt_total: 'Dư nợ cũ',
  official_debt_total: 'Công nợ chính thức',
  projected_debt_total: 'Công nợ dự kiến',
};

export function reconcile(totals: ImportTotals, baseline: Record<string, number>): ReconciliationResult {
  const lines = Object.keys(RECON_LABELS)
    .filter((key) => baseline[key] !== undefined)
    .map((key) => {
      const expected = baseline[key];
      const actual = (totals as unknown as Record<string, number>)[key] ?? 0;
      return {
        key,
        label: RECON_LABELS[key],
        expected,
        actual,
        diff: actual - expected,
        ok: actual === expected,
      };
    });
  return { ok: lines.every((l) => l.ok), lines };
}

async function saveIssues(db: D1Database, batchId: string, issues: ImportIssue[]): Promise<void> {
  const now = nowIso();
  const chunkSize = 40;
  for (let i = 0; i < issues.length; i += chunkSize) {
    const chunk = issues.slice(i, i + chunkSize);
    await db.batch(
      chunk.map((issue) =>
        db
          .prepare(
            `INSERT INTO import_errors (id, batch_id, sheet, row_no, field, code, message, severity, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            newId(),
            batchId,
            issue.sheet,
            issue.row_no,
            issue.field,
            issue.code,
            issue.message,
            issue.severity,
            now,
          ),
      ),
    );
  }
}

export interface PreviewOptions {
  fileName: string;
  bytes: ArrayBuffer | Uint8Array;
  r2Key?: string | null;
  ctx: { requestId: string; ip: string | null };
}

export async function previewImport(
  db: D1Database,
  config: AppConfig,
  auth: AuthContext,
  options: PreviewOptions,
): Promise<ImportPreviewResult> {
  const parsed = parseWorkbook(options.bytes);
  const totals = computeTotals(parsed);
  const reconciliation = reconcile(totals, config.reconciliationBaseline);
  const bytes = options.bytes instanceof Uint8Array ? options.bytes : new Uint8Array(options.bytes);
  const checksum = await sha256Hex(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

  const issues = [...parsed.issues];
  if (!reconciliation.ok) {
    for (const line of reconciliation.lines.filter((l) => !l.ok)) {
      issues.push({
        sheet: 'ĐỐI SOÁT',
        row_no: null,
        field: line.key,
        code: 'RECONCILIATION_MISMATCH',
        message: `${line.label}: mốc tài liệu ${line.expected.toLocaleString('vi-VN')} nhưng file cho ${line.actual.toLocaleString('vi-VN')} (lệch ${line.diff.toLocaleString('vi-VN')}).`,
        severity: 'ERROR',
      });
    }
  }

  const batchId = newId();
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO import_batches (id, file_name, checksum, type, status, totals_json, reconciliation_json,
         r2_key, started_by, created_at)
       VALUES (?, ?, ?, 'FULL_WORKBOOK', 'PREVIEW', ?, ?, ?, ?, ?)`,
    )
    .bind(
      batchId,
      options.fileName,
      checksum,
      JSON.stringify(totals),
      JSON.stringify(reconciliation),
      options.r2Key ?? null,
      auth.user.id,
      now,
    )
    .run();

  await saveIssues(db, batchId, issues);
  await auditStatement(db, {
    actorId: auth.user.id,
    action: 'IMPORT_PREVIEWED',
    entityType: 'IMPORT_BATCH',
    entityId: batchId,
    after: { file_name: options.fileName, totals, reconciled: reconciliation.ok },
    requestId: options.ctx.requestId,
    ip: options.ctx.ip,
  }).run();

  return {
    batch_id: batchId,
    file_name: options.fileName,
    checksum,
    totals: totals as unknown as Record<string, number>,
    reconciliation,
    issues,
    issue_counts: {
      errors: issues.filter((i) => i.severity === 'ERROR').length,
      warnings: issues.filter((i) => i.severity === 'WARNING').length,
      infos: issues.filter((i) => i.severity === 'INFO').length,
    },
  };
}

export interface CommitOptions {
  batchId: string;
  bytes: ArrayBuffer | Uint8Array;
  force?: boolean;
  ctx: { requestId: string; ip: string | null };
}

export interface CommitResult {
  batch_id: string;
  status: 'COMMITTED' | 'RECONCILED';
  inserted: Record<string, number>;
  reconciliation: ReconciliationResult;
}

export async function commitImport(
  db: D1Database,
  config: AppConfig,
  auth: AuthContext,
  options: CommitOptions,
): Promise<CommitResult> {
  const batch = await db
    .prepare('SELECT * FROM import_batches WHERE id = ?')
    .bind(options.batchId)
    .first<{ id: string; checksum: string; status: string; file_name: string }>();
  if (!batch) throw notFound('Không tìm thấy batch import');
  if (batch.status !== 'PREVIEW') {
    throw badRequest('BATCH_NOT_PREVIEW', 'Batch này đã được commit hoặc đã bị huỷ.');
  }

  const bytes = options.bytes instanceof Uint8Array ? options.bytes : new Uint8Array(options.bytes);
  const checksum = await sha256Hex(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  if (checksum !== batch.checksum) {
    throw badRequest(
      'CHECKSUM_MISMATCH',
      'File commit khác với file đã preview. Hãy preview lại để tránh ghi nhầm dữ liệu.',
    );
  }

  const parsed = parseWorkbook(bytes);
  const totals = computeTotals(parsed);
  const reconciliation = reconcile(totals, config.reconciliationBaseline);
  const now = nowIso();
  const today = vnDate();
  const inserted: Record<string, number> = {
    product_groups: 0,
    products: 0,
    product_prices: 0,
    customers: 0,
    orders: 0,
    order_items: 0,
    payments: 0,
    activities: 0,
    pending_allocations: 0,
  };

  const runChunked = async (statements: D1PreparedStatement[]) => {
    const size = 40;
    for (let i = 0; i < statements.length; i += size) {
      await db.batch(statements.slice(i, i + size));
    }
  };

  // ---- Nhóm sản phẩm + sản phẩm + giá ---------------------------------------
  const groupNames = [...new Set(parsed.products.map((p) => p.group_name).filter(Boolean))] as string[];
  const groupIdByName = new Map<string, string>();
  const existingGroups = await db.prepare('SELECT id, name FROM product_groups').all<{ id: string; name: string }>();
  for (const g of existingGroups.results ?? []) groupIdByName.set(g.name, g.id);

  const groupStatements: D1PreparedStatement[] = [];
  for (const name of groupNames) {
    if (groupIdByName.has(name)) continue;
    const id = newId();
    groupIdByName.set(name, id);
    inserted.product_groups += 1;
    groupStatements.push(
      db
        .prepare('INSERT INTO product_groups (id, code, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, name.slice(0, 40), name, now, now),
    );
  }
  await runChunked(groupStatements);

  const existingProducts = await db.prepare('SELECT id, sku FROM products').all<{ id: string; sku: string }>();
  const productIdBySku = new Map((existingProducts.results ?? []).map((p) => [p.sku, p.id]));

  const productStatements: D1PreparedStatement[] = [];
  for (const product of parsed.products) {
    let productId = productIdBySku.get(product.sku);
    if (!productId) {
      productId = newId();
      productIdBySku.set(product.sku, productId);
      inserted.products += 1;
      productStatements.push(
        db
          .prepare(
            `INSERT INTO products (id, sku, name, unit, pack_size, group_id, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          )
          .bind(
            productId,
            product.sku,
            product.name,
            product.unit,
            product.pack_size,
            product.group_name ? (groupIdByName.get(product.group_name) ?? null) : null,
            now,
            now,
          ),
      );
    }

    for (const code of TIER_ORDER) {
      const amount = product.prices[code];
      // Giá NULL vẫn tạo dòng để hiển thị "Chưa có" và chặn bán, nhưng amount giữ NULL.
      inserted.product_prices += 1;
      productStatements.push(
        db
          .prepare(
            `INSERT INTO product_prices (id, product_id, tier_id, amount, valid_from, valid_to, version,
               status, source, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NULL, 1, 'ACTIVE', ?, ?, ?, ?)
             ON CONFLICT (product_id, tier_id, valid_from) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
          )
          .bind(newId(), productId, TIER_ID_BY_CODE[code], amount, today, `import:${options.batchId}`, auth.user.id, now, now),
      );
    }
  }
  await runChunked(productStatements);

  // ---- Khách hàng -----------------------------------------------------------
  const userRows = await db
    .prepare('SELECT id, display_name, legacy_name FROM users WHERE deleted_at IS NULL')
    .all<{ id: string; display_name: string; legacy_name: string | null }>();
  const ownerIdByLegacy = new Map<string, string>();
  for (const u of userRows.results ?? []) {
    if (u.legacy_name) ownerIdByLegacy.set(u.legacy_name.toLowerCase(), u.id);
    ownerIdByLegacy.set(u.display_name.toLowerCase(), u.id);
  }

  const existingCustomers = await db
    .prepare('SELECT id, legacy_code FROM customers WHERE legacy_code IS NOT NULL')
    .all<{ id: string; legacy_code: string }>();
  const customerIdByLegacy = new Map((existingCustomers.results ?? []).map((c) => [c.legacy_code, c.id]));

  const debtByCustomer = new Map(parsed.debts.map((d) => [d.customer_legacy_code, d]));
  const customerStatements: D1PreparedStatement[] = [];

  for (const customer of parsed.customers) {
    if (customerIdByLegacy.has(customer.legacy_code)) continue;
    const id = newId();
    customerIdByLegacy.set(customer.legacy_code, id);
    inserted.customers += 1;

    const ownerId = customer.owner_legacy_name
      ? (ownerIdByLegacy.get(customer.owner_legacy_name.toLowerCase()) ?? null)
      : null;
    const debtRow = debtByCustomer.get(customer.legacy_code);
    const opening = debtRow?.opening_debt ?? customer.opening_debt ?? 0;

    customerStatements.push(
      db
        .prepare(
          `INSERT INTO customers (id, legacy_code, name, phone_text, phone_normalized, province, address,
             tier_id, legacy_tier_label, owner_id, source, stage, opening_debt, opening_debt_batch,
             data_quality, data_quality_note, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'NEW', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          customer.legacy_code,
          customer.name,
          customer.phone_text,
          customer.phone_normalized,
          customer.province,
          customer.address,
          customer.tier_code ? TIER_ID_BY_CODE[customer.tier_code] : null,
          customer.tier_label,
          ownerId,
          opening,
          options.batchId,
          customer.needs_review ? 'NEEDS_REVIEW' : 'OK',
          customer.review_notes.join('; ') || null,
          auth.user.id,
          now,
          now,
        ),
    );
  }
  await runChunked(customerStatements);

  // ---- Đơn hàng nguồn + trạng thái -----------------------------------------
  const statusByCode = new Map(parsed.orderStatuses.map((s) => [s.order_code, s]));
  const linesByOrder = new Map<string, typeof parsed.orderLines>();
  for (const line of parsed.orderLines) {
    const key = line.order_code ?? `CHUA_KHAI_BAO`;
    const list = linesByOrder.get(key) ?? [];
    list.push(line);
    linesByOrder.set(key, list);
  }

  const orderStatements: D1PreparedStatement[] = [];
  const orderIdByCode = new Map<string, string>();
  const errorStatements: D1PreparedStatement[] = [];

  for (const [orderCode, lines] of linesByOrder) {
    const first = lines[0];

    if (orderCode === 'CHUA_KHAI_BAO') {
      // Dòng chưa khai báo mã đơn: KHÔNG bỏ, không tự tạo đơn giả - đưa vào hàng chờ xử lý.
      for (const line of lines) {
        errorStatements.push(
          db
            .prepare(
              `INSERT INTO import_errors (id, batch_id, sheet, row_no, field, code, message, severity, raw_json, created_at)
               VALUES (?, ?, 'TAO_DON_HANG', ?, 'order_code', 'ORDER_CODE_MISSING', ?, 'WARNING', ?, ?)`,
            )
            .bind(
              newId(),
              options.batchId,
              line.row_no,
              `Dòng ${line.row_no} chưa khai báo mã đơn - giữ trong hàng chờ xử lý, chưa tạo đơn.`,
              JSON.stringify(line),
              now,
            ),
        );
      }
      continue;
    }

    const customerId = first.customer_legacy_code
      ? customerIdByLegacy.get(first.customer_legacy_code)
      : undefined;
    if (!customerId) {
      errorStatements.push(
        db
          .prepare(
            `INSERT INTO import_errors (id, batch_id, sheet, row_no, field, code, message, severity, raw_json, created_at)
             VALUES (?, ?, 'TAO_DON_HANG', ?, 'customer', 'CUSTOMER_NOT_MAPPED', ?, 'ERROR', ?, ?)`,
          )
          .bind(
            newId(),
            options.batchId,
            first.row_no,
            `Đơn ${orderCode} không map được khách hàng "${first.customer_legacy_code ?? ''}" - đưa vào hàng chờ xử lý.`,
            JSON.stringify(first),
            now,
          ),
      );
      continue;
    }

    const status = statusByCode.get(orderCode);
    const orderId = newId();
    orderIdByCode.set(orderCode, orderId);
    const orderDate = first.order_date ?? today;

    let subtotal = 0;
    const itemStatements: D1PreparedStatement[] = [];
    for (const line of lines) {
      const productId = line.sku ? productIdBySku.get(line.sku) : undefined;
      if (!productId || !line.qty) {
        errorStatements.push(
          db
            .prepare(
              `INSERT INTO import_errors (id, batch_id, sheet, row_no, field, code, message, severity, raw_json, created_at)
               VALUES (?, ?, 'TAO_DON_HANG', ?, 'sku', 'LINE_NOT_MAPPED', ?, 'ERROR', ?, ?)`,
            )
            .bind(
              newId(),
              options.batchId,
              line.row_no,
              `Dòng ${line.row_no}: không map được mã hàng "${line.sku ?? ''}" hoặc thiếu số lượng.`,
              JSON.stringify(line),
              now,
            ),
        );
        continue;
      }
      const price = line.unit_price ?? 0;
      const lineTotal = price * line.qty;
      subtotal += lineTotal;
      inserted.order_items += 1;
      itemStatements.push(
        db
          .prepare(
            `INSERT INTO order_items (id, order_id, product_id, qty, base_price, applied_price, line_total,
               price_override, tier_id_snapshot, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
          )
          .bind(newId(), orderId, productId, line.qty, price, price, lineTotal, now),
      );
    }

    const shipping = status?.shipping_fee ?? 0;
    const discount = status?.discount_amount ?? 0;
    const bonus = status?.bonus_deduction ?? 0;
    const cod = status?.cod_amount ?? 0;
    const total = subtotal - discount - bonus + shipping;
    inserted.orders += 1;

    orderStatements.push(
      db
        .prepare(
          `INSERT INTO orders (id, order_no, legacy_order_code, customer_id, owner_id, order_date, subtotal,
             discount_amount, bonus_deduction, shipping_fee, total_amount, cod_amount, approval_status,
             delivery_status, payment_status, accounting_status, accounting_confirmed_at, delivered_at,
             data_quality, import_batch_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, (SELECT owner_id FROM customers WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, 'APPROVED',
             ?, 'CHUA_THU', ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          orderId,
          `IMP-${orderCode}`,
          orderCode,
          customerId,
          customerId,
          orderDate,
          subtotal,
          discount,
          bonus,
          shipping,
          total,
          cod,
          status?.delivery_status ?? 'CHUA_XUAT',
          status?.accounting_confirmed ? 'DA_XAC_NHAN' : 'CHUA_XAC_NHAN',
          status?.accounting_confirmed ? now : null,
          status?.delivery_status === 'DA_GIAO' || status?.delivery_status === 'DA_XUAT_KHO' ? now : null,
          status ? 'OK' : 'NEEDS_REVIEW',
          options.batchId,
          auth.user.id,
          now,
          now,
        ),
      ...itemStatements,
    );
  }

  // Đơn có ở sheet quản lý nhưng không có ở sheet nguồn -> cảnh báo, không bỏ qua im lặng.
  for (const status of parsed.orderStatuses) {
    if (orderIdByCode.has(status.order_code)) continue;
    errorStatements.push(
      db
        .prepare(
          `INSERT INTO import_errors (id, batch_id, sheet, row_no, field, code, message, severity, created_at)
           VALUES (?, ?, 'QUAN_LY_DON_HANG', ?, 'order_code', 'ORDER_NOT_IN_SOURCE', ?, 'WARNING', ?)`,
        )
        .bind(
          newId(),
          options.batchId,
          status.row_no,
          `Đơn ${status.order_code} có ở sheet quản lý nhưng không tìm thấy dòng sản phẩm ở sheet nguồn.`,
          now,
        ),
    );
  }

  await runChunked(orderStatements);

  // ---- Thanh toán -----------------------------------------------------------
  const paymentStatements: D1PreparedStatement[] = [];
  for (const payment of parsed.payments) {
    const customerId = payment.customer_legacy_code
      ? customerIdByLegacy.get(payment.customer_legacy_code)
      : undefined;
    if (!customerId) {
      errorStatements.push(
        db
          .prepare(
            `INSERT INTO import_errors (id, batch_id, sheet, row_no, field, code, message, severity, raw_json, created_at)
             VALUES (?, ?, 'THANH_TOAN', ?, 'customer', 'CUSTOMER_NOT_MAPPED', ?, 'ERROR', ?, ?)`,
          )
          .bind(
            newId(),
            options.batchId,
            payment.row_no,
            `Phiếu thu dòng ${payment.row_no} không map được khách hàng.`,
            JSON.stringify(payment),
            now,
          ),
      );
      continue;
    }

    const paymentId = newId();
    inserted.payments += 1;
    paymentStatements.push(
      db
        .prepare(
          `INSERT INTO payments (id, external_receipt_no, source, external_row_key, customer_id, amount,
             paid_at, method, accounting_status, review_status, is_general_repayment, note, import_batch_id,
             created_by, created_at, updated_at)
           VALUES (?, ?, 'IMPORT', ?, ?, ?, ?, ?, 'CHUA_XAC_NHAN', ?, ?, NULL, ?, ?, ?, ?)
           ON CONFLICT (source, external_row_key) WHERE external_row_key IS NOT NULL DO NOTHING`,
        )
        .bind(
          paymentId,
          payment.receipt_no,
          payment.external_row_key,
          customerId,
          payment.amount,
          payment.paid_at ?? today,
          payment.method,
          payment.needs_review ? 'NEEDS_REVIEW' : 'OK',
          payment.is_general_repayment ? 1 : 0,
          options.batchId,
          auth.user.id,
          now,
          now,
        ),
    );

    if (payment.is_general_repayment) {
      inserted.pending_allocations += 1;
      paymentStatements.push(
        db
          .prepare(
            `INSERT INTO payment_allocations_pending (id, payment_id, customer_id, amount, reason, status, created_at)
             VALUES (?, ?, ?, ?, 'Khoản trả nợ chung từ file Excel - chờ phân bổ', 'PENDING', ?)`,
          )
          .bind(newId(), paymentId, customerId, payment.amount, now),
      );
    } else if (payment.order_code) {
      const orderId = orderIdByCode.get(payment.order_code);
      if (orderId) {
        paymentStatements.push(
          db
            .prepare(
              `INSERT INTO payment_allocations (id, payment_id, order_id, amount, allocated_by, created_at)
               VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (payment_id, order_id) DO NOTHING`,
            )
            .bind(newId(), paymentId, orderId, payment.amount, auth.user.id, now),
        );
      }
    }
  }
  await runChunked(paymentStatements);

  // ---- Nhật ký chăm sóc (giữ dòng hợp lệ, không tạo dòng rỗng) --------------
  const activityStatements: D1PreparedStatement[] = [];
  for (const activity of parsed.activities) {
    const customerId = activity.customer_legacy_code
      ? customerIdByLegacy.get(activity.customer_legacy_code)
      : undefined;
    if (!customerId || !activity.content) continue;
    const userId = activity.owner_legacy_name
      ? (ownerIdByLegacy.get(activity.owner_legacy_name.toLowerCase()) ?? auth.user.id)
      : auth.user.id;
    inserted.activities += 1;
    activityStatements.push(
      db
        .prepare(
          `INSERT INTO customer_activities (id, customer_id, user_id, channel, result, content,
             next_action, next_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          customerId,
          userId,
          activity.channel ?? 'Khác',
          activity.result ?? 'Đã trao đổi',
          activity.content,
          activity.next_action,
          activity.next_date,
          activity.created_at ? `${activity.created_at}T00:00:00.000Z` : now,
        ),
    );
  }
  await runChunked(activityStatements);
  await runChunked(errorStatements);

  // ---- Chốt batch -----------------------------------------------------------
  const status: 'COMMITTED' | 'RECONCILED' = reconciliation.ok ? 'RECONCILED' : 'COMMITTED';
  await db.batch([
    db
      .prepare(
        `UPDATE import_batches SET status = ?, committed_at = ?, totals_json = ?, reconciliation_json = ? WHERE id = ?`,
      )
      .bind(status, now, JSON.stringify(totals), JSON.stringify(reconciliation), options.batchId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'IMPORT_COMMITTED',
      entityType: 'IMPORT_BATCH',
      entityId: options.batchId,
      after: { status, totals, inserted },
      requestId: options.ctx.requestId,
      ip: options.ctx.ip,
    }),
  ]);

  if (!reconciliation.ok) {
    await db
      .prepare(
        `INSERT INTO alerts (id, code, entity_type, entity_id, severity, message, data_json, status, created_at)
         VALUES (?, 'IMPORT_RECONCILIATION_FAILED', 'IMPORT_BATCH', ?, 'CRITICAL', ?, ?, 'OPEN', ?)
         ON CONFLICT DO NOTHING`,
      )
      .bind(
        newId(),
        options.batchId,
        `Batch ${batch.file_name} lệch mốc đối soát - chưa được đánh dấu RECONCILED.`,
        JSON.stringify(reconciliation),
        now,
      )
      .run();
  }

  return { batch_id: options.batchId, status, inserted, reconciliation };
}

/** Rollback toàn bộ bản ghi của một batch (mục 5: "rollback batch"). */
export async function rollbackImport(
  db: D1Database,
  auth: AuthContext,
  batchId: string,
  ctx: { requestId: string; ip: string | null },
): Promise<{ status: string }> {
  const batch = await db
    .prepare('SELECT id, status FROM import_batches WHERE id = ?')
    .bind(batchId)
    .first<{ id: string; status: string }>();
  if (!batch) throw notFound('Không tìm thấy batch import');
  if (batch.status !== 'COMMITTED' && batch.status !== 'RECONCILED') {
    throw badRequest('BATCH_NOT_COMMITTED', 'Chỉ batch đã commit mới cần rollback.');
  }

  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE import_batch_id = ?)`,
      )
      .bind(batchId),
    db
      .prepare(
        `DELETE FROM payment_allocations_pending WHERE payment_id IN (SELECT id FROM payments WHERE import_batch_id = ?)`,
      )
      .bind(batchId),
    db.prepare('DELETE FROM payments WHERE import_batch_id = ?').bind(batchId),
    db
      .prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE import_batch_id = ?)')
      .bind(batchId),
    db.prepare('DELETE FROM orders WHERE import_batch_id = ?').bind(batchId),
    // Dọn bản ghi tham chiếu tới khách của batch trước khi xoá khách (ràng buộc khoá ngoại).
    db
      .prepare(
        'DELETE FROM customer_activities WHERE customer_id IN (SELECT id FROM customers WHERE opening_debt_batch = ?)',
      )
      .bind(batchId),
    db
      .prepare('DELETE FROM tasks WHERE customer_id IN (SELECT id FROM customers WHERE opening_debt_batch = ?)')
      .bind(batchId),
    db
      .prepare(
        `DELETE FROM alerts WHERE entity_type = 'CUSTOMER'
         AND entity_id IN (SELECT id FROM customers WHERE opening_debt_batch = ?)`,
      )
      .bind(batchId),
    db
      .prepare(
        'DELETE FROM customer_credit_balances WHERE customer_id IN (SELECT id FROM customers WHERE opening_debt_batch = ?)',
      )
      .bind(batchId),
    db
      .prepare(
        'DELETE FROM debt_snapshots WHERE customer_id IN (SELECT id FROM customers WHERE opening_debt_batch = ?)',
      )
      .bind(batchId),
    db.prepare('DELETE FROM customers WHERE opening_debt_batch = ?').bind(batchId),
    db.prepare(`UPDATE import_batches SET status = 'ROLLED_BACK', rolled_back_at = ? WHERE id = ?`).bind(now, batchId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'IMPORT_ROLLED_BACK',
      entityType: 'IMPORT_BATCH',
      entityId: batchId,
      after: { status: 'ROLLED_BACK' },
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);

  return { status: 'ROLLED_BACK' };
}

export { parseWorkbook };

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
import { parseWorkbook, type ParsedWorkbook, type ParseScope } from './parser';

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
  managed_orders_total: number;
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
    // Tổng phải thu của các đơn ở sheet quản lý: chốt để không lọt lỗi đọc nhầm cột giá.
    managed_orders_total: parsed.orderStatuses.reduce(
      (acc, o) => acc + (o.total_due ?? 0),
      0,
    ),
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
  managed_orders_total: 'Tổng phải thu của các đơn',
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
  // Chi mo nhung sheet thuc su dung: file that co 17 sheet, trong do nhieu sheet la bao cao
  // va bieu mau in an - mo het se vuot han muc xu ly cua Cloudflare Workers.
  const parsed = parseWorkbook(options.bytes, [
    'products',
    'customers',
    'orders',
    'payments',
    'activities',
  ]);
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

/**
 * Ghi dữ liệu theo từng CHẶNG. File thật có hơn 1.400 bản ghi, ghi hết trong một request
 * sẽ vượt hạn mức xử lý của Cloudflare Workers, nên mỗi chặng là một request riêng.
 */
export const COMMIT_PHASES = ['catalog', 'customers', 'orders', 'payments', 'finalize'] as const;
export type CommitPhase = (typeof COMMIT_PHASES)[number];

export const COMMIT_PHASE_LABELS: Record<CommitPhase, string> = {
  catalog: 'Sản phẩm và bảng giá',
  customers: 'Khách hàng',
  orders: 'Đơn hàng và dòng hàng',
  payments: 'Thanh toán và chăm sóc',
  finalize: 'Đối soát và chốt batch',
};

export interface CommitOptions {
  batchId: string;
  bytes: ArrayBuffer | Uint8Array;
  force?: boolean;
  /** Bỏ trống thì chạy chặng còn dở tiếp theo. */
  phase?: CommitPhase;
  /**
   * true = chỉ chạy MỘT chặng rồi trả về (Cloudflare Workers có hạn mức xử lý mỗi request).
   * false/bỏ trống = chạy lần lượt hết các chặng trong cùng lời gọi (dùng cho test và file nhỏ).
   */
  singlePhase?: boolean;
  ctx: { requestId: string; ip: string | null };
}

export interface CommitResult {
  batch_id: string;
  status: 'COMMITTED' | 'RECONCILED' | 'IN_PROGRESS';
  inserted: Record<string, number>;
  reconciliation: ReconciliationResult;
  /** Chặng vừa chạy xong và chặng kế tiếp cần gọi (null = đã xong hết). */
  phase?: CommitPhase;
  next_phase?: CommitPhase | null;
  phase_label?: string;
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
    .first<{
      id: string;
      checksum: string;
      type: string;
      status: string;
      file_name: string;
      progress_json: string | null;
      totals_json: string | null;
    }>();
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

  // Cùng một nội dung đã được chốt trước đó: trả kết quả cũ như một no-op thành
  // công. Batch preview mới được đóng lại để không tích tụ bản ghi treo và cũng
  // không vi phạm unique index (checksum, type) khi chuyển sang COMMITTED.
  const previousCommit = await db
    .prepare(
      `SELECT id, status, reconciliation_json FROM import_batches
       WHERE checksum = ? AND type = ? AND status IN ('COMMITTED', 'RECONCILED')
       ORDER BY committed_at DESC LIMIT 1`,
    )
    .bind(batch.checksum, batch.type)
    .first<{
      id: string;
      status: 'COMMITTED' | 'RECONCILED';
      reconciliation_json: string | null;
    }>();
  if (previousCommit) {
    await db
      .prepare("UPDATE import_batches SET status = 'ROLLED_BACK', rolled_back_at = ? WHERE id = ?")
      .bind(nowIso(), options.batchId)
      .run();
    return {
      batch_id: previousCommit.id,
      status: previousCommit.status,
      inserted: {
        product_groups: 0,
        products: 0,
        product_prices: 0,
        customers: 0,
        orders: 0,
        order_items: 0,
        payments: 0,
        activities: 0,
        pending_allocations: 0,
      },
      reconciliation: previousCommit.reconciliation_json
        ? (JSON.parse(previousCommit.reconciliation_json) as ReconciliationResult)
        : { ok: false, lines: [] },
    };
  }

  // Gọi không chỉ định chặng và không bật singlePhase: chạy tuần tự hết các chặng.
  if (!options.phase && !options.singlePhase) {
    let last: CommitResult | null = null;
    for (const p of COMMIT_PHASES) {
      last = await commitImport(db, config, auth, { ...options, phase: p });
    }
    return last as CommitResult;
  }

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

  // ---- Chia commit thành từng chặng ---------------------------------------
  // Mỗi request chỉ chạy MỘT chặng rồi ghi lại tiến độ, tránh vượt hạn mức xử lý.
  const donePhases: CommitPhase[] = batch.progress_json
    ? (JSON.parse(batch.progress_json) as CommitPhase[])
    : [];
  const phase: CommitPhase =
    options.phase ?? (COMMIT_PHASES.find((p) => !donePhases.includes(p)) ?? 'finalize');

  // Mỗi chặng chỉ đọc đúng nhóm dữ liệu của mình để không vượt hạn mức xử lý.
  const SCOPE_BY_PHASE: Record<CommitPhase, ParseScope[]> = {
    catalog: ['products'],
    // Dư nợ cũ lấy từ sheet CONG_NO (nguồn chuẩn); ô dư nợ ở KHACH_HANG có thể trống với khách có số âm.
    customers: ['customers', 'debts'],
    orders: ['orders'],
    payments: ['payments', 'activities'],
    // Chặng chốt chỉ cần các con số tổng, lấy lại từ kết quả preview đã lưu trong batch
    // thay vì đọc lại toàn bộ file (đọc lại sẽ vượt hạn mức xử lý).
    finalize: [],
  };
  const parsed = parseWorkbook(bytes, SCOPE_BY_PHASE[phase]);
  // Chặng chốt dùng lại tổng đã tính ở bước preview (đã lưu trong batch).
  const totals =
    phase === 'finalize' && batch.totals_json
      ? (JSON.parse(batch.totals_json) as ImportTotals)
      : computeTotals(parsed);
  const reconciliation = reconcile(totals, config.reconciliationBaseline);
  const now = nowIso();
  const today = vnDate();

  // Khong cho chot batch khi con chang chua chay xong - de tranh tinh trang da ghi thanh toan
  // nhung chua ghi don hang.
  if (phase === 'finalize') {
    const missing = COMMIT_PHASES.filter((p) => p !== 'finalize' && !donePhases.includes(p));
    if (missing.length > 0) {
      throw badRequest(
        'PHASES_INCOMPLETE',
        `Chưa ghi xong các phần: ${missing.map((p) => COMMIT_PHASE_LABELS[p]).join(', ')}. Bấm "Ghi dữ liệu" lại để chạy tiếp.`,
      );
    }
  }

  const finishPhase = async (current: CommitPhase): Promise<CommitResult> => {
    const done = [...new Set([...donePhases, current])];
    await db
      .prepare('UPDATE import_batches SET progress_json = ? WHERE id = ?')
      .bind(JSON.stringify(done), batch.id)
      .run();
    const next = COMMIT_PHASES.find((p) => !done.includes(p)) ?? null;
    return {
      batch_id: batch.id,
      status: 'IN_PROGRESS',
      inserted,
      reconciliation,
      phase: current,
      next_phase: next,
      phase_label: COMMIT_PHASE_LABELS[current],
    };
  };

  /** Bảng tra cứu dựng lại từ database, vì mỗi chặng chạy trong một request riêng. */
  const loadMaps = async () => {
    const [products, customers, users, orders] = await Promise.all([
      db.prepare('SELECT id, sku FROM products').all<{ id: string; sku: string }>(),
      db
        .prepare('SELECT id, legacy_code FROM customers WHERE legacy_code IS NOT NULL')
        .all<{ id: string; legacy_code: string }>(),
      db
        .prepare('SELECT id, display_name, legacy_name FROM users WHERE deleted_at IS NULL')
        .all<{ id: string; display_name: string; legacy_name: string | null }>(),
      db
        .prepare('SELECT id, legacy_order_code FROM orders WHERE legacy_order_code IS NOT NULL')
        .all<{ id: string; legacy_order_code: string }>(),
    ]);
    const owners = new Map<string, string>();
    for (const u of users.results ?? []) {
      if (u.legacy_name) owners.set(u.legacy_name.toLowerCase(), u.id);
      owners.set(u.display_name.toLowerCase(), u.id);
    }
    return {
      // Khop ma hang KHONG phan biet hoa/thuong: file that co 'TOILET1l' o bang gia
      // nhung dong don ghi 'Toilet1l', truoc day bi coi la ma la va bo dong.
      products: new Map((products.results ?? []).map((r) => [r.sku.trim().toLowerCase(), r.id])),
      customers: new Map((customers.results ?? []).map((r) => [r.legacy_code, r.id])),
      owners,
      orders: new Map((orders.results ?? []).map((r) => [r.legacy_order_code, r.id])),
    };
  };

  if (phase === 'catalog') {
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
  const productIdBySku = new Map(
    (existingProducts.results ?? []).map((p) => [p.sku.trim().toLowerCase(), p.id]),
  );

  // Giá đang áp dụng của sản phẩm đã có: nhập lại file thì CHỈ ghi giá khi Sheet có giá và khác giá hiện tại.
  // Ô giá trống trong Sheet không được xóa giá đang có trên web.
  const currentPrice = new Map<string, number | null>();
  const priceRows = await db
    .prepare(
      `SELECT product_id, tier_id, amount FROM product_prices
       WHERE status = 'ACTIVE' AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)
       ORDER BY valid_from ASC`,
    )
    .bind(today, today)
    .all<{ product_id: string; tier_id: string; amount: number | null }>();
  for (const r of priceRows.results ?? []) currentPrice.set(`${r.product_id}|${r.tier_id}`, r.amount);

  const productStatements: D1PreparedStatement[] = [];
  for (const product of parsed.products) {
    let productId = productIdBySku.get(product.sku.trim().toLowerCase());
    const isExisting = Boolean(productId);
    if (!productId) {
      productId = newId();
      productIdBySku.set(product.sku.trim().toLowerCase(), productId);
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
      if (isExisting) {
        const now0 = currentPrice.get(`${productId}|${TIER_ID_BY_CODE[code]}`);
        if (amount === null || amount === undefined || amount === now0) continue;
      }
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

    return finishPhase('catalog');
  }

  if (phase === 'customers') {
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
    const knownId = customerIdByLegacy.get(customer.legacy_code);
    if (knownId) {
      // Khách đã có: Sheet là số liệu chuẩn, kéo tên, liên hệ, cấp bậc, sale phụ trách, dư nợ cũ về đúng Sheet.
      const debtRow0 = debtByCustomer.get(customer.legacy_code);
      const opening0 = debtRow0?.opening_debt ?? customer.opening_debt ?? 0;
      const owner0 = customer.owner_legacy_name
        ? (ownerIdByLegacy.get(customer.owner_legacy_name.toLowerCase()) ?? null)
        : null;
      customerStatements.push(
        db
          .prepare(
            `UPDATE customers SET name = ?, phone_text = ?, phone_normalized = ?, province = ?, address = ?,
               tier_id = COALESCE(?, tier_id), legacy_tier_label = COALESCE(?, legacy_tier_label),
               owner_id = COALESCE(?, owner_id), opening_debt = ?, updated_at = ?
             WHERE id = ? AND (name <> ? OR COALESCE(phone_text, '') <> ? OR COALESCE(province, '') <> ?
               OR COALESCE(address, '') <> ? OR opening_debt <> ?
               OR COALESCE(tier_id, '') <> COALESCE(?, COALESCE(tier_id, ''))
               OR COALESCE(owner_id, '') <> COALESCE(?, COALESCE(owner_id, '')))`,
          )
          .bind(
            customer.name,
            customer.phone_text,
            customer.phone_normalized,
            customer.province,
            customer.address,
            customer.tier_code ? TIER_ID_BY_CODE[customer.tier_code] : null,
            customer.tier_label,
            owner0,
            opening0,
            now,
            knownId,
            customer.name,
            customer.phone_text ?? '',
            customer.province ?? '',
            customer.address ?? '',
            opening0,
            customer.tier_code ? TIER_ID_BY_CODE[customer.tier_code] : null,
            owner0,
          ),
      );
      continue;
    }
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

    return finishPhase('customers');
  }

  if (phase === 'orders') {
    const maps = await loadMaps();
    const customerIdByLegacy = maps.customers;
    const productIdBySku = maps.products;
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

  // Import lại cùng workbook phải là thao tác an toàn. Giữ đơn đã nhập trước đó
  // và chỉ dùng mã cũ để đối chiếu trạng thái, thay vì đụng UNIQUE(order_no).
  const existingOrders = await db
    .prepare(
      `SELECT id, legacy_order_code FROM orders
       WHERE legacy_order_code IS NOT NULL AND deleted_at IS NULL`,
    )
    .all<{ id: string; legacy_order_code: string }>();
  const existingOrderIdByCode = new Map(
    (existingOrders.results ?? []).map((row) => [row.legacy_order_code, row.id]),
  );

  // Dữ liệu hiện có của các đơn nhập từ Sheet, để so với Sheet.
  const syncable = new Map<
    string,
    {
      subtotal: number;
      discount_amount: number;
      bonus_deduction: number;
      shipping_fee: number;
      total_amount: number;
      cod_amount: number;
      delivery_status: string;
      accounting_status: string;
    }
  >();
  const syncRows = await db
    .prepare(
      `SELECT id, subtotal, discount_amount, bonus_deduction, shipping_fee, total_amount, cod_amount,
              delivery_status, accounting_status
       FROM orders WHERE legacy_order_code IS NOT NULL AND deleted_at IS NULL`,
    )
    .all<{
      id: string;
      subtotal: number;
      discount_amount: number;
      bonus_deduction: number;
      shipping_fee: number;
      total_amount: number;
      cod_amount: number;
      delivery_status: string;
      accounting_status: string;
    }>();
  for (const r of syncRows.results ?? []) syncable.set(r.id, r);
  const itemsByOrder = new Map<string, string[]>();
  const itemRows = await db
    .prepare(
      `SELECT oi.order_id, oi.product_id, oi.qty, oi.applied_price FROM order_items oi
       JOIN orders o ON o.id = oi.order_id WHERE o.legacy_order_code IS NOT NULL`,
    )
    .all<{ order_id: string; product_id: string; qty: number; applied_price: number }>();
  for (const r of itemRows.results ?? []) {
    const list = itemsByOrder.get(r.order_id) ?? [];
    list.push(`${r.product_id}:${r.qty}:${r.applied_price}`);
    itemsByOrder.set(r.order_id, list);
  }

  // Khách xuất hiện trong đơn nhưng không có ở danh sách khách (vd. "khách lẻ"): tự tạo hồ sơ để đơn không bị treo.
  const autoCustomerStatements: D1PreparedStatement[] = [];
  for (const lines of linesByOrder.values()) {
    const code = lines[0].customer_legacy_code;
    if (!code || customerIdByLegacy.has(code)) continue;
    const id = newId();
    customerIdByLegacy.set(code, id);
    inserted.customers += 1;
    const nm = code.charAt(0).toUpperCase() + code.slice(1);
    autoCustomerStatements.push(
      db
        .prepare(
          `INSERT INTO customers (id, legacy_code, name, stage, opening_debt, opening_debt_batch, data_quality,
             data_quality_note, created_by, created_at, updated_at)
           VALUES (?, ?, ?, 'NEW', 0, ?, 'NEEDS_REVIEW', ?, ?, ?, ?)`,
        )
        .bind(id, code, nm, options.batchId, 'Tự tạo khi nhập vì đơn dùng tên khách này nhưng chưa có hồ sơ', auth.user.id, now, now),
    );
  }
  await runChunked(autoCustomerStatements);

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

    const existingOrderId = existingOrderIdByCode.get(orderCode);
    if (existingOrderId) {
      orderIdByCode.set(orderCode, existingOrderId);
      // Sheet là số liệu chuẩn: đơn nhập từ Sheet lệch thì kéo số tiền, dòng hàng, trạng thái giao/kế toán về đúng Sheet.
      // Đơn không có dòng trạng thái ở sheet quản lý thì giữ nguyên.
      const cur = syncable.get(existingOrderId);
      const st = statusByCode.get(orderCode);
      if (cur && st) {
        let sub = 0;
        const sig: string[] = [];
        const newItems: { product_id: string; qty: number; price: number; base: number; total: number }[] = [];
        let ok = true;
        for (const line of lines) {
          // Dòng nhập mã hàng nhưng để số lượng 0: bỏ qua, đơn vẫn đồng bộ bình thường.
          if (!line.qty) continue;
          const pid = line.sku ? productIdBySku.get(line.sku.trim().toLowerCase()) : undefined;
          if (!pid) { ok = false; break; }
          const price = line.unit_price ?? 0;
          const lt = line.line_total ?? price * line.qty;
          sub += lt;
          if (line.qty > 0) {
            sig.push(`${pid}:${line.qty}:${price}`);
            newItems.push({ product_id: pid, qty: line.qty, price, base: line.base_price ?? price, total: lt });
          }
        }
        if (ok) {
          const sh = st.shipping_fee ?? 0;
          const di = st.discount_amount ?? 0;
          const bo = st.bonus_deduction ?? 0;
          const cd = st.cod_amount ?? 0;
          const tt = sub - di - bo + sh;
          const oldSig = (itemsByOrder.get(existingOrderId) ?? []).sort().join('|');
          const itemsChanged = oldSig !== [...sig].sort().join('|');
          const newDelivery = st.delivery_status ?? cur.delivery_status;
          const newAcc = st.accounting_confirmed ? 'DA_XAC_NHAN' : 'CHUA_XAC_NHAN';
          const moneyChanged =
            cur.subtotal !== sub || cur.discount_amount !== di || cur.bonus_deduction !== bo ||
            cur.shipping_fee !== sh || cur.total_amount !== tt || cur.cod_amount !== cd ||
            cur.delivery_status !== newDelivery || cur.accounting_status !== newAcc;
          if (itemsChanged || moneyChanged) {
            orderStatements.push(
              db
                .prepare(
                  `UPDATE orders SET subtotal = ?, discount_amount = ?, bonus_deduction = ?, shipping_fee = ?,
                     total_amount = ?, cod_amount = ?, delivery_status = ?, accounting_status = ?,
                     accounting_confirmed_at = CASE WHEN ? = 'DA_XAC_NHAN' THEN COALESCE(accounting_confirmed_at, ?) ELSE NULL END,
                     updated_at = ? WHERE id = ?`,
                )
                .bind(sub, di, bo, sh, tt, cd, newDelivery, newAcc, newAcc, now, now, existingOrderId),
            );
            if (itemsChanged) {
              orderStatements.push(db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(existingOrderId));
              for (const it of newItems) {
                orderStatements.push(
                  db
                    .prepare(
                      `INSERT INTO order_items (id, order_id, product_id, qty, base_price, applied_price, line_total,
                         price_override, tier_id_snapshot, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
                    )
                    .bind(newId(), existingOrderId, it.product_id, it.qty, it.base, it.price, it.total, now),
                );
              }
            }
            inserted.orders_updated = (inserted.orders_updated ?? 0) + 1;
            errorStatements.push(
              db
                .prepare(
                  `INSERT INTO import_errors (id, batch_id, sheet, row_no, field, code, message, severity, created_at)
                   VALUES (?, ?, 'SO_DON_HANG', ?, 'total', 'ORDER_SYNCED_FROM_SHEET', ?, 'WARNING', ?)`,
                )
                .bind(
                  newId(),
                  options.batchId,
                  first.row_no,
                  `Đơn ${orderCode} cập nhật theo Sheet: tổng ${cur.total_amount} → ${tt}${itemsChanged ? ' (đổi cả dòng hàng)' : ''}.`,
                  now,
                ),
            );
          }
        }
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
      // Mã hàng khớp không phân biệt hoa/thường và khoảng trắng thừa.
      const productId = line.sku ? productIdBySku.get(line.sku.trim().toLowerCase()) : undefined;
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
      // Đơn lịch sử: giữ nguyên đơn giá và thành tiền ghi trong file, không tính lại theo
      // bảng giá hiện hành - nếu không, đơn cũ sẽ đổi số mỗi lần bảng giá thay đổi.
      const price = line.unit_price ?? 0;
      const lineTotal = line.line_total ?? price * line.qty;
      if (line.qty < 0) {
        // Dòng số lượng ÂM trong sổ đơn = hàng trả lại / giảm trừ. order_items chỉ nhận số lượng dương,
        // nên không tạo dòng hàng, nhưng VẪN cộng thành tiền âm vào tiền hàng của đơn để tổng phải thu
        // và công nợ khớp với Google Sheet. Ghi cảnh báo để kế toán biết đơn nào có hàng trả.
        subtotal += lineTotal;
        errorStatements.push(
          db
            .prepare(
              `INSERT INTO import_errors (id, batch_id, sheet, row_no, field, code, message, severity, raw_json, created_at)
               VALUES (?, ?, 'SO_DON_HANG', ?, 'qty', 'RETURN_LINE_NETTED', ?, 'WARNING', ?, ?)`,
            )
            .bind(
              newId(),
              options.batchId,
              line.row_no,
              `Dòng ${line.row_no}: số lượng âm (${line.qty}) của mã "${line.sku ?? ''}" ở đơn ${orderCode} là hàng trả lại. Đã trừ ${Math.abs(lineTotal)} đ vào tiền hàng của đơn, không tạo dòng hàng.`,
              JSON.stringify(line),
              now,
            ),
        );
        continue;
      }
      subtotal += lineTotal;
      inserted.order_items += 1;
      itemStatements.push(
        db
          .prepare(
            `INSERT INTO order_items (id, order_id, product_id, qty, base_price, applied_price, line_total,
               price_override, tier_id_snapshot, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
          )
          .bind(
            newId(),
            orderId,
            productId,
            line.qty,
            line.base_price ?? price,
            price,
            lineTotal,
            now,
          ),
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

  // Dọn đơn không có trong Sheet (đơn thử/demo tạo trên web, đơn đã bị xoá khỏi Sheet): ẩn mềm bằng deleted_at,
  // khôi phục được. Chỉ chạy khi file có đủ đơn thật để tránh ẩn nhầm toàn bộ vì file rỗng.
  const sheetCodes = [...linesByOrder.keys()].filter((k) => k !== 'CHUA_KHAI_BAO');
  if (sheetCodes.length >= 10) {
    const keep = new Set(sheetCodes);
    const all = await db
      .prepare('SELECT id, order_no, legacy_order_code FROM orders WHERE deleted_at IS NULL')
      .all<{ id: string; order_no: string; legacy_order_code: string | null }>();
    const stale = (all.results ?? []).filter((o) => !o.legacy_order_code || !keep.has(o.legacy_order_code));
    const cleanup: D1PreparedStatement[] = [];
    for (const o of stale) {
      cleanup.push(
        db
          .prepare("UPDATE orders SET deleted_at = ?, kho_status = 'KHONG', updated_at = ? WHERE id = ?")
          .bind(now, now, o.id),
        db
          .prepare(
            `INSERT INTO import_errors (id, batch_id, sheet, row_no, field, code, message, severity, created_at)
             VALUES (?, ?, 'SO_DON_HANG', NULL, 'order_code', 'ORDER_HIDDEN_NOT_IN_SHEET', ?, 'WARNING', ?)`,
          )
          .bind(newId(), options.batchId, `Đơn ${o.order_no} không có trong Sheet nên đã được ẩn khỏi danh sách.`, now),
      );
      inserted.orders_hidden = (inserted.orders_hidden ?? 0) + 1;
    }
    await runChunked(cleanup);
  }

    await runChunked(errorStatements);
    return finishPhase('orders');
  }

  if (phase === 'payments') {
    const maps = await loadMaps();
    const customerIdByLegacy = maps.customers;
    const ownerIdByLegacy = maps.owners;
    const orderIdByCode = maps.orders;
    const errorStatements: D1PreparedStatement[] = [];
  // ---- Thanh toán -----------------------------------------------------------
  const paymentStatements: D1PreparedStatement[] = [];
  const existingPayments = await db
    .prepare(
      `SELECT id, external_row_key, accounting_status, paid_at, method FROM payments
       WHERE source = 'IMPORT' AND external_row_key IS NOT NULL`,
    )
    .all<{ id: string; external_row_key: string; accounting_status: string; paid_at: string; method: string | null }>();
  const existingPaymentKeys = new Set(
    (existingPayments.results ?? []).map((row) => row.external_row_key),
  );
  const existingPaymentByKey = new Map((existingPayments.results ?? []).map((row) => [row.external_row_key, row]));
  // Phiếu đã có: kéo ngày thu, hình thức, trạng thái kế toán về đúng Sheet.
  for (const payment of parsed.payments) {
    const cur = payment.external_row_key ? existingPaymentByKey.get(payment.external_row_key) : undefined;
    if (!cur) continue;
    const accNew = payment.accounting_confirmed ? 'DA_XAC_NHAN' : 'CHUA_XAC_NHAN';
    const paidNew = payment.paid_at ?? cur.paid_at;
    if (cur.accounting_status !== accNew || cur.paid_at !== paidNew || (cur.method ?? null) !== (payment.method ?? null)) {
      paymentStatements.push(
        db
          .prepare('UPDATE payments SET accounting_status = ?, paid_at = ?, method = ?, updated_at = ? WHERE id = ?')
          .bind(accNew, paidNew, payment.method ?? null, now, cur.id),
      );
      inserted.payments_updated = (inserted.payments_updated ?? 0) + 1;
    }
  }
  // Phiếu nhập từ Sheet mà Sheet không còn dòng đó (đã sửa/xoá): gỡ bỏ để tổng tiền khớp Sheet.
  if (parsed.payments.length >= 10) {
    const sheetKeys = new Set(parsed.payments.map((p) => p.external_row_key).filter(Boolean) as string[]);
    for (const row of existingPayments.results ?? []) {
      if (sheetKeys.has(row.external_row_key)) continue;
      paymentStatements.push(
        db.prepare('DELETE FROM payment_allocations WHERE payment_id = ?').bind(row.id),
        db.prepare('DELETE FROM payment_allocations_pending WHERE payment_id = ?').bind(row.id),
        db.prepare('DELETE FROM payments WHERE id = ?').bind(row.id),
      );
      inserted.payments_removed = (inserted.payments_removed ?? 0) + 1;
    }
  }
  for (const payment of parsed.payments) {
    // Nếu file đã được import trước đó thì bỏ cả payment lẫn allocation đi kèm.
    // Chỉ dựa vào ON CONFLICT ở câu INSERT payment sẽ khiến allocation sau đó
    // tham chiếu tới một payment_id mới không tồn tại và vi phạm khoá ngoại.
    if (payment.external_row_key && existingPaymentKeys.has(payment.external_row_key)) continue;

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
             paid_at, method, accounting_status, review_status, is_general_repayment, is_adjustment,
             adjustment_reason, note, import_batch_id, created_by, created_at, updated_at)
           VALUES (?, ?, 'IMPORT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
           ON CONFLICT (source, external_row_key) WHERE external_row_key IS NOT NULL DO NOTHING`,
        )
        .bind(
          paymentId,
          payment.receipt_no,
          payment.external_row_key,
          customerId,
          Math.abs(payment.amount),
          payment.paid_at ?? today,
          payment.method,
          // Giữ đúng trạng thái kế toán trong file: khoản đã xác nhận mới trừ nợ chính thức.
          payment.accounting_confirmed ? 'DA_XAC_NHAN' : 'CHUA_XAC_NHAN',
          payment.needs_review ? 'NEEDS_REVIEW' : 'OK',
          payment.is_general_repayment ? 1 : 0,
          payment.is_adjustment ? 1 : 0,
          payment.is_adjustment ? 'Bút toán đảo nhập từ file Excel' : null,
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
          .bind(newId(), paymentId, customerId, Math.abs(payment.amount), now),
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
            .bind(newId(), paymentId, orderId, Math.abs(payment.amount), auth.user.id, now),
        );
      }
    }
  }
  await runChunked(paymentStatements);

  // ---- Nhật ký chăm sóc (giữ dòng hợp lệ, không tạo dòng rỗng) --------------
  const activityStatements: D1PreparedStatement[] = [];
  const haveActs = await db
    .prepare('SELECT customer_id, content, created_at FROM customer_activities')
    .all<{ customer_id: string; content: string; created_at: string }>();
  const actKeys = new Set((haveActs.results ?? []).map((a) => `${a.customer_id}|${a.created_at.slice(0, 10)}|${a.content}`));
  for (const activity of parsed.activities) {
    const customerId = activity.customer_legacy_code
      ? customerIdByLegacy.get(activity.customer_legacy_code)
      : undefined;
    if (!customerId || !activity.content) continue;
    const actKey = `${customerId}|${activity.created_at ?? today}|${activity.content}`;
    if (actKeys.has(actKey)) continue;
    actKeys.add(actKey);
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

    return finishPhase('payments');
  }

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

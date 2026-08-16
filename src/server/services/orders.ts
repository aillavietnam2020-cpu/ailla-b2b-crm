import { nowIso, vnDate } from '@shared/datetime';
import { computeLineTotal, computeOrderTotals, generateOrderNo } from '@shared/orders';
import { checkLinePrice, resolveEffectivePrice } from '@shared/pricing';
import { checkDebtLimit } from '@shared/debt';
import type { OrderCreateInput } from '@shared/schemas';
import type { OrderDetail, OrderLineItem, OrderListItem } from '@shared/types';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, forbidden, notFound, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { RECEIVED_BY_ORDER } from '../lib/sql';
import type { AppConfig } from '../lib/settings';
import { loadPriceRows } from './pricing';
import { getCustomerDebt } from './debts';

interface CustomerRow {
  id: string;
  name: string;
  owner_id: string | null;
  tier_id: string | null;
  legacy_tier_label: string | null;
  stage: string;
}

export interface PreparedLine {
  product_id: string;
  sku: string;
  product_name: string;
  qty: number;
  base_price: number | null;
  applied_price: number;
  line_total: number;
  price_override: boolean;
  price_override_reason: string | null;
  diff_percent: number;
  required_role?: 'MANAGER' | 'CEO';
  is_gift?: boolean;
  promotion_note?: string | null;
}

export interface PreparedOrder {
  customer: CustomerRow;
  lines: PreparedLine[];
  totals: ReturnType<typeof computeOrderTotals>;
  approvals: Array<{ rule: string; requiredRole: 'MANAGER' | 'CEO'; reason: string; payload: unknown }>;
}

async function loadCustomerInScope(
  db: D1Database,
  auth: AuthContext,
  customerId: string,
): Promise<CustomerRow> {
  const row = await db
    .prepare(
      `SELECT id, name, owner_id, tier_id, legacy_tier_label, stage
       FROM customers WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(customerId)
    .first<CustomerRow>();
  if (!row) throw notFound('Không tìm thấy khách hàng');
  // Nhân viên chỉ thao tác trên khách của mình; trả 404 để không lộ sự tồn tại hồ sơ (mục 4.1).
  if (auth.scope === 'OWN' && row.owner_id !== auth.user.id) throw notFound('Không tìm thấy khách hàng');
  return row;
}

/** Dựng đơn: áp giá theo cấp khách, phát hiện chặn/duyệt. Không ghi DB. */
export async function prepareOrder(
  db: D1Database,
  config: AppConfig,
  auth: AuthContext,
  input: OrderCreateInput,
): Promise<PreparedOrder> {
  const customer = await loadCustomerInScope(db, auth, input.customer_id);
  const orderDate = input.order_date ?? vnDate();

  const productIds = input.items.map((i) => i.product_id);
  const placeholders = productIds.map(() => '?').join(',');
  const productRows = await db
    .prepare(
      `SELECT id, sku, name, active FROM products WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    )
    .bind(...productIds)
    .all<{ id: string; sku: string; name: string; active: number }>();
  const products = new Map((productRows.results ?? []).map((p) => [p.id, p]));

  const priceRows = customer.tier_id ? await loadPriceRows(db, productIds, customer.tier_id) : [];
  const lines: PreparedLine[] = [];
  const approvals: PreparedOrder['approvals'] = [];
  const fieldErrors: Record<string, string> = {};

  input.items.forEach((item, index) => {
    const product = products.get(item.product_id);
    if (!product) {
      fieldErrors[`items.${index}.product_id`] = 'Mã sản phẩm không tồn tại';
      return;
    }
    if (!product.active) {
      fieldErrors[`items.${index}.product_id`] = `Mã ${product.sku} đã ngừng kinh doanh`;
      return;
    }

    const base = customer.tier_id
      ? resolveEffectivePrice(priceRows, item.product_id, customer.tier_id, orderDate).amount
      : null;

    // Hàng tặng khuyến mại: đơn giá 0, không tính tiền, không cần duyệt giá.
    // Vẫn lưu base_price để biết giá trị hàng đã tặng khi đối chiếu sau này.
    if (item.is_gift) {
      lines.push({
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        qty: item.qty,
        base_price: base,
        applied_price: 0,
        line_total: 0,
        price_override: false,
        price_override_reason: null,
        diff_percent: 0,
        is_gift: true,
        promotion_note: item.promotion_note ?? null,
      });
      return;
    }

    const check = checkLinePrice({
      basePrice: base,
      appliedPrice: item.applied_price ?? base,
      hasTier: Boolean(customer.tier_id),
      managerThresholdPercent: config.priceOverrideManagerThresholdPercent,
      ceoThresholdPercent: config.priceOverrideCeoThresholdPercent,
    });

    if (check.blocked) {
      fieldErrors[`items.${index}.applied_price`] =
        check.code === 'MISSING_PRICE'
          ? `Mã ${product.sku} chưa có giá ở cấp giá của khách`
          : (check.message ?? 'Không thể thêm dòng này');
      return;
    }

    const applied = item.applied_price ?? (base as number);
    const line: PreparedLine = {
      product_id: product.id,
      sku: product.sku,
      product_name: product.name,
      qty: item.qty,
      base_price: base,
      applied_price: applied,
      line_total: computeLineTotal({ qty: item.qty, appliedPrice: applied }),
      price_override: check.needsApproval,
      price_override_reason: item.price_override_reason ?? null,
      diff_percent: check.diffPercent,
      required_role: check.requiredRole,
    };
    lines.push(line);

    if (check.needsApproval) {
      approvals.push({
        rule: 'PRICE_OVERRIDE',
        requiredRole: check.requiredRole ?? 'MANAGER',
        reason: `${product.sku}: giá thoả thuận ${applied.toLocaleString('vi-VN')}đ so với giá chuẩn ${(base ?? 0).toLocaleString('vi-VN')}đ (${check.diffPercent}%)`,
        payload: {
          product_id: product.id,
          sku: product.sku,
          base_price: base,
          proposed_price: applied,
          diff_percent: check.diffPercent,
          reason: item.price_override_reason ?? null,
        },
      });
    }
  });

  if (Object.keys(fieldErrors).length > 0) {
    const missingTier = !customer.tier_id;
    throw unprocessable(
      missingTier ? 'TIER_UNKNOWN' : 'ORDER_LINE_BLOCKED',
      missingTier
        ? `Khách "${customer.name}" đang ở cấp "${customer.legacy_tier_label ?? 'Khác'}" chưa map sang 8 cấp giá. Quản lý phải map cấp trước khi tạo đơn.`
        : 'Có dòng sản phẩm không hợp lệ. Xem chi tiết từng dòng.',
      fieldErrors,
    );
  }

  const totals = computeOrderTotals({
    items: lines.map((l) => ({ qty: l.qty, appliedPrice: l.applied_price })),
    discountAmount: input.discount_amount,
    bonusDeduction: input.bonus_deduction,
    shippingFee: input.shipping_fee,
    codAmount: input.cod_amount,
  });

  return { customer, lines, totals, approvals };
}

export interface CreateOrderContext {
  requestId: string;
  ip: string | null;
}

export async function createOrder(
  db: D1Database,
  config: AppConfig,
  auth: AuthContext,
  input: OrderCreateInput,
  ctx: CreateOrderContext,
): Promise<{ id: string; order_no: string }> {
  const prepared = await prepareOrder(db, config, auth, input);
  const now = nowIso();
  const orderDate = input.order_date ?? vnDate();
  const orderId = newId();

  const seqRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE substr(order_date, 1, 7) = ?`)
    .bind(orderDate.slice(0, 7))
    .first<{ n: number }>();
  const orderNo = generateOrderNo((seqRow?.n ?? 0) + 1, new Date(`${orderDate}T00:00:00.000Z`));

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO orders (id, order_no, customer_id, owner_id, order_date, subtotal, discount_amount,
           bonus_deduction, shipping_fee, total_amount, cod_amount, approval_status, delivery_status,
           payment_status, accounting_status, note, promotion_code, promotion_note,
           created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'CHUA_XUAT', 'CHUA_THU', 'CHUA_XAC_NHAN', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        orderId,
        orderNo,
        prepared.customer.id,
        prepared.customer.owner_id ?? auth.user.id,
        orderDate,
        prepared.totals.subtotal,
        prepared.totals.discountAmount,
        prepared.totals.bonusDeduction,
        prepared.totals.shippingFee,
        prepared.totals.totalAmount,
        prepared.totals.codAmount,
        input.note ?? null,
        input.promotion_code ?? null,
        input.promotion_note ?? null,
        auth.user.id,
        now,
        now,
      ),
  ];

  for (const line of prepared.lines) {
    statements.push(
      db
        .prepare(
          `INSERT INTO order_items (id, order_id, product_id, qty, base_price, applied_price, line_total,
             price_override, price_override_reason, tier_id_snapshot, is_gift, promotion_note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          orderId,
          line.product_id,
          line.qty,
          line.base_price,
          line.applied_price,
          line.line_total,
          line.price_override ? 1 : 0,
          line.price_override_reason,
          prepared.customer.tier_id,
          line.is_gift ? 1 : 0,
          line.promotion_note ?? null,
          now,
        ),
    );
  }

  statements.push(
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ORDER_CREATED',
      entityType: 'ORDER',
      entityId: orderId,
      after: { order_no: orderNo, customer_id: prepared.customer.id, totals: prepared.totals },
      ip: ctx.ip,
      requestId: ctx.requestId,
    }),
  );

  await db.batch(statements);
  return { id: orderId, order_no: orderNo };
}

/** Gửi duyệt: kiểm tra lại giá + công nợ ở backend, tạo yêu cầu duyệt đúng cấp. */
export async function submitOrder(
  db: D1Database,
  config: AppConfig,
  auth: AuthContext,
  orderId: string,
  ctx: CreateOrderContext,
): Promise<{ status: string; approvals: Array<{ rule_code: string; required_role: string }> }> {
  const order = await db
    .prepare(
      `SELECT o.*, c.owner_id AS customer_owner FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ? AND o.deleted_at IS NULL`,
    )
    .bind(orderId)
    .first<Record<string, unknown>>();
  if (!order) throw notFound('Không tìm thấy đơn hàng');
  if (auth.scope === 'OWN' && order.owner_id !== auth.user.id) throw notFound('Không tìm thấy đơn hàng');
  if (order.approval_status !== 'DRAFT' && order.approval_status !== 'REJECTED') {
    throw badRequest('ORDER_NOT_DRAFT', 'Chỉ đơn ở trạng thái Nháp hoặc bị từ chối mới được gửi duyệt.');
  }

  const items = await db
    .prepare(
      `SELECT oi.*, p.sku FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
    )
    .bind(orderId)
    .all<{
      product_id: string;
      sku: string;
      base_price: number | null;
      applied_price: number;
      price_override: number;
      is_gift: number;
    }>();

  const now = nowIso();
  const requests: Array<{ rule: string; role: 'MANAGER' | 'CEO'; reason: string; payload: unknown }> = [];

  for (const item of items.results ?? []) {
    // Dòng hàng tặng không có giá bán nên bỏ qua kiểm tra giá.
    if (item.is_gift) continue;
    if (item.base_price === null) {
      throw unprocessable(
        'MISSING_PRICE',
        `Mã ${item.sku} chưa có giá chuẩn. Không thể gửi duyệt cho tới khi bổ sung giá.`,
      );
    }
    if (item.applied_price !== item.base_price) {
      const diff = Math.abs(((item.applied_price - item.base_price) / item.base_price) * 100);
      const role: 'MANAGER' | 'CEO' = diff > config.priceOverrideCeoThresholdPercent ? 'CEO' : 'MANAGER';
      requests.push({
        rule: 'PRICE_OVERRIDE',
        role,
        reason: `${item.sku}: giá áp dụng lệch ${Math.round(diff * 100) / 100}% so với giá chuẩn`,
        payload: { sku: item.sku, base_price: item.base_price, proposed_price: item.applied_price },
      });
    }
  }

  const debt = await getCustomerDebt(db, order.customer_id as string);
  const limitCheck = checkDebtLimit(
    {
      openingDebt: debt.opening_debt,
      postedCharges: debt.posted_charges,
      confirmedPayments: debt.confirmed_payments,
      officialDebt: debt.official_debt,
      pendingCharges: debt.pending_charges,
      pendingCash: debt.pending_cash,
      projectedDebt: debt.projected_debt,
      creditBalance: debt.credit_balance,
    },
    debt.limit,
    order.total_amount as number,
    config.blockOnDebtLimitExceeded,
  );

  if (limitCheck.officialExceeded || limitCheck.projectedExceeded) {
    requests.push({
      rule: limitCheck.officialExceeded ? 'DEBT_LIMIT_EXCEEDED' : 'PROJECTED_DEBT_EXCEEDED',
      role: limitCheck.requiredRole ?? 'CEO',
      reason: limitCheck.message ?? 'Vượt hạn mức công nợ',
      payload: {
        limit: limitCheck.limit,
        official_debt: debt.official_debt,
        projected_debt: debt.projected_debt,
        order_amount: order.total_amount,
      },
    });
  }

  if (requests.length === 0) {
    requests.push({
      rule: 'ORDER_STANDARD',
      role: 'MANAGER',
      reason: 'Đơn trong ngưỡng - chờ Quản lý duyệt',
      payload: { total_amount: order.total_amount },
    });
  }

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE orders SET approval_status = 'PENDING_APPROVAL', submitted_at = ?, updated_at = ?,
           rejected_reason = NULL WHERE id = ?`,
      )
      .bind(now, now, orderId),
  ];

  for (const req of requests) {
    statements.push(
      db
        .prepare(
          `INSERT INTO approvals (id, entity_type, entity_id, rule_code, requester_id, required_role,
             status, reason, payload_json, created_at)
           VALUES (?, 'ORDER', ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
        )
        .bind(newId(), orderId, req.rule, auth.user.id, req.role, req.reason, JSON.stringify(req.payload), now),
    );
    if (req.rule === 'PRICE_OVERRIDE') {
      statements.push(
        auditStatement(db, {
          actorId: auth.user.id,
          action: 'PRICE_OVERRIDE_REQUESTED',
          entityType: 'ORDER',
          entityId: orderId,
          after: req.payload,
          requestId: ctx.requestId,
          ip: ctx.ip,
        }),
      );
    }
  }

  statements.push(
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ORDER_SUBMITTED',
      entityType: 'ORDER',
      entityId: orderId,
      before: { approval_status: order.approval_status },
      after: { approval_status: 'PENDING_APPROVAL', rules: requests.map((r) => r.rule) },
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  );

  await db.batch(statements);
  return {
    status: 'PENDING_APPROVAL',
    approvals: requests.map((r) => ({ rule_code: r.rule, required_role: r.role })),
  };
}

export async function listOrders(
  db: D1Database,
  scopeSql: string,
  scopeParams: unknown[],
  filters: { status?: string; customerId?: string; q?: string; limit?: number },
): Promise<OrderListItem[]> {
  const where: string[] = ['o.deleted_at IS NULL', scopeSql];
  const params: unknown[] = [...scopeParams];
  if (filters.status) {
    where.push('o.approval_status = ?');
    params.push(filters.status);
  }
  if (filters.customerId) {
    where.push('o.customer_id = ?');
    params.push(filters.customerId);
  }
  if (filters.q) {
    where.push('(o.order_no LIKE ? OR c.name LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }

  const rows = await db
    .prepare(
      `SELECT o.id, o.order_no, o.customer_id, c.name AS customer_name, o.owner_id,
              u.display_name AS owner_name, o.order_date, o.total_amount, o.cod_amount,
              o.approval_status, o.delivery_status, o.payment_status, o.accounting_status,
              COALESCE(a.received, 0) AS received_amount
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.owner_id
       LEFT JOIN (
         ${RECEIVED_BY_ORDER}
       ) a ON a.order_id = o.id
       WHERE ${where.join(' AND ')}
       ORDER BY o.order_date DESC, o.created_at DESC
       LIMIT ?`,
    )
    .bind(...params, filters.limit ?? 100)
    .all<OrderListItem & { cod_amount: number }>();

  return (rows.results ?? []).map((r) => ({
    ...r,
    received_amount: r.received_amount ?? 0,
    remaining_amount: r.total_amount - (r.cod_amount ?? 0) - (r.received_amount ?? 0),
  }));
}

export async function getOrderDetail(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
): Promise<OrderDetail> {
  const row = await db
    .prepare(
      `SELECT o.*, c.name AS customer_name, u.display_name AS owner_name,
              COALESCE(a.received, 0) AS received_amount
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.owner_id
       LEFT JOIN (
         ${RECEIVED_BY_ORDER}
       ) a ON a.order_id = o.id
       WHERE o.id = ? AND o.deleted_at IS NULL`,
    )
    .bind(orderId)
    .first<Record<string, unknown>>();
  if (!row) throw notFound('Không tìm thấy đơn hàng');
  const order = row as unknown as OrderDetail & { owner_id: string | null };
  if (auth.scope === 'OWN' && order.owner_id !== auth.user.id) throw notFound('Không tìm thấy đơn hàng');

  const itemRows = await db
    .prepare(
      `SELECT oi.id, oi.product_id, p.sku, p.name AS product_name, oi.qty, oi.base_price,
              oi.applied_price, oi.line_total, oi.price_override, oi.price_override_reason,
              oi.is_gift, oi.promotion_note
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ? ORDER BY oi.created_at`,
    )
    .bind(orderId)
    .all<Omit<OrderLineItem, 'price_override'> & { price_override: number }>();

  const approvalRows = await db
    .prepare(
      `SELECT a.*, r.display_name AS requester_name, ap.display_name AS approver_name
       FROM approvals a
       JOIN users r ON r.id = a.requester_id
       LEFT JOIN users ap ON ap.id = a.approver_id
       WHERE a.entity_type = 'ORDER' AND a.entity_id = ?
       ORDER BY a.created_at DESC`,
    )
    .bind(orderId)
    .all<Record<string, unknown>>();

  return {
    ...order,
    remaining_amount:
      (order.total_amount ?? 0) - (order.cod_amount ?? 0) - (order.received_amount ?? 0),
    items: (itemRows.results ?? []).map((i) => ({
      ...i,
      price_override: Boolean(i.price_override),
      is_gift: Boolean((i as unknown as { is_gift: number }).is_gift),
    })),
    approvals: (approvalRows.results ?? []).map((a) => ({
      ...(a as unknown as OrderDetail['approvals'][number]),
      payload: a.payload_json ? JSON.parse(a.payload_json as string) : null,
    })),
  };
}

/** Cập nhật trạng thái giao hàng - chỉ vai trò được phân quyền (mục 8.3). */
export async function updateDeliveryStatus(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  status: string,
  note: string | null,
  ctx: CreateOrderContext,
): Promise<void> {
  const order = await db
    .prepare('SELECT id, approval_status, delivery_status FROM orders WHERE id = ? AND deleted_at IS NULL')
    .bind(orderId)
    .first<{ id: string; approval_status: string; delivery_status: string }>();
  if (!order) throw notFound('Không tìm thấy đơn hàng');
  if (order.approval_status !== 'APPROVED') {
    throw badRequest('ORDER_NOT_APPROVED', 'Chỉ đơn đã duyệt mới cập nhật được trạng thái giao hàng.');
  }
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE orders SET delivery_status = ?, delivered_at = CASE WHEN ? IN ('DA_XUAT_KHO','DA_GIAO')
           THEN COALESCE(delivered_at, ?) ELSE delivered_at END, updated_at = ? WHERE id = ?`,
      )
      .bind(status, status, now, now, orderId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'DELIVERY_STATUS_CHANGED',
      entityType: 'ORDER',
      entityId: orderId,
      before: { delivery_status: order.delivery_status },
      after: { delivery_status: status },
      reason: note,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
}

/**
 * Kế toán xác nhận đơn: đây là mốc biến "chờ ghi nợ" thành "công nợ chính thức" (mục 9.1).
 * Chỉ đơn đã duyệt và đã rời kho mới được xác nhận.
 */
export async function setAccountingStatus(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  status: 'CHUA_XAC_NHAN' | 'DA_XAC_NHAN',
  note: string | null,
  ctx: CreateOrderContext,
): Promise<void> {
  const order = await db
    .prepare(
      `SELECT id, order_no, approval_status, delivery_status, accounting_status
       FROM orders WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(orderId)
    .first<{
      id: string;
      order_no: string;
      approval_status: string;
      delivery_status: string;
      accounting_status: string;
    }>();
  if (!order) throw notFound('Không tìm thấy đơn hàng');

  if (status === 'DA_XAC_NHAN') {
    if (order.approval_status !== 'APPROVED') {
      throw badRequest('ORDER_NOT_APPROVED', 'Chỉ đơn đã duyệt mới được kế toán xác nhận.');
    }
    if (order.delivery_status !== 'DA_XUAT_KHO' && order.delivery_status !== 'DA_GIAO') {
      throw badRequest(
        'ORDER_NOT_DELIVERED',
        'Đơn chưa xuất kho/giao hàng thì chưa ghi nợ chính thức được.',
      );
    }
  }

  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE orders SET accounting_status = ?,
           accounting_confirmed_at = CASE WHEN ? = 'DA_XAC_NHAN' THEN ? ELSE NULL END,
           updated_at = ? WHERE id = ?`,
      )
      .bind(status, status, now, now, orderId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ACCOUNTING_CONFIRMED',
      entityType: 'ORDER',
      entityId: orderId,
      before: { accounting_status: order.accounting_status },
      after: { accounting_status: status },
      reason: note,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
}

/** Huỷ đơn: chỉ khi chưa giao hàng và chưa có tiền phân bổ. */
export async function cancelOrder(
  db: D1Database,
  auth: AuthContext,
  orderId: string,
  reason: string,
  ctx: CreateOrderContext,
): Promise<void> {
  const order = await db
    .prepare(
      `SELECT o.id, o.owner_id, o.approval_status, o.delivery_status, o.accounting_status,
              COALESCE(a.received, 0) AS received
       FROM orders o
       LEFT JOIN (${RECEIVED_BY_ORDER}) a ON a.order_id = o.id
       WHERE o.id = ? AND o.deleted_at IS NULL`,
    )
    .bind(orderId)
    .first<{
      id: string;
      owner_id: string | null;
      approval_status: string;
      delivery_status: string;
      accounting_status: string;
      received: number;
    }>();
  if (!order) throw notFound('Không tìm thấy đơn hàng');
  if (auth.scope === 'OWN' && order.owner_id !== auth.user.id) throw notFound('Không tìm thấy đơn hàng');
  if (order.approval_status === 'CANCELLED') {
    throw badRequest('ORDER_CANCELLED', 'Đơn này đã huỷ trước đó.');
  }
  if (order.delivery_status !== 'CHUA_XUAT') {
    throw badRequest('ORDER_DELIVERED', 'Đơn đã xuất kho hoặc đã giao thì không huỷ được. Dùng trạng thái Hoàn.');
  }
  if (order.received > 0) {
    throw badRequest('ORDER_HAS_PAYMENT', 'Đơn đã có tiền phân bổ. Phải gỡ phân bổ trước khi huỷ.');
  }
  if (order.approval_status === 'APPROVED' && auth.user.role === 'EMPLOYEE') {
    throw forbidden('Đơn đã duyệt chỉ Quản lý hoặc CEO được huỷ.');
  }

  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE orders SET approval_status = 'CANCELLED', rejected_reason = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(reason, now, orderId),
    db
      .prepare(
        `UPDATE approvals SET status = 'CANCELLED', decided_at = ?
         WHERE entity_type = 'ORDER' AND entity_id = ? AND status = 'PENDING'`,
      )
      .bind(now, orderId),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ORDER_CANCELLED',
      entityType: 'ORDER',
      entityId: orderId,
      before: { approval_status: order.approval_status },
      after: { approval_status: 'CANCELLED' },
      reason,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
}

export function assertCanCreateForCustomer(auth: AuthContext, customerOwnerId: string | null): void {
  if (auth.scope === 'OWN' && customerOwnerId !== auth.user.id) {
    throw forbidden('Bạn chỉ được tạo đơn cho khách hàng mình phụ trách');
  }
}

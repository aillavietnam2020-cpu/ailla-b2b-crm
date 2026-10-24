import { nowIso, shipDayToIso, vnDate } from '@shared/datetime';
import {
  computeLineTotal,
  computeOrderTotals,
  derivePaymentStatus,
  generateOrderNo,
} from '@shared/orders';
import { checkLinePrice, resolveEffectivePrice } from '@shared/pricing';
import { adjustedPrice, loadAdjustments } from './priceAdjust';
import { checkDebtLimit } from '@shared/debt';
import type { OrderCreateInput, OrderUpdateInput } from '@shared/schemas';
import type {
  OrderDetail,
  OrderLineItem,
  OrderListItem,
  OrderRevision,
  OrderRevisionSnapshot,
} from '@shared/types';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { eventStatement } from '../lib/events';
import { badRequest, forbidden, notFound, unprocessable } from '../lib/http';
import { can } from '@shared/permissions';
import { applyDepositsToOrder } from './payments';
import { newId } from '../lib/ids';
import { RECEIVED_BY_ORDER } from '../lib/sql';
import type { AppConfig } from '../lib/settings';
import { loadPriceRows } from './pricing';
import { loadCustomerPriceRows } from './customerPrices';
import { getCustomerDebt } from './debts';
import { editFlowStatements, firstSendStatements, khoAfterEdit, seesAllOrders } from './orderFlow';

interface CustomerRow {
  id: string;
  name: string;
  owner_id: string | null;
  tier_id: string | null;
  legacy_tier_label: string | null;
  stage: string;
  price_mode: string | null;
  tier_code?: string | null;
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

/**
 * Cùng một sản phẩm vừa có dòng bán vừa có dòng tặng: lưu thành MỘT dòng (qty = tổng, gift_qty = phần tặng, tiền chỉ tính phần bán),
 * để kho chỉ thấy một mã với tổng số lượng cần xuất.
 */
export function mergeLinesForStorage(lines: PreparedLine[]): Array<PreparedLine & { gift_qty: number }> {
  const out: Array<PreparedLine & { gift_qty: number }> = [];
  for (const l of lines) {
    const mate = out.find((o) => o.product_id === l.product_id && Boolean(o.is_gift) !== Boolean(l.is_gift) && o.gift_qty === (o.is_gift ? o.qty : 0));
    if (!mate) {
      out.push({ ...l, gift_qty: l.is_gift ? l.qty : 0 });
      continue;
    }
    const sale = mate.is_gift ? l : mate;
    const gift = mate.is_gift ? mate : l;
    out[out.indexOf(mate)] = { ...sale, qty: sale.qty + gift.qty, gift_qty: gift.qty, is_gift: false, promotion_note: gift.promotion_note ?? sale.promotion_note ?? null };
  }
  return out;
}

/** Ngược lại khi đọc đơn: dòng có gift_qty tách lại thành dòng bán + dòng tặng để hiện và sửa như cũ. */
export function splitGiftRows<T extends { qty: number; applied_price: number; line_total: number; is_gift?: unknown; gift_qty?: number | null; id?: string }>(rows: T[]): T[] {
  const out: T[] = [];
  for (const r of rows) {
    const g = Number(r.gift_qty ?? 0);
    if (!g || g >= r.qty || r.is_gift) {
      out.push(r);
      continue;
    }
    out.push({ ...r, qty: r.qty - g, gift_qty: 0 });
    out.push({ ...r, id: r.id ? `${r.id}-tang` : r.id, qty: g, applied_price: 0, line_total: 0, is_gift: (typeof r.is_gift === 'boolean' ? true : 1) as never, gift_qty: 0 });
  }
  return out;
}

export interface PreparedOrder {
  customer: CustomerRow;
  /** Sale đổi cấp giá của khách khi lập / sửa đơn: lưu cùng lúc với đơn. */
  tier_change?: { customer_id: string; from: string | null; to: string; to_name: string; from_name: string | null };
  /** Đơn chưa đạt điều kiện lên cấp: gửi yêu cầu xin Quản lý duyệt đổi cấp, đơn vẫn tính theo cấp hiện tại. */
  tier_request?: { customer_id: string; to: string; to_name: string; reason: string };
  lines: PreparedLine[];
  totals: ReturnType<typeof computeOrderTotals>;
  approvals: Array<{
    rule: string;
    requiredRole: 'MANAGER' | 'CEO';
    reason: string;
    payload: unknown;
  }>;
}

async function loadCustomerInScope(
  db: D1Database,
  auth: AuthContext,
  customerId: string,
): Promise<CustomerRow> {
  const row = await db
    .prepare(
      `SELECT c.id, c.name, c.owner_id, c.tier_id, c.legacy_tier_label, c.stage, c.price_mode, t.code AS tier_code
       FROM customers c LEFT JOIN price_tiers t ON t.id = c.tier_id WHERE c.id = ? AND c.deleted_at IS NULL`,
    )
    .bind(customerId)
    .first<CustomerRow>();
  if (!row) throw notFound('Không tìm thấy khách hàng');
  // Nhân viên chỉ thao tác trên khách của mình; trả 404 để không lộ sự tồn tại hồ sơ (mục 4.1).
  if (auth.scope === 'OWN' && row.owner_id !== auth.user.id)
    throw notFound('Không tìm thấy khách hàng');
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
  // Nhân viên mua hàng công ty (cấp Nhân viên, trừ lương cuối tháng): chỉ quản lý điều phối (chị Thảo) hoặc CEO lập đơn.
  if (customer.tier_code === 'NHAN_VIEN' && auth.user.role === 'EMPLOYEE') {
    throw forbidden('Đơn nhân viên mua hàng công ty chỉ quản lý (chị Thảo) hoặc CEO lập.');
  }
  // Khách lên cấp: sale phụ trách (hoặc quản lý) đổi cấp ngay trên đơn. Chỉ tính trong bộ nhớ ở đây, được lưu cùng đơn.
  let tierChange: PreparedOrder['tier_change'];
  let needTierRule = false;
  let tierRank = 0;
  if (input.customer_tier_id && input.customer_tier_id !== customer.tier_id) {
    const allowed = auth.user.id === customer.owner_id || auth.scope !== 'OWN' || can(auth.user.role, 'customer.tier.change');
    if (!allowed) throw forbidden('Chỉ sale phụ trách khách này hoặc quản lý mới đổi được cấp giá.');
    needTierRule = !can(auth.user.role, 'customer.tier.change');
    const newTier = await db
      .prepare('SELECT id, code, name FROM price_tiers WHERE id = ?')
      .bind(input.customer_tier_id)
      .first<{ id: string; code: string; name: string }>();
    if (!newTier) throw unprocessable('BAD_TIER', 'Cấp giá không tồn tại.', { customer_tier_id: 'Chọn lại cấp giá' });
    const oldTier = customer.tier_id
      ? await db.prepare('SELECT name FROM price_tiers WHERE id = ?').bind(customer.tier_id).first<{ name: string }>()
      : null;
    tierRank = (await db.prepare('SELECT rank FROM price_tiers WHERE id = ?').bind(newTier.id).first<{ rank: number }>())?.rank ?? 0;
    tierChange = { customer_id: customer.id, from: customer.tier_id, to: newTier.id, to_name: newTier.name, from_name: oldTier?.name ?? null };
    customer.tier_id = newTier.id;
    customer.tier_code = newTier.code;
  }

  const productIds = input.items.map((i) => i.product_id);
  const placeholders = productIds.map(() => '?').join(',');
  const productRows = await db
    .prepare(
      `SELECT p.id, p.sku, p.name, p.active, p.group_id, g.code AS group_code
       FROM products p LEFT JOIN product_groups g ON g.id = p.group_id
       WHERE p.id IN (${placeholders}) AND p.deleted_at IS NULL`,
    )
    .bind(...productIds)
    .all<{ id: string; sku: string; name: string; active: number; group_id: string | null; group_code: string | null }>();
  const products = new Map((productRows.results ?? []).map((p) => [p.id, p]));

  // Khách gia công dùng bảng giá riêng của chính họ; khách thường dùng giá theo cấp 8 bậc.
  const customPricing = customer.price_mode === 'CUSTOM';
  const freeTier = !customPricing && customer.tier_code === 'KHAC';
  const hasPriceList = customPricing || Boolean(customer.tier_id);
  const priceKey = customPricing ? customer.id : (customer.tier_id as string);
  const priceRows = customPricing
    ? await loadCustomerPriceRows(db, customer.id, productIds)
    : customer.tier_id
      ? await loadPriceRows(db, productIds, customer.tier_id)
      : [];
  // Khách có bảng giá riêng NHƯNG cũng có cấp giá (NPP đặt giá riêng cho vài mã): mã chưa có trong bảng riêng thì tính theo cấp của khách.
  const tierFallback = customPricing && customer.tier_id ? (customer.tier_id as string) : null;
  const fallbackRows = tierFallback ? await loadPriceRows(db, productIds, tierFallback) : [];
  // Giá điều chỉnh / khuyến mại tạm thời đặt lên trên bảng giá gốc (khách gia công dùng bảng giá riêng, không áp).
  const adjustments = customPricing && !tierFallback ? [] : await loadAdjustments(db, orderDate);
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

    // Đơn ngày cũ (nhập từ Sheet, hoặc bảng giá mới chỉ có hiệu lực từ ngày gần đây): chưa có giá tại ngày đơn thì
    // lấy giá đang hiệu lực hôm nay, để vẫn sửa được đơn thay vì bị chặn "chưa có giá".
    let base: number | null = null;
    if (hasPriceList) {
      const atDate = resolveEffectivePrice(priceRows, item.product_id, priceKey, orderDate);
      base = atDate.found
        ? atDate.amount
        : resolveEffectivePrice(priceRows, item.product_id, priceKey, vnDate()).amount;
      if (customPricing && tierFallback && (base === null || base === undefined)) {
        // Không có trong bảng riêng của khách: dùng giá cấp (kèm giá điều chỉnh đang áp cho cấp đó).
        const t0 = resolveEffectivePrice(fallbackRows, item.product_id, tierFallback, orderDate);
        base = t0.found ? t0.amount : resolveEffectivePrice(fallbackRows, item.product_id, tierFallback, vnDate()).amount;
        if (adjustments.length) base = adjustedPrice(adjustments, item.product_id, product.group_id, tierFallback, base).amount;
      } else if (!customPricing && adjustments.length) {
        base = adjustedPrice(adjustments, item.product_id, product.group_id, priceKey, base).amount;
      }
    }

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

    // Cấp "Khác" (lái xe, khách lẻ lẫn...): không có bảng giá, giá do người lập đơn nhập, không cảnh báo, không bắt duyệt.
    if (freeTier || product.group_code === 'VAT_TU_BAN' || (customer.tier_code === 'NHAN_VIEN' && base === null)) {
      const typed = item.applied_price ?? 0;
      if (!(typed > 0)) {
        fieldErrors[`items.${index}.applied_price`] = `Nhập giá bán cho mã ${product.sku} (vật tư bán kèm / khách cấp "Khác" không có bảng giá, giá do thỏa thuận)`;
        return;
      }
      lines.push({
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        qty: item.qty,
        base_price: null,
        applied_price: typed,
        line_total: computeLineTotal({ qty: item.qty, appliedPrice: typed }),
        price_override: false,
        price_override_reason: null,
        diff_percent: 0,
      });
      return;
    }

    // Giá bán thay đổi theo thỏa thuận (cao hoặc thấp hơn bảng giá) là chuyện thường: mã chưa có giá chuẩn ở cấp này
    // mà người lập đã nhập giá thì vẫn cho lưu, coi là giá thỏa thuận (cần quản lý duyệt nếu người lập không có quyền duyệt).
    const manualOnly =
      hasPriceList && base === null && item.applied_price != null && item.applied_price > 0;
    const check = manualOnly
      ? {
          code: 'PRICE_OVERRIDE_MANAGER' as const,
          blocked: false,
          needsApproval: true,
          requiredRole: 'MANAGER' as const,
          diffPercent: 0,
          message: `Mã ${product.sku} chưa có giá chuẩn ở cấp này, dùng giá nhập tay`,
        }
      : checkLinePrice({
          basePrice: base,
          appliedPrice: item.applied_price ?? base,
          hasTier: hasPriceList,
          managerThresholdPercent: config.priceOverrideManagerThresholdPercent,
          ceoThresholdPercent: config.priceOverrideCeoThresholdPercent,
        });

    if (check.blocked) {
      fieldErrors[`items.${index}.applied_price`] =
        check.code === 'MISSING_PRICE'
          ? customPricing
            ? `Mã ${product.sku} chưa có trong bảng giá riêng của khách "${customer.name}"`
            : `Mã ${product.sku} chưa có giá ở cấp giá của khách`
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

    // Giá thỏa thuận là chuyện thường: mặc định KHÔNG bắt duyệt (sale tự điền giá được), dòng vẫn đánh dấu
    // giá thỏa thuận + % lệch để đối soát. Bật approval.price_override_required thì quay lại cách cũ:
    // người có quyền duyệt tự chỉnh trong quyền (CEO cho mức lệch lớn), người khác phải qua duyệt.
    const selfOk =
      !config.priceNeedsApproval ||
      (config.allowSelfApproval &&
        (check.requiredRole === 'CEO'
          ? auth.user.role === 'CEO'
          : auth.permissions.includes('order.approve.normal') || auth.user.role === 'CEO'));
    if (check.needsApproval && !selfOk) {
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
    const missingTier = !hasPriceList;
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

  // Sale (không phải quản lý / CEO) chỉ tự đưa khách LÊN cấp khi đơn này đạt điều kiện của cấp mới.
  // Chưa đạt thì không báo lỗi: đơn lưu theo cấp hiện tại và gửi yêu cầu xin Quản lý / CEO duyệt đổi cấp.
  if (tierChange && needTierRule) {
    const oldRank = tierChange.from
      ? ((await db.prepare('SELECT rank FROM price_tiers WHERE id = ?').bind(tierChange.from).first<{ rank: number }>())?.rank ?? 99)
      : 99;
    const rule = await db
      .prepare('SELECT min_order_amount FROM tier_upgrade_rules WHERE tier_id = ?')
      .bind(tierChange.to)
      .first<{ min_order_amount: number }>();
    const need = rule?.min_order_amount ?? 0;
    let why: string | null = null;
    if (tierRank >= oldRank) why = 'Không phải lên cấp cao hơn.';
    else if (need <= 0) why = 'Cấp này chưa đặt điều kiện đơn tối thiểu.';
    else if (totals.subtotal < need)
      why = `Đơn này tiền hàng ${totals.subtotal.toLocaleString('vi-VN')}đ, chưa đạt mức ${need.toLocaleString('vi-VN')}đ của cấp ${tierChange.to_name}.`;
    if (why) {
      // Đơn vẫn tạo và gửi khách được (giá theo cấp mới, là đơn nháp); khách CHƯA đổi cấp, và đơn chưa gửi duyệt được
      // cho tới khi Quản lý / CEO duyệt yêu cầu đổi cấp.
      return {
        customer,
        lines,
        totals,
        approvals,
        tier_request: { customer_id: customer.id, to: tierChange.to, to_name: tierChange.to_name, reason: why },
      };
    }
  }
  return { customer, lines, totals, approvals, tier_change: tierChange };
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
): Promise<{ id: string; order_no: string; tier_request?: boolean }> {
  const orderDate = input.order_date ?? vnDate();
  if (orderDate > vnDate()) {
    throw unprocessable('ORDER_DATE_FUTURE', 'Ngày đơn không được sau hôm nay.', {
      order_date: 'Ngày đơn ở tương lai',
    });
  }
  const prepared = await prepareOrder(db, config, auth, input);
  const now = nowIso();
  const orderId = newId();
  // Luồng kho chỉ áp cho đơn mới khi CEO đã bật (kho_cfg.flow_on = '1'); mặc định tắt để đơn không bị kẹt
  // khi chưa có kế toán kho / mã đồng bộ.
  const flowCfg = await db
    .prepare("SELECT v FROM kho_cfg WHERE k = 'flow_on'")
    .first<{ v: string }>();
  const flowOn = flowCfg?.v === '1' ? 1 : 0;

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
           flow_on, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'CHUA_XUAT', 'CHUA_THU', 'CHUA_XAC_NHAN', ?, ?, ?, ?, ?, ?, ?)`,
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
        flowOn,
        auth.user.id,
        now,
        now,
      ),
  ];

  for (const line of mergeLinesForStorage(prepared.lines)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO order_items (id, order_id, product_id, qty, base_price, applied_price, line_total,
             price_override, price_override_reason, tier_id_snapshot, is_gift, promotion_note, created_at, gift_qty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          line.gift_qty,
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

  statements.push(
    eventStatement(db, {
      type: 'ORDER_CREATED',
      entityType: 'ORDER',
      entityId: orderId,
      actorId: auth.user.id,
      actorType: auth.actorType ?? 'USER',
      payload: {
        order_no: orderNo,
        customer_id: prepared.customer.id,
        total_amount: prepared.totals.totalAmount,
      },
    }),
  );
  if (prepared.tier_change) {
    statements.push(
      db
        .prepare('UPDATE customers SET tier_id = ?, updated_at = ? WHERE id = ?')
        .bind(prepared.tier_change.to, now, prepared.tier_change.customer_id),
      auditStatement(db, {
        actorId: auth.user.id,
        action: 'CUSTOMER_TIER_CHANGED',
        entityType: 'CUSTOMER',
        entityId: prepared.tier_change.customer_id,
        before: { tier_id: prepared.tier_change.from, tier: prepared.tier_change.from_name },
        after: { tier_id: prepared.tier_change.to, tier: prepared.tier_change.to_name },
        reason: 'Khách lên cấp: sale đổi cấp giá khi lập đơn',
        requestId: ctx.requestId,
        ip: ctx.ip,
      }),
    );
  }
  await db.batch(statements);
  let tierRequested = false;
  if (prepared.tier_request) {
    try {
      const { requestTierChange } = await import('./approvals');
      await requestTierChange(db, auth, prepared.tier_request.customer_id, prepared.tier_request.to, `${prepared.tier_request.reason} (đơn ${orderNo})`, ctx);
      tierRequested = true;
    } catch (e) {
      console.error('[tier-request]', e);
    }
  }
  return { id: orderId, order_no: orderNo, tier_request: tierRequested };
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
      `SELECT o.*, c.owner_id AS customer_owner, c.tier_id AS customer_tier, c.price_mode AS customer_price_mode FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ? AND o.deleted_at IS NULL`,
    )
    .bind(orderId)
    .first<Record<string, unknown>>();
  if (!order) throw notFound('Không tìm thấy đơn hàng');
  if (auth.scope === 'OWN' && order.owner_id !== auth.user.id)
    throw notFound('Không tìm thấy đơn hàng');
  if (order.approval_status !== 'DRAFT' && order.approval_status !== 'REJECTED') {
    throw badRequest(
      'ORDER_NOT_DRAFT',
      'Chỉ đơn ở trạng thái Nháp hoặc bị từ chối mới được gửi duyệt.',
    );
  }

  const items = await db
    .prepare(
      `SELECT oi.*, p.sku, g.code AS group_code, t.code AS tier_code
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       LEFT JOIN product_groups g ON g.id = p.group_id
       LEFT JOIN price_tiers t ON t.id = oi.tier_id_snapshot
       WHERE oi.order_id = ?`,
    )
    .bind(orderId)
    .all<{
      product_id: string;
      sku: string;
      group_code: string | null;
      tier_code: string | null;
      base_price: number | null;
      applied_price: number;
      price_override: number;
      is_gift: number;
    }>();

  // Đơn đang tính giá theo cấp mới nhưng khách chưa được duyệt lên cấp đó: chưa gửi duyệt được (vẫn in / gửi khách bình thường).
  if (order.customer_price_mode !== 'CUSTOM') {
    const snap = (items.results ?? []).find((i) => !i.is_gift && (i as { tier_id_snapshot?: string | null }).tier_id_snapshot && (i as { tier_id_snapshot?: string | null }).tier_id_snapshot !== order.customer_tier);
    if (snap) {
      const names = await db
        .prepare('SELECT id, name FROM price_tiers WHERE id IN (?, ?)')
        .bind((snap as { tier_id_snapshot?: string }).tier_id_snapshot ?? '', String(order.customer_tier ?? ''))
        .all<{ id: string; name: string }>();
      const nm = new Map((names.results ?? []).map((t) => [t.id, t.name]));
      const pend = await db
        .prepare(`SELECT id FROM approvals WHERE entity_type = 'CUSTOMER_TIER' AND entity_id = ? AND status = 'PENDING' AND json_extract(payload_json, '$.to') = ?`)
        .bind(String(order.customer_id), (snap as { tier_id_snapshot?: string }).tier_id_snapshot ?? '')
        .first();
      const oldName = nm.get(String(order.customer_tier ?? '')) ?? 'hiện tại';
      const newName = nm.get((snap as { tier_id_snapshot?: string }).tier_id_snapshot ?? '') ?? 'mới';
      throw unprocessable(
        'TIER_PENDING',
        pend
          ? `Đơn đang tính giá cấp ${newName}, khách còn ở cấp ${oldName}. Chờ Quản lý duyệt yêu cầu đổi cấp rồi gửi duyệt đơn (đơn nháp vẫn in gửi khách được).`
          : `Đơn đang tính giá cấp ${newName} nhưng khách đang ở cấp ${oldName}. Sửa đơn để tính lại giá theo cấp hiện tại, hoặc xin duyệt đổi cấp.`,
      );
    }
  }

  const now = nowIso();
  const requests: Array<{
    rule: string;
    role: 'MANAGER' | 'CEO';
    reason: string;
    payload: unknown;
  }> = [];

  for (const item of items.results ?? []) {
    // Dòng hàng tặng không có giá bán nên bỏ qua kiểm tra giá.
    if (item.is_gift) continue;
    // Giá do người lập đơn tự điền theo thỏa thuận (cấp Khác / Nhân viên, vật tư bán kèm): không có giá chuẩn để so, không cần duyệt giá.
    if (item.base_price === null && (item.group_code === 'VAT_TU_BAN' || item.tier_code === 'KHAC' || item.tier_code === 'NHAN_VIEN')) continue;
    if (item.base_price === null) {
      throw unprocessable(
        'MISSING_PRICE',
        `Mã ${item.sku} chưa có giá chuẩn. Không thể gửi duyệt cho tới khi bổ sung giá.`,
      );
    }
    if (item.applied_price !== item.base_price) {
      const diff = Math.abs(((item.applied_price - item.base_price) / item.base_price) * 100);
      const role: 'MANAGER' | 'CEO' =
        diff > config.priceOverrideCeoThresholdPercent ? 'CEO' : 'MANAGER';
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
        .bind(
          newId(),
          orderId,
          req.rule,
          auth.user.id,
          req.role,
          req.reason,
          JSON.stringify(req.payload),
          now,
        ),
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

  if (Number(order.flow_on) === 1) {
    statements.push(
      ...firstSendStatements(db, auth, orderId, String(order.kho_status ?? 'KHONG'), now),
    );
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

  statements.push(
    eventStatement(db, {
      type: 'ORDER_SUBMITTED',
      entityType: 'ORDER',
      entityId: orderId,
      actorId: auth.user.id,
      actorType: auth.actorType ?? 'USER',
      payload: { rules: requests.map((r) => r.rule) },
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
  filters: { status?: string; customerId?: string; q?: string; limit?: number; khoStatus?: string },
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
  if (filters.khoStatus) {
    where.push('o.flow_on = 1 AND o.kho_status = ?');
    params.push(filters.khoStatus);
  }
  // Tìm theo từ: mã đơn, tên khách, số điện thoại, người phụ trách, mã / tên sản phẩm trong đơn.
  // Nhiều từ thì đơn phải khớp tất cả các từ (mỗi từ khớp ở một trong các trường trên).
  for (const w of (filters.q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6)) {
    const like = `%${w.replace(/[%_]/g, '')}%`;
    where.push(
      `(o.order_no LIKE ? OR c.name LIKE ? OR c.phone_text LIKE ? OR c.phone_normalized LIKE ? OR u.display_name LIKE ?
        OR EXISTS (SELECT 1 FROM order_items oi JOIN products pr ON pr.id = oi.product_id
                   WHERE oi.order_id = o.id AND (pr.sku LIKE ? OR pr.name LIKE ?)))`,
    );
    params.push(like, like, like, like, like, like, like);
  }

  const rows = await db
    .prepare(
      `SELECT o.id, o.order_no, o.customer_id, c.name AS customer_name, o.owner_id,
              u.display_name AS owner_name, o.order_date, o.total_amount, o.cod_amount,
              o.approval_status, o.delivery_status, o.payment_status, o.accounting_status,
              o.flow_on, o.kho_status, o.ship_date, o.need_date, o.hold_until, o.updated_at,
              c.phone_text AS customer_phone,
              (SELECT COUNT(DISTINCT pp.id) FROM payment_allocations pa JOIN payments pp ON pp.id = pa.payment_id
                 WHERE pa.order_id = o.id AND pa.reversed_at IS NULL AND pp.accounting_status = 'CHUA_XAC_NHAN' AND pp.is_adjustment = 0) AS pending_pay_n,
              (SELECT group_concat(DISTINCT pp.id) FROM payment_allocations pa JOIN payments pp ON pp.id = pa.payment_id
                 WHERE pa.order_id = o.id AND pa.reversed_at IS NULL AND pp.accounting_status = 'CHUA_XAC_NHAN' AND pp.is_adjustment = 0) AS pending_pay_ids,
              (SELECT COUNT(*) FROM approvals ap WHERE ap.entity_type = 'ORDER' AND ap.entity_id = o.id AND ap.status = 'PENDING') AS pending_approval_n,
              (SELECT group_concat(pr.sku || ' x ' || oi.qty, ', ')
                 FROM order_items oi JOIN products pr ON pr.id = oi.product_id WHERE oi.order_id = o.id) AS items_text,
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
      `SELECT o.*, (SELECT COALESCE(SUM(pa.amount), 0) FROM payment_allocations pa JOIN payments pp ON pp.id = pa.payment_id
                    WHERE pa.order_id = o.id AND pa.reversed_at IS NULL AND pp.purpose = 'DEPOSIT') AS deposit_applied,
              c.name AS customer_name, c.phone_text AS customer_phone, COALESCE(c.address, c.province) AS customer_address, c.price_mode AS price_mode, u.display_name AS owner_name,
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
  if (!seesAllOrders(auth) && order.owner_id !== auth.user.id)
    throw notFound('Không tìm thấy đơn hàng');

  const itemRows = await db
    .prepare(
      `SELECT oi.id, oi.product_id, p.sku, p.name AS product_name, oi.qty, oi.base_price,
              oi.applied_price, oi.line_total, oi.price_override, oi.price_override_reason,
              oi.is_gift, oi.gift_qty, oi.promotion_note, p.unit, p.pack_size
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ? ORDER BY oi.created_at, oi.rowid`,
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

  const revisionRows = await db
    .prepare(
      `SELECT r.id, r.revision_no, r.reason, r.stage, r.created_at, r.before_json, r.after_json,
              u.display_name AS edited_by_name
       FROM order_revisions r LEFT JOIN users u ON u.id = r.edited_by
       WHERE r.order_id = ? ORDER BY r.revision_no DESC`,
    )
    .bind(orderId)
    .all<{
      id: string;
      revision_no: number;
      reason: string | null;
      stage: string | null;
      created_at: string;
      before_json: string;
      after_json: string;
      edited_by_name: string | null;
    }>();
  const revisions: OrderRevision[] = (revisionRows.results ?? []).map((r) => ({
    id: r.id,
    revision_no: r.revision_no,
    reason: r.reason,
    stage: r.stage,
    edited_by_name: r.edited_by_name,
    created_at: r.created_at,
    before: JSON.parse(r.before_json) as OrderRevisionSnapshot,
    after: JSON.parse(r.after_json) as OrderRevisionSnapshot,
  }));

  const khoLines = await db
    .prepare(
      `SELECT product_id, status, ok_qty, eta_date, note, shipped_qty FROM order_kho_lines WHERE order_id = ?`,
    )
    .bind(orderId)
    .all<NonNullable<OrderDetail['kho_lines']>[number]>();
  const flowLog = await db
    .prepare(
      `SELECT l.id, l.at, u.display_name AS actor_name, l.action, l.from_status, l.to_status, l.note
       FROM order_flow_log l LEFT JOIN users u ON u.id = l.actor_id
       WHERE l.order_id = ? ORDER BY l.id DESC`,
    )
    .bind(orderId)
    .all<NonNullable<OrderDetail['flow_log']>[number]>();

  return {
    ...order,
    kho_lines: khoLines.results ?? [],
    flow_log: flowLog.results ?? [],
    revisions,
    remaining_amount:
      (order.total_amount ?? 0) - (order.cod_amount ?? 0) - (order.received_amount ?? 0),
    items: splitGiftRows(itemRows.results ?? []).map((i) => ({
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
  ship?: { day?: string | null; by?: string | null },
): Promise<void> {
  const order = await db
    .prepare(
      'SELECT id, approval_status, delivery_status, flow_on, kho_status, accounting_status FROM orders WHERE id = ? AND deleted_at IS NULL',
    )
    .bind(orderId)
    .first<{
      id: string;
      approval_status: string;
      delivery_status: string;
      flow_on: number;
      kho_status: string;
      accounting_status: string;
    }>();
  if (!order) throw notFound('Không tìm thấy đơn hàng');
  if (order.approval_status !== 'APPROVED') {
    throw badRequest(
      'ORDER_NOT_APPROVED',
      'Chỉ đơn đã duyệt mới cập nhật được trạng thái giao hàng.',
    );
  }
  // Đơn theo luồng kho: xuất kho phải do kế toán kho ghi số thực xuất ở đơn, không bấm tắt được.
  if (order.flow_on === 1 && status === 'DA_XUAT_KHO' && order.delivery_status === 'CHUA_XUAT') {
    throw badRequest(
      'USE_FLOW_SHIP',
      'Đơn theo luồng kho: kế toán kho vào đơn bấm "Xuất kho" và ghi số thực xuất.',
    );
  }
  const now = nowIso();
  const at = ship?.day ? shipDayToIso(ship.day) : now;
  if (ship?.day && ship.day > vnDate()) throw badRequest('BAD_SHIP_DAY', 'Ngày xuất kho không được sau hôm nay.');
  // Kho đã xác nhận xuất / giao thì đơn tự vào công nợ chính thức, kế toán không phải bấm xác nhận thêm một lần nữa.
  // (Đơn theo luồng kho thì tự xác nhận ở bước sale chốt tiền.) Vẫn "Bỏ xác nhận kế toán" được nếu cần.
  const autoAccount =
    (status === 'DA_XUAT_KHO' || status === 'DA_GIAO') &&
    order.approval_status === 'APPROVED' &&
    order.flow_on !== 1 &&
    order.accounting_status !== 'DA_XAC_NHAN';
  await db.batch([
    ...(autoAccount
      ? [
          db
            .prepare("UPDATE orders SET accounting_status = 'DA_XAC_NHAN', accounting_confirmed_at = ?, accounting_auto = 1 WHERE id = ?")
            .bind(now, orderId),
          auditStatement(db, {
            actorId: auth.user.id,
            action: 'ACCOUNTING_CONFIRMED',
            entityType: 'ORDER',
            entityId: orderId,
            before: { accounting_status: order.accounting_status },
            after: { accounting_status: 'DA_XAC_NHAN' },
            reason: 'Tự xác nhận khi kho xác nhận đã xuất / giao',
            requestId: ctx.requestId,
            ip: ctx.ip,
          }),
        ]
      : []),
    db
      .prepare(
        `UPDATE orders SET delivery_status = ?, delivered_at = CASE WHEN ? IN ('DA_XUAT_KHO','DA_GIAO')
           THEN COALESCE(delivered_at, ?) ELSE delivered_at END,
           shipped_by_name = CASE WHEN ? IN ('DA_XUAT_KHO','DA_GIAO') AND ? IS NOT NULL THEN ? ELSE shipped_by_name END,
           updated_at = ? WHERE id = ?`,
      )
      .bind(status, status, at, status, ship?.by ?? null, ship?.by ?? null, now, orderId),
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
  // Đơn đã đi: trừ tiền cọc còn dư của khách vào đơn này (lỗi thì không chặn việc xuất kho).
  if (status === 'DA_XUAT_KHO' || status === 'DA_GIAO') {
    try {
      await applyDepositsToOrder(db, auth, orderId, ctx);
    } catch (e) {
      console.error('[deposit] không trừ được cọc', e);
    }
  }
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
      `SELECT id, order_no, approval_status, delivery_status, accounting_status, flow_on, kho_status
       FROM orders WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(orderId)
    .first<{
      id: string;
      order_no: string;
      approval_status: string;
      delivery_status: string;
      accounting_status: string;
      flow_on: number;
      kho_status: string;
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
    if (order.flow_on === 1 && order.kho_status !== 'DA_CHOT_TIEN') {
      throw badRequest(
        'ORDER_MONEY_NOT_LOCKED',
        'Đơn chưa được sale chốt tiền phải thu (sau khi đối chiếu số thực xuất). Nhờ sale chốt tiền trước.',
      );
    }
  }

  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE orders SET accounting_status = ?,
           accounting_confirmed_at = CASE WHEN ? = 'DA_XAC_NHAN' THEN ? ELSE NULL END,
           accounting_auto = 0,
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
  if (auth.scope === 'OWN' && order.owner_id !== auth.user.id)
    throw notFound('Không tìm thấy đơn hàng');
  if (order.approval_status === 'CANCELLED') {
    throw badRequest('ORDER_CANCELLED', 'Đơn này đã huỷ trước đó.');
  }
  if (order.delivery_status !== 'CHUA_XUAT') {
    throw badRequest(
      'ORDER_DELIVERED',
      'Đơn đã xuất kho hoặc đã giao thì không huỷ được. Dùng trạng thái Hoàn.',
    );
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
    eventStatement(db, {
      type: 'ORDER_CANCELLED',
      entityType: 'ORDER',
      entityId: orderId,
      actorId: auth.user.id,
      actorType: auth.actorType ?? 'USER',
      payload: { reason },
    }),
    // Đơn theo luồng kho: ghi vào lịch sử bước. Hàng kho đã giữ cho đơn tự nhả vì kho chỉ giữ cho đơn còn Đã duyệt.
    db
      .prepare(
        `INSERT INTO order_flow_log (order_id, at, actor_id, action, from_status, to_status, note)
         SELECT id, ?, ?, 'HUY_DON', kho_status, kho_status, ? FROM orders WHERE id = ? AND flow_on = 1`,
      )
      .bind(now, auth.user.id, reason, orderId),
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

/**
 * Sửa đơn đã tạo (đổi dòng hàng, số lượng, giá, chiết khấu, phí, ghi chú). Dùng cho 3 tình huống thật:
 *  - khách đổi ý, hoặc kho báo hết hàng nên khách đổi đơn;
 *  - kho xuất sai, sale chỉnh lại đơn để tính lại tiền cho khách.
 *
 * Quy tắc:
 *  - Đơn đã huỷ, đã hoàn hàng thì không sửa. Đơn kế toán đã xác nhận ghi nợ thì phải được kế toán
 *    bỏ xác nhận trước (để công nợ không bị đổi âm thầm), sửa xong kế toán xác nhận lại.
 *  - Đơn nháp/bị từ chối: sửa tự do, quay về Nháp để gửi duyệt lại.
 *  - Đơn đang chờ duyệt: huỷ các yêu cầu cũ, tạo yêu cầu mới theo nội dung mới.
 *  - Đơn đã duyệt: nếu nội dung mới không phát sinh ngoại lệ (giá lệch chuẩn mới, vượt hạn mức)
 *    thì giữ nguyên Đã duyệt; có ngoại lệ thì quay về Chờ duyệt.
 *  - Mỗi lần sửa lưu bản trước/sau và lý do vào order_revisions + nhật ký hệ thống.
 */
export async function updateOrder(
  db: D1Database,
  config: AppConfig,
  auth: AuthContext,
  orderId: string,
  input: OrderUpdateInput,
  ctx: CreateOrderContext,
): Promise<{
  status: string;
  total_before: number;
  total_after: number;
  revision_no: number;
  needs_approval: boolean;
  approvals: Array<{ rule_code: string; required_role: string }>;
  tier_request?: boolean;
}> {
  const order = await db
    .prepare(
      `SELECT o.*, COALESCE(a.received, 0) AS received_amount
       FROM orders o
       LEFT JOIN (${RECEIVED_BY_ORDER}) a ON a.order_id = o.id
       WHERE o.id = ? AND o.deleted_at IS NULL`,
    )
    .bind(orderId)
    .first<Record<string, unknown>>();
  if (!order) throw notFound('Không tìm thấy đơn hàng');
  if (auth.scope === 'OWN' && order.owner_id !== auth.user.id)
    throw notFound('Không tìm thấy đơn hàng');

  const approvalStatus = order.approval_status as string;
  const deliveryStatus = order.delivery_status as string;
  if (approvalStatus === 'CANCELLED') {
    throw badRequest('ORDER_CANCELLED', 'Đơn đã huỷ nên không sửa được.');
  }
  if (deliveryStatus === 'HOAN') {
    throw badRequest('ORDER_RETURNED', 'Đơn đã hoàn hàng nên không sửa được. Hãy tạo đơn mới.');
  }
  // Đơn kế toán xác nhận BẰNG TAY thì khoá. Đơn tự xác nhận khi kho xuất / giao thì vẫn sửa được (kho xuất sai).
  if (order.accounting_status === 'DA_XAC_NHAN' && Number(order.accounting_auto ?? 0) !== 1) {
    throw badRequest(
      'ORDER_ACCOUNTING_LOCKED',
      'Đơn này kế toán đã xác nhận ghi nợ. Nhờ kế toán bấm "Bỏ xác nhận" rồi sửa đơn, sửa xong kế toán xác nhận lại.',
    );
  }

  const isDraft = approvalStatus === 'DRAFT' || approvalStatus === 'REJECTED';
  const reason = (input.reason ?? '').trim();
  if (!isDraft && reason.length < 5) {
    throw unprocessable(
      'EDIT_REASON_REQUIRED',
      'Đơn đã gửi duyệt hoặc đã xuất kho: ghi lý do sửa đơn (tối thiểu 5 ký tự) để mọi người nắm được.',
      { reason: 'Bắt buộc ghi lý do sửa đơn' },
    );
  }

  const prepared = await prepareOrder(db, config, auth, {
    ...input,
    customer_id: order.customer_id as string,
    order_date: order.order_date as string,
  });

  const oldItemRows = await db
    .prepare(
      `SELECT oi.product_id, p.sku, p.name, oi.qty, oi.applied_price, oi.line_total,
              oi.price_override, oi.is_gift, oi.gift_qty
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ? ORDER BY oi.created_at`,
    )
    .bind(orderId)
    .all<{
      product_id: string;
      sku: string;
      name: string;
      qty: number;
      applied_price: number;
      line_total: number;
      price_override: number;
      is_gift: number;
      gift_qty: number;
    }>();
  const oldItems = splitGiftRows(oldItemRows.results ?? []);

  const before: OrderRevisionSnapshot = {
    items: oldItems.map((i) => ({
      sku: i.sku,
      name: i.name,
      qty: i.qty,
      applied_price: i.applied_price,
      line_total: i.line_total,
      is_gift: Boolean(i.is_gift),
    })),
    subtotal: order.subtotal as number,
    discount_amount: order.discount_amount as number,
    bonus_deduction: order.bonus_deduction as number,
    shipping_fee: order.shipping_fee as number,
    total_amount: order.total_amount as number,
    cod_amount: order.cod_amount as number,
    note: (order.note as string | null) ?? null,
  };
  const after: OrderRevisionSnapshot = {
    items: prepared.lines.map((l) => ({
      sku: l.sku,
      name: l.product_name,
      qty: l.qty,
      applied_price: l.applied_price,
      line_total: l.line_total,
      is_gift: Boolean(l.is_gift),
    })),
    subtotal: prepared.totals.subtotal,
    discount_amount: prepared.totals.discountAmount,
    bonus_deduction: prepared.totals.bonusDeduction,
    shipping_fee: prepared.totals.shippingFee,
    total_amount: prepared.totals.totalAmount,
    cod_amount: prepared.totals.codAmount,
    note: input.note ?? null,
  };

  const oldTotal = before.total_amount;
  const newTotal = after.total_amount;
  const wasApproved = approvalStatus === 'APPROVED';
  const counted = wasApproved && (deliveryStatus === 'DA_XUAT_KHO' || deliveryStatus === 'DA_GIAO');

  type Req = { rule: string; role: 'MANAGER' | 'CEO'; reason: string; payload: unknown };
  const requests: Req[] = [];
  if (!isDraft) {
    // Giá thoả thuận đã được duyệt trước đó (cùng mã, cùng giá) thì không phải duyệt lại.
    const approvedKeys = new Set(
      wasApproved
        ? oldItems.filter((i) => i.price_override).map((i) => `${i.product_id}:${i.applied_price}`)
        : [],
    );
    for (const a of prepared.approvals) {
      const p = a.payload as { product_id?: string; proposed_price?: number };
      if (approvedKeys.has(`${p.product_id}:${p.proposed_price}`)) continue;
      requests.push({ rule: a.rule, role: a.requiredRole, reason: a.reason, payload: a.payload });
    }

    // Sửa giảm tiền cho đơn đã duyệt không làm rủi ro công nợ tăng nên không kiểm lại hạn mức.
    if (!(wasApproved && newTotal <= oldTotal)) {
      const debt = await getCustomerDebt(db, order.customer_id as string);
      // Đơn đã tính vào công nợ rồi thì chỉ cộng phần chênh lệch, tránh tính trùng.
      const addAmount = counted ? newTotal - oldTotal : newTotal;
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
        addAmount,
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
            order_amount: newTotal,
            edited: true,
          },
        });
      }
    }
  }

  let newStatus = approvalStatus;
  let newRequests: Req[] = [];
  if (isDraft) {
    newStatus = 'DRAFT';
  } else if (approvalStatus === 'PENDING_APPROVAL') {
    newRequests = requests.length
      ? requests
      : [
          {
            rule: 'ORDER_STANDARD',
            role: 'MANAGER',
            reason: 'Đơn đã được sửa - chờ Quản lý duyệt lại',
            payload: { total_amount: newTotal, edited: true },
          },
        ];
  } else if (requests.length > 0) {
    // Đơn đã duyệt mà nội dung mới phát sinh ngoại lệ thì phải duyệt lại.
    newStatus = 'PENDING_APPROVAL';
    newRequests = requests;
  }

  // Luồng kho: nội dung đơn đổi thì kho phải kiểm lại / quản lý duyệt lại.
  const khoNow = String(order.kho_status ?? 'KHONG');
  let newKho = khoNow;
  if (Number(order.flow_on) === 1 && !isDraft) {
    const after = khoAfterEdit(auth, khoNow, approvalStatus);
    newKho = after.kho;
    if (after.backToApproval && newStatus === 'APPROVED') {
      // Đơn đã duyệt, đang chờ kho xuất mà sale sửa: quản lý duyệt lại, kho thả hàng đã giữ.
      newStatus = 'PENDING_APPROVAL';
      newRequests = requests.length
        ? requests
        : [
            {
              rule: 'ORDER_STANDARD',
              role: 'MANAGER',
              reason: 'Đơn đã sửa sau khi duyệt - chờ quản lý duyệt lại',
              payload: { total_amount: newTotal, edited: true },
            },
          ];
    }
  }

  const now = nowIso();
  const received = order.received_amount as number;
  const paymentStatus =
    received > 0
      ? derivePaymentStatus(newTotal, received + prepared.totals.codAmount)
      : (order.payment_status as string);

  const revRow = await db
    .prepare(
      'SELECT COALESCE(MAX(revision_no), 0) + 1 AS n FROM order_revisions WHERE order_id = ?',
    )
    .bind(orderId)
    .first<{ n: number }>();
  const revisionNo = revRow?.n ?? 1;

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE orders SET subtotal = ?, discount_amount = ?, bonus_deduction = ?, shipping_fee = ?,
           total_amount = ?, cod_amount = ?, note = ?, promotion_code = ?, promotion_note = ?,
           approval_status = ?, payment_status = ?, rejected_reason = NULL,
           submitted_at = CASE WHEN ? = 'PENDING_APPROVAL' AND ? <> 'PENDING_APPROVAL' THEN ? ELSE submitted_at END,
           updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        prepared.totals.subtotal,
        prepared.totals.discountAmount,
        prepared.totals.bonusDeduction,
        prepared.totals.shippingFee,
        prepared.totals.totalAmount,
        prepared.totals.codAmount,
        input.note ?? null,
        input.promotion_code ?? null,
        input.promotion_note ?? null,
        newStatus,
        paymentStatus,
        newStatus,
        approvalStatus,
        now,
        now,
        orderId,
      ),
    db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(orderId),
  ];

  for (const line of mergeLinesForStorage(prepared.lines)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO order_items (id, order_id, product_id, qty, base_price, applied_price, line_total,
             price_override, price_override_reason, tier_id_snapshot, is_gift, promotion_note, created_at, gift_qty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          line.gift_qty,
        ),
    );
  }

  if (!isDraft) {
    statements.push(
      db
        .prepare(
          `UPDATE approvals SET status = 'CANCELLED', decided_at = ?
           WHERE entity_type = 'ORDER' AND entity_id = ? AND status = 'PENDING'`,
        )
        .bind(now, orderId),
    );
  }
  for (const req of newRequests) {
    statements.push(
      db
        .prepare(
          `INSERT INTO approvals (id, entity_type, entity_id, rule_code, requester_id, required_role,
             status, reason, payload_json, created_at)
           VALUES (?, 'ORDER', ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
        )
        .bind(
          newId(),
          orderId,
          req.rule,
          auth.user.id,
          req.role,
          req.reason,
          JSON.stringify(req.payload),
          now,
        ),
    );
  }

  statements.push(
    ...editFlowStatements(db, auth, orderId, khoNow, newKho, reason || 'Sửa đơn', now),
  );

  statements.push(
    db
      .prepare(
        `INSERT INTO order_revisions (id, order_id, revision_no, edited_by, reason, stage, before_json,
           after_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        newId(),
        orderId,
        revisionNo,
        auth.user.id,
        reason || null,
        `${approvalStatus}/${deliveryStatus}`,
        JSON.stringify(before),
        JSON.stringify(after),
        now,
      ),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'ORDER_EDITED',
      entityType: 'ORDER',
      entityId: orderId,
      before: {
        total_amount: oldTotal,
        approval_status: approvalStatus,
        delivery_status: deliveryStatus,
      },
      after: {
        total_amount: newTotal,
        approval_status: newStatus,
        lines: after.items.length,
        revision_no: revisionNo,
      },
      reason: reason || null,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  );

  statements.push(
    eventStatement(db, {
      type: 'ORDER_EDITED',
      entityType: 'ORDER',
      entityId: orderId,
      actorId: auth.user.id,
      actorType: auth.actorType ?? 'USER',
      payload: {
        revision_no: revisionNo,
        total_before: oldTotal,
        total_after: newTotal,
        status: newStatus,
      },
    }),
  );
  if (prepared.tier_change) {
    statements.push(
      db
        .prepare('UPDATE customers SET tier_id = ?, updated_at = ? WHERE id = ?')
        .bind(prepared.tier_change.to, nowIso(), prepared.tier_change.customer_id),
      auditStatement(db, {
        actorId: auth.user.id,
        action: 'CUSTOMER_TIER_CHANGED',
        entityType: 'CUSTOMER',
        entityId: prepared.tier_change.customer_id,
        before: { tier_id: prepared.tier_change.from, tier: prepared.tier_change.from_name },
        after: { tier_id: prepared.tier_change.to, tier: prepared.tier_change.to_name },
        reason: 'Khách lên cấp: sale đổi cấp giá khi sửa đơn',
        requestId: ctx.requestId,
        ip: ctx.ip,
      }),
    );
  }
  await db.batch(statements);
  if (prepared.tier_request) {
    try {
      const { requestTierChange } = await import('./approvals');
      await requestTierChange(db, auth, prepared.tier_request.customer_id, prepared.tier_request.to, `${prepared.tier_request.reason} (sửa đơn ${order.order_no ?? ''})`.trim(), ctx);
    } catch (e) {
      console.error('[tier-request]', e);
    }
  }
  return {
    tier_request: Boolean(prepared.tier_request),
    status: newStatus,
    total_before: oldTotal,
    total_after: newTotal,
    revision_no: revisionNo,
    needs_approval: newStatus === 'PENDING_APPROVAL',
    approvals: newRequests.map((r) => ({ rule_code: r.rule, required_role: r.role })),
  };
}

export function assertCanCreateForCustomer(
  auth: AuthContext,
  customerOwnerId: string | null,
): void {
  if (auth.scope === 'OWN' && customerOwnerId !== auth.user.id) {
    throw forbidden('Bạn chỉ được tạo đơn cho khách hàng mình phụ trách');
  }
}

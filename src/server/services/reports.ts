import { vnDate } from '@shared/datetime';
import type { AppConfig } from '../lib/settings';

export interface SalesRow {
  user_id: string | null;
  display_name: string;
  orders: number;
  gross_revenue: number; // tổng phải thu của đơn đã duyệt
  gift_value: number; // giá trị hàng tặng theo giá chuẩn
  discount_total: number; // chiết khấu + trừ thưởng
  collected: number; // tiền đã thu (kế toán xác nhận)
  new_customers: number;
  commission: number; // thưởng ước tính
}

export interface SalesReport {
  period: string;
  from: string;
  to: string;
  basis: 'REVENUE' | 'COLLECTED';
  commission_percent: number;
  rows: SalesRow[];
  totals: Omit<SalesRow, 'user_id' | 'display_name'>;
  by_month: Array<{ month: string; gross_revenue: number; collected: number; orders: number }>;
}

function periodRange(period: string): { from: string; to: string } {
  // period: 'YYYY-MM' cho báo cáo tháng, 'YYYY' cho báo cáo năm.
  if (/^\d{4}$/.test(period)) return { from: `${period}-01-01`, to: `${period}-12-31` };
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * Doanh số và thưởng theo nhân viên.
 * Thưởng = tỷ lệ % (cấu hình được) nhân với căn cứ tính:
 *   - COLLECTED: tiền thực thu đã được kế toán xác nhận (mặc định, an toàn cho dòng tiền).
 *   - REVENUE:   tổng phải thu của đơn đã duyệt.
 * Đây là số ƯỚC TÍNH để theo dõi; con số chi trả cuối cùng do công ty chốt.
 */
export async function salesReport(
  db: D1Database,
  config: AppConfig,
  options: { period?: string; ownerId?: string | null },
): Promise<SalesReport> {
  const period = options.period ?? vnDate().slice(0, 7);
  const { from, to } = periodRange(period);
  const ownerFilter = options.ownerId ? 'AND o.owner_id = ?' : '';
  const ownerParams = options.ownerId ? [options.ownerId] : [];

  const rows = await db
    .prepare(
      `SELECT u.id AS user_id, u.display_name,
        (SELECT COUNT(*) FROM orders o WHERE o.owner_id = u.id AND o.deleted_at IS NULL
           AND o.approval_status = 'APPROVED' AND o.order_date BETWEEN ? AND ?) AS orders,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.owner_id = u.id
           AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
           AND o.order_date BETWEEN ? AND ?) AS gross_revenue,
        (SELECT COALESCE(SUM(oi.qty * COALESCE(oi.base_price, 0)), 0)
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.owner_id = u.id AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
             AND oi.is_gift = 1 AND o.order_date BETWEEN ? AND ?) AS gift_value,
        (SELECT COALESCE(SUM(o.discount_amount + o.bonus_deduction), 0) FROM orders o
           WHERE o.owner_id = u.id AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
             AND o.order_date BETWEEN ? AND ?) AS discount_total,
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
           JOIN customers c ON c.id = p.customer_id
           WHERE c.owner_id = u.id AND p.accounting_status = 'DA_XAC_NHAN'
             AND p.paid_at BETWEEN ? AND ?) AS collected,
        (SELECT COUNT(*) FROM customers c WHERE c.owner_id = u.id AND c.deleted_at IS NULL
           AND substr(c.created_at, 1, 10) BETWEEN ? AND ?) AS new_customers
       FROM users u
       WHERE u.deleted_at IS NULL AND u.role = 'EMPLOYEE'
         ${options.ownerId ? 'AND u.id = ?' : ''}
       ORDER BY gross_revenue DESC`,
    )
    .bind(
      from,
      to,
      from,
      to,
      from,
      to,
      from,
      to,
      from,
      to,
      from,
      to,
      ...(options.ownerId ? [options.ownerId] : []),
    )
    .all<Omit<SalesRow, 'commission'>>();

  const percent = config.commissionPercent;
  const basis = config.commissionBasis;
  const list: SalesRow[] = (rows.results ?? []).map((r) => ({
    ...r,
    commission: Math.round(((basis === 'COLLECTED' ? r.collected : r.gross_revenue) * percent) / 100),
  }));

  const totals = list.reduce(
    (acc, r) => ({
      orders: acc.orders + r.orders,
      gross_revenue: acc.gross_revenue + r.gross_revenue,
      gift_value: acc.gift_value + r.gift_value,
      discount_total: acc.discount_total + r.discount_total,
      collected: acc.collected + r.collected,
      new_customers: acc.new_customers + r.new_customers,
      commission: acc.commission + r.commission,
    }),
    {
      orders: 0,
      gross_revenue: 0,
      gift_value: 0,
      discount_total: 0,
      collected: 0,
      new_customers: 0,
      commission: 0,
    },
  );

  // Biểu đồ 12 tháng gần nhất để nhìn xu hướng.
  const year = period.slice(0, 4);
  const byMonth = await db
    .prepare(
      `SELECT substr(o.order_date, 1, 7) AS month,
              COALESCE(SUM(o.total_amount), 0) AS gross_revenue,
              COUNT(*) AS orders,
              (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
                 WHERE substr(p.paid_at, 1, 7) = substr(o.order_date, 1, 7)
                   AND p.accounting_status = 'DA_XAC_NHAN') AS collected
       FROM orders o
       WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
         AND substr(o.order_date, 1, 4) = ? ${ownerFilter}
       GROUP BY month ORDER BY month`,
    )
    .bind(year, ...ownerParams)
    .all<{ month: string; gross_revenue: number; collected: number; orders: number }>();

  return {
    period,
    from,
    to,
    basis,
    commission_percent: percent,
    rows: list,
    totals,
    by_month: byMonth.results ?? [],
  };
}

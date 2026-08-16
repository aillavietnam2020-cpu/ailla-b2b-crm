/** Đọc cấu hình vận hành từ app_settings, có giá trị mặc định an toàn. */

export interface AppConfig {
  priceOverrideManagerThresholdPercent: number;
  priceOverrideCeoThresholdPercent: number;
  blockOnDebtLimitExceeded: boolean;
  accountingPendingAlertHours: number;
  reorderDefaultCycleDays: number;
  activityCorrectionWindowMinutes: number;
  reconciliationBaseline: Record<string, number>;
  authSessionHours: number;
  authMaxFailedLogins: number;
  authLockMinutes: number;
  /** Tỷ lệ thưởng (%) tính trên doanh số dùng để ước tính thưởng tháng của sale. */
  commissionPercent: number;
  /** Căn cứ tính thưởng: doanh số đơn đã duyệt hay tiền đã thu thực tế. */
  commissionBasis: 'REVENUE' | 'COLLECTED';
}

const DEFAULTS: AppConfig = {
  priceOverrideManagerThresholdPercent: 5,
  priceOverrideCeoThresholdPercent: 15,
  blockOnDebtLimitExceeded: true,
  accountingPendingAlertHours: 72,
  reorderDefaultCycleDays: 30,
  activityCorrectionWindowMinutes: 120,
  reconciliationBaseline: {
    products: 134,
    customers: 62,
    source_orders: 35,
    source_order_lines: 206,
    managed_orders: 34,
    // Tài liệu ghi 26 nhưng file thật chỉ có 25 giao dịch: dòng thứ 26 trong sheet THANH_TOAN
    // chỉ điền mỗi ô "KẾ TOÁN XÁC NHẬN", không có ngày/khách/tiền. Tổng tiền vẫn khớp tuyệt đối.
    payments: 25,
    payments_total: 180073600,
    opening_debt_total: 1256920982,
    official_debt_total: 1168465995,
    projected_debt_total: 1397046765,
  },
  authSessionHours: 12,
  authMaxFailedLogins: 5,
  authLockMinutes: 15,
  commissionPercent: 1,
  commissionBasis: 'COLLECTED',
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadConfig(db: D1Database): Promise<AppConfig> {
  const rows = await db.prepare('SELECT key, value_json FROM app_settings').all<{
    key: string;
    value_json: string;
  }>();
  const map = new Map((rows.results ?? []).map((r) => [r.key, r.value_json]));
  return {
    priceOverrideManagerThresholdPercent: parseJson(
      map.get('price_override.manager_threshold_percent'),
      DEFAULTS.priceOverrideManagerThresholdPercent,
    ),
    priceOverrideCeoThresholdPercent: parseJson(
      map.get('price_override.ceo_threshold_percent'),
      DEFAULTS.priceOverrideCeoThresholdPercent,
    ),
    blockOnDebtLimitExceeded: parseJson(
      map.get('debt.block_on_limit_exceeded'),
      DEFAULTS.blockOnDebtLimitExceeded,
    ),
    accountingPendingAlertHours: parseJson(
      map.get('accounting.pending_alert_hours'),
      DEFAULTS.accountingPendingAlertHours,
    ),
    reorderDefaultCycleDays: parseJson(
      map.get('reorder.default_cycle_days'),
      DEFAULTS.reorderDefaultCycleDays,
    ),
    activityCorrectionWindowMinutes: parseJson(
      map.get('activity.correction_window_minutes'),
      DEFAULTS.activityCorrectionWindowMinutes,
    ),
    reconciliationBaseline: parseJson(
      map.get('reconciliation.baseline'),
      DEFAULTS.reconciliationBaseline,
    ),
    authSessionHours: parseJson(map.get('auth.session_hours'), DEFAULTS.authSessionHours),
    authMaxFailedLogins: parseJson(map.get('auth.max_failed_logins'), DEFAULTS.authMaxFailedLogins),
    authLockMinutes: parseJson(map.get('auth.lock_minutes'), DEFAULTS.authLockMinutes),
    commissionPercent: parseJson(map.get('commission.percent'), DEFAULTS.commissionPercent),
    commissionBasis: parseJson(map.get('commission.basis'), DEFAULTS.commissionBasis),
  };
}

export const DEFAULT_CONFIG = DEFAULTS;

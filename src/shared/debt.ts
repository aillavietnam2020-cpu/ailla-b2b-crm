/**
 * Ba khái niệm công nợ (mục 9.1) - KHÔNG được gộp thành một số.
 *   - Công nợ chính thức = dư nợ cũ + phát sinh đã ghi nợ - đã thanh toán (kế toán xác nhận)
 *   - Chờ ghi nợ        = đơn đã giao/xuất nhưng kế toán chưa xác nhận
 *   - Chờ tiền về       = payment chưa xác nhận hoặc chưa phân bổ
 *   - Công nợ dự kiến   = chính thức + chờ ghi nợ - chờ tiền về
 */

export interface DebtInput {
  openingDebt: number;
  postedCharges: number; // đơn đã giao VÀ kế toán đã xác nhận
  confirmedPayments: number; // payment kế toán xác nhận và đã phân bổ
  pendingCharges: number; // đơn đủ trạng thái giao nhưng chưa xác nhận kế toán
  pendingCash: number; // payment chưa xác nhận / chưa phân bổ
  creditBalance?: number; // thu thừa, lưu riêng, không dùng số âm
}

export interface DebtResult {
  openingDebt: number;
  postedCharges: number;
  confirmedPayments: number;
  officialDebt: number;
  pendingCharges: number;
  pendingCash: number;
  projectedDebt: number;
  creditBalance: number;
}

export function computeDebt(input: DebtInput): DebtResult {
  const officialDebt = input.openingDebt + input.postedCharges - input.confirmedPayments;
  const projectedDebt = officialDebt + input.pendingCharges - input.pendingCash;
  return {
    openingDebt: input.openingDebt,
    postedCharges: input.postedCharges,
    confirmedPayments: input.confirmedPayments,
    officialDebt,
    pendingCharges: input.pendingCharges,
    pendingCash: input.pendingCash,
    projectedDebt,
    creditBalance: input.creditBalance ?? 0,
  };
}

export interface DebtLimitCheck {
  limit: number;
  officialExceeded: boolean;
  projectedExceeded: boolean;
  officialOver: number;
  projectedOver: number;
  blocked: boolean;
  requiredRole?: 'MANAGER' | 'CEO';
  message?: string;
}

/**
 * Kiểm tra hạn mức khi tạo/gửi duyệt đơn.
 * `additionalAmount` là tổng phải thu của đơn đang lập.
 */
export function checkDebtLimit(
  debt: DebtResult,
  limit: number,
  additionalAmount: number,
  blockOnExceeded = true,
): DebtLimitCheck {
  const official = debt.officialDebt + additionalAmount;
  const projected = debt.projectedDebt + additionalAmount;
  const officialExceeded = limit > 0 && official > limit;
  const projectedExceeded = limit > 0 && projected > limit;

  if (!officialExceeded && !projectedExceeded) {
    return {
      limit,
      officialExceeded: false,
      projectedExceeded: false,
      officialOver: 0,
      projectedOver: 0,
      blocked: false,
    };
  }

  const officialOver = Math.max(0, official - limit);
  const projectedOver = Math.max(0, projected - limit);
  // Vượt hạn mức chính thức là nghiêm trọng hơn: cần CEO duyệt ngoại lệ.
  const requiredRole: 'MANAGER' | 'CEO' = officialExceeded ? 'CEO' : 'MANAGER';

  return {
    limit,
    officialExceeded,
    projectedExceeded,
    officialOver,
    projectedOver,
    blocked: blockOnExceeded,
    requiredRole,
    message: officialExceeded
      ? `Đơn này làm công nợ chính thức vượt hạn mức ${limit.toLocaleString('vi-VN')}đ (vượt ${officialOver.toLocaleString('vi-VN')}đ).`
      : `Đơn này làm công nợ dự kiến vượt hạn mức ${limit.toLocaleString('vi-VN')}đ (vượt ${projectedOver.toLocaleString('vi-VN')}đ).`,
  };
}

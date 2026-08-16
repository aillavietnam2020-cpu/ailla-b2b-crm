/** Công thức đơn hàng (mục 8.2). */
import type { DeliveryStatus, PaymentStatus } from './enums';

export interface OrderLineInput {
  qty: number;
  appliedPrice: number;
}

export interface OrderTotalsInput {
  items: OrderLineInput[];
  discountAmount?: number;
  bonusDeduction?: number;
  shippingFee?: number;
  codAmount?: number;
  allocatedPayments?: number;
}

export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  bonusDeduction: number;
  shippingFee: number;
  totalAmount: number;
  codAmount: number;
  allocatedPayments: number;
  remainingAmount: number;
}

export function computeLineTotal(line: OrderLineInput): number {
  return Math.round(line.qty * line.appliedPrice);
}

export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotal = input.items.reduce((acc, line) => acc + computeLineTotal(line), 0);
  const discountAmount = input.discountAmount ?? 0;
  const bonusDeduction = input.bonusDeduction ?? 0;
  const shippingFee = input.shippingFee ?? 0;
  const codAmount = input.codAmount ?? 0;
  const allocatedPayments = input.allocatedPayments ?? 0;

  // Tổng phải thu = tiền hàng - chiết khấu - trừ thưởng tháng + phí vận chuyển
  const totalAmount = subtotal - discountAmount - bonusDeduction + shippingFee;
  // Tiền còn phải thu = tổng phải thu - COD/đặt cọc - các khoản đã phân bổ
  const remainingAmount = totalAmount - codAmount - allocatedPayments;

  return {
    subtotal,
    discountAmount,
    bonusDeduction,
    shippingFee,
    totalAmount,
    codAmount,
    allocatedPayments,
    remainingAmount,
  };
}

/** Trạng thái thanh toán suy ra từ số tiền đã nhận, không nhập tay. */
export function derivePaymentStatus(totalAmount: number, received: number): PaymentStatus {
  if (received <= 0) return 'CHUA_THU';
  if (received < totalAmount) return 'THU_MOT_PHAN';
  if (received === totalAmount) return 'DA_THU_DU';
  return 'THU_THUA';
}

/** Đơn đã rời kho thì mới phát sinh nghĩa vụ ghi nợ. */
export function isDeliveredForDebt(status: DeliveryStatus): boolean {
  return status === 'DA_XUAT_KHO' || status === 'DA_GIAO';
}

export function generateOrderNo(seq: number, at: Date = new Date()): string {
  const vn = new Date(at.getTime() + 7 * 60 * 60 * 1000);
  const y = vn.getUTCFullYear();
  const m = String(vn.getUTCMonth() + 1).padStart(2, '0');
  return `DH${y}${m}-${String(seq).padStart(4, '0')}`;
}

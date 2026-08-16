import { describe, expect, it } from 'vitest';
import { computeOrderTotals, derivePaymentStatus, generateOrderNo } from '@shared/orders';
import { checkLinePrice, resolveEffectivePrice } from '@shared/pricing';
import { checkDebtLimit, computeDebt } from '@shared/debt';
import { normalizePhone } from '@shared/phone';
import { percentDiff, toVndInteger } from '@shared/money';
import { canTransition, requiresManagerToReopen } from '@shared/stages';
import { activityCreateSchema } from '@shared/schemas';
import { evaluateAccountingPending, evaluateReorderDue, evaluateTaskOverdue } from '@shared/alerts';
import { normalizeExcelDate } from '@shared/datetime';

describe('Tiền tệ', () => {
  it('chuyển chuỗi tiền Việt về số nguyên đồng', () => {
    expect(toVndInteger('1.256.920.982')).toBe(1256920982);
    expect(toVndInteger('180.073.600đ')).toBe(180073600);
    expect(toVndInteger(95000)).toBe(95000);
  });

  it('ô trống trả NULL chứ không phải 0', () => {
    expect(toVndInteger('')).toBeNull();
    expect(toVndInteger(null)).toBeNull();
    expect(toVndInteger(undefined)).toBeNull();
  });

  it('giá trị 0 thật vẫn giữ là 0', () => {
    expect(toVndInteger(0)).toBe(0);
    expect(toVndInteger('0')).toBe(0);
  });

  it('tính phần trăm chênh lệch giá', () => {
    expect(percentDiff(100000, 90000)).toBe(-10);
    expect(percentDiff(100000, 100000)).toBe(0);
  });
});

describe('Số điện thoại (mục 2.1)', () => {
  it('khôi phục số 0 đầu khi Excel lưu dạng số', () => {
    const result = normalizePhone(987214568);
    expect(result.text).toBe('0987214568');
    expect(result.restoredLeadingZero).toBe(true);
    expect(result.needsReview).toBe(false);
  });

  it('chuyển +84 về dạng 0', () => {
    expect(normalizePhone('84912885604').normalized).toBe('0912885604');
  });

  it('thiếu số điện thoại thì đánh dấu cần kiểm tra, không bịa số', () => {
    const result = normalizePhone(null);
    expect(result.text).toBeNull();
    expect(result.needsReview).toBe(true);
  });

  it('số bất thường vẫn giữ nguyên nhưng vào hàng chờ kiểm tra', () => {
    const result = normalizePhone('12345');
    expect(result.needsReview).toBe(true);
    expect(result.text).toBe('12345');
  });
});

describe('Công thức đơn hàng (mục 8.2)', () => {
  it('tổng phải thu = tiền hàng - chiết khấu - trừ thưởng + phí vận chuyển', () => {
    const totals = computeOrderTotals({
      items: [
        { qty: 10, appliedPrice: 120000 },
        { qty: 5, appliedPrice: 80000 },
      ],
      discountAmount: 100000,
      bonusDeduction: 50000,
      shippingFee: 200000,
      codAmount: 500000,
      allocatedPayments: 200000,
    });
    expect(totals.subtotal).toBe(1600000);
    expect(totals.totalAmount).toBe(1650000);
    expect(totals.remainingAmount).toBe(950000);
  });

  it('trạng thái thanh toán suy ra từ số tiền nhận được', () => {
    expect(derivePaymentStatus(1000, 0)).toBe('CHUA_THU');
    expect(derivePaymentStatus(1000, 400)).toBe('THU_MOT_PHAN');
    expect(derivePaymentStatus(1000, 1000)).toBe('DA_THU_DU');
    expect(derivePaymentStatus(1000, 1200)).toBe('THU_THUA');
  });

  it('sinh mã đơn theo tháng', () => {
    expect(generateOrderNo(7, new Date('2026-08-16T00:00:00.000Z'))).toBe('DH202608-0007');
  });
});

describe('Quy tắc giá (mục 8.2)', () => {
  const rows = [
    { product_id: 'p1', tier_id: 't1', amount: 100000, valid_from: '2026-01-01', valid_to: null },
    { product_id: 'p1', tier_id: 't2', amount: null, valid_from: '2026-01-01', valid_to: null },
  ];

  it('lấy đúng giá hiệu lực theo ngày', () => {
    expect(resolveEffectivePrice(rows, 'p1', 't1', '2026-08-16').amount).toBe(100000);
  });

  it('giá NULL bị chặn, không tự áp giá', () => {
    const result = checkLinePrice({
      basePrice: null,
      appliedPrice: 50000,
      hasTier: true,
      managerThresholdPercent: 5,
      ceoThresholdPercent: 15,
    });
    expect(result.code).toBe('MISSING_PRICE');
    expect(result.blocked).toBe(true);
  });

  it('khách chưa map cấp giá thì chặn tạo đơn', () => {
    const result = checkLinePrice({
      basePrice: 100000,
      appliedPrice: 100000,
      hasTier: false,
      managerThresholdPercent: 5,
      ceoThresholdPercent: 15,
    });
    expect(result.code).toBe('TIER_UNKNOWN');
    expect(result.blocked).toBe(true);
  });

  it('giá thoả thuận nhỏ cần Quản lý duyệt, lệch lớn cần CEO', () => {
    const small = checkLinePrice({
      basePrice: 100000,
      appliedPrice: 92000,
      hasTier: true,
      managerThresholdPercent: 5,
      ceoThresholdPercent: 15,
    });
    expect(small.needsApproval).toBe(true);
    expect(small.requiredRole).toBe('MANAGER');

    const big = checkLinePrice({
      basePrice: 100000,
      appliedPrice: 70000,
      hasTier: true,
      managerThresholdPercent: 5,
      ceoThresholdPercent: 15,
    });
    expect(big.requiredRole).toBe('CEO');
  });

  it('giá đúng chuẩn thì không cần duyệt', () => {
    const result = checkLinePrice({
      basePrice: 100000,
      appliedPrice: 100000,
      hasTier: true,
      managerThresholdPercent: 5,
      ceoThresholdPercent: 15,
    });
    expect(result.code).toBe('OK');
    expect(result.needsApproval).toBe(false);
  });
});

describe('Công nợ ba khái niệm (mục 9.1)', () => {
  const debt = computeDebt({
    openingDebt: 1_000_000,
    postedCharges: 500_000,
    confirmedPayments: 300_000,
    pendingCharges: 200_000,
    pendingCash: 100_000,
  });

  it('công nợ chính thức = dư cũ + đã ghi nợ - đã thanh toán', () => {
    expect(debt.officialDebt).toBe(1_200_000);
  });

  it('công nợ dự kiến = chính thức + chờ ghi nợ - chờ tiền về', () => {
    expect(debt.projectedDebt).toBe(1_300_000);
  });

  it('không gộp ba số thành một', () => {
    expect(debt.pendingCharges).toBe(200_000);
    expect(debt.pendingCash).toBe(100_000);
  });

  it('vượt hạn mức chính thức thì cần CEO duyệt', () => {
    const check = checkDebtLimit(debt, 1_500_000, 400_000);
    expect(check.officialExceeded).toBe(true);
    expect(check.requiredRole).toBe('CEO');
  });

  it('chỉ vượt dự kiến thì Quản lý duyệt', () => {
    const check = checkDebtLimit(debt, 1_450_000, 200_000);
    expect(check.officialExceeded).toBe(false);
    expect(check.projectedExceeded).toBe(true);
    expect(check.requiredRole).toBe('MANAGER');
  });

  it('trong hạn mức thì không chặn', () => {
    expect(checkDebtLimit(debt, 10_000_000, 100_000).blocked).toBe(false);
  });
});

describe('Vòng đời khách hàng (mục 7.1)', () => {
  it('chỉ cho phép chuyển giai đoạn hợp lệ', () => {
    expect(canTransition('NEW', 'CONSULTING')).toBe(true);
    expect(canTransition('NEW', 'REGULAR')).toBe(false);
  });

  it('mở lại khách đã mất phải do Quản lý', () => {
    expect(requiresManagerToReopen('LOST', 'CONSULTING')).toBe(true);
  });
});

describe('Bắt buộc lịch chăm sóc tiếp (mục 7.2, AC-10)', () => {
  it('không cho lưu khi khách còn mở mà thiếu lịch tiếp', () => {
    const result = activityCreateSchema.safeParse({
      channel: 'Gọi điện',
      result: 'Đã trao đổi',
      content: 'Khách hẹn tuần sau xem lại',
    });
    expect(result.success).toBe(false);
  });

  it('cho lưu khi đóng khách kèm mã lý do', () => {
    const result = activityCreateSchema.safeParse({
      channel: 'Gọi điện',
      result: 'Từ chối',
      content: 'Khách đã có nhà phân phối khác',
      reason_code: 'DA_CO_NPP',
    });
    expect(result.success).toBe(true);
  });

  it('đóng khách mà thiếu mã lý do thì chặn', () => {
    const result = activityCreateSchema.safeParse({
      channel: 'Gọi điện',
      result: 'Mất khách',
      content: 'Khách không hợp tác nữa',
    });
    expect(result.success).toBe(false);
  });
});

describe('Rule cảnh báo (mục 13.1)', () => {
  it('TASK_OVERDUE khi quá hạn và chưa hoàn thành', () => {
    expect(
      evaluateTaskOverdue(
        { id: 't1', assignee_id: 'u1', status: 'OPEN', due_at: '2026-08-10', title: 'Gọi khách' },
        '2026-08-16',
      ),
    ).not.toBeNull();
    expect(
      evaluateTaskOverdue(
        { id: 't1', assignee_id: 'u1', status: 'DONE', due_at: '2026-08-10', title: 'Gọi khách' },
        '2026-08-16',
      ),
    ).toBeNull();
  });

  it('REORDER_DUE khi quá chu kỳ tái nhập', () => {
    const alert = evaluateReorderDue(
      { id: 'c1', name: 'Khách A', owner_id: 'u1', last_order_date: '2026-07-01', reorder_cycle_days: 30 },
      '2026-08-16',
      30,
    );
    expect(alert?.code).toBe('REORDER_DUE');
  });

  it('ACCOUNTING_PENDING khi đã giao nhưng kế toán chưa xác nhận quá ngưỡng', () => {
    const alert = evaluateAccountingPending(
      {
        id: 'o1',
        order_no: 'DH1',
        owner_id: 'u1',
        delivery_status: 'DA_GIAO',
        accounting_status: 'CHUA_XAC_NHAN',
        delivered_at: '2026-08-10T00:00:00.000Z',
      },
      '2026-08-16T00:00:00.000Z',
      72,
    );
    expect(alert?.code).toBe('ACCOUNTING_PENDING');
  });
});

describe('Chuẩn hoá ngày từ Excel', () => {
  it('đọc được serial number của Excel', () => {
    // Serial 45886 của Excel = ngày 17/08/2025
    expect(normalizeExcelDate(45886)).toBe('2025-08-17');
  });

  it('đọc được dd/mm/yyyy', () => {
    expect(normalizeExcelDate('16/08/2026')).toBe('2026-08-16');
  });
});

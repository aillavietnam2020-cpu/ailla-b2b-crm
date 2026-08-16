/** Quy tắc giá (mục 8.2). Thuần logic, không phụ thuộc database - dùng lại được ở test. */
import { percentDiff } from './money';

export interface PriceRow {
  product_id: string;
  tier_id: string;
  amount: number | null;
  valid_from: string;
  valid_to: string | null;
  status?: string;
}

/** Lấy giá hiệu lực của (sản phẩm, cấp) tại một ngày. Trả về null nếu chưa có giá. */
export function resolveEffectivePrice(
  rows: PriceRow[],
  productId: string,
  tierId: string,
  onDate: string,
): { amount: number | null; found: boolean } {
  const day = onDate.slice(0, 10);
  const candidates = rows
    .filter(
      (r) =>
        r.product_id === productId &&
        r.tier_id === tierId &&
        r.status !== 'DRAFT' &&
        r.valid_from.slice(0, 10) <= day &&
        (!r.valid_to || r.valid_to.slice(0, 10) >= day),
    )
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from));

  if (candidates.length === 0) return { amount: null, found: false };
  return { amount: candidates[0].amount, found: true };
}

export type PriceCheckCode =
  | 'OK'
  | 'MISSING_PRICE'
  | 'TIER_UNKNOWN'
  | 'PRICE_OVERRIDE_MANAGER'
  | 'PRICE_OVERRIDE_CEO';

export interface PriceCheckInput {
  basePrice: number | null;
  appliedPrice: number | null;
  hasTier: boolean;
  managerThresholdPercent: number;
  ceoThresholdPercent: number;
}

export interface PriceCheckResult {
  code: PriceCheckCode;
  blocked: boolean;
  needsApproval: boolean;
  requiredRole?: 'MANAGER' | 'CEO';
  diffPercent: number;
  message?: string;
}

/**
 * Kiểm tra một dòng đơn hàng:
 * - Khách chưa map cấp giá (ví dụ tier 'Khác') -> chặn, cần Quản lý map cấp.
 * - Giá cấp đang NULL -> chặn thêm dòng, tạo yêu cầu bổ sung giá.
 * - Giá sửa tay khác giá chuẩn -> tạo yêu cầu duyệt, giữ cả base và applied.
 */
export function checkLinePrice(input: PriceCheckInput): PriceCheckResult {
  if (!input.hasTier) {
    return {
      code: 'TIER_UNKNOWN',
      blocked: true,
      needsApproval: false,
      diffPercent: 0,
      message: 'Khách chưa được map sang một trong 8 cấp giá. Quản lý phải map cấp trước khi tạo đơn.',
    };
  }
  if (input.basePrice === null || input.basePrice === undefined) {
    return {
      code: 'MISSING_PRICE',
      blocked: true,
      needsApproval: false,
      diffPercent: 0,
      message: 'Mã hàng chưa có giá ở cấp này. Không được tự áp giá; hãy gửi yêu cầu bổ sung giá.',
    };
  }
  const applied = input.appliedPrice ?? input.basePrice;
  const diff = percentDiff(input.basePrice, applied);
  const abs = Math.abs(diff);

  if (abs === 0) {
    return { code: 'OK', blocked: false, needsApproval: false, diffPercent: 0 };
  }
  if (abs > input.ceoThresholdPercent) {
    return {
      code: 'PRICE_OVERRIDE_CEO',
      blocked: false,
      needsApproval: true,
      requiredRole: 'CEO',
      diffPercent: diff,
      message: `Giá thoả thuận lệch ${diff}% so với giá chuẩn - cần CEO duyệt.`,
    };
  }
  return {
    code: 'PRICE_OVERRIDE_MANAGER',
    blocked: false,
    needsApproval: true,
    requiredRole: 'MANAGER',
    diffPercent: diff,
    message: `Giá thoả thuận lệch ${diff}% so với giá chuẩn - cần Quản lý duyệt.`,
  };
}

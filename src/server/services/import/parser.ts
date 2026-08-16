/**
 * Đọc workbook CRM AILLA (01-CRM-B2B-AILLA.xlsx) theo mục 12.
 * Nguyên tắc:
 *  - Không bịa dữ liệu. Ô trống -> NULL, đồng thời gắn cảnh báo NEEDS_REVIEW.
 *  - Điện thoại luôn thành TEXT, khôi phục số 0 đầu khi Excel lưu dạng số.
 *  - Sheet CANH_BAO KHÔNG import (chứa công thức #REF!), cảnh báo được tính lại bằng query.
 */
import * as XLSX from 'xlsx';
import { normalizeExcelDate } from '@shared/datetime';
import { toVndInteger } from '@shared/money';
import { normalizePhone } from '@shared/phone';
import { TIER_LABELS, TIER_ORDER, type TierCode } from '@shared/enums';
import type { ImportIssue } from '@shared/types';

export interface ParsedProduct {
  row_no: number;
  sku: string;
  name: string;
  unit: string | null;
  pack_size: string | null;
  group_name: string | null;
  prices: Record<TierCode, number | null>;
  missing_tiers: TierCode[];
}

export interface ParsedCustomer {
  row_no: number;
  legacy_code: string;
  name: string;
  phone_text: string | null;
  phone_normalized: string | null;
  province: string | null;
  address: string | null;
  tier_label: string | null;
  tier_code: TierCode | null;
  owner_legacy_name: string | null;
  opening_debt: number;
  needs_review: boolean;
  review_notes: string[];
}

export interface ParsedOrderLine {
  row_no: number;
  order_code: string | null;
  customer_legacy_code: string | null;
  sku: string | null;
  qty: number | null;
  unit_price: number | null;
  order_date: string | null;
}

export interface ParsedOrderStatus {
  row_no: number;
  order_code: string;
  delivery_status: string | null;
  payment_status: string | null;
  accounting_confirmed: boolean | null;
  accounting_value: number | null;
  shipping_fee: number | null;
  discount_amount: number | null;
  bonus_deduction: number | null;
  cod_amount: number | null;
}

export interface ParsedPayment {
  row_no: number;
  receipt_no: string | null;
  customer_legacy_code: string | null;
  order_code: string | null;
  amount: number;
  paid_at: string | null;
  method: string | null;
  is_general_repayment: boolean;
  needs_review: boolean;
  external_row_key: string;
}

export interface ParsedDebt {
  row_no: number;
  customer_legacy_code: string;
  opening_debt: number | null;
  official_debt: number | null;
  projected_debt: number | null;
}

export interface ParsedActivity {
  row_no: number;
  customer_legacy_code: string | null;
  owner_legacy_name: string | null;
  channel: string | null;
  result: string | null;
  content: string | null;
  next_action: string | null;
  next_date: string | null;
  created_at: string | null;
}

export interface ParsedWorkbook {
  products: ParsedProduct[];
  customers: ParsedCustomer[];
  orderLines: ParsedOrderLine[];
  orderStatuses: ParsedOrderStatus[];
  payments: ParsedPayment[];
  debts: ParsedDebt[];
  activities: ParsedActivity[];
  issues: ImportIssue[];
  sheetsFound: string[];
}

/** Dấu thanh tiếng Việt sau khi tách bằng NFD (U+0300..U+036F). */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Bỏ dấu tiếng Việt + chuẩn hoá để so khớp tên sheet/cột không phụ thuộc cách gõ. */
export function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const SHEET_ALIASES: Record<string, string[]> = {
  BANG_GIA: ['bang_gia', 'bang_gia_8_cap', 'gia', 'price', 'bang_gia_san_pham'],
  KHACH_HANG: ['khach_hang', 'customer', 'danh_sach_khach_hang'],
  TAO_DON_HANG: ['tao_don_hang', 'don_hang_nguon', 'chi_tiet_don_hang', 'order_items'],
  QUAN_LY_DON_HANG: ['quan_ly_don_hang', 'quanly_don', 'order_status', 'theo_doi_don_hang'],
  THANH_TOAN: ['thanh_toan', 'payment', 'phieu_thu'],
  CONG_NO: ['cong_no', 'debt', 'du_no'],
  CHAM_SOC: ['cham_soc', 'nhat_ky_cham_soc', 'activity', 'lich_su_cham_soc'],
  LICH_HEN: ['lich_hen', 'lichhen', 'appointment', 'task'],
  CANH_BAO: ['canh_bao', 'alert', 'warning'],
};

function findSheet(workbook: XLSX.WorkBook, logical: string): string | null {
  const aliases = SHEET_ALIASES[logical] ?? [];
  for (const name of workbook.SheetNames) {
    const key = normalizeKey(name);
    if (aliases.includes(key) || key === normalizeKey(logical)) return name;
  }
  for (const name of workbook.SheetNames) {
    const key = normalizeKey(name);
    if (aliases.some((alias) => key.startsWith(alias) || alias.startsWith(key))) return name;
  }
  return null;
}

type Row = Record<string, unknown>;

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Row[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: true });
}

function pick(row: Row, aliases: string[]): unknown {
  for (const key of Object.keys(row)) {
    const norm = normalizeKey(key);
    if (aliases.includes(norm)) return row[key];
  }
  for (const key of Object.keys(row)) {
    const norm = normalizeKey(key);
    if (aliases.some((alias) => norm.includes(alias))) return row[key];
  }
  return null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

const TIER_ALIASES: Record<TierCode, string[]> = {
  GDKD: ['gdkd', 'gd_kd', 'giam_doc_kinh_doanh'],
  TPP: ['tpp'],
  NPP: ['npp', 'nha_phan_phoi'],
  TONG_DL: ['tong_dai_ly', 'tong_dl', 'tongdaily'],
  DL_C1: ['dai_ly_cap_1', 'dl_cap_1', 'daily_1', 'dl1'],
  DL_C2: ['dai_ly_cap_2', 'dl_cap_2', 'daily_2', 'dl2'],
  DAI_SU: ['dai_su', 'daisu'],
  BAN_LE: ['ban_le', 'le', 'retail'],
};

export function mapTierLabel(label: string | null): TierCode | null {
  if (!label) return null;
  const key = normalizeKey(label);
  for (const code of TIER_ORDER) {
    if (TIER_ALIASES[code].includes(key)) return code;
    if (normalizeKey(TIER_LABELS[code]) === key) return code;
  }
  return null;
}

function parseProducts(workbook: XLSX.WorkBook, issues: ImportIssue[]): ParsedProduct[] {
  const sheetName = findSheet(workbook, 'BANG_GIA');
  if (!sheetName) {
    issues.push({
      sheet: 'BANG_GIA',
      row_no: null,
      field: null,
      code: 'SHEET_MISSING',
      message: 'Không tìm thấy sheet bảng giá.',
      severity: 'ERROR',
    });
    return [];
  }

  const rows = sheetRows(workbook, sheetName);
  const products: ParsedProduct[] = [];

  rows.forEach((row, index) => {
    const rowNo = index + 2; // +1 header, +1 vì Excel đếm từ 1
    const sku = text(pick(row, ['ma_sp', 'sku', 'ma_san_pham', 'ma_hang', 'ma']));
    const name = text(pick(row, ['ten_sp', 'ten_san_pham', 'ten_hang', 'ten']));
    if (!sku) {
      if (name) {
        issues.push({
          sheet: 'BANG_GIA',
          row_no: rowNo,
          field: 'sku',
          code: 'MISSING_SKU',
          message: `Dòng ${rowNo} có tên sản phẩm nhưng thiếu mã SKU.`,
          severity: 'ERROR',
        });
      }
      return;
    }

    const prices = {} as Record<TierCode, number | null>;
    const missing: TierCode[] = [];
    for (const code of TIER_ORDER) {
      const raw = pick(row, TIER_ALIASES[code]);
      const amount = toVndInteger(raw);
      prices[code] = amount;
      if (amount === null) {
        missing.push(code);
      } else if (amount === 0) {
        issues.push({
          sheet: 'BANG_GIA',
          row_no: rowNo,
          field: code,
          code: 'ZERO_PRICE',
          message: `Mã ${sku} có giá 0 ở cấp ${TIER_LABELS[code]} - cần xác nhận là giá thật.`,
          severity: 'WARNING',
        });
      }
    }

    if (missing.length > 0) {
      issues.push({
        sheet: 'BANG_GIA',
        row_no: rowNo,
        field: 'price',
        code: 'MISSING_PRICE',
        message: `Mã ${sku} thiếu giá ở cấp: ${missing.map((m) => TIER_LABELS[m]).join(', ')}. Giữ NULL, chặn bán ở cấp này.`,
        severity: 'WARNING',
      });
    }

    products.push({
      row_no: rowNo,
      sku,
      name: name ?? sku,
      unit: text(pick(row, ['dvt', 'don_vi', 'don_vi_tinh', 'unit'])),
      pack_size: text(pick(row, ['quy_cach', 'dong_goi', 'pack_size'])),
      group_name: text(pick(row, ['nhom', 'nhom_sp', 'nhom_san_pham', 'group'])),
      prices,
      missing_tiers: missing,
    });
  });

  return products;
}

function parseCustomers(workbook: XLSX.WorkBook, issues: ImportIssue[]): ParsedCustomer[] {
  const sheetName = findSheet(workbook, 'KHACH_HANG');
  if (!sheetName) {
    issues.push({
      sheet: 'KHACH_HANG',
      row_no: null,
      field: null,
      code: 'SHEET_MISSING',
      message: 'Không tìm thấy sheet khách hàng.',
      severity: 'ERROR',
    });
    return [];
  }

  const rows = sheetRows(workbook, sheetName);
  const seen = new Map<string, number>();
  const customers: ParsedCustomer[] = [];

  rows.forEach((row, index) => {
    const rowNo = index + 2;
    const name = text(pick(row, ['ten_khach_hang', 'ten_khach', 'khach_hang', 'ten']));
    if (!name) return;

    const legacyRaw =
      text(pick(row, ['ma_kh', 'ma_khach_hang', 'ma_khach', 'code'])) ?? name.toLowerCase();
    let legacyCode = legacyRaw;
    const dupCount = seen.get(legacyCode);
    if (dupCount) {
      seen.set(legacyCode, dupCount + 1);
      legacyCode = `${legacyCode}-${dupCount + 1}`;
      issues.push({
        sheet: 'KHACH_HANG',
        row_no: rowNo,
        field: 'legacy_code',
        code: 'DUPLICATE_LEGACY_CODE',
        message: `Mã khách "${legacyRaw}" bị trùng; hệ thống thêm hậu tố để giữ đủ dòng.`,
        severity: 'WARNING',
      });
    } else {
      seen.set(legacyCode, 1);
    }

    const phone = normalizePhone(pick(row, ['sdt', 'so_dien_thoai', 'dien_thoai', 'phone', 'mobile']));
    const reviewNotes: string[] = [];
    if (phone.needsReview) reviewNotes.push(phone.note ?? 'Số điện thoại cần kiểm tra');
    if (phone.restoredLeadingZero) {
      issues.push({
        sheet: 'KHACH_HANG',
        row_no: rowNo,
        field: 'phone',
        code: 'PHONE_LEADING_ZERO_RESTORED',
        message: `Khách "${name}": số điện thoại lưu dạng số, đã khôi phục số 0 đầu và chuyển sang TEXT.`,
        severity: 'INFO',
      });
    }
    if (phone.needsReview) {
      issues.push({
        sheet: 'KHACH_HANG',
        row_no: rowNo,
        field: 'phone',
        code: 'PHONE_NEEDS_REVIEW',
        message: `Khách "${name}": ${phone.note ?? 'số điện thoại bất thường'}.`,
        severity: 'WARNING',
      });
    }

    const province = text(pick(row, ['tinh', 'tinh_thanh', 'tinh_tp', 'khu_vuc', 'province']));
    if (!province) {
      reviewNotes.push('Thiếu tỉnh/thành');
      issues.push({
        sheet: 'KHACH_HANG',
        row_no: rowNo,
        field: 'province',
        code: 'MISSING_PROVINCE',
        message: `Khách "${name}" thiếu tỉnh/thành.`,
        severity: 'WARNING',
      });
    }

    const address = text(pick(row, ['dia_chi', 'address']));
    if (!address) reviewNotes.push('Thiếu địa chỉ');

    const tierLabel = text(pick(row, ['cap', 'cap_gia', 'cap_dai_ly', 'tier', 'phan_loai']));
    const tierCode = mapTierLabel(tierLabel);
    if (tierLabel && !tierCode) {
      reviewNotes.push(`Cấp "${tierLabel}" không có trong bảng giá 8 cấp`);
      issues.push({
        sheet: 'KHACH_HANG',
        row_no: rowNo,
        field: 'tier',
        code: 'TIER_UNKNOWN',
        message: `Khách "${name}" có cấp "${tierLabel}" không tồn tại trong 8 cấp giá - phải map thủ công trước khi tạo đơn.`,
        severity: 'WARNING',
      });
    }

    // Các trường CRM (nguồn, giai đoạn, tiềm năng, chu kỳ) trong file cũ đang trống hoàn toàn.
    const source = text(pick(row, ['nguon', 'nguon_khach', 'source']));
    if (!source) reviewNotes.push('Chưa có nguồn khách');

    customers.push({
      row_no: rowNo,
      legacy_code: legacyCode,
      name,
      phone_text: phone.text,
      phone_normalized: phone.normalized,
      province,
      address,
      tier_label: tierLabel,
      tier_code: tierCode,
      owner_legacy_name: text(pick(row, ['sale', 'nhan_vien', 'phu_trach', 'owner', 'nv_phu_trach'])),
      opening_debt: toVndInteger(pick(row, ['du_no_cu', 'no_cu', 'du_no_dau_ky', 'cong_no_cu'])) ?? 0,
      needs_review: reviewNotes.length > 0,
      review_notes: reviewNotes,
    });
  });

  return customers;
}

function parseOrderLines(workbook: XLSX.WorkBook, issues: ImportIssue[]): ParsedOrderLine[] {
  const sheetName = findSheet(workbook, 'TAO_DON_HANG');
  if (!sheetName) {
    issues.push({
      sheet: 'TAO_DON_HANG',
      row_no: null,
      field: null,
      code: 'SHEET_MISSING',
      message: 'Không tìm thấy sheet đơn hàng nguồn.',
      severity: 'ERROR',
    });
    return [];
  }

  const rows = sheetRows(workbook, sheetName);
  const lines: ParsedOrderLine[] = [];

  rows.forEach((row, index) => {
    const rowNo = index + 2;
    const sku = text(pick(row, ['ma_sp', 'sku', 'ma_hang', 'ma_san_pham']));
    const qty = toVndInteger(pick(row, ['so_luong', 'sl', 'qty', 'quantity']));
    const orderCode = text(pick(row, ['ma_don', 'ma_don_hang', 'so_don', 'order_code', 'don_hang']));
    const customerCode = text(pick(row, ['ma_kh', 'khach_hang', 'ten_khach_hang', 'ma_khach']));

    if (!sku && !qty && !orderCode && !customerCode) return; // dòng trống thật sự

    if (!orderCode) {
      // KHÔNG bỏ dòng: đưa vào hàng chờ xử lý (mục 12).
      issues.push({
        sheet: 'TAO_DON_HANG',
        row_no: rowNo,
        field: 'order_code',
        code: 'ORDER_CODE_MISSING',
        message: `Dòng ${rowNo} chưa khai báo mã đơn - đưa vào hàng chờ xử lý, không được bỏ.`,
        severity: 'WARNING',
      });
    }

    lines.push({
      row_no: rowNo,
      order_code: orderCode,
      customer_legacy_code: customerCode ? customerCode.toLowerCase() : null,
      sku,
      qty,
      unit_price: toVndInteger(pick(row, ['don_gia', 'gia', 'unit_price', 'gia_ban'])),
      order_date: normalizeExcelDate(pick(row, ['ngay', 'ngay_dat', 'ngay_don', 'order_date'])),
    });
  });

  return lines;
}

function parseOrderStatuses(workbook: XLSX.WorkBook, issues: ImportIssue[]): ParsedOrderStatus[] {
  const sheetName = findSheet(workbook, 'QUAN_LY_DON_HANG');
  if (!sheetName) {
    issues.push({
      sheet: 'QUAN_LY_DON_HANG',
      row_no: null,
      field: null,
      code: 'SHEET_MISSING',
      message: 'Không tìm thấy sheet quản lý đơn hàng.',
      severity: 'ERROR',
    });
    return [];
  }

  const rows = sheetRows(workbook, sheetName);
  const statuses: ParsedOrderStatus[] = [];

  rows.forEach((row, index) => {
    const rowNo = index + 2;
    const orderCode = text(pick(row, ['ma_don', 'ma_don_hang', 'so_don', 'order_code']));
    if (!orderCode) return;

    const deliveryRaw = normalizeKey(pick(row, ['trang_thai_giao', 'giao_hang', 'trang_thai', 'delivery']));
    let delivery: string | null = null;
    if (deliveryRaw.includes('da_giao')) delivery = 'DA_GIAO';
    else if (deliveryRaw.includes('xuat_kho') || deliveryRaw.includes('da_xuat')) delivery = 'DA_XUAT_KHO';
    else if (deliveryRaw.includes('hoan')) delivery = 'HOAN';
    else if (deliveryRaw) delivery = 'CHUA_XUAT';

    const accountingValue = toVndInteger(pick(row, ['gia_tri_ke_toan', 'ke_toan_xac_nhan', 'gia_tri_xac_nhan']));
    if (accountingValue === null) {
      issues.push({
        sheet: 'QUAN_LY_DON_HANG',
        row_no: rowNo,
        field: 'accounting',
        code: 'ACCOUNTING_UNCONFIRMED',
        message: `Đơn ${orderCode} chưa có giá trị xác nhận kế toán - coi là CHƯA xác nhận.`,
        severity: 'WARNING',
      });
    }

    statuses.push({
      row_no: rowNo,
      order_code: orderCode,
      delivery_status: delivery,
      payment_status: text(pick(row, ['trang_thai_thanh_toan', 'thanh_toan', 'payment_status'])),
      accounting_confirmed: accountingValue !== null && accountingValue > 0,
      accounting_value: accountingValue,
      shipping_fee: toVndInteger(pick(row, ['phi_van_chuyen', 'phi_ship', 'ship'])),
      discount_amount: toVndInteger(pick(row, ['chiet_khau', 'giam_gia', 'discount'])),
      bonus_deduction: toVndInteger(pick(row, ['tru_thuong', 'thuong_thang', 'tru_thuong_thang'])),
      cod_amount: toVndInteger(pick(row, ['cod', 'dat_coc', 'tien_coc'])),
    });
  });

  return statuses;
}

function parsePayments(workbook: XLSX.WorkBook, issues: ImportIssue[]): ParsedPayment[] {
  const sheetName = findSheet(workbook, 'THANH_TOAN');
  if (!sheetName) {
    issues.push({
      sheet: 'THANH_TOAN',
      row_no: null,
      field: null,
      code: 'SHEET_MISSING',
      message: 'Không tìm thấy sheet thanh toán.',
      severity: 'ERROR',
    });
    return [];
  }

  const rows = sheetRows(workbook, sheetName);
  const payments: ParsedPayment[] = [];

  rows.forEach((row, index) => {
    const rowNo = index + 2;
    const amount = toVndInteger(pick(row, ['so_tien', 'so_tien_thu', 'amount', 'tien']));
    if (amount === null || amount === 0) return;

    const receipt = text(pick(row, ['ma_phieu_thu', 'so_phieu_thu', 'phieu_thu', 'receipt']));
    const customerCode = text(pick(row, ['ma_kh', 'khach_hang', 'ten_khach_hang', 'ma_khach']));
    const orderCode = text(pick(row, ['ma_don', 'ma_don_hang', 'order_code']));
    const noteText = text(pick(row, ['ghi_chu', 'noi_dung', 'dien_giai', 'note'])) ?? '';
    const isGeneral =
      !orderCode || normalizeKey(noteText).includes('tra_no_chung') || normalizeKey(noteText).includes('tra_no');

    if (!receipt) {
      issues.push({
        sheet: 'THANH_TOAN',
        row_no: rowNo,
        field: 'receipt_no',
        code: 'RECEIPT_NO_MISSING',
        message: `Dòng ${rowNo} thiếu mã phiếu thu - vẫn import nhưng đánh dấu NEEDS_REVIEW.`,
        severity: 'WARNING',
      });
    }
    if (isGeneral) {
      issues.push({
        sheet: 'THANH_TOAN',
        row_no: rowNo,
        field: 'order_code',
        code: 'GENERAL_REPAYMENT',
        message: `Dòng ${rowNo} là khoản trả nợ chung - vào hàng chờ phân bổ, chưa trừ vào từng đơn.`,
        severity: 'WARNING',
      });
    }

    payments.push({
      row_no: rowNo,
      receipt_no: receipt,
      customer_legacy_code: customerCode ? customerCode.toLowerCase() : null,
      order_code: orderCode,
      amount,
      paid_at: normalizeExcelDate(pick(row, ['ngay', 'ngay_thu', 'ngay_thanh_toan', 'paid_at'])),
      method: text(pick(row, ['hinh_thuc', 'phuong_thuc', 'method'])),
      is_general_repayment: isGeneral,
      needs_review: !receipt || isGeneral,
      // Khoá chống nhập trùng khi phiếu thu không có mã (mục 9.2)
      external_row_key: `${sheetName}:${rowNo}:${receipt ?? 'NO_RECEIPT'}:${amount}`,
    });
  });

  return payments;
}

function parseDebts(workbook: XLSX.WorkBook, issues: ImportIssue[]): ParsedDebt[] {
  const sheetName = findSheet(workbook, 'CONG_NO');
  if (!sheetName) {
    issues.push({
      sheet: 'CONG_NO',
      row_no: null,
      field: null,
      code: 'SHEET_MISSING',
      message: 'Không tìm thấy sheet công nợ - không thể đối soát ba tổng.',
      severity: 'ERROR',
    });
    return [];
  }

  const rows = sheetRows(workbook, sheetName);
  const debts: ParsedDebt[] = [];

  rows.forEach((row, index) => {
    const rowNo = index + 2;
    const customerCode = text(pick(row, ['ma_kh', 'khach_hang', 'ten_khach_hang', 'ma_khach']));
    if (!customerCode) return;
    debts.push({
      row_no: rowNo,
      customer_legacy_code: customerCode.toLowerCase(),
      opening_debt: toVndInteger(pick(row, ['du_no_cu', 'no_cu', 'du_no_dau_ky'])),
      official_debt: toVndInteger(pick(row, ['cong_no_chinh_thuc', 'no_chinh_thuc', 'chinh_thuc'])),
      projected_debt: toVndInteger(pick(row, ['cong_no_du_kien', 'no_du_kien', 'du_kien'])),
    });
  });

  return debts;
}

function parseActivities(workbook: XLSX.WorkBook): ParsedActivity[] {
  const sheetName = findSheet(workbook, 'CHAM_SOC');
  if (!sheetName) return [];
  const rows = sheetRows(workbook, sheetName);
  const activities: ParsedActivity[] = [];

  rows.forEach((row, index) => {
    const rowNo = index + 2;
    const content = text(pick(row, ['noi_dung', 'noi_dung_trao_doi', 'ghi_chu', 'content']));
    const customerCode = text(pick(row, ['ma_kh', 'khach_hang', 'ten_khach_hang']));
    // Dòng rỗng KHÔNG được coi là activity (mục 12).
    if (!content && !customerCode) return;

    activities.push({
      row_no: rowNo,
      customer_legacy_code: customerCode ? customerCode.toLowerCase() : null,
      owner_legacy_name: text(pick(row, ['sale', 'nhan_vien', 'nguoi_thuc_hien', 'owner'])),
      channel: text(pick(row, ['kenh', 'hinh_thuc', 'channel'])),
      result: text(pick(row, ['ket_qua', 'result'])),
      content,
      next_action: text(pick(row, ['buoc_tiep_theo', 'hanh_dong_tiep', 'next_action'])),
      next_date: normalizeExcelDate(pick(row, ['lich_tiep', 'ngay_cham_soc_tiep', 'next_date'])),
      created_at: normalizeExcelDate(pick(row, ['ngay', 'thoi_gian', 'created_at'])),
    });
  });

  return activities;
}

export function parseWorkbook(bytes: ArrayBuffer | Uint8Array): ParsedWorkbook {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });
  const issues: ImportIssue[] = [];

  const canhBao = findSheet(workbook, 'CANH_BAO');
  if (canhBao) {
    issues.push({
      sheet: 'CANH_BAO',
      row_no: null,
      field: null,
      code: 'SHEET_SKIPPED',
      message: 'Sheet CANH_BAO chứa công thức lỗi #REF! - KHÔNG import; cảnh báo được tính lại bằng query backend.',
      severity: 'INFO',
    });
  }

  return {
    products: parseProducts(workbook, issues),
    customers: parseCustomers(workbook, issues),
    orderLines: parseOrderLines(workbook, issues),
    orderStatuses: parseOrderStatuses(workbook, issues),
    payments: parsePayments(workbook, issues),
    debts: parseDebts(workbook, issues),
    activities: parseActivities(workbook),
    issues,
    sheetsFound: workbook.SheetNames,
  };
}

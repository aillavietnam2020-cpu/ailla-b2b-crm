/**
 * Sinh workbook mô phỏng đúng hiện trạng dữ liệu AILLA (mục 2 + 12.2) để test import/đối soát.
 * Dữ liệu hoàn toàn giả lập - KHÔNG chứa thông tin khách hàng thật.
 * Các mốc bắt buộc khớp: 134 SKU, 62 khách, 35 đơn nguồn/206 dòng, 34 đơn quản lý,
 * 26 payment = 180.073.600đ, ba tổng công nợ.
 */
import * as XLSX from 'xlsx';
import { TIER_LABELS, TIER_ORDER } from '@shared/enums';

const MISSING_PRICE_SKUS = [
  'TOILET500-C',
  'AIBIO10H',
  'AIBIO2X-c',
  'AIBIO10X',
  'AIBIO2H-C',
  'ARILA10',
  'vochai100',
  'M300-c',
  'M300',
  'R300-c',
  'R300',
];

export interface FixtureOptions {
  /** Cố tình làm lệch tổng để test nhánh đối soát thất bại. */
  breakReconciliation?: boolean;
}

export function buildWorkbookBytes(options: FixtureOptions = {}): Uint8Array {
  const workbook = XLSX.utils.book_new();

  /* ---------------------------------------------------------- BẢNG GIÁ (134 SKU) */
  const products: Record<string, unknown>[] = [];
  const skus: string[] = [];
  for (let i = 0; i < 134; i += 1) {
    const isMissingRow = i < MISSING_PRICE_SKUS.length;
    const sku = isMissingRow ? MISSING_PRICE_SKUS[i] : `SP${String(i + 1).padStart(3, '0')}`;
    skus.push(sku);
    const row: Record<string, unknown> = {
      'Mã SP': sku,
      'Tên SP': `Sản phẩm test ${i + 1}`,
      'ĐVT': i % 2 === 0 ? 'Can' : 'Chai',
      'Quy cách': i % 2 === 0 ? '5L' : '500ml',
      'Nhóm': `Nhóm ${(i % 10) + 1}`,
    };
    TIER_ORDER.forEach((code, tierIndex) => {
      // 11 mã đầu tiên thiếu giá ở cấp Bán lẻ (giữ NULL, không tự áp giá).
      if (isMissingRow && code === 'BAN_LE') {
        row[TIER_LABELS[code]] = null;
      } else {
        row[TIER_LABELS[code]] = 80000 + tierIndex * 5000 + i * 100;
      }
    });
    products.push(row);
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(products), 'BANG_GIA');

  /* ---------------------------------------------------------- KHÁCH HÀNG (62) */
  const customers: Record<string, unknown>[] = [];
  const customerCodes: string[] = [];
  for (let i = 0; i < 62; i += 1) {
    const code = `kh-${String(i + 1).padStart(3, '0')}`;
    customerCodes.push(code);

    // 58 số lưu dạng SỐ (mất số 0 đầu), 2 khách thiếu số, 2 số bất thường.
    let phone: unknown;
    if (i < 58) phone = 900000000 + i;
    else if (i < 60) phone = null;
    else phone = '12345';

    customers.push({
      'Mã KH': code,
      'Tên khách hàng': `Khách hàng test ${i + 1}`,
      'SĐT': phone,
      'Tỉnh/TP': i < 5 ? null : `Tỉnh ${(i % 22) + 1}`, // 5 khách thiếu tỉnh/thành
      'Địa chỉ': i === 10 ? null : `Số ${i + 1} phố Test`, // 1 khách thiếu địa chỉ
      'Cấp': i < 2 ? 'Khác' : TIER_LABELS[TIER_ORDER[i % 8]], // 2 khách cấp "Khác"
      Sale: i < 48 ? 'Thảo' : 'Huyền', // Thảo 48, Huyền 14
    });
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customers), 'KHACH_HANG');

  /* ---------------------------------- ĐƠN NGUỒN: 35 đơn / 206 dòng / 25 khách / 69 SKU */
  const orderCodes = Array.from({ length: 35 }, (_, i) => `DH${String(i + 1).padStart(3, '0')}`);
  const orderLines: Record<string, unknown>[] = [];
  let lineIndex = 0;
  for (let i = 0; i < 205; i += 1) {
    const orderIndex = i % 35;
    orderLines.push({
      'Mã đơn': orderCodes[orderIndex],
      'Mã KH': customerCodes[orderIndex % 25],
      'Mã SP': skus[lineIndex % 69],
      'Số lượng': (i % 9) + 1,
      'Đơn giá': 100000 + (i % 12) * 1000,
      Ngày: '2026-07-15',
    });
    lineIndex += 1;
  }
  // Dòng thứ 206 chưa khai báo mã đơn - bắt buộc vào hàng chờ, không được bỏ.
  orderLines.push({
    'Mã đơn': null,
    'Mã KH': customerCodes[0],
    'Mã SP': skus[0],
    'Số lượng': 2,
    'Đơn giá': 120000,
    Ngày: '2026-07-20',
  });
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(orderLines), 'TAO_DON_HANG');

  /* ---------------------------------------------------------- QUẢN LÝ ĐƠN (34) */
  const managed = orderCodes.slice(0, 34).map((code, i) => ({
    'Mã đơn': code,
    'Trạng thái giao': i < 30 ? 'Đã giao' : 'Đã xuất kho', // 30 đã giao, 4 đã xuất kho
    'Giá trị kế toán': i < 6 ? 5000000 + i * 100000 : null, // chỉ 6 đơn đã xác nhận kế toán
    'Phí vận chuyển': 0,
    'Chiết khấu': 0,
    'Trừ thưởng': 0,
    COD: 0,
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(managed), 'QUAN_LY_DON_HANG');

  /* ------------------------------------------ THANH TOÁN: 26 dòng = 180.073.600đ */
  const payments: Record<string, unknown>[] = [];
  let paymentTotal = 0;
  for (let i = 0; i < 26; i += 1) {
    const amount = i < 25 ? 6_000_000 : 180_073_600 - paymentTotal;
    paymentTotal += i < 25 ? amount : 0;
    payments.push({
      'Mã phiếu thu': i < 7 ? `PT${String(i + 1).padStart(3, '0')}` : null, // 19 dòng thiếu mã phiếu thu
      'Mã KH': customerCodes[i % 25],
      'Mã đơn': i < 10 ? orderCodes[i] : null, // 16 khoản còn lại là trả nợ chung
      'Số tiền': amount,
      'Ngày thu': '2026-08-01',
      'Hình thức': 'Chuyển khoản',
      'Ghi chú': i < 10 ? 'Thu theo đơn' : 'Trả nợ chung',
    });
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(payments), 'THANH_TOAN');

  /* ------------------------------------------------------------- CÔNG NỢ (3 tổng) */
  const openingTotal = options.breakReconciliation ? 1_000_000_000 : 1_256_920_982;
  const debts = customerCodes.map((code, i) => {
    const last = i === customerCodes.length - 1;
    return {
      'Mã KH': code,
      'Dư nợ cũ': last ? openingTotal - 61 * 20_000_000 : 20_000_000,
      'Công nợ chính thức': last ? 1_168_465_995 - 61 * 19_000_000 : 19_000_000,
      'Công nợ dự kiến': last ? 1_397_046_765 - 61 * 22_000_000 : 22_000_000,
    };
  });
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(debts), 'CONG_NO');

  /* ------------------------------------------- CHĂM SÓC: 1 dòng thật + 2 dòng rỗng */
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        'Mã KH': customerCodes[0],
        Sale: 'Thảo',
        'Kênh': 'Gọi điện',
        'Kết quả': 'Đã trao đổi',
        'Nội dung': 'Khách hẹn kiểm tra tồn rồi báo lại.',
        'Bước tiếp theo': 'Gọi lại chốt đơn',
        'Lịch tiếp': '2026-08-20',
        Ngày: '2026-08-10',
      },
      { 'Mã KH': null, Sale: null, 'Kênh': null, 'Kết quả': null, 'Nội dung': null },
      { 'Mã KH': null, Sale: null, 'Kênh': null, 'Kết quả': null, 'Nội dung': null },
    ]),
    'CHAM_SOC',
  );

  /* --------------------------------------------- CẢNH BÁO: công thức lỗi, không import */
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([{ 'Cảnh báo': '#REF!', 'Ghi chú': '#REF!' }]),
    'CANH_BAO',
  );

  return new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

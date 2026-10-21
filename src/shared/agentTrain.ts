/** Luật kiểm tra dùng chung cho trang Huấn luyện agent (web) và công cụ trên VPS. Không phụ thuộc môi trường. */

export const TRAIN_KINDS = ['SCRIPT', 'PRICE', 'FAQ', 'MEDIA', 'RULE'] as const;
export type TrainKind = (typeof TRAIN_KINDS)[number];
export const TRAIN_SETS = ['SALE', 'CSKH', 'BOTH'] as const;

/** Che thông tin cá nhân trước khi lưu hội thoại cũ: số điện thoại, email, đường link, dãy số dài (tài khoản, mã vận đơn). */
export function maskPersonal(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/(?:\+?84|0)(?:[\s.-]?\d){8,10}/g, '[sđt]')
    .replace(/\d(?:[\s.-]?\d){8,}/g, '[số]');
}

/** Lấy các mức giá trong câu: 149K, 149.000đ, 1,2tr... trả về số đồng (VND). */
export function extractPrices(text: string): number[] {
  const out = new Set<number>();
  const re = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|tr|triệu|đ|vnđ|vnd|₫)(?![\p{L}\d])/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const unit = m[2].toLowerCase();
    let n = Number(m[1].replace(/[.,](?=\d{3}(?!\d))/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) continue;
    if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') n *= 1000;
    else if (unit === 'tr' || unit === 'triệu') n *= 1_000_000;
    out.add(Math.round(n));
  }
  return [...out];
}

export type TrainFlag = { code: 'GIA_LA' | 'CAU_CAM' | 'TRONG'; msg: string };

/**
 * Chấm tự động câu agent trả lời: mọi mức giá phải nằm trong bảng giá ĐÃ DUYỆT; không chứa câu cấm đã duyệt.
 * Chỉ bắt lỗi chắc chắn, không thay chị chấm hay dở.
 */
export function checkReply(reply: string, approvedPriceText: string[], bannedPhrases: string[]): TrainFlag[] {
  const flags: TrainFlag[] = [];
  if (!reply.trim()) return [{ code: 'TRONG', msg: 'Agent không trả lời nội dung.' }];
  const allowed = new Set(approvedPriceText.flatMap(extractPrices));
  for (const p of extractPrices(reply)) {
    if (!allowed.has(p)) flags.push({ code: 'GIA_LA', msg: `Giá ${p.toLocaleString('vi-VN')}đ không có trong bảng giá đã duyệt.` });
  }
  const low = reply.toLowerCase();
  for (const b of bannedPhrases) {
    const t = b.trim().toLowerCase();
    if (t && low.includes(t)) flags.push({ code: 'CAU_CAM', msg: `Có câu cấm: "${b.trim()}"` });
  }
  return flags;
}

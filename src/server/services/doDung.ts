/**
 * Đồ dùng văn phòng & nhà máy (chị Hoa duyệt 11/11/2026): luật thuần, máy chủ (routes/doDung.ts) dùng, test ở tests/unit/doDung.test.ts.
 * - Hai nơi: vp (Văn phòng), nm (Nhà máy). Một danh mục chung, tồn tính riêng từng nơi.
 * - Thiết bị quay (tb), công cụ dụng cụ (cc): mượn rồi trả. Hàng mẫu (mau), đồ tiêu hao (th): lấy dùng, phần thừa trả về kệ.
 * - Hàng mẫu: Lead phòng của người xin duyệt → kho thành phẩm lập phiếu xuất kho (XK, ref_no = mã yêu cầu) → HCNS nhận về.
 * - Đề nghị mua: Lead phòng duyệt → Quản lý mua hàng duyệt → mua về nhập tồn, phiếu chi nháp vào Sổ chi phí (ngưỡng CEO ở phiếu chi).
 */
export const DD_NOI = { vp: 'Văn phòng', nm: 'Nhà máy' } as const;
export type Noi = keyof typeof DD_NOI;
export const DD_LOAI = { tb: 'Thiết bị quay', cc: 'Công cụ dụng cụ', mau: 'Hàng mẫu', th: 'Đồ tiêu hao' } as const;
export type Loai = keyof typeof DD_LOAI;
export const isNoi = (v: unknown): v is Noi => v === 'vp' || v === 'nm';
export const isLoai = (v: unknown): v is Loai => typeof v === 'string' && v in DD_LOAI;
/** Mượn rồi phải trả (không dùng hết được). */
export const muonTra = (l: string) => l === 'tb' || l === 'cc';
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Tiền tố mã đồ tự tạo theo loại. Hàng mẫu dùng mã kho thành phẩm. */
export const MA_TIEN_TO: Record<Loai, string> = { tb: 'TB-', cc: 'CC-', mau: 'MAU-', th: 'VP-' };
export function maMoi(loai: Loai, daCo: string[]): string {
  const p = MA_TIEN_TO[loai];
  const n = daCo.filter((m) => m.startsWith(p)).map((m) => Number(m.slice(p.length))).filter((x) => Number.isFinite(x));
  return p + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
}

/** Mã phiếu: tiền tố + yymm + "-" + số thứ tự 3 chữ số trong tháng. */
export function soPhieu(prefix: string, ngay: string, daCo: string[]): string {
  const head = `${prefix}${ngay.slice(2, 4)}${ngay.slice(5, 7)}-`;
  const n = daCo.filter((x) => x.startsWith(head)).map((x) => Number(x.slice(head.length))).filter((x) => Number.isFinite(x));
  return head + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
}

/** Người duyệt vòng Lead: Lead / trưởng phòng cùng phòng với người gửi (không tính chính người gửi). Không có thì bỏ vòng này. */
export type Mem = { name: string; pb: string; role: string; hr: boolean };
export function leadsOf(users: Record<string, Mem>, pb: string, nguoiGui: string): string[] {
  if (!pb) return [];
  return Object.entries(users)
    .filter(([id, u]) => id !== nguoiGui && u.pb === pb && (u.role === 'lead' || u.role === 'truongphong'))
    .map(([id]) => id);
}

/** Trạng thái đầu của yêu cầu hàng mẫu. Người gửi là Lead phòng / CEO, hoặc phòng không có Lead: chuyển thẳng kho. */
export function mauDau(o: { laCeo: boolean; laLead: boolean; coLead: boolean }): 'lead' | 'kho' {
  return o.laCeo || o.laLead || !o.coLead ? 'kho' : 'lead';
}

/** Trạng thái đầu / sau khi Lead duyệt của đề nghị mua. Quản lý mua hàng / CEO gửi thì khỏi vòng Quản lý mua hàng. */
export function muaDau(o: { laCeo: boolean; laLead: boolean; coLead: boolean; laQl: boolean }): 'lead' | 'ql' | 'mua' {
  if (o.laCeo) return 'mua';
  if (!o.laLead && o.coLead) return 'lead';
  return o.laQl ? 'mua' : 'ql';
}
export const muaSauLead = (laQl: boolean): 'ql' | 'mua' => (laQl ? 'mua' : 'ql');

/**
 * Trả đồ: từng dòng ghi số trả lại về kệ.
 * - Thiết bị / công cụ: trả ít hơn số mượn thì phần còn lại là hỏng hoặc mất, phải ghi tình trạng.
 * - Hàng mẫu / đồ tiêu hao: phần không trả là đã dùng hết.
 * Trả về số trả lại, số dùng hết, lỗi (nếu có).
 */
export function traDong(loai: string, sl: number, tra: number, tinh: string): { tra: number; dung: number; tinh: string; err?: string } {
  if (!Number.isFinite(tra) || tra < 0) return { tra: 0, dung: 0, tinh, err: 'Số trả lại không đúng' };
  if (tra > sl + 1e-9) return { tra, dung: 0, tinh, err: `Trả ${tra} nhiều hơn số đã lấy ${sl}` };
  if (muonTra(loai)) {
    const thieu = r6(sl - tra);
    if (thieu > 0 && !['Hỏng', 'Mất'].includes(tinh)) return { tra, dung: 0, tinh, err: 'Thiết bị trả thiếu: ghi rõ Hỏng hoặc Mất' };
    return { tra: r6(tra), dung: 0, tinh: thieu > 0 ? tinh : 'Tốt' };
  }
  return { tra: r6(tra), dung: r6(sl - tra), tinh: '' };
}

/** Kiểm kê: dòng sổ chênh = số đếm − tồn sổ. */
export const kkChenh = (dem: number, so: number) => r6(dem - so);

/** Quá hạn trả: hạn dạng "YYYY-MM-DDTHH:MM" (giờ Việt Nam) đã qua. */
export function quaHan(han: string | null | undefined, nowVn: string): boolean {
  return !!han && han.slice(0, 16) < nowVn.slice(0, 16);
}

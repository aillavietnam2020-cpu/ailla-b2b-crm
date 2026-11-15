/**
 * Logic dòng hàng của màn tạo đơn (thêm mã, tích/bỏ tích hàng tặng, xoá dòng, dòng nào còn thiếu giá).
 * Tách khỏi NewOrderPage để kiểm thử được. Mỗi dòng có `uid` riêng: cùng một mã có thể có dòng bán và dòng tặng,
 * bỏ tích tặng thì thành hai dòng bán cùng mã — không được dùng mã sản phẩm làm khoá dòng (trùng khoá làm React
 * vẽ lẫn dòng: đẻ thêm dòng, xoá một dòng mất cả hai).
 */

export interface Line {
  /** Khoá riêng của dòng trên màn hình (không gửi lên máy chủ). */
  uid: string;
  product_id: string;
  sku: string;
  name: string;
  /** Đơn vị lẻ của sản phẩm, ví dụ "Chai", "Can". */
  unit: string;
  /** Số lượng lẻ trong một thùng; 1 nghĩa là không bán theo thùng. */
  pack_size: number;
  /** Khách lấy lẻ hay lấy nguyên thùng. */
  pack_mode: 'LE' | 'THUNG';
  /** Số lượng theo đơn vị đang chọn (lẻ hoặc thùng). */
  qty: number;
  /** Giá một đơn vị lẻ theo cấp / bảng giá riêng của khách; null = chưa có giá, người lập nhập tay. */
  base_price: number | null;
  /** Giá sửa tay cho một đơn vị đang bán; để trống là dùng giá chuẩn. */
  applied_price: number | null;
  is_gift: boolean;
  /**
   * Mã có ĐVT là Thùng (ví dụ AILLA2HD): bảng giá đã là giá MỘT THÙNG, số lượng đếm bằng thùng.
   * Không có công tắc lẻ/thùng và không nhân giá với quy cách. Muốn bán lẻ từng can/chai thì chọn mã -C.
   */
  carton_sku: boolean;
  /** Vật tư bán kèm (vỏ, nắp, chai...): không có bảng giá, người lập đơn tự điền giá. */
  supply?: boolean;
}

let seq = 0;
/** Khoá dòng mới, không trùng trong phiên làm việc. */
export function newLineUid(): string {
  seq += 1;
  return `L${Date.now().toString(36)}-${seq}`;
}

/**
 * Thêm một mã vào đơn. Mã chưa có → dòng bán (kể cả khi chưa có giá: ô đơn giá để trống cho người lập nhập).
 * Mã đã có đúng một dòng bán → thêm dòng TẶNG kèm. Đã có dòng tặng hoặc đủ hai dòng → không thêm.
 */
export function addProductLine(
  lines: Line[],
  line: Omit<Line, 'uid' | 'is_gift'>,
): { lines: Line[]; result: 'added' | 'gift' | 'duplicate' } {
  const same = lines.filter((l) => l.product_id === line.product_id);
  const asGift = same.length === 1 && !same[0].is_gift;
  if (same.length > 0 && !asGift) return { lines, result: 'duplicate' };
  return {
    lines: [...lines, { ...line, uid: newLineUid(), is_gift: asGift }],
    result: asGift ? 'gift' : 'added',
  };
}

/** Sửa đúng một dòng theo khoá dòng. */
export function patchLine(lines: Line[], uid: string, patch: Partial<Omit<Line, 'uid'>>): Line[] {
  return lines.map((l) => (l.uid === uid ? { ...l, ...patch } : l));
}

/** Tích / bỏ tích hàng tặng: chỉ đổi đúng dòng đó, không sinh dòng mới. Tích tặng thì bỏ giá sửa tay. */
export function setLineGift(lines: Line[], uid: string, gift: boolean): Line[] {
  return patchLine(lines, uid, gift ? { is_gift: true, applied_price: null } : { is_gift: false });
}

/** Xoá đúng một dòng. */
export function removeLine(lines: Line[], uid: string): Line[] {
  return lines.filter((l) => l.uid !== uid);
}

/**
 * Dòng bán còn thiếu giá (chưa lưu / gửi được).
 * - Mã chưa có giá chuẩn (khách gia công chưa có trong bảng giá riêng, hoặc cấp của khách chưa có giá),
 *   cấp "Khác", vật tư bán kèm: phải nhập giá tay > 0.
 * - Hàng tặng không cần giá.
 */
export function lineNeedsPrice(line: Line, opts: { freeTier: boolean }): boolean {
  if (line.is_gift) return false;
  if (opts.freeTier || line.supply || line.base_price === null) return !((line.applied_price ?? 0) > 0);
  return false;
}

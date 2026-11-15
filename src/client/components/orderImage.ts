import type { OrderDetail } from '@shared/types';

/**
 * Vẽ ảnh đơn hàng gọn để sale gửi khách qua Zalo (thay cho chụp màn hình).
 * Chỉ có thông tin khách cần: tên khách, dòng hàng, số lượng, tiền. Không có công nợ, ghi chú nội bộ hay trạng thái duyệt.
 */
const W = 900;
const PAD = 44;
const BRAND = '#1f7a55';
const INK = '#1d2a24';
const MUTED = '#5f6f67';
const LINE = '#dbe2dc';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const vnd = (n: number) => `${Math.round(n || 0).toLocaleString('vi-VN')}đ`;
const day = (ymd: string | null | undefined) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '');

/** Số lượng đọc cho khách: mã bán theo thùng ghi thùng; mã lẻ chia hết quy cách thì ghi thêm số thùng. */
export function qtyLabel(qty: number, unit: string | null | undefined, pack: string | null | undefined): string {
  const u = (unit ?? '').trim().toLowerCase();
  if (u.includes('thùng') || u.includes('thung')) return `${qty} thùng`;
  const n = Number(String(pack ?? '').match(/\d+/)?.[0] ?? 1);
  const name = u || 'chai';
  if (n > 1 && qty % n === 0) return `${qty / n} thùng (${qty} ${name})`;
  return `${qty} ${name}`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

export function drawOrderImage(o: OrderDetail): string {
  const scale = 2;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `500 24px ${FONT}`;
  const nameW = W - PAD * 2 - 230;
  const items = o.items.map((i) => ({ ...i, lines: wrap(measure, i.product_name + (i.is_gift ? ' (tặng)' : ''), nameW) }));
  const extras: Array<[string, string]> = [];
  if (o.discount_amount) extras.push(['Chiết khấu', `−${vnd(o.discount_amount)}`]);
  if (o.bonus_deduction) extras.push(['Trừ thưởng', `−${vnd(o.bonus_deduction)}`]);
  if (o.shipping_fee) extras.push(['Phí vận chuyển', vnd(o.shipping_fee)]);
  if (o.cod_amount) extras.push(['Đã đặt cọc', vnd(o.cod_amount)]);

  // Vẽ trên khung dư chiều cao rồi cắt đúng phần đã vẽ.
  let h = 400 + items.reduce((a, it) => a + it.lines.length * 30 + 90, 0) + extras.length * 40 + 200;

  const cv = document.createElement('canvas');
  cv.width = W * scale;
  cv.height = h * scale;
  const ctx = cv.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, h);
  ctx.fillStyle = BRAND;
  ctx.fillRect(0, 0, W, 10);

  let y = PAD + 18;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BRAND;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText('AILLA · ĐƠN HÀNG', PAD, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = MUTED;
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(`Ngày ${day(o.order_date)}`, W - PAD, y);
  ctx.textAlign = 'left';
  y += 46;
  ctx.fillStyle = INK;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(o.order_no, PAD, y);
  y += 38;
  ctx.font = `600 25px ${FONT}`;
  ctx.fillText(o.customer_name, PAD, y);
  if (o.customer_address) {
    y += 32;
    ctx.fillStyle = MUTED;
    ctx.font = `400 21px ${FONT}`;
    ctx.fillText(wrap(ctx, o.customer_address, W - PAD * 2)[0], PAD, y);
  }
  y += 26;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();

  for (const it of items) {
    y += 40;
    ctx.fillStyle = INK;
    ctx.font = `500 24px ${FONT}`;
    it.lines.forEach((ln, k) => ctx.fillText(ln, PAD, y + k * 30));
    ctx.textAlign = 'right';
    ctx.font = `600 24px ${FONT}`;
    ctx.fillText(it.is_gift ? '0đ' : vnd(it.line_total), W - PAD, y);
    ctx.textAlign = 'left';
    y += (it.lines.length - 1) * 30 + 32;
    ctx.fillStyle = MUTED;
    ctx.font = `400 21px ${FONT}`;
    const unitPrice = it.is_gift ? '' : ` × ${vnd(it.applied_price)}`;
    ctx.fillText(`${qtyLabel(it.qty, it.unit, it.pack_size)}${unitPrice}`, PAD, y);
    y += 22;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
  }

  y += 46;
  const row = (label: string, val: string, bold = false) => {
    ctx.fillStyle = bold ? INK : MUTED;
    ctx.font = `${bold ? 700 : 500} ${bold ? 30 : 23}px ${FONT}`;
    ctx.fillText(label, PAD, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = bold ? BRAND : INK;
    ctx.fillText(val, W - PAD, y);
    ctx.textAlign = 'left';
  };
  row('Tiền hàng', vnd(o.subtotal));
  for (const [l, v] of extras) {
    y += 36;
    row(l, v);
  }
  y += 52;
  row('Tổng tiền', vnd(o.total_amount), true);
  h = Math.ceil(y + PAD);
  const out = document.createElement('canvas');
  out.width = W * scale;
  out.height = h * scale;
  out.getContext('2d')!.drawImage(cv, 0, 0);
  return out.toDataURL('image/png');
}

/** Điện thoại: mở bảng chia sẻ để chọn Zalo gửi luôn. Máy không hỗ trợ thì trả false (dùng nút Lưu ảnh). */
export async function shareImage(dataUrl: string, name: string): Promise<boolean> {
  try {
    // Không dùng fetch(data:) vì chính sách bảo mật của web chặn.
    const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/png' });
    const file = new File([blob], `${name}.png`, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
    await nav.share({ files: [file] });
    return true;
  } catch (e) {
    // Người dùng tự đóng bảng chia sẻ thì coi như đã xử lý.
    return e instanceof DOMException && e.name === 'AbortError';
  }
}

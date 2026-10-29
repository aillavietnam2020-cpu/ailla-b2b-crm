import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Kiểu bảng giao dịch dùng chung: hub/src/gdbang.js (tách mã đơn trong ô chữ tự do). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const G: any = new Function('esc', `${readFileSync('hub/src/gdbang.js', 'utf8')}\nreturn {gdMaDon, gdLaMa};`)((s: string) => s);

describe('Tách mã đơn của phiếu chi vận chuyển', () => {
  it('tách theo phẩy, chấm phẩy, xuống dòng', () => {
    expect(G.gdMaDon('DH202610-0040, PM2610-009; hàng sàn ngày 28/10\nIMP-thuyan-3009')).toEqual(['DH202610-0040', 'PM2610-009', 'hàng sàn ngày 28/10', 'IMP-thuyan-3009']);
  });
  it('nhận ra mã đơn, chữ tự do thì không', () => {
    expect(G.gdLaMa('DH202610-0040')).toBe(true);
    expect(G.gdLaMa('PM2610-009')).toBe(true);
    expect(G.gdLaMa('IMP-thuyan-3009')).toBe(true);
    expect(G.gdLaMa('hàng sàn ngày 28/10')).toBe(false);
    expect(G.gdLaMa('Lê Thị Hoa (Hoa Xù)')).toBe(false);
  });
});

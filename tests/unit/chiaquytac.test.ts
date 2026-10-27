import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Quy tắc phân bổ chi chung: hub/src/chicalc.js (scChiaChung, scKenhChuan). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = new Function(`${readFileSync('hub/src/chicalc.js', 'utf8')}\nreturn {scChiaChung, scKenhChuan};`)();
const r = (g: string, t: number, st = 'Ổn') => ({ g, t, k: 'Chung', st });
const DT = { TikTok: 600, 'Shopee Mall': 300, Facebook: 100 };
const tong = (o: Record<string, Record<string, number>>) => Object.values(o).reduce((a, x) => a + Object.values(x).reduce((b, v) => b + v, 0), 0);

describe('Quy tắc phân bổ chi chung', () => {
  it('chia theo doanh thu, tổng sau chia bằng tổng trước (cả khi lẻ tiền)', () => {
    const o = C.scChiaChung([r('G13', 1000001)], [{ g: '*', cach: 'dt', ks: ['TikTok', 'Shopee Mall', 'Facebook'] }], DT);
    expect(o.kenh.TikTok.G13).toBe(600001);
    expect(o.kenh['Shopee Mall'].G13).toBe(300000);
    expect(o.kenh.Facebook.G13).toBe(100000);
    expect(o.sau).toBe(o.truoc);
    expect(o.con).toHaveLength(0);
  });
  it('tỷ lệ dưới 100% thì phần còn lại để ở chi chung', () => {
    const o = C.scChiaChung([r('G11', 1000)], [{ g: 'G11', cach: 'tl', tl: { TikTok: 50, Facebook: 30 } }], DT);
    expect(o.kenh.TikTok.G11).toBe(500);
    expect(o.kenh.Facebook.G11).toBe(300);
    expect(o.con).toEqual([{ g: 'G11', t: 200, why: 'phần để lại chi chung' }]);
    expect(o.sau).toBe(1000);
  });
  it('tỷ lệ cộng quá 100% thì không chia và báo lỗi', () => {
    const o = C.scChiaChung([r('G11', 1000)], [{ g: 'G11', cach: 'tl', tl: { TikTok: 70, Facebook: 40 } }], DT);
    expect(o.kenh).toEqual({});
    expect(o.loi[0]).toContain('quá 100%');
    expect(o.sau).toBe(1000);
  });
  it('khoản cần rà / chờ duyệt không được đem chia', () => {
    const o = C.scChiaChung([r('G13', 500, 'Cần rà'), r('G13', 300)], [{ g: '*', cach: 'dt', ks: ['TikTok', 'Facebook'] }], DT);
    expect(tong(o.kenh)).toBe(300);
    expect(o.con[0].t).toBe(500);
    expect(o.sau).toBe(800);
  });
  it('thiếu doanh thu kênh nhận thì không chia theo doanh thu', () => {
    const o = C.scChiaChung([r('G13', 900)], [{ g: '*', cach: 'dt', ks: ['TikTok', 'NPP'] }], DT);
    expect(o.kenh).toEqual({});
    expect(o.loi[0]).toContain('NPP');
  });
  it('quy tắc riêng của nhóm thắng quy tắc mặc định; "giu" để nguyên chi chung; quy tắc tắt bị bỏ qua', () => {
    const rules = [{ g: '*', cach: 'dt', ks: ['TikTok', 'Facebook'] }, { g: 'G21', cach: 'giu' }, { g: 'G18', cach: 'tl', tl: { TikTok: 100 }, on: false }];
    const o = C.scChiaChung([r('G21', 100), r('G18', 70)], rules, DT);
    expect(o.con).toEqual([{ g: 'G21', t: 100, why: 'giữ ở chi chung' }]);
    expect(o.kenh.TikTok.G18).toBe(60);
    expect(o.kenh.Facebook.G18).toBe(10);
  });
  it('đổi tên kênh bảng lương sang cột Sổ chi phí', () => {
    expect(C.scKenhChuan('TikTok Shop')).toBe('TikTok');
    expect(C.scKenhChuan('Facebook / Pancake')).toBe('Facebook');
    expect(C.scKenhChuan('B2B / Đại lý (CRM)')).toBe('NPP');
    expect(C.scKenhChuan('Shopee')).toBe('Shopee Mall');
    expect(C.scKenhChuan('Shopee Aillavn1')).toBe('Shopee thường');
    expect(C.scKenhChuan('Website')).toBe('');
  });
});

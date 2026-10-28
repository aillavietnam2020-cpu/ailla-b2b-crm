import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Phí vận hành TikTok theo hợp đồng: hub/src/chicalc.js (scPhiVanHanhTT). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = new Function(`${readFileSync('hub/src/chicalc.js', 'utf8')}\nreturn {scPhiVanHanhTT};`)();

describe('Phí vận hành TikTok theo hợp đồng', () => {
  it('800 triệu – 2 tỷ, quảng cáo + affiliate dưới 30%: 12,5 triệu + thưởng 2%', () => {
    const r = C.scPhiVanHanhTT(1_392_110_100, 364_658_750, 34_655_085);
    expect(r.phi).toBe(12_500_000);
    expect(r.thuong).toBe(27_842_202);
    expect(r.tong).toBe(40_342_202);
  });
  it('quảng cáo + affiliate từ 30%: không thưởng', () => {
    expect(C.scPhiVanHanhTT(1_000_000_000, 250_000_000, 50_000_000).thuong).toBe(0);
  });
  it('dưới 800 triệu: vẫn 12,5 triệu, không thưởng', () => {
    const r = C.scPhiVanHanhTT(500_000_000, 10_000_000, 0);
    expect(r.phi).toBe(12_500_000);
    expect(r.thuong).toBe(0);
  });
  it('trên 2 tỷ: vẫn 12,5 triệu, thưởng 3% khi quảng cáo + affiliate dưới 30%', () => {
    const r = C.scPhiVanHanhTT(2_500_000_000, 100_000_000, 0);
    expect(r.phi).toBe(12_500_000);
    expect(r.thuong).toBe(75_000_000);
    expect(r.tong).toBe(87_500_000);
  });
  it('trên 2 tỷ nhưng quảng cáo + affiliate từ 30%: chỉ phí cố định', () => {
    expect(C.scPhiVanHanhTT(2_500_000_000, 700_000_000, 100_000_000).tong).toBe(12_500_000);
  });
  it('đúng 2 tỷ là mức 2%', () => {
    expect(C.scPhiVanHanhTT(2_000_000_000, 100_000_000, 0).thuong).toBe(40_000_000);
  });
});

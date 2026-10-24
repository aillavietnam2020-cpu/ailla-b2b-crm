import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Phòng điều hành (hub/src/dhcalc.js): giá nguyên liệu tăng, giá thành mới/bình quân, giá bán dưới ngưỡng, tiền, lãi tạm tính, 3 tầng. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(
  `${readFileSync('hub/src/dhcalc.js', 'utf8')}
  return {dhCfg,dhNvl,dhCost,dhGiaThanh,dhSellCheck,dhRunway,dhTamTinh,dhLuongKenh,dhBaTang};`,
)();

describe('Phòng điều hành: giá nguyên liệu và giá thành', () => {
  it('báo nguyên liệu tăng giá so với tháng trước, so cả với giá bình quân', () => {
    const cur = [
      { item: 'NVL1', name: 'Hương', last_price: 70000, avg_price: 68000, open_price: 50000 },
      { item: 'NVL2', name: 'Chai', last_price: 1000, avg_price: 1000, open_price: 0 },
      { item: 'NVL3', name: 'Nắp', last_price: 525, avg_price: 510, open_price: 500 },
    ];
    const prev = [{ item: 'NVL1', last_price: 50000 }, { item: 'NVL2', last_price: 1020 }];
    const r = T.dhNvl(cur, prev, 0.05);
    const n1 = r.find((x: any) => x.item === 'NVL1');
    expect(n1.chg).toBeCloseTo(0.4);
    expect(n1.gap).toBeCloseTo(2000 / 68000);
    expect(n1.up).toBe(true);
    expect(r.find((x: any) => x.item === 'NVL2').up).toBe(false);
    expect(r.find((x: any) => x.item === 'NVL3').chg).toBeCloseTo(0.05); // không có tháng trước: so với giá tồn đầu tháng
    expect(r[0].item).toBe('NVL1');
  });

  it('giá thành bóc nhiều bậc theo giá mới và theo bình quân, ghi mã thiếu giá', () => {
    const bom = new Map([
      ['TP', [{ item: 'BTP', qty: 0.5 }, { item: 'CHAI', qty: 1 }]],
      ['BTP', [{ item: 'NVL1', qty: 2 }]],
      ['TP2', [{ item: 'NVL1', qty: 1 }, { item: 'LA', qty: 1 }]],
    ]);
    const pNew = (c: string) => ({ NVL1: 70000, CHAI: 1000 })[c] ?? 0;
    const pAvg = (c: string) => ({ NVL1: 68000, CHAI: 1000 })[c] ?? 0;
    const [tp, tp2] = T.dhGiaThanh(['TP', 'TP2'], bom, pNew, pAvg);
    expect(tp.moi).toBe(0.5 * 2 * 70000 + 1000);
    expect(tp.bq).toBe(0.5 * 2 * 68000 + 1000);
    expect(tp.miss).toEqual([]);
    expect(tp2.miss).toEqual(['LA']);
  });

  it('giá bán, báo giá gia công dưới ngưỡng thì báo đỏ và gợi ý giá tối thiểu', () => {
    const map = new Map([['sp1', { misa_code: 'TP', factor: 2 }], ['sp2', { misa_code: 'TP2', factor: 1 }]]);
    const cost = new Map([['TP', { moi: 50000, miss: [] }], ['TP2', { moi: 10000, miss: ['LA'] }]]);
    const ng = T.dhCfg({}).nguong;
    const r = T.dhSellCheck(
      [
        { kind: 'kh', who: 'Khách GC', sku: 'SP1', name: 'Gia công 1', price: 110000 },
        { kind: 'tier', who: 'NPP', sku: 'SP1', name: 'SP 1', price: 150000 },
        { kind: 'tier', who: 'NPP', sku: 'SP2', name: 'SP 2', price: 20000 },
        { kind: 'tier', who: 'NPP', sku: 'SP9', name: 'SP 9', price: 20000 },
      ],
      map,
      (c: string) => cost.get(c) ?? null,
      ng,
    );
    const gc = r.find((x: any) => x.kind === 'kh');
    expect(gc.cost).toBe(100000);
    expect(gc.red).toBe(true);
    expect(gc.min).toBe(117700); // 100.000 ÷ (1 − 15%) làm tròn lên trăm đồng
    expect(r.find((x: any) => x.sku === 'SP1' && x.kind === 'tier').red).toBe(false);
    expect(r.find((x: any) => x.sku === 'SP2').why).toMatch(/Thiếu giá/);
    expect(r.find((x: any) => x.sku === 'SP9').why).toMatch(/Chưa nối mã/);
  });
});

describe('Phòng điều hành: tiền, lãi tạm tính, 3 tầng', () => {
  it('tiền đủ chạy bao nhiêu ngày', () => {
    expect(T.dhRunway({ tien: 300e6, vi: 60e6, thu: 100e6, tra: 160e6, chiNgay: 12e6 })).toEqual({ co: 360e6, ngay: 30, ngay2: 25 });
    expect(T.dhRunway({ tien: 1, chiNgay: 0 }).ngay).toBeNull();
  });
  it('lãi tạm tính: trừ hủy/hoàn dự kiến, giá vốn, phí sàn, quảng cáo đã chi, đóng gói, lương', () => {
    const r = T.dhTamTinh({ ban: 1000, don: 10, ads: 100 }, { thuan: 0.9, gv: 0.2, phi: 0.3, dongGoi: 5 }, 50);
    expect(r.dt).toBe(900);
    expect(r.t1).toBeCloseTo(900 - 180 - 270);
    expect(r.t2).toBeCloseTo(450 - 100 - 45 - 50);
    const s = T.dhTamTinh({ ban: 1000, don: 0, ads: 0, gv: 300, phi: 100 }, { thuan: 1, gv: 0.5, phi: 0.5 }, 0);
    expect(s.t1).toBe(600); // có số thật thì dùng số thật
  });
  it('lương team chia theo % kênh, lãi 3 tầng chia chi phí chung theo doanh thu', () => {
    const cfg = T.dhCfg({ luong: [{ team: 'Content', tien: 30e6, pt: { tts: 80, fb: 20 } }, { team: 'Sale', tien: 20e6, pt: { fb: 100 } }], kenh: { tts: { dongGoi: 2000 } } });
    expect(T.dhLuongKenh(cfg.luong, 'tts', 30)).toBeCloseTo(24e6);
    expect(T.dhLuongKenh(cfg.luong, 'fb', 15)).toBeCloseTo((6e6 + 20e6) / 2);
    const [tt, fb] = T.dhBaTang([{ ch: 'tts', dt: 300e6, lai: 80e6, don: 1000 }, { ch: 'fb', dt: 100e6, lai: 40e6, don: 500 }], cfg, 40e6);
    expect(tt.t2).toBe(80e6 - 24e6 - 2e6);
    expect(tt.pb).toBe(30e6);
    expect(fb.t3).toBe(40e6 - 26e6 - 10e6);
  });
});

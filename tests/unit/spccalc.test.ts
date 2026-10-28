import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Sản phẩm & combo (hub/src/spccalc.js): gom combo, giá vốn combo, trạng thái, tóm tắt mã chưa quy đổi. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(
  `${readFileSync('hub/src/spccalc.js', 'utf8')}
  return {spcGvMap,spcGroup,spcCost,spcStatus,spcUnSum,spcSuggestCode};`,
)();

const row = (sku: string, label: string, qty: number, kind = 'sp', extra: Record<string, string> = {}) => ({
  channel: 'SHOPEE', sku, variant: '', from_day: '', item_label: label, qty, kind, note: '', off_from: '', updated_at: '2026-10-20T00:00:00Z', ...extra,
});

describe('spccalc', () => {
  const rows = [
    row('2TL', 'TLG - Tẩy lồng', 2),
    row('2TL', 'CHOI - Chổi', 1, 'gift'),
    row('2TL', 'HOP5 - Hộp', 1, 'pack'),
    row('2TL', 'TLG - Tẩy lồng', 3, 'sp', { from_day: '2026-10-25' }),
    row('OLD', 'TLG - Tẩy lồng', 1, 'sp', { off_from: '2026-10-10' }),
    row('Q', 'X - Lạ', 1, 'sp', { note: '❓ CẦN KẾ TOÁN XÁC NHẬN: mã nào?' }),
  ];
  const sales = [
    { channel: 'SHOPEE', sku: '2TL', variant: '', shop: 'Ailla VN', orders: 3, last_day: '2026-10-26' },
    { channel: 'SHOPEE', sku: '2tl', variant: '', shop: 'Ailla Việt Nam', orders: 2, last_day: '2026-10-27' },
  ];

  it('gom combo, chọn bản theo ngày, đánh dấu ngừng dùng, cộng đơn các shop', () => {
    const C = T.spcGroup(rows, sales, '2026-10-28');
    const c = C.find((x: { sku: string }) => x.sku === '2TL');
    expect(c.versions.map((v: { from: string }) => v.from)).toEqual(['', '2026-10-25']);
    expect(c.parts).toEqual([{ label: 'TLG - Tẩy lồng', code: 'TLG', qty: 3, kind: 'sp' }]);
    expect(c).toMatchObject({ orders: 5, shops: ['Ailla VN', 'Ailla Việt Nam'], last: '2026-10-27', active: true });
    expect(T.spcGroup(rows, sales, '2026-10-20').find((x: { sku: string }) => x.sku === '2TL').parts).toHaveLength(3);
    expect(C.find((x: { sku: string }) => x.sku === 'OLD').active).toBe(false);
    expect(C.find((x: { sku: string }) => x.sku === 'Q').flag).toBe('mã nào?');
  });

  it('giá vốn: Giá vốn SKU đè giá nhập kho, chọn tháng gần nhất không quá kỳ; thiếu giá sản phẩm/quà thì không ước', () => {
    const g = T.spcGvMap(
      [{ ma: 'TLG', giaVon: { '2026-09': 20000, '2026-11': 99999 } }],
      [{ item: 'tlg', avg: 15000 }, { item: 'CHOI', avg: 5000 }],
      '2026-10',
    );
    expect(g.tlg).toEqual({ u: 20000, src: 'Giá vốn SKU 09/2026' });
    const parts = T.spcGroup(rows, [], '2026-10-20').find((x: { sku: string }) => x.sku === '2TL').parts;
    expect(T.spcCost(parts, g)).toMatchObject({ u: 45000, miss: [] });
    expect(T.spcCost(parts, { tlg: g.tlg })).toMatchObject({ u: null, miss: ['CHOI'] });
  });

  it('trạng thái và tóm tắt mã chưa quy đổi', () => {
    const C = T.spcGroup(rows, [], '2026-10-28');
    const items = new Set(['tlg', 'choi', 'hop5']);
    const by = (s: string) => C.find((x: { sku: string }) => x.sku === s);
    expect(T.spcStatus(by('OLD'), items, null)).toEqual(['gry', 'Ngừng dùng từ 10/10']);
    expect(T.spcStatus(by('Q'), items, null)[1]).toBe('Có món chưa có mã kho');
    expect(T.spcStatus(by('2TL'), items, {})[1]).toBe('Thiếu giá vốn 1 món');
    expect(T.spcStatus(by('2TL'), items, { tlg: { u: 1 } })[1]).toBe('Đủ');
    expect(T.spcUnSum([{ channel: 'TIKTOK', orders: 2, first_day: '2026-10-23' }, { channel: 'SHOPEE', orders: 3, first_day: '2026-10-05' }])).toEqual({
      codes: 2, orders: 5, oldest: '2026-10-05', by: 'Shopee 1, TikTok 1',
    });
    expect(T.spcSuggestCode('Nước lau sàn Ailla 1L hương Quế')).toBe('AILLANLS1LHQ');
  });
});

import { describe, expect, it } from 'vitest';
import {
  CSKH_DEFAULTS,
  attributeOrders,
  birthdaySoon,
  callState,
  mergeSettings,
  normBirthday,
  normPhone,
  parsePosOrder,
  pickOwners,
  tier,
} from '../../src/shared/cskh';

const set = mergeSettings({ cycles: { 'Xịt ruồi': 25 } });

describe('CSKH khách lẻ', () => {
  it('chuẩn hoá số điện thoại', () => {
    expect(normPhone('+84 899 050 504')).toBe('0899050504');
    expect(normPhone('0899.050.504')).toBe('0899050504');
    expect(normPhone('899050504')).toBe('0899050504');
    expect(normPhone('12345')).toBe('');
    expect(normPhone(null)).toBe('');
  });

  it('đọc đơn Poscake: số, địa chỉ, ngày giao theo giờ Việt Nam, sản phẩm', () => {
    const p = parsePosOrder(
      {
        id: 4812,
        status: 3,
        account: 'L1',
        inserted_at: '2026-11-05T03:00:00',
        bill_phone_number: '0900000000',
        shipping_address: { full_name: 'Dương Xuân', phone_number: '+84899050504', address: 'Số 12', commune_name: 'Dịch Vọng', district_name: 'Cầu Giấy', province_name: 'Hà Nội' },
        status_history: [
          { status: 2, updated_at: '2026-11-06T02:00:00' },
          { status: 3, updated_at: '2026-11-08T18:30:00' },
        ],
        items: [{ quantity: 2, variation_info: { name: 'Xịt ruồi', retail_price: 189000 } }],
        total_price_after_sub_discount: 350000,
      },
      { L1: 'Thảo-Xịt ruồi' },
    );
    expect(p).not.toBeNull();
    expect(p!.phone).toBe('0899050504');
    expect(p!.day).toBe('2026-11-09'); // 18:30 UTC = 01:30 sáng 09/11 giờ VN
    expect(p!.createdDay).toBe('2026-11-05');
    expect(p!.items).toEqual([{ n: 'Xịt ruồi', q: 2, p: 378000 }]);
    expect(p!.total).toBe(350000);
    expect(p!.source).toBe('Landing Thảo-Xịt ruồi');
    expect(p!.district).toBe('Cầu Giấy');
  });

  it('đơn không có số điện thoại thì bỏ', () => {
    expect(parsePosOrder({ id: 1, items: [] })).toBeNull();
  });

  it('trạng thái gọi', () => {
    const base = { owner_id: 'u1', next_call: null, last_call: null, last_order_day: '2026-11-08', last_product: 'Xịt ruồi', order_count: 1 };
    expect(callState({ ...base, owner_id: null }, '2026-11-10', set)).toBe('chua');
    expect(callState(base, '2026-11-10', set)).toBe('moi');
    expect(callState({ ...base, next_call: '2026-11-11' }, '2026-11-10', set)).toBe('cho');
    expect(callState({ ...base, last_call: '2026-11-09', next_call: '2026-11-09' }, '2026-11-10', set)).toBe('qua');
    expect(callState({ ...base, last_call: '2026-11-09', next_call: '2026-11-10' }, '2026-11-10', set)).toBe('nay');
    // Mua xịt ruồi 23 ngày trước (chu kỳ 25 ngày, gọi trước 3 ngày) → đến kỳ mua lại.
    expect(callState({ ...base, last_call: '2026-10-20', last_order_day: '2026-10-18' }, '2026-11-10', set)).toBe('ky');
    // Quá kỳ lâu (hơn 10 ngày) thì không còn ở danh sách hôm nay.
    expect(callState({ ...base, last_call: '2026-09-01', last_order_day: '2026-08-01' }, '2026-11-10', set)).toBe('cho');
  });

  it('hạng khách và sinh nhật', () => {
    expect(tier(2, CSKH_DEFAULTS)).toBe('VIP');
    expect(tier(1, CSKH_DEFAULTS)).toBe('Mua 1 lần');
    expect(birthdaySoon('12/11', '2026-11-10')).toBe(true);
    expect(birthdaySoon('20/11', '2026-11-10')).toBe(false);
    expect(birthdaySoon('02/01', '2026-12-30')).toBe(true);
    expect(normBirthday('5/6')).toBe('05/06');
    expect(normBirthday('40/2')).toBe('');
  });

  it('chia khách: khách cũ về người cũ, còn lại chia đều, bỏ người đang nghỉ', () => {
    const s = mergeSettings({ staffOff: ['c'] });
    const r = pickOwners(
      [
        { phone: '1', prev: 'b' },
        { phone: '2', prev: null },
        { phone: '3', prev: null },
        { phone: '4', prev: 'c' },
      ],
      ['a', 'b', 'c'],
      s,
    );
    expect(r['1']).toBe('b');
    expect(r['2']).toBe('a');
    expect(new Set([r['3'], r['4']])).toEqual(new Set(['a', 'b']));
    expect(Object.values(r)).not.toContain('c');
  });

  it('doanh thu bán thêm: đơn web theo người tạo, đơn khác theo cuộc gọi chốt trong 7 ngày', () => {
    const m = attributeOrders(
      [
        { id: 'A', phone: 'p1', created_day: '2026-11-03', day: '2026-11-06', total: 100 },
        { id: 'B', phone: 'p1', created_day: '2026-11-20', day: '2026-11-22', total: 100 },
        { id: 'C', phone: 'p2', created_day: '2026-11-04', day: '2026-11-06', total: 100 },
        { id: 'D', phone: 'p1', created_day: '2026-10-30', day: '2026-11-02', total: 100 },
      ],
      [
        { phone: 'p1', by_id: 'x', day: '2026-11-01' },
        { phone: 'p1', by_id: 'y', day: '2026-11-02' },
      ],
      { C: 'z' },
    );
    expect(m.get('A')).toBe('y'); // cuộc chốt gần nhất
    expect(m.has('B')).toBe(false); // quá 7 ngày
    expect(m.get('C')).toBe('z'); // đơn tạo trên web
    expect(m.has('D')).toBe(false); // đơn tạo trước cuộc gọi
  });
});

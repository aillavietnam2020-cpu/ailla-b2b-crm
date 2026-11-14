import { describe, expect, it } from 'vitest';
import {
  addProductLine,
  lineNeedsPrice,
  removeLine,
  setLineGift,
  type Line,
} from '../../src/client/pages/sales/orderLines';

/** Màn tạo đơn: thêm mã (kể cả mã chưa có giá), tích / bỏ tích hàng tặng, xoá dòng (Thảo báo 14/11). */
const base = (id: string, price: number | null): Omit<Line, 'uid' | 'is_gift'> => ({
  product_id: id,
  sku: id.toUpperCase(),
  name: id,
  unit: 'Can',
  pack_size: 1,
  pack_mode: 'LE',
  qty: 1,
  base_price: price,
  applied_price: null,
  carton_sku: false,
});

describe('dòng hàng màn tạo đơn', () => {
  it('thêm được mã chưa có giá (ARILA10 cho khách gia công), ô giá để trống', () => {
    const r = addProductLine([], base('arila10', null));
    expect(r.result).toBe('added');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].base_price).toBeNull();
    expect(r.lines[0].applied_price).toBeNull();
    expect(r.lines[0].is_gift).toBe(false);
  });

  it('mã chưa có giá: chặn khi chưa nhập, nhập giá tay > 0 thì hết chặn', () => {
    const [l] = addProductLine([], base('arila10', null)).lines;
    expect(lineNeedsPrice(l, { freeTier: false })).toBe(true);
    expect(lineNeedsPrice({ ...l, applied_price: 150000 }, { freeTier: false })).toBe(false);
    expect(lineNeedsPrice({ ...l, is_gift: true }, { freeTier: false })).toBe(false);
    // Mã có giá cấp: không chặn; cấp "Khác" thì phải nhập giá.
    const priced = addProductLine([], base('a', 1000)).lines[0];
    expect(lineNeedsPrice(priced, { freeTier: false })).toBe(false);
    expect(lineNeedsPrice(priced, { freeTier: true })).toBe(true);
  });

  it('chọn lại cùng mã thì thêm dòng tặng, lần ba báo trùng', () => {
    let lines = addProductLine([], base('a', 1000)).lines;
    const r2 = addProductLine(lines, base('a', 1000));
    expect(r2.result).toBe('gift');
    lines = r2.lines;
    expect(lines.map((l) => l.is_gift)).toEqual([false, true]);
    expect(new Set(lines.map((l) => l.uid)).size).toBe(2);
    expect(addProductLine(lines, base('a', 1000)).result).toBe('duplicate');
  });

  it('bỏ tích hàng tặng: dòng đó thành dòng bán, không sinh dòng mới, khoá dòng không trùng', () => {
    let lines = addProductLine([], base('a', 1000)).lines;
    lines = addProductLine(lines, base('a', 1000)).lines;
    const giftUid = lines[1].uid;
    lines = setLineGift(lines, giftUid, false);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.is_gift)).toEqual([false, false]);
    expect(new Set(lines.map((l) => l.uid)).size).toBe(2);
    // Tích lại thì về tặng, giá sửa tay bị bỏ.
    lines = setLineGift(lines.map((l) => (l.uid === giftUid ? { ...l, applied_price: 900 } : l)), giftUid, true);
    expect(lines[1]).toMatchObject({ is_gift: true, applied_price: null });
    expect(lines[0].is_gift).toBe(false);
  });

  it('xoá chỉ xoá đúng dòng được bấm, kể cả khi hai dòng cùng mã', () => {
    let lines = addProductLine([], base('a', 1000)).lines;
    lines = addProductLine(lines, base('a', 1000)).lines;
    lines = addProductLine(lines, base('b', null)).lines;
    lines = setLineGift(lines, lines[1].uid, false);
    const [first, second, third] = lines;
    expect(removeLine(lines, first.uid).map((l) => l.uid)).toEqual([second.uid, third.uid]);
    expect(removeLine(lines, second.uid).map((l) => l.uid)).toEqual([first.uid, third.uid]);
    expect(removeLine(lines, third.uid).map((l) => l.uid)).toEqual([first.uid, second.uid]);
  });
});

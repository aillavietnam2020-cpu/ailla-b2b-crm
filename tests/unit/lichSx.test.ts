import { describe, expect, it } from 'vitest';
import { planLichSx, workDays, type LichInput } from '../../src/server/services/lichSx';

/** Lịch sản xuất đề xuất 3 ngày (chị Hoa 21/11/2026). Thứ Bảy 21/11 → các ngày làm việc 23, 24, 25/11 (bỏ Chủ nhật). */
const base = (): LichInput => ({
  today: '2026-11-21',
  items: [
    { code: 'NG10', name: 'Nước giặt 10kg', unit: 'can', cls: 'TP', ton: 10 },
    { code: 'TUI', name: 'Túi tẩy lồng', unit: 'túi', cls: 'TP', ton: 2000 },
    { code: 'BTP189', name: 'Dung dịch 189', unit: 'lít', cls: 'BTP', ton: 500 },
    { code: 'VO10', name: 'Vỏ can 10L', unit: 'cái', cls: 'NVL', ton: 1000 },
    { code: 'BOT', name: 'Bột tẩy lồng', unit: 'kg', cls: 'NVL', ton: 5000 },
    { code: 'HUONG', name: 'Hương 189', unit: 'kg', cls: 'NVL', ton: 100 },
  ],
  ban: { TUI: 1000 },
  orders: [{ order_no: 'DH1', customer: 'Metis', kenh: 'GIA_CONG', ship: '2026-11-23', item: 'NG10', qty: 70 }],
  reqs: [],
  bom: [
    { product: 'NG10', item: 'BTP189', qty: 9.8 },
    { product: 'NG10', item: 'VO10', qty: 1 },
    { product: 'TUI', item: 'BOT', qty: 0.12 },
    { product: 'BTP189', item: 'HUONG', qty: 0.01 },
  ],
  rate: { NG10: 20, TUI: 100 },
});

describe('lịch sản xuất đề xuất', () => {
  it('3 ngày làm việc, bỏ Chủ nhật', () => {
    expect(workDays('2026-11-21')).toEqual(['2026-11-23', '2026-11-24', '2026-11-25']);
  });

  it('đơn thiếu hàng xếp trước, bổ sung tồn sau; chia việc lớn sang ngày sau theo sức xưởng', () => {
    const r = planLichSx(base());
    const d1 = r.days[0];
    expect(d1.tasks[0]).toMatchObject({ item: 'NG10', kind: 'DON', qty: 60, refs: ['DH1'], late: false });
    expect(d1.tasks[0].hours).toBe(3);
    // Túi: còn 2 ngày bán → làm đủ 21 ngày = 19.000 túi = 190 giờ công; sức xưởng 64 × 70% = 44,8 giờ/ngày.
    const tui = r.days.flatMap((d) => d.tasks).filter((t) => t.item === 'TUI');
    expect(tui.length).toBe(3);
    expect(r.days.every((d) => d.used <= d.cap + 0.01)).toBe(true);
    expect(r.overflow[0]).toMatchObject({ item: 'TUI' });
    expect(tui.reduce((a, t) => a + t.qty, 0) + r.overflow[0].qty).toBe(19000);
  });

  it('thiếu bán thành phẩm thì xét tiếp vật tư pha chế; thiếu vật tư vẫn xếp lịch, đánh dấu và gom danh sách cần chuẩn bị', () => {
    const inp = base();
    inp.items.find((i) => i.code === 'BTP189')!.ton = 100; // cần 588 lít → thiếu 488 lít → cần 4,88 kg hương (có 100)
    expect(planLichSx(inp).thieu).toHaveLength(0);
    inp.items.find((i) => i.code === 'HUONG')!.ton = 1;
    const r = planLichSx(inp);
    expect(r.days[0].tasks[0]).toMatchObject({ item: 'NG10', kind: 'DON' });
    expect(r.days[0].tasks[0].lack[0]).toMatchObject({ item: 'HUONG' });
    expect(r.thieu[0]).toMatchObject({ item: 'HUONG', have: 1, for: ['Nước giặt 10kg'] });
  });

  it('lệnh sản xuất đang mở được tính là hàng sắp có, không đẻ thêm việc theo đơn', () => {
    const inp = base();
    inp.reqs = [{ id: 'PSX1', sp: 'NG10', sl: 60, han: '2026-11-23', st: 'CAN_LAM' }];
    const all = planLichSx(inp).days.flatMap((d) => d.tasks).filter((t) => t.item === 'NG10');
    expect(all.map((t) => t.kind)).toEqual(['LENH']);
  });

  it('chưa có định mức năng suất thì ước giờ công mặc định và đánh dấu', () => {
    const inp = base();
    inp.rate = {};
    const t = planLichSx(inp).days[0].tasks[0];
    expect(t.hoursEst).toBe(true);
    expect(t.hours).toBe(4);
  });

  it('mỗi ngày tối đa số mã đặt trước; đơn không kịp hạn thì đề xuất dời ngày giao, không dồn tăng ca', () => {
    const inp = base();
    inp.ban = {};
    inp.cfg = { maxMa: 2 };
    inp.items.push({ code: 'A', name: 'Hàng A', unit: 'chai', cls: 'TP', ton: 0 }, { code: 'B', name: 'Hàng B', unit: 'chai', cls: 'TP', ton: 0 });
    inp.bom.push({ product: 'A', item: 'BOT', qty: 0.01 }, { product: 'B', item: 'BOT', qty: 0.01 });
    inp.orders.push({ order_no: 'DH2', customer: 'NPP X', kenh: 'B2B', ship: '2026-11-23', item: 'A', qty: 10 },
      { order_no: 'DH3', customer: 'NPP Y', kenh: 'B2B', ship: '2026-11-23', item: 'B', qty: 10 });
    const r = planLichSx(inp);
    expect(new Set(r.days[0].tasks.map((t) => t.item)).size).toBe(2);
    const moved = r.days[1].tasks[0];
    expect(moved.late).toBe(true);
    expect(r.doi).toContainEqual(expect.objectContaining({ item: moved.item, due: '2026-11-23', newDate: '2026-11-24' }));
  });
});

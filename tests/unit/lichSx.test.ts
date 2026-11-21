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

  it('thiếu bán thành phẩm thì xét tiếp vật tư pha chế; thiếu vật tư thì đưa vào Chờ vật tư', () => {
    const inp = base();
    inp.items.find((i) => i.code === 'BTP189')!.ton = 100; // cần 588 lít → thiếu 488 lít → cần 4,88 kg hương (có 100)
    expect(planLichSx(inp).waitMat).toHaveLength(0);
    inp.items.find((i) => i.code === 'HUONG')!.ton = 1;
    const r = planLichSx(inp);
    expect(r.waitMat[0]).toMatchObject({ item: 'NG10', kind: 'DON' });
    expect(r.waitMat[0].lack[0]).toMatchObject({ item: 'HUONG' });
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
});

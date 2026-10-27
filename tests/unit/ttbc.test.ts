import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Trang TikTok bản mới (hub/src/ttbc.js): cơ cấu, số theo tuần, cảnh báo & đề xuất, hiệu quả từng team. Số mẫu = số thật T9/2026. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = new Function(`${readFileSync('hub/src/ttbc.js', 'utf8')}
  return {ttbcLanes,ttbcWeeks,ttbcLast2,ttbcCost,ttbcPri,ttbcAlerts,ttbcTeams,ttbcDuKien};`)();

const KM = { gmv: 1538012277, vInh: 895475505, vKoc: 358365742, the: 260159896, lShop: 23444263, lKoc: 566871 };
const P = {
  dt: 1392110100, gv: 262583910, phi: -415466276, ads: 364658750, lai: 349577164, lg: 714059914, ng2: 0.362, dtUocGv: 78108300,
  fees: [['Hoa hồng sàn', -181702105], ['Phí giao dịch', -70628452], ['Phí khác', 0]],
  sp: [
    { n: 'Tinh dầu giặt sấy', dt: 876923400, lg: 477861929, bien: 0.545, q: 8628 },
    { n: 'Bình xịt muỗi', dt: 220829300, lg: 96348266, bien: 0.436, q: 1900 },
    { n: 'Bình xịt ruồi', dt: 110958049, lg: 50888028, bien: 0.459, q: 750 },
  ],
  g1: [{ pn: 'Bột tẩy vạn năng', dt: 418500, lg: -185000 }],
  g2: [{ pn: 'Bình xịt muỗi lẻ', dt: 36367000, bien: 0.21 }],
  g3: new Array(38).fill({}),
};

describe('ttbc: cơ cấu doanh thu và chi phí', () => {
  it('nguồn GMV: KOC gồm video + live KOC, chi KOC = hoa hồng quyết toán', () => {
    const L = T.ttbcLanes(KM, 34655085, 364658750);
    const koc = L.rows.find((r: { key: string }) => r.key === 'koc');
    expect(koc.gmv).toBe(358365742 + 566871);
    expect(Math.round(koc.cp100 * 1000)).toBe(97);
    expect(L.rows.find((r: { key: string }) => r.key === 'the').cp).toBe(0);
    expect(L.rows.find((r: { key: string }) => r.key === 'vInh').cp).toBe(null);
    expect(Math.round(L.ads100 * 1000)).toBe(237);
  });
  it('cơ cấu chi phí: thiếu Sổ chi phí thì không có lợi nhuận ròng; đủ thì trừ chi riêng và chi chung', () => {
    let C = T.ttbcCost(P, null, null);
    expect(C.ln).toBe(null);
    expect(C.lines[1].t).toBe(415466276);
    expect(C.lines[1].sub).toHaveLength(2);
    expect(C.bar.map((b: { n: string }) => b.n)).toEqual(['Giá vốn', 'Phí sàn', 'Quảng cáo', 'Lãi đóng góp']);
    C = T.ttbcCost(P, [{ n: 'Lương team', t: 52e6 }], [{ n: 'Văn phòng', t: 35e6 }]);
    expect(C.ln).toBe(349577164 - 52e6 - 35e6);
    expect(C.bar.at(-1).n).toBe('Lợi nhuận ròng');
  });
});

describe('ttbc: số theo tuần', () => {
  const days: Record<string, unknown> = {};
  for (let d = 1; d <= 30; d++) {
    const k = `2026-09-${String(d).padStart(2, '0')}`;
    const late = d >= 22 && d <= 28;
    days[k] = { km: { gmv: late ? 100e6 : 60e6, vInh: 30e6, lShop: 1e6 }, ads: { chi: late ? 22e6 : 12e6 } };
  }
  it('khối 7 ngày từ 01, đã cộng VAT quảng cáo', () => {
    const W = T.ttbcWeeks(days, '2026-09', 0.1);
    expect(W.map((w: { a: number; b: number }) => `${w.a}-${w.b}`)).toEqual(['1-7', '8-14', '15-21', '22-28', '29-30']);
    expect(W[0].ads).toBe(Math.round(7 * 12e6 * 1.1));
    const L2 = T.ttbcLast2(W);
    expect(L2[1].a).toBe(22);
    expect(L2[0].a).toBe(15);
  });
});

describe('ttbc: cảnh báo & đề xuất quản trị (số T9)', () => {
  const W = [{ a: 15, b: 21, gmv: 424.8e6, ads: 97.5e6, roas: 4.36 }, { a: 22, b: 28, gmv: 697.8e6, ads: 168.6e6, roas: 4.14 }];
  const A = T.ttbcAlerts({ P, lanes: T.ttbcLanes(KM, 34655085, 364658750), last2: W, live: { phien: 557, phienGmv: 19 }, adsMax: 0.38 });
  const txt = A.canh.map((x: { t: string }) => x.t).join(' | ');
  it('ra đủ cảnh báo từ số thật, việc đỏ lên trước', () => {
    expect(txt).toMatch(/Tinh dầu giặt sấy = 63%/);
    expect(txt).toMatch(/LIVE 557 buổi, chỉ 19/);
    expect(txt).toMatch(/Bột tẩy vạn năng: lỗ/);
    expect(txt).toMatch(/Bình xịt muỗi lẻ: biên 21%/);
    expect(txt).toMatch(/38 mã chưa có giá vốn/);
    expect(txt).toMatch(/Quảng cáo \+72,9%, GMV \+64,3%/);
    expect(A.canh[0].lv).toBe('r');
    expect(A.canh.at(-1).lv).toBe('g');
  });
  it('đề xuất: giữ ngân sách, dồn cho sản phẩm biên cao, mở KOC, đổi live', () => {
    const d = A.de.map((x: { t: string }) => x.t).join(' | ');
    expect(d).toMatch(/Giữ ngân sách/);
    expect(d).toMatch(/Dồn ngân sách cho Tinh dầu giặt sấy/);
    expect(d).toMatch(/Mở thêm KOC/);
    expect(d).toMatch(/Cắt bớt LIVE/);
  });
  it('không có số thì không cảnh báo', () => {
    expect(T.ttbcAlerts({ P: null, lanes: null, last2: null, live: null, adsMax: 0.38 })).toEqual({ canh: [], de: [] });
  });
  it('mức ưu tiên quảng cáo cho team', () => {
    expect(T.ttbcPri(P.sp[0], 0.362, P.dt)).toBe('Đẩy mạnh');
    expect(T.ttbcPri(P.sp[1], 0.362, P.dt)).toBe('Giữ mức');
    expect(T.ttbcPri({ dt: 1e6, lg: -1, bien: -0.1 }, 0.362, P.dt)).toBe('Dừng quảng cáo');
    expect(T.ttbcPri({ dt: 1e6, lg: 1, bien: 0.5 }, 0.362, P.dt)).toBe('Thử thêm');
  });
});

describe('ttbc: hiệu quả từng team (số T9)', () => {
  const R = T.ttbcTeams({
    km: KM, ads: { chi: 331507955, don: 14066 }, adsV: 364658750, dt: P.dt, lgRate: P.lg / P.dt, hoaHong: 34655085,
    live: { phien: 557, phienGmv: 19, gmv: 24e6, don: 386, xem: 1085986 },
    koc: { 'Nhà sáng tạo đã đăng nội dung': 276, Video: 959, 'Video có doanh số': 351, 'GMV nhờ nhà sáng tạo': 527.2e6, 'Hàng mẫu đã vận chuyển': 42 },
    last2: [{ a: 15, b: 21, gmv: 424.8e6, ads: 97.5e6, roas: 4.36, vInh: 252e6 }, { a: 22, b: 28, gmv: 697.8e6, ads: 168.6e6, roas: 4.14, vInh: 477e6 }],
  });
  it('ROI quảng cáo trên doanh thu thực, hòa vốn theo biên lãi gộp', () => {
    expect(R.ads.roi.toFixed(2)).toBe('3.82');
    expect(R.ads.hoaVon.toFixed(2)).toBe('1.95');
    expect(Math.round(R.ads.cpo)).toBe(23568);
    expect(R.ads.st).toBe('Theo dõi');
  });
  it('Booking: KOC lên video, video đăng; GMV KOC theo Key metrics (cùng số trang quản trị), ROI theo hoa hồng quyết toán', () => {
    expect(R.koc.nguoi).toBe(276);
    expect(R.koc.video).toBe(959);
    expect(R.koc.gmv).toBe(358365742 + 566871);
    expect(R.koc.roi.toFixed(1)).toBe('10.4');
    expect(R.koc.hhNguon).toBe('quyết toán');
  });
  it('Live kém, Content tốt; việc tuần này lấy việc đỏ trước', () => {
    expect(R.live.st).toBe('Kém');
    expect(R.content.st).toBe('Tốt');
    expect(R.todo[0].team).toBe('Live');
    expect(R.todo.length).toBeLessThanOrEqual(3);
  });
});

describe('ttbc: doanh thu dự kiến tháng chưa đủ số', () => {
  const closed = [{ dt: 900e6, hoanGiao: 100e6, den: null }, { dt: 500e6, hoanGiao: null, den: null }, { dt: 300e6, hoanGiao: 50e6, den: '2026-10-20' }];
  it('trừ phần chưa quyết toán theo tỷ lệ hoàn sau giao của tháng đủ số', () => {
    const R = T.ttbcDuKien({ dt: 400e6, dtUoc: 100e6, den: '2026-10-26' }, closed);
    expect(R.rate).toBe(0.1);
    expect(R.n).toBe(1);
    expect(R.dk).toBe(390e6);
  });
  it('chưa có tháng đủ số thì không đoán; tháng đủ số thì dự kiến = số thật', () => {
    expect(T.ttbcDuKien({ dt: 400e6, dtUoc: 100e6, den: '2026-10-26' }, []).dk).toBe(null);
    expect(T.ttbcDuKien({ dt: 400e6, dtUoc: 0, den: null }, closed).dk).toBe(400e6);
  });
});

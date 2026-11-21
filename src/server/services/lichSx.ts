/**
 * LỊCH SẢN XUẤT ĐỀ XUẤT 3 NGÀY (chị Hoa yêu cầu 21/11/2026, theo SOP "Đề xuất SOP Điều phối sản xuất").
 * Web xếp việc theo thứ tự: ① hạn giao đơn · ② lệnh sản xuất đang mở · ③ hàng sắp hết (dưới 7 ngày bán, làm đủ 21 ngày) ·
 * kiểm đủ vật tư theo định mức (thiếu bán thành phẩm thì xét tiếp vật tư pha chế) · không quá sức xưởng (chừa % dự phòng).
 * Chỉ tính và trả về đề xuất; không ghi gì. Quản đốc chốt thì trang web mới tạo lệnh sản xuất.
 */
import { vnDate } from '@shared/datetime';
import { unpack } from '../lib/pack';
import { khoTonRows } from './khoTon';

export type LichKind = 'DON' | 'LENH' | 'TON';
export interface LichTask {
  key: string;
  item: string;
  name: string;
  unit: string;
  qty: number;
  hours: number;
  hoursEst: boolean;
  due: string;
  kind: LichKind;
  reason: string;
  refs: string[];
  lack: Array<{ item: string; name: string; need: number; have: number }>;
  noBom: boolean;
  late: boolean;
  part?: string;
}
export interface LichDay { date: string; cap: number; used: number; tasks: LichTask[] }
export interface LichResult {
  today: string;
  cfg: LichCfg;
  days: LichDay[];
  waitMat: LichTask[];
  overflow: LichTask[];
}
export interface LichCfg { cong: number; duPhong: number; minDays: number; targetDays: number; gioMacDinh: number }
export const LICH_CFG_DEFAULT: LichCfg = { cong: 64, duPhong: 30, minDays: 7, targetDays: 21, gioMacDinh: 4 };

export interface LichInput {
  today: string;
  items: Array<{ code: string; name: string; unit: string; cls: string; ton: number }>;
  ban: Record<string, number>;
  orders: Array<{ order_no: string; customer: string; kenh: string; ship: string; item: string; qty: number }>;
  reqs: Array<{ id: string; sp: string; sl: number; han: string; st: string }>;
  bom: Array<{ product: string; item: string; qty: number }>;
  rate: Record<string, number>;
  cfg?: Partial<LichCfg>;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
export function addDays(d: string, n: number): string {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
/** 3 ngày làm việc kế tiếp (bỏ Chủ nhật), bắt đầu từ ngày mai. */
export function workDays(today: string, n = 3): string[] {
  const out: string[] = [];
  let d = today;
  while (out.length < n) {
    d = addDays(d, 1);
    if (new Date(d + 'T00:00:00Z').getUTCDay() !== 0) out.push(d);
  }
  return out;
}
const dd = (d: string) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '');

export function planLichSx(inp: LichInput): LichResult {
  const cfg: LichCfg = { ...LICH_CFG_DEFAULT, ...(inp.cfg || {}) };
  const today = inp.today;
  const days = workDays(today);
  const item = new Map(inp.items.map((i) => [i.code, i]));
  const bom = new Map<string, Array<{ item: string; qty: number }>>();
  for (const b of inp.bom) {
    if (!(b.qty > 0)) continue;
    const a = bom.get(b.product) || [];
    a.push({ item: b.item, qty: b.qty });
    bom.set(b.product, a);
  }
  const nm = (c: string) => item.get(c)?.name || c;
  const un = (c: string) => item.get(c)?.unit || '';
  const mk = (code: string, kind: LichKind, qty: number, due: string, reason: string, refs: string[]): LichTask => ({
    key: kind + ':' + code + ':' + refs.join(','),
    item: code, name: nm(code), unit: un(code), qty: Math.ceil(qty), hours: 0, hoursEst: false,
    due, kind, reason, refs, lack: [], noBom: !bom.has(code), late: false,
  });

  const tasks: LichTask[] = [];
  const codes = new Set<string>([
    ...inp.reqs.map((r) => r.sp),
    ...inp.orders.map((o) => o.item),
    ...inp.items.filter((i) => !['NVL', 'CCDC', 'BTP', 'HH'].includes(i.cls) && bom.has(i.code)).map((i) => i.code),
  ]);
  for (const code of codes) {
    const it = item.get(code);
    if (it && it.cls === 'HH') continue; // hàng mua ngoài: không sản xuất
    const onHand = Math.max(0, it?.ton ?? 0);
    // ② Lệnh sản xuất đang mở
    const reqs = inp.reqs.filter((r) => r.sp === code && r.sl > 0);
    let supply = 0;
    for (const r of reqs) {
      supply += r.sl;
      tasks.push(mk(code, 'LENH', r.sl, r.han || '', `Lệnh ${r.id}${r.han ? ' · hạn ' + dd(r.han) : ''}`, [r.id]));
    }
    // ① Đơn chờ xuất: phần thiếu so với tồn + lệnh đang mở
    const ords = inp.orders.filter((o) => o.item === code).sort((a, b) => (a.ship < b.ship ? -1 : a.ship > b.ship ? 1 : 0));
    let cum = 0;
    let short = 0;
    let firstDue = '';
    const refs: string[] = [];
    const avail = onHand + supply;
    for (const o of ords) {
      cum += o.qty;
      const s = Math.max(0, cum - avail) - short;
      if (s > 0) {
        short += s;
        if (!firstDue) firstDue = o.ship || today;
        refs.push(o.order_no);
      }
    }
    if (short > 0) {
      const o0 = ords.find((o) => o.order_no === refs[0])!;
      tasks.push(mk(code, 'DON', short, firstDue, `${o0.kenh === 'GIA_CONG' ? 'Đơn OEM' : 'Đơn phân phối'} ${o0.customer} · giao ${dd(firstDue)}${refs.length > 1 ? ` (+${refs.length - 1} đơn)` : ''}`, refs));
    }
    // ③ Bổ sung tồn theo tốc độ bán
    const b = inp.ban[code] || 0;
    if (b > 0 && bom.has(code)) {
      const projected = Math.max(0, avail + short - cum);
      const cover = projected / b;
      if (cover < cfg.minDays) {
        const q = Math.ceil(cfg.targetDays * b - projected);
        if (q > 0) tasks.push(mk(code, 'TON', q, addDays(today, Math.floor(cover)), `Tồn còn ${r2(cover).toLocaleString('vi-VN')} ngày bán · bán ${Math.round(b)}/ngày`, []));
      }
    }
  }
  const kindOrd: Record<LichKind, number> = { DON: 0, LENH: 1, TON: 2 };
  const btp = (c: string) => (bom.get(c) || []).map((x) => x.item).find((x) => item.get(x)?.cls === 'BTP') || '';
  // Đúng SOP: đơn có hạn giao trước, rồi lệnh đang mở, rồi hàng sắp hết; cùng nhóm thì hạn sớm trước, cùng hạn thì gom cùng bán thành phẩm (cùng bồn).
  tasks.sort((a, b) => kindOrd[a.kind] - kindOrd[b.kind] || (a.due < b.due ? -1 : a.due > b.due ? 1 : btp(a.item).localeCompare(btp(b.item))));

  // Kiểm vật tư theo thứ tự ưu tiên: việc trước giữ vật tư trước.
  const stock = new Map(inp.items.map((i) => [i.code, Math.max(0, i.ton)]));
  const need = (code: string, qty: number, st: Map<string, number>, lack: LichTask['lack'], depth: number) => {
    for (const c of bom.get(code) || []) {
      const req = qty * c.qty;
      const have = st.get(c.item) || 0;
      const take = Math.min(have, req);
      st.set(c.item, have - take);
      const sh = req - take;
      if (sh > 1e-6) {
        if (bom.has(c.item) && depth < 3) need(c.item, sh, st, lack, depth + 1);
        else lack.push({ item: c.item, name: nm(c.item), need: r2(req), have: r2(have) });
      }
    }
  };
  const ready: LichTask[] = [];
  const waitMat: LichTask[] = [];
  for (const t of tasks) {
    if (t.noBom) { ready.push(t); continue; }
    const st = new Map(stock);
    const lack: LichTask['lack'] = [];
    need(t.item, t.qty, st, lack, 0);
    if (lack.length) { t.lack = lack; waitMat.push(t); continue; }
    for (const [k, v] of st) stock.set(k, v);
    ready.push(t);
  }

  // Xếp vào 3 ngày theo sức xưởng; việc lớn được chia sang ngày sau.
  const cap = r2(cfg.cong * (1 - cfg.duPhong / 100));
  const out: LichDay[] = days.map((date) => ({ date, cap, used: 0, tasks: [] }));
  const overflow: LichTask[] = [];
  for (const t of ready) {
    const rate = inp.rate[t.item];
    const perUnit = rate > 0 ? 1 / rate : 0;
    let left = t.qty;
    let hoursLeft = perUnit ? t.qty * perUnit : cfg.gioMacDinh;
    const est = !perUnit;
    const parts: LichTask[] = [];
    for (const d of out) {
      if (left <= 0) break;
      const room = r2(d.cap - d.used);
      if (room <= 0.05) continue;
      if (hoursLeft <= room) {
        const p = { ...t, qty: left, hours: r2(hoursLeft), hoursEst: est, late: !!t.due && t.kind !== 'TON' && d.date > t.due };
        d.tasks.push(p); d.used = r2(d.used + hoursLeft); parts.push(p); left = 0; hoursLeft = 0;
      } else {
        const q = perUnit ? Math.floor(room / perUnit) : Math.floor((left * room) / hoursLeft);
        if (q <= 0) continue;
        const h = perUnit ? q * perUnit : (hoursLeft * q) / left;
        const p = { ...t, qty: q, hours: r2(h), hoursEst: est, late: !!t.due && t.kind !== 'TON' && d.date > t.due };
        d.tasks.push(p); d.used = r2(d.used + h); parts.push(p); left -= q; hoursLeft = r2(hoursLeft - h);
      }
    }
    if (parts.length > 1) parts.forEach((p, i) => { p.part = `phần ${i + 1}/${parts.length + (left > 0 ? 1 : 0)}`; });
    if (left > 0) overflow.push({ ...t, qty: left, hours: r2(hoursLeft), hoursEst: est });
  }
  return { today, cfg, days: out, waitMat, overflow };
}

/** Gom dữ liệu thật rồi gọi planLichSx. */
export async function loadLichSx(db: D1Database): Promise<LichResult> {
  const today = vnDate();
  const from14 = addDays(today, -13);
  const [rows, banR, ordR, bomR, sxRow] = await Promise.all([
    khoTonRows(db),
    db.prepare("SELECT item, -SUM(qty) AS q FROM kho_ledger WHERE qty < 0 AND doc_type IN ('ONLINE','B2B') AND doc_date >= ? AND doc_date <= ? GROUP BY item")
      .bind(from14, today).all<{ item: string; q: number }>(),
    db.prepare(
      `SELECT o.order_no, c.name AS customer,
              CASE WHEN c.price_mode = 'CUSTOM' AND c.tier_id IS NULL THEN 'GIA_CONG' ELSE 'B2B' END AS kenh,
              COALESCE(o.ship_date, o.need_date, substr(o.approved_at, 1, 10), o.order_date) AS ship,
              km.misa_code AS item, SUM(oi.qty * km.factor) AS qty
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       JOIN kho_map km ON km.crm_sku = p.sku
       WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
         AND ((o.flow_on = 1 AND o.kho_status = 'CHO_XUAT') OR (o.flow_on = 0 AND o.delivery_status = 'CHUA_XUAT'))
       GROUP BY o.id, km.misa_code`,
    ).all<{ order_no: string; customer: string; kenh: string; ship: string; item: string; qty: number }>(),
    db.prepare('SELECT product, item, qty FROM kho_bom').all<{ product: string; item: string; qty: number }>(),
    db.prepare("SELECT data FROM hub_state WHERE id = 'sx'").first<{ data: string }>(),
  ]);
  type Lot = { req?: string; st?: string; dat?: number; baoSL?: number };
  type Nk = { sp?: string; nguoi?: number; tu?: string; den?: string; sl?: number };
  let sx: { requests?: Array<{ id: string; sp: string; sl: number | null; han?: string; st: string }>; batches?: Lot[]; nk?: Nk[]; cfg?: { lich?: Partial<LichCfg> } } = {};
  try { if (sxRow) sx = JSON.parse(await unpack(sxRow.data)); } catch { sx = {}; }
  const lots = sx.batches || [];
  const reqs = (sx.requests || [])
    .filter((r) => r.st === 'CAN_LAM' || r.st === 'DANG_LAM')
    .map((r) => {
      const made = lots.filter((b) => b.req === r.id && b.st !== 'HUY').reduce((t, b) => t + (Number(b.dat) || Number(b.baoSL) || 0), 0);
      return { id: r.id, sp: r.sp, sl: Math.max(0, (Number(r.sl) || 0) - made), han: r.han || '', st: r.st };
    });
  // Định mức năng suất: tổng sản lượng ÷ tổng giờ công từ báo cáo sản lượng (trang Điều phối sản xuất).
  const hh = (t?: string) => { const m = String(t || '').trim().match(/^(\d{1,2})(?:[:hH.](\d{0,2}))?$/); return m ? +m[1] + +(m[2] || 0) / 60 : NaN; };
  const agg: Record<string, { c: number; q: number }> = {};
  for (const r of sx.nk || []) {
    if (!r.sp || r.sp === '__khac') continue;
    const h = hh(r.den) - hh(r.tu);
    const c = (Number(r.nguoi) || 0) * (h > 0 ? h : 0);
    if (!(c > 0 && Number(r.sl) > 0)) continue;
    const a = (agg[r.sp] ||= { c: 0, q: 0 });
    a.c += c; a.q += Number(r.sl);
  }
  const rate: Record<string, number> = {};
  for (const [k, a] of Object.entries(agg)) rate[k] = a.q / a.c;
  const ban: Record<string, number> = {};
  for (const b of banR.results) ban[b.item] = (Number(b.q) || 0) / 14;
  return planLichSx({
    today,
    items: rows.map((r) => ({ code: r.code, name: r.name, unit: r.unit, cls: r.cls, ton: r.ton })),
    ban,
    orders: ordR.results.map((o) => ({ ...o, ship: String(o.ship || '').slice(0, 10), qty: Number(o.qty) || 0 })),
    reqs,
    bom: bomR.results.map((b) => ({ ...b, qty: Number(b.qty) || 0 })),
    rate,
    cfg: sx.cfg?.lich,
  });
}

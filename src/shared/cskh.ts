/**
 * CSKH khách lẻ (chị Hoa duyệt demo 10/11/2026): phần tính toán dùng chung, không đụng cơ sở dữ liệu (để kiểm thử).
 * - Khách gom theo số điện thoại chuẩn 0xxxxxxxxx.
 * - Đọc đơn Poscake (cửa hàng Facebook) ra thông tin khách + sản phẩm.
 * - Trạng thái gọi: quá hạn / hôm nay / khách mới / đến kỳ mua lại / chưa tới hạn.
 * - Doanh thu bán thêm: đơn giao thành công của khách trong 7 ngày sau cuộc gọi "Đã chốt đơn" của CSKH đó,
 *   hoặc đơn CSKH tạo trên web (khớp mã Poscake). Không nhập tay.
 */

export const CSKH_RESULTS = ['Đã chốt đơn', 'Không nghe máy', 'Hẹn gọi lại', 'Kết nối Zalo', 'Khách từ chối', 'Sai số / thuê bao'] as const;
export type CskhResult = (typeof CSKH_RESULTS)[number];
export const CSKH_REASONS = ['Còn hàng, chưa dùng hết', 'Giá cao hơn chỗ khác', 'Không hài lòng sản phẩm', 'Không có nhu cầu', 'Khác'];
/** Số ngày sau cuộc gọi chốt đơn mà đơn giao thành công vẫn tính cho CSKH đó. */
export const UPSELL_DAYS = 7;

export interface CskhSettings {
  chia: 'auto' | 'tay';
  khachCu: 'cu' | 'moi'; // khách từng có người chăm: trả về người cũ / chia như khách mới
  staffOff: string[]; // CSKH đang tạm không nhận khách (nghỉ phép)
  fromDate: string; // lấy đơn giao thành công từ ngày
  vipOrders: number;
  firstCallDays: number; // gọi khách mới sau khi giao (ngày)
  kpi: number; // chỉ tiêu bán thêm / tháng (cả nhóm)
  cycles: Record<string, number>; // tên sản phẩm → số ngày dùng hết
  defaultCycle: number;
}
export const CSKH_DEFAULTS: CskhSettings = {
  chia: 'tay', // mặc định Lead Sale chia tay, Lead bật Web tự chia ở Cài đặt khi đã đủ người (10/11)
  khachCu: 'cu',
  staffOff: [],
  fromDate: '',
  vipOrders: 2,
  firstCallDays: 3,
  kpi: 0,
  cycles: {},
  defaultCycle: 30,
};

export function mergeSettings(raw: Partial<CskhSettings> | null | undefined): CskhSettings {
  const s = { ...CSKH_DEFAULTS, ...(raw ?? {}) };
  s.chia = s.chia === 'auto' ? 'auto' : 'tay';
  s.khachCu = s.khachCu === 'moi' ? 'moi' : 'cu';
  s.staffOff = Array.isArray(s.staffOff) ? s.staffOff.map(String) : [];
  s.fromDate = isDay(s.fromDate) ? s.fromDate : '';
  s.vipOrders = clampInt(s.vipOrders, 1, 50, 2);
  s.firstCallDays = clampInt(s.firstCallDays, 0, 60, 3);
  s.kpi = Math.max(0, Number(s.kpi) || 0);
  s.defaultCycle = clampInt(s.defaultCycle, 1, 365, 30);
  const cyc: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.cycles && typeof s.cycles === 'object' ? s.cycles : {})) {
    const n = Number(v);
    if (k.trim() && Number.isFinite(n) && n > 0) cyc[k.trim()] = Math.min(365, Math.round(n));
  }
  s.cycles = cyc;
  return s;
}
function clampInt(v: unknown, lo: number, hi: number, d: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
}
export const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Số điện thoại chuẩn 0xxxxxxxxx (10 số; số bàn / số cũ 11 số vẫn giữ). Không hợp lệ thì ''. */
export function normPhone(v: unknown): string {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2);
  if (!d.startsWith('0') && d.length === 9) d = '0' + d;
  return /^0\d{9,10}$/.test(d) ? d : '';
}

export function addDays(day: string, n: number): string {
  const t = Date.parse(day + 'T00:00:00Z') + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86_400_000);
}
/** Ngày giờ Việt Nam (YYYY-MM-DD) của một mốc thời gian Poscake (không có múi giờ = giờ UTC). */
export function vnDayOf(s: unknown): string {
  const str = String(s ?? '').trim();
  if (!str) return '';
  const t = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(str) ? str : str + 'Z');
  return Number.isFinite(t) ? new Date(t + 7 * 3_600_000).toISOString().slice(0, 10) : '';
}

/* ------------------------------------------------------------------ đọc đơn Poscake */
export interface CskhOrderItem {
  n: string;
  q: number;
  p: number; // thành tiền
}
export interface ParsedOrder {
  id: string;
  phone: string;
  name: string;
  street: string;
  ward: string;
  district: string;
  province: string;
  day: string; // ngày giao thành công
  createdDay: string;
  items: CskhOrderItem[];
  total: number;
  source: string;
}
type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Trạng thái Poscake: 3 = đã nhận (giao thành công). */
export const POS_DELIVERED = 3;

export function parsePosOrder(raw: unknown, srcNames: Record<string, string> = {}): ParsedOrder | null {
  const r = o(raw);
  const id = s(r.id ?? r.system_id ?? r.custom_id);
  if (!id) return null;
  const sh = o(r.shipping_address);
  const cus = o(r.customer);
  const phones = Array.isArray(cus.phone_numbers) ? cus.phone_numbers : [];
  const phone = normPhone(sh.phone_number) || normPhone(r.bill_phone_number) || normPhone(phones[0]);
  if (!phone) return null;
  const name = s(sh.full_name) || s(r.bill_full_name) || s(cus.name);
  let day = '';
  for (const h of Array.isArray(r.status_history) ? r.status_history : []) {
    const hh = o(h);
    if (n(hh.status) === POS_DELIVERED && hh.updated_at) {
      const d = vnDayOf(hh.updated_at);
      if (d && d > day) day = d;
    }
  }
  if (!day) day = vnDayOf(r.updated_at) || vnDayOf(r.inserted_at);
  const items: CskhOrderItem[] = [];
  for (const it of Array.isArray(r.items) ? r.items : []) {
    const x = o(it);
    const v = o(x.variation_info);
    const nm = s(v.name) || s(x.name);
    if (!nm) continue;
    const q = n(x.quantity) || 1;
    const price = n(v.retail_price) || n(x.retail_price) || n(x.price);
    items.push({ n: nm, q, p: Math.max(0, price * q - n(x.total_discount) - n(x.discount_each_product) * q) });
  }
  const total = n(r.total_price_after_sub_discount) || n(r.total_price) || items.reduce((a, b) => a + b.p, 0);
  const acc = s(r.account);
  const pageName = s(o(r.page).name);
  const source = pageName ? 'Page ' + pageName : acc && srcNames[acc] ? 'Landing ' + srcNames[acc] : acc ? 'Nguồn ' + acc : '';
  return {
    id,
    phone,
    name,
    street: s(sh.address),
    ward: s(sh.commune_name),
    district: s(sh.district_name),
    province: s(sh.province_name),
    day,
    createdDay: vnDayOf(r.inserted_at),
    items,
    total,
    source,
  };
}

/* ------------------------------------------------------------------ trạng thái gọi */
export type CallState = 'qua' | 'nay' | 'moi' | 'ky' | 'cho' | 'chua';
export interface CallInput {
  owner_id: string | null;
  next_call: string | null;
  last_call: string | null;
  last_order_day: string | null;
  last_product: string;
  order_count: number;
}
export function cycleOf(set: CskhSettings, product: string): number {
  return set.cycles[product] ?? set.defaultCycle;
}
/**
 * moi: khách đã chia, chưa gọi lần nào, đơn mới giao (14 ngày), tới ngày gọi lần đầu; qua: hẹn gọi đã qua; nay: hẹn hôm nay;
 * ky: chưa có hẹn mà đã tới kỳ dùng hết sản phẩm (trong 10 ngày gần đây); cho: còn lại; chua: chưa chia.
 */
export function callState(c: CallInput, today: string, set: CskhSettings): CallState {
  if (!c.owner_id) return 'chua';
  if (!c.last_call && c.last_order_day && diffDays(today, c.last_order_day) <= 14 && (!c.next_call || c.next_call <= today)) return 'moi';
  if (c.next_call) {
    if (c.next_call < today) return 'qua';
    if (c.next_call === today) return 'nay';
    return 'cho';
  }
  if (c.last_order_day) {
    const due = addDays(c.last_order_day, cycleOf(set, c.last_product) - 3);
    if (due <= today && diffDays(today, due) <= 10 && (!c.last_call || c.last_call < due)) return 'ky';
  }
  return 'cho';
}

/** Hạng khách. */
export function tier(orderCount: number, set: CskhSettings): 'VIP' | 'Mua 1 lần' | 'Chưa mua' {
  return orderCount >= set.vipOrders ? 'VIP' : orderCount >= 1 ? 'Mua 1 lần' : 'Chưa mua';
}

/** Sinh nhật (dd/mm) rơi vào [-3, +7] ngày quanh hôm nay. */
export function birthdaySoon(bd: string, today: string): boolean {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(bd.trim());
  if (!m) return false;
  const y = Number(today.slice(0, 4));
  for (const yy of [y - 1, y, y + 1]) {
    const d = `${yy}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (!isDay(d)) continue;
    const x = diffDays(d, today);
    if (x >= -3 && x <= 7) return true;
  }
  return false;
}
export function normBirthday(v: unknown): string {
  const m = /^\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})/.exec(String(v ?? ''));
  if (!m) return '';
  const d = Number(m[1]);
  const mo = Number(m[2]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return '';
  return `${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ chia khách xoay vòng */
/** Chọn người nhận cho từng khách mới: khách cũ về người cũ (nếu còn nhận khách), còn lại xoay vòng đều, bắt đầu từ người đang ít khách mới nhất. */
export function pickOwners(
  list: Array<{ phone: string; prev: string | null }>,
  staff: string[],
  set: CskhSettings,
  load: Record<string, number> = {},
): Record<string, string> {
  const on = staff.filter((x) => !set.staffOff.includes(x));
  const out: Record<string, string> = {};
  if (!on.length) return out;
  const cnt: Record<string, number> = {};
  for (const x of on) cnt[x] = load[x] ?? 0;
  for (const c of list) {
    if (set.khachCu === 'cu' && c.prev && on.includes(c.prev)) {
      out[c.phone] = c.prev;
      cnt[c.prev] += 1;
      continue;
    }
    const best = on.reduce((a, b) => (cnt[b] < cnt[a] ? b : a), on[0]);
    out[c.phone] = best;
    cnt[best] += 1;
  }
  return out;
}

/* ------------------------------------------------------------------ doanh thu bán thêm */
export interface UpsellLog {
  phone: string;
  by_id: string;
  day: string;
}
export interface UpsellOrder {
  id: string;
  phone: string;
  created_day: string;
  day: string;
  total: number;
}
/**
 * Gán đơn giao thành công cho CSKH: đơn CSKH tạo trên web (theo mã Poscake) thuộc người tạo;
 * đơn khác thuộc người có cuộc gọi "Đã chốt đơn" gần nhất trong 7 ngày trước ngày tạo đơn.
 */
export function attributeOrders(orders: UpsellOrder[], closeLogs: UpsellLog[], webByPos: Record<string, string>): Map<string, string> {
  const byPhone = new Map<string, UpsellLog[]>();
  for (const l of closeLogs) {
    const a = byPhone.get(l.phone) ?? [];
    a.push(l);
    byPhone.set(l.phone, a);
  }
  const out = new Map<string, string>();
  for (const od of orders) {
    if (webByPos[od.id]) {
      out.set(od.id, webByPos[od.id]);
      continue;
    }
    const ref = od.created_day || od.day;
    let best: UpsellLog | null = null;
    for (const l of byPhone.get(od.phone) ?? []) {
      const gap = diffDays(ref, l.day);
      if (gap < 0 || gap > UPSELL_DAYS) continue;
      if (!best || l.day > best.day) best = l;
    }
    if (best) out.set(od.id, best.by_id);
  }
  return out;
}

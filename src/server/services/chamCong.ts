/**
 * Chấm công trên điện thoại (chị Hoa duyệt 04/11/2026): nhân viên bấm Chấm vào / Chấm ra trên vanhanh,
 * máy chủ ghi giờ theo đồng hồ máy chủ (không tin giờ điện thoại) và khoảng cách tới điểm chấm gần nhất.
 * File này chỉ có hàm thuần (khoảng cách, giờ Việt Nam, đi muộn / về sớm, chuyên cần) để kiểm thử được; đọc ghi ở routes/chamCong.ts.
 * Mọi giờ giấc và quy tắc (lịch làm, nghỉ trưa, ca, mốc đi muộn, chuyên cần) là ô điền ở Nhân sự › Cài đặt chấm công
 * (CEO 04/11: không cố định trong code). Giá trị mặc định lấy theo thông báo 01102026/TB-AILLA. Chưa đổ vào bảng lương.
 */

export const CC_SETTINGS_KEY = 'cc_caidat';

/** ip: mạng wifi của điểm (IPv4 đủ, IPv6 lấy 4 nhóm đầu): máy tính không có GPS, chấm từ mạng này coi như ở điểm. */
export type Diem = { id: string; ten: string; lat: number; lng: number; bk: number; ip: string[] };

/** Khóa so mạng: IPv4 giữ nguyên; IPv6 lấy 4 nhóm đầu (cùng một modem, mỗi máy một đuôi khác nhau). */
export function ipKey(ip: unknown): string {
  const s = String(ip ?? '').trim().toLowerCase();
  if (!s) return '';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return s;
  if (!s.includes(':') || !/^[0-9a-f:]+$/.test(s)) return '';
  const [a, b = ''] = s.split('::');
  const head = a ? a.split(':') : [];
  const tail = s.includes('::') ? (b ? b.split(':') : []) : [];
  const full = s.includes('::') ? [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail] : head;
  if (full.length !== 8) return '';
  return full.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

/** Điểm (trong các điểm của lịch) có mạng wifi khớp với mạng người đang chấm. */
export function diemByIp(s: CcSettings, ip: string, l?: Lich): Diem | null {
  if (!ip) return null;
  const pts = l && l.diem.length ? s.diem.filter((d) => l.diem.includes(d.id)) : s.diem;
  return pts.find((d) => d.ip.includes(ip)) ?? null;
}
/**
 * Lịch làm của một nhóm người. kieu: 'codinh' giờ cố định; 'ca' làm theo ca được xếp (Nhân sự › Xếp ca);
 * 'tudo' giờ linh hoạt (chỉ ghi giờ vào ra).
 * thuBay: 'ca' làm cả ngày, 'nua' làm buổi sáng (ra theo gioRaT7), 'nghi' nghỉ hết,
 * 'nghi13' nghỉ thứ Bảy thứ 1 và thứ 3 của tháng, 'nghi24' nghỉ thứ Bảy thứ 2 và thứ 4. Chủ nhật nghỉ (trừ ngày được xếp ca).
 * truaTu / truaDen: giờ nghỉ trưa, không cần chấm, không tính vào giờ làm ('' = không nghỉ trưa).
 * diem: các điểm chấm của lịch này (văn phòng, xưởng khác nhau); rỗng = mọi điểm.
 * ngoaiOk: được chấm ngoài phạm vi khi ghi lý do (CEO 04/11: chỉ Sale); lịch khác ngoài phạm vi là không chấm được.
 */
export type ThuBay = 'ca' | 'nua' | 'nghi' | 'nghi13' | 'nghi24';
export type Lich = {
  id: string;
  ten: string;
  kieu: 'codinh' | 'ca' | 'tudo';
  gioVao: string;
  gioRa: string;
  truaTu: string;
  truaDen: string;
  anHan: number;
  thuBay: ThuBay;
  gioRaT7: string;
  chuyenCan: boolean;
  diem: string[];
  ngoaiOk: boolean;
  /**
   * Quy định đổi theo thời gian (CEO 04/11: văn phòng trước vào 8:30 và làm mọi thứ Bảy; từ khi vào 8:00 mới nghỉ 2 thứ Bảy).
   * tuNgay: ngày bắt đầu áp dụng giờ hiện tại; ngày trước đó dùng giờ trong cu. '' = không có lịch cũ.
   */
  tuNgay: string;
  cu: LichCu | null;
};
export type LichCu = { gioVao: string; gioRa: string; truaTu: string; truaDen: string; anHan: number; thuBay: ThuBay; gioRaT7: string };
/** Một ca làm (team live…): giờ bắt đầu, giờ kết thúc trong cùng một ngày. */
export type Ca = { id: string; ten: string; tu: string; den: string };
/**
 * Quy tắc tính công dùng chung. mocLyDo: muộn quá số phút này thì hỏi lý do (không ghi thì cảnh báo);
 * mocNang: mốc "muộn nặng" đếm riêng (thông báo 01102026: 10 phút); ccLan / ccNghi: tối đa số lần muộn + về sớm,
 * số ngày nghỉ trong tháng để giữ chuyên cần; tienCC, tienTrua: số tiền để hiện trên bảng (chưa trừ vào lương);
 * mocVong2: đơn nghỉ từ số ngày này phải HCNS duyệt vòng 2; tuMax: tạm ứng mỗi lần phải dưới số tiền này.
 */
export type QuyTac = { mocLyDo: number; mocNang: number; ccLan: number; ccNghi: number; tienCC: number; tienTrua: number; mocVong2: number; tuMax: number };
/** pbLich: lịch theo phòng ban; nguoiLich: lịch riêng từng người (mã đăng nhập), ưu tiên hơn phòng ban; macDinh: còn lại. */
export type CcSettings = {
  diem: Diem[];
  lich: Lich[];
  ca: Ca[];
  quyTac: QuyTac;
  /** Ngày lễ, tết công ty cho nghỉ: không tính là ngày phải làm (trừ người được xếp ca ngày đó). */
  ngayLe: { ngay: string; ten: string }[];
  pbLich: Record<string, string>;
  nguoiLich: Record<string, string>;
  macDinh: string;
};

const BASE = { anHan: 5, gioRaT7: '12:00', diem: [] as string[] };
/** Mặc định theo thông báo 01102026/TB-AILLA và lời CEO 04/11; CEO / HCNS sửa ở trang cài đặt. */
export const CC_DEFAULT: CcSettings = {
  diem: [],
  lich: [
    { ...BASE, id: 'vp', ten: 'Văn phòng', kieu: 'codinh', gioVao: '08:00', gioRa: '17:30', truaTu: '12:00', truaDen: '13:30', thuBay: 'nghi24', chuyenCan: true, ngoaiOk: false,
      tuNgay: '2026-10-01', cu: { gioVao: '08:30', gioRa: '17:30', truaTu: '12:00', truaDen: '13:30', anHan: 5, thuBay: 'nua', gioRaT7: '12:00' } },
    { ...BASE, id: 'xuong', ten: 'Xưởng', kieu: 'codinh', gioVao: '08:00', gioRa: '17:00', truaTu: '12:00', truaDen: '13:00', thuBay: 'ca', chuyenCan: false, ngoaiOk: false, tuNgay: '', cu: null },
    { ...BASE, id: 'live', ten: 'Live (theo ca)', kieu: 'ca', gioVao: '08:00', gioRa: '17:30', truaTu: '', truaDen: '', thuBay: 'ca', chuyenCan: false, ngoaiOk: false, tuNgay: '', cu: null },
    { ...BASE, id: 'sale', ten: 'Sale (giờ linh hoạt)', kieu: 'tudo', gioVao: '08:00', gioRa: '17:30', truaTu: '', truaDen: '', thuBay: 'ca', chuyenCan: false, ngoaiOk: true, tuNgay: '', cu: null },
  ],
  ca: [],
  ngayLe: [],
  quyTac: { mocLyDo: 10, mocNang: 10, ccLan: 2, ccNghi: 2, tienCC: 200000, tienTrua: 25000, mocVong2: 3, tuMax: 3000000 },
  pbLich: { SX: 'xuong', KV: 'xuong', B2B: 'sale', B2C: 'sale' },
  nguoiLich: {},
  macDinh: 'vp',
};

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const THU_BAY: ThuBay[] = ['ca', 'nua', 'nghi', 'nghi13', 'nghi24'];
const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return v !== '' && v != null && Number.isFinite(n) && n >= lo && n <= hi ? n : d;
};
const hm = (v: unknown, def: string) => (typeof v === 'string' && HM.test(v) ? v : def);
const hmOrEmpty = (v: unknown, def: string) => (v === '' ? '' : hm(v, def));

function normLich(x: unknown, i: number): Lich {
  const o = (x ?? {}) as Record<string, unknown>;
  const d = CC_DEFAULT.lich.find((l) => l.id === o.id) ?? CC_DEFAULT.lich[0];
  return {
    id: String(o.id || 'l' + (i + 1)).slice(0, 40),
    ten: String(o.ten || 'Lịch ' + (i + 1)).slice(0, 80),
    kieu: o.kieu === 'ca' || o.kieu === 'tudo' || o.kieu === 'codinh' ? o.kieu : d.kieu,
    gioVao: hm(o.gioVao, d.gioVao),
    gioRa: hm(o.gioRa, d.gioRa),
    truaTu: hmOrEmpty(o.truaTu, d.truaTu),
    truaDen: hmOrEmpty(o.truaDen, d.truaDen),
    anHan: Math.round(num(o.anHan, 0, 120, d.anHan)),
    thuBay: THU_BAY.includes(o.thuBay as ThuBay) ? (o.thuBay as ThuBay) : d.thuBay,
    gioRaT7: hm(o.gioRaT7, d.gioRaT7),
    chuyenCan: typeof o.chuyenCan === 'boolean' ? o.chuyenCan : d.chuyenCan,
    diem: Array.isArray(o.diem) ? o.diem.map(String).slice(0, 10) : [],
    ngoaiOk: typeof o.ngoaiOk === 'boolean' ? o.ngoaiOk : o.kieu === 'tudo',
    ...normCu(o, d),
  };
}

const NGAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Lịch cũ trước ngày áp dụng; lịch chưa từng lưu phần này thì lấy mặc định (văn phòng: 8:30, làm thứ Bảy buổi sáng, đến 30/9/2026). */
function normCu(o: Record<string, unknown>, d: Lich): { tuNgay: string; cu: LichCu | null } {
  const has = 'tuNgay' in o || 'cu' in o;
  const tuNgay = has ? (typeof o.tuNgay === 'string' && NGAY_RE.test(o.tuNgay) ? o.tuNgay : '') : d.tuNgay;
  const src = (has ? o.cu : d.cu) as Record<string, unknown> | null | undefined;
  if (!tuNgay || !src || typeof src !== 'object') return { tuNgay: '', cu: null };
  const base = d.cu ?? { gioVao: d.gioVao, gioRa: d.gioRa, truaTu: d.truaTu, truaDen: d.truaDen, anHan: d.anHan, thuBay: d.thuBay, gioRaT7: d.gioRaT7 };
  return {
    tuNgay,
    cu: {
      gioVao: hm(src.gioVao, base.gioVao),
      gioRa: hm(src.gioRa, base.gioRa),
      truaTu: hmOrEmpty(src.truaTu, base.truaTu),
      truaDen: hmOrEmpty(src.truaDen, base.truaDen),
      anHan: Math.round(num(src.anHan, 0, 120, base.anHan)),
      thuBay: THU_BAY.includes(src.thuBay as ThuBay) ? (src.thuBay as ThuBay) : base.thuBay,
      gioRaT7: hm(src.gioRaT7, base.gioRaT7),
    },
  };
}

/** Lịch áp dụng cho một ngày: trước ngày áp dụng thì dùng giờ cũ. */
export function lichNgay(l: Lich, ngay: string): Lich {
  return l.tuNgay && l.cu && ngay < l.tuNgay ? { ...l, ...l.cu } : l;
}

function normCa(x: unknown, i: number): Ca | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const tu = hm(o.tu, '');
  const den = hm(o.den, '');
  if (!tu || !den || den <= tu) return null; // ca qua nửa đêm chưa hỗ trợ
  return { id: String(o.id || 'ca' + (i + 1)).slice(0, 40), ten: String(o.ten || 'Ca ' + (i + 1)).slice(0, 60), tu, den };
}

function normQuyTac(x: unknown): QuyTac {
  const o = (x ?? {}) as Record<string, unknown>;
  const d = CC_DEFAULT.quyTac;
  return {
    mocLyDo: Math.round(num(o.mocLyDo, 0, 240, d.mocLyDo)),
    mocNang: Math.round(num(o.mocNang, 0, 240, d.mocNang)),
    ccLan: Math.round(num(o.ccLan, 0, 31, d.ccLan)),
    ccNghi: Math.round(num(o.ccNghi, 0, 31, d.ccNghi)),
    tienCC: Math.round(num(o.tienCC, 0, 100_000_000, d.tienCC)),
    tienTrua: Math.round(num(o.tienTrua, 0, 10_000_000, d.tienTrua)),
    mocVong2: Math.round(num(o.mocVong2, 1, 60, d.mocVong2)),
    tuMax: Math.round(num(o.tuMax, 0, 1_000_000_000, d.tuMax)),
  };
}

/** Làm sạch cài đặt nhận từ trình duyệt hoặc đọc từ máy chủ; thiếu hay sai thì lấy mặc định. */
export function normalizeSettings(v: unknown): CcSettings {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const diem = (Array.isArray(o.diem) ? o.diem : [])
    .map((x, i) => {
      const d = (x ?? {}) as Record<string, unknown>;
      if (d.lat === '' || d.lng === '' || d.lat == null || d.lng == null) return null;
      const lat = Number(d.lat);
      const lng = Number(d.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      return {
        id: String(d.id || 'd' + (i + 1)).slice(0, 40),
        ten: String(d.ten || 'Điểm ' + (i + 1)).slice(0, 80),
        lat,
        lng,
        bk: Math.round(num(d.bk, 30, 2000, 150)),
        ip: [...new Set((Array.isArray(d.ip) ? d.ip : String(d.ip ?? '').split(/[,\s]+/)).map((x) => (String(x).endsWith('/64') ? String(x) : ipKey(x))).filter(Boolean))].slice(0, 10),
      };
    })
    .filter((x): x is Diem => !!x)
    .slice(0, 10);
  const lich = Array.isArray(o.lich) && o.lich.length ? o.lich.slice(0, 12).map(normLich) : CC_DEFAULT.lich.map((l) => ({ ...l, diem: [] }));
  const ids = new Set(lich.map((l) => l.id));
  const map = (x: unknown, def: Record<string, string>) => {
    const src = x && typeof x === 'object' ? (x as Record<string, unknown>) : def;
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(src)) if (typeof val === 'string' && ids.has(val)) out[String(k).slice(0, 60)] = val;
    return out;
  };
  const diemIds = new Set(diem.map((d) => d.id));
  for (const l of lich) l.diem = l.diem.filter((id) => diemIds.has(id));
  const ca = (Array.isArray(o.ca) ? o.ca : []).slice(0, 20).map(normCa).filter((x): x is Ca => !!x);
  const macDinh = typeof o.macDinh === 'string' && ids.has(o.macDinh) ? o.macDinh : lich[0].id;
  const ngayLe = (Array.isArray(o.ngayLe) ? o.ngayLe : [])
    .map((x) => (x ?? {}) as Record<string, unknown>)
    .filter((x) => typeof x.ngay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.ngay))
    .map((x) => ({ ngay: x.ngay as string, ten: String(x.ten ?? '').slice(0, 80) }))
    .sort((a, b) => a.ngay.localeCompare(b.ngay))
    .slice(0, 60);
  return { diem, lich, ca, ngayLe, quyTac: normQuyTac(o.quyTac), pbLich: map(o.pbLich, CC_DEFAULT.pbLich), nguoiLich: map(o.nguoiLich, {}), macDinh };
}

/** Lịch làm của một người: lịch riêng, rồi theo phòng ban, rồi lịch mặc định. */
export function lichOf(s: CcSettings, userId: string, pb: string | undefined): Lich {
  const id = s.nguoiLich[userId] || (pb ? s.pbLich[pb] : '') || s.macDinh;
  return s.lich.find((l) => l.id === id) ?? s.lich[0];
}

/** Khoảng cách (mét) giữa hai tọa độ. */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Điểm chấm gần nhất trong các điểm của lịch (lịch không chọn điểm thì xét mọi điểm). trong = null khi chưa cài điểm nào. */
export function nearest(s: CcSettings, lat: number, lng: number, l?: Lich): { diem: Diem | null; kc: number | null; trong: boolean | null } {
  let best: Diem | null = null;
  let kc = Infinity;
  const pts = l && l.diem.length ? s.diem.filter((d) => l.diem.includes(d.id)) : s.diem;
  for (const d of pts) {
    const k = distanceM(lat, lng, d.lat, d.lng);
    if (k < kc) {
      kc = k;
      best = d;
    }
  }
  if (!best) return { diem: null, kc: null, trong: null };
  return { diem: best, kc: Math.round(kc), trong: kc <= best.bk };
}

const toMin = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
/** Số phút tính từ 0 giờ (giờ Việt Nam) của một thời điểm. */
export function vnMinutes(iso: string): number {
  const d = new Date(Date.parse(iso) + 7 * 3600e3);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
/** Thứ trong tuần của ngày 'YYYY-MM-DD': 0 = Chủ nhật. */
export function weekday(ngay: string): number {
  return new Date(ngay + 'T00:00:00Z').getUTCDay();
}

/**
 * Ngày đó có phải đi làm không, giờ vào giờ ra chuẩn (phút), có tính đi muộn / về sớm không.
 * Lịch theo ca: chỉ đi làm ngày được xếp ca, giờ theo ca. Giờ linh hoạt: không tính muộn.
 */
export function dayRule(l0: Lich, ngay: string, ca?: Ca | null, le = false): { lam: boolean; vao: number; ra: number; tinh: boolean } {
  const l = lichNgay(l0, ngay);
  if (l.kieu === 'ca') return ca ? { lam: true, vao: toMin(ca.tu), ra: toMin(ca.den), tinh: true } : { lam: false, vao: 0, ra: 0, tinh: false };
  const w = weekday(ngay);
  const vao = toMin(l.gioVao);
  const ra = toMin(l.gioRa);
  const tinh = l.kieu === 'codinh';
  if (w === 0 || le) return { lam: false, vao, ra, tinh: false };
  if (w !== 6) return { lam: true, vao, ra, tinh };
  const thu = Math.ceil(Number(ngay.slice(8, 10)) / 7); // thứ Bảy thứ mấy trong tháng
  if (l.thuBay === 'nghi' || (l.thuBay === 'nghi13' && (thu === 1 || thu === 3)) || (l.thuBay === 'nghi24' && (thu === 2 || thu === 4)))
    return { lam: false, vao, ra, tinh: false };
  return { lam: true, vao, ra: l.thuBay === 'nua' ? toMin(l.gioRaT7) : ra, tinh };
}

/** Một lượt chấm; may = lấy từ file máy chấm công (không phải bấm trên điện thoại). */
/** xn: lượt chấm ngoài văn phòng chờ / đã / không được xác nhận; gio_quay: giờ buổi quay gắn kèm (đi muộn so với giờ này). */
export type Luot = { loai: 'vao' | 'ra'; at: string; trong: number | null; ly_do_muon?: string | null; may?: boolean; xn?: string | null; gio_quay?: string | null };
export type NgayCong = {
  vao: string | null;
  ra: string | null;
  /** Phút đi muộn (tính đủ từ giờ vào chuẩn) khi vào trễ quá phút ân hạn; về sớm tương tự. Giờ linh hoạt không tính. */
  muon: number;
  som: number;
  /** Số phút làm từ lượt vào tới lượt ra, trừ giờ nghỉ trưa. */
  phut: number;
  quenRa: boolean;
  ngoai: boolean;
  lam: boolean;
  /** Tên ca được xếp (lịch theo ca). */
  ca: string | null;
  /** Ngày lễ công ty cho nghỉ. */
  le: boolean;
  /** Loại đơn nghỉ đã duyệt ngày đó ('Nghỉ phép năm', 'Nghỉ ốm', 'Nghỉ không lương'). */
  don: string | null;
  /** Có đơn xin về sớm / đến muộn đã duyệt: đi muộn, về sớm hôm đó không tính vi phạm chuyên cần. */
  coPhep: boolean;
  /** Giờ tăng ca đã duyệt ngày đó. */
  ot: number;
  /** Lý do đi muộn đã ghi; canhBao = muộn quá mốc hỏi lý do mà chưa ghi. */
  lyDoMuon: string | null;
  canhBao: boolean;
  /** Có lượt chấm ngoài văn phòng đang chờ Lead xác nhận (chưa tính công). */
  choXn: boolean;
  /** Có lượt chấm ngoài văn phòng đã được xác nhận (đi quay, gặp khách): tính công bình thường, không coi là ngoài phạm vi. */
  chamNgoai: boolean;
};

/**
 * Gộp các lượt chấm của một người trong một ngày: lấy lượt vào sớm nhất, lượt ra muộn nhất.
 * quenRa chỉ tính cho ngày đã qua (homNay = false).
 */
export function tongNgay(
  luot0: Luot[],
  l0: Lich,
  ngay: string,
  homNay: boolean,
  opt: { ca?: Ca | null; q?: QuyTac; le?: boolean; don?: string | null; coPhep?: boolean; ot?: number } = {},
): NgayCong {
  const l = lichNgay(l0, ngay);
  const q = opt.q ?? CC_DEFAULT.quyTac;
  const rule = dayRule(l, ngay, opt.ca, opt.le);
  // Lượt chấm ngoài chưa được xác nhận hoặc bị từ chối thì chưa tính công.
  const choXn = luot0.some((x) => x.xn === 'cho');
  const luot = luot0.filter((x) => x.xn !== 'cho' && x.xn !== 'khong');
  const vaoL = luot.filter((x) => x.loai === 'vao').sort((a, b) => a.at.localeCompare(b.at))[0];
  const raL = luot.filter((x) => x.loai === 'ra').sort((a, b) => b.at.localeCompare(a.at))[0];
  let muon = 0;
  let som = 0;
  if (rule.tinh && vaoL) {
    // Đi quay: so với giờ buổi quay thay vì giờ vào văn phòng.
    const m = vnMinutes(vaoL.at) - (vaoL.gio_quay && /^\d{1,2}:\d{2}$/.test(vaoL.gio_quay) ? toMin(vaoL.gio_quay) : rule.vao);
    if (m > l.anHan) muon = m;
  }
  if (rule.tinh && raL) {
    const m = rule.ra - vnMinutes(raL.at);
    if (m > l.anHan) som = m;
  }
  let phut = 0;
  if (vaoL && raL && raL.at > vaoL.at) {
    phut = Math.round((Date.parse(raL.at) - Date.parse(vaoL.at)) / 60000);
    if (l.kieu !== 'ca' && l.truaTu && l.truaDen) {
      const a = Math.max(vnMinutes(vaoL.at), toMin(l.truaTu));
      const b = Math.min(vnMinutes(raL.at), toMin(l.truaDen));
      if (b > a) phut -= b - a;
    }
  }
  return {
    vao: vaoL?.at ?? null,
    ra: raL?.at ?? null,
    muon,
    som,
    phut,
    quenRa: !!vaoL && !raL && !homNay,
    ngoai: luot.some((x) => x.trong === 0 && x.xn !== 'ok'),
    lam: rule.lam,
    ca: opt.ca?.ten ?? null,
    le: !!opt.le && l.kieu !== 'ca',
    don: opt.don ?? null,
    coPhep: !!opt.coPhep,
    ot: opt.ot ?? 0,
    lyDoMuon: vaoL?.ly_do_muon || null,
    canhBao: muon > q.mocLyDo && !vaoL?.ly_do_muon,
    choXn,
    chamNgoai: luot.some((x) => x.xn === 'ok'),
  };
}

export type TongThang = {
  cong: number;
  lamChuan: number;
  muonLan: number;
  muonPhut: number;
  /** Số lần muộn quá mốc "muộn nặng" (thông báo 01102026: quá 10 phút, mốc 5 lần trừ 25% thưởng giai đoạn chuyển tiếp). */
  muonNang: number;
  somLan: number;
  quenRa: number;
  ngoai: number;
  /** Số ngày chấm ngoài văn phòng đã xác nhận / đang chờ xác nhận. */
  chamNgoai: number;
  choXn: number;
  /** Số lần muộn quá mốc hỏi lý do mà không ghi lý do. */
  canhBao: number;
  /** Số lần đi muộn / về sớm KHÔNG có đơn xin phép đã duyệt: dùng để xét chuyên cần. */
  viPham: number;
  /** Tổng giờ tăng ca đã duyệt. */
  ot: number;
  /**
   * Ngày nghỉ tính chuyên cần (thông báo 01102026: không quá 2 ngày/tháng, trừ ngày nghỉ trong chế độ và lễ tết):
   * ngày phải làm (đã qua) mà không chấm, trừ ngày có đơn nghỉ phép năm / nghỉ ốm đã duyệt. Nghỉ không lương vẫn tính.
   */
  nghi: number;
  /** Ngày nghỉ theo chế độ (đơn phép năm, ốm đã duyệt), không tính vào chuyên cần. */
  nghiPhep: number;
  phut: number;
  /** Chuyên cần: muộn + về sớm không quá ccLan lần và nghỉ không quá ccNghi ngày. null = lịch không tính chuyên cần. */
  chuyenCan: boolean | null;
};

/** Cộng một tháng. homNay để không tính hôm nay là ngày nghỉ. */
export function tongThang(ngay: (NgayCong & { ngay: string })[], l: Lich, homNay: string, q: QuyTac = CC_DEFAULT.quyTac): TongThang {
  const co = ngay.filter((x) => x.vao || x.ra);
  const muonLan = co.filter((x) => x.muon > 0).length;
  const somLan = co.filter((x) => x.som > 0).length;
  const viPham = co.filter((x) => !x.coPhep).reduce((t, x) => t + (x.muon > 0 ? 1 : 0) + (x.som > 0 ? 1 : 0), 0);
  const vang = ngay.filter((x) => x.lam && !x.vao && !x.ra && x.ngay < homNay);
  const cheDo = (x: NgayCong) => !!x.don && x.don !== DON_KHONG_LUONG;
  const nghi = vang.filter((x) => !cheDo(x)).length;
  return {
    cong: co.length,
    lamChuan: ngay.filter((x) => x.lam).length,
    muonLan,
    muonPhut: co.reduce((t, x) => t + x.muon, 0),
    muonNang: co.filter((x) => x.muon > q.mocNang).length,
    somLan,
    quenRa: ngay.filter((x) => x.quenRa).length,
    ngoai: ngay.filter((x) => x.ngoai).length,
    chamNgoai: ngay.filter((x) => x.chamNgoai).length,
    choXn: ngay.filter((x) => x.choXn).length,
    canhBao: co.filter((x) => x.canhBao).length,
    viPham,
    ot: ngay.reduce((t, x) => t + (x.ot || 0), 0),
    nghi,
    nghiPhep: vang.filter(cheDo).length,
    phut: co.reduce((t, x) => t + x.phut, 0),
    chuyenCan: l.kieu !== 'tudo' && l.chuyenCan ? viPham <= q.ccLan && nghi <= q.ccNghi : null,
  };
}

export const DON_KHONG_LUONG = 'Nghỉ không lương';
const DON_NGHI = ['Nghỉ phép năm', 'Nghỉ ốm', DON_KHONG_LUONG];
/**
 * Ngày nghỉ có đơn đã duyệt của từng người (đơn ở Nhân sự › Đơn từ, hub_state.hr.don, nối tài khoản qua users.maNS).
 * Trả về: mã đăng nhập → (ngày → loại đơn).
 */
export function donNghiTheoNguoi(
  users: { crm?: string; maNS?: string }[] | undefined,
  don: { ma?: string; loai?: string; tu?: string; den?: string; tt?: string }[] | undefined,
): Map<string, Map<string, string>> {
  const crmOf = new Map<string, string>();
  for (const u of users ?? []) if (u?.crm && u.maNS) crmOf.set(u.maNS, u.crm);
  const out = new Map<string, Map<string, string>>();
  for (const d of don ?? []) {
    if (!d || d.tt !== 'duyet' || !DON_NGHI.includes(d.loai ?? '') || !d.ma || !d.tu) continue;
    const crm = crmOf.get(d.ma);
    if (!crm || !/^\d{4}-\d{2}-\d{2}$/.test(d.tu)) continue;
    const den = d.den && d.den >= d.tu ? d.den : d.tu;
    const m = out.get(crm) ?? new Map<string, string>();
    for (const n of daysFrom(d.tu, Math.min(62, daysBetweenIso(d.tu, den) + 1))) m.set(n, d.loai as string);
    out.set(crm, m);
  }
  return out;
}
const daysBetweenIso = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

/** Các ngày trong tháng 'YYYY-MM', không quá ngày cuối (thường là hôm nay). */
export function daysOf(thang: string, toiDa: string): string[] {
  const [y, m] = thang.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= n; d++) {
    const k = `${thang}-${String(d).padStart(2, '0')}`;
    if (k > toiDa) break;
    out.push(k);
  }
  return out;
}

/** n ngày liên tiếp bắt đầu từ ngày 'YYYY-MM-DD'. */
export function daysFrom(tu: string, n: number): string[] {
  const t = Date.parse(tu + 'T00:00:00Z');
  return Array.from({ length: n }, (_, i) => new Date(t + i * 864e5).toISOString().slice(0, 10));
}
/** Thứ Hai của tuần chứa ngày đó. */
export function mondayOf(ngay: string): string {
  return new Date(Date.parse(ngay + 'T00:00:00Z') - ((weekday(ngay) + 6) % 7) * 864e5).toISOString().slice(0, 10);
}

/** Ai xem được lượt chấm của ai: CEO, nhân sự xem hết; trưởng nhóm / trưởng phòng xem phòng mình; còn lại chỉ xem của mình. */
export type CcViewer = { id: string; all: boolean; pb: string | null };
export function ccViewer(userId: string, serverRole: string, member: { pb: string; role: string; hr: boolean } | undefined, hr: boolean): CcViewer {
  const all = serverRole === 'CEO' || member?.role === 'admin' || hr || !!member?.hr;
  const lead = !!member && ['lead', 'truongphong'].includes(member.role) && !!member.pb;
  return { id: userId, all, pb: !all && lead ? member!.pb : null };
}

/**
 * Chấm công trên điện thoại (chị Hoa duyệt 04/11/2026): nhân viên bấm Chấm vào / Chấm ra trên vanhanh,
 * máy chủ ghi giờ theo đồng hồ máy chủ (không tin giờ điện thoại) và khoảng cách tới điểm chấm gần nhất.
 * File này chỉ có hàm thuần (khoảng cách, giờ Việt Nam, đi muộn / về sớm, chuyên cần) để kiểm thử được; đọc ghi ở routes/chamCong.ts.
 * Quy định chuyên cần theo thông báo 01102026/TB-AILLA (khối văn phòng). Chưa đổ vào bảng lương.
 */

export const CC_SETTINGS_KEY = 'cc_caidat';

export type Diem = { id: string; ten: string; lat: number; lng: number; bk: number };
/**
 * Lịch làm của một nhóm người. kieu: 'codinh' giờ cố định (tính đi muộn, về sớm, chuyên cần);
 * 'ca' làm theo ca (team live, chưa xếp ca nên chỉ ghi giờ vào ra); 'tudo' giờ linh hoạt (sale, chỉ ghi giờ).
 * thuBay: 'ca' làm cả ngày, 'nua' làm buổi sáng (ra theo gioRaT7), 'nghi' nghỉ hết,
 * 'nghi13' nghỉ thứ Bảy thứ 1 và thứ 3 của tháng, 'nghi24' nghỉ thứ Bảy thứ 2 và thứ 4. Chủ nhật luôn nghỉ.
 */
export type ThuBay = 'ca' | 'nua' | 'nghi' | 'nghi13' | 'nghi24';
export type Lich = { id: string; ten: string; kieu: 'codinh' | 'ca' | 'tudo'; gioVao: string; gioRa: string; anHan: number; thuBay: ThuBay; gioRaT7: string; chuyenCan: boolean };
/** pbLich: lịch theo phòng ban; nguoiLich: lịch riêng từng người (mã đăng nhập), ưu tiên hơn phòng ban; macDinh: còn lại. */
export type CcSettings = { diem: Diem[]; lich: Lich[]; pbLich: Record<string, string>; nguoiLich: Record<string, string>; macDinh: string };

/** Theo thông báo 01102026/TB-AILLA và lời CEO 04/11: văn phòng 8h–17h30, quá 8h05 là muộn, nghỉ 2 thứ Bảy/tháng; xưởng làm thứ Bảy. */
export const CC_DEFAULT: CcSettings = {
  diem: [],
  lich: [
    { id: 'vp', ten: 'Văn phòng', kieu: 'codinh', gioVao: '08:00', gioRa: '17:30', anHan: 5, thuBay: 'nghi24', gioRaT7: '12:00', chuyenCan: true },
    { id: 'xuong', ten: 'Xưởng', kieu: 'codinh', gioVao: '08:00', gioRa: '17:30', anHan: 5, thuBay: 'ca', gioRaT7: '12:00', chuyenCan: false },
    { id: 'live', ten: 'Live (theo ca)', kieu: 'ca', gioVao: '08:00', gioRa: '17:30', anHan: 5, thuBay: 'ca', gioRaT7: '12:00', chuyenCan: false },
    { id: 'sale', ten: 'Sale (giờ linh hoạt)', kieu: 'tudo', gioVao: '08:00', gioRa: '17:30', anHan: 5, thuBay: 'ca', gioRaT7: '12:00', chuyenCan: false },
  ],
  pbLich: { SX: 'xuong', KV: 'xuong', B2B: 'sale', B2C: 'sale' },
  nguoiLich: {},
  macDinh: 'vp',
};

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const THU_BAY: ThuBay[] = ['ca', 'nua', 'nghi', 'nghi13', 'nghi24'];
const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : d;
};
const hm = (v: unknown, def: string) => (typeof v === 'string' && HM.test(v) ? v : def);

function normLich(x: unknown, i: number): Lich {
  const o = (x ?? {}) as Record<string, unknown>;
  const d = CC_DEFAULT.lich[0];
  return {
    id: String(o.id || 'l' + (i + 1)).slice(0, 40),
    ten: String(o.ten || 'Lịch ' + (i + 1)).slice(0, 80),
    kieu: o.kieu === 'ca' || o.kieu === 'tudo' ? o.kieu : 'codinh',
    gioVao: hm(o.gioVao, d.gioVao),
    gioRa: hm(o.gioRa, d.gioRa),
    anHan: Math.round(num(o.anHan, 0, 120, d.anHan)),
    thuBay: THU_BAY.includes(o.thuBay as ThuBay) ? (o.thuBay as ThuBay) : d.thuBay,
    gioRaT7: hm(o.gioRaT7, d.gioRaT7),
    chuyenCan: o.chuyenCan === undefined ? i === 0 : o.chuyenCan === true,
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
      };
    })
    .filter((x): x is Diem => !!x)
    .slice(0, 10);
  const lich = Array.isArray(o.lich) && o.lich.length ? o.lich.slice(0, 12).map(normLich) : CC_DEFAULT.lich.map((l) => ({ ...l }));
  const ids = new Set(lich.map((l) => l.id));
  const map = (x: unknown, def: Record<string, string>) => {
    const src = x && typeof x === 'object' ? (x as Record<string, unknown>) : def;
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(src)) if (typeof val === 'string' && ids.has(val)) out[String(k).slice(0, 60)] = val;
    return out;
  };
  const macDinh = typeof o.macDinh === 'string' && ids.has(o.macDinh) ? o.macDinh : lich[0].id;
  return { diem, lich, pbLich: map(o.pbLich, CC_DEFAULT.pbLich), nguoiLich: map(o.nguoiLich, {}), macDinh };
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

/** Điểm chấm gần nhất. trong = null khi chưa cài điểm nào (chưa kiểm vị trí được). */
export function nearest(s: CcSettings, lat: number, lng: number): { diem: Diem | null; kc: number | null; trong: boolean | null } {
  let best: Diem | null = null;
  let kc = Infinity;
  for (const d of s.diem) {
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

/** Ngày đó có phải đi làm không, giờ vào giờ ra chuẩn (phút). */
export function dayRule(l: Lich, ngay: string): { lam: boolean; vao: number; ra: number } {
  const w = weekday(ngay);
  const vao = toMin(l.gioVao);
  const ra = toMin(l.gioRa);
  if (w === 0) return { lam: false, vao, ra };
  if (w !== 6) return { lam: true, vao, ra };
  const thu = Math.ceil(Number(ngay.slice(8, 10)) / 7); // thứ Bảy thứ mấy trong tháng
  if (l.thuBay === 'nghi' || (l.thuBay === 'nghi13' && (thu === 1 || thu === 3)) || (l.thuBay === 'nghi24' && (thu === 2 || thu === 4)))
    return { lam: false, vao, ra };
  return { lam: true, vao, ra: l.thuBay === 'nua' ? toMin(l.gioRaT7) : ra };
}

export type Luot = { loai: 'vao' | 'ra'; at: string; trong: number | null };
export type NgayCong = {
  vao: string | null;
  ra: string | null;
  /** Phút đi muộn (tính đủ từ giờ vào chuẩn) khi vào trễ quá phút ân hạn; về sớm tương tự. Lịch theo ca / linh hoạt không tính. */
  muon: number;
  som: number;
  /** Số phút từ lượt vào tới lượt ra. */
  phut: number;
  quenRa: boolean;
  ngoai: boolean;
  lam: boolean;
};

/**
 * Gộp các lượt chấm của một người trong một ngày: lấy lượt vào sớm nhất, lượt ra muộn nhất.
 * quenRa chỉ tính cho ngày đã qua (homNay = false).
 */
export function tongNgay(luot: Luot[], l: Lich, ngay: string, homNay: boolean): NgayCong {
  const rule = dayRule(l, ngay);
  const vaoL = luot.filter((x) => x.loai === 'vao').sort((a, b) => a.at.localeCompare(b.at))[0];
  const raL = luot.filter((x) => x.loai === 'ra').sort((a, b) => b.at.localeCompare(a.at))[0];
  const tinh = rule.lam && l.kieu === 'codinh';
  let muon = 0;
  let som = 0;
  if (tinh && vaoL) {
    const m = vnMinutes(vaoL.at) - rule.vao;
    if (m > l.anHan) muon = m;
  }
  if (tinh && raL) {
    const m = rule.ra - vnMinutes(raL.at);
    if (m > l.anHan) som = m;
  }
  const phut = vaoL && raL && raL.at > vaoL.at ? Math.round((Date.parse(raL.at) - Date.parse(vaoL.at)) / 60000) : 0;
  return {
    vao: vaoL?.at ?? null,
    ra: raL?.at ?? null,
    muon,
    som,
    phut,
    quenRa: !!vaoL && !raL && !homNay,
    ngoai: luot.some((x) => x.trong === 0),
    lam: rule.lam,
  };
}

export type TongThang = {
  cong: number;
  lamChuan: number;
  muonLan: number;
  muonPhut: number;
  /** Số lần muộn quá 10 phút (mốc 5 lần trừ 25% thưởng trong giai đoạn chuyển tiếp). */
  muon10: number;
  somLan: number;
  quenRa: number;
  ngoai: number;
  /** Ngày phải làm (đã qua) mà không chấm: tạm coi là nghỉ, chưa trừ ngày nghỉ có đơn, lễ tết. */
  nghi: number;
  phut: number;
  /** Chuyên cần: muộn + về sớm không quá 2 lần và nghỉ không quá 2 ngày. null = lịch không tính chuyên cần (thông báo chỉ áp dụng khối văn phòng). */
  chuyenCan: boolean | null;
};

/** Cộng một tháng. homNay để không tính hôm nay là ngày nghỉ. */
export function tongThang(ngay: (NgayCong & { ngay: string })[], l: Lich, homNay: string): TongThang {
  const co = ngay.filter((x) => x.vao || x.ra);
  const muonLan = co.filter((x) => x.muon > 0).length;
  const somLan = co.filter((x) => x.som > 0).length;
  const nghi = ngay.filter((x) => x.lam && !x.vao && !x.ra && x.ngay < homNay).length;
  return {
    cong: co.length,
    lamChuan: ngay.filter((x) => x.lam).length,
    muonLan,
    muonPhut: co.reduce((t, x) => t + x.muon, 0),
    muon10: co.filter((x) => x.muon > 10).length,
    somLan,
    quenRa: ngay.filter((x) => x.quenRa).length,
    ngoai: ngay.filter((x) => x.ngoai).length,
    nghi,
    phut: co.reduce((t, x) => t + x.phut, 0),
    chuyenCan: l.kieu === 'codinh' && l.chuyenCan ? muonLan + somLan <= 2 && nghi <= 2 : null,
  };
}

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

/** Ai xem được lượt chấm của ai: CEO, nhân sự xem hết; trưởng nhóm / trưởng phòng xem phòng mình; còn lại chỉ xem của mình. */
export type CcViewer = { id: string; all: boolean; pb: string | null };
export function ccViewer(userId: string, serverRole: string, member: { pb: string; role: string; hr: boolean } | undefined, hr: boolean): CcViewer {
  const all = serverRole === 'CEO' || member?.role === 'admin' || hr || !!member?.hr;
  const lead = !!member && ['lead', 'truongphong'].includes(member.role) && !!member.pb;
  return { id: userId, all, pb: !all && lead ? member!.pb : null };
}

/**
 * Nghỉ phép & tăng ca, tạm ứng lương (chị Hoa duyệt demo 04/11/2026). Hàm thuần để kiểm thử; đọc ghi ở routes/nghiPhep.ts.
 * Quy tắc CEO chốt: nghỉ 1–2 ngày Lead duyệt là xong; từ mocVong2 ngày (mặc định 3) Lead duyệt rồi HCNS duyệt vòng 2.
 * Xin về sớm / đến muộn và tăng ca: Lead duyệt (tăng ca được duyệt thì báo đẩy cho HCNS).
 * Phòng chưa có Lead, hoặc người gửi chính là Lead: đơn lên thẳng HCNS.
 * Tạm ứng: dưới mức tối đa (mặc định 3 triệu), Kế toán duyệt, cuối tháng trừ vào lương.
 */
import { dayRule, daysFrom, lichNgay, type CcSettings, type Lich, type NgayCong } from './chamCong';

export type LoaiDon = 'phep' | 'om' | 'khongluong' | 'vesom' | 'ot' | 'lambu';
export const LOAI_DON: Record<LoaiDon, string> = {
  phep: 'Nghỉ phép năm',
  om: 'Nghỉ ốm',
  khongluong: 'Nghỉ không lương',
  vesom: 'Xin về sớm / đến muộn',
  ot: 'Làm thêm giờ (OT)',
  lambu: 'Xin làm bù',
};
export const LOAI_NGHI: LoaiDon[] = ['phep', 'om', 'khongluong'];
export type TrangThai = 'lead' | 'hcns' | 'xong' | 'tuchoi' | 'huy';
/** 'gio' = nghỉ theo giờ trong một ngày (CEO 10/11): giờ từ–đến ghi ở ghi_chu, số giờ ở cột gio. */
export type Buoi = 'ca' | 'sang' | 'chieu' | 'gio';

/**
 * Nghỉ theo giờ (CEO 10/11): số giờ nghỉ nằm trong giờ làm của ngày đó (bỏ phần ngoài giờ làm và giờ nghỉ trưa),
 * quy ra ngày = giờ nghỉ ÷ số giờ làm chuẩn của ngày (để trừ quỹ phép năm). Trả câu báo lỗi dễ hiểu nếu không hợp lệ.
 */
export function gioNghi(
  l: Lich,
  ngay: string,
  tu: string,
  den: string,
  rule: { lam: boolean; vao: number; ra: number },
): { gio: number; soNgay: number } | { loi: string } {
  const hm = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!hm.test(tu) || !hm.test(den) || den <= tu) return { loi: 'Ghi giờ nghỉ: từ giờ phải trước đến giờ' };
  if (!rule.lam) return { loi: 'Ngày này không phải ngày đi làm theo lịch' };
  const m = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
  const giao = (a: number, b: number, c: number, d: number) => Math.max(0, Math.min(b, d) - Math.max(a, c));
  const ln = lichNgay(l, ngay);
  const trua = ln.kieu !== 'ca' && ln.truaTu && ln.truaDen ? [m(ln.truaTu), m(ln.truaDen)] : null;
  const trongGio = (a: number, b: number) => giao(a, b, rule.vao, rule.ra) - (trua ? giao(Math.max(a, rule.vao), Math.min(b, rule.ra), trua[0], trua[1]) : 0);
  const phut = trongGio(m(tu), m(den));
  const chuan = trongGio(rule.vao, rule.ra);
  if (phut <= 0) return { loi: 'Giờ nghỉ phải nằm trong giờ làm của ngày đó' };
  if (chuan > 0 && phut >= chuan) return { loi: 'Nghỉ hết giờ làm của ngày thì chọn Cả ngày' };
  const gio = Math.round((phut / 60) * 100) / 100;
  return { gio, soNgay: chuan > 0 ? Math.round((phut / chuan) * 100) / 100 : 0 };
}

/**
 * Số ngày làm việc của một đơn nghỉ theo lịch làm của người gửi: bỏ Chủ nhật, thứ Bảy nghỉ, ngày lễ.
 * Nghỉ buổi sáng / chiều tính nửa ngày (chỉ khi từ ngày = đến ngày).
 */
export function soNgayNghi(l: Lich, tu: string, den: string, buoi: Buoi, ngayLe: string[] = []): number {
  if (den < tu) return 0;
  const n = Math.round((Date.parse(den + 'T00:00:00Z') - Date.parse(tu + 'T00:00:00Z')) / 864e5) + 1;
  // Lịch theo ca / giờ linh hoạt không có ngày nghỉ cố định: tính theo ngày lịch.
  const lam = daysFrom(tu, Math.min(n, 62)).filter((d) => l.kieu !== 'codinh' || dayRule(l, d, null, ngayLe.includes(d)).lam).length;
  if (buoi !== 'ca' && tu === den) return lam ? 0.5 : 0;
  return lam;
}

/** Trạng thái lúc gửi: có Lead (khác người gửi) thì chờ Lead, không thì lên thẳng HCNS. */
export function trangThaiDau(coLead: boolean): TrangThai {
  return coLead ? 'lead' : 'hcns';
}

/** Lead duyệt xong thì đi đâu: đơn nghỉ từ mocVong2 ngày lên HCNS, còn lại là xong. */
export function sauLeadDuyet(loai: LoaiDon, soNgay: number, mocVong2: number): TrangThai {
  return LOAI_NGHI.includes(loai) && soNgay >= mocVong2 ? 'hcns' : 'xong';
}

/** Ai đang được bấm duyệt đơn này. */
export function coTheDuyet(
  d: { st: TrangThai; user_id: string; pb: string | null },
  v: { id: string; hr: boolean; leadPb: string | null },
): boolean {
  if (d.user_id === v.id && !v.hr) return false; // tự duyệt đơn của mình: chỉ CEO / HCNS (khi không có ai khác)
  if (d.st === 'lead') return v.hr || (!!v.leadPb && v.leadPb === d.pb && d.user_id !== v.id);
  if (d.st === 'hcns') return v.hr;
  return false;
}

/** Phòng có Lead khác người gửi không (vai trò lead / trưởng phòng, cùng phòng). */
export function leadsCuaPhong(users: Record<string, { pb: string; role: string }>, pb: string, tru: string): string[] {
  if (!pb) return [];
  return Object.entries(users)
    .filter(([id, u]) => id !== tru && u.pb === pb && ['lead', 'truongphong'].includes(u.role))
    .map(([id]) => id);
}

/** Tháng trừ tạm ứng vào lương: tháng gửi đề nghị. */
export const kyTamUng = (ngay: string) => ngay.slice(0, 7);

/** Lịch làm của người gửi (lấy theo cài đặt chấm công); tách ra để route dùng chung. */
export type NgayDon = { loai: LoaiDon; buoi: Buoi; gio: number | null };
/** Đơn đã duyệt theo ngày: ngày → đơn (đơn nghỉ trải nhiều ngày thì mỗi ngày một dòng). */
export function donTheoNgay(rows: { loai: LoaiDon; tu: string; den: string; buoi: Buoi; gio: number | null }[]): Map<string, NgayDon[]> {
  const out = new Map<string, NgayDon[]>();
  for (const r of rows) {
    const n = Math.max(1, Math.round((Date.parse(r.den + 'T00:00:00Z') - Date.parse(r.tu + 'T00:00:00Z')) / 864e5) + 1);
    for (const d of daysFrom(r.tu, Math.min(n, 62))) {
      const a = out.get(d) ?? [];
      a.push({ loai: r.loai, buoi: r.buoi, gio: r.gio });
      out.set(d, a);
    }
  }
  return out;
}

export type { CcSettings };

/**
 * Ngày cần bù (CEO 06/11) trong các ngày đã qua: bù ngày cho ngày phải làm mà không chấm (không có đơn phép năm / ốm),
 * nghỉ không lương cả ngày hoặc nửa ngày; bù giờ cho ngày đi muộn / về sớm chưa có đơn xin phép. Ngày đã có đơn bù thì bỏ.
 */
export type CanBu = { ngay: string; kieu: 'ngay' | 'gio'; buoi: Buoi; phut: number; mo: string };
export function ngayCanBu(ngay: (NgayCong & { ngay: string })[], today: string): CanBu[] {
  const out: CanBu[] = [];
  const kl = (x: NgayCong) => !!x.don && x.don.startsWith(LOAI_DON.khongluong);
  for (const x of ngay) {
    if (x.ngay > today || x.bu) continue;
    if (x.ngay < today && x.lam && !x.vao && !x.ra && (!x.don || kl(x)))
      out.push({ ngay: x.ngay, kieu: 'ngay', buoi: 'ca', phut: 0, mo: kl(x) ? 'nghỉ không lương' : 'không chấm công' });
    else if (x.ngay < today && kl(x) && (x.vao || x.ra) && /\((sáng|chiều)\)/.test(x.don ?? ''))
      out.push({ ngay: x.ngay, kieu: 'ngay', buoi: x.don!.includes('sáng') ? 'sang' : 'chieu', phut: 0, mo: 'nghỉ không lương buổi ' + (x.don!.includes('sáng') ? 'sáng' : 'chiều') });
    else if ((x.muon > 0 || x.som > 0) && !x.coPhep)
      out.push({ ngay: x.ngay, kieu: 'gio', buoi: 'ca', phut: x.muon + x.som, mo: [x.muon ? 'đi muộn ' + x.muon + ' phút' : '', x.som ? 'về sớm ' + x.som + ' phút' : ''].filter(Boolean).join(', ') });
  }
  return out.reverse();
}

/** Kiểm đơn làm bù; trả lời câu báo lỗi dễ hiểu, hoặc null nếu hợp lệ. rule = giờ làm của ngày làm bù theo lịch. */
export function kiemBu(
  c: CanBu,
  b: { ngay: string; buoi: Buoi; tu: string; den: string },
  rule: { lam: boolean; vao: number; ra: number },
  today: string,
  hanBu: number,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.ngay)) return 'Chọn ngày làm bù';
  if (b.ngay < today) return 'Ngày làm bù phải từ hôm nay trở đi';
  if (b.ngay <= c.ngay && c.kieu === 'ngay') return 'Ngày làm bù phải sau ngày được bù';
  const cach = Math.round((Date.parse(b.ngay) - Date.parse(c.ngay)) / 864e5);
  if (cach > hanBu) return `Phải làm bù trong vòng ${hanBu} ngày sau ngày ${c.ngay.slice(8)}/${c.ngay.slice(5, 7)}`;
  if (c.kieu === 'ngay') {
    if (rule.lam) return 'Ngày này đang là ngày đi làm theo lịch. Bù ngày thì chọn ngày nghỉ (Chủ nhật, thứ Bảy được nghỉ)';
    return null;
  }
  const hm = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!hm.test(b.tu) || !hm.test(b.den) || b.den <= b.tu) return 'Ghi giờ làm bù: từ giờ phải trước đến giờ';
  const m = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
  const dai = m(b.den) - m(b.tu);
  if (dai < c.phut) return `Cần bù ${c.phut} phút, giờ đăng ký mới được ${dai} phút`;
  if (rule.lam && m(b.den) > rule.vao && m(b.tu) < rule.ra) return 'Giờ làm bù phải ngoài giờ làm (đến sớm trước giờ vào hoặc ở lại sau giờ ra)';
  return null;
}

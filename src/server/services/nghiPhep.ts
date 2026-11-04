/**
 * Nghỉ phép & tăng ca, tạm ứng lương (chị Hoa duyệt demo 04/11/2026). Hàm thuần để kiểm thử; đọc ghi ở routes/nghiPhep.ts.
 * Quy tắc CEO chốt: nghỉ 1–2 ngày Lead duyệt là xong; từ mocVong2 ngày (mặc định 3) Lead duyệt rồi HCNS duyệt vòng 2.
 * Xin về sớm / đến muộn và tăng ca: Lead duyệt (tăng ca được duyệt thì báo đẩy cho HCNS).
 * Phòng chưa có Lead, hoặc người gửi chính là Lead: đơn lên thẳng HCNS.
 * Tạm ứng: dưới mức tối đa (mặc định 3 triệu), Kế toán duyệt, cuối tháng trừ vào lương.
 */
import { dayRule, daysFrom, type CcSettings, type Lich } from './chamCong';

export type LoaiDon = 'phep' | 'om' | 'khongluong' | 'vesom' | 'ot';
export const LOAI_DON: Record<LoaiDon, string> = {
  phep: 'Nghỉ phép năm',
  om: 'Nghỉ ốm',
  khongluong: 'Nghỉ không lương',
  vesom: 'Xin về sớm / đến muộn',
  ot: 'Làm thêm giờ (OT)',
};
export const LOAI_NGHI: LoaiDon[] = ['phep', 'om', 'khongluong'];
export type TrangThai = 'lead' | 'hcns' | 'xong' | 'tuchoi' | 'huy';
export type Buoi = 'ca' | 'sang' | 'chieu';

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

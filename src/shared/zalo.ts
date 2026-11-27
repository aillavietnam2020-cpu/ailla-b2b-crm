/**
 * Zalo trong CRM, đợt 1 (chị Hoa duyệt 27/11/2026): phần tính toán dùng chung cho máy chủ và test.
 * Không có gửi tự động: mọi tin gửi đi đều do người bấm Gửi trên web.
 */

/** Trần chống khóa nick: gửi dồn tối đa 5 tin trong 30 giây mỗi nick (máy VPS cũng giữ trần này). */
export const ZALO_SEND_MAX = 5;
export const ZALO_SEND_WINDOW_MS = 30_000;
/** Tin dài nhất cho gửi một lần. */
export const ZALO_TEXT_MAX = 2000;

/** Đã có bao nhiêu tin gửi trong cửa sổ 30 giây tính tới `now`; còn gửi được không. */
export function sendAllowed(sentAtMs: number[], now: number): { ok: boolean; waitSec: number } {
  const inWin = sentAtMs.filter((t) => now - t < ZALO_SEND_WINDOW_MS).sort((a, b) => a - b);
  if (inWin.length < ZALO_SEND_MAX) return { ok: true, waitSec: 0 };
  const oldest = inWin[inWin.length - ZALO_SEND_MAX]!;
  return { ok: false, waitSec: Math.max(1, Math.ceil((ZALO_SEND_WINDOW_MS - (now - oldest)) / 1000)) };
}

/** Số Zalo / số khách về dạng 0xxxxxxxxx để khớp; không đúng dạng thì chuỗi rỗng. */
export function zaloPhone(v: unknown): string {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2);
  if (!d.startsWith('0') && d.length === 9) d = '0' + d;
  return /^0\d{9,10}$/.test(d) ? d : '';
}

export interface ZaloMsgRow {
  id: string;
  from_me: number;
  sender_name: string;
  kind: string;
  text: string;
  url: string;
  at: string;
  recalled_at: string | null;
  seen_at: string | null;
  sent_by_name?: string | null;
}

/** Tin bị thu hồi: Lead / CEO thấy nội dung cũ, người khác chỉ thấy "Tin đã thu hồi". */
export function msgForViewer(m: ZaloMsgRow, lead: boolean): ZaloMsgRow & { recalled: boolean } {
  if (!m.recalled_at) return { ...m, recalled: false };
  return lead ? { ...m, recalled: true } : { ...m, text: '', url: '', recalled: true };
}

/** Chữ ngắn đại diện một tin (danh sách hội thoại, lịch sử chăm sóc). */
export function msgPreview(kind: string, text: string): string {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  const tag: Record<string, string> = { image: '[Ảnh]', file: '[Tệp]', sticker: '[Nhãn dán]', voice: '[Tin thoại]', video: '[Video]', link: '[Liên kết]', other: '[Tin]' };
  if (kind === 'text') return t.slice(0, 200);
  return ((tag[kind] ?? '[Tin]') + (t ? ' ' + t : '')).slice(0, 200);
}

/** Tóm tắt một ngày nhắn Zalo cho Lịch sử chăm sóc. */
export interface ZaloDay {
  day: string; // YYYY-MM-DD giờ VN
  nick: string;
  conv_id: string;
  in: number;
  out: number;
  last_in: string;
  last_out: string;
  last_at: string;
}

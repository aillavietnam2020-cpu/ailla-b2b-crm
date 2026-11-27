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

/* ------------------------------------------------------------------ đợt 2: AI, đo sale */

/** Che số điện thoại, số tài khoản, dãy số dài trước khi gửi nội dung cho AI. Giữ số tiền có dấu chấm (95.000) và số nhỏ. */
export function aiMask(t: string): string {
  return String(t ?? '')
    .replace(/(?<![\d.])(\+?84|0)[\s.-]?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}(?![\d.])/g, '[SĐT]')
    .replace(/(?<![\d.])\d{8,}(?![\d.])/g, '[số]');
}

/** Từ nhạy cảm: AI không soạn, sale tự trả lời và báo Lead. Trả về từ gặp đầu tiên (bỏ dấu khi so). */
const SENSITIVE = ['khiếu nại', 'hoàn tiền', 'trả hàng', 'đổi trả', 'công an', 'khởi kiện', 'lừa đảo', 'hàng giả', 'dị ứng', 'ngộ độc', 'bỏng', 'cấp cứu', 'báo chí', 'tố cáo', 'bồi thường'];
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
export function aiSensitive(t: string): string | null {
  const f = ' ' + fold(String(t ?? '')).replace(/[^a-z0-9]+/g, ' ') + ' ';
  return SENSITIVE.find((w) => f.includes(' ' + fold(w) + ' ')) ?? null;
}

/** Số ngày không liên lạc thì coi là "khách lâu không chăm", theo giai đoạn khách kênh phân phối. */
export const STUCK_DAYS: Record<string, number> = { NEW: 7, CONSULTING: 14, QUOTED: 14, NEGOTIATING: 21, FIRST_ORDER: 30 };

export interface RespSample {
  conv_id: string;
  from_me: number;
  at: string;
  owner_id: string | null;
}
export interface RespStat {
  convs: number;
  inMsgs: number;
  outMsgs: number;
  replies: number;
  avgMin: number | null;
  medianMin: number | null;
  /** % lần trả lời trong 15 phút */
  within15: number | null;
  /** số lần để khách chờ quá 60 phút */
  over60: number;
}
/**
 * Thời gian trả lời: tính từ tin khách đầu tiên chưa được trả lời tới tin bên mình gửi kế tiếp, theo người phụ trách nick.
 * `rows` phải xếp theo hội thoại rồi theo giờ.
 */
export function responseStats(rows: RespSample[]): Record<string, RespStat> {
  const acc: Record<string, { convs: Set<string>; inMsgs: number; outMsgs: number; mins: number[] }> = {};
  let conv = '';
  let open: number | null = null;
  for (const r of rows) {
    if (r.conv_id !== conv) {
      conv = r.conv_id;
      open = null;
    }
    const k = r.owner_id ?? '';
    const a = (acc[k] ??= { convs: new Set(), inMsgs: 0, outMsgs: 0, mins: [] });
    a.convs.add(r.conv_id);
    const t = Date.parse(r.at);
    if (r.from_me) {
      a.outMsgs++;
      if (open !== null) {
        a.mins.push(Math.max(0, (t - open) / 60000));
        open = null;
      }
    } else {
      a.inMsgs++;
      if (open === null) open = t;
    }
  }
  const out: Record<string, RespStat> = {};
  for (const [k, a] of Object.entries(acc)) {
    const m = [...a.mins].sort((x, y) => x - y);
    const n = m.length;
    out[k] = {
      convs: a.convs.size,
      inMsgs: a.inMsgs,
      outMsgs: a.outMsgs,
      replies: n,
      avgMin: n ? Math.round((m.reduce((s, x) => s + x, 0) / n) * 10) / 10 : null,
      medianMin: n ? Math.round((n % 2 ? m[(n - 1) / 2]! : (m[n / 2 - 1]! + m[n / 2]!) / 2) * 10) / 10 : null,
      within15: n ? Math.round((m.filter((x) => x <= 15).length / n) * 100) : null,
      over60: m.filter((x) => x > 60).length,
    };
  }
  return out;
}

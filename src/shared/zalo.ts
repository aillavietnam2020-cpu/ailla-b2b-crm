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
/** Mặc định chị Hoa duyệt 27/11 (bản demo "Cài AI soạn sẵn"). */
const SENSITIVE = ['hoàn tiền', 'trả hàng', 'khiếu nại', 'lừa đảo', 'kiện', 'luật sư', 'công an', 'báo chí', 'tố cáo', 'bồi thường', 'huỷ hợp đồng', 'hàng lỗi'];
export const ORDER_WORDS = ['lấy', 'đặt', 'chốt', 'gửi cho anh', 'gửi cho chị', 'lên đơn', 'ship cho'];
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
const words = (s: string) => ' ' + s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
/** Cụm vô hại chứa từ khóa ngắn: bỏ trước khi so ("ý kiến" ≠ "kiện", "kiện hàng" là gói hàng). */
const SAFE = ['kiện hàng', 'ý kiến'];
/**
 * Tin có trúng từ nào trong danh sách không. So theo nguyên chữ (ranh giới chữ), không cắt giữa chữ.
 * Từ một tiếng có dấu (kiện, lấy, đặt…) so giữ dấu để không bắt nhầm (kiện ≠ kiến); khách gõ không dấu thì so bỏ dấu.
 * Cụm nhiều tiếng thì so bỏ dấu (hủy / huỷ hợp đồng đều trúng).
 */
export function kwHit(text: string, list: string[]): string | null {
  let t = words(String(text ?? ''));
  for (const x of SAFE) t = t.split(' ' + x + ' ').join(' ');
  const tf = fold(t);
  const plain = tf === t; // khách gõ không dấu
  for (const w of list) {
    const k = words(w).trim();
    if (!k) continue;
    const exact = !plain && !k.includes(' ') && fold(k) !== k;
    if (exact ? t.includes(' ' + k + ' ') : tf.includes(' ' + fold(k) + ' ')) return w;
  }
  return null;
}
export function aiSensitive(t: string, list: string[] = SENSITIVE): string | null {
  return kwHit(t, list);
}
/** Có số lượng: con số + thùng / chai / can / hộp / bao / gói / két / túi (có dấu hoặc không). */
export function hasQty(t: string): boolean {
  return /(^|[^\p{L}\p{N}])\d+\s*(thùng|thung|chai|can|hộp|hop|bao|gói|goi|két|ket|túi|tui)(?![\p{L}])/iu.test(String(t ?? ''));
}
export type OrderMode = 'off' | 'clear' | 'ask';
/**
 * Khi nào gợi ý lên đơn (chị Hoa duyệt 27/11): "rõ" = có từ đặt hàng VÀ có số lượng.
 * Chế độ "ask": khách nhắc số lượng thì hỏi sale có tạo đơn nháp không. Chỉ gợi ý; sale bấm mới mở trang Tạo đơn.
 */
export function orderSignal(text: string, mode: OrderMode, orderWords: string[]): { kind: 'order' | 'ask' | null; word: string | null; reason: string } | null {
  if (mode === 'off') return null;
  const word = kwHit(text, orderWords);
  const qty = hasQty(text);
  if (word && qty) return { kind: 'order', word, reason: `Khách đặt hàng (có "${word}" và số lượng).` };
  if (mode === 'ask' && qty) return { kind: 'ask', word, reason: 'Khách nhắc số lượng, có vẻ muốn mua.' };
  return { kind: null, word, reason: !word ? 'Không gợi ý đơn: tin không có từ đặt hàng.' : 'Không gợi ý đơn: tin không có số lượng.' };
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

/* ------------------------------------------------------------------ cài đặt "AI soạn sẵn" (27/11, theo mẫu ZL-CRM) */
export interface ZaloAiCfg {
  enabled: boolean;
  /** Nick áp dụng; trống = mọi nick. */
  nick_ids: string[];
  /** Khung giờ AI soạn (giờ Việt Nam), 0–24. */
  hour_start: number;
  hour_end: number;
  max_per_day: number;
  /** Sale vừa trả lời trong N phút thì AI tạm lùi (0 = tắt). */
  skip_staff_min: number;
  /** Khách nhắn liên tiếp: nghỉ N giây giữa hai nháp cùng hội thoại (0 = tắt). */
  min_gap_sec: number;
  /** Nháp cũ hơn N phút thì soạn lại. */
  ttl_min: number;
  /** Khách nhắn trúng các từ này thì AI không soạn, để người thật xử lý. */
  blocked: string[];
  /** Lời dặn riêng cho AI (thêm vào mọi lần soạn). */
  extra: string;
  /** Khách kênh phân phối: nhờ agent CSKH B2B soạn câu trả lời. */
  agent_b2b: boolean;
  /** Khi nào gợi ý lên đơn: tắt / chỉ khi khách nói rõ muốn đặt / hỏi sale khi khách có vẻ muốn mua. */
  order_mode: OrderMode;
  /** Từ báo hiệu khách đặt hàng (phải kèm số lượng). */
  order_words: string[];
}
/** Mặc định theo bản demo chị Hoa duyệt 27/11. */
export const ZALO_AI_DEFAULT: ZaloAiCfg = {
  enabled: true,
  nick_ids: [],
  hour_start: 7,
  hour_end: 21,
  max_per_day: 200,
  skip_staff_min: 3,
  min_gap_sec: 90,
  ttl_min: 120,
  blocked: SENSITIVE,
  extra: 'Xưng "em", gọi khách là anh/chị. Trả lời ngắn như nhắn Zalo, tối đa 4 câu.\nGiá chỉ lấy theo Bảng giá đúng cấp của khách, không tự giảm giá.\nKhách hỏi chiết khấu riêng thì hẹn sale báo lại sau khi hỏi Lead.\nKhông nhắc đối thủ.',
  agent_b2b: true,
  order_mode: 'clear',
  order_words: ORDER_WORDS,
};
const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
export function mergeAiCfg(raw: unknown): ZaloAiCfg {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof ZaloAiCfg, unknown>>;
  const d = ZALO_AI_DEFAULT;
  const list = (v: unknown, max: number, len: number) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x ?? '').trim().slice(0, len)).filter(Boolean))].slice(0, max) : null);
  return {
    enabled: r.enabled === undefined ? d.enabled : !!r.enabled,
    nick_ids: list(r.nick_ids, 100, 64) ?? d.nick_ids,
    hour_start: num(r.hour_start, 0, 23, d.hour_start),
    hour_end: num(r.hour_end, 1, 24, d.hour_end),
    max_per_day: num(r.max_per_day, 1, 5000, d.max_per_day),
    skip_staff_min: num(r.skip_staff_min, 0, 600, d.skip_staff_min),
    min_gap_sec: num(r.min_gap_sec, 0, 3600, d.min_gap_sec),
    ttl_min: num(r.ttl_min, 5, 10080, d.ttl_min),
    blocked: list(r.blocked, 100, 60) ?? d.blocked,
    extra: String(r.extra ?? d.extra).slice(0, 2000),
    agent_b2b: r.agent_b2b === undefined ? d.agent_b2b : !!r.agent_b2b,
    order_mode: r.order_mode === 'off' || r.order_mode === 'ask' || r.order_mode === 'clear' ? r.order_mode : d.order_mode,
    order_words: list(r.order_words, 50, 40) ?? d.order_words,
  };
}
/** Giờ hiện tại theo giờ Việt Nam (0–23). */
export const vnHour = (ms = Date.now()) => new Date(ms + 7 * 3600_000).getUTCHours();
/** Cổng chặn trước khi soạn: trả về lời báo nếu không được soạn. */
export function aiGate(cfg: ZaloAiCfg, x: { nickId: string; now: number; todayDrafts: number; lastStaffAt: string | null }): string | null {
  if (!cfg.enabled) return 'off';
  if (cfg.nick_ids.length && !cfg.nick_ids.includes(x.nickId)) return 'off';
  const h = vnHour(x.now);
  const inHours = cfg.hour_start < cfg.hour_end ? h >= cfg.hour_start && h < cfg.hour_end : h >= cfg.hour_start || h < cfg.hour_end;
  if (!inHours) return `Ngoài giờ AI soạn (${cfg.hour_start}h–${cfg.hour_end}h).`;
  if (x.todayDrafts >= cfg.max_per_day) return `Hôm nay đã soạn đủ ${cfg.max_per_day} nháp (giới hạn trong Cài AI soạn sẵn).`;
  if (cfg.skip_staff_min && x.lastStaffAt && x.now - Date.parse(x.lastStaffAt) < cfg.skip_staff_min * 60_000) return `Sale vừa trả lời trong ${cfg.skip_staff_min} phút, AI tạm lùi.`;
  return null;
}
export interface PlaybookEntry {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  content: string;
  priority: number;
  enabled: number;
}
/** Chọn mục kịch bản đưa cho AI: mục khớp từ khóa trong tin khách gần đây trước, rồi mục không có từ khóa; theo ưu tiên; tối đa 6. */
export function pickPlaybook(entries: PlaybookEntry[], recent: string, max = 6): PlaybookEntry[] {
  const hit = (e: PlaybookEntry) => !!kwHit(recent, e.keywords);
  const on = entries.filter((e) => e.enabled);
  const a = on.filter(hit).sort((x, y) => y.priority - x.priority);
  const b = on.filter((e) => !e.keywords.length).sort((x, y) => y.priority - x.priority);
  return [...a, ...b.filter((e) => !a.includes(e))].slice(0, max);
}
export const playbookText = (list: PlaybookEntry[]) =>
  list.length ? 'KỊCH BẢN BÁN HÀNG ĐÃ DUYỆT (chỉ nêu giá, chính sách, cam kết theo đây và bảng giá):\n' + list.map((e) => `## ${e.title}${e.category ? ' (' + e.category + ')' : ''}\n${e.content.slice(0, 1500)}`).join('\n\n') : '';

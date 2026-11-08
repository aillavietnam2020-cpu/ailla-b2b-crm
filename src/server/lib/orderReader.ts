import type { Env } from '../env';

/**
 * Đọc đơn khách B2B gửi qua Zalo (ảnh đơn viết tay, ảnh chụp tin nhắn, hoặc tin nhắn chữ) bằng AI (9router).
 * Máy CHỈ đọc tên hàng + số lượng và chọn mã trong danh mục; giá luôn do web tính theo cấp khách.
 * Dòng nào máy không chắc thì đánh dấu để người lập đơn bấm chọn, không tự đoán.
 */
export interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  unit: string | null;
  pack_size: string | null;
}

export type LineStatus = 'OK' | 'WARN' | 'BAD';

export interface ReadLine {
  /** Chữ khách ghi cho dòng này, giữ nguyên để người lập đơn đối chiếu. */
  raw: string;
  qty: number | null;
  /** Đơn vị khách ghi: can, thùng, chai... (null nếu không ghi). */
  unit_written: string | null;
  /** Mã gợi ý theo thứ tự, đều có trong danh mục. */
  candidates: string[];
  status: LineStatus;
  /** Câu hỏi ngắn khi chưa chắc, ví dụ "5kg hay 2kg?". */
  question: string | null;
}

export interface ReadResult {
  customer_hint: string | null;
  delivery_note: string | null;
  note: string | null;
  lines: ReadLine[];
}

const MAX_CATALOG = 700;

export function buildPrompt(catalog: CatalogItem[], text: string | null, hasImage: boolean): string {
  const list = catalog
    .slice(0, MAX_CATALOG)
    .map((p) => `${p.sku} | ${p.name} | ${p.unit ?? ''}${p.pack_size ? ' | ' + p.pack_size : ''}`)
    .join('\n');
  return [
    'Bạn là nhân viên nhập đơn của công ty AILLA (nước giặt, nước rửa chén, nước lau sàn...).',
    `Khách sỉ (nhà phân phối, đại lý) gửi đơn qua Zalo${hasImage ? ' dưới dạng ảnh (viết tay hoặc chụp màn hình)' : ''}${text ? ', kèm tin nhắn' : ''}.`,
    'Việc của bạn: tách từng dòng hàng khách đặt và chọn mã sản phẩm đúng trong DANH MỤC bên dưới.',
    '',
    'Quy tắc:',
    '- Chỉ chọn mã có trong danh mục. Không bịa mã.',
    '- Mã có ĐVT "Thùng" là bán theo thùng; mã đuôi "-C" thường là bán lẻ từng can/chai. Khách ghi "thùng"/"th" thì ưu tiên mã thùng, ghi "can"/"chai" thì ưu tiên mã lẻ.',
    '- Nếu khách ghi thiếu (không rõ 5kg hay 2kg, không rõ mùi hương, không có đơn vị), đặt "sure": false, đưa 2-3 mã có thể vào "candidates" và hỏi một câu ngắn trong "question".',
    '- Không thấy mã nào hợp thì "candidates": [] và "sure": false.',
    '- Số lượng là số khách ghi cho dòng đó (số nguyên). Không đọc được thì null.',
    '- Bỏ qua giá tiền khách ghi (nếu có): web tự tính giá.',
    '- Dòng không phải hàng (lời chào, địa chỉ, hẹn ngày giao) không đưa vào "lines".',
    '',
    'Chỉ trả về MỘT khối JSON, không giải thích:',
    '{"customer_hint": tên khách/cửa hàng nếu thấy, "delivery_note": yêu cầu giao hàng (ngày, nơi) nếu có, "note": ghi chú khác của khách nếu có,',
    ' "lines": [{"raw": chữ khách ghi, "qty": số, "unit_written": đơn vị khách ghi, "candidates": ["MÃ1","MÃ2"], "sure": true|false, "question": câu hỏi hoặc null}]}',
    '',
    'DANH MỤC (mã | tên | ĐVT | quy cách):',
    list,
    text ? `\nTIN NHẮN CỦA KHÁCH:\n${text.slice(0, 4000)}` : '',
  ].join('\n');
}

export function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const str = (v: unknown, max = 300): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s && s.toLowerCase() !== 'null' ? s.slice(0, max) : null;
};

export function normalizeRead(j: Record<string, unknown>, catalog: CatalogItem[]): ReadResult {
  const bySku = new Map(catalog.map((p) => [p.sku.toUpperCase(), p.sku]));
  const rawLines = Array.isArray(j.lines) ? j.lines.slice(0, 60) : [];
  const lines: ReadLine[] = [];
  for (const r of rawLines) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const raw = str(o.raw, 200) ?? '';
    const qn = Number(String(o.qty ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
    const qty = Number.isFinite(qn) && qn > 0 ? Math.round(qn) : null;
    const cands: string[] = [];
    for (const c of Array.isArray(o.candidates) ? o.candidates : []) {
      const sku = bySku.get(String(c).trim().toUpperCase());
      if (sku && !cands.includes(sku)) cands.push(sku);
      if (cands.length >= 4) break;
    }
    const sure = o.sure === true;
    const status: LineStatus = cands.length === 0 ? 'BAD' : sure && cands.length >= 1 && qty !== null ? 'OK' : 'WARN';
    let question = str(o.question, 160);
    if (status === 'WARN' && !question) question = qty === null ? 'Chưa đọc được số lượng' : 'Máy chưa chắc mã này';
    if (status === 'BAD' && !question) question = 'Không thấy hàng này trong danh mục';
    if (!raw && !cands.length) continue;
    lines.push({ raw, qty, unit_written: str(o.unit_written, 30), candidates: status === 'OK' ? cands.slice(0, 1) : cands, status, question: status === 'OK' ? null : question });
  }
  return {
    customer_hint: str(j.customer_hint, 120),
    delivery_note: str(j.delivery_note, 300),
    note: str(j.note, 500),
    lines,
  };
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}

/** Gọi 9router (OpenAI-compatible), trả về chữ máy viết. */
async function callAi(env: Env, content: unknown[]): Promise<string> {
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = env;
  if (!AI_BASE_URL || !AI_API_KEY) throw new Error('AI_NOT_CONFIGURED');
  const res = await fetch(`${AI_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL || 'web',
      stream: false,
      temperature: 0,
      max_tokens: 2500,
      messages: [{ role: 'user', content }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`AI_HTTP_${res.status}`);
  let text = '';
  if (raw.trimStart().startsWith('data:')) {
    for (const line of raw.split(/\r?\n/)) {
      const payload = line.slice(5).trim();
      if (!line.startsWith('data:') || !payload || payload === '[DONE]') continue;
      try {
        const chunk = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
        for (const ch of chunk.choices ?? []) text += ch.delta?.content ?? '';
      } catch {
        /* bỏ đoạn lỗi */
      }
    }
  } else {
    const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    text = data.choices?.[0]?.message?.content ?? '';
  }
  return text;
}

export async function readOrder(
  env: Env,
  catalog: CatalogItem[],
  input: { text: string | null; image: { bytes: Uint8Array; mime: string } | null },
): Promise<ReadResult> {
  const content: unknown[] = [{ type: 'text', text: buildPrompt(catalog, input.text, !!input.image) }];
  if (input.image) content.push({ type: 'image_url', image_url: { url: `data:${input.image.mime};base64,${toBase64(input.image.bytes)}` } });
  const out = await callAi(env, content);
  const json = extractJson(out);
  if (!json) throw new Error('AI_BAD_OUTPUT');
  return normalizeRead(json, catalog);
}

/** Bỏ dấu tiếng Việt + chữ thường, để so tên khách/nhóm Zalo. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

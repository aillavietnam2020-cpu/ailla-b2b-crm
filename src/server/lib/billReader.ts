import type { Env } from '../env';

/**
 * Đọc ảnh bill chuyển khoản bằng AI (9router trên VPS, combo có mô hình đọc được ảnh).
 * Kết quả CHỈ để điền sẵn vào form cho sale kiểm lại; không bao giờ tự ghi tiền.
 */
export interface BillReadResult {
  readable: boolean;
  amount: number | null;
  /** yyyy-mm-dd */
  paid_date: string | null;
  /** HH:MM hoặc HH:MM:SS nếu đọc được */
  paid_time: string | null;
  bank_ref: string | null;
  to_account: string | null;
  to_name: string | null;
  to_bank: string | null;
  sender_name: string | null;
  content: string | null;
  note: string | null;
}

const PROMPT = [
  'Bạn đọc ảnh chụp màn hình/biên lai chuyển khoản ngân hàng Việt Nam.',
  'Chỉ trả về MỘT khối JSON, không giải thích, với các khóa sau (không thấy thì null):',
  '{"is_bank_transfer": true|false,',
  ' "amount": số tiền VND là số nguyên không dấu phân cách,',
  ' "paid_at": "YYYY-MM-DD HH:MM:SS" (thời điểm giao dịch),',
  ' "ref": số tham chiếu / mã giao dịch / mã FT của giao dịch,',
  ' "to_account": số tài khoản người nhận (chỉ chữ số),',
  ' "to_name": tên người/công ty nhận,',
  ' "to_bank": ngân hàng người nhận,',
  ' "sender_name": tên người chuyển nếu có,',
  ' "content": nội dung chuyển khoản}',
  'Không đoán. Chữ số phải đúng từng ký tự như trên ảnh.',
].join('\n');

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, 300) : null;
};

export function normalizeBillJson(j: Record<string, unknown>): BillReadResult {
  const amountRaw = str(j.amount);
  let amount: number | null = null;
  if (amountRaw) {
    const digits = amountRaw.replace(/[^\d]/g, '');
    const n = Number(digits);
    amount = digits && Number.isFinite(n) && n > 0 ? n : null;
  }
  const at = str(j.paid_at);
  let date: string | null = null;
  let time: string | null = null;
  if (at) {
    const iso = at.match(/(\d{4})-(\d{2})-(\d{2})/);
    const vn = at.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (iso) date = `${iso[1]}-${iso[2]}-${iso[3]}`;
    else if (vn) date = `${vn[3]}-${vn[2].padStart(2, '0')}-${vn[1].padStart(2, '0')}`;
    const t = at.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (t) time = `${t[1].padStart(2, '0')}:${t[2]}${t[3] ? ':' + t[3] : ''}`;
  }
  const toAccount = str(j.to_account)?.replace(/[^\d]/g, '') || null;
  const ref = str(j.ref)?.replace(/\s+/g, '') || null;
  const isTransfer = j.is_bank_transfer !== false;
  return {
    readable: isTransfer && (amount !== null || ref !== null),
    amount,
    paid_date: date,
    paid_time: time,
    bank_ref: ref,
    to_account: toAccount,
    to_name: str(j.to_name),
    to_bank: str(j.to_bank),
    sender_name: str(j.sender_name),
    content: str(j.content),
    note: isTransfer ? null : 'Ảnh này không giống bill chuyển khoản',
  };
}

/** Gọi 9router; ném lỗi có thông điệp tiếng Việt để hiện cho sale. */
export async function readBillImage(env: Env, bytes: Uint8Array, mime: string): Promise<BillReadResult> {
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = env;
  if (!AI_BASE_URL || !AI_API_KEY) throw new Error('AI_NOT_CONFIGURED');
  const res = await fetch(`${AI_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL || 'web',
      stream: false,
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${toBase64(bytes)}` } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`AI_HTTP_${res.status}`);
  let text = '';
  if (raw.trimStart().startsWith('data:')) {
    // 9router có lúc trả kiểu stream dù đã xin stream=false: ghép các đoạn lại.
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
  const json = extractJson(text);
  if (!json) throw new Error('AI_BAD_OUTPUT');
  return normalizeBillJson(json);
}

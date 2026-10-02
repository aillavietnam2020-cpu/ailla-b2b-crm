import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, conflict, forbidden, notFound, ok } from '../lib/http';
import { requirePermission } from '../middleware/rbac';

/**
 * Khu Marketing & công việc (trang tĩnh /hub/).
 * Dữ liệu là một bản JSON chung cho cả team; ghi theo kiểu "cầm số phiên bản":
 * ai ghi sau mà cầm số cũ thì nhận 409, trình duyệt tự tải bản mới, áp lại thao tác rồi ghi lại.
 */
export const hubRoutes = new Hono<AppEnv>();

const STATE_ID = 'main';
const MAX_JSON = 8 * 1024 * 1024; // 8 MB JSON gốc (nén xong còn khoảng 1/8)
const BLOB_KEYS = ['t9file', 't9', 'kd', 'skucost', 'nhansu0'] as const;

async function pack(json: string): Promise<string> {
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function unpack(b64: string): Promise<string> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

const isHubAdmin = (role: string) => role === 'CEO';

hubRoutes.use('*', requirePermission('hub.access'));

/** Phiên bản hiện tại, để trình duyệt hỏi nhanh "có ai vừa sửa không" mà không tải cả dữ liệu. */
hubRoutes.get('/state/version', async (c) => {
  const row = await c.env.DB.prepare('SELECT version, updated_at FROM hub_state WHERE id = ?')
    .bind(STATE_ID)
    .first<{ version: number; updated_at: string }>();
  return ok(c, { version: row?.version ?? 0, updated_at: row?.updated_at ?? null });
});

hubRoutes.get('/state', async (c) => {
  const row = await c.env.DB.prepare('SELECT version, data, updated_at FROM hub_state WHERE id = ?')
    .bind(STATE_ID)
    .first<{ version: number; data: string; updated_at: string }>();
  if (!row) return ok(c, { version: 0, data: null, updated_at: null });
  return ok(c, { version: row.version, data: JSON.parse(await unpack(row.data)), updated_at: row.updated_at });
});

hubRoutes.put('/state', async (c) => {
  const auth = c.get('auth');
  const raw = await c.req.text();
  if (raw.length > MAX_JSON) throw badRequest('TOO_LARGE', 'Dữ liệu quá lớn');
  let body: { version?: unknown; data?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    throw badRequest('BAD_JSON', 'Dữ liệu gửi lên không đúng định dạng');
  }
  const base = Number(body.version);
  if (!Number.isInteger(base) || base < 0 || !body.data || typeof body.data !== 'object') {
    throw badRequest('BAD_STATE', 'Thiếu số phiên bản hoặc dữ liệu');
  }
  const packed = await pack(JSON.stringify(body.data));
  const now = nowIso();

  // Bản đầu tiên chỉ CEO được khởi tạo (tránh nhân viên vô tình tạo kho rỗng).
  if (base === 0) {
    if (!isHubAdmin(auth.user.role)) throw forbidden('Khu Marketing chưa được khởi tạo. Nhờ CEO mở trang trước.');
    const res = await c.env.DB.prepare(
      `INSERT INTO hub_state (id, version, data, updated_at, updated_by) VALUES (?, 1, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
    )
      .bind(STATE_ID, packed, now, auth.user.id)
      .run();
    if (!res.meta.changes) throw conflict('VERSION_CONFLICT', 'Đã có người khởi tạo trước');
    return ok(c, { version: 1, updated_at: now });
  }

  const res = await c.env.DB.prepare(
    `UPDATE hub_state SET version = version + 1, data = ?, updated_at = ?, updated_by = ?
     WHERE id = ? AND version = ?`,
  )
    .bind(packed, now, auth.user.id, STATE_ID, base)
    .run();
  if (!res.meta.changes) throw conflict('VERSION_CONFLICT', 'Có người vừa sửa trước, đang tải bản mới');
  return ok(c, { version: base + 1, updated_at: now });
});

/** Dữ liệu báo cáo nạp sẵn (TikTok tuần, kinh doanh các kênh, giá vốn). */
hubRoutes.get('/blob/:key', async (c) => {
  const key = c.req.param('key');
  if (!(BLOB_KEYS as readonly string[]).includes(key)) throw notFound();
  const row = await c.env.DB.prepare('SELECT data, admin_only FROM hub_blobs WHERE key = ?')
    .bind(key)
    .first<{ data: string; admin_only: number }>();
  if (!row) return ok(c, null);
  if (row.admin_only && !isHubAdmin(c.get('auth').user.role)) throw forbidden();
  return ok(c, JSON.parse(await unpack(row.data)));
});

hubRoutes.put('/blob/:key', async (c) => {
  const auth = c.get('auth');
  if (!isHubAdmin(auth.user.role)) throw forbidden();
  const key = c.req.param('key');
  if (!(BLOB_KEYS as readonly string[]).includes(key)) throw notFound();
  const raw = await c.req.text();
  if (raw.length > MAX_JSON) throw badRequest('TOO_LARGE', 'Dữ liệu quá lớn');
  const body = JSON.parse(raw) as { data: unknown; admin_only?: boolean };
  await c.env.DB.prepare(
    `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET data = excluded.data, admin_only = excluded.admin_only,
       updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  )
    .bind(key, await pack(JSON.stringify(body.data)), body.admin_only === false ? 0 : 1, nowIso(), auth.user.id)
    .run();
  return ok(c, { ok: true });
});

/**
 * Trợ lý AI: máy chủ gọi 9router trên VPS (gom gói tháng Claude/ChatGPT), khoá để ở secret của Worker,
 * trình duyệt không bao giờ thấy khoá.
 */
hubRoutes.post('/ai', async (c) => {
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = c.env;
  if (!AI_BASE_URL || !AI_API_KEY) {
    throw badRequest('AI_NOT_CONFIGURED', 'Máy chủ chưa được nối với 9router. Báo quản trị để cài đặt.');
  }
  const body = (await c.req.json().catch(() => ({}))) as { system?: string; user?: string; model?: string };
  const system = String(body.system ?? '').slice(0, 20000);
  const user = String(body.user ?? '').slice(0, 60000);
  if (!user) throw badRequest('EMPTY', 'Chưa có nội dung để hỏi');
  const model = (body.model && /^[\w.\-]{1,80}$/.test(body.model) ? body.model : AI_MODEL) || 'Combo_Content';

  const res = await fetch(`${AI_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(240_000),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error('[hub/ai] 9router', res.status, raw.slice(0, 300));
    throw badRequest('AI_FAILED', `9router báo lỗi ${res.status}. Thử lại sau ít phút.`);
  }
  let text = '';
  let used = model;
  if (raw.trimStart().startsWith('data:')) {
    // 9router có lúc trả kiểu stream dù đã xin stream=false: ghép các đoạn lại.
    for (const line of raw.split(/\r?\n/)) {
      const payload = line.slice(5).trim();
      if (!line.startsWith('data:') || !payload || payload === '[DONE]') continue;
      const chunk = JSON.parse(payload) as { model?: string; choices?: Array<{ delta?: { content?: string } }> };
      used = chunk.model ?? used;
      for (const ch of chunk.choices ?? []) text += ch.delta?.content ?? '';
    }
  } else {
    const data = JSON.parse(raw) as { model?: string; choices: Array<{ message: { content: string } }> };
    used = data.model ?? used;
    text = data.choices[0]?.message.content ?? '';
  }
  return ok(c, { text: text.trim(), model: used });
});

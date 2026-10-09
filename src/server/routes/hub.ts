import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { pack, unpack } from '../lib/pack';
import { badRequest, conflict, forbidden, notFound, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import type { AuthContext } from '../env';
import { requirePermission } from '../middleware/rbac';
import { canHr, hrFromUsers } from '../lib/hrAccess';

/**
 * Khu Marketing & công việc (trang tĩnh /hub/).
 * Dữ liệu là một bản JSON chung cho cả team; ghi theo kiểu "cầm số phiên bản":
 * ai ghi sau mà cầm số cũ thì nhận 409, trình duyệt tự tải bản mới, áp lại thao tác rồi ghi lại.
 */
export const hubRoutes = new Hono<AppEnv>();

const STATE_ID = 'main';
const MAX_JSON = 8 * 1024 * 1024; // 8 MB JSON gốc (nén xong còn khoảng 1/8)
const SECURE_ID = 'secure';
const BLOB_KEYS = ['t9file', 't9', 'kd', 'kd_ads', 'kd_sale', 'skucost', 'nhansu0', 'ads_live'] as const;
/**
 * Phần dữ liệu tài chính (giá vốn SKU, chi phí tháng, mục tiêu doanh số) tách sang bản ghi riêng:
 * chỉ CEO và kế toán (quyền xem công nợ toàn công ty) đọc/ghi được; người khác không nhận về,
 * gửi lên cũng bị bỏ qua.
 */
const SECURE_KEYS = ['skus', 'costs', 'targets'] as const;
const canSecret = (auth: AuthContext) => auth.user.role === 'CEO' || auth.permissions.includes('debt.read.all');

function splitSecure(data: Record<string, unknown>) {
  const secure: Record<string, unknown> = {};
  for (const k of SECURE_KEYS) {
    if (k in data) secure[k] = data[k];
    delete data[k];
  }
  return secure;
}

/**
 * Dữ liệu nhân sự (d.hr: hồ sơ, lương, CCCD, ngân hàng, hợp đồng, chấm công, bảng lương...) cất ở bản ghi 'hr'.
 * Chỉ người được phép (lib/hrAccess) nhận về và ghi được. Đơn từ, KPI tự đánh giá, tuyển dụng, đào tạo
 * vẫn ở bản chung vì nhân viên tự gửi.
 */
const HR_ID = 'hr';
const HR_PUBLIC = ['don', 'kpi', 'td', 'dt'];
function splitHr(data: Record<string, unknown>) {
  const hr = data.hr as Record<string, unknown> | undefined;
  if (!hr || typeof hr !== 'object') return {};
  const sec: Record<string, unknown> = {};
  const pub: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(hr)) (HR_PUBLIC.includes(k) ? pub : sec)[k] = v;
  data.hr = pub;
  return sec;
}
const hrHasData = (h: Record<string, unknown>) =>
  !!h.loaded || ['ns', 'cc', 'payroll', 'phep'].some((k) => h[k] && Object.keys(h[k] as object).length > 0);

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
  const auth = c.get('auth');
  const data = JSON.parse(await unpack(row.data)) as Record<string, unknown>;
  // Bản cũ có thể còn lẫn số tài chính: luôn gạt ra trước. Chưa có ngăn riêng thì CEO/kế toán nhận lại
  // đúng số cũ đó, lần ghi kế tiếp sẽ tự chuyển sang ngăn riêng.
  const legacy = splitSecure(data);
  if (canSecret(auth)) {
    const sec = await c.env.DB.prepare('SELECT data FROM hub_state WHERE id = ?').bind(SECURE_ID).first<{ data: string }>();
    Object.assign(data, sec ? JSON.parse(await unpack(sec.data)) : legacy);
  }
  // Nhân sự: bản cũ còn nằm trong bản chung thì chuyển sang ngăn riêng ngay lần đọc đầu tiên.
  const hrOk = hrFromUsers(auth, data.users as never);
  const hrLegacy = splitHr(data);
  let hrRow = await c.env.DB.prepare('SELECT data FROM hub_state WHERE id = ?').bind(HR_ID).first<{ data: string }>();
  if (!hrRow && hrHasData(hrLegacy)) {
    const packed = await pack(JSON.stringify(hrLegacy));
    await c.env.DB.prepare(
      `INSERT INTO hub_state (id, version, data, updated_at, updated_by) VALUES (?, 1, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    )
      .bind(HR_ID, packed, nowIso(), auth.user.id)
      .run();
    hrRow = { data: packed };
  }
  if (hrOk && hrRow) data.hr = Object.assign(data.hr as object, JSON.parse(await unpack(hrRow.data)));
  await auditStatement(c.env.DB, {
    actorId: auth.user.id,
    action: 'HUB_READ',
    entityType: 'HUB',
    entityId: canSecret(auth) ? 'state+finance' : 'state',
    ip: c.req.header('CF-Connecting-IP') ?? null,
    requestId: c.get('requestId'),
  }).run();
  return ok(c, { version: row.version, data, updated_at: row.updated_at, hr_ok: hrOk });
});

hubRoutes.put('/state', async (c) => {
  const auth = c.get('auth');
  const raw = await c.req.text();
  if (raw.length > MAX_JSON) throw badRequest('TOO_LARGE', 'Dữ liệu quá lớn');
  let body: { version?: unknown; data?: unknown; hr?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    throw badRequest('BAD_JSON', 'Dữ liệu gửi lên không đúng định dạng');
  }
  const base = Number(body.version);
  if (!Number.isInteger(base) || base < 0 || !body.data || typeof body.data !== 'object') {
    throw badRequest('BAD_STATE', 'Thiếu số phiên bản hoặc dữ liệu');
  }
  const data = body.data as Record<string, unknown>;
  const secure = splitSecure(data);
  const hrSec = splitHr(data);
  const packed = await pack(JSON.stringify(data));
  const now = nowIso();
  const saveSecure = async () => {
    if (!canSecret(auth) || Object.keys(secure).length === 0) return;
    await c.env.DB.prepare(
      `INSERT INTO hub_state (id, version, data, updated_at, updated_by) VALUES (?, 1, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET version = hub_state.version + 1, data = excluded.data,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    )
      .bind(SECURE_ID, await pack(JSON.stringify(secure)), now, auth.user.id)
      .run();
  };
  const saveHr = async () => {
    // Trang cũ còn mở từ trước khi tách ngăn: lần ghi đầu tiên cất luôn phần nhân sự (chưa có ngăn mới cất).
    if (hrHasData(hrSec)) {
      await c.env.DB.prepare(
        `INSERT INTO hub_state (id, version, data, updated_at, updated_by) VALUES (?, 1, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      )
        .bind(HR_ID, await pack(JSON.stringify(hrSec)), now, auth.user.id)
        .run();
    }
    // Trình duyệt chỉ gửi phần nhân sự khi đã nhận được nó (hr_ok); không có quyền thì bỏ qua.
    if (!(body as { hr?: unknown }).hr || Object.keys(hrSec).length === 0) return;
    if (!(await canHr(c.env.DB, auth))) return;
    await c.env.DB.prepare(
      `INSERT INTO hub_state (id, version, data, updated_at, updated_by) VALUES (?, 1, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET version = hub_state.version + 1, data = excluded.data,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    )
      .bind(HR_ID, await pack(JSON.stringify(hrSec)), now, auth.user.id)
      .run();
  };

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
    await saveSecure();
    await saveHr();
    return ok(c, { version: 1, updated_at: now });
  }

  const res = await c.env.DB.prepare(
    `UPDATE hub_state SET version = version + 1, data = ?, updated_at = ?, updated_by = ?
     WHERE id = ? AND version = ?`,
  )
    .bind(packed, now, auth.user.id, STATE_ID, base)
    .run();
  if (!res.meta.changes) throw conflict('VERSION_CONFLICT', 'Có người vừa sửa trước, đang tải bản mới');
  await saveSecure();
  await saveHr();
  return ok(c, { version: base + 1, updated_at: now });
});

/**
 * Kho Sản xuất trừ tồn theo đơn B2B ngay lúc đơn được bấm "Đã xuất kho" trên CRM (cùng máy chủ, không qua Sheet).
 * Chỉ trả số lượng theo mã hàng, không kèm giá hay tên khách.
 */
hubRoutes.get('/b2b-out', async (c) => {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('from') ?? '') ? (c.req.query('from') as string) : '2000-01-01';
  const rows = await c.env.DB.prepare(
    `SELECT o.order_no, o.delivery_status, o.delivered_at, p.sku, p.name, p.unit, oi.qty
     FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id
     WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
       AND o.delivery_status IN ('DA_XUAT_KHO', 'DA_GIAO') AND o.delivered_at >= ?
     ORDER BY o.delivered_at DESC LIMIT 5000`,
  )
    .bind(from)
    .all();
  return ok(c, rows.results ?? []);
});

/** Danh mục mã hàng CRM để kế toán quy đổi sang mã sản xuất (1 thùng = bao nhiêu sản phẩm). */
hubRoutes.get('/b2b-products', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT sku, name, unit FROM products WHERE deleted_at IS NULL AND active = 1 ORDER BY sku',
  ).all();
  return ok(c, rows.results ?? []);
});

/** Dữ liệu báo cáo nạp sẵn (TikTok tuần, kinh doanh các kênh, giá vốn). */
hubRoutes.get('/blob/:key', async (c) => {
  const key = c.req.param('key');
  if (!(BLOB_KEYS as readonly string[]).includes(key)) throw notFound();
  const row = await c.env.DB.prepare('SELECT data, admin_only FROM hub_blobs WHERE key = ?')
    .bind(key)
    .first<{ data: string; admin_only: number }>();
  if (!row) return ok(c, null);
  // Số liệu riêng tư (doanh thu đầy đủ, giá vốn, danh sách nhân sự): chỉ CEO và kế toán.
  const auth = c.get('auth');
  if (row.admin_only && !canSecret(auth)) throw forbidden();
  if (key !== 'ads_live') await auditStatement(c.env.DB, {
    actorId: auth.user.id,
    action: 'HUB_READ',
    entityType: 'HUB_BLOB',
    entityId: key,
    ip: c.req.header('CF-Connecting-IP') ?? null,
    requestId: c.get('requestId'),
  }).run();
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

/**
 * Hỏi AI trong web: nhân sự hỏi bằng lời thường, trình duyệt gửi kèm bản tóm tắt số liệu đã tính sẵn
 * (không gửi nguyên dữ liệu), máy chủ chặn theo số câu mỗi ngày rồi hỏi 9router.
 * Mỗi ngày: nhân viên 10 câu, trưởng nhóm / trưởng phòng 20 câu, CEO 50 câu (giờ Việt Nam).
 */
const ASK_LIMIT_DEFAULT = 10;
const ASK_LIMITS: Record<string, number> = { admin: 50, lead: 20, truongphong: 20 };
const ASK_SYSTEM = [
  'Bạn là trợ lý của Ailla Việt Nam, trả lời nhân sự trong công ty về công việc của họ dựa trên phần DỮ LIỆU được gửi kèm.',
  'Quy tắc:',
  '- Trả lời bằng tiếng Việt, ngắn gọn, đi thẳng vào câu hỏi trước, sau đó tối đa 3 gạch đầu dòng nếu cần.',
  '- Chỉ dùng số trong DỮ LIỆU. Số nào DỮ LIỆU đã tính sẵn thì dùng nguyên văn, không tự tính lại. Chỉ được cộng trừ đơn giản khi cần tổng.',
  '- Không có trong DỮ LIỆU thì nói rõ "web chưa có số này", tuyệt đối không bịa hay đoán số.',
  '- Nói rõ tên sản phẩm, tên kênh, đơn vị (video, đơn, view) và khoảng thời gian của số bạn nêu.',
  '- Giải thích bằng lời đời thường, không dùng thuật ngữ kỹ thuật. Không dùng bảng markdown.',
  '- "Còn cần làm" = kế hoạch tháng trừ video dùng tồn trừ video đã có hoặc đang làm. "Hiệu quả" là view, đơn, GMV của video đã đăng.',
].join('\n');

const vnDay = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

async function askWho(c: { get: (k: 'auth') => AuthContext; env: AppEnv['Bindings'] }) {
  const auth = c.get('auth');
  let role = auth.user.role === 'CEO' ? 'admin' : 'nhanvien';
  const row = await c.env.DB.prepare('SELECT data FROM hub_state WHERE id = ?').bind(STATE_ID).first<{ data: string }>();
  if (row) {
    try {
      const d = JSON.parse(await unpack(row.data)) as { users?: Array<{ crm?: string; role?: string; active?: boolean }> };
      const u = d.users?.find((x) => x.crm === auth.user.id && x.active !== false);
      if (u?.role) role = u.role;
    } catch {
      /* giữ vai trò mặc định */
    }
  }
  return { id: auth.user.id, limit: ASK_LIMITS[role] ?? ASK_LIMIT_DEFAULT };
}

type AskUsage = { date: string; counts: Record<string, number> };
async function askUsageRead(db: D1Database): Promise<AskUsage> {
  const row = await db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind('ai_usage').first<{ data: string }>();
  let u: AskUsage = { date: vnDay(), counts: {} };
  if (row) {
    try {
      const p = JSON.parse(row.data) as AskUsage;
      if (p.date === vnDay() && p.counts) u = p;
    } catch {
      /* bắt đầu lại */
    }
  }
  return u;
}
async function askUsageWrite(db: D1Database, u: AskUsage, userId: string) {
  await db
    .prepare(
      `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES ('ai_usage', ?, 1, ?, ?)
       ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    )
    .bind(JSON.stringify(u), nowIso(), userId)
    .run();
}

hubRoutes.get('/ask/quota', async (c) => {
  const who = await askWho(c);
  const u = await askUsageRead(c.env.DB);
  const used = u.counts[who.id] ?? 0;
  return ok(c, { limit: who.limit, used, left: Math.max(0, who.limit - used) });
});

hubRoutes.post('/ask', async (c) => {
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = c.env;
  if (!AI_BASE_URL || !AI_API_KEY) {
    throw badRequest('AI_NOT_CONFIGURED', 'Máy chủ chưa được nối với AI. Báo quản trị để cài đặt.');
  }
  const body = (await c.req.json().catch(() => ({}))) as { question?: string; pack?: string };
  const question = String(body.question ?? '').trim().slice(0, 600);
  const dataPack = String(body.pack ?? '').slice(0, 16000);
  if (!question) throw badRequest('EMPTY', 'Chưa có câu hỏi');

  const who = await askWho(c);
  const usage = await askUsageRead(c.env.DB);
  const used = usage.counts[who.id] ?? 0;
  if (used >= who.limit) {
    throw badRequest('ASK_LIMIT', `Hôm nay bạn đã hỏi đủ ${who.limit} câu. Sáng mai sẽ hỏi tiếp được.`);
  }
  usage.counts[who.id] = used + 1;
  await askUsageWrite(c.env.DB, usage, who.id);

  const refund = async () => {
    const u = await askUsageRead(c.env.DB);
    u.counts[who.id] = Math.max(0, (u.counts[who.id] ?? 1) - 1);
    await askUsageWrite(c.env.DB, u, who.id);
  };

  try {
    const res = await fetch(`${AI_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL || 'Combo_Content',
        stream: false,
        temperature: 0.2,
        messages: [
          { role: 'system', content: ASK_SYSTEM },
          { role: 'user', content: `DỮ LIỆU:\n${dataPack}\n\nCÂU HỎI: ${question}` },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.error('[hub/ask] 9router', res.status, raw.slice(0, 300));
      throw badRequest('AI_FAILED', `AI báo lỗi ${res.status}. Thử lại sau ít phút, câu hỏi này không bị tính.`);
    }
    let text = '';
    if (raw.trimStart().startsWith('data:')) {
      for (const line of raw.split(/\r?\n/)) {
        const payload = line.slice(5).trim();
        if (!line.startsWith('data:') || !payload || payload === '[DONE]') continue;
        const chunk = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
        for (const ch of chunk.choices ?? []) text += ch.delta?.content ?? '';
      }
    } else {
      const data = JSON.parse(raw) as { choices: Array<{ message: { content: string } }> };
      text = data.choices[0]?.message.content ?? '';
    }
    if (!text.trim()) throw badRequest('AI_EMPTY', 'AI chưa trả lời được, thử lại, câu hỏi này không bị tính.');
    return ok(c, { text: text.trim(), limit: who.limit, left: Math.max(0, who.limit - (used + 1)) });
  } catch (e) {
    await refund();
    throw e;
  }
});

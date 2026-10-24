import { Hono } from 'hono';
import type { Context } from 'hono';
import { nowIso } from '@shared/datetime';
import { maskPersonal, parseFbPageId } from '@shared/agentTrain';
import { emptyDoc, normalizeDoc, simulate, validateDoc, type BotDoc, type SimState } from '@shared/agentFlow';
import type { AppEnv } from '../env';
import { newId } from '../lib/ids';
import { forbidden, badRequest, conflict, notFound, ok, unauthorized, unprocessable } from '../lib/http';
import { requirePermission } from '../middleware/rbac';

/**
 * Huấn luyện bot bán hàng trên web.
 *  - /api/agent-train       : chị (CEO) tạo bot, sửa bản nháp (câu mẫu, luồng, giá, ảnh, bám đuổi, quy tắc), chạy mô phỏng,
 *                             xuất bản / quay lại phiên bản, gắn bot vào Page, nút tắt khẩn.
 *  - /api/agent-train-relay : công cụ trên VPS (khoá AGENT_RELAY_KEY) chỉ đọc phiên bản ĐANG DÙNG của bot gắn với Page và ghi nhật ký.
 * Agent không có đường nào để tự sửa nháp hay tự xuất bản. Không có chế độ gửi cho khách thật.
 */

const CTL_KEY = 'agent_train_ctl';
const MAX_DOC_BYTES = 600_000;
type Ctl = {
  kill: boolean;
  testers: string;
  /** Nhân viên nhắn tay thì agent im bao nhiêu phút. */
  silent_minutes: number;
  /** Khung giờ agent được trả lời ("HH:MM"; trống = cả ngày). */
  hours_from: string;
  hours_to: string;
  updated_at: string | null;
};
const CTL_DEFAULT: Ctl = { kill: false, testers: '', silent_minutes: 30, hours_from: '', hours_to: '', updated_at: null };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

async function readCtl(c: Context<AppEnv>): Promise<Ctl> {
  const r = await c.env.DB.prepare('SELECT v FROM app_kv WHERE k = ?').bind(CTL_KEY).first<{ v: string }>();
  if (!r) return CTL_DEFAULT;
  try {
    const j = JSON.parse(r.v) as Partial<Ctl>;
    return { ...CTL_DEFAULT, ...j, kill: !!j.kill };
  } catch {
    return CTL_DEFAULT;
  }
}

async function logEvent(c: Context<AppEnv>, action: string, ref: string | number, detail = '') {
  await c.env.DB.prepare(`INSERT INTO agent_train_log (at, by_user, action, ref, detail) VALUES (?, ?, ?, ?, ?)`)
    .bind(nowIso(), c.get('auth').user.id, action, String(ref), detail.slice(0, 300))
    .run();
}

type BotRow = { id: string; name: string; draft: string; dirty: number; created_at: string; updated_at: string };

async function loadBot(c: Context<AppEnv>, id: string): Promise<BotRow> {
  const r = await c.env.DB.prepare('SELECT * FROM agent_train_bots WHERE id = ?').bind(id).first<BotRow>();
  if (!r) throw notFound('Không có bot này');
  return r;
}

const parseDoc = (s: string): BotDoc => normalizeDoc(JSON.parse(s));

function docFromBody(v: unknown): BotDoc {
  const doc = normalizeDoc(v);
  if (JSON.stringify(doc).length > MAX_DOC_BYTES) throw badRequest('TOO_BIG', 'Kịch bản quá lớn, hãy bớt ảnh hoặc câu mẫu không dùng.');
  return doc;
}

/* ---------- Chị dùng trên web ---------- */
export const agentTrainRoutes = new Hono<AppEnv>();
agentTrainRoutes.use('*', requirePermission('user.manage'));
agentTrainRoutes.use('*', async (c, next) => {
  if (c.get('auth').user.role !== 'CEO') throw forbidden('Chỉ chủ doanh nghiệp được huấn luyện agent.');
  await next();
});

/* --- Bot --- */
agentTrainRoutes.get('/bots', async (c) => {
  const bots = await c.env.DB.prepare(`SELECT id, name, draft, dirty, updated_at FROM agent_train_bots ORDER BY created_at`).all<BotRow>();
  const vers = await c.env.DB.prepare(`SELECT bot_id, version FROM agent_train_versions WHERE is_current = 1`).all<{ bot_id: string; version: number }>();
  const pages = await c.env.DB.prepare(`SELECT id, name, bot_id, mode FROM agent_train_pages`).all<{ id: number; name: string; bot_id: string | null; mode: string }>();
  const cur = new Map((vers.results ?? []).map((v) => [v.bot_id, v.version]));
  // Số lượt agent chạy 7 ngày qua theo kết quả (từ nhật ký agent), để hiện cạnh từng bot như thống kê của Webcake.
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const runRows = await c.env.DB.prepare(
    `SELECT bot_id, result, COUNT(*) AS n FROM agent_train_runs WHERE at >= ? AND bot_id IS NOT NULL GROUP BY bot_id, result`,
  )
    .bind(since)
    .all<{ bot_id: string; result: string; n: number }>();
  const runs = new Map<string, Record<string, number>>();
  for (const r of runRows.results ?? []) runs.set(r.bot_id, { ...(runs.get(r.bot_id) ?? {}), [r.result]: r.n });
  return ok(
    c,
    (bots.results ?? []).map((b) => {
      const d = parseDoc(b.draft);
      return {
        id: b.id,
        name: b.name,
        dirty: !!b.dirty,
        updated_at: b.updated_at,
        current_version: cur.get(b.id) ?? null,
        counts: { flows: d.flows.length, lib: d.lib.length, offers: d.offers.length },
        runs: { sent: 0, handoff: 0, blocked: 0, out_of_script: 0, ...(runs.get(b.id) ?? {}) },
        pages: (pages.results ?? []).filter((p) => p.bot_id === b.id),
      };
    }),
  );
});

agentTrainRoutes.post('/bots', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; from?: string };
  const name = text(b.name, 120);
  if (!name) throw badRequest('NO_NAME', 'Chưa gõ tên bot');
  let doc = emptyDoc();
  if (b.from) doc = parseDoc((await loadBot(c, String(b.from))).draft);
  const id = newId();
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO agent_train_bots (id, name, draft, dirty, created_by, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)`,
  )
    .bind(id, name, JSON.stringify(doc), c.get('auth').user.id, now, now)
    .run();
  await logEvent(c, 'bot.create', id, name + (b.from ? ' (nhân bản)' : ''));
  return ok(c, { id });
});

agentTrainRoutes.get('/bots/:id', async (c) => {
  const bot = await loadBot(c, c.req.param('id'));
  const vers = await c.env.DB.prepare(
    `SELECT v.version, v.note, v.published_at, v.is_current, u.display_name AS by_name
     FROM agent_train_versions v LEFT JOIN users u ON u.id = v.published_by WHERE v.bot_id = ? ORDER BY v.version DESC LIMIT 50`,
  )
    .bind(bot.id)
    .all();
  const draft = parseDoc(bot.draft);
  return ok(c, {
    id: bot.id,
    name: bot.name,
    dirty: !!bot.dirty,
    draft,
    issues: validateDoc(draft),
    versions: vers.results ?? [],
  });
});

/** Lưu bản nháp (tự lưu từ trang). Agent chưa thấy gì cho tới khi xuất bản. */
agentTrainRoutes.put('/bots/:id', async (c) => {
  const bot = await loadBot(c, c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; draft?: unknown };
  const name = b.name === undefined ? bot.name : text(b.name, 120);
  if (!name) throw badRequest('NO_NAME', 'Chưa gõ tên bot');
  const draft = b.draft === undefined ? parseDoc(bot.draft) : docFromBody(b.draft);
  await c.env.DB.prepare(`UPDATE agent_train_bots SET name = ?, draft = ?, dirty = 1, updated_at = ? WHERE id = ?`)
    .bind(name, JSON.stringify(draft), nowIso(), bot.id)
    .run();
  return ok(c, { issues: validateDoc(draft), dirty: true });
});

agentTrainRoutes.delete('/bots/:id', async (c) => {
  const bot = await loadBot(c, c.req.param('id'));
  const used = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM agent_train_pages WHERE bot_id = ?').bind(bot.id).first<{ n: number }>();
  if (used?.n) throw conflict('BOT_IN_USE', 'Bot đang gắn với Page. Gỡ khỏi Page trước khi xóa.');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM agent_train_versions WHERE bot_id = ?').bind(bot.id),
    c.env.DB.prepare('DELETE FROM agent_train_bots WHERE id = ?').bind(bot.id),
  ]);
  await logEvent(c, 'bot.delete', bot.id, bot.name);
  return ok(c, { ok: true });
});

async function publish(c: Context<AppEnv>, bot: BotRow, doc: BotDoc, note: string) {
  const issues = validateDoc(doc);
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length) throw unprocessable('DOC_INVALID', `Chưa xuất bản được: ${errors.length} lỗi cần sửa (${errors[0].msg})`);
  const last = await c.env.DB.prepare('SELECT MAX(version) AS v FROM agent_train_versions WHERE bot_id = ?').bind(bot.id).first<{ v: number | null }>();
  const version = (last?.v ?? 0) + 1;
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE agent_train_versions SET is_current = 0 WHERE bot_id = ?').bind(bot.id),
    c.env.DB.prepare(
      `INSERT INTO agent_train_versions (bot_id, version, data, note, published_by, published_at, is_current) VALUES (?, ?, ?, ?, ?, ?, 1)`,
    ).bind(bot.id, version, JSON.stringify(doc), note, c.get('auth').user.id, now),
    c.env.DB.prepare(`UPDATE agent_train_bots SET draft = ?, dirty = 0, updated_at = ? WHERE id = ?`).bind(JSON.stringify(doc), now, bot.id),
  ]);
  await logEvent(c, 'bot.publish', bot.id, `${bot.name}: bản ${version}${note ? ' · ' + note : ''}`);
  return { version, warnings: issues.filter((i) => i.level === 'warn') };
}

agentTrainRoutes.post('/bots/:id/publish', async (c) => {
  const bot = await loadBot(c, c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { note?: string };
  return ok(c, await publish(c, bot, parseDoc(bot.draft), text(b.note, 200)));
});

/** Quay lại một phiên bản cũ: nội dung bản đó thành nháp và được xuất bản thành phiên bản mới (lịch sử không bị xóa). */
agentTrainRoutes.post('/bots/:id/rollback', async (c) => {
  const bot = await loadBot(c, c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { version?: number };
  const v = await c.env.DB.prepare('SELECT data FROM agent_train_versions WHERE bot_id = ? AND version = ?')
    .bind(bot.id, Number(b.version))
    .first<{ data: string }>();
  if (!v) throw notFound('Không có phiên bản này');
  return ok(c, await publish(c, bot, parseDoc(v.data), `quay lại bản ${Number(b.version)}`));
});

/** Mô phỏng một lượt trên bản nháp (hoặc bản đang dùng). Không gửi cho ai, không ghi gì. */
agentTrainRoutes.post('/bots/:id/simulate', async (c) => {
  const bot = await loadBot(c, c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as {
    draft?: unknown;
    use?: string;
    text?: string;
    flow_id?: string;
    preview_flow?: string;
    state?: Partial<SimState>;
    page?: string;
  };
  let doc: BotDoc;
  if (b.use === 'published') {
    const v = await c.env.DB.prepare('SELECT data FROM agent_train_versions WHERE bot_id = ? AND is_current = 1').bind(bot.id).first<{ data: string }>();
    if (!v) throw notFound('Bot chưa có phiên bản nào được xuất bản');
    doc = parseDoc(v.data);
  } else doc = b.draft === undefined ? parseDoc(bot.draft) : docFromBody(b.draft);
  const st: SimState = {
    cur: b.state?.cur ? String(b.state.cur) : null,
    xh: b.state?.xh === 'anh' || b.state?.xh === 'chị' ? b.state.xh : '',
    phone: !!b.state?.phone,
  };
  const kill = (await readCtl(c)).kill;
  if (kill) {
    return ok(c, { messages: [{ kind: 'system', text: 'Đang tắt khẩn: agent không trả lời.' }], log: ['Kết quả: dừng (tắt khẩn)'], result: { kind: 'blocked', note: 'Tắt khẩn', flow: null }, state: st });
  }
  return ok(c, simulate(doc, { text: text(b.text, 1000), flowId: b.flow_id, previewFlow: b.preview_flow }, st, text(b.page, 120) || '(chưa gắn Page)'));
});

/* --- Page --- */
agentTrainRoutes.get('/pages', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT id, fb_page_id, name, bot_id, mode FROM agent_train_pages ORDER BY id`).all();
  return ok(c, rows.results ?? []);
});

agentTrainRoutes.post('/pages', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; fb_page_id?: string };
  const name = text(b.name, 120);
  if (!name) throw badRequest('BAD_PAGE', 'Chưa gõ tên Page.');
  const fb = parseFbPageId(text(b.fb_page_id, 600));
  if (!fb) {
    throw badRequest(
      'BAD_PAGE',
      'Không thấy dãy số của Page trong cái chị dán. Link chỉ có tên Page (facebook.com/tên) thì không đủ. Dán link có số, ví dụ botcake.io/105017945992971/home hoặc facebook.com/profile.php?id=105017945992971, hoặc gõ thẳng dãy số.',
    );
  }
  const dup = await c.env.DB.prepare('SELECT id FROM agent_train_pages WHERE fb_page_id = ?').bind(fb).first();
  if (dup) throw conflict('PAGE_EXISTS', 'Page này đã có trong danh sách.');
  const now = nowIso();
  const res = await c.env.DB.prepare(`INSERT INTO agent_train_pages (fb_page_id, name, mode, created_at, updated_at) VALUES (?, ?, 'off', ?, ?)`)
    .bind(fb, name, now, now)
    .run();
  await logEvent(c, 'page.add', res.meta.last_row_id, `${name} (${fb})`);
  return ok(c, { id: res.meta.last_row_id });
});

agentTrainRoutes.patch('/pages/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const page = await c.env.DB.prepare('SELECT * FROM agent_train_pages WHERE id = ?').bind(id).first<{ id: number; name: string; bot_id: string | null; mode: string }>();
  if (!page) throw notFound('Không có Page này');
  const b = (await c.req.json().catch(() => ({}))) as { bot_id?: string | null; mode?: string; name?: string };
  let botId = page.bot_id;
  if (b.bot_id !== undefined) {
    botId = b.bot_id ? String(b.bot_id) : null;
    if (botId) await loadBot(c, botId);
  }
  // Chỉ có "tắt" hoặc "chỉ tài khoản thử". Mở cho khách thật là việc riêng, chị duyệt riêng.
  if (b.mode !== undefined && b.mode !== 'off' && b.mode !== 'tester') throw badRequest('BAD_MODE', 'Chỉ có chế độ tắt hoặc chỉ thử với tài khoản của chị');
  let mode = (b.mode ?? page.mode) as 'off' | 'tester';
  if (!botId) mode = 'off';
  if (mode === 'tester') {
    const cur = await c.env.DB.prepare('SELECT 1 AS x FROM agent_train_versions WHERE bot_id = ? AND is_current = 1').bind(botId).first();
    if (!cur) throw unprocessable('NOT_PUBLISHED', 'Bot chưa có phiên bản nào được xuất bản nên chưa bật thử được.');
  }
  await c.env.DB.prepare('UPDATE agent_train_pages SET name = ?, bot_id = ?, mode = ?, updated_at = ? WHERE id = ?')
    .bind(b.name === undefined ? page.name : text(b.name, 120) || page.name, botId, mode, nowIso(), id)
    .run();
  await logEvent(c, 'page.update', id, `${page.name}: bot ${botId ?? 'không'} · chế độ ${mode}`);
  return ok(c, { ok: true, mode, bot_id: botId });
});

agentTrainRoutes.delete('/pages/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare('DELETE FROM agent_train_pages WHERE id = ?').bind(id).run();
  await logEvent(c, 'page.delete', id);
  return ok(c, { ok: true });
});

/* --- Thẻ hội thoại (giống thẻ của Pancake) --- */
const TAG_COLORS = ['gray', 'blue', 'grn', 'amb', 'red', 'pnk', 'vio'];
type TagRow = { id: number; name: string; color: string; kind: string; sort: number };

agentTrainRoutes.get('/tags', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, name, color, kind, sort FROM agent_train_tags ORDER BY kind DESC, sort, id').all<TagRow>();
  return ok(c, rows.results ?? []);
});

agentTrainRoutes.post('/tags', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; color?: string; kind?: string };
  const name = text(b.name, 40);
  if (!name) throw badRequest('NO_NAME', 'Chưa gõ tên thẻ');
  const color = TAG_COLORS.includes(String(b.color)) ? String(b.color) : 'gray';
  const kind = b.kind === 'product' ? 'product' : 'stage';
  const dup = await c.env.DB.prepare('SELECT id FROM agent_train_tags WHERE name = ?').bind(name).first();
  if (dup) throw conflict('TAG_EXISTS', 'Đã có thẻ tên này.');
  const mx = await c.env.DB.prepare('SELECT MAX(sort) AS m FROM agent_train_tags').first<{ m: number | null }>();
  const res = await c.env.DB.prepare('INSERT INTO agent_train_tags (name, color, kind, sort, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(name, color, kind, (mx?.m ?? 0) + 1, nowIso())
    .run();
  await logEvent(c, 'tag.add', res.meta.last_row_id, name);
  return ok(c, { id: res.meta.last_row_id });
});

agentTrainRoutes.patch('/tags/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const old = await c.env.DB.prepare('SELECT id, name, color, kind FROM agent_train_tags WHERE id = ?').bind(id).first<TagRow>();
  if (!old) throw notFound('Không có thẻ này');
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; color?: string; kind?: string };
  const name = b.name === undefined ? old.name : text(b.name, 40);
  if (!name) throw badRequest('NO_NAME', 'Chưa gõ tên thẻ');
  const dup = await c.env.DB.prepare('SELECT id FROM agent_train_tags WHERE name = ? AND id != ?').bind(name, id).first();
  if (dup) throw conflict('TAG_EXISTS', 'Đã có thẻ tên này.');
  const color = b.color !== undefined && TAG_COLORS.includes(b.color) ? b.color : old.color;
  const kind = b.kind === undefined ? old.kind : b.kind === 'product' ? 'product' : 'stage';
  await c.env.DB.prepare('UPDATE agent_train_tags SET name = ?, color = ?, kind = ? WHERE id = ?').bind(name, color, kind, id).run();
  await logEvent(c, 'tag.update', id, name);
  return ok(c, { ok: true });
});

agentTrainRoutes.delete('/tags/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM agent_train_conv_tags WHERE tag_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM agent_train_tags WHERE id = ?').bind(id),
  ]);
  await logEvent(c, 'tag.delete', id);
  return ok(c, { ok: true });
});

/* --- Hội thoại (tin nhắn do công cụ VPS đẩy lên, chỉ chị xem) --- */
agentTrainRoutes.get('/convs', async (c) => {
  const tag = Number(c.req.query('tag') ?? 0) || 0;
  const q = text(c.req.query('q'), 80).toLowerCase();
  const where: string[] = [];
  const args: unknown[] = [];
  if (tag) {
    where.push('v.id IN (SELECT conv_id FROM agent_train_conv_tags WHERE tag_id = ?)');
    args.push(tag);
  }
  if (q) {
    where.push('(LOWER(v.name) LIKE ? OR LOWER(v.last_text) LIKE ?)');
    args.push(`%${q}%`, `%${q}%`);
  }
  const rows = await c.env.DB.prepare(
    `SELECT v.id, v.fb_page_id, v.name, v.unread, v.last_at, v.last_text, v.last_who, p.name AS page_name
     FROM agent_train_convs v LEFT JOIN agent_train_pages p ON p.fb_page_id = v.fb_page_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY v.last_at DESC LIMIT 100`,
  )
    .bind(...args)
    .all<{ id: number }>();
  const list = rows.results ?? [];
  const tagRows = list.length
    ? await c.env.DB.prepare(`SELECT conv_id, tag_id FROM agent_train_conv_tags WHERE conv_id IN (${list.map(() => '?').join(',')})`)
        .bind(...list.map((x) => x.id))
        .all<{ conv_id: number; tag_id: number }>()
    : { results: [] as { conv_id: number; tag_id: number }[] };
  const by = new Map<number, number[]>();
  for (const t of tagRows.results ?? []) by.set(t.conv_id, [...(by.get(t.conv_id) ?? []), t.tag_id]);
  return ok(c, list.map((x) => ({ ...x, tag_ids: by.get(x.id) ?? [] })));
});

agentTrainRoutes.get('/convs/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const conv = await c.env.DB.prepare(
    `SELECT v.id, v.fb_page_id, v.name, v.note, v.unread, v.created_at, v.last_at, p.name AS page_name, p.bot_id
     FROM agent_train_convs v LEFT JOIN agent_train_pages p ON p.fb_page_id = v.fb_page_id WHERE v.id = ?`,
  )
    .bind(id)
    .first<{ id: number; bot_id: string | null }>();
  if (!conv) throw notFound('Không có hội thoại này');
  const msgs = await c.env.DB.prepare(
    `SELECT * FROM (SELECT id, at, who, text, flow, version, why, got, wrong, wrong_note, images FROM agent_train_msgs WHERE conv_id = ? ORDER BY id DESC LIMIT 300) ORDER BY id`,
  )
    .bind(id)
    .all<{ images: string }>();
  const tags = await c.env.DB.prepare('SELECT tag_id FROM agent_train_conv_tags WHERE conv_id = ?').bind(id).all<{ tag_id: number }>();
  const bot = conv.bot_id ? await c.env.DB.prepare('SELECT name FROM agent_train_bots WHERE id = ?').bind(conv.bot_id).first<{ name: string }>() : null;
  return ok(c, { ...conv, bot_name: bot?.name ?? null, messages: (msgs.results ?? []).map((m) => ({ ...m, images: m.images ? (JSON.parse(m.images) as string[]) : [] })), tag_ids: (tags.results ?? []).map((t) => t.tag_id) });
});

/** Đổi bộ thẻ của khách (thay cả bộ). */
agentTrainRoutes.put('/convs/:id/tags', async (c) => {
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { tag_ids?: number[] };
  const exists = await c.env.DB.prepare('SELECT id FROM agent_train_convs WHERE id = ?').bind(id).first();
  if (!exists) throw notFound('Không có hội thoại này');
  const ids = [...new Set((b.tag_ids ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 30);
  const valid = ids.length
    ? ((await c.env.DB.prepare(`SELECT id FROM agent_train_tags WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{ id: number }>()).results ?? []).map((x) => x.id)
    : [];
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM agent_train_conv_tags WHERE conv_id = ?').bind(id),
    ...valid.map((t) => c.env.DB.prepare('INSERT INTO agent_train_conv_tags (conv_id, tag_id) VALUES (?, ?)').bind(id, t)),
  ]);
  return ok(c, { tag_ids: valid });
});

agentTrainRoutes.put('/convs/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { note?: string };
  const res = await c.env.DB.prepare('UPDATE agent_train_convs SET note = ? WHERE id = ?').bind(text(b.note, 1000), id).run();
  if (!res.meta.changes) throw notFound('Không có hội thoại này');
  return ok(c, { ok: true });
});

/** Đánh dấu đã xem trong web. Không gửi gì cho Facebook nên khách không thấy "đã xem". */
agentTrainRoutes.post('/convs/:id/read', async (c) => {
  await c.env.DB.prepare('UPDATE agent_train_convs SET unread = 0 WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return ok(c, { ok: true });
});

agentTrainRoutes.delete('/convs/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM agent_train_msgs WHERE conv_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM agent_train_conv_tags WHERE conv_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM agent_train_convs WHERE id = ?').bind(id),
  ]);
  await logEvent(c, 'conv.delete', id);
  return ok(c, { ok: true });
});

/** Chị đánh dấu một tin của agent là sai (để sau này thành đề xuất sửa). */
agentTrainRoutes.post('/msgs/:id/wrong', async (c) => {
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { wrong?: boolean; note?: string };
  const res = await c.env.DB.prepare(`UPDATE agent_train_msgs SET wrong = ?, wrong_note = ? WHERE id = ? AND who IN ('agent', 'system')`)
    .bind(b.wrong === false ? 0 : 1, text(b.note, 300), id)
    .run();
  if (!res.meta.changes) throw notFound('Không có tin này');
  return ok(c, { ok: true });
});

/* --- Nhật ký --- */
agentTrainRoutes.get('/log', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT l.id, l.at, l.action, l.ref, l.detail, u.display_name AS by_name
     FROM agent_train_log l LEFT JOIN users u ON u.id = l.by_user ORDER BY l.id DESC LIMIT 200`,
  ).all();
  return ok(c, rows.results ?? []);
});

agentTrainRoutes.get('/runs', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, at, fb_page_id, bot_id, version, flow, result, note, customer FROM agent_train_runs ORDER BY id DESC LIMIT 200`,
  ).all();
  return ok(c, rows.results ?? []);
});

/* --- Nút tắt khẩn, giờ trả lời, im lặng khi nhân viên nhắn tay --- */
agentTrainRoutes.get('/control', async (c) => ok(c, await readCtl(c)));

agentTrainRoutes.put('/control', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as Partial<Ctl>;
  const cur = await readCtl(c);
  const next: Ctl = {
    kill: b.kill === undefined ? cur.kill : !!b.kill,
    testers: b.testers === undefined ? cur.testers : text(b.testers, 500),
    silent_minutes: b.silent_minutes === undefined ? cur.silent_minutes : Math.min(1440, Math.max(1, Math.round(Number(b.silent_minutes)) || cur.silent_minutes)),
    hours_from: b.hours_from === undefined ? cur.hours_from : text(b.hours_from, 5),
    hours_to: b.hours_to === undefined ? cur.hours_to : text(b.hours_to, 5),
    updated_at: nowIso(),
  };
  for (const h of [next.hours_from, next.hours_to]) {
    if (h && !HHMM.test(h)) throw badRequest('BAD_HOURS', 'Giờ phải dạng 08:00');
  }
  if (!!next.hours_from !== !!next.hours_to) throw badRequest('BAD_HOURS', 'Nhập đủ giờ bắt đầu và giờ kết thúc, hoặc để trống cả hai');
  await c.env.DB.prepare(
    `INSERT INTO app_kv (k, v, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`,
  )
    .bind(CTL_KEY, JSON.stringify(next), next.updated_at)
    .run();
  const killChanged = next.kill !== cur.kill;
  await logEvent(c, killChanged ? (next.kill ? 'control.kill' : 'control.unkill') : 'control.save', 'control', killChanged ? (next.kill ? 'BẬT tắt khẩn' : 'gỡ tắt khẩn') : 'đổi thiết lập');
  return ok(c, next);
});

/* ---------- Công cụ trên VPS gọi ---------- */
export const agentTrainRelayRoutes = new Hono<AppEnv>();

agentTrainRelayRoutes.use('*', async (c, next) => {
  const key = c.req.header('X-Relay-Key') ?? '';
  const expected = (c.env.AGENT_RELAY_KEY ?? '').trim();
  if (!expected || key.length !== expected.length) throw unauthorized('Sai khoá cầu nối');
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) throw unauthorized('Sai khoá cầu nối');
  await next();
});

/**
 * Gói kịch bản ĐANG DÙNG cho một Page. Không trả gì (active=false) khi: tắt khẩn, Page chưa gắn bot, Page ở chế độ tắt,
 * hoặc bot chưa xuất bản. Công cụ trên VPS chỉ trả lời khi active=true và theo `control` (giờ, im lặng, tài khoản thử).
 */
agentTrainRelayRoutes.get('/pack', async (c) => {
  const fb = c.req.query('page') ?? '';
  const ctl = await readCtl(c);
  const page = await c.env.DB.prepare('SELECT id, fb_page_id, name, bot_id, mode FROM agent_train_pages WHERE fb_page_id = ?')
    .bind(fb)
    .first<{ id: number; fb_page_id: string; name: string; bot_id: string | null; mode: string }>();
  const off = (reason: string) => ok(c, { active: false, reason, control: ctl, page: page ? { name: page.name, mode: page.mode } : null, bot: null });
  if (ctl.kill) return off('kill');
  if (!page) return off('page_unknown');
  if (page.mode === 'off') return off('mode_off');
  if (!page.bot_id) return off('no_bot');
  const v = await c.env.DB.prepare(
    `SELECT v.version, v.data, b.name FROM agent_train_versions v JOIN agent_train_bots b ON b.id = v.bot_id WHERE v.bot_id = ? AND v.is_current = 1`,
  )
    .bind(page.bot_id)
    .first<{ version: number; data: string; name: string }>();
  if (!v) return off('not_published');
  return ok(c, {
    active: true,
    reason: '',
    control: ctl,
    page: { name: page.name, mode: page.mode },
    bot: { id: page.bot_id, name: v.name, version: v.version, data: parseDoc(v.data) },
  });
});

agentTrainRelayRoutes.post('/run', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { page?: string; bot_id?: string; version?: number; flow?: string; result?: string; note?: string; customer?: string };
  const results = ['sent', 'handoff', 'blocked', 'out_of_script', 'skipped'];
  if (!results.includes(String(b.result))) throw badRequest('BAD_RESULT', 'Kết quả không hợp lệ');
  await c.env.DB.prepare(
    `INSERT INTO agent_train_runs (at, fb_page_id, bot_id, version, flow, result, note, customer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(nowIso(), text(b.page, 40), b.bot_id ? text(b.bot_id, 60) : null, Number.isFinite(Number(b.version)) ? Number(b.version) : null, text(b.flow, 60), String(b.result), text(b.note, 300), maskPersonal(text(b.customer, 600)))
    .run();
  return ok(c, { ok: true });
});

const RETENTION_DAYS = 90;
type InMsg = { ext_id?: string; who?: string; text?: string; at?: string; flow?: string; version?: number; why?: string; got?: string; images?: string[] };

/**
 * Công cụ trên VPS đẩy tin nhắn của một khách lên web (khách nhắn, agent trả lời, nhân viên nhắn tay, agent dừng).
 * Nội dung được che số điện thoại, email, link NGAY Ở ĐÂY trước khi lưu. Tin trùng (cùng ext_id) bị bỏ qua.
 * Khi agent gửi một luồng có khai báo thẻ tự gắn, thẻ đó được gắn cho khách. Tin cũ hơn 90 ngày tự xóa.
 */
agentTrainRelayRoutes.post('/messages', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { page?: string; psid?: string; name?: string; messages?: InMsg[] };
  const page = text(b.page, 40);
  const psid = text(b.psid, 64);
  if (!/^\d{5,30}$/.test(page) || !psid) throw badRequest('BAD_CONV', 'Cần id Page (số) và mã khách.');
  const list = (b.messages ?? []).slice(0, 30);
  if (!list.length) throw badRequest('EMPTY', 'Không có tin nào.');
  const WHO = ['customer', 'agent', 'sale', 'system'];
  const now = nowIso();
  const name = text(b.name, 120);
  let conv = await c.env.DB.prepare('SELECT id FROM agent_train_convs WHERE fb_page_id = ? AND psid = ?').bind(page, psid).first<{ id: number }>();
  if (!conv) {
    const r = await c.env.DB.prepare(`INSERT INTO agent_train_convs (fb_page_id, psid, name, last_at, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(page, psid, name, '', now)
      .run();
    conv = { id: Number(r.meta.last_row_id) };
  } else if (name) {
    await c.env.DB.prepare('UPDATE agent_train_convs SET name = ? WHERE id = ?').bind(name, conv.id).run();
  }
  // Luồng của bản đang dùng, để gắn thẻ tự động theo mã luồng.
  const bot = await c.env.DB.prepare(
    `SELECT v.data FROM agent_train_pages p JOIN agent_train_versions v ON v.bot_id = p.bot_id AND v.is_current = 1 WHERE p.fb_page_id = ?`,
  )
    .bind(page)
    .first<{ data: string }>();
  const doc = bot ? parseDoc(bot.data) : null;
  const tagRows = (await c.env.DB.prepare('SELECT id, name FROM agent_train_tags').all<{ id: number; name: string }>()).results ?? [];
  let added = 0;
  let unread = 0;
  let lastAt = '';
  let lastText = '';
  let lastWho = '';
  const autoTags = new Set<number>();
  for (const m of list) {
    const who = WHO.includes(String(m.who)) ? String(m.who) : '';
    const body = maskPersonal(text(m.text, 4000)) || (Array.isArray(m.images) && m.images.length ? '[Ảnh]' : '');
    if (!who || !body) continue;
    const at = m.at && !Number.isNaN(Date.parse(m.at)) ? new Date(m.at).toISOString() : now;
    // Chỉ nhận đường dẫn https (tối đa 10 ảnh mỗi tin).
    const imgs = Array.isArray(m.images) ? m.images.map((u) => text(u, 600)).filter((u) => /^https:\/\//i.test(u)).slice(0, 10) : [];
    const r = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO agent_train_msgs (conv_id, ext_id, at, who, text, flow, version, why, got, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(conv.id, text(m.ext_id, 80), at, who, body, text(m.flow, 60), Number.isFinite(Number(m.version)) ? Number(m.version) : null, text(m.why, 600), text(m.got, 800), imgs ? JSON.stringify(imgs) : '')
      .run();
    if (!r.meta.changes) continue;
    added++;
    if (!lastAt || at >= lastAt) {
      lastAt = at;
      lastText = body.slice(0, 200);
      lastWho = who;
    }
    if (who === 'customer') unread++;
    if ((who === 'agent' || who === 'system') && m.flow && doc) {
      const code = text(m.flow, 60).split(' ')[0];
      const f = doc.flows.find((x) => x.code === code);
      for (const tn of f?.tags ?? []) {
        const t = tagRows.find((x) => x.name === tn);
        if (t) autoTags.add(t.id);
      }
    }
  }
  if (added) {
    await c.env.DB.prepare(
      `UPDATE agent_train_convs SET unread = unread + ?,
         last_text = CASE WHEN last_at <= ? THEN ? ELSE last_text END,
         last_who = CASE WHEN last_at <= ? THEN ? ELSE last_who END,
         last_at = CASE WHEN last_at <= ? THEN ? ELSE last_at END
       WHERE id = ?`,
    )
      .bind(unread, lastAt, lastText, lastAt, lastWho, lastAt, lastAt, conv.id)
      .run();
  }
  for (const t of autoTags) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO agent_train_conv_tags (conv_id, tag_id) VALUES (?, ?)').bind(conv.id, t).run();
  }
  // Giữ tin tối đa 90 ngày; hội thoại không còn tin nào thì xóa luôn.
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM agent_train_msgs WHERE at < ?').bind(cutoff),
    c.env.DB.prepare(`DELETE FROM agent_train_conv_tags WHERE conv_id IN (SELECT id FROM agent_train_convs WHERE last_at != '' AND last_at < ?)`).bind(cutoff),
    c.env.DB.prepare(`DELETE FROM agent_train_convs WHERE last_at != '' AND last_at < ?`).bind(cutoff),
  ]);
  return ok(c, { added, conv_id: conv.id, auto_tags: autoTags.size });
});

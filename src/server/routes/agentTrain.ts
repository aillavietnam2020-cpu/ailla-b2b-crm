import { Hono } from 'hono';
import type { Context } from 'hono';
import { nowIso } from '@shared/datetime';
import { TRAIN_KINDS, TRAIN_SETS, checkReply, maskPersonal } from '@shared/agentTrain';
import type { AppEnv } from '../env';
import { forbidden, badRequest, notFound, ok, unauthorized } from '../lib/http';
import { requirePermission } from '../middleware/rbac';

/**
 * Huấn luyện agent Sale và CSKH trên web.
 *  - /api/agent-train       : chị (CEO) sửa và duyệt kịch bản, bảng giá, câu khách hay hỏi, ảnh/video, luật cấm;
 *                             duyệt hoặc từ chối đề xuất của agent; chạy thử/chấm điểm; nút tắt khẩn.
 *  - /api/agent-train-relay : công cụ trên VPS (khoá AGENT_RELAY_KEY) đọc bản ĐÃ DUYỆT, gửi đề xuất, trả lời lại câu thử.
 * Agent chỉ đọc bản đã duyệt và chỉ đề xuất; không có đường nào để agent tự áp dụng. Không có chế độ gửi cho khách thật.
 */

const CTL_KEY = 'agent_train_ctl';
type Ctl = {
  mode: 'off' | 'tester';
  kill: boolean;
  testers: string;
  /** Nhân viên nhắn tay thì agent im bao nhiêu phút. */
  silent_minutes: number;
  /** Khung giờ agent được trả lời ("HH:MM"; để trống = cả ngày). */
  hours_from: string;
  hours_to: string;
  updated_at: string | null;
};
const CTL_DEFAULT: Ctl = { mode: 'off', kill: false, testers: '', silent_minutes: 30, hours_from: '', hours_to: '', updated_at: null };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

async function readCtl(c: Context<AppEnv>): Promise<Ctl> {
  const r = await c.env.DB.prepare('SELECT v FROM app_kv WHERE k = ?').bind(CTL_KEY).first<{ v: string }>();
  if (!r) return CTL_DEFAULT;
  try {
    const j = JSON.parse(r.v) as Partial<Ctl>;
    return { ...CTL_DEFAULT, ...j, mode: j.mode === 'tester' ? 'tester' : 'off' };
  } catch {
    return CTL_DEFAULT;
  }
}

async function logEvent(c: Context<AppEnv>, action: string, ref: string | number, detail = '') {
  await c.env.DB.prepare(`INSERT INTO agent_train_log (at, by_user, action, ref, detail) VALUES (?, ?, ?, ?, ?)`)
    .bind(nowIso(), c.get('auth').user.id, action, String(ref), detail.slice(0, 300))
    .run();
}

function itemInput(b: Record<string, unknown>) {
  const kind = String(b.kind ?? '');
  if (!(TRAIN_KINDS as readonly string[]).includes(kind)) throw badRequest('BAD_KIND', 'Loại mục không hợp lệ');
  const set = String(b.agent_set ?? 'BOTH');
  if (!(TRAIN_SETS as readonly string[]).includes(set)) throw badRequest('BAD_SET', 'Chọn agent Sale, CSKH hoặc cả hai');
  const title = text(b.title, 300);
  if (!title) throw badRequest('NO_TITLE', 'Chưa gõ tiêu đề');
  return {
    kind,
    agent_set: set,
    grp: text(b.grp, 120),
    code: text(b.code, 60),
    title,
    body: text(b.body, 4000),
    extra: text(b.extra, 2000),
  };
}

/* ---------- Chị dùng trên web ---------- */
export const agentTrainRoutes = new Hono<AppEnv>();
agentTrainRoutes.use('*', requirePermission('user.manage'));
agentTrainRoutes.use('*', async (c, next) => {
  if (c.get('auth').user.role !== 'CEO') throw forbidden('Chỉ chủ doanh nghiệp được huấn luyện agent.');
  await next();
});

agentTrainRoutes.get('/overview', async (c) => {
  const items = await c.env.DB.prepare(`SELECT kind, status, COUNT(*) AS n FROM agent_train_items GROUP BY kind, status`).all<{
    kind: string;
    status: string;
    n: number;
  }>();
  const sug = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM agent_train_suggestions WHERE status = 'PENDING'`).first<{ n: number }>();
  const ev = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN agent_reply IS NULL THEN 1 ELSE 0 END) AS waiting,
            AVG(ceo_score) AS avg_score, SUM(CASE WHEN flags != '[]' THEN 1 ELSE 0 END) AS flagged
     FROM agent_train_evals`,
  ).first<{ total: number; waiting: number | null; avg_score: number | null; flagged: number | null }>();
  return ok(c, { items: items.results ?? [], pending_suggestions: sug?.n ?? 0, evals: ev, control: await readCtl(c) });
});

agentTrainRoutes.get('/items', async (c) => {
  const kind = c.req.query('kind') ?? '';
  const byKind = (TRAIN_KINDS as readonly string[]).includes(kind);
  const q = c.env.DB.prepare(
    `SELECT id, agent_set, kind, grp, code, title, body, extra, status, source, approved_at, updated_at
     FROM agent_train_items WHERE status != 'ARCHIVED' ${byKind ? 'AND kind = ?' : ''} ORDER BY grp, code, id LIMIT 1000`,
  );
  const rows = await (byKind ? q.bind(kind) : q).all();
  return ok(c, rows.results ?? []);
});

agentTrainRoutes.post('/items', async (c) => {
  const v = itemInput((await c.req.json().catch(() => ({}))) as Record<string, unknown>);
  const now = nowIso();
  const res = await c.env.DB.prepare(
    `INSERT INTO agent_train_items (agent_set, kind, grp, code, title, body, extra, status, source, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'CEO', ?, ?, ?)`,
  )
    .bind(v.agent_set, v.kind, v.grp, v.code, v.title, v.body, v.extra, c.get('auth').user.id, now, now)
    .run();
  await logEvent(c, 'item.create', res.meta.last_row_id, `${v.kind}: ${v.title}`);
  return ok(c, { id: res.meta.last_row_id });
});

/** Sửa nội dung: mục đã duyệt bị đưa về "nháp", agent không còn dùng bản cũ cho tới khi chị duyệt lại. */
agentTrainRoutes.patch('/items/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const old = await c.env.DB.prepare('SELECT id FROM agent_train_items WHERE id = ?').bind(id).first();
  if (!old) throw notFound('Không có mục này');
  const v = itemInput((await c.req.json().catch(() => ({}))) as Record<string, unknown>);
  await c.env.DB.prepare(
    `UPDATE agent_train_items SET agent_set = ?, kind = ?, grp = ?, code = ?, title = ?, body = ?, extra = ?,
       status = 'DRAFT', approved_by = NULL, approved_at = NULL, updated_at = ? WHERE id = ?`,
  )
    .bind(v.agent_set, v.kind, v.grp, v.code, v.title, v.body, v.extra, nowIso(), id)
    .run();
  await logEvent(c, 'item.edit', id, `${v.kind}: ${v.title} (về nháp)`);
  return ok(c, { ok: true });
});

agentTrainRoutes.post('/items/:id/approve', async (c) => {
  const id = Number(c.req.param('id'));
  const now = nowIso();
  const res = await c.env.DB.prepare(
    `UPDATE agent_train_items SET status = 'APPROVED', approved_by = ?, approved_at = ?, updated_at = ?
     WHERE id = ? AND status != 'ARCHIVED'`,
  )
    .bind(c.get('auth').user.id, now, now, id)
    .run();
  if (!res.meta.changes) throw notFound('Không có mục này');
  await logEvent(c, 'item.approve', id);
  return ok(c, { ok: true });
});

agentTrainRoutes.post('/items/:id/archive', async (c) => {
  const id = Number(c.req.param('id'));
  const res = await c.env.DB.prepare(`UPDATE agent_train_items SET status = 'ARCHIVED', updated_at = ? WHERE id = ?`)
    .bind(nowIso(), id)
    .run();
  if (!res.meta.changes) throw notFound('Không có mục này');
  await logEvent(c, 'item.archive', id);
  return ok(c, { ok: true });
});

/* --- Đề xuất của agent --- */
agentTrainRoutes.get('/suggestions', async (c) => {
  const st = c.req.query('status') === 'ALL' ? '' : "WHERE status = 'PENDING'";
  const rows = await c.env.DB.prepare(
    `SELECT id, agent, agent_set, kind, grp, code, title, body, extra, reason, evidence, status, note, decided_at, created_at
     FROM agent_train_suggestions ${st} ORDER BY id DESC LIMIT 200`,
  ).all();
  return ok(c, rows.results ?? []);
});

/** Duyệt đề xuất = tạo mục ĐÃ DUYỆT từ nội dung chị thấy (chị có thể sửa chữ trước khi duyệt). */
agentTrainRoutes.post('/suggestions/:id/approve', async (c) => {
  const id = Number(c.req.param('id'));
  const s = await c.env.DB.prepare(`SELECT * FROM agent_train_suggestions WHERE id = ? AND status = 'PENDING'`)
    .bind(id)
    .first<Record<string, string>>();
  if (!s) throw notFound('Đề xuất không còn chờ duyệt');
  const over = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const v = itemInput({ ...s, ...over, kind: s.kind, agent_set: s.agent_set });
  const now = nowIso();
  const uid = c.get('auth').user.id;
  const ins = await c.env.DB.prepare(
    `INSERT INTO agent_train_items (agent_set, kind, grp, code, title, body, extra, status, source, created_by, approved_by, approved_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', 'AGENT', ?, ?, ?, ?, ?)`,
  )
    .bind(v.agent_set, v.kind, v.grp, v.code, v.title, v.body, v.extra, uid, uid, now, now, now)
    .run();
  await c.env.DB.prepare(
    `UPDATE agent_train_suggestions SET status = 'APPROVED', item_id = ?, decided_by = ?, decided_at = ? WHERE id = ?`,
  )
    .bind(ins.meta.last_row_id, uid, now, id)
    .run();
  await logEvent(c, 'suggestion.approve', id, `thành mục ${ins.meta.last_row_id}: ${v.title}`);
  return ok(c, { item_id: ins.meta.last_row_id });
});

agentTrainRoutes.post('/suggestions/:id/reject', async (c) => {
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { note?: string };
  const res = await c.env.DB.prepare(
    `UPDATE agent_train_suggestions SET status = 'REJECTED', note = ?, decided_by = ?, decided_at = ? WHERE id = ? AND status = 'PENDING'`,
  )
    .bind(text(b.note, 500), c.get('auth').user.id, nowIso(), id)
    .run();
  if (!res.meta.changes) throw notFound('Đề xuất không còn chờ duyệt');
  await logEvent(c, 'suggestion.reject', id, text(b.note, 200));
  return ok(c, { ok: true });
});

/* --- Chạy thử / chấm điểm --- */
agentTrainRoutes.get('/evals', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, agent_set, customer_msg, sale_reply, agent_reply, flags, ceo_score, ceo_note, created_at, answered_at
     FROM agent_train_evals ORDER BY id DESC LIMIT 200`,
  ).all<{ flags: string }>();
  return ok(c, (rows.results ?? []).map((r) => ({ ...r, flags: JSON.parse(r.flags || '[]') })));
});

/** Thêm các hội thoại cũ để thử: tự che số điện thoại, email, link trước khi lưu. */
agentTrainRoutes.post('/evals', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { agent_set?: string; cases?: { customer_msg?: string; sale_reply?: string }[] };
  const set = (TRAIN_SETS as readonly string[]).includes(String(b.agent_set)) ? String(b.agent_set) : 'SALE';
  const cases = (b.cases ?? []).slice(0, 50).filter((x) => text(x.customer_msg, 2000));
  if (!cases.length) throw badRequest('EMPTY', 'Chưa có câu khách nào');
  const now = nowIso();
  const uid = c.get('auth').user.id;
  await c.env.DB.batch(
    cases.map((x) =>
      c.env.DB.prepare(
        `INSERT INTO agent_train_evals (agent_set, customer_msg, sale_reply, created_by, created_at) VALUES (?, ?, ?, ?, ?)`,
      ).bind(set, maskPersonal(text(x.customer_msg, 2000)), maskPersonal(text(x.sale_reply, 2000)), uid, now),
    ),
  );
  return ok(c, { added: cases.length });
});

agentTrainRoutes.post('/evals/:id/score', async (c) => {
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { score?: number; note?: string };
  const score = Math.round(Number(b.score));
  if (!(score >= 1 && score <= 5)) throw badRequest('BAD_SCORE', 'Điểm từ 1 đến 5');
  const res = await c.env.DB.prepare(`UPDATE agent_train_evals SET ceo_score = ?, ceo_note = ? WHERE id = ?`)
    .bind(score, text(b.note, 500), id)
    .run();
  if (!res.meta.changes) throw notFound('Không có câu thử này');
  return ok(c, { ok: true });
});

agentTrainRoutes.delete('/evals/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM agent_train_evals WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return ok(c, { ok: true });
});

/* --- Nút tắt khẩn và chế độ thử --- */
agentTrainRoutes.get('/log', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT l.id, l.at, l.action, l.ref, l.detail, u.display_name AS by_name
     FROM agent_train_log l LEFT JOIN users u ON u.id = l.by_user ORDER BY l.id DESC LIMIT 200`,
  ).all();
  return ok(c, rows.results ?? []);
});

agentTrainRoutes.get('/control', async (c) => ok(c, await readCtl(c)));

agentTrainRoutes.put('/control', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as Partial<Ctl>;
  const cur = await readCtl(c);
  // Không có chế độ gửi khách thật: chỉ "tắt" hoặc "chỉ tài khoản thử của chị". Mở cho khách thật là việc riêng, chị duyệt riêng.
  if (b.mode !== undefined && b.mode !== 'off' && b.mode !== 'tester') {
    throw badRequest('BAD_MODE', 'Chỉ có chế độ tắt hoặc chỉ thử với tài khoản của chị');
  }
  const next: Ctl = {
    mode: b.mode ?? cur.mode,
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
  const what = [next.kill !== cur.kill ? (next.kill ? 'BẬT tắt khẩn' : 'gỡ tắt khẩn') : '', next.mode !== cur.mode ? `chế độ → ${next.mode}` : ''].filter(Boolean).join(', ');
  await logEvent(c, next.kill !== cur.kill ? (next.kill ? 'control.kill' : 'control.unkill') : 'control.save', 'control', what || 'đổi thiết lập');
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

/** Gói kiến thức ĐÃ DUYỆT. Nút tắt khẩn bật (hoặc đang ở chế độ tắt) thì không trả mục nào: agent không còn gì để trả lời. */
agentTrainRelayRoutes.get('/pack', async (c) => {
  const ctl = await readCtl(c);
  const set = c.req.query('set') === 'CSKH' ? 'CSKH' : 'SALE';
  if (ctl.kill || ctl.mode === 'off') return ok(c, { control: ctl, active: false, items: [] });
  const rows = await c.env.DB.prepare(
    `SELECT id, kind, grp, code, title, body, extra FROM agent_train_items
     WHERE status = 'APPROVED' AND agent_set IN (?, 'BOTH') ORDER BY kind, grp, code, id`,
  )
    .bind(set)
    .all();
  return ok(c, { control: ctl, active: true, items: rows.results ?? [] });
});

agentTrainRelayRoutes.post('/suggest', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const v = itemInput({ ...b, agent_set: b.agent_set ?? 'SALE' });
  if (!v.body) throw badRequest('NO_BODY', 'Đề xuất cần nội dung');
  const res = await c.env.DB.prepare(
    `INSERT INTO agent_train_suggestions (agent, agent_set, kind, grp, code, title, body, extra, reason, evidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      text(b.agent, 60) || 'agent',
      v.agent_set,
      v.kind,
      v.grp,
      v.code,
      v.title,
      v.body,
      v.extra,
      text(b.reason, 1000),
      maskPersonal(text(b.evidence, 3000)),
      nowIso(),
    )
    .run();
  return ok(c, { id: res.meta.last_row_id });
});

agentTrainRelayRoutes.get('/evals/pending', async (c) => {
  const ctl = await readCtl(c);
  if (ctl.kill) return ok(c, []);
  const rows = await c.env.DB.prepare(
    `SELECT id, agent_set, customer_msg FROM agent_train_evals WHERE agent_reply IS NULL ORDER BY id LIMIT 10`,
  ).all();
  return ok(c, rows.results ?? []);
});

agentTrainRelayRoutes.post('/evals/:id/answer', async (c) => {
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { reply?: string };
  const reply = text(b.reply, 5000);
  if (!reply) throw badRequest('EMPTY', 'Thiếu câu trả lời');
  const prices = await c.env.DB.prepare(`SELECT body, title, extra FROM agent_train_items WHERE kind = 'PRICE' AND status = 'APPROVED'`).all<{
    body: string;
    title: string;
    extra: string;
  }>();
  const banned = await c.env.DB.prepare(`SELECT body FROM agent_train_items WHERE kind = 'RULE' AND status = 'APPROVED'`).all<{ body: string }>();
  const flags = checkReply(
    reply,
    (prices.results ?? []).flatMap((p) => [p.body, p.title, p.extra]),
    (banned.results ?? []).flatMap((r) => r.body.split('\n')),
  );
  const res = await c.env.DB.prepare(
    `UPDATE agent_train_evals SET agent_reply = ?, flags = ?, answered_at = ? WHERE id = ? AND agent_reply IS NULL`,
  )
    .bind(reply, JSON.stringify(flags), nowIso(), id)
    .run();
  if (!res.meta.changes) throw notFound('Câu thử không còn chờ');
  return ok(c, { flags });
});

import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import { AGENT_ROSTER } from '@shared/agentRoster';
import type { AppEnv } from '../env';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { relayAuth } from './agentChat';

/**
 * Điều hành agent: sơ đồ tổ chức + bộ não phòng ban (CEO duyệt 07/11/2026).
 *  - /api/agent-ops        : CEO xem toàn bộ (trạng thái, phòng ban, ghi chú, nhật ký, năng lực) và sửa phòng ban / ghi chú.
 *  - /api/agent-relay-ops  : cầu nối trên VPS gửi trạng thái, năng lực, nhật ký lên (khoá AGENT_RELAY_KEY).
 * Web chỉ hiện và lưu ghi chú; không ra lệnh cho máy chủ agent.
 */

export const STATES = ['work', 'wait', 'stuck', 'err', 'idle', 'off'] as const;
const AGENT_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;
const DEPT_RE = /^[a-z0-9-]{1,24}$/;
const LOG_DAYS = 14;
export const DOC_KINDS = ['skill', 'kn'];
const DOC_MAX = 300_000; // ký tự, D1 giới hạn khoảng 2 MB một giá trị
const STALE_MS = 20 * 60_000; // máy chủ không gửi trạng thái quá 20 phút thì coi như chưa rõ

const str = (v: unknown, max: number) => (v == null ? null : String(v).trim().slice(0, max) || null);
const strList = (v: unknown, maxItems: number, maxLen: number) =>
  Array.isArray(v) ? v.map((x) => String(x ?? '').trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems) : [];
const safeJson = <T>(s: string | null | undefined, d: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : d;
  } catch {
    return d;
  }
};

/** Chuẩn hoá một dòng trạng thái máy chủ gửi lên. Trả null nếu mã agent sai. */
export function cleanStatus(x: Record<string, unknown>) {
  const agent = String(x.id ?? x.agent ?? '');
  if (!AGENT_RE.test(agent)) return null;
  const st = String(x.state ?? 'idle');
  const tok = Number(x.tokens_today);
  return {
    agent,
    state: (STATES as readonly string[]).includes(st) ? st : 'idle',
    task: str(x.task, 300),
    by_who: str(x.by, 120),
    wait_for: str(x.wait_for, 80),
    with_json: JSON.stringify(strList(x.with, 8, 80)),
    since: str(x.since, 40),
    next_run: str(x.next_run, 120),
    tokens_today: Number.isFinite(tok) && tok >= 0 ? Math.round(tok) : null,
    last_error: str(x.last_error, 400),
  };
}

/** Chuẩn hoá lịch chạy (workflow) máy chủ gửi lên. */
export function cleanCrons(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).map((c: Record<string, unknown>) => ({
    name: String(c?.name ?? '').slice(0, 160),
    when: String(c?.when ?? '').slice(0, 120),
    next: c?.next == null ? null : String(c.next).slice(0, 40),
    last: c?.last == null ? null : String(c.last).slice(0, 40),
    steps: strList(c?.steps, 12, 120),
  })).filter((c) => c.name);
}

/* ---------- CEO ---------- */
export const agentOpsRoutes = new Hono<AppEnv>();

agentOpsRoutes.use('*', async (c, next) => {
  if (c.get('auth').user.role !== 'CEO') throw forbidden('Chỉ CEO xem được bảng điều hành agent.');
  await next();
});

agentOpsRoutes.get('/', async (c) => {
  const db = c.env.DB;
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const [st, pf, depts, mem, notes, logs, seen, chat, docs] = await Promise.all([
    db.prepare('SELECT * FROM agent_ops_status').all<Record<string, unknown>>(),
    db.prepare('SELECT agent, skills_json, knowledge_json, crons_json, updated_at FROM agent_ops_profile').all<Record<string, string>>(),
    db.prepare('SELECT * FROM agent_dept ORDER BY sort, id').all(),
    db.prepare('SELECT * FROM agent_dept_member ORDER BY dept, sort').all<Record<string, unknown>>(),
    db.prepare('SELECT id, dept, kind, title, body, updated_at FROM agent_dept_note ORDER BY kind, updated_at DESC').all(),
    db.prepare('SELECT agent, at, kind, text, to_agent FROM agent_ops_log WHERE at >= ? ORDER BY at DESC LIMIT 300').bind(since).all(),
    db.prepare(`SELECT v, updated_at FROM app_kv WHERE k = 'agent_ops_seen'`).first<{ v: string }>(),
    db
      .prepare(
        `SELECT agent, SUM(CASE WHEN role = 'USER' AND status IN ('queued','taken') THEN 1 ELSE 0 END) AS pending, MAX(created_at) AS last_at
         FROM agent_chat WHERE owner_id = ? GROUP BY agent`,
      )
      .bind(c.get('auth').user.id)
      .all<{ agent: string; pending: number; last_at: string }>(),
    // Bảng nội dung tài liệu (0087) có thể chưa tạo: thiếu thì coi như chưa có tài liệu, trang vẫn chạy.
    db
      .prepare('SELECT agent, kind, name, description, path, size, file_at, CASE WHEN body IS NULL THEN 0 ELSE 1 END AS has_body FROM agent_ops_doc')
      .all<{ agent: string; kind: string; name: string; description: string | null; path: string | null; size: number | null; file_at: string | null; has_body: number }>()
      .catch(() => ({ results: [] as { agent: string; kind: string; name: string; description: string | null; path: string | null; size: number | null; file_at: string | null; has_body: number }[] })),
  ]);
  // Yêu cầu thêm agent (0088) có thể chưa tạo bảng: thiếu thì coi như không có.
  const reqs = await db
    .prepare(`SELECT id, agent, name, title, emoji, dept, parent, template, skills_json, duty, crons_json, combo, status, note, created_at, updated_at
              FROM agent_ops_req WHERE status <> 'cancelled' ORDER BY id DESC LIMIT 50`)
    .all<Record<string, unknown>>()
    .catch(() => ({ results: [] as Record<string, unknown>[] }));
  const docBy = new Map<string, Record<string, unknown>[]>();
  for (const d of docs.results ?? []) (docBy.get(d.agent) ?? docBy.set(d.agent, []).get(d.agent)!).push({ kind: d.kind, name: d.name, description: d.description, path: d.path, size: d.size, file_at: d.file_at, has_body: !!d.has_body });
  const stBy = new Map((st.results ?? []).map((r) => [String(r.agent), r]));
  const pfBy = new Map((pf.results ?? []).map((r) => [r.agent, r]));
  const chBy = new Map((chat.results ?? []).map((r) => [r.agent, r]));
  const memBy = new Map((mem.results ?? []).map((r) => [String(r.agent), r]));
  const fresh = !!seen && Date.now() - Date.parse(seen.v) < STALE_MS;
  // Mọi agent: trong danh sách nhắn tin + agent khai thêm trong phòng ban + agent máy chủ có gửi trạng thái.
  const ids = [...new Set([...AGENT_ROSTER.map((a) => a.id), ...memBy.keys(), ...stBy.keys()])];
  const agents = ids.map((id) => {
    const r = AGENT_ROSTER.find((a) => a.id === id);
    const m = memBy.get(id);
    const s = stBy.get(id);
    const p = pfBy.get(id);
    const ch = chBy.get(id);
    return {
      id,
      name: (m?.name as string) || r?.name || id,
      title: (m?.title as string) || r?.title || '',
      emoji: (m?.emoji as string) || r?.emoji || '🤖',
      color: (m?.color as string) || r?.color || '#64748b',
      chat: !!r,
      dept: (m?.dept as string) ?? null,
      parent: (m?.parent as string) ?? null,
      sort: Number(m?.sort ?? 99),
      status: s
        ? {
            state: s.state,
            task: s.task,
            by: s.by_who,
            wait_for: s.wait_for,
            with: safeJson<string[]>(s.with_json as string, []),
            since: s.since,
            next_run: s.next_run,
            tokens_today: s.tokens_today,
            last_error: s.last_error,
            updated_at: s.updated_at,
          }
        : null,
      pending: ch?.pending ?? 0,
      last_chat_at: ch?.last_at ?? null,
      skills: safeJson<string[]>(p?.skills_json, []),
      knowledge: safeJson<string[]>(p?.knowledge_json, []),
      crons: safeJson<unknown[]>(p?.crons_json, []),
      profile_at: p?.updated_at ?? null,
      docs: docBy.get(id) ?? [],
    };
  });
  return ok(c, {
    status_fresh: fresh,
    status_at: seen?.v ?? null,
    agents,
    depts: depts.results ?? [],
    notes: notes.results ?? [],
    logs: logs.results ?? [],
    reqs: (reqs.results ?? []).map((r) => ({ ...r, skills: safeJson<string[]>(r.skills_json as string, []), crons: safeJson<unknown[]>(r.crons_json as string, []) })),
  });
});

/** Mở xem nội dung một skill / file kiến thức. */
agentOpsRoutes.get('/doc', async (c) => {
  const agent = c.req.query('agent') ?? '';
  const kind = c.req.query('kind') ?? '';
  const name = c.req.query('name') ?? '';
  if (!AGENT_RE.test(agent) || !DOC_KINDS.includes(kind) || !name) throw badRequest('BAD_DOC', 'Thiếu thông tin tài liệu');
  const r = await c.env.DB.prepare('SELECT agent, kind, name, description, path, body, size, file_at, updated_at FROM agent_ops_doc WHERE agent = ? AND kind = ? AND name = ?')
    .bind(agent, kind, name)
    .first()
    .catch(() => null);
  if (!r) throw notFound('Máy chủ agent chưa gửi nội dung tài liệu này');
  return ok(c, r);
});

/** CEO tạo yêu cầu thêm agent. Máy chủ agent dựng ở trạng thái TẮT; CEO bấm Bật là bước riêng. */
agentOpsRoutes.post('/agent-req', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const agent = String(b.agent ?? '').trim();
  const name = str(b.name, 60);
  if (!AGENT_RE.test(agent)) throw badRequest('BAD_AGENT', 'Mã agent chỉ gồm chữ thường không dấu, số, gạch ngang (3–60 ký tự)');
  if (!name) throw badRequest('NO_NAME', 'Thiếu tên agent');
  const db = c.env.DB;
  const taken =
    AGENT_ROSTER.some((a) => a.id === agent) ||
    !!(await db.prepare('SELECT 1 FROM agent_dept_member WHERE agent = ?').bind(agent).first()) ||
    !!(await db.prepare(`SELECT 1 FROM agent_ops_req WHERE agent = ? AND status NOT IN ('cancelled','error')`).bind(agent).first());
  if (taken) throw badRequest('AGENT_EXISTS', 'Mã agent này đã có, chọn mã khác');
  const dept = String(b.dept ?? '');
  if (!(await db.prepare('SELECT 1 FROM agent_dept WHERE id = ?').bind(dept).first())) throw notFound('Không có phòng này');
  const parent = str(b.parent, 60);
  const template = str(b.template, 60);
  if ((parent && !AGENT_RE.test(parent)) || (template && !AGENT_RE.test(template))) throw badRequest('BAD_AGENT', 'Cấp trên / agent mẫu không hợp lệ');
  const crons = Array.isArray(b.crons)
    ? (b.crons as Record<string, unknown>[]).slice(0, 10).map((x) => ({ when: String(x?.when ?? '').slice(0, 80), task: String(x?.task ?? '').slice(0, 500) })).filter((x) => x.when && x.task)
    : [];
  const now = nowIso();
  const r = await db
    .prepare(
      `INSERT INTO agent_ops_req (agent, name, title, emoji, dept, parent, template, skills_json, duty, crons_json, combo, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    )
    .bind(agent, name, str(b.title, 80), str(b.emoji, 8), dept, parent, template, JSON.stringify(strList(b.skills, 60, 80)), str(b.duty, 3000), JSON.stringify(crons), str(b.combo, 60) ?? 'template', c.get('auth').user.id, now, now)
    .run();
  await db
    .prepare(
      `INSERT INTO agent_dept_member (agent, dept, parent, sort, name, title, emoji, color, updated_at) VALUES (?, ?, ?, 90, ?, ?, ?, '#64748b', ?)
       ON CONFLICT (agent) DO UPDATE SET dept = excluded.dept, parent = excluded.parent, name = excluded.name, title = excluded.title, emoji = excluded.emoji, updated_at = excluded.updated_at`,
    )
    .bind(agent, dept, parent, name, str(b.title, 80), str(b.emoji, 8) ?? '🤖', now)
    .run();
  return ok(c, { id: Number(r.meta.last_row_id), agent });
});

/** CEO bấm Bật (agent đã dựng xong) hoặc Huỷ (khi máy chủ chưa dựng). */
agentOpsRoutes.post('/agent-req/:id/:action', async (c) => {
  const id = Number(c.req.param('id'));
  const action = c.req.param('action');
  const r = await c.env.DB.prepare('SELECT id, agent, status FROM agent_ops_req WHERE id = ?').bind(id).first<{ id: number; agent: string; status: string }>();
  if (!r) throw notFound('Không có yêu cầu này');
  const now = nowIso();
  if (action === 'enable') {
    if (r.status !== 'created') throw badRequest('NOT_READY', 'Máy chủ chưa dựng xong agent này');
    await c.env.DB.prepare(`UPDATE agent_ops_req SET status = 'enable', updated_at = ? WHERE id = ?`).bind(now, id).run();
  } else if (action === 'cancel') {
    if (!['pending', 'error'].includes(r.status)) throw badRequest('CANNOT_CANCEL', 'Máy chủ đã nhận yêu cầu, không huỷ được ở đây');
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE agent_ops_req SET status = 'cancelled', updated_at = ? WHERE id = ?`).bind(now, id),
      c.env.DB.prepare('DELETE FROM agent_dept_member WHERE agent = ?').bind(r.agent),
    ]);
  } else throw badRequest('BAD_ACTION', 'Thao tác không hợp lệ');
  return ok(c, { id, action });
});

/** Sửa phòng ban (tên, biểu tượng, trưởng phòng, agent trưởng, mục tiêu) hoặc thêm phòng mới. */
agentOpsRoutes.put('/dept/:id', async (c) => {
  const id = c.req.param('id');
  if (!DEPT_RE.test(id)) throw badRequest('BAD_DEPT', 'Mã phòng không hợp lệ');
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(b.name, 60);
  if (!name) throw badRequest('NO_NAME', 'Thiếu tên phòng');
  const lead = str(b.agent_lead, 60);
  if (lead && !AGENT_RE.test(lead)) throw badRequest('BAD_AGENT', 'Mã agent trưởng không hợp lệ');
  const now = nowIso();
  const sort = Number.isFinite(Number(b.sort)) ? Number(b.sort) : 50;
  await c.env.DB.prepare(
    `INSERT INTO agent_dept (id, name, icon, lead_role, agent_lead, goal, sort, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, icon = excluded.icon, lead_role = excluded.lead_role,
       agent_lead = excluded.agent_lead, goal = excluded.goal, updated_at = excluded.updated_at`,
  )
    .bind(id, name, str(b.icon, 8), str(b.lead_role, 60), lead, str(b.goal, 200), sort, now)
    .run();
  return ok(c, { id });
});

/** Xếp agent vào phòng / đổi cấp trên. */
agentOpsRoutes.put('/member/:agent', async (c) => {
  const agent = c.req.param('agent');
  if (!AGENT_RE.test(agent)) throw badRequest('BAD_AGENT', 'Mã agent không hợp lệ');
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const dept = String(b.dept ?? '');
  const d = await c.env.DB.prepare('SELECT id FROM agent_dept WHERE id = ?').bind(dept).first();
  if (!d) throw notFound('Không có phòng này');
  const parent = str(b.parent, 60);
  if (parent && (!AGENT_RE.test(parent) || parent === agent)) throw badRequest('BAD_PARENT', 'Cấp trên không hợp lệ');
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO agent_dept_member (agent, dept, parent, sort, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (agent) DO UPDATE SET dept = excluded.dept, parent = excluded.parent, sort = excluded.sort, updated_at = excluded.updated_at`,
  )
    .bind(agent, dept, parent, Number.isFinite(Number(b.sort)) ? Number(b.sort) : 50, now)
    .run();
  return ok(c, { agent, dept, parent });
});

/** Thêm ghi chú phòng: kiến thức chung (kn), quyết định đã chốt (decision), người thật (person). */
agentOpsRoutes.post('/note', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const dept = String(b.dept ?? '');
  const kind = String(b.kind ?? '');
  if (!['kn', 'decision', 'person'].includes(kind)) throw badRequest('BAD_KIND', 'Loại ghi chú không hợp lệ');
  const title = str(b.title, 200);
  if (!title) throw badRequest('NO_TITLE', 'Thiếu tiêu đề');
  const d = await c.env.DB.prepare('SELECT id FROM agent_dept WHERE id = ?').bind(dept).first();
  if (!d) throw notFound('Không có phòng này');
  const now = nowIso();
  const r = await c.env.DB.prepare(
    'INSERT INTO agent_dept_note (dept, kind, title, body, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(dept, kind, title, str(b.body, 4000), c.get('auth').user.id, now, now)
    .run();
  return ok(c, { id: Number(r.meta.last_row_id) });
});

agentOpsRoutes.put('/note/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = str(b.title, 200);
  if (!Number.isInteger(id) || !title) throw badRequest('BAD_NOTE', 'Thiếu tiêu đề');
  const r = await c.env.DB.prepare('UPDATE agent_dept_note SET title = ?, body = ?, updated_at = ? WHERE id = ?')
    .bind(title, str(b.body, 4000), nowIso(), id)
    .run();
  if (!r.meta.changes) throw notFound('Không có ghi chú này');
  return ok(c, { id });
});

agentOpsRoutes.delete('/note/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw badRequest('BAD_NOTE', 'Mã ghi chú sai');
  await c.env.DB.prepare('DELETE FROM agent_dept_note WHERE id = ?').bind(id).run();
  return ok(c, { id });
});

/* ---------- Cầu nối trên VPS gửi lên ---------- */
export const agentRelayOpsRoutes = new Hono<AppEnv>();
agentRelayOpsRoutes.use('*', relayAuth);

/**
 * Gửi trạng thái (mỗi 5 phút), năng lực (khi đổi) và nhật ký.
 * { agents:[{id,state,task,by,wait_for,with:[],since,next_run,tokens_today,last_error}],
 *   profiles:[{id,skills:[],knowledge:[],crons:[{name,when,next,last,steps:[]}]}],
 *   logs:[{agent,at,kind,text,to}] }
 */
agentRelayOpsRoutes.post('/status', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { agents?: unknown[]; profiles?: unknown[]; logs?: unknown[] };
  const db = c.env.DB;
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const x of (b.agents ?? []).slice(0, 60)) {
    const s = cleanStatus((x ?? {}) as Record<string, unknown>);
    if (!s) continue;
    stmts.push(
      db
        .prepare(
          `INSERT INTO agent_ops_status (agent, state, task, by_who, wait_for, with_json, since, next_run, tokens_today, last_error, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (agent) DO UPDATE SET state = excluded.state, task = excluded.task, by_who = excluded.by_who,
             wait_for = excluded.wait_for, with_json = excluded.with_json, since = excluded.since, next_run = excluded.next_run,
             tokens_today = excluded.tokens_today, last_error = excluded.last_error, updated_at = excluded.updated_at`,
        )
        .bind(s.agent, s.state, s.task, s.by_who, s.wait_for, s.with_json, s.since, s.next_run, s.tokens_today, s.last_error, now),
    );
  }
  for (const x of (b.profiles ?? []).slice(0, 60)) {
    const p = (x ?? {}) as Record<string, unknown>;
    const agent = String(p.id ?? p.agent ?? '');
    if (!AGENT_RE.test(agent)) continue;
    stmts.push(
      db
        .prepare(
          `INSERT INTO agent_ops_profile (agent, skills_json, knowledge_json, crons_json, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (agent) DO UPDATE SET skills_json = excluded.skills_json, knowledge_json = excluded.knowledge_json,
             crons_json = excluded.crons_json, updated_at = excluded.updated_at`,
        )
        .bind(agent, JSON.stringify(strList(p.skills, 80, 80)), JSON.stringify(strList(p.knowledge, 80, 160)), JSON.stringify(cleanCrons(p.crons)), now),
    );
  }
  let logs = 0;
  for (const x of (b.logs ?? []).slice(0, 100)) {
    const l = (x ?? {}) as Record<string, unknown>;
    const agent = String(l.agent ?? '');
    const text = str(l.text, 500);
    const at = String(l.at ?? '');
    if (!AGENT_RE.test(agent) || !text || !Number.isFinite(Date.parse(at))) continue;
    const kind = ['giao', 'xong', 'loi', 'cho', 'note'].includes(String(l.kind)) ? String(l.kind) : 'note';
    stmts.push(
      db
        .prepare('INSERT INTO agent_ops_log (agent, at, kind, text, to_agent) VALUES (?, ?, ?, ?, ?)')
        .bind(agent, new Date(at).toISOString(), kind, text, str(l.to, 80)),
    );
    logs++;
  }
  stmts.push(
    db
      .prepare(`INSERT INTO app_kv (k, v, updated_at) VALUES ('agent_ops_seen', ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`)
      .bind(now, now),
    db.prepare('DELETE FROM agent_ops_log WHERE at < ?').bind(new Date(Date.now() - LOG_DAYS * 86_400_000).toISOString()),
  );
  await db.batch(stmts);
  return ok(c, { agents: (b.agents ?? []).length, profiles: (b.profiles ?? []).length, logs });
});

/**
 * Gửi nội dung skill / file kiến thức (khi đổi, hoặc mỗi giờ).
 * { agent, docs:[{kind:'skill'|'kn', name, description, path, body, file_at}], replace?: true }
 * replace=true: xoá các tài liệu cũ của agent không còn trong danh sách gửi lên.
 */
agentRelayOpsRoutes.post('/docs', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { agent?: string; docs?: unknown[]; replace?: boolean };
  const agent = String(b.agent ?? '');
  if (!AGENT_RE.test(agent)) throw badRequest('BAD_AGENT', 'Mã agent không hợp lệ');
  const db = c.env.DB;
  const now = nowIso();
  const keep: string[] = [];
  const stmts: D1PreparedStatement[] = [];
  for (const x of (b.docs ?? []).slice(0, 120)) {
    const d = (x ?? {}) as Record<string, unknown>;
    const kind = String(d.kind ?? '');
    const name = String(d.name ?? '').trim().slice(0, 160);
    if (!DOC_KINDS.includes(kind) || !name || name.includes('..')) continue;
    const body = d.body == null ? null : String(d.body).slice(0, DOC_MAX);
    keep.push(kind + '|' + name);
    stmts.push(
      db
        .prepare(
          `INSERT INTO agent_ops_doc (agent, kind, name, description, path, body, size, file_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (agent, kind, name) DO UPDATE SET description = excluded.description, path = excluded.path, body = excluded.body,
             size = excluded.size, file_at = excluded.file_at, updated_at = excluded.updated_at`,
        )
        .bind(agent, kind, name, str(d.description, 600), str(d.path, 300), body, body == null ? null : body.length, str(d.file_at, 40), now),
    );
  }
  if (b.replace) {
    const old = await db.prepare('SELECT kind, name FROM agent_ops_doc WHERE agent = ?').bind(agent).all<{ kind: string; name: string }>();
    for (const o of old.results ?? []) {
      if (!keep.includes(o.kind + '|' + o.name)) stmts.push(db.prepare('DELETE FROM agent_ops_doc WHERE agent = ? AND kind = ? AND name = ?').bind(agent, o.kind, o.name));
    }
  }
  // Gửi theo lô nhỏ để không vượt giới hạn một lần ghi của D1.
  for (let i = 0; i < stmts.length; i += 20) await db.batch(stmts.slice(i, i + 20));
  return ok(c, { agent, saved: keep.length });
});

/** Máy chủ agent lấy việc: yêu cầu thêm agent mới (pending) và yêu cầu bật (enable). */
agentRelayOpsRoutes.get('/requests', async (c) => {
  const r = await c.env.DB.prepare(
    `SELECT id, agent, name, title, emoji, dept, parent, template, skills_json, duty, crons_json, combo, status
     FROM agent_ops_req WHERE status IN ('pending','enable') ORDER BY id LIMIT 10`,
  ).all<Record<string, unknown>>();
  return ok(
    c,
    (r.results ?? []).map((x) => ({ ...x, skills: safeJson<string[]>(x.skills_json as string, []), crons: safeJson<unknown[]>(x.crons_json as string, []) })),
  );
});

/** Máy chủ báo tiến độ: creating → created (đã dựng, đang TẮT) → enabled; hoặc error kèm ghi chú. */
agentRelayOpsRoutes.post('/requests/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { status?: string; note?: string };
  const st = String(b.status ?? '');
  if (!['creating', 'created', 'enabled', 'error'].includes(st)) throw badRequest('BAD_STATUS', 'Trạng thái không hợp lệ');
  const r = await c.env.DB.prepare('UPDATE agent_ops_req SET status = ?, note = ?, updated_at = ? WHERE id = ?')
    .bind(st, str(b.note, 1000), nowIso(), id)
    .run();
  if (!r.meta.changes) throw notFound('Không có yêu cầu này');
  return ok(c, { id, status: st });
});

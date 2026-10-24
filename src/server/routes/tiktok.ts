import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, conflict, forbidden, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import { pack, unpack } from '../lib/pack';
import { requirePermission } from '../middleware/rbac';
import { adminOnlyEndpoint } from '../middleware/adminHost';

/**
 * Báo cáo kênh TikTok Shop (chị Hoa duyệt 24/10/2026).
 * - Số tháng (lãi lỗ, giá vốn, phí sàn theo SKU, khoá sổ): chỉ CEO và kế toán, ghi ở trang quản trị.
 * - Số hiệu suất theo ngày (5 làn GMV, LIVE, quảng cáo) và theo khoảng (KOC, nhà sáng tạo): team TikTok tải hằng tuần,
 *   tải lại thì ghi đè đúng ngày của nguồn file đó. Không có giá vốn, lãi.
 * File đơn hàng chỉ đọc ở trình duyệt; máy chủ không nhận tên, số điện thoại, địa chỉ khách.
 */
export const tiktokRoutes = new Hono<AppEnv>();
tiktokRoutes.use('*', requirePermission('hub.access'));

const canMoney = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('debt.read.all');
const ip = (c: { req: { header: (n: string) => string | undefined } }) => c.req.header('CF-Connecting-IP') ?? null;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KY = /^\d{4}-\d{2}$/;
const DAY_SRC = ['km', 'live', 'ads'] as const;
const RANGE_KIND = ['koc', 'creators'] as const;
const MAX_MONTH = 3 * 1024 * 1024;

/** Chỉ giữ số (tối đa 60 khoá) để không ai cất được chữ tuỳ ý vào bảng ngày. */
function numbersOnly(v: unknown, max = 60): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, max)) {
    if (typeof x === 'number' && Number.isFinite(x) && k.length <= 80) out[k] = x;
  }
  return out;
}

function cleanCreators(v: unknown) {
  const o = (v ?? {}) as Record<string, unknown>;
  const top = Array.isArray(o.top) ? o.top.slice(0, 300) : [];
  return {
    n: Number(o.n) || 0,
    nCo: Number(o.nCo) || 0,
    gmv: Number(o.gmv) || 0,
    top: top.map((t) => {
      const r = (t ?? {}) as Record<string, unknown>;
      return { u: String(r.u ?? '').slice(0, 80), ...numbersOnly(r, 20) };
    }),
  };
}

/** Số theo ngày + số theo khoảng giao với kỳ đang xem. */
tiktokRoutes.get('/days', async (c) => {
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  if (!DAY.test(from) || !DAY.test(to)) throw badRequest('BAD_RANGE', 'Khoảng ngày không hợp lệ');
  const [d, r] = await Promise.all([
    c.env.DB.prepare('SELECT day, src, data, updated_at FROM tts_day WHERE day BETWEEN ? AND ? ORDER BY day').bind(from, to).all(),
    c.env.DB.prepare(
      'SELECT kind, d_from, d_to, data, updated_at FROM tts_range WHERE d_from <= ? AND d_to >= ? ORDER BY d_from',
    )
      .bind(to, from)
      .all(),
  ]);
  const days: Record<string, Record<string, unknown>> = {};
  for (const x of (d.results ?? []) as { day: string; src: string; data: string }[]) {
    (days[x.day] ??= {})[x.src] = JSON.parse(x.data);
  }
  const ranges = ((r.results ?? []) as { kind: string; d_from: string; d_to: string; data: string; updated_at: string }[]).map(
    (x) => ({ kind: x.kind, from: x.d_from, to: x.d_to, at: x.updated_at, data: JSON.parse(x.data) }),
  );
  const last = await c.env.DB.prepare('SELECT src, MAX(day) AS day, MAX(updated_at) AS at FROM tts_day GROUP BY src').all();
  return ok(c, { days, ranges, last: last.results ?? [] });
});

/** Ghi số theo ngày của một nguồn file; ngày nào có trong file thì ghi đè ngày đó. */
tiktokRoutes.put('/days', async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as { src?: string; days?: Record<string, unknown>; file?: string };
  const src = String(body.src ?? '');
  if (!(DAY_SRC as readonly string[]).includes(src)) throw badRequest('BAD_SRC', 'Nguồn file không hợp lệ');
  const entries = Object.entries(body.days ?? {}).filter(([k]) => DAY.test(k));
  if (!entries.length) throw badRequest('EMPTY', 'File không có ngày nào');
  if (entries.length > 400) throw badRequest('TOO_MANY', 'Mỗi lần tải tối đa 400 ngày');
  const at = nowIso();
  const st = entries.map(([day, v]) =>
    c.env.DB.prepare(
      `INSERT INTO tts_day (day, src, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (day, src) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).bind(day, src, JSON.stringify(numbersOnly(v)), at, auth.user.id),
  );
  const ks = entries.map(([k]) => k).sort();
  st.push(
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'TTS_DAY_UPLOAD',
      entityType: 'TTS_DAY',
      entityId: src,
      after: { from: ks[0], to: ks[ks.length - 1], n: ks.length, file: String(body.file ?? '').slice(0, 200) },
      ip: ip(c),
      requestId: c.get('requestId'),
    }),
  );
  await c.env.DB.batch(st);
  return ok(c, { n: ks.length, from: ks[0], to: ks[ks.length - 1] });
});

/** Ghi số cả khoảng ngày (KOC, nhà sáng tạo); cùng khoảng thì ghi đè. */
tiktokRoutes.put('/range', async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as { kind?: string; from?: string; to?: string; data?: unknown; file?: string };
  const kind = String(body.kind ?? '');
  if (!(RANGE_KIND as readonly string[]).includes(kind)) throw badRequest('BAD_KIND', 'Loại file không hợp lệ');
  const from = String(body.from ?? '');
  const to = String(body.to ?? '');
  if (!DAY.test(from) || !DAY.test(to) || from > to) throw badRequest('BAD_RANGE', 'Khoảng ngày không hợp lệ');
  const data = kind === 'koc' ? numbersOnly(body.data, 80) : cleanCreators(body.data);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO tts_range (kind, d_from, d_to, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (kind, d_from, d_to) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).bind(kind, from, to, JSON.stringify(data), nowIso(), auth.user.id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'TTS_RANGE_UPLOAD',
      entityType: 'TTS_RANGE',
      entityId: `${kind}:${from}:${to}`,
      after: { file: String(body.file ?? '').slice(0, 200) },
      ip: ip(c),
      requestId: c.get('requestId'),
    }),
  ]);
  return ok(c, { ok: true });
});

/** Tóm tắt các tháng đã lưu (để so nhiều tháng và đưa lên Tổng quan). */
tiktokRoutes.get('/months', async (c) => {
  if (!canMoney(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem lãi lỗ kênh');
  const rows = await c.env.DB.prepare(
    'SELECT ky, summary, locked_at, locked_by, updated_at, updated_by FROM tts_month ORDER BY ky',
  ).all<{ ky: string; summary: string; locked_at: string | null; locked_by: string | null; updated_at: string; updated_by: string | null }>();
  return ok(
    c,
    (rows.results ?? []).map((r) => ({ ...r, summary: JSON.parse(r.summary) })),
  );
});

tiktokRoutes.get('/month/:ky', async (c) => {
  const auth = c.get('auth');
  if (!canMoney(auth)) throw forbidden('Chỉ CEO hoặc kế toán xem lãi lỗ kênh');
  const ky = c.req.param('ky');
  if (!KY.test(ky)) throw badRequest('BAD_KY', 'Tháng không hợp lệ');
  const row = await c.env.DB.prepare('SELECT data, locked_at, locked_by, updated_at, updated_by FROM tts_month WHERE ky = ?')
    .bind(ky)
    .first<{ data: string; locked_at: string | null; locked_by: string | null; updated_at: string; updated_by: string | null }>();
  if (!row) return ok(c, null);
  return ok(c, { ...row, data: JSON.parse(await unpack(row.data)) });
});

/** Lưu số tháng (sau khi người dùng xem trước và bấm lưu). Tháng đã khoá sổ thì không ghi đè. */
tiktokRoutes.put('/month/:ky', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  if (!canMoney(auth)) throw forbidden('Chỉ CEO hoặc kế toán lưu báo cáo tháng');
  const ky = c.req.param('ky');
  if (!KY.test(ky)) throw badRequest('BAD_KY', 'Tháng không hợp lệ');
  const raw = await c.req.text();
  if (raw.length > MAX_MONTH) throw badRequest('TOO_LARGE', 'Dữ liệu quá lớn');
  const body = JSON.parse(raw) as { data?: { ky?: string }; summary?: unknown; files?: unknown };
  if (!body.data || body.data.ky !== ky || !body.summary) throw badRequest('BAD_BODY', 'Thiếu số tháng');
  const cur = await c.env.DB.prepare('SELECT locked_at FROM tts_month WHERE ky = ?').bind(ky).first<{ locked_at: string | null }>();
  if (cur?.locked_at) throw conflict('LOCKED', `Tháng ${ky.slice(5)}/${ky.slice(0, 4)} đã khoá sổ, không ghi đè được.`);
  const at = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO tts_month (ky, data, summary, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (ky) DO UPDATE SET data = excluded.data, summary = excluded.summary,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).bind(ky, await pack(JSON.stringify(body.data)), JSON.stringify(body.summary), at, auth.user.id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'TTS_MONTH_SAVE',
      entityType: 'TTS_MONTH',
      entityId: ky,
      after: { summary: body.summary, files: body.files ?? null },
      ip: ip(c),
      requestId: c.get('requestId'),
    }),
  ]);
  return ok(c, { ok: true, updated_at: at });
});

/** Khoá sổ (CEO, kế toán) hoặc mở khoá (chỉ CEO). */
tiktokRoutes.post('/month/:ky/lock', adminOnlyEndpoint, async (c) => {
  const auth = c.get('auth');
  const ky = c.req.param('ky');
  if (!KY.test(ky)) throw badRequest('BAD_KY', 'Tháng không hợp lệ');
  const body = (await c.req.json().catch(() => ({}))) as { lock?: boolean };
  const lock = body.lock !== false;
  if (lock ? !canMoney(auth) : auth.user.role !== 'CEO') throw forbidden(lock ? 'Chỉ CEO hoặc kế toán khoá sổ' : 'Chỉ CEO mở khoá sổ');
  const at = nowIso();
  const r = await c.env.DB.batch([
    c.env.DB.prepare('UPDATE tts_month SET locked_at = ?, locked_by = ? WHERE ky = ?').bind(lock ? at : null, lock ? auth.user.id : null, ky),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: lock ? 'TTS_MONTH_LOCK' : 'TTS_MONTH_UNLOCK',
      entityType: 'TTS_MONTH',
      entityId: ky,
      ip: ip(c),
      requestId: c.get('requestId'),
    }),
  ]);
  if (!r[0].meta.changes) throw badRequest('NO_MONTH', 'Tháng này chưa lưu báo cáo');
  return ok(c, { ok: true, locked_at: lock ? at : null });
});

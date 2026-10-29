import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import { AGENT_SCOPE_PREFIX } from '@shared/agent';
import type { AppEnv } from '../env';
import { badRequest, conflict, forbidden, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import { pack, unpack } from '../lib/pack';
import { requirePermission } from '../middleware/rbac';

/**
 * Agent nạp báo cáo sàn TikTok hằng tuần (chị Hoa duyệt 25/10/2026, giao Agent · Kế toán trưởng).
 * Chỉ agent được CEO tick phạm vi "Báo cáo sàn" mới gọi được. Agent tự đọc file trên máy của nó bằng đúng công thức
 * của trang Tải file tháng (scripts/agent-tiktok-nap.mjs dùng chung hub/src/ttcalc.js), chỉ gửi lên số đã tính:
 * không tên, số điện thoại, địa chỉ khách. Mỗi lần ghi có một dòng nhật ký (người làm = agent).
 * Không khoá sổ, không mở khoá, không ghi đè tháng đã khoá, không thay bản chốt sổ đầy đủ bằng bản giữa tháng.
 */
export const agentTiktokRoutes = new Hono<AppEnv>();
agentTiktokRoutes.use('*', requirePermission('agent.read'));
agentTiktokRoutes.use('*', async (c, next) => {
  if (!c.get('auth').permissions.includes(AGENT_SCOPE_PREFIX + 'baocao_san')) throw forbidden('Agent này chưa được phép nạp báo cáo sàn');
  await next();
});

const KY = /^\d{4}-\d{2}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
import { DAY_SRC, RANGE_KIND, cleanRange } from './tiktok';
const MAX_MONTH = 3 * 1024 * 1024;
const ip = (c: { req: { header: (n: string) => string | undefined } }) => c.req.header('CF-Connecting-IP') ?? null;

function numbersOnly(v: unknown, max = 60): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, max)) {
    if (typeof x === 'number' && Number.isFinite(x) && k.length <= 80) out[k] = x;
  }
  return out;
}

async function hubPart(db: D1Database, id: string): Promise<Record<string, unknown>> {
  const r = await db.prepare('SELECT data FROM hub_state WHERE id = ?').bind(id).first<{ data: string }>();
  return r ? (JSON.parse(await unpack(r.data)) as Record<string, unknown>) : {};
}

/** Số đầu vào để tính giá vốn và chi phí riêng kênh, đúng như trang Tải file tháng dùng (TikTok; Shopee dùng lại với channel SHOPEE). */
export async function agentInputs(db: D1Database, ky: string, channel: 'TIKTOK' | 'SHOPEE') {
  // Shopee: đơn đã xuất kho trên Poscake để ghép giá vốn theo hàng xuất kho (chị Hoa chốt 29/10/2026), ngày 01 tới 45 ngày sau.
  const posTo = new Date(`${ky}-01T00:00:00Z`);
  posTo.setUTCDate(posTo.getUTCDate() + 45);
  const posQ =
    channel === 'SHOPEE'
      ? db
          .prepare("SELECT order_id, sku, variant FROM channel_order_lines WHERE channel = 'SHOPEE' AND day >= ? AND day <= ?")
          .bind(`${ky}-01`, posTo.toISOString().slice(0, 10))
          .all<{ order_id: string; sku: string; variant: string }>()
      : null;
  const [map, items, alias, moves, main, sec] = await Promise.all([
    db.prepare('SELECT sku, variant, from_day, item_label, qty FROM channel_map WHERE channel = ? ORDER BY sku, variant, from_day, item_label').bind(channel).all(),
    db.prepare('SELECT code, name, cls, grp FROM kho_items ORDER BY code').all(),
    db.prepare('SELECT label, item FROM channel_alias').all(),
    db
      .prepare(
        `SELECT m.item, m.qty, m.price FROM kho_moves m JOIN kho_docs d ON d.id = m.doc_id
         WHERE d.status = 'OK' AND d.type IN ('PN','TD') AND m.price IS NOT NULL AND m.price > 0 AND m.qty > 0`,
      )
      .all<{ item: string; qty: number; price: number }>(),
    hubPart(db, 'main'),
    hubPart(db, 'secure'),
  ]);
  const acc = new Map<string, { amt: number; qty: number }>();
  for (const r of moves.results ?? []) {
    const a = acc.get(r.item) ?? { amt: 0, qty: 0 };
    a.amt += r.price * r.qty;
    a.qty += r.qty;
    acc.set(r.item, a);
  }
  const kho = Object.fromEntries([...acc].map(([k, a]) => [k, Math.round(a.amt / a.qty)]));
  const all = { ...main, ...sec } as { skus?: { ma?: string; giaVon?: unknown }[]; costs?: { thang?: string }[]; costCats?: unknown[] };
  return {
    ky,
    map: map.results ?? [],
    items: items.results ?? [],
    alias: alias.results ?? [],
    kho,
    skus: (all.skus ?? []).map((s) => ({ ma: s.ma, giaVon: s.giaVon })),
    costs: (all.costs ?? []).filter((x) => x.thang === ky),
    costCats: all.costCats ?? [],
    ...(posQ ? { pos: (await posQ).results ?? [] } : {}),
  };
}
agentTiktokRoutes.get('/inputs', async (c) => {
  const ky = c.req.query('ky') ?? '';
  if (!KY.test(ky)) throw badRequest('BAD_KY', 'Tháng không hợp lệ');
  return ok(c, await agentInputs(c.env.DB, ky, 'TIKTOK'));
});

/** Các tháng đã lưu: để agent biết tháng nào đã khoá sổ, đã có bản chốt sổ hay bản giữa tháng đến ngày nào. */
agentTiktokRoutes.get('/months', async (c) => {
  const rows = await c.env.DB.prepare('SELECT ky, summary, locked_at, updated_at FROM tts_month ORDER BY ky').all<{
    ky: string;
    summary: string;
    locked_at: string | null;
    updated_at: string;
  }>();
  return ok(
    c,
    (rows.results ?? []).map((r) => {
      const s = JSON.parse(r.summary) as { den?: string | null; dt?: number; don?: number };
      return { ky: r.ky, den: s.den ?? null, dt: s.dt ?? null, don: s.don ?? null, locked: !!r.locked_at, updated_at: r.updated_at };
    }),
  );
});

agentTiktokRoutes.put('/month/:ky', async (c) => {
  const auth = c.get('auth');
  const ky = c.req.param('ky');
  if (!KY.test(ky)) throw badRequest('BAD_KY', 'Tháng không hợp lệ');
  const raw = await c.req.text();
  if (raw.length > MAX_MONTH) throw badRequest('TOO_LARGE', 'Dữ liệu quá lớn');
  const body = JSON.parse(raw) as { data?: { ky?: string; M?: { den?: string | null } }; summary?: { den?: string | null }; files?: unknown };
  if (!body.data || body.data.ky !== ky || !body.summary) throw badRequest('BAD_BODY', 'Thiếu số tháng');
  const den = body.summary.den ?? null;
  if (den !== null && !(DAY.test(den) && den.startsWith(ky))) throw badRequest('BAD_DEN', 'Ngày "đến" không thuộc tháng này');
  const cur = await c.env.DB.prepare('SELECT summary, locked_at FROM tts_month WHERE ky = ?').bind(ky).first<{ summary: string; locked_at: string | null }>();
  if (cur?.locked_at) throw conflict('LOCKED', `Tháng ${ky.slice(5)}/${ky.slice(0, 4)} đã khoá sổ, không ghi đè được.`);
  if (cur && den !== null) {
    const old = JSON.parse(cur.summary) as { den?: string | null };
    if (!old.den) throw conflict('HAS_FULL', 'Tháng này đã có báo cáo chốt sổ đầy đủ, không thay bằng bản giữa tháng.');
    if (old.den > den) throw conflict('OLDER', `Tháng này đã có bản mới hơn (đến ${old.den}).`);
  }
  const at = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO tts_month (ky, data, summary, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (ky) DO UPDATE SET data = excluded.data, summary = excluded.summary,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).bind(ky, await pack(JSON.stringify(body.data)), JSON.stringify(body.summary), at, auth.user.id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      actorType: 'AGENT',
      source: 'agent-tiktok',
      action: 'TTS_MONTH_SAVE',
      entityType: 'TTS_MONTH',
      entityId: ky,
      after: { summary: body.summary, files: body.files ?? null },
      ip: ip(c),
      requestId: c.get('requestId'),
    }),
  ]);
  return ok(c, { ok: true, ky, den, updated_at: at });
});

/** Số theo ngày (quảng cáo, 5 làn GMV, LIVE): ngày nào có trong file thì ghi đè ngày đó. */
/** Số cả khoảng ngày (KOC Transaction Analysis, Creator List, Video › Chi tiết): cùng khoảng thì ghi đè. */
agentTiktokRoutes.put('/range', async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as { kind?: string; from?: string; to?: string; data?: unknown; file?: string };
  const kind = String(body.kind ?? '');
  if (!(RANGE_KIND as readonly string[]).includes(kind)) throw badRequest('BAD_KIND', 'Loại file không hợp lệ');
  const from = String(body.from ?? '');
  const to = String(body.to ?? '');
  if (!DAY.test(from) || !DAY.test(to) || from > to) throw badRequest('BAD_RANGE', 'Khoảng ngày không hợp lệ');
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO tts_range (kind, d_from, d_to, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (kind, d_from, d_to) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).bind(kind, from, to, JSON.stringify(cleanRange(kind, body.data)), nowIso(), auth.user.id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      actorType: 'AGENT',
      source: 'agent-tiktok',
      action: 'TTS_RANGE_UPLOAD',
      entityType: 'TTS_RANGE',
      entityId: `${kind}:${from}:${to}`,
      after: { file: String(body.file ?? '').slice(0, 200) },
      ip: ip(c),
      requestId: c.get('requestId'),
    }),
  ]);
  return ok(c, { ok: true, kind, from, to });
});

agentTiktokRoutes.put('/days', async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as { src?: string; days?: Record<string, unknown>; file?: string };
  const src = String(body.src ?? '');
  if (!(DAY_SRC as readonly string[]).includes(src)) throw badRequest('BAD_SRC', 'Nguồn file không hợp lệ');
  const entries = Object.entries(body.days ?? {}).filter(([k]) => DAY.test(k));
  if (!entries.length) throw badRequest('EMPTY', 'File không có ngày nào');
  if (entries.length > 400) throw badRequest('TOO_MANY', 'Mỗi lần tải tối đa 400 ngày');
  const at = nowIso();
  const ks = entries.map(([k]) => k).sort();
  await c.env.DB.batch([
    ...entries.map(([day, v]) =>
      c.env.DB.prepare(
        `INSERT INTO tts_day (day, src, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (day, src) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      ).bind(day, src, JSON.stringify(numbersOnly(v)), at, auth.user.id),
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      actorType: 'AGENT',
      source: 'agent-tiktok',
      action: 'TTS_DAY_UPLOAD',
      entityType: 'TTS_DAY',
      entityId: src,
      after: { from: ks[0], to: ks[ks.length - 1], n: ks.length, file: String(body.file ?? '').slice(0, 200) },
      ip: ip(c),
      requestId: c.get('requestId'),
    }),
  ]);
  return ok(c, { n: ks.length, from: ks[0], to: ks[ks.length - 1] });
});

import { Hono, type Context } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, conflict, forbidden, notFound, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import { CHANNEL_LABELS, type Channel } from '../services/channelOut';
import {
  OVERDUE_RETURNED_DAYS,
  OVERDUE_RETURNING_DAYS,
  type RetItem,
  ageDays,
  expectedItems,
  normalizeCode,
  syncReturns,
} from '../services/returnScan';

/**
 * Hàng hoàn các sàn: kho quét mã vận đơn → web tự biết kênh, đơn, sản phẩm phải về →
 * kiểm (về thực tế / bán tiếp / hỏng) → "Nhập kho" lập phiếu nhập hàng hoàn (TL) mỗi kênh một phiếu.
 */
export const khoReturnRoutes = new Hono<AppEnv>();

/**
 * Không tra ra đơn trong danh sách hoàn Poscake: nhận kênh theo đầu mã vận đơn (cùng quy tắc với file Sheet quét hàng hoàn).
 * SPXVN… / GYR… → Shopee · 848… (14 số) → Facebook · 862… / 854… (12 số), TTVN…, TO…, VTPVN… → TikTok · còn lại: chưa rõ.
 * Gói SPX mà có trong danh sách đơn hoàn Facebook của Poscake thì đã được gắn Facebook từ bước tra đơn.
 */
export const guessChannel = (code: string): string | null => {
  if (/^(SPX|GYR)/.test(code)) return 'SHOPEE';
  if (/^848\d{11}$/.test(code)) return 'FACEBOOK';
  if (/^(862|854)\d{9}$/.test(code) || /^(TTVN|TO|VTPVN)/.test(code)) return 'TIKTOK';
  return null;
};
const canWork = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('sx.kiemke');
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const vnToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const vnDay = (back: number) => new Date(Date.now() + 7 * 3_600_000 - back * 86_400_000).toISOString().slice(0, 10);
const ip = (c: { req: { header: (n: string) => string | undefined } }) => c.req.header('CF-Connecting-IP') ?? null;
const PROBLEMS = ['', 'THIEU', 'HONG', 'SAI', 'KHAC'];
/** CAN cần khiếu nại · DA_GUI đã gửi · DUYET sàn duyệt đền · TU_CHOI sàn từ chối · XONG đã nhận tiền · TU_CHIU không khiếu nại được (Facebook) */
const CLAIMS = ['', 'CAN', 'DA_GUI', 'DUYET', 'TU_CHOI', 'XONG', 'TU_CHIU'];
const CLOSED_CLAIMS = ['XONG', 'TU_CHIU', 'TU_CHOI'];

interface ScanRow {
  id: number;
  code: string;
  scan_day: string;
  scanned_at: string;
  scanned_by: string | null;
  channel: string | null;
  order_id: string | null;
  state: string;
  items: string;
  problem: string;
  note: string;
  video_url: string;
  claim: string;
  claim_amount: number;
  order_ref: string;
  doc_id: number | null;
  source: string;
}

function parseItems(s: string): RetItem[] {
  try {
    const v = JSON.parse(s) as RetItem[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Gói có vấn đề: về thiếu so với đơn, có món hỏng, hoặc kho đánh dấu sai / khác. */
function issueOf(s: { items: RetItem[]; problem: string; order_id: string | null }): string[] {
  const out: string[] = [];
  if (!s.order_id) out.push(s.items.length ? 'Nhập gộp / nhập tay' : 'Chưa tra ra đơn');
  const short = s.order_id ? s.items.reduce((n, i) => n + Math.max(0, i.expected - i.received), 0) : 0;
  if (short > 0) out.push(`Thiếu ${short}`);
  const bad = s.items.reduce((n, i) => n + (i.bad || 0), 0);
  if (bad > 0) out.push(`Hỏng ${bad}`);
  if (s.items.some((i) => !i.mapped)) out.push('Có món chưa có mã MISA');
  if (s.problem === 'THIEU' && short === 0) out.push('Thiếu hàng');
  if (s.problem === 'HONG' && bad === 0) out.push('Hỏng');
  if (s.problem === 'SAI') out.push('Sai hàng');
  if (s.problem === 'KHAC') out.push('Khác');
  return out;
}

async function scanView(db: D1Database, rows: ScanRow[]) {
  const keys = rows.filter((r) => r.channel && r.order_id);
  const info = new Map<string, { status: number | null; shop: string; returning_at: string | null; returned_at: string | null }>();
  for (const r of keys) {
    const k = `${r.channel}|${r.order_id}`;
    if (info.has(k)) continue;
    const o = await db
      .prepare('SELECT status, shop, returning_at, returned_at FROM ret_orders WHERE channel = ? AND order_id = ?')
      .bind(r.channel, r.order_id)
      .first<{ status: number | null; shop: string; returning_at: string | null; returned_at: string | null }>();
    if (o) info.set(k, o);
  }
  return rows.map((r) => {
    const items = parseItems(r.items);
    const o = info.get(`${r.channel}|${r.order_id}`);
    return { ...r, items, order: o ?? null, issues: issueOf({ items, problem: r.problem, order_id: r.order_id }) };
  });
}

/** Kéo lại danh sách đơn hoàn từ Poscake (mặc định 3 ngày gần nhất; tối đa 30). */
khoReturnRoutes.post('/sync', async (c) => {
  if (!canWork(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán kho');
  const b = (await c.req.json().catch(() => ({}))) as { days?: unknown };
  const n = Math.min(Math.max(Math.floor(Number(b.days ?? 3)) || 3, 1), 30);
  const days = Array.from({ length: n }, (_, i) => vnDay(i));
  return ok(c, await syncReturns(c.env.DB, c.env.INGEST_KEY, days, (u) => fetch(u)));
});

/** Quét một mã: tra đơn hoàn theo mã vận đơn (hoặc mã đơn), ghi lượt quét chờ nhập kho. */
khoReturnRoutes.post('/scan', async (c) => {
  const auth = c.get('auth');
  if (!canWork(auth)) throw forbidden('Chỉ CEO hoặc kế toán kho');
  const b = (await c.req.json().catch(() => null)) as { code?: unknown; day?: unknown } | null;
  const { code, vietnamese } = normalizeCode(String(b?.code ?? ''));
  if (vietnamese) throw badRequest('UNIKEY', 'Mã có dấu tiếng Việt: tắt Unikey (chuyển sang E) rồi quét lại');
  if (code.length < 5) throw badRequest('BAD_CODE', 'Mã quá ngắn');
  const day = isDate(b?.day) ? b.day : vnToday();
  const db = c.env.DB;
  const dup = await db
    .prepare("SELECT id, scan_day FROM ret_scans WHERE code = ? AND state <> 'HUY' ORDER BY id DESC LIMIT 1")
    .bind(code)
    .first<{ id: number; scan_day: string }>();
  if (dup) throw conflict('DUPLICATE', `Mã này đã quét ngày ${dup.scan_day.split('-').reverse().join('/')}`);
  const hits = (
    await db
      .prepare('SELECT channel, order_id FROM ret_orders WHERE tracking = ? OR UPPER(order_id) = ? LIMIT 3')
      .bind(code, code)
      .all<{ channel: string; order_id: string }>()
  ).results ?? [];
  const hit = hits[0];
  const items = hit ? await expectedItems(db, hit.channel, hit.order_id) : [];
  const now = nowIso();
  const r = await db
    .prepare(
      `INSERT INTO ret_scans (code, scan_day, scanned_at, scanned_by, channel, order_id, items) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(code, day, now, auth.user.id, hit?.channel ?? guessChannel(code), hit?.order_id ?? null, JSON.stringify(items))
    .first<ScanRow>();
  return ok(c, (await scanView(db, r ? [r] : []))[0]);
});

/** Danh sách lượt quét của một ngày (mặc định hôm nay). */
khoReturnRoutes.get('/scans', async (c) => {
  const day = c.req.query('day');
  const d = isDate(day) ? day : vnToday();
  const rows = (
    await c.env.DB.prepare("SELECT * FROM ret_scans WHERE scan_day = ? AND state <> 'HUY' ORDER BY id DESC").bind(d).all<ScanRow>()
  ).results ?? [];
  return ok(c, { day: d, scans: await scanView(c.env.DB, rows) });
});

/** Sửa kết quả kiểm một gói: số về thực tế / bán tiếp / hỏng từng món, vấn đề, ghi chú, link video, tình trạng khiếu nại. */
khoReturnRoutes.put('/scans/:id', async (c) => {
  const auth = c.get('auth');
  if (!canWork(auth)) throw forbidden('Chỉ CEO hoặc kế toán kho');
  const id = Number(c.req.param('id'));
  const db = c.env.DB;
  const row = await db.prepare('SELECT * FROM ret_scans WHERE id = ?').bind(id).first<ScanRow>();
  if (!row) throw notFound('Không thấy lượt quét');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) throw badRequest('BAD_BODY', 'Thiếu dữ liệu');
  let items = parseItems(row.items);
  if (Array.isArray(b.items)) {
    if (row.state !== 'CHO') throw conflict('LOCKED', 'Gói này đã nhập kho, không sửa số được nữa');
    const byItem = new Map(items.map((i) => [i.item, i]));
    items = (b.items as Array<Record<string, unknown>>).map((x) => {
      const base = byItem.get(String(x.item)) ?? { item: String(x.item), name: String(x.name ?? x.item), mapped: true, expected: 0, received: 0, good: 0, bad: 0 };
      const received = Math.max(0, Number(x.received) || 0);
      const bad = Math.min(received, Math.max(0, Number(x.bad) || 0));
      return { ...base, received, bad, good: received - bad };
    });
  }
  let channel = row.channel;
  if (b.channel !== undefined && !row.order_id) {
    if (row.state !== 'CHO') throw conflict('LOCKED', 'Gói này đã nhập kho');
    const ch = String(b.channel);
    if (!['TIKTOK', 'SHOPEE', 'FACEBOOK'].includes(ch)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
    channel = ch;
  }
  if (Array.isArray(b.items) && !row.order_id) {
    const codes = (b.items as Array<Record<string, unknown>>).map((x) => String(x.item));
    const found = codes.length
      ? ((await db.prepare(`SELECT code FROM kho_items WHERE code IN (${codes.map(() => '?').join(',')})`).bind(...codes).all<{ code: string }>()).results ?? []).map((r) => r.code)
      : [];
    const miss = codes.filter((x) => !found.includes(x));
    if (miss.length) throw badRequest('NO_ITEM', `Không có mã ${miss.join(', ')} trong danh mục kho`);
  }
  const problem = b.problem === undefined ? row.problem : String(b.problem);
  const claim = b.claim === undefined ? row.claim : String(b.claim);
  if (!PROBLEMS.includes(problem)) throw badRequest('BAD_PROBLEM', 'Vấn đề không hợp lệ');
  if (!CLAIMS.includes(claim)) throw badRequest('BAD_CLAIM', 'Tình trạng khiếu nại không hợp lệ');
  const video = b.video_url === undefined ? row.video_url : String(b.video_url).trim().slice(0, 500);
  if (video && !/^https:\/\//.test(video)) throw badRequest('BAD_URL', 'Link video phải bắt đầu bằng https://');
  const note = b.note === undefined ? row.note : String(b.note).slice(0, 500);
  // Có vấn đề mà chưa đánh dấu khiếu nại thì tự đưa vào "cần khiếu nại".
  const issues = issueOf({ items, problem, order_id: row.order_id }).filter((x) => x !== 'Có món chưa có mã MISA');
  // Đơn Facebook không khiếu nại được: phần thiếu / hỏng tự chịu hao hụt.
  const claim2 = claim === '' && issues.length && row.order_id ? (channel === 'FACEBOOK' ? 'TU_CHIU' : 'CAN') : claim;
  const amount = b.claim_amount === undefined ? row.claim_amount : Math.max(0, Math.round(Number(b.claim_amount) || 0));
  // (gói không tra ra đơn là nhập tay: không tự đưa vào khiếu nại)
  await db
    .prepare('UPDATE ret_scans SET items = ?, problem = ?, claim = ?, video_url = ?, note = ?, channel = ?, claim_amount = ? WHERE id = ?')
    .bind(JSON.stringify(items), problem, claim2, video, note, channel, amount, id)
    .run();
  const r = await db.prepare('SELECT * FROM ret_scans WHERE id = ?').bind(id).first<ScanRow>();
  return ok(c, (await scanView(db, r ? [r] : []))[0]);
});

/** Bỏ một lượt quét nhầm (chỉ khi chưa nhập kho). */
khoReturnRoutes.delete('/scans/:id', async (c) => {
  if (!canWork(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán kho');
  const r = await c.env.DB.prepare("UPDATE ret_scans SET state = 'HUY' WHERE id = ? AND state = 'CHO'").bind(Number(c.req.param('id'))).run();
  if (!r.meta.changes) throw conflict('LOCKED', 'Gói đã nhập kho hoặc không còn');
  return ok(c, { ok: true });
});

/** Lập phiếu nhập hàng hoàn (TL) với số phiếu TLyymm-nnn; trùng số thì thử số kế tiếp. */
async function createReturnDoc(
  db: D1Database,
  userId: string,
  day: string,
  d: { partner: string; ref: string; note: string; extra: Record<string, unknown> },
): Promise<{ docId: number; no: string }> {
  const ym = day.slice(2, 4) + day.slice(5, 7);
  const now = nowIso();
  for (let attempt = 0; attempt < 4; attempt++) {
    const cnt = await db.prepare("SELECT COUNT(*) AS n FROM kho_docs WHERE type = 'TL' AND no LIKE ?").bind(`TL${ym}-%`).first<{ n: number }>();
    const no = `TL${ym}-${String((cnt?.n ?? 0) + 1 + attempt).padStart(3, '0')}`;
    try {
      await db
        .prepare(
          `INSERT INTO kho_docs (no, type, doc_date, partner, ref_no, ref_qty, note, extra, status, created_by, created_at)
           VALUES (?, 'TL', ?, ?, ?, NULL, ?, ?, 'OK', ?, ?)`,
        )
        .bind(no, day, d.partner, d.ref, d.note.slice(0, 1000), JSON.stringify(d.extra), userId, now)
        .run();
      const id = (await db.prepare('SELECT id FROM kho_docs WHERE no = ?').bind(no).first<{ id: number }>())?.id ?? 0;
      if (id) return { docId: id, no };
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e;
    }
  }
  throw conflict('NO_CLASH', 'Không cấp được số phiếu, thử lại');
}

/**
 * Phiếu nhập hoàn của ngày: kế toán nhập số thực nhập theo sản phẩm (hàng ổn), web so với số dự kiến
 * từ các gói đã quét. Một phiếu cho cả ngày; hàng thiếu không cộng tồn, hàng hỏng chỉ ghi nhận.
 */
async function receiveByActual(
  c: Context<AppEnv>,
  day: string,
  rows: ScanRow[],
  actual: Array<{ item: string; qty: number }>,
) {
  const db = c.env.DB;
  const auth = c.get('auth');
  const codes = [...new Set(actual.map((x) => x.item))];
  if (codes.length) {
    const known = new Set(
      ((await db.prepare(`SELECT code FROM kho_items WHERE code IN (${codes.map(() => '?').join(',')})`).bind(...codes).all<{ code: string }>()).results ?? []).map((r) => r.code),
    );
    const miss = codes.filter((x) => !known.has(x));
    if (miss.length) throw badRequest('NO_ITEM', `Không có mã ${miss.join(', ')} trong danh mục kho`);
  }
  const okBy = new Map<string, number>();
  const badBy = new Map<string, number>();
  const skipped: string[] = [];
  for (const s of rows) {
    for (const it of parseItems(s.items)) {
      if (!it.mapped) {
        if (it.received > 0) skipped.push(`${s.code}: ${it.name}`);
        continue;
      }
      okBy.set(it.item, (okBy.get(it.item) ?? 0) + it.good);
      badBy.set(it.item, (badBy.get(it.item) ?? 0) + it.bad);
    }
  }
  const act = new Map<string, number>();
  for (const x of actual) act.set(x.item, (act.get(x.item) ?? 0) + Math.max(0, Number(x.qty) || 0));
  const diff = [...new Set([...okBy.keys(), ...act.keys()])]
    .map((item) => ({ item, ok: okBy.get(item) ?? 0, actual: act.get(item) ?? 0 }))
    .map((x) => ({ ...x, diff: x.actual - x.ok }))
    .filter((x) => x.diff !== 0);
  const { docId, no } = await createReturnDoc(db, auth.user.id, day, {
    partner: 'Hàng hoàn các sàn',
    ref: `Hoàn ${day}`,
    note:
      `${rows.length} gói` + (diff.length ? `. Lệch so với dự kiến: ${diff.map((x) => `${x.item} ${x.diff > 0 ? '+' : ''}${x.diff}`).join(', ')}` : ''),
    extra: { source: 'ret_scans', channel: 'ALL', day, diff },
  });
  const stmts: D1PreparedStatement[] = [];
  for (const [item, q] of act)
    if (q > 0) stmts.push(db.prepare("INSERT INTO kho_moves (doc_id, item, qty, std_qty, price, role, note) VALUES (?, ?, ?, NULL, NULL, 'RETURN', 'Hàng ổn nhập lại')").bind(docId, item, q));
  for (const [item, q] of badBy)
    if (q > 0) stmts.push(db.prepare("INSERT INTO kho_moves (doc_id, item, qty, std_qty, price, role, note) VALUES (?, ?, 0, ?, NULL, 'DROP', 'Hỏng')").bind(docId, item, q));
  stmts.push(
    db.prepare(`UPDATE ret_scans SET state = 'NHAP', doc_id = ? WHERE id IN (${rows.map(() => '?').join(',')})`).bind(docId, ...rows.map((s) => s.id)),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'KHO_RETURN_RECEIVE',
      entityType: 'KHO_DOC',
      entityId: String(docId),
      after: { no, packages: rows.length, diff },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  );
  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
  return ok(c, [{ channel: 'ALL', no, packages: rows.length, skipped, diff }]);
}

/** Nhập kho các gói đã quét của một ngày: mỗi kênh một phiếu nhập hàng hoàn (TL). Bán tiếp cộng tồn, hỏng chỉ ghi nhận. */
khoReturnRoutes.post('/receive', async (c) => {
  const auth = c.get('auth');
  if (!canWork(auth)) throw forbidden('Chỉ CEO hoặc kế toán kho');
  const b = (await c.req.json().catch(() => null)) as { day?: unknown; actual?: unknown } | null;
  const day = isDate(b?.day) ? b.day : vnToday();
  const db = c.env.DB;
  const rows = (
    await db.prepare("SELECT * FROM ret_scans WHERE scan_day = ? AND state = 'CHO' AND channel IS NOT NULL").bind(day).all<ScanRow>()
  ).results ?? [];
  if (!rows.length) throw badRequest('NOTHING', 'Không có gói nào chờ nhập kho trong ngày này');
  if (Array.isArray(b?.actual)) {
    const actual = (b.actual as Array<Record<string, unknown>>).map((x) => ({ item: String(x.item ?? ''), qty: Number(x.qty) || 0 })).filter((x) => x.item);
    return receiveByActual(c, day, rows, actual);
  }
  const byCh = new Map<string, ScanRow[]>();
  for (const r of rows) byCh.set(r.channel!, [...(byCh.get(r.channel!) ?? []), r]);
  const out: Array<{ channel: string; no: string; packages: number; skipped: string[] }> = [];
  for (const [ch, list] of byCh) {
    const moves = new Map<string, { good: number; bad: number }>();
    const skipped: string[] = [];
    for (const s of list) {
      for (const it of parseItems(s.items)) {
        if (!it.mapped) {
          if (it.received > 0) skipped.push(`${s.code}: ${it.name}`);
          continue;
        }
        const m = moves.get(it.item) ?? { good: 0, bad: 0 };
        m.good += it.good;
        m.bad += it.bad;
        moves.set(it.item, m);
      }
    }
    const { docId, no } = await createReturnDoc(db, auth.user.id, day, {
      partner: CHANNEL_LABELS[ch as Channel] ?? ch,
      ref: `Hoàn ${CHANNEL_LABELS[ch as Channel] ?? ch} ${day}`,
      note: `${list.length} gói: ${list.map((s) => s.code).join(', ')}`,
      extra: { source: 'ret_scans', channel: ch },
    });
    const stmts: D1PreparedStatement[] = [];
    for (const [item, m] of moves) {
      if (m.good > 0)
        stmts.push(db.prepare("INSERT INTO kho_moves (doc_id, item, qty, std_qty, price, role, note) VALUES (?, ?, ?, NULL, NULL, 'RETURN', 'Bán tiếp')").bind(docId, item, m.good));
      if (m.bad > 0)
        stmts.push(db.prepare("INSERT INTO kho_moves (doc_id, item, qty, std_qty, price, role, note) VALUES (?, ?, 0, ?, NULL, 'DROP', 'Hỏng')").bind(docId, item, m.bad));
    }
    stmts.push(
      db.prepare(`UPDATE ret_scans SET state = 'NHAP', doc_id = ? WHERE id IN (${list.map(() => '?').join(',')})`).bind(docId, ...list.map((s) => s.id)),
      auditStatement(db, {
        actorId: auth.user.id,
        action: 'KHO_RETURN_RECEIVE',
        entityType: 'KHO_DOC',
        entityId: String(docId),
        after: { no, channel: ch, packages: list.length },
        requestId: c.get('requestId'),
        ip: ip(c),
      }),
    );
    for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
    out.push({ channel: ch, no, packages: list.length, skipped });
  }
  return ok(c, out);
});

/**
 * Đối soát: mỗi kênh có bao nhiêu đơn sàn báo hoàn, kho đã quét bao nhiêu, gói có vấn đề;
 * danh sách đơn chưa về (quá hạn = nghi thất lạc) và danh sách cần khiếu nại.
 */
khoReturnRoutes.get('/recon', async (c) => {
  const db = c.env.DB;
  const open = (
    await db
      .prepare(
        `SELECT o.channel, o.order_id, o.tracking, o.shop, o.status, o.returning_at, o.returned_at, o.ship_status
         FROM ret_orders o
         WHERE o.status IN (4, 5, 15)
           AND NOT EXISTS (SELECT 1 FROM ret_scans s WHERE s.channel = o.channel AND s.order_id = o.order_id AND s.state <> 'HUY')
         ORDER BY COALESCE(o.returned_at, o.returning_at)`,
      )
      .all<{ channel: string; order_id: string; tracking: string; shop: string; status: number; returning_at: string | null; returned_at: string | null; ship_status: string }>()
  ).results ?? [];
  const now = Date.now();
  const waiting = open.map((o) => {
    const dRet = ageDays(o.returned_at, now);
    const dIng = ageDays(o.returning_at, now);
    const overdue =
      o.status !== 4 && dRet !== null && dRet > OVERDUE_RETURNED_DAYS
        ? `Sàn báo đã hoàn ${dRet} ngày, kho chưa quét`
        : o.status === 4 && dIng !== null && dIng > OVERDUE_RETURNING_DAYS
          ? `Đang hoàn ${dIng} ngày`
          : '';
    return { ...o, overdue };
  });
  const claimRows = (
    await db.prepare("SELECT * FROM ret_scans WHERE state <> 'HUY' AND (claim <> '' OR (order_id IS NULL AND items = '[]' AND state = 'CHO')) ORDER BY scan_day DESC, id DESC LIMIT 500").all<ScanRow>()
  ).results ?? [];
  const scansByCh = (
    await db
      .prepare("SELECT channel, COUNT(*) AS n, SUM(state = 'CHO') AS cho FROM ret_scans WHERE state <> 'HUY' GROUP BY channel")
      .all<{ channel: string | null; n: number; cho: number }>()
  ).results ?? [];
  const summary = ['TIKTOK', 'SHOPEE', 'FACEBOOK'].map((ch) => {
    const w = waiting.filter((x) => x.channel === ch);
    const sc = scansByCh.find((x) => x.channel === ch);
    // Hao hụt: món thiếu + hỏng của các gói có vấn đề; Facebook (tự chịu) tính riêng; tiền sàn đã đền.
    let missing = 0;
    let bad = 0;
    let selfLoss = 0;
    let paid = 0;
    for (const x of claimRows.filter((r) => r.channel === ch && r.order_id)) {
      const its = parseItems(x.items);
      const m = its.reduce((n, i) => n + Math.max(0, i.expected - i.received), 0);
      const b = its.reduce((n, i) => n + (i.bad || 0), 0);
      missing += m;
      bad += b;
      if (x.claim === 'TU_CHIU') selfLoss += m + b;
      paid += x.claim_amount || 0;
    }
    return {
      missing,
      bad,
      self_loss: selfLoss,
      claim_paid: paid,
      channel: ch,
      returning: w.filter((x) => x.status === 4).length,
      returned_not_scanned: w.filter((x) => x.status !== 4).length,
      overdue: w.filter((x) => x.overdue).length,
      scanned: sc?.n ?? 0,
      waiting_receive: sc?.cho ?? 0,
      claims: claimRows.filter((x) => x.channel === ch && x.claim && !CLOSED_CLAIMS.includes(x.claim)).length,
    };
  });
  const unknown = scansByCh.find((x) => x.channel === null);
  // Kho đã quét nhận (thực tế đã hoàn về) nhưng Poscake vẫn ghi "Đang hoàn": nhắc cập nhật trạng thái trên Poscake.
  const lag = (
    await db
      .prepare(
        `SELECT s.channel, s.order_id, s.code, s.scan_day, o.shop FROM ret_scans s
         JOIN ret_orders o ON o.channel = s.channel AND o.order_id = s.order_id
         WHERE s.state <> 'HUY' AND o.status = 4 ORDER BY s.scan_day DESC LIMIT 500`,
      )
      .all<{ channel: string; order_id: string; code: string; scan_day: string; shop: string }>()
  ).results ?? [];
  return ok(c, {
    summary,
    poscake_lag: lag,
    unknown_scans: unknown?.n ?? 0,
    waiting,
    claims: await scanView(db, claimRows),
    rules: { returned_days: OVERDUE_RETURNED_DAYS, returning_days: OVERDUE_RETURNING_DAYS },
  });
});

/** Nạp các mã đã quét trước đây (dán từ file Sheet "Đơn hoàn các sàn": ngày + mã vận đơn). Mã trùng thì bỏ qua. */
khoReturnRoutes.post('/import', async (c) => {
  const auth = c.get('auth');
  if (!canWork(auth)) throw forbidden('Chỉ CEO hoặc kế toán kho');
  const b = (await c.req.json().catch(() => null)) as { rows?: unknown } | null;
  const rows = Array.isArray(b?.rows) ? (b.rows as Array<{ day?: unknown; code?: unknown }>) : [];
  if (!rows.length || rows.length > 3000) throw badRequest('BAD_ROWS', 'Không có dòng nào hoặc quá nhiều');
  const db = c.env.DB;
  let added = 0;
  let dup = 0;
  let found = 0;
  const now = nowIso();
  for (const r of rows) {
    const { code } = normalizeCode(String(r.code ?? ''));
    if (code.length < 5 || !isDate(r.day)) continue;
    const exists = await db.prepare("SELECT 1 FROM ret_scans WHERE code = ? AND state <> 'HUY'").bind(code).first();
    if (exists) {
      dup += 1;
      continue;
    }
    const hit = await db
      .prepare('SELECT channel, order_id FROM ret_orders WHERE tracking = ? OR UPPER(order_id) = ? LIMIT 1')
      .bind(code, code)
      .first<{ channel: string; order_id: string }>();
    const items = hit ? await expectedItems(db, hit.channel, hit.order_id) : [];
    if (hit) found += 1;
    await db
      .prepare("INSERT INTO ret_scans (code, scan_day, scanned_at, scanned_by, channel, order_id, items, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'IMPORT')")
      .bind(code, r.day, now, auth.user.id, hit?.channel ?? guessChannel(code), hit?.order_id ?? null, JSON.stringify(items))
      .run();
    added += 1;
  }
  return ok(c, { added, duplicate: dup, matched: found });
});

/** Gắn lại đơn cho các mã đã quét nhưng lúc quét chưa có trong danh sách hoàn (Poscake cập nhật chậm). */
khoReturnRoutes.post('/rematch', async (c) => {
  if (!canWork(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán kho');
  const db = c.env.DB;
  const rows = (
    await db
      .prepare("SELECT id, code, order_ref FROM ret_scans WHERE order_id IS NULL AND state = 'CHO' AND source <> 'BULK'")
      .all<{ id: number; code: string; order_ref: string }>()
  ).results ?? [];
  let n = 0;
  for (const r of rows) {
    let hit = await db
      .prepare('SELECT channel, order_id FROM ret_orders WHERE tracking = ? OR UPPER(order_id) = ? LIMIT 1')
      .bind(r.code, r.code)
      .first<{ channel: string; order_id: string }>();
    if (!hit && r.order_ref)
      hit = await db
        .prepare('SELECT channel, order_id FROM ret_orders WHERE tracking = ? OR UPPER(order_id) = ? LIMIT 1')
        .bind(r.order_ref, r.order_ref)
        .first<{ channel: string; order_id: string }>();
    if (!hit) continue;
    const items = await expectedItems(db, hit.channel, hit.order_id);
    await db.prepare('UPDATE ret_scans SET channel = ?, order_id = ?, items = ? WHERE id = ?').bind(hit.channel, hit.order_id, JSON.stringify(items), r.id).run();
    n += 1;
  }
  return ok(c, { matched: n, left: rows.length - n });
});

/* ---------- Ảnh phiếu kiểm hàng hoàn theo ngày (in ra, tích tay, chụp tải lên) ---------- */
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
khoReturnRoutes.post('/files', async (c) => {
  const auth = c.get('auth');
  if (!canWork(auth)) throw forbidden('Chỉ CEO hoặc kế toán kho');
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  const day = String(form?.get('day') ?? '');
  if (!file || typeof file === 'string') throw badRequest('MISSING', 'Chưa chọn ảnh');
  if (!isDate(day)) throw badRequest('BAD_DAY', 'Thiếu ngày');
  if (!FILE_TYPES.includes(file.type)) throw badRequest('BAD_TYPE', 'Chỉ nhận ảnh (jpg, png, webp) hoặc PDF');
  if (file.size > 1_600_000) throw badRequest('TOO_LARGE', 'Ảnh quá 1,5 MB');
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO ret_day_files (id, scan_day, name, mime, size, data, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, day, file.name || 'phieu-kiem.jpg', file.type, file.size, new Uint8Array(await file.arrayBuffer()), auth.user.id, nowIso())
    .run();
  return ok(c, { id });
});

khoReturnRoutes.get('/files', async (c) => {
  const day = c.req.query('day');
  const rows = await c.env.DB.prepare('SELECT id, name, mime, size, uploaded_at FROM ret_day_files WHERE scan_day = ? ORDER BY uploaded_at')
    .bind(isDate(day) ? day : vnToday())
    .all();
  return ok(c, rows.results ?? []);
});

khoReturnRoutes.get('/files/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT name, mime, data FROM ret_day_files WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ name: string; mime: string; data: unknown }>();
  if (!row) throw notFound('Không thấy ảnh');
  const d = row.data;
  const bytes =
    d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : Uint8Array.from((Array.isArray(d) ? d : Object.values(d as object)) as number[]);
  return new Response(bytes as unknown as BodyInit, {
    headers: { 'content-type': row.mime, 'content-disposition': `inline; filename="${encodeURIComponent(row.name)}"`, 'cache-control': 'private, max-age=300' },
  });
});

/**
 * Gói hoàn mang mã vận đơn khác (khách đổi đơn vị vận chuyển khi hoàn, ví dụ J&T → Viettel Post):
 * kho gõ mã đơn hoặc mã vận đơn gốc để gắn gói vào đúng đơn và lấy ra các món phải về.
 */
khoReturnRoutes.post('/scans/:id/link', async (c) => {
  if (!canWork(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán kho');
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => null)) as { code?: unknown } | null;
  const { code } = normalizeCode(String(b?.code ?? ''));
  if (code.length < 5) throw badRequest('BAD_CODE', 'Nhập mã đơn hoặc mã vận đơn gốc');
  const row = await db.prepare('SELECT * FROM ret_scans WHERE id = ?').bind(id).first<ScanRow>();
  if (!row) throw notFound('Không thấy lượt quét');
  if (row.state !== 'CHO') throw conflict('LOCKED', 'Gói đã nhập kho');
  const hit = await db
    .prepare('SELECT channel, order_id FROM ret_orders WHERE tracking = ? OR UPPER(order_id) = ? LIMIT 1')
    .bind(code, code)
    .first<{ channel: string; order_id: string }>();
  if (!hit) throw notFound('Chưa thấy đơn hoàn nào có mã này. Kiểm tra lại mã, hoặc nhập tay các món.');
  const items = await expectedItems(db, hit.channel, hit.order_id);
  await db
    .prepare("UPDATE ret_scans SET channel = ?, order_id = ?, items = ?, note = TRIM(note || ' Mã gốc: ' || ?) WHERE id = ?")
    .bind(hit.channel, hit.order_id, JSON.stringify(items), code, id)
    .run();
  const r = await db.prepare('SELECT * FROM ret_scans WHERE id = ?').bind(id).first<ScanRow>();
  return ok(c, (await scanView(db, r ? [r] : []))[0]);
});

/**
 * Nhập gộp hàng của các gói chưa tra ra đơn: kho chỉ ghi sản phẩm + số lượng cho cả ngày (theo kênh),
 * không phải chia từng gói. Lưu thành một dòng "gộp" chờ nhập kho; ghi lại là thay dòng gộp cũ của kênh đó.
 */
khoReturnRoutes.post('/bulk', async (c) => {
  const auth = c.get('auth');
  if (!canWork(auth)) throw forbidden('Chỉ CEO hoặc kế toán kho');
  const b = (await c.req.json().catch(() => null)) as { day?: unknown; channel?: unknown; items?: unknown } | null;
  const day = isDate(b?.day) ? b.day : vnToday();
  const channel = String(b?.channel ?? '');
  if (!['TIKTOK', 'SHOPEE', 'FACEBOOK'].includes(channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const raw = Array.isArray(b?.items) ? (b.items as Array<Record<string, unknown>>) : [];
  const db = c.env.DB;
  const codes = raw.map((x) => String(x.item ?? ''));
  const names = new Map(
    codes.length
      ? (((await db.prepare(`SELECT code, name FROM kho_items WHERE code IN (${codes.map(() => '?').join(',')})`).bind(...codes).all<{ code: string; name: string }>()).results ?? []).map((r) => [r.code, r.name]))
      : [],
  );
  const items: RetItem[] = [];
  for (const x of raw) {
    const code = String(x.item ?? '');
    if (!names.has(code)) throw badRequest('NO_ITEM', `Không có mã ${code} trong danh mục kho`);
    const received = Math.max(0, Number(x.received) || 0);
    const bad = Math.min(received, Math.max(0, Number(x.bad) || 0));
    if (received > 0) items.push({ item: code, name: names.get(code)!, mapped: true, expected: 0, received, good: received - bad, bad });
  }
  const code = `GOP-${day}-${channel}`;
  await db.prepare("DELETE FROM ret_scans WHERE code = ? AND state = 'CHO'").bind(code).run();
  if (items.length) {
    await db
      .prepare("INSERT INTO ret_scans (code, scan_day, scanned_at, scanned_by, channel, order_id, items, note, source) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'BULK')")
      .bind(code, day, nowIso(), auth.user.id, channel, JSON.stringify(items), 'Nhập gộp hàng của các gói chưa tra ra đơn')
      .run();
  }
  return ok(c, { items: items.length });
});

/** Gói chưa tra ra đơn (mọi ngày): để kế toán tra trên seller và điền mã đơn. */
khoReturnRoutes.get('/unmatched', async (c) => {
  const rows = (
    await c.env.DB
      .prepare("SELECT * FROM ret_scans WHERE order_id IS NULL AND state = 'CHO' AND source <> 'BULK' ORDER BY scan_day DESC, id DESC LIMIT 500")
      .all<ScanRow>()
  ).results ?? [];
  return ok(c, rows);
});

/**
 * Kế toán điền mã đơn (tra trên seller) cho gói chưa tra ra đơn. Có đơn đó trong danh sách hoàn Poscake thì gắn luôn
 * và lấy ra các món phải về; chưa có thì lưu lại mã đơn, lần kéo / gắn lại sau sẽ tự khớp.
 */
khoReturnRoutes.post('/scans/:id/order-ref', async (c) => {
  if (!canWork(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán kho');
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const b = (await c.req.json().catch(() => null)) as { order_ref?: unknown; channel?: unknown } | null;
  const ref = normalizeCode(String(b?.order_ref ?? '')).code;
  if (ref.length < 4) throw badRequest('BAD_CODE', 'Nhập mã đơn tra được trên seller');
  const row = await db.prepare('SELECT * FROM ret_scans WHERE id = ?').bind(id).first<ScanRow>();
  if (!row) throw notFound('Không thấy lượt quét');
  if (row.state !== 'CHO') throw conflict('LOCKED', 'Gói đã nhập kho');
  const ch = b?.channel === undefined || b.channel === '' ? null : String(b.channel);
  if (ch && !['TIKTOK', 'SHOPEE', 'FACEBOOK'].includes(ch)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const hit = await db
    .prepare('SELECT channel, order_id FROM ret_orders WHERE tracking = ? OR UPPER(order_id) = ? LIMIT 1')
    .bind(ref, ref)
    .first<{ channel: string; order_id: string }>();
  if (hit) {
    const items = await expectedItems(db, hit.channel, hit.order_id);
    await db
      .prepare('UPDATE ret_scans SET channel = ?, order_id = ?, items = ?, order_ref = ? WHERE id = ?')
      .bind(hit.channel, hit.order_id, JSON.stringify(items), ref, id)
      .run();
  } else {
    await db.prepare('UPDATE ret_scans SET order_ref = ?, channel = COALESCE(?, channel) WHERE id = ?').bind(ref, ch, id).run();
  }
  const r = await db.prepare('SELECT * FROM ret_scans WHERE id = ?').bind(id).first<ScanRow>();
  const view = (await scanView(db, r ? [r] : []))[0];
  return ok(c, { ...view, linked: !!hit });
});

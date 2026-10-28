import { Hono } from 'hono';
import { nowIso, vnDate } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, conflict, forbidden, notFound, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import { newId } from '../lib/ids';
import { accountantIds, taskStatements } from '../lib/notifyTasks';
import { requirePermission } from '../middleware/rbac';
import { CHANNELS, loadLookups, resolveLabel, type Channel } from '../services/channelOut';
import { loadMapVersions, pickMap, recomputeDay } from '../services/poscake';

/**
 * Quản trị › Cấu hình › Sản phẩm & combo (chị Hoa duyệt demo 28/10/2026).
 * Sản phẩm gốc = mã kho/MISA (kho_items TP/HH). Combo = bảng quy đổi mã các sàn (channel_map), mỗi món có loại
 * sp / gift (quà) / pack (bao bì) / skip (bỏ qua). Lưu combo thì tính lại phiếu xuất các ngày có đơn (recomputeDay).
 * Chỉ CEO và kế toán (order.accounting.confirm) sửa; ai vào được trang quản trị/vận hành thì xem (kho soạn hàng).
 */
export const sanphamRoutes = new Hono<AppEnv>();
sanphamRoutes.use('*', requirePermission('hub.access'));

export const canEditCombo = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('order.accounting.confirm');
const ip = (c: { req: { header: (n: string) => string | undefined } }) => c.req.header('CF-Connecting-IP') ?? null;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['sp', 'gift', 'pack', 'skip'] as const;
type Kind = (typeof KINDS)[number];
const isChannel = (v: unknown): v is Channel => typeof v === 'string' && (CHANNELS as readonly string[]).includes(v);
const codeOf = (label: string) => label.split(' - ')[0]!.trim();
/** Tiêu đề việc của kế toán (Việc hôm nay); cùng một tiêu đề đầu để tìm lại và cập nhật số. */
export const TASK_PREFIX = 'Nhập combo mới chưa quy đổi';

async function daysOf(db: D1Database, channel: string, sku: string, fromDay: string): Promise<string[]> {
  const r = await db
    .prepare('SELECT DISTINCT day FROM channel_order_lines WHERE channel = ? AND sku = ? AND day >= ? ORDER BY day')
    .bind(channel, sku, fromDay)
    .all<{ day: string }>();
  return (r.results ?? []).map((x) => x.day);
}

export interface Unmapped {
  channel: string;
  sku: string;
  variant: string;
  name: string;
  orders: number;
  qty: number;
  first_day: string;
  last_day: string;
  shops: string[];
}

/** Mã trên đơn sàn chưa có combo đang dùng (kho chưa trừ được, giá vốn chưa tính). */
export async function listUnmapped(db: D1Database): Promise<Unmapped[]> {
  const codes = new Set(((await db.prepare('SELECT code FROM kho_items').all<{ code: string }>()).results ?? []).map((r) => r.code.toLowerCase()));
  const out: Unmapped[] = [];
  for (const ch of CHANNELS) {
    const map = await loadMapVersions(db, ch);
    const rows = await db
      .prepare(
        `SELECT sku, variant, day, COALESCE(shop, '') AS shop, MIN(name) AS name, ROUND(SUM(qty), 3) AS qty, COUNT(DISTINCT order_id) AS orders
         FROM channel_order_lines WHERE channel = ? GROUP BY sku, variant, day, shop`,
      )
      .bind(ch)
      .all<{ sku: string; variant: string; day: string; shop: string; name: string; qty: number; orders: number }>();
    const agg = new Map<string, Unmapped>();
    for (const r of rows.results ?? []) {
      if (pickMap(map, r.sku, r.variant, r.day) || codes.has(r.sku.toLowerCase())) continue;
      const k = `${r.sku}|${r.variant}`;
      let a = agg.get(k);
      if (!a) {
        a = { channel: ch, sku: r.sku, variant: r.variant, name: r.name ?? '', orders: 0, qty: 0, first_day: r.day, last_day: r.day, shops: [] };
        agg.set(k, a);
      }
      a.orders += r.orders;
      a.qty += r.qty;
      if (r.day < a.first_day) a.first_day = r.day;
      if (r.day > a.last_day) a.last_day = r.day;
      if (r.shop && !a.shops.includes(r.shop)) a.shops.push(r.shop);
    }
    out.push(...agg.values());
  }
  return out.sort((a, b) => b.orders - a.orders || a.sku.localeCompare(b.sku));
}

/**
 * Báo kế toán (Việc hôm nay): còn mã chưa quy đổi thì giữ đúng MỘT việc đang mở cho mỗi kế toán, tiêu đề ghi số mã và số đơn;
 * hết mã thì tự đóng việc đó. Cron chạy sau khi kéo đơn Poscake; lưu combo cũng gọi lại.
 */
export async function syncComboTasks(db: D1Database): Promise<{ codes: number; orders: number; opened: number; closed: number }> {
  const un = await listUnmapped(db);
  const orders = un.reduce((s, u) => s + u.orders, 0);
  const now = nowIso();
  const open = (
    await db
      .prepare("SELECT id, assignee_id FROM tasks WHERE status = 'OPEN' AND title LIKE ?")
      .bind(TASK_PREFIX + '%')
      .all<{ id: string; assignee_id: string }>()
  ).results ?? [];
  if (!un.length) {
    if (open.length) {
      await db
        .prepare(`UPDATE tasks SET status = 'DONE', completed_at = ?, updated_at = ? WHERE status = 'OPEN' AND title LIKE ?`)
        .bind(now, now, TASK_PREFIX + '%')
        .run();
    }
    return { codes: 0, orders: 0, opened: 0, closed: open.length };
  }
  const by: Record<string, number> = {};
  for (const u of un) by[u.channel] = (by[u.channel] ?? 0) + 1;
  const title =
    `${TASK_PREFIX}: ${un.length} mã (` +
    Object.entries(by).map(([c, n]) => `${c === 'FACEBOOK' ? 'Facebook' : c === 'SHOPEE' ? 'Shopee' : 'TikTok'} ${n}`).join(', ') +
    `), ${orders} đơn chưa tính giá vốn. Quản trị › Cấu hình › Sản phẩm & combo › Mã chưa quy đổi`;
  if (open.length) {
    await db.prepare(`UPDATE tasks SET title = ?, updated_at = ? WHERE status = 'OPEN' AND title LIKE ?`).bind(title, now, TASK_PREFIX + '%').run();
  }
  const have = new Set(open.map((t) => t.assignee_id));
  const ids = (await accountantIds(db)).filter((id) => !have.has(id));
  const stmts = taskStatements(db, ids, { title, createdBy: null, now, priority: 'HIGH' });
  if (stmts.length) await db.batch(stmts);
  return { codes: un.length, orders, opened: stmts.length, closed: 0 };
}

/** Tất cả combo (mọi kênh) kèm số đơn và shop đang bán, để trang quản trị và kho cùng đọc. */
sanphamRoutes.get('/combos', async (c) => {
  const db = c.env.DB;
  const [rows, sales] = await Promise.all([
    db
      .prepare(
        `SELECT channel, sku, variant, from_day, item_label, qty, kind, note, off_from, updated_at
         FROM channel_map ORDER BY channel, sku, variant, from_day, kind, item_label`,
      )
      .all(),
    db
      .prepare(
        `SELECT channel, sku, variant, COALESCE(shop, '') AS shop, COUNT(DISTINCT order_id) AS orders, MAX(day) AS last_day
         FROM channel_order_lines GROUP BY channel, sku, variant, shop`,
      )
      .all(),
  ]);
  // Mã kho của từng món: tên đã gán riêng (channel_alias, như kho đang trừ) hoặc phần "MÃ" trước " - ".
  const lk = await loadLookups(db);
  const out = (rows.results ?? []).map((r) => {
    const label = String((r as { item_label: string }).item_label);
    return { ...r, code: resolveLabel(label, lk) ?? codeOf(label) };
  });
  return ok(c, { rows: out, sales: sales.results ?? [], can_edit: canEditCombo(c.get('auth')) });
});

sanphamRoutes.get('/history', async (c) => {
  const ch = c.req.query('channel');
  const sku = String(c.req.query('sku') ?? '').trim();
  if (!isChannel(ch) || !sku) throw badRequest('MISSING', 'Cần kênh và mã');
  const r = await c.env.DB
    .prepare(
      `SELECT a.action, a.before_json, a.after_json, a.created_at, u.display_name AS by_name
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.entity_type IN ('KHO_ONLINE', 'SP_COMBO') AND a.entity_id = ? ORDER BY a.created_at DESC LIMIT 100`,
    )
    .bind(`${ch}:${sku}`)
    .all();
  return ok(c, r.results ?? []);
});

sanphamRoutes.get('/unmapped', async (c) => ok(c, await listUnmapped(c.env.DB)));

/**
 * Lưu trọn một combo (một bản áp dụng từ from_day): thay mọi món của bản đó, bỏ cờ "cần kế toán xác nhận".
 * new_from: shop đổi combo từ ngày X → giữ bản cũ cho các ngày trước, thêm bản mới từ X.
 */
sanphamRoutes.put('/combo', async (c) => {
  const auth = c.get('auth');
  if (!canEditCombo(auth)) throw forbidden('Chỉ CEO hoặc kế toán sửa combo');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const ch = b.channel;
  const sku = String(b?.sku ?? '').trim();
  const variant = String(b?.variant ?? '').trim();
  const fromDay = String(b?.from_day ?? '').trim();
  if (!sku) throw badRequest('MISSING', 'Cần mã trên sàn');
  if (sku.length > 120 || variant.length > 200) throw badRequest('TOO_LONG', 'Mã hoặc phân loại quá dài');
  if (fromDay && !DAY.test(fromDay)) throw badRequest('BAD_DATE', 'Ngày áp dụng không hợp lệ');
  const raw = Array.isArray(b?.parts) ? (b.parts as Array<Record<string, unknown>>) : [];
  if (raw.length > 40) throw badRequest('TOO_MANY', 'Một combo tối đa 40 món');
  const parts = raw
    .map((p) => ({
      label: String(p.item_label ?? '').trim(),
      qty: Number(p.qty),
      kind: (KINDS as readonly string[]).includes(String(p.kind)) ? (String(p.kind) as Kind) : 'sp',
    }))
    .filter((p) => p.label);
  if (!parts.some((p) => p.kind === 'sp' || p.kind === 'skip')) throw badRequest('NO_PARTS', 'Combo cần ít nhất 1 sản phẩm');
  if (parts.some((p) => !(Number.isFinite(p.qty) && p.qty > 0 && p.qty <= 1000))) throw badRequest('BAD_QTY', 'Số lượng phải lớn hơn 0');
  // Mỗi món phải là mã có trong kho (trừ dòng BỎ QUA): không còn món "(chưa có mã)".
  const items = new Map(
    ((await c.env.DB.prepare('SELECT code, name FROM kho_items').all<{ code: string; name: string }>()).results ?? []).map((r) => [
      r.code.toLowerCase(),
      r,
    ]),
  );
  const merged = new Map<string, { label: string; qty: number; kind: Kind }>();
  for (const p of parts) {
    let label = p.label;
    if (p.kind === 'skip') label = 'BỎ QUA';
    else {
      const it = items.get(codeOf(p.label).toLowerCase());
      if (!it) throw badRequest('NO_CODE', `Món "${p.label}" chưa có trong Sản phẩm gốc`);
      label = `${it.code} - ${it.name}`;
    }
    const k = label.toLowerCase();
    const m = merged.get(k);
    if (m) m.qty += p.qty;
    else merged.set(k, { label, qty: p.qty, kind: p.kind });
  }
  const before = (
    await c.env.DB
      .prepare('SELECT item_label, qty, kind FROM channel_map WHERE channel = ? AND sku = ? AND variant = ? AND from_day = ?')
      .bind(ch, sku, variant, fromDay)
      .all<{ item_label: string; qty: number; kind: string }>()
  ).results ?? [];
  const off = await c.env.DB
    .prepare("SELECT MAX(off_from) AS o FROM channel_map WHERE channel = ? AND sku = ? AND variant = ?")
    .bind(ch, sku, variant)
    .first<{ o: string | null }>();
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM channel_map WHERE channel = ? AND sku = ? AND variant = ? AND from_day = ?').bind(ch, sku, variant, fromDay),
    ...[...merged.values()].map((p) =>
      c.env.DB
        .prepare(
          `INSERT INTO channel_map (channel, sku, variant, from_day, item_label, qty, note, updated_by, updated_at, kind, off_from)
           VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`,
        )
        .bind(ch, sku, variant, fromDay, p.label, p.qty, auth.user.id, now, p.kind, off?.o ?? ''),
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: before.length ? 'SP_COMBO_SAVE' : 'SP_COMBO_ADD',
      entityType: 'SP_COMBO',
      entityId: `${ch}:${sku}`,
      before: before.length ? { variant, from_day: fromDay, parts: before.map((r) => [r.item_label, r.qty, r.kind]) } : undefined,
      after: { variant, from_day: fromDay, parts: [...merged.values()].map((p) => [p.label, p.qty, p.kind]) },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  const days = await daysOf(c.env.DB, ch, sku, fromDay);
  for (const d of days) await recomputeDay(c.env.DB, ch, d);
  const orders = days.length
    ? ((await c.env.DB
        .prepare(`SELECT COUNT(DISTINCT order_id) AS n FROM channel_order_lines WHERE channel = ? AND sku = ? AND day >= ?`)
        .bind(ch, sku, fromDay)
        .first<{ n: number }>())?.n ?? 0)
    : 0;
  const tasks = await syncComboTasks(c.env.DB);
  return ok(c, { parts: merged.size, recomputed_days: days.length, orders, unmapped_left: tasks.codes });
});

/** Ngừng dùng combo từ một ngày (đơn trước ngày đó giữ cách tính cũ), hoặc dùng lại (off_from = ''). */
sanphamRoutes.post('/combo/stop', async (c) => {
  const auth = c.get('auth');
  if (!canEditCombo(auth)) throw forbidden('Chỉ CEO hoặc kế toán sửa combo');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isChannel(b?.channel)) throw badRequest('BAD_CHANNEL', 'Chọn kênh');
  const ch = b.channel;
  const sku = String(b?.sku ?? '').trim();
  const variant = String(b?.variant ?? '').trim();
  const offFrom = b?.off_from === '' ? '' : String(b?.off_from ?? vnDate()).trim();
  if (!sku) throw badRequest('MISSING', 'Cần mã trên sàn');
  if (offFrom && !DAY.test(offFrom)) throw badRequest('BAD_DATE', 'Ngày không hợp lệ');
  const cur = await c.env.DB
    .prepare('SELECT COUNT(*) AS n, MAX(off_from) AS o FROM channel_map WHERE channel = ? AND sku = ? AND variant = ?')
    .bind(ch, sku, variant)
    .first<{ n: number; o: string | null }>();
  if (!cur?.n) throw notFound('Không thấy combo này');
  if (offFrom && cur.o) throw conflict('STOPPED', 'Combo này đã ngừng dùng');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE channel_map SET off_from = ?, updated_by = ?, updated_at = ? WHERE channel = ? AND sku = ? AND variant = ?').bind(
      offFrom,
      auth.user.id,
      nowIso(),
      ch,
      sku,
      variant,
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: offFrom ? 'SP_COMBO_STOP' : 'SP_COMBO_RESUME',
      entityType: 'SP_COMBO',
      entityId: `${ch}:${sku}`,
      before: { variant, off_from: cur.o ?? '' },
      after: { variant, off_from: offFrom },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  const days = await daysOf(c.env.DB, ch, sku, offFrom || cur.o || '');
  for (const d of days) await recomputeDay(c.env.DB, ch, d);
  await syncComboTasks(c.env.DB);
  return ok(c, { recomputed_days: days.length });
});

/** Sản phẩm gốc: mã kho thành phẩm / hàng hóa, mã bán Kênh phân phối đang nối, số combo đang dùng mã đó. */
sanphamRoutes.get('/products', async (c) => {
  const db = c.env.DB;
  const [items, maps] = await Promise.all([
    db.prepare("SELECT code, name, unit, cls, grp, active, created_at FROM kho_items WHERE cls IN ('TP', 'HH') ORDER BY code").all(),
    db.prepare('SELECT crm_sku, misa_code, factor FROM kho_map').all(),
  ]);
  return ok(c, { items: items.results ?? [], kho_map: maps.results ?? [], can_edit: canEditCombo(c.get('auth')) });
});

/** Thêm sản phẩm một bước: mã kho/MISA + (tuỳ chọn) mã bán Kênh phân phối cùng mã + nối mã hệ số 1. Giá vốn ghi ở trình duyệt (Giá vốn SKU). */
sanphamRoutes.post('/products', async (c) => {
  const auth = c.get('auth');
  if (!canEditCombo(auth)) throw forbidden('Chỉ CEO hoặc kế toán thêm sản phẩm');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const code = String(b?.code ?? '').trim();
  const name = String(b?.name ?? '').trim();
  const unit = String(b?.unit ?? '').trim();
  const cls = b?.cls === 'HH' ? 'HH' : 'TP';
  if (!code || !name) throw badRequest('MISSING', 'Cần mã kho và tên sản phẩm');
  if (!/^[\w.\-+]{2,40}$/.test(code)) throw badRequest('BAD_CODE', 'Mã kho chỉ gồm chữ không dấu, số, dấu chấm, gạch (2–40 ký tự)');
  if (name.length > 200) throw badRequest('TOO_LONG', 'Tên quá dài');
  if (await c.env.DB.prepare('SELECT 1 FROM kho_items WHERE lower(code) = lower(?)').bind(code).first()) throw conflict('DUP_CODE', 'Mã kho này đã có');
  const kpp = b?.kpp === true;
  if (kpp && (await c.env.DB.prepare('SELECT 1 FROM products WHERE lower(sku) = lower(?)').bind(code).first())) {
    throw conflict('DUP_SKU', 'Đã có mã bán Kênh phân phối trùng mã này');
  }
  const now = nowIso();
  const productId = kpp ? newId() : null;
  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(
      "INSERT INTO kho_items (code, name, unit, cls, grp, min_stock, active, created_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?)",
    ).bind(code, name, unit, cls, cls === 'TP' ? 'Thành phẩm' : 'Hàng hóa', now),
  ];
  if (kpp) {
    stmts.push(
      c.env.DB.prepare(
        "INSERT OR IGNORE INTO product_groups (id, code, name, created_at, updated_at) VALUES (?, 'QUA_TANG', 'Quà tặng và gia dụng', ?, ?)",
      ).bind(newId(), now, now),
      c.env.DB.prepare(
        `INSERT INTO products (id, sku, name, unit, group_id, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ${cls === 'HH' ? "(SELECT id FROM product_groups WHERE code = 'QUA_TANG')" : 'NULL'}, 1, ?, ?)`,
      ).bind(productId, code, name, unit || null, now, now),
      c.env.DB.prepare("INSERT OR IGNORE INTO kho_map (crm_sku, misa_code, factor, note) VALUES (?, ?, 1, 'Tạo ở Sản phẩm & combo')").bind(code, code),
    );
  }
  stmts.push(
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'SP_PRODUCT_ADD',
      entityType: 'KHO_ITEM',
      entityId: code,
      after: { code, name, unit, cls, product_id: productId },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  );
  await c.env.DB.batch(stmts);
  return ok(c, { code, product_id: productId });
});

/** Sửa tên / đơn vị / ngừng dùng một sản phẩm gốc. Mã kho không đổi (đã có phiếu kho, MISA dùng). */
sanphamRoutes.patch('/products/:code', async (c) => {
  const auth = c.get('auth');
  if (!canEditCombo(auth)) throw forbidden('Chỉ CEO hoặc kế toán sửa sản phẩm');
  const code = c.req.param('code');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const cur = await c.env.DB
    .prepare("SELECT code, name, unit, cls, active FROM kho_items WHERE code = ? AND cls IN ('TP', 'HH')")
    .bind(code)
    .first<{ code: string; name: string; unit: string; cls: string; active: number }>();
  if (!cur) throw notFound('Không thấy sản phẩm này');
  const name = b?.name == null ? cur.name : String(b.name).trim();
  const unit = b?.unit == null ? cur.unit : String(b.unit).trim();
  const active = b?.active == null ? cur.active : b.active ? 1 : 0;
  if (!name) throw badRequest('MISSING', 'Cần tên sản phẩm');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE kho_items SET name = ?, unit = ?, active = ? WHERE code = ?').bind(name, unit, active, code),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'SP_PRODUCT_EDIT',
      entityType: 'KHO_ITEM',
      entityId: code,
      before: { name: cur.name, unit: cur.unit, active: cur.active },
      after: { name, unit, active },
      requestId: c.get('requestId'),
      ip: ip(c),
    }),
  ]);
  return ok(c, { code });
});

/**
 * Lưu vết giá vốn sản phẩm gốc (chị Hoa dặn 28/10: sửa là có lịch sử). Giá vốn vẫn cất ở Giá vốn SKU (dữ liệu chung của web);
 * trình duyệt ghi xong thì báo lên đây để ghi nhật ký: ai sửa, lúc nào, tháng nào, giá cũ → giá mới.
 */
sanphamRoutes.post('/cost-log', async (c) => {
  const auth = c.get('auth');
  if (!canEditCombo(auth)) throw forbidden('Chỉ CEO hoặc kế toán sửa giá vốn');
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const code = String(b?.code ?? '').trim();
  const ky = String(b?.ky ?? '').trim();
  const v = Number(b?.new);
  const old = b?.old == null || b.old === '' ? null : Number(b.old);
  if (!code || code.length > 60) throw badRequest('MISSING', 'Thiếu mã');
  if (!/^\d{4}-\d{2}$/.test(ky)) throw badRequest('BAD_KY', 'Tháng không hợp lệ');
  if (!(Number.isFinite(v) && v > 0 && v < 1e9)) throw badRequest('BAD_PRICE', 'Giá vốn không hợp lệ');
  await auditStatement(c.env.DB, {
    actorId: auth.user.id,
    action: 'SP_GIA_VON',
    entityType: 'SP_GIA_VON',
    entityId: code,
    before: { ky, gia: old != null && Number.isFinite(old) ? old : null },
    after: { ky, gia: Math.round(v) },
    requestId: c.get('requestId'),
    ip: ip(c),
  }).run();
  return ok(c, { code });
});

sanphamRoutes.get('/cost-history', async (c) => {
  const code = String(c.req.query('code') ?? '').trim();
  if (!code) throw badRequest('MISSING', 'Thiếu mã');
  const r = await c.env.DB
    .prepare(
      `SELECT a.action, a.before_json, a.after_json, a.created_at, u.display_name AS by_name
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       WHERE ((a.entity_type = 'SP_GIA_VON') OR (a.entity_type = 'KHO_ITEM' AND a.action LIKE 'SP_PRODUCT_%')) AND a.entity_id = ?
       ORDER BY a.created_at DESC LIMIT 100`,
    )
    .bind(code)
    .all();
  return ok(c, r.results ?? []);
});

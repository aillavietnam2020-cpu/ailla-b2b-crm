/**
 * CSKH khách lẻ (chị Hoa duyệt demo 10/11/2026) — /api/hub/cskh.
 * CSKH chỉ thấy khách được chia cho mình; Lead Sale (quyền cskh.quanly hoặc trưởng nhóm phòng CSKH / Sale Kênh bán lẻ) và CEO thấy hết,
 * chia khách, xem báo cáo, sửa cài đặt. Đơn khách lấy tự động từ Poscake, không nhập tay doanh thu.
 */
import { Hono } from 'hono';
import { nowIso, vnDate } from '@shared/datetime';
import {
  CSKH_REASONS,
  CSKH_TRAITS,
  CSKH_STOP_REASONS,
  TIER_BASE,
  tierOf,
  tierSql,
  normTags,
  CSKH_RESULTS,
  addDays,
  attributeOrders,
  birthdaySoon,
  callState,
  diffDays,
  isDay,
  mergeSettings,
  normBirthday,
  normPhone,
  type CskhSettings,
} from '@shared/cskh';
import type { AppEnv } from '../env';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { requirePermission } from '../middleware/rbac';
import {
  assignTo,
  backfillStep,
  startBackfill,
  stopBackfill,
  cskhMe,
  cskhStaff,
  getSetting,
  loadSettings,
  loadVariations,
  posStatuses,
  POS_STATUS,
  putSetting,
  sendOrderToPoscake,
  syncCskhDays,
  type BackfillState,
  type CskhMe,
} from '../services/cskh';

export const cskhRoutes = new Hono<AppEnv>();
cskhRoutes.use('*', requirePermission('hub.access'));

const httpFetch = (u: string) => fetch(u);
const httpPost = (u: string, i: { method: string; headers: Record<string, string>; body: string }) => fetch(u, i);
const str = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);
const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

type Cus = {
  phone: string;
  tags: string;
  tier_manual: string;
  stop_reason: string;
  stop_note: string;
  stop_at: string | null;
  stop_by: string;
  name: string;
  phone2: string;
  birthday: string;
  addr_street: string;
  addr_ward: string;
  addr_district: string;
  addr_province: string;
  source: string;
  note: string;
  owner_id: string | null;
  owner_name: string;
  owner_prev: string | null;
  next_call: string | null;
  last_call: string | null;
  last_result: string;
  first_order_day: string | null;
  last_order_day: string | null;
  last_product: string;
  order_count: number;
  total_spent: number;
  manual: number;
};
const COLS =
  'phone, tags, tier_manual, stop_reason, stop_note, stop_at, stop_by, name, phone2, birthday, addr_street, addr_ward, addr_district, addr_province, source, note, owner_id, owner_name, owner_prev, next_call, last_call, last_result, first_order_day, last_order_day, last_product, order_count, total_spent, manual';

async function who(c: { env: AppEnv['Bindings']; get: (k: 'auth') => AppEnv['Variables']['auth'] }): Promise<CskhMe> {
  const me = await cskhMe(c.env.DB, c.get('auth'));
  if (!me.lead && !me.staff) throw forbidden('Chỉ CSKH, Lead Sale, CEO dùng mục CSKH khách lẻ');
  return me;
}
function view(c: Cus, set: CskhSettings, today: string) {
  return { ...c, state: callState(c, today, set), tier: tierOf(c, set), bday: birthdaySoon(c.birthday, today) };
}
const canSee = (me: CskhMe, c: Pick<Cus, 'owner_id'>) => me.lead || c.owner_id === me.id;
const mask = (p: string) => p.slice(0, 4) + ' *** ' + p.slice(-3);

/* ------------------------------------------------------------------ người dùng + cài đặt */
cskhRoutes.get('/me', async (c) => {
  const me = await who(c);
  const set = await loadSettings(c.env.DB);
  const staff = await cskhStaff(c.env.DB);
  const bf = await getSetting<BackfillState>(c.env.DB, 'backfill');
  return ok(c, { me, staff, settings: set, today: vnDate(), results: CSKH_RESULTS, reasons: CSKH_REASONS, traits: CSKH_TRAITS, stopReasons: CSKH_STOP_REASONS, backfill: bf });
});

cskhRoutes.put('/settings', async (c) => {
  const me = await who(c);
  if (!me.lead) throw forbidden('Chỉ Lead Sale, CEO sửa cài đặt CSKH');
  const b = (await c.req.json().catch(() => ({}))) as Partial<CskhSettings>;
  const old = await loadSettings(c.env.DB);
  const set = mergeSettings({ ...old, ...b });
  await putSetting(c.env.DB, 'cfg', set);
  // Lùi ngày bắt đầu: kéo bù tiếp từ chỗ đang dừng; tiến ngày bắt đầu thì không xoá khách đã có.
  return ok(c, set);
});

/** Lead / CEO bấm "Kéo đơn mới ngay": kéo 3 ngày gần nhất (như lượt 7h sáng). */
cskhRoutes.post('/pull', async (c) => {
  const me = await who(c);
  if (!me.lead) throw forbidden('Chỉ Lead Sale, CEO kéo dữ liệu');
  const today = vnDate();
  const recent = await syncCskhDays(c.env.DB, c.env.INGEST_KEY, [today, addDays(today, -1), addDays(today, -2)], httpFetch);
  return ok(c, { recent });
});

/** Kéo dữ liệu cũ theo khoảng ngày Lead / CEO chọn. Kéo ngay vài ngày đầu, phần còn lại máy chủ tự kéo mỗi 15 phút. */
cskhRoutes.post('/pull-range', async (c) => {
  const me = await who(c);
  if (!me.lead) throw forbidden('Chỉ Lead Sale, CEO kéo dữ liệu');
  const b = (await c.req.json().catch(() => ({}))) as { from?: string; to?: string };
  const today = vnDate();
  const from = str(b.from, 10);
  const to = str(b.to, 10) || today;
  if (!isDay(from) || !isDay(to) || from > to) throw badRequest('NGAY', 'Chọn từ ngày, đến ngày cho đúng');
  if (to > today) throw badRequest('NGAY', 'Đến ngày không được sau hôm nay');
  if (diffDays(to, from) > 1100) throw badRequest('NGAY', 'Mỗi lần kéo tối đa 3 năm');
  await startBackfill(c.env.DB, from, to);
  const first = await backfillStep(c.env.DB, c.env.INGEST_KEY, httpFetch, 3);
  return ok(c, { first, state: await getSetting<BackfillState>(c.env.DB, 'backfill') });
});
cskhRoutes.post('/pull-stop', async (c) => {
  const me = await who(c);
  if (!me.lead) throw forbidden('Chỉ Lead Sale, CEO kéo dữ liệu');
  await stopBackfill(c.env.DB);
  return ok(c, { state: await getSetting<BackfillState>(c.env.DB, 'backfill') });
});

/* ------------------------------------------------------------------ việc hôm nay */
cskhRoutes.get('/today', async (c) => {
  const me = await who(c);
  const set = await loadSettings(c.env.DB);
  const today = vnDate();
  const all = me.lead && c.req.query('all') === '1';
  const own = all ? '' : 'AND owner_id = ?';
  const binds = all ? [] : [me.id];
  const rows = await c.env.DB.prepare(
    `SELECT ${COLS} FROM cskh_customers WHERE owner_id IS NOT NULL AND stop_reason = '' ${own}
       AND (next_call <= ? OR (next_call IS NULL AND last_order_day >= ?) OR birthday <> '')`,
  )
    .bind(...binds, today, addDays(today, -400))
    .all<Cus>();
  const out = (rows.results ?? [])
    .map((r) => view(r, set, today))
    .filter((r) => ['qua', 'nay', 'moi', 'ky'].includes(r.state) || r.bday);
  const order = { qua: 0, nay: 1, moi: 2, ky: 3, cho: 4, chua: 5 } as Record<string, number>;
  out.sort((a, b) => order[a.state] - order[b.state] || String(a.next_call ?? a.last_order_day).localeCompare(String(b.next_call ?? b.last_order_day)));
  const done = await c.env.DB.prepare(`SELECT COUNT(DISTINCT phone) AS n FROM cskh_logs WHERE day = ? ${all ? '' : 'AND by_id = ?'}`)
    .bind(today, ...binds)
    .first<{ n: number }>();
  return ok(c, { rows: out.slice(0, 600), more: Math.max(0, out.length - 600), calledToday: done?.n ?? 0 });
});

/* ------------------------------------------------------------------ danh sách + tìm */
cskhRoutes.get('/list', async (c) => {
  const me = await who(c);
  const set = await loadSettings(c.env.DB);
  const today = vnDate();
  const q = str(c.req.query('q'), 80).toLowerCase();
  const qd = q.replace(/\D/g, '');
  const owner = me.lead ? str(c.req.query('owner'), 60) : me.id;
  const where: string[] = [];
  const binds: unknown[] = [];
  if (owner === '_none') where.push('owner_id IS NULL');
  else if (owner) {
    where.push('owner_id = ?');
    binds.push(owner);
  }
  if (q) {
    if (qd.length >= 3) {
      where.push("(phone LIKE ? OR phone2 LIKE ? OR LOWER(name) LIKE ?)");
      binds.push(`%${qd}%`, `%${qd}%`, `%${q}%`);
    } else {
      where.push("(LOWER(name) LIKE ? OR LOWER(addr_province) LIKE ? OR LOWER(addr_district) LIKE ?)");
      binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
  }
  const t = str(c.req.query('tier'), 20);
  if (t) {
    const ts = tierSql(set, t);
    where.push(ts.sql);
    binds.push(...ts.binds);
  }
  const stf0 = str(c.req.query('state'), 10);
  if (stf0 === 'ngung') where.push("stop_reason <> ''");
  const sql = `SELECT ${COLS} FROM cskh_customers ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(last_order_day, '') DESC LIMIT 400`;
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<Cus>();
  let out = (rows.results ?? []).map((r) => view(r, set, today));
  const stf = str(c.req.query('state'), 10);
  if (stf) out = out.filter((r) => r.state === stf);
  const cnt = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM cskh_customers ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`)
    .bind(...binds)
    .first<{ n: number }>();
  return ok(c, { rows: out, total: cnt?.n ?? out.length });
});

/** Ô tìm trên cùng: số điện thoại, tên, mã đơn. Khách của người khác chỉ báo ai đang chăm, không lộ chi tiết. */
cskhRoutes.get('/search', async (c) => {
  const me = await who(c);
  const q = str(c.req.query('q'), 80).toLowerCase();
  const qd = q.replace(/\D/g, '');
  if (q.length < 2) return ok(c, []);
  const found = new Map<string, Cus>();
  if (qd.length >= 3) {
    const r = await c.env.DB.prepare(`SELECT ${COLS} FROM cskh_customers WHERE phone LIKE ? OR phone2 LIKE ? LIMIT 8`).bind(`%${qd}%`, `%${qd}%`).all<Cus>();
    for (const x of r.results ?? []) found.set(x.phone, x);
    const o = await c.env.DB.prepare(`SELECT ${COLS} FROM cskh_customers WHERE phone IN (SELECT phone FROM cskh_orders WHERE id = ? UNION SELECT phone FROM cskh_web_orders WHERE id = ? OR pos_id = ?) LIMIT 2`)
      .bind(qd, q.toUpperCase(), qd)
      .all<Cus>();
    for (const x of o.results ?? []) found.set(x.phone, x);
  }
  if (/\p{L}/u.test(q)) {
    const r = await c.env.DB.prepare(`SELECT ${COLS} FROM cskh_customers WHERE LOWER(name) LIKE ? ${me.lead ? '' : 'AND owner_id = ?'} LIMIT 8`)
      .bind(`%${q}%`, ...(me.lead ? [] : [me.id]))
      .all<Cus>();
    for (const x of r.results ?? []) found.set(x.phone, x);
  }
  const set = await loadSettings(c.env.DB);
  return ok(
    c,
    [...found.values()].slice(0, 8).map((x) =>
      canSee(me, x)
        ? { phone: x.phone, name: x.name, tier: tierOf(x, set), addr: [x.addr_street, x.addr_ward, x.addr_district, x.addr_province].filter(Boolean).join(', '), lock: false }
        : { phone: '', masked: mask(x.phone), owner: x.owner_name || (x.owner_id ? 'CSKH khác' : 'Chưa chia'), lock: true },
    ),
  );
});

/* ------------------------------------------------------------------ hồ sơ khách */
cskhRoutes.get('/customer/:phone', async (c) => {
  const me = await who(c);
  const phone = normPhone(c.req.param('phone'));
  const cus = await c.env.DB.prepare(`SELECT ${COLS} FROM cskh_customers WHERE phone = ?`).bind(phone).first<Cus>();
  if (!cus) throw notFound('Không thấy khách này');
  if (!canSee(me, cus)) throw forbidden(`Khách đang do ${cus.owner_name || 'CSKH khác'} chăm`);
  const set = await loadSettings(c.env.DB);
  const orders = await c.env.DB.prepare('SELECT id, day, created_day, items, total, source FROM cskh_orders WHERE phone = ? ORDER BY day DESC LIMIT 100').bind(phone).all();
  const logs = await c.env.DB.prepare('SELECT id, by_name, day, at, result, reason, note, question, next_call FROM cskh_logs WHERE phone = ? ORDER BY at DESC LIMIT 200').bind(phone).all();
  const web = await c.env.DB.prepare('SELECT id, by_name, day, items, total, pos_id, pos_error FROM cskh_web_orders WHERE phone = ? ORDER BY created_at DESC LIMIT 50').bind(phone).all();
  return ok(c, { customer: view(cus, set, vnDate()), orders: orders.results ?? [], logs: logs.results ?? [], web: web.results ?? [] });
});

function readCustomerBody(b: Record<string, unknown>) {
  return {
    name: str(b.name, 120),
    phone2: normPhone(b.phone2) || str(b.phone2, 20).replace(/[^\d ]/g, ''),
    birthday: normBirthday(b.birthday),
    addr_street: str(b.addr_street, 200),
    addr_ward: str(b.addr_ward, 100),
    addr_district: str(b.addr_district, 100),
    addr_province: str(b.addr_province, 100),
    note: str(b.note, 1000),
  };
}

/** Thêm khách tay (gọi hotline, nhắn Zalo, chưa có đơn). */
cskhRoutes.post('/customer', async (c) => {
  const me = await who(c);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const phone = normPhone(b.phone);
  const f = readCustomerBody(b);
  if (!f.name || !phone) throw badRequest('THIEU', 'Cần họ tên và số điện thoại đúng 10 số');
  const dup = await c.env.DB.prepare('SELECT owner_id, owner_name, name FROM cskh_customers WHERE phone = ?').bind(phone).first<{ owner_id: string | null; owner_name: string; name: string }>();
  if (dup) throw badRequest('TRUNG', canSee(me, dup) ? `Số này đã có: ${dup.name}` : `Số này đã có, khách đang do ${dup.owner_name || 'CSKH khác'} chăm`);
  let owner = me.id;
  let ownerName = me.name;
  if (me.lead && b.owner_id !== undefined) {
    const st = (await cskhStaff(c.env.DB)).find((s) => s.id === b.owner_id);
    owner = st ? st.id : me.id;
    ownerName = st ? st.name : me.name;
  }
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO cskh_customers (phone, name, phone2, birthday, addr_street, addr_ward, addr_district, addr_province, source, note, owner_id, owner_name, assigned_at, manual, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(phone, f.name, f.phone2, f.birthday, f.addr_street, f.addr_ward, f.addr_district, f.addr_province, str(b.source, 80) || 'Gọi điện / Zalo', f.note, owner, ownerName, now, now, now)
    .run();
  return ok(c, { phone });
});

cskhRoutes.put('/customer/:phone', async (c) => {
  const me = await who(c);
  const phone = normPhone(c.req.param('phone'));
  const cus = await c.env.DB.prepare('SELECT owner_id FROM cskh_customers WHERE phone = ?').bind(phone).first<{ owner_id: string | null }>();
  if (!cus) throw notFound('Không thấy khách này');
  if (!canSee(me, cus)) throw forbidden('Không phải khách của bạn');
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const f = readCustomerBody(b);
  if (!f.name) throw badRequest('THIEU', 'Cần họ tên khách');
  await c.env.DB.prepare(
    `UPDATE cskh_customers SET name = ?, phone2 = ?, birthday = ?, addr_street = ?, addr_ward = ?, addr_district = ?, addr_province = ?, note = ?, updated_at = ? WHERE phone = ?`,
  )
    .bind(f.name, f.phone2, f.birthday, f.addr_street, f.addr_ward, f.addr_district, f.addr_province, f.note, nowIso(), phone)
    .run();
  if (b.tags !== undefined) await c.env.DB.prepare('UPDATE cskh_customers SET tags = ? WHERE phone = ?').bind(normTags(b.tags), phone).run();
  if (me.lead && typeof b.owner_id === 'string' && b.owner_id && b.owner_id !== cus.owner_id) {
    const set = await loadSettings(c.env.DB);
    await assignTo(c.env.DB, [{ phone, prev: cus.owner_id }], set, vnDate(), { [phone]: b.owner_id });
  }
  return ok(c, { phone });
});

/** Đặc điểm khách + ghi nhớ (sửa ngay trên hồ sơ, không cần mở Sửa hồ sơ). */
cskhRoutes.put('/customer/:phone/traits', async (c) => {
  const me = await who(c);
  const phone = normPhone(c.req.param('phone'));
  const cus = await c.env.DB.prepare('SELECT owner_id FROM cskh_customers WHERE phone = ?').bind(phone).first<{ owner_id: string | null }>();
  if (!cus) throw notFound('Không thấy khách này');
  if (!canSee(me, cus)) throw forbidden('Không phải khách của bạn');
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const tags = normTags(b.tags);
  const note = str(b.note, 1000);
  await c.env.DB.prepare('UPDATE cskh_customers SET tags = ?, note = ?, updated_at = ? WHERE phone = ?').bind(tags, note, nowIso(), phone).run();
  return ok(c, { phone, tags, note });
});

/** Gán hạng tay ('' = để web tự xếp). */
cskhRoutes.put('/customer/:phone/tier', async (c) => {
  const me = await who(c);
  const phone = normPhone(c.req.param('phone'));
  const cus = await c.env.DB.prepare('SELECT owner_id FROM cskh_customers WHERE phone = ?').bind(phone).first<{ owner_id: string | null }>();
  if (!cus) throw notFound('Không thấy khách này');
  if (!canSee(me, cus)) throw forbidden('Không phải khách của bạn');
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const set = await loadSettings(c.env.DB);
  const t = str(b.tier, 20);
  if (t && t !== TIER_BASE && !set.tiers.some((x) => x.n === t)) throw badRequest('HANG', 'Hạng không có trong Cài đặt');
  await c.env.DB.prepare('UPDATE cskh_customers SET tier_manual = ?, updated_at = ? WHERE phone = ?').bind(t, nowIso(), phone).run();
  return ok(c, { phone, tier_manual: t });
});

/** Ngừng chăm sóc (CSKH / Lead, bắt buộc lý do): khách ra khỏi Việc hôm nay, không chia nữa. Lead / CEO cho chăm sóc lại. */
cskhRoutes.post('/customer/:phone/stop', async (c) => {
  const me = await who(c);
  const phone = normPhone(c.req.param('phone'));
  const cus = await c.env.DB.prepare('SELECT owner_id FROM cskh_customers WHERE phone = ?').bind(phone).first<{ owner_id: string | null }>();
  if (!cus) throw notFound('Không thấy khách này');
  if (!canSee(me, cus)) throw forbidden('Không phải khách của bạn');
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = str(b.reason, 80);
  if (!reason) throw badRequest('LY_DO', 'Chọn lý do ngừng chăm sóc');
  const note = str(b.note, 500);
  if (reason === 'Khác' && !note) throw badRequest('LY_DO', 'Ghi rõ lý do');
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE cskh_customers SET stop_reason = ?, stop_note = ?, stop_at = ?, stop_by = ?, next_call = NULL, updated_at = ? WHERE phone = ?').bind(reason, note, now, me.name, now, phone),
    c.env.DB.prepare("INSERT INTO cskh_logs (phone, by_id, by_name, day, at, result, reason, note) VALUES (?, ?, ?, ?, ?, 'Ngừng chăm sóc', ?, ?)").bind(phone, me.id, me.name, vnDate(), now, reason, note),
  ]);
  return ok(c, { phone });
});
cskhRoutes.post('/customer/:phone/resume', async (c) => {
  const me = await who(c);
  if (!me.lead) throw forbidden('Chỉ Lead Sale, CEO cho chăm sóc lại');
  const phone = normPhone(c.req.param('phone'));
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE cskh_customers SET stop_reason = '', stop_note = '', stop_at = NULL, stop_by = '', updated_at = ? WHERE phone = ?").bind(now, phone),
    c.env.DB.prepare("INSERT INTO cskh_logs (phone, by_id, by_name, day, at, result, note) VALUES (?, ?, ?, ?, ?, 'Chăm sóc lại', '')").bind(phone, me.id, me.name, vnDate(), now),
  ]);
  return ok(c, { phone });
});

/* ------------------------------------------------------------------ ghi kết quả cuộc gọi */
cskhRoutes.post('/log/:phone', async (c) => {
  const me = await who(c);
  const phone = normPhone(c.req.param('phone'));
  const cus = await c.env.DB.prepare('SELECT owner_id FROM cskh_customers WHERE phone = ?').bind(phone).first<{ owner_id: string | null }>();
  if (!cus) throw notFound('Không thấy khách này');
  if (!canSee(me, cus)) throw forbidden('Không phải khách của bạn');
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = str(b.result, 40);
  if (!(CSKH_RESULTS as readonly string[]).includes(result)) throw badRequest('KET_QUA', 'Chọn kết quả cuộc gọi');
  const next = str(b.next_call, 10);
  const today = vnDate();
  if (!isDay(next) || next <= today) throw badRequest('HEN', 'Chọn ngày gọi lại (sau hôm nay)');
  if (diffDays(next, today) > 366) throw badRequest('HEN', 'Ngày gọi lại quá xa');
  const now = nowIso();
  const bd = normBirthday(b.birthday);
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO cskh_logs (phone, by_id, by_name, day, at, result, reason, note, question, next_call) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
      phone,
      me.id,
      me.name,
      today,
      now,
      result,
      result === 'Khách từ chối' ? str(b.reason, 100) : '',
      str(b.note, 1000),
      str(b.question, 500),
      next,
    ),
    c.env.DB.prepare(
      `UPDATE cskh_customers SET next_call = ?, last_call = ?, last_result = ?, birthday = CASE WHEN birthday = '' AND ? <> '' THEN ? ELSE birthday END,
         owner_id = COALESCE(owner_id, ?), owner_name = CASE WHEN owner_id IS NULL THEN ? ELSE owner_name END, updated_at = ? WHERE phone = ?`,
    ).bind(next, today, result, bd, bd, me.id, me.name, now, phone),
  ]);
  return ok(c, { phone, next_call: next });
});

/* ------------------------------------------------------------------ đơn CSKH tạo */
cskhRoutes.get('/products', async (c) => {
  await who(c);
  return ok(c, await loadVariations(c.env.DB, c.env.INGEST_KEY, httpFetch, c.req.query('force') === '1'));
});

cskhRoutes.get('/orders', async (c) => {
  const me = await who(c);
  const month = str(c.req.query('month'), 7);
  const m = /^\d{4}-\d{2}$/.test(month) ? month : vnDate().slice(0, 7);
  const r = await c.env.DB.prepare(
    `SELECT w.*, cu.name AS cus_name, cu.addr_street, cu.addr_ward, cu.addr_district, cu.addr_province,
       (SELECT o.day FROM cskh_orders o WHERE o.id = w.pos_id) AS delivered_day
     FROM cskh_web_orders w LEFT JOIN cskh_customers cu ON cu.phone = w.phone
     WHERE w.day LIKE ? ${me.lead ? '' : 'AND w.by_id = ?'} ORDER BY w.created_at DESC LIMIT 500`,
  )
    .bind(m + '%', ...(me.lead ? [] : [me.id]))
    .all<Record<string, unknown>>();
  const rows = r.results ?? [];
  const ids = rows.map((x) => String(x.pos_id ?? '')).filter(Boolean);
  const st = ids.length ? await posStatuses(c.env.DB, c.env.INGEST_KEY, httpFetch, ids) : {};
  return ok(
    c,
    rows.map((x) => {
      const p = st[String(x.pos_id ?? '')];
      return { ...x, pos_status: p ? p.s : null, pos_status_name: p ? (POS_STATUS[p.s] ?? 'Mã ' + p.s) : '', ship_code: p?.code ?? '', carrier: p?.carrier ?? '' };
    }),
  );
});

cskhRoutes.post('/order', async (c) => {
  const me = await who(c);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const phone = normPhone(b.phone);
  const cus = await c.env.DB.prepare('SELECT owner_id, name FROM cskh_customers WHERE phone = ?').bind(phone).first<{ owner_id: string | null; name: string }>();
  if (!cus) throw notFound('Chọn khách cho đơn');
  if (!canSee(me, cus)) throw forbidden('Không phải khách của bạn');
  const raw = Array.isArray(b.items) ? (b.items as Array<Record<string, unknown>>) : [];
  const items = raw
    .map((i) => ({ n: str(i.n, 200), vid: str(i.vid, 60), q: Math.max(1, Math.round(num(i.q))), price: Math.max(0, num(i.price)) }))
    .filter((i) => i.n);
  if (!items.length) throw badRequest('SP', 'Chọn sản phẩm');
  const recvName = str(b.recv_name, 120) || cus.name;
  const recvPhone = normPhone(b.recv_phone) || phone;
  const recvAddr = str(b.recv_addr, 400);
  if (!recvAddr) throw badRequest('DIA_CHI', 'Cần địa chỉ giao');
  const ship = Math.max(0, num(b.ship));
  const discount = Math.max(0, num(b.discount));
  const total = Math.max(0, items.reduce((a, i) => a + i.q * i.price, 0) + ship - discount);
  const today = vnDate();
  const seq = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM cskh_web_orders WHERE day = ?').bind(today).first<{ n: number }>();
  const id = `CS-${today.slice(2).replace(/-/g, '')}-${String((seq?.n ?? 0) + 1).padStart(3, '0')}`;
  const paid = Math.min(total, Math.max(0, num(b.paid)));
  const payment = paid > 0 ? `CK:${paid}` : 'COD';
  const notePrint = str(b.note_print, 300);
  const note = [str(b.note, 500), notePrint ? `In: ${notePrint}` : ''].filter(Boolean).join(' · ');
  const sent = await sendOrderToPoscake(c.env.DB, c.env.INGEST_KEY, httpPost, { recv_name: recvName, recv_phone: recvPhone, recv_addr: recvAddr, items, ship, discount, note: str(b.note, 500), note_print: notePrint, paid, payment, ref: id, by_name: me.name });
  const now = nowIso();
  const st = [
    c.env.DB.prepare(
      `INSERT INTO cskh_web_orders (id, phone, by_id, by_name, day, created_at, items, ship, discount, total, payment, recv_name, recv_phone, recv_addr, note, pos_id, pos_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, phone, me.id, me.name, today, now, JSON.stringify(items), ship, discount, total, payment, recvName, recvPhone, recvAddr, note, sent.pos_id, sent.error),
  ];
  if (b.save_addr) {
    const a = (b.addr ?? {}) as Record<string, unknown>;
    st.push(
      c.env.DB.prepare('UPDATE cskh_customers SET addr_street = ?, addr_ward = ?, addr_district = ?, addr_province = ?, updated_at = ? WHERE phone = ?').bind(
        str(a.street, 200),
        str(a.ward, 100),
        str(a.district, 100),
        str(a.province, 100),
        now,
        phone,
      ),
    );
  }
  await c.env.DB.batch(st);
  return ok(c, { id, pos_id: sent.pos_id, error: sent.error, total });
});

/** Đơn chưa gửi được: thử gửi lại sang Poscake (người tạo hoặc Lead). */
cskhRoutes.post('/order/:id/resend', async (c) => {
  const me = await who(c);
  const w = await c.env.DB.prepare('SELECT * FROM cskh_web_orders WHERE id = ?').bind(str(c.req.param('id'), 30)).first<Record<string, unknown>>();
  if (!w) throw notFound('Không thấy đơn');
  if (!me.lead && w.by_id !== me.id) throw forbidden('Không phải đơn của bạn');
  if (w.pos_id) return ok(c, { pos_id: w.pos_id, error: '' });
  const items = JSON.parse(String(w.items)) as Array<{ n: string; vid: string; q: number; price: number }>;
  const sent = await sendOrderToPoscake(c.env.DB, c.env.INGEST_KEY, httpPost, {
    recv_name: String(w.recv_name),
    recv_phone: String(w.recv_phone),
    recv_addr: String(w.recv_addr),
    items,
    ship: Number(w.ship),
    discount: Number(w.discount),
    note: String(w.note),
    payment: String(w.payment),
    paid: Number(String(w.payment).startsWith('CK:') ? String(w.payment).slice(3) : 0) || 0,
    ref: String(w.id),
    by_name: String(w.by_name ?? ''),
  });
  await c.env.DB.prepare('UPDATE cskh_web_orders SET pos_id = ?, pos_error = ? WHERE id = ?').bind(sent.pos_id, sent.error, w.id).run();
  return ok(c, sent);
});

/** Đã lên đơn tay ở Poscake: ghi mã đơn Poscake để tính doanh thu đúng người. */
cskhRoutes.put('/order/:id/pos', async (c) => {
  const me = await who(c);
  const w = await c.env.DB.prepare('SELECT by_id FROM cskh_web_orders WHERE id = ?').bind(str(c.req.param('id'), 30)).first<{ by_id: string }>();
  if (!w) throw notFound('Không thấy đơn');
  if (!me.lead && w.by_id !== me.id) throw forbidden('Không phải đơn của bạn');
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const pos = str(b.pos_id, 30).replace(/\D/g, '');
  if (!pos) throw badRequest('MA', 'Nhập mã đơn Poscake');
  await c.env.DB.prepare("UPDATE cskh_web_orders SET pos_id = ?, pos_error = '' WHERE id = ?").bind(pos, str(c.req.param('id'), 30)).run();
  return ok(c, { pos_id: pos });
});

/* ------------------------------------------------------------------ chia khách */
cskhRoutes.get('/chia', async (c) => {
  const me = await who(c);
  if (!me.lead) throw forbidden('Chỉ Lead Sale, CEO chia khách');
  const today = vnDate();
  const kind = c.req.query('kind') === 'cu' ? 'cu' : 'moi';
  const rows = await c.env.DB.prepare(
    `SELECT ${COLS} FROM cskh_customers WHERE owner_id IS NULL AND stop_reason = '' AND ${kind === 'moi' ? '(first_order_day >= ? OR manual = 1)' : '(first_order_day < ? OR first_order_day IS NULL) AND manual = 0'}
     ORDER BY COALESCE(last_order_day, '') DESC LIMIT 500`,
  )
    .bind(addDays(today, -14))
    .all<Cus>();
  const cnt = await c.env.DB.prepare(
    `SELECT SUM(CASE WHEN first_order_day >= ? OR manual = 1 THEN 1 ELSE 0 END) AS moi, SUM(CASE WHEN (first_order_day < ? OR first_order_day IS NULL) AND manual = 0 THEN 1 ELSE 0 END) AS cu
     FROM cskh_customers WHERE owner_id IS NULL AND stop_reason = ''`,
  )
    .bind(addDays(today, -14), addDays(today, -14))
    .first<{ moi: number | null; cu: number | null }>();
  const set = await loadSettings(c.env.DB);
  return ok(c, { rows: (rows.results ?? []).map((r) => view(r, set, today)), moi: cnt?.moi ?? 0, cu: cnt?.cu ?? 0 });
});

/** Lưu phân chia: {assign: {phone: ownerId}} hoặc chia đều {auto: true, kind: 'moi'|'cu'}. */
cskhRoutes.post('/chia', async (c) => {
  const me = await who(c);
  if (!me.lead) throw forbidden('Chỉ Lead Sale, CEO chia khách');
  const b = (await c.req.json().catch(() => ({}))) as { assign?: Record<string, string>; auto?: boolean; kind?: string };
  const set = await loadSettings(c.env.DB);
  const today = vnDate();
  const staff = new Set((await cskhStaff(c.env.DB)).map((s) => s.id));
  if (b.auto) {
    const cut = addDays(today, -14);
    const r = await c.env.DB.prepare(
      `SELECT phone, owner_prev, last_order_day FROM cskh_customers WHERE owner_id IS NULL AND stop_reason = '' AND ${b.kind === 'cu' ? '(first_order_day < ? OR first_order_day IS NULL) AND manual = 0' : '(first_order_day >= ? OR manual = 1)'} LIMIT 3000`,
    )
      .bind(cut)
      .all<{ phone: string; owner_prev: string | null; last_order_day: string | null }>();
    const n = await assignTo(c.env.DB, (r.results ?? []).map((x) => ({ phone: x.phone, prev: x.owner_prev, day: x.last_order_day })), set, today);
    return ok(c, { assigned: n });
  }
  const fixed: Record<string, string> = {};
  for (const [p, o] of Object.entries(b.assign ?? {})) {
    const ph = normPhone(p);
    if (ph && staff.has(o)) fixed[ph] = o;
  }
  const phones = Object.keys(fixed);
  if (!phones.length) throw badRequest('CHIA', 'Chọn CSKH cho khách');
  const r = await c.env.DB.prepare(`SELECT phone, owner_id, last_order_day FROM cskh_customers WHERE phone IN (${phones.map(() => '?').join(',')})`)
    .bind(...phones)
    .all<{ phone: string; owner_id: string | null; last_order_day: string | null }>();
  const n = await assignTo(c.env.DB, (r.results ?? []).map((x) => ({ phone: x.phone, prev: x.owner_id, day: x.last_order_day })), set, today, fixed);
  return ok(c, { assigned: n });
});

/** Thu hồi khách đã chia mà CSKH chưa gọi lần nào (chia nhầm, người nghỉ): về lại "chưa chia". Không đụng khách đã có lần gọi / đơn web / khách thêm tay. */
cskhRoutes.post('/chia/thu-hoi', async (c) => {
  const me = await who(c);
  if (!me.lead) throw forbidden('Chỉ Lead Sale, CEO thu hồi khách');
  const b = (await c.req.json().catch(() => ({}))) as { owner_id?: string };
  const owner = str(b.owner_id, 60);
  const r = await c.env.DB.prepare(
    `UPDATE cskh_customers SET owner_prev = NULL, owner_id = NULL, owner_name = '', assigned_at = NULL, next_call = NULL, updated_at = ?
     WHERE owner_id IS NOT NULL ${owner ? 'AND owner_id = ?' : ''} AND manual = 0 AND last_call IS NULL
       AND NOT EXISTS (SELECT 1 FROM cskh_logs l WHERE l.phone = cskh_customers.phone)
       AND NOT EXISTS (SELECT 1 FROM cskh_web_orders w WHERE w.phone = cskh_customers.phone)`,
  )
    .bind(nowIso(), ...(owner ? [owner] : []))
    .run();
  return ok(c, { released: r.meta?.changes ?? 0 });
});

/* ------------------------------------------------------------------ tổng quan + báo cáo */
type OrdRow = { id: string; phone: string; day: string; created_day: string; items: string; total: number };
async function upsellIn(db: D1Database, from: string, to: string) {
  const orders = (await db.prepare('SELECT id, phone, day, created_day, items, total FROM cskh_orders WHERE day >= ? AND day <= ?').bind(from, to).all<OrdRow>()).results ?? [];
  const logs =
    (await db.prepare("SELECT phone, by_id, day FROM cskh_logs WHERE result = 'Đã chốt đơn' AND day >= ? AND day <= ?").bind(addDays(from, -40), to).all<{ phone: string; by_id: string; day: string }>()).results ?? [];
  const web = (await db.prepare('SELECT pos_id, by_id FROM cskh_web_orders WHERE pos_id IS NOT NULL AND day >= ?').bind(addDays(from, -40)).all<{ pos_id: string; by_id: string }>()).results ?? [];
  const webBy: Record<string, string> = {};
  for (const w of web) webBy[w.pos_id] = w.by_id;
  const map = attributeOrders(orders, logs, webBy);
  return orders.filter((o) => map.has(o.id)).map((o) => ({ ...o, by: map.get(o.id)! }));
}
function monthRange(m: string): [string, string] {
  const from = m + '-01';
  const d = new Date(Date.parse(from + 'T00:00:00Z'));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return [from, addDays(d.toISOString().slice(0, 10), -1)];
}

cskhRoutes.get('/overview', async (c) => {
  const me = await who(c);
  const db = c.env.DB;
  const set = await loadSettings(db);
  const today = vnDate();
  const month = /^\d{4}-\d{2}$/.test(str(c.req.query('month'), 7)) ? str(c.req.query('month'), 7) : today.slice(0, 7);
  const [from, to0] = monthRange(month);
  const to = to0 > today ? today : to0;
  const mine = !me.lead || c.req.query('mine') === '1';
  const oc = mine ? 'AND owner_id = ?' : '';
  const ob = mine ? [me.id] : [];
  const vipAuto = set.tiers.map((t) => [t.o > 0 ? 'order_count >= ' + t.o : '', t.s > 0 ? 'total_spent >= ' + t.s : ''].filter(Boolean).join(' OR ')).filter(Boolean);
  const vipCond = { sql: `((tier_manual <> '' AND tier_manual <> ?) OR (tier_manual = '' AND (${vipAuto.length ? vipAuto.join(' OR ') : '0'})))`, binds: [TIER_BASE] as unknown[] };
  const base = await db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN first_order_day >= ? AND first_order_day <= ? THEN 1 ELSE 0 END) AS moi,
         SUM(CASE WHEN ${vipCond.sql} THEN 1 ELSE 0 END) AS vip, SUM(CASE WHEN stop_reason <> '' THEN 1 ELSE 0 END) AS ngung, SUM(CASE WHEN order_count >= 1 THEN 1 ELSE 0 END) AS buyers,
         SUM(CASE WHEN next_call < ? THEN 1 ELSE 0 END) AS qua, SUM(CASE WHEN owner_id IS NULL THEN 1 ELSE 0 END) AS chua
       FROM cskh_customers WHERE 1 = 1 ${oc}`,
    )
    .bind(from, to0, ...vipCond.binds, today, ...ob)
    .first<{ total: number; moi: number; vip: number; ngung: number; buyers: number; qua: number; chua: number }>();
  // Hôm nay theo từng CSKH: cần gọi (quá hạn + hẹn hôm nay + khách mới + đến kỳ), đã gọi, chốt, quá hạn tồn.
  const cand = (
    await db
      .prepare(`SELECT ${COLS} FROM cskh_customers WHERE owner_id IS NOT NULL ${oc} AND (next_call <= ? OR (next_call IS NULL AND last_order_day >= ?))`)
      .bind(...ob, today, addDays(today, -400))
      .all<Cus>()
  ).results ?? [];
  const staff = await cskhStaff(db);
  const per = new Map<string, { id: string; name: string; can: number; goi: number; chot: number; qua: number; dt: number; don: number }>();
  const row = (id: string, name = '') => {
    let r = per.get(id);
    if (!r) {
      r = { id, name: name || staff.find((s) => s.id === id)?.name || '', can: 0, goi: 0, chot: 0, qua: 0, dt: 0, don: 0 };
      per.set(id, r);
    }
    return r;
  };
  if (!mine) for (const s of staff) row(s.id, s.name);
  else row(me.id, me.name);
  for (const cu of cand) {
    const s = callState(cu, today, set);
    if (!cu.owner_id) continue;
    const r = row(cu.owner_id, cu.owner_name);
    if (['qua', 'nay', 'moi', 'ky'].includes(s)) r.can += 1;
    if (s === 'qua') r.qua += 1;
  }
  const lt = (await db.prepare(`SELECT by_id, by_name, COUNT(DISTINCT phone) AS n, SUM(CASE WHEN result = 'Đã chốt đơn' THEN 1 ELSE 0 END) AS chot FROM cskh_logs WHERE day = ? ${mine ? 'AND by_id = ?' : ''} GROUP BY by_id`).bind(today, ...ob).all<{ by_id: string; by_name: string; n: number; chot: number }>()).results ?? [];
  for (const l of lt) {
    const r = row(l.by_id, l.by_name);
    r.goi = l.n;
    r.chot = l.chot;
  }
  // Doanh thu bán thêm trong tháng + 10 ngày gần nhất.
  const ups = await upsellIn(db, addDays(to, -9) < from ? addDays(to, -9) : from, to);
  const inMonth = ups.filter((o) => o.day >= from && o.day <= to && (!mine || o.by === me.id));
  for (const o of inMonth) {
    const r = row(o.by);
    r.dt += o.total;
    r.don += 1;
  }
  const days: Array<{ day: string; v: number }> = [];
  for (let i = 9; i >= 0; i--) {
    const d = addDays(to, -i);
    days.push({ day: d, v: ups.filter((o) => o.day === d && (!mine || o.by === me.id)).reduce((a, o) => a + o.total, 0) });
  }
  const prod = new Map<string, { q: number; v: number }>();
  for (const o of inMonth)
    for (const it of JSON.parse(o.items) as Array<{ n: string; q: number; p: number }>) {
      const a = prod.get(it.n) ?? { q: 0, v: 0 };
      a.q += it.q;
      a.v += it.p;
      prod.set(it.n, a);
    }
  const fun = await db
    .prepare(
      `SELECT COUNT(*) AS goi, SUM(CASE WHEN result NOT IN ('Không nghe máy', 'Sai số / thuê bao') THEN 1 ELSE 0 END) AS bat, SUM(CASE WHEN result = 'Đã chốt đơn' THEN 1 ELSE 0 END) AS chot
       FROM cskh_logs WHERE day >= ? AND day <= ? ${mine ? 'AND by_id = ?' : ''}`,
    )
    .bind(from, to, ...ob)
    .first<{ goi: number; bat: number; chot: number }>();
  const bdays = (
    await db.prepare(`SELECT phone, name, birthday, owner_name FROM cskh_customers WHERE birthday LIKE ? ${oc} ORDER BY birthday LIMIT 60`).bind('%/' + month.slice(5), ...ob).all()
  ).results ?? [];
  const src = (
    await db.prepare(`SELECT source, COUNT(*) AS n FROM cskh_customers WHERE first_order_day >= ? AND first_order_day <= ? ${oc} GROUP BY source ORDER BY n DESC LIMIT 8`).bind(from, to0, ...ob).all()
  ).results ?? [];
  const kpi = mine && me.lead === false ? (staff.length ? set.kpi / Math.max(1, staff.filter((s) => !set.staffOff.includes(s.id)).length) : 0) : set.kpi;
  return ok(c, {
    month,
    base,
    kpi,
    upsell: { total: inMonth.reduce((a, o) => a + o.total, 0), orders: inMonth.length },
    per: [...per.values()].sort((a, b) => b.dt - a.dt || a.name.localeCompare(b.name)),
    days,
    funnel: { goi: fun?.goi ?? 0, bat: fun?.bat ?? 0, chot: fun?.chot ?? 0, giao: inMonth.length },
    products: [...prod.entries()].map(([n, a]) => ({ n, ...a })).sort((a, b) => b.v - a.v).slice(0, 8),
    birthdays: bdays,
    sources: src,
  });
});

cskhRoutes.get('/report', async (c) => {
  const me = await who(c);
  if (!me.lead) throw forbidden('Chỉ Lead Sale, CEO xem báo cáo');
  const db = c.env.DB;
  const today = vnDate();
  const month = /^\d{4}-\d{2}$/.test(str(c.req.query('month'), 7)) ? str(c.req.query('month'), 7) : today.slice(0, 7);
  const [from, to] = monthRange(month);
  const staff = await cskhStaff(db);
  const own = (await db.prepare('SELECT owner_id, MAX(owner_name) AS name, COUNT(*) AS n, SUM(CASE WHEN next_call < ? THEN 1 ELSE 0 END) AS qua FROM cskh_customers WHERE owner_id IS NOT NULL GROUP BY owner_id').bind(today).all<{ owner_id: string; name: string; n: number; qua: number }>()).results ?? [];
  const lg = (
    await db
      .prepare(
        `SELECT by_id, by_name, COUNT(DISTINCT phone) AS goi, COUNT(DISTINCT CASE WHEN result NOT IN ('Không nghe máy', 'Sai số / thuê bao') THEN phone END) AS bat
         FROM cskh_logs WHERE day >= ? AND day <= ? GROUP BY by_id`,
      )
      .bind(from, to)
      .all<{ by_id: string; by_name: string; goi: number; bat: number }>()
  ).results ?? [];
  const ups = (await upsellIn(db, from, to > today ? today : to)).filter((o) => o.day >= from);
  const ids = new Set([...staff.map((s) => s.id), ...own.map((o) => o.owner_id), ...lg.map((l) => l.by_id), ...ups.map((u) => u.by)]);
  const rows = [...ids].map((id) => {
    const o = own.find((x) => x.owner_id === id);
    const l = lg.find((x) => x.by_id === id);
    const u = ups.filter((x) => x.by === id);
    const dt = u.reduce((a, x) => a + x.total, 0);
    return { id, name: staff.find((s) => s.id === id)?.name || l?.by_name || o?.name || '', khach: o?.n ?? 0, goi: l?.goi ?? 0, bat: l?.bat ?? 0, don: u.length, dt, tb: u.length ? dt / u.length : 0, qua: o?.qua ?? 0 };
  });
  const reasons = (await db.prepare("SELECT reason, COUNT(*) AS n FROM cskh_logs WHERE result = 'Khách từ chối' AND day >= ? AND day <= ? GROUP BY reason ORDER BY n DESC").bind(from, to).all()).results ?? [];
  const results = (await db.prepare('SELECT result, COUNT(*) AS n FROM cskh_logs WHERE day >= ? AND day <= ? GROUP BY result ORDER BY n DESC').bind(from, to).all()).results ?? [];
  const questions = (await db.prepare("SELECT question, by_name, day FROM cskh_logs WHERE question <> '' AND day >= ? AND day <= ? ORDER BY at DESC LIMIT 30").bind(from, to).all()).results ?? [];
  return ok(c, { month, rows: rows.sort((a, b) => b.dt - a.dt), reasons, results, questions });
});

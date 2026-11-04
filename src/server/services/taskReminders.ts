import { pack, unpack } from '../lib/pack';

/**
 * Nhắc việc "Task giao việc" mỗi sáng 8 giờ (chạy từ cron mỗi giờ, chỉ làm việc lúc 8 giờ giờ Việt Nam):
 *  - Việc trễ hạn / đến hạn: nhắc người làm, người cùng làm, người giao và Lead team đó (team chưa có Lead thì CEO).
 *  - Việc đến hạn hôm nay, việc còn 0–2 ngày mà người làm chưa bấm "Đang làm".
 *  - Việc đang chờ duyệt: nhắc người giao.
 *  - Một bản tóm tắt cho chị (admin): bao nhiêu việc trễ, ai trễ nhiều, bao nhiêu việc chờ duyệt.
 * Ghi vào chuông (hub_state.notifs). Dùng chung khóa autoRem với phần nhắc chạy trên trình duyệt để không báo trùng.
 * Thêm (04/11): "Trợ lý công việc" nhắn riêng từng người vào Tin nhắn (bảng chat_msgs, phòng dm:<mã đăng nhập>~sys-congviec):
 * Quá hạn, Hôm nay (kèm giờ, việc định kỳ), Chờ bạn duyệt, Mai; CEO thêm việc CEO giao đang trễ và cả công ty trễ.
 * Bật / tắt và giờ gửi ở Quản trị › Cấu hình › Ngưỡng cảnh báo (app_settings 'task.reminder' = {on, hour}), mặc định bật, 8 giờ.
 * Giờ gửi áp cho cả chuông. Người theo dõi (theoDoi) không nhận việc đó trong tin nhắc: chỉ người làm và người cùng làm.
 */

interface HubUser { id: string; name?: string; active?: boolean; role?: string; phongBan?: string }
interface HubUserC extends HubUser { crm?: string }
interface Task { id: string; ten: string; nguoi?: string; phoi?: string[]; tao?: string; han?: number; st?: string; gio?: string; tpl?: string; gap?: boolean; vong?: number }
interface Notif { id: string; to: string; text: string; at: string; ref: string; by: string; read: boolean }
interface HubData {
  users?: HubUserC[];
  tasks?: Task[];
  cards?: { thang?: string }[];
  notifs?: Notif[];
  autoRem?: Record<string, number>;
}

const NT_KEEP = 600;
export const TROLY_ID = 'sys-congviec';
export const REMINDER_KEY = 'task.reminder';
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const trolyRoom = (crm: string) => 'dm:' + [crm, TROLY_ID].sort().join('~');

export async function reminderConfig(db: D1Database): Promise<{ on: boolean; hour: number }> {
  try {
    const r = await db.prepare('SELECT value_json FROM app_settings WHERE key = ?').bind(REMINDER_KEY).first<{ value_json: string }>();
    const v = r ? (JSON.parse(r.value_json) as { on?: unknown; hour?: unknown }) : {};
    const h = Number(v.hour);
    return { on: v.on !== false, hour: Number.isInteger(h) && h >= 5 && h <= 12 ? h : 8 };
  } catch {
    return { on: true, hour: 8 };
  }
}

/** Nội dung tin nhắc buổi sáng cho một người (null = không có gì để nhắc). Hàm thuần để kiểm thử. */
export function buildDigest(d: { users?: HubUser[]; tasks?: Task[] }, uid: string, today: number, monthKey: string): string | null {
  const users = (d.users ?? []).filter((u) => u.active !== false);
  const me = users.find((u) => u.id === uid);
  if (!me) return null;
  const nameOf = (id?: string) => users.find((u) => u.id === id)?.name ?? 'chưa giao';
  const admins = users.filter((u) => u.role === 'admin').map((u) => u.id);
  const ceo = me.role === 'admin';
  const dd = (n: number) => (n >= 1 && n <= 31 ? `${String(n).padStart(2, '0')}/${monthKey.slice(5)}` : `ngày ${n}`);
  const open = (d.tasks ?? []).filter((t) => t.st !== 'done');
  const mine = (t: Task) => t.nguoi === uid || (t.phoi ?? []).includes(uid);
  const late = (t: Task) => !!t.han && t.han < today;
  const cut = (L: string[], n = 6) => (L.length > n ? L.slice(0, n).concat(`… và ${L.length - n} việc nữa`) : L);
  const flag = (t: Task) => (t.gap ? '[GẤP] ' : '');
  const sec = (title: string, L: string[]) => (L.length ? [title, ...cut(L).map((x) => '• ' + x)].join('\n') : '');
  const appr = (t: Task) => (t.vong === 2 ? admins : t.tao && t.tao !== t.nguoi ? [t.tao] : admins);

  const M = open.filter(mine);
  const L1 = M.filter(late).sort((a, b) => (a.han ?? 0) - (b.han ?? 0));
  const L2 = M.filter((t) => t.han === today).sort((a, b) => Number(!!b.gap) - Number(!!a.gap) || (a.gio || '99').localeCompare(b.gio || '99'));
  const L3 = M.filter((t) => t.han === today + 1);
  const RV = open.filter((t) => t.st === 'review' && t.nguoi !== uid && appr(t).includes(uid));
  const parts = [
    sec(`⚠ Quá hạn (${L1.length})`, L1.map((t) => `${flag(t)}${t.ten} · trễ ${today - (t.han ?? 0)} ngày${t.st === 'pause' ? ' · tạm dừng' : ''}`)),
    sec(`Hôm nay (${L2.length})`, L2.map((t) => `${t.gio ? t.gio + ' ' : ''}${flag(t)}${t.ten}${t.tpl ? ' · định kỳ' : ''}${t.st === 'pause' ? ' · tạm dừng' : t.st === 'review' ? ' · đã nộp, chờ duyệt' : ''}`)),
    sec(`Chờ bạn duyệt (${RV.length})`, RV.map((t) => `${t.ten} · ${nameOf(t.nguoi)}`)),
  ];
  if (ceo) {
    const G = open.filter((t) => t.tao === uid && t.nguoi && t.nguoi !== uid && late(t)).sort((a, b) => (a.han ?? 0) - (b.han ?? 0));
    parts.push(sec(`Việc CEO giao đang trễ (${G.length})`, G.map((t) => `${t.ten} · ${nameOf(t.nguoi)} · trễ ${today - (t.han ?? 0)} ngày`)));
    const all = open.filter((t) => late(t) && t.nguoi && !admins.includes(t.nguoi));
    if (all.length) {
      const by = new Map<string, number>();
      all.forEach((t) => by.set(nameOf(t.nguoi), (by.get(nameOf(t.nguoi)) ?? 0) + 1));
      const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n} ${c}`).join(', ');
      parts.push(`Cả công ty: ${all.length} việc trễ hạn (${top})`);
    }
  }
  const body = parts.filter(Boolean);
  if (!body.length && !L3.length) return null;
  if (L3.length) body.push(`Mai: ${L3.length} việc (${L3.slice(0, 3).map((t) => t.ten).join(', ')}${L3.length > 3 ? ', …' : ''})`);
  return [`Chào buổi sáng ${me.name ?? ''}. Việc ngày ${dd(today)}:`, ...body, 'Xem chi tiết ở Công việc › Việc của tôi.'].join('\n\n').slice(0, 3800);
}

/** Gửi tin nhắc vào Tin nhắn (mỗi người một lần mỗi ngày: đã có tin của trợ lý từ 0 giờ hôm nay thì thôi). */
async function sendDigests(db: D1Database, d: { users?: HubUserC[]; tasks?: Task[] }, now: Date, today: number, monthKey: string): Promise<number> {
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  const since = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600 * 1000).toISOString();
  const done = await db.prepare('SELECT DISTINCT room FROM chat_msgs WHERE user_id = ? AND created_at >= ?').bind(TROLY_ID, since).all<{ room: string }>();
  const had = new Set((done.results ?? []).map((r) => r.room));
  const at = now.toISOString();
  const st: D1PreparedStatement[] = [];
  for (const u of d.users ?? []) {
    if (u.active === false || !u.crm || !ID_RE.test(u.crm)) continue;
    const room = trolyRoom(u.crm);
    if (had.has(room)) continue;
    const body = buildDigest(d, u.id, today, monthKey);
    if (!body) continue;
    had.add(room);
    st.push(db.prepare("INSERT INTO chat_msgs (room, user_id, body, kind, ref, created_at) VALUES (?, ?, ?, '', '', ?)").bind(room, TROLY_ID, body, at));
  }
  if (st.length) await db.batch(st);
  return st.length;
}
const MKT_PB = ['CM', 'ADS', 'KOC', 'BDH', ''];
const KPB_TEAM: Record<string, string> = { CM: 'content', ADS: 'digital', KOC: 'koc', KT: 'ketoan', KV: 'kho', SX: 'sx', HCNS: 'hcns', B2B: 'sale', B2C: 'sale' };

export async function taskReminders(
  db: D1Database,
  now: Date = new Date(),
  opts: { anyHour?: boolean } = {},
): Promise<Record<string, unknown>> {
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  const cfg = await reminderConfig(db);
  if (!opts.anyHour && vn.getUTCHours() !== cfg.hour) return { skipped: `chưa tới ${cfg.hour} giờ sáng giờ Việt Nam` };
  const monthKey = `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
  const today = vn.getUTCDate();
  const sfx = `#${monthKey}-${today}`;
  const dd = (day: number) => `${String(day).padStart(2, '0')}/${monthKey.slice(5)}`;

  let bell: Record<string, unknown> | null = null;
  let snap: HubData | null = null;
  for (let attempt = 0; attempt < 3 && !bell; attempt++) {
    const row = await db
      .prepare("SELECT version, data FROM hub_state WHERE id = 'main'")
      .first<{ version: number; data: string }>();
    if (!row) return { skipped: 'chưa có dữ liệu' };
    const d = JSON.parse(await unpack(row.data)) as HubData;
    const thang = (d.cards ?? []).find((c) => c.thang)?.thang;
    if (thang !== monthKey) return { skipped: `dữ liệu là tháng ${thang ?? '?'}, không phải ${monthKey}` };

    const users = (d.users ?? []).filter((u) => u.active !== false);
    const active = new Set(users.map((u) => u.id));
    const nameOf = (id?: string) => users.find((u) => u.id === id)?.name ?? 'chưa giao';
    const admins = users.filter((u) => u.role === 'admin').map((u) => u.id);
    // Lead của team người làm (giống teamOf/cvTeamNorm ở hub/src/congviec.js); team chưa có Lead thì báo CEO, người làm là Lead thì thôi
    const teamOf = (u: HubUser) => {
      if (u.role === 'digital') return 'digital';
      if (u.role === 'content' || u.role === 'lead') return 'content';
      if (u.role === 'truongphong') return MKT_PB.includes(u.phongBan ?? '') ? 'mkt' : (KPB_TEAM[u.phongBan ?? ''] ?? u.phongBan ?? '');
      if (u.role === 'nhanvien' && u.phongBan) return KPB_TEAM[u.phongBan] ?? u.phongBan;
      return 'all';
    };
    const sees = (t: string, k: string) => t === k || (t === 'mkt' && ['content', 'digital', 'koc'].includes(k));
    const leadOf = (id?: string): string[] => {
      const u = users.find((x) => x.id === id);
      const k = u ? teamOf(u) : '';
      if (!u || !k || k === 'all' || u.role === 'admin') return admins;
      if (u.role === 'lead' || u.role === 'truongphong') return [];
      const l = users.filter((x) => x.id !== id && (x.role === 'lead' || x.role === 'truongphong') && sees(teamOf(x), k)).map((x) => x.id);
      return l.length ? l : admins;
    };
    const at = now.toISOString();
    d.autoRem = d.autoRem ?? {};
    for (const k of Object.keys(d.autoRem)) if (!k.endsWith(sfx)) delete d.autoRem[k];
    d.notifs = d.notifs ?? [];
    let sent = 0;
    const push = (key: string, to: Iterable<string | undefined>, text: string, ref = 'page:cv_v') => {
      const k = key + sfx;
      if (d.autoRem![k]) return;
      d.autoRem![k] = 1;
      for (const id of new Set([...to])) {
        if (!id || !active.has(id)) continue;
        d.notifs!.push({ id: 'nt' + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1e4).toString(36), to: id, text, at, ref, by: '', read: false });
        sent++;
      }
    };

    const open = (d.tasks ?? []).filter((t) => t.st !== 'done');
    const lateBy = new Map<string, number>();
    let lateN = 0;
    let reviewN = 0;
    for (const t of open) {
      const mine = [t.nguoi, ...(t.phoi ?? [])];
      const who = nameOf(t.nguoi);
      if (t.st === 'review') {
        reviewN++;
        push(`v|tk|${t.id}`, [t.tao, ...(t.tao ? [] : admins)], `Việc "${t.ten}" của ${who} đang chờ bạn duyệt`, `task:${t.id}`);
      }
      if (!t.han) continue;
      if (t.han < today) {
        lateN++;
        lateBy.set(who, (lateBy.get(who) ?? 0) + 1);
        push(`l|tk|${t.id}`, [...mine, t.tao, ...leadOf(t.nguoi)], `⚠ Trễ ${today - t.han} ngày: ${t.ten} · ${who}`, `task:${t.id}`);
      } else if (t.han === today) {
        push(`d|tk|${t.id}`, [...mine, t.tao, ...leadOf(t.nguoi)], `Đến hạn hôm nay: ${t.ten} · ${who}`, `task:${t.id}`);
      } else if (t.han - today <= 2 && (t.st === 'todo' || t.st === 'nhan')) {
        push(`n|tk|${t.id}`, mine, `Bạn chưa bấm "Đang làm": ${t.ten} · hạn ${dd(t.han)}`, `task:${t.id}`);
      }
    }
    if (lateN || reviewN) {
      const top = [...lateBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, c]) => `${n} ${c}`).join(', ');
      const parts = [lateN ? `${lateN} việc trễ hạn${top ? ' (' + top + ')' : ''}` : '', reviewN ? `${reviewN} việc chờ duyệt` : ''].filter(Boolean);
      push('sum', admins, `Sáng nay: ${parts.join(' · ')}`);
    }
    snap = d;
    if (!sent) {
      bell = { changed: 0 };
      break;
    }
    if (d.notifs.length > NT_KEEP) d.notifs = d.notifs.slice(-NT_KEEP);

    const res = await db
      .prepare("UPDATE hub_state SET version = version + 1, data = ?, updated_at = ? WHERE id = 'main' AND version = ?")
      .bind(await pack(JSON.stringify(d)), at, row.version)
      .run();
    if (res.meta.changes) bell = { notified: sent, late: lateN, review: reviewN };
  }
  if (!bell) bell = { skipped: 'dữ liệu đang được sửa liên tục, thử lại giờ sau' };
  let messaged = 0;
  if (cfg.on && snap) {
    try {
      messaged = await sendDigests(db, snap, now, today, monthKey);
    } catch (e) {
      bell.messageError = String(e);
    }
  }
  return { ...bell, messaged };
}

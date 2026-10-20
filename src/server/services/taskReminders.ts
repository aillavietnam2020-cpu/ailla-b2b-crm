import { pack, unpack } from '../lib/pack';

/**
 * Nhắc việc "Task giao việc" mỗi sáng 8 giờ (chạy từ cron mỗi giờ, chỉ làm việc lúc 8 giờ giờ Việt Nam):
 *  - Việc trễ hạn: nhắc người làm, người cùng làm, người giao và quản lý.
 *  - Việc đến hạn hôm nay, việc còn 0–2 ngày mà người làm chưa bấm "Đang làm".
 *  - Việc đang chờ duyệt: nhắc người giao.
 *  - Một bản tóm tắt cho chị (admin): bao nhiêu việc trễ, ai trễ nhiều, bao nhiêu việc chờ duyệt.
 * Ghi vào chuông (hub_state.notifs). Dùng chung khóa autoRem với phần nhắc chạy trên trình duyệt để không báo trùng.
 */

interface HubUser { id: string; name?: string; active?: boolean; role?: string }
interface Task { id: string; ten: string; nguoi?: string; phoi?: string[]; tao?: string; han?: number; st?: string }
interface Notif { id: string; to: string; text: string; at: string; ref: string; by: string; read: boolean }
interface HubData {
  users?: HubUser[];
  tasks?: Task[];
  cards?: { thang?: string }[];
  notifs?: Notif[];
  autoRem?: Record<string, number>;
}

const NT_KEEP = 600;

export async function taskReminders(
  db: D1Database,
  now: Date = new Date(),
  opts: { anyHour?: boolean } = {},
): Promise<Record<string, unknown>> {
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  if (!opts.anyHour && vn.getUTCHours() !== 8) return { skipped: 'chưa tới 8 giờ sáng giờ Việt Nam' };
  const monthKey = `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
  const today = vn.getUTCDate();
  const sfx = `#${monthKey}-${today}`;
  const dd = (day: number) => `${String(day).padStart(2, '0')}/${monthKey.slice(5)}`;

  for (let attempt = 0; attempt < 3; attempt++) {
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
    const leads = users.filter((u) => u.role === 'admin' || u.role === 'lead').map((u) => u.id);
    const admins = users.filter((u) => u.role === 'admin').map((u) => u.id);
    const at = now.toISOString();
    d.autoRem = d.autoRem ?? {};
    for (const k of Object.keys(d.autoRem)) if (!k.endsWith(sfx)) delete d.autoRem[k];
    d.notifs = d.notifs ?? [];
    let sent = 0;
    const push = (key: string, to: Iterable<string | undefined>, text: string, ref = 'page:cv_nv') => {
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
        push(`v|tk|${t.id}`, [t.tao, ...(t.tao ? [] : admins)], `Việc "${t.ten}" của ${who} đang chờ bạn duyệt`);
      }
      if (!t.han) continue;
      if (t.han < today) {
        lateN++;
        lateBy.set(who, (lateBy.get(who) ?? 0) + 1);
        push(`l|tk|${t.id}`, [...mine, t.tao, ...leads], `⚠ Trễ ${today - t.han} ngày: ${t.ten} · ${who}`);
      } else if (t.han === today) {
        push(`d|tk|${t.id}`, [...mine, t.tao, ...leads], `Đến hạn hôm nay: ${t.ten} · ${who}`);
      } else if (t.han - today <= 2 && (t.st === 'todo' || t.st === 'nhan')) {
        push(`n|tk|${t.id}`, mine, `Bạn chưa bấm "Đang làm": ${t.ten} · hạn ${dd(t.han)}`);
      }
    }
    if (lateN || reviewN) {
      const top = [...lateBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, c]) => `${n} ${c}`).join(', ');
      const parts = [lateN ? `${lateN} việc trễ hạn${top ? ' (' + top + ')' : ''}` : '', reviewN ? `${reviewN} việc chờ duyệt` : ''].filter(Boolean);
      push('sum', admins, `Sáng nay: ${parts.join(' · ')}`);
    }
    if (!sent) return { changed: 0 };
    if (d.notifs.length > NT_KEEP) d.notifs = d.notifs.slice(-NT_KEEP);

    const res = await db
      .prepare("UPDATE hub_state SET version = version + 1, data = ?, updated_at = ? WHERE id = 'main' AND version = ?")
      .bind(await pack(JSON.stringify(d)), at, row.version)
      .run();
    if (res.meta.changes) return { notified: sent, late: lateN, review: reviewN };
  }
  return { skipped: 'dữ liệu đang được sửa liên tục, thử lại giờ sau' };
}

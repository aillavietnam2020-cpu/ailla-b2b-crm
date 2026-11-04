import { pack, unpack } from '../lib/pack';

/**
 * Việc lặp lại (mẫu d.taskTpl có "lap"): máy chủ tự giao mỗi giờ, không phải chờ có người mở trang Việc.
 * Cùng luật với tkRecur ở hub/src/congviec.js và cùng mốc p.last (ngày giao gần nhất) nên hai nơi chạy không giao trùng:
 *  - "ngay" (hằng ngày): chỉ giao việc của hôm nay, không bù những ngày trước.
 *  - "tuan": ngày trong tuần p.ngay (1 = Thứ 2 … 7 = Chủ nhật); "thang": ngày p.ngay trong tháng. Bù tối đa 62 ngày bị lỡ.
 * Hạn = ngày giao + p.hanSau, đánh số ngày theo tháng của dữ liệu chung (ngày 1 của tháng = 1, tháng sau thì lớn hơn số ngày của tháng).
 */

export interface TaskTpl {
  id: string;
  ten: string;
  moTa?: string;
  team?: string;
  da?: string;
  nguoi?: string;
  phoi?: string[];
  theoDoi?: string[];
  gio?: string;
  uu?: string;
  v2?: boolean;
  v2ceo?: boolean;
  checklist?: { t: string }[];
  hanSau?: number;
  lap?: string;
  ngay?: number;
  tao?: string;
  last?: string;
  dung?: boolean;
  xoa?: boolean;
}
interface Notif { id: string; to: string; text: string; at: string; ref: string; by: string; read: boolean }
export interface RecurData {
  cards?: { thang?: string }[];
  taskTpl?: TaskTpl[];
  tasks?: Record<string, unknown>[];
  notifs?: Notif[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (x: Date) => `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
export const gapOf = (s: string) => /gấp|khẩn/i.test(String(s ?? '').normalize('NFC'));
export const lapLbl = (p: TaskTpl) =>
  p.lap === 'ngay' ? 'hằng ngày' : p.lap === 'tuan' ? 'mỗi ' + (Number(p.ngay) === 7 ? 'Chủ nhật' : 'thứ ' + (Number(p.ngay) + 1)) : p.lap === 'thang' ? `ngày ${p.ngay} hằng tháng` : '';

export function recurHit(p: TaskTpl, iso: string, today: string): boolean {
  const x = new Date(iso + 'T00:00:00Z');
  if (p.lap === 'ngay') return iso === today;
  if (p.lap === 'tuan') return ((x.getUTCDay() + 6) % 7) + 1 === Number(p.ngay);
  if (p.lap === 'thang') return x.getUTCDate() === Number(p.ngay);
  return false;
}

/** Giao các việc lặp lại đến hạn (sửa thẳng d). Trả về số việc đã giao và số mẫu đã đổi mốc. */
export function applyRecurring(
  d: RecurData,
  today: string,
  monthKey: string,
  opts: { stamp: string; at: string; uid: (p: string) => string },
): { created: number; touched: number } {
  const base = Date.parse(monthKey + '-01T00:00:00Z');
  const dayOf = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - base) / 864e5) + 1;
  let created = 0;
  let touched = 0;
  d.tasks = d.tasks ?? [];
  for (const p of d.taskTpl ?? []) {
    if (p.xoa || !p.lap || p.dung || (p.last ?? '') >= today) continue;
    const x = new Date((p.last || today) + 'T00:00:00Z');
    // hằng ngày: chỉ cần xét hôm nay, dù lần giao trước đã lâu (vòng bù 62 ngày không với tới)
    if (p.lap === 'ngay' && p.last) x.setTime(Math.max(x.getTime(), Date.parse(today + 'T00:00:00Z') - 864e5));
    for (let i = 0; i < 62; i++) {
      x.setUTCDate(x.getUTCDate() + 1);
      const iso = isoOf(x);
      if (iso > today) break;
      if (!recurHit(p, iso, today)) continue;
      const d0 = dayOf(iso);
      const nt = {
        id: opts.uid('cv'),
        ten: p.ten,
        moTa: p.moTa ?? '',
        team: p.team,
        da: p.da ?? '',
        nguoi: p.nguoi ?? '',
        phoi: p.phoi ?? [],
        theoDoi: p.theoDoi ?? [],
        gio: p.gio ?? '',
        gap: gapOf(p.ten),
        han: d0 + (Number(p.hanSau) || 0),
        bd: d0,
        uu: p.uu || 'Trung bình',
        st: 'todo',
        v2: p.v2,
        v2ceo: p.v2ceo,
        checklist: (p.checklist ?? []).map((c) => ({ t: c.t, x: false })),
        loai: 'Việc',
        tao: p.tao,
        tpl: p.id,
        log: [{ at: opts.stamp, by: 'Hệ thống', txt: `Tự giao theo mẫu lặp lại (${lapLbl(p)})` }],
      };
      d.tasks.push(nt);
      created++;
      if (nt.nguoi) {
        d.notifs = d.notifs ?? [];
        const dd = nt.han >= 1 && nt.han <= 31 ? `${pad(nt.han)}/${monthKey.slice(5)}` : `ngày ${nt.han}`;
        d.notifs.push({ id: opts.uid('nt'), to: nt.nguoi, text: `Việc lặp lại: "${nt.ten}" · hạn ${dd}`, at: opts.at, ref: 'task:' + nt.id, by: '', read: false });
      }
    }
    p.last = today;
    touched++;
  }
  return { created, touched };
}

const rid = (p: string) => p + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1e6).toString(36);

/** Chạy từ cron mỗi giờ: giao việc lặp lại của hôm nay (giờ Việt Nam). */
export async function taskRecurring(db: D1Database, now: Date = new Date()): Promise<Record<string, unknown>> {
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  const monthKey = `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}`;
  const today = isoOf(vn);
  const stamp = `${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}:${pad(vn.getUTCSeconds())} ${vn.getUTCDate()}/${vn.getUTCMonth() + 1}/${vn.getUTCFullYear()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db.prepare("SELECT version, data FROM hub_state WHERE id = 'main'").first<{ version: number; data: string }>();
    if (!row) return { skipped: 'chưa có dữ liệu' };
    const d = JSON.parse(await unpack(row.data)) as RecurData;
    const thang = (d.cards ?? []).find((c) => c.thang)?.thang;
    if (thang !== monthKey) return { skipped: `dữ liệu là tháng ${thang ?? '?'}, không phải ${monthKey}` };
    const r = applyRecurring(d, today, monthKey, { stamp, at: now.toISOString(), uid: rid });
    if (!r.touched) return { created: 0 };
    const res = await db
      .prepare("UPDATE hub_state SET version = version + 1, data = ?, updated_at = ? WHERE id = 'main' AND version = ?")
      .bind(await pack(JSON.stringify(d)), now.toISOString(), row.version)
      .run();
    if (res.meta.changes) return r;
  }
  return { skipped: 'dữ liệu đang được sửa liên tục, thử lại giờ sau' };
}

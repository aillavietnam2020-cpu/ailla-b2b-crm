import { pack, unpack } from '../lib/pack';

/**
 * Nhắc buổi quay của khu Marketing (chạy từ cron mỗi giờ, chỉ làm việc lúc 8 giờ sáng giờ Việt Nam):
 *  - Sáng hôm trước ngày quay: nhắc người quay và người có hook / kịch bản xếp vào buổi.
 *  - Buổi quay quá ngày mà chưa "Đã quay" hoặc "Đã hủy": báo Oanh (người duyệt) và người quay, mỗi sáng một lần,
 *    để người quay điền lý do trễ, Oanh dời lịch hoặc hủy.
 * Thông báo ghi vào chuông của khu Marketing (hub_state.notifs). Telegram làm sau.
 */

interface HubUser { id: string; active?: boolean; role?: string; perms?: string[] }
interface Shoot { id: string; day: number; buoi?: string; mucTieu?: string; nguoi?: string[]; trangThai?: string; nhacTruoc?: number; nhacTre?: number }
interface HubCard { buoiQuay?: string; nguoi?: string; thang?: string }
interface Notif { id: string; to: string; text: string; at: string; ref: string; by: string; read: boolean }
interface HubData { users?: HubUser[]; shoots?: Shoot[]; cards?: HubCard[]; notifs?: Notif[] }

const NT_KEEP = 600;
const OPEN = (s: Shoot) => !['Đã quay', 'Đã hủy'].includes(s.trangThai ?? '');
const dd = (day: number, mon: number) => `${String(day).padStart(2, '0')}/${String(mon).padStart(2, '0')}`;

export async function shootReminders(
  db: D1Database,
  now: Date = new Date(),
  opts: { anyHour?: boolean } = {},
): Promise<Record<string, unknown>> {
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  if (!opts.anyHour && vn.getUTCHours() !== 8) return { skipped: 'chưa tới 8 giờ sáng giờ Việt Nam' };
  const year = vn.getUTCFullYear();
  const mon = vn.getUTCMonth() + 1;
  const today = vn.getUTCDate();
  const monthKey = `${year}-${String(mon).padStart(2, '0')}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db
      .prepare("SELECT version, data FROM hub_state WHERE id = 'main'")
      .first<{ version: number; data: string }>();
    if (!row) return { skipped: 'chưa có dữ liệu khu Marketing' };
    const d = JSON.parse(await unpack(row.data)) as HubData;
    const thang = (d.cards ?? []).find((c) => c.thang)?.thang;
    if (thang !== monthKey) return { skipped: `dữ liệu khu Marketing là tháng ${thang ?? '?'}, không phải ${monthKey}` };

    const users = d.users ?? [];
    const active = new Set(users.filter((u) => u.active !== false).map((u) => u.id));
    const approvers = users.filter((u) => u.active !== false && u.role === 'lead' && (u.perms ?? []).includes('viec.duyet')).map((u) => u.id);
    const at = now.toISOString();
    let sentBefore = 0;
    let sentLate = 0;
    const notify = (ids: Iterable<string>, text: string) => {
      d.notifs = d.notifs ?? [];
      for (const to of new Set([...ids])) {
        if (!to || !active.has(to)) continue;
        d.notifs.push({ id: 'nt' + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1e3).toString(36), to, text, at, ref: '', by: '', read: false });
      }
      if (d.notifs.length > NT_KEEP) d.notifs = d.notifs.slice(-NT_KEEP);
    };

    for (const s of d.shoots ?? []) {
      if (!OPEN(s)) continue;
      const crew = s.nguoi ?? [];
      if (s.day === today + 1 && s.nhacTruoc !== s.day) {
        const writers = (d.cards ?? []).filter((c) => c.buoiQuay === s.id && c.nguoi).map((c) => c.nguoi as string);
        notify([...crew, ...writers], `Mai (${dd(s.day, mon)}) quay buổi ${s.buoi ?? ''}${s.mucTieu ? ': ' + s.mucTieu : ''}. Nhớ nộp hook, kịch bản đã duyệt.`);
        s.nhacTruoc = s.day;
        sentBefore++;
      } else if (s.day < today && s.nhacTre !== today) {
        notify([...approvers, ...crew], `Buổi quay ${dd(s.day, mon)} ${s.buoi ?? ''} chưa cập nhật (trễ ${today - s.day} ngày). Người quay điền lý do trễ, Oanh dời lịch hoặc hủy.`);
        s.nhacTre = today;
        sentLate++;
      }
    }
    if (!sentBefore && !sentLate) return { changed: 0 };

    const res = await db
      .prepare("UPDATE hub_state SET version = version + 1, data = ?, updated_at = ? WHERE id = 'main' AND version = ?")
      .bind(await pack(JSON.stringify(d)), at, row.version)
      .run();
    if (res.meta.changes) return { remindedBefore: sentBefore, remindedLate: sentLate };
    // Có người vừa sửa trước: đọc lại bản mới rồi làm lại.
  }
  return { skipped: 'dữ liệu đang được sửa liên tục, thử lại giờ sau' };
}

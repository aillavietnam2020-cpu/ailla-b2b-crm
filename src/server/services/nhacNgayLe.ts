import { nowIso } from '@shared/datetime';
import { bellTo } from '../lib/hubBell';
import { loadMembers } from './daoTao';
import { CC_SETTINGS_KEY, normalizeSettings, weekday } from './chamCong';

/**
 * Ngày 25 hằng tháng, 8 giờ sáng (giờ Việt Nam): nhắc HCNS điền ngày lễ tháng sau ở Nhân sự › Cài đặt chấm công
 * (CEO 04/11: ngày lễ theo lịch nhà nước, tháng này điền tháng sau). Mỗi tháng nhắc một lần (mốc lưu ở hub_blobs).
 */
const KEY = 'cc_nhac_le';

export async function nhacNgayLe(db: D1Database, now = new Date()): Promise<Record<string, unknown>> {
  const vn = new Date(now.getTime() + 7 * 3600e3);
  if (vn.getUTCDate() !== 25 || vn.getUTCHours() !== 8) return { skipped: 'không phải 8 giờ ngày 25' };
  const thang = `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
  const done = await db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(KEY).first<{ data: string }>();
  if (done?.data === thang) return { skipped: 'đã nhắc tháng này' };
  const sau = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() + 1, 1));
  const tenThang = `${sau.getUTCMonth() + 1}/${sau.getUTCFullYear()}`;
  const m = await loadMembers(db, 'he-thong');
  const to = Object.entries(m.users).filter(([, u]) => u.hr && u.role !== 'admin').map(([id]) => id);
  const n = await bellTo(db, to, `Nhắc: điền ngày lễ, ngày nghỉ bù tháng ${tenThang} (nếu có) ở Nhân sự › Cài đặt chấm công`, 'page:cc_caidat');
  await db
    .prepare(
      `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, 'he-thong')
       ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind(KEY, thang, nowIso())
    .run();
  return { notified: n, thang: tenThang };
}

/**
 * Mỗi sáng 8 giờ: ngày làm việc nào cả máy chấm công đều không ai chấm (máy ghi vắng hết) mà chưa có trong Ngày lễ
 * thì nhắc HCNS (và CEO) xem có phải ngày lễ không, để chấm công không tính vắng (CEO 04/11: 1/9, 2/9/2026). Mỗi ngày chỉ nhắc một lần.
 */
const KEY_VANG = 'cc_nhac_vang';
export async function nhacNgayVangChung(db: D1Database, now = new Date()): Promise<Record<string, unknown>> {
  const vn = new Date(now.getTime() + 7 * 3600e3);
  if (vn.getUTCHours() !== 8) return { skipped: 'chỉ chạy lúc 8 giờ' };
  const tu = new Date(vn.getTime() - 62 * 864e5).toISOString().slice(0, 10);
  const rows =
    (
      await db
        .prepare("SELECT ngay, SUM(CASE WHEN gio <> '[]' THEN 1 ELSE 0 END) AS co, COUNT(*) AS n FROM cc_may WHERE ngay >= ? GROUP BY ngay")
        .bind(tu)
        .all<{ ngay: string; co: number; n: number }>()
    ).results ?? [];
  const [cfg, done] = await Promise.all([
    db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(CC_SETTINGS_KEY).first<{ data: string }>(),
    db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(KEY_VANG).first<{ data: string }>(),
  ]);
  let le: string[] = [];
  let da: string[] = [];
  try {
    le = normalizeSettings(cfg ? JSON.parse(cfg.data) : null).ngayLe.map((x) => x.ngay);
    da = done ? (JSON.parse(done.data) as string[]) : [];
  } catch {
    /* dữ liệu hỏng thì coi như chưa có */
  }
  const ngay = rows
    .filter((r) => r.n >= 3 && !r.co && weekday(r.ngay) !== 0 && !le.includes(r.ngay) && !da.includes(r.ngay))
    .map((r) => r.ngay)
    .sort();
  if (!ngay.length) return { skipped: 'không có ngày nào cả máy đều vắng' };
  const m = await loadMembers(db, 'he-thong');
  const to = Object.entries(m.users).filter(([, u]) => u.hr).map(([id]) => id);
  const ds = ngay.map((d) => `${d.slice(8)}/${d.slice(5, 7)}`).join(', ');
  const n = await bellTo(db, to, `Ngày ${ds}: máy chấm công ghi cả công ty vắng. Nếu là ngày lễ, HCNS thêm vào Nhân sự › Cài đặt chấm công › Ngày lễ để không bị tính vắng.`, 'page:cc_caidat');
  await db
    .prepare(
      `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, 'he-thong')
       ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind(KEY_VANG, JSON.stringify([...da, ...ngay].slice(-200)), nowIso())
    .run();
  return { notified: n, ngay };
}

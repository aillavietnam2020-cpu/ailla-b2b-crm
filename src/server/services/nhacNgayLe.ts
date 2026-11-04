import { nowIso } from '@shared/datetime';
import { bellTo } from '../lib/hubBell';
import { loadMembers } from './daoTao';

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

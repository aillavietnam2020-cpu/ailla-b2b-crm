import { nowIso } from '@shared/datetime';
import { fileKind, normalizeConfig, type DriveConfig, type DriveTeam } from '../lib/driveAccess';
import { countSubs, type IdxFile, type TeamIdx } from '../lib/driveIndex';
import { pack, unpack } from '../lib/pack';
import { children, saKey } from './gdrive';

/**
 * Quét cây thư mục của từng thư mục đã gán (Thư mục làm việc) để có số file, "nằm ở đâu", tìm không dấu, việc cần xử lý.
 * Mỗi thư mục một dòng hub_blobs 'drive_idx_<mã>' (nén). Quét lại khi:
 *  - có người mở thư mục mà mục lục cũ hơn 15 phút (quét ngầm, trang vẫn hiện bản cũ ngay),
 *  - bấm "Tải lại",
 *  - cron mỗi 15 phút quét một thư mục cũ nhất (quá 6 giờ), để số trên Bảng điều khiển không quá cũ.
 * Thư mục gốc của phòng khác nằm bên trong (vd thư mục phòng nằm trong AILLA CENTER AI) thì bỏ qua, không đếm hai lần.
 */
const KEY = (pb: string) => `drive_idx_${pb}`;
const MAX_FOLDERS = 250;
const MAX_FILES = 4000;
export const STALE_MS = 15 * 60_000;

const MEM = new Map<string, { at: number; v: TeamIdx | null }>();
const RUNNING = new Set<string>();

export async function crawlTeam(key: NonNullable<ReturnType<typeof saKey>>, team: DriveTeam, skip: Set<string>): Promise<TeamIdx> {
  const queue: { id: string; sub: string; path: string[] }[] = [{ id: team.folderId, sub: '', path: [] }];
  const subs: { id: string; n: string }[] = [];
  const files: IdxFile[] = [];
  let folders = 0;
  let cut = false;
  const until = Date.now() + 25_000;
  // Đọc 8 thư mục một lượt cho nhanh; quá 250 thư mục hoặc quá 25 giây thì dừng, lưu phần đã đếm (cut).
  while (queue.length) {
    if (folders >= MAX_FOLDERS || Date.now() > until) {
      cut = true;
      break;
    }
    const wave = queue.splice(0, Math.min(8, MAX_FOLDERS - folders));
    folders += wave.length;
    const lists = await Promise.all(wave.map((w) => children(key, w.id)));
    wave.forEach((cur, wi) => {
      for (const f of lists[wi]) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          if (skip.has(f.id)) continue;
          if (!cur.path.length) subs.push({ id: f.id, n: f.name });
          queue.push({ id: f.id, sub: cur.sub || f.name, path: [...cur.path, f.name] });
          continue;
        }
        if (files.length >= MAX_FILES) {
          cut = true;
          continue;
        }
        const shortcut = f.mimeType === 'application/vnd.google-apps.shortcut';
        files.push({
          i: f.id,
          n: f.name,
          k: shortcut ? 'link' : fileKind(f.mimeType, f.name),
          s: cur.sub,
          w: cur.path.join(' › '),
          m: f.modifiedTime ?? null,
          c: f.createdTime ?? null,
          b: f.lastModifyingUser?.displayName ?? '',
          z: f.size ? Number(f.size) : null,
          l: f.webViewLink ?? `https://drive.google.com/open?id=${f.shortcutDetails?.targetId ?? f.id}`,
          d: !f.mimeType.startsWith('application/vnd.google-apps'),
          t: !!f.hasThumbnail,
        });
      }
    });
  }
  return { pb: team.pb, root: team.folderId, at: nowIso(), subs: countSubs(subs, files), files, cut };
}

export async function loadIdx(db: D1Database, pb: string): Promise<TeamIdx | null> {
  const hit = MEM.get(pb);
  if (hit && Date.now() - hit.at < 60_000) return hit.v;
  const row = await db.prepare('SELECT data FROM hub_blobs WHERE key = ?').bind(KEY(pb)).first<{ data: string }>();
  let v: TeamIdx | null = null;
  if (row) {
    try {
      v = JSON.parse(await unpack(row.data)) as TeamIdx;
    } catch {
      v = null;
    }
  }
  MEM.set(pb, { at: Date.now(), v });
  return v;
}

/** Lưu mục lục đã sửa (sau khi chuyển file). */
export async function saveIdx(db: D1Database, idx: TeamIdx) {
  await db
    .prepare(
      `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, NULL)
       ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind(KEY(idx.pb), await pack(JSON.stringify(idx)), nowIso())
    .run();
  MEM.set(idx.pb, { at: Date.now(), v: idx });
}

/** Quét lại một thư mục và lưu. Đang quét thì thôi (trả null). */
export async function refreshIdx(db: D1Database, saJson: string | undefined, cfg: DriveConfig, pb: string): Promise<TeamIdx | null> {
  const key = saKey(saJson);
  const team = cfg.teams.find((t) => t.pb === pb);
  if (!key || !team || team.direct || RUNNING.has(pb)) return null;
  RUNNING.add(pb);
  try {
    const skip = new Set(cfg.teams.filter((t) => t.pb !== pb).map((t) => t.folderId));
    const idx = await crawlTeam(key, team, skip);
    await db
      .prepare(
        `INSERT INTO hub_blobs (key, data, admin_only, updated_at, updated_by) VALUES (?, ?, 1, ?, NULL)
         ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .bind(KEY(pb), await pack(JSON.stringify(idx)), idx.at)
      .run();
    MEM.set(pb, { at: Date.now(), v: idx });
    return idx;
  } finally {
    RUNNING.delete(pb);
  }
}

/** Mục lục chưa có, của thư mục gốc cũ (vừa gán lại), hoặc cũ hơn `ms`. */
export const isStale = (idx: TeamIdx | null, root: string, ms = STALE_MS) => !idx || idx.root !== root || Date.now() - Date.parse(idx.at) > ms;

/** Cron: quét một thư mục có mục lục cũ nhất (chưa có, hoặc quá 6 giờ). */
export async function cronRefreshOne(db: D1Database, saJson: string | undefined) {
  if (!saKey(saJson)) return null;
  const row = await db.prepare("SELECT data FROM hub_blobs WHERE key = 'drive_teams'").first<{ data: string }>();
  const cfg: DriveConfig = row ? normalizeConfig(JSON.parse(row.data)) : { teams: [] };
  if (!cfg.teams.length) return null;
  let pick: { pb: string; at: number } | null = null;
  for (const t of cfg.teams.filter((x) => !x.direct)) {
    const idx = await loadIdx(db, t.pb);
    // Đổi thư mục gốc ở trang Gán thư mục thì quét lại ngay lượt sau.
    const at = idx && idx.root === t.folderId ? Date.parse(idx.at) : 0;
    if (!pick || at < pick.at) pick = { pb: t.pb, at };
  }
  if (!pick || Date.now() - pick.at < 6 * 3_600_000) return null;
  const idx = await refreshIdx(db, saJson, cfg, pick.pb);
  return idx ? { pb: idx.pb, files: idx.files.length, cut: idx.cut } : null;
}

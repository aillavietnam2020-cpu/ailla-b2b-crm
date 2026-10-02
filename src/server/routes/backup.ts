import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ok, unauthorized } from '../lib/http';

/**
 * Sao lưu: máy văn phòng gọi mỗi đêm (scripts/sao-luu.mjs) để giữ một bản toàn bộ database ngoài Cloudflare.
 * Xác thực bằng khoá riêng BACKUP_KEY (secret), không dùng phiên đăng nhập. Chỉ đọc, không sửa gì.
 */
export const backupRoutes = new Hono<AppEnv>();

backupRoutes.use('*', async (c, next) => {
  const key = c.req.header('X-Backup-Key') ?? '';
  const expected = c.env.BACKUP_KEY ?? '';
  if (!expected || key.length !== expected.length) throw unauthorized('Sai khoá sao lưu');
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) throw unauthorized('Sai khoá sao lưu');
  await next();
});

/** Danh sách bảng + câu lệnh tạo bảng/chỉ mục. */
backupRoutes.get('/schema', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'
     ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`,
  ).all();
  return ok(c, rows.results ?? []);
});

/** Dữ liệu một bảng, theo trang (rowid) để không vượt giới hạn phản hồi. */
backupRoutes.get('/table/:name', async (c) => {
  const name = c.req.param('name');
  const t = await c.env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
  )
    .bind(name)
    .first<{ name: string }>();
  if (!t) throw unauthorized('Không có bảng này');
  const offset = Math.max(0, Number(c.req.query('offset') ?? 0) || 0);
  const limit = 500;
  const rows = await c.env.DB.prepare(`SELECT * FROM "${t.name}" ORDER BY rowid LIMIT ? OFFSET ?`).bind(limit, offset).all();
  const list = rows.results ?? [];
  return ok(c, { rows: list, next: list.length === limit ? offset + limit : null });
});

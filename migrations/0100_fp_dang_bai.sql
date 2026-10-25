-- Đăng bài tự động lên Fanpage (khu Marketing), 25/10/2026.
-- fp_pages: page đã nối. Mã truy cập page được mã hóa (giống mã API Poscake), chỉ CEO dán vào, không bao giờ trả lại ra màn hình.
--   is_test = 1: page thử, bản đầu chỉ đăng vào page này.
-- fp_publish_log: nhật ký mỗi lần đăng (thành công, lỗi) để dò lại.
-- Công tắc chung nằm ở app_kv khóa 'fp_publish' (off / test / on), mặc định off.
CREATE TABLE IF NOT EXISTS fp_pages (
  page_id    TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  token      TEXT NOT NULL,
  is_test    INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS fp_publish_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id    TEXT NOT NULL,
  page_id    TEXT NOT NULL,
  status     TEXT NOT NULL,
  fb_post_id TEXT,
  error      TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fp_publish_log_card ON fp_publish_log (card_id);

-- Zalo trong CRM: cấu hình "AI soạn sẵn" + kho kịch bản bán hàng (chị Hoa yêu cầu 27/11/2026, theo mẫu ZL-CRM). Khối 0340–0349.
-- Cài đặt chung lưu ở app_kv (khóa 'zalo_ai_cfg'). Chỉ thêm bảng.

-- Kho kịch bản bán hàng: AI và agent chỉ được nêu giá, chính sách, cam kết theo các mục ở đây và bảng giá.
CREATE TABLE IF NOT EXISTS zalo_playbook (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT '',
  keywords    TEXT NOT NULL DEFAULT '[]',   -- JSON: khách nhắn trúng từ nào thì ưu tiên mục này; trống = luôn dùng
  content     TEXT NOT NULL,
  priority    INTEGER NOT NULL DEFAULT 50,  -- 0–100, cao đưa trước
  enabled     INTEGER NOT NULL DEFAULT 1,
  updated_by  TEXT,
  updated_at  TEXT NOT NULL
);

-- Nhật ký nháp: soạn / dùng / bỏ, để đếm lượt mỗi ngày và xem tỉ lệ sale dùng nháp.
CREATE TABLE IF NOT EXISTS zalo_ai_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id  TEXT NOT NULL,
  source   TEXT NOT NULL DEFAULT 'ai',      -- ai · agent
  action   TEXT NOT NULL,                   -- draft · used · dismissed
  by_id    TEXT,
  at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_zalo_ai_log_at ON zalo_ai_log (at, action);

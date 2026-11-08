-- Thông báo đẩy về điện thoại / máy tính kể cả khi đã tắt web (chị Hoa duyệt demo 08/11/2026).
-- user_id: mã đăng nhập (users.id). Một người có thể bật trên nhiều máy.
CREATE TABLE push_subs (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device TEXT NOT NULL DEFAULT '',   -- tên máy hiển thị: "iPhone · Safari", "Máy tính · Chrome"…
  created_at TEXT NOT NULL,
  last_ok_at TEXT
);
CREATE INDEX ix_push_subs_user ON push_subs (user_id);

-- Tùy chọn từng người + bộ đếm dồn (việc chờ duyệt gộp mỗi giờ, thông báo trong giờ yên lặng báo gộp buổi sáng).
CREATE TABLE push_users (
  user_id TEXT PRIMARY KEY,
  prefs TEXT NOT NULL DEFAULT '{}',
  pend_duyet INTEGER NOT NULL DEFAULT 0,
  last_duyet_at TEXT,
  pend_dem INTEGER NOT NULL DEFAULT 0
);

-- Đánh dấu đã gửi (chặn gửi trùng khi nhiều lần lưu chạy cùng lúc). Tự xóa sau 3 ngày.
CREATE TABLE push_sent (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL
);

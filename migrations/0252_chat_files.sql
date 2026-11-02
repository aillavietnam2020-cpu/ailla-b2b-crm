-- Tin nhắn (chị Hoa 02/11, học Zalo): ảnh / tệp gửi trong cuộc trò chuyện. Giữ theo phòng chat để máy chủ chặn quyền mở
-- (nhắn riêng chỉ hai người mở được). Lưu thẳng trong D1, mỗi tệp ≤ 1,5 MB (ảnh thu nhỏ ở trình duyệt trước khi gửi).
CREATE TABLE chat_files (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX ix_chat_files_room ON chat_files (room, created_at);

-- Migration 0056: ảnh agent gửi lại trên trang Điều hành agent (ví dụ Media tạo ảnh).
-- R2 chưa bật nên ảnh lưu thẳng trong D1 dạng base64, đã nén ở phía VPS (tối đa khoảng 1,5 MB mỗi ảnh).

CREATE TABLE agent_chat_files (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id    INTEGER NOT NULL REFERENCES agent_chat (id),
  name       TEXT NOT NULL,
  mime       TEXT NOT NULL,
  data       TEXT NOT NULL,              -- base64
  created_at TEXT NOT NULL
);
CREATE INDEX ix_agent_chat_files_chat ON agent_chat_files (chat_id);

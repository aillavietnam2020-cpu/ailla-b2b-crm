-- Tin nhắn (chị Hoa 03/11): nhóm phối hợp tự tạo (ví dụ Team Content – Digital), chỉ thành viên thấy và nhắn.
-- members: JSON mảng mã đăng nhập. Nhóm phòng / nhóm dự án không cần bảng này (máy chủ tính từ dữ liệu chung).
CREATE TABLE chat_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  members TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Migration 0010: vài giá trị nhỏ của hệ thống (ví dụ địa chỉ đường kết nối tới máy dựng video ở văn phòng).
CREATE TABLE app_kv (
  k           TEXT PRIMARY KEY,
  v           TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

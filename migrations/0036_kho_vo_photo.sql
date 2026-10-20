-- Ảnh vỏ can / chai / thùng để nhân sự tra theo hình. Ảnh đã nén nhỏ ở trình duyệt (khoảng 50-100 KB / ảnh).
CREATE TABLE kho_vo_photo (
  code       TEXT PRIMARY KEY REFERENCES kho_items (code),
  mime       TEXT NOT NULL,
  data       TEXT NOT NULL,              -- base64, không có tiền tố data:
  updated_by TEXT REFERENCES users (id),
  updated_at TEXT NOT NULL
);

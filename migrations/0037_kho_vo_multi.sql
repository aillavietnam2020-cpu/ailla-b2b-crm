-- Vỏ: tối đa 4 ảnh mỗi vỏ và nhiều nhà cung cấp cho mỗi vỏ.
CREATE TABLE kho_vo_img (
  code       TEXT NOT NULL REFERENCES kho_items (code),
  idx        INTEGER NOT NULL,           -- 1 = chính diện, 2..4 = ảnh phụ
  mime       TEXT NOT NULL,
  data       TEXT NOT NULL,              -- base64 đã nén nhỏ, không có tiền tố data:
  updated_by TEXT REFERENCES users (id),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (code, idx)
);
INSERT INTO kho_vo_img (code, idx, mime, data, updated_by, updated_at)
  SELECT code, 1, mime, data, updated_by, updated_at FROM kho_vo_photo;
DROP TABLE kho_vo_photo;

CREATE TABLE kho_vo_ncc (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL REFERENCES kho_items (code),
  name       TEXT NOT NULL,              -- tên nhà cung cấp
  ncc_code   TEXT NOT NULL DEFAULT '',   -- mã hoặc tên vỏ bên NCC
  price      REAL,                       -- giá báo: chỉ CEO / kế toán xem
  quote_date TEXT NOT NULL DEFAULT '',
  contact    TEXT NOT NULL DEFAULT '',
  main       INTEGER NOT NULL DEFAULT 0, -- NCC chính (đúng 1 dòng)
  updated_by TEXT REFERENCES users (id),
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_kho_vo_ncc_code ON kho_vo_ncc (code);

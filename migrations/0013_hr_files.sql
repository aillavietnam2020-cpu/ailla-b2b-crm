-- Migration 0013: file đính kèm hồ sơ nhân sự (ảnh, CCCD, hợp đồng, quyết định...).
-- R2 chưa bật trên tài khoản nên file nhỏ (≤ 1,5 MB) để thẳng trong D1.
-- Chỉ CEO, kế toán và người làm nhân sự đọc/ghi được (kiểm tra ở src/server/routes/hr.ts).

CREATE TABLE hr_files (
  id          TEXT PRIMARY KEY,
  ma          TEXT NOT NULL,               -- mã nhân sự (NV001...)
  name        TEXT NOT NULL,
  mime        TEXT NOT NULL DEFAULT 'application/octet-stream',
  kind        TEXT NOT NULL DEFAULT '',    -- anh | cccd | hd | qd | khac
  size        INTEGER NOT NULL,
  data        BLOB NOT NULL,
  created_at  TEXT NOT NULL,
  created_by  TEXT,
  deleted_at  TEXT
);

CREATE INDEX ix_hr_files_ma ON hr_files (ma);

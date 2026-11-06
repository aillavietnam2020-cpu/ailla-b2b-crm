-- Chấm công ngoài văn phòng (CEO 06/11): đi quay, gặp khách thì chụp ảnh check-in, gắn buổi quay, Lead xác nhận.
-- xn: NULL = lượt thường; 'cho' = chờ xác nhận; 'ok' = đã xác nhận; 'khong' = không xác nhận (coi như không chấm).
ALTER TABLE cc_luot ADD COLUMN anh_id TEXT;
ALTER TABLE cc_luot ADD COLUMN xn TEXT;
ALTER TABLE cc_luot ADD COLUMN xn_by TEXT;
ALTER TABLE cc_luot ADD COLUMN xn_at TEXT;
ALTER TABLE cc_luot ADD COLUMN quay TEXT;
ALTER TABLE cc_luot ADD COLUMN gio_quay TEXT;
CREATE INDEX IF NOT EXISTS idx_cc_luot_xn ON cc_luot (xn, ngay);

-- Ảnh check-in (JPEG đã thu nhỏ trên điện thoại, dạng data URL). Máy chủ thật chưa nối kho file R2 nên lưu thẳng D1.
CREATE TABLE IF NOT EXISTS cc_anh (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

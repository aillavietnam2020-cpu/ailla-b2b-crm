-- Điều khoản thanh toán của nhà cung cấp: chuyển khoản TRƯỚC khi giao, chuyển khoản SAU khi nhận hàng, hoặc CÔNG NỢ (trả sau N ngày).
ALTER TABLE suppliers ADD COLUMN pay_terms TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN pay_days INTEGER NOT NULL DEFAULT 0;

-- Ảnh bill / phiếu chi dùng chung cho cả khoản chi nhập tay (COST). Bỏ ràng buộc loại cũ vì SQLite không sửa được ràng buộc tại chỗ.
CREATE TABLE pay_files_new (
  id          TEXT PRIMARY KEY,
  ref_type    TEXT NOT NULL,
  ref_id      TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL DEFAULT 0,
  data        TEXT NOT NULL,
  created_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL
);
INSERT INTO pay_files_new (id, ref_type, ref_id, name, mime, size, data, created_by, created_at)
  SELECT id, ref_type, ref_id, name, mime, size, data, created_by, created_at FROM pay_files;
DROP TABLE pay_files;
ALTER TABLE pay_files_new RENAME TO pay_files;
CREATE INDEX ix_pay_files_ref ON pay_files (ref_type, ref_id);

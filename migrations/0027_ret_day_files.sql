-- Ảnh phiếu kiểm hàng hoàn (kho in ra, tích tay, chụp lại) gắn theo ngày nhận.
CREATE TABLE ret_day_files (
  id          TEXT PRIMARY KEY,
  scan_day    TEXT NOT NULL,
  name        TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  data        BLOB NOT NULL,
  uploaded_by TEXT,
  uploaded_at TEXT NOT NULL
);
CREATE INDEX ix_ret_day_files_day ON ret_day_files (scan_day);

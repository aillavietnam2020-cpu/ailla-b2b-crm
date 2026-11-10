-- Phiếu nhận hàng hoàn (chị Hoa 10/11/2026): mỗi lượt quét là một phiếu theo ngày, ngày quét nhiều lần thì nhiều phiếu;
-- in biên bản cho shipper ký theo từng phiếu. Gói quét trước ngày này không có phiếu (batch_id NULL), web gom thành "gói quét trước khi chia phiếu".
CREATE TABLE ret_batches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  no         TEXT NOT NULL UNIQUE,
  day        TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'SCAN', -- SCAN: quét máy; MANUAL: phiếu gõ tay
  created_at TEXT NOT NULL,
  created_by TEXT,
  closed_at  TEXT,
  closed_by  TEXT
);
CREATE INDEX ix_ret_batches_day ON ret_batches (day);
ALTER TABLE ret_scans ADD COLUMN batch_id INTEGER;
CREATE INDEX ix_ret_scans_batch ON ret_scans (batch_id);

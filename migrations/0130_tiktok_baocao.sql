-- Báo cáo kênh TikTok Shop trên web (thay file Excel + HTML), chị Hoa duyệt 24/10/2026.
-- tts_month: số tháng của kế toán (đã chia phí sàn theo SKU, giá vốn, lãi lỗ) + khoá sổ. Chỉ CEO, kế toán.
--   Không có tên, số điện thoại, địa chỉ khách: file đơn chỉ đọc ở trình duyệt.
-- tts_day: số hiệu suất từng ngày, mỗi nguồn file một dòng (km = Key metrics, live = LIVE, ads = Campaign overview).
--   Tải lại thì ghi đè đúng ngày của nguồn đó.
-- tts_range: số cả khoảng ngày (koc = Transaction Analysis, creators = Creator List).
CREATE TABLE IF NOT EXISTS tts_month (
  ky         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  summary    TEXT NOT NULL,
  locked_at  TEXT,
  locked_by  TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS tts_day (
  day        TEXT NOT NULL,
  src        TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (day, src)
);

CREATE TABLE IF NOT EXISTS tts_range (
  kind       TEXT NOT NULL,
  d_from     TEXT NOT NULL,
  d_to       TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (kind, d_from, d_to)
);

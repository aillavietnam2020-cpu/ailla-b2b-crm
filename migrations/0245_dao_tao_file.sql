-- Đào tạo: tệp đính kèm tài liệu (Word, PDF, Excel, PowerPoint…) — chị Hoa 02/11 muốn tải file lên thư viện.
-- doc_id NULL = vừa tải lên, chưa lưu vào tài liệu nào (chỉ người tải và CEO mở được).
CREATE TABLE IF NOT EXISTS dt_file (
  id TEXT PRIMARY KEY,
  doc_id TEXT,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_dt_file_doc ON dt_file (doc_id);
-- Danh sách tệp của tài liệu: JSON [{id, name, size, mime}]
ALTER TABLE dt_doc ADD COLUMN files TEXT NOT NULL DEFAULT '[]';

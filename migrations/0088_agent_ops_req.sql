-- Thêm agent ngay trên web (07/11/2026): CEO điền form → yêu cầu chờ máy chủ agent dựng (để TẮT) → CEO bấm Bật.
CREATE TABLE IF NOT EXISTS agent_ops_req (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL,              -- mã agent mới (chữ thường, số, gạch ngang)
  name TEXT NOT NULL,
  title TEXT,
  emoji TEXT,
  dept TEXT,
  parent TEXT,
  template TEXT,                    -- agent mẫu để chép nội quy, quyền
  skills_json TEXT NOT NULL DEFAULT '[]',
  duty TEXT,                        -- mô tả việc (máy chủ dùng để viết AGENTS.md / IDENTITY.md)
  crons_json TEXT NOT NULL DEFAULT '[]', -- [{when, task}]
  combo TEXT,                       -- gói AI: 'template' = dùng chung gói của agent mẫu
  status TEXT NOT NULL DEFAULT 'pending', -- pending | creating | created | enable | enabled | error | cancelled
  note TEXT,                        -- máy chủ ghi kết quả / lỗi
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_ops_req_status ON agent_ops_req (status);

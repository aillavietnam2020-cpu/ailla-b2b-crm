-- Điều hành agent: nội dung skill (SKILL.md) và file kiến thức của từng agent, máy chủ agent gửi lên để CEO mở xem trên web (07/11/2026).
CREATE TABLE IF NOT EXISTS agent_ops_doc (
  agent TEXT NOT NULL,
  kind TEXT NOT NULL,              -- skill | kn
  name TEXT NOT NULL,              -- tên skill / tên file (AGENTS.md, knowledge/BAI-HOC...)
  description TEXT,                -- mô tả ngắn (lấy từ phần đầu SKILL.md)
  path TEXT,                       -- chỗ lưu trên máy chủ agent
  body TEXT,                       -- nội dung (cắt tối đa 300 KB)
  size INTEGER,
  file_at TEXT,                    -- lần sửa file trên máy chủ
  updated_at TEXT NOT NULL,
  PRIMARY KEY (agent, kind, name)
);

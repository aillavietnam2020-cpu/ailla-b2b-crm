-- Migration 0058: mở trang Điều hành agent cho nhân sự (do chị Hoa cấp từng người, từng agent).
-- Mỗi người chỉ thấy cuộc trò chuyện CỦA MÌNH (owner_id); tin chị Hoa nhắn và tin Telegram của chị thuộc về chị.

ALTER TABLE agent_chat ADD COLUMN owner_id TEXT;

CREATE TABLE agent_chat_access (
  user_id    TEXT NOT NULL,
  agent      TEXT NOT NULL,
  granted_by TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, agent)
);

-- Tin có sẵn từ trước đều là của chị Hoa.
UPDATE agent_chat SET owner_id = (SELECT id FROM users WHERE role = 'CEO' AND kind = 'HUMAN' ORDER BY created_at LIMIT 1) WHERE owner_id IS NULL;
CREATE INDEX ix_agent_chat_owner ON agent_chat (owner_id, agent, id);

-- Chị Thảo (quản lý) được nhắn Kế toán trưởng.
INSERT OR IGNORE INTO agent_chat_access (user_id, agent, granted_by, created_at)
SELECT id, 'ke-toan-truong-ailla', (SELECT id FROM users WHERE role = 'CEO' AND kind = 'HUMAN' ORDER BY created_at LIMIT 1), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM users WHERE id = '41fa1233-6bf8-4d7f-81de-10898a34dc45';

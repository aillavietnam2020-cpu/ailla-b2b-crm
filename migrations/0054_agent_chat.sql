-- Migration 0054: nhắn agent ngay trên web (Điều hành agent).
-- Tin chị gõ trên web nằm hàng đợi; chương trình nhỏ trên VPS lấy về, nhờ đúng agent OpenClaw trả lời,
-- rồi gửi câu trả lời lên đây. Telegram vẫn dùng song song, không bị thay thế.

CREATE TABLE agent_chat (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  agent      TEXT NOT NULL,              -- mã agent trên VPS (main, lead-sale-ailla...)
  role       TEXT NOT NULL CHECK (role IN ('USER', 'AGENT', 'SYSTEM')),
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('queued', 'taken', 'done', 'error')), -- chỉ có nghĩa với tin của chị
  tg         INTEGER NOT NULL DEFAULT 0, -- 1 = gửi cả bản trả lời sang Telegram
  reply_to   INTEGER,                    -- tin của agent trả lời tin nào
  created_by TEXT REFERENCES users (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_agent_chat_agent ON agent_chat (agent, id);
CREATE INDEX ix_agent_chat_status ON agent_chat (status, id);

-- Migration 0060: agent ghi dữ liệu thay người, CHỈ khi người đó (đã được chị Hoa chỉ định) vừa ra lệnh qua web Điều hành agent.
--  agent_delegators : ai được ra lệnh cho agent nào (hiện: chị Thảo → agent Kế toán trưởng).
--  agent_delegations: "giấy ủy quyền" ngắn hạn, sinh ra mỗi khi một tin của người đó được đưa cho agent. Chỉ lưu bản băm.

CREATE TABLE agent_delegators (
  agent_id   TEXT NOT NULL REFERENCES users (id),   -- tài khoản agent (bảng agents)
  chat_agent TEXT NOT NULL,                         -- mã agent trên trang Điều hành agent, ví dụ ke-toan-truong-ailla
  user_id    TEXT NOT NULL REFERENCES users (id),   -- người được ra lệnh (chị Thảo)
  granted_by TEXT REFERENCES users (id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (agent_id, user_id)
);

CREATE TABLE agent_delegations (
  token_hash TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL REFERENCES users (id),
  user_id    TEXT NOT NULL REFERENCES users (id),
  chat_id    INTEGER,
  expires_at TEXT NOT NULL,
  max_uses   INTEGER NOT NULL,
  uses       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX ix_agent_delegations_exp ON agent_delegations (expires_at);

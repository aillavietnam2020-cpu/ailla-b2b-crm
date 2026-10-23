-- Migration 0059: file chị tải lên cho agent trên trang Điều hành agent (Excel, CSV, PDF, Word, video...).
-- R2 chưa bật nên file được cắt thành mảnh (~0,9 MB) lưu trong D1; tối đa 25 MB mỗi file. Tự xóa sau 30 ngày.

CREATE TABLE agent_chat_docs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id    INTEGER,                    -- gắn vào tin khi chị bấm Gửi; NULL = đang tải dở
  owner_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  nparts     INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX ix_agent_chat_docs_chat ON agent_chat_docs (chat_id);

CREATE TABLE agent_chat_doc_parts (
  doc_id INTEGER NOT NULL REFERENCES agent_chat_docs (id),
  seq    INTEGER NOT NULL,
  data   TEXT NOT NULL,                  -- base64
  PRIMARY KEY (doc_id, seq)
);

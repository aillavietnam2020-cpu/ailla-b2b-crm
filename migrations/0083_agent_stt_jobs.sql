-- Migration 0083: ghi âm trên web Điều hành agent -> máy ở văn phòng nghe bằng Whisper rồi trả chữ.
-- Âm thanh chỉ tồn tại tới khi nghe xong (xóa ngay), chữ giữ 1 ngày rồi dọn.
CREATE TABLE agent_stt_jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    TEXT NOT NULL,
  mime        TEXT NOT NULL,
  audio       TEXT,                           -- base64, xóa khi đã nghe xong
  status      TEXT NOT NULL DEFAULT 'queued', -- queued | taken | done | error
  text        TEXT,
  error       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_agent_stt_jobs_status ON agent_stt_jobs (status, id);

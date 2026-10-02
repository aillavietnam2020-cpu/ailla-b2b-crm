-- Migration 0009: hàng việc gửi sang Worker dựng video (máy tính ở văn phòng).
--
-- Worker chạy trên máy chị, web không gọi thẳng vào được, nên Worker tự hỏi web mỗi 15 giây:
-- lấy việc mới (status 'queued' → 'taken') rồi gửi tiến độ, kết quả phân tích, link video lên lại.
-- kind: 'win_analyze' (Hypit phân tích video win, tạo biến thể) · 'win_approve' (duyệt biến thể, dựng)
--       · 'win_fix' (yêu cầu Hypit làm lại theo góp ý).

CREATE TABLE worker_tasks (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('win_analyze', 'win_approve', 'win_fix')),
  ref         TEXT,                        -- mã video win bên web (hoặc mã việc phân tích gốc)
  payload     TEXT NOT NULL,               -- JSON: link, sản phẩm, số biến thể, kịch bản đã sửa...
  status      TEXT NOT NULL DEFAULT 'queued',
  progress    INTEGER NOT NULL DEFAULT 0,
  detail      TEXT,
  worker_job  TEXT,                        -- mã order bên Worker (WIN-xxx)
  result      TEXT,                        -- JSON: phân tích, biến thể, video con, link Drive
  created_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX ix_worker_tasks_status ON worker_tasks (status, created_at);

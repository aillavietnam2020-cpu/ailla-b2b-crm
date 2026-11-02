-- Task giao việc (chị Hoa 02/11): ảnh / file đính kèm của việc (brief người giao gửi, kết quả người làm nộp).
-- Lưu thẳng trong D1 vì R2 chưa bật; mỗi file ≤ 1,5 MB (ảnh to được thu nhỏ ở trình duyệt trước khi gửi).
CREATE TABLE task_files (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);
CREATE INDEX ix_task_files_task ON task_files (task_id);

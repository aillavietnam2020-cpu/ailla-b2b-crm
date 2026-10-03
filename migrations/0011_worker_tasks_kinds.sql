-- Migration 0011: bỏ giới hạn loại việc trong bảng worker_tasks.
--
-- Bảng cũ chỉ cho 3 loại việc ('win_analyze', 'win_approve', 'win_fix') nên các loại thêm sau
-- (duyệt / sửa video con Hypit, việc dựng cho thẻ video Marketing) bị cơ sở dữ liệu từ chối.
-- Loại việc hợp lệ giờ do máy chủ kiểm tra (KINDS trong src/server/routes/worker.ts).
-- SQLite không sửa được CHECK nên tạo bảng mới, chép dữ liệu, đổi tên.

CREATE TABLE worker_tasks_new (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,               -- loại việc, máy chủ kiểm tra theo danh sách KINDS
  ref         TEXT,                        -- mã video win / mã thẻ video bên web (hoặc mã việc gốc)
  payload     TEXT NOT NULL,               -- JSON: tham số gửi Worker
  status      TEXT NOT NULL DEFAULT 'queued',
  progress    INTEGER NOT NULL DEFAULT 0,
  detail      TEXT,
  worker_job  TEXT,                        -- mã order bên Worker
  result      TEXT,                        -- JSON: kết quả, link Drive
  created_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

INSERT INTO worker_tasks_new (id, kind, ref, payload, status, progress, detail, worker_job, result, created_by, created_at, updated_at)
  SELECT id, kind, ref, payload, status, progress, detail, worker_job, result, created_by, created_at, updated_at FROM worker_tasks;

DROP TABLE worker_tasks;
ALTER TABLE worker_tasks_new RENAME TO worker_tasks;

CREATE INDEX ix_worker_tasks_status ON worker_tasks (status, created_at);
CREATE INDEX ix_worker_tasks_ref ON worker_tasks (ref);

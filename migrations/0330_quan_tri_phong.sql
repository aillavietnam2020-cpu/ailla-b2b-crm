-- Quản trị phòng ban (CEO duyệt demo 14/11/2026, đợt 1): Lead tự quản nhân sự phòng mình.
-- Chỉ thêm bảng mới, không đụng dữ liệu cũ.

-- Đề nghị thêm người mới: Lead gửi, HCNS (hoặc CEO) duyệt thì web tạo tài khoản đăng nhập.
-- HCNS tự thêm người thì ghi luôn một dòng đã duyệt (để máy chủ cho gắn tài khoản vừa tạo vào bản chung).
CREATE TABLE IF NOT EXISTS qtpb_requests (
  id TEXT PRIMARY KEY,
  dept TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  title TEXT,
  cap TEXT,
  start_date TEXT,
  kind TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
  by_id TEXT NOT NULL,
  by_name TEXT,
  by_role TEXT,            -- 'lead' | 'hr' | 'ceo'
  decided_by TEXT,
  decided_name TEXT,
  decided_at TEXT,
  reason TEXT,
  crm_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_qtpb_requests_status ON qtpb_requests (status, dept);

-- Nhật ký thay đổi của Lead (quyền, khóa người nghỉ, menu, mẫu quyền) và người mới; CEO / Quản lý hoàn tác được.
CREATE TABLE IF NOT EXISTS qtpb_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT,
  actor_role TEXT,
  dept TEXT NOT NULL,
  action TEXT NOT NULL,     -- perms | lock | menu | tpl | add
  target TEXT,
  target_name TEXT,
  summary TEXT,
  before_json TEXT,
  after_json TEXT,
  undone_at TEXT,
  undone_by TEXT,
  undone_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_qtpb_log_dept ON qtpb_log (dept, at);

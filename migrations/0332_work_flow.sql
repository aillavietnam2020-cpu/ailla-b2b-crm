-- Quản trị phòng ban: Work Flow như demo CEO duyệt (14/11/2026).
-- Lead đặt các bước duyệt của phòng (Lead hoặc một nhân viên trong phòng duyệt, hạn từng bước, quá hạn thì nhắc / báo Lead / báo CEO).
-- Chỉ thêm cột / bảng mới, không đụng dữ liệu cũ.

-- Bước đang ở của đơn trong các bước Lead đặt (JSON {i, at, log}); NULL = đang ở bước đầu.
ALTER TABLE ns_don ADD COLUMN wfi TEXT;
ALTER TABLE dd_mua ADD COLUMN wfi TEXT;
ALTER TABLE dd_mau ADD COLUMN wfi TEXT;

-- Đã nhắc ai, bước nào (để máy chủ không nhắc lặp mỗi 15 phút).
CREATE TABLE IF NOT EXISTS qtpb_flow_rem (
  key TEXT PRIMARY KEY,
  at TEXT NOT NULL
);

-- Đề xuất theo Work Flow Lead tạo mới từ mẫu (duyệt bài đăng Fanpage, xin booking KOC, báo cáo tuần…).
CREATE TABLE IF NOT EXISTS qtpb_flow_items (
  id TEXT PRIMARY KEY,
  dept TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  flow_ten TEXT,
  tieu_de TEXT NOT NULL,
  noi_dung TEXT,
  link TEXT,
  by_id TEXT NOT NULL,      -- hub user id người gửi
  by_crm TEXT,
  by_name TEXT,
  st TEXT NOT NULL DEFAULT 'cho', -- cho | xong | tl | huy
  wfi TEXT,                 -- {steps, i, at, log}
  ly_do TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_qtpb_flow_items ON qtpb_flow_items (dept, st);

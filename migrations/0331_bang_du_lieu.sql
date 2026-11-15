-- Quản trị phòng ban đợt 3 (CEO duyệt demo 14/11/2026): Bảng dữ liệu Lead tự tạo trên web.
-- Bảng biểu của phòng (kho ý tưởng hook, booking KOC, hàng mẫu, lịch livestream…), KHÔNG phải chỗ để file.
-- Chỉ thêm bảng mới, không đụng dữ liệu cũ. Xóa bảng / dòng là xóa mềm (deleted_at) để CEO, Quản lý hoàn tác được.

CREATE TABLE IF NOT EXISTS qtpb_tables (
  id TEXT PRIMARY KEY,
  dept TEXT NOT NULL,
  name TEXT NOT NULL,
  def_json TEXT NOT NULL,      -- cột, chỉ số tự tính, ai xem, ai sửa, cột chia thẻ
  created_by TEXT,
  created_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_qtpb_tables_dept ON qtpb_tables (dept, deleted_at);

CREATE TABLE IF NOT EXISTS qtpb_rows (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  by_id TEXT,                  -- hub user id người thêm dòng
  by_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_name TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_qtpb_rows_table ON qtpb_rows (table_id, deleted_at);

-- Pha chế (chị Hoa duyệt demo 07/11/2026): yêu cầu pha chế, công thức của Kỹ thuật, báo tồn tại xưởng.
-- Chỉ thêm bảng, không đụng dữ liệu cũ. Yêu cầu cũ trong ngăn Sản xuất (pcReq) được chép sang lần đầu mở trang.

-- Yêu cầu pha chế: mỗi yêu cầu một dòng. "Đã pha" không lưu ở đây mà suy ra từ phiếu pha chế (kho_docs type PC, ref_no = id).
CREATE TABLE IF NOT EXISTS pc_req (
  id            TEXT PRIMARY KEY,          -- YCPCyymm-nnn
  btp           TEXT NOT NULL,             -- mã bán thành phẩm
  lit           REAL NOT NULL,             -- tổng số lít cần pha
  lit_bon       REAL,
  bon           REAL NOT NULL DEFAULT 1,
  ngay          TEXT NOT NULL,             -- ngày tạo (YYYY-MM-DD)
  han           TEXT,                      -- hạn cần (YYYY-MM-DD)
  ghi_chu       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'CHO_LAM' CHECK (status IN ('CHO_LAM', 'HUY')),
  created_by    TEXT,
  created_by_name TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  huy_by_name   TEXT,
  ly_do_huy     TEXT,
  huy_at        TEXT,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pc_req_status ON pc_req (status, ngay);

-- Công thức pha (cho 1 lít bán thành phẩm). Mỗi lần thêm / điều chỉnh là một bản mới, bản cũ giữ làm lịch sử.
-- status: CHO (chờ Trưởng kỹ thuật duyệt) · OK (đang dùng) · CU (bản cũ, đã thay) · TRA (bị trả lại).
CREATE TABLE IF NOT EXISTS pc_recipe (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  btp           TEXT NOT NULL,
  version       INTEGER NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('CHO', 'OK', 'CU', 'TRA')),
  lines         TEXT NOT NULL,             -- JSON [{item, qty}] số cho 1 lít
  huong_dan     TEXT NOT NULL DEFAULT '',  -- hướng dẫn pha chế
  ly_do         TEXT NOT NULL DEFAULT '',  -- lý do thêm / điều chỉnh
  created_by    TEXT,
  created_by_name TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  approved_by_name TEXT,
  approved_at   TEXT,
  tu_duyet      INTEGER NOT NULL DEFAULT 0, -- 1 = Trưởng kỹ thuật tự nhập, không cần duyệt
  tra_ly_do     TEXT,
  effective_at  TEXT                        -- lúc bắt đầu dùng
);
CREATE INDEX IF NOT EXISTS ix_pc_recipe_btp ON pc_recipe (btp, status, version);

-- Báo tồn tại xưởng: Kỹ thuật đếm nguyên liệu. Chỉ để báo đặt hàng / lệch kho, KHÔNG sửa sổ kho.
CREATE TABLE IF NOT EXISTS pc_count (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lines         TEXT NOT NULL,             -- JSON [{item, name, unit, web, dem, min, dat, lech}]
  note          TEXT NOT NULL DEFAULT '',
  created_by    TEXT,
  created_by_name TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);

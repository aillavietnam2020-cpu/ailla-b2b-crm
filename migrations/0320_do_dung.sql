-- Đồ dùng văn phòng & nhà máy (chị Hoa duyệt demo 11/11/2026): thiết bị quay, công cụ dụng cụ, hàng mẫu, đồ tiêu hao.
-- HCNS quản lý. Xem theo nơi: vp (Văn phòng) | nm (Nhà máy). Chỉ thêm bảng mới.

-- Danh mục đồ. Hàng mẫu gắn mã kho thành phẩm (kho_code). ts_ma: mã ở Sổ công cụ dụng cụ của kế toán (nếu có).
CREATE TABLE IF NOT EXISTS dd_item (
  id TEXT PRIMARY KEY,
  ma TEXT NOT NULL UNIQUE,
  ten TEXT NOT NULL,
  loai TEXT NOT NULL CHECK (loai IN ('tb','cc','mau','th')),
  dvt TEXT NOT NULL DEFAULT 'cái',
  kho_code TEXT,
  ts_ma TEXT,
  gia INTEGER NOT NULL DEFAULT 0,
  min_vp REAL NOT NULL DEFAULT 0,
  min_nm REAL NOT NULL DEFAULT 0,
  cho_vp TEXT NOT NULL DEFAULT '',
  cho_nm TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  ghi_chu TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Sổ đồ dùng: mỗi lần tăng / giảm trên kệ của một nơi. Tồn trên kệ = tổng qty theo (item, noi).
-- kind: dau (khai báo / thêm), kk (kiểm kê chênh), giao (giao đi mượn / lấy dùng), tra (trả lại), hong (hỏng / mất, bỏ khỏi kệ),
--       mau (hàng mẫu kho thành phẩm xuất về), mua (mua về).
CREATE TABLE IF NOT EXISTS dd_move (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES dd_item(id),
  noi TEXT NOT NULL CHECK (noi IN ('vp','nm')),
  qty REAL NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('dau','kk','giao','tra','hong','mau','mua')),
  ref TEXT,
  ngay TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  by_id TEXT,
  by_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dd_move_item ON dd_move (item_id, noi);
CREATE INDEX IF NOT EXISTS idx_dd_move_ref ON dd_move (ref);

-- Phiếu lấy đồ (đi quay hoặc dùng việc khác). Ký mượn / trả bằng bấm xác nhận trên web (chị Hoa chốt 11/11):
-- cho (người lấy gửi) → dang (HCNS giao; người lấy bấm "Đã nhận" = ky_nhan_at) → tra_cho (người lấy khai trả) → tra (HCNS nhận lại) | huy.
CREATE TABLE IF NOT EXISTS dd_lay (
  id TEXT PRIMARY KEY,
  noi TEXT NOT NULL CHECK (noi IN ('vp','nm')),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  shoot_id TEXT,
  shoot_txt TEXT NOT NULL DEFAULT '',
  muc_dich TEXT NOT NULL DEFAULT '',
  han TEXT,
  st TEXT NOT NULL CHECK (st IN ('cho','dang','tra_cho','tra','huy')),
  giao_by TEXT, giao_name TEXT, giao_at TEXT,
  ky_nhan_at TEXT,
  tra_khai_at TEXT,
  tra_by TEXT, tra_name TEXT, tra_at TEXT,
  ly_do_huy TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dd_lay_st ON dd_lay (st);
CREATE INDEX IF NOT EXISTS idx_dd_lay_user ON dd_lay (user_id);

CREATE TABLE IF NOT EXISTS dd_lay_line (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lay_id TEXT NOT NULL REFERENCES dd_lay(id),
  item_id TEXT NOT NULL REFERENCES dd_item(id),
  sl REAL NOT NULL,
  tra REAL,
  dung REAL,
  tinh TEXT,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_dd_lay_line ON dd_lay_line (lay_id);

-- Yêu cầu hàng mẫu từ xưởng: lead (chờ Lead phòng duyệt) → kho (chờ kho thành phẩm xuất; xuất = phiếu XK ref_no = id)
-- → xong (HCNS nhận về, tồn nơi nhận tăng) | tl (trả lại) | huy.
CREATE TABLE IF NOT EXISTS dd_mau (
  id TEXT PRIMARY KEY,
  noi TEXT NOT NULL CHECK (noi IN ('vp','nm')),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  pb TEXT NOT NULL DEFAULT '',
  kho_code TEXT NOT NULL,
  sl REAL NOT NULL,
  shoot_id TEXT,
  shoot_txt TEXT NOT NULL DEFAULT '',
  can_ngay TEXT,
  ghi_chu TEXT NOT NULL DEFAULT '',
  st TEXT NOT NULL CHECK (st IN ('lead','kho','xong','tl','huy')),
  lead_by TEXT, lead_name TEXT, lead_at TEXT,
  nhan_by TEXT, nhan_name TEXT, nhan_at TEXT, nhan_sl REAL,
  ly_do TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dd_mau_st ON dd_mau (st);

-- Đề nghị mua đồ dùng: lead (Lead phòng duyệt) → ql (Quản lý mua hàng duyệt) → mua (chờ mua) → xong (mua về, nhập tồn,
-- phiếu chi nháp vào Sổ chi phí) | tl | huy. Khoản chi từ ngưỡng CEO duyệt ở phiếu chi như cũ.
CREATE TABLE IF NOT EXISTS dd_mua (
  id TEXT PRIMARY KEY,
  noi TEXT NOT NULL CHECK (noi IN ('vp','nm')),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  pb TEXT NOT NULL DEFAULT '',
  item_id TEXT,
  ten TEXT NOT NULL,
  loai TEXT NOT NULL DEFAULT 'th',
  sl REAL NOT NULL,
  dvt TEXT NOT NULL DEFAULT 'cái',
  gia INTEGER NOT NULL DEFAULT 0,
  ly_do TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  st TEXT NOT NULL CHECK (st IN ('lead','ql','mua','xong','tl','huy')),
  lead_by TEXT, lead_name TEXT, lead_at TEXT,
  ql_by TEXT, ql_name TEXT, ql_at TEXT,
  thuc_sl REAL, thuc_tien INTEGER, tra_bang TEXT, ngay_mua TEXT, pc_id TEXT,
  xong_by TEXT, xong_name TEXT, xong_at TEXT,
  ly_do_tl TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dd_mua_st ON dd_mua (st);

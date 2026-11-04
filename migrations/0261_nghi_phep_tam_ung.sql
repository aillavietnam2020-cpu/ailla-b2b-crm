-- Nghỉ phép & tăng ca, tạm ứng lương, phiếu lương của tôi (chị Hoa duyệt demo 04/11/2026).
-- Đơn lưu riêng trên máy chủ (trước đây nằm trong dữ liệu chung hub_state.hr.don), máy chủ kiểm ai được duyệt.

-- Đơn nghỉ phép / ốm / không lương / xin về sớm, đến muộn / tăng ca.
-- st: 'lead' chờ Lead duyệt, 'hcns' chờ HCNS duyệt vòng 2, 'xong' đã duyệt, 'tuchoi', 'huy' (người gửi rút lại).
-- buoi: 'ca' cả ngày, 'sang' buổi sáng, 'chieu' buổi chiều. so_ngay: số ngày làm việc tính theo lịch làm của người gửi.
-- gio: số giờ tăng ca (loai 'ot'). ghi_chu: giờ về sớm / đến muộn (loai 'vesom').
CREATE TABLE ns_don (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pb TEXT,
  loai TEXT NOT NULL CHECK (loai IN ('phep', 'om', 'khongluong', 'vesom', 'ot')),
  tu TEXT NOT NULL,
  den TEXT NOT NULL,
  buoi TEXT NOT NULL DEFAULT 'ca',
  so_ngay REAL NOT NULL DEFAULT 0,
  gio REAL,
  ghi_chu TEXT,
  ly_do TEXT NOT NULL,
  st TEXT NOT NULL CHECK (st IN ('lead', 'hcns', 'xong', 'tuchoi', 'huy')),
  lead_id TEXT,
  lead_at TEXT,
  hcns_id TEXT,
  hcns_at TEXT,
  tu_choi TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_ns_don_user ON ns_don (user_id, tu);
CREATE INDEX idx_ns_don_st ON ns_don (st);
CREATE INDEX idx_ns_don_tu ON ns_don (tu);

-- Đề nghị tạm ứng lương: Kế toán duyệt; ky = tháng trừ vào lương 'YYYY-MM'. Mức tối đa là ô điền trong cài đặt.
CREATE TABLE ns_tamung (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  so_tien INTEGER NOT NULL,
  ly_do TEXT NOT NULL,
  ky TEXT NOT NULL,
  st TEXT NOT NULL CHECK (st IN ('kt', 'xong', 'tuchoi', 'huy')),
  kt_id TEXT,
  kt_at TEXT,
  tu_choi TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_ns_tamung_user ON ns_tamung (user_id, ky);
CREATE INDEX idx_ns_tamung_st ON ns_tamung (st, ky);

-- Phiếu lương của tôi: ai đã xem kỳ nào, và câu hỏi gửi HCNS.
CREATE TABLE ns_pl_xem (
  user_id TEXT NOT NULL,
  ky TEXT NOT NULL,
  xem_at TEXT NOT NULL,
  PRIMARY KEY (user_id, ky)
);
CREATE TABLE ns_pl_hoi (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ky TEXT NOT NULL,
  noi_dung TEXT NOT NULL,
  tra_loi TEXT,
  tra_loi_by TEXT,
  tra_loi_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ns_pl_hoi_ky ON ns_pl_hoi (ky);

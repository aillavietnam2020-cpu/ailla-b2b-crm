-- Chấm công trên điện thoại (chị Hoa duyệt 04/11/2026). Mỗi lần bấm Chấm vào / Chấm ra là một dòng.
-- ngay: ngày theo giờ Việt Nam 'YYYY-MM-DD'; at: giờ máy chủ (UTC ISO), không lấy giờ điện thoại.
-- ly_do: lý do chấm ngoài phạm vi (chỉ lịch được phép, ví dụ Sale); ly_do_muon: lý do đi muộn quá 10 phút (không bắt buộc, bỏ trống thì cảnh báo).
-- kc: mét tới điểm chấm gần nhất; trong: 1 trong phạm vi, 0 ngoài phạm vi (phải ghi lý do), NULL khi chưa cài điểm chấm.
-- Cài đặt (điểm chấm, giờ làm, phút ân hạn, thứ Bảy) để trong hub_blobs key 'cc_caidat'.
CREATE TABLE cc_luot (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ngay TEXT NOT NULL,
  loai TEXT NOT NULL CHECK (loai IN ('vao', 'ra')),
  at TEXT NOT NULL,
  lat REAL,
  lng REAL,
  acc REAL,
  kc REAL,
  diem TEXT,
  trong INTEGER,
  ly_do TEXT,
  ly_do_muon TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_cc_luot_user_ngay ON cc_luot (user_id, ngay);
CREATE INDEX idx_cc_luot_ngay ON cc_luot (ngay);

-- Xếp ca (người làm theo ca, ví dụ team live): mỗi người mỗi ngày một ca; ca_id trỏ tới danh sách ca trong 'cc_caidat'.
CREATE TABLE cc_xepca (
  user_id TEXT NOT NULL,
  ngay TEXT NOT NULL,
  ca_id TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, ngay)
);
CREATE INDEX idx_cc_xepca_ngay ON cc_xepca (ngay);

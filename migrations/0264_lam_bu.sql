-- Đơn xin làm bù (CEO duyệt demo 06/11/2026): bù theo ngày (ngày không chấm, nghỉ không lương) hoặc theo giờ (đi muộn, về sớm).
-- Loại đơn mới 'lambu': tu = den = ngày làm bù. bu_ngay: ngày được bù. bu_kieu: 'ngay' | 'gio'.
-- Bù ngày: buoi = cả ngày / buổi sáng / buổi chiều. Bù giờ: bu_tu, bu_den (giờ 'HH:MM' làm bù), bu_phut = số phút cần bù.
-- SQLite không sửa được CHECK nên dựng lại bảng ns_don, giữ nguyên dữ liệu.
CREATE TABLE ns_don_moi (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pb TEXT,
  loai TEXT NOT NULL CHECK (loai IN ('phep', 'om', 'khongluong', 'vesom', 'ot', 'lambu')),
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
  updated_at TEXT NOT NULL,
  bu_ngay TEXT,
  bu_kieu TEXT,
  bu_tu TEXT,
  bu_den TEXT,
  bu_phut INTEGER
);
INSERT INTO ns_don_moi (id, user_id, pb, loai, tu, den, buoi, so_ngay, gio, ghi_chu, ly_do, st, lead_id, lead_at, hcns_id, hcns_at, tu_choi, created_at, updated_at)
  SELECT id, user_id, pb, loai, tu, den, buoi, so_ngay, gio, ghi_chu, ly_do, st, lead_id, lead_at, hcns_id, hcns_at, tu_choi, created_at, updated_at FROM ns_don;
DROP TABLE ns_don;
ALTER TABLE ns_don_moi RENAME TO ns_don;
CREATE INDEX idx_ns_don_user ON ns_don (user_id, tu);
CREATE INDEX idx_ns_don_st ON ns_don (st);
CREATE INDEX idx_ns_don_bu ON ns_don (loai, bu_ngay);

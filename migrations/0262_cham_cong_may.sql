-- Nạp file máy chấm công (máy văn phòng, máy xưởng) — chị Hoa gửi file mẫu tháng 9/2026, duyệt 04/11/2026.
-- Mỗi máy đánh mã riêng (hai máy có thể trùng mã) nên khóa theo (may, ma).
-- cc_may: một dòng mỗi người mỗi ngày theo máy; gio = mảng JSON các giờ chấm 'HH:MM' (giờ Việt Nam) theo thứ tự.
CREATE TABLE cc_may (
  may TEXT NOT NULL,
  ma TEXT NOT NULL,
  ngay TEXT NOT NULL,
  gio TEXT NOT NULL DEFAULT '[]',
  ky_hieu TEXT,
  nap_at TEXT NOT NULL,
  PRIMARY KEY (may, ma, ngay)
);
CREATE INDEX idx_cc_may_ngay ON cc_may (ngay);

-- Ghép mã trên máy với tài khoản trên web (HCNS làm một lần). user_id '' = bỏ qua mã này.
CREATE TABLE cc_may_map (
  may TEXT NOT NULL,
  ma TEXT NOT NULL,
  ten TEXT,
  user_id TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (may, ma)
);

-- Phiếu pha chế NHÁP (16/11/2026, chị Hoa đồng ý cho agent Kế toán trưởng nhập phiếu pha chế).
-- Agent (ghi thay người được chỉ định) chỉ lập nháp ở đây; Kỹ thuật pha chế kiểm rồi bấm Ghi phiếu trên web mới thành phiếu kho (kho_docs type PC).
-- Chỉ thêm bảng, không đụng dữ liệu cũ.
CREATE TABLE IF NOT EXISTS pc_nhap (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no        TEXT NOT NULL DEFAULT '',   -- mã yêu cầu pha chế (YCPC…) nếu có
  btp           TEXT NOT NULL,
  ngay          TEXT NOT NULL,              -- ngày pha (YYYY-MM-DD)
  lit_bon       REAL NOT NULL,
  bon           REAL NOT NULL DEFAULT 1,
  liters        REAL NOT NULL,              -- tổng lít thu được = lit_bon × bon
  nguoi         TEXT NOT NULL DEFAULT '[]', -- JSON tên người pha
  lines         TEXT NOT NULL,              -- JSON [{item, qty, std_qty}] số thực tế + số theo công thức
  ct_version    INTEGER,
  ly_do_lech    TEXT NOT NULL DEFAULT '',
  ghi_chu       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'CHO' CHECK (status IN ('CHO', 'DA_GHI', 'HUY')),
  created_by    TEXT,                       -- người ra lệnh (agent ghi thay)
  created_by_name TEXT NOT NULL DEFAULT '',
  agent_name    TEXT,                       -- agent lập (nếu có)
  created_at    TEXT NOT NULL,
  doc_id        INTEGER,                    -- phiếu kho đã ghi từ nháp này
  doc_no        TEXT,
  xu_ly_by_name TEXT,
  xu_ly_at      TEXT,
  ly_do_huy     TEXT
);
CREATE INDEX IF NOT EXISTS ix_pc_nhap_status ON pc_nhap (status, created_at);

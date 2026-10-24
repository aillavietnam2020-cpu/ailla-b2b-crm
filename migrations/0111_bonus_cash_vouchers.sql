-- Phiếu chi thưởng NPP bằng tiền (chuyển khoản / tiền mặt). Kế toán lập, quản lý điều phối hoặc CEO duyệt.
-- Chỉ chi tối đa bằng "còn phải chi" của khách trong tháng (thưởng đạt được - đã trừ thẳng vào đơn - đã chi / đang chờ duyệt).
CREATE TABLE bonus_cash_vouchers (
  id            TEXT PRIMARY KEY,
  voucher_no    TEXT NOT NULL UNIQUE,
  customer_id   TEXT NOT NULL REFERENCES customers (id),
  month         TEXT NOT NULL,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  method        TEXT NOT NULL DEFAULT 'CHUYEN_KHOAN' CHECK (method IN ('TIEN_MAT', 'CHUYEN_KHOAN', 'KHAC')),
  note          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'CHO_DUYET' CHECK (status IN ('CHO_DUYET', 'DA_CHI', 'HUY')),
  created_by    TEXT REFERENCES users (id),
  created_at    TEXT NOT NULL,
  approved_by   TEXT REFERENCES users (id),
  approved_at   TEXT,
  cancel_reason TEXT,
  cancelled_by  TEXT REFERENCES users (id),
  cancelled_at  TEXT
);
CREATE INDEX ix_bonus_cash_customer ON bonus_cash_vouchers (customer_id, month, status);

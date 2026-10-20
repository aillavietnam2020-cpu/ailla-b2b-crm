-- Sổ phiếu chi vận chuyển: chi phí công ty trả cho xe / đơn vị vận chuyển (một xe có thể chở nhiều đơn NPP).
-- Chỉ là sổ chứng từ chi: KHÔNG gắn vào từng đơn, KHÔNG chia theo đơn (chị Hoa chốt 14/10). Cột order_refs chỉ để
-- ghi chú các mã đơn xe đó chở cho dễ tra cứu, không ràng buộc.
CREATE TABLE shipping_vouchers (
  id            TEXT PRIMARY KEY,
  voucher_no    TEXT NOT NULL UNIQUE,
  voucher_date  TEXT NOT NULL,
  carrier       TEXT NOT NULL DEFAULT '',
  destination   TEXT NOT NULL DEFAULT '',
  amount        INTEGER NOT NULL CHECK (amount > 0),
  method        TEXT NOT NULL DEFAULT 'TIEN_MAT' CHECK (method IN ('TIEN_MAT', 'CHUYEN_KHOAN', 'KHAC')),
  order_refs    TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'OK' CHECK (status IN ('OK', 'HUY')),
  created_by    TEXT REFERENCES users (id),
  created_at    TEXT NOT NULL,
  cancelled_by  TEXT REFERENCES users (id),
  cancelled_at  TEXT,
  cancel_reason TEXT
);
CREATE INDEX ix_shipping_vouchers_date ON shipping_vouchers (voucher_date, status);

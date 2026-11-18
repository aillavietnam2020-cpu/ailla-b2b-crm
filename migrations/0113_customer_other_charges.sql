-- Thu nhập khác ghi vào công nợ khách (chị Hoa 18/11/2026): khoản khách phải trả ngoài tiền hàng, ví dụ tiền thuế VAT khi
-- khách lấy hóa đơn (MISA hạch toán Nợ 131 / Có 711). Cộng vào công nợ khách, KHÔNG tính vào doanh thu bán hàng.
CREATE TABLE IF NOT EXISTS customer_other_charges (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  charge_date TEXT NOT NULL,          -- ngày chứng từ (YYYY-MM-DD)
  amount      INTEGER NOT NULL,       -- đồng; dương = khách nợ thêm
  description TEXT NOT NULL,          -- khoản gì (bắt buộc)
  doc_no      TEXT,                   -- số chứng từ MISA nếu có
  created_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL,
  deleted_at  TEXT,
  deleted_by  TEXT,
  delete_reason TEXT
);
CREATE INDEX IF NOT EXISTS ix_customer_other_charges_customer ON customer_other_charges (customer_id, deleted_at);

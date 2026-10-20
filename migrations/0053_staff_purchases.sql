-- Nhân viên mua hàng công ty, cuối tháng trừ lương: khách cấp "Nhân viên" gắn với mã nhân sự (staff_code = Mã NS trong HR MASTER).
ALTER TABLE customers ADD COLUMN staff_code TEXT;
CREATE INDEX ix_customers_staff_code ON customers (staff_code);

-- Số tiền đã chốt trừ lương theo tháng / nhân viên (để không chốt trùng và phiếu lương đọc lại).
CREATE TABLE staff_deductions (
  month      TEXT NOT NULL,             -- YYYY-MM
  staff_code TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  amount     INTEGER NOT NULL DEFAULT 0,
  closed_by  TEXT REFERENCES users (id),
  closed_at  TEXT NOT NULL,
  PRIMARY KEY (month, staff_code)
);

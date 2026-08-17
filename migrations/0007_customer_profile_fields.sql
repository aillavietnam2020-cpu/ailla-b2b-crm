-- Migration 0007: bổ sung thông tin cơ bản của khách hàng.
--
-- File Excel có cột "Zalo / Facebook" và "Ghi chú / đặc điểm khách" nhưng hệ thống chưa có
-- chỗ lưu. Ngoài ra sale cần ngày sinh để chúc mừng và email để gửi báo giá/chính sách.

ALTER TABLE customers ADD COLUMN birthday TEXT;
ALTER TABLE customers ADD COLUMN zalo TEXT;
ALTER TABLE customers ADD COLUMN email TEXT;
ALTER TABLE customers ADD COLUMN note TEXT;
ALTER TABLE customers ADD COLUMN tax_code TEXT;
ALTER TABLE customers ADD COLUMN contact_person TEXT;

CREATE INDEX ix_customers_birthday ON customers (birthday);

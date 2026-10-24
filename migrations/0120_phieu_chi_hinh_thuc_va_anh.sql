-- Phiếu chi (trả nhà cung cấp và chi vận chuyển): ghi rõ chi tiền mặt hay chuyển khoản, chi từ tài khoản nào,
-- chuyển đến ngân hàng / số tài khoản / tên chủ tài khoản nào, người nhận tiền mặt; kèm ảnh bill chuyển khoản
-- hoặc ảnh phiếu chi tiền mặt có chữ ký. Nhà cung cấp nhớ thông tin ngân hàng để lần sau điền sẵn.
ALTER TABLE po_payments ADD COLUMN method TEXT NOT NULL DEFAULT '';
ALTER TABLE po_payments ADD COLUMN from_account TEXT NOT NULL DEFAULT '';
ALTER TABLE po_payments ADD COLUMN to_bank TEXT NOT NULL DEFAULT '';
ALTER TABLE po_payments ADD COLUMN to_account_no TEXT NOT NULL DEFAULT '';
ALTER TABLE po_payments ADD COLUMN to_account_name TEXT NOT NULL DEFAULT '';
ALTER TABLE po_payments ADD COLUMN receiver TEXT NOT NULL DEFAULT '';

ALTER TABLE shipping_vouchers ADD COLUMN from_account TEXT NOT NULL DEFAULT '';
ALTER TABLE shipping_vouchers ADD COLUMN to_bank TEXT NOT NULL DEFAULT '';
ALTER TABLE shipping_vouchers ADD COLUMN to_account_no TEXT NOT NULL DEFAULT '';
ALTER TABLE shipping_vouchers ADD COLUMN to_account_name TEXT NOT NULL DEFAULT '';
ALTER TABLE shipping_vouchers ADD COLUMN receiver TEXT NOT NULL DEFAULT '';

ALTER TABLE suppliers ADD COLUMN bank TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN bank_account_no TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN bank_account_name TEXT NOT NULL DEFAULT '';

CREATE TABLE pay_files (
  id          TEXT PRIMARY KEY,
  ref_type    TEXT NOT NULL CHECK (ref_type IN ('PO_PAY', 'SHIP_VC')),
  ref_id      TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL DEFAULT 0,
  data        TEXT NOT NULL,                -- base64 (ảnh đã nén ở trình duyệt trước khi tải lên)
  created_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_pay_files_ref ON pay_files (ref_type, ref_id);

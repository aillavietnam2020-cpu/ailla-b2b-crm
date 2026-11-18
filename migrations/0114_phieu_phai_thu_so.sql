-- Phiếu phải thu của khách (chị Hoa 18/11/2026): mỗi khoản thu nhập khác là một phiếu có số riêng PPT<yymm>-<stt>,
-- kế toán tạo, hiện như một chứng từ của khách (cạnh đơn hàng) và cộng vào công nợ. Chỉ thêm cột.
ALTER TABLE customer_other_charges ADD COLUMN voucher_no TEXT;
UPDATE customer_other_charges
SET voucher_no = (
  SELECT 'PPT' || substr(replace(x.charge_date, '-', ''), 3, 4) || '-' || substr('000' || x.rn, -3)
  FROM (SELECT id, charge_date,
               ROW_NUMBER() OVER (PARTITION BY substr(charge_date, 1, 7) ORDER BY created_at, id) AS rn
        FROM customer_other_charges) x
  WHERE x.id = customer_other_charges.id
)
WHERE voucher_no IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_other_charges_voucher ON customer_other_charges (voucher_no);

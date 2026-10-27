-- Khoản chi từ ngưỡng (mặc định 5.000.000đ, đổi ở Ngưỡng cảnh báo) phải CEO duyệt (chị Hoa chốt 27/10/2026).
-- ceo_status: '' = không cần (khoản dưới ngưỡng, khoản CEO tự lập, mọi khoản cũ trước hôm nay) · 'CHO' = chờ CEO · 'DUYET' = CEO đã duyệt.
-- Chỉ thêm cột; dữ liệu cũ để '' nên không phải duyệt lại.
ALTER TABLE shipping_vouchers ADD COLUMN ceo_status TEXT NOT NULL DEFAULT '';
ALTER TABLE shipping_vouchers ADD COLUMN ceo_by TEXT;
ALTER TABLE shipping_vouchers ADD COLUMN ceo_at TEXT;

ALTER TABLE po_payments ADD COLUMN ceo_status TEXT NOT NULL DEFAULT '';
ALTER TABLE po_payments ADD COLUMN ceo_by TEXT;
ALTER TABLE po_payments ADD COLUMN ceo_at TEXT;

-- Phiếu chi thưởng NPP: quản lý duyệt trước (pre_by), khoản từ ngưỡng chờ CEO duyệt mới thành "đã chi".
ALTER TABLE bonus_cash_vouchers ADD COLUMN ceo_status TEXT NOT NULL DEFAULT '';
ALTER TABLE bonus_cash_vouchers ADD COLUMN pre_by TEXT;
ALTER TABLE bonus_cash_vouchers ADD COLUMN pre_at TEXT;

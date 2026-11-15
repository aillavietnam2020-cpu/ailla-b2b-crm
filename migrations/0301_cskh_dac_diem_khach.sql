-- CSKH khách lẻ (chị Hoa 10/11/2026): đặc điểm khách, hạng gán tay, ngừng chăm sóc. Chỉ thêm cột.
-- tags = các đặc điểm (có con nhỏ, dễ tính, cả nể...) nối bằng dấu "|".
ALTER TABLE cskh_customers ADD COLUMN tags TEXT NOT NULL DEFAULT '';
-- Hạng gán tay (VIP, VVIP...). Trống = web tự xếp theo số đơn / tổng mua ở Cài đặt.
ALTER TABLE cskh_customers ADD COLUMN tier_manual TEXT NOT NULL DEFAULT '';
-- Ngừng chăm sóc: lý do khác rỗng = khách ra khỏi Việc hôm nay, không chia, Lead / CEO cho chăm sóc lại được.
ALTER TABLE cskh_customers ADD COLUMN stop_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE cskh_customers ADD COLUMN stop_note TEXT NOT NULL DEFAULT '';
ALTER TABLE cskh_customers ADD COLUMN stop_at TEXT;
ALTER TABLE cskh_customers ADD COLUMN stop_by TEXT NOT NULL DEFAULT '';

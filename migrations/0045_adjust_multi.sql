-- Giá điều chỉnh: chọn NHIỀU mã / NHIỀU nhóm, và LOẠI TRỪ một số mã khỏi phạm vi nhóm hoặc "mọi sản phẩm".
-- Cột product_id / group_id cũ giữ nguyên (điều chỉnh tạo trước đây vẫn chạy).
ALTER TABLE price_adjustments ADD COLUMN product_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE price_adjustments ADD COLUMN group_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE price_adjustments ADD COLUMN exclude_ids TEXT NOT NULL DEFAULT '[]';

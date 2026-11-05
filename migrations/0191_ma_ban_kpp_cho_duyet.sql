-- Mã bán Kênh phân phối cho hàng hóa / quà chưa có mã (chị Hoa giao 05/11/2026).
-- Web tự đề xuất mã (QUA-<mã kho>); Trưởng phòng tạo thì duyệt luôn, sale tạo khi lên đơn thì vẫn bán được nhưng chờ Trưởng phòng duyệt mã.
-- Chỉ THÊM cột vào products:
--   code_status : '' = mã đã duyệt (mọi sản phẩm đang có) | 'CHO_DUYET' = mã do web đề xuất, chờ Trưởng phòng duyệt
--   code_by     : người tạo mã (users.id)
ALTER TABLE products ADD COLUMN code_status TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN code_by TEXT;

-- Người xuất kho do nhân sự kho tự điền khi xác nhận xuất (và sửa được sau), kèm ngày xuất do người xác nhận chọn.
ALTER TABLE orders ADD COLUMN shipped_by_name TEXT;

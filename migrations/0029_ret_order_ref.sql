-- Gói hoàn chưa tra ra đơn: kế toán tra trên seller rồi điền mã đơn vào đây (chờ Poscake cập nhật thì web tự gắn).
ALTER TABLE ret_scans ADD COLUMN order_ref TEXT NOT NULL DEFAULT '';

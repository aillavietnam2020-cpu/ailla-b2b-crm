-- Đơn được tự xác nhận kế toán khi kho xác nhận xuất / giao (hoặc khi sale chốt tiền): cho phép sale sửa đơn khi kho xuất sai.
-- Kế toán bấm xác nhận bằng tay thì cờ này về 0 và đơn khoá như cũ.
ALTER TABLE orders ADD COLUMN accounting_auto INTEGER NOT NULL DEFAULT 0;

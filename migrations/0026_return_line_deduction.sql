-- Phiếu trả hàng: khấu trừ từng dòng (phí, hàng lỗi trừ bớt...). Giảm nợ = SL thực nhận × đơn giá − khấu trừ.
ALTER TABLE order_return_lines ADD COLUMN deduction INTEGER NOT NULL DEFAULT 0;

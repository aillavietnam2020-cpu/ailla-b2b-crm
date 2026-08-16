-- Migration 0004: ghi nhận BÚT TOÁN ĐẢO (khoản điều chỉnh giảm) trong thanh toán.
--
-- Lý do: file CRM thật có dòng thu -6.500.000đ ngày 12/08 huỷ đúng khoản thu 6.500.000đ
-- ngày 06/08 của cùng một đơn. Kế toán cần giữ nguyên cả hai dòng để lịch sử thu tiền khớp
-- sổ sách.
--
-- Cách làm: KHÔNG lưu số âm trong database (đúng tinh thần mục 9.2 "không dùng số âm để che
-- lỗi công nợ"). Thay vào đó số tiền luôn dương và cờ is_adjustment = 1 cho biết khoản này
-- TRỪ ĐI thay vì CỘNG VÀO. Mọi phép cộng tiền đều nhân dấu theo cờ này.
--
-- Cách này cũng tránh phải dựng lại bảng payments (D1 chặn vì ràng buộc khoá ngoại từ
-- payment_allocations và payment_allocations_pending).

ALTER TABLE payments ADD COLUMN is_adjustment INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN adjustment_reason TEXT;

CREATE INDEX ix_payments_adjustment ON payments (is_adjustment);

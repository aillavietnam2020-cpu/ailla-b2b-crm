-- Số đếm tồn đầu kỳ của vỏ (từ bảng đếm do kho / kế toán điền) và ghi chú đối chiếu ("thanh lý", "nên đổi mã"…).
-- Chỉ là tư liệu đối chiếu, KHÔNG phải tồn kho thật (tồn thật vẫn tính từ phiếu).
ALTER TABLE kho_vo ADD COLUMN count_qty REAL;
ALTER TABLE kho_vo ADD COLUMN check_note TEXT NOT NULL DEFAULT '';

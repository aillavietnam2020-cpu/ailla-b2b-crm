-- Mua hàng: ngày giao dự kiến + giá đặt trên phiếu mua; phiếu chi có loại (trả tiền / cọc) và gắn được vào phiếu mua.
ALTER TABLE po_orders ADD COLUMN expected_date TEXT;
ALTER TABLE po_lines ADD COLUMN unit_price REAL;
ALTER TABLE po_payments ADD COLUMN kind TEXT NOT NULL DEFAULT 'CHI';
ALTER TABLE po_payments ADD COLUMN po_id TEXT;

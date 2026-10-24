-- Cùng một sản phẩm: một phần bán, một phần tặng. Lưu MỘT dòng (kho chỉ thấy một mã, tổng số lượng) và ghi riêng số tặng.
-- qty = tổng số lượng (bán + tặng); line_total chỉ tính phần bán (qty - gift_qty).
ALTER TABLE order_items ADD COLUMN gift_qty INTEGER NOT NULL DEFAULT 0;

-- Phiếu trả hàng "hàng lỗi, không thu về, bù cho khách": không qua kho, đi thẳng sang kế toán xác nhận giảm công nợ / bù.
ALTER TABLE order_returns ADD COLUMN no_collect INTEGER NOT NULL DEFAULT 0;

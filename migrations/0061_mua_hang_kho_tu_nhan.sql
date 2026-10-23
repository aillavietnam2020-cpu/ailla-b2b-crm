-- Phiếu mua tự tạo khi kho nhận hàng không có phiếu đặt (ví dụ vỏ can): source = 'KHO'.
ALTER TABLE po_orders ADD COLUMN source TEXT NOT NULL DEFAULT 'PO';

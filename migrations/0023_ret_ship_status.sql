-- Trạng thái của đơn vị vận chuyển (partner.partner_status: returning, delivered, ...).
-- Facebook hay có đơn Poscake vẫn "Đang hoàn" nhưng vận chuyển đã giao trả về shop (delivered): cần kho kiểm tra.
ALTER TABLE ret_orders ADD COLUMN ship_status TEXT NOT NULL DEFAULT '';

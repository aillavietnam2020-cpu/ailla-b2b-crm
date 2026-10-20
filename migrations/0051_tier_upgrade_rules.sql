-- Điều kiện lên cấp giá: sale chỉ đưa khách lên cấp mới ngay trên đơn khi ĐƠN ĐÓ đạt mức tiền hàng tối thiểu của cấp mới.
-- Quản lý và CEO đổi cấp ở đâu cũng được, không bị ràng buộc bởi bảng này. Cấp chưa có dòng (hoặc 0) thì sale chưa tự đưa khách lên cấp đó được.
CREATE TABLE tier_upgrade_rules (
  tier_id          TEXT PRIMARY KEY REFERENCES price_tiers (id),
  min_order_amount INTEGER NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  updated_at       TEXT NOT NULL
);

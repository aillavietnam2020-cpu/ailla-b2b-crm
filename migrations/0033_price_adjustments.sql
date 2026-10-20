-- Giá điều chỉnh / khuyến mại: lớp tạm thời đặt LÊN TRÊN bảng giá 8 cấp, không sửa bảng giá gốc.
-- Ví dụ nguyên liệu tăng thì một số mã tăng 1% trong thời gian nhất định; hết hạn hoặc tắt là về giá gốc.
-- Phạm vi: ALL (mọi sản phẩm) / GROUP (một nhóm) / PRODUCT (một mã); cụ thể hơn thắng. tier_ids rỗng = mọi cấp.
-- Kiểu: PERCENT (+1 / -5 %), AMOUNT (+/- đồng trên mỗi đơn vị), FIXED (đặt thẳng giá khuyến mại).
CREATE TABLE price_adjustments (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL DEFAULT '',
  scope       TEXT NOT NULL CHECK (scope IN ('ALL', 'GROUP', 'PRODUCT')),
  product_id  TEXT REFERENCES products (id),
  group_id    TEXT REFERENCES product_groups (id),
  tier_ids    TEXT NOT NULL DEFAULT '[]',
  kind        TEXT NOT NULL CHECK (kind IN ('PERCENT', 'AMOUNT', 'FIXED')),
  value       REAL NOT NULL,
  round_to    INTEGER NOT NULL DEFAULT 100,
  valid_from  TEXT NOT NULL,
  valid_to    TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'OFF')),
  created_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX ix_price_adjustments_active ON price_adjustments (status, valid_from);

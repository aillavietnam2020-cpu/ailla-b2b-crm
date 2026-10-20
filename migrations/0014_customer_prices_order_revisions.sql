-- Bảng giá riêng từng khách (khách gia công) và lịch sử sửa đơn.
--
-- customers.price_mode:
--   TIER   = giá theo cấp 8 bậc như trước (mặc định)
--   CUSTOM = chỉ dùng bảng giá riêng của khách này (customer_prices); mã nào chưa có giá thì chặn bán
-- products.price_scope:
--   TIER   = sản phẩm thường, nằm trong bảng giá 8 cấp
--   CUSTOM = sản phẩm gia công, chỉ xuất hiện trong bảng giá riêng của từng khách (không bị báo thiếu giá 8 cấp)

ALTER TABLE customers ADD COLUMN price_mode TEXT NOT NULL DEFAULT 'TIER'
  CHECK (price_mode IN ('TIER', 'CUSTOM'));

ALTER TABLE products ADD COLUMN price_scope TEXT NOT NULL DEFAULT 'TIER'
  CHECK (price_scope IN ('TIER', 'CUSTOM'));

-- Giá theo (khách, sản phẩm, ngày hiệu lực). Giá cũ không bị sửa mà đóng lại bằng valid_to,
-- đơn đã chốt vẫn giữ giá đã lưu trong order_items.
CREATE TABLE customer_prices (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  product_id  TEXT NOT NULL REFERENCES products (id),
  amount      INTEGER NOT NULL CHECK (amount >= 0),   -- giá một đơn vị nhỏ nhất (can/chai)
  valid_from  TEXT NOT NULL,
  valid_to    TEXT,
  created_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_customer_prices_key ON customer_prices (customer_id, product_id, valid_from);
CREATE INDEX ix_customer_prices_lookup
  ON customer_prices (customer_id, product_id, valid_from, valid_to);

-- Mỗi lần sửa đơn lưu lại bản trước/sau để truy được ai sửa gì, vì sao.
CREATE TABLE order_revisions (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders (id),
  revision_no INTEGER NOT NULL,
  edited_by   TEXT REFERENCES users (id),
  reason      TEXT,
  stage       TEXT,             -- trạng thái đơn lúc sửa, ví dụ APPROVED/DA_XUAT_KHO
  before_json TEXT NOT NULL,
  after_json  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_order_revisions ON order_revisions (order_id, revision_no);

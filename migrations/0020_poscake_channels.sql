-- Nối thẳng Poscake (Pancake POS) cho hàng bán qua sàn TikTok Shop / Shopee, thay cho hai file Sheet kế toán kho.
--  channel_source       : cửa hàng Poscake + mã API của từng kênh (mã API lưu dạng mã hoá, không trả ra ngoài)
--  channel_order_lines  : dòng hàng đã kéo về theo ngày; giữ lại để tính lại ngay khi sửa bảng quy đổi
--  channel_map          : bảng quy đổi combo → sản phẩm lẻ (kế toán sửa ngay trên web)

CREATE TABLE channel_source (
  channel        TEXT PRIMARY KEY CHECK (channel IN ('TIKTOK', 'SHOPEE', 'FACEBOOK')),
  shop_id        TEXT NOT NULL,
  api_key        TEXT NOT NULL,
  shop_names     TEXT,
  last_sync_at   TEXT,
  last_sync_note TEXT,
  updated_by     TEXT,
  updated_at     TEXT NOT NULL
);

CREATE TABLE channel_order_lines (
  channel    TEXT NOT NULL,
  order_id   TEXT NOT NULL,
  line_no    INTEGER NOT NULL,
  day        TEXT NOT NULL,
  shipped_at TEXT,
  shop       TEXT,
  sku        TEXT NOT NULL,
  variant    TEXT NOT NULL DEFAULT '',
  name       TEXT,
  qty        REAL NOT NULL,
  PRIMARY KEY (channel, order_id, line_no)
);
CREATE INDEX ix_channel_order_lines_day ON channel_order_lines (channel, day);

CREATE TABLE channel_map (
  channel    TEXT NOT NULL,
  sku        TEXT NOT NULL,
  variant    TEXT NOT NULL DEFAULT '',   -- trống = áp cho mọi phân loại của mã này
  item_label TEXT NOT NULL,              -- "MÃ - Tên" của sản phẩm lẻ, hoặc BỎ QUA
  qty        REAL NOT NULL DEFAULT 1,
  note       TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (channel, sku, variant, item_label)
);

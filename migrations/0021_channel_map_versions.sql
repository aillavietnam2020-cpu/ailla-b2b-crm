-- Bảng quy đổi combo theo thời gian: shop đổi thành phần combo / đổi quà thì thêm một "phiên bản" áp dụng từ ngày X,
-- các ngày trước X giữ nguyên cách quy đổi cũ. from_day = '' nghĩa là áp dụng từ đầu (dòng cũ giữ nguyên).
CREATE TABLE channel_map_v2 (
  channel    TEXT NOT NULL,
  sku        TEXT NOT NULL,
  variant    TEXT NOT NULL DEFAULT '',
  from_day   TEXT NOT NULL DEFAULT '',
  item_label TEXT NOT NULL,
  qty        REAL NOT NULL DEFAULT 1,
  note       TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (channel, sku, variant, from_day, item_label)
);
INSERT INTO channel_map_v2 (channel, sku, variant, from_day, item_label, qty, note, updated_by, updated_at)
SELECT channel, sku, variant, '', item_label, qty, note, updated_by, updated_at FROM channel_map;
DROP TABLE channel_map;
ALTER TABLE channel_map_v2 RENAME TO channel_map;

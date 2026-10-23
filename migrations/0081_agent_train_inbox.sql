-- Migration 0081: màn "Hội thoại" của trang Huấn luyện agent (xem tin nhắn như Pancake, chỉ chị xem).
-- Tin nhắn do công cụ trên VPS đẩy lên (đã che số điện thoại, email, link ở phía máy chủ trước khi lưu).
-- Chỉ thêm bảng, không đổi bảng cũ. Tin cũ hơn 90 ngày tự xóa khi có tin mới về.

CREATE TABLE agent_train_tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT 'gray',        -- gray, blue, grn, amb, red, pnk, vio
  kind       TEXT NOT NULL DEFAULT 'stage' CHECK (kind IN ('stage', 'product')),
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
-- Thẻ giai đoạn đang dùng trên Pancake của Page Ailla Việt Nam Store (chị sửa được trong Cài đặt > Thẻ hội thoại).
INSERT INTO agent_train_tags (name, color, kind, sort, created_at) VALUES
  ('CÂU HỎI', 'vio', 'stage', 1, '2026-10-23T00:00:00.000Z'),
  ('CHƯA BÁO GIÁ', 'pnk', 'stage', 2, '2026-10-23T00:00:00.000Z'),
  ('ĐÃ BÁO GIÁ', 'blue', 'stage', 3, '2026-10-23T00:00:00.000Z'),
  ('THIẾU THÔNG TIN', 'grn', 'stage', 4, '2026-10-23T00:00:00.000Z'),
  ('ĐÃ MUA HÀNG', 'blue', 'stage', 5, '2026-10-23T00:00:00.000Z'),
  ('HOÀN THÀNH', 'red', 'stage', 6, '2026-10-23T00:00:00.000Z'),
  ('HỎI GIÁ SỈ', 'grn', 'stage', 7, '2026-10-23T00:00:00.000Z');

CREATE TABLE agent_train_convs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  fb_page_id TEXT NOT NULL,
  psid       TEXT NOT NULL,                        -- mã khách trên Messenger của Page
  name       TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',             -- ghi chú của chị
  unread     INTEGER NOT NULL DEFAULT 0,           -- số tin khách chưa xem (chỉ trong web, không báo "đã xem" cho khách)
  last_at    TEXT NOT NULL,
  last_text  TEXT NOT NULL DEFAULT '',
  last_who   TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (fb_page_id, psid)
);
CREATE INDEX ix_agent_train_convs ON agent_train_convs (last_at);

CREATE TABLE agent_train_conv_tags (
  conv_id INTEGER NOT NULL REFERENCES agent_train_convs (id),
  tag_id  INTEGER NOT NULL REFERENCES agent_train_tags (id),
  PRIMARY KEY (conv_id, tag_id)
);

CREATE TABLE agent_train_msgs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id    INTEGER NOT NULL REFERENCES agent_train_convs (id),
  ext_id     TEXT NOT NULL DEFAULT '',             -- mã tin trên Facebook, để không ghi trùng
  at         TEXT NOT NULL,
  who        TEXT NOT NULL CHECK (who IN ('customer', 'agent', 'sale', 'system')),
  text       TEXT NOT NULL,                        -- đã che thông tin cá nhân
  flow       TEXT NOT NULL DEFAULT '',             -- luồng hoặc mã câu mẫu agent đã dùng
  version    INTEGER,
  why        TEXT NOT NULL DEFAULT '',             -- vì sao agent chọn
  got        TEXT NOT NULL DEFAULT '',             -- agent đã lấy dữ liệu gì
  wrong      INTEGER NOT NULL DEFAULT 0,           -- chị đánh dấu "agent trả lời sai"
  wrong_note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX ix_agent_train_msgs ON agent_train_msgs (conv_id, id);
CREATE UNIQUE INDEX ux_agent_train_msgs_ext ON agent_train_msgs (conv_id, ext_id) WHERE ext_id != '';

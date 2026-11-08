-- Nhận đơn B2B qua Zalo (chị Hoa duyệt 08/11, phương án 3 rồi phương án 1). Khối số 0290–0299.
-- Chỉ thêm bảng mới, không đụng dữ liệu cũ.

-- Mỗi lần đưa ảnh/tin đơn của khách vào web (sale chia sẻ, hoặc trợ lý đọc trong nhóm Zalo).
-- Ảnh gốc lưu thẳng trong D1 (≤ 1,5 MB, trình duyệt thu nhỏ trước) để Điều phối đối chiếu khi duyệt.
CREATE TABLE order_intakes (
  id               TEXT PRIMARY KEY,
  source           TEXT NOT NULL DEFAULT 'SALE' CHECK (source IN ('SALE', 'ZALO_GROUP')),
  customer_id      TEXT REFERENCES customers (id),
  raw_text         TEXT,
  image            BLOB,
  image_mime       TEXT,
  image_size       INTEGER,
  result_json      TEXT,
  status           TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'READ', 'FAILED', 'USED', 'DISMISSED')),
  error            TEXT,
  order_id         TEXT REFERENCES orders (id),
  zalo_thread_id   TEXT,
  zalo_thread_name TEXT,
  zalo_sender      TEXT,
  zalo_msg_id      TEXT,
  created_by       TEXT REFERENCES users (id),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX ix_order_intakes_order ON order_intakes (order_id);
CREATE INDEX ix_order_intakes_status ON order_intakes (status, created_at);
CREATE UNIQUE INDEX ux_order_intakes_zmsg ON order_intakes (zalo_msg_id) WHERE zalo_msg_id IS NOT NULL;

-- Link xem đơn gửi khách (không cần đăng nhập). Khách bấm "Đúng, chốt đơn" thì ghi giờ xác nhận.
CREATE TABLE order_share_links (
  token           TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders (id),
  created_by      TEXT REFERENCES users (id),
  created_at      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  first_viewed_at TEXT,
  view_count      INTEGER NOT NULL DEFAULT 0,
  confirmed_at    TEXT,
  change_note     TEXT,
  change_at       TEXT,
  revoked_at      TEXT
);
CREATE INDEX ix_order_share_order ON order_share_links (order_id);

-- Phương án 1: nhóm Zalo nào được trợ lý đọc đơn, gắn với khách nào. Mặc định tắt, Điều phối bật từng nhóm.
CREATE TABLE zalo_threads (
  thread_id   TEXT PRIMARY KEY,
  name        TEXT,
  customer_id TEXT REFERENCES customers (id),
  enabled     INTEGER NOT NULL DEFAULT 0,
  last_msg_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Phương án 1: tin trợ lý cần gửi vào nhóm Zalo (sau khi đơn được duyệt). Máy trên VPS lấy về gửi rồi báo đã gửi.
CREATE TABLE zalo_outbox (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL,
  text       TEXT NOT NULL,
  order_id   TEXT REFERENCES orders (id),
  status     TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  error      TEXT,
  created_by TEXT REFERENCES users (id),
  created_at TEXT NOT NULL,
  sent_at    TEXT
);
CREATE INDEX ix_zalo_outbox_status ON zalo_outbox (status, created_at);

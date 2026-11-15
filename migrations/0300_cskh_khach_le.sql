-- CSKH khách lẻ (chị Hoa duyệt demo 10/11/2026). Khối số migration của chat này: 0300–0309.
-- Chỉ thêm bảng mới, không đụng dữ liệu cũ. Khách gom theo số điện thoại, đơn kéo từ Poscake (cửa hàng Facebook) do máy chủ tự kéo.

-- Khách lẻ: một số điện thoại một khách.
CREATE TABLE IF NOT EXISTS cskh_customers (
  phone         TEXT PRIMARY KEY,            -- số chuẩn 0xxxxxxxxx
  name          TEXT NOT NULL DEFAULT '',
  phone2        TEXT NOT NULL DEFAULT '',
  birthday      TEXT NOT NULL DEFAULT '',    -- dd/mm
  addr_street   TEXT NOT NULL DEFAULT '',
  addr_ward     TEXT NOT NULL DEFAULT '',
  addr_district TEXT NOT NULL DEFAULT '',
  addr_province TEXT NOT NULL DEFAULT '',
  source        TEXT NOT NULL DEFAULT '',    -- nguồn đơn đầu (page / landing) hoặc "Gọi điện / Zalo"
  note          TEXT NOT NULL DEFAULT '',
  owner_id      TEXT,                        -- tài khoản CSKH đang chăm (users.id)
  owner_name    TEXT NOT NULL DEFAULT '',
  owner_prev    TEXT,                        -- người chăm trước (để trả khách cũ về người cũ)
  assigned_at   TEXT,
  next_call     TEXT,                        -- ngày hẹn gọi lại YYYY-MM-DD
  last_call     TEXT,
  last_result   TEXT NOT NULL DEFAULT '',
  first_order_day TEXT,
  last_order_day  TEXT,
  last_product  TEXT NOT NULL DEFAULT '',
  order_count   INTEGER NOT NULL DEFAULT 0,
  total_spent   REAL NOT NULL DEFAULT 0,
  manual        INTEGER NOT NULL DEFAULT 0,  -- 1 = CSKH thêm tay (khách gọi hotline / Zalo)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_cskh_cus_owner ON cskh_customers (owner_id, next_call);
CREATE INDEX IF NOT EXISTS ix_cskh_cus_next ON cskh_customers (next_call);

-- Đơn giao thành công của khách (kéo từ Poscake). items = JSON [{n: tên SP, q: số lượng, p: thành tiền}].
CREATE TABLE IF NOT EXISTS cskh_orders (
  id          TEXT PRIMARY KEY,              -- mã đơn Poscake
  phone       TEXT NOT NULL,
  day         TEXT NOT NULL,                 -- ngày giao thành công (giờ VN)
  created_day TEXT NOT NULL DEFAULT '',      -- ngày tạo đơn
  items       TEXT NOT NULL DEFAULT '[]',
  total       REAL NOT NULL DEFAULT 0,
  source      TEXT NOT NULL DEFAULT '',
  synced_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_cskh_ord_phone ON cskh_orders (phone, day);
CREATE INDEX IF NOT EXISTS ix_cskh_ord_day ON cskh_orders (day);

-- Mỗi lần gọi / chăm sóc.
CREATE TABLE IF NOT EXISTS cskh_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  phone       TEXT NOT NULL,
  by_id       TEXT,
  by_name     TEXT NOT NULL DEFAULT '',
  day         TEXT NOT NULL,                 -- YYYY-MM-DD giờ VN
  at          TEXT NOT NULL,
  result      TEXT NOT NULL,                 -- Đã chốt đơn / Không nghe máy / Hẹn gọi lại / Kết nối Zalo / Khách từ chối / Sai số
  reason      TEXT NOT NULL DEFAULT '',      -- lý do từ chối
  note        TEXT NOT NULL DEFAULT '',
  question    TEXT NOT NULL DEFAULT '',      -- câu hỏi khó
  next_call   TEXT
);
CREATE INDEX IF NOT EXISTS ix_cskh_log_phone ON cskh_logs (phone, at);
CREATE INDEX IF NOT EXISTS ix_cskh_log_day ON cskh_logs (day, by_id);

-- Đơn CSKH tạo trên web, gửi sang Poscake. items = JSON [{n, vid, q, price}].
CREATE TABLE IF NOT EXISTS cskh_web_orders (
  id          TEXT PRIMARY KEY,              -- CS-yymmdd-nnn
  phone       TEXT NOT NULL,
  by_id       TEXT,
  by_name     TEXT NOT NULL DEFAULT '',
  day         TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  items       TEXT NOT NULL,
  ship        REAL NOT NULL DEFAULT 0,
  discount    REAL NOT NULL DEFAULT 0,
  total       REAL NOT NULL DEFAULT 0,
  payment     TEXT NOT NULL DEFAULT 'COD',
  recv_name   TEXT NOT NULL DEFAULT '',
  recv_phone  TEXT NOT NULL DEFAULT '',
  recv_addr   TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  pos_id      TEXT,                          -- mã đơn bên Poscake khi gửi được
  pos_error   TEXT NOT NULL DEFAULT ''       -- lỗi khi Poscake không nhận đơn
);
CREATE INDEX IF NOT EXISTS ix_cskh_web_phone ON cskh_web_orders (phone);
CREATE INDEX IF NOT EXISTS ix_cskh_web_day ON cskh_web_orders (day, by_id);

-- Cài đặt CSKH (cách chia khách, ngày bắt đầu kéo, chu kỳ sản phẩm, chỉ tiêu...) và tiến độ kéo bù.
CREATE TABLE IF NOT EXISTS cskh_settings (
  k  TEXT PRIMARY KEY,
  v  TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

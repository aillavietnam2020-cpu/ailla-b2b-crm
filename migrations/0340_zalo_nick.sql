-- Zalo trong CRM, đợt 1 (chị Hoa duyệt demo 27/11/2026). Khối số 0340–0349.
-- Chỉ thêm bảng mới, không đụng dữ liệu cũ. Phần nhóm đọc đơn (0290: zalo_threads, zalo_outbox) giữ nguyên.
-- Phiên đăng nhập Zalo KHÔNG lưu ở đây: nằm trên VPS, mã hóa (vps-zalo/zalo-nick.mjs).

-- Nick Zalo công việc do công ty cấp, mỗi nick một người phụ trách.
CREATE TABLE IF NOT EXISTS zalo_nicks (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,                 -- tên gọi trên web, ví dụ "Zalo Sale 1"
  owner_id       TEXT REFERENCES users (id),    -- người phụ trách (sale thấy nick của mình)
  status         TEXT NOT NULL DEFAULT 'NEW',   -- NEW · QR · SCANNED · ON · OFF · NEED_QR · STOPPED
  status_note    TEXT NOT NULL DEFAULT '',
  qr_image       TEXT,                          -- ảnh QR tạm (base64), xóa khi đăng nhập xong
  qr_at          TEXT,
  zalo_uid       TEXT,
  zalo_name      TEXT,
  disabled       INTEGER NOT NULL DEFAULT 0,
  seen_at        TEXT,                          -- lần cuối chương trình VPS báo nick này
  created_by     TEXT REFERENCES users (id),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

-- Hội thoại: một người hoặc một nhóm trên một nick.
CREATE TABLE IF NOT EXISTS zalo_convs (
  id             TEXT PRIMARY KEY,
  nick_id        TEXT NOT NULL REFERENCES zalo_nicks (id),
  thread_id      TEXT NOT NULL,
  is_group       INTEGER NOT NULL DEFAULT 0,
  name           TEXT NOT NULL DEFAULT '',
  avatar         TEXT NOT NULL DEFAULT '',
  peer_phone     TEXT NOT NULL DEFAULT '',      -- số Zalo trả về (nếu khách để công khai), dạng 0xxxxxxxxx
  customer_id    TEXT REFERENCES customers (id),-- khách kênh phân phối
  cskh_phone     TEXT,                          -- khách lẻ CSKH (cskh_customers.phone)
  link_by        TEXT NOT NULL DEFAULT '',      -- AUTO (khớp SĐT) · tên người gắn tay
  last_at        TEXT,
  last_text      TEXT NOT NULL DEFAULT '',
  last_from_me   INTEGER NOT NULL DEFAULT 0,
  unread         INTEGER NOT NULL DEFAULT 0,
  waiting_since  TEXT,                          -- tin khách đầu tiên chưa được trả lời
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  UNIQUE (nick_id, thread_id)
);
CREATE INDEX IF NOT EXISTS ix_zalo_convs_last ON zalo_convs (last_at);
CREATE INDEX IF NOT EXISTS ix_zalo_convs_cus ON zalo_convs (customer_id);
CREATE INDEX IF NOT EXISTS ix_zalo_convs_cskh ON zalo_convs (cskh_phone);

-- Tin nhắn. Tin bị thu hồi vẫn giữ nội dung (recalled_at), chỉ Lead / CEO thấy nội dung.
CREATE TABLE IF NOT EXISTS zalo_msgs (
  id             TEXT PRIMARY KEY,
  conv_id        TEXT NOT NULL REFERENCES zalo_convs (id),
  nick_id        TEXT NOT NULL,
  msg_id         TEXT NOT NULL,                 -- mã tin của Zalo
  cli_msg_id     TEXT NOT NULL DEFAULT '',
  from_me        INTEGER NOT NULL DEFAULT 0,
  sender_uid     TEXT NOT NULL DEFAULT '',
  sender_name    TEXT NOT NULL DEFAULT '',
  kind           TEXT NOT NULL DEFAULT 'text',  -- text · image · file · sticker · voice · video · link · other
  text           TEXT NOT NULL DEFAULT '',
  url            TEXT NOT NULL DEFAULT '',
  at             TEXT NOT NULL,
  recalled_at    TEXT,
  seen_at        TEXT,                          -- khách đã xem (tin mình gửi)
  sent_by        TEXT REFERENCES users (id),    -- gửi từ web: ai bấm gửi
  created_at     TEXT NOT NULL,
  UNIQUE (nick_id, msg_id)
);
CREATE INDEX IF NOT EXISTS ix_zalo_msgs_conv ON zalo_msgs (conv_id, at);
CREATE INDEX IF NOT EXISTS ix_zalo_msgs_cli ON zalo_msgs (nick_id, cli_msg_id);

-- Lệnh web gửi xuống chương trình VPS: đăng nhập QR, gửi tin (người bấm), đăng xuất.
CREATE TABLE IF NOT EXISTS zalo_cmds (
  id             TEXT PRIMARY KEY,
  nick_id        TEXT NOT NULL,
  kind           TEXT NOT NULL,                 -- LOGIN_QR · SEND · LOGOUT
  conv_id        TEXT,
  thread_id      TEXT,
  is_group       INTEGER NOT NULL DEFAULT 0,
  to_phone       TEXT,                          -- nhắn khách chưa có hội thoại: tìm theo số
  customer_id    TEXT,                          -- nhắn từ hồ sơ khách: gắn hội thoại mới vào đúng khách
  cskh_phone     TEXT,
  text           TEXT,
  status         TEXT NOT NULL DEFAULT 'PENDING', -- PENDING · TAKEN · DONE · FAILED
  error          TEXT,
  msg_id         TEXT,
  created_by     TEXT REFERENCES users (id),
  created_at     TEXT NOT NULL,
  taken_at       TEXT,
  done_at        TEXT
);
CREATE INDEX IF NOT EXISTS ix_zalo_cmds_st ON zalo_cmds (status, created_at);
CREATE INDEX IF NOT EXISTS ix_zalo_cmds_nick ON zalo_cmds (nick_id, kind, created_at);

-- Tin mẫu gõ "/": Lead soạn, mọi người dùng.
CREATE TABLE IF NOT EXISTS zalo_templates (
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,          -- gõ "/chao"
  text           TEXT NOT NULL,
  updated_by     TEXT,
  updated_at     TEXT NOT NULL
);

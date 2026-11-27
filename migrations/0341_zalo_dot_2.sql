-- Zalo trong CRM, đợt 2 (chị Hoa chọn 27/11/2026): chat đầy đủ, AI soạn nháp, đo sale. Khối số 0340–0349.
-- Chỉ thêm bảng / cột mới.

-- Tin: trả lời trích dẫn, dữ liệu gốc để trích dẫn lại, ẩn phía mình.
ALTER TABLE zalo_msgs ADD COLUMN quote_text TEXT NOT NULL DEFAULT '';
ALTER TABLE zalo_msgs ADD COLUMN quote_name TEXT NOT NULL DEFAULT '';
ALTER TABLE zalo_msgs ADD COLUMN raw TEXT NOT NULL DEFAULT '';      -- {msgType, content, propertyExt, ttl, ts, uidFrom} để trích dẫn khi trả lời
ALTER TABLE zalo_msgs ADD COLUMN hidden_at TEXT;                    -- xóa phía mình (Lead / CEO vẫn thấy, có dấu)
ALTER TABLE zalo_msgs ADD COLUMN hidden_by TEXT;

-- Hội thoại: ghim trên web, đang gõ, đã chuông nhắc chờ trả lời, đã là bạn Zalo.
ALTER TABLE zalo_convs ADD COLUMN pinned_at TEXT;
ALTER TABLE zalo_convs ADD COLUMN typing_at TEXT;
ALTER TABLE zalo_convs ADD COLUMN wait_bell_at TEXT;
ALTER TABLE zalo_convs ADD COLUMN is_friend INTEGER;                -- 1 bạn, 0 chưa, NULL chưa rõ

-- Lệnh: dữ liệu thêm (trích dẫn, tệp, nhãn dán, cảm xúc, thu hồi, kết bạn).
ALTER TABLE zalo_cmds ADD COLUMN payload TEXT NOT NULL DEFAULT '';

-- Cảm xúc thả vào tin.
CREATE TABLE IF NOT EXISTS zalo_reactions (
  msg_row_id   TEXT NOT NULL,
  who_uid      TEXT NOT NULL,
  who_name     TEXT NOT NULL DEFAULT '',
  icon         TEXT NOT NULL,
  from_me      INTEGER NOT NULL DEFAULT 0,
  at           TEXT NOT NULL,
  PRIMARY KEY (msg_row_id, who_uid)
);

-- Ảnh / tệp sale gửi từ web: giữ tạm đến khi máy Zalo gửi xong thì xóa nội dung (tối đa 1,9 MB).
CREATE TABLE IF NOT EXISTS zalo_files (
  id           TEXT PRIMARY KEY,
  nick_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  mime         TEXT NOT NULL,
  size         INTEGER NOT NULL,
  data         BLOB,
  created_by   TEXT,
  created_at   TEXT NOT NULL,
  sent_at      TEXT
);

-- Danh bạ (bạn bè) từng nick, kéo từ Zalo.
CREATE TABLE IF NOT EXISTS zalo_friends (
  nick_id      TEXT NOT NULL,
  uid          TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  avatar       TEXT NOT NULL DEFAULT '',
  phone        TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (nick_id, uid)
);

-- Lời mời kết bạn gửi tới nick (người bấm Đồng ý / Từ chối).
CREATE TABLE IF NOT EXISTS zalo_friend_reqs (
  nick_id      TEXT NOT NULL,
  uid          TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  avatar       TEXT NOT NULL DEFAULT '',
  msg          TEXT NOT NULL DEFAULT '',
  at           TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING · ACCEPTED · REJECTED · GONE
  PRIMARY KEY (nick_id, uid)
);

-- Nháp AI cho một hội thoại (theo tin khách mới nhất), để mở lại không phải soạn lại.
CREATE TABLE IF NOT EXISTS zalo_ai (
  conv_id      TEXT PRIMARY KEY,
  msg_id       TEXT NOT NULL,
  text         TEXT NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);

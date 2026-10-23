-- Migration 0062: trang "Huấn luyện agent" (bot bán hàng trực Page).
-- Mỗi bot có MỘT bản nháp (toàn bộ kịch bản: câu mẫu, luồng, giá, ảnh, bám đuổi, quy tắc) và nhiều phiên bản đã xuất bản.
-- Agent trên VPS chỉ đọc phiên bản đang dùng của bot gắn với Page. Chị sửa nháp, kiểm tra, rồi mới xuất bản;
-- có thể quay lại phiên bản cũ. Nút tắt khẩn và thiết lập giờ/im lặng nằm ở app_kv (khoá agent_train_ctl).

CREATE TABLE agent_train_bots (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  draft       TEXT NOT NULL,                 -- JSON: toàn bộ kịch bản đang soạn
  dirty       INTEGER NOT NULL DEFAULT 0,    -- 1 = nháp có thay đổi chưa xuất bản
  created_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE agent_train_versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id       TEXT NOT NULL REFERENCES agent_train_bots (id),
  version      INTEGER NOT NULL,
  data         TEXT NOT NULL,                -- JSON đã xuất bản, không sửa nữa
  note         TEXT NOT NULL DEFAULT '',
  published_by TEXT REFERENCES users (id),
  published_at TEXT NOT NULL,
  is_current   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (bot_id, version)
);
CREATE INDEX ix_agent_train_versions ON agent_train_versions (bot_id, is_current);

CREATE TABLE agent_train_pages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fb_page_id  TEXT NOT NULL UNIQUE,          -- id Page Facebook
  name        TEXT NOT NULL,
  bot_id      TEXT REFERENCES agent_train_bots (id),
  mode        TEXT NOT NULL DEFAULT 'off' CHECK (mode IN ('off', 'tester')),  -- chưa có chế độ gửi khách thật
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Nhật ký agent: mỗi lượt trả lời hoặc dừng, ghi rõ dùng phiên bản nào, chọn luồng nào.
CREATE TABLE agent_train_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  fb_page_id  TEXT NOT NULL,
  bot_id      TEXT,
  version     INTEGER,
  flow        TEXT NOT NULL DEFAULT '',
  result      TEXT NOT NULL,                 -- sent | handoff | blocked | out_of_script | skipped
  note        TEXT NOT NULL DEFAULT '',
  customer    TEXT NOT NULL DEFAULT ''       -- câu khách, đã che thông tin cá nhân
);
CREATE INDEX ix_agent_train_runs ON agent_train_runs (id);

-- Lịch sử chỉnh sửa: ai đã sửa / xuất bản / tắt khẩn gì, lúc nào.
CREATE TABLE agent_train_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL,
  by_user    TEXT REFERENCES users (id),
  action     TEXT NOT NULL,                  -- vd: bot.publish, control.kill
  ref        TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX ix_agent_train_log ON agent_train_log (id);

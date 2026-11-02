-- Tin nhắn kiểu Lark (chị Hoa 02/11): nhóm theo phòng + nhắn riêng, lưu trên máy chủ (nhắn riêng chỉ hai người đọc được),
-- thẻ việc giao ngay trong chat, nhắc việc theo giờ.
-- room: 'g:<phòng>' nhóm (mọi người vào web vận hành đọc được) · 'dm:<mã người>~<mã người>' nhắn riêng (2 mã xếp theo thứ tự)
CREATE TABLE chat_msgs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',   -- '' tin thường · 'task' thẻ việc (ref = mã việc) · 'remind' báo đặt nhắc
  ref TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX ix_chat_msgs_room ON chat_msgs (room, id);

CREATE TABLE chat_reads (
  user_id TEXT NOT NULL,
  room TEXT NOT NULL,
  last_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, room)
);

CREATE TABLE chat_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,          -- người được nhắc
  by_id TEXT NOT NULL,            -- người đặt nhắc
  due_at TEXT NOT NULL,           -- ISO giờ nhắc
  text TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  task_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  fired_at TEXT
);
CREATE INDEX ix_chat_reminders_due ON chat_reminders (user_id, fired_at, due_at);

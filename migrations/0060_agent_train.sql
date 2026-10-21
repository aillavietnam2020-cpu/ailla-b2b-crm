-- Migration 0060: trang "Huấn luyện agent" (Sale và CSKH trực page).
-- Kho kịch bản / bảng giá / câu khách hay hỏi / ảnh-video / luật cấm: chị sửa và DUYỆT; agent chỉ đọc bản đã duyệt.
-- Agent học từ hội thoại chỉ ĐỀ XUẤT (bảng suggestions), chị duyệt hoặc từ chối. Chạy thử: agent trả lời lại câu khách cũ (đã xoá thông tin cá nhân).

CREATE TABLE agent_train_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_set   TEXT NOT NULL DEFAULT 'BOTH' CHECK (agent_set IN ('SALE', 'CSKH', 'BOTH')),
  kind        TEXT NOT NULL CHECK (kind IN ('SCRIPT', 'PRICE', 'FAQ', 'MEDIA', 'RULE')),
  grp         TEXT NOT NULL DEFAULT '',      -- nhóm (vd: bột tẩy vạn năng, vết bẩn nồi chảo)
  code        TEXT NOT NULL DEFAULT '',      -- mã câu mẫu (vd: BT_GT1) hoặc mã ảnh
  title       TEXT NOT NULL,                 -- tên / câu khách hỏi / tên sản phẩm
  body        TEXT NOT NULL DEFAULT '',      -- nội dung câu mẫu / câu trả lời chuẩn / giá / luật cấm
  extra       TEXT NOT NULL DEFAULT '',      -- ghi chú: link ảnh, quà, điều kiện
  status      TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'ARCHIVED')),
  source      TEXT NOT NULL DEFAULT 'CEO' CHECK (source IN ('CEO', 'AGENT')),
  created_by  TEXT REFERENCES users (id),
  approved_by TEXT REFERENCES users (id),
  approved_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX ix_agent_train_items ON agent_train_items (kind, status);

CREATE TABLE agent_train_suggestions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent       TEXT NOT NULL,
  agent_set   TEXT NOT NULL DEFAULT 'SALE' CHECK (agent_set IN ('SALE', 'CSKH', 'BOTH')),
  kind        TEXT NOT NULL CHECK (kind IN ('SCRIPT', 'PRICE', 'FAQ', 'MEDIA', 'RULE')),
  grp         TEXT NOT NULL DEFAULT '',
  code        TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  extra       TEXT NOT NULL DEFAULT '',
  reason      TEXT NOT NULL DEFAULT '',      -- vì sao agent đề xuất (đã quan sát gì)
  evidence    TEXT NOT NULL DEFAULT '',      -- trích dẫn hội thoại, ĐÃ xoá thông tin cá nhân
  status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  item_id     INTEGER REFERENCES agent_train_items (id),
  note        TEXT NOT NULL DEFAULT '',      -- lý do chị từ chối / ghi chú
  decided_by  TEXT REFERENCES users (id),
  decided_at  TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_agent_train_sug ON agent_train_suggestions (status, id);

CREATE TABLE agent_train_evals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_set   TEXT NOT NULL DEFAULT 'SALE' CHECK (agent_set IN ('SALE', 'CSKH', 'BOTH')),
  customer_msg TEXT NOT NULL,                -- câu khách (đã che số điện thoại, email, link)
  sale_reply  TEXT NOT NULL DEFAULT '',      -- câu sale thật đã nhắn
  agent_reply TEXT,                          -- câu agent trả lời lại (chưa có = đang chờ)
  flags       TEXT NOT NULL DEFAULT '[]',    -- JSON: các lỗi tự phát hiện (giá lạ, câu cấm...)
  ceo_score   INTEGER CHECK (ceo_score BETWEEN 1 AND 5),
  ceo_note    TEXT NOT NULL DEFAULT '',
  created_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL,
  answered_at TEXT
);
CREATE INDEX ix_agent_train_evals ON agent_train_evals (id);

-- Lịch sử chỉnh sửa: ai đã sửa / duyệt / tắt khẩn gì, lúc nào (để lần lại khi agent nói sai).
CREATE TABLE agent_train_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL,
  by_user    TEXT REFERENCES users (id),
  action     TEXT NOT NULL,                  -- vd: item.approve, control.kill
  ref        TEXT NOT NULL DEFAULT '',       -- mục / đề xuất liên quan
  detail     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX ix_agent_train_log ON agent_train_log (id);

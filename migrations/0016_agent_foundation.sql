-- Migration 0016: nền cho AI agent (chưa chạy agent nào).
--
-- Nguyên tắc: web là nơi giữ dữ liệu, trạng thái, quyền, phê duyệt và lịch sử. Agent chỉ là một "người dùng"
-- đặc biệt, vào bằng API riêng (/api/agent/*), có quyền riêng rất hẹp, chỉ đọc và ghi ĐỀ XUẤT; mọi việc
-- đổi trạng thái vẫn do người (hoặc luồng nghiệp vụ có sẵn) thực hiện.

-- Mỗi agent có một dòng trong users (để nhật ký, phân công, khóa ngoại dùng chung), phân biệt bằng kind.
ALTER TABLE users ADD COLUMN kind TEXT NOT NULL DEFAULT 'HUMAN' CHECK (kind IN ('HUMAN', 'AGENT'));

CREATE TABLE agents (
  id           TEXT PRIMARY KEY REFERENCES users (id),
  name         TEXT NOT NULL,
  purpose      TEXT NOT NULL DEFAULT '',
  token_hash   TEXT NOT NULL,          -- SHA-256 của khóa; khóa gốc chỉ hiện đúng một lần lúc tạo
  token_hint   TEXT NOT NULL,          -- vài ký tự đầu/cuối để nhận ra khóa
  status       TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  last_used_at TEXT,
  created_by   TEXT REFERENCES users (id),
  created_at   TEXT NOT NULL,
  rotated_at   TEXT
);
CREATE UNIQUE INDEX ux_agents_token ON agents (token_hash);

-- Nhật ký: phân biệt người / hệ thống / agent, kết quả, nguồn kích hoạt, người duyệt.
ALTER TABLE audit_logs ADD COLUMN actor_type TEXT NOT NULL DEFAULT 'USER';   -- USER | SYSTEM | AGENT
ALTER TABLE audit_logs ADD COLUMN result TEXT NOT NULL DEFAULT 'OK';         -- OK | FAILED | DENIED
ALTER TABLE audit_logs ADD COLUMN source TEXT;                               -- vd proposal:<id>, event:<id>, cron
ALTER TABLE audit_logs ADD COLUMN approved_by TEXT;
CREATE INDEX ix_audit_actor_type ON audit_logs (actor_type, created_at DESC);

-- Sự kiện nghiệp vụ: một chỗ duy nhất để agent (hoặc bot khác) đọc "có gì mới", theo con trỏ id tăng dần.
CREATE TABLE events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  at            TEXT NOT NULL,
  type          TEXT NOT NULL,           -- ORDER_CREATED, ORDER_STEP_CHANGED, PAYMENT_RECORDED, ORDER_STUCK ...
  entity_type   TEXT NOT NULL,           -- ORDER | CUSTOMER | PAYMENT | KHO_ITEM | BILL | PROPOSAL ...
  entity_id     TEXT NOT NULL,           -- ID ổn định của đối tượng
  actor_id      TEXT,
  actor_type    TEXT NOT NULL DEFAULT 'USER',
  payload_json  TEXT,
  dedupe_key    TEXT                     -- chống ghi trùng khi cron/agent chạy lại
);
CREATE UNIQUE INDEX ux_events_dedupe ON events (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX ix_events_type ON events (type, id);
CREATE INDEX ix_events_entity ON events (entity_type, entity_id, id);

-- Đề xuất của agent: agent KHÔNG tự đổi trạng thái; nó ghi đề xuất, người có quyền bấm Chấp nhận / Từ chối.
CREATE TABLE proposals (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,           -- REMINDER | KHO_CHECK_NOTE | PRODUCTION_REQUEST | STOCK_ALERT | DISCREPANCY | PAYMENT_FOLLOWUP
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
  agent_id      TEXT NOT NULL REFERENCES users (id),
  route_to      TEXT NOT NULL CHECK (route_to IN ('SALE', 'DIEU_PHOI', 'KHO', 'KE_TOAN')),
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  payload_json  TEXT,
  dedupe_key    TEXT NOT NULL,           -- agent gọi lại cùng khóa thì không tạo thêm
  decided_by    TEXT REFERENCES users (id),
  decided_at    TEXT,
  decision_note TEXT,
  created_at    TEXT NOT NULL,
  expires_at    TEXT
);
CREATE UNIQUE INDEX ux_proposals_dedupe ON proposals (agent_id, dedupe_key);
CREATE INDEX ix_proposals_status ON proposals (status, route_to, created_at DESC);
CREATE INDEX ix_proposals_entity ON proposals (entity_type, entity_id);

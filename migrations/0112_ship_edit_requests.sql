-- Yêu cầu sửa phiếu xuất kho B2B (số thực xuất / ngày xuất / người xuất): kho gửi kèm lý do, quản lý điều phối hoặc CEO duyệt mới sửa thật.
CREATE TABLE ship_edit_requests (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders (id),
  requested_by    TEXT REFERENCES users (id),
  requested_at    TEXT NOT NULL,
  ship_day        TEXT,
  shipped_by_name TEXT,
  lines_json      TEXT,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'CHO_DUYET' CHECK (status IN ('CHO_DUYET', 'DA_DUYET', 'TU_CHOI')),
  decided_by      TEXT REFERENCES users (id),
  decided_at      TEXT,
  decision_note   TEXT
);
CREATE INDEX ix_ship_edit_status ON ship_edit_requests (status, requested_at);
CREATE INDEX ix_ship_edit_order ON ship_edit_requests (order_id, status);

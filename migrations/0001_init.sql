-- Migration 0001: khung dữ liệu nghiệp vụ AILLA B2B CRM (mục 10 của đặc tả).
-- Quy ước: id TEXT (UUID), thời gian lưu UTC dạng ISO-8601, tiền lưu INTEGER đơn vị đồng.

-- ---------------------------------------------------------------------------
-- Người dùng và phân quyền
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('EMPLOYEE', 'MANAGER', 'CEO')),
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  legacy_name   TEXT,                       -- tên trong file Excel cũ: 'Thảo', 'Huyền'
  phone         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE UNIQUE INDEX ux_users_email ON users (lower(email));
CREATE INDEX ix_users_role ON users (role, status);
CREATE UNIQUE INDEX ux_users_legacy_name ON users (legacy_name) WHERE legacy_name IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Bảng giá 8 cấp
-- ---------------------------------------------------------------------------
CREATE TABLE price_tiers (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  rank        INTEGER NOT NULL,             -- 1 = GĐKD ... 8 = Bán lẻ
  debt_limit  INTEGER NOT NULL DEFAULT 0,   -- hạn mức công nợ tham chiếu (đồng)
  excel_column TEXT,                        -- tên cột tương ứng khi import/export
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_price_tiers_code ON price_tiers (code);
CREATE UNIQUE INDEX ux_price_tiers_rank ON price_tiers (rank);

CREATE TABLE product_groups (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_product_groups_code ON product_groups (code);
CREATE UNIQUE INDEX ux_product_groups_name ON product_groups (name);

CREATE TABLE products (
  id         TEXT PRIMARY KEY,
  sku        TEXT NOT NULL,
  name       TEXT NOT NULL,
  unit       TEXT,
  pack_size  TEXT,
  group_id   TEXT REFERENCES product_groups (id),
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX ux_products_sku ON products (sku);
CREATE INDEX ix_products_group ON products (group_id, active);

-- Giá chuẩn hoá theo (sản phẩm, cấp, ngày hiệu lực). amount NULL = chưa có giá.
CREATE TABLE product_prices (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id),
  tier_id    TEXT NOT NULL REFERENCES price_tiers (id),
  amount     INTEGER,
  valid_from TEXT NOT NULL,
  valid_to   TEXT,
  version    INTEGER NOT NULL DEFAULT 1,
  status     TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'LOCKED')),
  source     TEXT,
  created_by TEXT REFERENCES users (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_product_prices_key ON product_prices (product_id, tier_id, valid_from);
CREATE INDEX ix_product_prices_lookup ON product_prices (product_id, tier_id, valid_from, valid_to);

-- ---------------------------------------------------------------------------
-- Khách hàng, chăm sóc, công việc
-- ---------------------------------------------------------------------------
CREATE TABLE customers (
  id                  TEXT PRIMARY KEY,
  legacy_code         TEXT,                  -- mã/tên khách trong Excel cũ, dùng để đối soát
  name                TEXT NOT NULL,
  phone_text          TEXT,                  -- LUÔN lưu dạng TEXT, giữ số 0 đầu
  phone_normalized    TEXT,                  -- chỉ để tìm trùng, có thể NULL
  province            TEXT,
  address             TEXT,
  tier_id             TEXT REFERENCES price_tiers (id),
  legacy_tier_label   TEXT,                  -- ví dụ 'Khác' - cấp không có trong bảng giá
  owner_id            TEXT REFERENCES users (id),
  source              TEXT,
  stage               TEXT NOT NULL DEFAULT 'NEW'
                      CHECK (stage IN ('NEW','CONSULTING','QUOTED','NEGOTIATING','FIRST_ORDER','REGULAR','DORMANT','LOST')),
  potential           TEXT,
  interested_products TEXT,
  reorder_cycle_days  INTEGER,
  first_contact_date  TEXT,
  last_order_date     TEXT,
  next_follow_up_at   TEXT,
  opening_debt        INTEGER NOT NULL DEFAULT 0,   -- dư nợ cũ đầu kỳ (đóng băng theo batch)
  opening_debt_batch  TEXT,
  credit_limit        INTEGER,               -- NULL = lấy theo hạn mức của cấp giá
  data_quality        TEXT NOT NULL DEFAULT 'OK' CHECK (data_quality IN ('OK', 'NEEDS_REVIEW')),
  data_quality_note   TEXT,
  lost_reason         TEXT,
  created_by          TEXT REFERENCES users (id),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT
);
CREATE UNIQUE INDEX ux_customers_legacy_code ON customers (legacy_code) WHERE legacy_code IS NOT NULL;
CREATE INDEX ix_customers_owner ON customers (owner_id, stage);
CREATE INDEX ix_customers_stage ON customers (stage);
CREATE INDEX ix_customers_tier ON customers (tier_id);
CREATE INDEX ix_customers_phone ON customers (phone_normalized);
CREATE INDEX ix_customers_followup ON customers (next_follow_up_at);

CREATE TABLE customer_activities (
  id           TEXT PRIMARY KEY,
  customer_id  TEXT NOT NULL REFERENCES customers (id),
  user_id      TEXT NOT NULL REFERENCES users (id),
  channel      TEXT NOT NULL,               -- Gọi điện / Zalo / Messenger / Gặp trực tiếp / Khác
  result       TEXT NOT NULL,
  content      TEXT NOT NULL,
  next_action  TEXT,
  next_date    TEXT,
  reason_code  TEXT,                        -- bắt buộc khi Từ chối / Mất khách
  stage_before TEXT,
  stage_after  TEXT,
  corrected_at TEXT,                        -- append-only: chỉ sửa trong thời gian cho phép
  corrected_by TEXT REFERENCES users (id),
  created_at   TEXT NOT NULL
);
CREATE INDEX ix_activities_customer ON customer_activities (customer_id, created_at DESC);
CREATE INDEX ix_activities_user ON customer_activities (user_id, created_at DESC);

CREATE TABLE tasks (
  id                TEXT PRIMARY KEY,
  customer_id       TEXT REFERENCES customers (id),
  assignee_id       TEXT NOT NULL REFERENCES users (id),
  type              TEXT NOT NULL,          -- FOLLOW_UP / REORDER / DEBT / APPROVAL / DATA_QUALITY
  title             TEXT NOT NULL,
  due_at            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'CANCELLED')),
  priority          TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH')),
  source_activity_id TEXT REFERENCES customer_activities (id),
  completed_at      TEXT,
  created_by        TEXT REFERENCES users (id),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX ix_tasks_assignee ON tasks (assignee_id, status, due_at);
CREATE INDEX ix_tasks_customer ON tasks (customer_id, status);

-- ---------------------------------------------------------------------------
-- Đơn hàng
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id                 TEXT PRIMARY KEY,
  order_no           TEXT NOT NULL,
  legacy_order_code  TEXT,
  customer_id        TEXT NOT NULL REFERENCES customers (id),
  owner_id           TEXT REFERENCES users (id),
  order_date         TEXT NOT NULL,
  subtotal           INTEGER NOT NULL DEFAULT 0,   -- tiền hàng
  discount_amount    INTEGER NOT NULL DEFAULT 0,   -- chiết khấu
  bonus_deduction    INTEGER NOT NULL DEFAULT 0,   -- trừ thưởng tháng
  shipping_fee       INTEGER NOT NULL DEFAULT 0,   -- phí vận chuyển
  total_amount       INTEGER NOT NULL DEFAULT 0,   -- tổng phải thu
  cod_amount         INTEGER NOT NULL DEFAULT 0,   -- COD/đặt cọc
  approval_status    TEXT NOT NULL DEFAULT 'DRAFT'
                     CHECK (approval_status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED')),
  delivery_status    TEXT NOT NULL DEFAULT 'CHUA_XUAT'
                     CHECK (delivery_status IN ('CHUA_XUAT','DA_XUAT_KHO','DA_GIAO','HOAN')),
  payment_status     TEXT NOT NULL DEFAULT 'CHUA_THU'
                     CHECK (payment_status IN ('CHUA_THU','THU_MOT_PHAN','DA_THU_DU','THU_THUA')),
  accounting_status  TEXT NOT NULL DEFAULT 'CHUA_XAC_NHAN'
                     CHECK (accounting_status IN ('CHUA_XAC_NHAN','DA_XAC_NHAN')),
  accounting_confirmed_at TEXT,
  delivered_at       TEXT,
  note               TEXT,
  data_quality       TEXT NOT NULL DEFAULT 'OK' CHECK (data_quality IN ('OK','NEEDS_REVIEW')),
  import_batch_id    TEXT,
  created_by         TEXT REFERENCES users (id),
  submitted_at       TEXT,
  approved_by        TEXT REFERENCES users (id),
  approved_at        TEXT,
  rejected_reason    TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  deleted_at         TEXT
);
CREATE UNIQUE INDEX ux_orders_order_no ON orders (order_no);
CREATE INDEX ix_orders_customer ON orders (customer_id, order_date DESC);
CREATE INDEX ix_orders_owner ON orders (owner_id, approval_status);
CREATE INDEX ix_orders_status ON orders (approval_status, delivery_status, payment_status, accounting_status);

CREATE TABLE order_items (
  id                    TEXT PRIMARY KEY,
  order_id              TEXT NOT NULL REFERENCES orders (id),
  product_id            TEXT NOT NULL REFERENCES products (id),
  qty                   INTEGER NOT NULL CHECK (qty > 0),
  base_price            INTEGER,             -- giá chuẩn tại thời điểm tạo đơn (snapshot)
  applied_price         INTEGER NOT NULL,    -- giá thực áp dụng
  line_total            INTEGER NOT NULL,
  price_override        INTEGER NOT NULL DEFAULT 0,
  price_override_reason TEXT,
  tier_id_snapshot      TEXT REFERENCES price_tiers (id),
  created_at            TEXT NOT NULL
);
CREATE INDEX ix_order_items_order ON order_items (order_id);
CREATE INDEX ix_order_items_product ON order_items (product_id);

-- ---------------------------------------------------------------------------
-- Thanh toán và công nợ
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
  id                   TEXT PRIMARY KEY,
  external_receipt_no  TEXT,                 -- mã phiếu thu; có thể NULL -> NEEDS_REVIEW
  source               TEXT NOT NULL DEFAULT 'MANUAL',
  external_row_key     TEXT,                 -- khoá chống nhập trùng khi import
  customer_id          TEXT NOT NULL REFERENCES customers (id),
  amount               INTEGER NOT NULL CHECK (amount > 0),
  paid_at              TEXT NOT NULL,
  method               TEXT,
  accounting_status    TEXT NOT NULL DEFAULT 'CHUA_XAC_NHAN'
                       CHECK (accounting_status IN ('CHUA_XAC_NHAN','DA_XAC_NHAN')),
  review_status        TEXT NOT NULL DEFAULT 'OK' CHECK (review_status IN ('OK','NEEDS_REVIEW')),
  is_general_repayment INTEGER NOT NULL DEFAULT 0,  -- 'trả nợ chung' chưa phân bổ
  note                 TEXT,
  import_batch_id      TEXT,
  created_by           TEXT REFERENCES users (id),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_payments_external ON payments (source, external_row_key)
  WHERE external_row_key IS NOT NULL;
CREATE INDEX ix_payments_customer ON payments (customer_id, paid_at DESC);
CREATE INDEX ix_payments_review ON payments (review_status, accounting_status);

CREATE TABLE payment_allocations (
  id           TEXT PRIMARY KEY,
  payment_id   TEXT NOT NULL REFERENCES payments (id),
  order_id     TEXT NOT NULL REFERENCES orders (id),
  amount       INTEGER NOT NULL CHECK (amount > 0),
  allocated_by TEXT REFERENCES users (id),
  reversed_at  TEXT,
  created_at   TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_payment_allocations ON payment_allocations (payment_id, order_id);
CREATE INDEX ix_payment_allocations_order ON payment_allocations (order_id);

-- Hàng chờ phân bổ cho khoản 'trả nợ chung'
CREATE TABLE payment_allocations_pending (
  id          TEXT PRIMARY KEY,
  payment_id  TEXT NOT NULL REFERENCES payments (id),
  customer_id TEXT NOT NULL REFERENCES customers (id),
  amount      INTEGER NOT NULL CHECK (amount > 0),
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RESOLVED','CANCELLED')),
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_pending_alloc_status ON payment_allocations_pending (status, customer_id);

-- Thu thừa: không dùng số âm để che lỗi công nợ
CREATE TABLE customer_credit_balances (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  amount      INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_credit_balance_customer ON customer_credit_balances (customer_id);

CREATE TABLE debt_snapshots (
  id            TEXT PRIMARY KEY,
  customer_id   TEXT REFERENCES customers (id),
  batch_id      TEXT,
  snapshot_date TEXT NOT NULL,
  opening_debt  INTEGER NOT NULL DEFAULT 0,
  official_debt INTEGER NOT NULL DEFAULT 0,
  projected_debt INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE INDEX ix_debt_snapshots ON debt_snapshots (customer_id, snapshot_date DESC);

-- ---------------------------------------------------------------------------
-- Duyệt ngoại lệ, import, audit, cảnh báo
-- ---------------------------------------------------------------------------
CREATE TABLE approvals (
  id           TEXT PRIMARY KEY,
  entity_type  TEXT NOT NULL,               -- ORDER / PRICE_VERSION / CUSTOMER_TIER ...
  entity_id    TEXT NOT NULL,
  rule_code    TEXT NOT NULL,               -- PRICE_OVERRIDE / DEBT_LIMIT_EXCEEDED / TIER_UNKNOWN ...
  requester_id TEXT NOT NULL REFERENCES users (id),
  approver_id  TEXT REFERENCES users (id),
  required_role TEXT NOT NULL DEFAULT 'MANAGER' CHECK (required_role IN ('MANAGER', 'CEO')),
  status       TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reason       TEXT,
  decision_note TEXT,
  payload_json TEXT,
  decided_at   TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX ix_approvals_status ON approvals (status, created_at DESC);
CREATE INDEX ix_approvals_entity ON approvals (entity_type, entity_id);

CREATE TABLE import_batches (
  id                 TEXT PRIMARY KEY,
  file_name          TEXT NOT NULL,
  checksum           TEXT NOT NULL,
  type               TEXT NOT NULL,          -- FULL_WORKBOOK / BANG_GIA / KHACH_HANG ...
  status             TEXT NOT NULL DEFAULT 'PREVIEW'
                     CHECK (status IN ('PREVIEW','COMMITTED','RECONCILED','FAILED','ROLLED_BACK')),
  totals_json        TEXT,
  reconciliation_json TEXT,
  r2_key             TEXT,
  started_by         TEXT NOT NULL REFERENCES users (id),
  created_at         TEXT NOT NULL,
  committed_at       TEXT,
  rolled_back_at     TEXT
);
CREATE UNIQUE INDEX ux_import_batches_checksum ON import_batches (checksum, type)
  WHERE status IN ('COMMITTED', 'RECONCILED');
CREATE INDEX ix_import_batches_status ON import_batches (status, created_at DESC);

CREATE TABLE import_errors (
  id        TEXT PRIMARY KEY,
  batch_id  TEXT NOT NULL REFERENCES import_batches (id),
  sheet     TEXT NOT NULL,
  row_no    INTEGER,
  field     TEXT,
  code      TEXT NOT NULL,
  message   TEXT NOT NULL,
  severity  TEXT NOT NULL DEFAULT 'ERROR' CHECK (severity IN ('ERROR','WARNING','INFO')),
  raw_json  TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX ix_import_errors_batch ON import_errors (batch_id, sheet, row_no);

CREATE TABLE audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES users (id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  before_json TEXT,
  after_json  TEXT,
  reason      TEXT,
  ip          TEXT,
  request_id  TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_audit_entity ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX ix_audit_actor ON audit_logs (actor_id, created_at DESC);

CREATE TABLE alerts (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL,                -- TASK_OVERDUE / REORDER_DUE / ...
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  owner_id    TEXT REFERENCES users (id),
  severity    TEXT NOT NULL DEFAULT 'WARNING' CHECK (severity IN ('INFO','WARNING','CRITICAL')),
  message     TEXT NOT NULL,
  data_json   TEXT,
  status      TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  created_at  TEXT NOT NULL,
  resolved_at TEXT
);
CREATE UNIQUE INDEX ux_alerts_open ON alerts (code, entity_type, entity_id) WHERE status = 'OPEN';
CREATE INDEX ix_alerts_owner ON alerts (owner_id, status, created_at DESC);

CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT REFERENCES users (id),
  updated_at TEXT NOT NULL
);

-- Chống tạo trùng khi client gửi lại request (Idempotency-Key)
CREATE TABLE idempotency_keys (
  key           TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  endpoint      TEXT NOT NULL,
  request_hash  TEXT NOT NULL,
  response_json TEXT,
  status        TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','DONE')),
  created_at    TEXT NOT NULL
);
CREATE INDEX ix_idempotency_created ON idempotency_keys (created_at);

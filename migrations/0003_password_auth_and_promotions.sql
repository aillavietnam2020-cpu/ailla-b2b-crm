-- Migration 0003:
--   (1) Đăng nhập bằng email + mật khẩu (dùng khi chưa có tên miền để bật Cloudflare Access).
--   (2) Chương trình khuyến mại: hàng tặng theo dòng và mã chương trình theo đơn.

-- --------------------------------------------------------------------------
-- (1) Mật khẩu và phiên đăng nhập
-- --------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_updated_at TEXT;
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;

-- Phiên đăng nhập: cookie chỉ chứa token ngẫu nhiên, database chỉ lưu bản băm của token.
CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  token_hash   TEXT NOT NULL,
  user_id      TEXT NOT NULL REFERENCES users (id),
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT,
  ip           TEXT,
  user_agent   TEXT,
  revoked_at   TEXT
);
CREATE UNIQUE INDEX ux_sessions_token ON sessions (token_hash);
CREATE INDEX ix_sessions_user ON sessions (user_id, expires_at);

-- --------------------------------------------------------------------------
-- (2) Khuyến mại: hàng tặng và mã chương trình
-- --------------------------------------------------------------------------
-- Dòng hàng tặng: đơn giá 0, không tính vào tiền hàng, không cần duyệt giá,
-- nhưng vẫn là một dòng thật để theo dõi số lượng đã tặng.
ALTER TABLE order_items ADD COLUMN is_gift INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN promotion_note TEXT;

ALTER TABLE orders ADD COLUMN promotion_code TEXT;
ALTER TABLE orders ADD COLUMN promotion_note TEXT;

CREATE INDEX ix_orders_promotion ON orders (promotion_code);

INSERT INTO app_settings (key, value_json, version, updated_at) VALUES
  ('auth.session_hours', '12', 1, '2026-08-16T00:00:00.000Z'),
  ('auth.max_failed_logins', '5', 1, '2026-08-16T00:00:00.000Z'),
  ('auth.lock_minutes', '15', 1, '2026-08-16T00:00:00.000Z');

-- Chấm công chính chủ (CEO 10/11): mỗi người một máy chấm công, mỗi lần chấm xác nhận vân tay / Face ID (WebAuthn).
-- Mỗi người một máy: cred_id + khóa công khai (SPKI, base64url) + thuật toán (-7 ES256, -257 RS256).
CREATE TABLE cc_may_dk (
  user_id    TEXT PRIMARY KEY,
  cred_id    TEXT NOT NULL,
  pub_key    TEXT NOT NULL,
  alg        INTEGER NOT NULL,
  ten        TEXT,
  created_at TEXT NOT NULL,
  last_at    TEXT
);
-- Thử thách đang chờ ký của từng người (dùng một lần, hết hạn sau 5 phút).
CREATE TABLE cc_thu_thach (
  user_id TEXT PRIMARY KEY,
  chal    TEXT NOT NULL,
  exp     TEXT NOT NULL
);
-- Cảnh báo cho HCNS: thử chấm từ máy lạ ('la'), một máy chấm cho hai người trong ngày ('chung').
CREATE TABLE cc_may_canh_bao (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  ngay       TEXT NOT NULL,
  kieu       TEXT NOT NULL CHECK (kieu IN ('la', 'chung')),
  ten_may    TEXT,
  did        TEXT,
  khac_id    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_cc_may_cb_ngay ON cc_may_canh_bao (ngay);
-- Mã máy (ngẫu nhiên, lưu trong trình duyệt) của từng lượt chấm điện thoại: phát hiện một máy chấm cho nhiều người.
ALTER TABLE cc_luot ADD COLUMN did TEXT;
CREATE INDEX idx_cc_luot_did ON cc_luot (did, ngay);

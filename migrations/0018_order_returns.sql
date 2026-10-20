-- Phiếu hàng trả lại (kế toán gọi: "phiếu nhập kho hàng bán bị trả lại" + "giảm trừ công nợ").
-- Sale tạo → kho xác nhận đã nhận hàng (tăng tồn nếu còn bán được) → kế toán xác nhận giảm công nợ.
-- Additive: không đổi bảng cũ; chỉ thay view kho_ledger để cộng hàng trả về tồn.

CREATE TABLE order_returns (
  id             TEXT PRIMARY KEY,
  return_no      TEXT NOT NULL UNIQUE,
  customer_id    TEXT NOT NULL REFERENCES customers (id),
  order_id       TEXT REFERENCES orders (id),
  status         TEXT NOT NULL DEFAULT 'CHO_KHO'
                 CHECK (status IN ('CHO_KHO', 'DA_NHAN_KHO', 'DA_GIAM_NO', 'HUY')),
  return_date    TEXT NOT NULL,
  reason         TEXT,
  note           TEXT,
  claimed_amount INTEGER NOT NULL DEFAULT 0,   -- theo số sale báo
  credit_amount  INTEGER NOT NULL DEFAULT 0,   -- theo số kho thực nhận, chốt khi kế toán xác nhận
  resolution     TEXT CHECK (resolution IN ('TRU_CONG_NO', 'HOAN_TIEN')),
  created_by     TEXT REFERENCES users (id),
  created_at     TEXT NOT NULL,
  kho_by         TEXT REFERENCES users (id),
  kho_at         TEXT,
  kho_note       TEXT,
  acct_by        TEXT REFERENCES users (id),
  acct_at        TEXT,
  acct_note      TEXT,
  cancelled_by   TEXT REFERENCES users (id),
  cancelled_at   TEXT,
  updated_at     TEXT NOT NULL
);
CREATE INDEX ix_order_returns_customer ON order_returns (customer_id, status);
CREATE INDEX ix_order_returns_status ON order_returns (status, created_at DESC);

CREATE TABLE order_return_lines (
  id           TEXT PRIMARY KEY,
  return_id    TEXT NOT NULL REFERENCES order_returns (id),
  product_id   TEXT NOT NULL REFERENCES products (id),
  qty          REAL NOT NULL CHECK (qty > 0),       -- số sale báo trả
  unit_price   INTEGER NOT NULL DEFAULT 0,          -- giá bán của đơn gốc (hoặc nhập tay)
  received_qty REAL,                                -- số kho thực nhận (NULL = chưa nhận)
  condition    TEXT CHECK (condition IN ('CON_BAN_DUOC', 'HONG')),
  line_note    TEXT
);
CREATE INDEX ix_order_return_lines_return ON order_return_lines (return_id);

CREATE TABLE order_return_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id TEXT NOT NULL REFERENCES order_returns (id),
  at        TEXT NOT NULL,
  actor_id  TEXT REFERENCES users (id),
  action    TEXT NOT NULL,
  note      TEXT
);
CREATE INDEX ix_order_return_log_return ON order_return_log (return_id, at);

-- Sổ kho: giữ nguyên như 0015, thêm hàng trả lại đã nhận (chỉ phần còn bán được) vào tồn.
DROP VIEW kho_ledger;
CREATE VIEW kho_ledger AS
SELECT m.item AS item, m.qty AS qty, m.std_qty AS std_qty, m.role AS role, d.doc_date AS doc_date,
       d.id AS doc_id, d.type AS doc_type, d.no AS doc_no
FROM kho_moves m JOIN kho_docs d ON d.id = m.doc_id
WHERE d.status = 'OK'
UNION ALL
SELECT km.misa_code, -(COALESCE(okl.shipped_qty, oi.qty) * km.factor), NULL, 'B2B',
       substr(o.delivered_at, 1, 10), 0, 'B2B', o.order_no
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN kho_map km ON km.crm_sku = p.sku
LEFT JOIN order_kho_lines okl ON okl.order_id = o.id AND okl.product_id = oi.product_id
WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
  AND o.delivery_status IN ('DA_XUAT_KHO', 'DA_GIAO') AND o.delivered_at IS NOT NULL
  AND substr(o.delivered_at, 1, 10) >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'b2b_from'), '9999-12-31')
UNION ALL
SELECT km.misa_code, (rl.received_qty * km.factor), NULL, 'B2B',
       substr(r.kho_at, 1, 10), 0, 'TRA_HANG', r.return_no
FROM order_returns r
JOIN order_return_lines rl ON rl.return_id = r.id
JOIN products p ON p.id = rl.product_id
JOIN kho_map km ON km.crm_sku = p.sku
WHERE r.status IN ('DA_NHAN_KHO', 'DA_GIAM_NO') AND rl.condition = 'CON_BAN_DUOC'
  AND COALESCE(rl.received_qty, 0) > 0 AND r.kho_at IS NOT NULL
  AND substr(r.kho_at, 1, 10) >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'b2b_from'), '9999-12-31');

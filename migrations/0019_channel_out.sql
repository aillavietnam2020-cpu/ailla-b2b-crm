-- Hàng bán qua sàn (TikTok Shop, Shopee, ...) trừ vào kho theo từng ngày.
-- Nguồn: tab "Hàng lẻ theo ngày" của các Sheet kế toán kho (đã tách combo ra sản phẩm lẻ).
-- Mỗi (kênh, ngày) được thay nguyên cả ngày khi nạp lại nên nạp bao nhiêu lần cũng không bị trừ trùng.
-- Chỉ tính từ ngày kho_cfg 'online_from' (chưa đặt = chưa trừ gì), giống cách làm với đơn B2B.

CREATE TABLE channel_out (
  channel TEXT NOT NULL CHECK (channel IN ('TIKTOK', 'SHOPEE', 'FACEBOOK')),
  day     TEXT NOT NULL,
  item    TEXT NOT NULL,           -- mã vật tư trong kho_items
  qty     REAL NOT NULL,
  PRIMARY KEY (channel, day, item)
);

-- Dòng chưa biết là mã vật tư nào: kho CHƯA trừ cho tới khi được gán mã (channel_alias).
CREATE TABLE channel_unmapped (
  channel TEXT NOT NULL,
  day     TEXT NOT NULL,
  label   TEXT NOT NULL,
  qty     REAL NOT NULL,
  PRIMARY KEY (channel, day, label)
);

-- Tên sản phẩm lẻ trên Sheet → mã vật tư (khi tên không có dạng "MÃ - Tên").
CREATE TABLE channel_alias (
  label TEXT PRIMARY KEY,
  item  TEXT NOT NULL,
  note  TEXT
);

-- Ngày nào đã nhận dữ liệu (kể cả ngày 0 đơn) để phân biệt "không có đơn" với "chưa nạp".
CREATE TABLE channel_runs (
  channel     TEXT NOT NULL,
  day         TEXT NOT NULL,
  orders      INTEGER,
  lines       INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL,
  source      TEXT,
  PRIMARY KEY (channel, day)
);

INSERT INTO channel_alias (label, item, note) VALUES
  ('Cồn thơm 30ml', 'CON30ML', 'Cồn 30ml tặng kèm'),
  ('Phao lọc cặn', 'phaoloccan', 'Phao lọc cặn tặng kèm');

-- Sổ kho = như 0018 + hàng bán qua sàn (chỉ từ ngày online_from).
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
  AND substr(r.kho_at, 1, 10) >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'b2b_from'), '9999-12-31')
UNION ALL
SELECT co.item, -co.qty, NULL, 'ONLINE', co.day, 0, 'ONLINE', co.channel
FROM channel_out co
WHERE co.day >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'online_from'), '9999-12-31');

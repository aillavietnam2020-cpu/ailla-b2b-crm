-- Migration 0012: kho sản xuất (nhập NVL → pha chế BTP → kiểm kê đóng gói → xuất kho → hàng hoàn).
--
-- Sổ kho ghi theo từng dòng, KHÔNG sửa đè: phiếu sai thì hủy (còn dấu vết) rồi lập phiếu mới.
-- Tồn kho = tổng số lượng các dòng của phiếu còn hiệu lực (status = 'OK').

CREATE TABLE kho_items (
  code        TEXT PRIMARY KEY,            -- mã MISA
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT '',
  cls         TEXT NOT NULL,               -- NVL | BTP | TP | HH | CCDC | COMBO (lớp kho)
  grp         TEXT NOT NULL DEFAULT '',    -- nhóm hiển thị: hóa chất, vỏ can, tem nhãn...
  min_stock   REAL NOT NULL DEFAULT 0,     -- tồn tối thiểu để cảnh báo
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

-- Định mức: 1 dòng = 1 vật tư dùng cho 1 đơn vị sản phẩm (1 lít BTP, 1 can/chai thành phẩm).
CREATE TABLE kho_bom (
  product     TEXT NOT NULL REFERENCES kho_items (code),
  item        TEXT NOT NULL REFERENCES kho_items (code),
  qty         REAL NOT NULL,
  kind        TEXT NOT NULL DEFAULT '',    -- Bán thành phẩm | Vỏ can, chai, túi | Tem nhãn | ...
  note        TEXT NOT NULL DEFAULT '',
  sort        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product, item)
);

CREATE TABLE kho_docs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  no            TEXT NOT NULL UNIQUE,      -- PN2610-001, PC..., KS..., XB..., XK..., TL..., TD...
  type          TEXT NOT NULL,             -- PN | PC | KS | XB | XK | TL | TD
  doc_date      TEXT NOT NULL,             -- yyyy-mm-dd
  partner       TEXT NOT NULL DEFAULT '',  -- NCC / khách / nơi nhận
  ref_no        TEXT NOT NULL DEFAULT '',  -- số phiếu sản xuất của Thảo, mã đơn của sale
  ref_qty       REAL,                      -- số lượng theo phiếu sản xuất (để đối chiếu)
  note          TEXT NOT NULL DEFAULT '',
  extra         TEXT NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'OK',  -- OK | HUY
  created_by    TEXT REFERENCES users (id),
  created_at    TEXT NOT NULL,
  cancelled_by  TEXT REFERENCES users (id),
  cancelled_at  TEXT,
  cancel_reason TEXT
);
CREATE INDEX idx_kho_docs_date ON kho_docs (doc_date, type);

CREATE TABLE kho_moves (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id    INTEGER NOT NULL REFERENCES kho_docs (id),
  item      TEXT NOT NULL REFERENCES kho_items (code),
  qty       REAL NOT NULL,                 -- + nhập / − xuất
  std_qty   REAL,                          -- định mức (chỉ dòng pha chế, để tính chênh lệch)
  price     REAL,                          -- đơn giá (chỉ phiếu nhập)
  role      TEXT NOT NULL DEFAULT '',      -- IN | USE | OUT | PRODUCT | AUTO | RETURN
  note      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_kho_moves_item ON kho_moves (item);
CREATE INDEX idx_kho_moves_doc ON kho_moves (doc_id);

-- Cấu hình nhỏ của kho (ví dụ ngày bắt đầu trừ kho theo đơn B2B).
CREATE TABLE kho_cfg (
  k  TEXT PRIMARY KEY,
  v  TEXT NOT NULL
);

-- Đồng bộ mã CRM B2B → mã MISA. SL trừ kho = SL trên đơn × factor (1 thùng = số can/chai trong thùng).
CREATE TABLE kho_map (
  crm_sku    TEXT PRIMARY KEY,
  misa_code  TEXT NOT NULL REFERENCES kho_items (code),
  factor     REAL NOT NULL DEFAULT 1,
  note       TEXT NOT NULL DEFAULT ''
);

-- Sổ kho tổng hợp = các dòng của phiếu còn hiệu lực + đơn B2B đã xuất kho (từ ngày b2b_from, đã có mã MISA).
-- Đơn B2B không tạo phiếu: trừ ngay khi CRM bấm "Đã xuất kho", hủy / hoàn đơn bên CRM thì kho tự trả lại.
-- Chưa đặt b2b_from thì chưa trừ gì.
CREATE VIEW kho_ledger AS
SELECT m.item AS item, m.qty AS qty, m.std_qty AS std_qty, m.role AS role, d.doc_date AS doc_date,
       d.id AS doc_id, d.type AS doc_type, d.no AS doc_no
FROM kho_moves m JOIN kho_docs d ON d.id = m.doc_id
WHERE d.status = 'OK'
UNION ALL
SELECT km.misa_code, -(oi.qty * km.factor), NULL, 'B2B', substr(o.delivered_at, 1, 10), 0, 'B2B', o.order_no
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN kho_map km ON km.crm_sku = p.sku
WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
  AND o.delivery_status IN ('DA_XUAT_KHO', 'DA_GIAO') AND o.delivered_at IS NOT NULL
  AND substr(o.delivered_at, 1, 10) >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'b2b_from'), '9999-12-31');

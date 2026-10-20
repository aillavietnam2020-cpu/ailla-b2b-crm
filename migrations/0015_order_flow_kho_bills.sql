-- Migration 0015: luồng đơn B2B qua kho (sale → quản lý điều phối → kế toán kho → xuất → chốt tiền)
-- và kho ảnh bill giao dịch.
--
-- orders.flow_on = 1 chỉ cho đơn tạo mới sau khi lên luồng; đơn cũ giữ nguyên cách cũ (kho_status = KHONG).
-- kho_status là bước hiện tại trong luồng kho, tách riêng khỏi approval/delivery/payment/accounting:
--   CHO_DIEU_PHOI  sale đã gửi, quản lý điều phối chưa chuyển kho
--   CHO_KIEM_KHO   chờ kế toán kho kiểm tồn
--   DU_HANG        kho báo đủ hàng, chờ quản lý duyệt + lịch xuất
--   THIEU_HANG     kho báo thiếu: sale báo khách, sửa đơn rồi gửi lại
--   CHO_HANG       khách chịu chờ sản xuất: giữ đơn tới ngày hàng về (hold_until)
--   CHO_XUAT       đã duyệt + có lịch xuất, kho giữ hàng cho đơn này
--   DA_XUAT        kho đã xuất (ghi số thực xuất), chờ quản lý xác nhận
--   CHO_CHOT_TIEN  quản lý đã xác nhận xuất, sale đối chiếu số thực xuất và chốt tiền phải thu
--   DA_CHOT_TIEN   đã chốt tiền, kế toán xác nhận ghi nợ

ALTER TABLE orders ADD COLUMN flow_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN kho_status TEXT NOT NULL DEFAULT 'KHONG';
ALTER TABLE orders ADD COLUMN need_date TEXT;          -- ngày khách cần hàng
ALTER TABLE orders ADD COLUMN ship_date TEXT;          -- lịch xuất hàng do quản lý đặt
ALTER TABLE orders ADD COLUMN hold_until TEXT;         -- giữ chờ hàng tới ngày
ALTER TABLE orders ADD COLUMN kho_note TEXT;
ALTER TABLE orders ADD COLUMN money_locked_at TEXT;
ALTER TABLE orders ADD COLUMN money_locked_by TEXT;

CREATE INDEX ix_orders_kho_status ON orders (flow_on, kho_status);

-- Kết quả kiểm kho và số thực xuất, theo (đơn, sản phẩm). Số lượng theo đơn vị lẻ như order_items.qty.
CREATE TABLE order_kho_lines (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders (id),
  product_id  TEXT NOT NULL REFERENCES products (id),
  status      TEXT NOT NULL DEFAULT 'DU' CHECK (status IN ('DU', 'THIEU')),
  ok_qty      INTEGER,        -- số kho giao được (kiểm kho)
  eta_date    TEXT,           -- ngày dự kiến có hàng / lịch sản xuất
  note        TEXT,
  checked_by  TEXT,
  checked_at  TEXT,
  shipped_qty INTEGER,        -- số thực xuất
  shipped_by  TEXT,
  shipped_at  TEXT
);
CREATE UNIQUE INDEX ux_order_kho_lines ON order_kho_lines (order_id, product_id);

-- Ai báo ai, lúc nào: lịch sử từng bước của đơn.
CREATE TABLE order_flow_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    TEXT NOT NULL REFERENCES orders (id),
  at          TEXT NOT NULL,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT,
  note        TEXT
);
CREATE INDEX ix_order_flow_log ON order_flow_log (order_id, id);

-- Kho ảnh bill giao dịch. File nhỏ (đã thu nhỏ ở trình duyệt, ≤ 1,5 MB) để thẳng trong D1 như hr_files.
CREATE TABLE bills (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  order_id    TEXT REFERENCES orders (id),
  payment_id  TEXT REFERENCES payments (id),
  amount      INTEGER,
  paid_at     TEXT,
  method      TEXT,
  note        TEXT,
  name        TEXT NOT NULL,
  mime        TEXT NOT NULL DEFAULT 'application/octet-stream',
  size        INTEGER NOT NULL,
  data        BLOB NOT NULL,
  created_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX ix_bills_customer ON bills (customer_id, created_at DESC);
CREATE INDEX ix_bills_order ON bills (order_id);
CREATE INDEX ix_bills_payment ON bills (payment_id);

-- Sổ kho: đơn B2B đã xuất trừ theo SỐ THỰC XUẤT nếu kho đã ghi, không thì theo số trên đơn.
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
  AND substr(o.delivered_at, 1, 10) >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'b2b_from'), '9999-12-31');

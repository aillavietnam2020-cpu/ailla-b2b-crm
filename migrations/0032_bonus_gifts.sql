-- Thưởng hàng có mã kho + số lượng để lập phiếu xuất quà; Thảo duyệt mới trừ tồn kho (kho_docs loại XK).
ALTER TABLE bonus_tiers ADD COLUMN gift_items TEXT NOT NULL DEFAULT '[]';

CREATE TABLE bonus_gift_vouchers (
  id            TEXT PRIMARY KEY,
  voucher_no    TEXT NOT NULL UNIQUE,
  customer_id   TEXT NOT NULL REFERENCES customers (id),
  month         TEXT NOT NULL,                 -- 'YYYY-MM' của kỳ thưởng
  level_label   TEXT NOT NULL DEFAULT '',
  retail_sales  INTEGER NOT NULL DEFAULT 0,
  items         TEXT NOT NULL DEFAULT '[]',    -- [{item, name, qty}]
  status        TEXT NOT NULL DEFAULT 'CHO_DUYET' CHECK (status IN ('CHO_DUYET', 'DA_DUYET', 'HUY')),
  kho_doc_no    TEXT,
  created_by    TEXT REFERENCES users (id),
  created_at    TEXT NOT NULL,
  approved_by   TEXT REFERENCES users (id),
  approved_at   TEXT,
  cancel_reason TEXT,
  cancelled_by  TEXT REFERENCES users (id),
  cancelled_at  TEXT
);
-- Mỗi khách mỗi tháng chỉ có một phiếu quà còn hiệu lực.
CREATE UNIQUE INDEX ux_bonus_gift_active ON bonus_gift_vouchers (customer_id, month) WHERE status <> 'HUY';

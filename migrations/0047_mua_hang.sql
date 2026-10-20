-- Mua hàng: phiếu mua (Thảo, bên vận hành, không có giá) → lần nhận hàng (kho báo thực nhận, tự sinh phiếu nhập kho)
-- → giá lúc giao + hóa đơn nhà cung cấp (VAT, vận chuyển, bốc vác) → phiếu chi → công nợ nhà cung cấp (có công nợ đầu kỳ).
-- Giá và tiền chỉ nhập / xem được ở trang quản trị (CEO, quản lý, kế toán).

CREATE TABLE suppliers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  opening_debt  INTEGER NOT NULL DEFAULT 0,     -- công nợ đầu kỳ (đồng, dương = mình còn nợ nhà cung cấp)
  opening_date  TEXT,                           -- ngày chốt công nợ đầu kỳ
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE po_orders (
  id           TEXT PRIMARY KEY,
  no           TEXT NOT NULL UNIQUE,            -- PM2610-001
  order_date   TEXT NOT NULL,
  supplier_id  TEXT NOT NULL REFERENCES suppliers (id),
  note         TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'DAT' CHECK (status IN ('DAT', 'DANG_GIAO', 'DU', 'HUY')),
  created_by   TEXT REFERENCES users (id),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX ix_po_orders_status ON po_orders (status, order_date);

CREATE TABLE po_lines (
  id      TEXT PRIMARY KEY,
  po_id   TEXT NOT NULL REFERENCES po_orders (id),
  item    TEXT NOT NULL REFERENCES kho_items (code),
  qty     REAL NOT NULL CHECK (qty > 0),        -- số lượng đặt
  note    TEXT NOT NULL DEFAULT '',
  sort    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ix_po_lines_po ON po_lines (po_id);

-- Mỗi lần giao là một lần nhận: số thực nhận có thể khác số đặt. Tự sinh phiếu nhập kho (kho_docs loại PN).
CREATE TABLE po_receipts (
  id            TEXT PRIMARY KEY,
  po_id         TEXT NOT NULL REFERENCES po_orders (id),
  receipt_date  TEXT NOT NULL,
  kho_doc_id    INTEGER,
  note          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'OK' CHECK (status IN ('OK', 'HUY')),
  created_by    TEXT REFERENCES users (id),
  created_at    TEXT NOT NULL
);
CREATE INDEX ix_po_receipts_po ON po_receipts (po_id);

CREATE TABLE po_receipt_lines (
  id            TEXT PRIMARY KEY,
  receipt_id    TEXT NOT NULL REFERENCES po_receipts (id),
  po_line_id    TEXT REFERENCES po_lines (id),
  item          TEXT NOT NULL REFERENCES kho_items (code),
  qty           REAL NOT NULL CHECK (qty > 0),   -- số thực nhận
  unit_price    REAL,                            -- giá lúc giao (trước phí phát sinh); trống = chưa nhập giá
  kho_move_id   INTEGER                          -- dòng nhập kho tương ứng, để cập nhật giá vốn khi có giá
);
CREATE INDEX ix_po_rl_receipt ON po_receipt_lines (receipt_id);

CREATE TABLE po_invoices (
  id            TEXT PRIMARY KEY,
  supplier_id   TEXT NOT NULL REFERENCES suppliers (id),
  invoice_no    TEXT NOT NULL DEFAULT '',
  invoice_date  TEXT NOT NULL,
  goods_amount  INTEGER NOT NULL DEFAULT 0,      -- tiền hàng
  vat_amount    INTEGER NOT NULL DEFAULT 0,
  freight       INTEGER NOT NULL DEFAULT 0,      -- phí vận chuyển
  handling      INTEGER NOT NULL DEFAULT 0,      -- bốc vác
  other         INTEGER NOT NULL DEFAULT 0,
  vat_in_cost   INTEGER NOT NULL DEFAULT 0,      -- 1 = tính VAT vào giá vốn (không được khấu trừ)
  total         INTEGER NOT NULL DEFAULT 0,      -- tổng phải trả
  receipt_ids   TEXT NOT NULL DEFAULT '[]',      -- các lần nhận hàng thuộc hóa đơn này
  note          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'OK' CHECK (status IN ('OK', 'HUY')),
  created_by    TEXT REFERENCES users (id),
  created_at    TEXT NOT NULL
);
CREATE INDEX ix_po_invoices_supplier ON po_invoices (supplier_id, invoice_date);

CREATE TABLE po_payments (
  id           TEXT PRIMARY KEY,
  supplier_id  TEXT NOT NULL REFERENCES suppliers (id),
  invoice_id   TEXT REFERENCES po_invoices (id),
  pay_date     TEXT NOT NULL,
  amount       INTEGER NOT NULL CHECK (amount > 0),
  account      TEXT NOT NULL DEFAULT '',          -- tài khoản / hình thức chi
  note         TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'OK' CHECK (status IN ('OK', 'HUY')),
  created_by   TEXT REFERENCES users (id),
  created_at   TEXT NOT NULL
);
CREATE INDEX ix_po_payments_supplier ON po_payments (supplier_id, pay_date);

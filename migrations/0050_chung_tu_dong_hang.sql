-- Dòng hàng nhập tay trên chứng từ nhà cung cấp (chứng từ chưa gắn lần nhận hàng của kho).
CREATE TABLE po_invoice_lines (
  id          TEXT PRIMARY KEY,
  invoice_id  TEXT NOT NULL REFERENCES po_invoices (id),
  item        TEXT NOT NULL REFERENCES kho_items (code),
  qty         REAL NOT NULL,
  unit_price  REAL NOT NULL
);
CREATE INDEX ix_po_invoice_lines_inv ON po_invoice_lines (invoice_id);

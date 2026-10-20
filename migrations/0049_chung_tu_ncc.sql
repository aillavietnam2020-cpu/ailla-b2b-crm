-- Chứng từ nhà cung cấp: phiếu giao hàng / bill (PG) hoặc hóa đơn VAT (HD), kèm ảnh hoặc PDF đính kèm.
ALTER TABLE po_invoices ADD COLUMN doc_type TEXT NOT NULL DEFAULT 'HD';

CREATE TABLE po_files (
  id          TEXT PRIMARY KEY,
  invoice_id  TEXT NOT NULL REFERENCES po_invoices (id),
  name        TEXT NOT NULL DEFAULT '',
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL DEFAULT 0,
  data        TEXT NOT NULL,                -- nội dung file dạng base64 (ảnh đã nén trước khi tải lên)
  created_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_po_files_invoice ON po_files (invoice_id);

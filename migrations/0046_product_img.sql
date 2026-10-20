-- Ảnh sản phẩm (một ảnh chính mỗi sản phẩm): ảnh đã nén nhỏ ở trình duyệt, lưu base64 như ảnh vỏ.
CREATE TABLE product_img (
  product_id TEXT PRIMARY KEY REFERENCES products (id),
  mime       TEXT NOT NULL,
  data       TEXT NOT NULL,
  thumb      TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users (id),
  updated_at TEXT NOT NULL
);

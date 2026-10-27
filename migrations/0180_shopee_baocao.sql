-- Báo cáo kênh Shopee trên web (2 shop: Mall + thường), làm 27/10/2026 theo cách của TikTok (0130).
-- spe_month: số tháng của từng shop từ file Shopee (đơn + Tài chính + quảng cáo Dịch vụ Hiển thị). Chỉ CEO, kế toán.
--   summary: tổng tháng + số theo ngày [doanh thu, phí sàn, giá vốn, lãi gộp, đơn, quảng cáo] → gộp vào DAYD.spe.
--   data: dòng sản phẩm (không có mã đơn, tên, số điện thoại, địa chỉ khách: file đơn chỉ đọc ở trình duyệt).
--   Tải lại thì bản mới thay bản cũ của đúng tháng + shop; bản giữa tháng không đè bản đủ tháng.
CREATE TABLE IF NOT EXISTS spe_month (
  ky         TEXT NOT NULL,
  shop       TEXT NOT NULL,
  data       TEXT NOT NULL,
  summary    TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (ky, shop)
);

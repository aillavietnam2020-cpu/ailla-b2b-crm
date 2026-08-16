-- Migration 0005: cho phép commit import theo từng chặng.
--
-- Lý do: file CRM thật có 134 sản phẩm x 8 cấp giá (1072 dòng giá) + 62 khách + 35 đơn +
-- 206 dòng hàng + 25 phiếu thu. Ghi hết trong MỘT request vượt hạn mức xử lý của Cloudflare
-- Workers (lỗi 1102), và request bị cắt giữa chừng.
--
-- Cách xử lý: chia commit thành các chặng (catalog → customers → orders → payments → finalize),
-- mỗi chặng là một request riêng. Cột này ghi lại các chặng đã xong để chạy tiếp đúng chỗ,
-- không ghi trùng dữ liệu.

ALTER TABLE import_batches ADD COLUMN progress_json TEXT;

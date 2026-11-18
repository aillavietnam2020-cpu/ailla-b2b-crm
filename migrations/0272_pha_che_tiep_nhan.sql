-- Kỹ thuật pha chế tiếp nhận yêu cầu pha chế / xin dời hạn, người tạo trả lời, trao đổi qua lại (chị Hoa duyệt demo 18/11/2026).
-- Chỉ thêm cột / bảng, không đụng dữ liệu cũ. Yêu cầu cũ coi như "Chờ tiếp nhận".
ALTER TABLE pc_req ADD COLUMN tiep_nhan TEXT NOT NULL DEFAULT 'CHO';   -- CHO (chờ tiếp nhận) · NHAN (đã tiếp nhận) · XIN (xin dời hạn, chờ người tạo trả lời)
ALTER TABLE pc_req ADD COLUMN xin_han TEXT;                             -- ngày kỹ thuật xin dời đến
ALTER TABLE pc_req ADD COLUMN xin_ly TEXT;                              -- lý do xin dời
ALTER TABLE pc_req ADD COLUMN nhan_by_name TEXT;
ALTER TABLE pc_req ADD COLUMN nhan_at TEXT;

-- Nhật ký từng yêu cầu: tiếp nhận, xin dời, trả lời, đổi hạn, tin nhắn trao đổi.
CREATE TABLE IF NOT EXISTS pc_req_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id     TEXT NOT NULL,
  kind       TEXT NOT NULL,      -- TAO · NHAN · XIN · DONGY · DOI · GIU · SUA · MSG
  ben        TEXT NOT NULL,      -- KT (kỹ thuật pha chế) · MH (người tạo / mua hàng)
  by_id      TEXT,
  by_name    TEXT NOT NULL DEFAULT '',
  text       TEXT NOT NULL DEFAULT '',
  han_cu     TEXT,
  han_moi    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pc_req_log_req ON pc_req_log (req_id, id);

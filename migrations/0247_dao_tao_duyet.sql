-- Đào tạo: mọi tài liệu do người khác CEO tạo / sửa đều phải chị Hoa duyệt (02/11/2026).
-- Tài liệu đang hiện mà Lead sửa: bản sửa nằm ở pending (JSON), mọi người vẫn đọc bản đã duyệt cho tới khi CEO duyệt.
ALTER TABLE dt_doc ADD COLUMN approved_at TEXT;
ALTER TABLE dt_doc ADD COLUMN pending TEXT NOT NULL DEFAULT '';
ALTER TABLE dt_doc ADD COLUMN pending_by TEXT;
ALTER TABLE dt_doc ADD COLUMN pending_at TEXT;
-- Lời nhắn khi CEO trả lại để người soạn sửa.
ALTER TABLE dt_doc ADD COLUMN review_note TEXT;
-- Tài liệu đang hiện từ trước: coi lần đăng là lần duyệt.
UPDATE dt_doc SET approved_at = COALESCE(published_at, updated_at) WHERE status = 'dang' AND approved_at IS NULL;

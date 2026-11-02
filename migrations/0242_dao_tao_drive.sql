-- Đào tạo: tài liệu có thể soạn trong Google Docs (chị Hoa 02/11). Web đọc file qua tài khoản máy (chỉ xem),
-- chép nội dung vào body để ai được xem trên web đều đọc được, tự lấy lại khi file trên Drive được sửa.
-- drive_id: mã file Google Docs ('' = soạn trên web) · drive_mod: lần sửa cuối trên Drive đã chép · drive_sync_at: lần web hỏi Drive gần nhất
ALTER TABLE dt_doc ADD COLUMN drive_id TEXT NOT NULL DEFAULT '';
ALTER TABLE dt_doc ADD COLUMN drive_mod TEXT NOT NULL DEFAULT '';
ALTER TABLE dt_doc ADD COLUMN drive_sync_at TEXT;

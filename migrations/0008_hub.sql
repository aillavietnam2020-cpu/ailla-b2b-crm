-- Migration 0008: khu Marketing & công việc (trang /hub/).
--
-- Toàn bộ dữ liệu khu Marketing (kế hoạch tháng, thẻ video, giao việc, phiếu điều chỉnh, trợ lý AI...)
-- là MỘT bản ghi JSON nén gzip. Mỗi lần ghi phải kèm số phiên bản đang cầm; lệch số là có người
-- vừa sửa trước, trình duyệt tải bản mới về, áp lại thao tác của mình rồi ghi lại (không mất việc của ai).

CREATE TABLE hub_state (
  id          TEXT PRIMARY KEY,           -- 'main'
  version     INTEGER NOT NULL,
  data        TEXT NOT NULL,              -- JSON nén gzip, mã hoá base64
  updated_at  TEXT NOT NULL,
  updated_by  TEXT REFERENCES users (id)
);

-- Dữ liệu nạp từ file báo cáo (TikTok tuần, kinh doanh các kênh, giá vốn SKU). Không nằm trong
-- file giao diện công khai, chỉ trả về cho người đã đăng nhập có quyền.
CREATE TABLE hub_blobs (
  key         TEXT PRIMARY KEY,
  data        TEXT NOT NULL,              -- JSON nén gzip, mã hoá base64
  admin_only  INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT REFERENCES users (id)
);

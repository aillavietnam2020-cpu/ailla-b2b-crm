-- Migration 0006: quyền bổ sung theo từng người, dùng cho vai trò Kế toán.
--
-- Luồng thật của công ty:
--   Sale tạo đơn → gửi Quản lý → Quản lý tích "đã xuất kho"/"đã giao"
--   → Sale tích "tiền về" (ghi nhận, CHƯA vào công nợ chính thức)
--   → Kế toán xác nhận thì khoản tiền và đơn mới vào công nợ chính thức.
--
-- Kế toán không phải một trong ba vai trò gốc (Nhân viên/Quản lý/CEO) mà là quyền cộng thêm,
-- nên lưu riêng ở đây thay vì đổi cột role (đổi cột role phải dựng lại bảng users, mà D1
-- chặn vì có nhiều bảng tham chiếu tới users).

CREATE TABLE user_permissions (
  user_id    TEXT NOT NULL REFERENCES users (id),
  permission TEXT NOT NULL,
  granted_by TEXT REFERENCES users (id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, permission)
);

CREATE INDEX ix_user_permissions_user ON user_permissions (user_id);

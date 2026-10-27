-- Migration 0084: agent Kế toán trưởng được tự lập phiếu chi khi người được chỉ định (chị Thảo) ra lệnh (chị Hoa đồng ý 27/10/2026).
-- Công tắc là quyền 'agent.phieuchi' của tài khoản agent (bật/tắt ở Cấu hình › Quyền agent). Chỉ thêm dòng quyền, không sửa gì khác.
INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at)
SELECT DISTINCT g.agent_id, 'agent.phieuchi', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM agent_delegators g
WHERE g.chat_agent LIKE 'ke-toan-truong%';

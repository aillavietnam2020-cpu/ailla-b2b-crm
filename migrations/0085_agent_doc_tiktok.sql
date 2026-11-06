-- Migration 0085: cấp phạm vi CHỈ ĐỌC 'doc_tiktok' (GET /api/agent/tiktok/read) cho 4 agent: Lead Content, Lead Digital, Đăng (TikTok shop), Lead Sale
-- (chị Hoa giao 06/11/2026: agent đọc lại số TikTok đã nạp trên web, đỡ vào TikTok Seller Center). Không cấp quyền ghi nào.
-- Nhận agent theo tên chat (agent_delegators.chat_agent) hoặc theo tên agent; agent chưa tạo thì chị tick sau ở quantri › Agent AI.
INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at)
SELECT DISTINCT a.id, 'agent.scope.doc_tiktok', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM agents a
WHERE a.status = 'ACTIVE'
  AND (
    a.id IN (SELECT g.agent_id FROM agent_delegators g WHERE g.chat_agent IN ('lead-content-ailla', 'lead-digital-ailla', 'ailla-tiktok-shop', 'lead-sale-ailla'))
    OR a.name IN ('Lead Content', 'Lead Digital', 'Đăng', 'Lead Sale')
  );

-- Migration 0055: phạm vi đọc theo vai cho từng agent (bảng phân quyền chị Hoa duyệt 20/10/2026).
-- Phạm vi lưu trong user_permissions dạng 'agent.scope.<tên>' (xem AGENT_SCOPES trong shared/agent.ts).
-- Agent không có phạm vi nào thì không đọc được dữ liệu nghiệp vụ. Zalo trợ lý tạm không có phạm vi nào.

INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at)
WITH s(name, scope) AS (
  VALUES
    -- AILLA Center: thấy hết
    ('AILLA Center', 'orders'), ('AILLA Center', 'debts'), ('AILLA Center', 'kho'),
    ('AILLA Center', 'mkt_content'), ('AILLA Center', 'mkt_digital'), ('AILLA Center', 'xuong'),
    -- Sale và Kế toán trưởng: đơn, khách và công nợ
    ('Lead Sale', 'orders'), ('Lead Sale', 'debts'),
    ('Kế toán trưởng', 'orders'), ('Kế toán trưởng', 'debts'),
    -- Kế toán kho: kho + đơn đang chờ kho
    ('Kế toán kho', 'kho'), ('Kế toán kho', 'orders_kho'),
    -- Kỹ thuật sản xuất: kho, hóa chất, phiếu pha chế
    ('Kỹ thuật sản xuất', 'kho'),
    -- Content, Media: team Content + Công xưởng SX video
    ('Lead Content', 'mkt_content'), ('Lead Content', 'xuong'),
    ('Media', 'mkt_content'), ('Media', 'xuong'),
    -- Digital và 3 Ads: team Digital
    ('Lead Digital', 'mkt_digital'), ('Ads Duẩn', 'mkt_digital'),
    ('Ads Thảo Đinh', 'mkt_digital'), ('Ads Việt Anh', 'mkt_digital')
)
SELECT a.id, 'agent.scope.' || s.scope, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM agents a JOIN s ON s.name = a.name;

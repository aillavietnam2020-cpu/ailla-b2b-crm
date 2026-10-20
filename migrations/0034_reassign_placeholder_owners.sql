-- Khách và đơn nhập từ Sheet CRM gắn cho tài khoản GIỮ CHỖ (huyen@ailla.vn, thao@ailla.vn: đã khóa, không đăng nhập được)
-- theo cột "Sale phụ trách". Sale thật đăng nhập bằng tài khoản khác nên mở "Khách của tôi" không thấy gì.
-- Chuyển chủ sang tài khoản thật và chuyển luôn tên Sheet (legacy_name) để lần nhập sau gắn đúng người.
-- Chỉ chạy khi tài khoản thật có tồn tại (môi trường thử không có thì không đổi gì).

-- Huyền: Phạm Thị Thu Huyền (huyenphamheracos@gmail.com)
UPDATE customers SET owner_id = '5d6b32bb-db63-4b24-b02a-5d7845d29e0f'
  WHERE owner_id = 'user-huyen' AND EXISTS (SELECT 1 FROM users WHERE id = '5d6b32bb-db63-4b24-b02a-5d7845d29e0f');
UPDATE orders SET owner_id = '5d6b32bb-db63-4b24-b02a-5d7845d29e0f'
  WHERE owner_id = 'user-huyen' AND EXISTS (SELECT 1 FROM users WHERE id = '5d6b32bb-db63-4b24-b02a-5d7845d29e0f');
UPDATE tasks SET assignee_id = '5d6b32bb-db63-4b24-b02a-5d7845d29e0f'
  WHERE assignee_id = 'user-huyen' AND EXISTS (SELECT 1 FROM users WHERE id = '5d6b32bb-db63-4b24-b02a-5d7845d29e0f');
UPDATE alerts SET owner_id = '5d6b32bb-db63-4b24-b02a-5d7845d29e0f'
  WHERE owner_id = 'user-huyen' AND EXISTS (SELECT 1 FROM users WHERE id = '5d6b32bb-db63-4b24-b02a-5d7845d29e0f');

-- Thảo: thaonguyen1705@scgdrive.com (quản lý điều phối)
UPDATE customers SET owner_id = '41fa1233-6bf8-4d7f-81de-10898a34dc45'
  WHERE owner_id = 'user-thao' AND EXISTS (SELECT 1 FROM users WHERE id = '41fa1233-6bf8-4d7f-81de-10898a34dc45');
UPDATE orders SET owner_id = '41fa1233-6bf8-4d7f-81de-10898a34dc45'
  WHERE owner_id = 'user-thao' AND EXISTS (SELECT 1 FROM users WHERE id = '41fa1233-6bf8-4d7f-81de-10898a34dc45');
UPDATE tasks SET assignee_id = '41fa1233-6bf8-4d7f-81de-10898a34dc45'
  WHERE assignee_id = 'user-thao' AND EXISTS (SELECT 1 FROM users WHERE id = '41fa1233-6bf8-4d7f-81de-10898a34dc45');
UPDATE alerts SET owner_id = '41fa1233-6bf8-4d7f-81de-10898a34dc45'
  WHERE owner_id = 'user-thao' AND EXISTS (SELECT 1 FROM users WHERE id = '41fa1233-6bf8-4d7f-81de-10898a34dc45');

-- Tên Sheet: bỏ khỏi tài khoản giữ chỗ trước (cột legacy_name là duy nhất), rồi gắn cho tài khoản thật.
UPDATE users SET legacy_name = NULL
  WHERE id IN ('user-huyen', 'user-thao')
    AND EXISTS (SELECT 1 FROM users WHERE id = '5d6b32bb-db63-4b24-b02a-5d7845d29e0f')
    AND EXISTS (SELECT 1 FROM users WHERE id = '41fa1233-6bf8-4d7f-81de-10898a34dc45');
UPDATE users SET legacy_name = 'Huyền' WHERE id = '5d6b32bb-db63-4b24-b02a-5d7845d29e0f' AND legacy_name IS NULL
  AND NOT EXISTS (SELECT 1 FROM users WHERE legacy_name = 'Huyền');
UPDATE users SET legacy_name = 'Thảo' WHERE id = '41fa1233-6bf8-4d7f-81de-10898a34dc45' AND legacy_name IS NULL
  AND NOT EXISTS (SELECT 1 FROM users WHERE legacy_name = 'Thảo');

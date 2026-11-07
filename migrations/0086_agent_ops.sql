-- Điều hành agent: sơ đồ tổ chức + bộ não phòng ban (CEO duyệt bản D + H ngày 07/11/2026).
-- Chỉ thêm bảng mới, không đụng bảng cũ.

-- Trạng thái từng agent do cầu nối trên VPS gửi lên (mỗi agent một dòng, ghi đè).
CREATE TABLE IF NOT EXISTS agent_ops_status (
  agent TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'idle',      -- work | wait | stuck | err | idle | off
  task TEXT,                               -- việc đang làm (1 dòng)
  by_who TEXT,                             -- ai giao / lịch nào
  wait_for TEXT,                           -- đang chờ ai (mã agent hoặc tên vai người)
  with_json TEXT,                          -- đang phối hợp với ai: ["media-ailla-agent","CEO"]
  since TEXT,
  next_run TEXT,                           -- lượt chạy tới (chữ, ví dụ "11:45 · lượt đăng")
  tokens_today INTEGER,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

-- Năng lực: skill, file kiến thức, lịch chạy (workflow) của từng agent, máy chủ gửi lên.
CREATE TABLE IF NOT EXISTS agent_ops_profile (
  agent TEXT PRIMARY KEY,
  skills_json TEXT NOT NULL DEFAULT '[]',
  knowledge_json TEXT NOT NULL DEFAULT '[]',
  crons_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

-- Nhật ký agent tự ghi (giao việc, xong việc, lỗi...). Giữ 14 ngày.
CREATE TABLE IF NOT EXISTS agent_ops_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL,
  at TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note',       -- giao | xong | loi | cho | note
  text TEXT NOT NULL,
  to_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_ops_log_at ON agent_ops_log (at);

-- Phòng ban của bộ máy agent (CEO sửa trên web).
CREATE TABLE IF NOT EXISTS agent_dept (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  lead_role TEXT,                          -- trưởng phòng (vai người)
  agent_lead TEXT,                         -- agent trưởng
  goal TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Agent thuộc phòng nào, cấp trên là ai. Agent chưa có trong danh sách nhắn tin thì ghi tên/biểu tượng ở đây.
CREATE TABLE IF NOT EXISTS agent_dept_member (
  agent TEXT PRIMARY KEY,
  dept TEXT NOT NULL,
  parent TEXT,                             -- mã agent cấp trên (trống = đứng đầu phòng)
  sort INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  title TEXT,
  emoji TEXT,
  color TEXT,
  updated_at TEXT NOT NULL
);

-- Ghi chú của phòng: kiến thức chung (kn), quyết định đã chốt (decision), người thật trong phòng (person).
CREATE TABLE IF NOT EXISTS agent_dept_note (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dept TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_dept_note_dept ON agent_dept_note (dept, kind);

-- ---------- Dữ liệu ban đầu (CEO sửa lại trên web được) ----------
INSERT OR IGNORE INTO agent_dept (id, name, icon, lead_role, agent_lead, goal, sort, updated_at) VALUES
 ('dh', 'Điều hành', '🧭', 'CEO', 'main', 'Không việc nào chờ CEO quá 4 giờ', 1, '2026-11-07T00:00:00.000Z'),
 ('kd', 'Kinh doanh', '🛒', 'Lead Sale', 'lead-sale-ailla', 'Trả lời khách TikTok dưới 30 phút', 2, '2026-11-07T00:00:00.000Z'),
 ('mk', 'Marketing', '📣', 'Lead Content', 'lead-content-ailla', 'Ads dưới 38% doanh thu thực', 3, '2026-11-07T00:00:00.000Z'),
 ('kt', 'Kế toán · Kho · SX', '🧾', 'Kế toán trưởng', 'ke-toan-truong-ailla', 'Chốt sổ ngày 10 đúng hạn', 4, '2026-11-07T00:00:00.000Z');

INSERT OR IGNORE INTO agent_dept_member (agent, dept, parent, sort, name, title, emoji, color, updated_at) VALUES
 ('main', 'dh', NULL, 1, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('zalo-tro-ly-hoa', 'dh', NULL, 2, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('lead-sale-ailla', 'kd', NULL, 1, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('ailla-tiktok-shop', 'kd', 'lead-sale-ailla', 2, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('sale-b2b-ailla', 'kd', 'lead-sale-ailla', 3, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('lead-content-ailla', 'mk', NULL, 1, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('media-ailla-agent', 'mk', 'lead-content-ailla', 2, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('lead-digital-ailla', 'mk', NULL, 3, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('duan-ads-agent', 'mk', 'lead-digital-ailla', 4, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('viet-anh-ads-agent', 'mk', 'lead-digital-ailla', 5, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('thaodinh-ads-agent', 'mk', 'lead-digital-ailla', 6, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('ke-toan-truong-ailla', 'kt', NULL, 1, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('ke-toan-kho-ailla', 'kt', 'ke-toan-truong-ailla', 2, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z'),
 ('ky-thuat-san-xuat-ailla', 'kt', 'ke-toan-truong-ailla', 3, NULL, NULL, NULL, NULL, '2026-11-07T00:00:00.000Z');

INSERT INTO agent_dept_note (dept, kind, title, body, created_by, created_at, updated_at) VALUES
 ('dh', 'kn', 'Ngưỡng chi 5 triệu CEO duyệt', 'Khoản chi trên 5 triệu phải CEO duyệt trước khi chi.', 'u_chi', '2026-11-07T00:00:00.000Z', '2026-11-07T00:00:00.000Z'),
 ('dh', 'kn', 'Giờ cấm khởi động lại máy chủ agent', '7h–8h30 thứ Hai và cả ngày 10 (giờ tải và chốt báo cáo).', 'u_chi', '2026-11-07T00:00:00.000Z', '2026-11-07T00:00:00.000Z'),
 ('kd', 'kn', 'Sổ tay CSKH TikTok', 'Câu trả lời mẫu cho khách; chỉ tự trả lời câu sản phẩm khi sổ tay đã được CEO duyệt.', 'u_chi', '2026-11-07T00:00:00.000Z', '2026-11-07T00:00:00.000Z'),
 ('kd', 'kn', 'Chương trình khuyến mãi sàn', 'Danh sách chương trình sàn đang chạy (tiktok/chuong-trinh-san.md).', 'u_chi', '2026-11-07T00:00:00.000Z', '2026-11-07T00:00:00.000Z'),
 ('mk', 'kn', 'Ngưỡng quảng cáo 38% doanh thu thực', 'Cảnh báo khi chi quảng cáo vượt 38% doanh thu thực.', 'u_chi', '2026-11-07T00:00:00.000Z', '2026-11-07T00:00:00.000Z'),
 ('mk', 'kn', 'Quy ước tên chiến dịch', 'Cách đọc tên chiến dịch (AVN là page, XM, TLAi…).', 'u_chi', '2026-11-07T00:00:00.000Z', '2026-11-07T00:00:00.000Z'),
 ('kt', 'kn', 'Lãi lỗ tính trên doanh thu thực', 'Không dùng GMV, không dùng doanh thu chốt, không ước tỷ lệ.', 'u_chi', '2026-11-07T00:00:00.000Z', '2026-11-07T00:00:00.000Z'),
 ('kt', 'kn', 'Bài học kế toán', 'knowledge/BAI-HOC-KE-TOAN trên máy chủ agent.', 'u_chi', '2026-11-07T00:00:00.000Z', '2026-11-07T00:00:00.000Z'),
 ('dh', 'decision', 'Web ghi vai trò, không ghi tên người', NULL, 'u_chi', '2026-11-02T00:00:00.000Z', '2026-11-02T00:00:00.000Z'),
 ('dh', 'decision', 'Chi trên 5 triệu phải CEO duyệt', NULL, 'u_chi', '2026-10-27T00:00:00.000Z', '2026-10-27T00:00:00.000Z'),
 ('kd', 'decision', 'CSKH chỉ tự trả lời câu sản phẩm khi sổ tay đã duyệt', NULL, 'u_chi', '2026-10-31T00:00:00.000Z', '2026-10-31T00:00:00.000Z'),
 ('mk', 'decision', 'Video final: Lead Content duyệt rồi CEO duyệt', NULL, 'u_chi', '2026-11-03T00:00:00.000Z', '2026-11-03T00:00:00.000Z'),
 ('kt', 'decision', 'Lãi lỗ tính trên doanh thu thực, không dùng GMV', NULL, 'u_chi', '2026-10-25T00:00:00.000Z', '2026-10-25T00:00:00.000Z'),
 ('mk', 'person', 'Lead Content', 'Người duyệt video trước CEO', 'u_chi', '2026-11-07T00:00:00.000Z', '2026-11-07T00:00:00.000Z'),
 ('kt', 'person', 'Kế toán', 'Xác nhận số đếm kho, chứng từ', 'u_chi', '2026-11-07T00:00:00.000Z', '2026-11-07T00:00:00.000Z');

-- Skill thật trên máy chủ agent ngày 06/11/2026 (máy chủ gửi bản mới sẽ ghi đè).
INSERT OR IGNORE INTO agent_ops_profile (agent, skills_json, knowledge_json, crons_json, updated_at) VALUES
 ('main', '["abos-web","dieu-hanh-agent","hoi-agent","facebook-ads","facebook-binh-luan","facebook-fanpage","facebook-page-publisher","hoc-tin-nhan-fanpage","meta-messenger-ads-portable-launch","tao-anh-thuong-hieu","tem-san-xuat","tiktok-content-publisher","tiktok-shop"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('ke-toan-truong-ailla', '["abos-web","bao-cao-dong-tien","bao-cao-tai-chinh","ke-khai-thue","lap-ke-hoach-tai-chinh","lap-phieu-thu-chi","nap-bao-cao-tiktok","phan-tich-tai-chinh","quan-ly-cong-no","quan-ly-hang-ton-kho","quan-ly-ngan-sach","tem-san-xuat","tinh-luong-thuong"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md","TOOLS.md","knowledge/BAI-HOC-KE-TOAN","knowledge/DAO-TAO-KE-TOAN-TRUONG","knowledge/BAO-VIEC-8H30","knowledge/AILLA_COMMON_HANDOFF"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('ke-toan-kho-ailla', '["abos-web"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('ky-thuat-san-xuat-ailla', '["abos-web"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('sale-b2b-ailla', '["abos-web"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('zalo-tro-ly-hoa', '["abos-web"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('lead-content-ailla', '["abos-web","hypit-local-safe","nhan-link-video-drive","tao-anh-thuong-hieu","tiktok-chung","tiktok-content-publisher","tiktok-koc-affiliate","tiktok-noi-dung-live","tiktok-shop-media-livestream","tiktok-shop-seller-center-ai-operator","tiktok-shop-tap-affiliate-creator-management"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md","tiktok/README.md","tiktok/DUONG-DAN.md","tiktok/DRIVE.md","tiktok/NGUOI-PHU-TRACH.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('lead-digital-ailla', '["abos-web","hypit-local-safe","meta-ads-conversion","meta-messenger-ads-portable-launch","tao-anh-thuong-hieu","tiktok-ads","tiktok-chung","tiktok-shop-ads-gmv-max-optimization","tiktok-shop-seller-center-ai-operator"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md","tiktok/README.md","tiktok/DUONG-DAN.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('lead-sale-ailla', '["abos-web","tiktok-chung","tiktok-cskh","tiktok-shop-fulfillment-customer-service","tiktok-shop-seller-center-ai-operator"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md","tiktok/README.md","tiktok/DUONG-DAN.md","tiktok/NGUOI-PHU-TRACH.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('media-ailla-agent', '["abos-web","hypit-local-safe","tao-anh-thuong-hieu","tiktok-content-publisher"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('duan-ads-agent', '["abos-web","caption-ads-facebook-ailla","facebook-ads","facebook-fanpage","facebook-page-video-seeding","hypit-local-safe","meta-ads-conversion","meta-messenger-ads-portable-launch"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('viet-anh-ads-agent', '["abos-web","caption-ads-facebook-ailla","facebook-ads","facebook-fanpage","facebook-page-video-seeding","hypit-local-safe","meta-ads-conversion","meta-messenger-ads-portable-launch"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('thaodinh-ads-agent', '["abos-web","caption-ads-facebook-ailla","facebook-ads","facebook-fanpage","facebook-page-video-seeding","hypit-local-safe","meta-ads-conversion","meta-messenger-ads-portable-launch"]', '["AGENTS.md","IDENTITY.md","SOUL.md","USER.md","MEMORY.md"]', '[]', '2026-11-06T00:00:00.000Z'),
 ('ailla-tiktok-shop', '["abos-web","tiktok-chung","tiktok-van-hanh"]', '["AGENTS.md","IDENTITY.md","USER.md","tiktok/README.md","tiktok/DUONG-DAN.md","tiktok/chuong-trinh-san.md","tiktok/KHO-BAO-CAO.md"]', '[]', '2026-11-06T00:00:00.000Z');

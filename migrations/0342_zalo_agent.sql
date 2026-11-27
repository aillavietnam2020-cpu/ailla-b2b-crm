-- Zalo trong CRM: nối Hộp tin với agent CSKH B2B (chị Hoa đồng ý 27/11/2026). Khối số 0340–0349.
-- Nháp trả lời và đơn nháp của agent lưu cùng chỗ với nháp AI (zalo_ai). Chỉ thêm cột.
ALTER TABLE zalo_ai ADD COLUMN source TEXT NOT NULL DEFAULT 'ai';     -- ai · agent
ALTER TABLE zalo_ai ADD COLUMN order_json TEXT NOT NULL DEFAULT '';   -- {"lines":[{"sku","qty"}],"note"} agent gợi ý

-- Migration 0057: đồng bộ tin Telegram của chị Hoa với agent lên trang Điều hành agent (từ lúc bật trở đi).
-- source: WEB = chị gõ trên web; TELEGRAM = chép từ nhật ký cuộc trò chuyện trên VPS.
-- ext_id: mã tin gốc (phiên:số thứ tự) để chép lại cũng không bị trùng.

ALTER TABLE agent_chat ADD COLUMN source TEXT NOT NULL DEFAULT 'WEB';
ALTER TABLE agent_chat ADD COLUMN ext_id TEXT;
CREATE UNIQUE INDEX ux_agent_chat_ext ON agent_chat (ext_id) WHERE ext_id IS NOT NULL;

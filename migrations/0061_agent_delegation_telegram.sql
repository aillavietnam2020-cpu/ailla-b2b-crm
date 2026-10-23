-- Migration 0061: người được chỉ định ra lệnh cho agent cũng có thể ra lệnh qua Telegram (định danh Telegram do OpenClaw xác nhận, không do agent tự khai).
ALTER TABLE agent_delegators ADD COLUMN telegram_id TEXT;
ALTER TABLE agent_delegations ADD COLUMN source TEXT NOT NULL DEFAULT 'WEB';

-- Migration 0082: tin nhắn trong màn Hội thoại có thể kèm ảnh (danh sách đường dẫn https, dạng JSON). Chỉ thêm cột.
ALTER TABLE agent_train_msgs ADD COLUMN images TEXT NOT NULL DEFAULT '';

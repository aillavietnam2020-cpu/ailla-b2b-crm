-- Migration 0080: bản xem trước (JSON/chữ) của file agent gửi lên web, để mở ngay trong khung xem bên phải mà không tải về.
-- Excel, Word được cầu nối đọc sẵn thành bảng/chữ; markdown, txt, csv, json thì web đọc thẳng từ file.
ALTER TABLE agent_chat_docs ADD COLUMN preview TEXT;

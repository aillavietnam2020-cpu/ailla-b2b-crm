-- Tên chuẩn của vỏ: tự ghép từ loại, dung tích, kiểu, màu nhưng cho gõ đè. Trống = dùng tên tự ghép.
ALTER TABLE kho_vo ADD COLUMN std_name TEXT NOT NULL DEFAULT '';

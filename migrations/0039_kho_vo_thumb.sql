-- Ảnh thu nhỏ (khoảng 240px) cho lưới ảnh vỏ: trang mở nhanh, ảnh to chỉ tải khi mở chi tiết.
ALTER TABLE kho_vo_img ADD COLUMN thumb TEXT NOT NULL DEFAULT '';

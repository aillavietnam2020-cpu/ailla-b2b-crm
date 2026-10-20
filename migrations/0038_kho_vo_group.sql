-- Nhóm của vật tư đóng gói để lọc: VO (can, chai), THUNG, PHUKIEN (vòi, nắp...), KHAC (băng dính...). Trống = web tự đoán theo tên.
ALTER TABLE kho_vo ADD COLUMN grp TEXT NOT NULL DEFAULT '';

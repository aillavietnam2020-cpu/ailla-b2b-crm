-- Cơ chế thưởng NPP/đại lý: thưởng tháng và thưởng năm tính theo DOANH SỐ LẺ (số lượng × giá niêm yết bán lẻ).
-- customer_id = '' là cơ chế CHUNG; có customer_id là cơ chế RIÊNG của khách đó (thay hẳn cơ chế chung cho khách đó).
-- Mỗi mốc: doanh số lẻ từ (>=), thưởng tiền, thưởng hàng (mô tả + giá trị). Nhập ở trang quản trị (CEO).
CREATE TABLE bonus_tiers (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL DEFAULT '',
  period      TEXT NOT NULL CHECK (period IN ('MONTH', 'YEAR')),
  level_no    INTEGER NOT NULL,
  label       TEXT NOT NULL DEFAULT '',
  threshold   INTEGER NOT NULL CHECK (threshold >= 0),
  cash        INTEGER NOT NULL DEFAULT 0,
  gift_text   TEXT NOT NULL DEFAULT '',
  gift_value  INTEGER NOT NULL DEFAULT 0,
  updated_by  TEXT,
  updated_at  TEXT NOT NULL,
  UNIQUE (customer_id, period, level_no)
);
CREATE INDEX ix_bonus_tiers_customer ON bonus_tiers (customer_id, period);

-- Mã trợ giá / flash sale: không tính vào doanh số thưởng.
ALTER TABLE products ADD COLUMN bonus_excluded INTEGER NOT NULL DEFAULT 0;

-- Cơ chế chung chép từ Sheet CRM (CHINH_SACH_THUONG), CEO sửa tiếp ở trang quản trị.
INSERT INTO bonus_tiers (id, customer_id, period, level_no, label, threshold, cash, gift_text, gift_value, updated_at) VALUES
  ('bt-m1', '', 'MONTH', 1, 'Mức 1', 100000000, 500000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-m2', '', 'MONTH', 2, 'Mức 2', 150000000, 1500000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-m3', '', 'MONTH', 3, 'Mức 3', 250000000, 3000000, '60 tẩy lồng, 65 tẩy gioăng', 7500000, '2026-10-14T00:00:00.000Z'),
  ('bt-m4', '', 'MONTH', 4, 'Mức 4', 500000000, 7000000, '100 tẩy lồng, 139 tẩy gioăng', 15000000, '2026-10-14T00:00:00.000Z'),
  ('bt-m5', '', 'MONTH', 5, 'Mức 5', 1000000000, 16000000, '200 tẩy lồng, 277 tẩy gioăng', 30000000, '2026-10-14T00:00:00.000Z'),
  ('bt-m6', '', 'MONTH', 6, 'Mức 6', 1500000000, 24000000, '400 tẩy lồng, 320 tẩy gioăng', 45000000, '2026-10-14T00:00:00.000Z'),
  ('bt-m7', '', 'MONTH', 7, 'Mức 7', 2000000000, 32000000, '400 tẩy lồng, 554 tẩy gioăng', 60000000, '2026-10-14T00:00:00.000Z'),
  ('bt-y1', '', 'YEAR', 1, 'Mốc 1', 300000000, 900000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-y2', '', 'YEAR', 2, 'Mốc 2', 500000000, 2000000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-y3', '', 'YEAR', 3, 'Mốc 3', 1000000000, 6000000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-y4', '', 'YEAR', 4, 'Mốc 4', 2000000000, 14000000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-y5', '', 'YEAR', 5, 'Mốc 5', 4000000000, 36000000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-y6', '', 'YEAR', 6, 'Mốc 6', 6000000000, 60000000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-y7', '', 'YEAR', 7, 'Mốc 7', 8000000000, 99000000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-y8', '', 'YEAR', 8, 'Mốc 8', 12000000000, 140000000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-y9', '', 'YEAR', 9, 'Mốc 9', 15000000000, 190000000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-y10', '', 'YEAR', 10, 'Mốc 10', 20000000000, 280000000, '', 0, '2026-10-14T00:00:00.000Z'),
  ('bt-y11', '', 'YEAR', 11, 'Mốc 11', 35000000000, 520000000, '', 0, '2026-10-14T00:00:00.000Z');

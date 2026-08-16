-- Migration 0002: dữ liệu tham chiếu bắt buộc (không phải dữ liệu khách hàng).
-- 8 cấp giá và hạn mức tham chiếu theo mục 8.1 của đặc tả.

INSERT INTO price_tiers (id, code, name, rank, debt_limit, excel_column, created_at, updated_at) VALUES
  ('tier-gdkd',    'GDKD',    'GĐKD',          1, 150000000, 'GĐKD',          '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('tier-tpp',     'TPP',     'TPP',           2, 100000000, 'TPP',           '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('tier-npp',     'NPP',     'NPP',           3,  50000000, 'NPP',           '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('tier-tongdl',  'TONG_DL', 'Tổng đại lý',   4,  20000000, 'Tổng đại lý',   '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('tier-dlc1',    'DL_C1',   'Đại lý cấp 1',  5,   5000000, 'Đại lý cấp 1',  '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('tier-dlc2',    'DL_C2',   'Đại lý cấp 2',  6,   3000000, 'Đại lý cấp 2',  '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('tier-daisu',   'DAI_SU',  'Đại sứ',        7,   1000000, 'Đại sứ',        '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('tier-banle',   'BAN_LE',  'Bán lẻ',        8,    500000, 'Bán lẻ',        '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z');

-- Cấu hình vận hành. Sửa qua màn hình Cấu hình, mọi thay đổi có audit.
INSERT INTO app_settings (key, value_json, version, updated_at) VALUES
  ('price_override.manager_threshold_percent', '5',    1, '2026-08-16T00:00:00.000Z'),
  ('price_override.ceo_threshold_percent',     '15',   1, '2026-08-16T00:00:00.000Z'),
  ('debt.block_on_limit_exceeded',             'true', 1, '2026-08-16T00:00:00.000Z'),
  ('accounting.pending_alert_hours',           '72',   1, '2026-08-16T00:00:00.000Z'),
  ('reorder.default_cycle_days',               '30',   1, '2026-08-16T00:00:00.000Z'),
  ('activity.correction_window_minutes',       '120',  1, '2026-08-16T00:00:00.000Z'),
  ('reconciliation.baseline',
   '{"products":134,"customers":62,"source_orders":35,"source_order_lines":206,"managed_orders":34,"payments":26,"payments_total":180073600,"opening_debt_total":1256920982,"official_debt_total":1168465995,"projected_debt_total":1397046765}',
   1, '2026-08-16T00:00:00.000Z');

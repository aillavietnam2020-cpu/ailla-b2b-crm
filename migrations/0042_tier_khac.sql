-- Cấp giá "Khác": khách lái xe, khách lẻ lẫn... không thuộc 8 cấp giá. Cấp này KHÔNG có bảng giá,
-- giá bán do người lập đơn nhập theo thỏa thuận và không phát cảnh báo lệch giá.
INSERT INTO price_tiers (id, code, name, rank, debt_limit, excel_column, created_at, updated_at)
VALUES ('tier-khac', 'KHAC', 'Khác', 9, 0, 'Khác', '2026-10-17T00:00:00.000Z', '2026-10-17T00:00:00.000Z');

-- Khách đã nhập với nhãn cấp "Khác" mà chưa gắn cấp: gắn vào cấp mới.
UPDATE customers
SET tier_id = 'tier-khac', updated_at = '2026-10-17T00:00:00.000Z'
WHERE tier_id IS NULL AND deleted_at IS NULL AND lower(trim(coalesce(legacy_tier_label, ''))) IN ('khác', 'khac');

-- Bỏ dòng cảnh báo cũ "Cấp Khác không có trong bảng giá 8 cấp" khỏi ghi chú chất lượng dữ liệu.
UPDATE customers
SET data_quality_note = trim(
      replace(replace(replace(data_quality_note,
        '; Cấp "Khác" không có trong bảng giá 8 cấp', ''),
        'Cấp "Khác" không có trong bảng giá 8 cấp; ', ''),
        'Cấp "Khác" không có trong bảng giá 8 cấp', '')),
    updated_at = '2026-10-17T00:00:00.000Z'
WHERE tier_id = 'tier-khac' AND data_quality_note LIKE '%không có trong bảng giá 8 cấp%';

UPDATE customers
SET data_quality = 'OK', data_quality_note = NULL
WHERE tier_id = 'tier-khac' AND data_quality = 'NEEDS_REVIEW' AND coalesce(trim(data_quality_note), '') = '';

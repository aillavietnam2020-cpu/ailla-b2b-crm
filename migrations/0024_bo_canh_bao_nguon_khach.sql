-- Bỏ cảnh báo "Chưa có nguồn khách": Sheet CRM cũ không có cột nguồn, cảnh báo này làm mọi khách đều bị gắn "Kiểm tra".
UPDATE customers SET data_quality_note = NULLIF(TRIM(REPLACE(REPLACE(data_quality_note, '; Chưa có nguồn khách', ''), 'Chưa có nguồn khách', ''), '; '), '')
WHERE data_quality_note LIKE '%Chưa có nguồn khách%';
UPDATE customers SET data_quality = 'OK' WHERE data_quality = 'NEEDS_REVIEW' AND data_quality_note IS NULL;

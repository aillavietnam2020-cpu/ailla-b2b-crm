-- Khách có 2 số điện thoại ("0949… - 0944…") không phải số bất thường: bỏ cảnh báo này.
UPDATE customers SET data_quality_note = NULLIF(TRIM(REPLACE(REPLACE(data_quality_note, 'Số điện thoại bất thường (' || LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(phone_text,' ',''),'-',''),'/',''),'.','')) || ' chữ số); ', ''), 'Số điện thoại bất thường (' || LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(phone_text,' ',''),'-',''),'/',''),'.','')) || ' chữ số)', ''), '; '), '')
WHERE data_quality_note LIKE '%Số điện thoại bất thường%' AND (phone_text LIKE '%-%' OR phone_text LIKE '%/%') AND LENGTH(REPLACE(REPLACE(REPLACE(phone_text,' ',''),'-',''),'/','')) = 20;
UPDATE customers SET data_quality = 'OK' WHERE data_quality = 'NEEDS_REVIEW' AND data_quality_note IS NULL;

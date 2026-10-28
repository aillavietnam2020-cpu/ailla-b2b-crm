-- Sản phẩm & combo (Quản trị › Cấu hình), chị Hoa duyệt demo 28/10/2026.
-- Bảng quy đổi combo các sàn (channel_map) giữ nguyên chỗ và nguyên mọi dòng; chỉ THÊM 2 cột:
--   kind     : loại món trong combo: sp (sản phẩm) | gift (quà tặng) | pack (bao bì đóng gói) | skip (BỎ QUA, không trừ kho)
--   off_from : combo ngừng dùng từ ngày này ('' = đang dùng). Các ngày trước vẫn quy đổi như cũ.
ALTER TABLE channel_map ADD COLUMN kind TEXT NOT NULL DEFAULT 'sp';
ALTER TABLE channel_map ADD COLUMN off_from TEXT NOT NULL DEFAULT '';

-- Điền loại món cho các dòng đang có (chỉ ghi vào cột mới, không đổi mã, số lượng, ghi chú).
UPDATE channel_map SET kind = 'skip' WHERE trim(item_label) IN ('BỎ QUA', 'Bỏ qua', 'bỏ qua', 'Bỏ QUA', 'BỎ qua');

UPDATE channel_map SET kind = 'pack'
WHERE kind = 'sp' AND EXISTS (
  SELECT 1 FROM kho_items i
  WHERE lower(i.code) = lower(CASE WHEN instr(channel_map.item_label, ' - ') > 0
                                   THEN substr(channel_map.item_label, 1, instr(channel_map.item_label, ' - ') - 1)
                                   ELSE channel_map.item_label END)
    AND i.cls = 'NVL' AND (i.grp LIKE '%đóng gói%' OR i.grp LIKE 'Vỏ%')
);

-- Quà: ghi chú "Quà…", hoặc hàng hóa / vật tư khác nằm trong combo có thành phẩm.
UPDATE channel_map SET kind = 'gift'
WHERE kind = 'sp' AND (
  note LIKE '%Quà%'
  OR (
    EXISTS (
      SELECT 1 FROM kho_items i
      WHERE lower(i.code) = lower(CASE WHEN instr(channel_map.item_label, ' - ') > 0
                                       THEN substr(channel_map.item_label, 1, instr(channel_map.item_label, ' - ') - 1)
                                       ELSE channel_map.item_label END)
        AND (i.cls = 'HH' OR i.cls = 'NVL')
    )
    AND EXISTS (
      SELECT 1 FROM channel_map m2 JOIN kho_items t
        ON lower(t.code) = lower(CASE WHEN instr(m2.item_label, ' - ') > 0
                                      THEN substr(m2.item_label, 1, instr(m2.item_label, ' - ') - 1)
                                      ELSE m2.item_label END)
      WHERE m2.channel = channel_map.channel AND m2.sku = channel_map.sku AND m2.variant = channel_map.variant
        AND m2.from_day = channel_map.from_day AND t.cls = 'TP'
    )
  )
);

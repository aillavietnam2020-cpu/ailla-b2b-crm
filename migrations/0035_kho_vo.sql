-- Hồ sơ vỏ can / chai / thùng: tra mã vỏ, tên chuẩn, đặc điểm và vỏ này dùng cho thành phẩm nào.
-- Mã cũ (kho_items.code) vẫn là khóa của kho, định mức và quy đổi sàn; mã mới chỉ để tra cứu.
CREATE TABLE kho_vo (
  code       TEXT PRIMARY KEY REFERENCES kho_items (code),
  new_code   TEXT NOT NULL DEFAULT '',   -- mã chuẩn đề xuất, ví dụ VO-CAN-3.6-GND-DEN
  kind       TEXT NOT NULL DEFAULT '',   -- LOẠI: CAN, CHAI, THUNG...
  capacity   TEXT NOT NULL DEFAULT '',   -- dung tích: 3.6, 500ML...
  style      TEXT NOT NULL DEFAULT '',   -- kiểu dáng: 6C, GND, TRON...
  color      TEXT NOT NULL DEFAULT '',   -- màu: TRANG, DEN...
  seq        TEXT NOT NULL DEFAULT '',   -- STT khi hai vỏ y hệt nhau
  photo_url  TEXT NOT NULL DEFAULT '',   -- link ảnh (Drive)
  note       TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users (id),
  updated_at TEXT NOT NULL
);

-- Thành phẩm đóng vỏ nào, thùng nào (thông tin tra cứu; KHÔNG trừ kho — trừ kho vẫn theo định mức).
CREATE TABLE kho_pack (
  product    TEXT PRIMARY KEY REFERENCES kho_items (code),
  vo         TEXT NOT NULL DEFAULT '',
  thung      TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users (id),
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_kho_pack_vo ON kho_pack (vo);
CREATE INDEX idx_kho_pack_thung ON kho_pack (thung);

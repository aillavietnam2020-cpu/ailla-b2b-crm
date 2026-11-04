-- Hàng về lệch đơn mua (chị Hoa duyệt 04/11): mỗi dòng đặt nhận khác số đặt (dư hoặc thiếu) có một dòng ở đây.
-- Web tự tạo / cập nhật khi có lần nhận hàng (purchasing.ts syncLech), báo người phụ trách mua hàng chốt phần tiền.
-- Cách chốt (resolution):
--   dư:    TINH = NCC tính tiền phần dư (công nợ cộng theo giá đơn) · TANG = NCC tặng (giá 0, hạ giá vốn bình quân)
--          TRA  = trả lại phần dư (kho lập phiếu xuất trả, công nợ theo đơn)
--   thiếu: BU   = NCC giao bù sau (đơn còn mở) · CHOT = chốt theo thực nhận (trừ tiền, đóng đơn)
--          NO_HANG = đã trả đủ tiền, NCC nợ hàng (công nợ theo đơn)
CREATE TABLE po_lech (
  id           TEXT PRIMARY KEY,
  po_id        TEXT NOT NULL REFERENCES po_orders (id),
  po_line_id   TEXT NOT NULL UNIQUE REFERENCES po_lines (id),
  item         TEXT NOT NULL,
  ordered      REAL NOT NULL,                 -- số đặt
  received     REAL NOT NULL,                 -- tổng thực nhận (các lần nhận còn hiệu lực)
  diff         REAL NOT NULL,                 -- received - ordered: dương = dư, âm = thiếu
  status       TEXT NOT NULL DEFAULT 'CHO' CHECK (status IN ('CHO', 'XONG')),
  resolution   TEXT CHECK (resolution IS NULL OR resolution IN ('TINH', 'TANG', 'TRA', 'BU', 'CHOT', 'NO_HANG')),
  note         TEXT NOT NULL DEFAULT '',
  resolved_by  TEXT REFERENCES users (id),
  resolved_at  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX ix_po_lech_po ON po_lech (po_id);
CREATE INDEX ix_po_lech_status ON po_lech (status, created_at);

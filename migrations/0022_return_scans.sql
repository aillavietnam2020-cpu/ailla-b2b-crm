-- Hàng hoàn các sàn (TikTok Shop, Shopee, Facebook): danh sách đơn hoàn lấy từ Poscake + lượt quét mã vận đơn ở kho.
--  ret_orders : đơn đang hoàn / đã hoàn trên Poscake (tracking = mã vận đơn, partner.extend_code)
--  ret_lines  : dòng hàng của đơn hoàn (để tách combo ra sản phẩm lẻ phải về)
--  ret_scans  : mỗi lần kho quét một gói hoàn; items là JSON [{item, name, expected, received, good, bad}]
--               state: CHO (chờ nhập kho) | NHAP (đã lập phiếu nhập hàng hoàn) | HUY (quét nhầm)
--               problem: '' | THIEU | HONG | SAI | KHAC ; claim: '' | CAN (cần khiếu nại) | DA_GUI | XONG

CREATE TABLE ret_orders (
  channel      TEXT NOT NULL,
  order_id     TEXT NOT NULL,
  tracking     TEXT NOT NULL DEFAULT '',
  shop         TEXT NOT NULL DEFAULT '',
  status       INTEGER,
  returning_at TEXT,
  returned_at  TEXT,
  synced_at    TEXT NOT NULL,
  PRIMARY KEY (channel, order_id)
);
CREATE INDEX ix_ret_orders_tracking ON ret_orders (tracking);

CREATE TABLE ret_lines (
  channel  TEXT NOT NULL,
  order_id TEXT NOT NULL,
  line_no  INTEGER NOT NULL,
  sku      TEXT NOT NULL DEFAULT '',
  variant  TEXT NOT NULL DEFAULT '',
  name     TEXT NOT NULL DEFAULT '',
  qty      REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (channel, order_id, line_no)
);

CREATE TABLE ret_scans (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL,
  scan_day   TEXT NOT NULL,
  scanned_at TEXT NOT NULL,
  scanned_by TEXT,
  channel    TEXT,
  order_id   TEXT,
  state      TEXT NOT NULL DEFAULT 'CHO',
  items      TEXT NOT NULL DEFAULT '[]',
  problem    TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  video_url  TEXT NOT NULL DEFAULT '',
  claim      TEXT NOT NULL DEFAULT '',
  doc_id     INTEGER,
  source     TEXT NOT NULL DEFAULT 'SCAN'
);
CREATE INDEX ix_ret_scans_code ON ret_scans (code);
CREATE INDEX ix_ret_scans_day ON ret_scans (scan_day);
CREATE INDEX ix_ret_scans_order ON ret_scans (channel, order_id);

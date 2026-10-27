-- Doanh thu thực theo kênh × tháng (chị Hoa chốt 26/10/2026):
-- số web lưu lại khi tới ngày 10 tháng sau (đóng băng, không đổi nữa) và số kế toán nhập tay để đối chiếu.
-- channel: tts (TikTok Shop) | spe (Shopee) | fb (Facebook) | cskh (CSKH cũ) | b2b (Kênh phân phối) | gc (Kênh OEM)
CREATE TABLE IF NOT EXISTS revenue_months (
  ym          TEXT NOT NULL,
  channel     TEXT NOT NULL,
  web_amount  REAL,
  web_orders  INTEGER,
  web_json    TEXT,
  closed_at   TEXT,
  closed_by   TEXT,
  kt_amount   REAL,
  kt_note     TEXT,
  kt_at       TEXT,
  kt_by       TEXT,
  PRIMARY KEY (ym, channel)
);

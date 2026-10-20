-- Migration 0017: quy tắc kế toán cho khoản tiền về.
--  - Danh sách tài khoản nhận tiền hợp lệ của công ty (chuyển khoản vào tài khoản ngoài danh sách bị gắn cờ kiểm tra).
--  - Mục đích khoản tiền: thanh toán đơn / trả công nợ cũ / đặt cọc ứng trước, kèm giải trình khi lệch.
--  - Tiền mặt: ghi người nhận + bắt buộc ảnh phiếu thu có chữ ký trước khi kế toán xác nhận.
--  - Số tham chiếu giao dịch ngân hàng (đọc từ bill) là duy nhất: một bill không ghi hai lần.

CREATE TABLE receiving_accounts (
  id           TEXT PRIMARY KEY,
  bank         TEXT NOT NULL,            -- tên ngân hàng, ví dụ MB, BIDV, Vietcombank
  account_no   TEXT NOT NULL,            -- chỉ chữ số
  account_name TEXT NOT NULL,            -- tên chủ tài khoản
  note         TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_by   TEXT REFERENCES users (id),
  created_at   TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_receiving_accounts_no ON receiving_accounts (account_no);

ALTER TABLE payments ADD COLUMN purpose TEXT NOT NULL DEFAULT 'ORDER'
  CHECK (purpose IN ('ORDER', 'DEBT', 'DEPOSIT'));
ALTER TABLE payments ADD COLUMN explanation TEXT;
ALTER TABLE payments ADD COLUMN receiving_account_id TEXT REFERENCES receiving_accounts (id);
ALTER TABLE payments ADD COLUMN receiver_name TEXT;     -- người nhận tiền mặt
ALTER TABLE payments ADD COLUMN review_reason TEXT;     -- vì sao cần kế toán kiểm tra
ALTER TABLE payments ADD COLUMN bank_ref TEXT;          -- số tham chiếu giao dịch ngân hàng
CREATE UNIQUE INDEX ux_payments_bank_ref ON payments (bank_ref) WHERE bank_ref IS NOT NULL;

-- Bill: phân biệt ảnh bill chuyển khoản và ảnh phiếu thu tiền mặt có chữ ký; lưu dữ liệu đã đọc.
ALTER TABLE bills ADD COLUMN kind TEXT NOT NULL DEFAULT 'BILL' CHECK (kind IN ('BILL', 'PHIEU_THU'));
ALTER TABLE bills ADD COLUMN bank_ref TEXT;
ALTER TABLE bills ADD COLUMN to_account TEXT;
ALTER TABLE bills ADD COLUMN read_json TEXT;            -- kết quả AI đọc ảnh (để đối chiếu)

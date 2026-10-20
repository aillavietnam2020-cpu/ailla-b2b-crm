-- Cấp giá "Nhân viên": giá bán nội bộ cho nhân viên mua hàng công ty (trừ vào lương cuối tháng). Chị Thảo điền giá ở bảng giá;
-- mã chưa có giá thì lúc lập đơn gõ giá trực tiếp, không cần duyệt. Không tính vào cảnh báo "thiếu giá 8 cấp".
INSERT INTO price_tiers (id, code, name, rank, debt_limit, excel_column, created_at, updated_at)
VALUES ('tier-nhanvien', 'NHAN_VIEN', 'Nhân viên', 10, 0, 'Nhân viên', '2026-10-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z');

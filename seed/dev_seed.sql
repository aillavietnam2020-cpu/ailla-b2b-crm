-- Dữ liệu DEV đã ẩn danh. KHÔNG chứa dữ liệu khách hàng thật (mục 15).
-- Chạy: npm run db:seed:local

DELETE FROM payment_allocations;
DELETE FROM payment_allocations_pending;
DELETE FROM payments;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM customer_activities;
DELETE FROM tasks;
DELETE FROM customers;
DELETE FROM product_prices;
DELETE FROM products;
DELETE FROM product_groups;
DELETE FROM users;

INSERT INTO users (id, email, display_name, role, status, legacy_name, created_at, updated_at) VALUES
  ('user-thao',   'thao@ailla.vn',   'Nguyễn Thu Thảo (dev)', 'EMPLOYEE', 'ACTIVE', 'Thảo',  '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('user-huyen',  'huyen@ailla.vn',  'Trần Thanh Huyền (dev)','EMPLOYEE', 'ACTIVE', 'Huyền', '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('user-manager','quanly@ailla.vn', 'Quản lý kinh doanh (dev)','MANAGER','ACTIVE', NULL,    '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('user-ceo',    'ceo@ailla.vn',    'CEO (dev)',             'CEO',      'ACTIVE', NULL,    '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z');

INSERT INTO product_groups (id, code, name, created_at, updated_at) VALUES
  ('grp-giat', 'GIAT', 'Giặt xả', '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('grp-nha',  'NHA',  'Chăm sóc nhà cửa', '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z');

INSERT INTO products (id, sku, name, unit, pack_size, group_id, active, created_at, updated_at) VALUES
  ('prod-1', 'DEV-NGIAT5', 'Nước giặt hương ban mai 5L (dev)', 'Can', '5L', 'grp-giat', 1, '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('prod-2', 'DEV-LAUSAN', 'Nước lau sàn 4L (dev)', 'Can', '4L', 'grp-nha', 1, '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z'),
  ('prod-3', 'DEV-TOILET', 'Tẩy toilet 500ml (dev)', 'Chai', '500ml', 'grp-nha', 1, '2026-08-16T00:00:00.000Z', '2026-08-16T00:00:00.000Z');

-- prod-1 và prod-2 có đủ 8 cấp; prod-3 THIẾU giá ở cấp Bán lẻ để thử quy tắc chặn giá NULL.
INSERT INTO product_prices (id, product_id, tier_id, amount, valid_from, version, status, created_at, updated_at) VALUES
  ('pp-1-1','prod-1','tier-gdkd',   95000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-1-2','prod-1','tier-tpp',    99000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-1-3','prod-1','tier-npp',   105000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-1-4','prod-1','tier-tongdl',112000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-1-5','prod-1','tier-dlc1',  120000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-1-6','prod-1','tier-dlc2',  128000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-1-7','prod-1','tier-daisu', 135000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-1-8','prod-1','tier-banle', 149000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-2-1','prod-2','tier-gdkd',   62000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-2-2','prod-2','tier-tpp',    65000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-2-3','prod-2','tier-npp',    69000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-2-4','prod-2','tier-tongdl', 73000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-2-5','prod-2','tier-dlc1',   78000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-2-6','prod-2','tier-dlc2',   82000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-2-7','prod-2','tier-daisu',  88000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-2-8','prod-2','tier-banle',  95000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-3-1','prod-3','tier-gdkd',   28000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-3-5','prod-3','tier-dlc1',   35000,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pp-3-8','prod-3','tier-banle',   NULL,'2026-01-01',1,'ACTIVE','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z');

INSERT INTO customers (id, legacy_code, name, phone_text, phone_normalized, province, address, tier_id,
  legacy_tier_label, owner_id, source, stage, reorder_cycle_days, last_order_date, next_follow_up_at,
  opening_debt, data_quality, created_at, updated_at) VALUES
  ('cus-1','dev-01','Cửa hàng Bình Minh (dev)','0900000001','0900000001','Hà Nội','Số 1 phố Dev','tier-dlc1',
    NULL,'user-thao','Facebook Ads','REGULAR',30,'2026-07-10','2026-08-16',12000000,'OK','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('cus-2','dev-02','Tạp hoá Hướng Dương (dev)','0900000002','0900000002','Hải Phòng','Số 2 phố Dev','tier-dlc2',
    NULL,'user-thao','Giới thiệu','FIRST_ORDER',45,'2026-08-01','2026-08-14',0,'OK','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('cus-3','dev-03','Kho hàng Sao Mai (dev)','0900000003','0900000003','Nghệ An','Số 3 phố Dev','tier-npp',
    NULL,'user-huyen','TikTok','NEGOTIATING',NULL,NULL,'2026-08-16',0,'OK','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('cus-4','dev-04','Đại lý Thiên Ân (dev)',NULL,NULL,NULL,NULL,NULL,
    'Khác','user-huyen',NULL,'NEW',NULL,NULL,'2026-08-15',0,'NEEDS_REVIEW','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z');

INSERT INTO tasks (id, customer_id, assignee_id, type, title, due_at, status, priority, created_at, updated_at) VALUES
  ('task-1','cus-1','user-thao','REORDER','Gọi hỏi bán ra và chốt đơn tái nhập','2026-08-16','OPEN','HIGH','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('task-2','cus-2','user-thao','FOLLOW_UP','Hỏi phản hồi sau đơn đầu','2026-08-14','OPEN','NORMAL','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('task-3','cus-3','user-huyen','FOLLOW_UP','Gửi chính sách NPP và chốt cấp giá','2026-08-16','OPEN','HIGH','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('task-4','cus-4','user-huyen','DATA_QUALITY','Bổ sung số điện thoại và map cấp giá','2026-08-15','OPEN','HIGH','2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z');

INSERT INTO orders (id, order_no, customer_id, owner_id, order_date, subtotal, discount_amount, bonus_deduction,
  shipping_fee, total_amount, cod_amount, approval_status, delivery_status, payment_status, accounting_status,
  accounting_confirmed_at, delivered_at, created_by, approved_by, approved_at, created_at, updated_at) VALUES
  ('ord-1','DH202607-0001','cus-1','user-thao','2026-07-10',12000000,0,0,200000,12200000,0,'APPROVED','DA_GIAO',
    'THU_MOT_PHAN','DA_XAC_NHAN','2026-07-12T00:00:00.000Z','2026-07-11T00:00:00.000Z','user-thao','user-manager',
    '2026-07-10T02:00:00.000Z','2026-07-10T00:00:00.000Z','2026-07-12T00:00:00.000Z'),
  ('ord-2','DH202608-0001','cus-2','user-thao','2026-08-01',5600000,0,0,0,5600000,0,'APPROVED','DA_XUAT_KHO',
    'CHUA_THU','CHUA_XAC_NHAN',NULL,'2026-08-02T00:00:00.000Z','user-thao','user-manager',
    '2026-08-01T02:00:00.000Z','2026-08-01T00:00:00.000Z','2026-08-02T00:00:00.000Z');

INSERT INTO order_items (id, order_id, product_id, qty, base_price, applied_price, line_total, price_override, tier_id_snapshot, created_at) VALUES
  ('oi-1','ord-1','prod-1',100,120000,120000,12000000,0,'tier-dlc1','2026-07-10T00:00:00.000Z'),
  ('oi-2','ord-2','prod-2', 70, 82000, 80000, 5600000,1,'tier-dlc2','2026-08-01T00:00:00.000Z');

INSERT INTO payments (id, external_receipt_no, source, external_row_key, customer_id, amount, paid_at, method,
  accounting_status, review_status, is_general_repayment, created_at, updated_at) VALUES
  ('pay-1','PT-DEV-001','MANUAL','dev-1','cus-1',5000000,'2026-07-20','Chuyển khoản','DA_XAC_NHAN','OK',0,
    '2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z'),
  ('pay-2',NULL,'MANUAL','dev-2','cus-1',3000000,'2026-08-05','Tiền mặt','CHUA_XAC_NHAN','NEEDS_REVIEW',1,
    '2026-08-16T00:00:00.000Z','2026-08-16T00:00:00.000Z');

INSERT INTO payment_allocations (id, payment_id, order_id, amount, allocated_by, created_at) VALUES
  ('alloc-1','pay-1','ord-1',5000000,'user-manager','2026-08-16T00:00:00.000Z');

INSERT INTO payment_allocations_pending (id, payment_id, customer_id, amount, reason, status, created_at) VALUES
  ('pend-1','pay-2','cus-1',3000000,'Khoản trả nợ chung chờ phân bổ (dev)','PENDING','2026-08-16T00:00:00.000Z');

INSERT INTO customer_activities (id, customer_id, user_id, channel, result, content, next_action, next_date,
  stage_before, stage_after, created_at) VALUES
  ('act-1','cus-1','user-thao','Gọi điện','Đã trao đổi','Khách báo còn tồn khoảng 30%, hẹn tuần sau chốt đơn.',
    'Gọi chốt đơn tái nhập','2026-08-16','REGULAR','REGULAR','2026-08-10T02:00:00.000Z');

-- Migration 0070 (Kho, 04/11/2026): sổ kho tính theo MỐC TỒN, và không trừ hai lần dòng bán + dòng tặng cùng mã.
--
-- 1) Mốc tồn (chị Hoa chốt 04/11): kho_cfg 'ton_moc' = ngày phiếu tồn chốt chung (31/10). Mốc của từng mã:
--    - mã có phiếu tồn đầu kỳ / kiểm bổ sung (TD) từ ngày mốc chung trở đi: mốc = ngày phiếu TD mới nhất của mã đó;
--    - mã chưa kiểm: mốc = mốc chung.
--    Sổ chỉ lấy: dòng TD đúng ngày mốc của mã + mọi dòng khác SAU ngày mốc (số kiểm là số cuối ngày kiểm, nên hàng
--    nhập, xuất, bán sàn trong và trước ngày kiểm đã nằm trong số đếm, không trừ lại).
--    Chưa đặt ton_moc thì sổ như cũ (mọi dòng).
-- 2) order_kho_lines.shipped_qty là TỔNG thực xuất một mã trong đơn; order_items có thể có nhiều dòng cùng mã (bán + tặng),
--    nên gộp order_items theo (đơn, mã) trước khi nối, tránh trừ tổng đó nhiều lần.
-- Chỉ thay view, không đổi bảng hay dữ liệu.
DROP VIEW kho_ledger;
CREATE VIEW kho_ledger AS
WITH cfg AS (SELECT (SELECT v FROM kho_cfg WHERE k = 'ton_moc') AS g),
raw AS (
  SELECT m.item AS item, m.qty AS qty, m.std_qty AS std_qty, m.role AS role, d.doc_date AS doc_date,
         d.id AS doc_id, d.type AS doc_type, d.no AS doc_no
  FROM kho_moves m JOIN kho_docs d ON d.id = m.doc_id
  WHERE d.status = 'OK'
  UNION ALL
  SELECT km.misa_code, -(COALESCE(okl.shipped_qty, oi.qty) * km.factor), NULL, 'B2B',
         substr(o.delivered_at, 1, 10), 0, 'B2B', 'XB-' || o.order_no
  FROM orders o
  JOIN (SELECT order_id, product_id, SUM(qty) AS qty FROM order_items GROUP BY order_id, product_id) oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  JOIN kho_map km ON km.crm_sku = p.sku
  LEFT JOIN order_kho_lines okl ON okl.order_id = o.id AND okl.product_id = oi.product_id
  WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
    AND o.delivery_status IN ('DA_XUAT_KHO', 'DA_GIAO') AND o.delivered_at IS NOT NULL
    AND substr(o.delivered_at, 1, 10) >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'b2b_from'), '9999-12-31')
  UNION ALL
  SELECT km.misa_code, (rl.received_qty * km.factor), NULL, 'B2B',
         substr(r.kho_at, 1, 10), 0, 'TRA_HANG', r.return_no
  FROM order_returns r
  JOIN order_return_lines rl ON rl.return_id = r.id
  JOIN products p ON p.id = rl.product_id
  JOIN kho_map km ON km.crm_sku = p.sku
  WHERE r.status IN ('DA_NHAN_KHO', 'DA_GIAM_NO') AND rl.condition = 'CON_BAN_DUOC'
    AND COALESCE(rl.received_qty, 0) > 0 AND r.kho_at IS NOT NULL
    AND substr(r.kho_at, 1, 10) >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'b2b_from'), '9999-12-31')
  UNION ALL
  SELECT co.item, -co.qty, NULL, 'ONLINE', co.day, 0, 'ONLINE',
         'XL-' || CASE co.channel WHEN 'TIKTOK' THEN 'TT' WHEN 'SHOPEE' THEN 'SP' ELSE 'FB' END || '-' || replace(co.day, '-', '')
  FROM channel_out co
  WHERE co.day >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'online_from'), '9999-12-31')
),
moc AS (
  SELECT m.item AS item, MAX(d.doc_date) AS d
  FROM kho_moves m JOIN kho_docs d ON d.id = m.doc_id, cfg
  WHERE d.status = 'OK' AND d.type = 'TD' AND cfg.g IS NOT NULL AND d.doc_date >= cfg.g
  GROUP BY m.item
)
SELECT r.item AS item, r.qty AS qty, r.std_qty AS std_qty, r.role AS role, r.doc_date AS doc_date,
       r.doc_id AS doc_id, r.doc_type AS doc_type, r.doc_no AS doc_no
FROM raw r CROSS JOIN cfg LEFT JOIN moc ON moc.item = r.item
WHERE cfg.g IS NULL
   OR (r.doc_type = 'TD' AND r.doc_date = COALESCE(moc.d, cfg.g))
   OR (r.doc_type <> 'TD' AND r.doc_date > COALESCE(moc.d, cfg.g));

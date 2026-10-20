-- Số phiếu hiện trong sổ kho: đơn NPP xuất = XB-<mã đơn>; bán lẻ mỗi kênh mỗi ngày một phiếu XL-<kênh>-<ngày>.
DROP VIEW kho_ledger;
CREATE VIEW kho_ledger AS
SELECT m.item AS item, m.qty AS qty, m.std_qty AS std_qty, m.role AS role, d.doc_date AS doc_date,
       d.id AS doc_id, d.type AS doc_type, d.no AS doc_no
FROM kho_moves m JOIN kho_docs d ON d.id = m.doc_id
WHERE d.status = 'OK'
UNION ALL
SELECT km.misa_code, -(COALESCE(okl.shipped_qty, oi.qty) * km.factor), NULL, 'B2B',
       substr(o.delivered_at, 1, 10), 0, 'B2B', 'XB-' || o.order_no
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
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
WHERE co.day >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'online_from'), '9999-12-31');

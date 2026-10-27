import { RECEIVED_BY_ORDER } from '../lib/sql';

/**
 * Máy soát số liệu: mỗi sáng (hoặc khi bấm "Soát lại") đối chiếu các chỗ nối giữa tiền, kho và hàng hoàn.
 * Chỉ ĐỌC, không sửa gì. Mục nào có điểm lệch thì hiện ra để chị xử lý; mục ổn chỉ liệt kê tên.
 */
export type CheckGroup = 'TIEN' | 'KHO' | 'HOAN';
export type Severity = 'DO' | 'VANG';

interface CheckDef {
  code: string;
  group: CheckGroup;
  severity: Severity;
  title: string;
  hint: string;
  columns: Array<[string, string]>;
  sql: string;
  params?: unknown[];
}

export interface Finding {
  code: string;
  group: CheckGroup;
  severity: Severity;
  title: string;
  hint: string;
  count: number;
  capped: boolean;
  columns: Array<[string, string]>;
  rows: Array<Record<string, string | number | null>>;
}

export interface SoatResult {
  at: string;
  summary: { red: number; yellow: number; ok: number };
  findings: Finding[];
  passed: Array<{ code: string; group: CheckGroup; title: string }>;
  errors: Array<{ code: string; title: string; message: string }>;
}

const LIMIT = 200; // đọc tối đa 200 dòng mỗi mục
const SHOW = 100; // hiện tối đa 100 dòng đầu mỗi mục
export const OVERDUE_DAYS = 3; // đồng bộ với luật hàng hoàn: quá 3 ngày chưa về / chưa nhập kho thì báo
const CLAIM_OPEN_DAYS = 7;


export const CHECK_DEFS: CheckDef[] = [
  // ---------------------------------------------------------------- TIỀN
  {
    code: 'T1',
    group: 'TIEN',
    severity: 'VANG',
    title: 'Đơn thu nhiều hơn số phải thu',
    hint: 'Tổng phiếu thu đã gắn vào đơn (cộng cọc / COD) lớn hơn tổng tiền đơn. Kiểm tra có gắn nhầm đơn, hoặc cần chuyển phần dư sang khách.',
    columns: [['order_no', 'Mã đơn'], ['customer', 'Khách'], ['total_amount', 'Tổng đơn'], ['received', 'Đã thu + cọc'], ['over', 'Thừa']],
    sql: `SELECT o.order_no, c.name AS customer, o.total_amount, COALESCE(r.received, 0) + o.cod_amount AS received,
                 COALESCE(r.received, 0) + o.cod_amount - o.total_amount AS over
          FROM orders o JOIN customers c ON c.id = o.customer_id
          LEFT JOIN (${RECEIVED_BY_ORDER}) r ON r.order_id = o.id
          WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
            AND COALESCE(r.received, 0) + o.cod_amount > o.total_amount
          ORDER BY over DESC LIMIT ${LIMIT}`,
  },
  {
    code: 'T2',
    group: 'TIEN',
    severity: 'DO',
    title: 'Trạng thái thu tiền của đơn không khớp số tiền đã thu',
    hint: 'Đơn tạo trên web: trạng thái "đã thu / thu một phần / chưa thu" phải đúng theo tổng phiếu thu đã gắn. Lệch nghĩa là có thao tác ghi tiền đã sửa số mà không cập nhật trạng thái.',
    columns: [['order_no', 'Mã đơn'], ['customer', 'Khách'], ['total_amount', 'Tổng đơn'], ['received', 'Đã thu + cọc'], ['status', 'Trạng thái ghi'], ['expected', 'Lẽ ra là']],
    sql: `SELECT order_no, customer, total_amount, received, payment_status AS status, expected FROM (
            SELECT o.order_no, c.name AS customer, o.total_amount, COALESCE(r.received, 0) + o.cod_amount AS received, o.payment_status,
                   CASE WHEN COALESCE(r.received, 0) + o.cod_amount <= 0 THEN 'CHUA_THU'
                        WHEN COALESCE(r.received, 0) + o.cod_amount < o.total_amount THEN 'THU_MOT_PHAN'
                        WHEN COALESCE(r.received, 0) + o.cod_amount = o.total_amount THEN 'DA_THU_DU'
                        ELSE 'THU_THUA' END AS expected,
                   COALESCE(r.received, 0) AS rcv
            FROM orders o JOIN customers c ON c.id = o.customer_id
            LEFT JOIN (${RECEIVED_BY_ORDER}) r ON r.order_id = o.id
            WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED' AND o.import_batch_id IS NULL
          ) WHERE (rcv > 0 OR payment_status <> 'CHUA_THU') AND payment_status <> expected
          ORDER BY order_no DESC LIMIT ${LIMIT}`,
  },
  {
    code: 'T3',
    group: 'TIEN',
    severity: 'DO',
    title: 'Phiếu thu đã gắn vào đơn nhiều hơn số tiền của phiếu',
    hint: 'Tổng tiền phân bổ của một phiếu thu không được vượt số tiền trên phiếu. Nếu vượt là có lỗi ghi sổ, cần kế toán xem ngay.',
    columns: [['receipt', 'Phiếu thu'], ['customer', 'Khách'], ['amount', 'Tiền trên phiếu'], ['allocated', 'Đã gắn vào đơn'], ['over', 'Vượt']],
    sql: `SELECT COALESCE(p.external_receipt_no, p.id) AS receipt, c.name AS customer, p.amount, SUM(pa.amount) AS allocated, SUM(pa.amount) - p.amount AS over
          FROM payments p JOIN customers c ON c.id = p.customer_id
          JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.reversed_at IS NULL
          WHERE p.is_adjustment = 0
          GROUP BY p.id HAVING SUM(pa.amount) > p.amount
          ORDER BY over DESC LIMIT ${LIMIT}`,
  },
  {
    code: 'T4',
    group: 'TIEN',
    severity: 'VANG',
    title: 'Phiếu thu chưa kế toán xác nhận quá 3 ngày',
    hint: 'Tiền đã ghi nhận trên web nhưng kế toán chưa xác nhận đã về tài khoản. Nhắc kế toán đối chiếu sao kê.',
    columns: [['receipt', 'Phiếu thu'], ['customer', 'Khách'], ['amount', 'Số tiền'], ['paid_at', 'Ngày thu']],
    sql: `SELECT COALESCE(p.external_receipt_no, p.id) AS receipt, c.name AS customer, p.amount, substr(p.paid_at, 1, 10) AS paid_at
          FROM payments p JOIN customers c ON c.id = p.customer_id
          WHERE p.accounting_status = 'CHUA_XAC_NHAN' AND p.is_adjustment = 0
            AND substr(p.paid_at, 1, 10) <= date('now', '+7 hours', '-${OVERDUE_DAYS} days')
            AND substr(p.paid_at, 1, 10) >= date('now', '+7 hours', '-90 days')
          ORDER BY p.paid_at LIMIT ${LIMIT}`,
  },
  {
    code: 'T5',
    group: 'TIEN',
    severity: 'VANG',
    title: 'Khoản trả nợ chung chờ phân bổ quá 7 ngày',
    hint: 'Khách trả tiền không nói trả đơn nào, đang chờ chia vào đơn. Để lâu thì công nợ từng đơn không đúng.',
    columns: [['customer', 'Khách'], ['amount', 'Số tiền'], ['created', 'Từ ngày'], ['reason', 'Ghi chú']],
    sql: `SELECT c.name AS customer, pp.amount, substr(pp.created_at, 1, 10) AS created, COALESCE(pp.reason, '') AS reason
          FROM payment_allocations_pending pp JOIN customers c ON c.id = pp.customer_id
          WHERE pp.status = 'PENDING' AND substr(pp.created_at, 1, 10) <= date('now', '+7 hours', '-7 days')
          ORDER BY pp.created_at LIMIT ${LIMIT}`,
  },
  // ---------------------------------------------------------------- KHO
  {
    code: 'K1',
    group: 'KHO',
    severity: 'DO',
    title: 'Tồn kho âm theo sổ kho',
    hint: 'Bấm vào một dòng để xem sổ chi tiết của mã đó (nhập, xuất theo từng loại phiếu và các dòng gần nhất) rồi biết âm từ đâu. Sổ kho cho ra số tồn nhỏ hơn 0: xuất nhiều hơn nhập. Thường do thiếu phiếu nhập, nhập sai mã, hoặc chưa nhập tồn đầu kỳ (nếu chưa nhập số kiểm kê đầu kỳ thì âm là bình thường, nhập xong sẽ hết).',
    columns: [['item', 'Mã'], ['name', 'Tên'], ['in_qty', 'Tổng nhập'], ['out_qty', 'Tổng xuất'], ['balance', 'Tồn theo sổ'], ['last_out', 'Xuất gần nhất']],
    sql: `SELECT l.item, i.name,
                 ROUND(SUM(CASE WHEN l.qty > 0 THEN l.qty ELSE 0 END), 2) AS in_qty,
                 ROUND(SUM(CASE WHEN l.qty < 0 THEN -l.qty ELSE 0 END), 2) AS out_qty,
                 ROUND(SUM(l.qty), 2) AS balance,
                 MAX(CASE WHEN l.qty < 0 THEN l.doc_date END) AS last_out
          FROM kho_ledger l JOIN kho_items i ON i.code = l.item
          GROUP BY l.item HAVING ROUND(SUM(l.qty), 6) < 0 -- cùng luật "âm kho" ở services/khoTon.ts
          ORDER BY balance LIMIT ${LIMIT}`,
  },
  {
    code: 'K2',
    group: 'KHO',
    severity: 'DO',
    title: 'Đơn Kênh phân phối đã xuất kho nhưng sản phẩm chưa có mã MISA',
    hint: 'Sản phẩm này chưa nối với mã kho nên khi xuất bán, sổ kho không bị trừ. Vào Kho, Đồng bộ mã Kênh phân phối để nối mã.',
    columns: [['order_no', 'Mã đơn'], ['sku', 'Mã sản phẩm'], ['name', 'Tên'], ['delivered', 'Ngày xuất']],
    sql: `SELECT o.order_no, p.sku, p.name, substr(o.delivered_at, 1, 10) AS delivered
          FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id
          LEFT JOIN kho_map km ON km.crm_sku = p.sku
          WHERE o.deleted_at IS NULL AND o.approval_status = 'APPROVED'
            AND o.delivery_status IN ('DA_XUAT_KHO', 'DA_GIAO') AND o.delivered_at IS NOT NULL
            AND substr(o.delivered_at, 1, 10) >= COALESCE((SELECT v FROM kho_cfg WHERE k = 'b2b_from'), '9999-12-31')
            AND km.crm_sku IS NULL
          ORDER BY o.delivered_at DESC LIMIT ${LIMIT}`,
  },
  {
    code: 'K3',
    group: 'KHO',
    severity: 'VANG',
    title: 'Phiếu kho còn hiệu lực nhưng không có dòng hàng nào',
    hint: 'Phiếu trống (60 ngày gần đây) thường là phiếu tạo dở. Xóa hoặc hủy phiếu cho sạch sổ.',
    columns: [['no', 'Số phiếu'], ['type', 'Loại'], ['doc_date', 'Ngày'], ['partner', 'Đối tác']],
    sql: `SELECT d.no, d.type, d.doc_date, d.partner
          FROM kho_docs d LEFT JOIN kho_moves m ON m.doc_id = d.id
          WHERE d.status = 'OK' AND d.doc_date >= date('now', '+7 hours', '-60 days')
          GROUP BY d.id HAVING COUNT(m.id) = 0
          ORDER BY d.doc_date DESC LIMIT ${LIMIT}`,
  },
  // ---------------------------------------------------------------- HÀNG HOÀN
  {
    code: 'H1',
    group: 'HOAN',
    severity: 'VANG',
    title: `Gói hoàn đã quét nhưng chưa nhập kho quá ${OVERDUE_DAYS} ngày`,
    hint: 'Kho đã nhận gói nhưng chưa lập phiếu nhập hoàn nên tồn chưa cộng. Vào Hàng hoàn, Phiếu nhập hoàn để nhập kho.',
    columns: [['code', 'Mã vận đơn'], ['channel', 'Kênh'], ['scan_day', 'Ngày quét']],
    sql: `SELECT code, COALESCE(channel, '') AS channel, scan_day
          FROM ret_scans WHERE state = 'CHO' AND scan_day <= date('now', '+7 hours', '-${OVERDUE_DAYS} days')
          ORDER BY scan_day LIMIT ${LIMIT}`,
  },
  {
    code: 'H2',
    group: 'HOAN',
    severity: 'VANG',
    title: `Sàn báo đã hoàn quá ${OVERDUE_DAYS} ngày mà kho chưa quét`,
    hint: 'Đơn đã hoàn trên hệ thống nhưng web chưa có lượt quét. Nếu kho đã quét ở file Google Sheet thì nạp mã vào web (Hàng hoàn, Đối soát, Nạp mã đã quét trước đây); nếu chưa quét thật thì hỏi đơn vị vận chuyển, nghi thất lạc.',
    columns: [['channel', 'Kênh'], ['order_id', 'Mã đơn'], ['tracking', 'Mã vận đơn'], ['returned', 'Báo hoàn từ']],
    params: [`-${OVERDUE_DAYS} days`],
    sql: `SELECT o.channel, o.order_id, o.tracking, substr(o.returned_at, 1, 10) AS returned
          FROM ret_orders o
          WHERE o.status IN (5, 15) AND o.returned_at IS NOT NULL
            AND o.returned_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)
            AND NOT EXISTS (SELECT 1 FROM ret_scans s WHERE s.channel = o.channel AND s.order_id = o.order_id AND s.state <> 'HUY')
          ORDER BY o.returned_at LIMIT ${LIMIT}`,
  },
  {
    code: 'H3',
    group: 'HOAN',
    severity: 'VANG',
    title: 'Phiếu nhập hoàn có số thực nhập lệch dự kiến (30 ngày)',
    hint: 'Kế toán nhập số khác số dự kiến từ các đơn đã quét. Cần giải thích lệch (thiếu, đếm sai, gộp đơn).',
    columns: [['no', 'Số phiếu'], ['doc_date', 'Ngày'], ['note', 'Ghi chú lệch']],
    sql: `SELECT no, doc_date, note FROM kho_docs
          WHERE type = 'TL' AND status = 'OK' AND doc_date >= date('now', '+7 hours', '-30 days')
            AND COALESCE(json_array_length(json_extract(extra, '$.diff')), 0) > 0
          ORDER BY doc_date DESC LIMIT ${LIMIT}`,
  },
  {
    code: 'H4',
    group: 'HOAN',
    severity: 'VANG',
    title: `Gói cần khiếu nại sàn nhưng chưa gửi quá ${CLAIM_OPEN_DAYS} ngày`,
    hint: 'Hàng thiếu / hỏng của đơn Shopee, TikTok cần gửi khiếu nại để lấy lại tiền. Quá hạn khiếu nại thì sàn không đền.',
    columns: [['code', 'Mã vận đơn'], ['channel', 'Kênh'], ['scan_day', 'Ngày quét']],
    sql: `SELECT code, COALESCE(channel, '') AS channel, scan_day
          FROM ret_scans WHERE claim = 'CAN' AND state <> 'HUY' AND scan_day <= date('now', '+7 hours', '-${CLAIM_OPEN_DAYS} days')
          ORDER BY scan_day LIMIT ${LIMIT}`,
  },
];

export async function runChecks(db: D1Database, now: Date = new Date()): Promise<SoatResult> {
  const findings: Finding[] = [];
  const passed: SoatResult['passed'] = [];
  const errors: SoatResult['errors'] = [];
  for (const d of CHECK_DEFS) {
    try {
      const res = await db.prepare(d.sql).bind(...(d.params ?? [])).all<Record<string, string | number | null>>();
      const rows = res.results ?? [];
      if (!rows.length) {
        passed.push({ code: d.code, group: d.group, title: d.title });
        continue;
      }
      findings.push({
        code: d.code,
        group: d.group,
        severity: d.severity,
        title: d.title,
        hint: d.hint,
        count: rows.length,
        capped: rows.length >= LIMIT,
        columns: d.columns,
        rows: rows.slice(0, SHOW),
      });
    } catch (e) {
      errors.push({ code: d.code, title: d.title, message: e instanceof Error ? e.message : 'lỗi' });
    }
  }
  const order = { DO: 0, VANG: 1 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.code.localeCompare(b.code));
  return {
    at: now.toISOString(),
    summary: {
      red: findings.filter((f) => f.severity === 'DO').length,
      yellow: findings.filter((f) => f.severity === 'VANG').length,
      ok: passed.length,
    },
    findings,
    passed,
    errors,
  };
}

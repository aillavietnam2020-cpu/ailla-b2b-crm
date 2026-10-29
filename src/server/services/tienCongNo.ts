/**
 * TIỀN & CÔNG NỢ — MỘT CHỖ TÍNH Ở MÁY CHỦ (chuẩn hóa 27/10/2026). Định nghĩa từng chỉ số: đầu file hub/src/tiencalc.js.
 * Chỉ ĐỌC: không ghi, không sửa phiếu thu chi hay công nợ nào.
 *
 *  - Phải thu khách (theo kênh, tuổi nợ, DSO): debtAging() trong debts.ts — cũng là số của /api/debts/aging.
 *  - Phải trả nhà cung cấp + tuổi nợ: nccCongNo() dưới đây, CÙNG CÔNG THỨC với Mua hàng › Công nợ nhà cung cấp
 *    (routes/purchasing.ts GET /mh/debts; test tests/integration/tienCongNo.test.ts khóa hai bên bằng nhau).
 *  - Đối chiếu từng khách / nhà cung cấp: nợ đầu + phát sinh − đã trả − hàng trả lại = nợ cuối (chỉ chứng từ đã ghi nợ chính thức).
 *  - Chứng từ tiền (thu đã xác nhận, chi trên web) theo tài khoản: dongTien(). Phần sổ nằm trong ngăn tài chính
 *    (Sổ thu, Sổ chi phí, số dư kế toán nhập) cộng thêm ở trình duyệt (hub/src/tiencn.js).
 */
import { KENH_SQL, chiaTuoiNo, listDebts, type Kenh } from './debts';

const PO_PENDING_SQL = `SELECT po.supplier_id, po.id, po.no, po.order_date, SUM(l.qty * l.unit_price) AS value
  FROM po_orders po JOIN po_lines l ON l.po_id = po.id
  WHERE po.status <> 'HUY' AND l.unit_price IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM po_invoices v, json_each(v.receipt_ids) j JOIN po_receipts r ON r.id = j.value
                    WHERE r.po_id = po.id AND v.status = 'OK' AND r.status = 'OK')
  GROUP BY po.id`;

export interface NccDoc { date: string; kind: 'HD' | 'PM' | 'CHI' | 'COC'; ref: string; amount: number; ceo_status?: string; lq?: string }
/** Mã đơn bán mà một khoản tiền khách trả đã trừ vào (để bấm sang đơn). */
const PAY_DON = `(SELECT group_concat(COALESCE(o.legacy_order_code, o.order_no), ', ') FROM payment_allocations pa JOIN orders o ON o.id = pa.order_id
  WHERE pa.payment_id = x.id AND pa.reversed_at IS NULL)`;
/** Mã đơn mua của một phiếu chi nhà cung cấp. */
const PO_NO = `COALESCE((SELECT no FROM po_orders WHERE id = x.po_id), '')`;
export interface NccRow {
  id: string;
  name: string;
  opening_debt: number;
  opening_date: string | null;
  invoiced: number;
  po_pending: number;
  paid: number;
  balance: number;
  b30: number;
  b60: number;
  b90: number;
  b90p: number;
  old: number;
  oldest_days: number;
}

/** Chứng từ công nợ của từng nhà cung cấp, sau ngày chốt đầu kỳ (giống Mua hàng). */
async function nccDocs(db: D1Database, supplierId?: string) {
  const w = supplierId ? ' AND x.supplier_id = ?' : '';
  const b = supplierId ? [supplierId] : [];
  const [inv, pend, pay] = await Promise.all([
    db.prepare(`SELECT x.supplier_id, x.invoice_date AS date, x.invoice_no AS ref, x.total AS amount,
      (SELECT group_concat(DISTINCT po.no) FROM json_each(x.receipt_ids) j JOIN po_receipts r ON r.id = j.value JOIN po_orders po ON po.id = r.po_id) AS lq
      FROM po_invoices x WHERE x.status = 'OK'${w}`).bind(...b).all<{ supplier_id: string; date: string; ref: string; amount: number; lq: string | null }>(),
    db.prepare(`SELECT x.supplier_id, x.order_date AS date, x.no AS ref, x.value AS amount FROM (${PO_PENDING_SQL}) x WHERE 1=1${w}`).bind(...b).all<{ supplier_id: string; date: string; ref: string; amount: number }>(),
    db.prepare(`SELECT x.supplier_id, x.pay_date AS date, x.account AS ref, x.amount, x.kind, x.ceo_status, ${PO_NO} AS lq FROM po_payments x WHERE x.status = 'OK'${w}`).bind(...b).all<{ supplier_id: string; date: string; ref: string; amount: number; kind: string; ceo_status: string; lq: string }>(),
  ]);
  const by = new Map<string, NccDoc[]>();
  const add = (sid: string, d: NccDoc) => {
    const a = by.get(sid) ?? [];
    a.push(d);
    by.set(sid, a);
  };
  for (const r of inv.results ?? []) add(r.supplier_id, { date: r.date, kind: 'HD', ref: r.ref, amount: r.amount, lq: r.lq ?? '' });
  for (const r of pend.results ?? []) add(r.supplier_id, { date: r.date, kind: 'PM', ref: r.ref, amount: r.amount, lq: r.ref });
  for (const r of pay.results ?? []) add(r.supplier_id, { date: r.date, kind: r.kind === 'COC' ? 'COC' : 'CHI', ref: r.ref, amount: r.amount, ceo_status: r.ceo_status, lq: r.lq });
  return by;
}

/** Phải trả từng nhà cung cấp = đầu kỳ + chứng từ (hóa đơn; phiếu mua chưa có chứng từ theo giá đặt) − đã chi (cả cọc), sau ngày chốt đầu kỳ. */
export async function nccCongNo(db: D1Database, asOf: string): Promise<NccRow[]> {
  const sup = (await db.prepare('SELECT id, name, opening_debt, opening_date FROM suppliers WHERE active = 1 ORDER BY name').all<{ id: string; name: string; opening_debt: number; opening_date: string | null }>()).results ?? [];
  const docs = await nccDocs(db);
  return sup.map((s) => {
    const D = (docs.get(s.id) ?? []).filter((d) => !s.opening_date || d.date > s.opening_date);
    const sum = (k: NccDoc['kind'][]) => D.filter((d) => k.includes(d.kind)).reduce((t, d) => t + (d.amount || 0), 0);
    const invoiced = sum(['HD']);
    const po_pending = Math.round(sum(['PM']));
    const paid = sum(['CHI', 'COC']);
    const balance = (s.opening_debt || 0) + invoiced + po_pending - paid;
    const no = D.filter((d) => d.kind === 'HD' || d.kind === 'PM').sort((a, b) => b.date.localeCompare(a.date));
    return { ...s, opening_debt: s.opening_debt || 0, invoiced, po_pending, paid, balance, ...chiaTuoiNo(balance, no, asOf) };
  });
}

/* ---------------- Đối chiếu: nợ đầu + phát sinh − đã trả − hàng trả lại = nợ cuối ---------------- */

export interface DcRow {
  id: string;
  name: string;
  kenh?: Kenh;
  dau: number;
  phat_sinh: number;
  da_tra: number;
  tra_lai: number;
  cuoi: number;
  /** Số các trang đang hiện (công nợ chính thức / Mua hàng) — để thấy khớp hay lệch. */
  hien: number;
  cho_ghi_no?: number;
  cho_tien_ve?: number;
}
export interface ChungTu { date: string; loai: string; ref: string; note: string | null; amount: number; tinh: boolean; ceo?: string; /** mã đơn liên quan (đơn bán / đơn mua), cách nhau dấu phẩy */ lq?: string }

/** Chứng từ công nợ một khách (đơn đã giao/xuất, tiền thu, điều chỉnh, hàng trả lại). tinh = đã vào công nợ chính thức. */
async function khachChungTu(db: D1Database, customerId?: string) {
  const w = customerId ? ' AND x.customer_id = ?' : '';
  const b = customerId ? [customerId] : [];
  const [ord, pay, ret] = await Promise.all([
    db.prepare(`SELECT x.customer_id, x.order_date AS date, COALESCE(x.legacy_order_code, x.order_no) AS ref, x.total_amount AS amount, x.accounting_status AS st, x.note
      FROM orders x WHERE x.deleted_at IS NULL AND x.approval_status = 'APPROVED' AND x.delivery_status IN ('DA_XUAT_KHO','DA_GIAO')${w}`).bind(...b).all<Record<string, any>>(),
    db.prepare(`SELECT x.customer_id, x.paid_at AS date, COALESCE(x.external_receipt_no, x.method, '') AS ref, x.amount, x.accounting_status AS st, x.is_adjustment AS adj, x.note, x.method, ${PAY_DON} AS lq
      FROM payments x WHERE 1=1${w}`).bind(...b).all<Record<string, any>>(),
    db.prepare(`SELECT x.customer_id, x.return_date AS date, x.return_no AS ref, x.credit_amount AS amount, x.status AS st, x.reason AS note,
      (SELECT COALESCE(o.legacy_order_code, o.order_no) FROM orders o WHERE o.id = x.order_id) AS lq
      FROM order_returns x WHERE x.status IN ('DA_NHAN_KHO','DA_GIAM_NO')${w}`).bind(...b).all<Record<string, any>>(),
  ]);
  const by = new Map<string, Array<ChungTu & { k: 'PS' | 'TRA' | 'TL' }>>();
  const add = (cid: string, x: ChungTu & { k: 'PS' | 'TRA' | 'TL' }) => {
    const a = by.get(cid) ?? [];
    a.push(x);
    by.set(cid, a);
  };
  for (const o of ord.results ?? []) add(o.customer_id, { k: 'PS', date: String(o.date).slice(0, 10), loai: 'Đơn đã giao / xuất kho', ref: o.ref, note: o.note ?? null, amount: o.amount || 0, tinh: o.st === 'DA_XAC_NHAN', lq: o.ref });
  for (const p of pay.results ?? []) {
    const adj = p.adj === 1;
    add(p.customer_id, { k: 'TRA', date: String(p.date).slice(0, 10), loai: adj ? 'Bút toán đảo / hoàn tiền' : p.method === 'Bù trừ cước vận chuyển' ? 'Bù trừ cước khách trả hộ' : 'Tiền khách trả', ref: p.ref, note: p.note ?? null, amount: adj ? -p.amount : p.amount, tinh: p.st === 'DA_XAC_NHAN', lq: p.lq ?? '' });
  }
  for (const r of ret.results ?? []) add(r.customer_id, { k: 'TL', date: String(r.date).slice(0, 10), loai: 'Hàng trả lại', ref: r.ref, note: r.note ?? null, amount: r.amount || 0, tinh: r.st === 'DA_GIAM_NO', lq: r.lq ?? '' });
  return by;
}

export async function doiChieuKhach(db: D1Database, from: string, to: string): Promise<DcRow[]> {
  const list = await listDebts(db, '1=1', []);
  const kenh = new Map(((await db.prepare(`SELECT c.id, ${KENH_SQL} AS kenh FROM customers c`).all<{ id: string; kenh: Kenh }>()).results ?? []).map((r) => [r.id, r.kenh]));
  const docs = await khachChungTu(db);
  return list
    .map((d) => {
      const D = (docs.get(d.customer_id) ?? []).filter((x) => x.tinh && x.date <= to);
      const truoc = D.filter((x) => x.date < from);
      const trong = D.filter((x) => x.date >= from);
      const s = (L: typeof D, k: string) => L.filter((x) => x.k === k).reduce((t, x) => t + x.amount, 0);
      const dau = d.opening_debt + s(truoc, 'PS') - s(truoc, 'TRA') - s(truoc, 'TL');
      const r: DcRow = { id: d.customer_id, name: d.customer_name, kenh: kenh.get(d.customer_id) ?? 'B2B', dau, phat_sinh: s(trong, 'PS'), da_tra: s(trong, 'TRA'), tra_lai: s(trong, 'TL'), cuoi: 0, hien: d.official_debt, cho_ghi_no: d.pending_charges, cho_tien_ve: d.pending_cash };
      r.cuoi = r.dau + r.phat_sinh - r.da_tra - r.tra_lai;
      return r;
    })
    .filter((r) => r.dau || r.phat_sinh || r.da_tra || r.tra_lai || r.cuoi || r.hien);
}

export async function doiChieuNcc(db: D1Database, from: string, to: string, asOf: string): Promise<DcRow[]> {
  const rows = await nccCongNo(db, asOf);
  const docs = await nccDocs(db);
  return rows
    .map((s) => {
      const D = (docs.get(s.id) ?? []).filter((d) => (!s.opening_date || d.date > s.opening_date) && d.date <= to);
      const v = (L: NccDoc[], no: boolean) => L.filter((d) => (d.kind === 'HD' || d.kind === 'PM') === no).reduce((t, d) => t + (d.amount || 0), 0);
      const truoc = D.filter((d) => d.date < from);
      const trong = D.filter((d) => d.date >= from);
      const dau = s.opening_debt + v(truoc, true) - v(truoc, false);
      const r: DcRow = { id: s.id, name: s.name, dau, phat_sinh: v(trong, true), da_tra: v(trong, false), tra_lai: 0, cuoi: 0, hien: s.balance };
      r.cuoi = r.dau + r.phat_sinh - r.da_tra;
      return r;
    })
    .filter((r) => r.dau || r.phat_sinh || r.da_tra || r.cuoi || r.hien);
}

export async function chungTuKhach(db: D1Database, customerId: string): Promise<{ opening_debt: number; rows: ChungTu[] }> {
  const c = await db.prepare('SELECT opening_debt FROM customers WHERE id = ?').bind(customerId).first<{ opening_debt: number | null }>();
  const L = (await khachChungTu(db, customerId)).get(customerId) ?? [];
  return { opening_debt: c?.opening_debt ?? 0, rows: L.map(({ k: _k, ...x }) => x).sort((a, b) => a.date.localeCompare(b.date)) };
}
export async function chungTuNcc(db: D1Database, supplierId: string): Promise<{ opening_debt: number; opening_date: string | null; rows: ChungTu[] }> {
  const s = await db.prepare('SELECT opening_debt, opening_date FROM suppliers WHERE id = ?').bind(supplierId).first<{ opening_debt: number; opening_date: string | null }>();
  const L = (await nccDocs(db, supplierId)).get(supplierId) ?? [];
  const nm: Record<NccDoc['kind'], string> = { HD: 'Hóa đơn / chứng từ', PM: 'Phiếu mua chưa có chứng từ (giá đặt)', CHI: 'Đã chi', COC: 'Đã cọc' };
  return {
    opening_debt: s?.opening_debt ?? 0,
    opening_date: s?.opening_date ?? null,
    rows: L.map((d) => ({ date: d.date, loai: nm[d.kind], ref: d.ref, note: null, amount: d.kind === 'CHI' || d.kind === 'COC' ? -d.amount : Math.round(d.amount), tinh: !s?.opening_date || d.date > s.opening_date, ceo: d.ceo_status || '', lq: d.lq || '' })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/* ---------------- Chứng từ tiền trên web, theo tài khoản ---------------- */

export interface TienDoc {
  date: string;
  /** THU: tiền khách Kênh phân phối / OEM kế toán đã xác nhận · CHI_NCC, CHI_VC, CHI_THUONG · HOAN: bút toán đảo / hoàn tiền đã xác nhận */
  loai: 'THU' | 'CHI_NCC' | 'CHI_VC' | 'CHI_THUONG' | 'HOAN';
  ref: string;
  party: string;
  /** + tiền vào, − tiền ra */
  amount: number;
  /** id tài khoản nhận tiền, 'TIEN_MAT', hoặc '' = chưa rõ tài khoản */
  acct: string;
  acct_text: string;
  ceo: string;
  /** mã đơn liên quan (đơn bán khách trả / đơn mua / đơn được chở) */
  lq: string;
}

/** Nhận ra tài khoản từ chữ ghi trên phiếu chi ("MB · 0123 · CTY AILLA"): khớp số tài khoản. */
export function acctOf(text: string, method: string, accts: Array<{ id: string; account_no: string }>): string {
  const t = String(text || '').replace(/\s+/g, '');
  const a = t ? accts.find((x) => x.account_no && t.includes(x.account_no)) : undefined;
  if (a) return a.id;
  if (method === 'TIEN_MAT' || /tiền mặt/i.test(text || '') || /^tiền mặt/i.test(method || '')) return 'TIEN_MAT';
  return '';
}

export async function dongTien(db: D1Database, from: string, to: string): Promise<{ accounts: Array<{ id: string; bank: string; account_no: string; account_name: string; active: number }>; docs: TienDoc[] }> {
  const accounts = (await db.prepare('SELECT id, bank, account_no, account_name, active FROM receiving_accounts ORDER BY bank').all<{ id: string; bank: string; account_no: string; account_name: string; active: number }>()).results ?? [];
  const [pay, po, vc, bo] = await Promise.all([
    db.prepare(`SELECT x.paid_at AS date, COALESCE(x.external_receipt_no, '') AS ref, c.name AS party, x.amount, x.is_adjustment AS adj, x.method, x.receiving_account_id AS acct, ${PAY_DON} AS lq
      FROM payments x JOIN customers c ON c.id = x.customer_id
      WHERE x.accounting_status = 'DA_XAC_NHAN' AND COALESCE(x.method, '') <> 'Bù trừ cước vận chuyển' AND substr(x.paid_at, 1, 10) BETWEEN ? AND ?`).bind(from, to).all<Record<string, any>>(),
    db.prepare(`SELECT x.pay_date AS date, s.name AS party, x.amount, x.kind, x.method, x.from_account, x.account, x.ceo_status, ${PO_NO} AS lq
      FROM po_payments x JOIN suppliers s ON s.id = x.supplier_id WHERE x.status = 'OK' AND x.pay_date BETWEEN ? AND ?`).bind(from, to).all<Record<string, any>>(),
    db.prepare(`SELECT voucher_date AS date, voucher_no AS ref, carrier AS party, amount, method, from_account, ceo_status, order_refs AS lq
      FROM shipping_vouchers WHERE status = 'OK' AND method <> 'KHAC' AND voucher_date BETWEEN ? AND ?`).bind(from, to).all<Record<string, any>>(),
    db.prepare(`SELECT substr(b.approved_at, 1, 10) AS date, b.voucher_no AS ref, c.name AS party, b.amount, b.method, b.ceo_status
      FROM bonus_cash_vouchers b JOIN customers c ON c.id = b.customer_id WHERE b.status = 'DA_CHI' AND substr(b.approved_at, 1, 10) BETWEEN ? AND ?`).bind(from, to).all<Record<string, any>>(),
  ]);
  const lb = new Map(accounts.map((a) => [a.id, [a.bank, a.account_no, a.account_name].filter(Boolean).join(' · ')]));
  const docs: TienDoc[] = [];
  for (const p of pay.results ?? []) {
    const acct = p.acct || (/tiền mặt/i.test(p.method || '') ? 'TIEN_MAT' : '');
    docs.push({ date: String(p.date).slice(0, 10), loai: p.adj === 1 ? 'HOAN' : 'THU', ref: p.ref, party: p.party, amount: p.adj === 1 ? -p.amount : p.amount, acct, acct_text: p.acct ? lb.get(p.acct) ?? '' : p.method || '', ceo: '', lq: p.lq ?? '' });
  }
  for (const p of po.results ?? []) {
    const txt = p.from_account || p.account || '';
    docs.push({ date: p.date, loai: 'CHI_NCC', ref: p.kind === 'COC' ? 'Cọc' : 'Trả nhà cung cấp', party: p.party, amount: -p.amount, acct: acctOf(txt, p.method, accounts), acct_text: txt, ceo: p.ceo_status || '', lq: p.lq || '' });
  }
  for (const v of vc.results ?? []) docs.push({ date: v.date, loai: 'CHI_VC', ref: v.ref, party: v.party, amount: -v.amount, acct: acctOf(v.from_account, v.method, accounts), acct_text: v.from_account || v.method, ceo: v.ceo_status || '', lq: v.lq || '' });
  for (const b of bo.results ?? []) docs.push({ date: b.date, loai: 'CHI_THUONG', ref: b.ref, party: b.party, amount: -b.amount, acct: b.method === 'TIEN_MAT' ? 'TIEN_MAT' : '', acct_text: b.method, ceo: b.ceo_status || '', lq: '' });
  docs.sort((a, b) => a.date.localeCompare(b.date));
  return { accounts, docs };
}

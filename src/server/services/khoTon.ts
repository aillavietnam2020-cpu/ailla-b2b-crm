import { unpack } from '../lib/pack';

/**
 * MỘT CHỖ TÍNH TỒN KHO cho mọi trang hai web (chuẩn hóa 27/10/2026). Trang vận hành, trang quản trị, Máy soát số liệu,
 * cảnh báo kho và bot đều đọc số từ đây (máy chủ) và từ hub/src/khocalc.js (cùng luật, phía trình duyệt).
 *
 * ĐỊNH NGHĨA CHỈ SỐ (một mã MISA, đến hết ngày xem):
 *  - Tồn thực tế  = tổng các dòng trong sổ kho (view kho_ledger): phiếu kho còn hiệu lực (tồn đầu kỳ, nhập NVL,
 *                   pha chế, kiểm kê đóng gói, xuất khác, nhập hàng hoàn) + đơn Kênh phân phối đã xuất kho (từ ngày
 *                   kho_cfg.b2b_from, quy đổi mã theo Đồng bộ mã B2B) + hàng trả lại đã nhận + xuất bán lẻ sàn theo ngày
 *                   (từ ngày kho_cfg.online_from). Làm tròn 6 số lẻ.
 *  - Hàng đã giữ  = số trên các đơn Kênh phân phối đã duyệt, kho đã nhận lệnh (kho_status CHO_XUAT) nhưng chưa xuất
 *                   (delivery_status CHUA_XUAT), quy đổi qua Đồng bộ mã B2B. Cùng cách trang Đơn hàng báo "thiếu hàng".
 *  - Tồn khả dụng = tồn thực tế − hàng đã giữ.
 *  - Đang sản xuất= phiếu sản xuất "Đang làm" (phần chưa ra lô) + lô đã làm chưa nhập kho (chờ kiểm, chờ phân bổ, chờ in tem),
 *                   lấy ở ngăn Sản xuất (hub_state 'sx'). Chỉ để xem, KHÔNG cộng vào tồn.
 *  - Giá trị tồn  = phần tồn thực tế dương × giá bình quân gia quyền (Mua hàng › Giá nguyên vật liệu); thành phẩm chưa có giá.
 *  - Âm kho       = tồn thực tế < 0 (tính cả mã đã ngừng dùng, vì sổ vẫn sai).
 *  - Sắp hết      = có định mức an toàn (kho_items.min_stock > 0), không âm, và tồn khả dụng < định mức.
 *  - Nhóm         = Vỏ can, chai (nhóm "Vỏ can, chai, túi" hoặc có hồ sơ vỏ) · Nguyên vật liệu (NVL khác, công cụ) ·
 *                   Bán thành phẩm · Thành phẩm (thành phẩm, hàng hóa, combo).
 */

export type KhoNhom = 'VO' | 'NVL' | 'BTP' | 'TP';
export type KhoTrangThai = 'AM' | 'SAP_HET' | 'DU';

export const KHO_EPS = 1e-6;
export const r6 = (n: number) => Math.round((Number(n) || 0) * 1e6) / 1e6;

/** Nhóm hiển thị của một mã. Giống khoNhom trong hub/src/khocalc.js. */
export function khoNhom(cls: string, grp: string, isVo: boolean): KhoNhom {
  if (isVo || /^vỏ can/i.test(grp || '')) return 'VO';
  if (cls === 'NVL' || cls === 'CCDC') return 'NVL';
  if (cls === 'BTP') return 'BTP';
  return 'TP';
}

/** Trạng thái một mã. Giống khoTrangThai trong hub/src/khocalc.js. */
export function khoTrangThai(ton: number, khaDung: number, min: number): KhoTrangThai {
  if (r6(ton) < 0) return 'AM';
  if (min > 0 && r6(khaDung) < min) return 'SAP_HET';
  return 'DU';
}

export interface KhoTonRow {
  code: string;
  name: string;
  unit: string;
  cls: string;
  grp: string;
  nhom: KhoNhom;
  active: number;
  min_stock: number;
  ton: number;
  giu: number;
  kha_dung: number;
  dang_sx: number;
  so_dong: number;
  co_nhap: number;
  trang_thai: KhoTrangThai;
}

interface SxLite {
  requests?: Array<{ id: string; sp: string; sl: number | null; st: string }>;
  batches?: Array<{ sp: string; st: string; req?: string; baoSL?: number; dat?: number; tong?: number }>;
}

/** Đang sản xuất theo mã, từ ngăn Sản xuất. Lỗi đọc thì coi như 0 (không chặn trang tồn). */
export function dangSanXuat(sx: SxLite | null): Map<string, number> {
  const out = new Map<string, number>();
  if (!sx) return out;
  const add = (k: string, q: number) => {
    if (k && q > 0) out.set(k, r6((out.get(k) ?? 0) + q));
  };
  const lotQty = (b: { st: string; baoSL?: number; dat?: number; tong?: number }) =>
    b.st === 'CHO_KIEM' ? Number(b.baoSL) || 0 : Number(b.dat ?? b.tong) || 0;
  const lots = (sx.batches ?? []).filter((b) => b.st !== 'HUY');
  for (const b of lots) if (b.st !== 'SAN_SANG') add(b.sp, lotQty(b));
  for (const r of sx.requests ?? []) {
    if (r.st !== 'DANG_LAM') continue;
    const made = lots.filter((b) => b.req === r.id).reduce((t, b) => t + lotQty(b), 0);
    add(r.sp, Math.max(0, (Number(r.sl) || 0) - made));
  }
  return out;
}

async function readSx(db: D1Database): Promise<SxLite | null> {
  try {
    const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'sx'").first<{ data: string }>();
    return row ? (JSON.parse(await unpack(row.data)) as SxLite) : null;
  } catch {
    return null;
  }
}

/** Hàng đã giữ cho đơn Kênh phân phối (chưa xuất). Cùng điều kiện với orderFlow.ts (báo thiếu hàng). */
export const GIU_SQL = `SELECT km.misa_code AS item, SUM(oi.qty * km.factor) AS q
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  JOIN kho_map km ON km.crm_sku = p.sku
  WHERE o.flow_on = 1 AND o.kho_status = 'CHO_XUAT' AND o.approval_status = 'APPROVED'
    AND o.delivery_status = 'CHUA_XUAT' AND o.deleted_at IS NULL
  GROUP BY km.misa_code`;

/** Tồn mọi mã đến hết ngày asof (mặc định: hôm nay trở đi, tức mọi dòng). */
export async function khoTonRows(db: D1Database, asof = '9999-12-31'): Promise<KhoTonRow[]> {
  const [items, led, giu, sx] = await Promise.all([
    db
      .prepare(
        `SELECT i.code, i.name, i.unit, i.cls, i.grp, i.min_stock, i.active, CASE WHEN v.code IS NULL THEN 0 ELSE 1 END AS is_vo
         FROM kho_items i LEFT JOIN kho_vo v ON v.code = i.code`,
      )
      .all<{ code: string; name: string; unit: string; cls: string; grp: string; min_stock: number; active: number; is_vo: number }>(),
    db
      .prepare(
        `SELECT item, ROUND(SUM(qty), 6) AS q, COUNT(*) AS n, SUM(CASE WHEN qty > 0 THEN 1 ELSE 0 END) AS nin
         FROM kho_ledger WHERE doc_date <= ? GROUP BY item`,
      )
      .bind(asof)
      .all<{ item: string; q: number; n: number; nin: number }>(),
    db.prepare(GIU_SQL).all<{ item: string; q: number }>(),
    readSx(db),
  ]);
  const L = new Map((led.results ?? []).map((r) => [r.item, r]));
  const G = new Map((giu.results ?? []).map((r) => [r.item, r6(r.q)]));
  const S = dangSanXuat(sx);
  return (items.results ?? []).map((i) => {
    const l = L.get(i.code);
    const ton = r6(l?.q ?? 0);
    const g = G.get(i.code) ?? 0;
    const kd = r6(ton - g);
    const min = Number(i.min_stock) || 0;
    return {
      code: i.code,
      name: i.name,
      unit: i.unit,
      cls: i.cls,
      grp: i.grp,
      nhom: khoNhom(i.cls, i.grp, !!i.is_vo),
      active: i.active,
      min_stock: min,
      ton,
      giu: g,
      kha_dung: kd,
      dang_sx: S.get(i.code) ?? 0,
      so_dong: l?.n ?? 0,
      co_nhap: l?.nin ?? 0,
      trang_thai: khoTrangThai(ton, kd, min),
    };
  });
}

export interface KhoDcRow {
  code: string;
  dau: number;
  nhap: number;
  xuat: number;
  cuoi: number;
  td: number;
  nhap_truoc: number;
  am_tu: string | null;
  am_phieu: string | null;
  lech: number;
}

/**
 * Đối chiếu tồn kho trong kỳ: tồn đầu (mọi dòng trước from) + nhập − xuất = tồn cuối (đến hết to).
 * Kèm: đã có phiếu tồn đầu kỳ chưa, có từng có dòng nhập nào chưa, mã âm từ ngày nào do phiếu nào (dòng đầu tiên làm số
 * chạy xuống dưới 0), và số dòng lệch chứng từ (đơn xuất thực khác số trên đơn, kiểm kê khác số phiếu sản xuất).
 */
export async function khoDoiChieu(db: D1Database, from: string, to: string): Promise<KhoDcRow[]> {
  const [sum, lines, lech] = await Promise.all([
    db
      .prepare(
        `SELECT item AS code,
           ROUND(SUM(CASE WHEN doc_date < ?1 THEN qty ELSE 0 END), 6) AS dau,
           ROUND(SUM(CASE WHEN doc_date >= ?1 AND doc_date <= ?2 AND qty > 0 THEN qty ELSE 0 END), 6) AS nhap,
           ROUND(SUM(CASE WHEN doc_date >= ?1 AND doc_date <= ?2 AND qty < 0 THEN -qty ELSE 0 END), 6) AS xuat,
           ROUND(SUM(CASE WHEN doc_date <= ?2 THEN qty ELSE 0 END), 6) AS cuoi,
           SUM(CASE WHEN doc_type = 'TD' AND doc_date <= ?2 THEN 1 ELSE 0 END) AS td,
           SUM(CASE WHEN qty > 0 AND doc_date <= ?2 THEN 1 ELSE 0 END) AS nhap_truoc
         FROM kho_ledger GROUP BY item`,
      )
      .bind(from, to)
      .all<Omit<KhoDcRow, 'am_tu' | 'am_phieu' | 'lech'>>(),
    db
      .prepare(
        `SELECT item, doc_date, doc_no, SUM(qty) AS qty FROM kho_ledger WHERE doc_date <= ?
         GROUP BY item, doc_date, doc_id, doc_no ORDER BY item, doc_date, doc_id, doc_no`,
      )
      .bind(to)
      .all<{ item: string; doc_date: string; doc_no: string; qty: number }>(),
    db
      .prepare(
        `SELECT item, COUNT(*) AS n FROM (
           SELECT km.misa_code AS item FROM orders o
           JOIN order_kho_lines okl ON okl.order_id = o.id
           JOIN (SELECT order_id, product_id, SUM(qty) AS qty FROM order_items GROUP BY order_id, product_id) oi
             ON oi.order_id = o.id AND oi.product_id = okl.product_id
           JOIN products p ON p.id = oi.product_id JOIN kho_map km ON km.crm_sku = p.sku
           WHERE o.deleted_at IS NULL AND okl.shipped_qty IS NOT NULL AND ABS(okl.shipped_qty - oi.qty) > 0.000001
             AND substr(o.delivered_at, 1, 10) >= ?1 AND substr(o.delivered_at, 1, 10) <= ?2
           UNION ALL
           SELECT m.item FROM kho_docs d JOIN kho_moves m ON m.doc_id = d.id
           WHERE d.status = 'OK' AND d.type = 'KS' AND m.role = 'PRODUCT' AND d.ref_qty IS NOT NULL
             AND ABS((SELECT SUM(m2.qty) FROM kho_moves m2 WHERE m2.doc_id = d.id AND m2.role = 'PRODUCT') - d.ref_qty) > 0.000001
             AND d.doc_date >= ?1 AND d.doc_date <= ?2
         ) GROUP BY item`,
      )
      .bind(from, to)
      .all<{ item: string; n: number }>(),
  ]);
  const firstNeg = khoAmTu(lines.results ?? []);
  const LE = new Map((lech.results ?? []).map((r) => [r.item, r.n]));
  return (sum.results ?? []).map((r) => {
    const f = firstNeg.get(r.code);
    return { ...r, am_tu: f?.doc_date ?? null, am_phieu: f?.doc_no ?? null, lech: LE.get(r.code) ?? 0 };
  });
}

/**
 * Với mỗi mã đang âm ở dòng cuối: dòng (phiếu) đầu tiên của lần âm cuối cùng — sau dòng đó số chạy không trở lại ≥ 0 nữa.
 * Dòng đã sắp theo mã, ngày, phiếu.
 */
export function khoAmTu(lines: Array<{ item: string; doc_date: string; doc_no: string; qty: number }>) {
  const out = new Map<string, { doc_date: string; doc_no: string }>();
  let cur = '';
  let run = 0;
  let mark: { doc_date: string; doc_no: string } | null = null;
  const close = () => {
    if (cur && r6(run) < 0 && mark) out.set(cur, mark);
  };
  for (const l of lines) {
    if (l.item !== cur) {
      close();
      cur = l.item;
      run = 0;
      mark = null;
    }
    const before = r6(run);
    run += Number(l.qty) || 0;
    if (r6(run) < 0 && before >= 0) mark = { doc_date: l.doc_date, doc_no: l.doc_no };
    if (r6(run) >= 0) mark = null;
  }
  close();
  return out;
}

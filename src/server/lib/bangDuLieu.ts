/**
 * BẢNG DỮ LIỆU (Quản trị phòng ban đợt 3, CEO duyệt demo 14/11/2026).
 * Lead tự tạo bảng biểu của phòng: tự đặt cột, chỉ số tự tính, xem dạng bảng hoặc thẻ kéo thả.
 * Không phải chỗ để file (file vẫn ở Thư mục làm việc trên Drive, bảng chỉ gắn link).
 * Bảng không lấy số nào từ hệ thống (giá vốn, lợi nhuận, lương… vẫn khóa cứng, chỉ CEO và Kế toán).
 * File này chỉ có logic thuần: kiểm cấu trúc bảng, kiểm ô dữ liệu, ai xem / ai sửa.
 */

export const COL_TYPES = ['text', 'num', 'date', 'sel', 'user', 'link', 'check'] as const;
export type ColType = (typeof COL_TYPES)[number];
export const METRIC_KINDS = ['dem', 'tong', 'tb', 'tile'] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];

export const LIMITS = { tablesPerDept: 30, cols: 30, opts: 30, metrics: 12, rows: 5000, cell: 2000, them: 10 };

export type BangCol = { k: string; t: string; ty: ColType; opts?: string[] };
export type BangMetric = { t: string; kind: MetricKind; col?: string; fc?: string; fv?: string };
export type BangDef = {
  cols: BangCol[];
  metrics: BangMetric[];
  xem: { mode: 'phong' | 'lead'; them: string[] };
  sua: 'lead' | 'phutrach' | 'phong';
  kan?: string;
};

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.normalize('NFC').trim().slice(0, max) : '');
const KEY_RE = /^c[a-z0-9]{1,12}$/;

/** Kiểm lại cấu trúc bảng trình duyệt gửi lên. Sai chỗ nào thì bỏ chỗ đó (không tin trình duyệt). */
export function sanitizeDef(raw: unknown): BangDef {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const cols: BangCol[] = [];
  for (const c of Array.isArray(r.cols) ? r.cols : []) {
    if (cols.length >= LIMITS.cols) break;
    const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    const k = str(o.k, 13);
    const ty = (COL_TYPES as readonly string[]).includes(String(o.ty)) ? (o.ty as ColType) : null;
    const t = str(o.t, 60);
    if (!KEY_RE.test(k) || !ty || !t || cols.some((x) => x.k === k)) continue;
    const col: BangCol = { k, t, ty };
    if (ty === 'sel') {
      const opts = [...new Set((Array.isArray(o.opts) ? o.opts : []).map((x) => str(x, 40)).filter(Boolean))].slice(0, LIMITS.opts);
      col.opts = opts;
    }
    cols.push(col);
  }
  const byK = new Map(cols.map((c) => [c.k, c]));
  const metrics: BangMetric[] = [];
  for (const m of Array.isArray(r.metrics) ? r.metrics : []) {
    if (metrics.length >= LIMITS.metrics) break;
    const o = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
    const kind = (METRIC_KINDS as readonly string[]).includes(String(o.kind)) ? (o.kind as MetricKind) : null;
    if (!kind) continue;
    const mt: BangMetric = { t: str(o.t, 60) || 'Chỉ số', kind };
    if (kind === 'tong' || kind === 'tb') {
      const col = byK.get(str(o.col, 13));
      if (!col || col.ty !== 'num') continue;
      mt.col = col.k;
    }
    const fc = byK.get(str(o.fc, 13));
    if (fc && (fc.ty === 'sel' || fc.ty === 'check')) {
      mt.fc = fc.k;
      mt.fv = str(o.fv, 40);
    }
    if (kind === 'tile' && !mt.fc) continue; // tỉ lệ phải có điều kiện
    metrics.push(mt);
  }
  const x = (r.xem && typeof r.xem === 'object' ? r.xem : {}) as Record<string, unknown>;
  const them = [...new Set((Array.isArray(x.them) ? x.them : []).map((d) => str(d, 20)).filter(Boolean))].slice(0, LIMITS.them);
  const def: BangDef = {
    cols,
    metrics,
    xem: { mode: x.mode === 'lead' ? 'lead' : 'phong', them },
    sua: r.sua === 'phong' || r.sua === 'phutrach' ? r.sua : 'lead',
  };
  const kan = byK.get(str(r.kan, 13));
  if (kan && kan.ty === 'sel') def.kan = kan.k;
  return def;
}

/** Kiểm từng ô. Chỉ nhận cột đang có; ô của cột đã bỏ thì giữ nguyên giá trị cũ (để hoàn tác bỏ cột vẫn còn dữ liệu). */
export function sanitizeRow(patch: unknown, def: BangDef, old: Record<string, unknown> = {}): Record<string, unknown> {
  const p = (patch && typeof patch === 'object' ? patch : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...old };
  for (const c of def.cols) {
    if (!(c.k in p)) continue;
    const v = p[c.k];
    if (v === null || v === '' || v === undefined) {
      delete out[c.k];
      continue;
    }
    if (c.ty === 'num') {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[.\s]/g, '').replace(',', '.'));
      if (Number.isFinite(n) && Math.abs(n) < 1e15) out[c.k] = n;
    } else if (c.ty === 'date') {
      const s = str(v, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) out[c.k] = s;
    } else if (c.ty === 'check') {
      out[c.k] = v === true || v === 'true' || v === 1;
    } else if (c.ty === 'sel') {
      const s = str(v, 40);
      if ((c.opts ?? []).includes(s)) out[c.k] = s;
    } else if (c.ty === 'user') {
      const s = str(v, 40);
      if (/^[A-Za-z0-9_-]+$/.test(s)) out[c.k] = s;
    } else if (c.ty === 'link') {
      const s = str(v, LIMITS.cell);
      if (/^https?:\/\//i.test(s)) out[c.k] = s;
    } else {
      out[c.k] = str(v, LIMITS.cell);
    }
  }
  return out;
}

/** Người đang xem: hub user id, phòng, có phải Lead của phòng chủ bảng không, có phải CEO không. */
export type BangViewer = { hubId: string; dept: string; leadDept: string; ceo: boolean };

export function canView(tblDept: string, def: BangDef, v: BangViewer): boolean {
  if (v.ceo || v.leadDept === tblDept) return true;
  if (def.xem.mode === 'lead') return false;
  if (!v.dept) return false;
  return v.dept === tblDept || def.xem.them.includes(v.dept);
}

/** Sửa cấu trúc (cột, chỉ số, ai xem / ai sửa, xóa bảng): chỉ Lead phòng chủ bảng hoặc CEO. */
export function canDesign(tblDept: string, v: BangViewer): boolean {
  return v.ceo || v.leadDept === tblDept;
}

export function canAddRow(tblDept: string, def: BangDef, v: BangViewer): boolean {
  if (canDesign(tblDept, v)) return true;
  return def.sua !== 'lead' && v.dept === tblDept;
}

/** "Lead + người phụ trách": người trong phòng sửa được dòng mình thêm hoặc dòng có tên mình ở cột kiểu Người. */
export function canEditRow(
  tblDept: string,
  def: BangDef,
  v: BangViewer,
  row: { by_id?: string | null; data: Record<string, unknown> },
): boolean {
  if (canDesign(tblDept, v)) return true;
  if (def.sua === 'lead' || v.dept !== tblDept || !v.hubId) return false;
  if (def.sua === 'phong') return true;
  if (row.by_id === v.hubId) return true;
  return def.cols.some((c) => c.ty === 'user' && row.data[c.k] === v.hubId);
}

/** Một câu ngắn cho nhật ký: cấu trúc bảng đổi gì. */
export function describeDefChange(name0: string, d0: BangDef, name1: string, d1: BangDef): string {
  const parts: string[] = [];
  if (name0 !== name1) parts.push(`đổi tên thành "${name1}"`);
  const k0 = new Map(d0.cols.map((c) => [c.k, c]));
  const k1 = new Map(d1.cols.map((c) => [c.k, c]));
  const add = d1.cols.filter((c) => !k0.has(c.k)).map((c) => c.t);
  const del = d0.cols.filter((c) => !k1.has(c.k)).map((c) => c.t);
  const ren = d1.cols.filter((c) => k0.has(c.k) && (k0.get(c.k)!.t !== c.t || JSON.stringify(k0.get(c.k)!.opts ?? []) !== JSON.stringify(c.opts ?? []))).map((c) => c.t);
  if (add.length) parts.push(`thêm cột ${add.map((x) => `"${x}"`).join(", ")}`);
  if (del.length) parts.push(`bỏ cột ${del.map((x) => `"${x}"`).join(", ")}`);
  if (ren.length) parts.push(`sửa cột ${ren.map((x) => `"${x}"`).join(", ")}`);
  if (JSON.stringify(d0.cols.map((c) => c.k)) !== JSON.stringify(d1.cols.map((c) => c.k)) && !add.length && !del.length) parts.push('đổi thứ tự cột');
  if (JSON.stringify(d0.metrics) !== JSON.stringify(d1.metrics)) parts.push('sửa chỉ số tự tính');
  if (JSON.stringify(d0.xem) !== JSON.stringify(d1.xem)) parts.push('đổi ai được xem');
  if (d0.sua !== d1.sua) parts.push('đổi ai được sửa');
  if ((d0.kan ?? '') !== (d1.kan ?? '')) parts.push('đổi cột chia thẻ');
  return `Bảng "${name0}": ${parts.join('; ') || 'lưu lại, không đổi gì'}`;
}

/**
 * Hoàn tác MỘT thay đổi cấu trúc mà không xóa các thay đổi làm sau nó:
 * chỉ trả lại đúng phần khác nhau giữa trước / sau của dòng nhật ký, áp lên cấu trúc hiện tại.
 */
export function revertDef(cur: BangDef, before: BangDef, after: BangDef): BangDef {
  const out: BangDef = JSON.parse(JSON.stringify(cur)) as BangDef;
  const bK = new Map(before.cols.map((c, i) => [c.k, { c, i }]));
  const aK = new Map(after.cols.map((c) => [c.k, c]));
  // cột vừa thêm → bỏ; cột vừa bỏ → thêm lại đúng chỗ; cột vừa sửa → trả về như cũ
  out.cols = out.cols.filter((c) => bK.has(c.k) || !aK.has(c.k));
  for (const [k, { c, i }] of bK) {
    const a = aK.get(k);
    if (!a) {
      if (!out.cols.some((x) => x.k === k)) out.cols.splice(Math.min(i, out.cols.length), 0, c);
    } else if (JSON.stringify(a) !== JSON.stringify(c)) {
      out.cols = out.cols.map((x) => (x.k === k ? c : x));
    }
  }
  const sameSet = before.cols.length === after.cols.length && before.cols.every((c) => aK.has(c.k));
  if (sameSet && JSON.stringify(before.cols.map((c) => c.k)) !== JSON.stringify(after.cols.map((c) => c.k))) {
    const order = before.cols.map((c) => c.k);
    out.cols.sort((x, y) => (order.indexOf(x.k) + 1 || 999) - (order.indexOf(y.k) + 1 || 999));
  }
  if (JSON.stringify(before.metrics) !== JSON.stringify(after.metrics)) out.metrics = before.metrics;
  if (JSON.stringify(before.xem) !== JSON.stringify(after.xem)) out.xem = before.xem;
  if (before.sua !== after.sua) out.sua = before.sua;
  if ((before.kan ?? '') !== (after.kan ?? '')) {
    if (before.kan) out.kan = before.kan;
    else delete out.kan;
  }
  return sanitizeDef(out);
}

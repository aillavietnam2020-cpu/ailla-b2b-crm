import { nowIso, vnDate } from '@shared/datetime';
import type { AuthContext } from '../env';
import { badRequest, conflict } from '../lib/http';
import { pack, unpack } from '../lib/pack';
import { flowSummary } from './orderFlow';

/**
 * "Tạo lệnh sản xuất" từ danh sách mã đang thiếu (trang Đơn hàng CRM).
 * Phiếu sản xuất nằm ở ngăn Sản xuất của web chung (hub_state id 'sx', d.requests), nên ở đây đọc – thêm – ghi lại
 * có kiểm số phiên bản. Số lượng quy từ đơn vị CRM sang đơn vị kho bằng hệ số trong bảng đồng bộ mã (kho_map).
 */
const SX_ID = 'sx';

interface PsxRequest {
  id: string;
  sp: string;
  sl: number | null;
  nguon: string;
  uu: string;
  han: string;
  ghiChu: string;
  st: string;
  tao: string;
  taoLuc: string;
  batDau: string;
  lots: string[];
  hist: Array<{ at: string; by: string; act: string }>;
  src?: string;
  skuCrm?: string;
}

interface SxData {
  requests: PsxRequest[];
  log?: Array<{ at: string; by: string; act: string }>;
  [k: string]: unknown;
}

export interface ProductionInput {
  sku: string;
  qty?: number;
  note?: string;
}

export interface ProductionResult {
  created: Array<{ sku: string; code: string; item: string; qty: number }>;
  skipped: Array<{ sku: string; reason: string; code?: string }>;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export async function createProductionRequests(
  db: D1Database,
  auth: AuthContext,
  inputs: ProductionInput[],
): Promise<ProductionResult> {
  if (!inputs.length) throw badRequest('NO_ITEMS', 'Chưa chọn mã nào để làm lệnh sản xuất');
  const summary = await flowSummary(db, auth);
  const short = new Map(summary.shortages.map((s) => [s.sku, s]));
  const skus = [...new Set(inputs.map((i) => i.sku))];
  const marks = skus.map(() => '?').join(',');
  const maps = (
    await db
      .prepare(
        `SELECT km.crm_sku, km.misa_code, km.factor, ki.name, ki.cls FROM kho_map km
         JOIN kho_items ki ON ki.code = km.misa_code WHERE km.crm_sku IN (${marks})`,
      )
      .bind(...skus)
      .all<{ crm_sku: string; misa_code: string; factor: number; name: string; cls: string }>()
  ).results;
  const mapBy = new Map(maps.map((m) => [m.crm_sku, m]));

  const skipped: ProductionResult['skipped'] = [];
  const todo: Array<{ sku: string; item: string; qty: number; name: string; note: string }> = [];
  for (const inp of inputs) {
    const sh = short.get(inp.sku);
    if (!sh) {
      skipped.push({ sku: inp.sku, reason: 'Mã này không còn thiếu (đơn đã đủ hàng hoặc đã xử lý)' });
      continue;
    }
    const m = mapBy.get(inp.sku);
    if (!m) {
      skipped.push({ sku: inp.sku, reason: 'Chưa có mã kho trong bảng Đồng bộ mã B2B, nhờ kế toán kho thêm' });
      continue;
    }
    const qtyCrm = inp.qty != null && inp.qty > 0 ? inp.qty : sh.short;
    todo.push({
      sku: inp.sku,
      item: m.misa_code,
      qty: Math.ceil(qtyCrm * m.factor),
      name: sh.name,
      note: String(inp.note ?? '').trim(),
    });
  }
  if (!todo.length) return { created: [], skipped };

  const who = (await db.prepare('SELECT display_name FROM users WHERE id = ?').bind(auth.user.id).first<{ display_name: string }>())?.display_name ?? 'CRM';
  const today = vnDate();
  const stamp = `${today} ${nowIso().slice(11, 16)}`;

  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await db.prepare('SELECT version, data FROM hub_state WHERE id = ?').bind(SX_ID).first<{ version: number; data: string }>();
    if (!row) {
      throw conflict('SX_NOT_READY', 'Ngăn Sản xuất chưa được khởi tạo. Mở web chung, vào Sản xuất & kho một lần rồi thử lại.');
    }
    const data = JSON.parse(await unpack(row.data)) as SxData;
    if (!Array.isArray(data.requests)) data.requests = [];
    const created: ProductionResult['created'] = [];
    const skippedNow: ProductionResult['skipped'] = [...skipped];
    for (const t of todo) {
      const open = data.requests.find((r) => r.sp === t.item && r.src === 'THIEU_CRM' && ['CAN_LAM', 'DANG_LAM'].includes(r.st));
      if (open) {
        skippedNow.push({ sku: t.sku, reason: 'Đã có lệnh sản xuất đang mở cho mã này', code: open.id });
        continue;
      }
      const base = `PSX${today.slice(2, 4)}${today.slice(5, 7)}-`;
      let n = 1;
      while (data.requests.some((r) => r.id === base + pad(n, 3))) n++;
      const id = base + pad(n, 3);
      data.requests.push({
        id,
        sp: t.item,
        sl: t.qty,
        nguon: 'Đơn B2B',
        uu: 'Bình thường',
        han: '',
        ghiChu: `Mã thiếu của đơn B2B (${t.sku}).${t.note ? ' ' + t.note : ''}`,
        st: 'CAN_LAM',
        tao: who,
        taoLuc: today,
        batDau: '',
        lots: [],
        hist: [{ at: stamp, by: who, act: 'Tạo phiếu sản xuất từ danh sách mã thiếu trên CRM' }],
        src: 'THIEU_CRM',
        skuCrm: t.sku,
      });
      created.push({ sku: t.sku, code: id, item: t.item, qty: t.qty });
    }
    if (!created.length) return { created: [], skipped: skippedNow };
    data.log = [{ at: stamp, by: who, act: `tạo ${created.length} phiếu sản xuất từ mã thiếu: ${created.map((c) => c.code).join(', ')}` }, ...(data.log ?? [])].slice(0, 300);
    const res = await db
      .prepare('UPDATE hub_state SET version = version + 1, data = ?, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?')
      .bind(await pack(JSON.stringify(data)), nowIso(), auth.user.id, SX_ID, row.version)
      .run();
    if (res.meta.changes) return { created, skipped: skippedNow };
  }
  throw conflict('VERSION_CONFLICT', 'Có người vừa sửa phiếu sản xuất, thử lại sau vài giây');
}

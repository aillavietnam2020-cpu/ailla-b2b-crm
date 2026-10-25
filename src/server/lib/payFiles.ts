import type { Context } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, notFound, ok } from './http';
import { newId } from './ids';

/** Ảnh bill chuyển khoản / ảnh phiếu chi tiền mặt có chữ ký, gắn vào một phiếu chi (trả nhà cung cấp hoặc chi vận chuyển). */
export type PayFileRef = 'PO_PAY' | 'SHIP_VC' | 'COST';

const FILE_MIME = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
const MAX_FILE_B64 = 1_400_000; // khoảng 1 MB sau khi giải mã
const MAX_FILES = 8;

export async function listPayFiles(c: Context<AppEnv>, type: PayFileRef, id: string) {
  const rows = (
    await c.env.DB.prepare('SELECT id, name, mime, size, created_at FROM pay_files WHERE ref_type = ? AND ref_id = ? ORDER BY created_at').bind(type, id).all()
  ).results;
  return ok(c, rows);
}

export async function addPayFile(c: Context<AppEnv>, type: PayFileRef, id: string) {
  const b = (await c.req.json().catch(() => ({}))) as { name?: unknown; mime?: unknown; data?: unknown };
  const mime = String(b.mime ?? '');
  const data = String(b.data ?? '').replace(/^data:[^,]*,/, '');
  if (!FILE_MIME.test(mime)) throw badRequest('BAD_FILE', 'Chỉ nhận ảnh (JPG, PNG) hoặc PDF');
  if (!data || data.length > MAX_FILE_B64) throw badRequest('TOO_BIG', 'File quá lớn (tối đa khoảng 1 MB). Chụp lại ảnh nhỏ hơn hoặc nén PDF.');
  const n = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM pay_files WHERE ref_type = ? AND ref_id = ?').bind(type, id).first<{ n: number }>())?.n ?? 0;
  if (n >= MAX_FILES) throw badRequest('TOO_MANY', `Mỗi phiếu chi tối đa ${MAX_FILES} file`);
  const fid = newId();
  await c.env.DB.prepare('INSERT INTO pay_files (id, ref_type, ref_id, name, mime, size, data, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(fid, type, id, String(b.name ?? '').slice(0, 120), mime, Math.round((data.length * 3) / 4), data, c.get('auth').user.id, nowIso())
    .run();
  return ok(c, { id: fid });
}

export async function getPayFile(c: Context<AppEnv>, type: PayFileRef, id: string, fid: string) {
  const f = await c.env.DB.prepare('SELECT mime, data FROM pay_files WHERE id = ? AND ref_type = ? AND ref_id = ?').bind(fid, type, id).first<{ mime: string; data: string }>();
  if (!f) throw notFound('Không tìm thấy file');
  const bin = Uint8Array.from(atob(f.data), (ch) => ch.charCodeAt(0));
  return new Response(bin, { headers: { 'Content-Type': f.mime, 'Cache-Control': 'private, max-age=3600' } });
}

export async function deletePayFile(c: Context<AppEnv>, type: PayFileRef, id: string, fid: string) {
  await c.env.DB.prepare('DELETE FROM pay_files WHERE id = ? AND ref_type = ? AND ref_id = ?').bind(fid, type, id).run();
  return ok(c, { id: fid });
}

/** Hình thức chi đọc từ form: tiền mặt hay chuyển khoản, chi từ tài khoản nào, chuyển đến đâu, ai nhận.
 *  Máy chủ không bắt buộc tài khoản (agent lập theo lệnh có thể chưa biết); form trên web bắt buộc. */
export function readPayMethod(b: Record<string, unknown>) {
  const s = (k: string, max = 120) => String(b[k] ?? '').trim().slice(0, max);
  const method = b.method === 'CHUYEN_KHOAN' ? 'CHUYEN_KHOAN' : b.method === 'TIEN_MAT' ? 'TIEN_MAT' : '';
  const d = { method, from_account: s('from_account', 160), to_bank: s('to_bank', 80), to_account_no: s('to_account_no', 40), to_account_name: s('to_account_name'), receiver: s('receiver') };
  if (method === 'TIEN_MAT') Object.assign(d, { to_bank: '', to_account_no: '', to_account_name: '' });
  return d;
}

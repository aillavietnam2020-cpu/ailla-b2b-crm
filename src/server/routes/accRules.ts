import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { auditStatement, clientIp } from '../lib/audit';
import { badRequest, forbidden, ok } from '../lib/http';

/**
 * Quy tắc kế toán (chị Hoa giao 07/11/2026): một chỗ đặt các luật kế toán, trang quản trị › Cấu hình › Quy tắc kế toán.
 * "giai đoạn này cho xuất âm kho … sau này khi chị muốn không cho xuất âm kho là không xuất được âm".
 * Chỉ CEO và Kế toán sửa; mỗi lần đổi ghi nhật ký (audit_logs, entity_type ACC_RULES).
 * Luật đã có chỗ đặt riêng (ngưỡng chi CEO duyệt, ngưỡng quảng cáo/doanh thu) không lưu ở đây, trang chỉ hiện số và trỏ link.
 */
export const ACC_RULES_KEY = 'acc.rules';

export interface AccRules {
  /** Cho ghi phiếu xuất / pha chế / sản xuất khi tồn không đủ (sổ kho thành âm). Mặc định BẬT. */
  allow_negative: boolean;
  /** Khóa sổ: không ghi, sửa, hủy phiếu kho có ngày từ ngày này trở về trước. Rỗng = chưa khóa. */
  lock_date: string;
}

export const ACC_DEFAULT: AccRules = { allow_negative: true, lock_date: '' };

export async function loadAccRules(db: D1Database): Promise<AccRules> {
  const r = await db.prepare('SELECT value_json FROM app_settings WHERE key = ?').bind(ACC_RULES_KEY).first<{ value_json: string }>();
  let v: Partial<AccRules> = {};
  try {
    v = r ? (JSON.parse(r.value_json) as Partial<AccRules>) : {};
  } catch {
    v = {};
  }
  return {
    allow_negative: v.allow_negative !== false,
    lock_date: typeof v.lock_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.lock_date) ? v.lock_date : '',
  };
}

/** CEO và Kế toán (quyền xác nhận kế toán, không tính quản lý). */
export function canEditAccRules(auth: AuthContext): boolean {
  if (auth.user.role === 'CEO') return true;
  return auth.permissions.includes('order.accounting.confirm') && auth.user.role !== 'MANAGER';
}

export const accRulesRoutes = new Hono<AppEnv>();

/** Ai đăng nhập cũng đọc được (web báo trước "phiếu này sẽ bị chặn"). */
accRulesRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const rules = await loadAccRules(c.env.DB);
  const log = (
    await c.env.DB.prepare(
      `SELECT a.created_at, a.before_json, a.after_json, u.display_name AS who
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.entity_type = 'ACC_RULES' ORDER BY a.created_at DESC LIMIT 50`,
    ).all<{ created_at: string; before_json: string | null; after_json: string | null; who: string | null }>()
  ).results;
  return ok(c, { rules, can_edit: canEditAccRules(auth), log });
});

accRulesRoutes.put('/', async (c) => {
  const auth = c.get('auth');
  if (!canEditAccRules(auth)) throw forbidden('Chỉ CEO và Kế toán sửa quy tắc kế toán');
  const b = (await c.req.json().catch(() => null)) as Partial<AccRules> | null;
  if (!b) throw badRequest('BAD_JSON', 'Dữ liệu gửi lên không đúng định dạng');
  const before = await loadAccRules(c.env.DB);
  const next: AccRules = { ...before };
  if (b.allow_negative !== undefined) next.allow_negative = b.allow_negative === true;
  if (b.lock_date !== undefined) {
    const d = String(b.lock_date ?? '');
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw badRequest('BAD_DATE', 'Ngày khóa sổ không đúng');
    next.lock_date = d;
  }
  const changed = (Object.keys(next) as Array<keyof AccRules>).filter((k) => next[k] !== before[k]);
  if (!changed.length) return ok(c, { rules: before, changed: 0 });
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO app_settings (key, value_json, version, updated_by, updated_at) VALUES (?, ?, 1, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json, version = version + 1,
         updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    ).bind(ACC_RULES_KEY, JSON.stringify(next), auth.user.id, now),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'ACC_RULES_UPDATED',
      entityType: 'ACC_RULES',
      entityId: ACC_RULES_KEY,
      before: Object.fromEntries(changed.map((k) => [k, before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, next[k]])),
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }),
  ]);
  return ok(c, { rules: next, changed: changed.length });
});

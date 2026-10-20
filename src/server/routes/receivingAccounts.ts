import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso } from '@shared/datetime';
import { zodFieldErrors } from '@shared/schemas';
import type { AppEnv } from '../env';
import { auditStatement } from '../lib/audit';
import { notFound, ok, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { requirePermission } from '../middleware/rbac';
import { adminOnlyEndpoint } from '../middleware/adminHost';

/**
 * Danh sách tài khoản NHẬN TIỀN hợp lệ của công ty. Sale chọn trong danh sách này khi ghi tiền về;
 * bill chuyển khoản vào tài khoản ngoài danh sách bị gắn cờ cho kế toán kiểm tra.
 * Xem: mọi người dùng CRM. Thêm/sửa: chỉ CEO trên trang quản trị.
 */
export const receivingAccountRoutes = new Hono<AppEnv>();

receivingAccountRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, bank, account_no, account_name, note, active FROM receiving_accounts
     ORDER BY active DESC, bank, account_no`,
  ).all();
  return ok(c, rows.results ?? []);
});

const accountSchema = z.object({
  bank: z.string().trim().min(2, 'Nhập tên ngân hàng').max(60),
  account_no: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^\d]/g, ''))
    .refine((v) => v.length >= 6 && v.length <= 24, 'Số tài khoản không hợp lệ'),
  account_name: z.string().trim().min(2, 'Nhập tên chủ tài khoản').max(120),
  note: z.string().trim().max(200).optional().nullable(),
});

receivingAccountRoutes.post('/', adminOnlyEndpoint, requirePermission('settings.manage', 'order.approve.normal', 'order.accounting.confirm'), async (c) => {
  const auth = c.get('auth');
  const parsed = accountSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const exists = await c.env.DB.prepare('SELECT id FROM receiving_accounts WHERE account_no = ?')
    .bind(parsed.data.account_no)
    .first();
  if (exists) throw unprocessable('DUPLICATE', 'Số tài khoản này đã có trong danh sách', { account_no: 'Đã có' });
  const id = newId();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO receiving_accounts (id, bank, account_no, account_name, note, active, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(id, parsed.data.bank, parsed.data.account_no, parsed.data.account_name, parsed.data.note ?? null, auth.user.id, nowIso()),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'RECEIVING_ACCOUNT_ADDED',
      entityType: 'SETTING',
      entityId: id,
      after: { bank: parsed.data.bank, account_no: parsed.data.account_no },
      requestId: c.get('requestId'),
    }),
  ]);
  return ok(c, { id }, undefined, 201);
});

receivingAccountRoutes.post('/:id/active', adminOnlyEndpoint, requirePermission('settings.manage', 'order.approve.normal', 'order.accounting.confirm'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { active?: boolean };
  const row = await c.env.DB.prepare('SELECT id FROM receiving_accounts WHERE id = ?').bind(id).first();
  if (!row) throw notFound('Không tìm thấy tài khoản');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE receiving_accounts SET active = ? WHERE id = ?').bind(body.active === false ? 0 : 1, id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: body.active === false ? 'RECEIVING_ACCOUNT_DISABLED' : 'RECEIVING_ACCOUNT_ENABLED',
      entityType: 'SETTING',
      entityId: id,
      requestId: c.get('requestId'),
    }),
  ]);
  return ok(c, { id, active: body.active !== false });
});

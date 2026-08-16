import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso } from '@shared/datetime';
import { ROLES } from '@shared/enums';
import { zodFieldErrors } from '@shared/schemas';
import type { AppEnv } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, forbidden, notFound, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { checkPasswordStrength, hashPassword } from '../lib/password';
import { revokeAllSessions } from '../lib/session';
import { requirePermission } from '../middleware/rbac';

const userCreateSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ').max(200),
  display_name: z.string().trim().min(2, 'Tên hiển thị tối thiểu 2 ký tự').max(120),
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Vai trò không hợp lệ' }) }),
  legacy_name: z.string().trim().max(60).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  password: z.string().min(1, 'Nhập mật khẩu ban đầu'),
});

const userUpdateSchema = z.object({
  display_name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  legacy_name: z.string().trim().max(60).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
});

const setPasswordSchema = z.object({
  password: z.string().min(1, 'Nhập mật khẩu mới'),
  must_change: z.boolean().optional(),
});

export const userRoutes = new Hono<AppEnv>();

/** Quản lý chỉ được thao tác trên tài khoản nhân viên; CEO thao tác được mọi vai trò. */
function assertCanTouchRole(actorRole: string, targetRole: string) {
  if (actorRole === 'CEO') return;
  if (targetRole !== 'EMPLOYEE') {
    throw forbidden('Chỉ CEO mới được tạo hoặc sửa tài khoản Quản lý/CEO.');
  }
}

userRoutes.get('/', requirePermission('user.manage'), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, email, display_name, role, status, legacy_name, phone, last_login_at,
            password_updated_at, must_change_password,
            CASE WHEN password_hash IS NULL THEN 0 ELSE 1 END AS has_password
     FROM users WHERE deleted_at IS NULL ORDER BY role, display_name COLLATE NOCASE`,
  ).all();
  return c.json({ data: rows.results ?? [], request_id: c.get('requestId') });
});

userRoutes.post('/', requirePermission('user.manage'), async (c) => {
  const auth = c.get('auth');
  const parsed = userCreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const input = parsed.data;
  assertCanTouchRole(auth.user.role, input.role);

  const strengthError = checkPasswordStrength(input.password);
  if (strengthError) throw unprocessable('WEAK_PASSWORD', strengthError, { password: strengthError });

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE lower(email) = lower(?)')
    .bind(input.email)
    .first<{ id: string }>();
  if (existing) {
    throw badRequest('EMAIL_EXISTS', 'Email này đã có tài khoản', { email: 'Email đã tồn tại' });
  }

  const id = newId();
  const now = nowIso();
  const hash = await hashPassword(input.password);

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (id, email, display_name, role, status, legacy_name, phone,
         password_hash, password_updated_at, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(
      id,
      input.email.toLowerCase(),
      input.display_name,
      input.role,
      input.legacy_name ?? null,
      input.phone ?? null,
      hash,
      now,
      now,
      now,
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: id,
      after: { email: input.email, role: input.role, display_name: input.display_name },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);

  return c.json({ data: { id }, request_id: c.get('requestId') }, 201);
});

userRoutes.patch('/:id', requirePermission('user.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const parsed = userUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }

  const target = await c.env.DB.prepare(
    'SELECT id, email, display_name, role, status FROM users WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(id)
    .first<{ id: string; email: string; display_name: string; role: string; status: string }>();
  if (!target) throw notFound('Không tìm thấy tài khoản');

  assertCanTouchRole(auth.user.role, target.role);
  if (parsed.data.role) assertCanTouchRole(auth.user.role, parsed.data.role);
  if (target.id === auth.user.id && parsed.data.status === 'DISABLED') {
    throw badRequest('CANNOT_DISABLE_SELF', 'Không thể tự khoá tài khoản của chính mình');
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  if (fields.length === 0) return c.json({ data: { ok: true }, request_id: c.get('requestId') });

  const now = nowIso();
  const statements = [
    c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`).bind(
      ...values,
      now,
      id,
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      before: target,
      after: parsed.data,
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ];
  await c.env.DB.batch(statements);

  // Khoá tài khoản thì đá mọi phiên đang đăng nhập ra ngay.
  if (parsed.data.status === 'DISABLED') await revokeAllSessions(c.env.DB, id);

  return c.json({ data: { ok: true }, request_id: c.get('requestId') });
});

/** Đặt lại mật khẩu cho nhân sự. Người được cấp phải đổi lại ở lần đăng nhập kế tiếp. */
userRoutes.post('/:id/set-password', requirePermission('user.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const parsed = setPasswordSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const strengthError = checkPasswordStrength(parsed.data.password);
  if (strengthError) throw unprocessable('WEAK_PASSWORD', strengthError, { password: strengthError });

  const target = await c.env.DB.prepare(
    'SELECT id, email, role FROM users WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(id)
    .first<{ id: string; email: string; role: string }>();
  if (!target) throw notFound('Không tìm thấy tài khoản');
  assertCanTouchRole(auth.user.role, target.role);

  const hash = await hashPassword(parsed.data.password);
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE users SET password_hash = ?, password_updated_at = ?, must_change_password = ?,
         failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?`,
    ).bind(hash, now, parsed.data.must_change === false ? 0 : 1, now, id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'USER_PASSWORD_RESET',
      entityType: 'USER',
      entityId: id,
      after: { email: target.email },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  await revokeAllSessions(c.env.DB, id);

  return c.json({ data: { ok: true }, request_id: c.get('requestId') });
});

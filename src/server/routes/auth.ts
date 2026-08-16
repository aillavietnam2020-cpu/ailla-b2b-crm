import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso } from '@shared/datetime';
import { zodFieldErrors } from '@shared/schemas';
import type { AppEnv } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, unauthorized, unprocessable } from '../lib/http';
import { checkPasswordStrength, hashPassword, verifyPassword } from '../lib/password';
import { loadConfig } from '../lib/settings';
import {
  buildSessionCookie,
  clearSessionCookie,
  createSession,
  readSessionCookie,
  revokeAllSessions,
  revokeSession,
} from '../lib/session';

const loginSchema = z.object({
  email: z.string().trim().min(3, 'Nhập email đăng nhập').max(200),
  password: z.string().min(1, 'Nhập mật khẩu').max(200),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Nhập mật khẩu hiện tại'),
  new_password: z.string().min(1, 'Nhập mật khẩu mới'),
});

export const auth = new Hono<AppEnv>();

/** Đăng nhập bằng email + mật khẩu. Không tiết lộ email có tồn tại hay không. */
auth.post('/login', async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const { email, password } = parsed.data;
  const config = await loadConfig(c.env.DB);
  const now = nowIso();

  const user = await c.env.DB.prepare(
    `SELECT id, email, display_name, role, status, password_hash, must_change_password,
            failed_login_count, locked_until
     FROM users WHERE lower(email) = lower(?) AND deleted_at IS NULL`,
  )
    .bind(email)
    .first<{
      id: string;
      email: string;
      display_name: string;
      role: string;
      status: string;
      password_hash: string | null;
      must_change_password: number;
      failed_login_count: number;
      locked_until: string | null;
    }>();

  const genericError = unauthorized('Email hoặc mật khẩu không đúng');

  if (!user) {
    // Vẫn tốn thời gian băm để không lộ việc email không tồn tại.
    await verifyPassword(password, null);
    throw genericError;
  }
  if (user.status !== 'ACTIVE') {
    throw unauthorized('Tài khoản đang bị khoá. Liên hệ quản trị viên.');
  }
  if (user.locked_until && user.locked_until > now) {
    throw unauthorized(
      `Tài khoản tạm khoá do nhập sai nhiều lần. Thử lại sau ${config.authLockMinutes} phút.`,
    );
  }
  if (!user.password_hash) {
    throw unauthorized('Tài khoản chưa được đặt mật khẩu. Liên hệ quản trị viên.');
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    const failed = (user.failed_login_count ?? 0) + 1;
    const lockUntil =
      failed >= config.authMaxFailedLogins
        ? new Date(Date.now() + config.authLockMinutes * 60_000).toISOString()
        : null;
    await c.env.DB.prepare(
      'UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?',
    )
      .bind(failed, lockUntil, now, user.id)
      .run();
    throw genericError;
  }

  const session = await createSession(c.env.DB, user.id, config.authSessionHours, {
    ip: c.req.header('CF-Connecting-IP') ?? null,
    userAgent: c.req.header('User-Agent') ?? null,
  });

  await c.env.DB.batch([
    c.env.DB.prepare(
      'UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?',
    ).bind(now, now, user.id),
    auditStatement(c.env.DB, {
      actorId: user.id,
      action: 'USER_LOGGED_IN',
      entityType: 'USER',
      entityId: user.id,
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);

  const secure = new URL(c.req.url).protocol === 'https:';
  c.header('Set-Cookie', buildSessionCookie(session.token, session.maxAgeSeconds, secure));
  return c.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        status: user.status,
      },
      must_change_password: user.must_change_password === 1,
    },
    request_id: c.get('requestId'),
  });
});

auth.post('/logout', async (c) => {
  const token = readSessionCookie(c.req.raw.headers);
  if (token) await revokeSession(c.env.DB, token);
  const secure = new URL(c.req.url).protocol === 'https:';
  c.header('Set-Cookie', clearSessionCookie(secure));
  return c.json({ data: { ok: true }, request_id: c.get('requestId') });
});

/** Đổi mật khẩu của chính mình; đổi xong thu hồi toàn bộ phiên cũ. */
auth.post('/change-password', async (c) => {
  const authCtx = c.get('auth');
  if (!authCtx) throw unauthorized('Chưa đăng nhập');

  const parsed = changePasswordSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const strengthError = checkPasswordStrength(parsed.data.new_password);
  if (strengthError) {
    throw unprocessable('WEAK_PASSWORD', strengthError, { new_password: strengthError });
  }

  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(authCtx.user.id)
    .first<{ password_hash: string | null }>();
  const ok = await verifyPassword(parsed.data.current_password, row?.password_hash ?? null);
  if (!ok) {
    throw badRequest('WRONG_PASSWORD', 'Mật khẩu hiện tại không đúng', {
      current_password: 'Mật khẩu hiện tại không đúng',
    });
  }

  const hash = await hashPassword(parsed.data.new_password);
  const now = nowIso();
  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ?, password_updated_at = ?, must_change_password = 0,
       updated_at = ? WHERE id = ?`,
  )
    .bind(hash, now, now, authCtx.user.id)
    .run();
  await revokeAllSessions(c.env.DB, authCtx.user.id);

  const secure = new URL(c.req.url).protocol === 'https:';
  c.header('Set-Cookie', clearSessionCookie(secure));
  return c.json({
    data: { ok: true, message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' },
    request_id: c.get('requestId'),
  });
});

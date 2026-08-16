/** Quản lý phiên đăng nhập bằng cookie HttpOnly. */
import { nowIso } from '@shared/datetime';
import { newSessionToken, sha256Hex } from './password';
import { newId } from './ids';

export const SESSION_COOKIE = 'ailla_session';

export interface SessionUserRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  must_change_password: number;
}

export function readSessionCookie(headers: Headers): string | null {
  const cookie = headers.get('Cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=') || null;
  }
  return null;
}

export function buildSessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearSessionCookie(secure: boolean): string {
  const attrs = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export async function createSession(
  db: D1Database,
  userId: string,
  hours: number,
  meta: { ip: string | null; userAgent: string | null },
): Promise<{ token: string; maxAgeSeconds: number }> {
  const token = newSessionToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expires = new Date(now.getTime() + hours * 3_600_000);

  await db
    .prepare(
      `INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, last_seen_at, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId(),
      tokenHash,
      userId,
      now.toISOString(),
      expires.toISOString(),
      now.toISOString(),
      meta.ip,
      meta.userAgent?.slice(0, 300) ?? null,
    )
    .run();

  return { token, maxAgeSeconds: Math.floor(hours * 3600) };
}

export async function resolveSession(db: D1Database, token: string): Promise<SessionUserRow | null> {
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.role, u.status, u.must_change_password
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.deleted_at IS NULL`,
    )
    .bind(tokenHash, nowIso())
    .first<SessionUserRow>();
  if (!row) return null;

  await db
    .prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?')
    .bind(nowIso(), tokenHash)
    .run();
  return row;
}

export async function revokeSession(db: D1Database, token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(nowIso(), tokenHash)
    .run();
}

/** Thu hồi mọi phiên của một tài khoản: dùng khi đổi mật khẩu hoặc khoá tài khoản. */
export async function revokeAllSessions(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
    .bind(nowIso(), userId)
    .run();
}

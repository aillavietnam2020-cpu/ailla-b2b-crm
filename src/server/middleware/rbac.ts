import type { MiddlewareHandler } from 'hono';
import type { AppEnv, AuthContext } from '../env';
import type { Permission } from '@shared/permissions';
import { forbidden } from '../lib/http';

/** Chặn ở backend, không phụ thuộc việc ẩn menu ở frontend (mục 4.1). */
export function requirePermission(...permissions: Permission[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.get('auth');
    const allowed = permissions.some((p) => auth.permissions.includes(p));
    if (!allowed) throw forbidden();
    await next();
  };
}

export function requireRole(...roles: Array<'EMPLOYEE' | 'MANAGER' | 'CEO'>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!roles.includes(auth.user.role)) throw forbidden();
    await next();
  };
}

export function assertPermission(auth: AuthContext, permission: Permission): void {
  if (!auth.permissions.includes(permission)) throw forbidden();
}

/** Kiểm tra quyền mà không ném lỗi - dùng khi cần rẽ nhánh nghiệp vụ. */
export function hasPermission(auth: AuthContext, permission: Permission): boolean {
  return auth.permissions.includes(permission);
}

/**
 * Điều kiện SQL giới hạn phạm vi khách hàng.
 * EMPLOYEE chỉ thấy khách mình phụ trách; MANAGER/CEO thấy toàn bộ (MANAGER = toàn đội Sale).
 */
export function customerScopeClause(
  auth: AuthContext,
  alias = 'c',
): { sql: string; params: unknown[] } {
  if (auth.scope === 'OWN') {
    return { sql: `${alias}.owner_id = ?`, params: [auth.user.id] };
  }
  return { sql: '1=1', params: [] };
}

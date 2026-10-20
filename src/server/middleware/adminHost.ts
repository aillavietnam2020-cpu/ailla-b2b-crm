import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { forbidden } from '../lib/http';
import { isAdminHost } from '../lib/host';

/** Trên địa chỉ quản trị chỉ CEO và kế toán (quyền xem công nợ toàn công ty) được gọi dữ liệu. */
export const adminHostGate: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (isAdminHost(c.env, c.req.raw)) {
    const a = c.get('auth');
    const path = new URL(c.req.url).pathname;
    const ok = a.user.role === 'CEO' || a.permissions.includes('debt.read.all');
    if (!ok && path !== '/api/me') throw forbidden('Trang quản trị chỉ dành cho chủ doanh nghiệp và kế toán.');
  }
  await next();
};

/** Thao tác quản trị (phân quyền, sản phẩm, giá, thiết lập): chỉ gọi được từ địa chỉ quản trị khi đã cấu hình. */
export const adminOnlyEndpoint: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.env.ADMIN_HOST && !isAdminHost(c.env, c.req.raw)) {
    throw forbidden(`Thao tác này chỉ làm ở trang quản trị (${c.env.ADMIN_HOST}).`);
  }
  await next();
};

import type { Env } from '../env';

/**
 * Hai địa chỉ của cùng một hệ thống:
 *  - Vận hành (OPS_HOST, ví dụ qt.ailla.vn): việc hằng ngày của nhân sự.
 *  - Quản trị (ADMIN_HOST, ví dụ quantri.ailla.vn): phân quyền, sản phẩm, giá, báo cáo kế toán. Chỉ CEO và kế toán.
 * Chưa cấu hình ADMIN_HOST (máy lập trình, bản thử) thì mọi thứ chạy như cũ, không tách.
 */
export const hostOf = (req: Request): string => new URL(req.url).hostname.toLowerCase();

export function isAdminHost(env: Env, req: Request): boolean {
  return !!env.ADMIN_HOST && hostOf(req) === env.ADMIN_HOST.toLowerCase();
}

import type { Env } from '../env';
import { effectivePermissions } from '@shared/permissions';
import { loadExtraPermissions } from '../middleware/auth';
import { readSessionCookie, resolveSession } from '../lib/session';
import { isAdminHost } from '../lib/host';

/** Trang có script/style nội tuyến nên cần chính sách riêng, chặt nhất có thể. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/**
 * Trả trang khu Marketing cho người đã đăng nhập và có quyền 'hub.access'.
 * Chưa đăng nhập thì chuyển về trang đăng nhập CRM, đăng nhập xong quay lại /hub/.
 */
export async function serveHub(request: Request, env: Env, html: string): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== '/hub/') return Response.redirect(new URL('/hub/', url).toString(), 302);

  const token = readSessionCookie(request.headers);
  const session = token ? await resolveSession(env.DB, token) : null;
  if (!session || session.status !== 'ACTIVE') {
    return Response.redirect(new URL('/?next=/hub/', url).toString(), 302);
  }
  if (session.must_change_password === 1) return Response.redirect(new URL('/', url).toString(), 302);
  const permissions = effectivePermissions(
    session.role as 'EMPLOYEE' | 'MANAGER' | 'CEO',
    await loadExtraPermissions(env.DB, session.id),
  );
  if (!permissions.includes('hub.access')) {
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Trang quản trị Ailla</title><p style="font-family:sans-serif;padding:40px">Tài khoản chưa được cấp quyền vào khu Marketing. Nhờ CEO bật ở CRM › Người dùng & phân quyền. <a href="/">Về CRM</a></p>',
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
  const adminMode = isAdminHost(env, request);
  if (adminMode && !(session.role === 'CEO' || permissions.includes('debt.read.all'))) {
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Trang quản trị Ailla</title><p style="font-family:sans-serif;padding:40px">Trang quản trị chỉ dành cho chủ doanh nghiệp và kế toán.</p>',
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
  const opsUrl = env.OPS_HOST ? 'https://' + env.OPS_HOST + '/hub/' : '';
  const adminUrl = env.ADMIN_HOST ? 'https://' + env.ADMIN_HOST + '/hub/' : '';
  const siteTitle = !env.ADMIN_HOST ? "Trang quản trị Ailla" : adminMode ? "Ailla Quản trị" : "Ailla Vận hành";
  const page = html.split("Trang quản trị Ailla").join(siteTitle).replace(
    'let HOST_MODE="ops";let OPS_URL="";let ADMIN_URL="";',
    'let HOST_MODE=' + JSON.stringify(adminMode ? 'admin' : 'ops') + ';let OPS_URL=' + JSON.stringify(opsUrl) + ';let ADMIN_URL=' + JSON.stringify(adminUrl) + ';',
  );
  return new Response(page, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': CSP,
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}

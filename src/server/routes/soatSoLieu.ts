import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { forbidden, ok } from '../lib/http';
import { runChecks } from '../services/dataChecks';

/** Máy soát số liệu: chỉ CEO và kế toán xem; chỉ đọc, không sửa dữ liệu. */
export const soatRoutes = new Hono<AppEnv>();

soatRoutes.get('/', async (c) => {
  const a = c.get('auth');
  const allowed =
    a.user.role === 'CEO' || a.permissions.includes('order.accounting.confirm') || a.permissions.includes('settings.manage');
  if (!allowed) throw forbidden('Chỉ CEO hoặc kế toán');
  return ok(c, await runChecks(c.env.DB));
});

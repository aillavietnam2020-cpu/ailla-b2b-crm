import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ok } from '../lib/http';
import { requirePermission } from '../middleware/rbac';
import { loadConfig } from '../lib/settings';
import { ceoDashboard, managerDashboard, salesPerformance } from '../services/dashboards';
import { salesReport } from '../services/reports';

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get('/manager', requirePermission('dashboard.manager'), async (c) => {
  return ok(c, await managerDashboard(c.env.DB));
});

dashboardRoutes.get('/ceo', requirePermission('dashboard.ceo'), async (c) => {
  return ok(c, await ceoDashboard(c.env.DB));
});

/**
 * Báo cáo doanh số + thưởng theo kỳ (tháng 'YYYY-MM' hoặc năm 'YYYY').
 * Nhân viên chỉ xem được số của chính mình.
 */
dashboardRoutes.get('/sales', async (c) => {
  const auth = c.get('auth');
  const config = await loadConfig(c.env.DB);
  const requested = c.req.query('user_id');
  const ownerId = auth.user.role === 'EMPLOYEE' ? auth.user.id : (requested ?? null);
  return ok(c, await salesReport(c.env.DB, config, { period: c.req.query('period') ?? undefined, ownerId }));
});

/** Kết quả cá nhân. Nhân viên chỉ xem được của chính mình. */
dashboardRoutes.get('/me', async (c) => {
  const auth = c.get('auth');
  const requested = c.req.query('user_id');
  const userId = auth.user.role === 'EMPLOYEE' ? auth.user.id : (requested ?? auth.user.id);
  return ok(c, await salesPerformance(c.env.DB, userId));
});

import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { created, ok } from '../lib/http';
import { clientIp } from '../lib/audit';
import { loadConfig } from '../lib/settings';
import { parseInput } from '../lib/validate';
import {
  activityCreateSchema,
  customerCreateSchema,
  customerReassignSchema,
  customerUpdateSchema,
  listQuerySchema,
  taskCompleteSchema,
} from '@shared/schemas';
import { customerScopeClause, requirePermission } from '../middleware/rbac';
import {
  addActivity,
  completeTask,
  createCustomer,
  CUSTOMER_SORT_LABELS,
  getCustomer,
  listCustomers,
  listTasks,
  reassignCustomer,
  updateCustomer,
} from '../services/customers';
import { beginIdempotent, completeIdempotent } from '../lib/idempotency';

export const customerRoutes = new Hono<AppEnv>();

customerRoutes.get('/', requirePermission('customer.read.own'), async (c) => {
  const auth = c.get('auth');
  const query = listQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
  const scope = customerScopeClause(auth);
  const result = await listCustomers(c.env.DB, scope.sql, scope.params, {
    q: query.q,
    stage: query.stage,
    tierId: query.tier_id,
    ownerId: query.owner_id,
    due: query.due,
    dataQuality: query.data_quality,
    sort: query.sort,
    page: query.page,
    pageSize: query.page_size,
  });
  return ok(c, result.items, {
    total: result.total,
    page: query.page,
    page_size: query.page_size,
    sort: query.sort ?? 'follow_up',
    sort_options: CUSTOMER_SORT_LABELS,
  });
});

/** Sửa hồ sơ khách: cấp giá, giai đoạn, thông tin liên hệ, chu kỳ tái mua. */
customerRoutes.patch('/:id', requirePermission('customer.update'), async (c) => {
  const auth = c.get('auth');
  const input = parseInput(customerUpdateSchema, await c.req.json().catch(() => ({})));
  await updateCustomer(c.env.DB, auth, c.req.param('id'), input as Record<string, unknown>, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, await getCustomer(c.env.DB, auth, c.req.param('id')));
});

customerRoutes.post('/', requirePermission('customer.create'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const input = parseInput(customerCreateSchema, body);
  const key = c.req.header('Idempotency-Key') ?? null;

  const replay = await beginIdempotent(c.env.DB, key, auth.user.id, 'POST /api/customers', body);
  if (replay) return ok(c, replay.response, { idempotent_replay: true });

  const result = await createCustomer(c.env.DB, auth, input, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  await completeIdempotent(c.env.DB, key, result);
  return created(c, result);
});

customerRoutes.get('/:id', requirePermission('customer.read.own'), async (c) => {
  const auth = c.get('auth');
  return ok(c, await getCustomer(c.env.DB, auth, c.req.param('id')));
});

customerRoutes.post('/:id/activities', requirePermission('activity.create'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const input = parseInput(activityCreateSchema, body);
  const config = await loadConfig(c.env.DB);
  const key = c.req.header('Idempotency-Key') ?? null;

  const replay = await beginIdempotent(
    c.env.DB,
    key,
    auth.user.id,
    'POST /api/customers/:id/activities',
    body,
  );
  if (replay) return ok(c, replay.response, { idempotent_replay: true });

  const result = await addActivity(c.env.DB, auth, c.req.param('id'), input, config, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  await completeIdempotent(c.env.DB, key, result);
  return created(c, result);
});

customerRoutes.post('/:id/reassign', requirePermission('customer.reassign'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const input = parseInput(customerReassignSchema, body);
  await reassignCustomer(c.env.DB, auth, c.req.param('id'), input.owner_id, input.reason, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, { ok: true });
});

export const taskRoutes = new Hono<AppEnv>();

taskRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const filter = (c.req.query('filter') as 'today' | 'overdue' | 'open') ?? 'today';
  const assigneeParam = c.req.query('assignee_id');
  const assigneeId =
    auth.user.role === 'EMPLOYEE' ? auth.user.id : (assigneeParam ?? null);
  return ok(c, await listTasks(c.env.DB, assigneeId, filter));
});

taskRoutes.post('/:id/complete', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const input = parseInput(taskCompleteSchema, body);
  await completeTask(c.env.DB, auth, c.req.param('id'), input.note ?? null, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, { ok: true });
});


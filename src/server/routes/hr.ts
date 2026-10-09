import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { auditStatement } from '../lib/audit';
import { canHr } from '../lib/hrAccess';
import { requirePermission } from '../middleware/rbac';

/** File đính kèm hồ sơ nhân sự: chỉ CEO, kế toán, người làm nhân sự (lib/hrAccess). */
export const hrRoutes = new Hono<AppEnv>();
hrRoutes.use('*', requirePermission('hub.access'));
hrRoutes.use('*', async (c, next) => {
  if (!(await canHr(c.env.DB, c.get('auth')))) throw forbidden('Chỉ HCNS, kế toán và CEO xem được hồ sơ nhân sự');
  await next();
});

const MAX_FILE = 1_500_000;
const KINDS = ['anh', 'cccd', 'hd', 'qd', 'khac'];

hrRoutes.get('/files', async (c) => {
  const ma = c.req.query('ma') ?? '';
  const rows = await c.env.DB.prepare(
    `SELECT id, ma, name, mime, kind, size, created_at FROM hr_files
     WHERE deleted_at IS NULL AND (? = '' OR ma = ?) ORDER BY created_at DESC LIMIT 2000`,
  )
    .bind(ma, ma)
    .all<Record<string, unknown>>();
  return ok(c, rows.results ?? []);
});

hrRoutes.post('/files', async (c) => {
  const auth = c.get('auth');
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  const ma = String(form?.get('ma') ?? '').trim();
  const kind = String(form?.get('kind') ?? 'khac');
  if (!ma || !file || typeof file === 'string') throw badRequest('MISSING', 'Thiếu file hoặc mã nhân sự');
  if (file.size > MAX_FILE) throw badRequest('TOO_LARGE', 'File quá 1,5 MB, chị thu nhỏ hoặc chụp lại giúp em');
  const id = crypto.randomUUID();
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO hr_files (id, ma, name, mime, kind, size, data, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, ma, file.name.slice(0, 200), file.type || 'application/octet-stream', KINDS.includes(kind) ? kind : 'khac', file.size, new Uint8Array(await file.arrayBuffer()), now, auth.user.id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'HR_FILE_ADD', entityType: 'HR_FILE', entityId: id, after: { ma, name: file.name } }),
  ]);
  return ok(c, { id, ma, name: file.name, mime: file.type, kind, size: file.size, created_at: now });
});

hrRoutes.get('/files/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT name, mime, data FROM hr_files WHERE id = ? AND deleted_at IS NULL')
    .bind(c.req.param('id'))
    .first<{ name: string; mime: string; data: unknown }>();
  if (!row) throw notFound();
  // D1 trả cột BLOB dưới dạng mảng số; bản chạy thử trên máy có thể trả Buffer/Uint8Array.
  const d = row.data;
  const bytes =
    d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : Array.isArray(d) ? Uint8Array.from(d as number[]) : Uint8Array.from(Object.values(d as object) as number[]);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': row.mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

hrRoutes.delete('/files/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE hr_files SET deleted_at = ? WHERE id = ?').bind(nowIso(), id),
    auditStatement(c.env.DB, { actorId: auth.user.id, action: 'HR_FILE_DEL', entityType: 'HR_FILE', entityId: id }),
  ]);
  return ok(c, { id });
});

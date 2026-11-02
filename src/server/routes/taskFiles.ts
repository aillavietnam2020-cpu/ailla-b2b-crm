import { Hono } from 'hono';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { requirePermission } from '../middleware/rbac';

/**
 * Ảnh / file đính kèm của Task giao việc (hub/src/congviec.js). Việc nằm trong dữ liệu chung của hub,
 * ở đây chỉ giữ nội dung file; danh sách file của từng việc lưu trong việc đó (tasks[].files, tasks[].kqFiles).
 */
export const taskFileRoutes = new Hono<AppEnv>();
taskFileRoutes.use('*', requirePermission('hub.access'));

export const TASK_FILE_MAX = 1_600_000;
const TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

taskFileRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  const task = String(form?.get('task') ?? '').slice(0, 60);
  if (!file || typeof file === 'string') throw badRequest('MISSING', 'Chưa chọn file');
  if (!TYPES.includes(file.type)) throw badRequest('BAD_TYPE', 'Chỉ nhận ảnh, PDF, Word, Excel hoặc file chữ');
  if (file.size > TASK_FILE_MAX) throw badRequest('TOO_LARGE', 'File quá 1,5 MB, chị gửi link Drive giúp em');
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO task_files (id, task_id, name, mime, size, data, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, task, (file.name || 'file').slice(0, 160), file.type, file.size, new Uint8Array(await file.arrayBuffer()), auth.user.id, nowIso())
    .run();
  return ok(c, { id, name: file.name, size: file.size, type: file.type });
});

taskFileRoutes.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT name, mime, data FROM task_files WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ name: string; mime: string; data: unknown }>();
  if (!row) throw notFound('Không thấy file');
  const d = row.data;
  const bytes =
    d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : Uint8Array.from((Array.isArray(d) ? d : Object.values(d as object)) as number[]);
  return new Response(bytes as unknown as BodyInit, {
    headers: { 'content-type': row.mime, 'content-disposition': `inline; filename="${encodeURIComponent(row.name)}"`, 'cache-control': 'private, max-age=300' },
  });
});

/** Xóa: người tải lên hoặc CEO. */
taskFileRoutes.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const row = await c.env.DB.prepare('SELECT uploaded_by FROM task_files WHERE id = ?').bind(c.req.param('id')).first<{ uploaded_by: string }>();
  if (!row) throw notFound('Không thấy file');
  if (row.uploaded_by !== auth.user.id && auth.user.role !== 'CEO') throw forbidden('Chỉ người tải lên hoặc CEO được xóa');
  await c.env.DB.prepare('DELETE FROM task_files WHERE id = ?').bind(c.req.param('id')).run();
  return ok(c, { deleted: true });
});

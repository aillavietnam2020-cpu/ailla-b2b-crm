import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { badRequest, ok } from '../lib/http';
import { clientIp } from '../lib/audit';
import { loadConfig } from '../lib/settings';
import { requirePermission } from '../middleware/rbac';
import { COMMIT_PHASES, type CommitPhase, commitImport, previewImport, rollbackImport } from '../services/import';

export const importRoutes = new Hono<AppEnv>();

const MAX_FILE_BYTES = 20 * 1024 * 1024;

async function readUpload(c: { req: { formData: () => Promise<FormData> } }): Promise<{
  bytes: ArrayBuffer;
  fileName: string;
}> {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') {
    throw badRequest('FILE_REQUIRED', 'Vui lòng chọn file Excel (.xlsx) để tải lên.');
  }
  const bytes = await (file as File).arrayBuffer();
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw badRequest('FILE_TOO_LARGE', 'File vượt quá 20MB.');
  }
  return { bytes, fileName: (file as File).name };
}

importRoutes.get('/', requirePermission('import.read'), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT b.id, b.file_name, b.type, b.status, b.totals_json, b.reconciliation_json, b.created_at,
            b.committed_at, b.rolled_back_at, u.display_name AS started_by_name,
            (SELECT COUNT(*) FROM import_errors e WHERE e.batch_id = b.id AND e.severity = 'ERROR') AS error_count,
            (SELECT COUNT(*) FROM import_errors e WHERE e.batch_id = b.id AND e.severity = 'WARNING') AS warning_count
     FROM import_batches b LEFT JOIN users u ON u.id = b.started_by
     ORDER BY b.created_at DESC LIMIT 50`,
  ).all();
  return ok(c, rows.results ?? []);
});

importRoutes.get('/:id/errors', requirePermission('import.read'), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT sheet, row_no, field, code, message, severity FROM import_errors
     WHERE batch_id = ? ORDER BY severity, sheet, row_no LIMIT 1000`,
  )
    .bind(c.req.param('id'))
    .all();
  return ok(c, rows.results ?? []);
});

/** Bước 1: preview - KHÔNG ghi dữ liệu nghiệp vụ. */
importRoutes.post('/preview', requirePermission('import.run'), async (c) => {
  const auth = c.get('auth');
  const config = await loadConfig(c.env.DB);
  const { bytes, fileName } = await readUpload(c);

  // Lưu file gốc vào R2 để commit lại đúng file và phục vụ đối soát về sau.
  let r2Key: string | null = null;
  if (c.env.FILES) {
    r2Key = `imports/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${fileName}`;
    await c.env.FILES.put(r2Key, bytes);
  }

  const result = await previewImport(c.env.DB, config, auth, {
    fileName,
    bytes,
    r2Key,
    ctx: { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) },
  });
  return ok(c, result);
});

/** Bước 2: commit - chỉ chạy trên batch đã preview và đúng file (checksum khớp). */
importRoutes.post('/commit', requirePermission('import.run'), async (c) => {
  const auth = c.get('auth');
  const config = await loadConfig(c.env.DB);
  const contentType = c.req.header('content-type') ?? '';

  let batchId: string | null = null;
  let bytes: ArrayBuffer | null = null;
  let phaseParam: string | null = c.req.query('phase') ?? null;

  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.formData();
    batchId = String(form.get('batch_id') ?? '');
    phaseParam = phaseParam ?? (form.get('phase') ? String(form.get('phase')) : null);
    const file = form.get('file');
    if (file && typeof file !== 'string') bytes = await (file as File).arrayBuffer();
  } else {
    const body = await c.req.json().catch(() => ({}));
    batchId = body.batch_id ?? null;
    phaseParam = phaseParam ?? body.phase ?? null;
  }

  if (!batchId) throw badRequest('BATCH_REQUIRED', 'Thiếu batch_id của bước preview.');

  if (!bytes) {
    // Lấy lại đúng file đã preview từ R2.
    const batch = await c.env.DB.prepare('SELECT r2_key FROM import_batches WHERE id = ?')
      .bind(batchId)
      .first<{ r2_key: string | null }>();
    if (!batch?.r2_key || !c.env.FILES) {
      throw badRequest('FILE_REQUIRED', 'Không tìm thấy file đã preview, hãy tải lại file khi commit.');
    }
    const object = await c.env.FILES.get(batch.r2_key);
    if (!object) throw badRequest('FILE_MISSING', 'File preview đã bị xoá khỏi R2, hãy preview lại.');
    bytes = await object.arrayBuffer();
  }

  // Ghi theo từng chặng: mỗi request một chặng để không vượt hạn mức xử lý của Workers.
  // Client gọi lại với next_phase cho tới khi next_phase = null.
  const phase = COMMIT_PHASES.includes(phaseParam as CommitPhase)
    ? (phaseParam as CommitPhase)
    : undefined;

  const result = await commitImport(c.env.DB, config, auth, {
    batchId,
    bytes,
    phase,
    singlePhase: true,
    ctx: { requestId: c.get('requestId'), ip: clientIp(c.req.raw.headers) },
  });
  return ok(c, result);
});

importRoutes.post('/:id/rollback', requirePermission('import.run'), async (c) => {
  const auth = c.get('auth');
  const result = await rollbackImport(c.env.DB, auth, c.req.param('id'), {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, result);
});

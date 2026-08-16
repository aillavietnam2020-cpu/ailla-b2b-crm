import { nowIso } from '@shared/datetime';
import { sha256Hex } from './ids';
import { conflict } from './http';

export interface IdempotencyHit {
  replayed: true;
  response: unknown;
}

/**
 * Chống bấm hai lần / gửi lại request (mục 11.1, AC-13).
 * - Cùng key + cùng nội dung -> trả lại kết quả cũ, không tạo bản ghi mới.
 * - Cùng key nhưng nội dung khác -> 409, tránh ghi đè nhầm.
 */
export async function beginIdempotent(
  db: D1Database,
  key: string | null,
  userId: string,
  endpoint: string,
  body: unknown,
): Promise<IdempotencyHit | null> {
  if (!key) return null;
  const hash = await sha256Hex(JSON.stringify(body ?? {}));
  const existing = await db
    .prepare('SELECT key, request_hash, response_json, status FROM idempotency_keys WHERE key = ?')
    .bind(key)
    .first<{ key: string; request_hash: string; response_json: string | null; status: string }>();

  if (existing) {
    if (existing.request_hash !== hash) {
      throw conflict(
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency-Key này đã dùng cho một yêu cầu khác nội dung.',
      );
    }
    if (existing.status === 'DONE' && existing.response_json) {
      return { replayed: true, response: JSON.parse(existing.response_json) };
    }
    throw conflict('REQUEST_IN_PROGRESS', 'Yêu cầu trước đó đang được xử lý, vui lòng đợi.');
  }

  await db
    .prepare(
      `INSERT INTO idempotency_keys (key, user_id, endpoint, request_hash, status, created_at)
       VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?)`,
    )
    .bind(key, userId, endpoint, hash, nowIso())
    .run();
  return null;
}

export async function completeIdempotent(
  db: D1Database,
  key: string | null,
  response: unknown,
): Promise<void> {
  if (!key) return;
  await db
    .prepare(`UPDATE idempotency_keys SET status = 'DONE', response_json = ? WHERE key = ?`)
    .bind(JSON.stringify(response), key)
    .run();
}

export async function abortIdempotent(db: D1Database, key: string | null): Promise<void> {
  if (!key) return;
  await db.prepare('DELETE FROM idempotency_keys WHERE key = ?').bind(key).run();
}

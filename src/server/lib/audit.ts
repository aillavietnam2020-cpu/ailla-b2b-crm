import type { AuditAction } from '@shared/enums';
import { nowIso } from '@shared/datetime';
import { newId } from './ids';

export interface AuditInput {
  actorId: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  requestId?: string | null;
}

/**
 * Trả về statement audit để ghép vào cùng batch (transaction) với thay đổi nghiệp vụ - mục 11.1.
 */
export function auditStatement(db: D1Database, input: AuditInput): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, before_json, after_json, reason, ip, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId(),
      input.actorId,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      input.reason ?? null,
      input.ip ?? null,
      input.requestId ?? null,
      nowIso(),
    );
}

export async function writeAudit(db: D1Database, input: AuditInput): Promise<void> {
  await auditStatement(db, input).run();
}

export function clientIp(headers: Headers): string | null {
  return headers.get('CF-Connecting-IP') ?? headers.get('X-Forwarded-For') ?? null;
}

export { nowIso };

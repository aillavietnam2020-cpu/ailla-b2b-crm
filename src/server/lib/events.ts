import { nowIso } from '@shared/datetime';

/**
 * Sự kiện nghiệp vụ: một chỗ thống nhất để agent (hoặc bot khác) biết "có gì mới".
 * Ghi cùng batch với thay đổi nghiệp vụ nên không bao giờ lệch với dữ liệu.
 * dedupeKey chống ghi trùng khi cron hoặc agent chạy lại.
 */
export interface EventInput {
  type: string;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  actorType?: 'USER' | 'SYSTEM' | 'AGENT';
  payload?: unknown;
  dedupeKey?: string | null;
}

export function eventStatement(db: D1Database, e: EventInput): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO events (at, type, entity_type, entity_id, actor_id, actor_type, payload_json, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
    )
    .bind(
      nowIso(),
      e.type,
      e.entityType,
      e.entityId,
      e.actorId ?? null,
      e.actorType ?? 'USER',
      e.payload === undefined ? null : JSON.stringify(e.payload),
      e.dedupeKey ?? null,
    );
}

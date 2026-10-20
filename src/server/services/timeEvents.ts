import { nowIso, vnDate } from '@shared/datetime';
import { KHO_WAITING, type KhoStatus } from '@shared/flow';
import { eventStatement } from '../lib/events';
import { khoAlerts } from '../routes/kho';

/** Sau bao nhiêu giờ đứng yên ở một bước thì coi là "kẹt". */
const STUCK_HOURS = 24;
/** Đơn đã xuất kho quá số ngày này mà chưa đánh dấu giao thì báo. */
const DELIVERY_DAYS = 3;

/**
 * Sự kiện theo thời gian (cron mỗi giờ): đơn kẹt, quá lịch xuất, chưa giao, tồn dưới mức.
 * Mỗi sự kiện có dedupe_key theo ngày nên cron chạy lại không ghi trùng.
 * Chưa chạy agent nào; chỉ ghi để sau này agent đọc qua /api/agent/events.
 */
export async function emitTimeEvents(db: D1Database): Promise<{ emitted: number }> {
  const today = vnDate();
  const events: D1PreparedStatement[] = [];

  const stuck = await db
    .prepare(
      `SELECT id, order_no, kho_status, owner_id,
              CAST((julianday('now') - julianday(updated_at)) * 24 AS INTEGER) AS hours
       FROM orders
       WHERE deleted_at IS NULL AND flow_on = 1 AND kho_status NOT IN ('KHONG', 'DA_CHOT_TIEN')
         AND approval_status NOT IN ('CANCELLED', 'REJECTED', 'DRAFT') AND accounting_status <> 'DA_XAC_NHAN'
         AND (julianday('now') - julianday(updated_at)) * 24 >= ?`,
    )
    .bind(STUCK_HOURS)
    .all<{ id: string; order_no: string; kho_status: string; owner_id: string | null; hours: number }>();
  for (const o of stuck.results ?? []) {
    events.push(
      eventStatement(db, {
        type: 'ORDER_STUCK',
        entityType: 'ORDER',
        entityId: o.id,
        actorType: 'SYSTEM',
        dedupeKey: `ORDER_STUCK:${o.id}:${o.kho_status}:${today}`,
        payload: {
          order_no: o.order_no,
          kho_status: o.kho_status,
          hours: o.hours,
          waiting_for: KHO_WAITING[o.kho_status as KhoStatus] ?? null,
        },
      }),
    );
  }

  const shipLate = await db
    .prepare(
      `SELECT id, order_no, ship_date FROM orders
       WHERE deleted_at IS NULL AND flow_on = 1 AND kho_status = 'CHO_XUAT' AND ship_date IS NOT NULL AND ship_date < ?`,
    )
    .bind(today)
    .all<{ id: string; order_no: string; ship_date: string }>();
  for (const o of shipLate.results ?? []) {
    events.push(
      eventStatement(db, {
        type: 'SHIP_OVERDUE',
        entityType: 'ORDER',
        entityId: o.id,
        actorType: 'SYSTEM',
        dedupeKey: `SHIP_OVERDUE:${o.id}:${today}`,
        payload: { order_no: o.order_no, ship_date: o.ship_date },
      }),
    );
  }

  const cutoff = new Date(Date.now() - DELIVERY_DAYS * 86_400_000).toISOString();
  const undelivered = await db
    .prepare(
      `SELECT id, order_no, delivered_at FROM orders
       WHERE deleted_at IS NULL AND approval_status = 'APPROVED' AND delivery_status = 'DA_XUAT_KHO'
         AND delivered_at IS NOT NULL AND delivered_at < ?`,
    )
    .bind(cutoff)
    .all<{ id: string; order_no: string; delivered_at: string }>();
  for (const o of undelivered.results ?? []) {
    events.push(
      eventStatement(db, {
        type: 'DELIVERY_OVERDUE',
        entityType: 'ORDER',
        entityId: o.id,
        actorType: 'SYSTEM',
        dedupeKey: `DELIVERY_OVERDUE:${o.id}:${today}`,
        payload: { order_no: o.order_no, delivered_at: o.delivered_at },
      }),
    );
  }

  const alerts = await khoAlerts(db);
  for (const row of [...alerts.low, ...alerts.negative]) {
    events.push(
      eventStatement(db, {
        type: 'KHO_LOW_STOCK',
        entityType: 'KHO_ITEM',
        entityId: String(row.code),
        actorType: 'SYSTEM',
        dedupeKey: `KHO_LOW_STOCK:${row.code}:${today}`,
        payload: { name: row.name, qty: row.qty, min_stock: row.min_stock, cls: row.cls },
      }),
    );
  }

  for (let i = 0; i < events.length; i += 80) await db.batch(events.slice(i, i + 80));
  void nowIso;
  return { emitted: events.length };
}

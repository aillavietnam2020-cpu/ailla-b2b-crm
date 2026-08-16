import { nowIso, vnDate } from '@shared/datetime';
import {
  evaluateAccountingPending,
  evaluateDebtAlerts,
  evaluateMissingPrice,
  evaluateReorderDue,
  evaluateTaskOverdue,
  type AlertCandidate,
} from '@shared/alerts';
import { ALERT_LABELS, type AlertCode } from '@shared/enums';
import type { AlertItem } from '@shared/types';
import { newId } from '../lib/ids';
import type { AppConfig } from '../lib/settings';
import { listDebts } from './debts';

/** Chạy toàn bộ rule cảnh báo (mục 13.1). Gọi từ cron mỗi giờ hoặc thủ công từ dashboard. */
export async function evaluateAllAlerts(db: D1Database, config: AppConfig): Promise<AlertCandidate[]> {
  const now = nowIso();
  const today = vnDate();
  const candidates: AlertCandidate[] = [];

  const tasks = await db
    .prepare(`SELECT id, assignee_id, status, due_at, title FROM tasks WHERE status = 'OPEN'`)
    .all<{ id: string; assignee_id: string; status: string; due_at: string; title: string }>();
  for (const task of tasks.results ?? []) {
    // due_at lưu theo ngày làm việc VN; so sánh với hôm nay.
    const alert = evaluateTaskOverdue({ ...task, due_at: task.due_at }, today);
    if (alert) candidates.push(alert);
  }

  const customers = await db
    .prepare(
      `SELECT id, name, owner_id, last_order_date, reorder_cycle_days
       FROM customers WHERE deleted_at IS NULL AND stage <> 'LOST'`,
    )
    .all<{
      id: string;
      name: string;
      owner_id: string | null;
      last_order_date: string | null;
      reorder_cycle_days: number | null;
    }>();
  for (const customer of customers.results ?? []) {
    const alert = evaluateReorderDue(customer, today, config.reorderDefaultCycleDays);
    if (alert) candidates.push(alert);
  }

  const debts = await listDebts(db, '1=1', []);
  for (const debt of debts) {
    candidates.push(
      ...evaluateDebtAlerts({
        id: debt.customer_id,
        name: debt.customer_name,
        owner_id: null,
        officialDebt: debt.official_debt,
        projectedDebt: debt.projected_debt,
        limit: debt.limit,
      }),
    );
  }

  const orders = await db
    .prepare(
      `SELECT id, order_no, owner_id, delivery_status, accounting_status, delivered_at
       FROM orders WHERE deleted_at IS NULL AND approval_status = 'APPROVED'`,
    )
    .all<{
      id: string;
      order_no: string;
      owner_id: string | null;
      delivery_status: string;
      accounting_status: string;
      delivered_at: string | null;
    }>();
  for (const order of orders.results ?? []) {
    const alert = evaluateAccountingPending(order, now, config.accountingPendingAlertHours);
    if (alert) candidates.push(alert);
  }

  const missing = await db
    .prepare(
      `SELECT p.id AS product_id, p.sku, GROUP_CONCAT(t.name, ', ') AS tier_names
       FROM products p
       JOIN price_tiers t ON 1 = 1
       LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.tier_id = t.id
            AND pp.amount IS NOT NULL AND pp.status <> 'DRAFT'
            AND (pp.valid_to IS NULL OR pp.valid_to >= date('now'))
       WHERE p.deleted_at IS NULL AND pp.id IS NULL
       GROUP BY p.id, p.sku`,
    )
    .all<{ product_id: string; sku: string; tier_names: string | null }>();
  for (const row of missing.results ?? []) {
    const alert = evaluateMissingPrice({
      product_id: row.product_id,
      sku: row.sku,
      tierNames: (row.tier_names ?? '').split(', ').filter(Boolean),
    });
    if (alert) candidates.push(alert);
  }

  return candidates;
}

/** Ghi cảnh báo mới, đóng cảnh báo không còn đúng. Không tạo trùng nhờ unique index. */
export async function syncAlerts(db: D1Database, config: AppConfig): Promise<{ opened: number; resolved: number }> {
  const candidates = await evaluateAllAlerts(db, config);
  const now = nowIso();
  const keyOf = (c: { code: string; entityType: string; entityId: string }) =>
    `${c.code}|${c.entityType}|${c.entityId}`;

  const existing = await db
    .prepare(`SELECT id, code, entity_type, entity_id FROM alerts WHERE status = 'OPEN'`)
    .all<{ id: string; code: string; entity_type: string; entity_id: string }>();
  const existingMap = new Map(
    (existing.results ?? []).map((a) => [`${a.code}|${a.entity_type}|${a.entity_id}`, a.id]),
  );
  const candidateKeys = new Set(candidates.map(keyOf));

  const statements: D1PreparedStatement[] = [];
  let opened = 0;
  for (const candidate of candidates) {
    if (existingMap.has(keyOf(candidate))) continue;
    opened += 1;
    statements.push(
      db
        .prepare(
          `INSERT INTO alerts (id, code, entity_type, entity_id, owner_id, severity, message, data_json, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
        )
        .bind(
          newId(),
          candidate.code,
          candidate.entityType,
          candidate.entityId,
          candidate.ownerId ?? null,
          candidate.severity,
          candidate.message,
          candidate.data ? JSON.stringify(candidate.data) : null,
          now,
        ),
    );
  }

  let resolved = 0;
  for (const [key, id] of existingMap) {
    if (candidateKeys.has(key)) continue;
    resolved += 1;
    statements.push(
      db.prepare(`UPDATE alerts SET status = 'RESOLVED', resolved_at = ? WHERE id = ?`).bind(now, id),
    );
  }

  if (statements.length > 0) await db.batch(statements);
  return { opened, resolved };
}

export async function listAlerts(
  db: D1Database,
  options: { ownerId?: string | null; codes?: AlertCode[]; limit?: number },
): Promise<AlertItem[]> {
  const where: string[] = [`status = 'OPEN'`];
  const params: unknown[] = [];
  if (options.ownerId) {
    where.push('owner_id = ?');
    params.push(options.ownerId);
  }
  if (options.codes?.length) {
    where.push(`code IN (${options.codes.map(() => '?').join(',')})`);
    params.push(...options.codes);
  }
  const rows = await db
    .prepare(
      `SELECT id, code, entity_type, entity_id, owner_id, severity, message, created_at
       FROM alerts WHERE ${where.join(' AND ')}
       ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, created_at DESC
       LIMIT ?`,
    )
    .bind(...params, options.limit ?? 50)
    .all<AlertItem>();
  return (rows.results ?? []).map((a) => ({
    ...a,
    label: ALERT_LABELS[a.code as AlertCode] ?? a.code,
  }));
}

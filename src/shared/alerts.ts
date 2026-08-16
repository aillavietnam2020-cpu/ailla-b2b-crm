/** Quy tắc cảnh báo tối thiểu (mục 13.1), viết bằng logic thuần để test được. */
import type { AlertCode } from './enums';
import { daysBetween } from './datetime';

export interface AlertCandidate {
  code: AlertCode;
  entityType: 'TASK' | 'CUSTOMER' | 'ORDER' | 'PRODUCT' | 'IMPORT_BATCH';
  entityId: string;
  ownerId?: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  data?: Record<string, unknown>;
}

export interface TaskLike {
  id: string;
  assignee_id: string;
  status: string;
  due_at: string;
  title: string;
}

export function evaluateTaskOverdue(task: TaskLike, nowIso: string): AlertCandidate | null {
  if (task.status !== 'OPEN') return null;
  if (task.due_at >= nowIso) return null;
  return {
    code: 'TASK_OVERDUE',
    entityType: 'TASK',
    entityId: task.id,
    ownerId: task.assignee_id,
    severity: 'WARNING',
    message: `Việc "${task.title}" đã quá hạn.`,
    data: { due_at: task.due_at },
  };
}

export interface ReorderLike {
  id: string;
  name: string;
  owner_id: string | null;
  last_order_date: string | null;
  reorder_cycle_days: number | null;
}

export function evaluateReorderDue(
  customer: ReorderLike,
  today: string,
  defaultCycleDays: number,
): AlertCandidate | null {
  if (!customer.last_order_date) return null;
  const cycle = customer.reorder_cycle_days ?? defaultCycleDays;
  const elapsed = daysBetween(customer.last_order_date, today);
  if (elapsed < cycle) return null;
  return {
    code: 'REORDER_DUE',
    entityType: 'CUSTOMER',
    entityId: customer.id,
    ownerId: customer.owner_id,
    severity: 'WARNING',
    message: `${customer.name} đã ${elapsed} ngày chưa nhập lại (chu kỳ ${cycle} ngày).`,
    data: { elapsed, cycle },
  };
}

export interface DebtLike {
  id: string;
  name: string;
  owner_id: string | null;
  officialDebt: number;
  projectedDebt: number;
  limit: number;
}

export function evaluateDebtAlerts(customer: DebtLike): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  if (customer.limit > 0 && customer.officialDebt > customer.limit) {
    out.push({
      code: 'DEBT_LIMIT_EXCEEDED',
      entityType: 'CUSTOMER',
      entityId: customer.id,
      ownerId: customer.owner_id,
      severity: 'CRITICAL',
      message: `${customer.name} vượt hạn mức công nợ chính thức.`,
      data: { officialDebt: customer.officialDebt, limit: customer.limit },
    });
  }
  if (customer.limit > 0 && customer.projectedDebt > customer.limit) {
    out.push({
      code: 'PROJECTED_DEBT_EXCEEDED',
      entityType: 'CUSTOMER',
      entityId: customer.id,
      ownerId: customer.owner_id,
      severity: 'WARNING',
      message: `${customer.name} vượt hạn mức công nợ dự kiến.`,
      data: { projectedDebt: customer.projectedDebt, limit: customer.limit },
    });
  }
  return out;
}

export interface AccountingPendingLike {
  id: string;
  order_no: string;
  owner_id: string | null;
  delivery_status: string;
  accounting_status: string;
  delivered_at: string | null;
}

export function evaluateAccountingPending(
  order: AccountingPendingLike,
  nowIso: string,
  thresholdHours: number,
): AlertCandidate | null {
  if (order.accounting_status === 'DA_XAC_NHAN') return null;
  if (order.delivery_status !== 'DA_GIAO' && order.delivery_status !== 'DA_XUAT_KHO') return null;
  if (!order.delivered_at) return null;
  const hours = (new Date(nowIso).getTime() - new Date(order.delivered_at).getTime()) / 3_600_000;
  if (hours < thresholdHours) return null;
  return {
    code: 'ACCOUNTING_PENDING',
    entityType: 'ORDER',
    entityId: order.id,
    ownerId: order.owner_id,
    severity: 'WARNING',
    message: `Đơn ${order.order_no} đã giao ${Math.floor(hours)} giờ nhưng kế toán chưa xác nhận.`,
    data: { hours: Math.floor(hours), threshold: thresholdHours },
  };
}

export interface MissingPriceLike {
  product_id: string;
  sku: string;
  tierNames: string[];
}

export function evaluateMissingPrice(row: MissingPriceLike): AlertCandidate | null {
  if (row.tierNames.length === 0) return null;
  return {
    code: 'MISSING_PRICE',
    entityType: 'PRODUCT',
    entityId: row.product_id,
    severity: 'WARNING',
    message: `Mã ${row.sku} thiếu giá ở cấp: ${row.tierNames.join(', ')}.`,
    data: { tiers: row.tierNames },
  };
}

/**
 * Hợp đồng chung giữa web và AI agent.
 * Agent chỉ vào bằng /api/agent/*, có quyền riêng (không dùng quyền admin), và phần lớn việc chỉ được ĐỀ XUẤT.
 */

/** Quyền riêng của agent ('agent.act' = được ghi thay người, chỉ khi có giấy ủy quyền của người ra lệnh). Chỉ các quyền này; agent không nhận quyền theo vai trò. */
export const AGENT_PERMISSIONS = ['agent.read', 'agent.propose', 'agent.act'] as const;

/**
 * Phạm vi đọc của từng agent (cấp riêng, theo vai). Lưu trong user_permissions dạng 'agent.scope.<tên>'.
 *  orders = đơn hàng · orders_kho = chỉ đơn đang chờ kho · debts = khách và công nợ
 *  kho = tồn kho, hóa chất, phiếu pha chế, hàng thiếu · mkt_content / mkt_digital = hạng mục Marketing của team
 *  xuong = Công xưởng SX video
 */
export const AGENT_SCOPE_PREFIX = 'agent.scope.';
export const AGENT_SCOPES = ['orders', 'orders_kho', 'debts', 'kho', 'mkt_content', 'mkt_digital', 'xuong'] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];
export const AGENT_SCOPE_LABELS: Record<AgentScope, string> = {
  orders: 'Đơn hàng',
  orders_kho: 'Đơn chờ kho',
  debts: 'Khách và công nợ',
  kho: 'Kho, hóa chất, pha chế',
  mkt_content: 'Marketing: team Content',
  mkt_digital: 'Marketing: team Digital',
  xuong: 'Công xưởng SX video',
};
export const AGENT_SCOPE_PERMISSIONS: string[] = AGENT_SCOPES.map((s) => AGENT_SCOPE_PREFIX + s);

export const PROPOSAL_KINDS = [
  'REMINDER',
  'KHO_CHECK_NOTE',
  'PRODUCTION_REQUEST',
  'STOCK_ALERT',
  'DISCREPANCY',
  'PAYMENT_FOLLOWUP',
] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const PROPOSAL_KIND_LABELS: Record<ProposalKind, string> = {
  REMINDER: 'Nhắc việc',
  KHO_CHECK_NOTE: 'Nhận xét kiểm tồn',
  PRODUCTION_REQUEST: 'Đề xuất sản xuất',
  STOCK_ALERT: 'Cảnh báo tồn kho',
  DISCREPANCY: 'Phát hiện lệch',
  PAYMENT_FOLLOWUP: 'Theo dõi tiền về / bill',
};

/** Đề xuất được chuyển tới chức năng nào xem xét. */
export const PROPOSAL_ROUTES = ['SALE', 'DIEU_PHOI', 'KHO', 'KE_TOAN'] as const;
export type ProposalRoute = (typeof PROPOSAL_ROUTES)[number];

export const PROPOSAL_ROUTE_LABELS: Record<ProposalRoute, string> = {
  SALE: 'Sale',
  DIEU_PHOI: 'Quản lý điều phối',
  KHO: 'Kế toán kho',
  KE_TOAN: 'Kế toán',
};

/** Loại đối tượng agent được phép gắn đề xuất vào (kiểm tồn tại theo ID, không theo tên). */
export const PROPOSAL_ENTITY_TYPES = ['ORDER', 'CUSTOMER', 'PAYMENT', 'KHO_ITEM', 'PRODUCT'] as const;
export type ProposalEntityType = (typeof PROPOSAL_ENTITY_TYPES)[number];

/**
 * Mức độ cho từng hành động (xem docs): AUTO = agent tự làm; AUTO_LOG = tự làm nhưng ghi log + báo;
 * PROPOSE = chỉ được đề xuất, người duyệt. Hành động không có trong bảng coi như PROPOSE.
 */
export const ACTION_POLICY = {
  'proposal.create': 'AUTO_LOG',
  'order.read': 'AUTO',
  'kho.read': 'AUTO',
  'order.flow.transition': 'PROPOSE',
  'order.approve': 'PROPOSE',
  'order.edit': 'PROPOSE',
  'order.cancel': 'PROPOSE',
  'price.change': 'PROPOSE',
  'debt.adjust': 'PROPOSE',
  'payment.confirm': 'PROPOSE',
  'kho.stock.adjust': 'PROPOSE',
  'external.send': 'PROPOSE',
  'data.delete': 'PROPOSE',
} as const;
export type ActionKey = keyof typeof ACTION_POLICY;
export type ActionMode = 'AUTO' | 'AUTO_LOG' | 'PROPOSE';

export function policyFor(action: string): ActionMode {
  return (ACTION_POLICY as Record<string, ActionMode>)[action] ?? 'PROPOSE';
}

/** Loại sự kiện nghiệp vụ. Chưa chạy agent cho mọi sự kiện, chỉ ghi để sau này kích hoạt. */
export const EVENT_TYPES = [
  'CUSTOMER_CREATED',
  'ORDER_CREATED',
  'ORDER_SUBMITTED',
  'ORDER_EDITED',
  'ORDER_CANCELLED',
  'ORDER_APPROVED',
  'ORDER_REJECTED',
  'ORDER_STEP_CHANGED',
  'ORDER_STUCK',
  'SHIP_OVERDUE',
  'DELIVERY_OVERDUE',
  'PAYMENT_RECORDED',
  'PAYMENT_CONFIRMED',
  'BILL_ADDED',
  'RETURN_CREATED',
  'RETURN_RECEIVED',
  'RETURN_CREDITED',
  'KHO_LOW_STOCK',
  'ALERT_OPENED',
  'PROPOSAL_CREATED',
  'PROPOSAL_DECIDED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

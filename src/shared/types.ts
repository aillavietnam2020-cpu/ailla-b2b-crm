/** Kiểu dữ liệu dùng chung giữa Worker và React (DTO của API). */
import type {
  AccountingStatus,
  CustomerStage,
  DeliveryStatus,
  OrderApprovalStatus,
  PaymentStatus,
  Role,
} from './enums';
import type { DataScope, Permission } from './permissions';

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
  request_id: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
  request_id: string;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    display_name: string;
    role: Role;
    status: string;
    /** 1 = phải đổi mật khẩu trước khi vào hệ thống (tài khoản mới hoặc vừa được cấp lại). */
    must_change_password?: number;
  };
  scope: DataScope;
  permissions: Permission[];
  environment: string;
}

export interface UserSummary {
  id: string;
  display_name: string;
  role: Role;
  legacy_name?: string | null;
}

export interface PriceTier {
  id: string;
  code: string;
  name: string;
  rank: number;
  debt_limit: number;
}

export interface CustomerListItem {
  id: string;
  legacy_code: string | null;
  name: string;
  phone_text: string | null;
  province: string | null;
  tier_id: string | null;
  tier_name: string | null;
  legacy_tier_label: string | null;
  owner_id: string | null;
  owner_name: string | null;
  stage: CustomerStage;
  source: string | null;
  next_follow_up_at: string | null;
  last_order_date: string | null;
  data_quality: 'OK' | 'NEEDS_REVIEW';
  official_debt: number;
  projected_debt: number;
  credit_limit: number;
}

export interface CustomerDetail extends CustomerListItem {
  /** Thông tin cơ bản bổ sung ngoài file Excel gốc. */
  birthday?: string | null;
  zalo?: string | null;
  email?: string | null;
  note?: string | null;
  tax_code?: string | null;
  contact_person?: string | null;
  address: string | null;
  potential: string | null;
  interested_products: string | null;
  reorder_cycle_days: number | null;
  first_contact_date: string | null;
  opening_debt: number;
  data_quality_note: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  activities: ActivityItem[];
  tasks: TaskItem[];
  orders: OrderListItem[];
  debt: DebtSummary;
}

export interface ActivityItem {
  id: string;
  customer_id: string;
  customer_name?: string;
  user_id: string;
  user_name: string;
  channel: string;
  result: string;
  content: string;
  next_action: string | null;
  next_date: string | null;
  reason_code: string | null;
  created_at: string;
}

export interface TaskItem {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  assignee_id: string;
  assignee_name?: string;
  type: string;
  title: string;
  due_at: string;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  overdue: boolean;
}

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  unit: string | null;
  pack_size: string | null;
  group_id: string | null;
  group_name: string | null;
  active: number;
  prices: Record<string, number | null>;
  missing_tiers: string[];
}

export interface OrderLineItem {
  id: string;
  product_id: string;
  sku: string;
  product_name: string;
  qty: number;
  base_price: number | null;
  applied_price: number;
  line_total: number;
  price_override: boolean;
  price_override_reason: string | null;
}

export interface OrderListItem {
  id: string;
  order_no: string;
  customer_id: string;
  customer_name: string;
  owner_id: string | null;
  owner_name: string | null;
  order_date: string;
  total_amount: number;
  approval_status: OrderApprovalStatus;
  delivery_status: DeliveryStatus;
  payment_status: PaymentStatus;
  accounting_status: AccountingStatus;
  received_amount: number;
  remaining_amount: number;
}

export interface OrderDetail extends OrderListItem {
  subtotal: number;
  discount_amount: number;
  bonus_deduction: number;
  shipping_fee: number;
  cod_amount: number;
  note: string | null;
  items: OrderLineItem[];
  approvals: ApprovalItem[];
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
}

export interface ApprovalItem {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_label?: string;
  rule_code: string;
  requester_id: string;
  requester_name: string;
  approver_id: string | null;
  approver_name: string | null;
  required_role: 'MANAGER' | 'CEO';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason: string | null;
  decision_note: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  decided_at: string | null;
}

export interface DebtSummary {
  customer_id: string;
  customer_name: string;
  owner_name?: string | null;
  opening_debt: number;
  posted_charges: number;
  confirmed_payments: number;
  official_debt: number;
  pending_charges: number;
  pending_cash: number;
  projected_debt: number;
  credit_balance: number;
  limit: number;
  official_exceeded: boolean;
  projected_exceeded: boolean;
}

export interface AlertItem {
  id: string;
  code: string;
  label: string;
  entity_type: string;
  entity_id: string;
  owner_id: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  created_at: string;
}

export interface ImportIssue {
  sheet: string;
  row_no: number | null;
  field: string | null;
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
}

export interface ImportPreviewResult {
  batch_id: string;
  file_name: string;
  checksum: string;
  totals: Record<string, number>;
  reconciliation: ReconciliationResult;
  issues: ImportIssue[];
  issue_counts: { errors: number; warnings: number; infos: number };
}

export interface ReconciliationLine {
  key: string;
  label: string;
  expected: number;
  actual: number;
  diff: number;
  ok: boolean;
}

export interface ReconciliationResult {
  ok: boolean;
  lines: ReconciliationLine[];
}

export interface ManagerDashboard {
  reps: Array<{
    user_id: string;
    display_name: string;
    customers: number;
    open_tasks: number;
    overdue_tasks: number;
    activities_30d: number;
    orders_month: number;
    revenue_month: number;
    customers_with_orders: number;
  }>;
  unassigned_customers: number;
  pending_approvals: number;
  overdue_customers: number;
  needs_review_customers: number;
  alerts: AlertItem[];
}

export interface CeoDashboard {
  revenue_month: number;
  collected_month: number;
  official_debt: number;
  projected_debt: number;
  pending_charges: number;
  pending_cash: number;
  customers_total: number;
  customers_with_orders: number;
  order_rate: number;
  data_quality: {
    customers_needs_review: number;
    products_missing_price: number;
    orders_needs_review: number;
    payments_needs_review: number;
    last_import_status: string | null;
    last_import_reconciled: boolean | null;
  };
  decisions: AlertItem[];
  pending_approvals: ApprovalItem[];
}

export interface SalesPerformance {
  customers: number;
  customers_with_orders: number;
  order_rate: number;
  revenue_month: number;
  revenue_total: number;
  activities_month: number;
  open_tasks: number;
  overdue_tasks: number;
  by_stage: Array<{ stage: CustomerStage; count: number }>;
}

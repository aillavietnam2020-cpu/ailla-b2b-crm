/**
 * Ma trận quyền theo mục 4 của đặc tả.
 * LƯU Ý: đây là nguồn sự thật dùng CHUNG, nhưng việc kiểm tra bắt buộc phải chạy ở backend.
 * Frontend chỉ dùng để ẩn/hiện cho đẹp - ẩn nút không phải là bảo mật.
 */
import type { Role } from './enums';

export const PERMISSIONS = [
  'customer.read.own',
  'customer.read.team',
  'customer.read.all',
  'customer.create',
  'customer.update',
  'customer.reassign',
  'customer.tier.change',
  'activity.create',
  'activity.read.team',
  'task.manage.own',
  'task.manage.team',
  'price.read',
  'price.propose',
  'price.approve',
  'order.create',
  'order.create.team',
  'order.submit',
  'order.approve.normal',
  'order.approve.exception',
  'order.delivery.update',
  'order.accounting.confirm',
  'debt.read.own',
  'debt.read.team',
  'debt.read.all',
  'payment.allocate',
  'import.run',
  'import.read',
  'export.team',
  'export.all',
  'audit.read.own',
  'audit.read.team',
  'audit.read.all',
  'dashboard.manager',
  'dashboard.ceo',
  'settings.manage',
  'user.manage',
  'user.manage.all',
  'product.manage',
  'order.payment.record',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const EMPLOYEE: Permission[] = [
  'customer.read.own',
  'customer.create',
  'customer.update',
  'activity.create',
  'task.manage.own',
  'price.read',
  'order.create',
  'order.submit',
  'debt.read.own',
  'audit.read.own',
];

const MANAGER: Permission[] = [
  ...EMPLOYEE,
  'customer.read.team',
  'customer.reassign',
  'customer.tier.change',
  'activity.read.team',
  'task.manage.team',
  'price.propose',
  'order.create.team',
  'order.approve.normal',
  'order.delivery.update',
  'debt.read.team',
  'payment.allocate',
  'import.run',
  'import.read',
  'export.team',
  'audit.read.team',
  'dashboard.manager',
  'user.manage',
  'product.manage',
  'order.payment.record',
  'order.accounting.confirm',
];

/**
 * CEO: toàn công ty, ưu tiên chỉ đọc vận hành.
 * Không có order.create / activity.create / customer.create (mục 4: "Không nhập liệu vận hành").
 */
const CEO: Permission[] = [
  'customer.read.own',
  'customer.read.team',
  'customer.read.all',
  'customer.reassign',
  'price.read',
  'price.approve',
  'order.approve.normal',
  'order.approve.exception',
  'debt.read.own',
  'debt.read.team',
  'debt.read.all',
  'import.read',
  'export.all',
  'audit.read.own',
  'audit.read.team',
  'audit.read.all',
  'dashboard.manager',
  'dashboard.ceo',
  'settings.manage',
  'user.manage',
  'user.manage.all',
  'product.manage',
  'order.payment.record',
  'order.accounting.confirm',
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlyArray<Permission>> = {
  EMPLOYEE: EMPLOYEE,
  MANAGER: MANAGER,
  CEO: CEO,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export type DataScope = 'OWN' | 'TEAM' | 'ALL';

export function customerScope(role: Role): DataScope {
  if (role === 'CEO') return 'ALL';
  if (role === 'MANAGER') return 'TEAM';
  return 'OWN';
}

/** Vai trò tối thiểu được duyệt theo mức chênh lệch giá (mục 8.2 + cấu hình app_settings). */
export function requiredApproverRole(
  diffPercentAbs: number,
  managerThreshold: number,
  ceoThreshold: number,
): Role {
  if (diffPercentAbs > ceoThreshold) return 'CEO';
  if (diffPercentAbs > managerThreshold) return 'MANAGER';
  return 'MANAGER';
}

export function canDecideApproval(role: Role, requiredRole: 'MANAGER' | 'CEO'): boolean {
  if (requiredRole === 'CEO') return role === 'CEO';
  return role === 'MANAGER' || role === 'CEO';
}

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { STAGE_LABELS, ORDER_STATUS_LABELS } from '@shared/enums';
import type { CustomerStage } from '@shared/enums';

/* ------------------------------------------------------------------ Toast */
interface ToastMessage {
  id: string;
  text: string;
  kind: 'success' | 'error';
}
interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}
const ToastContext = createContext<ToastApi>({ success: () => {}, error: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const push = useCallback((text: string, kind: 'success' | 'error') => {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => setMessages((prev) => prev.filter((m) => m.id !== id)), 4000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ success: (t) => push(t, 'success'), error: (t) => push(t, 'error') }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {messages.map((m, index) => (
        <div
          key={m.id}
          className={`toast ${m.kind === 'error' ? 'error' : ''}`}
          style={{ bottom: 22 + index * 62 }}
          role="status"
        >
          {m.text}
        </div>
      ))}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

/* ------------------------------------------------------------------ Trạng thái */
export function StageBadge({ stage }: { stage: CustomerStage }) {
  const tone: Record<CustomerStage, string> = {
    NEW: 'blue',
    CONSULTING: 'orange',
    QUOTED: 'purple',
    NEGOTIATING: 'purple',
    FIRST_ORDER: 'green',
    REGULAR: 'pink',
    DORMANT: 'orange',
    LOST: 'red',
  };
  return <span className={`badge ${tone[stage] ?? ''}`}>{STAGE_LABELS[stage] ?? stage}</span>;
}

export function OrderStatusBadges({
  approval,
  delivery,
  payment,
  accounting,
}: {
  approval: keyof typeof ORDER_STATUS_LABELS.approval;
  delivery: keyof typeof ORDER_STATUS_LABELS.delivery;
  payment: keyof typeof ORDER_STATUS_LABELS.payment;
  accounting: keyof typeof ORDER_STATUS_LABELS.accounting;
}) {
  const approvalTone =
    approval === 'APPROVED' ? 'green' : approval === 'REJECTED' || approval === 'CANCELLED' ? 'red' : 'orange';
  const deliveryTone = delivery === 'DA_GIAO' ? 'green' : delivery === 'HOAN' ? 'red' : 'blue';
  const paymentTone =
    payment === 'DA_THU_DU' ? 'green' : payment === 'CHUA_THU' ? 'red' : payment === 'THU_THUA' ? 'purple' : 'orange';
  const accountingTone = accounting === 'DA_XAC_NHAN' ? 'green' : 'orange';

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <span className={`badge ${approvalTone}`}>{ORDER_STATUS_LABELS.approval[approval]}</span>
      <span className={`badge ${deliveryTone}`}>{ORDER_STATUS_LABELS.delivery[delivery]}</span>
      <span className={`badge ${paymentTone}`}>{ORDER_STATUS_LABELS.payment[payment]}</span>
      <span className={`badge ${accountingTone}`}>KT: {ORDER_STATUS_LABELS.accounting[accounting]}</span>
    </div>
  );
}

/**
 * Một đơn chỉ hiện ĐÚNG MỘT nhãn: bước xa nhất mà đơn đã đi tới trong luồng
 * tạo đơn → duyệt → xuất kho → giao → thu tiền → kế toán xác nhận.
 * Danh sách đơn không nên trải cả dải nhãn, nhìn rất rối.
 */
export function orderStage(order: {
  approval_status: keyof typeof ORDER_STATUS_LABELS.approval;
  delivery_status: keyof typeof ORDER_STATUS_LABELS.delivery;
  payment_status: keyof typeof ORDER_STATUS_LABELS.payment;
  accounting_status: keyof typeof ORDER_STATUS_LABELS.accounting;
}): { label: string; tone: string } {
  if (order.approval_status === 'CANCELLED') return { label: 'Đã huỷ', tone: 'red' };
  if (order.approval_status === 'REJECTED') return { label: 'Bị từ chối', tone: 'red' };
  if (order.approval_status === 'DRAFT') return { label: 'Nháp, chưa gửi duyệt', tone: 'orange' };
  if (order.approval_status === 'PENDING_APPROVAL') return { label: 'Chờ duyệt', tone: 'orange' };
  if (order.delivery_status === 'HOAN') return { label: 'Hàng hoàn về', tone: 'red' };

  // Đã duyệt: chạy tiếp theo đúng luồng vận hành của công ty.
  if (order.accounting_status === 'DA_XAC_NHAN') return { label: 'Hoàn tất', tone: 'green' };
  if (order.payment_status === 'DA_THU_DU' || order.payment_status === 'THU_THUA') {
    return { label: 'Chờ kế toán xác nhận', tone: 'purple' };
  }
  if (order.payment_status === 'THU_MOT_PHAN') return { label: 'Thu một phần', tone: 'orange' };
  if (order.delivery_status === 'DA_GIAO') return { label: 'Đã giao, chờ tiền', tone: 'blue' };
  if (order.delivery_status === 'DA_XUAT_KHO') return { label: 'Đã xuất kho', tone: 'blue' };
  return { label: 'Chờ xuất kho', tone: 'orange' };
}

export function OrderStageBadge(props: Parameters<typeof orderStage>[0]) {
  const stage = orderStage(props);
  return <span className={`badge ${stage.tone} nowrap`}>{stage.label}</span>;
}

/* ------------------------------------------------------------------ Khối chung */
export function Card({
  title,
  action,
  children,
  bodyClass,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClass?: string;
}) {
  return (
    <section className="card">
      {(title || action) && (
        <div className="card-head">
          {title ? <h3>{title}</h3> : <span />}
          {action}
        </div>
      )}
      <div className={bodyClass ?? 'card-body'}>{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className={`hint ${tone ?? ''}`}>{hint}</div>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn sm" onClick={onClose} aria-label="Đóng">
            Đóng
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  full,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label>{label}</label>
      {children}
      {hint && !error && <span className="muted" style={{ fontSize: 12 }}>{hint}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="alert-box" style={{ marginBottom: 14 }}>
      {message}
    </div>
  );
}

export function Loading({ text = 'Đang tải dữ liệu…' }: { text?: string }) {
  return <div className="loading">{text}</div>;
}

export function EmptyState({ message = 'Chưa có dữ liệu.' }: { message?: string }) {
  return <div className="empty">{message}</div>;
}

export function StateBlock({
  loading,
  error,
  empty,
  emptyText = 'Chưa có dữ liệu.',
  children,
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  if (loading) return <div className="loading">Đang tải dữ liệu…</div>;
  if (error) return <div className="alert-box" style={{ margin: 16 }}>{error}</div>;
  if (empty) return <div className="empty">{emptyText}</div>;
  return <>{children}</>;
}

/** Bỏ phần ghi chú trong ngoặc, ví dụ "Nguyễn Thu Thảo (dev)" -> "Nguyễn Thu Thảo". */
function cleanName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}

export function initialsOf(name: string): string {
  return cleanName(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

/** Tên gọi ngắn để chào hỏi: lấy hai từ cuối của họ tên. */
export function shortName(name: string): string {
  const parts = cleanName(name).split(/\s+/).filter(Boolean);
  return parts.slice(-2).join(' ') || name;
}

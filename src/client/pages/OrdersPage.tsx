import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ApprovalItem, OrderDetail, OrderListItem } from '@shared/types';
import { formatVnDate, formatVnDateTime, vnDate } from '@shared/datetime';
import { formatVnd } from '@shared/money';
import { ApiError, api } from '../lib/api';
import { useApi } from '../lib/hooks';
import {
  Card,
  ErrorBox,
  Modal,
  OrderStageBadge,
  OrderStatusBadges,
  StateBlock,
  useToast,
} from '../components/ui';
import { useAuth } from '../components/AuthProvider';

export function OrdersPage({ mode }: { mode: 'sales' | 'admin' }) {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const orders = useApi<OrderListItem[]>(`/api/orders${status ? `?status=${status}` : ''}`);
  const approvals = useApi<ApprovalItem[]>(
    can('order.approve.normal') ? '/api/approvals?status=PENDING' : null,
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{mode === 'admin' ? 'Đơn hàng & duyệt ngoại lệ' : 'Đơn hàng của tôi'}</h2>
          <p>
            Trạng thái duyệt, giao hàng, thanh toán và kế toán được tách riêng - không gộp thành một cột.
          </p>
        </div>
        <div className="actions">
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái duyệt</option>
            <option value="DRAFT">Nháp</option>
            <option value="PENDING_APPROVAL">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Bị từ chối</option>
          </select>
          {can('order.create') && (
            <Link className="btn primary" to="/sales/orders/new">
              Tạo đơn hàng
            </Link>
          )}
        </div>
      </div>

      {can('order.approve.normal') && (
        <Card
          title={`Yêu cầu chờ duyệt (${approvals.data?.length ?? 0})`}
          bodyClass=""
          action={<button className="btn sm" onClick={approvals.reload}>Làm mới</button>}
        >
          <StateBlock
            loading={approvals.loading}
            error={approvals.error}
            empty={(approvals.data ?? []).length === 0}
            emptyText="Không có yêu cầu nào đang chờ."
          >
            <ApprovalTable
              approvals={approvals.data ?? []}
              onDecided={() => {
                approvals.reload();
                orders.reload();
              }}
            />
          </StateBlock>
        </Card>
      )}

      <div style={{ height: 18 }} />

      <Card bodyClass="">
        <StateBlock
          loading={orders.loading}
          error={orders.error}
          empty={(orders.data ?? []).length === 0}
          emptyText="Chưa có đơn hàng nào."
        >
          <div className="table-wrap">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  {mode === 'admin' && <th>Sale</th>}
                  <th>Ngày</th>
                  <th className="right">Tổng phải thu</th>
                  <th className="right">Còn phải thu</th>
                  <th>Trạng thái hiện tại</th>
                  <th>Cập nhật trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {(orders.data ?? []).map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/${mode}/orders/${order.id}`} style={{ color: 'var(--pink)', fontWeight: 700 }}>
                        {order.order_no}
                      </Link>
                    </td>
                    <td>{order.customer_name}</td>
                    {mode === 'admin' && <td>{order.owner_name ?? '—'}</td>}
                    <td className="nowrap">{formatVnDate(order.order_date)}</td>
                    <td className="right nowrap">{formatVnd(order.total_amount)}</td>
                    <td className="right nowrap">{formatVnd(order.remaining_amount)}</td>
                    <td>
                      <OrderStageBadge {...order} />
                    </td>
                    <td>
                      <QuickActions order={order} onDone={() => orders.reload()} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </Card>
    </>
  );
}

export function ApprovalTable({
  approvals,
  onDecided,
}: {
  approvals: ApprovalItem[];
  onDecided: () => void;
}) {
  const toast = useToast();
  const [target, setTarget] = useState<{ approval: ApprovalItem; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const decide = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await api.post(`/api/approvals/${target.approval.id}/decide`, {
        decision: target.decision,
        note: note || null,
      });
      toast.success(target.decision === 'APPROVED' ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu');
      setTarget(null);
      setNote('');
      onDecided();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không xử lý được yêu cầu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Đối tượng</th>
              <th>Quy tắc</th>
              <th>Lý do</th>
              <th>Cấp duyệt</th>
              <th>Người gửi</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((approval) => (
              <tr key={approval.id}>
                <td>
                  <strong>{approval.entity_label ?? approval.entity_id.slice(0, 8)}</strong>
                  <div className="muted">{formatVnDateTime(approval.created_at)}</div>
                </td>
                <td>
                  <span className={`badge ${approval.rule_code === 'ORDER_STANDARD' ? 'blue' : 'orange'}`}>
                    {approval.rule_code}
                  </span>
                </td>
                <td>{approval.reason}</td>
                <td>
                  <span className={`badge ${approval.required_role === 'CEO' ? 'red' : 'purple'}`}>
                    {approval.required_role === 'CEO' ? 'CEO duyệt' : 'Quản lý duyệt'}
                  </span>
                </td>
                <td>{approval.requester_name}</td>
                <td>
                  <div className="actions">
                    <button className="btn sm dark" onClick={() => setTarget({ approval, decision: 'APPROVED' })}>
                      Duyệt
                    </button>
                    <button className="btn sm danger" onClick={() => setTarget({ approval, decision: 'REJECTED' })}>
                      Từ chối
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && (
        <Modal
          title={target.decision === 'APPROVED' ? 'Xác nhận duyệt' : 'Từ chối yêu cầu'}
          onClose={() => setTarget(null)}
          footer={
            <>
              <button className="btn" onClick={() => setTarget(null)}>
                Huỷ
              </button>
              <button
                className={`btn ${target.decision === 'APPROVED' ? 'primary' : 'danger'}`}
                onClick={decide}
                disabled={saving}
              >
                {saving ? 'Đang xử lý…' : 'Xác nhận'}
              </button>
            </>
          }
        >
          <div className="modal-body">
            <p>
              <strong>{target.approval.reason}</strong>
            </p>
            <div className="field">
              <label>Ghi chú quyết định</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function OrderDetailPage({ mode }: { mode: 'sales' | 'admin' }) {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const order = useApi<OrderDetail>(`/api/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  if (order.loading) return <div className="loading">Đang tải đơn hàng…</div>;
  if (order.error) return <div className="alert-box">{order.error}</div>;
  if (!order.data) return null;
  const o = order.data;

  const submit = async () => {
    setBusy(true);
    try {
      const result = await api.post<{ approvals: Array<{ rule_code: string; required_role: string }> }>(
        `/api/orders/${o.id}/submit`,
        {},
        crypto.randomUUID(),
      );
      const needsCeo = result.data.approvals.some((a) => a.required_role === 'CEO');
      toast.success(needsCeo ? 'Đã gửi duyệt - yêu cầu này cần CEO duyệt' : 'Đã gửi duyệt cho Quản lý');
      order.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không gửi duyệt được');
    } finally {
      setBusy(false);
    }
  };

  const updateDelivery = async (status: string) => {
    setBusy(true);
    try {
      await api.post(`/api/orders/${o.id}/delivery`, { delivery_status: status });
      toast.success('Đã cập nhật trạng thái giao hàng');
      order.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không cập nhật được');
    } finally {
      setBusy(false);
    }
  };

  const confirmAccounting = async () => {
    setBusy(true);
    try {
      await api.post(`/api/orders/${o.id}/accounting`, { accounting_status: 'DA_XAC_NHAN' });
      toast.success('Đã xác nhận kế toán - đơn này vào công nợ chính thức');
      order.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không xác nhận được');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const reason = prompt('Lý do huỷ đơn (bắt buộc, tối thiểu 5 ký tự):');
    if (!reason) return;
    setBusy(true);
    try {
      await api.post(`/api/orders/${o.id}/cancel`, { reason });
      toast.success('Đã huỷ đơn');
      order.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không huỷ được đơn');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Đơn {o.order_no}</h2>
          <p>
            {o.customer_name} · Ngày {formatVnDate(o.order_date)} · Sale {o.owner_name ?? '—'}
          </p>
        </div>
        <div className="actions">
          <Link className="btn" to={`/${mode}/orders`}>
            Danh sách đơn
          </Link>
          {(o.approval_status === 'DRAFT' || o.approval_status === 'REJECTED') && can('order.submit') && (
            <button className="btn primary" onClick={submit} disabled={busy}>
              Gửi duyệt
            </button>
          )}
          {o.approval_status === 'APPROVED' && can('order.delivery.update') && (
            <>
              <button className="btn" onClick={() => updateDelivery('DA_XUAT_KHO')} disabled={busy}>
                Đánh dấu đã xuất kho
              </button>
              <button className="btn dark" onClick={() => updateDelivery('DA_GIAO')} disabled={busy}>
                Đánh dấu đã giao
              </button>
              <button className="btn" onClick={() => updateDelivery('HOAN')} disabled={busy}>
                Hoàn hàng
              </button>
            </>
          )}
          {o.approval_status === 'APPROVED' &&
            o.accounting_status === 'CHUA_XAC_NHAN' &&
            can('order.accounting.confirm') && (
              <button className="btn" onClick={confirmAccounting} disabled={busy}>
                Kế toán xác nhận
              </button>
            )}
          {can('order.payment.record') && o.approval_status === 'APPROVED' && (
            <button className="btn primary" onClick={() => setShowPayment(true)}>
              Ghi nhận tiền về
            </button>
          )}
          {o.approval_status !== 'CANCELLED' && o.delivery_status === 'CHUA_XUAT' && (
            <button className="btn danger" onClick={cancel} disabled={busy}>
              Huỷ đơn
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <OrderStatusBadges
          approval={o.approval_status}
          delivery={o.delivery_status}
          payment={o.payment_status}
          accounting={o.accounting_status}
        />
      </div>

      {o.rejected_reason && <div className="alert-box" style={{ marginBottom: 16 }}>Lý do từ chối: {o.rejected_reason}</div>}

      <div className="grid-2">
        <Card title="Dòng sản phẩm" bodyClass="">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Mã SKU</th>
                  <th>Sản phẩm</th>
                  <th className="right">SL</th>
                  <th className="right">Giá chuẩn</th>
                  <th className="right">Giá áp dụng</th>
                  <th className="right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.sku}</strong>
                      {item.price_override && <div><span className="badge orange">Giá thoả thuận</span></div>}
                    </td>
                    <td>{item.product_name}</td>
                    <td className="right">{item.qty}</td>
                    <td className="right nowrap muted">{formatVnd(item.base_price)}</td>
                    <td className="right nowrap">{formatVnd(item.applied_price)}</td>
                    <td className="right nowrap">{formatVnd(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card title="Số tiền">
            <div className="stat-row">
              <span className="muted">Tiền hàng</span>
              <strong>{formatVnd(o.subtotal)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Chiết khấu</span>
              <strong>-{formatVnd(o.discount_amount)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Trừ thưởng tháng</span>
              <strong>-{formatVnd(o.bonus_deduction)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Phí vận chuyển</span>
              <strong>+{formatVnd(o.shipping_fee)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Tổng phải thu</span>
              <strong>{formatVnd(o.total_amount)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">COD/đặt cọc</span>
              <strong>{formatVnd(o.cod_amount)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Đã thu (phân bổ)</span>
              <strong>{formatVnd(o.received_amount)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Còn phải thu</span>
              <strong>{formatVnd(o.remaining_amount)}</strong>
            </div>
          </Card>

          <Card title="Yêu cầu duyệt">
            {o.approvals.length === 0 ? (
              <div className="empty">Chưa gửi duyệt.</div>
            ) : (
              <div className="timeline">
                {o.approvals.map((approval) => (
                  <div className="event" key={approval.id}>
                    <p>
                      <strong>{approval.rule_code}</strong> ·{' '}
                      <span
                        className={`badge ${
                          approval.status === 'APPROVED'
                            ? 'green'
                            : approval.status === 'REJECTED'
                              ? 'red'
                              : 'orange'
                        }`}
                      >
                        {approval.status}
                      </span>
                    </p>
                    <small>
                      {approval.reason} — {approval.requester_name} gửi lúc{' '}
                      {formatVnDateTime(approval.created_at)}
                    </small>
                    {approval.decision_note && <div>Ghi chú: {approval.decision_note}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {showPayment && (
        <RecordPaymentModal
          order={o}
          onClose={() => setShowPayment(false)}
          onDone={() => {
            setShowPayment(false);
            toast.success('Đã ghi nhận tiền về');
            order.reload();
          }}
        />
      )}
    </>
  );
}

/**
 * Thao tác nhanh ngay trên danh sách, đúng luồng thật của công ty:
 *   Quản lý tích "đã xuất kho" → "đã giao"
 *   Sale tích "tiền về" (ghi nhận, chưa vào công nợ chính thức)
 *   Kế toán bấm "xác nhận" thì đơn mới ghi nợ chính thức.
 * Nút nào không thuộc quyền của người đang đăng nhập thì không hiện.
 */
function QuickActions({ order, onDone }: { order: OrderListItem; onDone: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      toast.success(label);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thực hiện được');
    } finally {
      setBusy(false);
    }
  };

  const buttons: React.ReactNode[] = [];

  // Đơn còn nháp thì việc cần làm đầu tiên là gửi duyệt, làm ngay tại danh sách.
  if (
    (order.approval_status === 'DRAFT' || order.approval_status === 'REJECTED') &&
    can('order.submit')
  ) {
    buttons.push(
      <button
        key="gui"
        className="btn sm primary"
        disabled={busy}
        onClick={() =>
          run('Đã gửi duyệt', () => api.post(`/api/orders/${order.id}/submit`, {}, crypto.randomUUID()))
        }
      >
        Gửi duyệt
      </button>,
    );
  }

  if (order.approval_status === 'APPROVED' && can('order.delivery.update')) {
    if (order.delivery_status === 'CHUA_XUAT') {
      buttons.push(
        <button
          key="xuat"
          className="btn sm"
          disabled={busy}
          onClick={() =>
            run('Đã đánh dấu xuất kho', () =>
              api.post(`/api/orders/${order.id}/delivery`, { delivery_status: 'DA_XUAT_KHO' }),
            )
          }
        >
          Đã xuất kho
        </button>,
      );
    } else if (order.delivery_status === 'DA_XUAT_KHO') {
      buttons.push(
        <button
          key="giao"
          className="btn sm"
          disabled={busy}
          onClick={() =>
            run('Đã đánh dấu giao hàng', () =>
              api.post(`/api/orders/${order.id}/delivery`, { delivery_status: 'DA_GIAO' }),
            )
          }
        >
          Đã giao
        </button>,
      );
    }
  }

  if (
    order.approval_status === 'APPROVED' &&
    order.payment_status !== 'DA_THU_DU' &&
    can('order.payment.record')
  ) {
    buttons.push(
      <button key="tien" className="btn sm primary" disabled={busy} onClick={() => setShowPayment(true)}>
        Tiền về
      </button>,
    );
  }

  if (
    order.approval_status === 'APPROVED' &&
    order.accounting_status === 'CHUA_XAC_NHAN' &&
    (order.delivery_status === 'DA_XUAT_KHO' || order.delivery_status === 'DA_GIAO') &&
    can('order.accounting.confirm')
  ) {
    buttons.push(
      <button
        key="kt"
        className="btn sm dark"
        disabled={busy}
        onClick={() =>
          run('Kế toán đã xác nhận', () =>
            api.post(`/api/orders/${order.id}/accounting`, { accounting_status: 'DA_XAC_NHAN' }),
          )
        }
      >
        KT xác nhận
      </button>,
    );
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {buttons.length > 0 ? buttons : <span className="muted">—</span>}
      </div>
      {showPayment && (
        <RecordPaymentModal
          order={{ ...order, items: [], approvals: [] } as unknown as OrderDetail}
          onClose={() => setShowPayment(false)}
          onDone={() => {
            setShowPayment(false);
            toast.success('Đã ghi nhận tiền về, chờ kế toán xác nhận');
            onDone();
          }}
        />
      )}
    </>
  );
}

/** Ghi nhận tiền khách trả cho đúng đơn này. */
function RecordPaymentModal({
  order,
  onClose,
  onDone,
}: {
  order: OrderDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const remaining = Math.max(0, order.remaining_amount ?? 0);
  const [amount, setAmount] = useState(String(remaining));
  const [paidAt, setPaidAt] = useState(vnDate());
  const [method, setMethod] = useState('Chuyển khoản');
  const [receiptNo, setReceiptNo] = useState('');
  const [confirmed, setConfirmed] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/payments', {
        customer_id: order.customer_id,
        amount: Number(amount),
        paid_at: paidAt,
        method,
        external_receipt_no: receiptNo || null,
        note: note || null,
        accounting_confirmed: confirmed,
        allocations: [{ order_id: order.id, amount: Number(amount) }],
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không ghi nhận được khoản thu');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Ghi nhận tiền về · đơn ${order.order_no}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <ErrorBox message={error} />
          <p className="muted">
            Khách <strong>{order.customer_name}</strong> · còn phải thu{' '}
            <strong>{formatVnd(remaining)}</strong>. Số tiền thừa so với công nợ đơn sẽ được giữ thành
            số dư có của khách, không trừ âm.
          </p>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Số tiền nhận (đồng) *</label>
              <input
                type="number"
                min={1}
                step={1000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Ngày nhận tiền</label>
              <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="field">
              <label>Hình thức</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Chuyển khoản</option>
                <option>Tiền mặt</option>
                <option>COD</option>
                <option>Bù trừ công nợ</option>
              </select>
            </div>
            <div className="field">
              <label>Mã phiếu thu</label>
              <input
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                placeholder="Bỏ trống sẽ vào hàng chờ kiểm tra"
              />
            </div>
            <div className="field full">
              <label>Ghi chú</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="field full">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Kế toán đã xác nhận khoản này (trừ vào công nợ chính thức ngay)
              </label>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu khoản thu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

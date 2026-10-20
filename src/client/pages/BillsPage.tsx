import { CustomerSelect } from '../components/CustomerSelect';
import { hubPeriodLabel, hubPeriodParam, hubPeriodRange } from '../lib/hubPeriod';
import { useMemo, useState } from 'react';
import type { CustomerListItem, OrderListItem } from '@shared/types';
import { formatVnDate, vnDate } from '@shared/datetime';
import { formatVnd } from '@shared/money';
import { ApiError, api, apiFetch } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useAuth } from '../components/AuthProvider';
import { BillFilePicker, uploadBills } from '../components/BillUpload';
import { Card, ErrorBox, Modal, PageHead, StateBlock, useToast } from '../components/ui';

interface Bill {
  id: string;
  customer_id: string;
  customer_name: string;
  order_id: string | null;
  order_no: string | null;
  payment_id: string | null;
  payment_status: string | null;
  amount: number | null;
  paid_at: string | null;
  method: string | null;
  note: string | null;
  name: string;
  mime: string;
  size: number;
  created_by_name: string | null;
  created_at: string;
}

interface HistoryRow {
  id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  is_adjustment: number;
  paid_at: string;
  method: string | null;
  external_receipt_no: string | null;
  accounting_status: string;
  note: string | null;
  created_by_name: string | null;
  bill_count: number;
  orders: string | null;
  /** Đơn gợi ý cho khoản chưa gắn đơn (đúng số còn phải thu, duy nhất một đơn). */
  suggest?: { order_id: string; order_no: string; remaining: number } | null;
}

/**
 * Kho ảnh bill giao dịch: sale gửi bill khách chuyển khoản, kế toán mở ra đối chiếu khi xác nhận tiền về.
 * Tab "Lịch sử giao dịch" liệt kê các khoản tiền về kèm đơn đã phân bổ và số bill đính kèm.
 */
export function BillsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'bills' | 'history' | 'report'>('bills');
  const month = hubPeriodParam();
  const [customerId, setCustomerId] = useState('');
  // Khoảng ngày theo bộ chọn thời gian trên cùng của Trang quản trị.
  const { from, to } = hubPeriodRange();
  const [q, setQ] = useState('');
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Bill | null>(null);

  const customers = useApi<CustomerListItem[]>('/api/customers?page_size=200');
  const qs = new URLSearchParams({ _: String(reloadKey) });
  if (customerId) qs.set('customer_id', customerId);
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  if (tab === 'bills' && q) qs.set('q', q);
  if (tab === 'bills' && onlyUnlinked) qs.set('unlinked', '1');
  const bills = useApi<Bill[]>(tab === 'bills' ? `/api/bills?${qs.toString()}` : null);
  const history = useApi<HistoryRow[]>(
    tab === 'history' ? `/api/bills/history?${qs.toString()}` : null,
  );

  const reload = () => setReloadKey((k) => k + 1);
  const canUpload = can('order.payment.record');
  const canConfirm = can('order.accounting.confirm');

  /** Kế toán xác nhận (hoặc bỏ xác nhận) khoản tiền về sau khi đối chiếu bill. */
  async function confirmPayment(id: string, confirmed: boolean) {
    try {
      await api.post(`/api/payments/${id}/confirm`, { confirmed });
      toast.success(confirmed ? 'Đã xác nhận khoản tiền về' : 'Đã bỏ xác nhận khoản tiền');
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không xác nhận được');
    }
  }

  /** Tự chia khoản tiền vào các đơn của khách, đơn đặt trước trừ trước. */
  async function autoAllocate(id: string) {
    try {
      const r = await api.post<{ allocated: number; to_old_debt: number; to_credit: number }>(`/api/payments/${id}/auto-allocate`, {});
      const d = r.data;
      toast.success(
        `Đã chia ${formatVnd(d.allocated)} vào đơn` +
          (d.to_old_debt ? `, ${formatVnd(d.to_old_debt)} trừ công nợ cũ` : '') +
          (d.to_credit ? `, ${formatVnd(d.to_credit)} giữ làm số dư có của khách` : ''),
      );
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không chia được');
    }
  }

  /** Một lần bấm: gắn khoản tiền vào đơn gợi ý rồi xác nhận khoản tiền. */
  async function confirmAttach(id: string, orderId: string, orderNo: string) {
    try {
      await api.post(`/api/payments/${id}/confirm-attach`, { order_id: orderId });
      toast.success(`Đã xác nhận khoản tiền và gắn vào đơn ${orderNo}`);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không gắn được vào đơn');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Kho bill giao dịch</h2>
          <p>
            Ảnh bill khách chuyển khoản do sale gửi, kèm lịch sử các khoản tiền về. Bill gắn với
            khách, đơn và khoản tiền để kế toán đối chiếu.
          </p>
        </div>
        {canUpload && (
          <div className="actions">
            <button className="btn primary" onClick={() => setCreating(true)}>
              Gửi bill mới
            </button>
          </div>
        )}
      </div>

      <div
        className="toolbar"
        style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}
      >
        <button
          className={`btn ${tab === 'bills' ? 'primary' : ''}`}
          onClick={() => setTab('bills')}
        >
          Kho ảnh bill
        </button>
        <button
          className={`btn ${tab === 'history' ? 'primary' : ''}`}
          onClick={() => setTab('history')}
        >
          Lịch sử giao dịch
        </button>
        <button
          className={`btn ${tab === 'report' ? 'primary' : ''}`}
          onClick={() => setTab('report')}
        >
          Báo cáo tháng
        </button>
      </div>

      {tab === 'report' ? (
        <MonthReport month={month} />
      ) : (
        <>
          <Card>
            <div className="form-grid">
              <div className="field">
                <label>Khách hàng</label>
                <CustomerSelect
                  value={customerId}
                  onChange={setCustomerId}
                  emptyLabel="Tất cả khách"
                  options={(customers.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
                />
              </div>
              {tab === 'bills' && (
                <>
                  <div className="field">
                    <label>Tìm (khách, ghi chú, mã đơn)</label>
                    <input value={q} onChange={(e) => setQ(e.target.value)} />
                  </div>
                  <label
                    className="field"
                    style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                  >
                    <input
                      type="checkbox"
                      checked={onlyUnlinked}
                      onChange={(e) => setOnlyUnlinked(e.target.checked)}
                    />
                    Chỉ bill chưa gắn khoản tiền
                  </label>
                </>
              )}
            </div>
          </Card>

          <div style={{ height: 16 }} />

          {tab === 'bills' ? (
            <StateBlock
              loading={bills.loading}
              error={bills.error}
              empty={(bills.data ?? []).length === 0}
              emptyText="Chưa có bill nào. Bấm Gửi bill mới hoặc gửi bill ngay trong đơn hàng."
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                  gap: 12,
                }}
              >
                {(bills.data ?? []).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="card"
                    onClick={() => setOpen(b)}
                    style={{ textAlign: 'left', padding: 8, cursor: 'pointer' }}
                  >
                    {b.mime.startsWith('image/') ? (
                      <img
                        src={`/api/bills/${b.id}/file`}
                        alt={b.name}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: 150,
                          objectFit: 'cover',
                          borderRadius: 8,
                          background: '#f3f0ff',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: 150,
                          display: 'grid',
                          placeItems: 'center',
                          background: '#f3f0ff',
                          borderRadius: 8,
                          fontWeight: 700,
                        }}
                      >
                        PDF
                      </div>
                    )}
                    <div style={{ marginTop: 6 }}>
                      <strong>{b.customer_name}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {b.amount ? formatVnd(b.amount) : 'Chưa ghi số tiền'} ·{' '}
                        {formatVnDate(b.paid_at ?? b.created_at)}
                      </div>
                      <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {b.order_no && <span className="badge blue">{b.order_no}</span>}
                        {b.payment_id ? (
                          <span
                            className={`badge ${b.payment_status === 'DA_XAC_NHAN' ? 'green' : 'orange'}`}
                          >
                            {b.payment_status === 'DA_XAC_NHAN'
                              ? 'KT đã xác nhận'
                              : 'Chờ KT xác nhận'}
                          </span>
                        ) : (
                          <span className="badge">Chưa gắn khoản tiền</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </StateBlock>
          ) : (
            <Card bodyClass="">
              <StateBlock
                loading={history.loading}
                error={history.error}
                empty={(history.data ?? []).length === 0}
                emptyText="Chưa có giao dịch nào trong khoảng này."
              >
                <div className="table-wrap">
                  <table className="data wide">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Khách hàng</th>
                        <th className="right">Số tiền</th>
                        <th>Hình thức</th>
                        <th>Đơn đã phân bổ</th>
                        <th>Mã phiếu</th>
                        <th>Kế toán</th>
                        <th className="right">Bill</th>
                        <th>Người ghi</th>
                        {canConfirm && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(history.data ?? []).map((h) => (
                        <tr key={h.id}>
                          <td className="nowrap">{formatVnDate(h.paid_at)}</td>
                          <td>{h.customer_name}</td>
                          <td className="right nowrap">
                            {h.is_adjustment ? '−' : ''}
                            {formatVnd(h.amount)}
                          </td>
                          <td>{h.method ?? '—'}</td>
                          <td>
                            {h.orders ?? (
                              <>
                                <span className="muted">Chưa phân bổ</span>
                                {h.suggest && (
                                  <div style={{ fontSize: 12.5, marginTop: 2 }}>
                                    <span className="badge purple">Gợi ý</span> đơn <b>{h.suggest.order_no}</b> (đúng {formatVnd(h.suggest.remaining)})
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                          <td>{h.external_receipt_no ?? '—'}</td>
                          <td>
                            <span
                              className={`badge ${h.accounting_status === 'DA_XAC_NHAN' ? 'green' : 'orange'}`}
                            >
                              {h.accounting_status === 'DA_XAC_NHAN'
                                ? 'Đã xác nhận'
                                : 'Chờ xác nhận'}
                            </span>
                          </td>
                          <td className="right">{h.bill_count}</td>
                          <td>{h.created_by_name ?? '—'}</td>
                          {canConfirm && (
                            <td>
                              {h.suggest && (
                                <button
                                  className="btn sm primary"
                                  style={{ marginRight: 6 }}
                                  onClick={() => void confirmAttach(h.id, h.suggest!.order_id, h.suggest!.order_no)}
                                  title="Đối chiếu bill xong thì bấm: xác nhận khoản tiền và gắn vào đơn gợi ý cùng lúc"
                                >
                                  {h.accounting_status === 'DA_XAC_NHAN' ? 'Gắn vào đơn' : 'Xác nhận + gắn vào đơn'}
                                </button>
                              )}
                              {!h.orders && !h.is_adjustment && (
                                <button
                                  className="btn sm primary"
                                  style={{ marginRight: 6 }}
                                  onClick={() => void autoAllocate(h.id)}
                                  title="Chia khoản tiền này vào các đơn của khách, đơn đặt trước trừ trước; thừa thì trừ công nợ cũ"
                                >
                                  Tự chia vào đơn
                                </button>
                              )}
                              {h.accounting_status === 'DA_XAC_NHAN' ? (
                                <button
                                  className="btn sm"
                                  onClick={() => void confirmPayment(h.id, false)}
                                >
                                  Bỏ xác nhận
                                </button>
                              ) : (
                                <button
                                  className="btn sm primary"
                                  onClick={() => void confirmPayment(h.id, true)}
                                >
                                  Xác nhận
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </StateBlock>
            </Card>
          )}
        </>
      )}

      {open && (
        <BillDetailModal
          bill={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null);
            reload();
            toast.success('Đã cập nhật');
          }}
        />
      )}
      {creating && (
        <NewBillModal
          customers={customers.data ?? []}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            toast.success('Đã gửi bill');
            reload();
          }}
        />
      )}
    </>
  );
}

function BillDetailModal({
  bill,
  onClose,
  onChanged,
}: {
  bill: Bill;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const history = useApi<HistoryRow[]>(
    `/api/bills/history?customer_id=${bill.customer_id}&limit=30`,
  );
  const [paymentId, setPaymentId] = useState(bill.payment_id ?? '');

  async function link() {
    try {
      await api.patch(`/api/bills/${bill.id}`, { payment_id: paymentId || null });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gắn được');
    }
  }
  const toast = useToast();
  const picked = (history.data ?? []).find((h) => h.id === paymentId);
  /** Ngay trong hộp bill: chia khoản tiền vào đơn (đơn cũ trước) và xác nhận, khỏi phải đóng hộp tìm nút khác. */
  async function payAction(kind: 'alloc' | 'confirm') {
    if (!paymentId) return;
    try {
      if (kind === 'alloc') {
        const r = await api.post<{ allocated: number; to_old_debt: number; to_credit: number }>(`/api/payments/${paymentId}/auto-allocate`, {});
        toast.success(`Đã chia ${formatVnd(r.data.allocated)} vào đơn` + (r.data.to_old_debt ? `, ${formatVnd(r.data.to_old_debt)} trừ công nợ cũ` : '') + (r.data.to_credit ? `, ${formatVnd(r.data.to_credit)} làm số dư có` : ''));
      } else {
        await api.post(`/api/payments/${paymentId}/confirm`, { confirmed: true });
        toast.success('Đã xác nhận khoản tiền về');
      }
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không làm được');
    }
  }
  async function remove() {
    if (!confirm('Xoá bill này khỏi kho?')) return;
    try {
      await apiFetch(`/api/bills/${bill.id}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xoá được');
    }
  }

  return (
    <Modal title={`Bill · ${bill.customer_name}`} onClose={onClose} wide>
      <div className="modal-body">
        <ErrorBox message={error} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1fr)',
            gap: 16,
          }}
        >
          <div>
            {bill.mime.startsWith('image/') ? (
              <a href={`/api/bills/${bill.id}/file`} target="_blank" rel="noreferrer">
                <img
                  src={`/api/bills/${bill.id}/file`}
                  alt={bill.name}
                  style={{
                    width: '100%',
                    maxHeight: 460,
                    objectFit: 'contain',
                    background: '#f3f0ff',
                    borderRadius: 8,
                  }}
                />
              </a>
            ) : (
              <a
                className="btn"
                href={`/api/bills/${bill.id}/file`}
                target="_blank"
                rel="noreferrer"
              >
                Mở file PDF
              </a>
            )}
          </div>
          <div>
            <div className="stat-row">
              <span className="muted">Số tiền</span>
              <strong>{bill.amount ? formatVnd(bill.amount) : '—'}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Ngày chuyển</span>
              <strong>{formatVnDate(bill.paid_at ?? bill.created_at)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Hình thức</span>
              <strong>{bill.method ?? '—'}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Đơn</span>
              <strong>{bill.order_no ?? '—'}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Người gửi</span>
              <strong>{bill.created_by_name ?? '—'}</strong>
            </div>
            {bill.note && <p style={{ marginTop: 8 }}>{bill.note}</p>}

            <div className="field" style={{ marginTop: 12 }}>
              <label>Gắn vào khoản tiền về</label>
              <select value={paymentId} onChange={(e) => setPaymentId(e.target.value)}>
                <option value="">— Chưa gắn —</option>
                {(history.data ?? []).map((h) => (
                  <option key={h.id} value={h.id}>
                    {formatVnDate(h.paid_at)} · {formatVnd(h.amount)} · {h.orders ?? 'chưa phân bổ'}
                  </option>
                ))}
              </select>
            </div>
            {picked && can('order.accounting.confirm') && (
              <div className="note" style={{ marginTop: 10 }}>
                <div style={{ marginBottom: 6 }}>
                  Khoản này: <b>{picked.orders ? `đã trừ vào ${picked.orders}` : 'chưa trừ vào đơn nào'}</b> ·{' '}
                  <b>{picked.accounting_status === 'DA_XAC_NHAN' ? 'đã xác nhận' : 'chưa xác nhận'}</b>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!picked.orders && (
                    <button className="btn sm primary" onClick={() => void payAction('alloc')}>
                      Chia vào đơn / công nợ (đơn cũ trước)
                    </button>
                  )}
                  {picked.accounting_status !== 'DA_XAC_NHAN' && (
                    <button className="btn sm primary" onClick={() => void payAction('confirm')}>
                      Xác nhận khoản tiền
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <h4 style={{ margin: '16px 0 6px' }}>Lịch sử giao dịch của khách</h4>
        <StateBlock
          loading={history.loading}
          error={history.error}
          empty={(history.data ?? []).length === 0}
          emptyText="Khách chưa có giao dịch nào."
        >
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th className="right">Số tiền</th>
                  <th>Đơn</th>
                  <th>Kế toán</th>
                  <th className="right">Bill</th>
                </tr>
              </thead>
              <tbody>
                {(history.data ?? []).map((h) => (
                  <tr key={h.id}>
                    <td className="nowrap">{formatVnDate(h.paid_at)}</td>
                    <td className="right nowrap">{formatVnd(h.amount)}</td>
                    <td>{h.orders ?? '—'}</td>
                    <td>
                      {h.accounting_status === 'DA_XAC_NHAN' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                    </td>
                    <td className="right">{h.bill_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </div>
      <div className="modal-foot">
        {can('order.payment.record') && (
          <button className="btn danger" onClick={() => void remove()}>
            Xoá bill
          </button>
        )}
        <button className="btn" onClick={onClose}>
          Đóng
        </button>
        {can('order.payment.record') && (
          <button className="btn primary" onClick={() => void link()}>
            Lưu gắn khoản tiền
          </button>
        )}
      </div>
    </Modal>
  );
}

function NewBillModal({
  customers,
  onClose,
  onDone,
}: {
  customers: CustomerListItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(vnDate());
  const [method, setMethod] = useState('Chuyển khoản');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orders = useApi<OrderListItem[]>(
    customerId ? `/api/orders?customer_id=${customerId}&limit=50` : null,
  );
  const orderOptions = useMemo(
    () => (orders.data ?? []).filter((o) => o.approval_status !== 'CANCELLED'),
    [orders.data],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return setError('Chọn khách hàng');
    if (files.length === 0) return setError('Chọn ít nhất một ảnh bill');
    setBusy(true);
    setError(null);
    try {
      await uploadBills(files, {
        customerId,
        orderId: orderId || null,
        amount: amount ? Number(amount) : null,
        paidAt,
        method,
        note,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được bill');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Gửi bill mới" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <ErrorBox message={error} />
          <div className="form-grid">
            <div className="field">
              <label>Khách hàng *</label>
              <CustomerSelect
                value={customerId}
                onChange={(id) => {
                  setCustomerId(id);
                  setOrderId('');
                }}
                options={customers.map((c) => ({ id: c.id, name: c.name }))}
              />
            </div>
            <div className="field">
              <label>Đơn hàng (nếu có)</label>
              <select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                disabled={!customerId}
              >
                <option value="">— Không gắn đơn —</option>
                {orderOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_no} · {formatVnd(o.total_amount)}
                  </option>
                ))}
              </select>
            </div>
            <BillFilePicker files={files} onChange={setFiles} />
            <div className="field">
              <label>Số tiền trên bill (đồng)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Ngày chuyển</label>
              <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="field">
              <label>Hình thức</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Chuyển khoản</option>
                <option>Tiền mặt</option>
                <option>COD</option>
                <option>Khác</option>
              </select>
            </div>
            <div className="field full">
              <label>Ghi chú</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Đang gửi…' : 'Gửi bill'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface AccountRow {
  id: string;
  bank: string;
  account_no: string;
  account_name: string;
  note: string | null;
  active: number;
}

/** Danh sách tài khoản nhận tiền hợp lệ của công ty (chỉ CEO sửa, trên trang quản trị). */
/** Trang quản trị: tài khoản nhận tiền hợp lệ của công ty (chuyển từ Kho bill sang Cài đặt). */
export function ReceivingAccountsPage() {
  return (
    <>
      <PageHead
        title="Tài khoản nhận tiền"
        subtitle="Sale chỉ chọn trong danh sách này khi ghi tiền chuyển khoản"
      />
      <ReceivingAccounts />
    </>
  );
}

function ReceivingAccounts() {
  const toast = useToast();
  const [key, setKey] = useState(0);
  const list = useApi<AccountRow[]>(`/api/receiving-accounts?_=${key}`);
  const [form, setForm] = useState({ bank: '', account_no: '', account_name: '' });
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/api/receiving-accounts', form);
      setForm({ bank: '', account_no: '', account_name: '' });
      setKey((k) => k + 1);
      toast.success('Đã thêm tài khoản nhận tiền');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thêm được');
    }
  }
  async function toggle(a: AccountRow) {
    try {
      await api.post(`/api/receiving-accounts/${a.id}/active`, { active: !a.active });
      setKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không đổi được');
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Card title="Tài khoản nhận tiền hợp lệ của công ty">
        <p className="muted" style={{ margin: '0 0 8px' }}>
          Sale chỉ chọn trong danh sách này khi ghi tiền chuyển khoản. Bill chuyển vào tài khoản
          ngoài danh sách bị gắn cờ cho kế toán kiểm tra.
        </p>
        <ErrorBox message={error} />
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Ngân hàng</th>
                <th>Số tài khoản</th>
                <th>Chủ tài khoản</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Chưa có tài khoản nào. Thêm tài khoản nhận tiền của công ty bên dưới.
                  </td>
                </tr>
              )}
              {(list.data ?? []).map((a) => (
                <tr key={a.id} style={a.active ? undefined : { opacity: 0.55 }}>
                  <td>{a.bank}</td>
                  <td>
                    <strong>{a.account_no}</strong>
                  </td>
                  <td>{a.account_name}</td>
                  <td>
                    <button className="btn sm" onClick={() => void toggle(a)}>
                      {a.active ? 'Ngừng dùng' : 'Dùng lại'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={add} className="form-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label>Ngân hàng</label>
            <input
              value={form.bank}
              onChange={(e) => setForm({ ...form, bank: e.target.value })}
              placeholder="MB"
              required
            />
          </div>
          <div className="field">
            <label>Số tài khoản</label>
            <input
              value={form.account_no}
              onChange={(e) => setForm({ ...form, account_no: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Chủ tài khoản</label>
            <input
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              placeholder="CÔNG TY CP TM VÀ XNK AILLA VIỆT NAM"
              required
            />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button className="btn primary">Thêm tài khoản</button>
          </div>
        </form>
      </Card>
    </div>
  );
}

interface ReportGroup {
  key: string;
  count: number;
  amount: number;
  confirmed: number;
  pending: number;
  customer_name?: string;
}

interface MonthReportData {
  month: string;
  totals: { count: number; amount: number; confirmed: number; pending: number };
  by_customer: ReportGroup[];
  by_method: ReportGroup[];
  by_purpose: ReportGroup[];
  rows: Array<{
    id: string;
    paid_at: string;
    customer_name: string;
    amount: number;
    method: string | null;
    purpose: string;
    explanation: string | null;
    external_receipt_no: string | null;
    bank_ref: string | null;
    accounting_status: string;
    review_reason: string | null;
    receiver_name: string | null;
    account_bank: string | null;
    account_no: string | null;
    bill_count: number;
    orders: string | null;
  }>;
}

const PURPOSE_LABEL: Record<string, string> = {
  ORDER: 'Thanh toán đơn',
  DEBT: 'Trả công nợ nhiều đơn',
  DEPOSIT: 'Đặt cọc / ứng trước',
};

/** Báo cáo giao dịch B2B theo tháng: tổng tiền về, theo khách, hình thức, mục đích, tách đã xác nhận / chờ xác nhận. */
function MonthReport({ month }: { month: string }) {
  const report = useApi<MonthReportData>(`/api/bills/report?month=${month}`);
  const d = report.data;

  async function exportXlsx() {
    if (!d) return;
    const XLSX = await import('xlsx');
    const rows: unknown[][] = [
      [
        'Ngày',
        'Khách hàng',
        'Đơn',
        'Số tiền (đ)',
        'Hình thức',
        'Mục đích',
        'Giải trình',
        'Số tham chiếu',
        'Tài khoản nhận',
        'Người nhận tiền mặt',
        'Số bill',
        'Kế toán',
        'Cần kiểm tra',
      ],
      ...d.rows.map((r) => [
        r.paid_at,
        r.customer_name,
        r.orders ?? '',
        r.amount,
        r.method ?? '',
        PURPOSE_LABEL[r.purpose] ?? r.purpose,
        r.explanation ?? '',
        r.bank_ref ?? r.external_receipt_no ?? '',
        r.account_no ? `${r.account_bank ?? ''} ${r.account_no}` : '',
        r.receiver_name ?? '',
        r.bill_count,
        r.accounting_status === 'DA_XAC_NHAN' ? 'Đã xác nhận' : 'Chờ xác nhận',
        r.review_reason ?? '',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [12, 30, 22, 14, 14, 20, 36, 26, 26, 20, 8, 14, 36].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Giao dịch ' + month);
    XLSX.writeFile(wb, `bao-cao-giao-dich-b2b-${month}.xlsx`);
  }

  const table = (title: string, groups: ReportGroup[], label: (g: ReportGroup) => string) => (
    <Card title={title} bodyClass="">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th></th>
              <th className="right">Số khoản</th>
              <th className="right">Tổng tiền</th>
              <th className="right">Đã xác nhận</th>
              <th className="right">Chờ xác nhận</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Không có giao dịch.
                </td>
              </tr>
            )}
            {groups.map((g) => (
              <tr key={g.key}>
                <td>{label(g)}</td>
                <td className="right">{g.count}</td>
                <td className="right nowrap">{formatVnd(g.amount)}</td>
                <td className="right nowrap">{formatVnd(g.confirmed)}</td>
                <td className="right nowrap">{formatVnd(g.pending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <>
      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="field">
            <label>Kỳ báo cáo</label>
            <strong>{hubPeriodLabel()}</strong>
          </div>
          <button
            className="btn"
            onClick={() => void exportXlsx()}
            disabled={!d || d.rows.length === 0}
          >
            Xuất Excel
          </button>
        </div>
      </Card>
      <div style={{ height: 16 }} />
      <StateBlock loading={report.loading} error={report.error} empty={false}>
        {d && (
          <>
            <div className="kpis">
              <div className="kpi">
                <div className="label">Số giao dịch</div>
                <div className="value">{d.totals.count}</div>
              </div>
              <div className="kpi">
                <div className="label">Tổng tiền về</div>
                <div className="value">{formatVnd(d.totals.amount)}</div>
              </div>
              <div className="kpi">
                <div className="label">Đã xác nhận</div>
                <div className="value">{formatVnd(d.totals.confirmed)}</div>
              </div>
              <div className="kpi">
                <div className="label">Chờ xác nhận</div>
                <div className="value">{formatVnd(d.totals.pending)}</div>
              </div>
            </div>
            <div style={{ height: 16 }} />
            {table('Theo khách hàng', d.by_customer, (g) => g.customer_name ?? g.key)}
            <div style={{ height: 16 }} />
            {table('Theo hình thức', d.by_method, (g) => g.key)}
            <div style={{ height: 16 }} />
            {table('Theo mục đích', d.by_purpose, (g) => PURPOSE_LABEL[g.key] ?? g.key)}
            <div style={{ height: 16 }} />
            <Card title={`Chi tiết ${d.rows.length} giao dịch`} bodyClass="">
              <div className="table-wrap">
                <table className="data wide">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Khách hàng</th>
                      <th>Đơn</th>
                      <th className="right">Số tiền</th>
                      <th>Hình thức</th>
                      <th>Mục đích</th>
                      <th>Giải trình / lưu ý</th>
                      <th>Kế toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="nowrap">{formatVnDate(r.paid_at)}</td>
                        <td>{r.customer_name}</td>
                        <td>{r.orders ?? '—'}</td>
                        <td className="right nowrap">{formatVnd(r.amount)}</td>
                        <td>{r.method ?? '—'}</td>
                        <td>{PURPOSE_LABEL[r.purpose] ?? r.purpose}</td>
                        <td>
                          {r.explanation}
                          {r.review_reason && <div className="error">{r.review_reason}</div>}
                        </td>
                        <td>
                          <span
                            className={`badge ${r.accounting_status === 'DA_XAC_NHAN' ? 'green' : 'orange'}`}
                          >
                            {r.accounting_status === 'DA_XAC_NHAN' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </StateBlock>
    </>
  );
}

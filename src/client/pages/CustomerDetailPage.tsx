import { hubPeriodLabel, hubPeriodParam } from '../lib/hubPeriod';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CustomerDetail } from '@shared/types';
import { formatVnDate, formatVnDateTime } from '@shared/datetime';
import { formatVnd } from '@shared/money';
import { formatPhone } from '@shared/phone';
import { STAGE_REQUIREMENTS } from '@shared/stages';
import { ApiError, api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { ActivityModal } from '../components/ActivityModal';
import { CustomerEditModal } from '../components/CustomerEditModal';
import { PaymentForm } from '../components/PaymentForm';
import { Card, OrderStatusBadges, StageBadge, StateBlock } from '../components/ui';
import { useAuth } from '../components/AuthProvider';

export function CustomerDetailPage({ mode }: { mode: 'sales' | 'admin' }) {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const [showActivity, setShowActivity] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const periodParam = hubPeriodParam();
  const navigate = useNavigate();
  const customer = useApi<CustomerDetail>(
    `/api/customers/${id}?_=${reloadKey}&month=${periodParam}`,
  );

  if (customer.loading) return <div className="loading">Đang tải hồ sơ khách hàng…</div>;
  if (customer.error) return <div className="alert-box">{customer.error}</div>;
  if (!customer.data) return null;

  const c = customer.data;
  const deleteCustomer = async () => {
    if (
      !window.confirm(
        `Xóa khách "${c.name}"?\n\nChỉ xóa được khách chưa có đơn hàng, phiếu thu, trả hàng hay dư nợ cũ. Không hoàn tác được.`,
      )
    )
      return;
    try {
      await api.delete(`/api/customers/${c.id}`);
      navigate(`/${mode}/customers`);
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : 'Chưa xóa được khách này');
    }
  };
  const debt = c.debt;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{c.name}</h2>
          <p>
            {formatPhone(c.phone_text)} · {c.province ?? 'Chưa có tỉnh/thành'} ·{' '}
            {c.price_mode === 'CUSTOM'
              ? 'Bảng giá riêng (khách gia công)'
              : (c.tier_name ?? `Cấp "${c.legacy_tier_label ?? 'chưa xác định'}"`)}
          </p>
        </div>
        <div className="actions">
          <Link className="btn" to={`/${mode}/customers`}>
            Quay lại danh sách
          </Link>
          {can('customer.update') && (
            <button className="btn" onClick={() => setShowEdit(true)}>
              Sửa hồ sơ
            </button>
          )}
          {can('customer.delete') && (
            <button
              className="btn"
              style={{ color: '#b42318' }}
              onClick={() => void deleteCustomer()}
            >
              Xóa khách
            </button>
          )}
          {can('activity.create') && (
            <button className="btn primary" onClick={() => setShowActivity(true)}>
              Ghi nhận chăm sóc
            </button>
          )}
          {can('order.create') && (
            <button className="btn" onClick={() => setShowPay(true)}>
              Thu tiền
            </button>
          )}
          {can('order.create') && (
            <Link className="btn dark" to={`/sales/orders/new?customer_id=${c.id}`}>
              Tạo đơn cho khách này
            </Link>
          )}
        </div>
      </div>

      {c.data_quality === 'NEEDS_REVIEW' && (
        <div className="alert-box warn" style={{ marginBottom: 16 }}>
          Hồ sơ cần bổ sung dữ liệu: {c.data_quality_note ?? 'thiếu thông tin CRM sau khi import'}.
        </div>
      )}
      {!c.tier_id && c.price_mode !== 'CUSTOM' && (
        <div className="alert-box" style={{ marginBottom: 16 }}>
          Khách chưa được map sang 1 trong 8 cấp giá nên chưa tạo được đơn. Quản lý cần chọn cấp
          giá.
        </div>
      )}

      <div className="kpis">
        <div className="kpi">
          <div className="label">Giai đoạn</div>
          <div className="value" style={{ fontSize: 18, marginTop: 10 }}>
            <StageBadge stage={c.stage} />
          </div>
          <div className="hint">{STAGE_REQUIREMENTS[c.stage]}</div>
        </div>
        <div className="kpi">
          <div className="label">Công nợ chính thức</div>
          <div className="value">{formatVnd(debt.official_debt)}</div>
          <div className={`hint ${debt.official_exceeded ? 'bad' : 'good'}`}>
            Hạn mức {formatVnd(debt.limit)}
          </div>
        </div>
        <div className="kpi">
          <div className="label">Công nợ dự kiến</div>
          <div className="value">{formatVnd(debt.projected_debt)}</div>
          <div className="hint">
            Chờ ghi nợ {formatVnd(debt.pending_charges)} · Chờ tiền về{' '}
            {formatVnd(debt.pending_cash)}
          </div>
        </div>
        <div className="kpi">
          <div className="label">
            Doanh số {hubPeriodLabel()}
          </div>
          <div className="value">{c.revenue_month ? formatVnd(c.revenue_month) : '_'}</div>
          <div className="hint">
            Doanh số lẻ (tính thưởng): <b>{c.retail_month ? formatVnd(c.retail_month) : '_'}</b>
          </div>
        </div>
        <div className="kpi">
          <div className="label">Chăm sóc tiếp</div>
          <div className="value" style={{ fontSize: 20 }}>
            {formatVnDate(c.next_follow_up_at)}
          </div>
          <div className="hint">Lần mua gần nhất: {formatVnDate(c.last_order_date)}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="stack">
          <Card title="Lịch sử chăm sóc">
            <StateBlock
              loading={false}
              error={null}
              empty={c.activities.length === 0}
              emptyText="Chưa có hoạt động chăm sóc nào."
            >
              <div className="timeline">
                {c.activities.map((activity) => (
                  <div className="event" key={activity.id}>
                    <p>
                      <strong>{activity.result}</strong> · {activity.channel} — {activity.user_name}
                    </p>
                    <small>{formatVnDateTime(activity.created_at)}</small>
                    <div>{activity.content}</div>
                    {activity.next_action && (
                      <small>
                        Bước tiếp theo: {activity.next_action} ({formatVnDate(activity.next_date)})
                      </small>
                    )}
                    {activity.reason_code && <small>Lý do: {activity.reason_code}</small>}
                  </div>
                ))}
              </div>
            </StateBlock>
          </Card>

          <Card title="Đơn hàng" bodyClass="">
            <StateBlock
              loading={false}
              error={null}
              empty={c.orders.length === 0}
              emptyText="Chưa có đơn hàng."
            >
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Ngày</th>
                      <th className="right">Tổng phải thu</th>
                      <th className="right">Còn phải thu</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link to={`/${mode}/orders/${order.id}`} className="rowlink">
                            {order.order_no}
                          </Link>
                        </td>
                        <td className="nowrap">{formatVnDate(order.order_date)}</td>
                        <td className="right nowrap">{formatVnd(order.total_amount)}</td>
                        <td className="right nowrap">{formatVnd(order.remaining_amount)}</td>
                        <td>
                          <OrderStatusBadges
                            approval={order.approval_status}
                            delivery={order.delivery_status}
                            payment={order.payment_status}
                            accounting={order.accounting_status}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </StateBlock>
          </Card>

          <CustomerLedger id={id} reloadKey={reloadKey} />
        </div>

        <div className="stack">
          <Card title="Thông tin khách hàng">
            <div className="stat-row">
              <span className="muted">Mã cũ (Excel)</span>
              <strong>{c.legacy_code ?? '—'}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Sale phụ trách</span>
              <strong>{c.owner_name ?? 'Chưa phân công'}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Nguồn khách</span>
              <strong>{c.source ?? 'Chưa có'}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Địa chỉ</span>
              <strong style={{ textAlign: 'right' }}>{c.address ?? 'Chưa có'}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Chu kỳ tái nhập</span>
              <strong>{c.reorder_cycle_days ? `${c.reorder_cycle_days} ngày` : 'Chưa có'}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Sản phẩm quan tâm</span>
              <strong style={{ textAlign: 'right' }}>{c.interested_products ?? 'Chưa có'}</strong>
            </div>
          </Card>

          <Card title="Chi tiết công nợ">
            <div className="stat-row">
              <span className="muted">Dư nợ cũ đầu kỳ</span>
              <strong>{formatVnd(debt.opening_debt)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Phát sinh đã ghi nợ</span>
              <strong>{formatVnd(debt.posted_charges)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Đã thanh toán (kế toán xác nhận)</span>
              <strong>{formatVnd(debt.confirmed_payments)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Chờ ghi nợ</span>
              <strong>{formatVnd(debt.pending_charges)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Chờ tiền về</span>
              <strong>{formatVnd(debt.pending_cash)}</strong>
            </div>
            {debt.pending_cash > 0 && can('order.accounting.confirm') && (
              <div className="stat-row">
                <span className="muted">Có khoản tiền chờ kế toán xác nhận</span>
                <Link className="btn sm primary" to={`${window.location.pathname.startsWith('/admin') ? '/admin' : '/sales'}/bills`}>
                  Mở Kho bill để xác nhận
                </Link>
              </div>
            )}
            <div className="stat-row">
              <span className="muted">Thu thừa (credit)</span>
              <strong>{formatVnd(debt.credit_balance)}</strong>
            </div>
          </Card>

          <Card title="Việc đang mở">
            <StateBlock
              loading={false}
              error={null}
              empty={c.tasks.filter((t) => t.status === 'OPEN').length === 0}
              emptyText="Không còn việc mở."
            >
              <div className="timeline">
                {c.tasks
                  .filter((task) => task.status === 'OPEN')
                  .map((task) => (
                    <div className="event" key={task.id}>
                      <p>
                        <strong>{task.title}</strong>
                      </p>
                      <small>
                        Hạn {formatVnDate(task.due_at)} {task.overdue ? '· ĐÃ QUÁ HẠN' : ''}
                      </small>
                    </div>
                  ))}
              </div>
            </StateBlock>
          </Card>
        </div>
      </div>

      {showActivity && (
        <ActivityModal
          customerId={c.id}
          customerName={c.name}
          currentStage={c.stage}
          tierName={
            c.price_mode === 'CUSTOM'
              ? 'Bảng giá riêng'
              : (c.tier_name ?? c.legacy_tier_label ?? null)
          }
          phone={c.phone_text}
          officialDebt={debt.official_debt}
          onClose={() => setShowActivity(false)}
          onSaved={customer.reload}
        />
      )}

      {showPay && (
        <PaymentForm
          order={{
            id: '',
            order_no: '',
            customer_id: c.id,
            customer_name: c.name,
            remaining_amount: 0,
          }}
          onClose={() => setShowPay(false)}
          onDone={() => {
            setShowPay(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {showEdit && (
        <CustomerEditModal
          customer={c}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}

interface LedgerEntry {
  date: string;
  kind: 'DAU_KY' | 'GHI_NO' | 'THANH_TOAN' | 'DIEU_CHINH' | 'TRA_HANG';
  ref: string;
  note: string | null;
  amount: number;
  confirmed: boolean;
  balance: number;
}

const LEDGER_KIND: Record<LedgerEntry['kind'], string> = {
  DAU_KY: 'Dư nợ đầu kỳ',
  GHI_NO: 'Ghi nợ (đơn hàng)',
  THANH_TOAN: 'Thanh toán',
  DIEU_CHINH: 'Điều chỉnh',
  TRA_HANG: 'Trả hàng',
};

/** 13/10 chị: lịch sử giao dịch công nợ của khách — mọi lần ghi nợ, trả tiền, trả hàng theo ngày, kèm dư nợ sau từng lần. */
function CustomerLedger({ id, reloadKey }: { id: string; reloadKey: number }) {
  const ledger = useApi<LedgerEntry[]>(`/api/customers/${id}/ledger?_=${reloadKey}`);
  const rows = [...(ledger.data ?? [])].reverse(); // mới nhất lên đầu
  return (
    <Card
      title="Lịch sử giao dịch"
      bodyClass=""
      action={
        <a className="btn sm" href={`/print/statement/${id}`} target="_blank" rel="noreferrer">
          Đối chiếu công nợ (in / gửi khách)
        </a>
      }
    >
      <StateBlock
        loading={ledger.loading}
        error={ledger.error}
        empty={rows.length === 0}
        emptyText="Chưa có giao dịch nào."
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Loại</th>
                <th>Chứng từ</th>
                <th className="right">Tăng nợ</th>
                <th className="right">Giảm nợ</th>
                <th className="right">Dư nợ sau</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={r.confirmed ? '' : 'muted'}>
                  <td className="nowrap">{r.date ? formatVnDate(r.date) : '—'}</td>
                  <td>
                    {LEDGER_KIND[r.kind]}
                    {!r.confirmed && (
                      <div>
                        <span className="badge orange">Chờ kế toán xác nhận</span>
                      </div>
                    )}
                  </td>
                  <td>
                    {r.ref}
                    {r.note && <div className="muted small">{r.note}</div>}
                  </td>
                  <td className="right nowrap">{r.amount > 0 ? formatVnd(r.amount) : ''}</td>
                  <td className="right nowrap">{r.amount < 0 ? formatVnd(-r.amount) : ''}</td>
                  <td className="right nowrap">
                    {r.confirmed ? (
                      <strong>{formatVnd(r.balance)}</strong>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateBlock>
    </Card>
  );
}

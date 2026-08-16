import type { CeoDashboard } from '@shared/types';
import { formatVnd } from '@shared/money';
import { useApi } from '../../lib/hooks';
import { Card, Kpi, StateBlock } from '../../components/ui';
import { ApprovalTable } from '../OrdersPage';

export function CeoDashboardPage() {
  const dashboard = useApi<CeoDashboard>('/api/dashboards/ceo');
  const data = dashboard.data;
  const quality = data?.data_quality;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Bàn điều hành CEO</h2>
          <p>Doanh số, thu tiền, công nợ, quyết định cần xử lý và độ tin cậy của nguồn dữ liệu.</p>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="Doanh số tháng" value={formatVnd(data?.revenue_month ?? 0)} hint="Đơn đã duyệt" />
        <Kpi label="Thu tiền trong tháng" value={formatVnd(data?.collected_month ?? 0)} hint="Kế toán đã xác nhận" />
        <Kpi label="Công nợ chính thức" value={formatVnd(data?.official_debt ?? 0)} hint="Dùng cho báo cáo" />
        <Kpi
          label="Công nợ dự kiến"
          value={formatVnd(data?.projected_debt ?? 0)}
          hint={`Chờ ghi nợ ${formatVnd(data?.pending_charges ?? 0)} · Chờ tiền về ${formatVnd(data?.pending_cash ?? 0)}`}
        />
        <Kpi
          label="Tỷ lệ khách có đơn"
          value={data ? `${data.order_rate}%` : '—'}
          hint={data ? `${data.customers_with_orders}/${data.customers_total} khách` : ''}
        />
      </div>

      <div className="grid-2">
        <Card title="Quyết định cần xử lý">
          <StateBlock
            loading={dashboard.loading}
            error={dashboard.error}
            empty={(data?.decisions ?? []).length === 0}
            emptyText="Không có quyết định nào đang treo."
          >
            <div className="timeline">
              {(data?.decisions ?? []).map((alert) => (
                <div className="event" key={alert.id}>
                  <p>
                    <strong>{alert.label}</strong>{' '}
                    <span className={`badge ${alert.severity === 'CRITICAL' ? 'red' : 'orange'}`}>
                      {alert.severity}
                    </span>
                  </p>
                  <small>{alert.message}</small>
                </div>
              ))}
            </div>
          </StateBlock>
        </Card>

        <Card title="Chất lượng nguồn dữ liệu">
          <div className="stat-row">
            <span className="muted">Khách cần kiểm tra dữ liệu</span>
            <strong>{quality?.customers_needs_review ?? 0}</strong>
          </div>
          <div className="stat-row">
            <span className="muted">Mã hàng thiếu giá</span>
            <strong>{quality?.products_missing_price ?? 0}</strong>
          </div>
          <div className="stat-row">
            <span className="muted">Đơn cần rà soát</span>
            <strong>{quality?.orders_needs_review ?? 0}</strong>
          </div>
          <div className="stat-row">
            <span className="muted">Phiếu thu cần rà soát</span>
            <strong>{quality?.payments_needs_review ?? 0}</strong>
          </div>
          <div className="stat-row">
            <span className="muted">Lần import gần nhất</span>
            <strong>
              {quality?.last_import_status ?? 'Chưa import'}{' '}
              {quality?.last_import_reconciled === false && <span className="badge red">Lệch đối soát</span>}
            </strong>
          </div>
        </Card>
      </div>

      <div style={{ height: 18 }} />

      <Card title={`Yêu cầu chờ duyệt (${data?.pending_approvals.length ?? 0})`} bodyClass="">
        <StateBlock
          loading={dashboard.loading}
          error={dashboard.error}
          empty={(data?.pending_approvals ?? []).length === 0}
          emptyText="Không có yêu cầu nào chờ duyệt."
        >
          <ApprovalTable approvals={data?.pending_approvals ?? []} onDecided={dashboard.reload} />
        </StateBlock>
      </Card>
    </>
  );
}

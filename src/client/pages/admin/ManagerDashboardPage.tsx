import { Link } from 'react-router-dom';
import type { ManagerDashboard } from '@shared/types';
import { formatVnd } from '@shared/money';
import { useApi } from '../../lib/hooks';
import { api } from '../../lib/api';
import { Card, Kpi, StateBlock, useToast } from '../../components/ui';

export function ManagerDashboardPage() {
  const toast = useToast();
  const dashboard = useApi<ManagerDashboard>('/api/dashboards/manager');
  const data = dashboard.data;

  const refreshAlerts = async () => {
    try {
      const result = await api.post<{ opened: number; resolved: number }>('/api/alerts/refresh');
      toast.success(`Đã cập nhật cảnh báo: mở mới ${result.data.opened}, đóng ${result.data.resolved}`);
      dashboard.reload();
    } catch {
      toast.error('Không chạy được rule cảnh báo');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Điều hành đội ngũ</h2>
          <p>KPI từng nhân viên, khách chưa phân công, đơn chờ duyệt và cảnh báo cần xử lý.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={refreshAlerts}>
            Chạy lại cảnh báo
          </button>
          <Link className="btn primary" to="/admin/orders">
            Xử lý đơn chờ duyệt
          </Link>
        </div>
      </div>

      <div className="kpis">
        <Kpi
          label="Khách chưa phân công"
          value={data?.unassigned_customers ?? '—'}
          hint={data?.unassigned_customers ? 'Cần phân bổ ngay' : 'Đã phân hết'}
          tone={data?.unassigned_customers ? 'warn' : 'good'}
        />
        <Kpi
          label="Đơn/yêu cầu chờ duyệt"
          value={data?.pending_approvals ?? '—'}
          hint="Bao gồm giá thoả thuận và vượt hạn mức"
          tone={data?.pending_approvals ? 'warn' : 'good'}
        />
        <Kpi
          label="Khách quá hạn chăm sóc"
          value={data?.overdue_customers ?? '—'}
          hint="Lịch chăm sóc đã trễ"
          tone={data?.overdue_customers ? 'bad' : 'good'}
        />
        <Kpi
          label="Hồ sơ cần kiểm tra dữ liệu"
          value={data?.needs_review_customers ?? '—'}
          hint="Thiếu nguồn, tỉnh, cấp giá…"
        />
      </div>

      <div className="grid-2">
        <Card title="Hiệu suất từng nhân viên" bodyClass="">
          <StateBlock
            loading={dashboard.loading}
            error={dashboard.error}
            empty={(data?.reps ?? []).length === 0}
            emptyText="Chưa có nhân viên Sale nào."
          >
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th className="right">Khách</th>
                    <th className="right">Việc mở</th>
                    <th className="right">Quá hạn</th>
                    <th className="right">Chăm sóc 30 ngày</th>
                    <th className="right">Đơn tháng</th>
                    <th className="right">Doanh số tháng</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.reps ?? []).map((rep) => (
                    <tr key={rep.user_id}>
                      <td>
                        <strong>{rep.display_name}</strong>
                        <div className="muted">{rep.customers_with_orders} khách đã có đơn</div>
                      </td>
                      <td className="right">{rep.customers}</td>
                      <td className="right">{rep.open_tasks}</td>
                      <td className="right" style={{ color: rep.overdue_tasks ? 'var(--red)' : undefined }}>
                        {rep.overdue_tasks}
                      </td>
                      <td className="right">{rep.activities_30d}</td>
                      <td className="right">{rep.orders_month}</td>
                      <td className="right nowrap">{formatVnd(rep.revenue_month)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StateBlock>
        </Card>

        <Card title="Cảnh báo cần xử lý">
          <StateBlock
            loading={dashboard.loading}
            error={dashboard.error}
            empty={(data?.alerts ?? []).length === 0}
            emptyText="Không có cảnh báo nào."
          >
            <div className="timeline">
              {(data?.alerts ?? []).map((alert) => (
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
      </div>
    </>
  );
}

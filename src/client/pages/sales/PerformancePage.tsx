import type { SalesPerformance } from '@shared/types';
import { STAGE_LABELS } from '@shared/enums';
import { formatVnd } from '@shared/money';
import { useApi } from '../../lib/hooks';
import { Card, Kpi } from '../../components/ui';

export function PerformancePage() {
  const perf = useApi<SalesPerformance>('/api/dashboards/me');
  const data = perf.data;
  const maxStage = Math.max(1, ...(data?.by_stage ?? []).map((s) => s.count));

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Kết quả cá nhân</h2>
          <p>Đánh giá dựa trên hành động chăm sóc và kết quả bán hàng thực tế trong phạm vi khách của bạn.</p>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="Khách phụ trách" value={data?.customers ?? '—'} hint="Tổng danh sách" />
        <Kpi
          label="Tỷ lệ có đơn"
          value={data ? `${data.order_rate}%` : '—'}
          hint={data ? `${data.customers_with_orders} khách đã nhập hàng` : ''}
        />
        <Kpi label="Doanh số tháng" value={formatVnd(data?.revenue_month ?? 0)} hint="Đơn đã duyệt" />
        <Kpi label="Doanh số luỹ kế" value={formatVnd(data?.revenue_total ?? 0)} hint="Toàn bộ đơn đã duyệt" />
      </div>

      <div className="grid-2">
        <Card title="Phân bố khách theo giai đoạn">
          {(data?.by_stage ?? []).map((row) => (
            <div key={row.stage} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>{STAGE_LABELS[row.stage]}</strong>
                <span>{row.count} khách</span>
              </div>
              <div className="progress">
                <i style={{ width: `${Math.max(4, (row.count / maxStage) * 100)}%` }} />
              </div>
            </div>
          ))}
          {(data?.by_stage ?? []).length === 0 && <div className="empty">Chưa có khách hàng.</div>}
        </Card>

        <Card title="Chỉ số cần cải thiện">
          <div className="stat-row">
            <span className="muted">Hoạt động chăm sóc trong tháng</span>
            <strong>{data?.activities_month ?? 0}</strong>
          </div>
          <div className="stat-row">
            <span className="muted">Việc đang mở</span>
            <strong>{data?.open_tasks ?? 0}</strong>
          </div>
          <div className="stat-row">
            <span className="muted">Việc quá hạn</span>
            <strong style={{ color: data?.overdue_tasks ? 'var(--red)' : undefined }}>
              {data?.overdue_tasks ?? 0}
            </strong>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            Không để lịch quá hạn: mỗi khách còn mở đều phải có ngày chăm sóc tiếp. Ưu tiên nhóm đã đủ điều kiện và
            có cửa hàng để tăng tỷ lệ đơn nhập đầu.
          </p>
        </Card>
      </div>
    </>
  );
}

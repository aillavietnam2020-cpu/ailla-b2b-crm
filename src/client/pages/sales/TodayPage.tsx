import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AlertItem, SalesPerformance, TaskItem } from '@shared/types';
import { formatVnDate } from '@shared/datetime';
import { formatCompactVnd } from '@shared/money';
import { useApi } from '../../lib/hooks';
import { api } from '../../lib/api';
import { Card, Kpi, StateBlock, initialsOf, shortName, useToast } from '../../components/ui';
import { useAuth } from '../../components/AuthProvider';

type Queue = 'today' | 'overdue' | 'open';

export function TodayPage() {
  const { me } = useAuth();
  const toast = useToast();
  const [queue, setQueue] = useState<Queue>('today');

  const tasks = useApi<TaskItem[]>(`/api/tasks?filter=${queue}`);
  const performance = useApi<SalesPerformance>('/api/dashboards/me');
  const alerts = useApi<AlertItem[]>('/api/alerts');

  const completeTask = async (task: TaskItem) => {
    try {
      await api.post(`/api/tasks/${task.id}/complete`, {});
      toast.success('Đã đánh dấu hoàn thành');
      tasks.reload();
      performance.reload();
    } catch {
      toast.error('Không cập nhật được công việc');
    }
  };

  const stats = performance.data;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Chào {shortName(me?.user.display_name ?? '')}</h2>
          <p>Danh sách cần xử lý hôm nay · {formatVnDate(new Date().toISOString())}</p>
        </div>
        <div className="actions">
          <Link className="btn" to="/sales/customers?new=1">
            Thêm khách hàng
          </Link>
          <Link className="btn primary" to="/sales/orders/new">
            Tạo đơn hàng
          </Link>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="Việc cần xử lý" value={stats?.open_tasks ?? '—'} hint="Theo lịch chăm sóc" />
        <Kpi
          label="Việc quá hạn"
          value={stats?.overdue_tasks ?? '—'}
          hint={stats?.overdue_tasks ? 'Xử lý ngay hôm nay' : 'Không có việc quá hạn'}
          tone={stats?.overdue_tasks ? 'bad' : 'good'}
        />
        <Kpi
          label="Khách có đơn"
          value={stats ? `${stats.customers_with_orders}/${stats.customers}` : '—'}
          hint={stats ? `Tỷ lệ có đơn ${stats.order_rate}%` : ''}
        />
        <Kpi
          label="Doanh số tháng"
          value={stats ? formatCompactVnd(stats.revenue_month) : '—'}
          hint="Đơn đã duyệt trong tháng"
        />
      </div>

      <div className="grid-2">
        <Card
          title="Danh sách ưu tiên"
          bodyClass=""
          action={
            <div className="actions">
              {(
                [
                  ['today', 'Đến hạn hôm nay'],
                  ['overdue', 'Quá hạn'],
                  ['open', 'Tất cả'],
                ] as Array<[Queue, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={`btn sm ${queue === key ? 'dark' : ''}`}
                  onClick={() => setQueue(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <StateBlock
            loading={tasks.loading}
            error={tasks.error}
            empty={(tasks.data ?? []).length === 0}
            emptyText="Không có việc nào trong nhóm này."
          >
            {(tasks.data ?? []).map((task) => (
              <div className="list-row" key={task.id}>
                <div className="initial">{initialsOf(task.customer_name ?? 'KH')}</div>
                <div className="list-main">
                  <strong>{task.customer_name ?? 'Không gắn khách'}</strong>
                  <small>{task.title}</small>
                </div>
                <div className="col-hide">
                  <span className={`badge ${task.overdue ? 'red' : 'blue'}`}>
                    {task.overdue ? 'Quá hạn' : 'Hạn hôm nay'}
                  </span>
                </div>
                <div className="col-hide muted">{formatVnDate(task.due_at)}</div>
                <div className="actions">
                  {task.customer_id && (
                    <Link className="btn sm" to={`/sales/customers/${task.customer_id}`}>
                      Mở hồ sơ
                    </Link>
                  )}
                  <button className="btn sm dark" onClick={() => completeTask(task)}>
                    Xong
                  </button>
                </div>
              </div>
            ))}
          </StateBlock>
        </Card>

        <div className="stack">
          <Card title="Cảnh báo của tôi">
            <StateBlock
              loading={alerts.loading}
              error={alerts.error}
              empty={(alerts.data ?? []).length === 0}
              emptyText="Không có cảnh báo."
            >
              <div className="timeline">
                {(alerts.data ?? []).slice(0, 8).map((alert) => (
                  <div className="event" key={alert.id}>
                    <p>
                      <strong>{alert.label}</strong>
                    </p>
                    <small>{alert.message}</small>
                  </div>
                ))}
              </div>
            </StateBlock>
          </Card>

          <Card title="Việc cần nhớ">
            <div className="timeline">
              <div className="event">
                <p>
                  <strong>Lead mới: gọi trong 15 phút</strong>
                </p>
                <small>Tốc độ phản hồi ảnh hưởng trực tiếp tỷ lệ chốt.</small>
              </div>
              <div className="event">
                <p>
                  <strong>Mỗi lần liên hệ đều phải có kết quả</strong>
                </p>
                <small>Ghi nội dung, bước tiếp theo và ngày chăm sóc tiếp.</small>
              </div>
              <div className="event">
                <p>
                  <strong>Đơn đầu chưa phải kết thúc</strong>
                </p>
                <small>Theo dõi bán ra để tạo đơn tái nhập đúng chu kỳ.</small>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

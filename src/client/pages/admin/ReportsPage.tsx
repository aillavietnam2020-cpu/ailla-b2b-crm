import { useState } from 'react';
import { formatCompactVnd, formatVnd } from '@shared/money';
import { vnDate } from '@shared/datetime';
import { STAGE_LABELS, type CustomerStage } from '@shared/enums';
import { useApi } from '../../lib/hooks';
import { Card, PageHead, StateBlock } from '../../components/ui';
import { BarChart, DonutChart, FunnelChart, StatCard, CHART_COLORS } from '../../components/charts';

interface SalesDashboardData {
  period: string;
  overview: {
    revenue: number;
    orders: number;
    aov: number;
    customers_with_orders: number;
    new_first_order_customers: number;
    new_contacted_customers: number;
    close_rate: number;
    repeat_rate: number;
    overdue_reorder_customers: number;
  };
  by_sale: Array<{
    user_id: string | null;
    display_name: string;
    revenue: number;
    revenue_new_customers: number;
    revenue_old_customers: number;
    orders: number;
    aov: number;
    new_customers: number;
    collected: number;
  }>;
  by_product_group: Array<{
    group_name: string;
    revenue: number;
    quantity: number;
    order_lines: number;
    share: number;
    revenue_total: number;
  }>;
  funnel: Array<{ stage: string; customers: number; share: number; revenue_total: number }>;
}

/**
 * Dashboard kinh doanh dựng theo sheet DASHBOARD_SALE của công ty:
 * A tổng quan kỳ · B KPI từng sale · C nhóm sản phẩm bán chạy · D phễu khách hàng.
 */
export function ReportsPage() {
  const [period, setPeriod] = useState(vnDate().slice(0, 7));
  const report = useApi<SalesDashboardData>(`/api/dashboards/sales?period=${period}`);
  const data = report.data;

  return (
    <>
      <PageHead
        title="Dashboard kinh doanh"
        subtitle="Doanh thu đã trừ chiết khấu, không tính phí vận chuyển; chỉ tính đơn đã duyệt."
        actions={
          <input
            type="month"
            className="select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        }
      />

      <StateBlock loading={report.loading} error={report.error}>
        {data && (
          <>
            {/* A. TỔNG QUAN CÔNG TY TRONG KỲ */}
            <div className="stat-grid">
              <StatCard
                label="Doanh thu trong kỳ"
                value={formatCompactVnd(data.overview.revenue)}
                hint="Đã trừ chiết khấu, không tính phí ship"
                color={CHART_COLORS[0]}
              />
              <StatCard
                label="Số đơn trong kỳ"
                value={data.overview.orders}
                hint={`${data.overview.customers_with_orders} khách phát sinh đơn`}
                color={CHART_COLORS[1]}
              />
              <StatCard
                label="Giá trị đơn trung bình"
                value={formatCompactVnd(data.overview.aov)}
                hint="Doanh thu chia số đơn"
                color={CHART_COLORS[2]}
              />
              <StatCard
                label="Khách chốt đơn đầu tiên"
                value={data.overview.new_first_order_customers}
                hint={`${data.overview.new_contacted_customers} khách mới tiếp cận`}
                color={CHART_COLORS[3]}
              />
              <StatCard
                label="Tỷ lệ chốt"
                value={`${data.overview.close_rate}%`}
                hint="Khách chốt đơn đầu / khách mới tiếp cận"
                color={CHART_COLORS[4]}
              />
              <StatCard
                label="Khách cũ tái đơn"
                value={`${data.overview.repeat_rate}%`}
                hint="Đã mua trước kỳ và quay lại trong kỳ"
                color={CHART_COLORS[5]}
              />
              <StatCard
                label="Khách quá hạn tái mua"
                value={data.overview.overdue_reorder_customers}
                hint="Quá chu kỳ riêng của từng khách"
                color={CHART_COLORS[8]}
                trend={
                  data.overview.overdue_reorder_customers > 0
                    ? { text: 'Cần gọi lại ngay', good: false }
                    : { text: 'Không có khách bỏ quên' }
                }
              />
            </div>

            <div style={{ height: 18 }} />

            {/* B. KPI HIỆU SUẤT TỪNG SALE */}
            <div className="grid-2">
              <Card title="Doanh thu theo nhân viên">
                {data.by_sale.length === 0 ? (
                  <div className="empty">Kỳ này chưa có số liệu.</div>
                ) : (
                  <BarChart
                    format={formatCompactVnd}
                    data={data.by_sale.map((row) => ({
                      label: row.display_name,
                      sublabel: `${row.orders} đơn · AOV ${formatCompactVnd(row.aov)}`,
                      value: row.revenue,
                    }))}
                  />
                )}
              </Card>

              <Card title="Cơ cấu doanh thu theo nhóm sản phẩm">
                <DonutChart
                  centerLabel="doanh thu luỹ kế"
                  format={formatCompactVnd}
                  slices={data.by_product_group
                    .slice(0, 8)
                    .map((g) => ({ label: g.group_name, value: g.revenue_total }))}
                />
              </Card>
            </div>

            <div style={{ height: 18 }} />

            <Card title="Chi tiết theo nhân viên" bodyClass="">
              <div className="table-wrap">
                <table className="data wide">
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th className="right">Doanh thu</th>
                      <th className="right">DT khách mới</th>
                      <th className="right">DT khách cũ</th>
                      <th className="right">Số đơn</th>
                      <th className="right">AOV</th>
                      <th className="right">Khách mới</th>
                      <th className="right">Tiền đã thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_sale.map((row) => (
                      <tr key={row.user_id ?? row.display_name}>
                        <td>
                          <strong>{row.display_name}</strong>
                        </td>
                        <td className="right nowrap">{formatVnd(row.revenue)}</td>
                        <td className="right nowrap">{formatVnd(row.revenue_new_customers)}</td>
                        <td className="right nowrap">{formatVnd(row.revenue_old_customers)}</td>
                        <td className="right">{row.orders}</td>
                        <td className="right nowrap">{formatVnd(row.aov)}</td>
                        <td className="right">{row.new_customers}</td>
                        <td className="right nowrap">{formatVnd(row.collected)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div style={{ height: 18 }} />

            <div className="grid-2">
              {/* C. NHÓM SẢN PHẨM BÁN CHẠY */}
              <Card title="Nhóm sản phẩm bán chạy (luỹ kế)">
                <BarChart
                  format={formatCompactVnd}
                  data={data.by_product_group.slice(0, 9).map((g) => ({
                    label: g.group_name,
                    sublabel: `${g.quantity} sản phẩm · ${g.share}% doanh thu kỳ`,
                    value: g.revenue_total,
                  }))}
                />
              </Card>

              {/* D. PHỄU KHÁCH HÀNG */}
              <Card title="Phễu khách hàng">
                <FunnelChart
                  steps={data.funnel.map((row) => ({
                    label: STAGE_LABELS[row.stage as CustomerStage] ?? row.stage,
                    value: row.customers,
                    hint: `${row.share}% danh sách · doanh số luỹ kế ${formatCompactVnd(row.revenue_total)}`,
                  }))}
                />
              </Card>
            </div>
          </>
        )}
      </StateBlock>
    </>
  );
}

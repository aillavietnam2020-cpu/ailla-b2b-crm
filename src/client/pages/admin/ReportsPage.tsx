import { useState } from 'react';
import { formatCompactVnd, formatVnd } from '@shared/money';
import { vnDate } from '@shared/datetime';
import { STAGE_LABELS, type CustomerStage } from '@shared/enums';
import { useApi } from '../../lib/hooks';
import { Card, Kpi, PageHead, StateBlock } from '../../components/ui';

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

  const maxGroupRevenue = Math.max(1, ...(data?.by_product_group ?? []).map((g) => g.revenue_total));

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
            <div className="kpi-grid">
              <Kpi label="Doanh thu trong kỳ" value={formatCompactVnd(data.overview.revenue)} hint="Đã trừ chiết khấu" />
              <Kpi label="Số đơn trong kỳ" value={data.overview.orders} hint="Đơn đã duyệt" />
              <Kpi label="Giá trị đơn trung bình" value={formatCompactVnd(data.overview.aov)} hint="Doanh thu / số đơn" />
              <Kpi
                label="Khách phát sinh đơn"
                value={data.overview.customers_with_orders}
                hint={`${data.overview.new_first_order_customers} khách chốt đơn đầu tiên`}
              />
              <Kpi
                label="Tỷ lệ chốt trong kỳ"
                value={`${data.overview.close_rate}%`}
                hint={`${data.overview.new_contacted_customers} khách mới tiếp cận`}
              />
              <Kpi
                label="Tỷ lệ khách cũ tái đơn"
                value={`${data.overview.repeat_rate}%`}
                hint="Khách đã mua trước kỳ, có đơn trong kỳ"
              />
              <Kpi
                label="Khách quá hạn tái mua"
                value={data.overview.overdue_reorder_customers}
                hint="Quá chu kỳ riêng của từng khách"
                tone={data.overview.overdue_reorder_customers > 0 ? 'warn' : undefined}
              />
            </div>

            <div style={{ height: 18 }} />

            {/* B. KPI HIỆU SUẤT TỪNG SALE */}
            <Card title="Hiệu suất từng sale trong kỳ" bodyClass="">
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
                      <th className="right">Khách mới tiếp cận</th>
                      <th className="right">Tiền đã thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_sale.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty">
                          Kỳ này chưa có số liệu.
                        </td>
                      </tr>
                    ) : (
                      data.by_sale.map((row) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <div style={{ height: 18 }} />

            <div className="grid-2">
              {/* C. NHÓM SẢN PHẨM BÁN CHẠY */}
              <Card title="Nhóm sản phẩm bán chạy" bodyClass="">
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Nhóm sản phẩm</th>
                        <th className="right">Doanh thu kỳ</th>
                        <th className="right">Sản lượng</th>
                        <th className="right">Tỷ trọng</th>
                        <th className="right">Luỹ kế</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_product_group.map((group) => (
                        <tr key={group.group_name}>
                          <td>
                            <strong>{group.group_name}</strong>
                            <div className="progress" style={{ background: '#eaecf0', marginTop: 4 }}>
                              <i
                                style={{
                                  width: `${Math.max(2, (group.revenue_total / maxGroupRevenue) * 100)}%`,
                                  background: 'var(--pink)',
                                }}
                              />
                            </div>
                          </td>
                          <td className="right nowrap">{formatVnd(group.revenue)}</td>
                          <td className="right">{group.quantity}</td>
                          <td className="right">{group.share}%</td>
                          <td className="right nowrap">{formatCompactVnd(group.revenue_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* D. PHỄU KHÁCH HÀNG */}
              <Card title="Phễu khách hàng" bodyClass="">
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Giai đoạn</th>
                        <th className="right">Số khách</th>
                        <th className="right">Tỷ trọng</th>
                        <th className="right">Doanh số luỹ kế</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.funnel.map((row) => (
                        <tr key={row.stage}>
                          <td>{STAGE_LABELS[row.stage as CustomerStage] ?? row.stage}</td>
                          <td className="right">{row.customers}</td>
                          <td className="right">{row.share}%</td>
                          <td className="right nowrap">{formatCompactVnd(row.revenue_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}
      </StateBlock>
    </>
  );
}

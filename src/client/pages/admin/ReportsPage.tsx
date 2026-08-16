import { useState } from 'react';
import { formatCompactVnd, formatVnd } from '@shared/money';
import { vnDate } from '@shared/datetime';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../components/AuthProvider';
import { Card, ErrorBox, Kpi, PageHead, StateBlock } from '../../components/ui';
import { ApiError, api } from '../../lib/api';

interface SalesRow {
  user_id: string | null;
  display_name: string;
  orders: number;
  gross_revenue: number;
  gift_value: number;
  discount_total: number;
  collected: number;
  new_customers: number;
  commission: number;
}

interface SalesReport {
  period: string;
  from: string;
  to: string;
  basis: 'REVENUE' | 'COLLECTED';
  commission_percent: number;
  rows: SalesRow[];
  totals: Omit<SalesRow, 'user_id' | 'display_name'>;
  by_month: Array<{ month: string; gross_revenue: number; collected: number; orders: number }>;
}

const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

/** Doanh số theo tháng/năm và thưởng ước tính cho từng nhân viên Sale. */
export function ReportsPage() {
  const { can } = useAuth();
  const today = vnDate();
  const [period, setPeriod] = useState(today.slice(0, 7));
  const [savingPercent, setSavingPercent] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const report = useApi<SalesReport>(`/api/dashboards/sales?period=${period}&_=${reloadKey}`);
  const data = report.data;
  const isYear = /^\d{4}$/.test(period);
  const canEditSettings = can('settings.manage');

  async function saveCommission(percent: number, basis: 'REVENUE' | 'COLLECTED') {
    setSavingPercent(true);
    setSettingsError(null);
    try {
      await api.patch('/api/settings', { 'commission.percent': percent, 'commission.basis': basis });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : 'Không lưu được thiết lập');
    } finally {
      setSavingPercent(false);
    }
  }

  const maxRevenue = Math.max(1, ...(data?.by_month ?? []).map((m) => m.gross_revenue));

  return (
    <>
      <PageHead
        title="Doanh số và thưởng"
        subtitle="Doanh số đơn đã duyệt, tiền thực thu và thưởng ước tính theo từng nhân viên."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="month"
              value={isYear ? `${period}-01` : period}
              onChange={(e) => setPeriod(e.target.value)}
              className="select"
            />
            <button className="btn" onClick={() => setPeriod(period.slice(0, 4))}>
              Cả năm {period.slice(0, 4)}
            </button>
          </div>
        }
      />

      <ErrorBox message={settingsError} />

      <StateBlock loading={report.loading} error={report.error}>
        {data && (
          <>
            <div className="kpi-grid">
              <Kpi
                label={isYear ? `Doanh số năm ${period}` : `Doanh số ${MONTH_NAMES[Number(period.slice(5, 7)) - 1]}`}
                value={formatCompactVnd(data.totals.gross_revenue)}
                hint={`${data.totals.orders} đơn đã duyệt`}
              />
              <Kpi
                label="Tiền đã thu"
                value={formatCompactVnd(data.totals.collected)}
                hint="Kế toán đã xác nhận"
              />
              <Kpi
                label="Chiết khấu + trừ thưởng"
                value={formatCompactVnd(data.totals.discount_total)}
                hint="Giảm trực tiếp trên đơn"
              />
              <Kpi
                label="Giá trị hàng tặng"
                value={formatCompactVnd(data.totals.gift_value)}
                hint="Tính theo giá chuẩn của cấp khách"
              />
              <Kpi
                label="Thưởng ước tính"
                value={formatCompactVnd(data.totals.commission)}
                hint={`${data.commission_percent}% ${data.basis === 'COLLECTED' ? 'tiền đã thu' : 'doanh số'}`}
              />
            </div>

            <div className="grid-2" style={{ marginTop: 18 }}>
              <Card title="Kết quả từng nhân viên" bodyClass="">
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th className="right">Đơn</th>
                        <th className="right">Doanh số</th>
                        <th className="right">Đã thu</th>
                        <th className="right">Khách mới</th>
                        <th className="right">Thưởng ước tính</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="empty">
                            Kỳ này chưa có số liệu.
                          </td>
                        </tr>
                      ) : (
                        data.rows.map((row) => (
                          <tr key={row.user_id ?? row.display_name}>
                            <td>
                              <strong>{row.display_name}</strong>
                            </td>
                            <td className="right">{row.orders}</td>
                            <td className="right nowrap">{formatVnd(row.gross_revenue)}</td>
                            <td className="right nowrap">{formatVnd(row.collected)}</td>
                            <td className="right">{row.new_customers}</td>
                            <td className="right nowrap">
                              <strong>{formatVnd(row.commission)}</strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
                <Card title={`Doanh số 12 tháng năm ${period.slice(0, 4)}`}>
                  {data.by_month.length === 0 ? (
                    <div className="empty">Chưa có đơn nào trong năm này.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {data.by_month.map((m) => (
                        <div key={m.month}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span>{MONTH_NAMES[Number(m.month.slice(5, 7)) - 1]}</span>
                            <strong>{formatCompactVnd(m.gross_revenue)}</strong>
                          </div>
                          <div className="progress" style={{ background: '#eaecf0' }}>
                            <i
                              style={{
                                width: `${Math.max(3, (m.gross_revenue / maxRevenue) * 100)}%`,
                                background: 'var(--pink)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card title="Cách tính thưởng">
                  <p className="muted">
                    Thưởng ước tính = tỷ lệ % × căn cứ tính. Đây là con số theo dõi nội bộ, không thay
                    cho bảng lương chính thức.
                  </p>
                  {canEditSettings ? (
                    <CommissionSetting
                      percent={data.commission_percent}
                      basis={data.basis}
                      busy={savingPercent}
                      onSave={saveCommission}
                    />
                  ) : (
                    <p>
                      Đang áp dụng: <strong>{data.commission_percent}%</strong> trên{' '}
                      {data.basis === 'COLLECTED' ? 'tiền đã thu' : 'doanh số đơn đã duyệt'}. Chỉ CEO
                      được đổi tỷ lệ này.
                    </p>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </StateBlock>
    </>
  );
}

function CommissionSetting({
  percent,
  basis,
  busy,
  onSave,
}: {
  percent: number;
  basis: 'REVENUE' | 'COLLECTED';
  busy: boolean;
  onSave: (percent: number, basis: 'REVENUE' | 'COLLECTED') => void;
}) {
  const [value, setValue] = useState(String(percent));
  const [mode, setMode] = useState(basis);

  return (
    <div className="form-grid" style={{ marginTop: 10 }}>
      <div className="field">
        <label>Tỷ lệ thưởng (%)</label>
        <input type="number" min={0} step={0.1} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <div className="field">
        <label>Tính trên</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as 'REVENUE' | 'COLLECTED')}>
          <option value="COLLECTED">Tiền đã thu (an toàn dòng tiền)</option>
          <option value="REVENUE">Doanh số đơn đã duyệt</option>
        </select>
      </div>
      <div className="field full">
        <button className="btn primary" disabled={busy} onClick={() => onSave(Number(value), mode)}>
          {busy ? 'Đang lưu…' : 'Lưu cách tính thưởng'}
        </button>
      </div>
    </div>
  );
}

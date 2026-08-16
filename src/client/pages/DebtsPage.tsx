import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DebtSummary } from '@shared/types';
import { formatVnd } from '@shared/money';
import { useApi } from '../lib/hooks';
import { Card, Kpi, StateBlock } from '../components/ui';

interface Totals {
  opening_debt: number;
  official_debt: number;
  projected_debt: number;
  pending_charges: number;
  pending_cash: number;
  customers_exceeded: number;
}

export function DebtsPage({ mode }: { mode: 'sales' | 'admin' }) {
  const [filter, setFilter] = useState('');
  const debts = useApi<DebtSummary[]>(`/api/debts${filter ? `?filter=${filter}` : ''}`);
  const totals = debts.meta?.totals as Totals | undefined;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{mode === 'admin' ? 'Công nợ toàn công ty' : 'Công nợ khách của tôi'}</h2>
          <p>
            Ba khái niệm tách riêng: công nợ chính thức (kế toán xác nhận), chờ ghi nợ / chờ tiền về, và công nợ dự
            kiến dùng để cảnh báo hạn mức.
          </p>
        </div>
        <div className="actions">
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tất cả khách</option>
            <option value="has_debt">Chỉ khách còn nợ</option>
            <option value="exceeded">Chỉ khách vượt hạn mức</option>
          </select>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="Dư nợ cũ đầu kỳ" value={formatVnd(totals?.opening_debt ?? 0)} hint="Đóng băng theo batch import" />
        <Kpi label="Công nợ chính thức" value={formatVnd(totals?.official_debt ?? 0)} hint="Dùng cho báo cáo" />
        <Kpi
          label="Công nợ dự kiến"
          value={formatVnd(totals?.projected_debt ?? 0)}
          hint={`Chờ ghi nợ ${formatVnd(totals?.pending_charges ?? 0)}`}
        />
        <Kpi
          label="Khách vượt hạn mức"
          value={totals?.customers_exceeded ?? 0}
          hint={totals?.customers_exceeded ? 'Cần xử lý ngay' : 'Trong ngưỡng'}
          tone={totals?.customers_exceeded ? 'bad' : 'good'}
        />
      </div>

      <Card bodyClass="">
        <StateBlock
          loading={debts.loading}
          error={debts.error}
          empty={(debts.data ?? []).length === 0}
          emptyText="Không có dữ liệu công nợ."
        >
          <div className="table-wrap">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  {mode === 'admin' && <th>Sale</th>}
                  <th className="right">Dư nợ cũ</th>
                  <th className="right">Đã ghi nợ</th>
                  <th className="right">Đã thanh toán</th>
                  <th className="right">Chính thức</th>
                  <th className="right">Chờ ghi nợ</th>
                  <th className="right">Chờ tiền về</th>
                  <th className="right">Dự kiến</th>
                  <th className="right">Hạn mức</th>
                </tr>
              </thead>
              <tbody>
                {(debts.data ?? []).map((debt) => (
                  <tr key={debt.customer_id}>
                    <td>
                      <Link
                        to={`/${mode}/customers/${debt.customer_id}`}
                        style={{ color: 'var(--pink)', fontWeight: 700 }}
                      >
                        {debt.customer_name}
                      </Link>
                      {debt.official_exceeded && <div><span className="badge red">Vượt hạn mức chính thức</span></div>}
                      {!debt.official_exceeded && debt.projected_exceeded && (
                        <div><span className="badge orange">Vượt hạn mức dự kiến</span></div>
                      )}
                    </td>
                    {mode === 'admin' && <td>{debt.owner_name ?? '—'}</td>}
                    <td className="right nowrap">{formatVnd(debt.opening_debt)}</td>
                    <td className="right nowrap">{formatVnd(debt.posted_charges)}</td>
                    <td className="right nowrap">{formatVnd(debt.confirmed_payments)}</td>
                    <td className="right nowrap">
                      <strong>{formatVnd(debt.official_debt)}</strong>
                    </td>
                    <td className="right nowrap">{formatVnd(debt.pending_charges)}</td>
                    <td className="right nowrap">{formatVnd(debt.pending_cash)}</td>
                    <td className="right nowrap">{formatVnd(debt.projected_debt)}</td>
                    <td className="right nowrap muted">{formatVnd(debt.limit)}</td>
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

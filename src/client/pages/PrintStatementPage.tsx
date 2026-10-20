import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { formatVnDate } from '@shared/datetime';
import { formatVnd } from '@shared/money';
import { useApi } from '../lib/hooks';

interface Statement {
  customer: { id: string; name: string; phone: string | null; address: string | null };
  as_of: string;
  old_debt_left: number;
  credit: number;
  orders: Array<{ id: string; order_no: string; order_date: string; delivered: boolean; total: number; paid: number; remaining: number }>;
  payments: Array<{
    id: string;
    paid_at: string;
    amount: number;
    method: string | null;
    receipt: string | null;
    confirmed: boolean;
    allocations: Array<{ order_no: string; amount: number }>;
    to_old_debt: number;
    to_credit: number;
  }>;
  orders_remaining: number;
  owed_total: number;
}

const COMPANY = {
  name: 'CÔNG TY CPTM VÀ XNK AILLA VIỆT NAM',
  address: '196 ngõ Thịnh Quang, đường Tây Sơn, phường Thịnh Quang, Hà Nội',
};

/** Một câu cho mỗi lần khách thanh toán: tiền đã trừ vào đơn nào, phần thừa đi đâu. */
function explain(p: Statement['payments'][number]): string {
  const parts = p.allocations.map((a) => `đơn ${a.order_no} ${formatVnd(a.amount)}`);
  if (p.to_old_debt > 0) parts.push(`công nợ cũ ${formatVnd(p.to_old_debt)}`);
  if (p.to_credit > 0) parts.push(`giữ lại làm số dư có của quý khách ${formatVnd(p.to_credit)}`);
  const how = parts.length ? `được trừ vào: ${parts.join('; ')}` : 'chưa trừ vào đơn nào';
  return `Ngày ${formatVnDate(p.paid_at)}, quý khách thanh toán ${formatVnd(p.amount)}${p.method ? ` (${p.method.toLowerCase()})` : ''}, ${how}.`;
}

export function PrintStatementPage() {
  const { id = '' } = useParams();
  const st = useApi<Statement>(`/api/customers/${id}/statement`);
  useEffect(() => {
    const d = st.data;
    if (!d) return;
    const prev = document.title;
    document.title = `Đối chiếu công nợ - ${d.customer.name} - ${d.as_of}`;
    return () => {
      document.title = prev;
    };
  }, [st.data]);
  if (st.loading) return <div className="loading" style={{ padding: 40 }}>Đang tải…</div>;
  if (st.error || !st.data) return <div className="alert-box">{st.error ?? 'Không tìm thấy khách'}</div>;
  const d = st.data;
  const owing = d.orders.filter((o) => o.remaining > 0);
  const newest = d.orders.length ? d.orders[d.orders.length - 1] : null;

  return (
    <div className="print-root">
      <div className="print-toolbar no-print">
        <button className="btn primary" onClick={() => window.print()}>
          In / Lưu PDF
        </button>
        <span className="muted">Bảng đối chiếu gửi khách: đơn nào còn nợ, mỗi lần thanh toán đã trừ vào đâu.</span>
      </div>
      <div className="print-page">
        <div className="print-head">
          <img src="/ailla-logo.png" alt="Ailla" className="print-logo" />
          <div className="print-co">
            <strong>{COMPANY.name}</strong>
            <div>{COMPANY.address}</div>
          </div>
          <div className="print-form">
            <div>Ngày lập: {formatVnDate(d.as_of)}</div>
          </div>
        </div>
        <h1 className="print-title">BẢNG ĐỐI CHIẾU CÔNG NỢ</h1>
        <p className="print-sub">
          Khách hàng: <strong>{d.customer.name}</strong>
          {d.customer.phone ? ` · ${d.customer.phone}` : ''}
        </p>

        <table className="print-table" style={{ maxWidth: 440, marginLeft: 'auto' }}>
          <tbody>
            <tr>
              <td>Các đơn còn nợ ({owing.length} đơn)</td>
              <td style={{ textAlign: 'right' }}>{formatVnd(d.orders_remaining)}</td>
            </tr>
            <tr>
              <td>Công nợ cũ còn lại</td>
              <td style={{ textAlign: 'right' }}>{formatVnd(d.old_debt_left)}</td>
            </tr>
            {d.credit > 0 && (
              <tr>
                <td>Tiền quý khách đang dư (trừ đi)</td>
                <td style={{ textAlign: 'right' }}>− {formatVnd(d.credit)}</td>
              </tr>
            )}
            <tr>
              <td>
                <strong>{d.owed_total >= 0 ? 'TỔNG CÒN PHẢI THANH TOÁN' : 'CÔNG TY ĐANG NỢ QUÝ KHÁCH'}</strong>
              </td>
              <td style={{ textAlign: 'right' }}>
                <strong>{formatVnd(Math.abs(d.owed_total))}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <h3 style={{ margin: '16px 0 4px' }}>1. Các đơn hàng</h3>
        <table className="print-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Ngày đặt</th>
              <th style={{ textAlign: 'right' }}>Giá trị</th>
              <th style={{ textAlign: 'right' }}>Đã thanh toán</th>
              <th style={{ textAlign: 'right' }}>Còn nợ</th>
            </tr>
          </thead>
          <tbody>
            {d.orders.map((o) => (
              <tr key={o.id}>
                <td>
                  {o.order_no}
                  {!o.delivered ? ' (chưa giao)' : ''}
                </td>
                <td>{formatVnDate(o.order_date)}</td>
                <td style={{ textAlign: 'right' }}>{formatVnd(o.total)}</td>
                <td style={{ textAlign: 'right' }}>{formatVnd(o.paid)}</td>
                <td style={{ textAlign: 'right' }}>{o.remaining > 0 ? <strong>{formatVnd(o.remaining)}</strong> : 'Đã đủ'}</td>
              </tr>
            ))}
            {d.orders.length === 0 && (
              <tr>
                <td colSpan={5}>Chưa có đơn nào.</td>
              </tr>
            )}
          </tbody>
        </table>

        <h3 style={{ margin: '16px 0 4px' }}>2. Các lần quý khách thanh toán</h3>
        <table className="print-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th style={{ textAlign: 'right' }}>Số tiền</th>
              <th>Đã trừ vào</th>
            </tr>
          </thead>
          <tbody>
            {d.payments.map((p) => (
              <tr key={p.id}>
                <td className="nowrap">
                  {formatVnDate(p.paid_at)}
                  {!p.confirmed ? ' *' : ''}
                </td>
                <td style={{ textAlign: 'right' }}>{formatVnd(p.amount)}</td>
                <td>
                  {p.allocations.map((a) => `${a.order_no}: ${formatVnd(a.amount)}`).join(' · ')}
                  {p.to_old_debt > 0 ? `${p.allocations.length ? ' · ' : ''}Công nợ cũ: ${formatVnd(p.to_old_debt)}` : ''}
                  {p.to_credit > 0 ? `${p.allocations.length || p.to_old_debt ? ' · ' : ''}Giữ lại cho quý khách: ${formatVnd(p.to_credit)}` : ''}
                </td>
              </tr>
            ))}
            {d.payments.length === 0 && (
              <tr>
                <td colSpan={3}>Chưa có lần thanh toán nào trong 120 ngày gần đây.</td>
              </tr>
            )}
          </tbody>
        </table>
        {d.payments.some((p) => !p.confirmed) && <p style={{ fontSize: 12 }}>* Khoản đang chờ kế toán xác nhận.</p>}

        <h3 style={{ margin: '16px 0 4px' }}>3. Diễn giải</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {d.payments.map((p) => (
            <li key={p.id}>{explain(p)}</li>
          ))}
          {newest && newest.remaining > 0 && (
            <li>
              Đơn mới nhất {newest.order_no} ngày {formatVnDate(newest.order_date)}, giá trị {formatVnd(newest.total)}, hiện còn nợ{' '}
              {formatVnd(newest.remaining)}.
            </li>
          )}
          <li>
            Thứ tự trừ tiền: đơn đặt trước trừ trước, đơn đặt sau trừ sau; phần còn thừa trừ vào công nợ cũ, hết công nợ cũ thì giữ lại làm số
            dư cho quý khách.
          </li>
        </ul>
        <p style={{ marginTop: 18 }}>
          Tổng còn phải thanh toán tại ngày {formatVnDate(d.as_of)}:{' '}
          <strong>{d.owed_total >= 0 ? formatVnd(d.owed_total) : `0 (công ty đang nợ quý khách ${formatVnd(-d.owed_total)})`}</strong>
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { formatVnDateTime } from '@shared/datetime';
import { useApi } from '../../lib/hooks';
import { Card, StateBlock } from '../../components/ui';

interface AuditRow {
  id: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_json: string | null;
  after_json: string | null;
  reason: string | null;
  ip: string | null;
  request_id: string | null;
  created_at: string;
}

export function AuditPage() {
  const [entityType, setEntityType] = useState('');
  const logs = useApi<AuditRow[]>(`/api/audit${entityType ? `?entity_type=${entityType}` : ''}`);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Nhật ký hệ thống</h2>
          <p>Mọi thay đổi owner, cấp giá, đơn hàng, duyệt, thanh toán và import đều được ghi lại kèm before/after.</p>
        </div>
        <select className="select" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">Tất cả đối tượng</option>
          <option value="CUSTOMER">Khách hàng</option>
          <option value="ORDER">Đơn hàng</option>
          <option value="PAYMENT">Thanh toán</option>
          <option value="IMPORT_BATCH">Import</option>
          <option value="TASK">Công việc</option>
        </select>
      </div>

      <Card bodyClass="">
        <StateBlock
          loading={logs.loading}
          error={logs.error}
          empty={(logs.data ?? []).length === 0}
          emptyText="Chưa có nhật ký nào."
        >
          <div className="table-wrap">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>Trước</th>
                  <th>Sau</th>
                  <th>Lý do</th>
                  <th>Request</th>
                </tr>
              </thead>
              <tbody>
                {(logs.data ?? []).map((log) => (
                  <tr key={log.id}>
                    <td className="nowrap">{formatVnDateTime(log.created_at)}</td>
                    <td>{log.actor_name ?? 'Hệ thống'}</td>
                    <td>
                      <span className="badge plain">{log.action}</span>
                    </td>
                    <td className="muted">
                      {log.entity_type}
                      <div style={{ fontSize: 11 }}>{log.entity_id?.slice(0, 8)}</div>
                    </td>
                    <td style={{ maxWidth: 220, fontSize: 12 }} className="muted">
                      {log.before_json ?? '—'}
                    </td>
                    <td style={{ maxWidth: 260, fontSize: 12 }} className="muted">
                      {log.after_json ?? '—'}
                    </td>
                    <td style={{ maxWidth: 180 }}>{log.reason ?? '—'}</td>
                    <td className="muted" style={{ fontSize: 11 }}>
                      {log.request_id?.slice(0, 8) ?? '—'}
                      <div>{log.ip ?? ''}</div>
                    </td>
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

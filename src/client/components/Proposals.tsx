import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PROPOSAL_KIND_LABELS, PROPOSAL_ROUTE_LABELS, type ProposalKind, type ProposalRoute } from '@shared/agent';
import { formatVnDateTime } from '@shared/datetime';
import { ApiError, api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { Card, useToast } from './ui';

interface Proposal {
  id: string;
  kind: string;
  status: string;
  agent_name: string | null;
  route_to: string;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  title: string;
  body: string | null;
  payload: unknown;
  created_at: string;
}

/**
 * Đề xuất của AI agent gửi tới người đang xem. Agent không tự đổi dữ liệu: người có quyền bấm Chấp nhận
 * (nghĩa là đồng ý và sẽ tự làm bằng chức năng có sẵn) hoặc Từ chối. Không có đề xuất thì không hiện gì.
 */
export function ProposalsCard({
  entityType,
  entityId,
  mode = 'sales',
}: {
  entityType?: string;
  entityId?: string;
  mode?: 'sales' | 'admin';
}) {
  const toast = useToast();
  const [key, setKey] = useState(0);
  const qs = new URLSearchParams({ status: 'PENDING', _: String(key) });
  if (entityType) qs.set('entity_type', entityType);
  if (entityId) qs.set('entity_id', entityId);
  const list = useApi<Proposal[]>(`/api/proposals?${qs.toString()}`);
  const items = list.data ?? [];
  if (items.length === 0) return null;

  async function decide(p: Proposal, decision: 'ACCEPTED' | 'REJECTED') {
    const note = prompt(decision === 'ACCEPTED' ? 'Ghi chú (không bắt buộc):' : 'Lý do từ chối (không bắt buộc):') ?? '';
    try {
      await api.post(`/api/proposals/${p.id}/decide`, { decision, note: note || null });
      toast.success(decision === 'ACCEPTED' ? 'Đã chấp nhận đề xuất' : 'Đã từ chối đề xuất');
      setKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không xử lý được');
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Card title={`Đề xuất của trợ lý AI (${items.length})`}>
        <div className="timeline">
          {items.map((p) => (
            <div className="event" key={p.id}>
              <p>
                <span className="badge purple">
                  {PROPOSAL_KIND_LABELS[p.kind as ProposalKind] ?? p.kind}
                </span>{' '}
                <strong>{p.title}</strong>
              </p>
              {p.body && <div>{p.body}</div>}
              <small>
                {p.entity_type === 'ORDER' && !entityId ? (
                  <Link to={`/${mode}/orders/${p.entity_id}`}>Đơn {p.entity_label ?? p.entity_id}</Link>
                ) : (
                  <span>
                    {p.entity_type} {p.entity_label ?? ''}
                  </span>
                )}{' '}
                · gửi tới {PROPOSAL_ROUTE_LABELS[p.route_to as ProposalRoute] ?? p.route_to} ·{' '}
                {p.agent_name ?? 'Agent'} · {formatVnDateTime(p.created_at)}
              </small>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button className="btn sm primary" onClick={() => void decide(p, 'ACCEPTED')}>
                  Chấp nhận
                </button>
                <button className="btn sm" onClick={() => void decide(p, 'REJECTED')}>
                  Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

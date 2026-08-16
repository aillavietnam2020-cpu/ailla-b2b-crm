import { useState } from 'react';
import type { ImportIssue, ImportPreviewResult } from '@shared/types';
import { formatVnDateTime } from '@shared/datetime';
import { ApiError, api, apiFetch } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { Card, StateBlock, useToast } from '../../components/ui';
import { useAuth } from '../../components/AuthProvider';

interface BatchRow {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  committed_at: string | null;
  started_by_name: string | null;
  error_count: number;
  warning_count: number;
  reconciliation_json: string | null;
}

/** Màn hình import 2 bước: preview trước, commit sau, luôn hiển thị đối soát. */
export function ImportPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [commitStep, setCommitStep] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const batches = useApi<BatchRow[]>('/api/imports');

  const runPreview = async () => {
    if (!file) return;
    setBusy(true);
    setErrorText(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiFetch<ImportPreviewResult>('/api/imports/preview', {
        method: 'POST',
        formData,
      });
      setPreview(result.data);
      batches.reload();
      toast.success('Đã kiểm tra file. Chưa ghi dữ liệu nghiệp vụ nào.');
    } catch (err) {
      setErrorText(err instanceof ApiError ? err.message : 'Không đọc được file.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Ghi dữ liệu theo từng chặng: sản phẩm/giá → khách hàng → đơn hàng → thanh toán → chốt.
   * Mỗi chặng là một request riêng vì Cloudflare giới hạn thời gian xử lý mỗi lần gọi.
   */
  const runCommit = async () => {
    if (!preview || !file) return;
    setBusy(true);
    setErrorText(null);
    setCommitStep(null);
    try {
      let phase: string | null = null;
      let status = '';
      // Tối đa 10 vòng cho 5 chặng - đủ dư để không bao giờ lặp vô hạn.
      for (let i = 0; i < 10; i += 1) {
        const formData = new FormData();
        formData.append('batch_id', preview.batch_id);
        formData.append('file', file);
        if (phase) formData.append('phase', phase);

        const result = await apiFetch<{
          status: string;
          next_phase: string | null;
          phase_label?: string;
        }>('/api/imports/commit', { method: 'POST', formData });

        status = result.data.status;
        setCommitStep(result.data.phase_label ?? null);
        if (!result.data.next_phase) break;
        phase = result.data.next_phase;
      }

      toast.success(
        status === 'RECONCILED'
          ? 'Ghi dữ liệu xong và khớp toàn bộ mốc đối soát.'
          : 'Đã ghi dữ liệu nhưng CHƯA khớp đối soát - xem danh sách lệch.',
      );
      setPreview(null);
      setFile(null);
      setCommitStep(null);
      batches.reload();
    } catch (err) {
      setErrorText(
        err instanceof ApiError
          ? `${err.message} (bấm "Ghi dữ liệu" lần nữa để chạy tiếp từ chặng đang dở)`
          : 'Không ghi được dữ liệu.',
      );
    } finally {
      setBusy(false);
    }
  };

  const rollback = async (batchId: string) => {
    if (!confirm('Rollback toàn bộ dữ liệu của batch này?')) return;
    try {
      await api.post(`/api/imports/${batchId}/rollback`);
      toast.success('Đã rollback batch');
      batches.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không rollback được');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Import & chất lượng dữ liệu</h2>
          <p>
            Bước 1 kiểm tra file và đối soát; bước 2 mới ghi dữ liệu. Sheet CANH_BAO không được import vì chứa công
            thức lỗi.
          </p>
        </div>
      </div>

      {errorText && <div className="alert-box" style={{ marginBottom: 16 }}>{errorText}</div>}

      {can('import.run') && (
        <Card title="Tải file CRM Excel">
          <div className="actions" style={{ alignItems: 'center' }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
            <button className="btn" onClick={runPreview} disabled={!file || busy}>
              {busy ? 'Đang xử lý…' : 'Bước 1: Kiểm tra (preview)'}
            </button>
            <button className="btn primary" onClick={runCommit} disabled={!preview || busy}>
              {busy && commitStep ? `Đang ghi: ${commitStep}…` : 'Bước 2: Ghi dữ liệu vào hệ thống'}
            </button>
          </div>
        </Card>
      )}

      {preview && (
        <>
          <div style={{ height: 18 }} />
          <div className="grid-2">
            <Card title="Đối soát với mốc tài liệu">
              <div className="table-wrap">
                <table className="data" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>Chỉ tiêu</th>
                      <th className="right">Mốc tài liệu</th>
                      <th className="right">File hiện tại</th>
                      <th className="right">Lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.reconciliation.lines.map((line) => (
                      <tr key={line.key}>
                        <td>{line.label}</td>
                        <td className="right nowrap">{line.expected.toLocaleString('vi-VN')}</td>
                        <td className="right nowrap">{line.actual.toLocaleString('vi-VN')}</td>
                        <td className="right nowrap">
                          {line.ok ? (
                            <span className="badge green">Khớp</span>
                          ) : (
                            <span className="badge red">{line.diff.toLocaleString('vi-VN')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title={`Lỗi & cảnh báo (${preview.issues.length})`}>
              <div className="stat-row">
                <span className="muted">Lỗi chặn</span>
                <strong style={{ color: 'var(--red)' }}>{preview.issue_counts.errors}</strong>
              </div>
              <div className="stat-row">
                <span className="muted">Cảnh báo</span>
                <strong style={{ color: 'var(--orange)' }}>{preview.issue_counts.warnings}</strong>
              </div>
              <div className="stat-row">
                <span className="muted">Ghi chú</span>
                <strong>{preview.issue_counts.infos}</strong>
              </div>
              <IssueList issues={preview.issues} />
            </Card>
          </div>
        </>
      )}

      <div style={{ height: 18 }} />

      <Card title="Lịch sử import" bodyClass="">
        <StateBlock
          loading={batches.loading}
          error={batches.error}
          empty={(batches.data ?? []).length === 0}
          emptyText="Chưa có lần import nào."
        >
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Trạng thái</th>
                  <th className="right">Lỗi</th>
                  <th className="right">Cảnh báo</th>
                  <th>Người chạy</th>
                  <th>Thời gian</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(batches.data ?? []).map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.file_name}</td>
                    <td>
                      <span
                        className={`badge ${
                          batch.status === 'RECONCILED'
                            ? 'green'
                            : batch.status === 'COMMITTED'
                              ? 'orange'
                              : batch.status === 'ROLLED_BACK'
                                ? 'red'
                                : 'blue'
                        }`}
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td className="right">{batch.error_count}</td>
                    <td className="right">{batch.warning_count}</td>
                    <td>{batch.started_by_name ?? '—'}</td>
                    <td className="nowrap">{formatVnDateTime(batch.committed_at ?? batch.created_at)}</td>
                    <td>
                      {can('import.run') && (batch.status === 'COMMITTED' || batch.status === 'RECONCILED') && (
                        <button className="btn sm danger" onClick={() => rollback(batch.id)}>
                          Rollback
                        </button>
                      )}
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

function IssueList({ issues }: { issues: ImportIssue[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? issues : issues.slice(0, 12);
  return (
    <>
      <div className="timeline" style={{ marginTop: 14 }}>
        {visible.map((issue, index) => (
          <div className="event" key={index}>
            <p>
              <span
                className={`badge ${
                  issue.severity === 'ERROR' ? 'red' : issue.severity === 'WARNING' ? 'orange' : 'blue'
                }`}
              >
                {issue.severity}
              </span>{' '}
              <strong>{issue.sheet}</strong>
              {issue.row_no ? ` · dòng ${issue.row_no}` : ''}
            </p>
            <small>{issue.message}</small>
          </div>
        ))}
      </div>
      {issues.length > 12 && (
        <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Thu gọn' : `Xem tất cả ${issues.length} dòng`}
        </button>
      )}
    </>
  );
}

import { useState } from 'react';
import { formatVnDateTime } from '@shared/datetime';
import { ApiError, api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useToast } from './ui';

/**
 * Trên trang chi tiết đơn:
 *  - Ảnh / tin đơn gốc của khách (đơn lập từ Zalo) để Điều phối đối chiếu khi duyệt.
 *  - Đơn đã duyệt: tạo link xem đơn + lời nhắn để Sale dán vào Zalo gửi khách; thấy khách đã mở, đã chốt hay báo sửa.
 */
interface IntakeRow {
  id: string;
  source: string;
  raw_text: string | null;
  has_image: number;
  zalo_thread_name: string | null;
  zalo_sender: string | null;
  created_at: string;
}
interface ShareLink {
  token: string;
  url: string;
  message: string;
  created_at: string;
  first_viewed_at: string | null;
  view_count: number;
  confirmed_at: string | null;
  change_note: string | null;
  change_at: string | null;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function OrderZaloShare({ orderId, canCreate }: { orderId: string; canCreate: boolean }) {
  const toast = useToast();
  const intakes = useApi<IntakeRow[]>(`/api/order-intake/by-order/${orderId}`);
  const share = useApi<{ can_share: boolean; link: ShareLink | null }>(`/api/order-intake/share/${orderId}`);
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState<string | null>(null);

  const make = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ link: ShareLink }>(`/api/order-intake/share/${orderId}`, {});
      const okCopy = await copy(r.data.link.message);
      toast.success(okCopy ? 'Đã chép lời nhắn kèm link. Mở Zalo nhóm của khách và dán vào.' : 'Đã tạo link. Bấm "Chép lời nhắn" để gửi khách.');
      share.reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Chưa tạo được link');
    } finally {
      setBusy(false);
    }
  };

  const rows = intakes.data ?? [];
  const link = share.data?.link ?? null;
  if (!rows.length && !share.data?.can_share && !link) return null;

  return (
    <section className="card" style={{ padding: 14, display: 'grid', gap: 12, marginBottom: 16 }}>
      {rows.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <strong>Đơn gốc của khách</strong>
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {r.has_image ? (
                <img
                  src={`/api/order-intake/${r.id}/image`}
                  alt="Ảnh đơn khách gửi"
                  onClick={() => setBig(`/api/order-intake/${r.id}/image`)}
                  style={{ width: 140, maxHeight: 180, objectFit: 'contain', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'zoom-in' }}
                />
              ) : null}
              <div style={{ flex: 1, minWidth: 200, fontSize: 13 }}>
                <div className="muted">
                  {r.source === 'ZALO_GROUP' ? `Trợ lý đọc trong nhóm Zalo${r.zalo_thread_name ? ` "${r.zalo_thread_name}"` : ''}` : 'Sale đưa vào từ Zalo'} ·{' '}
                  {formatVnDateTime(r.created_at)}
                  {r.zalo_sender ? ` · người gửi: ${r.zalo_sender}` : ''}
                </div>
                {r.raw_text && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{r.raw_text}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {(share.data?.can_share || link) && (
        <div style={{ display: 'grid', gap: 8 }}>
          <strong>Gửi khách xác nhận</strong>
          {!link && (
            <>
              <div className="muted" style={{ fontSize: 13 }}>
                Web tạo một link xem đơn (khách mở được ngay trong Zalo, không cần đăng nhập) và lời nhắn có tóm tắt đơn. Sale dán vào Zalo của khách. Khách bấm "Đúng, chốt đơn" thì web ghi lại giờ.
              </div>
              {canCreate && (
                <button type="button" className="btn primary" disabled={busy} onClick={() => void make()}>
                  {busy ? 'Đang tạo…' : 'Tạo link và chép lời nhắn'}
                </button>
              )}
            </>
          )}
          {link && (
            <>
              <div style={{ fontSize: 13.5 }}>
                {link.confirmed_at ? (
                  <span className="badge ok">Khách đã chốt đơn lúc {formatVnDateTime(link.confirmed_at)}</span>
                ) : link.change_at ? (
                  <span className="badge orange">Khách báo sửa lúc {formatVnDateTime(link.change_at)}</span>
                ) : link.first_viewed_at ? (
                  <span className="badge blue">Khách đã mở link, chưa chốt</span>
                ) : (
                  <span className="badge muted">Đã tạo link, khách chưa mở</span>
                )}
              </div>
              {link.change_note && !link.confirmed_at && (
                <div className="alert-box warn">Khách ghi: {link.change_note}. Sửa đơn xong thì gửi lại link cho khách.</div>
              )}
              <textarea readOnly value={link.message} rows={6} onFocus={(e) => e.currentTarget.select()} style={{ fontSize: 13 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void copy(link.message).then((ok) => (ok ? toast.success('Đã chép. Dán vào Zalo của khách.') : toast.error('Máy không cho chép, bấm vào ô trên rồi chép tay.')))}
                >
                  Chép lời nhắn
                </button>
                <button type="button" className="btn" onClick={() => void copy(link.url).then((ok) => ok && toast.success('Đã chép link'))}>
                  Chép link
                </button>
                <a className="btn" href={link.url} target="_blank" rel="noreferrer">
                  Xem trang khách thấy
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {big && (
        <div
          onClick={() => setBig(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}
        >
          <img src={big} alt="Ảnh đơn khách gửi" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </section>
  );
}

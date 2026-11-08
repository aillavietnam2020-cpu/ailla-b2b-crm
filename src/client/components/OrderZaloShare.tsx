import { useState } from 'react';
import { formatVnDateTime } from '@shared/datetime';
import { ApiError, api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useToast } from './ui';
import type { OrderDetail } from '@shared/types';
import { drawOrderImage, shareImage } from './orderImage';

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

export function OrderZaloShare({ order, canCreate }: { order: OrderDetail; canCreate: boolean }) {
  const orderId = order.id;
  const toast = useToast();
  const [img, setImg] = useState<string | null>(null);
  const makeImage = () => {
    try {
      setImg(drawOrderImage(order));
    } catch {
      toast.error('Máy chưa vẽ được ảnh, thử lại.');
    }
  };
  const sendImage = async () => {
    if (!img) return;
    if (!(await shareImage(img, order.order_no))) toast.success('Bấm giữ ảnh để lưu hoặc chia sẻ, hoặc bấm "Lưu ảnh".');
  };
  const intakes = useApi<IntakeRow[]>(`/api/order-intake/by-order/${orderId}`);
  const share = useApi<{ can_share: boolean; link: ShareLink | null }>(`/api/order-intake/share/${orderId}`);
  const zsend = useApi<{
    thread: { thread_id: string; name: string | null } | null;
    last: { status: string; error: string | null; created_at: string; sent_at: string | null } | null;
  }>(`/api/order-intake/zalo-send/${orderId}`);
  const [busy, setBusy] = useState(false);

  const sendZalo = async () => {
    setBusy(true);
    try {
      await api.post(`/api/order-intake/zalo-send/${orderId}`, {});
      toast.success('Trợ lý sẽ gửi đơn vào nhóm Zalo trong ít phút.');
      zsend.reload();
      share.reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Chưa gửi được');
    } finally {
      setBusy(false);
    }
  };
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
          <strong>Gửi đơn cho khách</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn primary" onClick={makeImage}>
              {img ? 'Vẽ lại ảnh đơn' : 'Tạo ảnh đơn'}
            </button>
            {img && (
              <>
                <button type="button" className="btn primary" onClick={() => void sendImage()}>
                  Gửi ảnh qua Zalo
                </button>
                <a className="btn" href={img} download={`${order.order_no}.png`}>
                  Lưu ảnh
                </a>
              </>
            )}
          </div>
          {img && (
            <img src={img} alt={`Ảnh đơn ${order.order_no}`} style={{ width: '100%', maxWidth: 420, border: '1px solid #ddd', borderRadius: 8 }} />
          )}
          <div className="muted" style={{ fontSize: 12.5 }}>
            Ảnh chỉ có tên khách, hàng, số lượng và tiền. Không có công nợ hay ghi chú nội bộ.
          </div>
          {zsend.data?.thread && canCreate && (
            <div style={{ display: 'grid', gap: 6 }}>
              <button type="button" className="btn primary" disabled={busy || zsend.data.last?.status === 'PENDING'} onClick={() => void sendZalo()}>
                {zsend.data.last?.status === 'PENDING'
                  ? 'Đang chờ trợ lý gửi vào nhóm…'
                  : `Trợ lý gửi đơn vào nhóm "${zsend.data.thread.name ?? 'Zalo'}"`}
              </button>
              {zsend.data.last?.status === 'SENT' && zsend.data.last.sent_at && (
                <span className="muted" style={{ fontSize: 13 }}>
                  Trợ lý đã gửi vào nhóm lúc {formatVnDateTime(zsend.data.last.sent_at)}.
                </span>
              )}
              {zsend.data.last?.status === 'FAILED' && (
                <div className="alert-box warn">Trợ lý chưa gửi được ({zsend.data.last.error}). Chép lời nhắn bên dưới và gửi tay.</div>
              )}
            </div>
          )}
          {!link && (
            <>
              <div className="muted" style={{ fontSize: 13 }}>
                Muốn khách bấm chốt để web ghi lại giờ khách đồng ý: gửi thêm link (khách mở ngay trong Zalo, không cần đăng nhập).
              </div>
              {canCreate && (
                <button type="button" className="btn" disabled={busy} onClick={() => void make()}>
                  {busy ? 'Đang tạo…' : 'Gửi thêm link để khách bấm chốt (không bắt buộc)'}
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

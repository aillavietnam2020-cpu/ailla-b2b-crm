import { useState } from 'react';
import { vnDate } from '@shared/datetime';
import { Modal } from './ui';

/**
 * Hỏi NGÀY XUẤT KHO và NGƯỜI XUẤT KHO trước khi ghi "đã xuất kho / đã giao".
 * Không điền sẵn: người kho phải tự chọn ngày hàng thực sự rời kho và tự gõ tên mình.
 */
export function ShipInfoModal({
  title,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (info: { ship_day: string; shipped_by_name: string }) => void;
}) {
  const [day, setDay] = useState('');
  const [by, setBy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!day) return setError('Phải chọn ngày xuất kho (ngày hàng thực sự rời kho).');
    if (by.trim().length < 2) return setError('Người xuất kho phải tự ghi tên mình.');
    setError(null);
    onConfirm({ ship_day: day, shipped_by_name: by.trim() });
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <p className="muted">Kho trừ tồn vào đúng ngày xuất chọn dưới đây.</p>
          <div className="form-grid" style={{ marginTop: 10 }}>
            <div className="field">
              <label>Ngày xuất kho</label>
              <input type="date" value={day} max={vnDate()} onChange={(e) => setDay(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Người xuất kho (tự điền tên)</label>
              <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Họ tên người xuất hàng" />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            Xác nhận đã xuất
          </button>
        </div>
      </form>
    </Modal>
  );
}

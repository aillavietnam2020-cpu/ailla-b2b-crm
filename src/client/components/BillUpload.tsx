import { useEffect, useState } from 'react';
import { vnDate } from '@shared/datetime';
import { ApiError, apiFetch } from '../lib/api';
import { shrinkImage } from '../lib/image';
import { ErrorBox, Modal } from './ui';

export interface BillTarget {
  customerId: string;
  customerName?: string;
  orderId?: string | null;
  orderNo?: string | null;
  paymentId?: string | null;
  amount?: number | null;
}

/** Gửi một hoặc nhiều ảnh bill (đã thu nhỏ) lên kho bill, gắn với khách / đơn / khoản tiền. */
export async function uploadBills(
  files: File[],
  target: BillTarget & { paidAt?: string; method?: string; note?: string },
  extra?: { kind?: 'BILL' | 'PHIEU_THU'; bankRef?: string | null; toAccount?: string | null; readJson?: string | null },
): Promise<void> {
  for (const original of files) {
    const file = await shrinkImage(original);
    const fd = new FormData();
    fd.set('file', file, file.name);
    fd.set('customer_id', target.customerId);
    if (target.orderId) fd.set('order_id', target.orderId);
    if (target.paymentId) fd.set('payment_id', target.paymentId);
    if (target.amount) fd.set('amount', String(target.amount));
    if (target.paidAt) fd.set('paid_at', target.paidAt);
    if (target.method) fd.set('method', target.method);
    if (target.note) fd.set('note', target.note);
    if (extra?.kind) fd.set('kind', extra.kind);
    if (extra?.bankRef) fd.set('bank_ref', extra.bankRef);
    if (extra?.toAccount) fd.set('to_account', extra.toAccount);
    if (extra?.readJson) fd.set('read_json', extra.readJson);
    await apiFetch('/api/bills', { method: 'POST', formData: fd });
  }
}

/** Ô chọn ảnh bill kèm xem trước tên file; dùng trong các form có đính kèm bill. */
export function BillFilePicker({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <div className="field full">
      <label>Ảnh bill khách chuyển khoản (có thể chọn nhiều ảnh)</label>
      <input
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={(e) => onChange(Array.from(e.target.files ?? []))}
      />
      {files.length > 0 && (
        <span className="muted" style={{ fontSize: 12 }}>
          Đã chọn {files.length} file: {files.map((f) => f.name).join(', ')}
        </span>
      )}
    </div>
  );
}

/** Hộp thoại gửi bill nhanh từ đơn hàng hoặc kho bill. */
export function BillUploadModal({
  target,
  onClose,
  onDone,
}: {
  target: BillTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [amount, setAmount] = useState(target.amount ? String(target.amount) : '');
  const [paidAt, setPaidAt] = useState(vnDate());
  const [method, setMethod] = useState('Chuyển khoản');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [files]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      setError('Chọn ít nhất một ảnh bill');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadBills(files, {
        ...target,
        amount: amount ? Number(amount) : null,
        paidAt,
        method,
        note,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được bill');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Gửi bill${target.orderNo ? ` · đơn ${target.orderNo}` : ''}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <ErrorBox message={error} />
          <p className="muted">
            Khách <strong>{target.customerName ?? ''}</strong>. Bill được lưu vào Kho bill, kế toán mở ra đối chiếu
            khi xác nhận tiền về.
          </p>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <BillFilePicker files={files} onChange={setFiles} />
            <div className="field">
              <label>Số tiền trên bill (đồng)</label>
              <input type="number" min={0} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="field">
              <label>Ngày chuyển</label>
              <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="field">
              <label>Hình thức</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Chuyển khoản</option>
                <option>Tiền mặt</option>
                <option>COD</option>
                <option>Khác</option>
              </select>
            </div>
            <div className="field full">
              <label>Ghi chú</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Đang gửi…' : 'Gửi bill'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

import { useState } from 'react';
import type { CustomerListItem } from '@shared/types';
import { useApi } from '../lib/hooks';
import { Field, Modal } from './ui';
import { PaymentForm } from './PaymentForm';

/** Nút "Thu tiền" đặt ngoài danh sách: chọn khách rồi mở phiếu thu (trả công nợ / đặt cọc). */
export function CollectPaymentButton({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<CustomerListItem | null>(null);
  const customers = useApi<CustomerListItem[]>(open ? '/api/customers?page=1&page_size=200' : null);
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const list = (customers.data ?? [])
    .filter((c) => !q.trim() || fold(`${c.name} ${c.phone_text ?? ''} ${c.legacy_code ?? ''}`).includes(fold(q.trim())))
    .slice(0, 30);
  const close = () => {
    setOpen(false);
    setPicked(null);
    setQ('');
  };
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        Thu tiền
      </button>
      {open && !picked && (
        <Modal title="Thu tiền · chọn khách" onClose={close}>
          <div className="modal-body">
            <Field label="Tên khách hoặc số điện thoại">
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ vài chữ tên khách…" />
            </Field>
            <div style={{ maxHeight: 360, overflow: 'auto', marginTop: 8 }}>
              {customers.loading && <div className="muted">Đang tải…</div>}
              {list.map((c) => (
                <button
                  key={c.id}
                  className="btn"
                  style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
                  onClick={() => setPicked(c)}
                >
                  <strong>{c.name}</strong> <span className="muted">{c.phone_text ?? ''} · {c.province ?? ''}</span>
                </button>
              ))}
              {!customers.loading && list.length === 0 && <div className="muted">Không thấy khách nào.</div>}
            </div>
          </div>
        </Modal>
      )}
      {open && picked && (
        <PaymentForm
          order={{ id: '', order_no: '', customer_id: picked.id, customer_name: picked.name, remaining_amount: 0 }}
          onClose={close}
          onDone={() => {
            close();
            onDone?.();
          }}
        />
      )}
    </>
  );
}

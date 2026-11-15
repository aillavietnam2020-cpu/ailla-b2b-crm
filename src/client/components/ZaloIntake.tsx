import { useRef, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useAuth } from './AuthProvider';
import { CustomerSelect } from './CustomerSelect';

/**
 * Ô "Đơn từ Zalo" trên trang tạo đơn: sale chọn ảnh đơn của khách (lưu từ Zalo) hoặc dán ảnh / tin nhắn,
 * máy đọc ra dòng hàng. Dòng chắc chắn hiện xanh, dòng chưa chắc hiện vàng (phải bấm chọn), không có trong danh mục hiện đỏ (bỏ dòng).
 * Bấm "Đưa vào đơn" thì các dòng đi vào bảng dòng hàng bên dưới; giá do trang tạo đơn tính theo cấp khách như bình thường.
 */
export interface IntakeProduct {
  id: string;
  sku: string;
  name: string;
  unit: string | null;
  pack_size: string | null;
}

interface IntakeLine {
  raw: string;
  qty: number | null;
  unit_written: string | null;
  candidates: string[];
  products: IntakeProduct[];
  status: 'OK' | 'WARN' | 'BAD';
  question: string | null;
}

interface ReadResponse {
  id: string;
  customer_id?: string | null;
  thread_name?: string | null;
  sender?: string | null;
  raw_text?: string | null;
  has_image?: boolean;
  customer_hint: string | null;
  delivery_note: string | null;
  note: string | null;
  lines: IntakeLine[];
}

interface QueueRow {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  thread_name: string | null;
  zalo_sender: string | null;
  raw_text: string | null;
  has_image: number;
  line_count: number;
  created_at: string;
}

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export interface IntakePick {
  product: IntakeProduct;
  qty: number;
  /** Khách ghi "thùng" cho mã bán lẻ: trang tạo đơn chuyển dòng sang lấy nguyên thùng. */
  as_carton: boolean;
}

interface Work extends IntakeLine {
  pick: string | null;
  qtyEdit: string;
  drop: boolean;
}

const MAX_SIDE = 1600;

/** Thu nhỏ ảnh ở trình duyệt (≤1600px, JPEG) cho nhẹ trước khi gửi. */
async function shrink(file: Blob): Promise<{ b64: string; mime: string; url: string }> {
  // Đọc bằng data: vì chính sách bảo mật của web chặn ảnh blob:.
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Ảnh không mở được'));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Ảnh không mở được'));
    i.src = url;
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Máy không xử lý được ảnh');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let q = 0.82;
  let data = canvas.toDataURL('image/jpeg', q);
  while (data.length > 1_900_000 && q > 0.4) {
    q -= 0.12;
    data = canvas.toDataURL('image/jpeg', q);
  }
  return { b64: data.slice(data.indexOf(',') + 1), mime: 'image/jpeg', url: data };
}

const looksCarton = (u: string | null) => !!u && /th(ù|u)ng|\bth\b|kiện|kien/i.test(u);
const isCartonSku = (u: string | null) => !!u && /th(ù|u)ng|kiện|kien/i.test(u);

export function ZaloIntake({
  customerId,
  customers,
  onPickCustomer,
  onApply,
}: {
  customerId: string;
  customers: Array<{ id: string; name: string }>;
  onPickCustomer: (id: string) => void;
  onApply: (picks: IntakePick[], meta: { intakeId: string; note: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<{ b64: string; mime: string; url: string } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<ReadResponse | null>(null);
  const [work, setWork] = useState<Work[]>([]);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { can } = useAuth();
  /** Đơn trợ lý đã nhận trong nhóm Zalo, chờ sale lập đơn. */
  const queue = useApi<QueueRow[]>('/api/order-intake/pending');
  const [fromZalo, setFromZalo] = useState<{ thread: string | null; sender: string | null } | null>(null);

  const loadResult = (data: ReadResponse) => {
    setRes(data);
    setWork(
      data.lines.map((l) => ({
        ...l,
        pick: l.status === 'OK' ? (l.candidates[0] ?? null) : null,
        qtyEdit: l.qty ? String(l.qty) : '',
        drop: false,
      })),
    );
  };

  const openQueued = async (id: string) => {
    setBusy(true);
    setErr(null);
    setDone(false);
    try {
      const r = await api.get<ReadResponse>(`/api/order-intake/${id}`);
      if (r.data.customer_id && r.data.customer_id !== customerId) onPickCustomer(r.data.customer_id);
      setImage(r.data.has_image ? { b64: '', mime: '', url: `/api/order-intake/${id}/image` } : null);
      setText(r.data.raw_text ?? '');
      setFromZalo({ thread: r.data.thread_name ?? null, sender: r.data.sender ?? null });
      loadResult(r.data);
      setOpen(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Chưa mở được đơn này');
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (id: string) => {
    try {
      await api.post(`/api/order-intake/${id}/dismiss`, {});
      queue.reload();
      if (res?.id === id) {
        setRes(null);
        setWork([]);
        setFromZalo(null);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Chưa bỏ được');
    }
  };

  const takeFile = async (f: Blob | null | undefined) => {
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      setErr('Chỉ nhận ảnh (JPG, PNG).');
      return;
    }
    try {
      setErr(null);
      setImage(await shrink(f));
      setFromZalo(null);
      setRes(null);
      setDone(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ảnh không mở được');
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      void takeFile(item.getAsFile());
    }
  };

  const read = async () => {
    setBusy(true);
    setErr(null);
    setRes(null);
    setDone(false);
    try {
      const r = await api.post<ReadResponse>('/api/order-intake/read', {
        text: text.trim() || undefined,
        image_b64: image?.b64 || undefined,
        mime: image?.b64 ? image.mime : undefined,
        customer_id: customerId || undefined,
      });
      setFromZalo(null);
      loadResult(r.data);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Máy chưa đọc được đơn này. Thử lại hoặc lập đơn tay.');
    } finally {
      setBusy(false);
    }
  };

  const patch = (i: number, p: Partial<Work>) => setWork((w) => w.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const pending = work.filter((w) => !w.drop && (!w.pick || !(Number(w.qtyEdit) > 0))).length;
  const keep = work.filter((w) => !w.drop && w.pick);

  const apply = () => {
    if (!res) return;
    const picks: IntakePick[] = keep.map((w) => {
      const product = w.products.find((p) => p.sku === w.pick)!;
      return { product, qty: Math.round(Number(w.qtyEdit)), as_carton: !isCartonSku(product.unit) && looksCarton(w.unit_written) };
    });
    const note = [res.delivery_note, res.note].filter(Boolean).join('. ') || null;
    onApply(picks, { intakeId: res.id, note });
    setDone(true);
    queue.reload();
  };

  const hintMatch =
    res?.customer_hint && !customerId
      ? customers.find((c) => {
          const f = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
          const h = f(res.customer_hint!);
          const n = f(c.name);
          return h.length >= 3 && (n.includes(h) || h.includes(n));
        })
      : undefined;

  const rows = queue.data ?? [];
  const queueBox = rows.length > 0 && (
    <div style={{ display: 'grid', gap: 6, width: '100%' }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>Trợ lý nhận trong nhóm Zalo ({rows.length} đơn chờ lập)</div>
      {rows.map((q) => (
        <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', background: res?.id === q.id ? 'rgba(31,122,85,.08)' : undefined }}>
          <div style={{ flex: 1, minWidth: 200, fontSize: 13 }}>
            <b>{q.customer_name ?? q.thread_name ?? 'Nhóm Zalo'}</b> · {q.line_count} dòng{q.has_image ? ' · có ảnh' : ''}
            <div className="muted">
              {q.thread_name ? `Nhóm "${q.thread_name}"` : ''}
              {q.zalo_sender ? ` · ${q.zalo_sender}` : ''} · {hhmm(q.created_at)}
            </div>
          </div>
          <button type="button" className="btn sm primary" disabled={busy} onClick={() => void openQueued(q.id)}>
            Mở
          </button>
          <button type="button" className="btn sm" onClick={() => void dismiss(q.id)} title="Không phải đơn, hoặc đã lập tay">
            Bỏ qua
          </button>
        </div>
      ))}
    </div>
  );

  if (!open) {
    return (
      <section className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong>Đơn từ Zalo</strong>
          <div className="muted" style={{ fontSize: 13 }}>Khách gửi ảnh đơn hoặc nhắn tin? Đưa vào đây, máy đọc sẵn dòng hàng.</div>
        </div>
        <button type="button" className="btn primary" onClick={() => setOpen(true)}>
          Đọc đơn từ ảnh / tin nhắn
        </button>
        {queueBox}
        {err && <div className="alert-box" style={{ width: '100%' }}>{err}</div>}
      </section>
    );
  }

  const color = (w: Work) => (w.drop ? 'var(--line, #ddd)' : !w.pick ? (w.status === 'BAD' ? '#c23b2e' : '#b26b00') : '#1d8a4e');

  return (
    <section className="card" style={{ padding: 14, display: 'grid', gap: 12 }} onPaste={onPaste}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <strong>Đơn từ Zalo</strong>
        <button type="button" className="btn sm" onClick={() => setOpen(false)}>
          Thu gọn
        </button>
      </div>
      {queueBox}
      {fromZalo && (
        <div className="note">
          Đơn trợ lý nhận trong nhóm Zalo{fromZalo.thread ? ` "${fromZalo.thread}"` : ''}{fromZalo.sender ? `, người gửi ${fromZalo.sender}` : ''}. Kiểm từng dòng rồi bấm "Đưa vào đơn".
        </div>
      )}
      {!customerId && <div className="note">Chọn khách ở khung trên trước để máy chọn đúng bảng giá của khách.</div>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: 8, width: 160 }}>
          {image ? (
            <img src={image.url} alt="Ảnh đơn của khách" style={{ width: 160, maxHeight: 200, objectFit: 'contain', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }} />
          ) : (
            <div className="muted" style={{ fontSize: 13, border: '2px dashed #9bbfae', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              Chưa có ảnh
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void takeFile(e.target.files?.[0])} />
          <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}>
            {image ? 'Đổi ảnh' : 'Chọn ảnh đơn'}
          </button>
          {image && (
            <button type="button" className="btn sm" onClick={() => setImage(null)}>
              Bỏ ảnh
            </button>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 220, display: 'grid', gap: 8 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Dán tin nhắn đặt hàng của khách vào đây (nếu khách nhắn chữ). Trên máy tính có thể dán thẳng ảnh vào ô này."
          />
          <div className="muted" style={{ fontSize: 12.5 }}>
            Trên điện thoại: trong Zalo bấm giữ ảnh đơn → Lưu ảnh, rồi bấm "Chọn ảnh đơn". Tin nhắn chữ: bấm giữ → Sao chép, rồi dán vào ô trên.
          </div>
          <button type="button" className="btn primary" disabled={busy || (!image?.b64 && !text.trim())} onClick={() => void read()}>
            {busy ? 'Máy đang đọc đơn… (khoảng 10–30 giây)' : 'Đọc đơn'}
          </button>
        </div>
      </div>
      {err && <div className="alert-box">{err}</div>}

      {res && (
        <div style={{ display: 'grid', gap: 8 }}>
          {res.customer_hint && !customerId && (
            <div className="note">
              Máy thấy tên khách: <b>{res.customer_hint}</b>
              {hintMatch && (
                <>
                  {' '}
                  <button type="button" className="btn sm primary" onClick={() => onPickCustomer(hintMatch.id)}>
                    Chọn khách {hintMatch.name}
                  </button>
                </>
              )}
            </div>
          )}
          {work.length === 0 && <div className="note">Máy không thấy dòng hàng nào. Thử ảnh rõ hơn hoặc lập đơn tay.</div>}
          {work.map((w, i) => (
            <div key={i} style={{ borderLeft: `4px solid ${color(w)}`, border: '1px solid #ddd', borderLeftWidth: 4, borderLeftColor: color(w), borderRadius: 8, padding: 10, display: 'grid', gap: 6, opacity: w.drop ? 0.55 : 1 }}>
              <div className="muted" style={{ fontSize: 13 }}>
                Khách ghi: <b style={{ color: 'inherit' }}>{w.raw || '(không rõ)'}</b>
              </div>
              {w.status !== 'OK' && w.question && !w.pick && !w.drop && <div style={{ fontSize: 13, color: color(w), fontWeight: 600 }}>{w.question}</div>}
              {w.products.length > 0 && !w.drop && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {w.products.map((p) => (
                    <button
                      key={p.sku}
                      type="button"
                      className={`btn sm${w.pick === p.sku ? ' primary' : ''}`}
                      onClick={() => patch(i, { pick: p.sku })}
                      title={p.sku}
                    >
                      {p.name} <span style={{ opacity: 0.7 }}>· {p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
              {w.status === 'BAD' && !w.drop && <div className="muted" style={{ fontSize: 13 }}>Không có trong danh mục. Bỏ dòng này rồi hỏi lại khách, hoặc thêm tay ở bảng dòng hàng.</div>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {!w.drop && (
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                    Số lượng
                    <input type="number" min={1} value={w.qtyEdit} onChange={(e) => patch(i, { qtyEdit: e.target.value })} style={{ width: 80 }} />
                    <span className="muted">{w.unit_written ?? ''}</span>
                  </label>
                )}
                <button type="button" className={`btn sm${w.drop ? ' primary' : ''}`} onClick={() => patch(i, { drop: !w.drop })}>
                  {w.drop ? 'Lấy lại dòng' : 'Bỏ dòng'}
                </button>
              </div>
            </div>
          ))}
          {(res.delivery_note || res.note) && (
            <div className="muted" style={{ fontSize: 13 }}>
              Khách dặn: {[res.delivery_note, res.note].filter(Boolean).join('. ')} (sẽ ghi vào ghi chú đơn)
            </div>
          )}
          {work.length > 0 && (
            <button type="button" className="btn primary" disabled={pending > 0 || !customerId || keep.length === 0 || done} onClick={apply}>
              {done
                ? 'Đã đưa vào đơn. Kiểm tra bảng dòng hàng bên dưới.'
                : !customerId
                  ? 'Chọn khách trước'
                  : pending > 0
                    ? `Còn ${pending} dòng cần chọn mã / số lượng hoặc bỏ`
                    : `Đưa ${keep.length} dòng vào đơn`}
            </button>
          )}
        </div>
      )}
      {can('order.approve.normal') && <ZaloThreads customers={customers} />}
    </section>
  );
}

interface ThreadRow {
  thread_id: string;
  name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  enabled: number;
  last_msg_at: string | null;
}

/** Điều phối: các nhóm Zalo số Zalo trợ lý đang ở trong. Gắn nhóm với khách rồi bật thì trợ lý mới đọc đơn nhóm đó. */
function ZaloThreads({ customers }: { customers: Array<{ id: string; name: string }> }) {
  const [show, setShow] = useState(false);
  const list = useApi<ThreadRow[]>(show ? '/api/order-intake/zalo/threads' : null);
  const [err, setErr] = useState<string | null>(null);
  const save = async (t: ThreadRow, patch: { enabled?: boolean; customer_id?: string | null }) => {
    setErr(null);
    try {
      await api.put(`/api/order-intake/zalo/threads/${encodeURIComponent(t.thread_id)}`, patch);
      list.reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Chưa lưu được');
    }
  };
  return (
    <div style={{ borderTop: '1px solid #ddd', paddingTop: 10, display: 'grid', gap: 8 }}>
      <button type="button" className="btn sm" style={{ justifySelf: 'start' }} onClick={() => setShow((v) => !v)}>
        {show ? 'Ẩn nhóm Zalo của trợ lý' : 'Nhóm Zalo trợ lý đọc đơn (Điều phối)'}
      </button>
      {show && (
        <>
          <div className="muted" style={{ fontSize: 13 }}>
            Thêm số Zalo trợ lý vào nhóm của khách, nhắn một tin bất kỳ trong nhóm, nhóm sẽ hiện ở đây. Gắn đúng khách rồi bật. Nhóm chưa bật thì trợ lý không đọc, không trả lời.
          </div>
          {err && <div className="alert-box">{err}</div>}
          {list.loading && <div className="muted">Đang tải…</div>}
          {(list.data ?? []).length === 0 && !list.loading && <div className="muted">Chưa có nhóm nào.</div>}
          {(list.data ?? []).map((t) => (
            <div key={t.thread_id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px' }}>
              <div style={{ flex: 1, minWidth: 160, fontSize: 13 }}>
                <b>{t.name ?? t.thread_id}</b>
                <div className="muted">{t.last_msg_at ? `Tin gần nhất ${hhmm(t.last_msg_at)}` : ''}</div>
              </div>
              <div style={{ minWidth: 200, flex: 1 }}>
                <CustomerSelect
                  value={t.customer_id ?? ''}
                  onChange={(id) => void save(t, { customer_id: id || null })}
                  placeholder="Gắn với khách…"
                  options={customers.map((c) => ({ id: c.id, name: c.name }))}
                />
              </div>
              <button type="button" className={`btn sm${t.enabled ? ' primary' : ''}`} onClick={() => void save(t, { enabled: !t.enabled })}>
                {t.enabled ? 'Đang bật · bấm để tắt' : 'Đang tắt · bấm để bật'}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

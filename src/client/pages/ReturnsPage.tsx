import { CustomerSelect } from '../components/CustomerSelect';
import { useMemo, useState } from 'react';
import type { CustomerListItem, OrderDetail, OrderListItem, ProductItem } from '@shared/types';
import {
  RETURN_CONDITION_LABELS,
  RETURN_RESOLUTION_LABELS,
  RETURN_STATUS_LABELS,
  type ReturnCondition,
  type ReturnDetail,
  type ReturnListItem,
  type ReturnResolution,
  type ReturnStatus,
} from '@shared/returns';
import { formatVnDate, formatVnDateTime } from '@shared/datetime';
import { formatVnd } from '@shared/money';
import { ApiError, api } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { useAuth } from '../components/AuthProvider';
import { Card, ErrorBox, Field, Modal, PageHead, StateBlock, useToast } from '../components/ui';

const STATUS_TONE: Record<ReturnStatus, string> = {
  CHO_KHO: 'warn',
  DA_NHAN_KHO: 'info',
  DA_GIAM_NO: 'ok',
  HUY: 'muted',
};

const FILTERS: Array<{ value: ReturnStatus | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'CHO_KHO', label: RETURN_STATUS_LABELS.CHO_KHO },
  { value: 'DA_NHAN_KHO', label: RETURN_STATUS_LABELS.DA_NHAN_KHO },
  { value: 'DA_GIAM_NO', label: RETURN_STATUS_LABELS.DA_GIAM_NO },
];

/**
 * Hàng trả lại: sale tạo phiếu → kho (kế toán kho) xác nhận đã nhận hàng → kế toán xác nhận giảm công nợ.
 * Thay cho cách cũ là ghi số lượng âm vào đơn: có chứng từ riêng, tồn kho tăng đúng, công nợ giảm có người xác nhận.
 */
export function ReturnsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState<ReturnStatus | ''>('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useApi<ReturnListItem[]>(`/api/returns${status ? `?status=${status}` : ''}`);
  const canCreate = can('order.create') || can('order.create.team') || can('order.kho.process');

  return (
    <div>
      <PageHead
        title="Hàng trả lại"
        subtitle="Khách trả hàng thì làm phiếu ở đây: kho nhận hàng, kế toán xác nhận giảm công nợ."
        actions={
          canCreate ? (
            <button className="btn primary" onClick={() => setCreating(true)}>
              + Tạo phiếu trả hàng
            </button>
          ) : undefined
        }
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            className={`btn ${status === f.value ? 'primary' : ''}`}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <Card bodyClass="">
        <StateBlock
          loading={list.loading}
          error={list.error}
          empty={(list.data ?? []).length === 0}
          emptyText="Chưa có phiếu trả hàng nào."
        >
          <div className="table-wrap">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Ngày</th>
                  <th>Khách hàng</th>
                  <th>Đơn gốc</th>
                  <th className="right">Giá trị</th>
                  <th>Trạng thái</th>
                  <th>Người tạo</th>
                </tr>
              </thead>
              <tbody>
                {(list.data ?? []).map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => setOpenId(r.id)}>
                    <td className="nowrap">
                      <strong>{r.return_no}</strong>
                    </td>
                    <td className="nowrap">{formatVnDate(r.return_date)}</td>
                    <td>{r.customer_name}</td>
                    <td>{r.order_no ?? <span className="muted">—</span>}</td>
                    <td className="right nowrap">
                      {formatVnd(r.status === 'CHO_KHO' || r.status === 'HUY' ? r.claimed_amount : r.credit_amount)}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_TONE[r.status]} nowrap`}>{r.no_collect && r.status === 'DA_NHAN_KHO' ? 'Không thu về, chờ kế toán' : RETURN_STATUS_LABELS[r.status]}</span>
                    </td>
                    <td>{r.created_by_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </Card>
      {creating && (
        <CreateReturnModal
          onClose={() => setCreating(false)}
          onDone={(id) => {
            setCreating(false);
            list.reload();
            setOpenId(id);
          }}
        />
      )}
      {openId && (
        <ReturnModal
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => list.reload()}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Tạo phiếu */
interface DraftLine {
  product_id: string;
  sku: string;
  name: string;
  qty: string;
  unit_price: string;
  max_qty: number | null;
  unit: string | null;
  pack: number;
  /** Trả theo thùng: số lượng nhập là số thùng, quy ra chai/can lẻ = số thùng × quy cách. */
  carton: boolean;
  deduction: string;
}

function packOf(v: string | null | undefined): number {
  const m = String(v ?? '').match(/d+/);
  const n = m ? Number(m[0]) : 1;
  return Number.isFinite(n) && n > 1 ? n : 1;
}
const lineQty = (l: DraftLine) => Number(l.qty || 0) * (l.carton ? l.pack : 1);
const lineAmount = (l: DraftLine) => Math.max(0, Math.round(lineQty(l) * Number(l.unit_price || 0)) - Number(l.deduction || 0));

function CreateReturnModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const toast = useToast();
  const customers = useApi<CustomerListItem[]>('/api/customers?page_size=200');
  const [customerId, setCustomerId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [noCollect, setNoCollect] = useState(false);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orders = useApi<OrderListItem[]>(
    customerId ? `/api/orders?customer_id=${customerId}&limit=100` : null,
  );
  const products = useApi<ProductItem[]>(
    !orderId && customerId && debounced.length >= 2
      ? `/api/products?limit=20&q=${encodeURIComponent(debounced)}`
      : null,
  );

  async function pickOrder(id: string) {
    setOrderId(id);
    setLines([]);
    if (!id) return;
    try {
      const res = await api.get<OrderDetail>(`/api/orders/${id}`);
      setLines(
        res.data.items
          .filter((it) => it.qty > 0)
          .map((it) => ({
            product_id: it.product_id,
            sku: it.sku,
            name: it.product_name,
            qty: '',
            unit_price: String(it.applied_price),
            max_qty: it.qty,
            unit: it.unit ?? null,
            pack: packOf(it.pack_size),
            carton: false,
            deduction: '',
          })),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được đơn gốc');
    }
  }

  async function addProduct(p: ProductItem) {
    if (lines.some((l) => l.product_id === p.id)) return;
    setQuery('');
    // Không chọn đơn gốc: giá tự lấy theo cấp (hoặc bảng giá riêng) của khách; vẫn sửa được.
    let price = '0';
    try {
      const res = await api.get<Record<string, number>>(`/api/returns/price?customer_id=${customerId}&product_ids=${p.id}`);
      if (res.data[p.id] != null) price = String(res.data[p.id]);
    } catch {
      /* không lấy được giá thì để sale gõ */
    }
    setLines((cur) => [...cur, { product_id: p.id, sku: p.sku, name: p.name, qty: '1', unit_price: price, max_qty: null, unit: p.unit, pack: packOf(p.pack_size), carton: false, deduction: '' }]);
  }

  const chosen = lines.filter((l) => Number(l.qty) > 0);
  const total = chosen.reduce((s, l) => s + lineAmount(l), 0);

  async function submit() {
    setError(null);
    if (!customerId) return setError('Chọn khách hàng.');
    if (reason.trim().length < 2) return setError('Ghi lý do trả hàng.');
    if (noCollect && reason.trim().length < 10) return setError('Hàng lỗi không thu về: ghi rõ lý do (hàng gì lỗi, vì sao không gửi trả về).');
    if (chosen.length === 0) return setError('Nhập số lượng trả cho ít nhất một mặt hàng.');
    for (const l of chosen) {
      if (l.max_qty !== null && Number(l.qty) > l.max_qty) {
        return setError(`${l.name}: số lượng trả lớn hơn số đã mua (${l.max_qty}).`);
      }
    }
    setBusy(true);
    try {
      const res = await api.post<ReturnDetail>('/api/returns', {
        customer_id: customerId,
        order_id: orderId || null,
        reason: reason.trim(),
        no_collect: noCollect,
        note: note.trim() || null,
        items: chosen.map((l) => ({
          product_id: l.product_id,
          qty: lineQty(l),
          deduction: Math.round(Number(l.deduction || 0)),
          unit_price: Math.round(Number(l.unit_price || 0)),
        })),
      });
      toast.success(noCollect ? `Đã tạo phiếu ${res.data.return_no}. Hàng không thu về, chờ kế toán xác nhận bù cho khách.` : `Đã tạo phiếu ${res.data.return_no}. Chờ kho nhận hàng.`);
      onDone(res.data.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được phiếu');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Tạo phiếu trả hàng"
      onClose={onClose}
      wide
      footer={
        <>
          <span className="muted" style={{ marginRight: 'auto' }}>
            Giá trị khách trả: <strong>{formatVnd(total)}</strong>
          </span>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          <button className="btn primary" disabled={busy} onClick={submit}>
            {busy ? 'Đang lưu…' : 'Gửi cho kho'}
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="form-grid">
        <Field label="Khách hàng">
          <CustomerSelect
            value={customerId}
            onChange={(id) => {
              setCustomerId(id);
              void pickOrder('');
            }}
            options={(customers.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
          />
        </Field>
        <Field label="Đơn gốc (nếu có)" hint="Chọn đơn thì tự lấy đúng giá bán và chặn trả quá số đã mua.">
          <select value={orderId} disabled={!customerId} onChange={(e) => void pickOrder(e.target.value)}>
            <option value="">— Không chọn đơn —</option>
            {(orders.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.order_no} · {formatVnDate(o.order_date)} · {formatVnd(o.total_amount)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lý do trả hàng" full>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: giao sai quy cách, hàng lỗi…" />
        </Field>
        <Field label="Ghi chú thêm" full>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Hàng lỗi, khách không gửi trả về (công ty bù cho khách)" full>
          <label className="mo-check">
            <input type="checkbox" checked={noCollect} onChange={(e) => setNoCollect(e.target.checked)} />
            Không thu hàng về kho: bỏ qua bước kho nhận, kế toán xác nhận bù thẳng (trừ công nợ hoặc hoàn tiền)
          </label>
        </Field>
      </div>

      {!orderId && customerId && (
        <div style={{ marginTop: 12 }}>
          <Field label="Thêm mặt hàng (gõ tên hoặc mã)">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Gõ ít nhất 2 ký tự" />
          </Field>
          {(products.data ?? []).length > 0 && (
            <div className="suggest" style={{ marginTop: 6 }}>
              {(products.data ?? []).map((p) => (
                <button key={p.id} className="btn sm" style={{ margin: 2 }} onClick={() => addProduct(p)}>
                  {p.sku} · {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {lines.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Mặt hàng</th>
                <th>Quy cách</th>
                <th className="right">Đã mua</th>
                <th className="right">Số lượng trả</th>
                <th className="right">Đơn giá</th>
                <th className="right">Khấu trừ (đ)</th>
                <th className="right">Thành tiền</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.product_id}>
                  <td>
                    {l.name}
                    <div className="muted">{l.sku}</div>
                  </td>
                  <td className="nowrap">{l.pack > 1 ? `${l.pack} ${(l.unit ?? 'chai').toLowerCase()}/thùng` : l.unit ?? '—'}</td>
                  <td className="right">{l.max_qty ?? '—'}</td>
                  <td className="right">
                    <input
                      type="number"
                      min={0}
                      style={{ width: 80, textAlign: 'right' }}
                      value={l.qty}
                      onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                    />
                    {l.pack > 1 && (
                      <select
                        className="select"
                        style={{ width: 80, marginLeft: 4 }}
                        value={l.carton ? 'THUNG' : 'LE'}
                        onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, carton: e.target.value === 'THUNG' } : x)))}
                      >
                        <option value="LE">Lẻ</option>
                        <option value="THUNG">Thùng</option>
                      </select>
                    )}
                    {l.carton && Number(l.qty) > 0 && <div className="muted">= {lineQty(l)} lẻ</div>}
                  </td>
                  <td className="right">
                    <input
                      type="number"
                      min={0}
                      style={{ width: 110, textAlign: 'right' }}
                      value={l.unit_price}
                      readOnly={l.max_qty !== null}
                      onChange={(e) =>
                        setLines(lines.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))
                      }
                    />
                  </td>
                  <td className="right">
                    <input
                      type="number"
                      min={0}
                      style={{ width: 100, textAlign: 'right' }}
                      value={l.deduction}
                      placeholder="0"
                      title="Số tiền trừ bớt (phí, hàng lỗi…), không giảm vào công nợ"
                      onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, deduction: e.target.value } : x)))}
                    />
                  </td>
                  <td className="right nowrap">{formatVnd(lineAmount(l))}</td>
                  <td>
                    {l.max_qty === null && (
                      <button className="btn sm" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                        Bỏ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ Chi tiết + xử lý */
function ReturnModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const detail = useApi<ReturnDetail>(`/api/returns/${id}`);
  const r = detail.data;
  const [rec, setRec] = useState<Record<string, { qty: string; condition: ReturnCondition }>>({});
  const [khoNote, setKhoNote] = useState('');
  const [resolution, setResolution] = useState<ReturnResolution>('TRU_CONG_NO');
  const [acctNote, setAcctNote] = useState('');
  const [acct, setAcct] = useState<Record<string, { unit_price: string; deduction: string }>>({});
  const acctFor = (l: { id: string; unit_price: number; deduction?: number }) =>
    acct[l.id] ?? { unit_price: String(l.unit_price), deduction: String(l.deduction ?? 0) };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recFor = (lineId: string, qty: number) => rec[lineId] ?? { qty: String(qty), condition: 'CON_BAN_DUOC' as ReturnCondition };
  const credit = useMemo(
    () =>
      (r?.items ?? []).reduce((s, l) => s + Math.round(Number(recFor(l.id, l.qty).qty || 0) * l.unit_price), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r, rec],
  );

  const acctCredit = (r?.items ?? []).reduce((s, l) => {
    const q = l.received_qty ?? 0;
    const a = acctFor(l);
    return s + Math.max(0, Math.round(q * Number(a.unit_price || 0)) - (q > 0 ? Number(a.deduction || 0) : 0));
  }, 0);

  async function act(path: string, body: unknown, okText: string) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/returns/${id}/${path}`, body);
      toast.success(okText);
      detail.reload();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xử lý được');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={r ? `Phiếu trả hàng ${r.return_no}` : 'Phiếu trả hàng'} onClose={onClose} wide>
      <StateBlock loading={detail.loading} error={detail.error} empty={!r}>
        {r && (
          <div>
            <ErrorBox message={error} />
            <p>
              <span className={`badge ${STATUS_TONE[r.status]}`}>{r.no_collect && r.status === 'DA_NHAN_KHO' ? 'Không thu về, chờ kế toán' : RETURN_STATUS_LABELS[r.status]}</span>{' '}
              <strong>{r.customer_name}</strong>
              {r.order_no && <> · đơn gốc {r.order_no}</>} · ngày {formatVnDate(r.return_date)}
            </p>
            <p>
              <span className="muted">Lý do:</span> {r.reason}
              {r.note && (
                <>
                  <br />
                  <span className="muted">Ghi chú:</span> {r.note}
                </>
              )}
            </p>

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Mặt hàng</th>
                    <th className="right">Khách báo trả</th>
                    <th className="right">Đơn giá</th>
                    <th className="right">Khấu trừ</th>
                    <th className="right">Kho nhận</th>
                    <th>Tình trạng</th>
                  </tr>
                </thead>
                <tbody>
                  {r.items.map((l) => {
                    const editing = r.status === 'CHO_KHO' && can('order.kho.process');
                    const acctEdit = r.status === 'DA_NHAN_KHO' && can('order.accounting.confirm');
                    const v = recFor(l.id, l.qty);
                    return (
                      <tr key={l.id}>
                        <td>
                          {l.product_name}
                          <div className="muted">{l.sku}</div>
                        </td>
                        <td className="right">{l.qty}</td>
                        <td className="right nowrap">
                          {acctEdit ? (
                            <input
                              type="number"
                              min={0}
                              style={{ width: 100, textAlign: 'right' }}
                              value={acctFor(l).unit_price}
                              onChange={(e) => setAcct({ ...acct, [l.id]: { ...acctFor(l), unit_price: e.target.value } })}
                            />
                          ) : (
                            formatVnd(l.unit_price)
                          )}
                        </td>
                        <td className="right nowrap">
                          {acctEdit ? (
                            <input
                              type="number"
                              min={0}
                              style={{ width: 100, textAlign: 'right' }}
                              value={acctFor(l).deduction}
                              onChange={(e) => setAcct({ ...acct, [l.id]: { ...acctFor(l), deduction: e.target.value } })}
                            />
                          ) : (
                            formatVnd(l.deduction ?? 0)
                          )}
                        </td>
                        <td className="right">
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              max={l.qty}
                              style={{ width: 80, textAlign: 'right' }}
                              value={v.qty}
                              onChange={(e) => setRec({ ...rec, [l.id]: { ...v, qty: e.target.value } })}
                            />
                          ) : (
                            (l.received_qty ?? '—')
                          )}
                        </td>
                        <td>
                          {editing ? (
                            <select
                              value={v.condition}
                              onChange={(e) =>
                                setRec({ ...rec, [l.id]: { ...v, condition: e.target.value as ReturnCondition } })
                              }
                            >
                              {Object.entries(RETURN_CONDITION_LABELS).map(([k, label]) => (
                                <option key={k} value={k}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          ) : l.condition ? (
                            RETURN_CONDITION_LABELS[l.condition]
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: 8 }}>
              Giá trị khách báo: <strong>{formatVnd(r.claimed_amount)}</strong>
              {r.status !== 'CHO_KHO' && r.status !== 'HUY' && (
                <>
                  {' '}
                  · {r.no_collect ? 'Bù cho khách (hàng không thu về):' : 'Giảm công nợ theo số kho nhận:'} <strong>{formatVnd(r.credit_amount)}</strong>
                </>
              )}
              {r.resolution && <> · {RETURN_RESOLUTION_LABELS[r.resolution]}</>}
            </p>

            {r.status === 'CHO_KHO' && can('order.kho.process') && (
              <div className="alert-box" style={{ marginTop: 12 }}>
                <p>
                  Kho kiểm hàng thật rồi ghi số thực nhận và tình trạng từng dòng. Hàng còn bán được sẽ được cộng lại
                  vào tồn kho. Giá trị giảm công nợ dự kiến: <strong>{formatVnd(credit)}</strong>.
                </p>
                <Field label="Ghi chú của kho">
                  <input value={khoNote} onChange={(e) => setKhoNote(e.target.value)} />
                </Field>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() =>
                    act(
                      'receive',
                      {
                        lines: r.items.map((l) => {
                          const v = recFor(l.id, l.qty);
                          return { line_id: l.id, received_qty: Number(v.qty || 0), condition: v.condition };
                        }),
                        note: khoNote.trim() || null,
                      },
                      'Đã ghi nhận kho nhận hàng. Chờ kế toán xác nhận giảm công nợ.',
                    )
                  }
                >
                  Xác nhận đã nhận hàng
                </button>
              </div>
            )}

            {r.status === 'DA_NHAN_KHO' && can('order.accounting.confirm') && (
              <div className="alert-box" style={{ marginTop: 12 }}>
                <Field label="Xử lý tiền cho khách">
                  <select value={resolution} onChange={(e) => setResolution(e.target.value as ReturnResolution)}>
                    {Object.entries(RETURN_RESOLUTION_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ghi chú của kế toán">
                  <input value={acctNote} onChange={(e) => setAcctNote(e.target.value)} />
                </Field>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() =>
                    act(
                      'confirm',
                      {
                        resolution,
                        note: acctNote.trim() || null,
                        lines: r.items.map((l) => ({
                          line_id: l.id,
                          unit_price: Math.round(Number(acctFor(l).unit_price || 0)),
                          deduction: Math.round(Number(acctFor(l).deduction || 0)),
                        })),
                      },
                      `Đã giảm công nợ ${formatVnd(acctCredit)} cho khách.`,
                    )
                  }
                >
                  Xác nhận giảm công nợ {formatVnd(acctCredit)}
                </button>
              </div>
            )}

            {r.status !== 'DA_GIAM_NO' && r.status !== 'HUY' && (
              <p style={{ marginTop: 12 }}>
                <button
                  className="btn sm danger"
                  disabled={busy}
                  onClick={() => {
                    const reason = prompt('Lý do huỷ phiếu:') ?? '';
                    if (reason.trim()) void act('cancel', { reason }, 'Đã huỷ phiếu trả hàng.');
                  }}
                >
                  Huỷ phiếu
                </button>
              </p>
            )}

            <h4 style={{ marginTop: 16 }}>Lịch sử</h4>
            <div className="timeline">
              {r.log.map((g, i) => (
                <div key={i} className="timeline-item">
                  <div>
                    <strong>{LOG_LABELS[g.action] ?? g.action}</strong> · {g.actor_name ?? '—'}
                  </div>
                  <div className="muted">
                    {formatVnDateTime(g.at)}
                    {g.note ? ` · ${g.note}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </StateBlock>
    </Modal>
  );
}

const LOG_LABELS: Record<string, string> = {
  TAO_PHIEU: 'Tạo phiếu',
  KHO_NHAN_HANG: 'Kho nhận hàng',
  KE_TOAN_XAC_NHAN: 'Kế toán xác nhận giảm công nợ',
  HUY_PHIEU: 'Huỷ phiếu',
};

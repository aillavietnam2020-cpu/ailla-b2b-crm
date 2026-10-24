import { hubPeriodRange } from '../lib/hubPeriod';
import { useEffect, useState } from 'react';
import { formatVnDate, vnDate } from '@shared/datetime';
import { formatVnd } from '@shared/money';
import { ApiError, api } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { Card, Field, Modal, PageHead, StateBlock, useToast } from '../components/ui';
import { shrinkImage } from '../lib/image';

interface Voucher {
  id: string;
  voucher_no: string;
  voucher_date: string;
  carrier: string;
  destination: string;
  amount: number;
  method: 'TIEN_MAT' | 'CHUYEN_KHOAN' | 'KHAC';
  order_refs: string;
  note: string;
  status: 'OK' | 'HUY';
  cancel_reason: string | null;
  created_by_name: string | null;
  from_account?: string;
  to_bank?: string;
  to_account_no?: string;
  to_account_name?: string;
  receiver?: string;
  file_count?: number;
}

interface CompanyAccount {
  id: string;
  bank: string;
  account_no: string;
  account_name: string;
  active: number | boolean;
}
const acctLabel = (a: CompanyAccount) => [a.bank, a.account_no, a.account_name].filter(Boolean).join(' · ');

/** Chi tiết hình thức chi để hiện dưới chữ "Chuyển khoản" / "Tiền mặt". */
function methodDetail(v: Voucher): string {
  if (v.method === 'CHUYEN_KHOAN' && (v.from_account || v.to_account_no))
    return `từ ${v.from_account || '?'} → ${[v.to_bank, v.to_account_no, v.to_account_name].filter(Boolean).join(' · ')}`;
  if (v.method === 'TIEN_MAT' && v.receiver) return `người nhận: ${v.receiver}`;
  return '';
}

/** Đọc file thành base64 (ảnh đã thu nhỏ) để gửi lên máy chủ. */
async function fileToPayload(f: File) {
  const small = await shrinkImage(f);
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Không đọc được ' + f.name));
    r.readAsDataURL(small);
  });
  return { name: small.name, mime: small.type || 'image/jpeg', data };
}

/** Ảnh bill chuyển khoản / ảnh phiếu chi tiền mặt có chữ ký của một phiếu: xem, thêm, xóa. */
function FilesModal({ v, onClose, onChanged }: { v: Voucher; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const files = useApi<{ id: string; name: string; mime: string }[]>(`/api/shipping-vouchers/${v.id}/files`);
  const [busy, setBusy] = useState(false);
  const url = (fid: string) => `/api/shipping-vouchers/${v.id}/files/${fid}`;
  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    let n = 0;
    for (const f of Array.from(list)) {
      try {
        await api.post(`/api/shipping-vouchers/${v.id}/files`, await fileToPayload(f));
        n += 1;
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Chưa tải được ' + f.name);
      }
    }
    setBusy(false);
    if (n) toast.success(`Đã tải lên ${n} ảnh`);
    files.reload();
    onChanged();
  }
  async function remove(fid: string) {
    if (!window.confirm('Xóa ảnh này?')) return;
    try {
      await api.delete(`/api/shipping-vouchers/${v.id}/files/${fid}`);
      files.reload();
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Chưa xóa được');
    }
  }
  return (
    <Modal title={`Ảnh bill / phiếu chi · ${v.voucher_no}`} onClose={onClose}>
      <p className="muted">
        {METHOD_LABEL[v.method]} {formatVnd(v.amount)} {methodDetail(v) ? '· ' + methodDetail(v) : ''}
      </p>
      <StateBlock loading={files.loading} error={files.error} empty={(files.data ?? []).length === 0} emptyText="Chưa có ảnh nào.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(files.data ?? []).map((f) => (
            <div key={f.id} style={{ width: 150 }}>
              <a href={url(f.id)} target="_blank" rel="noopener noreferrer">
                {f.mime === 'application/pdf' ? (
                  <span>📄 {f.name || 'file.pdf'}</span>
                ) : (
                  <img src={url(f.id)} alt={f.name} style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                )}
              </a>
              <button className="btn sm" onClick={() => void remove(f.id)}>
                Xóa
              </button>
            </div>
          ))}
        </div>
      </StateBlock>
      <Field label="Thêm ảnh bill chuyển khoản / phiếu chi tiền mặt có chữ ký" full>
        <input type="file" multiple accept="image/*,application/pdf" disabled={busy} onChange={(e) => void upload(e.target.files)} />
      </Field>
    </Modal>
  );
}

const METHOD_LABEL: Record<Voucher['method'], string> = {
  TIEN_MAT: 'Tiền mặt',
  CHUYEN_KHOAN: 'Chuyển khoản',
  KHAC: 'Khác',
};

/** In một phiếu chi: mở cửa sổ in đơn giản (không cần máy chủ). */
function printVoucher(v: Voucher) {
  const w = window.open('', '_blank', 'width=720,height=800');
  if (!w) return;
  const esc = (s: string) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
    );
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(v.voucher_no)}</title>
  <style>body{font:15px Arial,sans-serif;margin:32px;color:#111}h1{text-align:center;margin:0 0 4px}
  .c{text-align:center;color:#555;margin-bottom:24px}td{padding:8px 4px;vertical-align:top}td:first-child{width:180px;color:#444}
  .sig{display:flex;justify-content:space-between;margin-top:56px;text-align:center}.sig div{width:30%}</style>
  <h1>PHIẾU CHI VẬN CHUYỂN</h1><div class="c">Số ${esc(v.voucher_no)} · Ngày ${formatVnDate(v.voucher_date)}</div>
  <table><tr><td>Đơn vị vận chuyển / xe</td><td><b>${esc(v.carrier)}</b></td></tr>
  <tr><td>Nơi giao</td><td>${esc(v.destination || '—')}</td></tr>
  <tr><td>Số tiền</td><td><b>${formatVnd(v.amount)}</b></td></tr>
  <tr><td>Hình thức</td><td>${METHOD_LABEL[v.method]}</td></tr>
  <tr><td>Các đơn xe chở</td><td>${esc(v.order_refs || '—')}</td></tr>
  <tr><td>Ghi chú</td><td>${esc(v.note || '—')}</td></tr></table>
  <div class="sig"><div>Người lập<br><br><br>${esc(v.created_by_name ?? '')}</div><div>Kế toán</div><div>Người nhận tiền</div></div>
  <script>window.onload=()=>window.print()</script>`);
  w.document.close();
}

function csvOf(rows: Voucher[]) {
  const q = (s: string | number) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = [
    'Số phiếu',
    'Ngày',
    'Đơn vị vận chuyển / xe',
    'Nơi giao',
    'Số tiền',
    'Hình thức',
    'Các đơn xe chở',
    'Ghi chú',
    'Người lập',
    'Trạng thái',
  ];
  const lines = rows.map((r) =>
    [
      r.voucher_no,
      r.voucher_date,
      r.carrier,
      r.destination,
      r.amount,
      METHOD_LABEL[r.method],
      r.order_refs,
      r.note,
      r.created_by_name ?? '',
      r.status === 'OK' ? 'Hiệu lực' : 'Đã hủy',
    ]
      .map(q)
      .join(','),
  );
  const blob = new Blob(['﻿' + [head.map(q).join(','), ...lines].join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `phieu-chi-van-chuyen-${vnDate()}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

/**
 * Sổ phiếu chi vận chuyển: chi phí công ty trả cho xe / đơn vị vận chuyển. Một xe chở nhiều đơn NPP thì chỉ ghi MỘT phiếu,
 * không chia theo đơn. Thảo lập là có hiệu lực luôn; kế toán xem để đối chiếu.
 */
export function ShippingVouchersPage() {
  const toast = useToast();
  // Khoảng ngày theo bộ chọn thời gian trên cùng của Trang quản trị.
  const { from, to } = hubPeriodRange();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Voucher | null>(null);
  const qs = new URLSearchParams({ from, to });
  if (q) qs.set('q', q);
  const list = useApi<Voucher[]>(`/api/shipping-vouchers?${qs.toString()}`);
  const meta = list.meta as { can_write?: boolean } | undefined;
  const rows = list.data ?? [];
  const total = rows.filter((r) => r.status === 'OK').reduce((s, r) => s + r.amount, 0);
  const canWrite = meta?.can_write !== false;

  async function cancel(v: Voucher) {
    const reason = window.prompt(`Lý do hủy phiếu ${v.voucher_no} (bắt buộc):`, '');
    if (!reason || reason.trim().length < 3) return;
    try {
      await api.post(`/api/shipping-vouchers/${v.id}/cancel`, { reason: reason.trim() });
      toast.success('Đã hủy phiếu ' + v.voucher_no);
      list.reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Chưa hủy được phiếu');
    }
  }

  return (
    <div>
      <PageHead
        title="Phiếu chi vận chuyển"
        subtitle="Chi phí xe / đơn vị vận chuyển công ty trả. Một xe chở nhiều đơn thì ghi một phiếu, không chia theo đơn."
        actions={
          canWrite ? (
            <button className="btn primary" onClick={() => setCreating(true)}>
              + Lập phiếu chi
            </button>
          ) : undefined
        }
      />
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <input
          type="search"
          placeholder="Tìm số phiếu, xe, nơi giao, mã đơn…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <button className="btn" onClick={() => csvOf(rows)} disabled={!rows.length}>
          Tải Excel (CSV)
        </button>
        <strong style={{ marginLeft: 'auto' }}>Tổng chi: {formatVnd(total)}</strong>
      </div>
      <Card bodyClass="">
        <StateBlock
          loading={list.loading}
          error={list.error}
          empty={rows.length === 0}
          emptyText="Chưa có phiếu chi nào trong khoảng ngày này."
        >
          <div className="table-wrap">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Số phiếu</th>
                  <th>Ngày</th>
                  <th>Đơn vị VC / xe</th>
                  <th>Nơi giao</th>
                  <th className="right">Số tiền</th>
                  <th>Hình thức</th>
                  <th>Các đơn xe chở</th>
                  <th>Ghi chú</th>
                  <th>Người lập</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr
                    key={v.id}
                    style={
                      v.status === 'HUY'
                        ? { opacity: 0.5, textDecoration: 'line-through' }
                        : undefined
                    }
                  >
                    <td className="nowrap">
                      <strong>{v.voucher_no}</strong>
                    </td>
                    <td className="nowrap">{formatVnDate(v.voucher_date)}</td>
                    <td>{v.carrier}</td>
                    <td>{v.destination || <span className="muted">—</span>}</td>
                    <td className="right nowrap">{formatVnd(v.amount)}</td>
                    <td>
                      {METHOD_LABEL[v.method]}
                      {methodDetail(v) && <div className="muted" style={{ fontSize: 12 }}>{methodDetail(v)}</div>}
                    </td>
                    <td>{v.order_refs || <span className="muted">—</span>}</td>
                    <td>{v.status === 'HUY' ? `Đã hủy: ${v.cancel_reason ?? ''}` : v.note}</td>
                    <td>{v.created_by_name ?? '—'}</td>
                    <td className="nowrap">
                      <button className="btn sm" onClick={() => printVoucher(v)}>
                        In
                      </button>{' '}
                      <button className="btn sm" onClick={() => setViewing(v)}>
                        {v.file_count ? `Ảnh (${v.file_count})` : 'Ảnh'}
                      </button>{' '}
                      {canWrite && v.status === 'OK' && (
                        <button className="btn sm danger" onClick={() => void cancel(v)}>
                          Hủy
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
      {viewing && <FilesModal v={viewing} onClose={() => setViewing(null)} onChanged={() => list.reload()} />}
      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            list.reload();
          }}
        />
      )}
    </div>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(vnDate());
  const [carrier, setCarrier] = useState('');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Voucher['method']>('TIEN_MAT');
  const [orders, setOrders] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const accts = useApi<CompanyAccount[]>('/api/receiving-accounts');
  const active = (accts.data ?? []).filter((a) => a.active);
  const [fromAcct, setFromAcct] = useState('');
  const [fromOther, setFromOther] = useState('');
  const [toBank, setToBank] = useState('');
  const [toNo, setToNo] = useState('');
  const [toName, setToName] = useState('');
  const [receiver, setReceiver] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  useEffect(() => {
    if (!fromAcct && active.length) setFromAcct(acctLabel(active[0]));
  }, [active.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const r = await api.post<{ id: string; voucher_no: string }>('/api/shipping-vouchers', {
        voucher_date: date,
        carrier,
        destination,
        amount: Math.round(Number(String(amount).replace(/[.,\s]/g, '')) || 0),
        method,
        order_refs: orders,
        note,
        ...(method === 'CHUYEN_KHOAN'
          ? { from_account: fromAcct === '__x' ? fromOther : fromAcct, to_bank: toBank, to_account_no: toNo, to_account_name: toName }
          : method === 'TIEN_MAT'
            ? { receiver }
            : {}),
      });
      let up = 0;
      for (const f of Array.from(files ?? [])) {
        try {
          await api.post(`/api/shipping-vouchers/${(r.data as { id: string }).id}/files`, await fileToPayload(f));
          up += 1;
        } catch (e) {
          toast.error(e instanceof ApiError ? e.message : 'Chưa tải được ' + f.name);
        }
      }
      toast.success('Đã lập phiếu ' + r.data.voucher_no + (up ? `, kèm ${up} ảnh` : ''));
      onDone();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFields(e.fields ?? {});
      } else setError('Chưa lập được phiếu, thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Lập phiếu chi vận chuyển"
      onClose={onClose}
      footer={
        <button className="btn primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Đang lưu…' : 'Lưu phiếu chi'}
        </button>
      }
    >
      <div className="form-grid">
        <Field label="Ngày chi" error={fields.voucher_date}>
          <input
            type="date"
            value={date}
            max={vnDate()}
            onChange={(e) => setDate(e.target.value || vnDate())}
          />
        </Field>
        <Field label="Số tiền (đ)" error={fields.amount}>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ví dụ 1500000"
          />
        </Field>
        <Field label="Đơn vị vận chuyển / biển số xe" error={fields.carrier} full>
          <input
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="Ví dụ: Xe 29C-123.45 hoặc Nhà xe Hà Thành"
          />
        </Field>
        <Field label="Nơi giao (NPP / tuyến)" full>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} />
        </Field>
        <Field label="Hình thức chi">
          <select value={method} onChange={(e) => setMethod(e.target.value as Voucher['method'])}>
            <option value="TIEN_MAT">Tiền mặt</option>
            <option value="CHUYEN_KHOAN">Chuyển khoản</option>
            <option value="KHAC">Khác</option>
          </select>
        </Field>
        {method === 'CHUYEN_KHOAN' && (
          <>
            <Field label="Chi từ tài khoản công ty" error={fields.from_account} full>
              <select value={fromAcct} onChange={(e) => setFromAcct(e.target.value)}>
                {!active.length && <option value="">— Chưa có tài khoản công ty (thêm ở Cấu hình) —</option>}
                {active.map((a) => (
                  <option key={a.id} value={acctLabel(a)}>
                    {acctLabel(a)}
                  </option>
                ))}
                <option value="__x">Tài khoản khác…</option>
              </select>
            </Field>
            {fromAcct === '__x' && (
              <Field label="Ghi tài khoản chi" full>
                <input value={fromOther} onChange={(e) => setFromOther(e.target.value)} placeholder="Ngân hàng · số tài khoản" />
              </Field>
            )}
            <Field label="Ngân hàng nhận">
              <input value={toBank} onChange={(e) => setToBank(e.target.value)} placeholder="Ví dụ: MB" />
            </Field>
            <Field label="Số tài khoản nhận" error={fields.to_account_no}>
              <input value={toNo} onChange={(e) => setToNo(e.target.value)} />
            </Field>
            <Field label="Tên chủ tài khoản nhận" full>
              <input value={toName} onChange={(e) => setToName(e.target.value)} />
            </Field>
          </>
        )}
        {method === 'TIEN_MAT' && (
          <Field label="Người nhận tiền mặt" full>
            <input value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="Họ tên lái xe / người nhận" />
          </Field>
        )}
        <Field label="Ảnh bill chuyển khoản / ảnh phiếu chi tiền mặt có chữ ký" full>
          <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setFiles(e.target.files)} />
        </Field>
        <Field
          label="Các đơn xe chở (không bắt buộc)"
          hint="Chỉ để tra cứu, ví dụ: DH202610-0023, DH202610-0024"
          full
        >
          <input value={orders} onChange={(e) => setOrders(e.target.value)} />
        </Field>
        <Field label="Ghi chú" full>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}

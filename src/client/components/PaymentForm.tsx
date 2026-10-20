import { useEffect, useMemo, useState } from 'react';
import type { OrderListItem } from '@shared/types';
import { formatVnDate, vnDate } from '@shared/datetime';
import { formatVnd } from '@shared/money';
import { ApiError, api, apiFetch } from '../lib/api';
import { shrinkImage } from '../lib/image';
import { useApi } from '../lib/hooks';
import { useAuth } from './AuthProvider';
import { uploadBills } from './BillUpload';
import { ErrorBox, Modal } from './ui';

interface Account {
  id: string;
  bank: string;
  account_no: string;
  account_name: string;
  active: number;
}

interface BillRead {
  readable: boolean;
  reason?: string;
  amount?: number | null;
  paid_date?: string | null;
  paid_time?: string | null;
  bank_ref?: string | null;
  to_account?: string | null;
  to_name?: string | null;
  content?: string | null;
  sender_name?: string | null;
  note?: string | null;
  account?: { status: 'MATCH' | 'UNKNOWN' | 'NONE'; id?: string; label?: string };
  duplicate?: { customer_name: string; amount: number | null; paid_at: string | null } | null;
}

type Purpose = 'ORDER' | 'DEBT' | 'DEPOSIT';

const PURPOSES: Array<{ key: Purpose; title: string; hint: string }> = [
  { key: 'ORDER', title: 'Thanh toán đơn này', hint: 'Khách trả tiền cho đúng đơn đang mở.' },
  {
    key: 'DEBT',
    title: 'Trả công nợ nhiều đơn',
    hint: 'Khách trả cho đơn này và/hoặc các đơn cũ chưa thanh toán đủ. Chia tiền theo từng đơn.',
  },
  {
    key: 'DEPOSIT',
    title: 'Khách đặt cọc / ứng trước',
    hint: 'Tiền chưa gắn đơn nào, giữ thành số dư có của khách để trừ vào đơn sau.',
  },
];

const EXPLAIN_HINTS: Record<Purpose, string[]> = {
  ORDER: [
    'Khách trả trước một phần, phần còn lại thanh toán sau',
    'Khách chuyển dư, phần dư giữ làm số dư có',
    'Gồm cả tiền trả công nợ đơn cũ',
  ],
  DEBT: ['Khách thanh toán công nợ các đơn cũ', 'Khách trả dồn nhiều đơn trong tháng'],
  DEPOSIT: ['Khách cọc trước cho đơn dự kiến', 'Khách ứng trước tiền hàng'],
};

/**
 * Ghi nhận tiền về kèm bill. Quy trình: chọn ảnh bill (hệ thống đọc sẵn số tiền, ngày, mã giao dịch, tài khoản nhận),
 * chọn mục đích (đơn này / trả nợ nhiều đơn / đặt cọc), giải trình khi lệch, tiền mặt phải có ảnh phiếu thu ký tên.
 */
export function PaymentForm({
  order,
  onClose,
  onDone,
}: {
  order: {
    id: string;
    order_no: string;
    customer_id: string;
    customer_name?: string;
    remaining_amount?: number;
  };
  onClose: () => void;
  onDone: () => void;
}) {
  const { me } = useAuth();
  const remaining = Math.max(0, order.remaining_amount ?? 0);

  const accounts = useApi<Account[]>('/api/receiving-accounts');
  const orders = useApi<OrderListItem[]>(`/api/orders?customer_id=${order.customer_id}&limit=100`);
  const openOrders = useMemo(
    () =>
      (orders.data ?? [])
        .filter((o) => o.approval_status === 'APPROVED' && o.remaining_amount > 0)
        .sort((a, b) => (a.order_date + a.order_no).localeCompare(b.order_date + b.order_no)),
    [orders.data],
  );

  const [files, setFiles] = useState<File[]>([]);
  const [read, setRead] = useState<BillRead | null>(null);
  const [reading, setReading] = useState(false);
  const [method, setMethod] = useState('Chuyển khoản');
  const [amount, setAmount] = useState(String(remaining || ''));
  const [paidAt, setPaidAt] = useState(vnDate());
  const [bankRef, setBankRef] = useState('');
  const [accountId, setAccountId] = useState('');
  const [receiver, setReceiver] = useState(me?.user.display_name ?? '');
  // Mở từ trang khách (không gắn đơn): chỉ có trả công nợ hoặc đặt cọc / ứng trước.
  const noOrder = !order.id;
  const [purpose, setPurpose] = useState<Purpose>(noOrder ? 'DEPOSIT' : 'ORDER');
  const [explanation, setExplanation] = useState('');
  const [note, setNote] = useState('');
  // Công ty miễn ship, khách trả cước nhà xe hộ rồi trừ vào tiền đơn: nhập ngay trong lần ghi tiền về này.
  // Người có quyền kế toán (Thảo làm thay kế toán): xác nhận luôn trong một lần lưu, không phải sang Kho bill bấm tiếp.
  const canConfirm = Boolean(me?.permissions.includes('order.accounting.confirm'));
  const [confirmNow, setConfirmNow] = useState(true);
  const [confirmOrder, setConfirmOrder] = useState(true);
  const [carrierOn, setCarrierOn] = useState(false);
  const [carrierAmt, setCarrierAmt] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Khách chuyển nhiều lần / nhiều tài khoản cho cùng khoản: mỗi dòng thêm = một lần chuyển, lưu thành một khoản riêng.
  const [extra, setExtra] = useState<
    Array<{
      amount: string;
      paidAt: string;
      accountId: string;
      bankRef: string;
      file?: File;
      read?: BillRead | null;
    }>
  >([]);

  const isCash = method === 'Tiền mặt';
  const isTransfer = method === 'Chuyển khoản';
  const firstAmount = Math.round(Number(amount) || 0);
  const extraNums = extra.map((x) => Math.round(Number(x.amount) || 0));
  // Tổng tiền về của phiếu (lần đầu + các lần chuyển thêm).
  const amountNum = firstAmount + extraNums.reduce((a, b) => a + b, 0);

  // Đọc bill ngay khi chọn ảnh đầu tiên (chỉ với chuyển khoản).
  useEffect(() => {
    const first = files[0];
    if (!first || !isTransfer) {
      setRead(null);
      return;
    }
    let cancelled = false;
    // Chọn nhiều ảnh bill cùng lúc: mỗi ảnh sau ảnh đầu là một lần chuyển riêng, đọc và điền sẵn từng dòng.
    const rest = files.slice(1);
    if (rest.length) {
      setExtra(
        rest.map((f) => ({ amount: '', paidAt, accountId: '', bankRef: '', file: f, read: null })),
      );
      void (async () => {
        for (let i = 0; i < rest.length; i++) {
          let r: BillRead | null = null;
          try {
            const small = await shrinkImage(rest[i]!);
            const fd = new FormData();
            fd.set('file', small, small.name);
            r = (await apiFetch<BillRead>('/api/bills/read', { method: 'POST', formData: fd }))
              .data;
          } catch {
            r = { readable: false, reason: 'Chưa đọc được bill này, nhập tay.' };
          }
          if (cancelled) return;
          const got = r;
          setExtra((cur) =>
            cur.map((x, j) =>
              j !== i
                ? x
                : {
                    ...x,
                    read: got,
                    amount: got?.readable && got.amount ? String(got.amount) : x.amount,
                    paidAt: got?.readable && got.paid_date ? got.paid_date : x.paidAt,
                    bankRef: got?.readable && got.bank_ref ? got.bank_ref : x.bankRef,
                    accountId:
                      got?.readable && got.account?.status === 'MATCH' && got.account.id
                        ? got.account.id
                        : x.accountId,
                  },
            ),
          );
        }
      })();
    } else {
      setExtra((cur) => cur.filter((x) => !x.file));
    }
    (async () => {
      setReading(true);
      try {
        const small = await shrinkImage(first);
        const fd = new FormData();
        fd.set('file', small, small.name);
        const res = await apiFetch<BillRead>('/api/bills/read', { method: 'POST', formData: fd });
        if (cancelled) return;
        const r = res.data;
        setRead(r);
        if (r.readable) {
          if (r.amount) setAmount(String(r.amount));
          if (r.paid_date) setPaidAt(r.paid_date);
          if (r.bank_ref) setBankRef(r.bank_ref);
          if (r.account?.status === 'MATCH' && r.account.id) setAccountId(r.account.id);
          if (r.content && !note) setNote(r.content);
        }
      } catch {
        if (!cancelled)
          setRead({ readable: false, reason: 'Chưa đọc được bill tự động. Nhập tay.' });
      } finally {
        if (!cancelled) setReading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, isTransfer]);

  // Phân bổ mặc định cho "thanh toán đơn này".
  const thisAlloc = purpose === 'ORDER' ? amountNum : 0;
  const allocSum = Object.values(alloc).reduce((a, v) => a + (Math.round(Number(v)) || 0), 0);
  const variance = purpose === 'ORDER' ? amountNum !== remaining : false;
  // Trả từng phần (một đơn chuyển nhiều lần, nhiều tài khoản) là bình thường: chỉ cần giải trình khi tiền về DƯ so với đơn.
  const needExplain = purpose === 'DEPOSIT';
  const unallocated = purpose === 'DEBT' ? amountNum - allocSum : 0;

  function autoSplit() {
    let left = amountNum;
    const next: Record<string, string> = {};
    // Đơn đang mở trước, rồi các đơn cũ nhất.
    const ordered = [...openOrders].sort((a, b) =>
      a.id === order.id ? -1 : b.id === order.id ? 1 : 0,
    );
    for (const o of ordered) {
      if (left <= 0) break;
      const take = Math.min(left, o.remaining_amount);
      next[o.id] = String(take);
      left -= take;
    }
    setAlloc(next);
  }

  const blockers: string[] = [];
  if (read?.duplicate) blockers.push('Bill này đã được ghi cho một khoản tiền khác.');
  if (!amountNum || amountNum <= 0) blockers.push('Nhập số tiền.');
  if (needExplain && explanation.trim().length < 5) blockers.push('Cần ghi giải trình.');
  if (isCash && !receiver.trim()) blockers.push('Ghi tên người nhận tiền mặt.');
  if (isCash && files.length === 0) {
    blockers.push('Chụp ảnh phiếu thu có chữ ký.');
  }
  if (extra.some((x) => x.read?.duplicate))
    blockers.push('Có bill đã được ghi trước đó (xem dòng báo đỏ), bỏ dòng đó rồi lưu.');
  if (extra.some((x) => x.file && x.read === null))
    blockers.push('Đang đọc các bill, chờ một chút.');
  if (carrierOn && purpose === 'ORDER') {
    if (!(Math.round(Number(String(carrierAmt).replace(/[.,\s]/g, ''))) > 0))
      blockers.push('Nhập số tiền cước khách trả nhà xe.');
    if (carrierName.trim().length < 2) blockers.push('Ghi tên nhà xe hoặc biển số xe.');
  }
  if (purpose === 'DEBT' && allocSum > amountNum)
    blockers.push('Số chia cho các đơn vượt số tiền về.');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (blockers.length) {
      setError(blockers[0]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const allocations =
        purpose === 'ORDER'
          ? [{ order_id: order.id, amount: thisAlloc }]
          : purpose === 'DEBT'
            ? Object.entries(alloc)
                .map(([order_id, v]) => ({ order_id, amount: Math.round(Number(v)) || 0 }))
                .filter((a) => a.amount > 0)
            : [];
      // Chia phần trả cho đơn này theo từng lần chuyển (lần đầu trước).
      let orderLeft = thisAlloc;
      const takeOrder = (amt: number) => {
        const t = Math.min(amt, Math.max(0, orderLeft));
        orderLeft -= t;
        return t;
      };
      const firstOrderAlloc = purpose === 'ORDER' ? takeOrder(firstAmount) : 0;
      const saved = await api.post<{ id: string }>('/api/payments', {
        customer_id: order.customer_id,
        amount: firstAmount,
        paid_at: paidAt,
        method,
        purpose,
        explanation: explanation.trim() || null,
        bank_ref: isTransfer ? bankRef.trim() || null : null,
        receiving_account_id: isTransfer ? accountId || null : null,
        receiver_name: isCash ? receiver.trim() : null,
        note: note || null,
        // Sale ghi tiền thì chờ kế toán xác nhận ở Kho bill; người có quyền kế toán tick "xác nhận luôn" thì xong ngay
        // (tiền mặt vẫn phải chờ ảnh phiếu thu ký tên).
        accounting_confirmed: canConfirm && confirmNow && !isCash,
        allocations:
          purpose === 'ORDER'
            ? firstOrderAlloc > 0
              ? [{ order_id: order.id, amount: firstOrderAlloc }]
              : []
            : allocations,
      });
      for (let i = 0; i < extra.length; i++) {
        const x = extra[i]!;
        const amt = extraNums[i]!;
        if (amt <= 0) continue;
        const a = purpose === 'ORDER' ? takeOrder(amt) : 0;
        const ex = await api.post<{ id: string }>('/api/payments', {
          customer_id: order.customer_id,
          amount: amt,
          paid_at: x.paidAt || paidAt,
          method,
          purpose,
          explanation: explanation.trim() || null,
          bank_ref: x.bankRef.trim() || null,
          receiving_account_id: x.accountId || null,
          receiver_name: null,
          note: `Lần chuyển ${i + 2}${note ? ' · ' + note : ''}`,
          accounting_confirmed: canConfirm && confirmNow && !isCash,
          allocations: purpose === 'ORDER' && a > 0 ? [{ order_id: order.id, amount: a }] : [],
        });
        if (x.file) {
          try {
            await uploadBills(
              [x.file],
              {
                customerId: order.customer_id,
                orderId: purpose === 'ORDER' ? order.id : null,
                orderNo: order.order_no,
                paymentId: ex.data.id,
                amount: amt,
                paidAt: x.paidAt || paidAt,
                method,
              },
              {
                kind: 'BILL',
                bankRef: x.bankRef.trim() || null,
                toAccount: x.read?.to_account ?? null,
                readJson: x.read ? JSON.stringify(x.read).slice(0, 3500) : null,
              },
            );
          } catch {
            /* khoản đã ghi; ảnh gửi lại sau */
          }
        }
      }
      if (carrierOn && purpose === 'ORDER') {
        try {
          await api.post(`/api/orders/${order.id}/carrier-paid`, {
            amount: Math.round(Number(String(carrierAmt).replace(/[.,\s]/g, ''))),
            carrier: carrierName.trim(),
            note: null,
          });
        } catch (err) {
          setError(
            'Đã ghi tiền về nhưng chưa ghi được cước khách trả hộ: ' +
              (err instanceof ApiError
                ? err.message
                : 'thử lại bằng nút "Khách trả cước hộ" trên đơn.'),
          );
          return;
        }
      }
      // Xác nhận luôn ghi nợ đơn (nếu đơn đủ điều kiện: đã duyệt, đã xuất, đã chốt tiền với đơn theo luồng kho).
      let orderConfirmNote = '';
      if (canConfirm && confirmOrder && purpose === 'ORDER' && order.id) {
        try {
          await api.post(`/api/orders/${order.id}/accounting`, {
            accounting_status: 'DA_XAC_NHAN',
          });
        } catch (err) {
          orderConfirmNote =
            err instanceof ApiError ? err.message : 'Chưa xác nhận được ghi nợ đơn.';
        }
      }
      if (files.length > 0) {
        try {
          await uploadBills(
            isTransfer ? files.slice(0, 1) : files,
            {
              customerId: order.customer_id,
              orderId: purpose === 'ORDER' ? order.id : null,
              orderNo: order.order_no,
              paymentId: saved.data.id,
              amount: firstAmount,
              paidAt,
              method,
            },
            {
              kind: isCash ? 'PHIEU_THU' : 'BILL',
              bankRef: isTransfer ? bankRef.trim() || null : null,
              toAccount: read?.to_account ?? null,
              readJson: read ? JSON.stringify(read).slice(0, 3500) : null,
            },
          );
        } catch {
          setError(
            'Đã ghi nhận tiền về nhưng chưa gửi được ảnh. Gửi lại ảnh trong Kho bill giao dịch.',
          );
          return;
        }
      }
      if (orderConfirmNote) {
        setError(
          `Đã ghi tiền về. Chưa xác nhận ghi nợ đơn vì: ${orderConfirmNote} (xác nhận sau ở trang đơn).`,
        );
        return;
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không ghi nhận được khoản thu');
    } finally {
      setBusy(false);
    }
  }

  const accountOptions = (accounts.data ?? []).filter((a) => a.active);

  return (
    <Modal
      title={
        noOrder
          ? `Phiếu thu · ${order.customer_name ?? ''}`
          : `Tiền về và gửi bill · đơn ${order.order_no}`
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <ErrorBox message={error} />
          <p className="muted">
            Khách <strong>{order.customer_name ?? ''}</strong>
            {noOrder ? (
              <>
                {' '}
                · khách trả tiền không theo đơn mới: chọn trả công nợ các đơn cũ, hoặc đặt cọc / ứng
                trước để trừ vào đơn sau.
              </>
            ) : (
              <>
                {' '}
                · đơn này còn phải thu <strong>{formatVnd(remaining)}</strong>.
              </>
            )}
          </p>

          <div className="form-grid" style={{ marginTop: 10 }}>
            <div className="field">
              <label>Hình thức</label>
              <select
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  setFiles([]);
                  setRead(null);
                }}
              >
                <option>Chuyển khoản</option>
                <option>Tiền mặt</option>
                <option>COD</option>
                <option>Bù trừ công nợ</option>
              </select>
            </div>

            <div className="field">
              <label>
                {isCash
                  ? 'Ảnh phiếu thu có chữ ký người nộp và người nhận *'
                  : isTransfer
                    ? 'Ảnh bill chuyển khoản (nếu có)'
                    : 'Ảnh chứng từ (nếu có)'}
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && (
                <span className="muted" style={{ fontSize: 12 }}>
                  Đã chọn {files.length} file
                </span>
              )}
            </div>
          </div>

          {reading && <div className="alert-box">Đang đọc bill…</div>}
          {read && !reading && (
            <div className={`alert-box ${read.readable ? '' : 'warn'}`} style={{ marginTop: 8 }}>
              {read.readable ? (
                <>
                  <strong>Đã đọc bill:</strong> {read.amount ? formatVnd(read.amount) : '—'}
                  {read.paid_date
                    ? ` · ${formatVnDate(read.paid_date)}${read.paid_time ? ' ' + read.paid_time : ''}`
                    : ''}
                  {read.to_account ? ` · tới TK ${read.to_account}` : ''}. Kiểm lại các ô bên dưới
                  rồi lưu.
                </>
              ) : (
                <>{read.reason ?? read.note ?? 'Không đọc được bill, nhập tay.'}</>
              )}
              {read.readable && read.account?.status === 'MATCH' && (
                <div style={{ color: 'var(--green, #0c7a6b)' }}>
                  Tài khoản nhận hợp lệ: {read.account.label}
                </div>
              )}
              {read.readable && read.account?.status === 'UNKNOWN' && (
                <div className="error">
                  Tài khoản nhận <strong>{read.to_account}</strong> KHÔNG có trong danh sách tài
                  khoản hợp lệ của công ty. Khoản này sẽ được gắn cờ cho kế toán kiểm tra.
                </div>
              )}
              {read.duplicate && (
                <div className="error">
                  Bill này đã được ghi cho khách {read.duplicate.customer_name}
                  {read.duplicate.amount ? ` (${formatVnd(read.duplicate.amount)})` : ''}. Không ghi
                  hai lần.
                </div>
              )}
            </div>
          )}

          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label>{extra.length ? 'Số tiền lần 1 (đồng) *' : 'Số tiền nhận (đồng) *'}</label>
              <input
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Ngày nhận tiền</label>
              <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            {isTransfer && (
              <>
                <div className="field">
                  <label>Số tham chiếu giao dịch</label>
                  <input
                    value={bankRef}
                    onChange={(e) => setBankRef(e.target.value)}
                    placeholder="Mã trên bill"
                  />
                </div>
                <div className="field">
                  <label>Tài khoản nhận (của công ty)</label>
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                    <option value="">— Chọn tài khoản —</option>
                    {accountOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bank} · {a.account_no} · {a.account_name}
                      </option>
                    ))}
                  </select>
                  {accountOptions.length === 0 && (
                    <span className="muted" style={{ fontSize: 12 }}>
                      Chưa có danh sách tài khoản hợp lệ. Nhờ chị Hoa thêm ở Trang quản trị › Cài
                      đặt › Tài khoản nhận tiền.
                    </span>
                  )}
                </div>
              </>
            )}
            {isTransfer && purpose !== 'DEBT' && (
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                {extra.map((x, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginBottom: 6,
                    }}
                  >
                    <strong style={{ minWidth: 52 }}>Lần {i + 2}</strong>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="Số tiền"
                      style={{ width: 140 }}
                      value={x.amount}
                      onChange={(e) =>
                        setExtra(
                          extra.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)),
                        )
                      }
                    />
                    <input
                      type="date"
                      value={x.paidAt}
                      onChange={(e) =>
                        setExtra(
                          extra.map((y, j) => (j === i ? { ...y, paidAt: e.target.value } : y)),
                        )
                      }
                    />
                    <select
                      value={x.accountId}
                      style={{ minWidth: 220 }}
                      onChange={(e) =>
                        setExtra(
                          extra.map((y, j) => (j === i ? { ...y, accountId: e.target.value } : y)),
                        )
                      }
                    >
                      <option value="">— Tài khoản nhận —</option>
                      {accountOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.bank} · {a.account_no}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Mã giao dịch"
                      style={{ width: 130 }}
                      value={x.bankRef}
                      onChange={(e) =>
                        setExtra(
                          extra.map((y, j) => (j === i ? { ...y, bankRef: e.target.value } : y)),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setExtra(extra.filter((_, j) => j !== i))}
                    >
                      Bỏ
                    </button>
                    {x.file && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        Ảnh: {x.file.name}
                        {x.read === null ? ' · đang đọc…' : ''}
                      </span>
                    )}
                    {x.read?.duplicate && (
                      <span className="error" style={{ fontSize: 12 }}>
                        Bill này đã ghi cho {x.read.duplicate.customer_name}, không ghi hai lần.
                      </span>
                    )}
                    {x.read?.readable && x.read.account?.status === 'UNKNOWN' && (
                      <span className="error" style={{ fontSize: 12 }}>
                        Tài khoản {x.read.to_account} không có trong danh sách.
                      </span>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn sm"
                  onClick={() =>
                    setExtra([...extra, { amount: '', paidAt, accountId: '', bankRef: '' }])
                  }
                >
                  + Khách chuyển thêm lần nữa (tài khoản khác)
                </button>
                {extra.length > 0 && (
                  <span className="muted" style={{ marginLeft: 8 }}>
                    Tổng tiền về: <strong>{formatVnd(amountNum)}</strong>
                  </span>
                )}
              </div>
            )}
            {isCash && (
              <div className="field">
                <label>Người nhận tiền mặt *</label>
                <input value={receiver} onChange={(e) => setReceiver(e.target.value)} />
              </div>
            )}
          </div>

          <h4 style={{ margin: '16px 0 6px' }}>Khoản này dùng để</h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {PURPOSES.filter((p) => !noOrder || p.key !== 'ORDER').map((p) => (
              <label
                key={p.key}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  padding: '8px 10px',
                  border: '1px solid var(--line, #e4def0)',
                  borderRadius: 8,
                }}
              >
                <input
                  type="radio"
                  name="purpose"
                  checked={purpose === p.key}
                  onChange={() => setPurpose(p.key)}
                />
                <span>
                  <strong>{p.title}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {p.hint}
                  </div>
                </span>
              </label>
            ))}
          </div>

          {purpose === 'ORDER' && amountNum > 0 && (
            <p
              className={variance && amountNum > remaining ? 'error' : 'muted'}
              style={{ marginTop: 8 }}
            >
              {variance
                ? amountNum < remaining
                  ? `Thu một phần: đơn còn ${formatVnd(remaining - amountNum)} sau khoản này. Khách chuyển nhiều lần thì ghi từng lần một phiếu.`
                  : `Tiền về dư ${formatVnd(amountNum - remaining)} so với đơn: tự trừ các đơn đặt trước khác của khách, rồi nợ cũ; hết nợ cũ thì thành số dư có (công ty nợ khách).`
                : 'Số tiền khớp phần còn phải thu của đơn.'}
            </p>
          )}

          {purpose === 'DEBT' && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <button type="button" className="btn sm" onClick={autoSplit}>
                  Tự chia theo thứ tự (đơn này trước, rồi đơn cũ nhất)
                </button>
                <span className="muted">
                  Đã chia {formatVnd(allocSum)} / {formatVnd(amountNum)}
                  {unallocated > 0
                    ? ` · còn ${formatVnd(unallocated)} chưa chia (giữ làm số dư có)`
                    : ''}
                </span>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Đơn</th>
                      <th>Ngày</th>
                      <th className="right">Còn phải thu</th>
                      <th className="right">Chia vào đơn này</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted">
                          Khách không còn đơn nào chưa thanh toán đủ.
                        </td>
                      </tr>
                    )}
                    {openOrders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <strong>{o.order_no}</strong>
                          {o.id === order.id && <span className="badge blue"> đơn này</span>}
                        </td>
                        <td className="nowrap">{formatVnDate(o.order_date)}</td>
                        <td className="right nowrap">{formatVnd(o.remaining_amount)}</td>
                        <td className="right">
                          <input
                            type="number"
                            min={0}
                            max={o.remaining_amount}
                            value={alloc[o.id] ?? ''}
                            onChange={(e) => setAlloc({ ...alloc, [o.id]: e.target.value })}
                            style={{ width: 130, textAlign: 'right' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {needExplain && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>Giải trình *</label>
              <input
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Vì sao số tiền khác phần còn phải thu / khoản này dùng để làm gì"
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {EXPLAIN_HINTS[purpose].map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="btn sm"
                    onClick={() => setExplanation(h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {purpose === 'ORDER' && order.id && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>
                <input
                  type="checkbox"
                  checked={carrierOn}
                  onChange={(e) => setCarrierOn(e.target.checked)}
                />{' '}
                Có cước nhà xe khách trả hộ, đã trừ vào tiền đơn (công ty miễn ship)
              </label>
              {carrierOn && (
                <div className="form-grid" style={{ marginTop: 8 }}>
                  <div className="field">
                    <label>Số tiền cước khách đã trả nhà xe (đ)</label>
                    <input
                      inputMode="numeric"
                      value={carrierAmt}
                      onChange={(e) => setCarrierAmt(e.target.value)}
                      placeholder="Ví dụ 300000"
                    />
                  </div>
                  <div className="field">
                    <label>Nhà xe / biển số xe</label>
                    <input
                      value={carrierName}
                      onChange={(e) => setCarrierName(e.target.value)}
                      placeholder="Ví dụ: Nhà xe Hà Thành 29C-123.45"
                    />
                  </div>
                  <p className="muted full">
                    Số tiền về ở trên giữ <b>đúng số trong bill</b> (đã trừ cước). Web tự ghi thêm
                    phiếu thu bù trừ cước vào đơn và một phiếu chi vận chuyển, nên tổng đủ tiền đơn
                    mà sao kê ngân hàng vẫn khớp.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="field" style={{ marginTop: 12 }}>
            <label>Ghi chú</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {canConfirm && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>
                <input
                  type="checkbox"
                  checked={confirmNow}
                  onChange={(e) => setConfirmNow(e.target.checked)}
                />{' '}
                Xác nhận luôn tiền về (không cần sang Kho bill)
              </label>
              {purpose === 'ORDER' && order.id && (
                <label>
                  <input
                    type="checkbox"
                    checked={confirmOrder}
                    onChange={(e) => setConfirmOrder(e.target.checked)}
                  />{' '}
                  Xác nhận luôn ghi nợ đơn này (nếu đơn đã xuất kho / chốt tiền)
                </label>
              )}
            </div>
          )}
          <div className="alert-box" style={{ marginTop: 12 }}>
            {canConfirm && confirmNow && !isCash ? (
              <>
                Lưu xong, khoản này được <strong>xác nhận luôn</strong> và trừ vào công nợ. Bill vẫn
                được lưu để đối chiếu sau.
              </>
            ) : (
              <>
                Lưu xong, khoản này ở trạng thái <strong>Chờ kế toán xác nhận</strong>. Kế toán mở
                bill, đối chiếu rồi mới xác nhận (Kho bill giao dịch › Lịch sử giao dịch). Chưa xác
                nhận thì chưa trừ vào công nợ chính thức.
              </>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn primary" disabled={busy || reading}>
            {busy ? 'Đang lưu…' : 'Lưu tiền về, gửi kế toán xác nhận'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

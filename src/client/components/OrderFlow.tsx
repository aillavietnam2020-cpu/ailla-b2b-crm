import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ACTOR_LABELS,
  FLOW_STEPS,
  KHO_LABELS,
  KHO_WAITING,
  type KhoCheckLine,
  type KhoStatus,
} from '@shared/flow';
import type { OrderDetail } from '@shared/types';
import { formatVnDate, formatVnDateTime, vnDate } from '@shared/datetime';
import { formatVnd } from '@shared/money';
import { ApiError, api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useAuth } from './AuthProvider';
import { BillUploadModal } from './BillUpload';
import { Card, ErrorBox, StateBlock, useToast } from './ui';

const ACTION_LABELS: Record<string, string> = {
  GUI_DON: 'Sale gửi đơn',
  GUI_LAI: 'Sale gửi lại sau khi sửa đơn',
  CHUYEN_KHO: 'Điều phối chuyển kho kiểm tồn',
  KHO_BAO_DU: 'Kho báo đủ hàng',
  KHO_BAO_THIEU: 'Kho báo thiếu hàng',
  GIU_CHO_HANG: 'Giữ chờ hàng',
  HANG_VE: 'Tới ngày hàng về',
  DUYET_LICH_XUAT: 'Duyệt + đặt lịch xuất',
  KHO_XUAT: 'Kho xuất hàng',
  SUA_SO_XUAT: 'Kho sửa số thực xuất',
  XAC_NHAN_XUAT: 'Điều phối xác nhận đã xuất',
  CHOT_TIEN: 'Chốt tiền phải thu',
  SUA_DON: 'Sửa đơn',
  HUY_DON: 'Huỷ đơn (kho nhả hàng đã giữ)',
};

/** Tiền tố nhãn: ai đang phải làm bước kế tiếp. */
export function waitingLabel(status: string | undefined): string | null {
  const s = (status ?? 'KHONG') as KhoStatus;
  const who = KHO_WAITING[s];
  return who ? ACTOR_LABELS[who] : null;
}

/** Nhãn một bước trong luồng kho, dùng cho danh sách đơn. */
export function FlowBadge({ status }: { status: string | undefined }) {
  const s = (status ?? 'KHONG') as KhoStatus;
  if (s === 'KHONG') return null;
  const who = waitingLabel(s);
  const tone =
    s === 'THIEU_HANG'
      ? 'red'
      : s === 'DA_CHOT_TIEN'
        ? 'purple'
        : s === 'CHO_HANG'
          ? 'orange'
          : 'blue';
  return (
    <div>
      <span className={`badge ${tone} nowrap`}>{KHO_LABELS[s]}</span>
      {who && (
        <div className="muted" style={{ fontSize: 12 }}>
          Đang chờ: {who}
        </div>
      )}
    </div>
  );
}

function Stepper({ status }: { status: KhoStatus }) {
  const idx = FLOW_STEPS.findIndex((s) => s.statuses.includes(status));
  return (
    <ol
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        listStyle: 'none',
        padding: 0,
        margin: '0 0 12px',
      }}
    >
      {FLOW_STEPS.map((s, i) => {
        const done = idx > i || (status === 'DA_CHOT_TIEN' && i <= idx);
        const cur = i === idx;
        return (
          <li
            key={s.key}
            className={`badge ${cur ? 'orange' : done ? 'green' : ''}`}
            style={{ opacity: cur || done ? 1 : 0.6 }}
          >
            {i + 1}. {s.label}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Tiến trình đơn qua kho và các nút theo vai trò:
 *   Điều phối: chuyển kho kiểm, giữ chờ hàng, duyệt + lịch xuất, xác nhận đã xuất.
 *   Kế toán kho: kiểm tồn báo đủ/thiếu, xuất kho ghi số thực xuất.
 *   Sale: sửa đơn, gửi lại, đối chiếu số thực xuất, chốt tiền, gửi bill.
 */
export function OrderFlowPanel({
  order,
  mode,
  onChanged,
}: {
  order: OrderDetail;
  mode: 'sales' | 'admin';
  onChanged: () => void;
}) {
  const { can, me } = useAuth();
  const toast = useToast();
  const status = (order.kho_status ?? 'KHONG') as KhoStatus;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [showBill, setShowBill] = useState(false);

  const isApprover = can('order.approve.normal');
  const isKho = can('order.kho.process');
  const isOwner = (order as unknown as { owner_id?: string | null }).owner_id === me?.user.id;
  const saleActs = isOwner || isApprover;

  const lines = order.items;
  const khoMap = useMemo(
    () => new Map((order.kho_lines ?? []).map((l) => [l.product_id, l])),
    [order.kho_lines],
  );
  const diff = lines
    .map((i) => ({ ...i, shipped: khoMap.get(i.product_id)?.shipped_qty ?? null }))
    .filter((i) => i.shipped !== null && i.shipped !== i.qty);

  async function run(path: string, body: unknown, ok: string) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/orders/${order.id}/flow/${path}`, body);
      toast.success(ok);
      setNote('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thực hiện được');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'KHONG' || !order.flow_on) return null;
  if (order.approval_status === 'CANCELLED') return null;

  const who = waitingLabel(status);
  const editLink = (
    <Link className="btn" to={`/${mode}/orders/${order.id}/edit`}>
      Sửa đơn
    </Link>
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <Card title="Tiến trình đơn">
        <Stepper status={status} />
        <p style={{ margin: '0 0 8px' }}>
          <strong>{KHO_LABELS[status]}</strong>
          {who && <span className="muted"> · đang chờ {who}</span>}
          {order.need_date && (
            <span className="muted"> · khách cần hàng {formatVnDate(order.need_date)}</span>
          )}
          {order.ship_date && (
            <span className="muted"> · lịch xuất {formatVnDate(order.ship_date)}</span>
          )}
          {order.hold_until && (
            <span className="muted"> · hàng về dự kiến {formatVnDate(order.hold_until)}</span>
          )}
        </p>
        {order.kho_note && <p className="muted">Ghi chú: {order.kho_note}</p>}
        <ErrorBox message={error} />

        {/* Bước 2: điều phối chuyển kho */}
        {status === 'CHO_DIEU_PHOI' && isApprover && (
          <div className="form-grid">
            <div className="field">
              <label>Ngày khách cần hàng</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Ghi chú cho kho (ưu tiên, giao gấp…)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="field full">
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  void run(
                    'to-kho',
                    { need_date: date || null, note: note || null },
                    'Đã chuyển kho kiểm tồn',
                  )
                }
              >
                Chuyển kho kiểm tồn và sắp lịch sản xuất
              </button>
            </div>
          </div>
        )}
        {status === 'CHO_DIEU_PHOI' && !isApprover && (
          <p className="muted">Đơn đã gửi cho quản lý điều phối. Chờ chuyển xuống kho kiểm tồn.</p>
        )}

        {/* Bước 3: kho kiểm tồn */}
        {status === 'CHO_KIEM_KHO' && isKho && (
          <KhoCheckForm
            order={order}
            busy={busy}
            onSubmit={(b) => run('kho-report', b, 'Đã báo kết quả kiểm kho')}
          />
        )}
        {status === 'CHO_KIEM_KHO' && !isKho && (
          <p className="muted">Kế toán kho đang kiểm tồn và sắp lịch sản xuất.</p>
        )}

        {/* Kho báo thiếu / giữ chờ hàng */}
        {(status === 'THIEU_HANG' || status === 'CHO_HANG') && (
          <>
            <ShortageTable order={order} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {saleActs && editLink}
              {saleActs && (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() =>
                    void run('send', { note: note || null }, 'Đã gửi lại cho điều phối')
                  }
                >
                  {isApprover ? 'Gửi kho kiểm lại' : 'Đã báo khách và sửa đơn, gửi lại điều phối'}
                </button>
              )}
              {status === 'THIEU_HANG' && isApprover && (
                <>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    title="Ngày hàng về"
                  />
                  <button
                    className="btn"
                    disabled={busy || !date}
                    onClick={() =>
                      void run(
                        'hold',
                        { hold_until: date, note: note || null },
                        'Đã giữ đơn chờ hàng',
                      )
                    }
                  >
                    Khách chịu chờ: giữ chờ hàng đến ngày này
                  </button>
                </>
              )}
              {status === 'CHO_HANG' && isApprover && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => void run('to-kho', {}, 'Đã chuyển kho kiểm lại')}
                >
                  Chuyển kho kiểm lại ngay
                </button>
              )}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              {status === 'THIEU_HANG'
                ? 'Sale báo khách số hàng thiếu: khách đổi đơn thì sửa đơn rồi gửi lại; khách chịu chờ thì quản lý bấm giữ chờ hàng và làm lệnh sản xuất.'
                : 'Tới ngày hàng về đơn tự quay lại hàng chờ kho kiểm tồn.'}
            </p>
          </>
        )}

        {/* Bước 5: duyệt (kho báo đủ hàng làm ngoài hệ thống cũng được), ngày hẹn xuất nếu có */}
        {(status === 'DU_HANG' || (isApprover && ['CHO_DIEU_PHOI', 'CHO_KIEM_KHO', 'THIEU_HANG', 'CHO_HANG'].includes(status ?? ''))) && (
          <>
            <p className="muted">
              {status === 'DU_HANG'
                ? 'Kho đã báo đủ hàng cho mọi dòng.'
                : 'Kho báo đủ hàng ngoài hệ thống thì duyệt luôn, không cần chờ kho kiểm trên web.'}
              {order.kho_note ? ` Ghi chú kho: ${order.kho_note}` : ''}
            </p>
            {isApprover ? (
              <div className="form-grid">
                <div className="field">
                  <label>Ngày hẹn xuất (nếu có)</label>
                  <input
                    type="date"
                    min={vnDate()}
                    value={date || order.need_date || ''}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Ghi chú cho kho</label>
                  <input value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div className="field full">
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        'approve',
                        { ship_date: date || order.need_date || null, note: note || null },
                        'Đã duyệt, kho giữ hàng cho đơn này',
                      )
                    }
                  >
                    Duyệt đơn
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted">Chờ quản lý điều phối duyệt và đặt lịch xuất.</p>
            )}
          </>
        )}

        {/* Bước 6: kho xuất */}
        {status === 'CHO_XUAT' && isKho && (
          <ShipForm order={order} busy={busy} onSubmit={(b) => run('ship', b, 'Đã ghi xuất kho')} />
        )}
        {status === 'CHO_XUAT' && !isKho && (
          <p className="muted">
            Kho đang giữ hàng cho đơn này, xuất theo lịch{' '}
            {order.ship_date ? formatVnDate(order.ship_date) : ''}.
          </p>
        )}

        {/* Bước 7: xác nhận đã xuất */}
        {status === 'DA_XUAT' && (
          <>
            <DiffTable rows={diff} />
            {diff.length > 0 && (
              <div className="alert-box" style={{ marginTop: 10 }}>
                Kho xuất <strong>lệch số đặt</strong>. Sale phụ trách vào xử lý: báo khách, rồi bấm{' '}
                <strong>Đồng ý số thực xuất</strong> (đơn tự sửa theo số kho xuất, vào công nợ) hoặc tự sửa đơn.
              </div>
            )}
            {saleActs && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {diff.length > 0 && (
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      void run('accept-shipped', {}, 'Đã đồng ý số thực xuất: đơn đã sửa và vào công nợ')
                    }
                  >
                    Đồng ý số thực xuất, vào công nợ
                  </button>
                )}
                {diff.length > 0 && (
                  <Link className="btn" to={`/${mode}/orders/${order.id}/edit`}>
                    Sửa đơn theo ý khách
                  </Link>
                )}
                {diff.length === 0 && (
                  <button className="btn primary" disabled={busy} onClick={() => void run('lock-money', {}, 'Đã chốt tiền phải thu')}>
                    Chốt tiền phải thu {formatVnd(order.total_amount)}
                  </button>
                )}
              </div>
            )}
            {isApprover ? (
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      'confirm-shipped',
                      {},
                      'Đã xác nhận xuất. Số thực xuất đã tự áp vào đơn, sale được báo in lại phiếu',
                    )
                  }
                >
                  Xác nhận đã xuất (số thực xuất tự áp vào đơn, báo sale in lại phiếu)
                </button>
                {can('order.accounting.confirm') && (
                  <button
                    className="btn"
                    style={{ marginLeft: 8 }}
                    disabled={busy}
                    onClick={() =>
                      void run('finish', {}, 'Đã xác nhận xuất, chốt tiền và xác nhận ghi nợ')
                    }
                    title="Làm một lần: xác nhận đã xuất, chốt tiền phải thu và xác nhận ghi nợ (không phải bấm từng bước)"
                  >
                    Xác nhận xuất + chốt tiền + ghi nợ (1 lần bấm)
                  </button>
                )}
              </div>
            ) : (
              <p className="muted">Chờ quản lý điều phối xác nhận đã xuất.</p>
            )}
          </>
        )}

        {/* Bước 8: sale đối chiếu, sửa đơn, chốt tiền */}
        {status === 'CHO_CHOT_TIEN' && (
          <>
            <DiffTable rows={diff} />
            {(order.revisions ?? []).some((r) =>
              (r.reason ?? '').startsWith('Tự áp số thực xuất'),
            ) && (
              <div className="alert-box" style={{ marginTop: 10 }}>
                Kho xuất lệch số đặt nên đơn đã được <strong>tự sửa theo số thực xuất</strong> (xem
                lịch sử sửa đơn). Sale bấm{' '}
                <a href={`/print/orders/${order.id}?type=order`} target="_blank" rel="noreferrer">
                  In phiếu gửi khách
                </a>{' '}
                gửi khách xác nhận lại, rồi chốt tiền.
              </div>
            )}
            {saleActs ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {diff.length > 0 ? (
                  <>
                    <Link className="btn primary" to={`/${mode}/orders/${order.id}/edit`}>
                      Sửa đơn theo số thực xuất
                    </Link>
                    <span className="muted">
                      Sửa đơn cho khớp số thực xuất rồi quay lại chốt tiền.
                    </span>
                  </>
                ) : (
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      void run('lock-money', { note: note || null }, 'Đã chốt tiền phải thu')
                    }
                  >
                    Chốt tiền phải thu {formatVnd(order.total_amount)}
                  </button>
                )}
                {diff.length === 0 && can('order.accounting.confirm') && (
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      void run('finish', { note: note || null }, 'Đã chốt tiền và xác nhận ghi nợ')
                    }
                    title="Chốt tiền phải thu và xác nhận ghi nợ trong một lần bấm"
                  >
                    Chốt tiền + xác nhận ghi nợ (1 lần bấm)
                  </button>
                )}
                <button className="btn" onClick={() => setShowBill(true)}>
                  Gửi bill khách chuyển khoản
                </button>
              </div>
            ) : (
              <p className="muted">Chờ sale đối chiếu số thực xuất và chốt tiền phải thu.</p>
            )}
          </>
        )}

        {status === 'DA_CHOT_TIEN' && (
          <p className="muted">
            Đã chốt tiền phải thu {formatVnd(order.total_amount)}. Chờ kế toán xác nhận ghi nợ.
          </p>
        )}

        {/* Kho phát hiện ghi nhầm / gửi nhầm hàng: sửa số thực xuất, kể cả khi đã chốt tiền */}
        {(isKho || isApprover || can('order.accounting.confirm')) &&
          ['DA_XUAT', 'CHO_CHOT_TIEN', 'DA_CHOT_TIEN'].includes(status) && (
            <CorrectShipped
              order={order}
              busy={busy}
              onSubmit={(body) =>
                run(
                  'correct-shipped',
                  body,
                  'Đã sửa số thực xuất. Tồn kho và đơn đã đổi theo, sale được báo kiểm tra lại tiền',
                )
              }
            />
          )}
      </Card>

      {(order.flow_log ?? []).length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary className="muted" style={{ cursor: 'pointer' }}>
            Lịch sử các bước ({order.flow_log?.length})
          </summary>
          <div className="timeline" style={{ marginTop: 8 }}>
            {(order.flow_log ?? []).map((l) => (
              <div className="event" key={l.id}>
                <p>
                  <strong>{ACTION_LABELS[l.action] ?? l.action}</strong> ·{' '}
                  {l.actor_name ?? 'Hệ thống'} · {formatVnDateTime(l.at)}
                </p>
                {l.note && <small>{l.note}</small>}
              </div>
            ))}
          </div>
        </details>
      )}

      {showBill && (
        <BillUploadModal
          target={{
            customerId: order.customer_id,
            customerName: order.customer_name,
            orderId: order.id,
            orderNo: order.order_no,
            amount: Math.max(0, order.remaining_amount ?? 0),
          }}
          onClose={() => setShowBill(false)}
          onDone={() => {
            setShowBill(false);
            toast.success('Đã gửi bill vào kho bill');
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function CorrectShipped({
  order,
  busy,
  onSubmit,
}: {
  order: OrderDetail;
  busy: boolean;
  onSubmit: (body: unknown) => void;
}) {
  const current = new Map((order.kho_lines ?? []).map((l) => [l.product_id, l.shipped_qty]));
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const value = (i: { product_id: string; qty: number }) =>
    qty[i.product_id] ?? String(current.get(i.product_id) ?? i.qty);
  const changed = order.items.filter(
    (i) => Number(value(i)) !== (current.get(i.product_id) ?? i.qty),
  );
  return (
    <details style={{ marginTop: 12 }}>
      <summary className="muted" style={{ cursor: 'pointer' }}>
        Kho ghi nhầm / gửi nhầm hàng? Sửa số thực xuất
      </summary>
      <div style={{ marginTop: 8 }}>
        <p className="muted">
          Sửa được cả khi đã chốt tiền hoặc kế toán đã xác nhận. Tồn kho đổi ngay theo số mới; đơn
          tự áp số mới; đơn quay lại bước chốt tiền, kế toán xác nhận lại; sale được báo kiểm tra
          lại tiền với khách. Mã khách nhận khác mã trên đơn thì nhờ sale bấm Sửa đơn thêm mã đó
          trước.
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Sản phẩm</th>
                <th className="right">Đang ghi xuất</th>
                <th className="right">Số thực xuất đúng</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.product_id}>
                  <td>
                    <strong>{i.sku}</strong>
                  </td>
                  <td>{i.product_name}</td>
                  <td className="right">{current.get(i.product_id) ?? i.qty}</td>
                  <td className="right">
                    <input
                      type="number"
                      min={0}
                      value={value(i)}
                      onChange={(e) => setQty({ ...qty, [i.product_id]: e.target.value })}
                      style={{ width: 100, textAlign: 'right' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="form-grid" style={{ marginTop: 10 }}>
          <div className="field full">
            <label>
              Lý do sửa (bắt buộc, ví dụ: gửi nhầm 2 thùng hương hoa thay vì hương chanh)
            </label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="field full">
            <button
              className="btn primary"
              disabled={busy || changed.length === 0 || reason.trim().length < 5}
              onClick={() =>
                onSubmit({
                  lines: changed.map((i) => ({
                    product_id: i.product_id,
                    shipped_qty: Math.max(0, Math.floor(Number(value(i)) || 0)),
                  })),
                  reason: reason.trim(),
                })
              }
            >
              Lưu số thực xuất mới ({changed.length} mã đổi)
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}

function DiffTable({
  rows,
}: {
  rows: Array<{ sku: string; product_name: string; qty: number; shipped: number | null }>;
}) {
  if (rows.length === 0) {
    return <p className="muted">Số thực xuất khớp số trên đơn.</p>;
  }
  return (
    <div>
      <div className="alert-box warn">
        Số thực xuất lệch số trên đơn ở {rows.length} mã. Cần sửa đơn cho khớp rồi chốt tiền.
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Sản phẩm</th>
              <th className="right">Trên đơn</th>
              <th className="right">Thực xuất</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sku}>
                <td>
                  <strong>{r.sku}</strong>
                </td>
                <td>{r.product_name}</td>
                <td className="right">{r.qty}</td>
                <td className="right">
                  <strong>{r.shipped ?? 0}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShortageTable({ order }: { order: OrderDetail }) {
  const map = new Map((order.kho_lines ?? []).map((l) => [l.product_id, l]));
  const rows = order.items.filter((i) => map.get(i.product_id)?.status === 'THIEU');
  if (rows.length === 0) return null;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Sản phẩm</th>
            <th className="right">Khách đặt</th>
            <th className="right">Kho giao được</th>
            <th className="right">Thiếu</th>
            <th>Dự kiến có hàng</th>
            <th>Ghi chú kho</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => {
            const l = map.get(i.product_id)!;
            return (
              <tr key={i.product_id}>
                <td>
                  <strong>{i.sku}</strong>
                </td>
                <td>{i.product_name}</td>
                <td className="right">{i.qty}</td>
                <td className="right">{l.ok_qty ?? 0}</td>
                <td className="right">
                  <strong className="error">{i.qty - (l.ok_qty ?? 0)}</strong>
                </td>
                <td>{l.eta_date ? formatVnDate(l.eta_date) : '—'}</td>
                <td>{l.note ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface LineDraft {
  status: 'DU' | 'THIEU';
  ok_qty: string;
  eta_date: string;
  note: string;
}

/** Kế toán kho: xem tồn từng dòng (thành phẩm, đã giữ, khả năng sản xuất) rồi báo đủ/thiếu. */
function KhoCheckForm({
  order,
  busy,
  onSubmit,
}: {
  order: OrderDetail;
  busy: boolean;
  onSubmit: (body: unknown) => void;
}) {
  const check = useApi<{ lines: KhoCheckLine[]; stock_ready: boolean }>(
    `/api/orders/${order.id}/kho-check`,
  );
  const [draft, setDraft] = useState<Record<string, LineDraft>>({});
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!check.data) return;
    const next: Record<string, LineDraft> = {};
    for (const l of check.data.lines) {
      const short = l.misa_code ? l.short > 0 : false;
      const okKho = Math.max(0, l.available);
      next[l.product_id] = {
        status: short ? 'THIEU' : 'DU',
        ok_qty: short ? String(Math.max(0, Math.floor(okKho / (l.factor || 1)))) : '',
        eta_date: '',
        note: '',
      };
    }
    setDraft(next);
  }, [check.data]);

  const set = (id: string, patch: Partial<LineDraft>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const submit = () => {
    const lines = (check.data?.lines ?? []).map((l) => {
      const d = draft[l.product_id];
      return {
        product_id: l.product_id,
        status: d.status,
        ok_qty: d.status === 'THIEU' ? Math.max(0, Math.floor(Number(d.ok_qty) || 0)) : null,
        eta_date: d.status === 'THIEU' && d.eta_date ? d.eta_date : null,
        note: d.note || null,
      };
    });
    onSubmit({ lines, note: note || null });
  };

  return (
    <StateBlock loading={check.loading} error={check.error} empty={false}>
      {check.data && !check.data.stock_ready && (
        <div className="alert-box warn">
          Kho chưa bật trừ tồn theo đơn B2B (chưa đặt ngày bắt đầu), số tồn bên dưới có thể chưa
          phản ánh đơn đã xuất.
        </div>
      )}
      <div className="table-wrap">
        <table className="data wide">
          <thead>
            <tr>
              <th>Mã · sản phẩm</th>
              <th className="right">Cần</th>
              <th className="right">Tồn kho</th>
              <th className="right">Đã giữ cho đơn khác</th>
              <th className="right">Còn dùng</th>
              <th className="right">Thiếu</th>
              <th>Làm thêm được (theo định mức)</th>
              <th>Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {(check.data?.lines ?? []).map((l) => {
              const d = draft[l.product_id];
              if (!d) return null;
              return (
                <tr key={l.product_id}>
                  <td>
                    <strong>{l.sku}</strong>
                    <div className="muted">{l.name}</div>
                    {l.misa_code ? (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Mã kho {l.misa_code}
                        {l.factor !== 1 ? ` · 1 = ${l.factor} đơn vị kho` : ''}
                      </div>
                    ) : (
                      <div className="error" style={{ fontSize: 12 }}>
                        Chưa đồng bộ mã kho, tự kiểm bằng tay
                      </div>
                    )}
                  </td>
                  <td className="right">{l.need_kho}</td>
                  <td className="right">{l.misa_code ? l.stock : '—'}</td>
                  <td className="right">{l.misa_code ? l.reserved : '—'}</td>
                  <td className="right">{l.misa_code ? l.available : '—'}</td>
                  <td className="right">
                    {l.misa_code ? (
                      <strong className={l.short > 0 ? 'error' : ''}>{l.short}</strong>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {l.short > 0 ? (
                      l.can_make === null ? (
                        <span className="muted">Chưa có định mức</span>
                      ) : l.missing_components.length === 0 ? (
                        <span className="badge green">Đủ vật tư làm thêm {l.can_make}</span>
                      ) : (
                        <div>
                          <span className="badge orange">Làm thêm được {l.can_make}</span>
                          <div className="error" style={{ fontSize: 12 }}>
                            Thiếu:{' '}
                            {l.missing_components
                              .map((m) => `${m.name} (cần ${m.need}, có ${m.have} ${m.unit})`)
                              .join('; ')}
                          </div>
                        </div>
                      )
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ minWidth: 230 }}>
                    <select
                      value={d.status}
                      onChange={(e) =>
                        set(l.product_id, { status: e.target.value as 'DU' | 'THIEU' })
                      }
                    >
                      <option value="DU">Đủ hàng</option>
                      <option value="THIEU">Thiếu hàng</option>
                    </select>
                    {d.status === 'THIEU' && (
                      <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
                        <input
                          type="number"
                          min={0}
                          max={l.qty - 1}
                          value={d.ok_qty}
                          onChange={(e) => set(l.product_id, { ok_qty: e.target.value })}
                          placeholder={`Giao được (trên ${l.qty})`}
                        />
                        <input
                          type="date"
                          value={d.eta_date}
                          onChange={(e) => set(l.product_id, { eta_date: e.target.value })}
                          title="Ngày dự kiến có hàng / lịch sản xuất"
                        />
                        <input
                          value={d.note}
                          onChange={(e) => set(l.product_id, { note: e.target.value })}
                          placeholder="Ghi chú (sản xuất xong ngày…)"
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="form-grid" style={{ marginTop: 10 }}>
        <div className="field full">
          <label>Ghi chú cho điều phối</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="field full">
          <button className="btn primary" disabled={busy || !check.data} onClick={submit}>
            Báo kết quả kiểm kho cho điều phối
          </button>
        </div>
      </div>
    </StateBlock>
  );
}

/** Kế toán kho ghi số thực xuất từng mã (mặc định bằng số trên đơn). Kho trừ tồn theo số này. */
function ShipForm({
  order,
  busy,
  onSubmit,
}: {
  order: OrderDetail;
  busy: boolean;
  onSubmit: (body: unknown) => void;
}) {
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.items.map((i) => [i.product_id, String(i.qty)])),
  );
  const [note, setNote] = useState('');
  const [shipDay, setShipDay] = useState('');
  const [shipBy, setShipBy] = useState('');
  const [shipErr, setShipErr] = useState<string | null>(null);
  const anyDiff = order.items.some((i) => Number(qty[i.product_id]) !== i.qty);
  return (
    <div>
      <p className="muted">Ghi số thực xuất của từng mã. Kho trừ tồn đúng theo số này.</p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Sản phẩm</th>
              <th className="right">Trên đơn</th>
              <th className="right">Thực xuất</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.product_id}>
                <td>
                  <strong>{i.sku}</strong>
                </td>
                <td>{i.product_name}</td>
                <td className="right">{i.qty}</td>
                <td className="right">
                  <input
                    type="number"
                    min={0}
                    value={qty[i.product_id] ?? ''}
                    onChange={(e) => setQty({ ...qty, [i.product_id]: e.target.value })}
                    style={{ width: 100, textAlign: 'right' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-grid" style={{ marginTop: 10 }}>
        <div className="field">
          <label>Ngày xuất kho</label>
          <input type="date" value={shipDay} max={vnDate()} onChange={(e) => setShipDay(e.target.value)} />
        </div>
        <div className="field">
          <label>Người xuất kho (tự điền tên)</label>
          <input value={shipBy} onChange={(e) => setShipBy(e.target.value)} placeholder="Họ tên người xuất hàng" />
        </div>
        <div className="field full">
          <label>Ghi chú xuất kho {anyDiff ? '(đang lệch số trên đơn, ghi rõ lý do)' : ''}</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="field full">
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => {
              if (!shipDay) return setShipErr('Phải chọn ngày xuất kho (ngày hàng thực sự rời kho).');
              if (shipBy.trim().length < 2) return setShipErr('Người xuất kho phải tự ghi tên mình.');
              setShipErr(null);
              onSubmit({
                lines: order.items.map((i) => ({
                  product_id: i.product_id,
                  shipped_qty: Math.max(0, Math.floor(Number(qty[i.product_id]) || 0)),
                })),
                note: note || null,
                ship_day: shipDay,
                shipped_by_name: shipBy.trim(),
              });
            }}
          >
            Xác nhận đã xuất kho
          </button>
          {shipErr && <p className="error">{shipErr}</p>}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import type {
  ApprovalItem,
  OrderDetail,
  OrderListItem,
  OrderRevision,
  OrderRevisionSnapshot,
} from '@shared/types';
import { formatVnDate, formatVnDateTime } from '@shared/datetime';
import type { Permission } from '@shared/permissions';
import { formatVnd, formatVndNumber } from '@shared/money';
import { ApiError, api } from '../lib/api';
import { useApi } from '../lib/hooks';
import {
  Card,
  Field,
  Modal,
  orderStage,
  OrderStatusBadges,
  StateBlock,
  useToast,
} from '../components/ui';
import { useAuth } from '../components/AuthProvider';
import { OrderFlowPanel } from '../components/OrderFlow';
import { ProposalsCard } from '../components/Proposals';
import { PaymentForm } from '../components/PaymentForm';
import { ShipInfoModal } from '../components/ShipInfoModal';
import { KHO_LABELS, KHO_WAITING, type KhoStatus } from '@shared/flow';

export function OrdersPage({ mode }: { mode: 'sales' | 'admin' }) {
  const { can, me } = useAuth();
  const [stage, setStage] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [onlyMine, setOnlyMine] = useState(false);
  const [khoFilter, setKhoFilter] = useState('');
  const [flowKey, setFlowKey] = useState(0);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [psxBusy, setPsxBusy] = useState(false);
  const [psxMsg, setPsxMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const orderQs = new URLSearchParams();
  if (q) orderQs.set('q', q);
  orderQs.set('limit', '500');
  if (khoFilter) orderQs.set('kho_status', khoFilter);
  const orders = useApi<OrderListItem[]>(
    `/api/orders${orderQs.size ? `?${orderQs.toString()}` : ''}`,
  );
  const summary = useApi<{
    counts: Record<string, number>;
    shortages: Array<{
      sku: string;
      name: string;
      short: number;
      orders: number;
      eta: string | null;
    }>;
    enabled: boolean;
  }>(`/api/orders/flow/summary?_=${flowKey}`);
  const approvals = useApi<ApprovalItem[]>(
    can('order.approve.normal') ? '/api/approvals?status=PENDING' : null,
  );

  const makeProduction = async (skus: string[]) => {
    if (!skus.length || psxBusy) return;
    setPsxBusy(true);
    setPsxMsg(null);
    try {
      const { data: r } = await api.post<{
        created: Array<{ sku: string; code: string; qty: number }>;
        skipped: Array<{ sku: string; reason: string; code?: string }>;
      }>('/api/orders/flow/production-requests', { items: skus.map((sku) => ({ sku })) });
      const parts: string[] = [];
      if (r.created.length) {
        parts.push(
          `Đã tạo ${r.created.length} phiếu sản xuất: ${r.created.map((c) => `${c.code} (${c.sku}, ${c.qty})`).join('; ')}.`,
        );
      }
      if (r.skipped.length) {
        parts.push(
          `Bỏ qua ${r.skipped.length} mã: ${r.skipped.map((k) => `${k.sku} - ${k.reason}${k.code ? ` (${k.code})` : ''}`).join('; ')}.`,
        );
      }
      setPsxMsg({ ok: r.created.length > 0, text: parts.join(' ') });
      setPicked(new Set());
    } catch (e) {
      setPsxMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : 'Chưa tạo được lệnh sản xuất, thử lại sau.',
      });
    } finally {
      setPsxBusy(false);
    }
  };
  const shortList = summary.data?.shortages ?? [];
  // Hàng nút trạng thái có số đếm (học Pancake): mỗi đơn đúng một trạng thái, bấm để lọc.
  const allOrders = orders.data ?? [];
  const stageOf = (o: OrderListItem) => orderStage(o);
  const stageCounts = new Map<string, { n: number; tone: string }>();
  for (const o of allOrders) {
    const st = stageOf(o);
    const cur = stageCounts.get(st.label);
    stageCounts.set(st.label, { n: (cur?.n ?? 0) + 1, tone: st.tone });
  }
  const todos = new Map(allOrders.map((o) => [o.id, todoOf(o, can, me?.user.id)]));
  const mineCount = allOrders.filter((o) => todos.get(o.id)).length;
  const byStage = stage ? allOrders.filter((o) => stageOf(o).label === stage) : allOrders;
  const shownOrders = onlyMine ? byStage.filter((o) => todos.get(o.id)) : byStage;
  const chosen = shownOrders.filter((o) => sel.has(o.id));
  const allChosen = shownOrders.length > 0 && chosen.length === shownOrders.length;
  const printMany = (type: 'ship' | 'order') => {
    if (chosen.length > 10) {
      alert('Mỗi lần in tối đa 10 đơn. Chị chọn ít đơn hơn.');
      return;
    }
    chosen.forEach((o) => window.open(`/print/orders/${o.id}?type=${type}`, '_blank'));
  };
  const exportCsv = () => {
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Mã đơn', 'Khách hàng', 'SĐT', 'Sale', 'Ngày', 'Sản phẩm', 'Tổng phải thu', 'Còn phải thu', 'Trạng thái'];
    const rows = chosen.map((o) => [o.order_no, o.customer_name, o.customer_phone ?? '', o.owner_name ?? '', o.order_date, o.items_text ?? '', o.total_amount, o.remaining_amount, stageOf(o).label]);
    const csv = '\uFEFF' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `don-hang-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="page-head">
        <div className="stagebar" role="tablist" aria-label="Lọc đơn theo trạng thái">
        <button type="button" className={`stagechip${stage === '' && !onlyMine ? ' on' : ''}`} onClick={() => { setStage(''); setOnlyMine(false); }}>
          Tất cả <b>{allOrders.length}</b>
        </button>
        {mineCount > 0 && (
          <button type="button" className={`stagechip mine${onlyMine ? ' on' : ''}`} onClick={() => { setOnlyMine(!onlyMine); setStage(''); }} title="Các đơn đang chờ chính bạn duyệt, xác nhận hoặc xử lý">
            Cần tôi xử lý <b>{mineCount}</b>
          </button>
        )}
        {[...stageCounts.entries()]
          .sort((a, b) => b[1].n - a[1].n)
          .map(([label, v]) => (
            <button
              type="button"
              key={label}
              className={`stagechip ${v.tone}${stage === label ? ' on' : ''}`}
              onClick={() => setStage(stage === label ? '' : label)}
            >
              <i /> {label} <b>{v.n}</b>
            </button>
          ))}
        </div>
        <div className="actions">
          <input
            className="input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã đơn, tên khách, SĐT, sản phẩm…"
            aria-label="Tìm đơn hàng"
            style={{ minWidth: 260 }}
          />
          {can('order.create') && (
            <Link className="btn primary" to="/sales/orders/new">
              Tạo đơn hàng
            </Link>
          )}
        </div>
      </div>

      <ProposalsCard mode={mode} />


      <FlowChips
        counts={summary.data?.counts ?? {}}
        active={khoFilter}
        onPick={setKhoFilter}
        enabled={summary.data?.enabled}
        onToggled={() => setFlowKey((k) => k + 1)}
      />

      {can('order.approve.normal') && (summary.data?.shortages ?? []).length > 0 && (
        <Card
          title={`Mã đang thiếu, cần làm lệnh sản xuất (${summary.data?.shortages.length})`}
          bodyClass=""
          action={
            <button
              className="btn sm primary"
              disabled={psxBusy || picked.size === 0}
              onClick={() => makeProduction([...picked])}
            >
              {psxBusy ? 'Đang tạo…' : `Tạo lệnh sản xuất (${picked.size})`}
            </button>
          }
        >
          {psxMsg && (
            <p
              className={psxMsg.ok ? 'success' : 'error'}
              style={{ padding: '8px 12px', margin: 0 }}
            >
              {psxMsg.text}
            </p>
          )}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả mã thiếu"
                      checked={shortList.length > 0 && picked.size === shortList.length}
                      onChange={(e) =>
                        setPicked(
                          e.target.checked ? new Set(shortList.map((x) => x.sku)) : new Set(),
                        )
                      }
                    />
                  </th>
                  <th>Mã</th>
                  <th>Sản phẩm</th>
                  <th className="right">Đang thiếu</th>
                  <th className="right">Số đơn</th>
                  <th>Kho dự kiến có hàng</th>
                </tr>
              </thead>
              <tbody>
                {(summary.data?.shortages ?? []).map((s) => (
                  <tr key={s.sku}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${s.sku}`}
                        checked={picked.has(s.sku)}
                        onChange={(e) =>
                          setPicked((prev) => {
                            const n = new Set(prev);
                            if (e.target.checked) n.add(s.sku);
                            else n.delete(s.sku);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td>
                      <strong>{s.sku}</strong>
                    </td>
                    <td>{s.name}</td>
                    <td className="right">
                      <strong className="error">{s.short}</strong>
                    </td>
                    <td className="right">{s.orders}</td>
                    <td>{s.eta ? formatVnDate(s.eta) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {chosen.length > 0 && (
        <div className="selbar">
          <b>Đã chọn {chosen.length} đơn</b>
          <button className="btn sm" onClick={() => printMany('ship')}>In phiếu xuất kho</button>
          <button className="btn sm" onClick={() => printMany('order')}>In phiếu gửi khách</button>
          <button className="btn sm" onClick={exportCsv}>Tải Excel (CSV)</button>
          <button className="btn sm" onClick={() => setSel(new Set())}>Bỏ chọn</button>
        </div>
      )}

      <div style={{ height: 6 }} />

      {can('order.approve.normal') && (approvals.loading || approvals.error || (approvals.data ?? []).length > 0) && (
        <Card
          title={`Yêu cầu chờ duyệt (${approvals.data?.length ?? 0})`}
          bodyClass=""
          action={
            <button className="btn sm" onClick={approvals.reload}>
              Làm mới
            </button>
          }
        >
          <StateBlock
            loading={approvals.loading}
            error={approvals.error}
            empty={(approvals.data ?? []).length === 0}
            emptyText="Không có yêu cầu nào đang chờ."
          >
            <ApprovalTable
              approvals={approvals.data ?? []}
              onDecided={() => {
                approvals.reload();
                orders.reload();
              }}
            />
          </StateBlock>
        </Card>
      )}

      <div style={{ height: 18 }} />

      <Card bodyClass="">
        <StateBlock
          loading={orders.loading}
          error={orders.error}
          empty={shownOrders.length === 0}
          emptyText="Chưa có đơn hàng nào."
        >
          <div className="table-wrap">
            <table className="data wide">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả đơn đang hiện"
                      checked={allChosen}
                      onChange={(e) => setSel(e.target.checked ? new Set(shownOrders.map((o) => o.id)) : new Set())}
                    />
                  </th>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>SĐT</th>
                  {mode === 'admin' && <th>Sale</th>}
                  <th>Ngày</th>
                  <th className="right">Tổng phải thu (đ)</th>
                  <th className="right">Còn phải thu (đ)</th>
                  <th>Cập nhật</th>
                  <th>Cần làm</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {shownOrders.map((order) => (
                  <tr key={order.id} className={sel.has(order.id) ? 'picked' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${order.order_no}`}
                        checked={sel.has(order.id)}
                        onChange={(e) =>
                          setSel((prev) => {
                            const n = new Set(prev);
                            if (e.target.checked) n.add(order.id);
                            else n.delete(order.id);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td>
                      <Link to={`/${mode}/orders/${order.id}`} className="rowlink">
                        {order.order_no}
                      </Link>
                    </td>
                    <td className="nw" title={order.customer_name}>{order.customer_name}</td>
                    <td className="nowrap">{order.customer_phone ?? ''}</td>
                    {mode === 'admin' && <td className="nw" title={order.owner_name ?? ''}>{order.owner_name ?? '—'}</td>}
                    <td className="nowrap">{formatVnDate(order.order_date)}</td>
                    <td className="right nowrap">{formatVndNumber(order.total_amount)}</td>
                    <td className="right nowrap">{formatVndNumber(order.remaining_amount)}</td>
                    <td className="nowrap muted">{order.updated_at ? formatVnDateTime(order.updated_at) : ''}</td>
                    <td>
                      <TodoCell order={order} mode={mode} onDone={() => orders.reload()} todo={todos.get(order.id) ?? null} />
                    </td>
                    <td>
                      <QuickActions order={order} mode={mode} onDone={() => orders.reload()} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </Card>
    </>
  );
}

interface PriceChangePayload {
  sku?: string;
  product_name?: string;
  tier_name?: string;
  old_amount?: number | null;
  new_amount?: number | null;
  valid_from?: string;
}

/** Nội dung một đề nghị đổi giá: sản phẩm, cấp, giá cũ → giá mới, ngày hiệu lực. */
function PriceChange({ payload }: { payload: PriceChangePayload }) {
  const money = (v: number | null | undefined) => (v === null || v === undefined ? 'Chưa có' : `${v.toLocaleString('vi-VN')} đ`);
  const up = payload.old_amount != null && payload.new_amount != null ? payload.new_amount - payload.old_amount : null;
  return (
    <div>
      <strong>
        {payload.sku} · {payload.product_name}
      </strong>
      <div>
        <span className="badge purple">{payload.tier_name}</span>{' '}
        <span className="muted">{money(payload.old_amount)}</span> →{' '}
        <strong>{payload.new_amount === null || payload.new_amount === undefined ? 'Xóa giá' : money(payload.new_amount)}</strong>
        {up !== null && up !== 0 && (
          <span className={up > 0 ? 'error' : 'ok'} style={{ marginLeft: 6 }}>
            {up > 0 ? '+' : '−'}
            {Math.abs(up).toLocaleString('vi-VN')} đ
          </span>
        )}
      </div>
      {payload.valid_from && <div className="muted">Áp dụng từ {payload.valid_from.split('-').reverse().join('/')}</div>}
    </div>
  );
}

export function ApprovalTable({
  approvals,
  onDecided,
}: {
  approvals: ApprovalItem[];
  onDecided: () => void;
}) {
  const toast = useToast();
  const [target, setTarget] = useState<{
    approval: ApprovalItem;
    decision: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const decide = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await api.post(`/api/approvals/${target.approval.id}/decide`, {
        decision: target.decision,
        note: note || null,
      });
      toast.success(target.decision === 'APPROVED' ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu');
      setTarget(null);
      setNote('');
      onDecided();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không xử lý được yêu cầu');
    } finally {
      setSaving(false);
    }
  };

  const priceReqs = approvals.filter((x) => x.rule_code === 'PRICE_VERSION');
  const approveAllPrices = async () => {
    if (!window.confirm(`Duyệt cả ${priceReqs.length} đề nghị đổi giá đang hiển thị? Xem kỹ cột "Đối tượng" trước khi bấm.`)) return;
    setSaving(true);
    let done = 0;
    try {
      for (const r of priceReqs) {
        await api.post(`/api/approvals/${r.id}/decide`, { decision: 'APPROVED', note: null });
        done += 1;
      }
      toast.success(`Đã duyệt ${done} đề nghị đổi giá`);
    } catch (err) {
      toast.error(`${err instanceof ApiError ? err.message : 'Không duyệt hết được'} (đã duyệt ${done}/${priceReqs.length})`);
    } finally {
      setSaving(false);
      onDecided();
    }
  };

  return (
    <>
      {priceReqs.length > 1 && (
        <div style={{ padding: '10px 16px' }}>
          <button className="btn dark" disabled={saving} onClick={() => void approveAllPrices()}>
            Duyệt tất cả {priceReqs.length} đề nghị đổi giá
          </button>
        </div>
      )}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Đối tượng</th>
              <th>Quy tắc</th>
              <th>Lý do</th>
              <th>Cấp duyệt</th>
              <th>Người gửi</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((approval) => (
              <tr key={approval.id}>
                <td>
                  {approval.rule_code === 'PRICE_VERSION' && approval.payload ? (
                    <PriceChange payload={approval.payload as PriceChangePayload} />
                  ) : (
                    <strong>{approval.entity_label ?? approval.entity_id.slice(0, 8)}</strong>
                  )}
                  <div className="muted">{formatVnDateTime(approval.created_at)}</div>
                </td>
                <td>
                  <span
                    className={`badge ${approval.rule_code === 'ORDER_STANDARD' ? 'blue' : 'orange'}`}
                  >
                    {approval.rule_code === 'PRICE_VERSION' ? 'Đổi giá' : approval.rule_code === 'TIER_CHANGE' ? 'Đổi cấp khách' : approval.rule_code}
                  </span>
                </td>
                <td>{approval.reason}</td>
                <td>
                  <span className={`badge ${approval.required_role === 'CEO' ? 'red' : 'purple'}`}>
                    {approval.required_role === 'CEO' ? 'CEO duyệt' : 'Quản lý duyệt'}
                  </span>
                </td>
                <td>{approval.requester_name}</td>
                <td>
                  <div className="actions">
                    <button
                      className="btn sm dark"
                      onClick={() => setTarget({ approval, decision: 'APPROVED' })}
                    >
                      Duyệt
                    </button>
                    <button
                      className="btn sm danger"
                      onClick={() => setTarget({ approval, decision: 'REJECTED' })}
                    >
                      Từ chối
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && (
        <Modal
          title={target.decision === 'APPROVED' ? 'Xác nhận duyệt' : 'Từ chối yêu cầu'}
          onClose={() => setTarget(null)}
          footer={
            <>
              <button className="btn" onClick={() => setTarget(null)}>
                Huỷ
              </button>
              <button
                className={`btn ${target.decision === 'APPROVED' ? 'primary' : 'danger'}`}
                onClick={decide}
                disabled={saving}
              >
                {saving ? 'Đang xử lý…' : 'Xác nhận'}
              </button>
            </>
          }
        >
          <div className="modal-body">
            <p>
              <strong>{target.approval.reason}</strong>
            </p>
            <div className="field">
              <label>Ghi chú quyết định</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function OrderDetailPage({ mode }: { mode: 'sales' | 'admin' }) {
  const { id = '' } = useParams();
  const { can, me } = useAuth();
  const toast = useToast();
  const order = useApi<OrderDetail>(`/api/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showCarrier, setShowCarrier] = useState(false);
  const [shipAsk, setShipAsk] = useState<null | 'DA_XUAT_KHO' | 'DA_GIAO'>(null);

  if (order.loading) return <div className="loading">Đang tải đơn hàng…</div>;
  if (order.error) return <div className="alert-box">{order.error}</div>;
  if (!order.data) return null;
  const o = order.data;

  const submit = async () => {
    setBusy(true);
    try {
      const result = await api.post<{
        approvals: Array<{ rule_code: string; required_role: string }>;
      }>(`/api/orders/${o.id}/submit`, {}, crypto.randomUUID());
      const needsCeo = result.data.approvals.some((a) => a.required_role === 'CEO');
      toast.success(
        needsCeo ? 'Đã gửi duyệt - yêu cầu này cần CEO duyệt' : 'Đã gửi duyệt cho Quản lý',
      );
      order.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không gửi duyệt được');
    } finally {
      setBusy(false);
    }
  };

  /** Quản lý: gửi duyệt và duyệt luôn trong một lần bấm (đơn không có ngoại lệ cần CEO). */
  const submitAndApprove = async () => {
    setBusy(true);
    try {
      await api.post(`/api/orders/${o.id}/submit`, {}, crypto.randomUUID());
      const fresh = await api.get<OrderDetail>(`/api/orders/${o.id}`);
      if (fresh.data.approval_status === 'PENDING_APPROVAL') {
        if (fresh.data.flow_on) {
          await api.post(`/api/orders/${o.id}/flow/approve`, {});
        } else {
          for (const ap of fresh.data.approvals.filter((x) => x.status === 'PENDING')) {
            await api.post(`/api/approvals/${ap.id}/decide`, { decision: 'APPROVED' });
          }
        }
      }
      const done = await api.get<OrderDetail>(`/api/orders/${o.id}`);
      toast[done.data.approval_status === 'APPROVED' ? 'success' : 'error'](
        done.data.approval_status === 'APPROVED'
          ? 'Đã duyệt đơn. Kho thấy đơn ở danh sách chờ xuất.'
          : 'Đơn có yêu cầu cần CEO duyệt nên chưa duyệt hết được.',
      );
      order.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không duyệt được');
    } finally {
      setBusy(false);
    }
  };

  const updateDelivery = async (status: string, info?: { ship_day: string; shipped_by_name: string }) => {
    setBusy(true);
    try {
      await api.post(`/api/orders/${o.id}/delivery`, { delivery_status: status, ...(info ?? {}) });
      toast.success('Đã cập nhật trạng thái giao hàng');
      order.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không cập nhật được');
    } finally {
      setBusy(false);
    }
  };

  const confirmAccounting = async () => {
    setBusy(true);
    try {
      await api.post(`/api/orders/${o.id}/accounting`, { accounting_status: 'DA_XAC_NHAN' });
      toast.success('Đã xác nhận kế toán - đơn này vào công nợ chính thức');
      order.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không xác nhận được');
    } finally {
      setBusy(false);
    }
  };

  const unconfirmAccounting = async () => {
    const note = prompt(
      'Bỏ xác nhận kế toán để sale sửa đơn. Ghi lý do (ví dụ: kho xuất thiếu 1 can, cần sửa đơn):',
    );
    if (!note || note.trim().length < 5) return;
    setBusy(true);
    try {
      await api.post(`/api/orders/${o.id}/accounting`, {
        accounting_status: 'CHUA_XAC_NHAN',
        note: note.trim(),
      });
      toast.success('Đã bỏ xác nhận. Sale sửa được đơn rồi, sửa xong nhớ xác nhận lại.');
      order.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không bỏ xác nhận được');
    } finally {
      setBusy(false);
    }
  };

  // Sửa/huỷ đơn: sale phụ trách đơn, hoặc quản lý/CEO. Kế toán kho chỉ xem và làm bước của kho.
  const isOwnerOrder = (o as unknown as { owner_id?: string | null }).owner_id === me?.user.id;
  const mayEdit = (can('order.create') && isOwnerOrder) || can('order.create.team');
  const editable =
    mayEdit &&
    o.approval_status !== 'CANCELLED' &&
    o.delivery_status !== 'HOAN' &&
    o.accounting_status !== 'DA_XAC_NHAN';
  const lockedByAccounting =
    mayEdit && o.accounting_status === 'DA_XAC_NHAN' && o.approval_status !== 'CANCELLED';

  const cancel = async () => {
    const reason = prompt('Lý do huỷ đơn (bắt buộc, tối thiểu 5 ký tự):');
    if (!reason) return;
    setBusy(true);
    try {
      await api.post(`/api/orders/${o.id}/cancel`, { reason });
      toast.success('Đã huỷ đơn');
      order.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không huỷ được đơn');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Đơn {o.order_no}</h2>
          <p>
            {o.customer_name} · Ngày {formatVnDate(o.order_date)} · Sale {o.owner_name ?? '—'}
          </p>
        </div>
        <div className="actions">
          <Link className="btn" to={`/${mode}/orders`}>
            Danh sách đơn
          </Link>
          {editable && (
            <Link className="btn" to={`/${mode}/orders/${o.id}/edit`}>
              Sửa đơn
            </Link>
          )}
          {o.approval_status !== 'CANCELLED' && (
            <>
              <a
                className="btn"
                href={`/print/orders/${o.id}?type=order`}
                target="_blank"
                rel="noreferrer"
              >
                In phiếu gửi khách
              </a>
              <a
                className="btn"
                href={`/print/orders/${o.id}?type=ship`}
                target="_blank"
                rel="noreferrer"
              >
                In phiếu xuất kho
              </a>
            </>
          )}
          {(o.approval_status === 'DRAFT' || o.approval_status === 'REJECTED') &&
            can('order.submit') && (
              <button className="btn primary" onClick={submit} disabled={busy}>
                {o.flow_on
                  ? can('order.approve.normal')
                    ? 'Gửi kho kiểm tồn'
                    : 'Gửi cho điều phối'
                  : 'Gửi duyệt'}
              </button>
            )}
          {(o.approval_status === 'DRAFT' || o.approval_status === 'REJECTED') &&
            can('order.submit') &&
            can('order.approve.normal') && (
              <button className="btn primary" onClick={() => void submitAndApprove()} disabled={busy} title="Gửi duyệt và duyệt luôn, không phải chờ kho kiểm tồn">
                Duyệt
              </button>
            )}
          {o.approval_status === 'APPROVED' && can('order.delivery.update') && (
            <>
              {!o.flow_on && (
                <button
                  className="btn"
                  onClick={() => setShipAsk('DA_XUAT_KHO')}
                  disabled={busy}
                >
                  Đánh dấu đã xuất kho
                </button>
              )}
              <button
                className="btn dark"
                onClick={() => (o.delivery_status === 'CHUA_XUAT' ? setShipAsk('DA_GIAO') : void updateDelivery('DA_GIAO'))}
                disabled={busy}
              >
                Đánh dấu đã giao
              </button>
              <button className="btn" onClick={() => updateDelivery('HOAN')} disabled={busy}>
                Hoàn hàng
              </button>
            </>
          )}
          {o.approval_status === 'APPROVED' &&
            o.accounting_status === 'CHUA_XAC_NHAN' &&
            (!o.flow_on || o.kho_status === 'DA_CHOT_TIEN') &&
            can('order.accounting.confirm') && (
              <button className="btn" onClick={confirmAccounting} disabled={busy}>
                Kế toán xác nhận
              </button>
            )}
          {o.accounting_status === 'DA_XAC_NHAN' && can('order.accounting.confirm') && (
            <button className="btn" onClick={unconfirmAccounting} disabled={busy}>
              Bỏ xác nhận kế toán
            </button>
          )}
          {can('order.payment.record') && (o.approval_status === 'APPROVED' || o.approval_status === 'PENDING_APPROVAL') && (
            <button className="btn primary" onClick={() => setShowPayment(true)}>
              Tiền về + gửi bill
            </button>
          )}
          {can('payment.allocate') && o.approval_status === 'APPROVED' && o.payment_status !== 'DA_THU_DU' && (
            <button
              className="btn"
              disabled={busy}
              title="Khách đã đặt cọc từ trước: trừ tiền cọc còn dư vào đơn này (đơn xuất kho thì web cũng tự trừ)"
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await api.post<{ applied: number }>(`/api/orders/${o.id}/apply-deposit`, {});
                  if (r.data.applied) toast.success(`Đã trừ ${formatVnd(r.data.applied)} tiền cọc vào đơn`);
                  else toast.error('Khách không có tiền cọc nào còn dư để trừ vào đơn này.');
                  order.reload();
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : 'Chưa trừ được cọc');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Trừ tiền cọc vào đơn
            </button>
          )}
          {can('order.payment.record') && (o.approval_status === 'APPROVED' || o.approval_status === 'PENDING_APPROVAL') && (
            <button
              className="btn"
              onClick={() => setShowCarrier(true)}
              title="Công ty miễn ship, khách trả cước nhà xe rồi trừ vào tiền đơn"
            >
              Khách trả cước hộ
            </button>
          )}
          {mayEdit && o.approval_status !== 'CANCELLED' && o.delivery_status === 'CHUA_XUAT' && (
            <button className="btn danger" onClick={cancel} disabled={busy}>
              Huỷ đơn
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <OrderStatusBadges
          approval={o.approval_status}
          delivery={o.delivery_status}
          payment={o.payment_status}
          accounting={o.accounting_status}
        />
      </div>

      {o.rejected_reason && (
        <div className="alert-box" style={{ marginBottom: 16 }}>
          Lý do từ chối: {o.rejected_reason}
        </div>
      )}

      <ProposalsCard entityType="ORDER" entityId={o.id} mode={mode} />

      <OrderFlowPanel order={o} mode={mode} onChanged={order.reload} />
      {lockedByAccounting && (
        <div className="alert-box warn" style={{ marginBottom: 16 }}>
          Đơn này kế toán đã xác nhận ghi nợ nên đang khoá, không sửa được. Cần sửa (khách đổi, kho
          xuất sai…) thì nhờ kế toán bấm <strong>Bỏ xác nhận kế toán</strong>, sale sửa đơn xong, kế
          toán xác nhận lại.
        </div>
      )}

      <div className="grid-2">
        <Card title="Dòng sản phẩm" bodyClass="">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Mã SKU</th>
                  <th>Sản phẩm</th>
                  <th className="right">SL</th>
                  <th className="right">Giá chuẩn</th>
                  <th className="right">Giá áp dụng</th>
                  <th className="right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.sku}</strong>
                      {item.price_override && (
                        <div>
                          <span className="badge orange">Giá thoả thuận</span>
                        </div>
                      )}
                    </td>
                    <td>{item.product_name}</td>
                    <td className="right">{item.qty}</td>
                    <td className="right nowrap muted">{formatVnd(item.base_price)}</td>
                    <td className="right nowrap">{formatVnd(item.applied_price)}</td>
                    <td className="right nowrap">{formatVnd(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card title="Số tiền">
            <div className="stat-row">
              <span className="muted">Tiền hàng</span>
              <strong>{formatVnd(o.subtotal)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Chiết khấu</span>
              <strong>-{formatVnd(o.discount_amount)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Trừ thưởng tháng</span>
              <strong>-{formatVnd(o.bonus_deduction)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Phí vận chuyển</span>
              <strong>+{formatVnd(o.shipping_fee)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Tổng phải thu</span>
              <strong>{formatVnd(o.total_amount)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">COD/đặt cọc</span>
              <strong>{formatVnd(o.cod_amount)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Đã thu (phân bổ)</span>
              <strong>{formatVnd(o.received_amount)}</strong>
            </div>
            {(o.deposit_applied ?? 0) > 0 && (
              <div className="stat-row">
                <span className="muted">&nbsp;&nbsp;trong đó tiền khách đã đặt cọc</span>
                <strong>{formatVnd(o.deposit_applied ?? 0)}</strong>
              </div>
            )}
            <div className="stat-row">
              <span className="muted">Còn phải thu</span>
              <strong>{formatVnd(o.remaining_amount)}</strong>
            </div>
          </Card>

          <OrderPayments order={o} onChanged={() => order.reload()} />
          <OrderBills order={o} onChanged={() => order.reload()} />

          {(o.revisions ?? []).length > 0 && (
            <Card title={`Lịch sử sửa đơn (${(o.revisions ?? []).length})`}>
              <RevisionList revisions={o.revisions ?? []} />
            </Card>
          )}

          <Card title="Yêu cầu duyệt">
            {o.approvals.length === 0 ? (
              <div className="empty">Chưa gửi duyệt.</div>
            ) : (
              <div className="timeline">
                {o.approvals.map((approval) => (
                  <div className="event" key={approval.id}>
                    <p>
                      <strong>{approval.rule_code}</strong> ·{' '}
                      <span
                        className={`badge ${
                          approval.status === 'APPROVED'
                            ? 'green'
                            : approval.status === 'REJECTED'
                              ? 'red'
                              : 'orange'
                        }`}
                      >
                        {approval.status}
                      </span>
                    </p>
                    <small>
                      {approval.reason} — {approval.requester_name} gửi lúc{' '}
                      {formatVnDateTime(approval.created_at)}
                    </small>
                    {approval.decision_note && <div>Ghi chú: {approval.decision_note}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {shipAsk && (
        <ShipInfoModal
          title={shipAsk === 'DA_GIAO' ? 'Ghi đã giao hàng' : 'Ghi đã xuất kho'}
          busy={busy}
          onClose={() => setShipAsk(null)}
          onConfirm={(info) => {
            const st = shipAsk;
            setShipAsk(null);
            void updateDelivery(st, info);
          }}
        />
      )}
      {showPayment && (
        <PaymentForm
          order={o}
          onClose={() => setShowPayment(false)}
          onDone={() => {
            setShowPayment(false);
            toast.success('Đã ghi nhận tiền về');
            order.reload();
          }}
        />
      )}
      {showCarrier && (
        <CarrierPaidModal
          orderId={o.id}
          orderNo={o.order_no}
          onClose={() => setShowCarrier(false)}
          onDone={(voucher) => {
            setShowCarrier(false);
            toast.success(`Đã ghi cước khách trả hộ: phiếu thu bù trừ + phiếu chi ${voucher}`);
            order.reload();
          }}
        />
      )}
    </>
  );
}

/**
 * Công ty miễn ship nhưng giao hàng khách trả cước cho nhà xe rồi trừ vào tiền đơn (công ty chỉ nhận một giao dịch đã trừ cước).
 * Một thao tác ghi đủ hai việc: phiếu thu "Bù trừ cước vận chuyển" vào đơn, và phiếu chi vận chuyển.
 */
function CarrierPaidModal({
  orderId,
  orderNo,
  onClose,
  onDone,
}: {
  orderId: string;
  orderNo: string;
  onClose: () => void;
  onDone: (voucherNo: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [carrier, setCarrier] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ voucher_no: string }>(`/api/orders/${orderId}/carrier-paid`, {
        amount: Number(String(amount).replace(/[.,\s]/g, '')),
        carrier,
        note: note || null,
      });
      onDone(r.data.voucher_no);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chưa ghi được, thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Khách trả cước hộ · đơn ${orderNo}`}
      onClose={onClose}
      footer={
        <button className="btn primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Đang ghi…' : 'Ghi nhận cước khách trả hộ'}
        </button>
      }
    >
      <p className="muted">
        Dùng khi công ty <b>miễn ship</b> nhưng khách trả cước cho nhà xe lúc nhận hàng và trừ vào
        tiền đơn. Tiền khách chuyển cho công ty ghi như bình thường ở nút "Tiền về + gửi bill" (số
        đã trừ cước). Ở đây chỉ ghi <b>phần cước</b>.
      </p>
      <div className="form-grid">
        <div className="field">
          <label>Số tiền cước (đ)</label>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ví dụ 300000"
          />
        </div>
        <div className="field">
          <label>Nhà xe / biển số xe</label>
          <input
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="Ví dụ: Nhà xe Hà Thành 29C-123.45"
          />
        </div>
        <div className="field full">
          <label>Ghi chú (không bắt buộc)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <p className="muted">
        Web sẽ tạo: (1) phiếu thu <b>"Bù trừ cước vận chuyển"</b> gắn vào đơn này, chờ kế toán xác
        nhận; (2) <b>phiếu chi vận chuyển</b> để báo cáo chi phí vận chuyển đủ.
      </p>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}

/**
 * Thao tác nhanh ngay trên danh sách, đúng luồng thật của công ty:
 *   Quản lý tích "đã xuất kho" → "đã giao"
 *   Sale tích "tiền về" (ghi nhận, chưa vào công nợ chính thức)
 *   Kế toán bấm "xác nhận" thì đơn mới ghi nợ chính thức.
 * Nút nào không thuộc quyền của người đang đăng nhập thì không hiện.
 */
type TodoKey = 'approve' | 'send_approve' | 'confirm_pay' | 'confirm_debt' | 'ship';
/**
 * Việc KẾ TIẾP trên đơn dành cho người đang xem: ai cần duyệt gì, xác nhận gì thì hiện ngay ở cột "Cần làm".
 * Trả null nếu đơn không có việc nào cho người này.
 */
function todoOf(
  o: OrderListItem,
  can: (p: Permission) => boolean,
  myId: string | undefined,
): { key: TodoKey; label: string } | null {
  const approved = o.approval_status === 'APPROVED';
  if (can('order.approve.normal') && o.approval_status === 'PENDING_APPROVAL') return { key: 'approve', label: 'Duyệt' };
  if (can('order.accounting.confirm') && (o.pending_pay_n ?? 0) > 0) return { key: 'confirm_pay', label: `Xác nhận tiền${(o.pending_pay_n ?? 0) > 1 ? ` (${o.pending_pay_n})` : ''}` };
  if (
    can('order.accounting.confirm') &&
    approved &&
    o.accounting_status === 'CHUA_XAC_NHAN' &&
    (o.delivery_status === 'DA_XUAT_KHO' || o.delivery_status === 'DA_GIAO') &&
    (!o.flow_on || o.kho_status === 'DA_CHOT_TIEN')
  )
    return { key: 'confirm_debt', label: 'Xác nhận ghi nợ' };
  if ((o.approval_status === 'DRAFT' || o.approval_status === 'REJECTED') && can('order.submit') && (can('order.approve.normal') || o.owner_id === myId))
    return { key: 'send_approve', label: can('order.approve.normal') ? 'Duyệt' : 'Gửi duyệt' };
  if (
    can('order.kho.process') &&
    approved &&
    ((o.flow_on && o.kho_status === 'CHO_XUAT') || (!o.flow_on && o.delivery_status === 'CHUA_XUAT'))
  )
    return { key: 'ship', label: 'Ghi xuất kho' };
  return null;
}

/** Nhãn ngắn cho nút trạng thái trong bảng (chữ đầy đủ hiện khi rê chuột). */
const SHORT_STAGE: Record<string, string> = {
  'Nháp, chưa gửi duyệt': 'Nháp',
  'Đã giao, chờ tiền': 'Chờ tiền',
  'Chờ kế toán xác nhận': 'Chờ KT xác nhận',
  'Bị từ chối': 'Từ chối',
  'Hàng hoàn về': 'Hoàn về',
  'Thu một phần': 'Thu 1 phần',
};

function TodoCell({
  order,
  mode,
  onDone,
  todo,
}: {
  order: OrderListItem;
  mode: 'sales' | 'admin';
  onDone: () => void;
  todo: { key: TodoKey; label: string } | null;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!todo) return <span className="muted">—</span>;
  if (todo.key === 'ship') {
    return (
      <Link className="btn sm primary" to={`/${mode}/orders/${order.id}`}>
        {todo.label}
      </Link>
    );
  }
  const go = async () => {
    setBusy(true);
    try {
      if (todo.key === 'confirm_pay') {
        for (const id of String(order.pending_pay_ids ?? '').split(',').filter(Boolean)) {
          await api.post(`/api/payments/${id}/confirm`, { confirmed: true });
        }
        toast.success('Đã xác nhận tiền về');
      } else if (todo.key === 'confirm_debt') {
        await api.post(`/api/orders/${order.id}/accounting`, { accounting_status: 'DA_XAC_NHAN' });
        toast.success('Đã xác nhận ghi nợ, đơn vào công nợ chính thức');
      } else {
        if (todo.key === 'send_approve') await api.post(`/api/orders/${order.id}/submit`, {}, crypto.randomUUID());
        const fresh = await api.get<OrderDetail>(`/api/orders/${order.id}`);
        if (fresh.data.approval_status === 'PENDING_APPROVAL' && todo.label !== 'Gửi duyệt') {
          if (fresh.data.flow_on) await api.post(`/api/orders/${order.id}/flow/approve`, {});
          else for (const ap of fresh.data.approvals.filter((x) => x.status === 'PENDING')) await api.post(`/api/approvals/${ap.id}/decide`, { decision: 'APPROVED' });
        }
        toast.success(todo.label === 'Gửi duyệt' ? 'Đã gửi duyệt' : 'Đã duyệt đơn');
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Chưa làm được, mở đơn để xem');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className="btn sm primary todo" disabled={busy} onClick={() => void go()}>
      {busy ? 'Đang làm…' : todo.label}
    </button>
  );
}

function QuickActions({
  order,
  mode,
  onDone,
}: {
  order: OrderListItem;
  mode: 'sales' | 'admin';
  onDone: () => void;
}) {
  const { can, me } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [shipAsk, setShipAsk] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);
  const stage = orderStage(order);
  const liveFlow = Boolean(order.flow_on) && (order.kho_status ?? 'KHONG') !== 'KHONG' && isLiveFlow(order);
  const stageLabel = liveFlow ? (KHO_LABELS[(order.kho_status ?? 'KHONG') as KhoStatus] ?? stage.label) : stage.label;
  const stageTone = liveFlow ? (order.kho_status === 'THIEU_HANG' ? 'red' : order.kho_status === 'DA_CHOT_TIEN' ? 'purple' : order.kho_status === 'CHO_HANG' ? 'orange' : 'blue') : stage.tone;

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      toast.success(label);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thực hiện được');
    } finally {
      setBusy(false);
    }
  };

  const buttons: React.ReactNode[] = [];
  const flow = Boolean(order.flow_on) && order.approval_status !== 'CANCELLED';
  const ks = (order.kho_status ?? 'KHONG') as KhoStatus;

  // Sửa đơn: khách đổi ý, kho hết hàng, kho xuất sai. Khoá khi kế toán đã xác nhận ghi nợ.
  if (
    ((can('order.create') && order.owner_id === me?.user.id) || can('order.create.team')) &&
    order.approval_status !== 'CANCELLED' &&
    order.delivery_status !== 'HOAN' &&
    order.accounting_status !== 'DA_XAC_NHAN'
  ) {
    buttons.push(
      <Link key="sua" className="btn sm" to={`/${mode}/orders/${order.id}/edit`}>
        Sửa đơn
      </Link>,
    );
  }

  // Đơn theo luồng kho: việc của từng người hiện ngay tại danh sách; việc có nhập liệu thì vào đơn.
  if (flow && ks !== 'KHONG') {
    const mine =
      (KHO_WAITING[ks] === 'DIEU_PHOI' && can('order.approve.normal')) ||
      (KHO_WAITING[ks] === 'KHO' && can('order.kho.process')) ||
      (KHO_WAITING[ks] === 'SALE' && (can('order.create') || can('order.create.team'))) ||
      (KHO_WAITING[ks] === 'KE_TOAN' && can('order.accounting.confirm'));
    if (ks === 'CHO_DIEU_PHOI' && can('order.approve.normal')) {
      buttons.push(
        <button
          key="tokho"
          className="btn sm primary"
          disabled={busy}
          onClick={() =>
            run('Đã chuyển kho kiểm tồn', () => api.post(`/api/orders/${order.id}/flow/to-kho`, {}))
          }
        >
          Chuyển kho kiểm
        </button>,
      );
    } else if (ks === 'DA_XUAT' && can('order.approve.normal')) {
      buttons.push(
        <button
          key="xn"
          className="btn sm primary"
          disabled={busy}
          onClick={() =>
            run('Đã xác nhận xuất, báo sale đối chiếu', () =>
              api.post(`/api/orders/${order.id}/flow/confirm-shipped`, {}),
            )
          }
        >
          Xác nhận đã xuất
        </button>,
      );
    } else if (mine && ks !== 'DA_CHOT_TIEN') {
      buttons.push(
        <Link key="xl" className="btn sm primary" to={`/${mode}/orders/${order.id}`}>
          {KHO_LABELS[ks] ? 'Xử lý' : 'Mở'}
        </Link>,
      );
    }
  }

  // Đơn còn nháp thì việc cần làm đầu tiên là gửi duyệt, làm ngay tại danh sách.
  if (
    (order.approval_status === 'DRAFT' || order.approval_status === 'REJECTED') &&
    can('order.submit')
  ) {
    buttons.push(
      <button
        key="gui"
        className="btn sm primary"
        disabled={busy}
        onClick={() =>
          run('Đã gửi duyệt', () =>
            api.post(`/api/orders/${order.id}/submit`, {}, crypto.randomUUID()),
          )
        }
      >
        {flow ? (can('order.approve.normal') ? 'Gửi kho kiểm' : 'Gửi điều phối') : 'Gửi duyệt'}
      </button>,
    );
    if (can('order.approve.normal')) {
      buttons.push(
        <button
          key="duyetluon"
          className="btn sm primary"
          disabled={busy}
          onClick={() =>
            run('Đã duyệt đơn', async () => {
              await api.post(`/api/orders/${order.id}/submit`, {}, crypto.randomUUID());
              const fresh = await api.get<OrderDetail>(`/api/orders/${order.id}`);
              if (fresh.data.approval_status === 'PENDING_APPROVAL') {
                if (fresh.data.flow_on) await api.post(`/api/orders/${order.id}/flow/approve`, {});
                else for (const ap of fresh.data.approvals.filter((x) => x.status === 'PENDING')) await api.post(`/api/approvals/${ap.id}/decide`, { decision: 'APPROVED' });
              }
            })
          }
        >
          Duyệt
        </button>,
      );
    }
  }

  if (order.approval_status === 'APPROVED' && can('order.delivery.update') && !flow) {
    if (order.delivery_status === 'CHUA_XUAT') {
      buttons.push(
        <button
          key="xuat"
          className="btn sm"
          disabled={busy}
          onClick={() => setShipAsk(true)}
        >
          Đã xuất kho
        </button>,
      );
    } else if (order.delivery_status === 'DA_XUAT_KHO') {
      buttons.push(
        <button
          key="giao"
          className="btn sm"
          disabled={busy}
          onClick={() =>
            run('Đã đánh dấu giao hàng', () =>
              api.post(`/api/orders/${order.id}/delivery`, { delivery_status: 'DA_GIAO' }),
            )
          }
        >
          Đã giao
        </button>,
      );
    }
  }

  if (
    order.approval_status === 'APPROVED' &&
    order.payment_status !== 'DA_THU_DU' &&
    can('order.payment.record')
  ) {
    buttons.push(
      <button
        key="tien"
        className="btn sm primary"
        disabled={busy}
        onClick={() => setShowPayment(true)}
      >
        Tiền về + bill
      </button>,
    );
  }
  if (
    order.approval_status === 'APPROVED' &&
    order.payment_status !== 'DA_THU_DU' &&
    can('payment.allocate')
  ) {
    buttons.push(
      <button
        key="coc"
        className="btn sm"
        disabled={busy}
        onClick={() =>
          run('Đã trừ tiền cọc của khách vào đơn', async () => {
            const r = await api.post<{ applied: number }>(`/api/orders/${order.id}/apply-deposit`, {});
            if (!r.data.applied) throw new ApiError(400, 'NO_DEPOSIT', 'Khách không có tiền cọc nào còn dư để trừ vào đơn này.');
          })
        }
      >
        Trừ tiền cọc vào đơn
      </button>,
    );
  }

  if (
    order.approval_status === 'APPROVED' &&
    order.accounting_status === 'CHUA_XAC_NHAN' &&
    (order.delivery_status === 'DA_XUAT_KHO' || order.delivery_status === 'DA_GIAO') &&
    (!flow || ks === 'DA_CHOT_TIEN') &&
    can('order.accounting.confirm')
  ) {
    buttons.push(
      <button
        key="kt"
        className="btn sm dark"
        disabled={busy}
        onClick={() =>
          run('Kế toán đã xác nhận', () =>
            api.post(`/api/orders/${order.id}/accounting`, { accounting_status: 'DA_XAC_NHAN' }),
          )
        }
      >
        KT xác nhận
      </button>,
    );
  }

  return (
    <>
      <button
        type="button"
        className={`stbtn ${stageTone}`}
        title={stageLabel}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setMenu(menu ? null : { top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 190, window.innerWidth - 198)) });
        }}
      >
        <span>{SHORT_STAGE[stageLabel] ?? stageLabel}</span>
        <i aria-hidden="true">▾</i>
      </button>
      {menu &&
        createPortal(
        <div className="stpop" role="menu" style={{ top: menu.top, left: menu.left }} onClick={() => setMenu(null)}>
          {buttons.map((b, i) => (
            <div key={i}>{b}</div>
          ))}
          <Link className="btn sm" to={`/${mode}/orders/${order.id}`}>
            Xem chi tiết đơn
          </Link>
          <a className="btn sm" href={`/print/orders/${order.id}?type=ship`} target="_blank" rel="noreferrer">
            In phiếu xuất kho
          </a>
          <a className="btn sm" href={`/print/orders/${order.id}?type=order`} target="_blank" rel="noreferrer">
            In phiếu gửi khách
          </a>
        </div>,
        document.body,
      )}
      {shipAsk && (
        <ShipInfoModal
          title="Ghi đã xuất kho"
          busy={busy}
          onClose={() => setShipAsk(false)}
          onConfirm={(info) => {
            setShipAsk(false);
            void run('Đã đánh dấu xuất kho', () =>
              api.post(`/api/orders/${order.id}/delivery`, { delivery_status: 'DA_XUAT_KHO', ...info }),
            );
          }}
        />
      )}
      {showPayment && (
        <PaymentForm
          order={{ ...order, items: [], approvals: [] } as unknown as OrderDetail}
          onClose={() => setShowPayment(false)}
          onDone={() => {
            setShowPayment(false);
            toast.success('Đã ghi nhận tiền về, chờ kế toán xác nhận');
            onDone();
          }}
        />
      )}
    </>
  );
}

/** Liệt kê những gì đã đổi giữa bản trước và bản sau của một lần sửa đơn. */
function describeChanges(before: OrderRevisionSnapshot, after: OrderRevisionSnapshot): string[] {
  const out: string[] = [];
  const b = new Map(before.items.map((i) => [i.sku, i]));
  const a = new Map(after.items.map((i) => [i.sku, i]));
  for (const [sku, item] of a) {
    const old = b.get(sku);
    if (!old) {
      out.push(
        `Thêm ${sku} · ${item.qty} × ${formatVndNumber(item.applied_price)}đ${item.is_gift ? ' (tặng)' : ''}`,
      );
      continue;
    }
    if (old.qty !== item.qty) out.push(`${sku}: số lượng ${old.qty} → ${item.qty}`);
    if (old.applied_price !== item.applied_price) {
      out.push(
        `${sku}: đơn giá ${formatVndNumber(old.applied_price)}đ → ${formatVndNumber(item.applied_price)}đ`,
      );
    }
    if (old.is_gift !== item.is_gift)
      out.push(`${sku}: ${item.is_gift ? 'chuyển sang hàng tặng' : 'bỏ hàng tặng'}`);
  }
  for (const [sku] of b) if (!a.has(sku)) out.push(`Bỏ ${sku}`);
  const fee = (label: string, x: number, y: number) => {
    if (x !== y) out.push(`${label}: ${formatVndNumber(x)}đ → ${formatVndNumber(y)}đ`);
  };
  fee('Chiết khấu', before.discount_amount, after.discount_amount);
  fee('Trừ thưởng tháng', before.bonus_deduction, after.bonus_deduction);
  fee('Phí vận chuyển', before.shipping_fee, after.shipping_fee);
  fee('COD/đặt cọc', before.cod_amount, after.cod_amount);
  if ((before.note ?? '') !== (after.note ?? '')) out.push('Sửa ghi chú đơn');
  return out;
}

function RevisionList({ revisions }: { revisions: OrderRevision[] }) {
  return (
    <div className="timeline">
      {revisions.map((r) => {
        const changes = describeChanges(r.before, r.after);
        return (
          <div className="event" key={r.id}>
            <p>
              <strong>Lần sửa {r.revision_no}</strong> · {r.edited_by_name ?? '—'} ·{' '}
              {formatVnDateTime(r.created_at)}
            </p>
            {r.reason && <div>Lý do: {r.reason}</div>}
            <small>
              Tổng phải thu: {formatVndNumber(r.before.total_amount)}đ →{' '}
              <strong>{formatVndNumber(r.after.total_amount)}đ</strong>
            </small>
            {changes.length > 0 && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Đơn nằm trong luồng kho còn đang chạy (chưa huỷ, chưa bị từ chối, chưa xong ở kế toán). */
function isLiveFlow(o: OrderListItem): boolean {
  return (
    o.approval_status !== 'CANCELLED' &&
    o.approval_status !== 'REJECTED' &&
    o.approval_status !== 'DRAFT' &&
    o.accounting_status !== 'DA_XAC_NHAN' &&
    o.delivery_status !== 'HOAN'
  );
}

const CHIP_ORDER: KhoStatus[] = [
  'CHO_DIEU_PHOI',
  'CHO_KIEM_KHO',
  'THIEU_HANG',
  'CHO_HANG',
  'DU_HANG',
  'CHO_XUAT',
  'DA_XUAT',
  'CHO_CHOT_TIEN',
  'DA_CHOT_TIEN',
];

/** Hàng chip đếm đơn theo từng bước của luồng kho; chip nào tới lượt người đang xem thì nổi bật. */
function FlowChips({
  counts,
  active,
  onPick,
  enabled,
  onToggled,
}: {
  counts: Record<string, number>;
  active: string;
  onPick: (s: string) => void;
  enabled?: boolean;
  onToggled: () => void;
}) {
  const { can } = useAuth();
  const toast = useToast();
  const total = CHIP_ORDER.reduce((n, s) => n + (counts[s] ?? 0), 0);
  const myTurn = (s: KhoStatus) => {
    const who = KHO_WAITING[s];
    return (
      (who === 'DIEU_PHOI' && can('order.approve.normal')) ||
      (who === 'KHO' && can('order.kho.process')) ||
      (who === 'SALE' && (can('order.create') || can('order.create.team'))) ||
      (who === 'KE_TOAN' && can('order.accounting.confirm'))
    );
  };

  async function toggle() {
    try {
      await api.put('/api/orders/flow/enabled', { enabled: !enabled });
      toast.success(!enabled ? 'Đã bật luồng kho cho đơn mới' : 'Đã tắt luồng kho cho đơn mới');
      onToggled();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không đổi được');
    }
  }

  return (
    <div style={{ marginBottom: 6, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {total > 0 || active ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`btn sm ${active === '' ? 'primary' : ''}`} onClick={() => onPick('')}>
            Tất cả đơn
          </button>
          {CHIP_ORDER.filter((s) => (counts[s] ?? 0) > 0 || active === s).map((s) => (
            <button
              key={s}
              className={`btn sm ${active === s ? 'primary' : myTurn(s) ? 'dark' : ''}`}
              onClick={() => onPick(active === s ? '' : s)}
              title={myTurn(s) ? 'Việc đang chờ bạn' : undefined}
            >
              {KHO_LABELS[s]} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
      ) : null}
      {can('settings.manage') && enabled !== undefined && window.location.hostname.startsWith('quantri.') && (
        <div className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
          Luồng kho đơn mới: <strong>{enabled ? 'bật' : 'tắt'}</strong>{' '}
          <button className="lnk" onClick={() => void toggle()}>
            {enabled ? 'Tắt đi' : 'Bật lên'}
          </button>
        </div>
      )}
    </div>
  );
}

interface BillRow {
  id: string;
  amount: number | null;
  paid_at: string | null;
  mime: string;
  name: string;
  payment_status: string | null;
}

/** Bill của đơn: ảnh thu nhỏ và nút gửi thêm bill. */
function OrderBills({ order, onChanged }: { order: OrderDetail; onChanged?: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [key, setKey] = useState(0);
  const [pay, setPay] = useState(false);
  const bills = useApi<BillRow[]>(`/api/bills?order_id=${order.id}&_=${key}`);
  // Bill đã lưu nhưng chưa thành khoản tiền về nào: dễ tưởng đã ghi nhận nên nhắc rõ.
  const orphan = (bills.data ?? []).filter((b) => b.payment_status === null || b.payment_status === undefined);
  const canPay = can('order.payment.record') && order.payment_status !== 'DA_THU_DU';
  return (
    <Card
      title={`Bill giao dịch (${(bills.data ?? []).length})`}
      action={
        canPay ? (
          <button className="btn sm primary" onClick={() => setPay(true)}>
            Tiền về + bill
          </button>
        ) : undefined
      }
    >
      {orphan.length > 0 && canPay && (
        <div className="note" style={{ margin: '8px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>
            Có <b>{orphan.length} bill chưa ghi nhận thành tiền về</b>: số tiền chưa được trừ vào đơn, kế toán chưa thấy để xác nhận.
          </span>
          <button
            className="btn sm primary"
            onClick={async () => {
              try {
                for (const b of orphan) await api.post(`/api/bills/${b.id}/record-payment`, {});
                toast.success('Đã ghi nhận tiền về từ bill, chờ kế toán xác nhận');
                setKey((k) => k + 1);
                onChanged?.();
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Chưa ghi nhận được, dùng nút Tiền về + bill');
                setPay(true);
              }
            }}
          >
            Ghi nhận tiền về
          </button>
        </div>
      )}
      {(bills.data ?? []).length === 0 ? (
        <div className="empty">Chưa có bill nào cho đơn này.</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(bills.data ?? []).map((b) => (
            <a
              key={b.id}
              href={`/api/bills/${b.id}/file`}
              target="_blank"
              rel="noreferrer"
              title={b.name}
            >
              {b.mime.startsWith('image/') ? (
                <img
                  src={`/api/bills/${b.id}/file`}
                  alt={b.name}
                  style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8 }}
                />
              ) : (
                <span className="badge">PDF</span>
              )}
            </a>
          ))}
        </div>
      )}
      {pay && (
        <PaymentForm
          order={{ id: order.id, order_no: order.order_no, customer_id: order.customer_id, customer_name: order.customer_name, remaining_amount: order.remaining_amount }}
          onClose={() => setPay(false)}
          onDone={() => {
            setPay(false);
            toast.success('Đã ghi nhận tiền về, chờ kế toán xác nhận');
            setKey((k) => k + 1);
            onChanged?.();
          }}
        />
      )}
    </Card>
  );
}

interface OrderPaymentRow {
  id: string;
  amount: number;
  paid_at: string;
  method: string | null;
  accounting_status: string;
  note: string | null;
  is_adjustment?: number;
  created_by: string | null;
}

/** Các phiếu thu đã trừ vào đơn này, kèm nút xóa phiếu ghi sai (ghi trùng, nhầm số, nhầm khách). */
function OrderPayments({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const { me, can } = useAuth();
  const toast = useToast();
  const [key, setKey] = useState(0);
  const list = useApi<OrderPaymentRow[]>(`/api/payments?order_id=${order.id}&_=${key}`);
  const rows = list.data ?? [];
  const isAcct = can('order.accounting.confirm');
  async function remove(p: OrderPaymentRow) {
    const reason = prompt(
      `Xóa phiếu thu ${formatVnd(p.amount)} ngày ${formatVnDate(p.paid_at)}? Ghi lý do (ví dụ: ghi trùng, nhầm số tiền):`,
    );
    if (!reason || reason.trim().length < 3) return;
    try {
      await api.post(`/api/payments/${p.id}/delete`, { reason: reason.trim() });
      toast.success('Đã xóa phiếu thu');
      setKey((k) => k + 1);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Chưa xóa được');
    }
  }
  const [refund, setRefund] = useState(false);
  const [rAmount, setRAmount] = useState('');
  const [rBill, setRBill] = useState('');
  const [rReason, setRReason] = useState('');
  const [rBusy, setRBusy] = useState(false);
  const paid = rows.reduce((t, p) => t + (p.is_adjustment ? -p.amount : p.amount), 0);
  async function doRefund() {
    setRBusy(true);
    try {
      await api.post('/api/payments/refund', {
        order_id: order.id,
        amount: Number(rAmount.replace(/\D/g, '')),
        bill_ref: rBill,
        reason: rReason,
      });
      toast.success('Đã lập phiếu hoàn tiền');
      setRefund(false);
      setRAmount('');
      setRBill('');
      setRReason('');
      setKey((k) => k + 1);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Chưa lập được phiếu hoàn tiền');
    } finally {
      setRBusy(false);
    }
  }
  if (rows.length === 0) return null;
  return (
    <Card title={`Phiếu thu của đơn (${rows.length})`}>
      {isAcct && paid > 0 && (
        <div style={{ marginBottom: 8 }}>
          <button className="btn sm" onClick={() => setRefund(true)}>
            Hoàn tiền cho khách
          </button>
        </div>
      )}
      {refund && (
        <Modal
          title="Phiếu chi hoàn tiền cho khách"
          onClose={() => setRefund(false)}
          footer={
            <>
              <button className="btn" onClick={() => setRefund(false)}>
                Đóng
              </button>
              <button className="btn primary" disabled={rBusy} onClick={() => void doRefund()}>
                {rBusy ? 'Đang lưu…' : 'Lập phiếu hoàn tiền'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <Field label={`Số tiền hoàn (khách đã trả ${formatVnd(paid)})`} full>
              <input value={rAmount} onChange={(e) => setRAmount(e.target.value)} inputMode="numeric" placeholder="Ví dụ: 1500000" />
            </Field>
            <Field label="Bill / số tham chiếu chuyển khoản" hint="Bắt buộc. Có bill này là đủ, không cần chị Hoa duyệt." full>
              <input value={rBill} onChange={(e) => setRBill(e.target.value)} />
            </Field>
            <Field label="Lý do hoàn tiền" hint="Ví dụ: kho xuất thiếu 3 thùng, hoàn lại phần chênh." full>
              <input value={rReason} onChange={(e) => setRReason(e.target.value)} />
            </Field>
          </div>
        </Modal>
      )}
      <table className="data">
        <tbody>
          {rows.map((p) => {
            const canDel =
              isAcct || (p.created_by === me?.user.id && p.accounting_status !== 'DA_XAC_NHAN');
            return (
              <tr key={p.id}>
                <td className="nowrap">{formatVnDate(p.paid_at)}</td>
                <td>
                  {p.method ?? ''}
                  {p.note ? <div className="muted">{p.note}</div> : null}
                </td>
                <td className="right nowrap">
                  <strong>{p.is_adjustment ? "−" : ""}{formatVnd(p.amount)}</strong>
                  <div className="muted">
                    {p.accounting_status === 'DA_XAC_NHAN' ? 'Kế toán đã xác nhận' : 'Chờ kế toán'}
                  </div>
                </td>
                <td>
                  {canDel && (
                    <button className="btn sm" onClick={() => void remove(p)}>
                      Xóa
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

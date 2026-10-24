import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { hubPeriodRange } from '../lib/hubPeriod';
import { formatVnd } from '@shared/money';
import { ApiError, api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useAuth } from '../components/AuthProvider';
import { Card, StateBlock, useToast } from '../components/ui';

interface GiftItem {
  item: string;
  qty: number;
}
interface Tier {
  label: string;
  threshold: number;
  cash: number;
  gift_text: string;
  gift_value: number;
  gift_items: GiftItem[];
}
interface GiftVoucher {
  id: string;
  voucher_no: string;
  customer_id: string;
  customer_name: string;
  level_label: string;
  items: Array<{ item: string; name: string; qty: number }>;
  status: 'CHO_DUYET' | 'DA_DUYET' | 'HUY';
  kho_doc_no: string | null;
  cancel_reason: string | null;
}
interface Policy {
  general: { MONTH: Tier[]; YEAR: Tier[] };
  overrides: Array<{ customer_id: string; customer_name: string; MONTH: Tier[]; YEAR: Tier[] }>;
  can_edit: boolean;
}
interface CashVoucher {
  id: string;
  voucher_no: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  method: string;
  note: string;
  status: 'CHO_DUYET' | 'DA_CHI' | 'HUY';
  cancel_reason: string | null;
  created_by_name: string | null;
  approved_by_name: string | null;
}
interface Row {
  customer_id: string;
  customer_name: string;
  tier_name: string | null;
  policy: 'RIENG' | 'CHUNG';
  actual_sales: number;
  retail_sales: number;
  month_level: string;
  month_cash: number;
  month_gift_text: string;
  month_gift_value: number;
  month_gift_items: GiftItem[];
  advanced: number;
  paid?: number;
  payable: number;
  year_retail: number;
  year_level: string;
  year_cash: number;
}

/* ------------------------------------------------------------------ Bảng xếp hạng doanh số & thưởng */
const shortVnd = (n: number) => {
  const a = Math.abs(n);
  const f = (v: number, u: string) => `${(Math.round(v * 10) / 10).toString().replace('.', ',')} ${u}`;
  if (a >= 1e9) return f(n / 1e9, 'tỷ');
  if (a >= 1e6) return f(n / 1e6, 'triệu');
  return formatVnd(n);
};
const pad2 = (n: number) => String(n).padStart(2, '0');

function RankingPanel({ slot }: { slot: HTMLElement | null }) {
  const toast = useToast();
  // Kỳ xếp hạng: tháng / quý / năm, bấm mũi tên để lùi hoặc tiến. Mặc định theo kỳ đang chọn ở thanh trên cùng.
  const base = hubPeriodRange().to;
  const [kind, setKind] = useState<'M' | 'Q' | 'Y'>('M');
  const [y, setY] = useState(Number(base.slice(0, 4)));
  const [m, setM] = useState(Number(base.slice(5, 7)) - 1);
  const m0 = kind === 'Q' ? Math.floor(m / 3) * 3 : kind === 'Y' ? 0 : m;
  const m1 = kind === 'Q' ? m0 + 2 : kind === 'Y' ? 11 : m;
  const from = `${y}-${pad2(m0 + 1)}-01`;
  const to = `${y}-${pad2(m1 + 1)}-${pad2(new Date(y, m1 + 1, 0).getDate())}`;
  const label =
    kind === 'M' ? `Tháng ${m + 1}/${y}` : kind === 'Q' ? `Quý ${Math.floor(m / 3) + 1}/${y}` : `Năm ${y}`;
  const step = (dir: number) => {
    if (kind === 'Y') return setY(y + dir);
    const t = y * 12 + m + dir * (kind === 'Q' ? 3 : 1);
    setY(Math.floor(t / 12));
    setM(t % 12);
  };
  const oneMonth = kind === 'M';
  const giftMonth = to.slice(0, 7);
  const rep = useApi<{ month: string; rows: Row[] }>(`/api/bonus/report?month=${from}..${to}`);
  const gifts = useApi<GiftVoucher[]>(`/api/bonus/gifts?month=${giftMonth}`);
  const canApprove = (gifts.meta as { can_approve?: boolean } | undefined)?.can_approve === true;
  const cash = useApi<CashVoucher[]>(`/api/bonus/cash?month=${giftMonth}`);
  const payCash = async (r: Row) => {
    const v = window.prompt(`Chi thưởng cho ${r.customer_name}. Số tiền (tối đa ${r.payable.toLocaleString('vi-VN')} đ):`, String(Math.max(0, r.payable)));
    if (!v) return;
    const amount = Math.round(Number(v.replace(/[^\d]/g, '')));
    if (!amount) return;
    const note = window.prompt('Ghi chú (chuyển khoản / tiền mặt, nội dung chi):', 'Chuyển khoản') ?? '';
    await act(
      async () => {
        await api.post('/api/bonus/cash', {
          customer_id: r.customer_id,
          month: giftMonth,
          amount,
          method: /mặt/i.test(note) ? 'TIEN_MAT' : 'CHUYEN_KHOAN',
          note,
        });
        cash.reload();
        rep.reload();
      },
      'Đã lập phiếu chi thưởng, chờ duyệt',
    );
  };
  const [top, setTop] = useState<10 | 20 | 0>(10);
  const [q, setQ] = useState('');
  const all = [...(rep.data?.rows ?? [])].sort((x, y2) => y2.retail_sales - x.retail_sales);
  const rows = all;
  const giftOf = (cid: string) =>
    (gifts.data ?? []).find((g) => g.customer_id === cid && g.status !== 'HUY');
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      gifts.reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Chưa thực hiện được');
    }
  };
  const sum = (f: (r: Row) => number) => rows.reduce((t, r) => t + f(r), 0);
  const ranked = all.map((r, i) => ({ r, rank: i + 1 }));
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? ranked.filter((x) => x.r.customer_name.toLowerCase().includes(needle))
    : ranked;
  const shown = needle || top === 0 ? filtered : filtered.slice(0, top);
  const maxSales = Math.max(1, ...all.map((r) => r.retail_sales));
  const podium = all.slice(0, 3);
  return (
    <div className="bn">
      {slot &&
        createPortal(
      <div className="bn-period">
        <div className="bn-seg" role="tablist" aria-label="Xếp hạng theo">
          {(
            [
              ['M', 'Tháng'],
              ['Q', 'Quý'],
              ['Y', 'Năm'],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              className={kind === k ? 'on' : ''}
              onClick={() => setKind(k)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="bn-step">
          <button aria-label="Kỳ trước" onClick={() => step(-1)}>
            ‹
          </button>
          <b>{label}</b>
          <button aria-label="Kỳ sau" onClick={() => step(1)}>
            ›
          </button>
        </div>
      </div>,
          slot,
        )}

      <div className="bn-kpis">
        <div className="bn-kpi">
          <span>Doanh số lẻ · {label}</span>
          <b>{shortVnd(sum((r) => r.retail_sales))}</b>
        </div>
        <div className="bn-kpi">
          <span>Số đại lý / NPP có doanh số</span>
          <b>{rows.length}</b>
        </div>
        <div className="bn-kpi">
          <span>Thưởng tiền kỳ này</span>
          <b>{shortVnd(sum((r) => r.month_cash))}</b>
        </div>
        <div className="bn-kpi bn-kpi-accent">
          <span>Còn phải chi (đã ứng {shortVnd(sum((r) => r.advanced))})</span>
          <b>{shortVnd(sum((r) => r.payable))}</b>
        </div>
      </div>

      {podium.length > 0 && (
        <div className="bn-podium">
          {podium.map((r, i) => (
            <div key={r.customer_id} className={`bn-pod bn-pod-${i + 1}`}>
              <div className="bn-medal">{i + 1}</div>
              <div className="bn-pod-name" title={r.customer_name}>
                {r.customer_name}
              </div>
              <div className="bn-pod-sales">{shortVnd(r.retail_sales)}</div>
              <div className="bn-pod-sub">
                {r.month_level || 'Chưa đạt mốc'}
                {r.month_cash ? ` · thưởng ${shortVnd(r.month_cash)}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <Card bodyClass="">
        <div className="bn-toolbar">
          <div className="bn-seg" role="tablist" aria-label="Số đại lý hiển thị">
            {([10, 20, 0] as const).map((n) => (
              <button
                key={n}
                role="tab"
                aria-selected={top === n}
                className={top === n ? 'on' : ''}
                onClick={() => setTop(n)}
              >
                {n === 0 ? `Tất cả (${all.length})` : `Top ${n}`}
              </button>
            ))}
          </div>
          <input
            className="bn-search"
            placeholder="Tìm đại lý…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm đại lý"
          />
          <span className="muted bn-note">
            Xếp theo doanh số LẺ (số lượng × giá niêm yết); không tính hàng tặng, mã trợ giá, đơn hủy;
            hàng trả được trừ.
          </span>
        </div>
        <StateBlock
          loading={rep.loading}
          error={rep.error}
          empty={rows.length === 0}
          emptyText="Kỳ này chưa có doanh số của NPP / đại lý thuộc diện thưởng."
        >
          <div className="table-wrap">
            <table className="bn-table">
              <thead>
                <tr>
                  <th className="c">#</th>
                  <th>Đại lý</th>
                  <th>Doanh số lẻ</th>
                  <th className="right">Doanh số thực</th>
                  <th>Mốc thưởng</th>
                  <th className="right">Thưởng tiền</th>
                  <th>Thưởng hàng</th>
                  <th>Phiếu quà</th>
                  <th className="right">Còn phải chi</th>
                  <th>Lũy kế năm</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ r, rank }) => {
                  const g = giftOf(r.customer_id);
                  return (
                    <tr key={r.customer_id}>
                      <td className="c">
                        <span className={`bn-rank${rank <= 3 ? ` r${rank}` : ''}`}>{rank}</span>
                      </td>
                      <td>
                        <div className="bn-name">{r.customer_name}</div>
                        <div className="bn-sub">
                          {r.tier_name ?? '—'}
                          {r.policy === 'RIENG' && <span className="badge info">Cơ chế riêng</span>}
                        </div>
                      </td>
                      <td className="bn-barcell">
                        <div className="bn-val">{formatVnd(r.retail_sales)}</div>
                        <div className="bn-bar">
                          <i style={{ width: `${Math.max(2, (r.retail_sales / maxSales) * 100)}%` }} />
                        </div>
                      </td>
                      <td className="right nowrap muted">{formatVnd(r.actual_sales)}</td>
                      <td>
                        {r.month_level ? (
                          <span className="bn-level">{r.month_level}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="right nowrap">
                        {r.month_cash ? <b>{formatVnd(r.month_cash)}</b> : <span className="muted">—</span>}
                      </td>
                      <td>
                        {r.month_gift_text || <span className="muted">—</span>}
                        {r.month_gift_value ? (
                          <small className="muted"> ({formatVnd(r.month_gift_value)})</small>
                        ) : null}
                      </td>
                      <td className="nowrap">
                        {g && oneMonth ? (
                          <span className={`badge ${g.status === 'DA_DUYET' ? 'ok' : 'warn'}`}>
                            {g.voucher_no} · {g.status === 'DA_DUYET' ? 'đã trừ kho' : 'chờ duyệt'}
                          </span>
                        ) : !oneMonth ? (
                          <span className="muted">—</span>
                        ) : r.month_gift_text || r.month_gift_items.length ? (
                          <button
                            className="btn sm"
                            onClick={() =>
                              void act(
                                () =>
                                  api.post('/api/bonus/gifts', {
                                    customer_id: r.customer_id,
                                    month: giftMonth,
                                  }),
                                'Đã lập phiếu xuất quà, chờ duyệt',
                              )
                            }
                          >
                            Lập phiếu
                          </button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="right nowrap">
                        <b className={r.payable < 0 ? 'error' : ''}>{formatVnd(r.payable)}</b>
                        {r.advanced ? <div className="bn-sub">đã ứng {formatVnd(r.advanced)}</div> : null}
                        {r.paid ? <div className="bn-sub">đã chi {formatVnd(r.paid)}</div> : null}
                        {oneMonth && r.payable > 0 && r.month_cash > 0 ? (
                          <button className="btn sm" onClick={() => void payCash(r)}>
                            Chi thưởng
                          </button>
                        ) : null}
                      </td>
                      <td className="nowrap">
                        <div>{formatVnd(r.year_retail)}</div>
                        <div className="bn-sub">
                          {r.year_level || '—'}
                          {r.year_cash ? ` · ${formatVnd(r.year_cash)}` : ''}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      Không có đại lý nào khớp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </Card>
      <div style={{ height: 12 }} />
      {oneMonth && (gifts.data ?? []).length > 0 && (
        <>
          <div style={{ height: 12 }} />
          <Card title={`Phiếu xuất quà thưởng tháng ${giftMonth}`}>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Số phiếu</th>
                    <th>Khách</th>
                    <th>Mức</th>
                    <th>Quà</th>
                    <th>Trạng thái</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(gifts.data ?? []).map((g) => (
                    <tr key={g.id} style={g.status === 'HUY' ? { opacity: 0.5 } : undefined}>
                      <td className="nowrap">
                        <strong>{g.voucher_no}</strong>
                      </td>
                      <td>{g.customer_name}</td>
                      <td>{g.level_label}</td>
                      <td>{g.items.map((i) => `${i.qty} × ${i.name || i.item}`).join(', ')}</td>
                      <td>
                        {g.status === 'CHO_DUYET' && (
                          <span className="badge warn">Chờ duyệt (chưa trừ kho)</span>
                        )}
                        {g.status === 'DA_DUYET' && (
                          <span className="badge ok">Đã duyệt · phiếu kho {g.kho_doc_no}</span>
                        )}
                        {g.status === 'HUY' && (
                          <span className="badge muted">Đã hủy: {g.cancel_reason}</span>
                        )}
                      </td>
                      <td className="nowrap">
                        {canApprove && g.status === 'CHO_DUYET' && (
                          <button
                            className="btn sm primary"
                            onClick={() =>
                              void act(
                                () => api.post(`/api/bonus/gifts/${g.id}/approve`, {}),
                                'Đã duyệt: phiếu xuất kho đã ghi, tồn kho đã trừ',
                              )
                            }
                          >
                            Duyệt & trừ kho
                          </button>
                        )}{' '}
                        {canApprove && g.status !== 'HUY' && (
                          <button
                            className="btn sm danger"
                            onClick={() => {
                              const reason = window.prompt('Lý do hủy phiếu (bắt buộc):', '');
                              if (reason && reason.trim().length >= 3)
                                void act(
                                  () =>
                                    api.post(`/api/bonus/gifts/${g.id}/cancel`, {
                                      reason: reason.trim(),
                                    }),
                                  'Đã hủy phiếu' +
                                    (g.status === 'DA_DUYET' ? ', kho đã trả lại tồn' : ''),
                                );
                            }}
                          >
                            Hủy
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {oneMonth && (cash.data ?? []).length > 0 && (
        <>
          <div style={{ height: 12 }} />
          <Card title={`Phiếu chi thưởng bằng tiền tháng ${giftMonth}`}>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Số phiếu</th>
                    <th>Khách</th>
                    <th className="right">Số tiền</th>
                    <th>Ghi chú</th>
                    <th>Trạng thái</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(cash.data ?? []).map((v) => (
                    <tr key={v.id} style={v.status === 'HUY' ? { opacity: 0.5 } : undefined}>
                      <td className="nowrap">
                        <strong>{v.voucher_no}</strong>
                      </td>
                      <td>{v.customer_name}</td>
                      <td className="right nowrap">{formatVnd(v.amount)}</td>
                      <td>{v.note}</td>
                      <td>
                        {v.status === 'CHO_DUYET' && <span className="badge warn">Chờ duyệt (lập bởi {v.created_by_name})</span>}
                        {v.status === 'DA_CHI' && <span className="badge ok">Đã chi · duyệt bởi {v.approved_by_name}</span>}
                        {v.status === 'HUY' && <span className="badge muted">Đã hủy: {v.cancel_reason}</span>}
                      </td>
                      <td className="nowrap">
                        {(cash.meta as { can_approve?: boolean } | undefined)?.can_approve && v.status === 'CHO_DUYET' && (
                          <button
                            className="btn sm primary"
                            onClick={() =>
                              void act(async () => {
                                await api.post(`/api/bonus/cash/${v.id}/approve`, {});
                                cash.reload();
                                rep.reload();
                              }, 'Đã duyệt: phiếu chi thưởng ghi là đã chi')
                            }
                          >
                            Duyệt chi
                          </button>
                        )}{' '}
                        {(cash.meta as { can_approve?: boolean } | undefined)?.can_approve && v.status !== 'HUY' && (
                          <button
                            className="btn sm danger"
                            onClick={() => {
                              const reason = window.prompt('Lý do hủy phiếu (bắt buộc):', '');
                              if (reason && reason.trim().length >= 3)
                                void act(async () => {
                                  await api.post(`/api/bonus/cash/${v.id}/cancel`, { reason: reason.trim() });
                                  cash.reload();
                                  rep.reload();
                                }, 'Đã hủy phiếu chi thưởng');
                            }}
                          >
                            Hủy
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      <p className="muted" style={{ marginTop: 8 }}>
        "Đã ứng" là khoản thưởng đã trừ thẳng vào đơn trong kỳ. "Còn phải chi" âm nghĩa là đã
        ứng nhiều hơn thưởng đạt được. "Đã chi" là thưởng bằng tiền đã lập phiếu chi thưởng.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Cơ chế thưởng (trang quản trị) */
function TierEditor({
  value,
  onChange,
  period,
  khoItems,
  readOnly,
}: {
  readOnly?: boolean;
  value: Tier[];
  onChange: (t: Tier[]) => void;
  period: 'MONTH' | 'YEAR';
  khoItems: Array<{ code: string; name: string }>;
}) {
  const set = (i: number, patch: Partial<Tier>) =>
    onChange(value.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  const num = (v: string) => Math.max(0, Math.round(Number(v.replace(/[.,\s]/g, '')) || 0));
  if (readOnly) {
    const nameOf = (code: string) => khoItems.find((k) => k.code === code)?.name ?? code;
    return (
      <div className="table-wrap" style={{ padding: '0 8px 12px' }}>
        <table className="tier-table tier-view">
          <thead>
            <tr>
              <th>{period === 'MONTH' ? 'Mức' : 'Mốc'}</th>
              <th className="right">Doanh số lẻ từ</th>
              <th className="right">Thưởng tiền</th>
              <th>Thưởng hàng</th>
              <th className="right">Giá trị hàng</th>
              {period === 'MONTH' && <th>Quà xuất kho</th>}
            </tr>
          </thead>
          <tbody>
            {value.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 18 }}>
                  Chưa có mốc nào.
                </td>
              </tr>
            )}
            {value.map((t, i) => (
              <tr key={i}>
                <td>
                  <span className="bn-level">{t.label || `Mức ${i + 1}`}</span>
                </td>
                <td className="right">{formatVnd(t.threshold)}</td>
                <td className="right v-cash">{t.cash ? formatVnd(t.cash) : '—'}</td>
                <td>{t.gift_text || <span className="muted">—</span>}</td>
                <td className="right v-gift">{t.gift_value ? formatVnd(t.gift_value) : '—'}</td>
                {period === 'MONTH' && (
                  <td>
                    {(t.gift_items ?? []).length
                      ? t.gift_items.map((g) => `${g.qty} × ${nameOf(g.item)}`).join(', ')
                      : <span className="muted">—</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="table-wrap" style={{ padding: '0 8px 12px' }}>
      <table className="tier-table">
        <thead>
          <tr>
            <th>{period === 'MONTH' ? 'Mức' : 'Mốc'}</th>
            <th className="right">Doanh số lẻ từ (≥, đ)</th>
            <th className="right">Thưởng tiền (đ)</th>
            <th>Thưởng hàng (mô tả)</th>
            <th className="right">Giá trị hàng (đ)</th>
            {period === 'MONTH' && <th>Quà xuất kho (mã kho × số lượng)</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {value.map((t, i) => (
            <tr key={i}>
              <td>
                <input
                  value={t.label}
                  onChange={(e) => set(i, { label: e.target.value })}
                  className="t-label" 
                />
              </td>
              <td className="right">
                <input
                  inputMode="numeric"
                  className="num t-money"
                  value={t.threshold}
                  onChange={(e) => set(i, { threshold: num(e.target.value) })}
                                  />
              </td>
              <td className="right">
                <input
                  inputMode="numeric"
                  className="num t-money"
                  value={t.cash}
                  onChange={(e) => set(i, { cash: num(e.target.value) })}
                                  />
              </td>
              <td>
                <input
                  value={t.gift_text}
                  onChange={(e) => set(i, { gift_text: e.target.value })}
                  className="t-text"
                  placeholder="Ví dụ: 60 tẩy lồng, 65 tẩy gioăng"
                />
              </td>
              <td className="right">
                <input
                  inputMode="numeric"
                  className="num t-money"
                  value={t.gift_value}
                  onChange={(e) => set(i, { gift_value: num(e.target.value) })}
                                  />
              </td>
              {period === 'MONTH' && (
                <td className="t-gifts">
                  {(t.gift_items ?? []).map((g, gi) => (
                    <div key={gi} className="gift-row">
                      <input
                        list="kho-items"
                        value={g.item}
                        placeholder="Mã kho"
                        className="g-item" 
                        onChange={(e) =>
                          set(i, {
                            gift_items: t.gift_items.map((x, k) =>
                              k === gi ? { ...x, item: e.target.value } : x,
                            ),
                          })
                        }
                      />
                      <input
                        inputMode="numeric"
                        value={g.qty}
                        className="num g-qty" 
                        onChange={(e) =>
                          set(i, {
                            gift_items: t.gift_items.map((x, k) =>
                              k === gi ? { ...x, qty: num(e.target.value) } : x,
                            ),
                          })
                        }
                      />
                      <button
                        className="btn sm"
                        onClick={() =>
                          set(i, { gift_items: t.gift_items.filter((_, k) => k !== gi) })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn sm"
                    onClick={() =>
                      set(i, { gift_items: [...(t.gift_items ?? []), { item: '', qty: 1 }] })
                    }
                  >
                    + quà
                  </button>
                </td>
              )}
              <td className="t-actions">
                <button
                  className="btn sm danger"
                  onClick={() => onChange(value.filter((_, k) => k !== i))}
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="kho-items">
        {khoItems.map((k) => (
          <option key={k.code} value={k.code}>
            {k.name}
          </option>
        ))}
      </datalist>
      <div className="tier-add">
        <button
          className="btn"
          onClick={() =>
            onChange([
              ...value,
              { label: '', threshold: 0, cash: 0, gift_text: '', gift_value: 0, gift_items: [] },
            ])
          }
        >
          + Thêm {period === 'MONTH' ? 'mức' : 'mốc'}
        </button>
      </div>
    </div>
  );
}

function PolicyPanel() {
  const toast = useToast();
  const { can } = useAuth();
  const pol = useApi<Policy>('/api/bonus/policy');
  const custs = useApi<Array<{ id: string; name: string }>>('/api/customers?limit=2000');
  const cat = useApi<{ items: Array<{ code: string; name: string; cls: string; active: number }> }>(
    '/api/hub/kho/catalog',
  );
  const khoItems = (cat.data?.items ?? []).filter((i) => i.active && i.cls !== 'COMBO');
  const [scope, setScope] = useState<string>(''); // '' = chung, còn lại = customer_id
  const [month, setMonth] = useState<Tier[]>([]);
  const [year, setYear] = useState<Tier[]>([]);
  const [saving, setSaving] = useState(false);
  // Trong web chung (khung nhúng) chỉ xem; thêm / sửa / xóa làm ở Trang quản trị.
  const viewOnly = typeof document !== 'undefined' && document.documentElement.classList.contains('embedded');
  const ceo = !viewOnly && (pol.data?.can_edit === true || can('settings.manage'));

  useEffect(() => {
    if (!pol.data) return;
    const src =
      scope === '' ? pol.data.general : pol.data.overrides.find((o) => o.customer_id === scope);
    setMonth(((src && src.MONTH) || []).map((t) => ({ ...t })));
    setYear(((src && src.YEAR) || []).map((t) => ({ ...t })));
  }, [pol.data, scope]);

  async function save(period: 'MONTH' | 'YEAR', tiers: Tier[]) {
    setSaving(true);
    try {
      await api.put('/api/bonus/policy', { customer_id: scope, period, tiers });
      toast.success(`Đã lưu cơ chế thưởng ${period === 'MONTH' ? 'tháng' : 'năm'}`);
      pol.reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Chưa lưu được');
    } finally {
      setSaving(false);
    }
  }

  const overrideIds = new Set((pol.data?.overrides ?? []).map((o) => o.customer_id));

  return (
    <div>
      <p className="muted" style={{ margin: '0 0 12px' }}>
        {ceo
          ? 'Đặt mốc thưởng tháng và năm theo doanh số lẻ. Có cơ chế chung; khách có cơ chế riêng thì dùng riêng, thay hẳn cơ chế chung.'
          : 'Chỉ xem. Muốn thêm, sửa hoặc xóa mốc thưởng thì vào Trang quản trị.'}
      </p>
      <Card title="Áp dụng cho">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="bn-select"
          >
            <option value="">Cơ chế CHUNG (mọi khách)</option>
            {(pol.data?.overrides ?? []).map((o) => (
              <option key={o.customer_id} value={o.customer_id}>
                Riêng: {o.customer_name}
              </option>
            ))}
            {(ceo ? (custs.data ?? []) : [])
              .filter((c) => !overrideIds.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  Tạo cơ chế riêng cho: {c.name}
                </option>
              ))}
          </select>
          {scope !== '' && (
            <span className="muted">
              {overrideIds.has(scope)
                ? 'Khách này đang có cơ chế riêng.'
                : 'Khách này đang theo cơ chế chung. Nhập mốc riêng rồi lưu để tạo cơ chế riêng.'}
            </span>
          )}
        </div>
      </Card>
      <div style={{ height: 12 }} />
      <Card
        title={scope === '' ? 'Thưởng THÁNG (chung)' : 'Thưởng THÁNG (riêng khách)'}
        action={
          ceo ? (
            <button
              className="btn primary"
              disabled={saving}
              onClick={() => void save('MONTH', month)}
            >
              Lưu thưởng tháng
            </button>
          ) : undefined
        }
      >
        <TierEditor value={month} onChange={setMonth} period="MONTH" khoItems={khoItems} readOnly={!ceo} />
        {scope !== '' && overrideIds.has(scope) && ceo && (
          <p className="muted">Xóa hết các dòng rồi Lưu nếu muốn khách này quay về cơ chế chung.</p>
        )}
      </Card>
      <div style={{ height: 12 }} />
      <Card
        title={
          scope === '' ? 'Thưởng NĂM (chung, theo doanh số lẻ lũy kế)' : 'Thưởng NĂM (riêng khách)'
        }
        action={
          ceo ? (
            <button
              className="btn primary"
              disabled={saving}
              onClick={() => void save('YEAR', year)}
            >
              Lưu thưởng năm
            </button>
          ) : undefined
        }
      >
        <TierEditor value={year} onChange={setYear} period="YEAR" khoItems={khoItems} readOnly={!ceo} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Trang chung: xếp hạng + cơ chế */
export function BonusHubPage({ initial = 'rank' }: { initial?: 'rank' | 'policy' }) {
  const { can } = useAuth();
  const canPolicy = can('settings.manage');
  const [tab, setTab] = useState<'rank' | 'policy'>(initial === 'policy' && canPolicy ? 'policy' : 'rank');
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <div>
      <div className="bn-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'rank'} className={tab === 'rank' ? 'on' : ''} onClick={() => setTab('rank')}>
          Bảng xếp hạng doanh số
        </button>
        {canPolicy && (
          <button role="tab" aria-selected={tab === 'policy'} className={tab === 'policy' ? 'on' : ''} onClick={() => setTab('policy')}>
            Cơ chế thưởng
          </button>
        )}
        <div ref={setSlot} className="bn-slot" />
      </div>
      {tab === 'rank' ? <RankingPanel slot={slot} /> : <PolicyPanel />}
    </div>
  );
}

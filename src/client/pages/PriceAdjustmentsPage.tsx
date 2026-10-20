import { useState } from 'react';
import type { ProductItem } from '@shared/types';
import { formatVnDate, vnDate } from '@shared/datetime';
import { formatVnd } from '@shared/money';
import { ApiError, api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useAuth } from '../components/AuthProvider';
import { Card, Field, Modal, PageHead, StateBlock, useToast } from '../components/ui';

interface Adj {
  id: string;
  label: string;
  scope: 'ALL' | 'GROUP' | 'PRODUCT';
  product_sku: string | null;
  product_name: string | null;
  group_name: string | null;
  products: Array<{ id: string; sku: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  excludes: Array<{ id: string; sku: string; name: string }>;
  tier_ids: string[];
  kind: 'PERCENT' | 'AMOUNT' | 'FIXED';
  value: number;
  round_to: number;
  valid_from: string;
  valid_to: string | null;
  status: 'ACTIVE' | 'OFF';
  state: 'DANG_AP_DUNG' | 'SAP_AP_DUNG' | 'HET_HAN' | 'OFF';
  created_by_name: string | null;
}

const STATE_LABEL: Record<Adj['state'], [string, string]> = {
  DANG_AP_DUNG: ['Đang áp dụng', 'ok'],
  SAP_AP_DUNG: ['Sắp áp dụng', 'info'],
  HET_HAN: ['Đã hết hạn', 'muted'],
  OFF: ['Đã tắt', 'muted'],
};

function describe(a: Adj): string {
  if (a.kind === 'PERCENT') return `${a.value > 0 ? '+' : ''}${a.value}%`;
  if (a.kind === 'AMOUNT') return `${a.value > 0 ? '+' : ''}${formatVnd(a.value)} / đơn vị`;
  return `Đặt giá ${formatVnd(a.value)}`;
}

/**
 * Giá điều chỉnh / khuyến mại: lớp TẠM THỜI đặt lên trên bảng giá 8 cấp, không sửa bảng giá gốc.
 * Ví dụ nguyên liệu tăng: một số mã +1% trong một thời gian; hết hạn hoặc tắt là về giá gốc.
 */
export function PriceAdjustmentsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const list = useApi<Adj[]>('/api/price-adjustments');
  const [creating, setCreating] = useState(false);
  const canEdit = can('price.approve');
  const rows = list.data ?? [];

  async function toggle(a: Adj) {
    try {
      await api.post(`/api/price-adjustments/${a.id}/toggle`, { active: a.status !== 'ACTIVE' });
      toast.success(a.status === 'ACTIVE' ? 'Đã tắt, về giá gốc' : 'Đã bật lại');
      list.reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Chưa thực hiện được');
    }
  }
  async function remove(a: Adj) {
    if (!window.confirm(`Xóa điều chỉnh "${a.label}"? Giá về bảng giá gốc ngay.`)) return;
    try {
      await api.post(`/api/price-adjustments/${a.id}/delete`, {});
      toast.success('Đã xóa');
      list.reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Chưa xóa được');
    }
  }

  return (
    <div>
      <PageHead
        title="Giá điều chỉnh / khuyến mại"
        subtitle="Lớp tạm thời đặt lên trên bảng giá gốc, không sửa bảng giá. Hết hạn hoặc tắt là về giá gốc ngay. Đơn đã chốt giữ nguyên giá đã bán."
        actions={
          canEdit ? (
            <button className="btn primary" onClick={() => setCreating(true)}>
              + Thêm điều chỉnh
            </button>
          ) : undefined
        }
      />
      <Card bodyClass="">
        <StateBlock
          loading={list.loading}
          error={list.error}
          empty={rows.length === 0}
          emptyText="Chưa có điều chỉnh nào. Bảng giá gốc đang được dùng nguyên vẹn."
        >
          <div className="table-wrap">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Lý do / chương trình</th>
                  <th>Áp cho</th>
                  <th>Cấp</th>
                  <th>Điều chỉnh</th>
                  <th>Từ</th>
                  <th>Đến</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} style={a.state === 'HET_HAN' || a.state === 'OFF' ? { opacity: 0.6 } : undefined}>
                    <td>
                      <strong>{a.label}</strong>
                    </td>
                    <td>
                      <div>
                        {a.scope === 'ALL' && 'Mọi sản phẩm'}
                        {a.scope === 'GROUP' &&
                          `Nhóm: ${(a.groups.length ? a.groups.map((g) => g.name) : [a.group_name ?? '']).join(', ')}`}
                        {a.scope === 'PRODUCT' &&
                          (a.products.length > 1 ? (
                            <span title={a.products.map((p) => `${p.sku} · ${p.name}`).join('\n')}>
                              {a.products.length} mã: {a.products.slice(0, 2).map((p) => p.sku).join(', ')}
                              {a.products.length > 2 ? ` … +${a.products.length - 2}` : ''}
                            </span>
                          ) : (
                            `${a.products[0]?.sku ?? a.product_sku ?? ''} · ${a.products[0]?.name ?? a.product_name ?? ''}`
                          ))}
                      </div>
                      {a.excludes.length > 0 && (
                        <div className="muted" style={{ fontSize: 12.5 }} title={a.excludes.map((p) => `${p.sku} · ${p.name}`).join('\n')}>
                          Không áp cho {a.excludes.length} mã: {a.excludes.slice(0, 3).map((p) => p.sku).join(', ')}
                          {a.excludes.length > 3 ? ' …' : ''}
                        </div>
                      )}
                    </td>
                    <td>{a.tier_ids.length ? `${a.tier_ids.length} cấp` : 'Mọi cấp'}</td>
                    <td className="nowrap">
                      <strong>{describe(a)}</strong>
                    </td>
                    <td className="nowrap">{formatVnDate(a.valid_from)}</td>
                    <td className="nowrap">{a.valid_to ? formatVnDate(a.valid_to) : 'Đến khi tắt'}</td>
                    <td>
                      <span className={`badge ${STATE_LABEL[a.state][1]}`}>{STATE_LABEL[a.state][0]}</span>
                    </td>
                    <td className="nowrap">
                      {canEdit && (
                        <>
                          <button className="btn sm" onClick={() => void toggle(a)}>
                            {a.status === 'ACTIVE' ? 'Tắt' : 'Bật'}
                          </button>{' '}
                          <button className="btn sm danger" onClick={() => void remove(a)}>
                            Xóa
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </Card>
      <p className="muted" style={{ marginTop: 8 }}>
        Một mã ở một cấp chỉ chịu <b>một</b> điều chỉnh: phạm vi cụ thể hơn thắng (mã &gt; nhóm &gt; tất cả), cùng mức thì cái tạo sau thắng.
        Khách gia công dùng bảng giá riêng nên không bị áp.
      </p>
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

/** Chọn nhiều mục trong một danh sách dài: ô tìm, tick từng mục, chọn hết các mục đang hiện. */
function MultiPick({
  items,
  value,
  onChange,
  placeholder,
}: {
  items: Array<{ id: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState('');
  const fold = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase();
  const needle = fold(q.trim());
  const shown = items.filter((i) => !needle || needle.split(/\s+/).every((w) => fold(i.label).includes(w)));
  const picked = new Set(value);
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((x) => x !== id));
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          style={{ flex: '1 1 180px', minWidth: 140 }}
        />
        <button type="button" className="btn sm" onClick={() => onChange([...new Set([...value, ...shown.map((i) => i.id)])])}>
          Chọn các mã đang hiện
        </button>
        <button type="button" className="btn sm" onClick={() => onChange([])} disabled={!value.length}>
          Bỏ chọn
        </button>
        <b style={{ fontSize: 13 }}>{value.length ? `Đã chọn ${value.length}` : 'Chưa chọn'}</b>
      </div>
      <div style={{ maxHeight: 190, overflowY: 'auto', padding: '4px 8px' }}>
        {shown.length === 0 && <p className="muted" style={{ margin: 8 }}>Không có mục nào khớp.</p>}
        {shown.map((i) => (
          <label
            key={i.id}
            style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', cursor: 'pointer', fontWeight: 400, textAlign: 'left' }}
          >
            <input
              type="checkbox"
              checked={picked.has(i.id)}
              onChange={(e) => toggle(i.id, e.target.checked)}
              style={{ width: 16, height: 16, padding: 0, margin: 0, flex: 'none' }}
            />
            <span style={{ flex: 1, textAlign: 'left' }}>{i.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const cat = useApi<{ tiers: Array<{ id: string; code: string; name: string }>; products: ProductItem[] }>('/api/prices');
  const groups = useApi<Array<{ id: string; name: string }>>('/api/product-groups');
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<'ALL' | 'GROUP' | 'PRODUCT'>('PRODUCT');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [tiers, setTiers] = useState<string[]>([]);
  const [kind, setKind] = useState<'PERCENT' | 'AMOUNT' | 'FIXED'>('PERCENT');
  const [value, setValue] = useState('1');
  const [roundTo, setRoundTo] = useState('100');
  const [from, setFrom] = useState(vnDate());
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const product = (cat.data?.products ?? []).find((p) => productIds.includes(p.id)) ?? (scope === 'PRODUCT' ? undefined : (cat.data?.products ?? []).find((p) => !excludeIds.includes(p.id) && (scope === 'ALL' || groupIds.includes(p.group_id ?? ''))));
  const tierList = cat.data?.tiers ?? [];
  const sample = (() => {
    const v = Number(String(value).replace(',', '.'));
    if (!product || !Number.isFinite(v)) return null;
    const t = tierList.find((x) => tiers.length === 0 || tiers.includes(x.id));
    const base = t ? product.prices[t.code] : null;
    if (base === null || base === undefined) return null;
    const step = Math.max(1, Number(roundTo) || 1);
    const raw = kind === 'PERCENT' ? base * (1 + v / 100) : kind === 'AMOUNT' ? base + v : v;
    return { tier: t?.name ?? '', base, after: Math.max(0, Math.round(raw / step) * step) };
  })();

  async function save() {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.post('/api/price-adjustments', {
        label,
        scope,
        product_ids: scope === 'PRODUCT' ? productIds : [],
        group_ids: scope === 'GROUP' ? groupIds : [],
        exclude_ids: scope === 'PRODUCT' ? [] : excludeIds,
        tier_ids: tiers,
        kind,
        value: Number(String(value).replace(',', '.')),
        round_to: Math.max(1, Number(roundTo) || 100),
        valid_from: from,
        valid_to: to || null,
      });
      toast.success('Đã thêm điều chỉnh giá');
      onDone();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFields(e.fields ?? {});
      } else setError('Chưa lưu được, thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Thêm giá điều chỉnh / khuyến mại"
      onClose={onClose}
      footer={
        <button className="btn primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Đang lưu…' : 'Lưu điều chỉnh'}
        </button>
      }
    >
      <div className="form-grid">
        <Field label="Lý do / tên chương trình" error={fields.label} full>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ví dụ: Nguyên liệu tăng giá tháng 10" />
        </Field>
        <Field label="Áp cho" full>
          <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="PRODUCT">Một hoặc nhiều mã sản phẩm</option>
            <option value="GROUP">Một hoặc nhiều nhóm sản phẩm</option>
            <option value="ALL">Mọi sản phẩm</option>
          </select>
        </Field>
        {scope === 'PRODUCT' && (
          <Field label="Chọn các mã sản phẩm" error={fields.product_ids} full>
            <MultiPick
              items={(cat.data?.products ?? []).map((p) => ({ id: p.id, label: `${p.sku} · ${p.name}` }))}
              value={productIds}
              onChange={setProductIds}
              placeholder="Tìm mã hoặc tên sản phẩm…"
            />
          </Field>
        )}
        {scope === 'GROUP' && (
          <Field label="Chọn các nhóm sản phẩm" error={fields.group_ids} full>
            <MultiPick
              items={(groups.data ?? []).map((g) => ({ id: g.id, label: g.name }))}
              value={groupIds}
              onChange={setGroupIds}
              placeholder="Tìm nhóm…"
            />
          </Field>
        )}
        {scope !== 'PRODUCT' && (
          <Field
            label="Không áp cho các mã này (nếu có)"
            hint="Ví dụ áp cả nhóm nước giặt nhưng AiBio không tăng; áp lau sàn nhưng lau sàn chuyên dụng không tăng. Mã nào tick ở đây sẽ giữ nguyên giá gốc."
            full
          >
            <MultiPick
              items={(cat.data?.products ?? [])
                .filter((p) => scope === 'ALL' || !groupIds.length || groupIds.includes(p.group_id ?? ''))
                .map((p) => ({ id: p.id, label: `${p.sku} · ${p.name}` }))}
              value={excludeIds}
              onChange={setExcludeIds}
              placeholder="Tìm mã cần loại ra…"
            />
          </Field>
        )}
        <Field label="Cấp áp dụng" hint="Không tick cấp nào = áp cho mọi cấp" full>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {tierList.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={tiers.includes(t.id)}
                  onChange={(e) => setTiers(e.target.checked ? [...tiers, t.id] : tiers.filter((x) => x !== t.id))}
                />{' '}
                {t.name}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Cách điều chỉnh">
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="PERCENT">Tăng / giảm theo %</option>
            <option value="AMOUNT">Tăng / giảm số tiền cố định (đ / đơn vị)</option>
            <option value="FIXED">Đặt thẳng giá khuyến mại (đ)</option>
          </select>
        </Field>
        <Field
          label={kind === 'PERCENT' ? 'Số % (tăng dương, giảm âm)' : kind === 'AMOUNT' ? 'Số tiền (đ, giảm thì âm)' : 'Giá khuyến mại (đ)'}
          error={fields.value}
        >
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Làm tròn đến (đ)" hint="Ví dụ 100: 32.320 thành 32.300">
          <select value={roundTo} onChange={(e) => setRoundTo(e.target.value)}>
            <option value="1">1 đ</option>
            <option value="100">100 đ</option>
            <option value="500">500 đ</option>
            <option value="1000">1.000 đ</option>
          </select>
        </Field>
        <Field label="Từ ngày" error={fields.valid_from}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày (để trống = đến khi tắt)" error={fields.valid_to}>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {sample && (
        <p className="muted">
          Ví dụ ({sample.tier || 'cấp đầu tiên'}): {formatVnd(sample.base)} → <b>{formatVnd(sample.after)}</b>
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}

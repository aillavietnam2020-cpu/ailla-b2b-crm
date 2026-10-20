import { useState } from 'react';
import type { PriceTier, ProductItem } from '@shared/types';
import { TIER_LABELS, TIER_ORDER, type TierCode } from '@shared/enums';

/** Các cột giá: 8 cấp + cấp Nhân viên (giá nội bộ do quản lý điền). */
const PRICE_COLS: string[] = [...TIER_ORDER, 'NHAN_VIEN'];
const colLabel = (code: string) => (code === 'NHAN_VIEN' ? 'Nhân viên' : TIER_LABELS[code as TierCode]);
import { formatVnd } from '@shared/money';
import { vnDate } from '@shared/datetime';
import { useApi, useDebounced } from '../lib/hooks';
import { useAuth } from '../components/AuthProvider';
import { Card, ErrorBox, Modal, StateBlock, useToast } from '../components/ui';
import { ApiError, api } from '../lib/api';

interface TierRow {
  id: string;
  code: string;
  name: string;
  rank: number;
}

/**
 * Bảng giá 8 cấp.
 * - Nhân viên: chỉ đọc, ô "Chưa có" là cấp chưa có giá và bị chặn bán.
 * - Quản lý: bấm vào ô để đề nghị giá mới (CEO duyệt mới có hiệu lực).
 * - CEO: sửa là có hiệu lực ngay theo ngày hiệu lực đã chọn.
 */
export function PricesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [editing, setEditing] = useState<{ product: ProductItem; tier: TierRow } | null>(null);
  const [adding, setAdding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedQ = useDebounced(q);

  // Trên web vận hành (vanhanh) chỉ XEM bảng giá; sửa giá, thêm / xóa sản phẩm chỉ ở trang quản trị.
  const host = window.location.hostname;
  const onAdminSite = host.startsWith('quantri.') || host === 'localhost' || host === '127.0.0.1';
  const canEditPrice = can('price.propose') && onAdminSite;
  const canApprovePrice = can('price.approve') && onAdminSite;
  const canManageProduct = can('product.manage') && onAdminSite;

  // Sản phẩm gia công chỉ nằm trong bảng giá riêng của từng khách nên không hiện ở bảng 8 cấp.
  const query = new URLSearchParams({ limit: '500', scope: 'TIER', _: String(reloadKey) });
  if (debouncedQ) query.set('q', debouncedQ);
  if (onlyMissing) query.set('missing_price', '1');
  const prices = useApi<{ products: ProductItem[]; tiers: TierRow[]; date: string }>(
    `/api/prices?${query.toString()}`,
  );

  const products = prices.data?.products ?? [];
  const tiers = prices.data?.tiers ?? [];
  const missingCount = products.filter((p) => p.missing_tiers.length > 0).length;
  const tierByCode = new Map(tiers.map((t) => [t.code, t]));

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Bảng giá 8 cấp</h2>
          <p>
            Giá hiệu lực ngày {prices.data?.date ?? '—'}. Ô "Chưa có" nghĩa là cấp đó chưa có giá và bị chặn bán.
            {canEditPrice && ' Bấm vào một ô giá để sửa.'}
          </p>
        </div>
        {canManageProduct && (
          <div className="actions">
            <button className="btn primary" onClick={() => setAdding(true)}>
              Thêm sản phẩm
            </button>
          </div>
        )}
      </div>

      {missingCount > 0 && (
        <div className="alert-box warn" style={{ marginBottom: 16 }}>
          {missingCount} mã hàng đang thiếu giá ở ít nhất một cấp. Không được tự áp giá cho các cấp này.
        </div>
      )}

      {canEditPrice && !canApprovePrice && (
        <div className="alert-box" style={{ marginBottom: 16 }}>
          Quản lý sửa giá sẽ tạo <strong>đề nghị chờ CEO duyệt</strong>; giá cũ vẫn áp dụng cho tới khi được duyệt.
        </div>
      )}

      <Card bodyClass="">
        <div className="toolbar">
          <div className="search">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã SKU hoặc tên sản phẩm…" />
          </div>
          <label className="btn" style={{ fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(e) => setOnlyMissing(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Chỉ mã thiếu giá
          </label>
        </div>

        <TierRulesCard canEdit={can('customer.tier.change') && onAdminSite} />

        <StateBlock
          loading={prices.loading}
          error={prices.error}
          empty={products.length === 0}
          emptyText="Chưa có sản phẩm nào. Hãy import bảng giá từ file Excel hoặc bấm Thêm sản phẩm."
        >
          <div className="table-wrap">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Mã SKU</th>
                  <th>Tên sản phẩm</th>
                  <th>Nhóm</th>
                  {PRICE_COLS.map((code) => (
                    <th key={code} className="right">
                      {colLabel(code)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.sku}</strong>
                    </td>
                    <td>{product.name}</td>
                    <td className="muted">{product.group_name ?? '—'}</td>
                    {PRICE_COLS.map((code) => {
                      const amount = product.prices[code];
                      const eff = product.eff_prices?.[code];
                      const adj = (product.adjusted ?? []).find((x) => x.tier === code);
                      const tier = tierByCode.get(code);
                      const content =
                        amount === null || amount === undefined ? (
                          <span className="badge orange">Chưa có</span>
                        ) : (
                          formatVnd(amount)
                        );
                      return (
                        <td key={code} className="right nowrap">
                          {canEditPrice && tier ? (
                            <button
                              className="link-btn"
                              onClick={() => setEditing({ product, tier })}
                              title="Sửa giá"
                            >
                              {content}
                            </button>
                          ) : (
                            content
                          )}
                          {adj && eff !== null && eff !== undefined && eff !== amount && (
                            <div>
                              <small className="badge orange" title={`Đang điều chỉnh: ${adj.label}`}>
                                đang áp {formatVnd(eff)}
                              </small>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </Card>

      {editing && (
        <PriceEditModal
          product={editing.product}
          tier={editing.tier}
          currentAmount={editing.product.prices[editing.tier.code] ?? null}
          immediate={canApprovePrice}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            toast.success(message);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {adding && (
        <NewProductModal
          tiers={tiers}
          immediate={canApprovePrice}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            toast.success('Đã thêm sản phẩm. Nhớ đặt giá cho các cấp trước khi bán.');
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}

function PriceEditModal({
  product,
  tier,
  currentAmount,
  immediate,
  onClose,
  onDone,
}: {
  product: ProductItem;
  tier: TierRow;
  currentAmount: number | null;
  immediate: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [amount, setAmount] = useState(currentAmount === null ? '' : String(currentAmount));
  const [validFrom, setValidFrom] = useState(vnDate());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/prices', {
        product_id: product.id,
        tier_id: tier.id,
        amount: amount === '' ? null : Number(amount),
        valid_from: validFrom,
        reason: reason || null,
      });
      onDone(immediate ? 'Đã cập nhật giá' : 'Đã gửi đề nghị giá lên CEO duyệt');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được giá');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Giá ${product.sku} · ${tier.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <ErrorBox message={error} />
          <p className="muted">
            {product.name}. Giá hiện tại:{' '}
            <strong>{currentAmount === null ? 'Chưa có' : formatVnd(currentAmount)}</strong>.
            {immediate
              ? ' Giá mới có hiệu lực ngay từ ngày chọn bên dưới.'
              : ' Đề nghị này cần CEO duyệt mới áp dụng.'}
          </p>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Giá mới (đồng)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Để trống = xoá giá cấp này"
              />
              <span className="muted" style={{ fontSize: 12 }}>
                Để trống nghĩa là cấp này chưa có giá và sẽ bị chặn bán.
              </span>
            </div>
            <div className="field">
              <label>Áp dụng từ ngày</label>
              <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              <span className="muted" style={{ fontSize: 12 }}>
                Đơn đã chốt trước ngày này giữ nguyên giá cũ.
              </span>
            </div>
            <div className="field full">
              <label>Lý do thay đổi</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: điều chỉnh giá theo bảng giá quý 3"
              />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Đang lưu…' : immediate ? 'Lưu giá' : 'Gửi đề nghị'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewProductModal({
  tiers,
  immediate,
  onClose,
  onDone,
}: {
  tiers: TierRow[];
  immediate: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const groups = useApi<Array<{ id: string; name: string }>>('/api/product-groups');
  const [form, setForm] = useState({ sku: '', name: '', unit: '', pack_size: '', group_id: '' });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const created = await api.post<{ id: string }>('/api/products', {
        sku: form.sku.trim(),
        name: form.name.trim(),
        unit: form.unit || null,
        pack_size: form.pack_size || null,
        group_id: form.group_id || null,
      });
      // Giá các cấp điền luôn lúc tạo: cấp nào để trống thì chưa có giá (bị chặn bán).
      const filled = tiers.filter((t) => (prices[t.id] ?? '').trim() !== '');
      for (const t of filled) {
        await api.post('/api/prices', {
          product_id: created.data.id,
          tier_id: t.id,
          amount: Math.round(Number(prices[t.id])),
          valid_from: vnDate(),
          reason: 'Giá khi tạo sản phẩm mới',
        });
      }
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else setError('Không thêm được sản phẩm');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Thêm sản phẩm" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <ErrorBox message={error} />
          <div className="form-grid">
            <div className="field">
              <label>Mã SKU *</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
              {fields.sku && <span className="error">{fields.sku}</span>}
            </div>
            <div className="field">
              <label>Tên sản phẩm *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              {fields.name && <span className="error">{fields.name}</span>}
            </div>
            <div className="field">
              <label>Đơn vị tính</label>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="Chai / Thùng / Can"
              />
            </div>
            <div className="field">
              <label>Quy cách</label>
              <input
                value={form.pack_size}
                onChange={(e) => setForm({ ...form, pack_size: e.target.value })}
                placeholder="500ml, 5L, 12 chai/thùng…"
              />
            </div>
            <div className="field">
              <label>Nhóm sản phẩm</label>
              <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
                <option value="">— chưa có nhóm —</option>
                {(groups.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <h4 style={{ margin: '16px 0 4px' }}>Giá các cấp (đồng)</h4>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 12.5 }}>
            {immediate ? 'Điền được cấp nào lưu luôn cấp đó, có hiệu lực từ hôm nay.' : 'Giá điền ở đây sẽ gửi CEO duyệt.'} Cấp để trống = chưa có
            giá, bị chặn bán cho tới khi đặt giá.
          </p>
          <div className="form-grid">
            {tiers.map((t) => (
              <div className="field" key={t.id}>
                <label>{t.name}</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={prices[t.id] ?? ''}
                  onChange={(e) => setPrices({ ...prices, [t.id]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Thêm sản phẩm'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Điều kiện lên cấp giá: tiền hàng tối thiểu của MỘT đơn để sale tự đưa khách lên cấp đó ngay khi lập đơn.
 * Đơn chưa đạt (hoặc cấp để trống / 0) thì sale vẫn lập đơn nháp và gửi xin Quản lý duyệt đổi cấp.
 */
function TierRulesCard({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [key, setKey] = useState(0);
  const tiers = useApi<PriceTier[]>(`/api/tiers?_=${key}`);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const list = (tiers.data ?? []).filter((t) => t.code !== 'KHAC' && t.code !== 'NHAN_VIEN');
  async function save(t: PriceTier) {
    const raw = (draft[t.id] ?? '').replace(/[^\d]/g, '');
    if (draft[t.id] === undefined) return;
    try {
      await api.put(`/api/tiers/${t.id}/upgrade-rule`, { min_order_amount: raw === '' ? 0 : Number(raw) });
      toast.success(`Đã lưu điều kiện lên cấp ${t.name}`);
      setDraft((d) => {
        const n = { ...d };
        delete n[t.id];
        return n;
      });
      setKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Chưa lưu được');
    }
  }
  if (list.length === 0) return null;
  return (
    <Card title="Điều kiện lên cấp giá (sale tự đưa khách lên cấp ngay trên đơn)" bodyClass="">
      <p className="muted" style={{ margin: '8px 14px' }}>
        Điền <b>tiền hàng tối thiểu của một đơn</b> để được lên cấp đó. Đơn đạt thì cấp của khách đổi luôn khi lưu đơn. Đơn chưa đạt hoặc
        cấp để trống (0) thì sale vẫn lập đơn nháp giá cấp mới, gửi khách được, và gửi xin Quản lý duyệt đổi cấp. Chị, chị Thảo và quản lý
        đổi cấp ở đâu cũng không bị ràng buộc.
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Cấp giá</th>
              <th className="right">Đơn từ (đồng, tiền hàng)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => {
              const cur = t.min_order_amount ?? 0;
              const val = draft[t.id] ?? (cur ? String(cur) : '');
              return (
                <tr key={t.id}>
                  <td>
                    <strong>{t.name}</strong>
                  </td>
                  <td className="right">
                    {canEdit ? (
                      <input
                        inputMode="numeric"
                        style={{ width: 180, textAlign: 'right' }}
                        placeholder="0 (chưa đặt)"
                        value={val === '' ? '' : Number(val.replace(/[^\d]/g, '') || 0).toLocaleString('vi-VN')}
                        onChange={(e) => setDraft((d) => ({ ...d, [t.id]: e.target.value.replace(/[^\d]/g, '') }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void save(t);
                        }}
                      />
                    ) : cur ? (
                      formatVnd(cur)
                    ) : (
                      <span className="muted">chưa đặt</span>
                    )}
                  </td>
                  <td>
                    {canEdit && draft[t.id] !== undefined && (
                      <button className="btn sm primary" onClick={() => void save(t)}>
                        Lưu
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

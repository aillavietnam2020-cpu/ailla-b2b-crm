import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { CustomerListItem, PriceTier, ProductItem } from '@shared/types';
import { formatVnd } from '@shared/money';
import { vnDate } from '@shared/datetime';
import { ApiError, api, newIdempotencyKey } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { Card, ErrorBox, StateBlock, useToast } from '../../components/ui';

interface Line {
  product_id: string;
  sku: string;
  name: string;
  /** Đơn vị lẻ của sản phẩm, ví dụ "Chai", "Can". */
  unit: string;
  /** Số lượng lẻ trong một thùng; 1 nghĩa là không bán theo thùng. */
  pack_size: number;
  /** Khách lấy lẻ hay lấy nguyên thùng. */
  pack_mode: 'LE' | 'THUNG';
  /** Số lượng theo đơn vị đang chọn (lẻ hoặc thùng). */
  qty: number;
  /** Giá một đơn vị lẻ theo cấp của khách; null = cấp này chưa có giá. */
  base_price: number | null;
  /** Giá sửa tay cho một đơn vị lẻ; để trống là dùng giá chuẩn. */
  applied_price: number | null;
  is_gift: boolean;
}

/** Số lượng lẻ thực tế của một dòng (thùng × quy đổi). */
function unitQty(line: Line): number {
  return line.pack_mode === 'THUNG' ? line.qty * Math.max(1, line.pack_size) : line.qty;
}

function linePrice(line: Line): number {
  if (line.is_gift) return 0;
  return line.applied_price ?? line.base_price ?? 0;
}

function lineTotal(line: Line): number {
  return unitQty(line) * linePrice(line);
}

/** Đọc số quy đổi từ cột "Quy cách" của sản phẩm: "12 chai/thùng" -> 12. */
function parsePackSize(value: string | null): number {
  if (!value) return 1;
  const match = String(value).match(/\d+/);
  const parsed = match ? Number(match[0]) : 1;
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}

export function NewOrderPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [customerId, setCustomerId] = useState(params.get('customer_id') ?? '');
  const [productQuery, setProductQuery] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [fees, setFees] = useState({ discount_amount: 0, bonus_deduction: 0, shipping_fee: 0, cod_amount: 0 });
  const [promotion, setPromotion] = useState({ code: '', note: '' });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());

  const debouncedQuery = useDebounced(productQuery);
  const customers = useApi<CustomerListItem[]>('/api/customers?page_size=200');
  const tiers = useApi<PriceTier[]>('/api/tiers');
  const catalog = useApi<{ products: ProductItem[] }>(
    `/api/prices?limit=400${debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : ''}`,
  );

  const customer = (customers.data ?? []).find((c) => c.id === customerId) ?? null;
  const tierCode = useMemo(
    () => (tiers.data ?? []).find((t) => t.id === customer?.tier_id)?.code ?? null,
    [tiers.data, customer?.tier_id],
  );

  /** Giá của một sản phẩm theo đúng cấp bậc của khách đang chọn. */
  const priceForTier = (product: ProductItem): number | null =>
    tierCode ? (product.prices[tierCode] ?? null) : null;

  const subtotal = lines.reduce((acc, line) => acc + lineTotal(line), 0);
  const totalAmount = subtotal - fees.discount_amount - fees.bonus_deduction + fees.shipping_fee;
  const remaining = totalAmount - fees.cod_amount;
  const blockedLines = lines.filter((l) => !l.is_gift && l.base_price === null);

  const addLine = (product: ProductItem) => {
    if (lines.some((l) => l.product_id === product.id)) {
      toast.error(`${product.sku} đã có trong đơn`);
      return;
    }
    setLines([
      ...lines,
      {
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit ?? 'Cái',
        pack_size: parsePackSize(product.pack_size),
        pack_mode: 'LE',
        qty: 1,
        base_price: priceForTier(product),
        applied_price: null,
        is_gift: false,
      },
    ]);
  };

  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const result = await api.post<{ id: string }>(
        '/api/orders',
        {
          customer_id: customerId,
          order_date: vnDate(),
          items: lines.map((line) => ({
            product_id: line.product_id,
            // Gửi lên số lượng LẺ; hệ thống chỉ lưu đơn vị lẻ để tính tiền và tồn nhất quán.
            qty: unitQty(line),
            applied_price: line.is_gift ? undefined : (line.applied_price ?? undefined),
            is_gift: line.is_gift,
          })),
          ...fees,
          promotion_code: promotion.code || null,
          promotion_note: promotion.note || null,
          note: note || null,
        },
        idempotencyKey,
      );
      toast.success('Đã tạo đơn. Kiểm tra lại rồi gửi duyệt.');
      navigate(`/sales/orders/${result.data.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fields ?? {});
        setIdempotencyKey(newIdempotencyKey());
      } else setFormError('Không tạo được đơn hàng');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Tạo đơn hàng</h2>
          <p>
            Giá tự nhảy theo cấp bậc của khách. Mã chưa có giá ở cấp đó sẽ bị chặn; giá sửa tay phải
            gửi duyệt.
          </p>
        </div>
      </div>

      <ErrorBox message={formError} />

      {/* Khối 1: khách hàng và tổng tiền nằm cùng một khung cho dễ đối chiếu */}
      <Card title="Khách hàng và tổng tiền">
        <div className="order-head">
          <div className="field">
            <label>Khách hàng *</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— Chọn khách hàng —</option>
              {(customers.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.tier_name ?? 'chưa có cấp'}
                </option>
              ))}
            </select>
            {customer && !customer.tier_id && (
              <span className="error">
                Khách chưa được map cấp giá nên chưa tạo đơn được. Quản lý cần chọn cấp bậc trước.
              </span>
            )}
          </div>

          <div className="order-facts">
            <div className="stat-row">
              <span className="muted">Cấp bậc áp giá</span>
              <strong>{customer?.tier_name ?? '—'}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Công nợ chính thức</span>
              <strong>{formatVnd(customer?.official_debt ?? 0)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Hạn mức</span>
              <strong>{formatVnd(customer?.credit_limit ?? 0)}</strong>
            </div>
          </div>

          <div className="order-facts">
            <div className="stat-row">
              <span className="muted">Tiền hàng</span>
              <strong>{formatVnd(subtotal)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Tổng phải thu</span>
              <strong style={{ fontSize: 18 }}>{formatVnd(totalAmount)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Còn phải thu sau COD</span>
              <strong>{formatVnd(remaining)}</strong>
            </div>
          </div>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      {/* Khối 2: dòng hàng chiếm hết chiều ngang, không phải kéo qua lại */}
      <Card
        title={`Dòng đơn hàng (${lines.length})`}
        bodyClass=""
        action={
          <div className="search" style={{ minWidth: 320 }}>
            <input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Gõ mã SKU hoặc tên sản phẩm để thêm…"
              disabled={!customerId}
            />
          </div>
        }
      >
        {productQuery && (
          <div className="product-suggest">
            <StateBlock
              loading={catalog.loading}
              error={catalog.error}
              empty={(catalog.data?.products ?? []).length === 0}
              emptyText="Không tìm thấy sản phẩm."
            >
              {(catalog.data?.products ?? []).slice(0, 8).map((product) => {
                const price = priceForTier(product);
                return (
                  <button
                    type="button"
                    key={product.id}
                    className="suggest-row"
                    onClick={() => addLine(product)}
                    disabled={!customerId}
                  >
                    <span>
                      <strong>{product.sku}</strong> · {product.name}
                      <small className="muted">
                        {' '}
                        {product.unit ?? ''} {product.pack_size ? `· ${product.pack_size}` : ''}
                      </small>
                    </span>
                    <span className={price === null ? 'error' : ''}>
                      {price === null ? 'Chưa có giá ở cấp này' : formatVnd(price)}
                    </span>
                  </button>
                );
              })}
            </StateBlock>
          </div>
        )}

        {lines.length === 0 ? (
          <div className="empty">
            {customerId ? 'Chưa có dòng nào. Gõ mã sản phẩm ở ô trên để thêm.' : 'Chọn khách hàng trước.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Đơn vị</th>
                  <th className="right">Số lượng</th>
                  <th className="right">Quy ra lẻ</th>
                  <th className="right">Đơn giá lẻ</th>
                  <th className="right">Thành tiền</th>
                  <th className="right">Hàng tặng</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.product_id}>
                    <td>
                      <strong>{line.sku}</strong>
                      <div className="muted">{line.name}</div>
                      {fieldErrors[`items.${index}.applied_price`] && (
                        <div className="error">{fieldErrors[`items.${index}.applied_price`]}</div>
                      )}
                      {!line.is_gift && line.base_price === null && (
                        <div className="error">Cấp giá của khách chưa có giá cho mã này</div>
                      )}
                    </td>
                    <td className="nowrap">
                      <select
                        value={line.pack_mode}
                        onChange={(e) =>
                          updateLine(index, {
                            pack_mode: e.target.value as 'LE' | 'THUNG',
                            // Sản phẩm chưa khai quy cách thì tạm lấy 12, sửa ngay ở ô bên cạnh.
                            pack_size:
                              e.target.value === 'THUNG' && line.pack_size < 2 ? 12 : line.pack_size,
                          })
                        }
                      >
                        <option value="LE">{line.unit} (lẻ)</option>
                        <option value="THUNG">Thùng</option>
                      </select>
                      {line.pack_mode === 'THUNG' && (
                        <span className="pack-size">
                          <input
                            type="number"
                            min={2}
                            value={line.pack_size}
                            title={`Một thùng có mấy ${line.unit.toLowerCase()}`}
                            onChange={(e) =>
                              updateLine(index, { pack_size: Math.max(2, Number(e.target.value) || 2) })
                            }
                          />
                          <small className="muted"> {line.unit.toLowerCase()}/thùng</small>
                        </span>
                      )}
                    </td>
                    <td className="right">
                      <input
                        type="number"
                        min={1}
                        value={line.qty}
                        onChange={(e) => updateLine(index, { qty: Number(e.target.value) || 1 })}
                        style={{ width: 84, textAlign: 'right' }}
                      />
                    </td>
                    <td className="right nowrap">
                      {unitQty(line)} {line.unit.toLowerCase()}
                    </td>
                    <td className="right">
                      {line.is_gift ? (
                        <span className="badge green">Tặng · 0đ</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder={line.base_price !== null ? String(line.base_price) : 'chưa có giá'}
                          value={line.applied_price ?? ''}
                          onChange={(e) =>
                            updateLine(index, {
                              applied_price: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          style={{ width: 130, textAlign: 'right' }}
                        />
                      )}
                    </td>
                    <td className="right nowrap">
                      <strong>{formatVnd(lineTotal(line))}</strong>
                    </td>
                    <td className="right">
                      <input
                        type="checkbox"
                        checked={line.is_gift}
                        title="Hàng tặng khuyến mại, không tính tiền"
                        onChange={(e) => updateLine(index, { is_gift: e.target.checked })}
                      />
                    </td>
                    <td>
                      <button
                        className="btn sm danger"
                        onClick={() => setLines(lines.filter((_, i) => i !== index))}
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Khuyến mại, phí và chiết khấu">
        <div className="form-grid">
          <div className="field">
            <label>Mã chương trình khuyến mại</label>
            <input
              value={promotion.code}
              onChange={(e) => setPromotion({ ...promotion, code: e.target.value })}
              placeholder="KM-T8-MUA10TANG1"
            />
          </div>
          <div className="field">
            <label>Nội dung khuyến mại</label>
            <input
              value={promotion.note}
              onChange={(e) => setPromotion({ ...promotion, note: e.target.value })}
              placeholder="Mua 10 tặng 1, giảm 5% đơn từ 20 triệu…"
            />
          </div>
          <div className="field">
            <label>Chiết khấu (đ)</label>
            <input
              type="number"
              min={0}
              value={fees.discount_amount}
              onChange={(e) => setFees({ ...fees, discount_amount: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="field">
            <label>Trừ thưởng tháng (đ)</label>
            <input
              type="number"
              min={0}
              value={fees.bonus_deduction}
              onChange={(e) => setFees({ ...fees, bonus_deduction: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="field">
            <label>Phí vận chuyển (đ)</label>
            <input
              type="number"
              min={0}
              value={fees.shipping_fee}
              onChange={(e) => setFees({ ...fees, shipping_fee: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="field">
            <label>COD / đặt cọc (đ)</label>
            <input
              type="number"
              min={0}
              value={fees.cod_amount}
              onChange={(e) => setFees({ ...fees, cod_amount: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="field full">
            <label>Ghi chú đơn</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="modal-foot" style={{ paddingRight: 0 }}>
          <button
            className="btn primary"
            disabled={saving || !customerId || lines.length === 0 || blockedLines.length > 0}
            onClick={save}
          >
            {saving ? 'Đang lưu…' : `Lưu đơn · ${formatVnd(totalAmount)}`}
          </button>
        </div>
        {blockedLines.length > 0 && (
          <div className="alert-box" style={{ marginTop: 10 }}>
            Còn {blockedLines.length} dòng chưa có giá ở cấp của khách. Bỏ dòng đó ra hoặc bổ sung giá
            trong Bảng giá trước khi lưu.
          </div>
        )}
      </Card>
    </>
  );
}

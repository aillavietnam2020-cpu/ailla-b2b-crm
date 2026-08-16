import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { CustomerListItem, ProductItem } from '@shared/types';
import { vnDate } from '@shared/datetime';
import { formatVnd } from '@shared/money';
import { ApiError, api, newIdempotencyKey } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { Card, Field, StateBlock, useToast } from '../../components/ui';

interface Line {
  product_id: string;
  sku: string;
  name: string;
  qty: number;
  applied_price: number | null;
  /** Hàng tặng khuyến mại: không tính tiền, không cần duyệt giá. */
  is_gift?: boolean;
}

interface PreviewLine {
  product_id: string;
  sku: string;
  qty: number;
  base_price: number | null;
  applied_price: number;
  line_total: number;
  price_override: boolean;
  diff_percent: number;
  required_role?: 'MANAGER' | 'CEO';
}

interface PreviewResult {
  lines: PreviewLine[];
  totals: {
    subtotal: number;
    totalAmount: number;
    remainingAmount: number;
  };
  approvals: Array<{ rule: string; requiredRole: string; reason: string }>;
}

/** Tạo đơn: giá tự động theo cấp khách, chặn giá NULL, giá sửa tay phải duyệt. */
export function NewOrderPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());

  const [customerId, setCustomerId] = useState(params.get('customer_id') ?? '');
  const [productQuery, setProductQuery] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [fees, setFees] = useState({ discount_amount: 0, bonus_deduction: 0, shipping_fee: 0, cod_amount: 0 });
  const [promotion, setPromotion] = useState({ code: '', note: '' });
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const debouncedProductQuery = useDebounced(productQuery);
  const customers = useApi<CustomerListItem[]>('/api/customers?page_size=200');
  const products = useApi<ProductItem[]>(
    debouncedProductQuery ? `/api/products?q=${encodeURIComponent(debouncedProductQuery)}&limit=25` : null,
  );

  const customer = useMemo(
    () => (customers.data ?? []).find((c) => c.id === customerId) ?? null,
    [customers.data, customerId],
  );

  const addLine = (product: ProductItem) => {
    if (lines.some((l) => l.product_id === product.id)) return;
    setLines([...lines, { product_id: product.id, sku: product.sku, name: product.name, qty: 1, applied_price: null }]);
    setProductQuery('');
    setPreview(null);
  };

  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    setPreview(null);
  };

  const buildPayload = () => ({
    customer_id: customerId,
    order_date: vnDate(),
    items: lines.map((line) => ({
      product_id: line.product_id,
      qty: line.qty,
      applied_price: line.is_gift ? undefined : (line.applied_price ?? undefined),
      is_gift: line.is_gift ?? false,
    })),
    ...fees,
    promotion_code: promotion.code || null,
    promotion_note: promotion.note || null,
    note: note || null,
  });

  const runPreview = async () => {
    setFormError(null);
    setFieldErrors({});
    try {
      const result = await api.post<PreviewResult>('/api/orders/preview', buildPayload());
      setPreview(result.data);
    } catch (err) {
      setPreview(null);
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fields ?? {});
      } else setFormError('Không tính được đơn hàng.');
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const result = await api.post<{ id: string; order_no: string }>('/api/orders', buildPayload(), idempotencyKey);
      toast.success(`Đã tạo đơn ${result.data.order_no} ở trạng thái Nháp`);
      setIdempotencyKey(newIdempotencyKey());
      navigate(`/sales/orders/${result.data.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fields ?? {});
      } else setFormError('Không lưu được đơn hàng.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Tạo đơn hàng</h2>
          <p>Giá lấy tự động theo cấp của khách. Mã thiếu giá sẽ bị chặn, giá sửa tay sẽ phải gửi duyệt.</p>
        </div>
      </div>

      {formError && <div className="alert-box" style={{ marginBottom: 16 }}>{formError}</div>}

      <div className="grid-2">
        <div className="stack">
          <Card title="1. Chọn khách hàng">
            <Field label="Khách hàng *" error={fieldErrors.customer_id}>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="">— Chọn khách —</option>
                {(customers.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.tier_name ? `· ${c.tier_name}` : '· CHƯA MAP CẤP GIÁ'}
                  </option>
                ))}
              </select>
            </Field>
            {customer && !customer.tier_id && (
              <div className="alert-box" style={{ marginTop: 12 }}>
                Khách này đang ở cấp "{customer.legacy_tier_label ?? 'Khác'}" chưa map sang 8 cấp giá. Quản lý phải
                map cấp trước khi tạo đơn.
              </div>
            )}
            {customer && (
              <div style={{ marginTop: 12 }}>
                <div className="stat-row">
                  <span className="muted">Công nợ chính thức</span>
                  <strong>{formatVnd(customer.official_debt)}</strong>
                </div>
                <div className="stat-row">
                  <span className="muted">Công nợ dự kiến</span>
                  <strong>{formatVnd(customer.projected_debt)}</strong>
                </div>
                <div className="stat-row">
                  <span className="muted">Hạn mức</span>
                  <strong>{formatVnd(customer.credit_limit)}</strong>
                </div>
              </div>
            )}
          </Card>

          <Card title="2. Thêm sản phẩm">
            <Field label="Tìm mã SKU hoặc tên sản phẩm">
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="VD: TOILET500, nước giặt…"
              />
            </Field>
            <StateBlock
              loading={products.loading}
              error={products.error}
              empty={Boolean(debouncedProductQuery) && (products.data ?? []).length === 0}
              emptyText="Không tìm thấy sản phẩm."
            >
              <div className="timeline" style={{ marginTop: 10 }}>
                {(products.data ?? []).slice(0, 8).map((product) => (
                  <div className="event" key={product.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <p>
                        <strong>{product.sku}</strong> — {product.name}
                      </p>
                      {product.missing_tiers.length > 0 && (
                        <small style={{ color: 'var(--orange)' }}>
                          Thiếu giá ở: {product.missing_tiers.join(', ')}
                        </small>
                      )}
                    </div>
                    <button className="btn sm" onClick={() => addLine(product)}>
                      Thêm
                    </button>
                  </div>
                ))}
              </div>
            </StateBlock>
          </Card>
        </div>

        <div className="stack">
          <Card title="3. Dòng đơn hàng" bodyClass="">
            {lines.length === 0 ? (
              <div className="empty">Chưa có dòng nào.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th className="right">SL</th>
                      <th className="right">Giá áp dụng</th>
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
                            <div className="error" style={{ color: 'var(--red)', fontSize: 12 }}>
                              {fieldErrors[`items.${index}.applied_price`]}
                            </div>
                          )}
                        </td>
                        <td className="right">
                          <input
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(e) => updateLine(index, { qty: Number(e.target.value) || 1 })}
                            style={{ width: 78, textAlign: 'right' }}
                          />
                        </td>
                        <td className="right">
                          {line.is_gift ? (
                            <span className="badge green">Tặng · 0đ</span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              placeholder="Giá chuẩn"
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
                        <td className="right">
                          <input
                            type="checkbox"
                            checked={Boolean(line.is_gift)}
                            title="Đánh dấu dòng này là hàng tặng khuyến mại"
                            onChange={(e) =>
                              updateLine(index, {
                                is_gift: e.target.checked,
                                applied_price: e.target.checked ? null : line.applied_price,
                              })
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="btn sm danger"
                            onClick={() => {
                              setLines(lines.filter((_, i) => i !== index));
                              setPreview(null);
                            }}
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

          <Card title="4. Khuyến mại, phí và chiết khấu">
            <div className="form-grid">
              <Field
                label="Mã chương trình khuyến mại"
                hint="Ví dụ: KM-T8-MUA10TANG1. Dùng để lọc và tổng kết chương trình sau này."
              >
                <input
                  value={promotion.code}
                  onChange={(e) => setPromotion({ ...promotion, code: e.target.value })}
                  placeholder="Bỏ trống nếu đơn không theo chương trình"
                />
              </Field>
              <Field label="Nội dung khuyến mại">
                <input
                  value={promotion.note}
                  onChange={(e) => setPromotion({ ...promotion, note: e.target.value })}
                  placeholder="Mua 10 tặng 1, giảm 5% đơn từ 20 triệu…"
                />
              </Field>
              <Field label="Chiết khấu (đ)">
                <input
                  type="number"
                  min={0}
                  value={fees.discount_amount}
                  onChange={(e) => setFees({ ...fees, discount_amount: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Trừ thưởng tháng (đ)">
                <input
                  type="number"
                  min={0}
                  value={fees.bonus_deduction}
                  onChange={(e) => setFees({ ...fees, bonus_deduction: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Phí vận chuyển (đ)">
                <input
                  type="number"
                  min={0}
                  value={fees.shipping_fee}
                  onChange={(e) => setFees({ ...fees, shipping_fee: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="COD/đặt cọc (đ)">
                <input
                  type="number"
                  min={0}
                  value={fees.cod_amount}
                  onChange={(e) => setFees({ ...fees, cod_amount: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Ghi chú" full>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
          </Card>

          {preview && (
            <Card title="5. Kiểm tra trước khi lưu">
              <div className="stat-row">
                <span className="muted">Tiền hàng</span>
                <strong>{formatVnd(preview.totals.subtotal)}</strong>
              </div>
              <div className="stat-row">
                <span className="muted">Tổng phải thu</span>
                <strong>{formatVnd(preview.totals.totalAmount)}</strong>
              </div>
              {preview.approvals.length > 0 && (
                <div className="alert-box warn" style={{ marginTop: 12 }}>
                  Đơn này sẽ cần duyệt:
                  <ul style={{ margin: '8px 0 0 18px' }}>
                    {preview.approvals.map((approval, index) => (
                      <li key={index}>
                        {approval.reason} ({approval.requiredRole === 'CEO' ? 'CEO duyệt' : 'Quản lý duyệt'})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <div className="actions">
            <button className="btn" onClick={runPreview} disabled={!customerId || lines.length === 0}>
              Kiểm tra giá & hạn mức
            </button>
            <button
              className="btn primary"
              onClick={save}
              disabled={saving || !customerId || lines.length === 0}
            >
              {saving ? 'Đang lưu…' : 'Lưu đơn nháp'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type {
  CustomerListItem,
  CustomerPriceImportReport,
  CustomerPriceItem,
  ProductItem,
} from '@shared/types';
import { formatVnd, formatVndNumber } from '@shared/money';
import { vnDate } from '@shared/datetime';
import { ApiError, api } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { useAuth } from '../../components/AuthProvider';
import { Card, ErrorBox, Modal, StateBlock, useToast } from '../../components/ui';

interface CustomPriceCustomer {
  id: string;
  name: string;
  phone_text: string | null;
  owner_name: string | null;
  price_count: number;
}

interface ParsedRow {
  sku: string;
  amount: number;
  name: string | null;
  unit: string | null;
  pack_qty: number | null;
}

interface ParsedFile {
  rows: ParsedRow[];
  /** Dòng có giá nhưng thiếu mã hàng: không đưa lên được. */
  noSku: Array<{ line: number; name: string }>;
  columns: { sku: string; price: string; name?: string; unit?: string; pack?: string };
}

/** Bỏ dấu, chữ thường, gộp khoảng trắng để so tên cột không phụ thuộc cách gõ. */
function norm(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;
  let s = String(value ?? '')
    .replace(/[đ₫\s]/gi, '')
    .replace(/,/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s));
}

function toInt(value: unknown): number | null {
  const m = String(value ?? '').match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Đọc bảng giá từ ma trận ô của file Excel/CSV.
 * Nhận cả mẫu của hệ thống (Mã hàng | Tên hàng | ĐVT | Quy cách | Đơn giá) lẫn file báo giá gia công
 * (cột "MÃ HÀNG" và "Thành Phẩm can"), tự dò dòng tiêu đề trong 15 dòng đầu.
 */
export function parseMatrix(matrix: unknown[][]): ParsedFile | null {
  const skuTests: Array<(h: string) => boolean> = [
    (h) => h === 'ma hang',
    (h) => h === 'ma sp' || h === 'sku' || h === 'ma san pham',
    (h) => h.startsWith('ma hang'),
    (h) => h === 'ma',
  ];
  const priceTests: Array<(h: string) => boolean> = [
    (h) => h.includes('don gia'),
    (h) => h.includes('gia ban'),
    (h) => h.includes('thanh pham'),
    (h) => h === 'gia',
  ];
  const find = (header: string[], tests: Array<(h: string) => boolean>) => {
    for (const t of tests) {
      const i = header.findIndex(t);
      if (i >= 0) return i;
    }
    return -1;
  };

  for (let r = 0; r < Math.min(matrix.length, 15); r += 1) {
    const raw = matrix[r] ?? [];
    const header = raw.map(norm);
    const iSku = find(header, skuTests);
    const iPrice = find(header, priceTests);
    if (iSku < 0 || iPrice < 0) continue;
    const iName = find(header, [(h) => h.includes('ten hang'), (h) => h.includes('ten san pham'), (h) => h === 'ten']);
    const iUnit = find(header, [(h) => h === 'dvt' || h === 'don vi' || h === 'don vi tinh']);
    const iPack = find(header, [(h) => h.includes('quy cach')]);

    const rows: ParsedRow[] = [];
    const noSku: ParsedFile['noSku'] = [];
    for (let i = r + 1; i < matrix.length; i += 1) {
      const line = matrix[i] ?? [];
      const sku = String(line[iSku] ?? '').trim();
      const amount = toAmount(line[iPrice]);
      const name = iName >= 0 ? String(line[iName] ?? '').trim() : '';
      if (amount === null) continue;
      if (!sku) {
        noSku.push({ line: i + 1, name: name || '(không có tên)' });
        continue;
      }
      rows.push({
        sku,
        amount,
        name: name || null,
        unit: iUnit >= 0 ? String(line[iUnit] ?? '').trim() || null : null,
        pack_qty: iPack >= 0 ? toInt(line[iPack]) : null,
      });
    }
    return {
      rows,
      noSku,
      columns: {
        sku: String(raw[iSku]).replace(/\s+/g, ' ').trim(),
        price: String(raw[iPrice]).replace(/\s+/g, ' ').trim(),
        name: iName >= 0 ? String(raw[iName]).replace(/\s+/g, ' ').trim() : undefined,
        unit: iUnit >= 0 ? String(raw[iUnit]).replace(/\s+/g, ' ').trim() : undefined,
        pack: iPack >= 0 ? String(raw[iPack]).replace(/\s+/g, ' ').trim() : undefined,
      },
    };
  }
  return null;
}

/**
 * Bảng giá riêng từng khách gia công (trang quản trị).
 * Mỗi khách một bảng giá theo mã hàng; thêm từng mã hoặc tải file Excel/CSV hàng loạt.
 * Giá đổi theo ngày hiệu lực, đơn đã chốt giữ giá cũ.
 */
export function CustomerPricesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const canEdit = can('price.propose') || can('price.approve');

  const [customerId, setCustomerId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [validFrom, setValidFrom] = useState(vnDate());
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const debouncedQ = useDebounced(q);

  const customers = useApi<CustomPriceCustomer[]>(`/api/customer-prices?_=${reloadKey}`);
  const list = useMemo(() => customers.data ?? [], [customers.data]);
  const current = list.find((c) => c.id === customerId) ?? null;

  useEffect(() => {
    if (!customerId && list.length > 0) setCustomerId(list[0].id);
  }, [list, customerId]);

  const query = new URLSearchParams({ date: vnDate(), _: String(reloadKey) });
  if (debouncedQ) query.set('q', debouncedQ);
  const prices = useApi<CustomerPriceItem[]>(
    customerId ? `/api/customer-prices/${customerId}?${query.toString()}` : null,
  );
  const items = prices.data ?? [];

  const reload = () => setReloadKey((k) => k + 1);

  async function savePrice(item: CustomerPriceItem, amount: number | null) {
    try {
      await api.put(`/api/customer-prices/${customerId}/item`, {
        product_id: item.product_id,
        amount,
        valid_from: validFrom,
      });
      toast.success(amount === null ? `Đã bỏ ${item.sku} khỏi bảng giá` : `Đã lưu giá ${item.sku}`);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không lưu được giá');
    }
  }

  async function switchBack() {
    if (!current) return;
    if (
      !confirm(
        `Chuyển "${current.name}" về giá theo cấp 8 bậc? Bảng giá riêng vẫn được giữ lại nhưng khách không dùng nữa.`,
      )
    )
      return;
    try {
      await api.patch(`/api/customers/${current.id}`, { price_mode: 'TIER' });
      toast.success('Đã chuyển khách về giá theo cấp');
      setCustomerId('');
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không chuyển được');
    }
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Mã hàng', 'Tên hàng', 'ĐVT', 'Quy cách (số can/chai trong 1 thùng)', 'Đơn giá (đ / can hoặc chai)'],
      ['3.5suongmai', 'Nước giặt 3.5kg', 'Thùng', 6, 41980],
      ['RC450Q', 'Rửa chén 450ml chai trong', 'Thùng', 28, 7725],
    ]);
    ws['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 10 }, { wch: 34 }, { wch: 26 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bảng giá');
    XLSX.writeFile(wb, 'mau-bang-gia-khach-gia-cong.xlsx');
  }

  async function exportCurrent() {
    if (!current) return;
    const XLSX = await import('xlsx');
    const rows: unknown[][] = [
      ['Mã hàng', 'Tên hàng', 'ĐVT', 'Quy cách', 'Đơn giá (đ)', 'Áp dụng từ'],
      ...items.map((i) => [i.sku, i.name, i.unit ?? '', i.pack_size ?? '', i.amount, i.valid_from]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bảng giá');
    XLSX.writeFile(wb, `bang-gia-${current.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.xlsx`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Bảng giá riêng từng khách (gia công, NPP)</h2>
          <p>
            Khách cần giá riêng (khách gia công, hoặc NPP có giá thỏa thuận) có một bảng giá theo mã hàng. Mã có trong bảng thì
            bán theo giá riêng. Mã chưa có: khách <b>có cấp giá</b> (NPP, đại lý) tính theo cấp của khách, khách gia công
            (không có cấp) không mua được. Giá đổi theo ngày áp dụng; đơn đã chốt giữ nguyên giá cũ.
          </p>
        </div>
        {canEdit && (
          <div className="actions">
            <button className="btn primary" onClick={() => setAddingCustomer(true)}>
              Thêm khách có giá riêng
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, 300px) 1fr', gap: 16, alignItems: 'start' }}>
        <Card title={`Khách dùng giá riêng (${list.length})`} bodyClass="">
          <StateBlock
            loading={customers.loading}
            error={customers.error}
            empty={list.length === 0}
            emptyText="Chưa có khách nào dùng bảng giá riêng. Bấm Thêm khách có giá riêng."
          >
            <div>
              {list.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="suggest-row"
                  onClick={() => setCustomerId(c.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: c.id === customerId ? 'var(--surface-2, #f3f0ff)' : undefined,
                    fontWeight: c.id === customerId ? 700 : 500,
                  }}
                >
                  <span>
                    {c.name}
                    <small className="muted"> · {c.owner_name ?? 'chưa gán sale'}</small>
                  </span>
                  <span className={c.price_count === 0 ? 'error' : 'muted'}>{c.price_count} mã</span>
                </button>
              ))}
            </div>
          </StateBlock>
        </Card>

        <div>
          {!current ? (
            <Card>
              <div className="empty">Chọn một khách ở bên trái để xem và sửa bảng giá riêng.</div>
            </Card>
          ) : (
            <>
              <Card
                title={`Bảng giá của ${current.name}`}
                action={
                  <div className="actions">
                    <button className="btn sm" onClick={downloadTemplate}>
                      Tải file mẫu
                    </button>
                    <button className="btn sm" onClick={exportCurrent} disabled={items.length === 0}>
                      Tải bảng giá hiện tại
                    </button>
                    {canEdit && (
                      <button className="btn sm primary" onClick={() => setImporting(true)}>
                        Tải lên Excel / CSV
                      </button>
                    )}
                    {canEdit && (
                      <button className="btn sm" onClick={switchBack}>
                        Chuyển về giá theo cấp
                      </button>
                    )}
                  </div>
                }
              >
                <div className="form-grid">
                  <div className="field">
                    <label>Giá mới áp dụng từ ngày</label>
                    <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
                    <span className="muted" style={{ fontSize: 12 }}>
                      Dùng cho mọi lần sửa giá hoặc tải file bên dưới. Đơn đã chốt trước ngày này giữ giá cũ.
                    </span>
                  </div>
                  <div className="field">
                    <label>Tìm mã hoặc tên hàng</label>
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ mã hoặc tên…" />
                  </div>
                </div>
              </Card>

              <div style={{ height: 16 }} />

              {canEdit && (
                <>
                  <AddPriceRow
                    customerId={current.id}
                    validFrom={validFrom}
                    onDone={() => {
                      toast.success('Đã thêm giá');
                      reload();
                    }}
                  />
                  <div style={{ height: 16 }} />
                </>
              )}

              <Card bodyClass="">
                <StateBlock
                  loading={prices.loading}
                  error={prices.error}
                  empty={items.length === 0}
                  emptyText="Bảng giá riêng của khách này còn trống. Thêm từng mã ở trên hoặc tải file Excel lên."
                >
                  <div className="table-wrap">
                    <table className="data wide">
                      <thead>
                        <tr>
                          <th>Mã hàng</th>
                          <th>Tên hàng</th>
                          <th>ĐVT · quy cách</th>
                          <th className="right">Đơn giá (đ / can hoặc chai)</th>
                          <th>Áp dụng từ</th>
                          {canEdit && <th></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <PriceRow
                            key={item.product_id}
                            item={item}
                            canEdit={canEdit}
                            onSave={(amount) => savePrice(item, amount)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </StateBlock>
              </Card>
            </>
          )}
        </div>
      </div>

      {importing && current && (
        <ImportModal
          customer={current}
          validFrom={validFrom}
          onClose={() => setImporting(false)}
          onDone={(message) => {
            setImporting(false);
            toast.success(message);
            reload();
          }}
        />
      )}

      {addingCustomer && (
        <AddCustomerModal
          existingIds={list.map((c) => c.id)}
          onClose={() => setAddingCustomer(false)}
          onDone={(id) => {
            setAddingCustomer(false);
            setCustomerId(id);
            toast.success('Đã chuyển khách sang bảng giá riêng. Nhập giá hoặc tải file lên.');
            reload();
          }}
        />
      )}
    </>
  );
}

function PriceRow({
  item,
  canEdit,
  onSave,
}: {
  item: CustomerPriceItem;
  canEdit: boolean;
  onSave: (amount: number | null) => void;
}) {
  const [value, setValue] = useState(String(item.amount));
  useEffect(() => setValue(String(item.amount)), [item.amount]);

  const commit = () => {
    const n = Number(value);
    if (value.trim() === '' || !Number.isFinite(n) || n < 0) {
      setValue(String(item.amount));
      return;
    }
    if (Math.round(n) !== item.amount) onSave(Math.round(n));
  };

  return (
    <tr>
      <td>
        <strong>{item.sku}</strong>
      </td>
      <td>{item.name}</td>
      <td className="muted">
        {item.unit ?? '—'}
        {item.pack_size ? ` · ${item.pack_size}` : ''}
      </td>
      <td className="right">
        {canEdit ? (
          <input
            type="number"
            min={0}
            step={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            style={{ width: 130, textAlign: 'right' }}
          />
        ) : (
          formatVnd(item.amount)
        )}
      </td>
      <td className="nowrap muted">{item.valid_from}</td>
      {canEdit && (
        <td>
          <button
            className="btn sm danger"
            onClick={() => {
              if (confirm(`Bỏ mã ${item.sku} khỏi bảng giá của khách này?`)) onSave(null);
            }}
          >
            Bỏ
          </button>
        </td>
      )}
    </tr>
  );
}

/** Thêm một mã vào bảng giá: tìm sản phẩm trong danh mục, nhập giá. */
function AddPriceRow({
  customerId,
  validFrom,
  onDone,
}: {
  customerId: string;
  validFrom: string;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<ProductItem | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounced(text);
  const search = useApi<ProductItem[]>(
    debounced.trim().length >= 1 && !picked ? `/api/products?limit=8&q=${encodeURIComponent(debounced)}` : null,
  );

  async function add() {
    if (!picked || amount === '') return;
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/customer-prices/${customerId}/item`, {
        product_id: picked.id,
        amount: Math.round(Number(amount)),
        valid_from: validFrom,
      });
      setPicked(null);
      setText('');
      setAmount('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thêm được giá');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Thêm một mã vào bảng giá">
      <ErrorBox message={error} />
      <div className="form-grid">
        <div className="field">
          <label>Mã hàng</label>
          <input
            value={picked ? `${picked.sku} · ${picked.name}` : text}
            onChange={(e) => {
              setPicked(null);
              setText(e.target.value);
            }}
            placeholder="Gõ mã hoặc tên hàng có trong danh mục…"
          />
          {!picked && (search.data ?? []).length > 0 && (
            <div className="product-suggest">
              {(search.data ?? []).map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className="suggest-row"
                  onClick={() => {
                    setPicked(p);
                    setText('');
                  }}
                >
                  <span>
                    <strong>{p.sku}</strong> · {p.name}
                    <small className="muted">
                      {' '}
                      {p.unit ?? ''} {p.pack_size ? `· ${p.pack_size}` : ''}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
          <span className="muted" style={{ fontSize: 12 }}>
            Mã chưa có trong danh mục thì dùng "Tải lên Excel / CSV" và tích tạo sản phẩm mới.
          </span>
        </div>
        <div className="field">
          <label>Đơn giá (đ / can hoặc chai)</label>
          <input
            type="number"
            min={0}
            step={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add();
            }}
          />
        </div>
      </div>
      <div className="modal-foot" style={{ paddingRight: 0 }}>
        <button className="btn primary" disabled={busy || !picked || amount === ''} onClick={() => void add()}>
          {busy ? 'Đang lưu…' : 'Thêm vào bảng giá'}
        </button>
      </div>
    </Card>
  );
}

/** Chọn một khách (đang dùng giá theo cấp) để chuyển sang bảng giá riêng. */
function AddCustomerModal({
  existingIds,
  onClose,
  onDone,
}: {
  existingIds: string[];
  onClose: () => void;
  onDone: (customerId: string) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounced(text);
  const customers = useApi<CustomerListItem[]>(
    `/api/customers?page_size=30${debounced ? `&q=${encodeURIComponent(debounced)}` : ''}`,
  );
  const options = useMemo(
    () => (customers.data ?? []).filter((c) => !existingIds.includes(c.id) && c.price_mode !== 'CUSTOM'),
    [customers.data, existingIds],
  );

  async function pick(customer: CustomerListItem) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/customers/${customer.id}`, { price_mode: 'CUSTOM' });
      onDone(customer.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không chuyển được khách');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Thêm khách có giá riêng" onClose={onClose}>
      <div className="modal-body">
        <ErrorBox message={error} />
        <p className="muted">
          Chọn khách trong danh sách khách hàng. Sau khi chuyển, mã nào có trong bảng giá riêng thì bán theo giá riêng. Khách
          đã có cấp giá (NPP, đại lý) vẫn mua được các mã còn lại theo giá cấp; khách gia công không có cấp thì chỉ mua được
          mã có trong bảng riêng.
        </p>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Tìm khách</label>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Gõ tên khách…" autoFocus />
        </div>
        <StateBlock
          loading={customers.loading}
          error={customers.error}
          empty={options.length === 0}
          emptyText="Không có khách phù hợp."
        >
          <div className="product-suggest" style={{ position: 'static', maxHeight: 280, overflowY: 'auto' }}>
            {options.map((c) => (
              <button
                type="button"
                key={c.id}
                className="suggest-row"
                disabled={busy}
                onClick={() => void pick(c)}
              >
                <span>
                  <strong>{c.name}</strong>
                  <small className="muted"> · {c.owner_name ?? 'chưa gán sale'}</small>
                </span>
                <span className="muted">{c.tier_name ?? 'chưa có cấp'}</span>
              </button>
            ))}
          </div>
        </StateBlock>
      </div>
    </Modal>
  );
}

/** Tải file Excel/CSV: đọc ở máy, xem trước kết quả trên máy chủ, rồi mới áp dụng. */
function ImportModal({
  customer,
  validFrom,
  onClose,
  onDone,
}: {
  customer: CustomPriceCustomer;
  validFrom: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [replaceAll, setReplaceAll] = useState(false);
  const [report, setReport] = useState<CustomerPriceImportReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    setReport(null);
    setParsed(null);
    setParseError(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      const result = parseMatrix(matrix);
      if (!result || result.rows.length === 0) {
        setParseError(
          'Không tìm thấy bảng giá trong file. File cần có cột "Mã hàng" và cột giá ("Đơn giá" hoặc "Thành phẩm can"). Bấm Tải file mẫu để xem cách trình bày.',
        );
        return;
      }
      setParsed(result);
    } catch {
      setParseError('Không đọc được file. Hãy dùng file .xlsx, .xls hoặc .csv.');
    }
  }

  // Xem trước mỗi khi đổi file hoặc đổi lựa chọn.
  useEffect(() => {
    if (!parsed) return;
    let cancelled = false;
    setChecking(true);
    setError(null);
    api
      .post<CustomerPriceImportReport>(`/api/customer-prices/${customer.id}/import`, {
        rows: parsed.rows,
        valid_from: validFrom,
        create_missing: createMissing,
        replace_all: replaceAll,
        dry_run: true,
      })
      .then((res) => {
        if (!cancelled) setReport(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Không kiểm tra được file');
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parsed, createMissing, replaceAll, customer.id, validFrom]);

  async function apply() {
    if (!parsed) return;
    setApplying(true);
    setError(null);
    try {
      const res = await api.post<CustomerPriceImportReport>(`/api/customer-prices/${customer.id}/import`, {
        rows: parsed.rows,
        valid_from: validFrom,
        create_missing: createMissing,
        replace_all: replaceAll,
      });
      const r = res.data;
      onDone(
        `Đã cập nhật bảng giá: ${r.created_price} mã mới, ${r.changed_price} mã đổi giá, ${r.unchanged} mã không đổi` +
          (r.products_created ? `, tạo ${r.products_created} sản phẩm mới` : '') +
          (r.removed ? `, bỏ ${r.removed} mã` : ''),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không áp dụng được');
    } finally {
      setApplying(false);
    }
  }

  return (
    <Modal
      title={`Tải bảng giá lên cho ${customer.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          <button
            className="btn primary"
            disabled={!report || checking || applying || report.matched === 0}
            onClick={() => void apply()}
          >
            {applying ? 'Đang áp dụng…' : `Áp dụng từ ngày ${validFrom}`}
          </button>
        </>
      }
    >
      <div className="modal-body">
        <ErrorBox message={error} />
        <div className="field">
          <label>File bảng giá (.xlsx, .xls, .csv)</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void onFile(e.target.files?.[0])} />
          <span className="muted" style={{ fontSize: 12 }}>
            Cần cột "Mã hàng" và cột giá. Nhận luôn file báo giá gia công (cột "Thành phẩm can").
            Giá là giá một can hoặc một chai (đơn vị nhỏ nhất), áp dụng từ ngày {validFrom}.
          </span>
        </div>

        {parseError && <div className="alert-box">{parseError}</div>}

        {parsed && (
          <>
            <p className="muted" style={{ marginTop: 12 }}>
              <strong>{fileName}</strong>: đọc được <strong>{parsed.rows.length}</strong> dòng giá. Cột mã:{' '}
              "{parsed.columns.sku}", cột giá: "{parsed.columns.price}".
            </p>

            {parsed.noSku.length > 0 && (
              <div className="alert-box warn" style={{ marginTop: 10 }}>
                {parsed.noSku.length} dòng có giá nhưng <strong>thiếu mã hàng</strong> nên bị bỏ qua (dòng{' '}
                {parsed.noSku
                  .slice(0, 8)
                  .map((r) => r.line)
                  .join(', ')}
                {parsed.noSku.length > 8 ? '…' : ''}). Điền mã vào file rồi tải lại nếu cần bán các mã đó.
              </div>
            )}

            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="field full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={createMissing}
                  onChange={(e) => setCreateMissing(e.target.checked)}
                />
                Tạo sản phẩm mới cho các mã chưa có trong danh mục (lấy tên, ĐVT, quy cách từ file)
              </label>
              <label className="field full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} />
                Mã nào đang có trong bảng giá mà không có trong file thì bỏ khỏi bảng giá (thay toàn bộ bảng giá)
              </label>
            </div>

            {checking && <div className="loading">Đang kiểm tra file…</div>}

            {report && !checking && (
              <div style={{ marginTop: 12 }}>
                <div className="kpis">
                  <div className="kpi">
                    <div className="label">Mã khớp / tạo mới</div>
                    <div className="value">{formatVndNumber(report.matched)}</div>
                  </div>
                  <div className="kpi">
                    <div className="label">Giá mới</div>
                    <div className="value">{formatVndNumber(report.created_price)}</div>
                  </div>
                  <div className="kpi">
                    <div className="label">Đổi giá</div>
                    <div className="value">{formatVndNumber(report.changed_price)}</div>
                  </div>
                  <div className="kpi">
                    <div className="label">Không đổi</div>
                    <div className="value">{formatVndNumber(report.unchanged)}</div>
                  </div>
                </div>

                {report.products_created > 0 && (
                  <p className="muted" style={{ marginTop: 10 }}>
                    Sẽ tạo <strong>{report.products_created}</strong> sản phẩm mới trong danh mục (chỉ dùng cho
                    bảng giá riêng, không vào bảng giá 8 cấp).
                  </p>
                )}
                {report.removed > 0 && (
                  <div className="alert-box warn" style={{ marginTop: 10 }}>
                    Sẽ bỏ <strong>{report.removed}</strong> mã đang có trong bảng giá mà file không có.
                  </div>
                )}
                {report.duplicate_skus.length > 0 && (
                  <div className="alert-box warn" style={{ marginTop: 10 }}>
                    Mã bị lặp trong file (lấy dòng cuối): {report.duplicate_skus.slice(0, 10).join(', ')}
                    {report.duplicate_skus.length > 10 ? '…' : ''}
                  </div>
                )}
                {report.unknown_skus.length > 0 && (
                  <div className="alert-box" style={{ marginTop: 10 }}>
                    <strong>{report.unknown_skus.length}</strong> mã chưa có trong danh mục sản phẩm nên chưa
                    được tải lên: {report.unknown_skus.slice(0, 12).map((s) => s.sku).join(', ')}
                    {report.unknown_skus.length > 12 ? '…' : ''}. Tích ô "Tạo sản phẩm mới" ở trên nếu muốn tạo
                    luôn các mã này.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

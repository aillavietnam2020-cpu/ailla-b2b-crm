import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { CustomerDetail, OrderDetail } from '@shared/types';
import { formatVnDate, vnDate } from '@shared/datetime';
import { formatVndNumber } from '@shared/money';
import { useApi } from '../lib/hooks';

interface BankAccount {
  id: string;
  bank: string;
  account_no: string;
  account_name: string;
  note: string | null;
  active: number;
}

const COMPANY = {
  name: 'CÔNG TY CPTM VÀ XNK AILLA VIỆT NAM',
  address: '196 ngõ Thịnh Quang, đường Tây Sơn, phường Thịnh Quang, Hà Nội',
};

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readBlock(n: number, full: boolean): string {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const donvi = n % 10;
  const parts: string[] = [];
  if (full || tram > 0) parts.push(`${DIGITS[tram]} trăm`);
  if (chuc > 1) {
    parts.push(`${DIGITS[chuc]} mươi`);
    if (donvi === 1) parts.push('mốt');
    else if (donvi === 5) parts.push('lăm');
    else if (donvi > 0) parts.push(DIGITS[donvi]!);
  } else if (chuc === 1) {
    parts.push('mười');
    if (donvi === 5) parts.push('lăm');
    else if (donvi > 0) parts.push(DIGITS[donvi]!);
  } else if (donvi > 0) {
    if (tram > 0 || full) parts.push('lẻ');
    parts.push(DIGITS[donvi]!);
  }
  return parts.join(' ');
}

/** Số tiền bằng chữ, ví dụ 17.897.400 → "Mười bảy triệu tám trăm chín mươi bảy nghìn bốn trăm đồng". */
export function vndInWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return 'Không đồng';
  const units = ['', ' nghìn', ' triệu', ' tỷ'];
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const out: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const g = groups[i]!;
    if (g === 0) continue;
    const full = i < groups.length - 1;
    out.push(readBlock(g, full) + (units[i] ?? ''));
  }
  const text = out.join(' ').replace(/\s+/g, ' ').trim();
  return `${amount < 0 ? 'Âm ' : ''}${text.charAt(0).toUpperCase()}${text.slice(1)} đồng`;
}

/**
 * In phiếu của một đơn B2B (mở ở tab riêng, bấm In hoặc Lưu PDF):
 *   ?type=order  Phiếu đặt hàng / báo đơn gửi khách: có logo, giá, tổng tiền, chỗ khách xác nhận.
 *   ?type=ship   Phiếu xuất kho nội bộ: KHÔNG có giá, chỉ số lượng, có cột "Thực xuất" để kế toán kho
 *                ghi tay đối soát; số thực xuất đã nhập trên hệ thống thì in sẵn.
 */
/**
 * Cột ĐVT trên phiếu: đơn vị tính kèm quy cách gọn. Quy cách dạng "20 chai/thùng" ghép với đơn vị "Thùng" thì ghi "Thùng 20"
 * (không lặp "thùng" hai lần). Quy cách khác (ví dụ "500ml") thì ghi nối sau đơn vị như cũ.
 */
function unitLabel(unit: string | null | undefined, pack: string | null | undefined): string {
  const u = (unit ?? '').trim();
  const p = (pack ?? '').trim();
  if (!p) return u;
  const m = p.match(/^(\d+)\s*[^\d/]*\/\s*[^\d]+$/);
  if (m && u) return `${u} ${m[1]}`;
  return [u, p].filter(Boolean).join(' ');
}

export function PrintOrderPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const type = params.get('type') === 'ship' ? 'ship' : 'order';
  // Ngày xuất hàng chỉ hiện khi kho ĐÃ xuất (ngày xuất thực tế); chưa xuất thì để trống, không lấy ngày dự kiến hay ngày duyệt.
  const order = useApi<OrderDetail>(`/api/orders/${id}`);
  const customer = useApi<CustomerDetail>(order.data ? `/api/customers/${order.data.customer_id}` : null);
  const banks = useApi<BankAccount[]>(type === 'order' ? '/api/receiving-accounts' : null);

  // Tên tab = tên file khi lưu PDF: "Phiếu xuất kho DH202610-0020 - HKD Thu Hường".
  useEffect(() => {
    const d = order.data;
    if (!d) return;
    const prev = document.title;
    document.title = `${type === 'ship' ? 'Phiếu xuất kho' : 'Phiếu đặt hàng'} ${d.order_no} - ${d.customer_name}`;
    return () => {
      document.title = prev;
    };
  }, [order.data, type]);

  if (order.loading) return <div className="loading" style={{ padding: 40 }}>Đang tải đơn hàng…</div>;
  if (order.error || !order.data) return <div className="alert-box">{order.error ?? 'Không tìm thấy đơn hàng'}</div>;
  const o = order.data;
  const c = customer.data;

  const shipped = new Map<string, number>();
  for (const k of o.kho_lines ?? []) if (k.shipped_qty !== null && k.shipped_qty !== undefined) shipped.set(k.product_id, k.shipped_qty);
  const hasShipped = shipped.size > 0;
  const items = o.items;
  // Cùng một sản phẩm có thể có dòng bán + dòng tặng: kho chỉ ghi một số thực xuất cho cả hai, so theo tổng số lượng của mã.
  const orderedOf = new Map<string, number>();
  const giftOf = new Map<string, number>();
  for (const it of items) {
    orderedOf.set(it.product_id, (orderedOf.get(it.product_id) ?? 0) + it.qty);
    if (it.is_gift) giftOf.set(it.product_id, (giftOf.get(it.product_id) ?? 0) + it.qty);
  }
  const diff = hasShipped && [...shipped].some(([pid, q]) => orderedOf.has(pid) && orderedOf.get(pid) !== q);
  const shippedDay = (() => {
    const d = o as OrderDetail & { delivered_at?: string | null };
    return o.delivery_status === 'DA_XUAT_KHO' || o.delivery_status === 'DA_GIAO' ? (d.delivered_at ?? null) : null;
  })();

  // Tiền theo số thực giao khi kho đã ghi số thực xuất; chưa ghi thì theo số đặt.
  const useActual = type === 'order' && hasShipped;
  const lineQty = (it: (typeof items)[number]) => {
    if (!useActual || !shipped.has(it.product_id)) return it.qty;
    const total = shipped.get(it.product_id) ?? it.qty;
    if (it.is_gift) return Math.min(it.qty, total);
    return Math.max(0, total - (giftOf.get(it.product_id) ?? 0));
  };
  const lineAmount = (it: (typeof items)[number]) => (it.is_gift ? 0 : Math.round(lineQty(it) * it.applied_price));
  const subtotal = useActual ? items.reduce((s, it) => s + lineAmount(it), 0) : o.subtotal;
  const total = useActual ? subtotal - (o.discount_amount ?? 0) - (o.bonus_deduction ?? 0) + (o.shipping_fee ?? 0) : o.total_amount;
  const paid = (o as OrderDetail & { received_amount?: number }).received_amount ?? 0;
  const dueNow = total - (o.cod_amount ?? 0) - paid;
  const activeBanks = (banks.data ?? []).filter((b) => b.active === 1);
  // Công nợ khách: lấy công nợ dự kiến hiện tại, bỏ phần của chính đơn này (nếu đã tính) để ra "công nợ trước đơn".
  const debt = c?.debt;
  const orderCounted = o.approval_status === 'APPROVED' && ['DA_XUAT_KHO', 'DA_GIAO'].includes(o.delivery_status);
  const dueOnOrder = o.total_amount - (o.cod_amount ?? 0) - paid;
  const prevDebt = debt ? debt.projected_debt - (orderCounted ? dueOnOrder : 0) : null;
  const afterDebt = prevDebt === null ? null : prevDebt + dueNow;
  const today = vnDate();
  const [yy, mm, dd] = today.split('-');

  const title =
    type === 'ship'
      ? 'PHIẾU XUẤT KHO'
      : diff
        ? 'PHIẾU XÁC NHẬN ĐƠN HÀNG (THEO SỐ THỰC GIAO)'
        : 'PHIẾU ĐẶT HÀNG';

  return (
    <div className="print-root">
      <div className="print-toolbar no-print">
        <button className="btn primary" onClick={() => window.print()}>
          In / Lưu PDF
        </button>
        <span className="muted">
          {type === 'ship'
            ? 'Phiếu xuất kho nội bộ: không có giá, chỉ có số lượng.'
            : 'Phiếu gửi khách.'}{' '}
          Muốn lưu file: bấm nút, ở hộp in mục “Máy in” chọn “Lưu dưới dạng PDF” rồi bấm Lưu (gửi qua Zalo được).
        </span>
      </div>

      <div className="print-page">
        <div className="print-head">
          <img src="/ailla-logo.png" alt="Ailla" className="print-logo" />
          <div className="print-co">
            <strong>{COMPANY.name}</strong>
            <div>{COMPANY.address}</div>
          </div>
          <div className="print-form">
            <div>Mẫu số: 02-BH</div>
            <div>{type === 'ship' ? 'Liên 1: Lưu — Liên 2: Giao kế toán' : 'Liên 1: Lưu — Liên 2: Giao khách hàng'}</div>
          </div>
        </div>

        <h1 className="print-title">{title}</h1>
        <p className="print-sub">
          Số phiếu: <strong>{o.order_no}</strong>
        </p>

        <table className="print-info">
          <tbody>
            <tr>
              <td>
                Khách hàng: <strong>{o.customer_name}</strong>
              </td>
              <td>
                {type === 'ship' ? 'Ngày xuất hàng: ' : 'Ngày đặt: '}
                <strong>
                  {type === 'ship'
                    ? shippedDay
                      ? formatVnDate(shippedDay)
                      : '....../....../........'
                    : formatVnDate(o.order_date)}
                </strong>
              </td>
            </tr>
            <tr>
              <td>Điện thoại: {c?.phone_text ?? o?.customer_phone ?? '—'}</td>
              <td>Sale phụ trách: {o.owner_name ?? '—'}</td>
            </tr>
            <tr>
              <td colSpan={2}>Địa chỉ giao hàng: {c?.address ?? c?.province ?? o?.customer_address ?? '—'}</td>
            </tr>
            {type === 'order' && o.ship_date && (
              <tr>
                <td colSpan={2}>Dự kiến giao hàng: {formatVnDate(o.ship_date)}</td>
              </tr>
            )}
            {o.note && (
              <tr>
                <td colSpan={2}>Ghi chú đơn: {o.note}</td>
              </tr>
            )}
          </tbody>
        </table>

        {type === 'ship' ? (
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>STT</th>
                <th style={{ width: 120 }}>Mã sản phẩm</th>
                <th>Tên sản phẩm</th>
                <th style={{ width: 70 }}>ĐVT</th>
                <th style={{ width: 70 }}>SL đặt</th>
                <th style={{ width: 90 }}>Thực xuất</th>
                <th style={{ width: 130 }}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id}>
                  <td className="c">{i + 1}</td>
                  <td>{it.sku}</td>
                  <td>
                    {it.product_name}
                    {it.is_gift && <em> (hàng tặng)</em>}
                  </td>
                  <td className="c">{unitLabel(it.unit, it.pack_size)}</td>
                  <td className="r">{it.qty}</td>
                  <td className="r">{shipped.has(it.product_id) ? (it.is_gift ? Math.min(it.qty, shipped.get(it.product_id) ?? it.qty) : Math.max(0, (shipped.get(it.product_id) ?? 0) - (giftOf.get(it.product_id) ?? 0))) : ''}</td>
                  <td />
                </tr>
              ))}
              <tr className="tot">
                <td colSpan={4} className="r">
                  Tổng cộng
                </td>
                <td className="r">{items.reduce((s, it) => s + it.qty, 0)}</td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>STT</th>
                <th style={{ width: 110 }}>Mã sản phẩm</th>
                <th>Tên sản phẩm</th>
                <th style={{ width: 70 }}>ĐVT</th>
                {diff && <th style={{ width: 60 }}>SL đặt</th>}
                <th style={{ width: 60 }}>{diff ? 'SL giao' : 'Số lượng'}</th>
                <th style={{ width: 90 }}>Đơn giá</th>
                <th style={{ width: 100 }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id}>
                  <td className="c">{i + 1}</td>
                  <td>{it.sku}</td>
                  <td>
                    {it.product_name}
                    {it.is_gift && <em> (hàng tặng)</em>}
                  </td>
                  <td className="c">{unitLabel(it.unit, it.pack_size)}</td>
                  {diff && <td className="r">{it.qty}</td>}
                  <td className={`r ${diff && lineQty(it) !== it.qty ? 'hl' : ''}`}>{lineQty(it)}</td>
                  <td className="r">{it.is_gift ? 'Tặng' : formatVndNumber(it.applied_price)}</td>
                  <td className="r">{formatVndNumber(lineAmount(it))}</td>
                </tr>
              ))}
              <tr className="tot">
                <td colSpan={diff ? 7 : 6} className="r">
                  Cộng tiền hàng
                </td>
                <td className="r">{formatVndNumber(subtotal)}</td>
              </tr>
              {(o.discount_amount ?? 0) > 0 && (
                <tr>
                  <td colSpan={diff ? 7 : 6} className="r">
                    Chiết khấu
                  </td>
                  <td className="r">-{formatVndNumber(o.discount_amount)}</td>
                </tr>
              )}
              {(o.bonus_deduction ?? 0) > 0 && (
                <tr>
                  <td colSpan={diff ? 7 : 6} className="r">
                    Trừ thưởng tháng
                  </td>
                  <td className="r">-{formatVndNumber(o.bonus_deduction)}</td>
                </tr>
              )}
              {(o.shipping_fee ?? 0) > 0 && (
                <tr>
                  <td colSpan={diff ? 7 : 6} className="r">
                    Phí vận chuyển
                  </td>
                  <td className="r">{formatVndNumber(o.shipping_fee)}</td>
                </tr>
              )}
              <tr className="tot">
                <td colSpan={diff ? 7 : 6} className="r">
                  TỔNG PHẢI THANH TOÁN
                </td>
                <td className="r">{formatVndNumber(total)}</td>
              </tr>
              {paid > 0 && (
                <tr>
                  <td colSpan={diff ? 7 : 6} className="r">
                    Đã thanh toán
                  </td>
                  <td className="r">-{formatVndNumber(paid)}</td>
                </tr>
              )}
              {(paid > 0 || (o.cod_amount ?? 0) > 0) && (
                <tr className="tot">
                  <td colSpan={diff ? 7 : 6} className="r">
                    CÒN PHẢI THU
                  </td>
                  <td className="r">{formatVndNumber(dueNow)}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {type === 'order' && (
          <>
            <p className="print-words">
              Số tiền bằng chữ: <strong>{vndInWords(total)}</strong>
            </p>
            {prevDebt !== null && afterDebt !== null && (
              <table className="print-debt">
                <tbody>
                  <tr>
                    <td>Công nợ cũ của khách (trước đơn này)</td>
                    <td className="r">{formatVndNumber(prevDebt)}</td>
                  </tr>
                  <tr>
                    <td>Còn phải thu của đơn này</td>
                    <td className="r">{formatVndNumber(dueNow)}</td>
                  </tr>
                  <tr className="tot">
                    <td>TỔNG CÔNG NỢ SAU ĐƠN NÀY</td>
                    <td className="r">{formatVndNumber(afterDebt)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            {diff && (
              <p className="print-note">
                Lưu ý: số lượng thực giao khác số lượng đặt ở các dòng được tô đậm; tiền hàng ở trên đã tính theo số
                thực giao.
              </p>
            )}
            {activeBanks.length > 0 && (
              <div className="print-bank">
                <strong>Thông tin chuyển khoản:</strong>
                {activeBanks.map((b) => (
                  <div key={b.id}>
                    {b.bank} · STK <strong>{b.account_no}</strong> · {b.account_name}
                  </div>
                ))}
                <div>
                  Nội dung chuyển khoản: <strong>{o.order_no}</strong>
                </div>
              </div>
            )}
          </>
        )}

        <p className="print-date">
          Hà Nội, ngày {dd} tháng {mm} năm {yy}
        </p>
        <table className="print-sign">
          <tbody>
            <tr>
              {(type === 'ship'
                ? ['NGƯỜI LẬP PHIẾU (SALE)', 'QUẢN LÝ ĐIỀU PHỐI', 'KẾ TOÁN KHO', 'NGƯỜI GIAO / NHẬN HÀNG']
                : ['NGƯỜI LẬP PHIẾU', 'KẾ TOÁN', 'THỦ KHO', 'KHÁCH HÀNG XÁC NHẬN']
              ).map((t) => (
                <td key={t}>
                  <strong>{t}</strong>
                  <div>(Ký, ghi rõ họ tên)</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

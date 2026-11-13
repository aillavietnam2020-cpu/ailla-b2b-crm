import { CustomerSelect } from '../../components/CustomerSelect';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  CustomerListItem,
  CustomerPriceItem,
  OrderDetail,
  OrderLineItem,
  PriceTier,
  ProductItem,
} from '@shared/types';
import { formatVnd } from '@shared/money';
import { formatVnDate, vnDate } from '@shared/datetime';
import { ApiError, api, newIdempotencyKey } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { Card, ErrorBox, StateBlock, useToast } from '../../components/ui';
import { useAuth } from '../../components/AuthProvider';
import { ZaloIntake, type IntakePick } from '../../components/ZaloIntake';

/** Một gợi ý sản phẩm khi gõ mã: giá đã quy theo cách tính giá của khách. */
interface Suggest {
  id: string;
  sku: string;
  name: string;
  unit: string | null;
  pack_size: string | null;
  price: number | null;
}

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
  /**
   * Mã có ĐVT là Thùng (ví dụ AILLA2HD): bảng giá đã là giá MỘT THÙNG, số lượng đếm bằng thùng.
   * Không có công tắc lẻ/thùng và không nhân giá với quy cách. Muốn bán lẻ từng can/chai thì chọn mã -C.
   */
  carton_sku: boolean;
  /** Vật tư bán kèm (vỏ, nắp, chai...): không có bảng giá, người lập đơn tự điền giá. */
  supply?: boolean;
}

interface SupplyItem {
  code: string;
  name: string;
  unit: string;
  grp: string;
  product_id: string | null;
}

/** 1 nếu khách lấy lẻ, bằng số chai trong thùng nếu khách lấy nguyên thùng. */
function factorOf(line: Line): number {
  return line.pack_mode === 'THUNG' ? Math.max(1, line.pack_size) : 1;
}

/** Số chai thực tế của dòng — chỉ dùng để đối chiếu và tính thưởng. */
function unitQty(line: Line): number {
  return line.qty * factorOf(line);
}

/** Giá theo cấp bậc của khách, quy về đúng đơn vị đang bán (chai hay thùng). */
function tierPriceFor(line: Line): number | null {
  return line.base_price === null ? null : line.base_price * factorOf(line);
}

/** Giá thực tính cho một đơn vị đang bán: giá sale sửa tay, nếu không thì giá cấp bậc. */
function linePrice(line: Line): number {
  if (line.is_gift) return 0;
  return line.applied_price ?? tierPriceFor(line) ?? 0;
}

function lineTotal(line: Line): number {
  return line.qty * linePrice(line);
}

/**
 * Đơn vị bán lẻ để hiển thị. File Excel có mã ghi ĐVT là "Thùng", nhưng đơn vị
 * nhỏ nhất khách lấy vẫn là chai, nên không được hiện "Thùng (lẻ)".
 */
function retailUnit(unit: string | null): string {
  const raw = (unit ?? '').trim();
  if (!raw) return 'Chai';
  const key = raw.toLowerCase();
  if (
    key.includes('thùng') ||
    key.includes('thung') ||
    key.includes('kiện') ||
    key.includes('kien')
  ) {
    return 'Chai';
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** ĐVT của mã là thùng/kiện: giá trong bảng giá là giá một thùng. */
function isCartonUnit(unit: string | null): boolean {
  const key = (unit ?? '').trim().toLowerCase();
  return (
    key.includes('thùng') || key.includes('thung') || key.includes('kiện') || key.includes('kien')
  );
}

/** Đọc số quy đổi từ cột "Quy cách" của sản phẩm: "12 chai/thùng" -> 12. */
function parsePackSize(value: string | null): number {
  if (!value) return 1;
  const match = String(value).match(/\d+/);
  const parsed = match ? Number(match[0]) : 1;
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}

/** Dựng lại dòng hàng của form từ một dòng đơn đã lưu (khi sửa đơn). */
function lineFromItem(item: OrderLineItem): Line {
  const pack = parsePackSize(item.pack_size ?? null);
  const gift = Boolean(item.is_gift);
  // Đơn lưu theo chai/can lẻ; nếu chia hết cho quy cách thì hiện lại theo thùng cho dễ đọc.
  const cartonSku = isCartonUnit(item.unit ?? null);
  const asCarton = !cartonSku && pack > 1 && item.qty % pack === 0;
  const f = asCarton ? pack : 1;
  const sameAsBase = item.base_price !== null && item.applied_price === item.base_price;
  return {
    product_id: item.product_id,
    sku: item.sku,
    name: item.product_name,
    unit: cartonSku ? 'Thùng' : retailUnit(item.unit ?? null),
    pack_size: pack,
    pack_mode: asCarton ? 'THUNG' : 'LE',
    qty: item.qty / f,
    base_price: item.base_price,
    applied_price: gift || sameAsBase ? null : item.applied_price * f,
    is_gift: gift,
    carton_sku: cartonSku,
  };
}

export function NewOrderPage({ mode = 'sales' }: { mode?: 'sales' | 'admin' }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  // Quản lý điều phối (Thảo) tự tạo đơn: lưu xong gửi luôn, không phải mở đơn bấm "Gửi" thêm một lần.
  const mayAutoSend = can('order.approve.normal');
  const [sendNow, setSendNow] = useState(true);
  const [params] = useSearchParams();
  const { id: editId } = useParams();
  const editing = Boolean(editId);
  // Điện thoại: dòng đang mở để sửa chi tiết, và khối chiết khấu/phí đang mở hay gập.
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [showFees, setShowFees] = useState(false);
  const existing = useApi<OrderDetail>(editId ? `/api/orders/${editId}` : null);
  const [reason, setReason] = useState('');
  const loadedRef = useRef(false);

  const [customerId, setCustomerId] = useState(params.get('customer_id') ?? '');
  /** Khách NPP lên cấp: cấp giá sale chọn ngay trên đơn ('' = giữ nguyên cấp hiện tại của khách). */
  const [tierPick, setTierPick] = useState('');
  // Nhập lại đơn của những ngày trước: chọn được ngày đơn (mặc định hôm nay, không chọn ngày tương lai).
  const [orderDate, setOrderDate] = useState(vnDate());
  const [productQuery, setProductQuery] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [fees, setFees] = useState({
    discount_amount: 0,
    bonus_deduction: 0,
    shipping_fee: 0,
    cod_amount: 0,
  });
  const [promotion, setPromotion] = useState({ code: '', note: '' });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  /** Ảnh / tin đơn từ Zalo đã đọc: lưu đơn xong thì gắn ảnh gốc vào đơn. */
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());

  const debouncedQuery = useDebounced(productQuery);
  const customers = useApi<CustomerListItem[]>('/api/customers?page_size=200');
  const tiers = useApi<PriceTier[]>('/api/tiers');
  const customer = (customers.data ?? []).find((c) => c.id === customerId) ?? null;
  const customPricing = (customer?.price_mode ?? existing.data?.price_mode) === 'CUSTOM';
  const qs = debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : '';
  // Khách thường chọn trong bảng giá 8 cấp. Khách gia công: bảng giá riêng của họ, và gõ tìm thì thấy cả mọi mã khác
  // (CEO 13/11: đơn gia công phải tạo được với mọi mã) — mã chưa có trong bảng riêng thì nhập giá tay, quản lý duyệt như giá thỏa thuận.
  const catalog = useApi<{ products: ProductItem[] }>(
    customerId && !customPricing
      ? `/api/prices?limit=400&scope=TIER${qs}`
      : customerId && customPricing && debouncedQuery.trim()
        ? `/api/prices?limit=200${qs}`
        : null,
  );
  const ownCatalog = useApi<CustomerPriceItem[]>(
    customerId && customPricing ? `/api/customer-prices/${customerId}?${qs.slice(1)}` : null,
  );
  const effTierId = tierPick || customer?.tier_id || null;
  const tierCode = useMemo(
    () => (tiers.data ?? []).find((t) => t.id === effTierId)?.code ?? null,
    [tiers.data, effTierId],
  );
  useEffect(() => setTierPick(''), [customerId]);

  /** Đổi cấp giá của khách ngay trên đơn: tính lại giá các dòng đang có theo cấp mới; lưu đơn thì hồ sơ khách tự đổi theo. */
  const changeTier = async (newId: string) => {
    setTierPick(newId === (customer?.tier_id ?? '') ? '' : newId);
    const code = (tiers.data ?? []).find((t) => t.id === newId)?.code;
    // Khách có bảng giá riêng: giá các dòng lấy theo bảng riêng, cấp chỉ là giá dự phòng nên không tính lại dòng.
    if (!code || lines.length === 0 || customPricing) return;
    try {
      const r = await api.get<{ products: ProductItem[] }>('/api/prices?limit=1000&scope=TIER');
      const byId = new Map(r.data.products.map((p) => [p.id, p]));
      setLines((cur) =>
        cur.map((l) => {
          const p = byId.get(l.product_id);
          if (!p || l.supply) return l;
          return { ...l, base_price: (p.eff_prices ?? p.prices)[code] ?? null };
        }),
      );
    } catch {
      toast.error('Chưa tải được bảng giá của cấp mới, thử chọn lại cấp.');
    }
  };

  /** Giá của một sản phẩm theo đúng cấp bậc của khách đang chọn. */
  const priceForTier = (product: ProductItem): number | null =>
    tierCode ? ((product.eff_prices ?? product.prices)[tierCode] ?? null) : null;

  /**
   * Số can/chai trong một thùng, suy từ cặp mã "X" (thùng) và "X-C" (can) trong bảng giá: giá thùng ÷ giá can cùng cấp.
   * Trả 0 nếu không suy ra được (khi đó mới dùng số nhập tay / mặc định).
   */
  const siblingPack = (sku: string): number => {
    if (customPricing) return 0;
    const list = catalog.data?.products ?? [];
    const key = sku.toLowerCase();
    const thungKey = key.endsWith('-c') ? key.slice(0, -2) : key;
    const t = list.find((p) => p.sku.toLowerCase() === thungKey);
    const c = list.find((p) => p.sku.toLowerCase() === `${thungKey}-c`);
    if (!t || !c) return 0;
    const code = tierCode ?? 'BAN_LE';
    const tp = (t.eff_prices ?? t.prices)[code];
    const cp = (c.eff_prices ?? c.prices)[code];
    if (!tp || !cp) return 0;
    const ratio = Math.round(tp / cp);
    return ratio >= 2 ? ratio : 0;
  };
  /** Đơn vị lẻ của sản phẩm (can, chai, hộp...) lấy từ mã -C cùng sản phẩm; không có thì ghi chung. */
  const smallUnit = (sku: string): string => {
    const list = catalog.data?.products ?? [];
    const key = sku.toLowerCase();
    const base = key.endsWith('-c') ? key.slice(0, -2) : key;
    const c = list.find((p) => p.sku.toLowerCase() === `${base}-c`);
    return (c?.unit ?? 'can/chai').toLowerCase();
  };
  /** Quy cách của dòng: số đã khai, nếu chưa thì suy từ mã thùng/mã can. */
  const packFor = (line: Line): number =>
    line.pack_size > 1 ? line.pack_size : siblingPack(line.sku);

  const ownIds = new Set((ownCatalog.data ?? []).map((p) => p.product_id));
  const suggestions: Suggest[] = customPricing
    ? [
        ...(ownCatalog.data ?? []).map((p) => ({
          id: p.product_id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          pack_size: p.pack_size,
          price: p.amount,
        })),
        // Mã chưa có trong bảng giá riêng của khách: vẫn chọn được, giá để trống cho người lập đơn nhập.
        ...(catalog.data?.products ?? [])
          .filter((p) => !ownIds.has(p.id))
          .map((p) => ({ id: p.id, sku: p.sku, name: p.name + ' (chưa có giá riêng, nhập giá)', unit: p.unit, pack_size: p.pack_size, price: null })),
      ]
    : (catalog.data?.products ?? []).map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        pack_size: p.pack_size,
        price: priceForTier(p),
      }));
  // Khách gia công mua thêm vật tư (vỏ thùng, nắp, chai...): tìm trong kho vật tư, giá tự điền.
  const supplies = useApi<SupplyItem[]>(
    customPricing && customerId && debouncedQuery.trim() ? `/api/supplies?q=${encodeURIComponent(debouncedQuery.trim())}` : null,
  );
  const addSupply = async (it: SupplyItem) => {
    try {
      const r = await api.post<{ id: string; sku: string; name: string; unit: string | null }>('/api/supplies/ensure', { code: it.code });
      const p = r.data;
      addLine({ id: p.id, sku: p.sku, name: p.name, unit: p.unit, pack_size: null, price: null }, true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Chưa thêm được vật tư');
    }
  };
  // Hàng hóa chưa có mã bán Kênh phân phối (mua về làm quà nhưng vẫn bán cho NPP, có giá và doanh thu): vẫn chọn vào đơn được, web tự tạo mã (QUA-…), Trưởng phòng duyệt mã sau.
  const gifts = useApi<SupplyItem[]>(
    !customPricing && customerId && debouncedQuery.trim() ? `/api/supplies?gift=1&q=${encodeURIComponent(debouncedQuery.trim())}` : null,
  );
  const addGiftItem = async (it: SupplyItem) => {
    try {
      const r = await api.post<{ id: string; sku: string; name: string; unit: string | null; code_status: string }>('/api/supplies/ensure-gift', { code: it.code });
      const p = r.data;
      addLine({ id: p.id, sku: p.sku, name: p.name, unit: p.unit, pack_size: null, price: null }, true);
      if (p.code_status === 'CHO_DUYET') toast.success(`Đã tạo mã bán ${p.sku}, chờ Trưởng phòng duyệt mã. Nhập giá bán cho dòng này.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Chưa thêm được hàng hóa');
    }
  };
  const suggestLoading = customPricing ? ownCatalog.loading : catalog.loading;
  const suggestError = customPricing ? ownCatalog.error : catalog.error;

  // Mở form sửa đơn: nạp sẵn khách, dòng hàng, chiết khấu, ghi chú của đơn đang sửa.
  useEffect(() => {
    const o = existing.data;
    if (!o || loadedRef.current) return;
    loadedRef.current = true;
    setCustomerId(o.customer_id);
    if (o.order_date) setOrderDate(o.order_date);
    setLines(o.items.map(lineFromItem));
    setFees({
      discount_amount: o.discount_amount ?? 0,
      bonus_deduction: o.bonus_deduction ?? 0,
      shipping_fee: o.shipping_fee ?? 0,
      cod_amount: o.cod_amount ?? 0,
    });
    setPromotion({ code: o.promotion_code ?? '', note: o.promotion_note ?? '' });
    setNote(o.note ?? '');
  }, [existing.data]);

  const subtotal = lines.reduce((acc, line) => acc + lineTotal(line), 0);
  const totalAmount = subtotal - fees.discount_amount - fees.bonus_deduction + fees.shipping_fee;
  const remaining = totalAmount - fees.cod_amount;
  const freeTier = tierCode === 'KHAC';
  const staffTier = tierCode === 'NHAN_VIEN';
  const lineNeedsPrice = (l: Line) =>
    !l.is_gift &&
    (freeTier || l.supply || (staffTier && l.base_price === null)
      ? (l.applied_price ?? 0) <= 0
      : l.base_price === null && !(editing && (l.applied_price ?? 0) > 0));
  const blockedLines = lines.filter(lineNeedsPrice);
  const needsReason =
    editing &&
    existing.data !== null &&
    existing.data.approval_status !== 'DRAFT' &&
    existing.data.approval_status !== 'REJECTED';

  // ── Tự lưu nháp ──────────────────────────────────────────────────────────
  // Khách + ít nhất một dòng hợp lệ thì đơn tự được ghi thành đơn Nháp (hiện trong danh sách đơn),
  // sau đó mỗi lần sửa tự lưu lại sau ~2 giây. Tải lại trang / mất mạng vẫn còn đơn, mở lại làm tiếp.
  const draftIdRef = useRef<string | null>(null);
  const draftDateRef = useRef<string | null>(null);
  const createKeyRef = useRef({ body: '', key: newIdempotencyKey() });
  const lastSavedRef = useRef('');
  const inflightRef = useRef(false);
  const attachedRef = useRef(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  const [autoSaveFailed, setAutoSaveFailed] = useState(false);
  const orderItemsBody = () =>
    lines.map((line) => ({
      product_id: line.product_id,
      qty: unitQty(line),
      applied_price:
        line.is_gift || line.applied_price === null ? undefined : Math.round(line.applied_price / factorOf(line)),
      is_gift: line.is_gift,
    }));
  const draftKey = JSON.stringify([customerId, orderDate, orderItemsBody(), fees, promotion, note]);
  const canAutosave =
    !saving &&
    Boolean(customerId) &&
    lines.length > 0 &&
    blockedLines.length === 0 &&
    !tierPick &&
    lines.every((l) => unitQty(l) > 0) &&
    (!editing || (loadedRef.current && existing.data?.approval_status === 'DRAFT'));
  useEffect(() => {
    if (!canAutosave) return;
    if (editing && lastSavedRef.current === '') {
      lastSavedRef.current = draftKey; // vừa nạp đơn nháp: chưa có gì mới để lưu
      return;
    }
    if (draftKey === lastSavedRef.current) return;
    const timer = window.setTimeout(async () => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      const id = editId ?? draftIdRef.current;
      try {
        if (!id) {
          // Cùng nội dung thì dùng lại khóa (mất mạng gửi lại không sinh đơn trùng); nội dung khác thì khóa mới.
          if (createKeyRef.current.body !== draftKey) createKeyRef.current = { body: draftKey, key: newIdempotencyKey() };
          const r = await api.post<{ id: string }>(
            '/api/orders',
            {
              customer_id: customerId,
              order_date: orderDate,
              items: orderItemsBody(),
              ...fees,
              promotion_code: promotion.code || null,
              promotion_note: promotion.note || null,
              note: note || null,
            },
            createKeyRef.current.key,
          );
          draftIdRef.current = r.data.id;
          draftDateRef.current = orderDate;
          // Tải lại trang thì vào thẳng đơn nháp này (không về form trống).
          window.history.replaceState(window.history.state, '', `/${mode}/orders/${r.data.id}/edit`);
          if (intakeId && !attachedRef.current) {
            attachedRef.current = true;
            await api.post(`/api/order-intake/${intakeId}/attach`, { order_id: r.data.id }).catch(() => undefined);
          }
        } else {
          if (!editing && draftDateRef.current && orderDate !== draftDateRef.current) {
            await api.post(`/api/orders/${id}/order-date`, { order_date: orderDate, reason: null });
            draftDateRef.current = orderDate;
          }
          await api.put(`/api/orders/${id}`, {
            items: orderItemsBody(),
            ...fees,
            promotion_code: promotion.code || null,
            promotion_note: promotion.note || null,
            note: note || null,
            autosave: true,
          });
        }
        lastSavedRef.current = draftKey;
        setAutoSaveFailed(false);
        setAutoSavedAt(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        setAutoSaveFailed(true); // mất mạng / lỗi: lần sửa sau sẽ thử lại, nút Lưu đơn vẫn dùng bình thường
      } finally {
        inflightRef.current = false;
      }
    }, 2000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, canAutosave]);

  const addLine = (product: Suggest, supply = false) => {
    const same = lines.filter((l) => l.product_id === product.id);
    // Cùng sản phẩm được có hai dòng: một dòng bán, một dòng tặng.
    const addAsGift = same.length === 1 && !same[0].is_gift;
    if (same.length > 0 && !addAsGift) {
      toast.error(`${product.sku} đã có trong đơn`);
      return;
    }
    if (addAsGift) toast.success(`${product.sku} đã có dòng bán, thêm dòng TẶNG kèm`);
    setLines([
      ...lines,
      {
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        unit: isCartonUnit(product.unit) ? 'Thùng' : retailUnit(product.unit),
        pack_size: parsePackSize(product.pack_size),
        pack_mode: 'LE',
        qty: 1,
        base_price: product.price,
        applied_price: null,
        is_gift: addAsGift,
        carton_sku: isCartonUnit(product.unit),
        supply,
      },
    ]);
    // Chọn xong thì ẩn danh sách gợi ý, ô tìm kiếm về trống để tìm mã tiếp theo.
    setProductQuery('');
  };

  /** Dòng máy đọc từ đơn Zalo: giá lấy theo cấp / bảng giá riêng của khách, giống lúc chọn tay. */
  const addFromIntake = async (picks: IntakePick[], meta: { intakeId: string; note: string | null }) => {
    let priceOf: (productId: string) => number | null = () => null;
    try {
      if (customPricing) {
        const r = await api.get<CustomerPriceItem[]>(`/api/customer-prices/${customerId}`);
        const m = new Map(r.data.map((p) => [p.product_id, p.amount]));
        priceOf = (id) => m.get(id) ?? null;
      } else {
        const r = await api.get<{ products: ProductItem[] }>('/api/prices?limit=1000&scope=TIER');
        const m = new Map(r.data.products.map((p) => [p.id, p]));
        priceOf = (id) => {
          const p = m.get(id);
          return p ? priceForTier(p) : null;
        };
      }
    } catch {
      toast.error('Chưa tải được bảng giá. Dòng nào thiếu giá thì chọn lại mã.');
    }
    const have = new Set(lines.filter((l) => !l.is_gift).map((l) => l.product_id));
    const add: Line[] = [];
    let skipped = 0;
    for (const pk of picks) {
      if (have.has(pk.product.id)) {
        skipped++;
        continue;
      }
      have.add(pk.product.id);
      const carton = isCartonUnit(pk.product.unit);
      const pack = parsePackSize(pk.product.pack_size);
      add.push({
        product_id: pk.product.id,
        sku: pk.product.sku,
        name: pk.product.name,
        unit: carton ? 'Thùng' : retailUnit(pk.product.unit),
        pack_size: pack,
        pack_mode: pk.as_carton && pack > 1 ? 'THUNG' : 'LE',
        qty: pk.qty,
        base_price: priceOf(pk.product.id),
        applied_price: null,
        is_gift: false,
        carton_sku: carton,
      });
    }
    setLines((cur) => [...cur, ...add]);
    setIntakeId(meta.intakeId);
    if (meta.note && !note.trim()) setNote(meta.note);
    toast.success(
      `Đã đưa ${add.length} dòng vào đơn${skipped ? `, bỏ ${skipped} dòng trùng mã đã có` : ''}. Kiểm tra số lượng, thùng/lẻ và giá trước khi lưu.`,
    );
  };

  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (editing && editId) {
        // Sửa ngày đặt đơn (tạo nhầm ngày): ghi riêng, có nhật ký, trước khi lưu phần hàng.
        if (existing.data?.order_date && orderDate !== existing.data.order_date) {
          await api.post(`/api/orders/${editId}/order-date`, { order_date: orderDate, reason: reason.trim() || null });
        }
        const result = await api.put<{
          status: string;
          total_before: number;
          total_after: number;
          needs_approval: boolean;
        }>(`/api/orders/${editId}`, {
          items: lines.map((line) => ({
            product_id: line.product_id,
            qty: unitQty(line),
            applied_price:
              line.is_gift || line.applied_price === null
                ? undefined
                : Math.round(line.applied_price / factorOf(line)),
            is_gift: line.is_gift,
          })),
          ...fees,
          promotion_code: promotion.code || null,
          promotion_note: promotion.note || null,
          customer_tier_id: tierPick || null,
          note: note || null,
          reason: reason.trim() || null,
        });
        const r = result.data;
        if ((r as { tier_request?: boolean }).tier_request) toast.success('Đã lưu đơn nháp giá cấp mới và gửi xin Quản lý duyệt đổi cấp cho khách.');
        toast.success(
          r.needs_approval
            ? 'Đã lưu. Đơn quay lại Chờ duyệt vì có giá lệch chuẩn hoặc vượt hạn mức.'
            : `Đã lưu. Tổng tiền: ${formatVnd(r.total_before)} → ${formatVnd(r.total_after)}`,
        );
        navigate(`/${mode}/orders/${editId}`);
        return;
      }
      // Chờ lần tự lưu đang chạy (nếu có) xong rồi mới lưu chính thức.
      for (let i = 0; i < 50 && inflightRef.current; i++) await new Promise((r) => setTimeout(r, 100));
      const draftId = draftIdRef.current;
      if (draftId) {
        if (draftDateRef.current && orderDate !== draftDateRef.current) {
          await api.post(`/api/orders/${draftId}/order-date`, { order_date: orderDate, reason: null });
        }
        await api.put(`/api/orders/${draftId}`, {
          items: orderItemsBody(),
          ...fees,
          promotion_code: promotion.code || null,
          promotion_note: promotion.note || null,
          customer_tier_id: tierPick || null,
          note: note || null,
        });
        if (intakeId && !attachedRef.current) {
          await api.post(`/api/order-intake/${intakeId}/attach`, { order_id: draftId }).catch(() => {
            toast.error('Đơn đã lưu nhưng chưa gắn được ảnh gốc của khách.');
          });
        }
        if (mayAutoSend && sendNow) {
          try {
            await api.post(`/api/orders/${draftId}/submit`, {});
            toast.success('Đã tạo đơn và gửi đi.');
          } catch (e) {
            toast.error(`Đã lưu đơn nhưng chưa gửi được: ${e instanceof ApiError ? e.message : 'thử lại'}. Mở đơn để gửi.`);
          }
        } else {
          toast.success('Đã tạo đơn. Kiểm tra lại rồi gửi duyệt.');
        }
        navigate(`/sales/orders/${draftId}`);
        return;
      }
      const result = await api.post<{ id: string; tier_request?: boolean }>(
        '/api/orders',
        {
          customer_id: customerId,
          order_date: orderDate,
          items: lines.map((line) => ({
            product_id: line.product_id,
            // Hệ thống lưu theo đơn vị nhỏ nhất (chai) để doanh số và thưởng tính
            // nhất quán, nên đơn lấy thùng được quy đổi cả số lượng lẫn đơn giá.
            qty: unitQty(line),
            applied_price:
              line.is_gift || line.applied_price === null
                ? undefined
                : Math.round(line.applied_price / factorOf(line)),
            is_gift: line.is_gift,
          })),
          ...fees,
          promotion_code: promotion.code || null,
          promotion_note: promotion.note || null,
          customer_tier_id: tierPick || null,
          note: note || null,
        },
        idempotencyKey,
      );
      if (intakeId) {
        await api.post(`/api/order-intake/${intakeId}/attach`, { order_id: result.data.id }).catch(() => {
          toast.error('Đơn đã lưu nhưng chưa gắn được ảnh gốc của khách.');
        });
      }
      if (mayAutoSend && sendNow) {
        try {
          await api.post(`/api/orders/${result.data.id}/submit`, {});
          toast.success('Đã tạo đơn và gửi đi.');
        } catch (e) {
          toast.error(
            `Đã lưu đơn nhưng chưa gửi được: ${e instanceof ApiError ? e.message : 'thử lại'}. Mở đơn để gửi.`,
          );
        }
      } else {
        toast.success('Đã tạo đơn. Kiểm tra lại rồi gửi duyệt.');
      }
      navigate(`/sales/orders/${result.data.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fields ?? {});
        setIdempotencyKey(newIdempotencyKey());
      } else setFormError(editing ? 'Không lưu được thay đổi' : 'Không tạo được đơn hàng');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{editing ? `Sửa đơn ${existing.data?.order_no ?? ''}` : 'Tạo đơn hàng'}</h2>
          <p>
            {customPricing
              ? 'Khách này dùng bảng giá riêng: giá tự nhảy theo bảng giá của khách. Mã chưa có trong bảng giá riêng sẽ bị chặn; giá sửa tay phải gửi duyệt.'
              : 'Giá tự nhảy theo cấp bậc của khách. Mã chưa có giá ở cấp đó sẽ bị chặn; giá sửa tay phải gửi duyệt.'}
          </p>
        </div>
      </div>

      <ErrorBox message={formError} />

      {editing && existing.error && <div className="alert-box">{existing.error}</div>}
      {editing && existing.data && <EditNotice order={existing.data} newTotal={totalAmount} />}

      {/* Khối 1: khách hàng và tổng tiền nằm cùng một khung cho dễ đối chiếu */}
      <Card title="Khách hàng và tổng tiền">
        <div className="order-head">
          <div className="field">
            <label>Khách hàng *</label>
            <CustomerSelect
              value={customerId}
              onChange={setCustomerId}
              disabled={editing}
              title={editing ? 'Muốn đổi khách thì huỷ đơn và tạo đơn mới' : undefined}
              placeholder="Gõ tên khách để tìm…"
              options={(customers.data ?? []).map((c) => ({
                id: c.id,
                name: c.name,
                hint: c.price_mode === 'CUSTOM' ? 'bảng giá riêng' : (c.tier_name ?? 'chưa có cấp'),
              }))}
            />
            <label style={{ marginTop: 10 }}>Ngày đơn</label>
            {editing ? (
              <input
                type="date"
                value={orderDate}
                max={vnDate()}
                onChange={(e) => setOrderDate(e.target.value || existing.data?.order_date || vnDate())}
                title="Sửa ngày đặt đơn nếu tạo nhầm ngày. Số đơn giữ nguyên."
              />
            ) : (
              <input
                type="date"
                value={orderDate}
                max={vnDate()}
                onChange={(e) => setOrderDate(e.target.value || vnDate())}
                title="Nhập đơn của ngày trước thì chọn đúng ngày đơn được đặt"
              />
            )}
            {editing && existing.data?.order_date && orderDate !== existing.data.order_date && (
              <span className="muted">Ngày đơn đổi từ {formatVnDate(existing.data.order_date)} sang {formatVnDate(orderDate)} khi bấm Lưu.</span>
            )}
            {!editing && orderDate !== vnDate() && (
              <span className="muted">Đơn nhập lại cho ngày {formatVnDate(orderDate)}.</span>
            )}
            {customer && !customer.tier_id && customer.price_mode !== 'CUSTOM' && (
              <span className="error">
                Khách chưa được map cấp giá nên chưa tạo đơn được. Quản lý cần chọn cấp bậc trước.
              </span>
            )}
          </div>

          <div className="order-facts">
            <div className="stat-row">
              <span className="muted">Cách tính giá</span>
              {!customer ? (
                <strong>—</strong>
              ) : (
                <select
                  value={effTierId ?? ''}
                  onChange={(e) => void changeTier(e.target.value)}
                  title="Khách lên cấp: chọn cấp mới, giá các dòng đổi theo và hồ sơ khách tự cập nhật khi lưu đơn"
                  style={{ maxWidth: 200 }}
                >
                  {!effTierId && <option value="">{customPricing ? 'Bảng giá riêng (chưa có cấp)' : 'Chưa có cấp'}</option>}
                  {(tiers.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {tierPick && (
              <div className="note" style={{ margin: '4px 0' }}>
                Khách lên cấp: đơn tính giá theo cấp mới, lưu đơn xong hồ sơ khách tự đổi theo.
                {!can('customer.tier.change') &&
                  (() => {
                    const need = (tiers.data ?? []).find((t) => t.id === tierPick)?.min_order_amount ?? 0;
                    return need > 0 && subtotal >= need
                      ? ` Đơn đạt điều kiện (từ ${formatVnd(need)}): cấp đổi luôn khi lưu đơn.`
                      : need > 0
                        ? ` Đơn chưa đạt điều kiện (cần ${formatVnd(need)}, hiện ${formatVnd(subtotal)}): lưu đơn là đơn nháp giá cấp mới (gửi khách được) và gửi xin Quản lý duyệt đổi cấp; đơn gửi duyệt được sau khi cấp được duyệt.`
                        : ' Cấp này chưa đặt điều kiện: lưu đơn là đơn nháp giá cấp mới (gửi khách được) và gửi xin Quản lý duyệt đổi cấp; đơn gửi duyệt được sau khi cấp được duyệt.';
                  })()}
              </div>
            )}
            <div className="stat-row">
              <span className="muted">Công nợ chính thức</span>
              <strong>{formatVnd(customer?.official_debt ?? 0)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Hạn mức</span>
              <strong>{formatVnd(customer?.credit_limit ?? 0)}</strong>
            </div>
          </div>

          <div className="order-facts desk-only">
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

      {!editing && (
        <>
          <ZaloIntake
            customerId={customerId}
            customers={(customers.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
            onPickCustomer={setCustomerId}
            onApply={(picks, meta) => void addFromIntake(picks, meta)}
          />
          <div style={{ height: 16 }} />
        </>
      )}

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
              loading={suggestLoading}
              error={suggestError}
              empty={suggestions.length === 0}
              emptyText={
                customPricing
                  ? 'Mã này chưa có trong bảng giá riêng của khách.'
                  : 'Không tìm thấy sản phẩm.'
              }
            >
              {suggestions.slice(0, 8).map((product) => {
                const price = product.price;
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
                      {price === null ? 'Chưa có giá' : formatVnd(price)}
                    </span>
                  </button>
                );
              })}
            </StateBlock>
            {!customPricing && (gifts.data ?? []).length > 0 && (
              <div style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}>
                <div className="muted" style={{ fontSize: 12.5, padding: '0 4px 4px' }}>
                  Hàng hóa chưa có mã bán Kênh phân phối: chọn là web tự tạo mã, Trưởng phòng duyệt mã sau. Nhập giá bán như mọi mã khác.
                </div>
                {(gifts.data ?? []).map((it) => (
                  <button type="button" key={it.code} className="suggest-row" onClick={() => void addGiftItem(it)} disabled={!customerId}>
                    <span>
                      <strong>{it.code}</strong> · {it.name}
                      <small className="muted"> {it.unit}{it.grp ? ` · ${it.grp}` : ''}</small>
                    </span>
                    <span className="muted">Tạo mã · nhập giá</span>
                  </button>
                ))}
              </div>
            )}
            {customPricing && (supplies.data ?? []).length > 0 && (
              <div style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}>
                <div className="muted" style={{ fontSize: 12.5, padding: '0 4px 4px' }}>
                  Vật tư bán kèm (vỏ thùng, nắp, chai…): tự điền giá, không cần duyệt
                </div>
                {(supplies.data ?? []).map((it) => (
                  <button type="button" key={it.code} className="suggest-row" onClick={() => void addSupply(it)} disabled={!customerId}>
                    <span>
                      <strong>{it.code}</strong> · {it.name}
                      <small className="muted"> {it.unit}{it.grp ? ` · ${it.grp}` : ''}</small>
                    </span>
                    <span className="muted">Nhập giá</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {lines.length === 0 ? (
          <div className="empty">
            {customerId
              ? 'Chưa có dòng nào. Gõ mã sản phẩm ở ô trên để thêm.'
              : 'Chọn khách hàng trước.'}
          </div>
        ) : (
          <>
            <div className="mo-lines">
              {lines.map((line, index) => {
                const open = openLine === line.product_id;
                const missing = lineNeedsPrice(line);
                return (
                  <div key={line.product_id + (line.is_gift ? "-tang" : "")} className={'mo-line' + (missing ? ' bad' : '')}>
                    <div className="mo-line-main">
                      <button
                        type="button"
                        className="mo-line-info"
                        onClick={() => setOpenLine(open ? null : line.product_id)}
                      >
                        <span className="mo-sku">
                          {line.sku} ·{' '}
                          {line.pack_mode === 'THUNG' ? 'thùng' : line.unit.toLowerCase()}
                          {line.is_gift && <span className="mo-gift">Tặng</span>}
                        </span>
                        <span className="mo-name">
                          {line.name}
                          {!line.is_gift && tierPriceFor(line) !== null
                            ? ` · ${formatVnd(linePrice(line))}`
                            : ''}
                        </span>
                      </button>
                      <div className="mo-qty">
                        <button
                          type="button"
                          aria-label="Giảm"
                          onClick={() => updateLine(index, { qty: Math.max(1, line.qty - 1) })}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={line.qty}
                          onChange={(e) => updateLine(index, { qty: Number(e.target.value) || 1 })}
                        />
                        <button
                          type="button"
                          aria-label="Tăng"
                          onClick={() => updateLine(index, { qty: line.qty + 1 })}
                        >
                          +
                        </button>
                      </div>
                      <strong className="mo-amt">{formatVnd(lineTotal(line))}</strong>
                    </div>
                    {missing && (
                      <div className="error">
                        {customPricing
                          ? 'Mã này chưa có trong bảng giá riêng của khách'
                          : 'Cấp giá của khách chưa có giá cho mã này'}
                      </div>
                    )}
                    {fieldErrors[`items.${index}.applied_price`] && (
                      <div className="error">{fieldErrors[`items.${index}.applied_price`]}</div>
                    )}
                    {open && (
                      <div className="mo-line-edit">
                        <label>
                          Đơn vị
                          <select
                            value={line.pack_mode}
                            disabled={line.carton_sku}
                            onChange={(e) =>
                              updateLine(index, {
                                pack_mode: e.target.value as 'LE' | 'THUNG',
                                pack_size:
                                  e.target.value === 'THUNG' && line.pack_size < 2
                                    ? packFor(line) || 12
                                    : line.pack_size,
                                applied_price: null,
                              })
                            }
                          >
                            {line.carton_sku ? (
                              <option value="LE">Thùng (giá một thùng)</option>
                            ) : (
                              <>
                                <option value="LE">{line.unit} (lẻ)</option>
                                <option value="THUNG">Thùng</option>
                              </>
                            )}
                          </select>
                        </label>
                        {line.pack_mode === 'THUNG' && (
                          <label>
                            {line.unit.toLowerCase()}/thùng
                            <input
                              type="number"
                              inputMode="numeric"
                              min={2}
                              value={line.pack_size}
                              onChange={(e) =>
                                updateLine(index, {
                                  pack_size: Math.max(2, Number(e.target.value) || 2),
                                })
                              }
                            />
                          </label>
                        )}
                        {!line.is_gift && (
                          <label>
                            Giá sửa tay (đ)
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              placeholder={
                                tierPriceFor(line) !== null
                                  ? String(tierPriceFor(line))
                                  : 'chưa có giá'
                              }
                              value={line.applied_price ?? ''}
                              onChange={(e) =>
                                updateLine(index, {
                                  applied_price:
                                    e.target.value === '' ? null : Number(e.target.value),
                                })
                              }
                            />
                          </label>
                        )}
                        <label className="mo-check">
                          <input
                            type="checkbox"
                            checked={line.is_gift}
                            onChange={(e) => updateLine(index, { is_gift: e.target.checked })}
                          />
                          Hàng tặng (0đ)
                        </label>
                        <div className="mo-line-meta">
                          {line.carton_sku
                            ? packFor(line) > 1
                              ? `Quy ra ${line.qty * packFor(line)} ${smallUnit(line.sku)}`
                              : 'Giá tính theo thùng'
                            : `Quy ra ${unitQty(line)} ${line.unit.toLowerCase()}`}
                        </div>
                        <button
                          type="button"
                          className="btn sm danger"
                          onClick={() => {
                            setLines(lines.filter((_, i) => i !== index));
                            setOpenLine(null);
                          }}
                        >
                          Xoá dòng này
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="table-wrap desk-only">
              <table className="data">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Đơn vị</th>
                    <th className="right">Số lượng</th>
                    <th className="right">Quy ra đơn vị lẻ: can/chai (tính thưởng)</th>
                    <th className="right">
                      {customPricing ? 'Đơn giá theo bảng giá riêng' : 'Đơn giá theo cấp bậc'}
                    </th>
                    <th className="right">Thành tiền</th>
                    <th className="right">Hàng tặng</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.product_id + (line.is_gift ? "-tang" : "")}>
                      <td>
                        <strong>{line.sku}</strong>
                        <div className="muted">{line.name}</div>
                        {fieldErrors[`items.${index}.applied_price`] && (
                          <div className="error">{fieldErrors[`items.${index}.applied_price`]}</div>
                        )}
                        {lineNeedsPrice(line) && (
                          <div className="error">
                            {freeTier
                              ? 'Nhập giá bán (khách cấp "Khác" tự thỏa thuận giá)'
                              : customPricing
                                ? 'Mã này chưa có trong bảng giá riêng của khách'
                                : 'Cấp giá của khách chưa có giá cho mã này'}
                          </div>
                        )}
                      </td>
                      <td className="nowrap">
                        <select
                          value={line.pack_mode}
                          disabled={line.carton_sku}
                          onChange={(e) =>
                            updateLine(index, {
                              pack_mode: e.target.value as 'LE' | 'THUNG',
                              // Sản phẩm chưa khai quy cách thì tạm lấy 12, sửa ngay ở ô bên cạnh.
                              pack_size:
                                e.target.value === 'THUNG' && line.pack_size < 2
                                  ? packFor(line) || 12
                                  : line.pack_size,
                              // Đổi đơn vị thì giá sửa tay cũ không còn đúng nữa.
                              applied_price: null,
                            })
                          }
                        >
                          {line.carton_sku ? (
                            <option value="LE">Thùng (giá một thùng)</option>
                          ) : (
                            <>
                              <option value="LE">{line.unit} (lẻ)</option>
                              <option value="THUNG">Thùng</option>
                            </>
                          )}
                        </select>
                        {line.pack_mode === 'THUNG' && (
                          <span className="pack-size">
                            <input
                              type="number"
                              min={2}
                              value={line.pack_size}
                              title={`Một thùng có mấy ${line.unit.toLowerCase()}`}
                              onChange={(e) =>
                                updateLine(index, {
                                  pack_size: Math.max(2, Number(e.target.value) || 2),
                                })
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
                        {line.carton_sku
                          ? packFor(line) > 1
                            ? `${line.qty * packFor(line)} ${smallUnit(line.sku)}`
                            : '—'
                          : `${unitQty(line)} ${line.unit.toLowerCase()}`}
                      </td>
                      <td className="right">
                        {line.is_gift ? (
                          <span className="badge green">Tặng · 0đ</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step={1}
                            placeholder={
                              tierPriceFor(line) !== null
                                ? String(tierPriceFor(line))
                                : 'chưa có giá'
                            }
                            value={line.applied_price ?? ''}
                            onChange={(e) =>
                              updateLine(index, {
                                applied_price:
                                  e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            style={{ width: 130, textAlign: 'right' }}
                          />
                        )}
                        {!line.is_gift && line.applied_price === 0 && (
                          <div style={{ marginTop: 4 }}>
                            <button
                              type="button"
                              className="btn sm primary"
                              title="Giá 0đ sẽ bị tính là lệch 100% và phải CEO duyệt. Hàng tặng thì không cần."
                              onClick={() =>
                                updateLine(index, { is_gift: true, applied_price: null })
                              }
                            >
                              Đây là hàng tặng
                            </button>
                          </div>
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
          </>
        )}
      </Card>

      <div style={{ height: 16 }} />

      <button type="button" className="mo-more" onClick={() => setShowFees(!showFees)}>
        <span>Chiết khấu, phí ship, ghi chú</span>
        <span>{showFees ? '⌃' : '›'}</span>
      </button>
      <div className={'fees-wrap' + (showFees || needsReason ? ' open' : '')}>
        <Card title="Chương trình khuyến mại, chiết khấu và phí">
          <p className="muted" style={{ margin: '0 0 12px' }}>
            Tặng quà: thêm sản phẩm vào bảng trên rồi tích ô <strong>Hàng tặng</strong>, dòng đó về
            0đ. Giảm giá tiền: điền vào ô <strong>Chiết khấu</strong> bên dưới.
          </p>
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
            {needsReason && (
              <div className="field full">
                <label>Lý do sửa đơn *</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ví dụ: kho báo hết hàng, khách đổi sang mã khác / kho xuất thiếu 1 can"
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  Lý do được lưu cùng bản trước/sau để mọi người (kho, kế toán) nắm được vì sao đơn
                  đổi.
                </span>
              </div>
            )}
          </div>

          <div className="modal-foot" style={{ paddingRight: 0 }}>
            {(autoSavedAt || autoSaveFailed) && (
              <span className="muted" style={{ marginRight: 12, fontSize: 12 }}>
                {autoSaveFailed ? 'Chưa tự lưu được nháp, sẽ thử lại khi sửa tiếp' : `Đã tự lưu nháp lúc ${autoSavedAt}`}
              </span>
            )}
            {!editing && mayAutoSend && (
              <label style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={sendNow}
                  onChange={(e) => setSendNow(e.target.checked)}
                />{' '}
                Gửi luôn sau khi lưu
              </label>
            )}
            <button
              className="btn primary"
              disabled={
                saving ||
                !customerId ||
                lines.length === 0 ||
                blockedLines.length > 0 ||
                (needsReason && reason.trim().length < 5)
              }
              onClick={save}
            >
              {saving
                ? 'Đang lưu…'
                : editing
                  ? `Lưu thay đổi · ${formatVnd(totalAmount)}`
                  : `Lưu đơn · ${formatVnd(totalAmount)}`}
            </button>
            {editing && editId && (
              <Link className="btn" to={`/${mode}/orders/${editId}`} style={{ marginLeft: 8 }}>
                Bỏ qua, không sửa
              </Link>
            )}
          </div>
          {blockedLines.length > 0 && (
            <div className="alert-box" style={{ marginTop: 10 }}>
              Còn {blockedLines.length} dòng chưa có giá{' '}
              {customPricing ? 'trong bảng giá riêng của khách' : 'ở cấp của khách'}. Bỏ dòng đó ra
              hoặc bổ sung giá trước khi lưu.
            </div>
          )}
        </Card>
      </div>

      {/* Điện thoại: thanh tổng tiền + nút lưu luôn nằm dưới đáy màn hình */}
      <div className="mo-bar">
        <div className="mo-bar-total">
          <small>{lines.length} mã · Phải thu</small>
          <strong>{formatVnd(totalAmount)}</strong>
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={
            saving ||
            !customerId ||
            lines.length === 0 ||
            blockedLines.length > 0 ||
            (needsReason && reason.trim().length < 5)
          }
          onClick={save}
        >
          {saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu đơn'}
        </button>
      </div>
    </>
  );
}

/** Lời nhắc ở đầu form sửa đơn: sửa xong thì chuyện gì xảy ra với trạng thái duyệt, công nợ. */
function EditNotice({ order, newTotal }: { order: OrderDetail; newTotal: number }) {
  const delivered = order.delivery_status === 'DA_XUAT_KHO' || order.delivery_status === 'DA_GIAO';
  let text: string;
  if (order.approval_status === 'DRAFT' || order.approval_status === 'REJECTED') {
    text = 'Đơn chưa được duyệt: sửa xong nhớ bấm Gửi duyệt lại.';
  } else if (order.approval_status === 'PENDING_APPROVAL') {
    text =
      'Đơn đang chờ duyệt: sửa xong các yêu cầu duyệt cũ bị huỷ và hệ thống gửi yêu cầu mới theo nội dung mới.';
  } else {
    text =
      'Đơn đã duyệt: sửa xong tiền được tính lại. Nếu có giá lệch chuẩn mới hoặc vượt hạn mức công nợ thì đơn quay về Chờ duyệt, ngược lại vẫn giữ Đã duyệt.';
    if (delivered) text += ' Đơn đã xuất kho nên công nợ chờ ghi sẽ đổi theo số tiền mới.';
  }
  const diff = newTotal - order.total_amount;
  return (
    <div className="alert-box warn" style={{ marginBottom: 16 }}>
      <strong>Đang sửa đơn {order.order_no}.</strong> {text}
      {diff !== 0 && (
        <div style={{ marginTop: 6 }}>
          Tổng phải thu: {formatVnd(order.total_amount)} → <strong>{formatVnd(newTotal)}</strong> (
          {diff > 0 ? '+' : '-'}
          {formatVnd(Math.abs(diff))})
        </div>
      )}
    </div>
  );
}

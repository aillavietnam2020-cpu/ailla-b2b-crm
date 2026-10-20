import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { installTableScrolling } from '../lib/dragScroll';
import { installMobileTables } from '../lib/mobileTables';
import { installRowMenus } from '../lib/rowMenus';
import { initialsOf } from './ui';

interface NavItem {
  to: string;
  label: string;
  short: string;
  mobile?: boolean;
}

const SALES_NAV: NavItem[] = [
  { to: '/sales', label: 'Việc hôm nay', short: 'Hôm nay', mobile: true },
  { to: '/sales/customers', label: 'Khách hàng của tôi', short: 'Khách hàng', mobile: true },
  { to: '/sales/orders', label: 'Đơn hàng', short: 'Đơn hàng', mobile: true },
  { to: '/sales/prices', label: 'Bảng giá 8 cấp', short: 'Bảng giá' },
  { to: '/sales/debts', label: 'Công nợ khách của tôi', short: 'Công nợ' },
  { to: '/sales/bills', label: 'Kho bill giao dịch', short: 'Bill' },
  { to: '/sales/returns', label: 'Hàng trả lại', short: 'Trả hàng' },
  { to: '/sales/shipping-vouchers', label: 'Phiếu chi vận chuyển', short: 'Chi VC' },
  { to: '/sales/performance', label: 'Kết quả cá nhân', short: 'Kết quả', mobile: true },
];

/** Việc hằng ngày. */
const ADMIN_NAV: NavItem[] = [
  { to: '/admin/reports', label: 'Dashboard kinh doanh', short: 'Dashboard', mobile: true },
  { to: '/admin/customers', label: 'Khách hàng', short: 'Khách hàng', mobile: true },
  { to: '/admin/orders', label: 'Đơn hàng & duyệt', short: 'Đơn hàng', mobile: true },
  { to: '/admin/debts', label: 'Công nợ', short: 'Công nợ' },
  { to: '/admin/bills', label: 'Kho bill giao dịch', short: 'Bill' },
  { to: '/admin/returns', label: 'Hàng trả lại', short: 'Trả hàng' },
  { to: '/admin/bonus', label: 'Thưởng & xếp hạng NPP', short: 'Thưởng' },
  { to: '/admin/shipping-vouchers', label: 'Phiếu chi vận chuyển', short: 'Chi VC' },
];

/** Thiết lập: ít khi đụng tới, tách riêng cho khỏi rối màn hình làm việc hằng ngày. */
const ADMIN_SETUP_NAV: NavItem[] = [
  { to: '/admin/prices', label: 'Sản phẩm & bảng giá', short: 'Bảng giá' },
  { to: '/admin/price-adjustments', label: 'Giá điều chỉnh / khuyến mại', short: 'Giá điều chỉnh' },
  { to: '/admin/customer-prices', label: 'Bảng giá khách gia công', short: 'Giá gia công' },
  { to: '/admin/users', label: 'Người dùng & phân quyền', short: 'Tài khoản' },
  { to: '/admin/imports', label: 'Import dữ liệu', short: 'Import' },
  { to: '/admin/audit', label: 'Nhật ký hệ thống', short: 'Audit' },
];

/**
 * Trang quản trị (quantri.*) chỉ có MỘT menu: menu 8 mục trong /hub/. Mở thẳng một đường dẫn CRM (từ thông báo, từ liên kết cũ...)
 * thì chuyển vào đúng trang trong khung đó; trang nào chưa có chỗ trong menu thì hiện nội dung kèm nút quay lại, không dựng menu thứ hai.
 */
const PATH_TO_HUB_PAGE: Record<string, string> = {
  '/admin': 'exec',
  '/admin/reports': 'exec',
  '/admin/ceo': 'exec',
  '/admin/orders': 'cr_dn',
  '/admin/customers': 'cr_kh',
  '/admin/debts': 'cr_cn',
  '/admin/prices': 'cr_gia',
  '/admin/price-adjustments': 'cr_dc',
  '/admin/customer-prices': 'cr_giagc',
  '/admin/bonus': 'cr_thuong',
  '/admin/bonus-policy': 'cr_thuong',
  '/admin/users': 'nhansu',
  '/admin/imports': 'cr_import',
  '/admin/audit': 'cr_audit',
  '/admin/bills': 'cr_bill',
  '/admin/receiving-accounts': 'cr_rcv',
  '/admin/shipping-vouchers': 'cr_vc',
};
/** Trang chi tiết (đơn, khách): mở lại đúng trang đó trong khung của mục tương ứng. */
const DETAIL_PREFIX = ['/admin/orders/', '/admin/customers/'];
const isQuantriHost = () => window.location.hostname.startsWith('quantri.');
/** Đích trong /hub/ cho một đường dẫn CRM, hoặc null nếu chưa có chỗ trong menu. */
function hubHashFor(pathname: string, search: string): string | null {
  const key = PATH_TO_HUB_PAGE[pathname];
  if (key) return `go=${key}`;
  if (DETAIL_PREFIX.some((x) => pathname.startsWith(x))) return `crm=${encodeURIComponent(pathname + search)}`;
  return null;
}

const TITLES: Record<string, string> = {
  '/sales': 'Việc hôm nay',
  '/sales/customers': 'Khách hàng của tôi',
  '/sales/orders': 'Đơn hàng',
  '/sales/orders/new': 'Tạo đơn hàng',
  '/sales/prices': 'Bảng giá 8 cấp',
  '/sales/debts': 'Công nợ khách của tôi',
  '/sales/bills': 'Kho bill giao dịch',
  '/sales/returns': 'Hàng trả lại',
  '/sales/shipping-vouchers': 'Phiếu chi vận chuyển',
  '/sales/performance': 'Kết quả cá nhân',
  '/admin': 'Dashboard kinh doanh',
  '/admin/ceo': 'Dashboard kinh doanh',
  '/admin/customers': 'Danh sách khách hàng',
  '/admin/orders': 'Đơn hàng & duyệt ngoại lệ',
  '/admin/prices': 'Sản phẩm và bảng giá 8 cấp',
  '/admin/customer-prices': 'Bảng giá riêng từng khách',
  '/admin/debts': 'Công nợ toàn công ty',
  '/admin/bills': 'Kho bill giao dịch',
  '/admin/returns': 'Hàng trả lại',
  '/admin/price-adjustments': 'Giá điều chỉnh / khuyến mại',
  '/admin/bonus': 'Thưởng & xếp hạng NPP',
  '/admin/bonus-policy': 'Cơ chế thưởng NPP',
  '/admin/shipping-vouchers': 'Phiếu chi vận chuyển',
  '/admin/reports': 'Dashboard kinh doanh',
  '/admin/users': 'Người dùng và phân quyền',
  '/admin/imports': 'Import & chất lượng dữ liệu',
  '/admin/audit': 'Nhật ký hệ thống',
  '/admin/account': 'Đổi mật khẩu',
  '/sales/account': 'Đổi mật khẩu',
};

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Nhân viên Sale B2B',
  MANAGER: 'Quản lý kinh doanh',
  CEO: 'CEO · Quản trị cao nhất',
};

export function AppShell({ space, children }: { space: 'sales' | 'admin'; children: React.ReactNode }) {
  const { me, logout, devMode } = useAuth();
  const location = useLocation();
  const nav = space === 'admin' ? ADMIN_NAV : SALES_NAV;
  // CEO không nhập liệu vận hành nên ẩn mục chỉ dành cho Quản lý.
  const visibleNav = nav.filter((item) => {
    if (item.to === '/admin/ceo') return me?.user.role === 'CEO';
    if (item.to === '/admin/imports') return me?.user.role === 'MANAGER' || me?.user.role === 'CEO';
    // Sổ phiếu chi vận chuyển: điều phối, kế toán, CEO. Sale thường không thấy.
    if (item.to === '/sales/shipping-vouchers')
      return Boolean(
        me?.permissions.includes('order.accounting.confirm') || me?.permissions.includes('order.approve.normal'),
      );
    return true;
  });
  const title = TITLES[location.pathname] ?? 'AILLA B2B CRM';

  // Kéo chuột và lăn chuột để xem bảng rộng, gắn một lần cho mọi trang.
  React.useEffect(() => installTableScrolling(), []);
  // Điện thoại: dòng bảng hiện thành thẻ (xem lib/mobileTables.ts).
  React.useEffect(() => installMobileTables(), []);
  // Cột thao tác của bảng: nút phụ (Xóa, Khoá...) gom vào nút ⋯.
  React.useEffect(() => installRowMenus(), []);

  // Trong khung Trang quản trị: chỉ hiện nội dung, báo tên trang lên để khung hiển thị đúng tiêu đề.
  const embedded = window.self !== window.top;
  const onQuantri = !embedded && isQuantriHost();
  const hubHash = onQuantri ? hubHashFor(location.pathname, location.search) : null;
  React.useEffect(() => {
    if (hubHash) window.location.replace(`/hub/#${hubHash}`);
  }, [hubHash]);
  if (hubHash) return null;
  if (onQuantri) {
    return (
      <div className="app">
        <main className="main">
          <div className="content" style={{ paddingTop: 14 }}>
            <p style={{ margin: '0 0 12px' }}>
              <a href="/hub/">← Về Trang quản trị</a>
            </p>
            {children}
          </div>
        </main>
      </div>
    );
  }
  if (embedded) {
    return (
      <div className="app">
        <main className="main">
          <div className={TITLES[location.pathname] ? 'content has-title' : 'content'}>{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand-logo">
          <img src="/ailla-logo.png" alt="Ailla" />
        </div>
        <div className="brand">
          <div>
            <strong>Trang quản trị</strong>
            <small>{space === 'admin' ? 'Quản trị B2B · AILLA Việt Nam' : 'Bàn làm việc Sale · AILLA Việt Nam'}</small>
          </div>
        </div>
          <>
            <div className="nav-label">{space === 'admin' ? 'Điều hành' : 'Công việc'}</div>
            <nav className="nav">
              {visibleNav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/sales' || item.to === '/admin'}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </>
        {space === 'admin' && (
          <>
            <div className="nav-label">Thiết lập</div>
            <nav className="nav">
              {ADMIN_SETUP_NAV.filter((item) => {
                if (item.to === '/admin/users') return me?.permissions.includes('user.manage');
                if (item.to === '/admin/imports') return me?.permissions.includes('import.read');
                return true;
              }).map((item) => (
                <NavLink key={item.to} to={item.to}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </>
        )}
        {me?.permissions.includes('hub.access') && (
          <>
            <div className="nav-label">Trang quản trị</div>
            <nav className="nav">
              <a href="/hub/">← Về Trang quản trị</a>
            </nav>
          </>
        )}
        {me?.user.role !== 'EMPLOYEE' && (
          <>
            <div className="nav-label">Chuyển không gian</div>
            <nav className="nav">
              <NavLink to={space === 'admin' ? '/sales' : '/admin'}>
                {space === 'admin' ? 'Xem bàn làm việc Sale' : 'Về khu quản trị'}
              </NavLink>
            </nav>
          </>
        )}
        <div className="sidebar-foot">
          <strong>{me?.user.display_name}</strong>
          <span>{ROLE_LABEL[me?.user.role ?? ''] ?? ''}</span>
        </div>
      </aside>

      <main className="main">
        {me?.environment === 'demo' && (
          <div
            style={{
              background: 'var(--orange-soft)',
              color: 'var(--orange)',
              borderBottom: '1px solid #fedf89',
              padding: '8px 26px',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            BẢN DEMO CÔNG KHAI · đăng nhập không cần mật khẩu, dữ liệu chỉ là dữ liệu mẫu. Không nhập
            thông tin khách hàng thật vào đây.
          </div>
        )}
        <header className="topbar">
          <h1>{title}</h1>
          <div className="top-actions">
            <NavLink className="btn sm" to={`/${space}/account`}>
              Đổi mật khẩu
            </NavLink>
            <button className="btn sm" onClick={() => void logout()}>
              {devMode ? 'Đổi tài khoản' : 'Đăng xuất'}
            </button>
            <div className="avatar">{initialsOf(me?.user.display_name ?? 'AI')}</div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>

      <nav className="mobile-nav">
        {visibleNav
          .filter((item) => item.mobile)
          .map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/sales' || item.to === '/admin'}>
              {item.short}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}

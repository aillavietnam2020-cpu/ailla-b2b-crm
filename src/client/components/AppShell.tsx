import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { installTableScrolling } from '../lib/dragScroll';
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
  { to: '/sales/performance', label: 'Kết quả cá nhân', short: 'Kết quả', mobile: true },
];

/** Việc hằng ngày. */
const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Điều hành đội ngũ', short: 'Điều hành', mobile: true },
  { to: '/admin/ceo', label: 'Bàn điều hành CEO', short: 'CEO' },
  { to: '/admin/reports', label: 'Dashboard kinh doanh', short: 'Dashboard', mobile: true },
  { to: '/admin/customers', label: 'Khách hàng', short: 'Khách hàng', mobile: true },
  { to: '/admin/orders', label: 'Đơn hàng & duyệt', short: 'Đơn hàng', mobile: true },
  { to: '/admin/debts', label: 'Công nợ', short: 'Công nợ' },
];

/** Thiết lập: ít khi đụng tới, tách riêng cho khỏi rối màn hình làm việc hằng ngày. */
const ADMIN_SETUP_NAV: NavItem[] = [
  { to: '/admin/prices', label: 'Sản phẩm & bảng giá', short: 'Bảng giá' },
  { to: '/admin/users', label: 'Người dùng & phân quyền', short: 'Tài khoản' },
  { to: '/admin/imports', label: 'Import dữ liệu', short: 'Import' },
  { to: '/admin/audit', label: 'Nhật ký hệ thống', short: 'Audit' },
];

const TITLES: Record<string, string> = {
  '/sales': 'Việc hôm nay',
  '/sales/customers': 'Khách hàng của tôi',
  '/sales/orders': 'Đơn hàng',
  '/sales/orders/new': 'Tạo đơn hàng',
  '/sales/prices': 'Bảng giá 8 cấp',
  '/sales/debts': 'Công nợ khách của tôi',
  '/sales/performance': 'Kết quả cá nhân',
  '/admin': 'Điều hành đội ngũ',
  '/admin/ceo': 'Bàn điều hành CEO',
  '/admin/customers': 'Khách hàng B2B',
  '/admin/orders': 'Đơn hàng & duyệt ngoại lệ',
  '/admin/prices': 'Sản phẩm và bảng giá 8 cấp',
  '/admin/debts': 'Công nợ toàn công ty',
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
    return true;
  });
  const title = TITLES[location.pathname] ?? 'AILLA B2B CRM';

  // Kéo chuột và lăn chuột để xem bảng rộng, gắn một lần cho mọi trang.
  React.useEffect(() => installTableScrolling(), []);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>AILLA</strong>
            <small>{space === 'admin' ? 'Quản trị B2B' : 'Bàn làm việc Sale'}</small>
          </div>
        </div>
        <div className="nav-label">{space === 'admin' ? 'Điều hành' : 'Công việc'}</div>
        <nav className="nav">
          {visibleNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/sales' || item.to === '/admin'}>
              {item.label}
            </NavLink>
          ))}
        </nav>
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

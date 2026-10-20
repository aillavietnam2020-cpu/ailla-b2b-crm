import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './components/AuthProvider';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { PricesPage } from './pages/PricesPage';
import { CustomerPricesPage } from './pages/admin/CustomerPricesPage';
import { DebtsPage } from './pages/DebtsPage';
import { BillsPage, ReceivingAccountsPage } from './pages/BillsPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { PriceAdjustmentsPage } from './pages/PriceAdjustmentsPage';
import { BonusHubPage } from './pages/BonusPages';
import { ShippingVouchersPage } from './pages/ShippingVouchersPage';
import { OrderDetailPage, OrdersPage } from './pages/OrdersPage';
import { TodayPage } from './pages/sales/TodayPage';
import { NewOrderPage } from './pages/sales/NewOrderPage';
import { PerformancePage } from './pages/sales/PerformancePage';
import { ImportPage } from './pages/admin/ImportPage';
import { AuditPage } from './pages/admin/AuditPage';
import { UsersPage } from './pages/admin/UsersPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { PrintOrderPage } from './pages/PrintOrderPage';
import { PrintStatementPage } from './pages/PrintStatementPage';

/**
 * Hai không gian giao diện dùng chung một backend:
 *   /sales - nhân viên Sale
 *   /admin - Quản lý và CEO
 * Ẩn menu chỉ để UX; quyền thật luôn được kiểm tra lại ở backend.
 */
export function App() {
  const { me, loading, error, mustChangePassword } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading" style={{ paddingTop: 80 }}>Đang kiểm tra tài khoản…</div>;
  if (!me) return <LoginPage error={error} />;
  // Tài khoản vừa được cấp mật khẩu: bắt đổi trước khi vào hệ thống.
  if (mustChangePassword) return <ChangePasswordPage forced />;

  // Ailla Hub (/hub/) là cửa vào chung: ai có quyền thì đăng nhập xong vào thẳng Hub, CRM B2B là một
  // phân hệ bên trong. Tài khoản "chỉ Marketing" chỉ được ở lại CRM để đổi mật khẩu.
  const next = new URLSearchParams(location.search).get('next');
  const hasHub = me.permissions.includes('hub.access');
  const hubOnly = !me.permissions.includes('price.read') && hasHub;
  let justLoggedIn = false;
  try {
    justLoggedIn = sessionStorage.getItem('ailla_just_logged_in') === '1';
    sessionStorage.removeItem('ailla_just_logged_in');
  } catch {
    /* trình duyệt chặn lưu tạm: bỏ qua */
  }
  const goHub =
    hasHub &&
    (justLoggedIn ||
      (next && /^\/hub\/[\w\-./?=&#]*$/.test(next)) ||
      location.pathname === '/' ||
      (hubOnly && !location.pathname.endsWith('/account')));
  if (goHub) {
    // Giữ phần #lo=... của mã QR tem để mở đúng lô sau khi đăng nhập.
    window.location.replace((next && next.startsWith('/hub/') ? next : '/hub/') + window.location.hash);
    return <div className="loading" style={{ paddingTop: 80 }}>Đang mở Trang quản trị…</div>;
  }

  // Trang in phiếu: mở ở tab riêng, không có khung menu.
  if (location.pathname.startsWith('/print/orders/') || location.pathname.startsWith('/print/statement/')) {
    return (
      <Routes>
        <Route path="/print/orders/:id" element={<PrintOrderPage />} />
        <Route path="/print/statement/:id" element={<PrintStatementPage />} />
      </Routes>
    );
  }

  const isAdminSpace = me.user.role === 'MANAGER' || me.user.role === 'CEO';
  const homePath = isAdminSpace ? (me.user.role === 'CEO' ? '/admin/ceo' : '/admin') : '/sales';

  if (location.pathname === '/') return <Navigate to={homePath} replace />;
  if (location.pathname.startsWith('/admin') && !isAdminSpace) {
    // Nhân viên không vào được khu quản trị (AC-01).
    return (
      <AppShell space="sales">
        <div className="alert-box">
          Bạn không có quyền vào khu quản trị. Toàn bộ dữ liệu admin cũng bị chặn ở backend.
        </div>
      </AppShell>
    );
  }

  const space: 'sales' | 'admin' = location.pathname.startsWith('/admin') ? 'admin' : 'sales';

  return (
    <AppShell space={space}>
      <Routes>
        <Route path="/sales" element={<TodayPage />} />
        <Route path="/sales/customers" element={<CustomersPage mode="sales" />} />
        <Route path="/sales/customers/:id" element={<CustomerDetailPage mode="sales" />} />
        <Route path="/sales/orders" element={<OrdersPage mode="sales" />} />
        <Route path="/sales/orders/new" element={<NewOrderPage mode="sales" />} />
        <Route path="/sales/orders/:id" element={<OrderDetailPage mode="sales" />} />
        <Route path="/sales/orders/:id/edit" element={<NewOrderPage mode="sales" />} />
        <Route path="/sales/prices" element={<PricesPage />} />
        <Route path="/sales/debts" element={<DebtsPage mode="sales" />} />
        <Route path="/sales/bills" element={<BillsPage />} />
        <Route path="/sales/returns" element={<ReturnsPage />} />
        <Route path="/sales/shipping-vouchers" element={<ShippingVouchersPage />} />
        <Route path="/sales/performance" element={<PerformancePage />} />

        <Route path="/admin" element={<DashboardPage initial="doingu" />} />
        <Route path="/admin/ceo" element={<DashboardPage initial="ceo" />} />
        <Route path="/admin/customers" element={<CustomersPage mode="admin" />} />
        <Route path="/admin/customers/:id" element={<CustomerDetailPage mode="admin" />} />
        <Route path="/admin/orders" element={<OrdersPage mode="admin" />} />
        <Route path="/admin/orders/:id" element={<OrderDetailPage mode="admin" />} />
        <Route path="/admin/orders/:id/edit" element={<NewOrderPage mode="admin" />} />
        <Route path="/admin/customer-prices" element={<CustomerPricesPage />} />
        <Route path="/admin/prices" element={<PricesPage />} />
        <Route path="/admin/receiving-accounts" element={<ReceivingAccountsPage />} />
        <Route path="/admin/debts" element={<DebtsPage mode="admin" />} />
        <Route path="/admin/bills" element={<BillsPage />} />
        <Route path="/admin/returns" element={<ReturnsPage />} />
        <Route path="/admin/price-adjustments" element={<PriceAdjustmentsPage />} />
        <Route path="/admin/bonus" element={<BonusHubPage />} />
        <Route path="/admin/bonus-policy" element={<BonusHubPage initial="policy" />} />
        <Route path="/admin/shipping-vouchers" element={<ShippingVouchersPage />} />
        <Route path="/admin/reports" element={<DashboardPage initial="tong" />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/imports" element={<ImportPage />} />
        <Route path="/admin/audit" element={<AuditPage />} />
        <Route path="/admin/account" element={<ChangePasswordPage />} />
        <Route path="/sales/account" element={<ChangePasswordPage />} />

        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Routes>
    </AppShell>
  );
}

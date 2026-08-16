import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './components/AuthProvider';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { PricesPage } from './pages/PricesPage';
import { DebtsPage } from './pages/DebtsPage';
import { OrderDetailPage, OrdersPage } from './pages/OrdersPage';
import { TodayPage } from './pages/sales/TodayPage';
import { NewOrderPage } from './pages/sales/NewOrderPage';
import { PerformancePage } from './pages/sales/PerformancePage';
import { ManagerDashboardPage } from './pages/admin/ManagerDashboardPage';
import { CeoDashboardPage } from './pages/admin/CeoDashboardPage';
import { ImportPage } from './pages/admin/ImportPage';
import { AuditPage } from './pages/admin/AuditPage';
import { UsersPage } from './pages/admin/UsersPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';

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
        <Route path="/sales/orders/new" element={<NewOrderPage />} />
        <Route path="/sales/orders/:id" element={<OrderDetailPage mode="sales" />} />
        <Route path="/sales/prices" element={<PricesPage />} />
        <Route path="/sales/debts" element={<DebtsPage mode="sales" />} />
        <Route path="/sales/performance" element={<PerformancePage />} />

        <Route path="/admin" element={<ManagerDashboardPage />} />
        <Route path="/admin/ceo" element={<CeoDashboardPage />} />
        <Route path="/admin/customers" element={<CustomersPage mode="admin" />} />
        <Route path="/admin/customers/:id" element={<CustomerDetailPage mode="admin" />} />
        <Route path="/admin/orders" element={<OrdersPage mode="admin" />} />
        <Route path="/admin/orders/:id" element={<OrderDetailPage mode="admin" />} />
        <Route path="/admin/prices" element={<PricesPage />} />
        <Route path="/admin/debts" element={<DebtsPage mode="admin" />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
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

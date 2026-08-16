import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { ApiError, api } from '../lib/api';

const DEV_SUGGESTIONS = [
  { email: 'thao@ailla.vn', label: 'Thảo · Nhân viên Sale' },
  { email: 'huyen@ailla.vn', label: 'Huyền · Nhân viên Sale' },
  { email: 'quanly@ailla.vn', label: 'Quản lý kinh doanh' },
  { email: 'ceo@ailla.vn', label: 'CEO' },
];

/**
 * Đăng nhập bằng email + mật khẩu.
 * Trên máy lập trình còn có nút chọn nhanh tài khoản mẫu để khỏi phải nhớ mật khẩu.
 */
export function LoginPage({ error }: { error: string | null }) {
  const { login, signInDev } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showDevShortcuts, setShowDevShortcuts] = useState(false);

  // /api/health không cần đăng nhập, dùng để biết đang chạy ở máy lập trình hay trên mạng.
  useEffect(() => {
    api
      .get<{ status: string; environment: string }>('/api/health')
      .then((r) => setShowDevShortcuts(r.data.environment === 'development'))
      .catch(() => setShowDevShortcuts(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Không đăng nhập được, thử lại giúp tôi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1>AILLA B2B CRM</h1>
        <p className="muted">Hệ thống nội bộ. Đăng nhập bằng tài khoản công ty cấp.</p>

        {(formError || error) && (
          <div className="alert-box" style={{ margin: '14px 0' }}>
            {formError ?? error}
          </div>
        )}

        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ten@ailla.vn"
            required
          />
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="login-password">Mật khẩu</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="btn primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
          disabled={busy || !email || !password}
        >
          {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
        </button>

        <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
          Quên mật khẩu thì báo Quản lý hoặc CEO đặt lại giúp trong mục Người dùng.
        </p>

        {showDevShortcuts && (
          <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div className="muted" style={{ marginBottom: 8, fontWeight: 700, fontSize: 12 }}>
              MÁY LẬP TRÌNH · VÀO NHANH KHÔNG CẦN MẬT KHẨU
            </div>
            {DEV_SUGGESTIONS.map((item) => (
              <button
                key={item.email}
                type="button"
                className="btn"
                style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}
                onClick={() => signInDev(item.email)}
              >
                <span>{item.label}</span>
                <span className="muted">{item.email}</span>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}

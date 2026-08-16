import { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { ApiError, api } from '../lib/api';

/**
 * Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên (hoặc sau khi được cấp lại).
 * Đổi xong, mọi phiên cũ bị thu hồi nên phải đăng nhập lại.
 */
export function ChangePasswordPage({ forced }: { forced?: boolean }) {
  const { logout, me } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError('Hai ô mật khẩu mới chưa giống nhau');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/change-password', { current_password: current, new_password: next });
      setDone(true);
      setTimeout(() => void logout(), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đổi được mật khẩu');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>Đã đổi mật khẩu</h1>
          <p className="muted">Đang đưa chị về màn hình đăng nhập để vào lại bằng mật khẩu mới…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1>Đổi mật khẩu</h1>
        <p className="muted">
          {forced
            ? `Tài khoản ${me?.user.email} đang dùng mật khẩu do quản trị cấp. Đặt mật khẩu riêng trước khi dùng hệ thống.`
            : 'Đặt mật khẩu mới cho tài khoản của bạn.'}
        </p>

        {error && (
          <div className="alert-box" style={{ margin: '14px 0' }}>
            {error}
          </div>
        )}

        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="cp-current">Mật khẩu hiện tại</label>
          <input
            id="cp-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="cp-next">Mật khẩu mới</label>
          <input
            id="cp-next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
          <span className="muted" style={{ fontSize: 12 }}>
            Tối thiểu 8 ký tự, có cả chữ và số.
          </span>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="cp-confirm">Nhập lại mật khẩu mới</label>
          <input
            id="cp-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="btn primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
          disabled={busy}
        >
          {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </button>

        <button
          type="button"
          className="btn"
          style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
          onClick={() => void logout()}
        >
          Đăng xuất
        </button>
      </form>
    </div>
  );
}

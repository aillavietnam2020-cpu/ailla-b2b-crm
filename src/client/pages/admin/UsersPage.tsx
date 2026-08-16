import { useEffect, useState } from 'react';
import { formatVnDateTime } from '@shared/datetime';
import { useAuth } from '../../components/AuthProvider';
import { Card, EmptyState, ErrorBox, Loading, Modal, PageHead } from '../../components/ui';
import { ApiError, api } from '../../lib/api';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'CEO';
  status: 'ACTIVE' | 'DISABLED';
  legacy_name: string | null;
  phone: string | null;
  last_login_at: string | null;
  password_updated_at: string | null;
  must_change_password: number;
  has_password: number;
}

const ROLE_LABELS: Record<UserRow['role'], string> = {
  EMPLOYEE: 'Nhân viên Sale',
  MANAGER: 'Quản lý',
  CEO: 'CEO',
};

/**
 * Cấp tài khoản cho nhân sự: tạo mới, đặt lại mật khẩu, khoá/mở khoá.
 * Mật khẩu do người cấp tự gõ tại đây và người nhận phải đổi ở lần đăng nhập đầu.
 */
export function UsersPage() {
  const { me } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [passwordFor, setPasswordFor] = useState<UserRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isCeo = me?.user.role === 'CEO';

  function load() {
    setLoading(true);
    api
      .get<UserRow[]>('/api/admin/users')
      .then((r) => {
        setRows(r.data);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được danh sách'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleStatus(user: UserRow) {
    const next = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    if (
      next === 'DISABLED' &&
      !confirm(`Khoá tài khoản ${user.display_name}? Người này sẽ bị đăng xuất ngay lập tức.`)
    ) {
      return;
    }
    try {
      await api.patch(`/api/admin/users/${user.id}`, { status: next });
      setNotice(next === 'DISABLED' ? 'Đã khoá tài khoản' : 'Đã mở khoá tài khoản');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đổi được trạng thái');
    }
  }

  return (
    <div>
      <PageHead
        title="Người dùng"
        subtitle="Cấp tài khoản cho nhân sự, đặt lại mật khẩu và khoá tài khoản khi nghỉ việc."
        actions={
          <button className="btn primary" onClick={() => setCreating(true)}>
            Thêm tài khoản
          </button>
        }
      />

      {notice && (
        <div className="alert-box success" style={{ marginBottom: 14 }}>
          {notice}
        </div>
      )}
      <ErrorBox message={error} />

      <Card>
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState message="Chưa có tài khoản nào." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Vai trò</th>
                  <th>Tên trong file Excel</th>
                  <th>Lần đăng nhập gần nhất</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.display_name}</strong>
                      <div className="muted">{user.email}</div>
                    </td>
                    <td>{ROLE_LABELS[user.role]}</td>
                    <td>{user.legacy_name ?? <span className="muted">—</span>}</td>
                    <td>
                      {user.last_login_at ? (
                        formatVnDateTime(user.last_login_at)
                      ) : (
                        <span className="muted">Chưa đăng nhập</span>
                      )}
                    </td>
                    <td>
                      {user.status === 'ACTIVE' ? (
                        <span className="badge won">Đang dùng</span>
                      ) : (
                        <span className="badge overdue">Đã khoá</span>
                      )}
                      {user.must_change_password === 1 && user.has_password === 1 && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          Phải đổi mật khẩu khi vào
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn" onClick={() => setPasswordFor(user)}>
                          Đặt mật khẩu
                        </button>
                        {(isCeo || user.role === 'EMPLOYEE') && user.id !== me?.user.id && (
                          <button className="btn" onClick={() => void toggleStatus(user)}>
                            {user.status === 'ACTIVE' ? 'Khoá' : 'Mở khoá'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <CreateUserModal
          canPickRole={Boolean(isCeo)}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            setNotice('Đã tạo tài khoản. Báo mật khẩu cho nhân sự và nhắc họ đổi lại khi đăng nhập.');
            load();
          }}
        />
      )}

      {passwordFor && (
        <SetPasswordModal
          user={passwordFor}
          onClose={() => setPasswordFor(null)}
          onDone={() => {
            setPasswordFor(null);
            setNotice('Đã đặt mật khẩu mới. Người dùng sẽ phải đổi lại khi đăng nhập.');
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  canPickRole,
  onClose,
  onDone,
}: {
  canPickRole: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    email: '',
    display_name: '',
    role: 'EMPLOYEE' as UserRow['role'],
    legacy_name: '',
    phone: '',
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.post('/api/admin/users', {
        ...form,
        legacy_name: form.legacy_name || null,
        phone: form.phone || null,
      });
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else setError('Không tạo được tài khoản');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Thêm tài khoản" onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        <div className="form-grid">
          <div className="field">
            <label>Họ tên *</label>
            <input
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              required
            />
            {fields.display_name && <span className="error">{fields.display_name}</span>}
          </div>
          <div className="field">
            <label>Email đăng nhập *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            {fields.email && <span className="error">{fields.email}</span>}
          </div>
          <div className="field">
            <label>Vai trò</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRow['role'] })}
              disabled={!canPickRole}
            >
              <option value="EMPLOYEE">Nhân viên Sale</option>
              <option value="MANAGER">Quản lý</option>
              <option value="CEO">CEO</option>
            </select>
            {!canPickRole && <span className="muted">Chỉ CEO được tạo tài khoản Quản lý/CEO.</span>}
          </div>
          <div className="field">
            <label>Tên trong file Excel cũ</label>
            <input
              value={form.legacy_name}
              onChange={(e) => setForm({ ...form, legacy_name: e.target.value })}
              placeholder="Thảo / Huyền"
            />
            <span className="muted" style={{ fontSize: 12 }}>
              Điền đúng tên trong cột phụ trách để import gán khách về đúng người.
            </span>
          </div>
          <div className="field">
            <label>Số điện thoại</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="field">
            <label>Mật khẩu ban đầu *</label>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            {fields.password && <span className="error">{fields.password}</span>}
            <span className="muted" style={{ fontSize: 12 }}>
              Tối thiểu 8 ký tự, có chữ và số. Người nhận phải đổi khi đăng nhập lần đầu.
            </span>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Đang tạo…' : 'Tạo tài khoản'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SetPasswordModal({
  user,
  onClose,
  onDone,
}: {
  user: UserRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/admin/users/${user.id}/set-password`, { password });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đặt được mật khẩu');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Đặt mật khẩu · ${user.display_name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        <p className="muted">
          Mật khẩu mới sẽ có hiệu lực ngay, mọi thiết bị đang đăng nhập của người này bị đăng xuất.
          Đọc mật khẩu trực tiếp cho nhân sự, đừng gửi qua nhóm chat chung.
        </p>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Mật khẩu mới *</label>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Đặt mật khẩu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

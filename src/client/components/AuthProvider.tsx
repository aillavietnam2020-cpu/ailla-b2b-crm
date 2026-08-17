import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { MeResponse } from '@shared/types';
import type { Permission } from '@shared/permissions';
import { ApiError, api, apiFetch, getDevEmail, setDevEmail } from '../lib/api';

interface AuthState {
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  /** Máy lập trình: cho phép chọn nhanh tài khoản mẫu, không cần mật khẩu. */
  devMode: boolean;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInDev: (email: string) => void;
  reload: () => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthState>({
  me: null,
  loading: true,
  error: null,
  devMode: false,
  mustChangePassword: false,
  login: async () => {},
  logout: async () => {},
  signInDev: () => {},
  reload: () => {},
  can: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devEmail, setDevEmailState] = useState<string | null>(getDevEmail());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<MeResponse>('/api/me')
      .then((result) => {
        if (cancelled) return;
        setMe(result.data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMe(null);
        // Chưa đăng nhập là trạng thái bình thường của màn hình đăng nhập, không phải lỗi.
        const notSignedIn = err instanceof ApiError && (err.status === 401 || err.status === 403);
        setError(notSignedIn && !devEmail ? null : err instanceof ApiError ? err.message : 'Không kết nối được máy chủ');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [devEmail, tick]);

  // Phien het han o bat ky man hinh nao -> quay ve man hinh dang nhap.
  useEffect(() => {
    const onUnauthorized = () => setMe(null);
    window.addEventListener('ailla:unauthorized', onUnauthorized);
    return () => window.removeEventListener('ailla:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.post('/api/auth/login', { email, password });
    setDevEmail(null);
    setDevEmailState(null);
    setTick((t) => t + 1);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Kể cả khi máy chủ báo lỗi, vẫn xoá trạng thái phía trình duyệt.
    }
    setDevEmail(null);
    setDevEmailState(null);
    setMe(null);
    setTick((t) => t + 1);
  }, []);

  const value: AuthState = {
    me,
    loading,
    error,
    devMode: me?.environment === 'development',
    mustChangePassword: Boolean(me?.user.must_change_password),
    login,
    logout,
    signInDev: (email: string) => {
      setDevEmail(email);
      setDevEmailState(email);
    },
    reload: () => setTick((t) => t + 1),
    can: (permission) => Boolean(me?.permissions.includes(permission)),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

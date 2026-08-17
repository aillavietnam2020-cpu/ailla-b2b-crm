import type { Role } from '@shared/enums';
import type { DataScope } from '@shared/permissions';

export interface Env {
  DB: D1Database;
  FILES?: R2Bucket;
  ASSETS?: Fetcher;
  ENVIRONMENT: string;
  DEV_AUTH_ENABLED?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  APP_TIMEZONE?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  status: string;
  /** 1 = bắt buộc đổi mật khẩu ở lần đăng nhập tới (tài khoản mới hoặc vừa được cấp lại). */
  must_change_password?: number;
}

export interface AuthContext {
  user: AuthUser;
  scope: DataScope;
  /** Quyền theo vai trò + quyền cấp thêm cho riêng tài khoản (ví dụ gói Kế toán). */
  permissions: string[];
}

export interface AppVariables {
  auth: AuthContext;
  requestId: string;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };

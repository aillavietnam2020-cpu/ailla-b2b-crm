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
  /** Trợ lý AI khu Marketing: 9router trên VPS. AI_API_KEY đặt bằng `wrangler secret put`. */
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  /** Khoá riêng cho Worker dựng video (máy văn phòng) gọi /api/worker/*. Đặt bằng `wrangler secret put`. */
  WORKER_KEY?: string;
  /** Khoá riêng cho cầu nối trên VPS (nhắn agent ngay trên web) gọi /api/agent-relay. Đặt bằng `wrangler secret put`. */
  AGENT_RELAY_KEY?: string;
  /** Khoá riêng cho agent Fanpage (OpenClaw trên VPS) gọi /api/fp/*, chỉ thấy việc fp_*. */
  FP_KEY?: string;
  /** Tự cập nhật danh sách email được vào qt.ailla.vn (Cloudflare Access). CF_ACCESS_TOKEN là secret. */
  CF_ACCOUNT_ID?: string;
  ACCESS_APP_ID?: string;
  ACCESS_POLICY_ID?: string;
  CF_ACCESS_TOKEN?: string;
  /** Khoá cho máy văn phòng tải bản sao lưu mỗi đêm (/api/backup). */
  BACKUP_KEY?: string;
  /** Khoá VPS đẩy số liệu (file báo cáo Digital) lên /api/ingest. */
  INGEST_KEY?: string;
  /** Địa chỉ trang vận hành (qt.ailla.vn) và trang quản trị (quantri.ailla.vn). Trống thì không tách. */
  OPS_HOST?: string;
  ADMIN_HOST?: string;
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
  /** USER = người dùng; AGENT = AI agent vào bằng khóa riêng. */
  actorType?: 'USER' | 'AGENT';
}

export interface AppVariables {
  auth: AuthContext;
  requestId: string;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };

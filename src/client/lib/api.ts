import type { ApiErrorBody, ApiEnvelope } from '@shared/types';

const DEV_EMAIL_KEY = 'ailla_dev_email';

/** Chỉ dùng ở local dev: chọn tài khoản giả lập thay cho Cloudflare Access. */
export function getDevEmail(): string | null {
  return localStorage.getItem(DEV_EMAIL_KEY);
}
export function setDevEmail(email: string | null): void {
  if (email) localStorage.setItem(DEV_EMAIL_KEY, email);
  else localStorage.removeItem(DEV_EMAIL_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  formData?: FormData;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<{
  data: T;
  meta?: Record<string, unknown>;
}> {
  const headers: Record<string, string> = {};
  const devEmail = getDevEmail();
  if (devEmail) headers['X-Dev-Email'] = devEmail;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(path, {
    method: options.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
    signal: options.signal,
    // Gửi kèm cookie phiên đăng nhập.
    credentials: 'same-origin',
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    // Phien dang nhap het han: bao cho ca ung dung biet de quay ve man hinh dang nhap,
    // thay vi de tung o hien "Chua dang nhap".
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new CustomEvent('ailla:unauthorized'));
    }
    const err = payload as ApiErrorBody;
    throw new ApiError(
      response.status,
      err.error?.code ?? 'UNKNOWN',
      err.error?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.',
      err.error?.fields,
      err.request_id,
    );
  }

  const envelope = payload as ApiEnvelope<T>;
  return { data: envelope.data, meta: envelope.meta };
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    apiFetch<T>(path, { method: 'POST', body, idempotencyKey }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  upload: <T>(path: string, formData: FormData) => apiFetch<T>(path, { method: 'POST', formData }),
};

/** Khoá chống bấm hai lần cho mỗi lần mở form (mục 6.1). */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

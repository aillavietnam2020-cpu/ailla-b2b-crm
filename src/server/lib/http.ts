import type { Context } from 'hono';
import type { AppEnv } from '../env';

/** Lỗi nghiệp vụ có mã ổn định để frontend hiển thị đúng thông báo tiếng Việt. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, fields?: Record<string, string>) =>
  new AppError(400, code, message, fields);
export const unauthorized = (message = 'Chưa đăng nhập hoặc phiên đã hết hạn') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Bạn không có quyền thực hiện thao tác này') =>
  new AppError(403, 'FORBIDDEN', message);
/** Dùng khi che giấu sự tồn tại của hồ sơ ngoài phạm vi dữ liệu (mục 4.1). */
export const notFound = (message = 'Không tìm thấy dữ liệu') =>
  new AppError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const unprocessable = (code: string, message: string, fields?: Record<string, string>) =>
  new AppError(422, code, message, fields);

export function ok<T>(c: Context<AppEnv>, data: T, meta?: Record<string, unknown>, status = 200) {
  return c.json({ data, meta, request_id: c.get('requestId') }, status as never);
}

export function created<T>(c: Context<AppEnv>, data: T, meta?: Record<string, unknown>) {
  return ok(c, data, meta, 201);
}

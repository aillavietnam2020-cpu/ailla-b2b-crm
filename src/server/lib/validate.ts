import type { z } from 'zod';
import { zodFieldErrors } from '@shared/schemas';
import { badRequest } from './http';

/** Validate body/query ở backend. Không bao giờ tin dữ liệu client gửi lên (mục 11.1). */
export function parseInput<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(
      'VALIDATION_ERROR',
      'Dữ liệu chưa hợp lệ, vui lòng kiểm tra các trường được đánh dấu.',
      zodFieldErrors(result.error),
    );
  }
  return result.data;
}

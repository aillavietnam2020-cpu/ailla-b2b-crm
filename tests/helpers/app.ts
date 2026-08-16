import { createApp } from '@server/app';
import type { Env } from '@server/env';
import { createTestDb, type TestD1 } from './d1';

export const USERS = {
  thao: 'thao@ailla.vn',
  huyen: 'huyen@ailla.vn',
  manager: 'quanly@ailla.vn',
  ceo: 'ceo@ailla.vn',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Thân phản hồi trong test là JSON tuỳ ý nên dùng kiểu lỏng cho tiện assert. */
export interface TestResponseBody {
  data: any;
  meta?: any;
  error?: any;
  request_id: string;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface TestContext {
  db: TestD1;
  env: Env;
  request: (
    path: string,
    options?: {
      method?: string;
      body?: unknown;
      as?: string;
      idempotencyKey?: string;
      formData?: FormData;
      /** Cookie phiên đăng nhập (test đăng nhập bằng mật khẩu). */
      cookie?: string;
    },
  ) => Promise<{ status: number; body: TestResponseBody; setCookie: string | null }>;
}

const NOW = '2026-08-16T01:00:00.000Z';

/** Người dùng dev cố định để test phân quyền (giống seed dev, đã ẩn danh). */
export async function seedUsers(db: TestD1): Promise<void> {
  const rows: Array<[string, string, string, string, string | null]> = [
    ['user-thao', USERS.thao, 'Nguyễn Thu Thảo (test)', 'EMPLOYEE', 'Thảo'],
    ['user-huyen', USERS.huyen, 'Trần Thanh Huyền (test)', 'EMPLOYEE', 'Huyền'],
    ['user-manager', USERS.manager, 'Quản lý kinh doanh (test)', 'MANAGER', null],
    ['user-ceo', USERS.ceo, 'CEO (test)', 'CEO', null],
  ];
  for (const [id, email, name, role, legacy] of rows) {
    await db
      .prepare(
        `INSERT INTO users (id, email, display_name, role, status, legacy_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      )
      .bind(id, email, name, role, legacy, NOW, NOW)
      .run();
  }
}

export function createTestContext(): TestContext {
  const db = createTestDb();
  const env = {
    DB: db as unknown as D1Database,
    ENVIRONMENT: 'development',
    DEV_AUTH_ENABLED: 'true',
    APP_TIMEZONE: 'Asia/Ho_Chi_Minh',
  } as Env;

  const app = createApp();

  const request: TestContext['request'] = async (path, options = {}) => {
    const headers: Record<string, string> = {};
    if (options.as) headers['X-Dev-Email'] = options.as;
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    if (options.cookie) headers['Cookie'] = options.cookie;

    let body: BodyInit | undefined;
    if (options.formData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    const response = await app.fetch(
      new Request(`http://localhost${path}`, {
        method: options.method ?? (body ? 'POST' : 'GET'),
        headers,
        body,
      }),
      env,
      { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
    );

    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
      setCookie: response.headers.get('Set-Cookie'),
    };
  };

  return { db, env, request };
}

/** Bộ dữ liệu tối thiểu: 1 sản phẩm đủ giá, 1 sản phẩm thiếu giá bán lẻ, 3 khách. */
export async function seedBusinessData(db: TestD1): Promise<void> {
  await db
    .prepare(
      `INSERT INTO products (id, sku, name, unit, active, created_at, updated_at)
       VALUES ('prod-full', 'TEST-FULL', 'Nước giặt test 5L', 'Can', 1, ?, ?)`,
    )
    .bind(NOW, NOW)
    .run();
  await db
    .prepare(
      `INSERT INTO products (id, sku, name, unit, active, created_at, updated_at)
       VALUES ('prod-missing', 'TEST-MISSING', 'Tẩy toilet test 500ml', 'Chai', 1, ?, ?)`,
    )
    .bind(NOW, NOW)
    .run();

  const tiers = ['tier-gdkd', 'tier-tpp', 'tier-npp', 'tier-tongdl', 'tier-dlc1', 'tier-dlc2', 'tier-daisu', 'tier-banle'];
  let index = 0;
  for (const tier of tiers) {
    index += 1;
    await db
      .prepare(
        `INSERT INTO product_prices (id, product_id, tier_id, amount, valid_from, version, status, created_at, updated_at)
         VALUES (?, 'prod-full', ?, ?, '2026-01-01', 1, 'ACTIVE', ?, ?)`,
      )
      .bind(`pp-full-${index}`, tier, 100000 + index * 5000, NOW, NOW)
      .run();
  }
  // prod-missing: chỉ có giá ở cấp Đại lý cấp 1, các cấp khác NULL
  await db
    .prepare(
      `INSERT INTO product_prices (id, product_id, tier_id, amount, valid_from, version, status, created_at, updated_at)
       VALUES ('pp-missing-1', 'prod-missing', 'tier-dlc1', 35000, '2026-01-01', 1, 'ACTIVE', ?, ?)`,
    )
    .bind(NOW, NOW)
    .run();
  await db
    .prepare(
      `INSERT INTO product_prices (id, product_id, tier_id, amount, valid_from, version, status, created_at, updated_at)
       VALUES ('pp-missing-2', 'prod-missing', 'tier-banle', NULL, '2026-01-01', 1, 'ACTIVE', ?, ?)`,
    )
    .bind(NOW, NOW)
    .run();

  const customers: Array<[string, string, string, string | null, string | null, number]> = [
    ['cus-thao-1', 'Cửa hàng Test A', 'user-thao', 'tier-dlc1', null, 0],
    ['cus-thao-2', 'Cửa hàng Test B', 'user-thao', 'tier-dlc1', null, 4_900_000],
    ['cus-huyen-1', 'Cửa hàng Test C', 'user-huyen', 'tier-npp', null, 0],
    ['cus-no-tier', 'Cửa hàng Test D', 'user-thao', null, 'Khác', 0],
  ];
  for (const [id, name, owner, tier, legacyTier, opening] of customers) {
    await db
      .prepare(
        `INSERT INTO customers (id, legacy_code, name, phone_text, phone_normalized, province, tier_id,
           legacy_tier_label, owner_id, stage, next_follow_up_at, opening_debt, data_quality, created_at, updated_at)
         VALUES (?, ?, ?, '0900000000', ?, 'Hà Nội', ?, ?, ?, 'NEGOTIATING', '2026-08-16', ?, 'OK', ?, ?)`,
      )
      .bind(id, id, name, id, tier, legacyTier, owner, opening, NOW, NOW)
      .run();
  }
}

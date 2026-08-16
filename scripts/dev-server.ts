/**
 * Dev server dự phòng: chạy đúng code Worker trên Node + SQLite.
 *
 * Dùng khi `wrangler dev` không khởi động được trên máy (workerd lỗi trên một số bản Windows).
 *   npm run dev:node        -> API tại http://127.0.0.1:8787
 *   npm run dev             -> giao diện tại http://127.0.0.1:5173 (đã proxy /api sang 8787)
 *
 * Dữ liệu nằm trong file .dev-data/crm.sqlite, nạp sẵn seed dev đã ẩn danh.
 * KHÔNG dùng cho staging/production - production luôn chạy trên Cloudflare Workers + D1.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/server/app';
import type { Env } from '../src/server/env';
import { createSqliteD1 } from './lib/sqlite-d1';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, '.dev-data');
const DB_FILE = path.join(DATA_DIR, 'crm.sqlite');
const PORT = Number(process.env.PORT ?? 8787);
const fresh = process.argv.includes('--fresh');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (fresh && existsSync(DB_FILE)) rmSync(DB_FILE);

const isNew = !existsSync(DB_FILE);
const db = createSqliteD1({
  file: DB_FILE,
  // Chỉ nạp seed khi tạo mới database để không ghi đè dữ liệu đang thử nghiệm.
  extraSqlFiles: isNew ? ['seed/dev_seed.sql'] : [],
});

const env = {
  DB: db as unknown as D1Database,
  ENVIRONMENT: 'development',
  DEV_AUTH_ENABLED: 'true',
  APP_TIMEZONE: 'Asia/Ho_Chi_Minh',
} as Env;

const app = createApp();

const server = createServer(async (req, res) => {
  const url = `http://127.0.0.1:${PORT}${req.url ?? '/'}`;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const request = new Request(url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });

  try {
    const response = await app.fetch(request, env, {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as unknown as ExecutionContext);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    console.error('[dev-server]', error);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi dev server' } }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.info(`[dev-server] API chạy tại http://127.0.0.1:${PORT}`);
  console.info(`[dev-server] Database: ${DB_FILE}${isNew ? ' (mới tạo, đã nạp seed dev)' : ''}`);
  console.info('[dev-server] Đăng nhập thử bằng header X-Dev-Email: thao@ailla.vn | quanly@ailla.vn | ceo@ailla.vn');
});

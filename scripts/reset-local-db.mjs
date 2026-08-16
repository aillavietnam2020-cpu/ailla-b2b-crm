#!/usr/bin/env node
/**
 * Reset database LOCAL (chỉ dùng cho máy lập trình).
 * KHÔNG có đường dẫn nào gọi script này từ giao diện production.
 */
import { execSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';

if (process.env.CI) {
  console.error('Không chạy reset trên CI.');
  process.exit(1);
}

const stateDir = '.wrangler/state';
if (existsSync(stateDir)) {
  rmSync(stateDir, { recursive: true, force: true });
  console.info('Đã xoá state D1 local.');
}

execSync('npx wrangler d1 migrations apply ailla_crm_dev --local', { stdio: 'inherit' });
execSync('npx wrangler d1 execute ailla_crm_dev --local --file=./seed/dev_seed.sql', { stdio: 'inherit' });
console.info('Đã tạo lại database local và nạp dữ liệu dev.');

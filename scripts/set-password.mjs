#!/usr/bin/env node
/**
 * Đặt mật khẩu cho một tài khoản CRM trên Cloudflare D1.
 *
 * Mật khẩu được gõ trực tiếp trên máy bạn, băm ngay tại chỗ bằng PBKDF2 rồi mới gửi lên
 * database. Mật khẩu gốc KHÔNG được ghi ra màn hình, không lưu file, không gửi đi đâu khác.
 *
 * Cách dùng:
 *   node scripts/set-password.mjs --env production --email ten@congty.com
 *   node scripts/set-password.mjs --env demo --email thao@ailla.vn
 */
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Phải trùng giới hạn Web Crypto trên Cloudflare Workers.
const ITERATIONS = 100_000;

const DATABASES = {
  production: 'ailla_crm_prod',
  staging: 'ailla_crm_staging',
  demo: 'ailla_crm_demo',
  dev: 'ailla_crm_dev',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { env: 'production', email: null, mustChange: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--env') out.env = args[++i];
    else if (args[i] === '--email') out.email = args[++i];
    else if (args[i] === '--must-change') out.mustChange = true;
  }
  return out;
}

/** Đọc mật khẩu mà không hiện ký tự lên màn hình. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (char) => {
      const c = char.toString();
      if (c === '\n' || c === '\r' || c === '') {
        process.stdin.removeListener('data', onData);
      } else {
        process.stdout.write('[2K[200D' + question + '*'.repeat(rl.line.length));
      }
    };
    process.stdout.write(question);
    process.stdin.on('data', onData);
    rl.question('', (value) => {
      rl.close();
      process.stdout.write('\n');
      resolve(value);
    });
  });
}

function checkStrength(password) {
  if (password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự';
  if (!/[a-zA-Z]/.test(password)) return 'Mật khẩu phải có ít nhất một chữ cái';
  if (!/\d/.test(password)) return 'Mật khẩu phải có ít nhất một chữ số';
  return null;
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password.normalize('NFKC'), salt, ITERATIONS, 32, 'sha256');
  return `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function main() {
  const { env, email, mustChange } = parseArgs();
  const database = DATABASES[env];

  if (!database) {
    console.error(`Môi trường không hợp lệ: ${env}. Chọn một trong: ${Object.keys(DATABASES).join(', ')}`);
    process.exit(1);
  }
  if (!email) {
    console.error('Thiếu --email. Ví dụ: node scripts/set-password.mjs --env production --email ten@congty.com');
    process.exit(1);
  }

  console.info(`\nĐặt mật khẩu cho ${email} trên database ${database} (${env}).`);
  console.info('Mật khẩu sẽ không hiện lên màn hình.\n');

  const password = await askHidden('Mật khẩu mới: ');
  const confirm = await askHidden('Nhập lại mật khẩu: ');

  if (password !== confirm) {
    console.error('\nHai lần nhập không giống nhau. Chưa thay đổi gì cả.');
    process.exit(1);
  }
  const weak = checkStrength(password);
  if (weak) {
    console.error(`\n${weak}. Chưa thay đổi gì cả.`);
    process.exit(1);
  }

  const hash = hashPassword(password);
  const now = new Date().toISOString();
  const sql =
    `UPDATE users SET password_hash = '${hash}', password_updated_at = '${now}', ` +
    `must_change_password = ${mustChange ? 1 : 0}, failed_login_count = 0, locked_until = NULL, ` +
    `updated_at = '${now}' WHERE lower(email) = lower('${email.replace(/'/g, "''")}');`;

  const args = ['wrangler', 'd1', 'execute', database, '--remote', '--command', sql];
  if (env !== 'dev') args.splice(4, 0, '--env', env);

  try {
    // Gọi thẳng CLI JavaScript của Wrangler để giữ nguyên từng đối số SQL trên
    // Windows; đi qua npx.cmd/cmd.exe sẽ tách câu SQL tại dấu cách.
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const wranglerCli = resolve(scriptDir, '../node_modules/wrangler/bin/wrangler.js');
    const output = execFileSync(process.execPath, [wranglerCli, ...args.slice(1)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const changed = /"rows_written":\s*(\d+)/.exec(output);
    if (changed && Number(changed[1]) === 0) {
      console.error(`\nKhông tìm thấy tài khoản ${email} trong database ${database}.`);
      console.error('Tạo tài khoản trước trong màn hình "Người dùng", hoặc kiểm tra lại email.');
      process.exit(1);
    }
    console.info(`\n✅ Đã đặt mật khẩu cho ${email}. Giờ đăng nhập được bằng mật khẩu mới.`);
  } catch (error) {
    console.error('\nKhông chạy được lệnh wrangler:', error.message);
    process.exit(1);
  }
}

main();

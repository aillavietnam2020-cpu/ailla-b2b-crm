#!/usr/bin/env node
/**
 * Nối "cửa" Cloudflare Access của qt.ailla.vn với Trang quản trị, để CEO thêm/khoá nhân sự
 * trên web là email tự được mở/rút ở cửa, không phải vào Cloudflare.
 *
 * Mã khoá (API token) dán vào đây KHÔNG hiện lên màn hình, không lưu file: chỉ dùng để
 * tìm ứng dụng qt.ailla.vn rồi cất thẳng vào secret của Worker (CF_ACCESS_TOKEN).
 *
 * Cách dùng: node scripts/noi-cua-access.mjs   (hoặc bấm NOI-CUA-QT.bat)
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

process.noDeprecation = true;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACCOUNT_ID = 'be5d086a049ed8399aaa562543e9d174';
const DOMAIN = 'qt.ailla.vn';

function askHidden(question) {
  return new Promise((done) => {
    const stdin = process.stdin;
    let value = '';
    process.stdout.write(question);
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') {
          stdin.removeListener('data', onData);
          if (stdin.isTTY) stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write('\n');
          done(value.trim());
          return;
        }
        if (c === '\u0003') process.exit(1);
        if (c === '\b' || c === '\u007f') {
          if (value.length) value = value.slice(0, -1);
          continue;
        }
        // Chỉ nhận ký tự của mã khoá (chữ, số, - _): bỏ ký tự lạ lọt vào khi dán trong cửa sổ đen.
        if (/[A-Za-z0-9_-]/.test(c)) {
          value += c;
          process.stdout.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function cf(token, path) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/access${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.success) {
    const msg = (j.errors && j.errors[0] && j.errors[0].message) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return j.result;
}

/** Máy chưa đăng nhập Cloudflare (hoặc phiên cũ hết hạn) thì mở trang đăng nhập để chị bấm Allow. */
function ensureLogin() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.toUpperCase() === 'CLOUDFLARE_API_TOKEN') delete env[k];
  const who = spawnSync('npx wrangler whoami', { cwd: ROOT, env, shell: true, encoding: 'utf8' });
  if (who.status === 0 && /logged in/i.test(who.stdout || '') && !/not logged in/i.test(who.stdout || '')) return;
  console.log('');
  console.log('Cần đăng nhập Cloudflare một lần: trình duyệt sẽ mở, chị bấm nút "Allow" rồi quay lại đây.');
  const r = spawnSync('npx wrangler login', { cwd: ROOT, env, shell: true, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Chưa đăng nhập được Cloudflare');
}

function putSecret(name, value) {
  const env = { ...process.env };
  delete env.CLOUDFLARE_API_TOKEN; // dùng tài khoản Cloudflare đã đăng nhập trên máy
  const r = spawnSync(`npx wrangler secret put ${name} --env production`, {
    cwd: ROOT,
    input: value,
    env,
    shell: true,
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`Không cất được ${name}: ${(r.stderr || r.stdout || '').slice(-300)}`);
}

// Lấy mã từ bộ nhớ copy (chị bấm nút Copy trên Cloudflare là đủ, không cần dán vào cửa sổ đen).
function fromClipboard() {
  const r = spawnSync('powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' });
  const raw = String(r.stdout || '');
  // Copy nhầm cả dòng lệnh thử (curl ... Bearer <mã>) thì lấy đúng phần sau "Bearer".
  const bearer = /Bearer\s+([A-Za-z0-9_-]{30,})/.exec(raw);
  if (bearer) return bearer[1];
  // Còn lại: lấy đoạn liền dài nhất trông giống mã khoá.
  const runs = raw.match(/[A-Za-z0-9_-]{30,}/g) || [];
  return runs.sort((x, y) => y.length - x.length)[0] || '';
}
let token = fromClipboard();
if (token.length >= 30) {
  console.log(`Đã lấy mã khoá từ bộ nhớ copy (${token.length} ký tự).`);
} else {
  token = await askHidden('Chưa thấy mã trong bộ nhớ copy. Dán mã (bấm chuột phải) rồi Enter: ');
}
if (!token) {
  console.log('Chưa dán mã khoá.');
  process.exitCode = 1;
} else {

try {
  const apps = await cf(token, '/apps');
  const app = apps.find((a) =>
    [a.domain, ...(a.self_hosted_domains || []), ...((a.destinations || []).map((d) => d.uri))]
      .filter(Boolean)
      .some((d) => String(d).replace(/^https?:\/\//, '').startsWith(DOMAIN)),
  );
  if (!app) throw new Error(`Không thấy ứng dụng nào khoá ${DOMAIN}`);
  const pols = (app.policies || []).filter((p) => p.decision === 'allow');
  if (!pols.length) throw new Error('Ứng dụng chưa có chính sách cho phép (Allow)');
  const policy = pols[0];
  // Chính sách dùng chung (reusable) thì sửa ở cấp tài khoản, không qua ứng dụng.
  const reusable = await cf(token, '/policies').catch(() => []);
  const isReusable = Array.isArray(reusable) && reusable.some((p) => p.id === policy.id);

  console.log(`Tìm thấy cửa: "${app.name}", chính sách "${policy.name}".`);
  ensureLogin();
  console.log('Đang cất vào máy chủ (mất khoảng 30 giây)...');
  putSecret('CF_ACCOUNT_ID', ACCOUNT_ID);
  putSecret('ACCESS_POLICY_ID', policy.id);
  if (!isReusable) putSecret('ACCESS_APP_ID', app.id);
  putSecret('CF_ACCESS_TOKEN', token);
  spawnSync('powershell', ['-NoProfile', '-Command', 'Set-Clipboard -Value " "']);
  console.log('');
  console.log('XONG. Vào qt.ailla.vn › Cài đặt › Tài khoản & phân quyền:');
  console.log('ô "Cửa vào qt.ailla.vn" sẽ hiện "Tự cập nhật".');
} catch (e) {
  console.log('');
  console.log('CHƯA ĐƯỢC: ' + e.message);
  if (/Authentication|token|quyền|permission/i.test(e.message)) console.log('Kiểm tra lại: mã khoá copy đủ chưa (thường dài khoảng 40-55 ký tự), có quyền "Access: Apps and Policies - Edit" chưa.');
  process.exitCode = 1;
}
}

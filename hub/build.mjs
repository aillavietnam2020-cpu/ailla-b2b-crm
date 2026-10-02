/**
 * Dựng trang khu Marketing (/hub/) thành MỘT file HTML để Worker trả về sau khi kiểm tra đăng nhập.
 *
 *   node hub/build.mjs
 *
 * File dựng ra KHÔNG chứa số liệu nào: kế hoạch/doanh thu tháng trước, báo cáo TikTok, kinh doanh,
 * giá vốn đều nạp riêng vào D1 (bảng hub_blobs) bằng hub/blobs-sql.mjs và tải về sau khi đăng nhập.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const OUT = path.resolve(ROOT, '..', 'src', 'server', 'hub', 'hub.html');

const JS_ORDER = [
  'core.js', 'app.js', 'phanbo.js', 'setup.js', 'giaoviec.js', 'kinhdoanh.js', 'exec.js', 'period.js',
  'congviec.js', 'hr.js', 'importx.js', 'dieuchinh.js', 'bots.js', 'claude.js', 'ai.js', 'server.js',
];

const read = (f) => readFileSync(path.join(SRC, f), 'utf8');
const esc = (s) => s.replace(/<\//g, '<\\/');

const logo = read('logo.b64').trim();
const header = [
  'const SERVER=true;',
  'let APP_MODE="admin";',
  `const LOGO="${logo}";`,
  `const QUYCHUAN=${esc(read('quychuan.json').trim())};`,
  'var KD=null,SKUCOST=[],NHANSU0=[],T9_BASE={},T9RAW={cards:[],kho:[]};',
].join('\n');

const fonts =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap">';
const xlsx = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ailla Hub</title>
<link rel="icon" href="data:image/png;base64,${logo}">
${fonts}
${xlsx}
<style>
${read('style.css')}
</style></head><body>
<div id="app"><div class="loginwrap"><div class="login"><p>Đang tải…</p></div></div></div>
<div class="drawer" id="drawer" hidden><div class="in" id="drawerIn" role="dialog" aria-modal="true" aria-label="Chi tiết"></div></div>
<div class="toast" id="toast" hidden></div>
<script>
${header}
${JS_ORDER.map((f) => esc(read(f))).join('\n')}
</script></body></html>`;

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.info(`[hub] ${path.relative(process.cwd(), OUT)} ${Math.round(html.length / 1024)} KB`);

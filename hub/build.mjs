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
  'core.js', 'drp.js', 'app.js', 'phanbo.js', 'setup.js', 'giaoviec.js', 'kinhdoanh.js', 'exec.js', 'period.js',
  'congviec.js', 'hr.js', 'importx.js', 'dieuchinh.js', 'sanxuat.js', 'kho.js', 'kho2.js', 'kho3.js', 'kho4.js', 'khoxuat.js', 'sxsteps.js', 'sanphamsku.js', 'khohoan.js', 'soatsolieu.js', 'winhub.js', 'adsday.js', 'fbdash.js', 'fbpl.js', 'spdangchay.js', 'dieuphoi.js', 'xepviec.js', 'pillar.js', 'tuan.js', 'dashv2.js', 'lichtuan.js', 'bots.js', 'claude.js', 'ai.js', 'server.js', 'chat.js', 'khodang.js', 'kocwin.js', 'trolyai.js', 'giaonhanh.js', 'kehoachthang.js', 'tongquancontent.js', 'dauviec.js', 'loaivideo.js', 'bangvideo.js', 'fanpage.js', 'fpai.js', 'dangbai.js', 'nhapthang.js', 'digital.js', 'hockb.js', 'pagethuonghieu.js', 'nhansu2.js', 'nhansu3.js', 'nhansu4.js', 'tenhien.js', 'lichluoi.js', 'xuongvideo.js', 'ttcalc.js', 'tiktok.js', 'ttbc.js', 'tiktokv2.js', 'hostmode.js', 'admmenu.js', 'dhcalc.js', 'dieuhanh.js', 'tqgop.js', 'specalc.js', 'shopee.js', 'spebc.js', 'spev2.js', 'fbbc.js', 'fbv2.js', 'hqteam.js', 'opsview.js', 'b2bpl.js', 'gc.js', 'muahang.js', 'rowmenu.js', 'qtchart.js', 'admnav2.js', 'gdbang.js', 'chicalc.js', 'socp.js', 'cpduyet.js', 'cpluong.js', 'cpthu.js', 'sochi.js', 'scphanbo.js', 'scbaocao.js', 'phieuchigop.js', 'quytac.js', 'vieccho.js', 'suckhoe.js', 'kenhview.js', 'tienlich.js', 'ngansach.js', 'phaithu.js', 'nguong.js', 'dashb2b.js', 'kenhpp.js', 'kenhoem.js', 'npp360.js', 'thangmoi.js', 'trungtam.js', 'ttmenu.js', 'vieccuatoi.js', 'agentavatars.js', 'dieuhanhagent.js', 'huanluyenagent.js', 'spccalc.js', 'spcombo.js', 'pdcalc.js', 'pheduyet.js', 'dtcalc.js', 'doanhthu.js', 'plcty.js', 'bcban.js', 'khocalc.js', 'khoton.js', 'tiencalc.js', 'tiencn.js', 'tscalc.js', 'taisan.js', 'menubang.js', 'mobile.js',
];

const read = (f) => readFileSync(path.join(SRC, f), 'utf8');
const esc = (s) => s.replace(/<\//g, '<\\/');

const logo = read('logo.b64').trim();
const header = [
  'const SERVER=true;',
  'let HOST_MODE="ops";let OPS_URL="";let ADMIN_URL="";',
  'let APP_MODE="admin";',
  `const LOGO="${logo}";`,
  `const QUYCHUAN=${esc(read('quychuan.json').trim())};`,
  'var KD=null,SKUCOST=[],NHANSU0=[],T9_BASE={},T9RAW={cards:[],kho:[]};',
  `const BUILD_ID="${Date.now()}";`,
].join('\n');

const fonts =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap">';
const xlsx = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>';

// Hỏi sẵn dữ liệu lúc mở trang ngay khi trình duyệt đọc tới đầu trang, trong lúc phần còn lại (khoảng 4 MB mã) còn đang tải;
// svApi (server.js) dùng lại đúng một lần. Chỉ là GET, không đổi gì trên máy chủ.
const prefetch = '<script>window.SVPRE={};["/api/me","/api/hub/state","/api/hub/sx"].forEach(function(u){try{var p=fetch(u,{credentials:"same-origin",headers:{"Content-Type":"application/json"}});p.catch(function(){});SVPRE[u]=p}catch(e){}});setTimeout(function(){window.SVPRE={}},30000)</script>';

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0f1b3d"><link rel="manifest" href="/manifest.webmanifest" crossorigin="use-credentials"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Ailla"><meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>Trang quản trị Ailla</title>
${prefetch}
<link rel="icon" href="data:image/png;base64,${logo}">
${fonts}
${xlsx}
<style>
${read('style.css')}
${read('theme-navy.css')}
${read('theme-sang.css')}
${read('mobile.css')}
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

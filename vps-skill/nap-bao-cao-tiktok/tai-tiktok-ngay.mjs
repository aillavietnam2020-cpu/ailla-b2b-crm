#!/usr/bin/env node
/*
 * tai-tiktok-ngay — tải đơn hàng + quyết toán + quảng cáo TikTok Shop bằng SCRIPT (không gọi AI) trên trình duyệt TikTok
 * RIÊNG của VPS (công cụ tt / tt-tai / tt-browser trong /root/.openclaw/tiktok/bin), rồi nạp tháng lên web bằng nap-tiktok.mjs.
 * Bổ sung cho tai-ads-km (quảng cáo 2 ngày + Key metrics, chạy 1h50) — hai việc không đụng nhau, cùng xếp hàng trình duyệt qua tt-browser.
 *
 *   node tai-tiktok-ngay.mjs              chạy thật (tải, chạy thử, kiểm số, nạp, xoá file khách)
 *   node tai-tiktok-ngay.mjs --thu        tải + tính số, KHÔNG ghi lên web
 *   node tai-tiktok-ngay.mjs --ke-hoach   in việc hôm nay, không đụng trình duyệt
 * Tuỳ chọn: --ngay YYYY-MM-DD (giả lập hôm nay) · --ky YYYY-MM · --ep (làm cả khi web đã có số) · --giu (không xoá file)
 *
 * Mất đăng nhập / hộp xác minh: DỪNG, nhắn chị (nhan-chi.sh), không tự nhập. Thư mục làm việc riêng /root/bao-cao-san/tt-ngay/<tháng>/.
 * Cách bấm ghi theo đúng các bước đã chạy tay thành công 09/11/2026; hộp lịch tìm theo chữ trên trang nên không phụ thuộc cỡ cửa sổ.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canLam, lapViec, tenFile, timThang, tinNhan, trongKhungCam, vnParts, yesterday, msVN, nhanLoiTrang } from './tai-tiktok-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const co = (k) => argv.includes(k);
const gt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] || '' : ''; };
const THU = co('--thu'), GIU = co('--giu'), EP = co('--ep');
const AGENT = 'ke-toan-truong-ailla';
const GOC = process.env.TT_NGAY_DIR || '/root/bao-cao-san/tt-ngay';
const URL0 = (process.env.ABOS_URL || 'https://ailla-b2b-crm.aillavietnam2020.workers.dev').replace(/\/$/, '');
const now = gt('--ngay') ? new Date(`${gt('--ngay')}T09:00:00+07:00`) : new Date();
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const p2 = (n) => String(n).padStart(2, '0');
const homNay = (() => { const p = vnParts(now); return `${p.y}-${p2(p.m)}-${p2(p.d)}`; })();

const log = (m) => {
  console.log(m);
  try { mkdirSync(GOC, { recursive: true }); appendFileSync(join(GOC, 'nhat-ky.log'), `${new Date().toISOString()} ${m}\n`); } catch { /* bỏ qua */ }
};

/* ── Việc hôm nay ── */
let viec = lapViec(now);
if (gt('--ky')) viec = viec.filter((v) => v.ky === gt('--ky'));
if (co('--ke-hoach')) {
  const p = vnParts(now);
  console.log(`Hôm nay ${p.d}/${p.m}/${p.y}, số đến hết ${yesterday(now)}. Khung cấm bây giờ: ${trongKhungCam(now) ? 'CÓ' : 'không'}.`);
  for (const v of viec) {
    console.log(`Tháng ${v.ky} (${v.loai === 'du' ? 'ĐỦ THÁNG chốt sổ' : 'giữa tháng'}): đơn ${v.ord.from}→${v.ord.to} · quyết toán ${v.inc.from}→${v.inc.to} · quảng cáo ${v.ads.from}→${v.ads.to}`);
    console.log(`  file: ${['ord', 'inc', 'ads'].map((l) => tenFile(l, v[l].from, v[l].to)).join(', ')}`);
  }
  if (!viec.length) console.log('Hôm nay không có việc.');
  process.exit(0);
}

/* ── Công cụ gọi tt ── */
const ENV = { ...process.env, PATH: `/root/.openclaw/tiktok/bin:${process.env.PATH}`, TZ: 'Asia/Ho_Chi_Minh' };
const run = (cmd, args, ms = 120000) => execFileSync(cmd, args.map(String), { encoding: 'utf8', timeout: ms, env: ENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tt = (...a) => run('tt', a);
const js = (fn) => tt('js', fn);

class Chan extends Error { constructor(loai, ct = '') { super(`${loai}${ct ? ': ' + ct : ''}`); this.loai = loai; } }

/** Lấy phần tử lá có đúng chữ (regex), đang hiện, lọc thêm bằng flt (biến o.r = khung), chọn first | last | widest. */
const LA = (re, flt = 'true', pick = 'first') => `(()=>{const a=[...document.querySelectorAll('body *')].filter(e=>${re}.test((e.innerText||'').trim())&&![...e.children].some(c=>${re}.test((c.innerText||'').trim()))&&e.getBoundingClientRect().width>0).map(e=>({e,r:e.getBoundingClientRect()})).filter(o=>${flt});${pick === 'widest' ? 'a.sort((x,y)=>y.r.width-x.r.width);' : ''}return a.length?a[${pick === 'last' ? 'a.length-1' : '0'}].e:null})()`;
const CNT = (re) => `[...document.querySelectorAll('body *')].filter(e=>${re}.test((e.innerText||'').trim())&&![...e.children].some(c=>${re}.test((c.innerText||'').trim()))&&e.getBoundingClientRect().width>0).length`;

async function bamChu(chu) { for (let i = 0; i < 4; i++) { try { tt('bam-chu', chu); return; } catch { await sleep(6); } } throw new Error(`Không bấm được "${chu}"`); }

/** Tâm phần tử (sau khi cuộn vào giữa màn hình) -> [x, y] hoặc null. */
function tam(expr) {
  const r = js(`() => { const e=(${expr}); if(!e) return ''; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return JSON.stringify([Math.round(r.x+r.width/2),Math.round(r.y+r.height/2)]) }`);
  try { return JSON.parse(r); } catch { return null; }
}
const bamToaDo = (x, y) => run('tt-xy', [x, y]);
async function bam(expr, mo = 'phần tử', cho = 1.5) {
  const c = tam(expr);
  if (!c) throw new Error(`Không thấy ${mo} trên trang`);
  bamToaDo(c[0], c[1]);
  await sleep(cho);
}
const dem = (re) => +js(`() => ${CNT(re)}`) || 0;

async function canhTrang() {
  const url = tt('dang-o');
  const loi = nhanLoiTrang(url, tt('chu', 3000));
  if (loi) throw new Chan(loi, url.slice(0, 100));
}
async function mo(url, doi = 15) {
  tt('mo', url);
  tt('cho', doi);
  try { tt('bam-chu', 'Đã hiểu'); } catch { /* không có hộp này */ }
  await canhTrang();
}

/* ── Chọn ngày trên lịch kiểu "11 / 2026" (hai bảng cạnh nhau) ── */
const DAUTHANG = `JSON.stringify([...document.querySelectorAll('body *')].filter(e=>/^\\d{1,2}\\s*\\/\\s*\\d{4}$/.test((e.innerText||'').trim())&&![...e.children].some(c=>/^\\d{1,2}\\s*\\/\\s*\\d{4}$/.test((c.innerText||'').trim()))&&e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return {t:e.innerText.trim(),x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}}))`;
async function chonNgay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dich = y * 12 + m;
  const dd = p2(d);
  for (let i = 0; i < 16; i++) {
    const hs = JSON.parse(js(`() => ${DAUTHANG}`) || '[]').map((h) => ({ ...h, n: +h.t.split('/')[1].trim() * 12 + +h.t.split('/')[0].trim() })).sort((a, b) => a.x - b.x);
    if (!hs.length) throw new Error('Không thấy lịch (chưa mở được ô ngày)');
    const h = hs.find((x) => x.n === dich);
    if (h) {
      const c = JSON.parse(js(`() => { const cs=[...document.querySelectorAll('body *')].filter(e=>(e.innerText||'').trim()==='${dd}'&&![...e.children].some(c=>(c.innerText||'').trim()==='${dd}')&&e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();const k=(getComputedStyle(e).color.match(/\\d+/g)||[255,255,255]).slice(0,3).reduce((s,v)=>s+ +v,0);return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),k}}).filter(o=>Math.abs(o.x-${h.x})<140&&o.y>${h.y}&&o.k<330); return JSON.stringify(cs[0]||null) }`) || 'null');
      if (!c) throw new Error(`Không thấy ngày ${iso} trên lịch`);
      bamToaDo(c.x, c.y);
      await sleep(1.5);
      return;
    }
    const lui = dich < hs[0].n;
    const goc = lui ? hs[0] : hs[hs.length - 1];
    bamToaDo(lui ? goc.x - 74 : goc.x + 76, goc.y);
    await sleep(1.2);
  }
  throw new Error(`Không chuyển được lịch tới ${iso}`);
}

/* ── Lấy file về VPS ── */
async function layFile(dich, giay = 60) {
  try { run('tt-tai', ['lay', dich, giay], (giay + 400) * 1000); } catch (e) { /* lệnh dọn cuối có thể báo lỗi dù file đã về: kiểm bằng kích thước */ }
  if (!existsSync(dich) || statSync(dich).size < 200) throw new Error(`File tải về trống: ${dich}`);
  log(`  đã lấy ${dich.split('/').pop()} (${statSync(dich).size} byte)`);
}

/* ── Từng file ── */
async function taiQuangCao(v, dich) {
  await mo(`https://seller-vn.tiktok.com/ads-creation/dashboard?mpa=1&type=product&list_start_date=${msVN(v.ads.from)}&list_end_date=${msVN(v.ads.to)}`, 30);
  run('tt-tai', ['bay']);
  for (let i = 0; i < 2; i++) { try { tt('klik-css', '[class*=icon-download]'); } catch { /* thử lại */ } await sleep(6); }
  await layFile(dich, 40);
}

async function taiQuyetToan(v, dich) {
  await mo('https://seller-vn.tiktok.com/finance/bills');
  await bamChu('Báo cáo'); await sleep(4);
  await bamChu('Xem theo đơn hàng'); await sleep(4);
  await bam(LA('/^Lịch sử xuất dữ liệu$/', 'true', 'last'), 'Lịch sử xuất dữ liệu', 3);
  const truoc = dem('/^Tải xuống$/');
  tt('phim', 'Escape'); await sleep(2);
  await bam(LA('/^Xuất$/', 'o.r.x>900', 'last'), 'nút Xuất (quyết toán)', 2);
  await bam(LA('/^Thời gian bắt đầu$/'), 'ô ngày xuất', 2);
  await chonNgay(v.inc.from);
  await chonNgay(v.inc.to);
  await bam(LA('/^OK$/'), 'nút OK lịch', 1.5);
  await bam(LA('/^Xuất$/', 'true', 'last'), 'nút Xuất trong hộp', 5);
  await bam(LA('/^Lịch sử xuất dữ liệu$/', 'true', 'last'), 'Lịch sử xuất dữ liệu', 3);
  for (let i = 0; i < 40 && dem('/^Tải xuống$/') <= truoc; i++) { await sleep(9); await canhTrang(); }
  if (dem('/^Tải xuống$/') <= truoc) throw new Error('Đợi 6 phút file quyết toán chưa xuất xong');
  run('tt-tai', ['bay']);
  await bam(LA('/^Tải xuống$/', 'true', 'first'), 'Tải xuống (quyết toán)', 4);
  await layFile(dich, 60);
}

async function taiDonHang(v, dich) {
  await mo('https://seller-vn.tiktok.com/order');
  await bam(LA('/^Tất cả$/', 'o.r.y>300&&o.r.y<460'), 'tab Tất cả', 4);
  await bam(LA('/^Bộ lọc/', 'o.r.y>300'), 'nút Bộ lọc', 2.5);
  const o = tam(`[...document.querySelectorAll('input')].find(i=>i.placeholder==='Từ'&&i.getBoundingClientRect().width>0)`);
  if (!o) throw new Error('Không thấy ô ngày trong Bộ lọc');
  bamToaDo(o[0], o[1]); await sleep(2);
  await chonNgay(v.ord.from);
  await chonNgay(v.ord.to);
  await bam(LA('/^Áp dụng$/'), 'nút Áp dụng', 7);
  await bam(LA('/^Xuất$/', 'o.r.y>300&&o.r.y<520&&o.r.x>1000'), 'nút Xuất (đơn hàng)', 3);
  const truoc = dem('/^Tải xuống$/');
  if (!/Đơn hàng đã lọc/.test(tt('chu', 4000))) throw new Error('Không thấy hộp Xuất đơn hàng');
  await bam(LA('/^Xuất$/', 'o.r.x>1000&&o.r.y>350', 'widest'), 'nút Xuất trong hộp', 10);
  for (let i = 0; i < 40 && dem('/^Tải xuống$/') <= truoc; i++) { await sleep(9); await canhTrang(); }
  if (dem('/^Tải xuống$/') <= truoc) throw new Error('Đợi 6 phút file đơn hàng chưa xuất xong');
  run('tt-tai', ['bay']);
  const c = tam(LA('/^Tải xuống$/', 'true', 'first'));
  if (!c) throw new Error('Không thấy nút Tải xuống (đơn hàng)');
  tt('klik-ct', 'div', 'Tải xuống'); await sleep(4);
  await layFile(dich, 60);
}

/* ── Khoá một lượt, trạng thái, nhắn chị ── */
const KHOA = join(GOC, 'dang-chay.lock');
const FTT = join(GOC, 'trang-thai.json');
const docTT = () => { try { return JSON.parse(readFileSync(FTT, 'utf8')); } catch { return {}; } };
const ghiTT = (o) => { try { writeFileSync(FTT, JSON.stringify(o, null, 1)); } catch { /* bỏ qua */ } };
function nhanChi(noiDung) {
  if (process.env.TT_NGAY_KHONG_NHAN) { log('[không nhắn] ' + noiDung.replace(/\n/g, ' / ')); return; }
  try { execFileSync('bash', [join(here, 'nhan-chi.sh'), noiDung], { timeout: 120000, stdio: 'ignore' }); } catch { log('Không nhắn được chị.'); }
}
function baoChi(loai, ky, buoc) {
  const tt0 = docTT();
  tt0.nhac = tt0.nhac || {};
  if (tt0.nhac[loai] === homNay) return;
  tt0.nhac[loai] = homNay;
  ghiTT(tt0);
  nhanChi(tinNhan(loai, { ky, buoc }));
}
function tienDo(m) {
  try { const d = `/root/bao-cao-san/${viec[0]?.ky || homNay.slice(0, 7)}`; mkdirSync(d, { recursive: true }); appendFileSync(join(d, 'TIEN-DO.txt'), `${homNay} ${p2(vnParts(new Date()).hh)}:${p2(vnParts(new Date()).mm)} | tai-tiktok-ngay (tự động, không AI) | ${m}\n`); } catch { /* bỏ qua */ }
}

let KEY = process.env.ABOS_AGENT_KEY || '';
if (!KEY) { try { KEY = readFileSync(`/root/.config/abos/${AGENT}.key`, 'utf8').trim(); } catch { /* chưa có */ } }
async function webThang() {
  if (!KEY.startsWith('agt_')) throw new Error('Chưa có khoá web của Kế toán trưởng.');
  const r = await fetch(`${URL0}/api/agent/tiktok/months`, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`Web từ chối đọc các tháng (${r.status})`);
  return (await r.json()).data || [];
}

/* ── Chạy ── */
if (!co('--bo-qua-khung') && trongKhungCam(now)) { log('KHUNG_CAM: 7h00–8h30 thứ Hai/ngày 10, bỏ lượt.'); process.exit(0); }
if (!viec.length) { log(`Ngày ${homNay}: không có việc.`); process.exit(0); }
mkdirSync(GOC, { recursive: true });
if (existsSync(KHOA) && Date.now() - statSync(KHOA).mtimeMs < 3 * 3600 * 1000) { log('Đang có một lượt khác chạy, bỏ lượt này.'); process.exit(0); }
writeFileSync(KHOA, String(process.pid));

let dungVi = '';
let daNap = 0;
let mo_ = false;
try {
  const daCo = await webThang();
  const can = viec.filter((v) => { const q = canLam(v, timThang(daCo, v.ky), EP); log(`Tháng ${v.ky}: ${q.lam ? 'làm' : 'bỏ qua'} (${q.ly_do}).`); return q.lam; });
  if (can.length) {
    let ok = false, r = '';
    for (let i = 0; i < 8 && !ok; i++) { try { r = run('tt-browser', ['bat', AGENT], 400000).split('\n').pop(); } catch (e) { r = `LOI ${String(e.stderr || e.message).slice(-100)}`; } ok = r.startsWith('SAN_SANG'); if (!ok && r.startsWith('KHUNG_CAM')) break; if (!ok) await sleep(20); }
    if (!ok) throw new Error(`Không giành được trình duyệt (${r})`);
    mo_ = true;
    if (!/DA_DANG_NHAP/.test(run('kiem-dang-nhap-tiktok', [], 300000))) throw new Chan('DANG_NHAP', 'phiên TikTok trên VPS');
  }
  for (const v of can) {
    const dir = join(GOC, v.ky);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    let buoc = '';
    try {
      const f = (l) => join(dir, tenFile(l, v[l].from, v[l].to));
      for (const [ten, fn] of [['quảng cáo', () => taiQuangCao(v, f('ads'))], ['quyết toán', () => taiQuyetToan(v, f('inc'))], ['đơn hàng', () => taiDonHang(v, f('ord'))]]) {
        buoc = ten; log(`Tháng ${v.ky}: đang tải ${ten}…`);
        try { await fn(); } catch (e) { if (e instanceof Chan) throw e; log(`  lỗi lần 1 (${e.message}), thử lại`); await fn(); }
      }
      buoc = 'nạp lên web';
      const files = ['ord', 'inc', 'ads'].map(f);
      const nap = (them) => execFileSync('node', [join(here, 'nap-tiktok.mjs'), '--as', AGENT, ...files, '--ky', v.ky, ...them], { encoding: 'utf8', timeout: 600000 });
      const thu = nap(['--thu']);
      log(thu.trim().split('\n').slice(-3).join('\n'));
      const dt = +(thu.match(/Doanh thu thực ([\d.]+)/)?.[1] || '0').replace(/\./g, '');
      const cu = timThang(daCo, v.ky)?.dt || 0;
      if (!dt || (cu > 0 && dt < cu * 0.9)) { log(`  Số lệch bất thường (mới ${dt}, đang có ${cu}), KHÔNG nạp.`); tienDo(`tháng ${v.ky}: số lệch bất thường, không nạp`); continue; }
      if (THU) { log('  --thu: chưa ghi lên web.'); continue; }
      log(nap([]).trim().split('\n').pop());
      tienDo(`đã tải + nạp tháng ${v.ky} ${v.loai === 'du' ? '(đủ tháng)' : `(đến ${v.inc.to})`}: đơn+quyết toán+quảng cáo, đã xoá file`);
      daNap += 1;
    } catch (e) {
      if (e instanceof Chan) throw e;
      log(`LỖI ${v.ky} (${buoc}): ${e.message}`);
      tienDo(`tháng ${v.ky}: lỗi lúc ${buoc}: ${e.message.slice(0, 120)}`);
    } finally {
      if (!GIU) rmSync(dir, { recursive: true, force: true }); // file đơn có tên, SĐT, địa chỉ khách
    }
  }
} catch (e) {
  if (e instanceof Chan) { dungVi = e.loai; log(`DỪNG vì ${e.message}`); baoChi(e.loai, viec[0].ky, 'lúc tải file'); tienDo(`dừng vì ${e.loai}`); }
  else { log(`LỖI: ${e.message}`); tienDo(`lỗi: ${e.message.slice(0, 120)}`); }
} finally {
  if (mo_) { try { run('tt-browser', ['tat', AGENT]); } catch { /* ok */ } }
  rmSync(KHOA, { force: true });
}
log(dungVi ? `Kết thúc: dừng (${dungVi}).` : `Kết thúc: đã nạp ${daNap} tháng${THU ? ' (chạy thử, không ghi web)' : ''}.`);

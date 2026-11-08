#!/usr/bin/env node
/*
 * tai-tiktok-ngay — tải báo cáo TikTok Shop HẰNG NGÀY bằng script (không gọi AI), rồi nạp lên web ABOS bằng nap-tiktok.mjs.
 * Chị Hoa chốt 06/11/2026: tải hằng ngày, chuyển từ agent Kế toán trưởng sang script chạy lịch trên VPS.
 *
 *   node tai-tiktok-ngay.mjs                chạy thật theo ngày hôm nay (cron gọi lệnh này)
 *   node tai-tiktok-ngay.mjs --thu          tải thật nhưng chỉ TÍNH và in số, không ghi lên web (chị chưa đồng ý ghi thì dùng cái này)
 *   node tai-tiktok-ngay.mjs --ke-hoach     chỉ in việc sẽ làm hôm nay, không đụng trình duyệt
 *   node tai-tiktok-ngay.mjs --kham <url>   mở trang, in chữ + nút để chỉnh bước bấm (không tải gì)
 * Tuỳ chọn: --ngay YYYY-MM-DD (giả lập hôm nay) · --ep (làm cả khi web đã có số) · --giu (không xoá file sau khi nạp, chỉ để chẩn đoán)
 *           --bo-qua-khung (chạy cả trong khung cấm 7h–8h30 thứ Hai/ngày 10) · --profile chrome|tiktok · --ky YYYY-MM (chỉ tháng đó)
 *
 * Gặp đăng nhập lại / hộp xác minh: DỪNG, nhắn chị (nhan-chi.sh), không tự nhập mật khẩu. Mỗi ngày nhắn chị tối đa một lần cho mỗi loại lỗi.
 * Thư mục làm việc RIÊNG /root/bao-cao-san/tt-ngay/<tháng>/ (không đụng thư mục tháng của Shopee); xoá ngay sau khi nạp vì file đơn có tên, SĐT, địa chỉ khách.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canLam, kyOf, lapViec, tenFile, timThang, tinNhan, trongKhungCam, vnParts, yesterday } from './tai-tiktok-lib.mjs';
import { Chan, TEAM_NHE, taiDonHang, taiQuangCao, taiQuyetToan, taiTeamNhe, taoDriver } from './tai-tiktok-trang.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const co = (k) => argv.includes(k);
const gt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] || '' : ''; };

const THU = co('--thu');
const GIU = co('--giu');
const EP = co('--ep');
const AGENT = 'ke-toan-truong-ailla';
const GOC = process.env.TT_NGAY_DIR || '/root/bao-cao-san/tt-ngay';
const URL0 = (process.env.ABOS_URL || 'https://ailla-b2b-crm.aillavietnam2020.workers.dev').replace(/\/$/, '');
const now = gt('--ngay') ? new Date(`${gt('--ngay')}T09:00:00+07:00`) : new Date();

const log = (m) => {
  const dong = `${new Date().toISOString()} ${m}`;
  console.log(m);
  try { mkdirSync(GOC, { recursive: true }); appendFileSync(join(GOC, 'nhat-ky.log'), dong + '\n'); } catch { /* không ghi được nhật ký thì thôi */ }
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

/* ── Trạng thái (chống nhắn chị lặp) và khoá một lượt ── */
const FTT = join(GOC, 'trang-thai.json');
const docTT = () => { try { return JSON.parse(readFileSync(FTT, 'utf8')); } catch { return {}; } };
const ghiTT = (o) => { try { mkdirSync(GOC, { recursive: true }); writeFileSync(FTT, JSON.stringify(o, null, 1)); } catch { /* bỏ qua */ } };
const homNay = `${vnParts(now).y}-${String(vnParts(now).m).padStart(2, '0')}-${String(vnParts(now).d).padStart(2, '0')}`;

const KHOA = join(GOC, 'dang-chay.lock');
function giuKhoa() {
  mkdirSync(GOC, { recursive: true });
  if (existsSync(KHOA)) {
    const tuoi = Date.now() - statSync(KHOA).mtimeMs;
    if (tuoi < 3 * 3600 * 1000) { log('Đang có một lượt khác chạy, bỏ lượt này.'); process.exit(0); }
  }
  writeFileSync(KHOA, String(process.pid));
}
const nhaKhoa = () => { try { rmSync(KHOA, { force: true }); } catch { /* ok */ } };

function nhanChi(noiDung) {
  if (process.env.TT_NGAY_KHONG_NHAN) { log('[không nhắn] ' + noiDung.replace(/\n/g, ' / ')); return; }
  try { execFileSync('bash', [join(here, 'nhan-chi.sh'), noiDung], { timeout: 120000, stdio: 'ignore' }); } catch { log('Không nhắn được chị.'); }
}
/** Nhắn chị về một loại lỗi, tối đa một lần mỗi ngày. */
function baoChi(loai, ky, buoc) {
  const tt = docTT();
  tt.nhac = tt.nhac || {};
  if (tt.nhac[loai] === homNay) return;
  tt.nhac[loai] = homNay;
  ghiTT(tt);
  nhanChi(tinNhan(loai, { ky, buoc, gio: `${String(vnParts(new Date()).hh).padStart(2, '0')}:${String(vnParts(new Date()).mm).padStart(2, '0')}` }));
}
/** Lỗi kỹ thuật (trang đổi giao diện...): ghi sổ lỗi cho người làm web; chỉ nhắn chị khi lỗi lặp lại nhiều ngày liền. */
function baoLoiKyThuat(ky, buoc, chiTiet) {
  const tt = docTT();
  tt.loi = tt.loi || { soNgay: 0, cuoi: '' };
  if (tt.loi.cuoi !== homNay) { tt.loi.soNgay += 1; tt.loi.cuoi = homNay; }
  ghiTT(tt);
  try {
    const dir = '/root/bao-loi-web';
    mkdirSync(process.env.TT_NGAY_DIR ? GOC : dir, { recursive: true });
    appendFileSync(join(process.env.TT_NGAY_DIR ? GOC : dir, 'LOI-WEB.md'), `\n- ${homNay} tải TikTok hằng ngày (${ky}, ${buoc}): ${chiTiet}\n`);
  } catch { /* không ghi được cũng không sao */ }
  if (tt.loi.soNgay >= 3 && tt.nhac?.KY_THUAT !== homNay) {
    tt.nhac = { ...(tt.nhac || {}), KY_THUAT: homNay };
    ghiTT(tt);
    nhanChi(tinNhan('KY_THUAT', { ky, buoc }));
  }
}

/* ── Gọi web (đọc bản đã có) ── */
let KEY = process.env.ABOS_AGENT_KEY || '';
if (!KEY) { try { KEY = readFileSync(`/root/.config/abos/${AGENT}.key`, 'utf8').trim(); } catch { /* chưa có khoá */ } }
async function webThang() {
  if (!KEY.startsWith('agt_')) throw new Error('Chưa có khoá web của Kế toán trưởng (abos-khoa).');
  const r = await fetch(`${URL0}/api/agent/tiktok/months`, { headers: { Authorization: `Bearer ${KEY}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Web từ chối đọc các tháng (${r.status})`);
  return j.data || [];
}

/* ── Chế độ khám trang (không tải gì) ── */
if (co('--kham')) {
  const d = taoDriver(gt('--profile') || 'chrome');
  await d.khoiDong();
  const tab = await d.mo(gt('--kham'));
  console.log(d.kham(tab));
  d.dong(tab);
  process.exit(0);
}

/* ── Chạy ── */
if (!co('--bo-qua-khung') && trongKhungCam(now)) { log('KHUNG_CAM: đang trong 7h00–8h30 thứ Hai/ngày 10, bỏ lượt (nhường hàng chờ trình duyệt).'); process.exit(0); }
if (!viec.length) { log(`Ngày ${homNay}: không có việc.`); process.exit(0); }

giuKhoa();
process.on('exit', nhaKhoa);
let loiDung = '';
let daNap = 0;
try {
  const daCo = await webThang();
  const d = taoDriver(gt('--profile') || 'chrome');
  let khoiDong = false;
  for (const v of viec) {
    const q = canLam(v, timThang(daCo, v.ky), EP);
    if (!q.lam) { log(`Tháng ${v.ky}: bỏ qua (${q.ly_do}).`); continue; }
    log(`Tháng ${v.ky} (${v.loai === 'du' ? 'đủ tháng' : 'giữa tháng'}): ${q.ly_do}. Bắt đầu tải.`);
    if (!khoiDong) { await d.khoiDong(); khoiDong = true; }
    const dir = join(GOC, v.ky);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    let buoc = '';
    try {
      const tai = [
        ['file quảng cáo', 'ads', () => taiQuangCao(d, v, join(dir, tenFile('ads', v.ads.from, v.ads.to)))],
        ['file đơn hàng', 'ord', () => taiDonHang(d, v, join(dir, tenFile('ord', v.ord.from, v.ord.to)))],
        ['file quyết toán', 'inc', () => taiQuyetToan(d, v, join(dir, tenFile('inc', v.inc.from, v.inc.to)))],
      ];
      for (const [ten, , chay] of tai) { buoc = ten; log(`  đang tải ${ten}…`); await chay(); log(`  xong ${ten}`); }
      for (const t of TEAM_NHE) {
        buoc = `file team ${t.loai}`;
        try { await taiTeamNhe(d, t.url, v, join(dir, tenFile(t.loai, v.team.from, v.team.to))); log(`  xong ${buoc}`); } catch (e) {
          if (e instanceof Chan) throw e;
          log(`  bỏ ${buoc}: ${e.message}`);
        }
      }
      /* Nạp: chạy thử trước, kiểm số, rồi mới nạp thật. */
      buoc = 'nạp lên web';
      const files = ['ord', 'inc', 'ads', 'km', 'vdays'].map((l) => join(dir, tenFile(l, v[l]?.from || v.team.from, v[l]?.to || v.team.to))).filter((f) => existsSync(f));
      const chay = (them) => execFileSync('node', [join(here, 'nap-tiktok.mjs'), '--as', AGENT, ...files, '--ky', v.ky, ...them], { encoding: 'utf8', timeout: 600000 });
      const thu = chay(['--thu']);
      log(thu.trim());
      const dt = +(thu.match(/Doanh thu thực ([\d.]+)/)?.[1] || '0').replace(/\./g, '');
      const cu = timThang(daCo, v.ky)?.dt || 0;
      if (cu > 0 && dt < cu * 0.9) {
        baoLoiKyThuat(v.ky, 'kiểm số', `doanh thu mới ${dt} thấp hơn bản đang có ${cu} hơn 10%, KHÔNG nạp`);
        log('  Số lệch bất thường so với bản đang có, không nạp.');
        continue;
      }
      if (THU) { log('  --thu: dừng ở đây, chưa ghi lên web.'); continue; }
      log(chay([]).trim());
      daNap += 1;
    } finally {
      if (!GIU) rmSync(dir, { recursive: true, force: true }); // file đơn có tên, SĐT, địa chỉ khách
      else log(`  --giu: để lại ${dir} (nhớ xoá tay).`);
    }
  }
} catch (e) {
  if (e instanceof Chan) {
    loiDung = e.loai;
    log(`DỪNG vì ${e.message}`);
    baoChi(e.loai, viec[0].ky, 'lúc tải file');
  } else {
    log(`LỖI: ${e.message}`);
    baoLoiKyThuat(viec[0].ky, 'chạy', e.message);
  }
  process.exitCode = 0; // lỗi đã báo; để cron không đẩy thêm thư báo lỗi
}
if (!loiDung && daNap) { const tt = docTT(); tt.loi = { soNgay: 0, cuoi: '' }; tt.lanNapCuoi = homNay; ghiTT(tt); }
log(loiDung ? `Kết thúc: dừng (${loiDung}).` : `Kết thúc: đã nạp ${daNap} tháng${THU ? ' (chạy thử, không ghi web)' : ''}.`);

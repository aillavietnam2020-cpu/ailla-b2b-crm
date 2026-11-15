#!/usr/bin/env node
/*
 * tai-shopee-ngay — tải báo cáo Shopee 2 shop (aillavn1 thường, aillavn Mall) HẰNG NGÀY bằng SCRIPT, KHÔNG gọi AI,
 * chạy trên trình duyệt RIÊNG của máy chủ (không dùng Chrome máy chị Hoa), rồi gọi nap-shopee.mjs để nạp lên web.
 *
 *   node tai-shopee-ngay.mjs                 chạy thật: tải → chạy thử nap-shopee --thu → nạp thật → xóa file khách
 *   node tai-shopee-ngay.mjs --thu           tải + tính thử, KHÔNG ghi lên web, vẫn xóa file khách
 *   node tai-shopee-ngay.mjs --lap-viec      chỉ in ra hôm nay sẽ tải gì (không mở trình duyệt, không đụng mạng)
 *   node tai-shopee-ngay.mjs --dang-nhap     mở trình duyệt có màn hình để chị/người làm web đăng nhập Shopee một lần
 *   Tùy chọn: --ngay YYYY-MM-DD (giả lập ngày chạy) · --shop aillavn1 · --ep (chạy cả trong khung cấm) · --giu-file (không xóa file, chỉ để thử)
 *
 * Biến môi trường (đều có mặc định):
 *   TAI_SHOPEE_CDP=http://127.0.0.1:9222   nối vào trình duyệt đang chạy trên máy chủ (nếu không có thì tự mở trình duyệt riêng)
 *   TAI_SHOPEE_PROFILE=/root/.config/tai-shopee/profile   nơi giữ phiên đăng nhập
 *   TAI_SHOPEE_CHROME=/đường/dẫn/chrome   trình duyệt dùng để mở (mặc định: chrome/chromium cài sẵn)
 *   TAI_SHOPEE_HEADED=1   mở có màn hình (cần màn hình ảo, ít bị Shopee nghi hơn chế độ ẩn)
 *   TAI_SHOPEE_XEM=https://…   đường dẫn để chị nhìn thấy trình duyệt của máy chủ khi cần kéo hình / nhập mật khẩu
 *   BAO_CAO_DIR=/root/bao-cao-san   AS=ke-toan-truong-ailla
 *
 * LUẬT CỨNG: không bao giờ tự nhập mật khẩu, không tự kéo hình, không tải lại trang cho qua hộp kiểm tra.
 * Gặp mật khẩu / hộp kéo hình / đăng nhập lại: nhắn chị (nhan-chi.sh), chờ tối đa 30 phút, quá thì bỏ shop đó và ghi rõ.
 * Chỉ nạp shop đủ cả file. Thao tác chậm như người: chuột thật, đợi 3–5 giây sau mỗi bước.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, unlinkSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from './tai-shopee-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (k) => {
  const i = args.indexOf(k);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const opt = (k) => {
  const i = args.indexOf(k);
  if (i < 0) return '';
  const v = args[i + 1] || '';
  args.splice(i, 2);
  return v;
};
const THU = flag('--thu');
const LAP_VIEC = flag('--lap-viec');
const DANG_NHAP = flag('--dang-nhap');
const EP = flag('--ep');
const GIU_FILE = flag('--giu-file');
const NGAY = opt('--ngay');
const CHI_SHOP = opt('--shop');

const AS = process.env.AS || 'ke-toan-truong-ailla';
const GOC = process.env.BAO_CAO_DIR || '/root/bao-cao-san';
const PROFILE = process.env.TAI_SHOPEE_PROFILE || '/root/.config/tai-shopee/profile';
const DUNG_LAI = join(process.env.BAO_CAO_DIR || '/root/bao-cao-san', '_dung-lai-doanh-thu');
const KHOA = '/root/.config/tai-shopee/dang-chay.lock';
const XEM = process.env.TAI_SHOPEE_XEM || '';

const now = NGAY ? new Date(`${NGAY}T03:00:00+07:00`) : new Date();
const log = (...a) => console.log(`[${L.gioVN(new Date())}]`, ...a);
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const choNhuNguoi = (page) => page.waitForTimeout(L.doiNhuNguoi(3, 5));

/** Lỗi "trang không như mong đợi" — bỏ shop này, không đoán mò. */
class LoiTrang extends Error {}
/** Hết 30 phút chờ chị mà trang vẫn bị chặn. */
class HetGio extends Error {
  constructor(loi) {
    super(loi);
    this.loi = loi;
  }
}

/* ---------------- Nhắn chị ---------------- */
function nhanChi(noiDung) {
  const r = spawnSync('bash', [join(here, 'nhan-chi.sh'), noiDung], { encoding: 'utf8', timeout: 90000 });
  if (r.error) log('Không nhắn được chị (máy này không có nhan-chi.sh chạy được):', noiDung.split('\n')[0]);
}

/* ---------------- Việc của hôm nay ---------------- */
const viecs = L.lapViec(now);
const shops = L.SHOPS.filter((s) => !CHI_SHOP || s.ten === CHI_SHOP);
if (LAP_VIEC) {
  console.log(`Ngày chạy (giờ VN): ${L.ymd(L.vnParts(now).y, L.vnParts(now).m, L.vnParts(now).d)} · khung cấm: ${L.trongKhungCam(now) ? 'ĐANG TRONG khung cấm' : 'không'}`);
  if (!viecs.length) console.log('Hôm nay không có việc gì.');
  for (const v of viecs) {
    console.log(`Tháng ${v.ky} (${v.loai === 'du' ? 'ĐỦ THÁNG, chốt sổ' : 'giữa tháng'})`);
    for (const s of shops) for (const f of L.fileCanCo(v, s.ten)) console.log(`  ${s.ten}: ${f.ten}`);
  }
  process.exit(0);
}
if (!EP && !DANG_NHAP && L.trongKhungCam(now)) {
  log('Đang trong khung cấm của hàng chờ trình duyệt (7h–8h30 thứ Hai và ngày 10). Bỏ lượt này, không làm gì.');
  process.exit(0);
}

/* ---------------- Mỗi lần chỉ một phiên ---------------- */
mkdirSync(dirname(KHOA), { recursive: true });
if (existsSync(KHOA)) {
  const pid = Number(readFileSync(KHOA, 'utf8'));
  let song = false;
  try {
    process.kill(pid, 0);
    song = true;
  } catch {
    /* tiến trình cũ đã chết */
  }
  if (song) {
    log(`Đang có một phiên khác chạy (pid ${pid}). Bỏ lượt này.`);
    process.exit(0);
  }
}
writeFileSync(KHOA, String(process.pid));
const nha = () => {
  try {
    unlinkSync(KHOA);
  } catch {
    /* đã gỡ */
  }
};
process.on('exit', nha);
for (const sg of ['SIGINT', 'SIGTERM']) process.on(sg, () => process.exit(130));

/* ---------------- Trình duyệt riêng của máy chủ ---------------- */
async function moTrinhDuyet() {
  const { chromium } = await import('playwright-core');
  if (process.env.TAI_SHOPEE_CDP) {
    const b = await chromium.connectOverCDP(process.env.TAI_SHOPEE_CDP);
    return { ctx: b.contexts()[0] || (await b.newContext({ acceptDownloads: true })), dong: async () => b.close() };
  }
  mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: !(DANG_NHAP || process.env.TAI_SHOPEE_HEADED),
    executablePath: process.env.TAI_SHOPEE_CHROME || undefined,
    channel: process.env.TAI_SHOPEE_CHROME ? undefined : 'chrome',
    viewport: { width: 1366, height: 820 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    acceptDownloads: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  return { ctx, dong: async () => ctx.close() };
}

/* ---------------- Thao tác như người ---------------- */
/** Bấm bằng chuột thật: cuộn tới nút, đưa chuột tới từ từ, dừng một chút, rồi nhấn. Không dùng .click() trong JS. */
async function bam(page, loc, nhan) {
  const el = loc.first();
  try {
    await el.waitFor({ state: 'visible', timeout: 20000 });
  } catch {
    throw new LoiTrang(`Không thấy nút "${nhan}" trên trang ${page.url().slice(0, 80)}`);
  }
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  if (!b) throw new LoiTrang(`Nút "${nhan}" không có vị trí`);
  const x = b.x + b.width * (0.3 + 0.4 * Math.random());
  const y = b.y + b.height * (0.3 + 0.4 * Math.random());
  await page.mouse.move(x, y, { steps: 12 + Math.floor(Math.random() * 10) });
  await page.waitForTimeout(250 + Math.floor(Math.random() * 400));
  await page.mouse.click(x, y, { delay: 60 + Math.floor(Math.random() * 90) });
  await choNhuNguoi(page);
}

async function docTrang(page) {
  try {
    const t = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    return { url: page.url(), text: t };
  } catch {
    return { url: page.url(), text: '' };
  }
}

/**
 * Gác cổng: trang có đang bị chặn (mật khẩu / kéo hình / đăng nhập) không.
 * Bị chặn thì nhắn chị MỘT lần rồi chỉ NHÌN (mỗi phút), chờ tối đa 30 phút; không chạm gì vào trang.
 * Hết chặn thì trả về (làm tiếp từ bước đang dở); hết giờ thì ném HetGio.
 */
async function canhGac(page, ngu_canh) {
  let loi = L.nhanChan(...Object.values(await docTrang(page)));
  if (!loi) return;
  const han = new Date(Date.now() + L.CHO_CHI_PHUT * 60000);
  log(`Trang bị chặn (${loi}) ở ${ngu_canh.file}. Đã nhắn chị, chờ tới ${L.gioVN(han)}.`);
  nhanChi(L.tinNhan(loi, { ...ngu_canh, gio: L.gioVN(han), xem: XEM }));
  while (Date.now() < han.getTime()) {
    await ngu(60000);
    loi = L.nhanChan(...Object.values(await docTrang(page)));
    if (!loi) {
      log('Chị đã xử lý xong, làm tiếp.');
      await choNhuNguoi(page);
      return;
    }
  }
  throw new HetGio(loi);
}

const LYDO = { MAT_KHAU: 'Shopee đòi nhập mật khẩu mà chị chưa nhập kịp', CAPTCHA: 'Shopee hiện hộp kiểm tra kéo hình mà chị chưa kéo kịp', DANG_NHAP: 'Shopee bắt đăng nhập lại mà chưa ai đăng nhập' };

/* ---------------- Từng bước trên Kênh Người bán ---------------- */
async function dungShop(page, shop, ctx) {
  await page.goto('https://banhang.shopee.vn/portal/sale/order', { waitUntil: 'domcontentloaded' });
  await choNhuNguoi(page);
  await canhGac(page, ctx);
  const t = await docTrang(page);
  if (L.coTenShop(t.text, shop)) return;
  log(`Chuyển sang shop ${shop} (một lần).`);
  await page.goto('https://banhang.shopee.vn/portal/shop', { waitUntil: 'domcontentloaded' });
  await choNhuNguoi(page);
  await canhGac(page, ctx);
  const dong = page.locator('tr, li, div[class*="shop"]').filter({ hasText: new RegExp(`(^|[^\\w.-])${shop}(?![\\w-])`, 'i') }).filter({ has: page.getByText('Chi tiết') });
  await bam(page, dong.last().getByText('Chi tiết'), `Chi tiết (${shop})`);
  await page.waitForLoadState('domcontentloaded');
  await choNhuNguoi(page);
  await canhGac(page, ctx);
}

/** Chọn khoảng ngày trong ô ngày đang mở: gõ từng ô, rồi ĐỌC LẠI để chắc đã nhận đúng, sai thì dừng (không tải nhầm kỳ). */
async function chonNgay(page, vung, from, to) {
  const o = vung.locator('input[placeholder*="Ngày"], input[placeholder*="ngày"], .eds-date-picker input, .eds-input__input').filter({ visible: true });
  const n = await o.count();
  if (n < 2) throw new LoiTrang('Không thấy 2 ô chọn ngày');
  for (const [i, iso] of [[0, from], [1, to]]) {
    await bam(page, o.nth(i), `ô ngày ${i + 1}`);
    await page.keyboard.press('Control+A');
    await page.keyboard.type(L.ngayVN(iso), { delay: 90 + Math.floor(Math.random() * 80) });
    await page.keyboard.press('Enter');
    await choNhuNguoi(page);
  }
  const g = [await o.nth(0).inputValue().catch(() => ''), await o.nth(1).inputValue().catch(() => '')];
  if (!L.oNgayDung(g[0], from) || !L.oNgayDung(g[1], to)) throw new LoiTrang(`Ô ngày không nhận đúng (đọc lại được: "${g[0]}" – "${g[1]}", cần ${from} – ${to})`);
}

/** Bấm một nút tải và nhận file bằng sự kiện tải của trình duyệt máy chủ (không có hộp Save As, không đụng máy chị). */
async function taiVe(page, nut, nhan, dich) {
  mkdirSync(dirname(dich), { recursive: true });
  const cho = page.waitForEvent('download', { timeout: 120000 });
  await bam(page, nut, nhan);
  const dl = await cho.catch(() => null);
  if (!dl) throw new LoiTrang(`Bấm "${nhan}" nhưng Shopee không trả file`);
  const tam = `${dich}.tai`;
  await dl.saveAs(tam);
  giaiNenNeuCan(tam, dich);
}
/** File Doanh thu Shopee là .zip: giữ file "Income…", bỏ file "shopee_xi…". */
function giaiNenNeuCan(tam, dich) {
  const dau = readFileSync(tam).subarray(0, 2).toString();
  const laZipChuaXlsx =
    dau === 'PK' &&
    spawnSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);n=z.namelist();sys.exit(0 if any(x.lower().endswith(".xlsx") for x in n) and not any(x.startswith("xl/") for x in n) else 1)', tam]).status === 0;
  if (!laZipChuaXlsx) return renameSync(tam, dich);
  const r = spawnSync('python3', ['-c', 'import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1]);L=sorted([n for n in z.namelist() if n.lower().endswith(".xlsx")],key=lambda n:("shopee_xi" in n.lower(),n))\nopen(sys.argv[2],"wb").write(z.read(L[0]))', tam, dich]);
  unlinkSync(tam);
  if (r.status !== 0) throw new LoiTrang('Không giải nén được file Doanh thu');
}

async function choBaoCaoXong(page) {
  for (let i = 0; i < 20; i++) {
    const t = (await docTrang(page)).text;
    if (!/Đang được xử lý|Đang xử lý/i.test(t)) return;
    await ngu(15000);
  }
  throw new LoiTrang('Báo cáo Shopee xử lý quá 5 phút chưa xong');
}

async function taiMotFile(page, f, shop, dich, ctx) {
  const c = { ...ctx, file: { ord: 'Đơn hàng', inc: 'Doanh thu', ads: 'Quảng cáo' }[f.loai] };
  if (f.loai === 'inc') {
    await page.goto(L.urlDoanhThu(f.from, f.to), { waitUntil: 'domcontentloaded' });
    await choNhuNguoi(page);
    await canhGac(page, c); // Shopee đòi mật khẩu ở đây, mỗi shop một lần
    await bam(page, page.getByRole('button', { name: /^Xuất/ }), 'Xuất');
    await canhGac(page, c);
    await choBaoCaoXong(page);
    return taiVe(page, page.getByText(/^Tải về$/), 'Tải về', dich);
  }
  if (f.loai === 'ord') {
    await page.goto('https://banhang.shopee.vn/portal/sale/order', { waitUntil: 'domcontentloaded' });
    await choNhuNguoi(page);
    await canhGac(page, c);
    await bam(page, page.getByRole('button', { name: /^Xuất/ }), 'Xuất');
    await chonNgay(page, page.locator('.eds-modal, [role="dialog"]'), f.from, f.to);
    await bam(page, page.locator('.eds-modal, [role="dialog"]').getByRole('button', { name: /^Xuất$/ }), 'Xuất (trong hộp)');
    await canhGac(page, c);
    await choBaoCaoXong(page);
    return taiVe(page, page.getByText(/^Tải về$/), 'Tải về', dich);
  }
  await page.goto('https://banhang.shopee.vn/portal/marketing/pas/wallet?tab=ads_credit_bill_label', { waitUntil: 'domcontentloaded' });
  await choNhuNguoi(page);
  await canhGac(page, c);
  await chonNgay(page, page.locator('body'), f.from, f.to);
  return taiVe(page, page.getByText(/Tải dữ liệu/), 'Tải dữ liệu', dich);
}

/* ---------------- Nạp ---------------- */
function chayNap(files, thu) {
  const a = [join(here, 'nap-shopee.mjs'), '--as', AS, ...files];
  if (thu) a.push('--thu');
  const r = spawnSync('node', a, { encoding: 'utf8', timeout: 300000 });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/* ---------------- Một shop trong một việc ---------------- */
async function xuLyShop(page, v, shop) {
  const dir = join(GOC, v.ky, 'spe');
  mkdirSync(dir, { recursive: true });
  const can = L.fileCanCo(v, shop);
  for (const n of L.fileCuCanXoa(readdirSync(dir), can, shop)) rmSync(join(dir, n), { force: true });
  let thieu = L.fileConThieu(readdirSync(dir), can);
  const ctx = { shop, ky: v.ky };
  if (thieu.length) {
    // Doanh thu 01→09 tháng sau trùng với Doanh thu tháng đang chạy: dùng lại bản đã tải, đỡ bấm thêm trên Shopee.
    for (const f of thieu.filter((x) => x.loai === 'inc')) {
      const nguon = join(DUNG_LAI, f.ten);
      if (existsSync(nguon)) copyFileSync(nguon, join(dir, f.ten));
    }
    thieu = L.fileConThieu(readdirSync(dir), can);
  }
  if (thieu.length) {
    await dungShop(page, shop, { ...ctx, file: 'đầu tiên' });
    for (const f of thieu) {
      log(`Shopee ${shop} · tải ${f.ten}`);
      await taiMotFile(page, f, shop, join(dir, f.ten), ctx);
      if (f.loai === 'inc') {
        mkdirSync(DUNG_LAI, { recursive: true });
        copyFileSync(join(dir, f.ten), join(DUNG_LAI, f.ten));
      }
      await choNhuNguoi(page);
    }
  }
  const dayDu = L.fileConThieu(readdirSync(dir), can).length === 0;
  if (!dayDu) throw new LoiTrang('Còn thiếu file sau khi tải');
  const files = can.map((f) => join(dir, f.ten));
  // Cổng an toàn: chạy thử trước, thấy đúng shop và không lỗi mới được nạp thật.
  const thu = chayNap(files, true);
  if (!thu.ok) throw new LoiTrang(`Chạy thử nạp báo lỗi: ${thu.out.trim().split('\n').slice(-2).join(' / ')}`);
  if (!new RegExp(`Shopee ${shop} tháng`).test(thu.out)) throw new LoiTrang(`Chạy thử không ra đúng shop ${shop}: file tải về có thể của shop khác`);
  const tomTat = thu.out.split('\n').find((l) => /Doanh thu thực/.test(l))?.trim() || '';
  let nhan = `chạy thử OK. ${tomTat}`;
  if (!THU) {
    const that = chayNap(files, false);
    if (!that.ok) throw new LoiTrang(`Nạp thật báo lỗi: ${that.out.trim().split('\n').slice(-2).join(' / ')}`);
    nhan = `đã nạp lên web. ${tomTat}`;
    nhanChi(L.tinXong(shop, v.ky, tomTat.replace(/\s*·\s*/g, ', ')));
  }
  if (!GIU_FILE) for (const f of can) rmSync(join(dir, f.ten), { force: true });
  return nhan;
}

/* ---------------- Chạy ---------------- */
if (DANG_NHAP) {
  const { ctx, dong } = await moTrinhDuyet();
  const p = ctx.pages()[0] || (await ctx.newPage());
  await p.goto('https://banhang.shopee.vn/', { waitUntil: 'domcontentloaded' });
  log('Đã mở Kênh Người bán. Đăng nhập xong thì đóng cửa sổ trình duyệt (tối đa 60 phút).');
  await Promise.race([new Promise((r) => ctx.on('close', r)), ngu(3600000)]);
  await dong().catch(() => {});
  process.exit(0);
}

if (!viecs.length) {
  log('Hôm nay không có việc gì.');
  process.exit(0);
}
const ketQua = [];
const { ctx: bc, dong } = await moTrinhDuyet();
const page = bc.pages()[0] || (await bc.newPage());
try {
  for (const v of viecs) {
    for (const s of shops) {
      try {
        const kq = await xuLyShop(page, v, s.ten);
        ketQua.push({ ky: v.ky, shop: s.ten, ok: true, kq });
        log(`Shopee ${s.ten} tháng ${v.ky}: ${kq}`);
      } catch (e) {
        const lyDo = e instanceof HetGio ? `${LYDO[e.loi] || 'trang bị chặn'} (đã chờ ${L.CHO_CHI_PHUT} phút)` : e instanceof LoiTrang ? e.message : `lỗi ngoài dự kiến: ${String(e.message || e).slice(0, 160)}`;
        ketQua.push({ ky: v.ky, shop: s.ten, ok: false, kq: lyDo });
        log(`BỎ Shopee ${s.ten} tháng ${v.ky}: ${lyDo}`);
        if (e instanceof HetGio) nhanChi(L.tinBo(s.ten, v.ky, LYDO[e.loi] || 'trang bị chặn'));
        else nhanChi(L.tinNhan('', { shop: s.ten, ky: v.ky, file: lyDo.slice(0, 100) }));
        // File đã tải giữ nguyên trong thư mục để lượt sau tải bù.
      }
    }
  }
} finally {
  rmSync(DUNG_LAI, { recursive: true, force: true }); // có tên khách trong file Doanh thu
  await dong().catch(() => {});
}
console.log('--- Tổng kết ---');
for (const k of ketQua) console.log(`${k.ok ? 'OK ' : 'BỎ '} Shopee ${k.shop} ${k.ky}: ${k.kq}`);
process.exit(ketQua.some((k) => !k.ok) ? 2 : 0);

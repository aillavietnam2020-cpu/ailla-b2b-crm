/**
 * Tạo file SQL nạp số liệu báo cáo vào bảng hub_blobs (D1), để trang /hub/ tải sau khi đăng nhập.
 *
 *   HUB_DATA_DIR=<thư mục số liệu> node hub/blobs-sql.mjs <file .sql đầu ra>
 *   npx wrangler d1 execute ailla_crm_prod --remote --env production --file <file .sql đầu ra>
 *
 * File .sql chứa số liệu kinh doanh: đặt ở thư mục tạm, KHÔNG để trong kho code hay ổ Google Drive.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const DATA = process.env.HUB_DATA_DIR;
const out = process.argv[2];
if (!DATA || !out) {
  console.error('Cách dùng: HUB_DATA_DIR=<thư mục> node hub/blobs-sql.mjs <file .sql>');
  process.exit(1);
}

// [khoá trong hub_blobs, file nguồn, chỉ CEO xem]
const ITEMS = [
  ['t9file', 't9file.json', 0], // báo cáo video TikTok tuần, trợ lý AI của team dùng
  ['t9', null, 0], // kế hoạch + doanh thu tháng 9 theo SKU, lead dùng ở Kế hoạch › Bước 1
  ['kd', 'kinhdoanh.json', 1], // doanh thu, lãi lỗ các kênh: chỉ CEO + kế toán
  ['kd_ads', 'kd_ads', 0], // số Ads Facebook cho team Digital (chi, đơn, doanh số Ads từng người)
  ['kd_sale', 'kd_sale', 0], // số bán hàng cho Sale B2C (doanh thu, đơn, chốt, hủy, hoàn), không có giá vốn/lãi
  ['skucost', 'skucost.json', 1], // giá vốn SKU
  ['nhansu0', 'nhansu0.json', 1], // danh sách nhân sự ban đầu (không có lương)
];

const readJson = (file) => {
  const p = path.join(DATA, file);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
};

// Kế hoạch tháng 9 (thẻ video, kho) + doanh thu tháng 9 theo SKU (ước theo tuần 24-30/9 x 30/7),
// dùng ở Kế hoạch › Bước 1 và khi khởi tạo dữ liệu.
const guess = (t) => {
  t = String(t || '').toLowerCase();
  const map = [[['vạn năng', 'bột tẩy'], 'BT'], [['tinh dầu'], 'TD'], [['ruồi'], 'XR'], [['muỗi'], 'XM'], [['sáp'], 'SAP'],
    [['arila'], 'AR'], [['lồng'], 'TL'], [['nước giặt'], 'NG'], [['lau sàn'], 'LS']];
  for (const [keys, k] of map) if (keys.some((x) => t.includes(x))) return k;
  return null;
};
function t9Blob() {
  const t9file = readJson('t9file.json');
  const t9 = readJson('t9.json');
  if (!t9file && !t9) return null;
  const base = {};
  for (const r of t9file?.recs ?? []) {
    const k = guess(r[3]) || guess(r[2]) || 'KHAC';
    base[k] = (base[k] || 0) + r[7];
  }
  for (const k of Object.keys(base)) base[k] = Math.round((base[k] * 30) / 7 / 1e6) * 1e6;
  return { base, raw: { cards: t9?.cards ?? [], kho: t9?.kho ?? [] } };
}

// Phần cắt ra từ kinhdoanh.json cho từng nhóm, không kèm doanh thu tổng, giá vốn, lãi lỗ.
function kdPart(kind) {
  const kd = readJson('kinhdoanh.json');
  if (!kd) return null;
  if (kind === 'kd_ads') {
    const { adsPeople, adsProd, adsTran, adsMonths, adsChiDay } = kd;
    return { adsPeople, adsProd, adsTran, adsMonths, adsChiDay, day: { ads: kd.day?.ads ?? {} } };
  }
  // Sale cần doanh thu để làm việc (doanh thu chốt, doanh thu từng bạn, giá trị đơn) nhưng KHÔNG thấy
  // giá vốn / lãi: bỏ cột giá vốn (vị trí 7) trong số Facebook theo ngày.
  const fbDay = Object.fromEntries(Object.entries(kd.day?.fb ?? {}).map(([d, r]) => [d, r.map((v, i) => (i === 7 ? 0 : v))]));
  return { fbSale: kd.fbSale ?? [], fbHist: kd.fbHist ?? [], day: { fb: fbDay } };
}

const now = new Date().toISOString();
const lines = [];
for (const [key, file, adminOnly] of ITEMS) {
  const value = file?.startsWith('kd_') ? kdPart(file) : file ? readJson(file) : t9Blob();
  if (!value) {
    console.warn(`[hub] bỏ qua ${key} (không có số liệu)`);
    continue;
  }
  const json = JSON.stringify(value);
  const b64 = gzipSync(Buffer.from(json, 'utf8')).toString('base64');
  lines.push(
    `INSERT INTO hub_blobs (key, data, admin_only, updated_at) VALUES ('${key}', '${b64}', ${adminOnly}, '${now}') ` +
      `ON CONFLICT (key) DO UPDATE SET data = excluded.data, admin_only = excluded.admin_only, updated_at = excluded.updated_at;`,
  );
  console.info(`[hub] ${key}: ${Math.round(b64.length / 1024)} KB`);
}
writeFileSync(out, lines.join('\n') + '\n');
console.info(`[hub] đã ghi ${out}`);

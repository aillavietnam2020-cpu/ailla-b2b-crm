#!/usr/bin/env node
/*
 * nap-shopee — agent Kế toán trưởng nạp báo cáo Shopee (2 shop: Mall aillavn + thường aillavn1) vào web ABOS (làm 28/10/2026).
 * Đọc file đơn hàng, Tài chính › Doanh thu, Lịch sử giao dịch Dịch vụ Hiển thị (quảng cáo) NGAY TRÊN MÁY NÀY bằng đúng công thức
 * của trang Shopee trên web (specalc.js, spebom.js chép nguyên từ hub/src), rồi chỉ gửi số đã tính lên web.
 * Không gửi mã đơn, tên, số điện thoại, địa chỉ khách.
 *
 *   node nap-shopee.mjs --as AGENT_ID file… [--thu]
 * Mỗi shop cần file đơn + file Tài chính (quảng cáo nên có). Đưa file của cả 2 shop vào một lệnh cũng được:
 * công cụ ghép file đơn với file Tài chính có nhiều mã đơn trùng nhất, quảng cáo theo tên đăng nhập shop.
 *   --thu : chỉ tính và in số, KHÔNG ghi lên web.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = ['ttcalc.js', 'spebom.js', 'specalc.js'].map((f) => readFileSync(join(here, f), 'utf8')).join('\n');
const T = new Function(
  `${src}
  return {ttCsv,ttSheets,ttHead,ttCell,ttMakeCostOf,speKind,speOrderSheet,speReadOrders,speGuessKy,speFinMeta,speReadFin,speReadAds,speBuildMonth,speSummary,speRowsPack,speKey,SPE_BOM};`,
)();

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  if (i < 0) return '';
  const v = args[i + 1] || '';
  args.splice(i, 2);
  return v;
};
const flag = (k) => {
  const i = args.indexOf(k);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const AS = opt('--as');
const thu = flag('--thu');
const URL0 = (process.env.ABOS_URL || 'https://ailla-b2b-crm.aillavietnam2020.workers.dev').replace(/\/$/, '');
const die = (m) => {
  console.error(m);
  process.exit(1);
};
if (!args.length) die('Thiếu file. Cách dùng: node nap-shopee.mjs --as AGENT_ID file_don file_tai_chinh file_quang_cao [--thu]');

let KEY = process.env.ABOS_AGENT_KEY || '';
if (!KEY && /^[\w-]+$/.test(AS)) {
  try {
    KEY = readFileSync(`/root/.config/abos/${AS}.key`, 'utf8').trim();
  } catch {
    /* chưa có khoá */
  }
}
async function call(path, method = 'GET', body) {
  if (!KEY.startsWith('agt_')) die('Agent này chưa có khoá web. Báo chị Hoa dán khoá bằng lệnh abos-khoa.');
  const r = await fetch(URL0 + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) die(`Web từ chối (${r.status}): ${j?.error?.message || j?.message || 'lỗi'}`);
  return j.data;
}

/* Đọc file như trình duyệt: .csv đọc chữ, còn lại đọc Excel. */
function readSheets(p) {
  if (/\.csv$/i.test(p)) return { csv: T.ttCsv(readFileSync(p, 'utf8')) };
  const XLSX = require('xlsx');
  return T.ttSheets(XLSX, XLSX.read(readFileSync(p), { type: 'buffer' }));
}
const U = { orders: [], fin: [], ads: [] };
for (const p of args) {
  const sh = readSheets(p);
  const kind = T.speKind(sh);
  const name = basename(p);
  if (kind === 'orders') U.orders.push({ name, aoa: T.speOrderSheet(sh) });
  else if (kind === 'fin') U.fin.push({ name, sh, meta: T.speFinMeta(sh) });
  else if (kind === 'ads') {
    const A = T.speReadAds(sh.csv);
    if (A.err) die(`${name}: ${A.err}`);
    U.ads.push({ name, A });
  } else die(`File "${name}" không phải file Shopee cần (đơn hàng, Tài chính › Doanh thu, lịch sử giao dịch quảng cáo).`);
}
if (!U.fin.length) die('Thiếu file Tài chính › Doanh thu.');

/* Ghép như trang Shopee (spePair): file đơn không ghi tên shop, ghép với file Tài chính có nhiều mã đơn trùng nhất. */
const ids = (o) => {
  const H = T.ttHead(o.aoa, ['Mã đơn hàng'], 5);
  const s = new Set();
  if (H)
    for (let r = H.at + 1; r < o.aoa.length; r++) {
      const v = T.ttCell((o.aoa[r] || [])[H.ix['Mã đơn hàng']]);
      if (v) s.add(v);
    }
  return s;
};
const pairs = U.fin.map((F) => {
  const keys = Object.keys(T.speReadFin(F.sh, null).ord || {});
  let best = null;
  let bn = 0;
  U.orders.forEach((o) => {
    o.ids = o.ids || ids(o);
    const n = keys.filter((k) => o.ids.has(k)).length;
    if (n > bn) {
      bn = n;
      best = o;
    }
  });
  return { shop: F.meta.shop, F, O: best, ad: U.ads.find((a) => a.A.shop === F.meta.shop) };
});

/* Giá vốn như speCostOf trên web: bảng Quy đổi mã các sàn kênh Shopee trước, thiếu thì định mức của skill. */
const inputs = {};
async function costOfFor(ky) {
  const I = inputs[ky] || (inputs[ky] = await call(`/api/agent/shopee/inputs?ky=${ky}`));
  const items = new Map((I.items || []).map((i) => [String(i.code).toLowerCase(), i]));
  const isPack = (code) => {
    const it = items.get(String(code).toLowerCase());
    return !!it && /đóng gói|hộp|thùng|bao bì/i.test((it.grp || '') + ' ' + (it.name || '')) && it.cls === 'NVL';
  };
  const bomRows = Object.entries(T.SPE_BOM).flatMap(([k, cs]) => cs.map(([code, q]) => ({ sku: k, variant: '', from_day: '', item_label: code, qty: q })));
  const web = T.ttMakeCostOf({ ky, mapRows: I.map, skus: I.skus || [], khoCost: I.kho || {}, isPack });
  const bom = T.ttMakeCostOf({ ky, mapRows: bomRows, skus: I.skus || [], khoCost: I.kho || {}, isPack });
  return (s) => {
    const tries = [() => (s.sv ? web(s.sv, s.sp, s.vr) : null), () => (s.sp ? web(s.sp, null, s.vr) : null), () => web(s.pn, null, s.vr), () => bom(T.speKey(s.pn, s.vr), null, '')];
    let best = null;
    for (const t of tries) {
      const c = t();
      if (!c) continue;
      if (c.u != null) return c;
      if (!best || /^Thiếu/.test(c.why)) best = c;
    }
    return best || { u: null, why: 'Chưa quy đổi mã' };
  };
}

const vn = (n) => Math.round(n || 0).toLocaleString('vi-VN');
const done = [];
for (const p of pairs) {
  if (!p.shop) die(`File ${p.F.name}: không đọc được tên shop (dòng Người Bán).`);
  if (!p.O) die(`Shop ${p.shop}: chưa có file đơn hàng của shop này.`);
  const ky = T.speGuessKy(p.O.aoa);
  const O = T.speReadOrders(p.O.aoa, ky);
  if (O.err) die(`Shop ${p.shop}: ${O.err}`);
  const F = T.speReadFin(p.F.sh, ky);
  if (F.err) die(`Shop ${p.shop}: ${F.err}`);
  if (!p.ad) console.log(`Shop ${p.shop}: KHÔNG có file quảng cáo, quảng cáo tính 0.`);
  const M = T.speBuildMonth({ ky, shop: p.shop, orders: O, fin: F, ads: p.ad ? p.ad.A : null, costOf: await costOfFor(ky) });
  if (M.err) die(M.err);
  const files = { fin: p.F.name, orders: p.O.name, ads: p.ad ? p.ad.name : '' };
  console.log(`Shopee ${p.shop} tháng ${ky.slice(5)}/${ky.slice(0, 4)}${M.den ? ` (giữa tháng, số đến ${M.den.slice(8)}/${M.den.slice(5, 7)})` : ' (đủ tháng)'}`);
  console.log(
    `  Doanh thu thực ${vn(M.dt)} · giá vốn ${vn(M.gv)}${M.dtUocGv ? ` (có ${vn(M.dtUocGv)} doanh thu giá vốn ước, chưa quy đổi mã)` : ''} · phí sàn ${vn(-M.phi)} · quảng cáo ${vn(M.ads)} · lãi sau ads ${vn(M.lg - M.ads)} · ${vn(M.don)} đơn`,
  );
  done.push({ ky, M, files });
}
if (thu) {
  console.log('Chạy thử: chưa ghi gì lên web.');
  process.exit(0);
}
const me = await call('/api/agent/me');
for (const x of done) {
  const data = { rows: T.speRowsPack(x.M), fees: x.M.fees, n: x.M.n, files: x.files, at: new Date().toISOString(), by: me.name };
  await call(`/api/agent/shopee/month/${x.ky}/${encodeURIComponent(x.M.shop)}`, 'PUT', { data, summary: T.speSummary(x.M), files: x.files });
}
console.log(`Đã nạp lên web: Shopee ${done.map((x) => x.M.shop).join(', ')}. Kế toán vẫn khoá sổ trên web như cũ.`);

#!/usr/bin/env node
/*
 * nap-tiktok — agent Kế toán trưởng nạp báo cáo TikTok Shop vào web ABOS (chị Hoa duyệt 25/10/2026).
 * Đọc 3 file kế toán (đơn hàng OrderSKUList, quyết toán income, quảng cáo Campaign) NGAY TRÊN MÁY NÀY bằng đúng công thức
 * của trang Tải file tháng (ttcalc.js chép nguyên từ hub/src/ttcalc.js), rồi chỉ gửi số đã tính lên web.
 * Không gửi tên, số điện thoại, địa chỉ khách.
 *
 *   node nap-tiktok.mjs --as AGENT_ID file1 file2 file3 [--ky 2026-10] [--thu]
 *   --thu : chỉ tính và in số, KHÔNG ghi lên web.
 * Khoá agent: biến ABOS_AGENT_KEY hoặc /root/.config/abos/<AGENT_ID>.key (như lệnh abos).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const T = new Function(
  `${readFileSync(join(here, 'ttcalc.js'), 'utf8')}
  return {ttCsv,ttSheets,ttKind,ttGuessKy,ttReadOrders,ttReadIncome,ttReadCampaign,ttBuildMonth,ttPL,ttSummary,ttMakeCostOf,ttTodo,ttPackPL};`,
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
let ky = opt('--ky');
const thu = flag('--thu');
const URL0 = (process.env.ABOS_URL || 'https://ailla-b2b-crm.aillavietnam2020.workers.dev').replace(/\/$/, '');
const die = (m) => {
  console.error(m);
  process.exit(1);
};
if (!args.length) die('Thiếu file. Cách dùng: node nap-tiktok.mjs --as AGENT_ID file_don_hang file_quyet_toan file_quang_cao [--ky YYYY-MM] [--thu]');

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
const up = {};
for (const p of args) {
  const sh = readSheets(p);
  const kind = T.ttKind(sh);
  if (!['orders', 'income', 'camp'].includes(kind)) die(`File "${basename(p)}" không phải file kế toán cần (đơn hàng, quyết toán, quảng cáo Campaign).`);
  if (kind === 'orders') {
    const a = sh[Object.keys(sh)[0]];
    up.orders = { name: basename(p), aoa: a, ky: T.ttGuessKy(a) };
  } else up[kind] = { name: basename(p), sh };
}
for (const [k, n] of [['orders', 'đơn hàng'], ['income', 'quyết toán (income)'], ['camp', 'quảng cáo Campaign']]) if (!up[k]) die(`Thiếu file ${n}.`);
ky = ky || up.orders.ky;
if (!/^\d{4}-\d{2}$/.test(ky)) die('Không đoán được tháng, thêm --ky YYYY-MM.');

const o = T.ttReadOrders(up.orders.aoa, ky);
if (o.err) die(o.err);
const inc = T.ttReadIncome(up.income.sh, ky);
if (inc.err) die(inc.err);
const camp = T.ttReadCampaign(up.camp.sh[Object.keys(up.camp.sh)[0]]);
if (camp.err) die(camp.err);
const M = T.ttBuildMonth({ ky, orders: o, income: inc, camp });
if (M.err) die(M.err);

/* Giá vốn và chi phí riêng kênh: lấy từ web, tính giống trang Tải file tháng (tsbCostOf, tsbExtra). */
const I = await call(`/api/agent/tiktok/inputs?ky=${ky}`);
const items = new Map((I.items || []).map((i) => [String(i.code).toLowerCase(), i]));
const isPack = (code) => {
  const it = items.get(String(code).toLowerCase());
  return !!it && /đóng gói|hộp|thùng|bao bì/i.test((it.grp || '') + ' ' + (it.name || '')) && it.cls === 'NVL';
};
const costOf = T.ttMakeCostOf({ ky, mapRows: I.map, skus: I.skus || [], khoCost: I.kho || {}, isPack });
const cat = (k) => (I.costCats || []).find((c) => c.k === k) || { n: k };
const extra = (I.costs || [])
  .filter((c) => c.thang === ky && /tik\s*tok/i.test(c.kenh || '') && c.cat !== 'PHI-SAN' && !(c.cat === 'ADS-TT' && /gmv\s*max/i.test(c.note || '')))
  .map((c) => ({ n: cat(c.cat).n + (c.note ? ' · ' + c.note : ''), v: +c.tien || 0 }));
const P = T.ttPL(M, costOf, extra);
const S = T.ttSummary(P);
const vn = (n) => Math.round(n || 0).toLocaleString('vi-VN');
console.log(`Báo cáo TikTok tháng ${ky.slice(5)}/${ky.slice(0, 4)}${S.den ? ` (giữa tháng, số đến ${S.den.slice(8)}/${S.den.slice(5, 7)})` : ' (đủ tháng)'}`);
console.log(`Doanh thu thực ${vn(S.dt)} · giá vốn ${vn(S.gv)} · phí sàn ${vn(-S.phi)} · quảng cáo ${vn(S.ads)} · lãi kênh ${vn(S.lai)} · ${vn(S.don)} đơn`);
if (thu) {
  console.log('Chạy thử: chưa ghi gì lên web.');
  process.exit(0);
}

const me = await call('/api/agent/me');
const files = { orders: up.orders.name, income: up.income.name, camp: up.camp.name };
const data = { ky, M, pl: T.ttPackPL(P), todo: T.ttTodo(P), files, at: new Date().toISOString(), by: me.name };
await call(`/api/agent/tiktok/month/${ky}`, 'PUT', { data, summary: S, files });
const ad = Object.fromEntries(Object.entries(camp.days || {}).filter(([d]) => d.slice(0, 7) === ky));
if (Object.keys(ad).length) await call('/api/agent/tiktok/days', 'PUT', { src: 'ads', days: ad, file: up.camp.name });
console.log(`Đã nạp lên web: Tổng quan › TikTok Shop tháng ${ky.slice(5)}/${ky.slice(0, 4)}. Kế toán vẫn khoá sổ trên web như cũ.`);

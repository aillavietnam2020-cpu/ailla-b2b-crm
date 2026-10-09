/**
 * Đọc file Excel AILLA_Kho_SanXuat_NXT_2026.xlsx (tải từ Google Sheet) và sinh file SQL nạp danh mục vật tư + định mức
 * (và, nếu có --ton-dau, một phiếu tồn đầu từ các dòng đánh "x" ở tab TON_DAU).
 *
 *   node scripts/kho/import-sheet.cjs <file.xlsx> <ra.sql> [--ton-dau yyyy-mm-dd]
 *
 * Chỉ sinh file SQL, KHÔNG ghi vào database nào. Chạy file SQL ở máy thử hoặc (khi chị cho lệnh) lên web chính.
 */
const X = require('xlsx');
const fs = require('node:fs');
const [file, out] = process.argv.slice(2);
const tdIdx = process.argv.indexOf('--ton-dau');
const tdDate = tdIdx > 0 ? process.argv[tdIdx + 1] : null;
if (!file || !out) {
  console.error('Cách dùng: node scripts/kho/import-sheet.cjs <file.xlsx> <ra.sql> [--ton-dau yyyy-mm-dd]');
  process.exit(1);
}
const wb = X.readFile(file);
const rows = (n) => X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
const q = (s) => "'" + String(s ?? '').replace(/'/g, "''") + "'";
const now = new Date().toISOString();
const CLS = { TP: 'TP', HH: 'HH', NVL: 'NVL', BTP: 'BTP', CCDC: 'CCDC', Combo: 'COMBO' };

const items = rows('DM_VATTU').slice(5).filter((r) => r[0]);
const sql = ['-- Sinh bởi scripts/kho/import-sheet.cjs', 'BEGIN;'];
const seenItem = new Set();
for (const r of items) {
  const code = String(r[0]).trim();
  if (seenItem.has(code)) continue;
  seenItem.add(code);
  const min = Number(r[7]) > 0 ? Number(r[7]) : 0;
  sql.push(
    `INSERT OR IGNORE INTO kho_items (code,name,unit,cls,grp,min_stock,active,created_at) VALUES (${q(code)},${q(r[1])},${q(r[4])},${q(CLS[r[5]] || 'NVL')},${q(r[6])},${min},1,${q(now)});`,
  );
}

const bom = rows('DM_DINHMUC').slice(5).filter((r) => r[0] && r[2]);
const merged = new Map();
const dups = [];
bom.forEach((r, i) => {
  const key = r[0] + '|' + r[2];
  if (merged.has(key)) {
    dups.push(`${r[0]} ← ${r[2]}: ${merged.get(key).qty} và ${r[5]}`);
    return; // giữ dòng đầu, báo để chị xem
  }
  merged.set(key, { product: r[0], item: r[2], qty: Number(r[5]), kind: r[6], note: r[7], sort: i });
});
for (const b of merged.values()) {
  if (!(b.qty > 0)) continue;
  sql.push(
    `INSERT OR IGNORE INTO kho_bom (product,item,qty,kind,note,sort) VALUES (${q(b.product)},${q(b.item)},${b.qty},${q(b.kind)},${q(b.note)},${b.sort});`,
  );
}

if (tdDate) {
  const t = rows('TON_DAU').slice(4).filter((r) => r[0] && String(r[4]).trim().toLowerCase() === 'x' && Number(r[3]) > 0 && !/^VÍ DỤ/.test(r[1]));
  const ym = tdDate.slice(2, 4) + tdDate.slice(5, 7);
  sql.push(
    `INSERT INTO kho_docs (no,type,doc_date,partner,ref_no,note,extra,status,created_at) VALUES ('TD${ym}-001','TD',${q(tdDate)},'','','Tồn đầu (số mẫu để chạy thử, kế toán nhập lại)','{}','OK',${q(now)});`,
  );
  for (const r of t) {
    if (!seenItem.has(String(r[0]).trim())) continue;
    sql.push(
      `INSERT INTO kho_moves (doc_id,item,qty,role) VALUES ((SELECT id FROM kho_docs WHERE no='TD${ym}-001'),${q(String(r[0]).trim())},${Number(r[3])},'IN');`,
    );
  }
}
sql.push('COMMIT;');
fs.writeFileSync(out, sql.join('\n') + '\n');
console.log(`${seenItem.size} mã vật tư, ${merged.size} dòng định mức${tdDate ? ', có tồn đầu mẫu' : ''} → ${out}`);
if (dups.length) console.log('Dòng định mức bị lặp (giữ dòng đầu):\n  ' + dups.join('\n  '));

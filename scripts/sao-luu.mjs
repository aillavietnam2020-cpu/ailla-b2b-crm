#!/usr/bin/env node
/**
 * Sao lưu toàn bộ dữ liệu web (CRM + Trang quản trị) về máy, mỗi đêm một bản, giữ 60 ngày.
 * Chạy tự động bằng Task Scheduler ("Ailla - Sao luu web", 00:30). Chạy tay: node scripts/sao-luu.mjs
 *
 * Máy chủ đưa dữ liệu qua /api/backup với khoá riêng (BACKUP_KEY, cất ở %USERPROFILE%\.ailla-sao-luu.json,
 * không nằm trong code, không để trên Drive). Kết quả là file .sql.gz: đủ để dựng lại database.
 * Khôi phục: giải nén rồi `wrangler d1 execute <db mới> --remote --file <file.sql>`.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OUT = process.env.SAO_LUU_DIR || 'F:\\SAO-LUU-WEB-AILLA';
const KEEP_DAYS = 60;
const cfg = JSON.parse(readFileSync(join(homedir(), '.ailla-sao-luu.json'), 'utf8'));

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const log = (msg) => {
  const line = `${new Date().toLocaleString('vi-VN')}  ${msg}`;
  console.log(line);
  appendFileSync(join(OUT, 'nhat-ky.txt'), line + '\r\n');
};

async function get(path) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(cfg.url.replace(/\/$/, '') + '/api/backup' + path, {
        headers: { 'X-Backup-Key': cfg.key },
        signal: AbortSignal.timeout(60000),
      });
      const j = await res.json();
      if (!res.ok) throw new Error((j.error && j.error.message) || `HTTP ${res.status}`);
      return j.data;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 20000));
    }
  }
}

const lit = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return "'" + String(v).replace(/'/g, "''") + "'";
};

try {
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }); // YYYY-MM-DD
  const schema = await get('/schema');
  const out = ['PRAGMA defer_foreign_keys = TRUE;'];
  let total = 0;
  for (const s of schema.filter((x) => x.type === 'table')) out.push(s.sql + ';');
  for (const s of schema.filter((x) => x.type === 'table')) {
    for (let offset = 0; offset !== null; ) {
      const page = await get(`/table/${encodeURIComponent(s.name)}?offset=${offset}`);
      for (const row of page.rows) {
        const cols = Object.keys(row);
        out.push(`INSERT INTO "${s.name}" (${cols.map((k) => `"${k}"`).join(',')}) VALUES (${cols.map((k) => lit(row[k])).join(',')});`);
        total += 1;
      }
      offset = page.next;
    }
  }
  for (const s of schema.filter((x) => x.type !== 'table')) out.push(s.sql + ';');
  const file = join(OUT, `ailla-${day}.sql.gz`);
  writeFileSync(file, gzipSync(out.join('\n') + '\n'));
  log(`Đã sao lưu: ailla-${day}.sql.gz (${schema.filter((x) => x.type === 'table').length} bảng, ${total} dòng, ${Math.round(statSync(file).size / 1024)} KB)`);
} catch (e) {
  log('SAO LƯU THẤT BẠI: ' + e.message);
  process.exit(1);
}

// Xoá bản cũ hơn 60 ngày.
const cutoff = Date.now() - KEEP_DAYS * 864e5;
for (const f of readdirSync(OUT)) {
  const m = /^ailla-(\d{4}-\d{2}-\d{2})\.sql\.gz$/.exec(f);
  if (m && Date.parse(m[1]) < cutoff) {
    unlinkSync(join(OUT, f));
    log(`Xoá bản cũ: ${f}`);
  }
}

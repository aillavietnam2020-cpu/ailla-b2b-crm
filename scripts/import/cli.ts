/**
 * Công cụ dòng lệnh kiểm tra file CRM Excel TRƯỚC khi import lên hệ thống.
 *   npm run import:preview -- "D:/duong-dan/01-CRM-B2B-AILLA.xlsx"
 *
 * Chỉ đọc file và đối chiếu với mốc tài liệu - KHÔNG ghi vào database.
 * Việc commit phải chạy qua API (cần quyền và ghi audit), xem hướng dẫn ở cuối output.
 */
import { readFileSync } from 'node:fs';
import { computeTotals, reconcile } from '../../src/server/services/import/index';
import { parseWorkbook } from '../../src/server/services/import/parser';
import { DEFAULT_CONFIG } from '../../src/server/lib/settings';

function main(): void {
  const [command, filePath] = process.argv.slice(2);

  if (!command || (command !== 'preview' && command !== 'commit')) {
    console.info('Cách dùng: npm run import:preview -- <đường-dẫn-file.xlsx>');
    process.exit(1);
  }

  if (command === 'commit') {
    console.info(
      [
        'Commit phải chạy qua API để đảm bảo có quyền, có audit và có checksum khớp:',
        '',
        '  1) curl -F "file=@01-CRM-B2B-AILLA.xlsx" https://crm.ailla.vn/api/imports/preview',
        '  2) curl -F "file=@01-CRM-B2B-AILLA.xlsx" -F "batch_id=<id từ bước 1>" \\',
        '          https://crm.ailla.vn/api/imports/commit',
        '',
        'Hoặc dùng màn hình "Import & chất lượng dữ liệu" trong khu quản trị.',
      ].join('\n'),
    );
    return;
  }

  if (!filePath) {
    console.error('Thiếu đường dẫn file.');
    process.exit(1);
  }

  const bytes = readFileSync(filePath);
  const parsed = parseWorkbook(new Uint8Array(bytes));
  const totals = computeTotals(parsed);
  const reconciliation = reconcile(totals, DEFAULT_CONFIG.reconciliationBaseline);

  console.info(`\nFILE: ${filePath}`);
  console.info(`Sheet tìm thấy: ${parsed.sheetsFound.join(', ')}\n`);

  console.info('ĐỐI SOÁT VỚI MỐC TÀI LIỆU');
  for (const line of reconciliation.lines) {
    const status = line.ok ? 'KHỚP' : `LỆCH ${line.diff.toLocaleString('vi-VN')}`;
    console.info(
      `  ${line.label.padEnd(32)} mốc ${String(line.expected).padStart(14)} | file ${String(line.actual).padStart(14)} | ${status}`,
    );
  }

  const errors = parsed.issues.filter((i) => i.severity === 'ERROR');
  const warnings = parsed.issues.filter((i) => i.severity === 'WARNING');
  console.info(`\nLỖI CHẶN: ${errors.length} · CẢNH BÁO: ${warnings.length}`);
  for (const issue of [...errors, ...warnings].slice(0, 30)) {
    console.info(`  [${issue.severity}] ${issue.sheet}${issue.row_no ? ` dòng ${issue.row_no}` : ''}: ${issue.message}`);
  }
  if (parsed.issues.length > 30) {
    console.info(`  … còn ${parsed.issues.length - 30} dòng nữa, xem đầy đủ trong màn hình Import.`);
  }

  console.info(
    `\nKẾT LUẬN: ${reconciliation.ok ? 'File khớp mốc đối soát, có thể commit.' : 'File LỆCH mốc đối soát - phải xử lý trước khi commit.'}\n`,
  );
}

main();

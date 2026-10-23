// Chặn đưa web lên từ một bản chưa chứa `main` mới nhất trên GitHub (23/10: deploy từ nhánh riêng làm mất tính năng của chat khác).
// Chỉ chị Hoa mới được bỏ qua: đặt SKIP_DEPLOY_GUARD=1 khi chạy (các chat KHÔNG tự đặt).
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (process.env.SKIP_DEPLOY_GUARD === '1') {
  console.log('[chặn deploy] bỏ qua theo SKIP_DEPLOY_GUARD=1');
  process.exit(0);
}
try {
  try {
    git('fetch', 'origin', 'main');
  } catch {
    // mất mạng thì vẫn kiểm tra theo bản origin/main đã có trên máy
  }
  const head = git('rev-parse', 'HEAD');
  const main = git('rev-parse', 'origin/main');
  let contains = true;
  try {
    git('merge-base', '--is-ancestor', main, head);
  } catch {
    contains = false;
  }
  if (!contains) {
    console.error(
      [
        '',
        '=== DỪNG: KHÔNG ĐƯA WEB LÊN ===',
        `Bản đang làm (${head.slice(0, 7)}) chưa chứa main mới nhất trên GitHub (${main.slice(0, 7)}).`,
        'Đưa lên lúc này sẽ làm MẤT tính năng của các chat khác đã nằm trong main.',
        'Cách xử lý: git fetch origin && git merge origin/main, chạy lại kiểm tra (tsc, vitest), rồi deploy lại.',
        'Xem docs/QUY-TAC-NHIEU-CHAT.md. Chỉ chị Hoa mới được bỏ qua bằng SKIP_DEPLOY_GUARD=1.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
  console.log(`[chặn deploy] OK: bản đang làm đã chứa main (${main.slice(0, 7)}).`);
} catch (e) {
  console.error('[chặn deploy] không kiểm tra được git:', e instanceof Error ? e.message : e);
  process.exit(1);
}

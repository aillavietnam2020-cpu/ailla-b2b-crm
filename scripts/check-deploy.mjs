// Chốt chặn đưa web lên (nhiều chat cùng làm trên một máy):
//  start   : (1) bản đang làm phải chứa origin/main mới nhất, (2) lấy "khóa" để chỉ một chat đưa web lên tại một thời điểm.
//  final   : sau khi dựng xong, kiểm tra lại (nếu trong lúc dựng có chat khác vừa ghi main thì dừng, không đưa bản cũ lên).
//  release : trả khóa sau khi đưa lên xong.
// Khóa nằm trong thư mục .git dùng chung của mọi thư mục làm việc, tự hết hạn sau 10 phút (phòng khi một lần đưa lên bị lỗi giữa chừng).
// Chỉ chị Hoa mới được bỏ qua: SKIP_DEPLOY_GUARD=1 (các chat KHÔNG tự đặt).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const mode = process.argv[2] || 'start';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const LOCK_MIN = 10;

if (process.env.SKIP_DEPLOY_GUARD === '1') {
  console.log('[chặn deploy] bỏ qua theo SKIP_DEPLOY_GUARD=1');
  process.exit(0);
}

function stop(lines) {
  console.error(['', '=== DỪNG: KHÔNG ĐƯA WEB LÊN ===', ...lines, ''].join('\n'));
  process.exit(1);
}

function lockPath() {
  const dir = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  return path.join(dir, 'deploy.lock');
}

function releaseLock() {
  try {
    fs.unlinkSync(lockPath());
  } catch {
    // không có khóa thì thôi
  }
}

function checkContainsMain() {
  try {
    git('fetch', 'origin', 'main');
  } catch {
    // mất mạng thì vẫn kiểm tra theo bản origin/main đã có trên máy
  }
  const head = git('rev-parse', 'HEAD');
  const main = git('rev-parse', 'origin/main');
  try {
    git('merge-base', '--is-ancestor', main, head);
  } catch {
    return { ok: false, head, main };
  }
  return { ok: true, head, main };
}

try {
  if (mode === 'release') {
    releaseLock();
    console.log('[chặn deploy] đã trả khóa.');
    process.exit(0);
  }

  const r = checkContainsMain();
  if (!r.ok) {
    if (mode === 'final') releaseLock();
    stop([
      `Bản đang làm (${r.head.slice(0, 7)}) chưa chứa main mới nhất trên GitHub (${r.main.slice(0, 7)}).`,
      mode === 'final'
        ? 'Trong lúc dựng, có chat khác vừa ghi main. Đưa bản này lên sẽ làm MẤT tính năng của chat đó.'
        : 'Đưa lên lúc này sẽ làm MẤT tính năng của các chat khác đã nằm trong main.',
      'Cách xử lý: git fetch origin && git merge origin/main, chạy lại kiểm tra (tsc, vitest), rồi deploy lại.',
      'Xem docs/QUY-TAC-NHIEU-CHAT.md. Chỉ chị Hoa mới được bỏ qua bằng SKIP_DEPLOY_GUARD=1.',
    ]);
  }

  if (mode === 'start') {
    const lp = lockPath();
    const mine = JSON.stringify({ at: new Date().toISOString(), head: r.head, cwd: process.cwd() });
    for (let i = 0; i < 2; i++) {
      try {
        fs.writeFileSync(lp, mine, { flag: 'wx' });
        break;
      } catch {
        let held = null;
        try {
          held = JSON.parse(fs.readFileSync(lp, 'utf8'));
        } catch {
          // khóa hỏng thì coi như hết hạn
        }
        const ageMin = held ? (Date.now() - Date.parse(held.at)) / 60000 : Infinity;
        if (ageMin < LOCK_MIN) {
          stop([
            `Đang có một chat khác đưa web lên (từ ${new Date(held.at).toLocaleTimeString('vi-VN')}, thư mục ${held.cwd}).`,
            'Chờ 1–2 phút cho nó xong, rồi git fetch origin && git merge origin/main và thử lại.',
          ]);
        }
        fs.unlinkSync(lp); // khóa cũ đã hết hạn
        if (i === 1) stop(['Không lấy được khóa đưa web lên, thử lại sau.']);
      }
    }
  }
  console.log(`[chặn deploy] ${mode}: OK, bản đang làm đã chứa main (${r.main.slice(0, 7)}).`);
} catch (e) {
  console.error('[chặn deploy] không kiểm tra được git:', e instanceof Error ? e.message : e);
  process.exit(1);
}

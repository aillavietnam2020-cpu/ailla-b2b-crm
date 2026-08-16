import { describe, expect, it } from 'vitest';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { verifyPassword } from '@server/lib/password';

/**
 * Script scripts/set-password.mjs băm mật khẩu bằng node:crypto, còn Worker kiểm tra bằng Web Crypto.
 * Test này bảo đảm hai bên hiểu cùng một định dạng - nếu lệch, người dùng sẽ không đăng nhập được.
 */
describe('Tương thích băm mật khẩu giữa script và Worker', () => {
  it('chuỗi băm do script tạo được Worker chấp nhận', async () => {
    const password = 'ailla2026';
    const salt = randomBytes(16);
    const hash = pbkdf2Sync(password.normalize('NFKC'), salt, 210_000, 32, 'sha256');
    const stored = `pbkdf2$210000$${salt.toString('base64')}$${hash.toString('base64')}`;

    expect(await verifyPassword(password, stored)).toBe(true);
    expect(await verifyPassword('mat-khau-khac', stored)).toBe(false);
  });
});

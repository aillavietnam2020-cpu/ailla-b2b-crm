/**
 * Băm mật khẩu bằng PBKDF2-SHA256 (Web Crypto - chạy được cả trên Workers lẫn Node).
 * Database CHỈ lưu chuỗi băm, không bao giờ lưu mật khẩu gốc.
 * Định dạng lưu: pbkdf2$<iterations>$<salt_base64>$<hash_base64>
 */

const ITERATIONS = 210_000;
const KEY_LENGTH_BITS = 256;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    KEY_LENGTH_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/** So sánh theo thời gian hằng số để không lộ thông tin qua thời gian phản hồi. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const actual = await derive(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

/** Token phiên đăng nhập: ngẫu nhiên 32 byte, chỉ gửi cho trình duyệt một lần. */
export function newSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Quy tắc mật khẩu tối thiểu, thông báo bằng tiếng Việt. */
export function checkPasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự';
  if (!/[a-zA-Z]/.test(password)) return 'Mật khẩu phải có ít nhất một chữ cái';
  if (!/\d/.test(password)) return 'Mật khẩu phải có ít nhất một chữ số';
  if (/^\s|\s$/.test(password)) return 'Mật khẩu không được bắt đầu hoặc kết thúc bằng dấu cách';
  return null;
}

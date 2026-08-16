export function newId(): string {
  return crypto.randomUUID();
}

/** Hash ổn định (SHA-256 hex) - dùng cho checksum file import và request hash idempotency. */
export async function sha256Hex(input: ArrayBuffer | string): Promise<string> {
  const buffer =
    typeof input === 'string' ? new TextEncoder().encode(input).buffer as ArrayBuffer : input;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

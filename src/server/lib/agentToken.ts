/** Khóa của agent: ngẫu nhiên, chỉ lưu bản băm SHA-256; khóa gốc hiện đúng một lần lúc tạo hoặc đổi. */
export const AGENT_TOKEN_PREFIX = 'agt_';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateAgentToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return AGENT_TOKEN_PREFIX + toHex(bytes);
}

export async function hashAgentToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function tokenHint(token: string): string {
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

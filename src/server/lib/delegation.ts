import { hashAgentToken } from './agentToken';

/**
 * Agent ghi dữ liệu thay một người (hiện: chị Thảo ra lệnh cho agent Kế toán trưởng).
 * Giấy ủy quyền sinh ra khi tin của đúng người đó được đưa cho agent; ngắn hạn, giới hạn số lần ghi, chỉ lưu bản băm.
 * Ai khác ra lệnh (Telegram, Zalo, tài khoản khác, kể cả chị Hoa) thì không có giấy nên mọi lệnh ghi đều bị từ chối.
 */
export const DELEGATION_PREFIX = 'dlg_';
export const DELEGATION_TTL_MS = 30 * 60_000;
export const DELEGATION_MAX_USES = 40;

/** Chỉ các nhóm việc chị Hoa đã đồng ý: mua hàng + phiếu chi nhà cung cấp, kho, đơn B2B, thanh toán và công nợ khách. Không bao giờ xóa cứng. */
const ALLOW: Array<{ methods: string[]; re: RegExp }> = [
  { methods: ['GET', 'POST', 'PUT'], re: /^\/api\/hub\/kho\/mh(\/|$)/ },
  { methods: ['GET', 'POST'], re: /^\/api\/hub\/kho\/docs(\/\d+\/cancel)?$/ },
  { methods: ['POST'], re: /^\/api\/hub\/kho\/lots\/[^/]+\/cancel$/ },
  { methods: ['GET', 'POST'], re: /^\/api\/hub\/kho\/items$/ },
  { methods: ['GET', 'PUT'], re: /^\/api\/hub\/kho\/items\/[^/]+$/ },
  { methods: ['GET', 'POST', 'PUT'], re: /^\/api\/orders(\/|$)/ },
  { methods: ['GET', 'POST'], re: /^\/api\/payments(\/(?!.*\/delete$)[^/]+(\/[a-z-]+)?)?$/ },
  { methods: ['GET'], re: /^\/api\/customers(\/|$)/ },
];

export function delegatedPathAllowed(method: string, path: string): boolean {
  if (path.includes('..')) return false;
  return ALLOW.some((a) => a.methods.includes(method) && a.re.test(path));
}

export async function issueDelegation(db: D1Database, agentId: string, userId: string, chatId: number | null): Promise<string> {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const token = DELEGATION_PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const now = new Date();
  await db
    .prepare('INSERT INTO agent_delegations (token_hash, agent_id, user_id, chat_id, expires_at, max_uses, uses, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)')
    .bind(await hashAgentToken(token), agentId, userId, chatId, new Date(now.getTime() + DELEGATION_TTL_MS).toISOString(), DELEGATION_MAX_USES, now.toISOString())
    .run();
  // dọn giấy đã hết hạn quá 1 ngày
  await db.prepare('DELETE FROM agent_delegations WHERE expires_at < ?').bind(new Date(now.getTime() - 86_400_000).toISOString()).run();
  return token;
}

export type DelegationRow = { token_hash: string; agent_id: string; user_id: string; chat_id: number | null; expires_at: string; max_uses: number; uses: number };

/**
 * Ra lệnh qua Telegram: cầu nối thấy tin của người được chỉ định (định danh do OpenClaw ghi, không do agent tự khai) thì tạo giấy phía web.
 * Agent dùng chữ "tg" thay cho giấy; web lấy giấy Telegram còn hiệu lực mới nhất của agent. Mỗi tin Telegram chỉ sinh một giấy.
 */
export const DELEGATION_TG = 'tg';
export async function issueTelegramDelegation(db: D1Database, agentId: string, userId: string, extId: string): Promise<void> {
  const now = new Date();
  await db
    .prepare(
      `INSERT OR IGNORE INTO agent_delegations (token_hash, agent_id, user_id, chat_id, expires_at, max_uses, uses, created_at, source)
       VALUES (?, ?, ?, NULL, ?, ?, 0, ?, 'TG')`,
    )
    .bind('tg:' + (await hashAgentToken(extId)), agentId, userId, new Date(now.getTime() + DELEGATION_TTL_MS).toISOString(), DELEGATION_MAX_USES, now.toISOString())
    .run();
}

/** Giấy hợp lệ: đúng agent, chưa hết hạn, người ra lệnh vẫn đang được chỉ định cho agent này. */
export async function loadDelegation(db: D1Database, token: string, agentId: string): Promise<DelegationRow | null> {
  if (token === DELEGATION_TG) {
    const r = await db
      .prepare(
        `SELECT d.token_hash, d.agent_id, d.user_id, d.chat_id, d.expires_at, d.max_uses, d.uses
         FROM agent_delegations d JOIN agent_delegators g ON g.agent_id = d.agent_id AND g.user_id = d.user_id
         WHERE d.agent_id = ? AND d.source = 'TG' AND d.expires_at > ? AND d.uses < d.max_uses
         ORDER BY d.created_at DESC LIMIT 1`,
      )
      .bind(agentId, new Date().toISOString())
      .first<DelegationRow>();
    return r ?? null;
  }
  if (!token.startsWith(DELEGATION_PREFIX)) return null;
  const hash = await hashAgentToken(token);
  const row = await db
    .prepare(
      `SELECT d.token_hash, d.agent_id, d.user_id, d.chat_id, d.expires_at, d.max_uses, d.uses
       FROM agent_delegations d JOIN agent_delegators g ON g.agent_id = d.agent_id AND g.user_id = d.user_id
       WHERE d.token_hash = ? AND d.agent_id = ?`,
    )
    .bind(hash, agentId)
    .first<DelegationRow>();
  if (!row || row.expires_at < new Date().toISOString()) return null;
  return row;
}

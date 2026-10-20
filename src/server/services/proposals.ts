import { nowIso } from '@shared/datetime';
import {
  PROPOSAL_ENTITY_TYPES,
  PROPOSAL_KINDS,
  PROPOSAL_ROUTES,
  type ProposalEntityType,
  type ProposalRoute,
} from '@shared/agent';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { eventStatement } from '../lib/events';
import { badRequest, forbidden, notFound, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';

export interface ProposalInput {
  kind: string;
  route_to: string;
  entity_type: string;
  entity_id: string;
  title: string;
  body?: string | null;
  payload?: unknown;
  /** Bắt buộc: gọi lại cùng khóa thì không tạo thêm. */
  dedupe_key: string;
  expires_at?: string | null;
}

export interface ProposalRow {
  id: string;
  kind: string;
  status: string;
  agent_id: string;
  agent_name: string | null;
  route_to: ProposalRoute;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  title: string;
  body: string | null;
  payload: unknown;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

const ENTITY_TABLE: Record<ProposalEntityType, { sql: string }> = {
  ORDER: { sql: 'SELECT order_no AS label FROM orders WHERE id = ? AND deleted_at IS NULL' },
  CUSTOMER: { sql: 'SELECT name AS label FROM customers WHERE id = ? AND deleted_at IS NULL' },
  PAYMENT: { sql: 'SELECT id AS label FROM payments WHERE id = ?' },
  KHO_ITEM: { sql: 'SELECT name AS label FROM kho_items WHERE code = ?' },
  PRODUCT: { sql: 'SELECT sku AS label FROM products WHERE id = ? AND deleted_at IS NULL' },
};

/** Quyền cần có để xem xét đề xuất theo từng chức năng. */
const ROUTE_PERMISSION: Record<ProposalRoute, string | null> = {
  DIEU_PHOI: 'order.approve.normal',
  KHO: 'order.kho.process',
  KE_TOAN: 'order.accounting.confirm',
  SALE: null, // sale phụ trách đơn (hoặc quản lý) xem xét
};

function canReview(auth: AuthContext, route: ProposalRoute, ownerId: string | null): boolean {
  if (auth.user.role === 'CEO') return true;
  const perm = ROUTE_PERMISSION[route];
  if (perm) return auth.permissions.includes(perm);
  return ownerId === auth.user.id || auth.permissions.includes('order.approve.normal');
}

export async function createProposal(
  db: D1Database,
  auth: AuthContext,
  input: ProposalInput,
  ctx: { requestId: string; ip: string | null },
): Promise<{ id: string; duplicate: boolean }> {
  if (!(PROPOSAL_KINDS as readonly string[]).includes(input.kind)) {
    throw unprocessable('BAD_KIND', 'Loại đề xuất không hợp lệ', { kind: 'Không hợp lệ' });
  }
  if (!(PROPOSAL_ROUTES as readonly string[]).includes(input.route_to)) {
    throw unprocessable('BAD_ROUTE', 'Nơi nhận đề xuất không hợp lệ', { route_to: 'Không hợp lệ' });
  }
  if (!(PROPOSAL_ENTITY_TYPES as readonly string[]).includes(input.entity_type)) {
    throw unprocessable('BAD_ENTITY', 'Loại đối tượng không hợp lệ', { entity_type: 'Không hợp lệ' });
  }
  const title = (input.title ?? '').trim();
  const dedupe = (input.dedupe_key ?? '').trim();
  if (!title || title.length > 200) throw unprocessable('BAD_TITLE', 'Tiêu đề 1-200 ký tự', { title: 'Không hợp lệ' });
  if (!dedupe || dedupe.length > 160) {
    throw unprocessable('BAD_DEDUPE', 'Cần dedupe_key (tối đa 160 ký tự) để chống tạo trùng', {
      dedupe_key: 'Bắt buộc',
    });
  }

  // Gọi lại cùng dedupe_key: trả đề xuất cũ, không tạo thêm.
  const existing = await db
    .prepare('SELECT id FROM proposals WHERE agent_id = ? AND dedupe_key = ?')
    .bind(auth.user.id, dedupe)
    .first<{ id: string }>();
  if (existing) return { id: existing.id, duplicate: true };

  // Đối tượng phải tồn tại và được tham chiếu bằng ID ổn định, không bằng tên.
  const entity = await db
    .prepare(ENTITY_TABLE[input.entity_type as ProposalEntityType].sql)
    .bind(input.entity_id)
    .first<{ label: string }>();
  if (!entity) throw notFound(`Không tìm thấy ${input.entity_type} có ID này`);

  const id = newId();
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO proposals (id, kind, status, agent_id, route_to, entity_type, entity_id, title, body,
           payload_json, dedupe_key, created_at, expires_at)
         VALUES (?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.kind,
        auth.user.id,
        input.route_to,
        input.entity_type,
        input.entity_id,
        title,
        (input.body ?? '').slice(0, 2000) || null,
        input.payload === undefined ? null : JSON.stringify(input.payload).slice(0, 20000),
        dedupe,
        now,
        input.expires_at ?? null,
      ),
    eventStatement(db, {
      type: 'PROPOSAL_CREATED',
      entityType: 'PROPOSAL',
      entityId: id,
      actorId: auth.user.id,
      actorType: 'AGENT',
      payload: { kind: input.kind, route_to: input.route_to, entity_type: input.entity_type, entity_id: input.entity_id },
    }),
    auditStatement(db, {
      actorId: auth.user.id,
      actorType: 'AGENT',
      action: 'PROPOSAL_CREATED',
      entityType: input.entity_type,
      entityId: input.entity_id,
      after: { proposal_id: id, kind: input.kind, title },
      source: `agent:${auth.user.id}`,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
  return { id, duplicate: false };
}

export async function listProposals(
  db: D1Database,
  auth: AuthContext,
  filters: { status?: string; entityType?: string; entityId?: string; limit?: number },
): Promise<ProposalRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.status) {
    where.push('p.status = ?');
    params.push(filters.status);
  }
  if (filters.entityType) {
    where.push('p.entity_type = ?');
    params.push(filters.entityType);
  }
  if (filters.entityId) {
    where.push('p.entity_id = ?');
    params.push(filters.entityId);
  }
  const rows = await db
    .prepare(
      `SELECT p.*, u.display_name AS agent_name, d.display_name AS decided_by_name,
              CASE p.entity_type
                WHEN 'ORDER' THEN (SELECT order_no FROM orders WHERE id = p.entity_id)
                WHEN 'CUSTOMER' THEN (SELECT name FROM customers WHERE id = p.entity_id)
                WHEN 'KHO_ITEM' THEN (SELECT name FROM kho_items WHERE code = p.entity_id)
                WHEN 'PRODUCT' THEN (SELECT sku FROM products WHERE id = p.entity_id)
                ELSE p.entity_id END AS entity_label,
              CASE p.entity_type
                WHEN 'ORDER' THEN (SELECT owner_id FROM orders WHERE id = p.entity_id)
                WHEN 'CUSTOMER' THEN (SELECT owner_id FROM customers WHERE id = p.entity_id)
                ELSE NULL END AS owner_id
       FROM proposals p
       JOIN users u ON u.id = p.agent_id
       LEFT JOIN users d ON d.id = p.decided_by
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY p.created_at DESC LIMIT ?`,
    )
    .bind(...params, Math.min(filters.limit ?? 100, 300))
    .all<Record<string, unknown>>();

  return (rows.results ?? [])
    .filter((r) => canReview(auth, r.route_to as ProposalRoute, (r.owner_id as string | null) ?? null))
    .map((r) => ({
      id: r.id as string,
      kind: r.kind as string,
      status: r.status as string,
      agent_id: r.agent_id as string,
      agent_name: (r.agent_name as string | null) ?? null,
      route_to: r.route_to as ProposalRoute,
      entity_type: r.entity_type as string,
      entity_id: r.entity_id as string,
      entity_label: (r.entity_label as string | null) ?? null,
      title: r.title as string,
      body: (r.body as string | null) ?? null,
      payload: r.payload_json ? JSON.parse(r.payload_json as string) : null,
      decided_by_name: (r.decided_by_name as string | null) ?? null,
      decided_at: (r.decided_at as string | null) ?? null,
      decision_note: (r.decision_note as string | null) ?? null,
      created_at: r.created_at as string,
    }));
}

/**
 * Người có quyền bấm Chấp nhận / Từ chối. Chấp nhận nghĩa là "đồng ý với đề xuất, tôi sẽ làm";
 * việc thay đổi dữ liệu thật vẫn do người thao tác qua các chức năng có sẵn (có quyền, có nhật ký).
 */
export async function decideProposal(
  db: D1Database,
  auth: AuthContext,
  id: string,
  decision: 'ACCEPTED' | 'REJECTED',
  note: string | null,
  ctx: { requestId: string; ip: string | null },
): Promise<void> {
  const p = await db
    .prepare('SELECT id, status, route_to, entity_type, entity_id, kind FROM proposals WHERE id = ?')
    .bind(id)
    .first<{
      id: string;
      status: string;
      route_to: ProposalRoute;
      entity_type: string;
      entity_id: string;
      kind: string;
    }>();
  if (!p) throw notFound('Không tìm thấy đề xuất');
  if (p.status !== 'PENDING') throw badRequest('PROPOSAL_DECIDED', 'Đề xuất này đã được xử lý.');

  let ownerId: string | null = null;
  if (p.entity_type === 'ORDER') {
    ownerId =
      (await db.prepare('SELECT owner_id FROM orders WHERE id = ?').bind(p.entity_id).first<{ owner_id: string | null }>())
        ?.owner_id ?? null;
  } else if (p.entity_type === 'CUSTOMER') {
    ownerId =
      (await db.prepare('SELECT owner_id FROM customers WHERE id = ?').bind(p.entity_id).first<{ owner_id: string | null }>())
        ?.owner_id ?? null;
  }
  if (!canReview(auth, p.route_to, ownerId)) throw forbidden('Bạn không phải người xem xét đề xuất này.');

  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE proposals SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?
         WHERE id = ? AND status = 'PENDING'`,
      )
      .bind(decision, auth.user.id, now, note, id),
    eventStatement(db, {
      type: 'PROPOSAL_DECIDED',
      entityType: 'PROPOSAL',
      entityId: id,
      actorId: auth.user.id,
      payload: { decision, kind: p.kind, entity_type: p.entity_type, entity_id: p.entity_id },
    }),
    auditStatement(db, {
      actorId: auth.user.id,
      action: decision === 'ACCEPTED' ? 'PROPOSAL_ACCEPTED' : 'PROPOSAL_REJECTED',
      entityType: p.entity_type,
      entityId: p.entity_id,
      before: { status: 'PENDING' },
      after: { status: decision, proposal_id: id },
      reason: note,
      source: `proposal:${id}`,
      approvedBy: auth.user.id,
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
}

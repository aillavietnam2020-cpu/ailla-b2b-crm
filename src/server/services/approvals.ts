import { nowIso } from '@shared/datetime';
import { canDecideApproval } from '@shared/permissions';
import type { ApprovalItem } from '@shared/types';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { badRequest, forbidden, notFound } from '../lib/http';

interface ApprovalRow {
  id: string;
  entity_type: string;
  entity_id: string;
  rule_code: string;
  requester_id: string;
  required_role: 'MANAGER' | 'CEO';
  status: string;
  reason: string | null;
}

export async function listApprovals(
  db: D1Database,
  status: string | undefined,
  limit = 100,
): Promise<ApprovalItem[]> {
  const rows = await db
    .prepare(
      `SELECT a.*, r.display_name AS requester_name, ap.display_name AS approver_name,
              o.order_no AS entity_label, c.name AS customer_name
       FROM approvals a
       JOIN users r ON r.id = a.requester_id
       LEFT JOIN users ap ON ap.id = a.approver_id
       LEFT JOIN orders o ON o.id = a.entity_id AND a.entity_type = 'ORDER'
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE (? IS NULL OR a.status = ?)
       ORDER BY a.created_at DESC LIMIT ?`,
    )
    .bind(status ?? null, status ?? null, limit)
    .all<Record<string, unknown>>();

  return (rows.results ?? []).map((a) => ({
    ...(a as unknown as ApprovalItem),
    entity_label: [a.entity_label, a.customer_name].filter(Boolean).join(' · ') || undefined,
    payload: a.payload_json ? JSON.parse(a.payload_json as string) : null,
  }));
}

/**
 * Duyệt/từ chối một yêu cầu. Đơn chỉ chuyển sang APPROVED khi TẤT CẢ yêu cầu của nó được duyệt.
 * Toàn bộ thay đổi + audit ghi trong cùng một batch (transaction) - mục 11.1.
 */
export async function decideApproval(
  db: D1Database,
  auth: AuthContext,
  approvalId: string,
  decision: 'APPROVED' | 'REJECTED',
  note: string | null,
  ctx: { requestId: string; ip: string | null },
): Promise<{ approval_status: string; order_status?: string }> {
  const approval = await db
    .prepare('SELECT * FROM approvals WHERE id = ?')
    .bind(approvalId)
    .first<ApprovalRow>();
  if (!approval) throw notFound('Không tìm thấy yêu cầu duyệt');
  if (approval.status !== 'PENDING') {
    throw badRequest('APPROVAL_DECIDED', 'Yêu cầu này đã được xử lý.');
  }
  if (!canDecideApproval(auth.user.role, approval.required_role)) {
    throw forbidden(
      approval.required_role === 'CEO'
        ? 'Yêu cầu này vượt ngưỡng Quản lý, chỉ CEO được duyệt.'
        : 'Bạn không có quyền duyệt yêu cầu này.',
    );
  }
  if (approval.requester_id === auth.user.id && auth.user.role !== 'CEO') {
    throw forbidden('Không được tự duyệt yêu cầu do chính mình gửi.');
  }

  const now = nowIso();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE approvals SET status = ?, approver_id = ?, decided_at = ?, decision_note = ? WHERE id = ?`,
      )
      .bind(decision, auth.user.id, now, note, approvalId),
  ];

  let orderStatus: string | undefined;

  if (approval.entity_type === 'ORDER') {
    const order = await db
      .prepare('SELECT id, customer_id, order_date, approval_status FROM orders WHERE id = ?')
      .bind(approval.entity_id)
      .first<{ id: string; customer_id: string; order_date: string; approval_status: string }>();
    if (!order) throw notFound('Đơn hàng của yêu cầu này không còn tồn tại');

    if (decision === 'REJECTED') {
      orderStatus = 'REJECTED';
      statements.push(
        db
          .prepare(
            `UPDATE orders SET approval_status = 'REJECTED', rejected_reason = ?, updated_at = ? WHERE id = ?`,
          )
          .bind(note ?? approval.reason ?? 'Bị từ chối', now, order.id),
        db
          .prepare(
            `UPDATE approvals SET status = 'CANCELLED', decided_at = ? WHERE entity_type = 'ORDER'
             AND entity_id = ? AND status = 'PENDING' AND id <> ?`,
          )
          .bind(now, order.id, approvalId),
        auditStatement(db, {
          actorId: auth.user.id,
          action: 'ORDER_REJECTED',
          entityType: 'ORDER',
          entityId: order.id,
          before: { approval_status: order.approval_status },
          after: { approval_status: 'REJECTED' },
          reason: note,
          requestId: ctx.requestId,
          ip: ctx.ip,
        }),
      );
    } else {
      const pending = await db
        .prepare(
          `SELECT COUNT(*) AS n FROM approvals WHERE entity_type = 'ORDER' AND entity_id = ?
           AND status = 'PENDING' AND id <> ?`,
        )
        .bind(order.id, approvalId)
        .first<{ n: number }>();

      if ((pending?.n ?? 0) === 0) {
        orderStatus = 'APPROVED';
        const priorOrders = await db
          .prepare(
            `SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND approval_status = 'APPROVED'
             AND deleted_at IS NULL AND id <> ?`,
          )
          .bind(order.customer_id, order.id)
          .first<{ n: number }>();
        const nextStage = (priorOrders?.n ?? 0) >= 1 ? 'REGULAR' : 'FIRST_ORDER';

        statements.push(
          db
            .prepare(
              `UPDATE orders SET approval_status = 'APPROVED', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?`,
            )
            .bind(auth.user.id, now, now, order.id),
          db
            .prepare(
              `UPDATE customers SET stage = ?, last_order_date = ?, updated_at = ? WHERE id = ? AND stage <> 'LOST'`,
            )
            .bind(nextStage, order.order_date, now, order.customer_id),
          auditStatement(db, {
            actorId: auth.user.id,
            action: 'ORDER_APPROVED',
            entityType: 'ORDER',
            entityId: order.id,
            before: { approval_status: order.approval_status },
            after: { approval_status: 'APPROVED', customer_stage: nextStage },
            reason: note,
            requestId: ctx.requestId,
            ip: ctx.ip,
          }),
        );
      } else {
        orderStatus = 'PENDING_APPROVAL';
      }
    }
  }

  // Duyệt phiên bản giá do Quản lý đề nghị: kích hoạt bản nháp và đóng giá cũ.
  if (approval.entity_type === 'PRICE_VERSION') {
    const draft = await db
      .prepare('SELECT id, product_id, tier_id, valid_from FROM product_prices WHERE id = ?')
      .bind(approval.entity_id)
      .first<{ id: string; product_id: string; tier_id: string; valid_from: string }>();

    if (draft) {
      if (decision === 'APPROVED') {
        const closeAt = new Date(new Date(`${draft.valid_from}T00:00:00Z`).getTime() - 86_400_000)
          .toISOString()
          .slice(0, 10);
        statements.push(
          db
            .prepare(
              `UPDATE product_prices SET valid_to = ?, updated_at = ?
               WHERE product_id = ? AND tier_id = ? AND status = 'ACTIVE' AND id <> ?
                 AND (valid_to IS NULL OR valid_to >= ?)`,
            )
            .bind(closeAt, now, draft.product_id, draft.tier_id, draft.id, closeAt),
          db
            .prepare(`UPDATE product_prices SET status = 'ACTIVE', updated_at = ? WHERE id = ?`)
            .bind(now, draft.id),
        );
      } else {
        statements.push(db.prepare('DELETE FROM product_prices WHERE id = ?').bind(draft.id));
      }
    }

    statements.push(
      auditStatement(db, {
        actorId: auth.user.id,
        action: decision === 'APPROVED' ? 'PRICE_VERSION_CREATED' : 'PRICE_OVERRIDE_REJECTED',
        entityType: 'PRODUCT_PRICE',
        entityId: approval.entity_id,
        after: { decision, approval_id: approvalId },
        reason: note,
        requestId: ctx.requestId,
        ip: ctx.ip,
      }),
    );
  }

  if (approval.rule_code === 'PRICE_OVERRIDE') {
    statements.push(
      auditStatement(db, {
        actorId: auth.user.id,
        action: decision === 'APPROVED' ? 'PRICE_OVERRIDE_APPROVED' : 'PRICE_OVERRIDE_REJECTED',
        entityType: approval.entity_type,
        entityId: approval.entity_id,
        after: { approval_id: approvalId, decision },
        reason: note,
        requestId: ctx.requestId,
        ip: ctx.ip,
      }),
    );
  }

  await db.batch(statements);
  return { approval_status: decision, order_status: orderStatus };
}

import { nowIso } from '@shared/datetime';
import { canDecideApproval } from '@shared/permissions';
import type { ApprovalItem } from '@shared/types';
import type { AuthContext } from '../env';
import { auditStatement } from '../lib/audit';
import { eventStatement } from '../lib/events';
import { badRequest, forbidden, notFound } from '../lib/http';
import { newId } from '../lib/ids';

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
              o.order_no AS entity_label, COALESCE(c.name, tc.name) AS customer_name
       FROM approvals a
       JOIN users r ON r.id = a.requester_id
       LEFT JOIN users ap ON ap.id = a.approver_id
       LEFT JOIN orders o ON o.id = a.entity_id AND a.entity_type = 'ORDER'
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN customers tc ON tc.id = a.entity_id AND a.entity_type = 'CUSTOMER_TIER'
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
  ctx: { requestId: string; ip: string | null; allowSelfApproval?: boolean },
): Promise<{ approval_status: string; order_status?: string }> {
  const approval = await db
    .prepare('SELECT * FROM approvals WHERE id = ?')
    .bind(approvalId)
    .first<ApprovalRow>();
  if (!approval) throw notFound('Không tìm thấy yêu cầu duyệt');
  if (approval.status !== 'PENDING') {
    throw badRequest('APPROVAL_DECIDED', 'Yêu cầu này đã được xử lý.');
  }
  // Yêu cầu vượt ngưỡng Quản lý: ngoài CEO, người được cấp quyền "duyệt ngoại lệ" (order.approve.exception) cũng duyệt được.
  const exceptionOk = approval.required_role === 'CEO' && auth.permissions.includes('order.approve.exception');
  if (!canDecideApproval(auth.user.role, approval.required_role) && !exceptionOk) {
    throw forbidden(
      approval.required_role === 'CEO'
        ? 'Yêu cầu này vượt ngưỡng Quản lý, chỉ CEO được duyệt.'
        : 'Bạn không có quyền duyệt yêu cầu này.',
    );
  }
  // Công ty nhỏ: một người vừa bán hàng vừa là quản lý. Nếu cấu hình không cho tự duyệt thì
  // vẫn chặn, còn mặc định là cho phép và ghi rõ "tự duyệt" vào nhật ký.
  const selfApproval = approval.requester_id === auth.user.id;
  if (selfApproval && auth.user.role !== 'CEO' && ctx.allowSelfApproval === false) {
    throw forbidden(
      'Cấu hình hiện tại không cho tự duyệt yêu cầu do chính mình gửi. Nhờ người khác duyệt.',
    );
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
      .prepare(
        'SELECT id, customer_id, order_date, approval_status, flow_on, kho_status FROM orders WHERE id = ?',
      )
      .bind(approval.entity_id)
      .first<{
        id: string;
        customer_id: string;
        order_date: string;
        approval_status: string;
        flow_on: number;
        kho_status: string;
      }>();
    if (!order) throw notFound('Đơn hàng của yêu cầu này không còn tồn tại');
    // Kho báo đủ / thiếu hàng có thể làm ngoài hệ thống: người duyệt quyết định, không chặn theo bước kiểm kho.

    if (decision === 'REJECTED') {
      orderStatus = 'REJECTED';
      statements.push(
        db
          .prepare(
            `UPDATE orders SET approval_status = 'REJECTED', rejected_reason = ?, updated_at = ?,
               kho_status = CASE WHEN flow_on = 1 THEN 'CHO_DIEU_PHOI' ELSE kho_status END
             WHERE id = ?`,
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
          reason: selfApproval ? `${note ?? ''} (tự duyệt)`.trim() : note,
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
              `UPDATE orders SET approval_status = 'APPROVED', approved_by = ?, approved_at = ?, updated_at = ?,
                 kho_status = CASE WHEN flow_on = 1 THEN 'CHO_XUAT' ELSE kho_status END
               WHERE id = ?`,
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
            reason: selfApproval ? `${note ?? ''} (tự duyệt)`.trim() : note,
            requestId: ctx.requestId,
            ip: ctx.ip,
          }),
        );
      } else {
        orderStatus = 'PENDING_APPROVAL';
      }
    }
  }

  // Sale xin đổi cấp giá của khách (chưa đạt điều kiện): quản lý / CEO duyệt thì cấp của khách đổi theo.
  if (approval.entity_type === 'CUSTOMER_TIER' && decision === 'APPROVED') {
    const payload = JSON.parse(String((approval as unknown as { payload_json?: string }).payload_json ?? '{}')) as {
      to?: string;
      to_name?: string;
      from?: string | null;
      from_name?: string | null;
    };
    if (payload.to) {
      statements.push(
        db.prepare('UPDATE customers SET tier_id = ?, updated_at = ? WHERE id = ?').bind(payload.to, now, approval.entity_id),
        auditStatement(db, {
          actorId: auth.user.id,
          action: 'CUSTOMER_TIER_CHANGED',
          entityType: 'CUSTOMER',
          entityId: approval.entity_id,
          before: { tier_id: payload.from ?? null, tier: payload.from_name ?? null },
          after: { tier_id: payload.to, tier: payload.to_name ?? null },
          reason: `Duyệt yêu cầu đổi cấp${note ? ': ' + note : ''}`,
          requestId: ctx.requestId,
          ip: ctx.ip,
        }),
      );
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

  if (approval.entity_type === 'ORDER' && (orderStatus === 'APPROVED' || orderStatus === 'REJECTED')) {
    statements.push(
      eventStatement(db, {
        type: orderStatus === 'APPROVED' ? 'ORDER_APPROVED' : 'ORDER_REJECTED',
        entityType: 'ORDER',
        entityId: approval.entity_id,
        actorId: auth.user.id,
        actorType: auth.actorType ?? 'USER',
        payload: { rule_code: approval.rule_code, note },
      }),
    );
  }

  await db.batch(statements);
  // Đơn vừa được duyệt: nếu khách đã đặt cọc thì trừ tiền cọc vào đơn ngay, đơn hiện "đã đặt cọc" rồi mới nạp bill phần còn lại.
  if (approval.entity_type === 'ORDER' && orderStatus === 'APPROVED') {
    try {
      const { applyDepositsToOrder } = await import('./payments');
      await applyDepositsToOrder(db, auth, approval.entity_id, ctx);
    } catch (e) {
      console.error('[deposit] không trừ được cọc khi duyệt đơn', e);
    }
  }
  return { approval_status: decision, order_status: orderStatus };
}

/**
 * Sale xin đổi cấp giá của khách khi đơn / hồ sơ CHƯA đạt điều kiện lên cấp: gửi yêu cầu cho Quản lý hoặc CEO duyệt,
 * duyệt xong cấp của khách mới đổi. Đã có yêu cầu cùng cấp đang chờ thì không tạo trùng.
 */
export async function requestTierChange(
  db: D1Database,
  auth: AuthContext,
  customerId: string,
  toTierId: string,
  reason: string,
  ctx: { requestId: string | null; ip: string | null },
): Promise<{ id: string; duplicate: boolean }> {
  const cust = await db
    .prepare('SELECT c.id, c.name, c.tier_id, t.name AS tier_name FROM customers c LEFT JOIN price_tiers t ON t.id = c.tier_id WHERE c.id = ? AND c.deleted_at IS NULL')
    .bind(customerId)
    .first<{ id: string; name: string; tier_id: string | null; tier_name: string | null }>();
  if (!cust) throw notFound('Không tìm thấy khách hàng');
  const to = await db.prepare('SELECT id, name FROM price_tiers WHERE id = ?').bind(toTierId).first<{ id: string; name: string }>();
  if (!to) throw badRequest('BAD_TIER', 'Cấp giá không tồn tại.');
  if (cust.tier_id === to.id) throw badRequest('SAME_TIER', 'Khách đang ở cấp này rồi.');
  const dup = await db
    .prepare(
      `SELECT id FROM approvals WHERE entity_type = 'CUSTOMER_TIER' AND entity_id = ? AND status = 'PENDING' AND json_extract(payload_json, '$.to') = ?`,
    )
    .bind(customerId, toTierId)
    .first<{ id: string }>();
  if (dup) return { id: dup.id, duplicate: true };
  const id = newId();
  const now = nowIso();
  const text = `Xin đổi cấp giá của khách ${cust.name}: ${cust.tier_name ?? 'chưa có cấp'} lên ${to.name}. ${reason}`.trim();
  await db.batch([
    db
      .prepare(
        `INSERT INTO approvals (id, entity_type, entity_id, rule_code, requester_id, required_role, status, reason, payload_json, created_at)
         VALUES (?, 'CUSTOMER_TIER', ?, 'TIER_CHANGE', ?, 'MANAGER', 'PENDING', ?, ?, ?)`,
      )
      .bind(id, customerId, auth.user.id, text, JSON.stringify({ customer_id: customerId, from: cust.tier_id, from_name: cust.tier_name, to: to.id, to_name: to.name }), now),
    auditStatement(db, {
      actorId: auth.user.id,
      action: 'TIER_CHANGE_REQUESTED',
      entityType: 'CUSTOMER',
      entityId: customerId,
      after: { from: cust.tier_name, to: to.name, reason },
      requestId: ctx.requestId,
      ip: ctx.ip,
    }),
  ]);
  return { id, duplicate: false };
}

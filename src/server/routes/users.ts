import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso } from '@shared/datetime';
import { ROLES } from '@shared/enums';
import { ACCOUNTANT_PERMISSIONS, HUB_ONLY, WAREHOUSE_PERMISSIONS } from '@shared/permissions';
import { zodFieldErrors } from '@shared/schemas';
import type { AppEnv } from '../env';
import { syncAccessEmails } from '../lib/access-sync';
import { auditStatement } from '../lib/audit';
import { badRequest, forbidden, notFound, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { checkPasswordStrength, hashPassword } from '../lib/password';
import { revokeAllSessions } from '../lib/session';
import { requirePermission } from '../middleware/rbac';

const userCreateSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ').max(200),
  display_name: z.string().trim().min(2, 'Tên hiển thị tối thiểu 2 ký tự').max(120),
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Vai trò không hợp lệ' }) }),
  legacy_name: z.string().trim().max(60).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  password: z.string().min(1, 'Nhập mật khẩu ban đầu'),
});

const userUpdateSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ').max(200).optional(),
  display_name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  legacy_name: z.string().trim().max(60).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
});

const setPasswordSchema = z.object({
  password: z.string().min(1, 'Nhập mật khẩu mới'),
  must_change: z.boolean().optional(),
});

export const userRoutes = new Hono<AppEnv>();

/** Đã tách trang quản trị: tạo tài khoản và phân quyền chỉ chủ doanh nghiệp làm được (kế toán không). */
userRoutes.use('*', async (c, next) => {
  if (c.env.ADMIN_HOST && c.get('auth').user.role !== 'CEO') {
    throw forbidden('Chỉ chủ doanh nghiệp được tạo tài khoản và phân quyền.');
  }
  await next();
});

/** Quản lý chỉ được thao tác trên tài khoản nhân viên; CEO thao tác được mọi vai trò. */
function assertCanTouchRole(actorRole: string, targetRole: string) {
  if (actorRole === 'CEO') return;
  if (targetRole !== 'EMPLOYEE') {
    throw forbidden('Chỉ CEO mới được tạo hoặc sửa tài khoản Quản lý/CEO.');
  }
}

userRoutes.get('/', requirePermission('user.manage'), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, email, display_name, role, status, legacy_name, phone, last_login_at,
            password_updated_at, must_change_password,
            CASE WHEN password_hash IS NULL THEN 0 ELSE 1 END AS has_password,
            (SELECT COUNT(*) FROM user_permissions up
              WHERE up.user_id = users.id AND up.permission = 'order.accounting.confirm') AS is_accountant,
            (SELECT COUNT(*) FROM user_permissions up
              WHERE up.user_id = users.id AND up.permission = 'order.kho.process') AS is_warehouse,
            (SELECT COUNT(*) FROM user_permissions up
              WHERE up.user_id = users.id AND up.permission = 'hub.access') AS is_marketing,
            (SELECT COUNT(*) FROM user_permissions up
              WHERE up.user_id = users.id AND up.permission = 'hub.only') AS is_hub_only
     FROM users WHERE deleted_at IS NULL AND kind = 'HUMAN' ORDER BY role, display_name COLLATE NOCASE`,
  ).all();
  return c.json({ data: rows.results ?? [], request_id: c.get('requestId') });
});

userRoutes.post('/', requirePermission('user.manage'), async (c) => {
  const auth = c.get('auth');
  const parsed = userCreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const input = parsed.data;
  assertCanTouchRole(auth.user.role, input.role);

  const strengthError = checkPasswordStrength(input.password);
  if (strengthError) throw unprocessable('WEAK_PASSWORD', strengthError, { password: strengthError });

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE lower(email) = lower(?)')
    .bind(input.email)
    .first<{ id: string }>();
  if (existing) {
    throw badRequest('EMAIL_EXISTS', 'Email này đã có tài khoản', { email: 'Email đã tồn tại' });
  }

  const id = newId();
  const now = nowIso();
  const hash = await hashPassword(input.password);

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (id, email, display_name, role, status, legacy_name, phone,
         password_hash, password_updated_at, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(
      id,
      input.email.toLowerCase(),
      input.display_name,
      input.role,
      input.legacy_name ?? null,
      input.phone ?? null,
      hash,
      now,
      now,
      now,
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: id,
      after: { email: input.email, role: input.role, display_name: input.display_name },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);

  // Mở cửa qt.ailla.vn cho email mới (Cloudflare Access).
  const access = await syncAccessEmails(c.env).catch(() => ({ ok: false, error: 'lỗi mạng' }));
  return c.json({ data: { id, access }, request_id: c.get('requestId') }, 201);
});

/**
 * Bật/tắt gói quyền KẾ TOÁN cho một tài khoản.
 * Kế toán: xác nhận tiền về, phân bổ khoản thu, xem công nợ toàn công ty.
 * Không sửa đơn, không tạo khách - sổ sách chính thức vẫn nằm ở MISA.
 */
userRoutes.post('/:id/accountant', requirePermission('user.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
  const enabled = body.enabled !== false;

  const target = await c.env.DB.prepare(
    'SELECT id, email, display_name FROM users WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(id)
    .first<{ id: string; email: string; display_name: string }>();
  if (!target) throw notFound('Không tìm thấy tài khoản');

  const now = nowIso();
  const statements = enabled
    ? [
        ...ACCOUNTANT_PERMISSIONS.map((permission) =>
          c.env.DB.prepare(
            `INSERT INTO user_permissions (user_id, permission, granted_by, created_at)
             VALUES (?, ?, ?, ?) ON CONFLICT (user_id, permission) DO NOTHING`,
          ).bind(id, permission, auth.user.id, now),
        ),
        // Kế toán cần vào CRM B2B (xác nhận tiền về): bỏ dấu "Chỉ Marketing" nếu có, không thì quyền kế toán vô tác dụng.
        c.env.DB.prepare('DELETE FROM user_permissions WHERE user_id = ? AND permission = ?').bind(id, HUB_ONLY),
        // Kế toán làm việc ở Trang quản trị (kho, bán sàn, hàng hoàn, đối soát): cấp luôn quyền vào đó.
        c.env.DB.prepare(
          `INSERT INTO user_permissions (user_id, permission, granted_by, created_at)
           VALUES (?, 'hub.access', ?, ?) ON CONFLICT (user_id, permission) DO NOTHING`,
        ).bind(id, auth.user.id, now),
      ]
    : [
        c.env.DB.prepare(
          `DELETE FROM user_permissions WHERE user_id = ? AND permission IN (${ACCOUNTANT_PERMISSIONS.map(
            () => '?',
          ).join(',')})`,
        ).bind(id, ...ACCOUNTANT_PERMISSIONS),
      ];

  statements.push(
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      after: { accountant: enabled, email: target.email },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  );
  await c.env.DB.batch(statements);
  return c.json({ data: { ok: true, accountant: enabled }, request_id: c.get('requestId') });
});

/**
 * Bật/tắt gói quyền KHO (kế toán kho): thấy mọi đơn B2B trong luồng kho, kiểm tồn, báo đủ/thiếu, ghi số thực xuất.
 * Chỉ CEO cấp được (user.manage trên địa chỉ quản trị).
 */
userRoutes.post('/:id/warehouse', requirePermission('user.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
  const enabled = body.enabled !== false;

  const target = await c.env.DB.prepare(
    'SELECT id, email FROM users WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(id)
    .first<{ id: string; email: string }>();
  if (!target) throw notFound('Không tìm thấy tài khoản');

  const now = nowIso();
  const statements = enabled
    ? [
        ...WAREHOUSE_PERMISSIONS.map((permission) =>
          c.env.DB.prepare(
            `INSERT INTO user_permissions (user_id, permission, granted_by, created_at)
             VALUES (?, ?, ?, ?) ON CONFLICT (user_id, permission) DO NOTHING`,
          ).bind(id, permission, auth.user.id, now),
        ),
        // Kế toán kho làm việc trong CRM B2B: bỏ dấu "Chỉ Marketing" nếu có.
        c.env.DB.prepare('DELETE FROM user_permissions WHERE user_id = ? AND permission = ?').bind(id, HUB_ONLY),
        // Các trang Kho vật tư, bán sàn, hàng hoàn nằm ở Trang quản trị: cấp luôn quyền vào đó.
        c.env.DB.prepare(
          `INSERT INTO user_permissions (user_id, permission, granted_by, created_at)
           VALUES (?, 'hub.access', ?, ?) ON CONFLICT (user_id, permission) DO NOTHING`,
        ).bind(id, auth.user.id, now),
      ]
    : [
        c.env.DB.prepare(
          `DELETE FROM user_permissions WHERE user_id = ? AND permission IN (${WAREHOUSE_PERMISSIONS.map(
            () => '?',
          ).join(',')})`,
        ).bind(id, ...WAREHOUSE_PERMISSIONS),
      ];

  statements.push(
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      after: { warehouse: enabled, email: target.email },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  );
  await c.env.DB.batch(statements);
  return c.json({ data: { ok: true, warehouse: enabled }, request_id: c.get('requestId') });
});

/**
 * Khu Marketing: 'off' = không vào; 'with_b2b' = vào thêm khu Marketing, vẫn giữ quyền B2B;
 * 'only' = nhân sự Content/Digital, CHỈ vào khu Marketing, mọi dữ liệu B2B bị chặn ở backend.
 */
userRoutes.post('/:id/marketing', requirePermission('user.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode === 'only' || body.mode === 'with_b2b' ? body.mode : 'off';

  const target = await c.env.DB.prepare(
    'SELECT id, email, role FROM users WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(id)
    .first<{ id: string; email: string; role: string }>();
  if (!target) throw notFound('Không tìm thấy tài khoản');
  assertCanTouchRole(auth.user.role, target.role);

  const now = nowIso();
  const grant = (permission: string) =>
    c.env.DB.prepare(
      `INSERT INTO user_permissions (user_id, permission, granted_by, created_at)
       VALUES (?, ?, ?, ?) ON CONFLICT (user_id, permission) DO NOTHING`,
    ).bind(id, permission, auth.user.id, now);
  const statements = [
    c.env.DB.prepare(
      "DELETE FROM user_permissions WHERE user_id = ? AND permission IN ('hub.access', ?)",
    ).bind(id, HUB_ONLY),
  ];
  if (mode !== 'off') statements.push(grant('hub.access'));
  if (mode === 'only') statements.push(grant(HUB_ONLY));
  statements.push(
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      after: { marketing: mode, email: target.email },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  );
  await c.env.DB.batch(statements);
  return c.json({ data: { ok: true, marketing: mode }, request_id: c.get('requestId') });
});

userRoutes.patch('/:id', requirePermission('user.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const parsed = userUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }

  const target = await c.env.DB.prepare(
    'SELECT id, email, display_name, role, status FROM users WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(id)
    .first<{ id: string; email: string; display_name: string; role: string; status: string }>();
  if (!target) throw notFound('Không tìm thấy tài khoản');

  assertCanTouchRole(auth.user.role, target.role);
  if (parsed.data.role) assertCanTouchRole(auth.user.role, parsed.data.role);
  if (target.id === auth.user.id && parsed.data.status === 'DISABLED') {
    throw badRequest('CANNOT_DISABLE_SELF', 'Không thể tự khoá tài khoản của chính mình');
  }
  if (parsed.data.email !== undefined) {
    const email = parsed.data.email.toLowerCase();
    if (target.id === auth.user.id) {
      throw badRequest(
        'CANNOT_CHANGE_OWN_EMAIL',
        'Không tự đổi email của chính mình ở đây (đổi sai là không đăng nhập lại được). Nhờ người có quyền khác đổi hộ.',
      );
    }
    const clash = await c.env.DB.prepare('SELECT id FROM users WHERE lower(email) = ? AND id <> ?')
      .bind(email, id)
      .first<{ id: string }>();
    if (clash) throw badRequest('EMAIL_EXISTS', 'Email này đã có tài khoản khác', { email: 'Email đã tồn tại' });
    parsed.data.email = email;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  if (fields.length === 0) return c.json({ data: { ok: true }, request_id: c.get('requestId') });

  const now = nowIso();
  const statements = [
    c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`).bind(
      ...values,
      now,
      id,
    ),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      before: target,
      after: parsed.data,
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ];
  await c.env.DB.batch(statements);

  // Khoá tài khoản thì đá mọi phiên đang đăng nhập ra ngay; đổi email thì phiên cũ cũng hết hiệu lực.
  const emailChanged = parsed.data.email !== undefined && parsed.data.email !== target.email.toLowerCase();
  if (parsed.data.status === 'DISABLED' || emailChanged) await revokeAllSessions(c.env.DB, id);
  // Khoá / mở lại tài khoản hoặc đổi email thì rút / thêm email ở cửa vanhanh.ailla.vn.
  const access =
    (parsed.data.status && parsed.data.status !== target.status) || emailChanged
      ? await syncAccessEmails(c.env).catch(() => ({ ok: false, error: 'lỗi mạng' }))
      : undefined;

  return c.json({ data: { ok: true, access }, request_id: c.get('requestId') });
});

/**
 * Xóa tài khoản nhập sai (ví dụ gõ nhầm email). Chỉ xóa được khi tài khoản chưa phụ trách đơn hay khách nào;
 * đã có dữ liệu thì chỉ khóa hoặc sửa email. Xóa mềm: email được giải phóng để tạo lại đúng địa chỉ.
 */
userRoutes.delete('/:id', requirePermission('user.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const target = await c.env.DB.prepare(
    'SELECT id, email, display_name, role FROM users WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(id)
    .first<{ id: string; email: string; display_name: string; role: string }>();
  if (!target) throw notFound('Không tìm thấy tài khoản');
  assertCanTouchRole(auth.user.role, target.role);
  if (target.id === auth.user.id) throw badRequest('CANNOT_DELETE_SELF', 'Không thể tự xóa tài khoản của chính mình');
  if (target.role === 'CEO') throw badRequest('CANNOT_DELETE_CEO', 'Không xóa được tài khoản CEO');

  const used = await c.env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM orders WHERE owner_id = ?1 AND deleted_at IS NULL) AS orders,
            (SELECT COUNT(*) FROM customers WHERE owner_id = ?1 AND deleted_at IS NULL) AS customers`,
  )
    .bind(id)
    .first<{ orders: number; customers: number }>();
  if ((used?.orders ?? 0) > 0 || (used?.customers ?? 0) > 0) {
    throw badRequest(
      'USER_IN_USE',
      `${target.display_name} đang phụ trách ${used?.orders ?? 0} đơn và ${used?.customers ?? 0} khách nên không xóa được. Hãy khóa tài khoản, hoặc chuyển phụ trách rồi xóa. Nếu chỉ gõ sai email thì dùng "Sửa email".`,
    );
  }

  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE users SET deleted_at = ?, status = 'DISABLED', email = ?, legacy_name = NULL, updated_at = ? WHERE id = ?`,
    ).bind(now, `deleted-${id}@deleted.invalid`, now, id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'USER_DELETED',
      entityType: 'USER',
      entityId: id,
      before: target,
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  await revokeAllSessions(c.env.DB, id);
  const access = await syncAccessEmails(c.env).catch(() => ({ ok: false, error: 'lỗi mạng' }));
  return c.json({ data: { ok: true, access }, request_id: c.get('requestId') });
});

/** Đặt lại mật khẩu cho nhân sự. Người được cấp phải đổi lại ở lần đăng nhập kế tiếp. */
userRoutes.post('/:id/set-password', requirePermission('user.manage'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const parsed = setPasswordSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw unprocessable('VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', zodFieldErrors(parsed.error));
  }
  const strengthError = checkPasswordStrength(parsed.data.password);
  if (strengthError) throw unprocessable('WEAK_PASSWORD', strengthError, { password: strengthError });

  const target = await c.env.DB.prepare(
    'SELECT id, email, role FROM users WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(id)
    .first<{ id: string; email: string; role: string }>();
  if (!target) throw notFound('Không tìm thấy tài khoản');
  assertCanTouchRole(auth.user.role, target.role);

  const hash = await hashPassword(parsed.data.password);
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE users SET password_hash = ?, password_updated_at = ?, must_change_password = ?,
         failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?`,
    ).bind(hash, now, parsed.data.must_change === false ? 0 : 1, now, id),
    auditStatement(c.env.DB, {
      actorId: auth.user.id,
      action: 'USER_PASSWORD_RESET',
      entityType: 'USER',
      entityId: id,
      after: { email: target.email },
      requestId: c.get('requestId'),
      ip: c.req.header('CF-Connecting-IP') ?? null,
    }),
  ]);
  await revokeAllSessions(c.env.DB, id);

  return c.json({ data: { ok: true }, request_id: c.get('requestId') });
});

/** Tình trạng cửa qt.ailla.vn và đồng bộ lại bằng tay. */
userRoutes.get('/access-sync', requirePermission('user.manage'), async (c) => {
  const configured = Boolean(c.env.CF_ACCESS_TOKEN && c.env.CF_ACCOUNT_ID && c.env.ACCESS_POLICY_ID);
  return c.json({ data: { configured }, request_id: c.get('requestId') });
});
userRoutes.post('/access-sync', requirePermission('user.manage'), async (c) => {
  const access = await syncAccessEmails(c.env).catch(() => ({ ok: false, error: 'lỗi mạng' }));
  return c.json({ data: access, request_id: c.get('requestId') });
});

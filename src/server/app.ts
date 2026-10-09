import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './env';
import { AppError } from './lib/http';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth';
import { auth } from './routes/auth';
import { userRoutes } from './routes/users';
import { backupRoutes } from './routes/backup';
import { ingestRoutes } from './routes/ingest';
import { coreRoutes } from './routes/core';
import { customerRoutes, taskRoutes } from './routes/customers';
import { catalogRoutes } from './routes/catalog';
import { approvalRoutes, orderRoutes } from './routes/orders';
import { financeRoutes } from './routes/finance';
import { importRoutes } from './routes/imports';
import { dashboardRoutes } from './routes/dashboards';
import { hubRoutes } from './routes/hub';
import { hubWorkerRoutes, workerRoutes } from './routes/worker';
import { khoRoutes } from './routes/kho';
import { hrRoutes } from './routes/hr';

/**
 * Ứng dụng Hono. Tách khỏi index.ts để test có thể gọi trực tiếp app.fetch()
 * mà không cần chạy Worker thật.
 */
export function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    const requestId = c.req.header('CF-Ray') ?? crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);
    // Hệ thống nội bộ: không cho công cụ tìm kiếm lưu hay hiển thị.
    c.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
    await next();
  });

  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
      referrerPolicy: 'strict-origin-when-cross-origin',
      xFrameOptions: 'DENY',
    }),
  );

  app.get('/api/health', (c) =>
    c.json({ data: { status: 'ok', environment: c.env.ENVIRONMENT }, request_id: c.get('requestId') }),
  );

  // Đăng nhập/đăng xuất phải dùng được khi CHƯA có phiên; đổi mật khẩu thì cần biết ai đang gọi.
  app.use('/api/auth/*', optionalAuthMiddleware);
  app.route('/api/auth', auth);

  // Worker dựng video (máy văn phòng) tự gọi bằng khoá riêng, không có phiên đăng nhập.
  app.route('/api/worker', workerRoutes);
  app.route('/api/backup', backupRoutes);
  app.route('/api/ingest', ingestRoutes);

  // Mọi endpoint /api còn lại đều phải qua xác thực + RBAC ở backend.
  app.use('/api/*', authMiddleware);

  app.route('/api', coreRoutes);
  app.route('/api/admin/users', userRoutes);
  app.route('/api/customers', customerRoutes);
  app.route('/api/tasks', taskRoutes);
  app.route('/api', catalogRoutes);
  app.route('/api/orders', orderRoutes);
  app.route('/api/approvals', approvalRoutes);
  app.route('/api', financeRoutes);
  app.route('/api/imports', importRoutes);
  app.route('/api/dashboards', dashboardRoutes);
  app.route('/api/hub/worker-tasks', hubWorkerRoutes);
  app.route('/api/hub/kho', khoRoutes);
  app.route('/api/hub/hr', hrRoutes);
  app.route('/api/hub', hubRoutes);

  app.notFound((c) =>
    c.json(
      { error: { code: 'NOT_FOUND', message: 'Không tìm thấy endpoint' }, request_id: c.get('requestId') },
      404,
    ),
  );

  app.onError((err, c) => {
    const requestId = c.get('requestId');
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message, fields: err.fields }, request_id: requestId },
        err.status as never,
      );
    }
    // Không trả stack trace ra ngoài (mục 11.1).
    console.error('[unhandled]', requestId, err);
    return c.json(
      {
        error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống. Vui lòng thử lại hoặc báo quản trị.' },
        request_id: requestId,
      },
      500,
    );
  });

  return app;
}

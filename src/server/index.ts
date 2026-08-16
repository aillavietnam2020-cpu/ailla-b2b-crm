import type { Env } from './env';
import { createApp } from './app';
import { loadConfig } from './lib/settings';
import { syncAlerts } from './services/alerts';

const app = createApp();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api')) {
      return app.fetch(request, env, ctx);
    }

    // SPA React: mọi đường dẫn khác trả về static assets (không phải nguồn dữ liệu).
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Ứng dụng chưa được build. Chạy `npm run build` trước.', { status: 503 });
  },

  /** Cron mỗi giờ: sinh cảnh báo quá hạn, tái nhập, công nợ, kế toán treo (mục 13.1). */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const config = await loadConfig(env.DB);
        const result = await syncAlerts(env.DB, config);
        console.info('[cron] alerts', JSON.stringify(result));
      })(),
    );
  },
};

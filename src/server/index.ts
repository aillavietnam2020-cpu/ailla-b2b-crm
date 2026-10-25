import type { Env } from './env';
import { createApp } from './app';
import { loadConfig } from './lib/settings';
import { syncAlerts } from './services/alerts';
import { emitTimeEvents } from './services/timeEvents';
import { serveHub } from './hub/serve';
import HUB_HTML from './hub/hub.html';
import { shootReminders } from './services/shootReminders';
import { taskReminders } from './services/taskReminders';
import { publishDue } from './services/fpPublish';
import { syncAllChannels } from './services/poscake';
import { syncReturns } from './services/returnScan';
import { syncFbSaleDays } from './services/fbSales';
import { isAdminHost } from './lib/host';
import { readSessionCookie, resolveSession } from './lib/session';

const app = createApp();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api')) {
      return app.fetch(request, env, ctx);
    }

    // Khu Marketing: trang tĩnh nhưng chỉ trả về sau khi kiểm tra đăng nhập.
    if (url.pathname === '/hub' || url.pathname.startsWith('/hub/')) {
      return serveHub(request, env, HUB_HTML);
    }

    // Địa chỉ quản trị: đã đăng nhập thì mở gốc là vào luôn trang quản trị (không hiện giao diện CRM B2B).
    if (url.pathname === '/' && !url.searchParams.has('next') && isAdminHost(env, request)) {
      const token = readSessionCookie(request.headers);
      const session = token ? await resolveSession(env.DB, token) : null;
      if (session && session.status === 'ACTIVE') return Response.redirect(new URL('/hub/', url).toString(), 302);
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
        // Sự kiện theo thời gian (đơn kẹt, quá lịch xuất, tồn dưới mức) cho agent đọc sau này.
        try {
          console.info('[cron] events', JSON.stringify(await emitTimeEvents(env.DB)));
        } catch (error) {
          console.error('[cron] events loi', error);
        }
        // Kéo đơn bán qua sàn (TikTok Shop, Shopee) từ Poscake: 7 giờ sáng giờ Việt Nam, hôm qua và hôm kia.
        try {
          const hourVn = (new Date().getUTCHours() + 7) % 24;
          if (hourVn === 7) {
            const day = (back: number) => new Date(Date.now() + 7 * 3_600_000 - back * 86_400_000).toISOString().slice(0, 10);
            console.info('[cron] poscake', JSON.stringify(await syncAllChannels(env.DB, env.INGEST_KEY, [day(1), day(2)], (u) => fetch(u))));
            // Đơn hoàn (TikTok, Shopee, Facebook): hôm nay, hôm qua, hôm kia.
            console.info('[cron] don hoan', JSON.stringify(await syncReturns(env.DB, env.INGEST_KEY, [day(0), day(1), day(2)], (u) => fetch(u))));
            // Số bán hàng Facebook theo người xử lý đơn (Pancake analytics): 8 ngày gần nhất, vì đơn hoàn và đơn giao về chậm.
            console.info('[cron] fb sale', JSON.stringify(await syncFbSaleDays(env.DB, env.INGEST_KEY, [0, 1, 2, 3, 4, 5, 6, 7].map(day), (u) => fetch(u))));
          }
        } catch (error) {
          console.error('[cron] poscake loi', error);
        }
        // Nhắc buổi quay của khu Marketing (chỉ chạy lúc 8 giờ sáng giờ Việt Nam).
        try {
          console.info('[cron] nhac buoi quay', JSON.stringify(await shootReminders(env.DB)));
        } catch (error) {
          console.error('[cron] nhac buoi quay loi', error);
        }
        // Đăng bài Fanpage đã duyệt tới giờ (công tắc app_kv fp_publish: off / test / on).
        try {
          console.info('[cron] dang fanpage', JSON.stringify(await publishDue(env.DB, env.INGEST_KEY, (u, i) => fetch(u, i))));
        } catch (error) {
          console.error('[cron] dang fanpage loi', error);
        }
        // Nhắc việc Task giao việc: việc trễ, đến hạn, chờ duyệt + tóm tắt cho chị (8 giờ sáng giờ Việt Nam).
        try {
          console.info('[cron] nhac task', JSON.stringify(await taskReminders(env.DB)));
        } catch (error) {
          console.error('[cron] nhac task loi', error);
        }
      })(),
    );
  },
};

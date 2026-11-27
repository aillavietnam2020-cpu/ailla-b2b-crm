/**
 * Zalo trong CRM, đợt 2 (chị Hoa chọn 27/11/2026): AI soạn nháp, AI trau chuốt câu, tóm tắt cuộc chat,
 * bản tin "Khách hôm nay", đo sale qua Zalo, chuông nhắc khách chờ trả lời.
 *
 * AI chỉ soạn NHÁP: người đọc lại rồi bấm Gửi, máy không tự gửi. Trước khi gửi nội dung cho AI, số điện thoại và
 * dãy số dài (tài khoản ngân hàng) được che. Tin có từ nhạy cảm (khiếu nại, hoàn tiền…) thì AI không soạn, báo sale tự trả lời.
 * Giá chỉ lấy từ Bảng giá đúng cấp của khách; không có thì AI phải hẹn kiểm lại, không tự đặt giá.
 */
import { Hono } from 'hono';
import { nowIso, vnDate } from '@shared/datetime';
import { aiMask, aiSensitive, responseStats, STUCK_DAYS, type RespSample } from '@shared/zalo';
import type { AppEnv, Env } from '../env';
import { badRequest, forbidden, ok } from '../lib/http';
import { bellTo } from '../lib/hubBell';
import { callAi } from '../lib/orderReader';
import { convFor, nickScope, viewer } from './zaloNick';

export const zaloInsightRoutes = new Hono<AppEnv>();

interface CtxMsg {
  from_me: number;
  kind: string;
  text: string;
  at: string;
  recalled_at: string | null;
  msg_id: string;
}

async function convContext(env: Env, convId: string) {
  const db = env.DB;
  const conv = await db
    .prepare('SELECT z.id, z.name, z.is_group, z.customer_id, z.cskh_phone, n.name AS nick_name FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id WHERE z.id = ?')
    .bind(convId)
    .first<{ id: string; name: string; is_group: number; customer_id: string | null; cskh_phone: string | null; nick_name: string }>();
  const msgs = (
    (await db.prepare('SELECT from_me, kind, text, at, recalled_at, msg_id FROM zalo_msgs WHERE conv_id = ? AND hidden_at IS NULL ORDER BY at DESC LIMIT 30').bind(convId).all<CtxMsg>()).results ?? []
  ).reverse();
  let profile = '';
  let prices: Array<{ name: string; unit: string | null; amount: number }> = [];
  if (conv?.customer_id) {
    const c = await db
      .prepare(
        `SELECT c.name, c.province, c.stage, c.tier_id, t.name AS tier_name,
           (SELECT MAX(o.order_date) FROM orders o WHERE o.customer_id = c.id AND o.deleted_at IS NULL AND o.approval_status = 'APPROVED') AS last_order
         FROM customers c LEFT JOIN price_tiers t ON t.id = c.tier_id WHERE c.id = ?`,
      )
      .bind(conv.customer_id)
      .first<{ name: string; province: string | null; stage: string; tier_id: string | null; tier_name: string | null; last_order: string | null }>();
    if (c) {
      profile = `Khách kênh phân phối (đại lý/NPP): ${c.name}, ${c.province ?? ''}, cấp giá ${c.tier_name ?? 'chưa có'}, giai đoạn ${c.stage}, nhập gần nhất ${c.last_order ?? 'chưa mua'}.`;
      const notes = (await db.prepare('SELECT content FROM customer_activities WHERE customer_id = ? ORDER BY created_at DESC LIMIT 3').bind(conv.customer_id).all<{ content: string }>()).results ?? [];
      if (notes.length) profile += ' Ghi chú chăm sóc gần đây: ' + notes.map((x) => x.content.slice(0, 200)).join(' | ');
      if (c.tier_id) {
        prices =
          (
            await db
              .prepare(
                `SELECT p.name, p.unit, pp.amount FROM product_prices pp JOIN products p ON p.id = pp.product_id
                 WHERE pp.tier_id = ? AND pp.status = 'ACTIVE' AND p.active = 1 AND pp.amount IS NOT NULL AND pp.valid_from <= ?
                   AND pp.valid_from = (SELECT MAX(x.valid_from) FROM product_prices x WHERE x.product_id = pp.product_id AND x.tier_id = pp.tier_id AND x.status = 'ACTIVE' AND x.valid_from <= ?)
                 ORDER BY p.name LIMIT 150`,
              )
              .bind(c.tier_id, vnDate(), vnDate())
              .all<{ name: string; unit: string | null; amount: number }>()
          ).results ?? [];
      }
    }
  } else if (conv?.cskh_phone) {
    const c = await db.prepare('SELECT name, order_count, total_spent, last_order_day, last_product, note FROM cskh_customers WHERE phone = ?').bind(conv.cskh_phone).first<{ name: string; order_count: number; total_spent: number; last_order_day: string | null; last_product: string; note: string }>();
    if (c) profile = `Khách lẻ: ${c.name}, đã mua ${c.order_count} đơn, sản phẩm gần nhất ${c.last_product || 'chưa rõ'} (${c.last_order_day ?? ''}). ${c.note ? 'Ghi nhớ: ' + c.note.slice(0, 200) : ''}`;
  }
  return { conv, msgs, profile, prices };
}

const chatLines = (msgs: CtxMsg[]) =>
  msgs
    .filter((m) => !m.recalled_at)
    .map((m) => `${m.from_me ? 'AILLA' : 'Khách'}: ${aiMask(m.kind === 'text' ? m.text : `[${m.kind}] ${m.text}`).slice(0, 400)}`)
    .join('\n');

const RULES = `Bạn soạn NHÁP tin Zalo cho nhân viên bán hàng của AILLA (hóa phẩm gia dụng: nước giặt, nước xả, lau sàn, tẩy rửa...). Nhân viên sẽ đọc lại rồi mới gửi.
Quy tắc:
- Tối đa 4 câu, tiếng Việt tự nhiên, lễ phép, xưng "em", gọi khách "anh/chị" (nếu chưa rõ thì "anh/chị").
- Giá, khuyến mãi, chính sách CHỈ được lấy từ BẢNG GIÁ bên dưới. Không có trong bảng thì nói "em kiểm lại giá rồi báo anh/chị ngay", tuyệt đối không tự đặt giá.
- Không hứa thời gian giao hàng, không hứa công dụng y tế. Không bịa thông tin.
- Nếu khách hỏi có phải máy/AI không thì để nhân viên tự trả lời (viết: "[Để nhân viên trả lời]").
- Chỉ trả về đúng nội dung tin nhắn, không giải thích, không dùng dấu ngoặc kép bao quanh.`;

function priceBlock(prices: Array<{ name: string; unit: string | null; amount: number }>) {
  if (!prices.length) return 'BẢNG GIÁ: (không có bảng giá cho khách này)';
  return 'BẢNG GIÁ đúng cấp của khách (đồng):\n' + prices.map((p) => `- ${p.name}${p.unit ? ' (' + p.unit + ')' : ''}: ${p.amount.toLocaleString('vi-VN')}`).join('\n');
}
const clean = (t: string) => t.replace(/^["“”'\s]+|["“”'\s]+$/g, '').trim().slice(0, 1500);

/** Nháp AI cho hội thoại đang chờ trả lời. Nháp giữ theo tin khách mới nhất; ?redo=1 thì soạn lại. */
zaloInsightRoutes.get('/convs/:id/ai', async (c) => {
  const v = await viewer(c);
  const z = await convFor(c, v, c.req.param('id'));
  if (z.is_group) return ok(c, { text: '', note: 'Nhóm chưa có AI soạn ở đợt này.' });
  const { msgs, profile, prices } = await convContext(c.env, z.id);
  const lastIn = [...msgs].reverse().find((m) => !m.from_me && !m.recalled_at);
  const last = msgs[msgs.length - 1];
  if (!lastIn || !last || last.from_me) return ok(c, { text: '', note: '' });
  const redo = c.req.query('redo') === '1';
  if (!redo) {
    const cached = await c.env.DB.prepare('SELECT text, note FROM zalo_ai WHERE conv_id = ? AND msg_id = ?').bind(z.id, lastIn.msg_id).first<{ text: string; note: string }>();
    if (cached) return ok(c, cached);
  }
  const recentIn = msgs.filter((m) => !m.from_me).slice(-3).map((m) => m.text).join(' ');
  const hit = aiSensitive(recentIn);
  let out = { text: '', note: '' };
  if (hit) out = { text: '', note: `Khách nhắc "${hit}": việc nhạy cảm, AI không soạn. Sale tự trả lời và báo Lead.` };
  else {
    try {
      const prompt = `${RULES}\n\n${priceBlock(prices)}\n\nTHÔNG TIN KHÁCH: ${aiMask(profile) || 'chưa rõ'}\n\nĐOẠN CHAT GẦN NHẤT:\n${chatLines(msgs)}\n\nSoạn tin trả lời tiếp theo của AILLA${redo ? ' (cách viết khác lần trước)' : ''}:`;
      out = { text: clean(await callAi(c.env, [{ type: 'text', text: prompt }])), note: '' };
    } catch (e) {
      const m = String((e as Error).message);
      return ok(c, { text: '', note: m === 'AI_NOT_CONFIGURED' ? 'Chưa cài AI cho web.' : 'AI đang bận, thử lại sau.' });
    }
  }
  await c.env.DB.prepare('INSERT INTO zalo_ai (conv_id, msg_id, text, note, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(conv_id) DO UPDATE SET msg_id = excluded.msg_id, text = excluded.text, note = excluded.note, created_at = excluded.created_at')
    .bind(z.id, lastIn.msg_id, out.text, out.note, nowIso())
    .run();
  return ok(c, out);
});

/** AI trau chuốt câu sale đang gõ (giữ ý, sửa lỗi, lễ phép hơn). */
zaloInsightRoutes.post('/convs/:id/ai-polish', async (c) => {
  const v = await viewer(c);
  const z = await convFor(c, v, c.req.param('id'));
  const b = (await c.req.json().catch(() => ({}))) as { text?: string };
  const t = String(b.text ?? '').trim().slice(0, 1500);
  if (!t) throw badRequest('NO_TEXT', 'Chưa có câu để sửa');
  const { prices } = await convContext(c.env, z.id);
  try {
    const prompt = `${RULES}\n\n${priceBlock(prices)}\n\nNhân viên đã viết câu dưới đây. Sửa lỗi chính tả, cho lễ phép và gọn hơn, GIỮ NGUYÊN Ý và mọi con số (nếu số giá khác bảng giá thì giữ nguyên số nhân viên viết). Chỉ trả về câu đã sửa.\n\nCÂU GỐC: ${t}`;
    return ok(c, { text: clean(await callAi(c.env, [{ type: 'text', text: prompt }])) });
  } catch {
    throw badRequest('AI_BUSY', 'AI đang bận, thử lại sau');
  }
});

/** AI tóm tắt cuộc chat + khách đang vui hay bực + nên làm gì tiếp. */
zaloInsightRoutes.post('/convs/:id/ai-summary', async (c) => {
  const v = await viewer(c);
  const z = await convFor(c, v, c.req.param('id'));
  const { msgs, profile } = await convContext(c.env, z.id);
  if (!msgs.length) return ok(c, { text: 'Chưa có tin để tóm tắt.' });
  try {
    const prompt = `Tóm tắt cuộc chat Zalo giữa nhân viên AILLA và khách dưới đây cho quản lý đọc, tiếng Việt, tối đa 4 dòng ngắn:
1) Khách cần gì / đã chốt gì. 2) Cảm xúc khách (vui, bình thường, lăn tăn, bực) và vì sao. 3) Việc nên làm tiếp. Không bịa.
THÔNG TIN KHÁCH: ${aiMask(profile) || 'chưa rõ'}
CHAT:\n${chatLines(msgs)}`;
    return ok(c, { text: clean(await callAi(c.env, [{ type: 'text', text: prompt }])) });
  } catch {
    throw badRequest('AI_BUSY', 'AI đang bận, thử lại sau');
  }
});

/** Bản tin "Khách hôm nay": khách chờ lâu nhất, hẹn hôm nay / quá hạn, khách lâu không chăm, khách im 30 ngày. Theo phạm vi người xem. */
zaloInsightRoutes.get('/brief', async (c) => {
  const v = await viewer(c);
  const db = c.env.DB;
  const sc = nickScope(v);
  const today = vnDate();
  const waiting =
    (
      await db
        .prepare(
          `SELECT z.id, z.name, cu.name AS customer_name, cs.name AS cskh_name, z.waiting_since, z.last_text, n.name AS nick_name
           FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id LEFT JOIN customers cu ON cu.id = z.customer_id LEFT JOIN cskh_customers cs ON cs.phone = z.cskh_phone
           WHERE z.is_group = 0 AND z.waiting_since IS NOT NULL AND ${sc.sql} ORDER BY z.waiting_since LIMIT 8`,
        )
        .bind(...sc.params)
        .all()
    ).results ?? [];
  const own = v.lead ? '' : 'AND c.owner_id = ?';
  const ownP = v.lead ? [] : [v.id];
  const due =
    (
      await db
        .prepare(`SELECT c.id, c.name, c.next_follow_up_at AS day, u.display_name AS owner_name FROM customers c LEFT JOIN users u ON u.id = c.owner_id WHERE c.deleted_at IS NULL AND c.next_follow_up_at IS NOT NULL AND c.next_follow_up_at <= ? ${own} ORDER BY c.next_follow_up_at LIMIT 8`)
        .bind(today, ...ownP)
        .all()
    ).results ?? [];
  const dueCs =
    (await db.prepare(`SELECT c.phone, c.name, c.next_call AS day, c.owner_name FROM cskh_customers c WHERE c.next_call IS NOT NULL AND c.next_call <= ? AND COALESCE(c.stop_reason, '') = '' ${own} ORDER BY c.next_call DESC LIMIT 8`).bind(today, ...ownP).all())
      .results ?? [];
  // Khách lâu không chăm: lần liên lạc cuối (chăm sóc, Zalo, đơn) quá ngưỡng của giai đoạn.
  const stuckRows =
    (
      await db
        .prepare(
          `SELECT c.id, c.name, c.stage, u.display_name AS owner_name,
             MAX(COALESCE((SELECT MAX(a.created_at) FROM customer_activities a WHERE a.customer_id = c.id), ''),
                 COALESCE((SELECT MAX(z.last_at) FROM zalo_convs z WHERE z.customer_id = c.id), ''),
                 COALESCE((SELECT MAX(o.order_date) FROM orders o WHERE o.customer_id = c.id AND o.deleted_at IS NULL), ''),
                 c.created_at) AS last_touch
           FROM customers c LEFT JOIN users u ON u.id = c.owner_id
           WHERE c.deleted_at IS NULL AND c.stage IN ('NEW','CONSULTING','QUOTED','NEGOTIATING','FIRST_ORDER') ${own}`,
        )
        .bind(...ownP)
        .all<{ id: string; name: string; stage: string; owner_name: string | null; last_touch: string }>()
    ).results ?? [];
  const now = Date.now();
  const stuck = stuckRows
    .map((r) => ({ ...r, days: Math.floor((now - Date.parse(r.last_touch.length === 10 ? r.last_touch + 'T00:00:00+07:00' : r.last_touch)) / 86_400_000) }))
    .filter((r) => Number.isFinite(r.days) && r.days >= (STUCK_DAYS[r.stage] ?? 30))
    .sort((a, b) => b.days - a.days)
    .slice(0, 8);
  const silentSince = new Date(now - 30 * 86_400_000).toISOString();
  const silent =
    (
      await db
        .prepare(
          `SELECT z.id, z.name, cu.name AS customer_name, cs.name AS cskh_name, z.last_at, n.name AS nick_name FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id
           LEFT JOIN customers cu ON cu.id = z.customer_id LEFT JOIN cskh_customers cs ON cs.phone = z.cskh_phone
           WHERE z.is_group = 0 AND (z.customer_id IS NOT NULL OR z.cskh_phone IS NOT NULL) AND z.last_at < ? AND ${sc.sql} ORDER BY z.last_at DESC LIMIT 8`,
        )
        .bind(silentSince, ...sc.params)
        .all()
    ).results ?? [];
  return ok(c, { waiting, due, due_cskh: dueCs, stuck, silent });
});

/** Đo sale qua Zalo (Lead / CEO): theo người phụ trách nick, trong khoảng ngày (tối đa 31 ngày). */
zaloInsightRoutes.get('/report', async (c) => {
  const v = await viewer(c);
  if (!v.lead) throw forbidden('Chỉ Lead / CEO xem đo sale');
  const db = c.env.DB;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('to') ?? '') ? c.req.query('to')! : vnDate();
  let from = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('from') ?? '') ? c.req.query('from')! : vnDate(new Date(Date.now() - 6 * 86_400_000));
  if (Date.parse(to) - Date.parse(from) > 31 * 86_400_000) from = vnDate(new Date(Date.parse(to) - 30 * 86_400_000));
  const a = new Date(Date.parse(from + 'T00:00:00+07:00')).toISOString();
  const b = new Date(Date.parse(to + 'T00:00:00+07:00') + 86_400_000).toISOString();
  const rows =
    (
      await db
        .prepare(
          `SELECT m.conv_id, m.from_me, m.at, m.sent_by, n.owner_id FROM zalo_msgs m JOIN zalo_convs z ON z.id = m.conv_id JOIN zalo_nicks n ON n.id = m.nick_id
           WHERE z.is_group = 0 AND m.at >= ? AND m.at < ? ORDER BY m.conv_id, m.at LIMIT 60000`,
        )
        .bind(a, b)
        .all<RespSample>()
    ).results ?? [];
  const stats = responseStats(rows);
  const users = (await db.prepare("SELECT id, display_name FROM users WHERE kind = 'HUMAN'").all<{ id: string; display_name: string }>()).results ?? [];
  const nameOf = new Map(users.map((u) => [u.id, u.display_name]));
  const waitNow =
    (
      await db
        .prepare(
          `SELECT n.owner_id, COUNT(*) AS n, SUM(CASE WHEN z.waiting_since < ? THEN 1 ELSE 0 END) AS late FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id
           WHERE z.is_group = 0 AND z.waiting_since IS NOT NULL GROUP BY n.owner_id`,
        )
        .bind(new Date(Date.now() - 30 * 60_000).toISOString())
        .all<{ owner_id: string | null; n: number; late: number }>()
    ).results ?? [];
  const keys = new Set([...Object.keys(stats), ...waitNow.map((w) => w.owner_id ?? '')]);
  const people = [...keys].map((k) => {
    const s = stats[k] ?? { convs: 0, inMsgs: 0, outMsgs: 0, replies: 0, avgMin: null, medianMin: null, within15: null, over60: 0 };
    const w = waitNow.find((x) => (x.owner_id ?? '') === k);
    return { owner_id: k || null, name: k ? nameOf.get(k) ?? '(không rõ)' : 'Nick chưa giao người', ...s, wait_now: w?.n ?? 0, wait_late: w?.late ?? 0 };
  });
  people.sort((x, y) => (x.medianMin ?? 1e9) - (y.medianMin ?? 1e9));
  return ok(c, { from, to, people });
});

/**
 * Chuông nhắc: khách chờ trả lời Zalo quá 30 phút (1-1) thì báo người phụ trách nick, mỗi đợt chờ báo một lần.
 * Gọi từ cron 15 phút.
 */
export async function zaloWaitBell(db: D1Database): Promise<number> {
  const cut = new Date(Date.now() - 30 * 60_000).toISOString();
  const rows =
    (
      await db
        .prepare(
          `SELECT z.id, z.waiting_since, COALESCE(cu.name, cs.name, z.name) AS who, n.owner_id, n.name AS nick_name FROM zalo_convs z JOIN zalo_nicks n ON n.id = z.nick_id
           LEFT JOIN customers cu ON cu.id = z.customer_id LEFT JOIN cskh_customers cs ON cs.phone = z.cskh_phone
           WHERE z.is_group = 0 AND z.waiting_since IS NOT NULL AND z.waiting_since < ? AND (z.wait_bell_at IS NULL OR z.wait_bell_at < z.waiting_since) AND n.owner_id IS NOT NULL LIMIT 200`,
        )
        .bind(cut)
        .all<{ id: string; waiting_since: string; who: string; owner_id: string; nick_name: string }>()
    ).results ?? [];
  if (!rows.length) return 0;
  const by = new Map<string, typeof rows>();
  for (const r of rows) by.set(r.owner_id, [...(by.get(r.owner_id) ?? []), r]);
  for (const [owner, list] of by) {
    const names = list.slice(0, 3).map((x) => x.who || 'khách').join(', ');
    try {
      await bellTo(db, [owner], `Zalo: ${list.length} khách chờ trả lời quá 30 phút (${names}${list.length > 3 ? '…' : ''}). Mở Kinh doanh › Zalo › Hộp tin Zalo.`, '');
    } catch {
      /* chuông lỗi thì thôi */
    }
  }
  const now = nowIso();
  for (let i = 0; i < rows.length; i += 80) await db.batch(rows.slice(i, i + 80).map((r) => db.prepare('UPDATE zalo_convs SET wait_bell_at = ? WHERE id = ?').bind(now, r.id)));
  return rows.length;
}

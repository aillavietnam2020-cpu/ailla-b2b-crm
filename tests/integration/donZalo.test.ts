import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';
import { normalizeRead } from '@server/lib/orderReader';
import { qtyText } from '@server/routes/orderIntake';

/** Nhận đơn B2B qua Zalo (08/11): máy đọc đơn, gắn ảnh gốc, link khách xác nhận. */
let ctx: TestContext;
beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});
afterEach(() => vi.unstubAllGlobals());

const CAT = [
  { id: 'p1', sku: 'AILLA5HD', name: 'Hygiene đen 5kg', unit: 'Thùng', pack_size: null },
  { id: 'p2', sku: 'AILLA10HD', name: 'Hygiene đen 10kg', unit: 'Can', pack_size: null },
];

describe('normalizeRead', () => {
  it('chỉ giữ mã có trong danh mục, phân xanh/vàng/đỏ', () => {
    const r = normalizeRead(
      {
        lines: [
          { raw: 'hygiene 10kg 15 can', qty: 15, candidates: ['AILLA10HD'], sure: true },
          { raw: 'hygiene đen 10', qty: '10', candidates: ['AILLA10HD', 'AILLA5HD', 'BIA-KHONG-CO'], sure: false, question: '10kg hay 5kg?' },
          { raw: 'xịt kính 1 th', qty: 1, candidates: ['XIT-KINH'], sure: true },
        ],
      },
      CAT,
    );
    expect(r.lines.map((l) => l.status)).toEqual(['OK', 'WARN', 'BAD']);
    expect(r.lines[1].candidates).toEqual(['AILLA10HD', 'AILLA5HD']);
    expect(r.lines[1].question).toBe('10kg hay 5kg?');
    expect(r.lines[2].candidates).toEqual([]);
  });
  it('thiếu số lượng thì không cho là chắc chắn', () => {
    const r = normalizeRead({ lines: [{ raw: 'hygiene 10kg', qty: null, candidates: ['AILLA10HD'], sure: true }] }, CAT);
    expect(r.lines[0].status).toBe('WARN');
  });
});

describe('qtyText', () => {
  it('ghi thùng cho khách dễ đọc', () => {
    expect(qtyText(15, 'Thùng', null)).toBe('15 thùng');
    expect(qtyText(24, 'Chai', '12 chai/thùng')).toBe('2 thùng (24 chai)');
    expect(qtyText(5, 'Can', null)).toBe('5 can');
  });
});

describe('đọc đơn từ ảnh / tin nhắn', () => {
  it('máy đọc ra dòng, ráp đúng sản phẩm; lưu đơn xong gắn được vào đơn', async () => {
    ctx.env.AI_BASE_URL = 'https://ai.test';
    ctx.env.AI_API_KEY = 'k';
    const fake = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '```json\n{"customer_hint":"Thảo","delivery_note":"giao thứ 7","lines":[{"raw":"nước giặt 5L : 10","qty":10,"unit_written":"can","candidates":["TEST-FULL"],"sure":true}]}\n```' } }],
        }),
      ),
    );
    vi.stubGlobal('fetch', fake);
    const r = await ctx.request('/api/order-intake/read', { as: USERS.thao, body: { text: 'nước giặt 5L : 10', customer_id: 'cus-thao-1' } });
    expect(r.status).toBe(200);
    expect(r.body.data.lines[0].status).toBe('OK');
    expect(r.body.data.lines[0].products[0].id).toBe('prod-full');
    expect(r.body.data.delivery_note).toBe('giao thứ 7');
    // Giá không gửi cho máy đọc: chỉ có tên hàng + mã trong lời nhắc.
    const sent = JSON.parse((fake.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.messages[0].content[0].text).toContain('TEST-FULL');
    expect(sent.messages[0].content[0].text).not.toContain('100000');

    const created = await ctx.request('/api/orders', { as: USERS.thao, body: { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 10 }] } });
    expect(created.status).toBe(201);
    const att = await ctx.request(`/api/order-intake/${r.body.data.id}/attach`, { as: USERS.thao, body: { order_id: created.body.data.id } });
    expect(att.status).toBe(200);
    const list = await ctx.request(`/api/order-intake/by-order/${created.body.data.id}`, { as: USERS.thao });
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].raw_text).toBe('nước giặt 5L : 10');
  });

  it('máy chưa bật thì báo lời dễ hiểu', async () => {
    const r = await ctx.request('/api/order-intake/read', { as: USERS.thao, body: { text: 'abc' } });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toContain('chưa được bật');
  });

  it('không có ảnh lẫn chữ thì chặn', async () => {
    const r = await ctx.request('/api/order-intake/read', { as: USERS.thao, body: {} });
    expect(r.status).toBe(400);
  });
});

describe('link khách xác nhận', () => {
  const fetchPublic = (path: string, init?: RequestInit) =>
    ctx.app.fetch(new Request(`http://localhost${path}`, init), ctx.env, { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext);

  it('chỉ đơn đã duyệt mới tạo link; khách mở không cần đăng nhập và bấm chốt', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body: { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 10 }] } });
    const id = created.body.data.id;
    expect((await ctx.request(`/api/order-intake/share/${id}`, { as: USERS.thao, body: {} })).status).toBe(422);

    await ctx.db.prepare("UPDATE orders SET approval_status = 'APPROVED' WHERE id = ?").bind(id).run();
    const s = await ctx.request(`/api/order-intake/share/${id}`, { as: USERS.thao, body: {} });
    expect(s.status).toBe(200);
    const link = s.body.data.link;
    expect(link.message).toContain('Nước giặt test 5L: 10 can');
    expect(link.url).toMatch(/\/d\/[A-Za-z0-9_-]{20,}$/);
    // Gọi lại vẫn ra link cũ.
    const again = await ctx.request(`/api/order-intake/share/${id}`, { as: USERS.thao, body: {} });
    expect(again.body.data.link.token).toBe(link.token);

    const page = await fetchPublic(`/d/${link.token}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('Đúng, chốt đơn');
    expect(html).not.toMatch(/chị|em ơi/);

    const post = await fetchPublic(`/d/${link.token}/chot`, { method: 'POST' });
    expect(post.status).toBe(303);
    const st = await ctx.request(`/api/order-intake/share/${id}`, { as: USERS.thao });
    expect(st.body.data.link.confirmed_at).toBeTruthy();
    expect(st.body.data.link.view_count).toBe(1);
    const log = await ctx.db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'ORDER_CUSTOMER_CONFIRMED' AND entity_id = ?").bind(id).first<{ n: number }>();
    expect(log?.n).toBe(1);
  });

  it('khách báo sửa thì lưu lời khách; link sai thì không mở', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body: { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 10 }] } });
    const id = created.body.data.id;
    await ctx.db.prepare("UPDATE orders SET approval_status = 'APPROVED' WHERE id = ?").bind(id).run();
    const s = await ctx.request(`/api/order-intake/share/${id}`, { as: USERS.thao, body: {} });
    const token = s.body.data.link.token;
    const form = new URLSearchParams({ note: 'lấy 8 can thôi' });
    const post = await fetchPublic(`/d/${token}/sua`, { method: 'POST', body: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    expect(post.status).toBe(303);
    const st = await ctx.request(`/api/order-intake/share/${id}`, { as: USERS.thao });
    expect(st.body.data.link.change_note).toBe('lấy 8 can thôi');
    expect((await fetchPublic('/d/khong-dung-link-nay-1234')).status).toBe(404);
  });

  it('người không xem được đơn thì không tạo được link', async () => {
    const created = await ctx.request('/api/orders', { as: USERS.thao, body: { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 10 }] } });
    await ctx.db.prepare("UPDATE orders SET approval_status = 'APPROVED' WHERE id = ?").bind(created.body.data.id).run();
    const r = await ctx.request(`/api/order-intake/share/${created.body.data.id}`, { as: USERS.huyen, body: {} });
    expect([403, 404]).toContain(r.status);
  });
});

describe('trợ lý nhóm Zalo (phương án 1)', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const relay = async (path: string, body?: unknown, key = 'khoa-thu'): Promise<{ status: number; json: () => Promise<any> }> =>
    ctx.app.fetch(
      new Request(`http://localhost/api/zalo-relay${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'X-Relay-Key': key, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      ctx.env,
      { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
    );
  const fakeAi = () =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: '{"lines":[{"raw":"nước giặt 5L 10","qty":10,"candidates":["TEST-FULL"],"sure":true}]}' } }] })),
      ),
    );

  beforeEach(() => {
    ctx.env.AGENT_RELAY_KEY = 'khoa-thu';
    ctx.env.AI_BASE_URL = 'https://ai.test';
    ctx.env.AI_API_KEY = 'k';
  });

  it('sai khoá thì từ chối; nhóm chưa bật thì chỉ ghi tên, không đọc', async () => {
    expect((await relay('/message', { thread_id: 'g1' }, 'sai')).status).toBe(401);
    const r = await relay('/message', { thread_id: 'g1', thread_name: 'AILLA - NPP Hà Nam', text: 'nước giặt 5L 10 can' });
    expect((await r.json()).data.action).toBe('none');
    const t = await ctx.db.prepare("SELECT name, enabled FROM zalo_threads WHERE thread_id = 'g1'").first<{ name: string; enabled: number }>();
    expect(t).toEqual({ name: 'AILLA - NPP Hà Nam', enabled: 0 });
    const n = await ctx.db.prepare('SELECT COUNT(*) AS n FROM order_intakes').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it('nhóm đã bật: đọc đơn, trả lời đã nhận 1 lần, đơn chờ hiện cho sale; duyệt xong trợ lý gửi vào nhóm', async () => {
    await relay('/message', { thread_id: 'g1', thread_name: 'Nhóm NPP', text: 'chào shop' });
    // Bật nhóm cần gắn khách trước
    expect((await ctx.request('/api/order-intake/zalo/threads/g1', { method: 'PUT', as: USERS.manager, body: { enabled: true } })).status).toBe(422);
    expect((await ctx.request('/api/order-intake/zalo/threads/g1', { method: 'PUT', as: USERS.manager, body: { enabled: true, customer_id: 'cus-thao-1' } })).status).toBe(200);
    // Nhân viên thường không bật được
    expect((await ctx.request('/api/order-intake/zalo/threads/g1', { method: 'PUT', as: USERS.thao, body: { enabled: false } })).status).toBe(403);

    fakeAi();
    const small = await (await relay('/message', { thread_id: 'g1', text: 'cảm ơn ạ' })).json();
    expect(small.data.reason).toBe('not_order');
    const r1 = await (await relay('/message', { thread_id: 'g1', msg_id: 'm1', sender_name: 'Chủ đại lý', text: 'nước giặt 5L 10 can' })).json();
    expect(r1.data.action).toBe('reply');
    expect(r1.data.text).not.toMatch(/chị|em /);
    const dup = await (await relay('/message', { thread_id: 'g1', msg_id: 'm1', text: 'nước giặt 5L 10 can' })).json();
    expect(dup.data.reason).toBe('duplicate');
    const r2 = await (await relay('/message', { thread_id: 'g1', msg_id: 'm2', text: 'thêm nước giặt 5L 2 can' })).json();
    expect(r2.data.action).toBe('none'); // vừa trả lời rồi, không nhắn liên tục

    const q = await ctx.request('/api/order-intake/pending', { as: USERS.thao });
    expect(q.body.data).toHaveLength(2);
    const one = await ctx.request(`/api/order-intake/${r1.data.intake_id}`, { as: USERS.thao });
    expect(one.body.data.customer_id).toBe('cus-thao-1');
    expect(one.body.data.lines[0].products[0].id).toBe('prod-full');
    expect((await ctx.request(`/api/order-intake/${r2.data.intake_id}/dismiss`, { as: USERS.thao, body: {} })).status).toBe(200);

    const created = await ctx.request('/api/orders', { as: USERS.thao, body: { customer_id: 'cus-thao-1', items: [{ product_id: 'prod-full', qty: 10 }] } });
    const id = created.body.data.id;
    await ctx.request(`/api/order-intake/${r1.data.intake_id}/attach`, { as: USERS.thao, body: { order_id: id } });
    expect((await ctx.request('/api/order-intake/pending', { as: USERS.thao })).body.data).toHaveLength(0);
    // Chưa duyệt thì không gửi
    expect((await ctx.request(`/api/order-intake/zalo-send/${id}`, { as: USERS.thao, body: {} })).status).toBe(422);
    await ctx.db.prepare("UPDATE orders SET approval_status = 'APPROVED' WHERE id = ?").bind(id).run();
    expect((await ctx.request(`/api/order-intake/zalo-send/${id}`, { as: USERS.thao, body: {} })).status).toBe(200);
    expect((await ctx.request(`/api/order-intake/zalo-send/${id}`, { as: USERS.thao, body: {} })).status).toBe(422);

    const box = await (await relay('/outbox')).json();
    expect(box.data).toHaveLength(1);
    expect(box.data[0].thread_id).toBe('g1');
    expect(box.data[0].text).toContain('/d/');
    await relay(`/outbox/${box.data[0].id}/done`, { ok: true });
    expect((await (await relay('/outbox')).json()).data).toHaveLength(0);
    const st = await ctx.request(`/api/order-intake/zalo-send/${id}`, { as: USERS.thao });
    expect(st.body.data.last.status).toBe('SENT');
  });
});

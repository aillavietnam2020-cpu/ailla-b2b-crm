/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { checkReply, extractPrices, maskPersonal } from '@shared/agentTrain';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  ctx.env.AGENT_RELAY_KEY = 'relay-test-key-123';
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

const relay = async (method: string, path: string, body?: unknown, key = 'relay-test-key-123') => {
  const r = await ctx.app.fetch(
    new Request('http://x/api/agent-train-relay' + path, {
      method,
      headers: { 'X-Relay-Key': key, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    ctx.env,
  );
  return { status: r.status, body: (await r.json()) as { data: any } };
};

const ceo = (path: string, body?: unknown, method?: string) =>
  ctx.request('/api/agent-train' + path, { as: USERS.ceo, body, method } as any);

const addItem = async (over: Record<string, unknown> = {}) => {
  const r = await ceo('/items', { kind: 'PRICE', agent_set: 'SALE', title: 'Bột tẩy vạn năng', body: '149K / 369K / 599K', ...over });
  expect(r.status).toBe(200);
  return r.body.data.id as number;
};

describe('Luật kiểm tra dùng chung', () => {
  it('che số điện thoại, email, link', () => {
    const m = maskPersonal('Gọi 0912 345 678 hoặc a.b@gmail.com xem https://fb.com/x');
    expect(m).not.toMatch(/0912|gmail|fb\.com/);
  });
  it('đọc giá dạng K, nghìn, chấm ngăn cách', () => {
    expect(extractPrices('Combo 369K, lẻ 149.000đ, 1,2tr').sort((a, b) => a - b)).toEqual([149000, 369000, 1200000]);
  });
  it('báo giá lạ và câu cấm, giá đúng thì không báo', () => {
    expect(checkReply('Giá 149K ạ', ['149K / 369K'], [])).toEqual([]);
    expect(checkReply('Chỉ 99K thôi', ['149K'], []).map((f) => f.code)).toEqual(['GIA_LA']);
    expect(checkReply('Dùng oxygen hoạt tính', ['149K'], ['Oxygen hoạt tính']).map((f) => f.code)).toEqual(['CAU_CAM']);
  });
});

describe('Huấn luyện agent trên web', () => {
  it('chỉ CEO dùng được', async () => {
    const r = await ctx.request('/api/agent-train/overview', { as: USERS.thao } as any);
    expect(r.status).toBe(403);
  });

  it('mục mới là nháp; duyệt rồi agent mới thấy; sửa thì về nháp', async () => {
    await ceo('/control', { mode: 'tester' }, 'PUT');
    const id = await addItem();
    expect((await relay('GET', '/pack?set=SALE')).body.data.items).toHaveLength(0);

    expect((await ceo(`/items/${id}/approve`, {})).status).toBe(200);
    const pack = (await relay('GET', '/pack?set=SALE')).body.data;
    expect(pack.items.map((i: any) => i.title)).toEqual(['Bột tẩy vạn năng']);
    // Agent CSKH không thấy mục chỉ dành cho Sale.
    expect((await relay('GET', '/pack?set=CSKH')).body.data.items).toHaveLength(0);

    await ceo(`/items/${id}`, { kind: 'PRICE', agent_set: 'SALE', title: 'Bột tẩy vạn năng', body: '159K' }, 'PATCH');
    expect((await relay('GET', '/pack?set=SALE')).body.data.items).toHaveLength(0);
  });

  it('nút tắt khẩn và chế độ tắt làm gói kiến thức trống', async () => {
    const id = await addItem();
    await ceo(`/items/${id}/approve`, {});
    // Mặc định chế độ tắt.
    expect((await relay('GET', '/pack')).body.data).toMatchObject({ active: false, items: [] });
    await ceo('/control', { mode: 'tester' }, 'PUT');
    expect((await relay('GET', '/pack')).body.data.items).toHaveLength(1);
    await ceo('/control', { kill: true }, 'PUT');
    expect((await relay('GET', '/pack')).body.data).toMatchObject({ active: false, items: [] });
    await ceo('/control', { kill: false }, 'PUT');
    expect((await relay('GET', '/pack')).body.data.items).toHaveLength(1);
  });

  it('không có chế độ gửi cho khách thật', async () => {
    expect((await ceo('/control', { mode: 'live' }, 'PUT')).status).toBe(400);
    expect((await ceo('/control', {}, 'PUT')).body.data.mode).toBe('off');
  });

  it('thiết lập giờ trả lời, thời gian im; lịch sử ghi lại việc tắt khẩn và duyệt', async () => {
    expect((await ceo('/control', { hours_from: '08:00' }, 'PUT')).status).toBe(400);
    expect((await ceo('/control', { hours_from: '8h', hours_to: '22:00' }, 'PUT')).status).toBe(400);
    const ok = await ceo('/control', { hours_from: '08:00', hours_to: '22:00', silent_minutes: 45 }, 'PUT');
    expect(ok.body.data).toMatchObject({ hours_from: '08:00', hours_to: '22:00', silent_minutes: 45 });
    const id = await addItem();
    await ceo(`/items/${id}/approve`, {});
    await ceo('/control', { kill: true }, 'PUT');
    const log = (await ceo('/log')).body.data.map((l: any) => l.action);
    expect(log).toEqual(expect.arrayContaining(['item.create', 'item.approve', 'control.kill']));
    expect((await ceo('/log')).body.data[0].by_name).toBeTruthy();
  });

  it('cầu nối sai khoá bị từ chối', async () => {
    expect((await relay('GET', '/pack', undefined, 'sai')).status).toBe(401);
  });

  it('đề xuất của agent: chờ duyệt, chị sửa chữ rồi duyệt mới thành mục đã duyệt', async () => {
    await ceo('/control', { mode: 'tester' }, 'PUT');
    const s = await relay('POST', '/suggest', {
      agent: 'lead-sale-ailla',
      kind: 'SCRIPT',
      title: 'Bám đuổi sau 2 giờ',
      body: 'Chị ơi bên em giữ ưu đãi tới tối nay ạ',
      reason: '8/10 khách chốt sau khi sale nhắc lần hai',
      evidence: 'Khách 0912345678: để em xem',
    });
    expect(s.status).toBe(200);
    // Chưa duyệt thì agent chưa thấy gì.
    expect((await relay('GET', '/pack')).body.data.items).toHaveLength(0);

    const list = (await ceo('/suggestions')).body.data;
    expect(list).toHaveLength(1);
    expect(list[0].evidence).not.toContain('0912345678');

    const ap = await ceo(`/suggestions/${list[0].id}/approve`, { body: 'Chị ơi em giữ ưu đãi tới tối nay nhé' });
    expect(ap.status).toBe(200);
    const items = (await relay('GET', '/pack')).body.data.items;
    expect(items.map((i: any) => i.body)).toEqual(['Chị ơi em giữ ưu đãi tới tối nay nhé']);
    expect((await ceo('/suggestions')).body.data).toHaveLength(0);
    // Duyệt lần hai thì không còn chờ.
    expect((await ceo(`/suggestions/${list[0].id}/approve`, {})).status).toBe(404);
  });

  it('từ chối đề xuất thì không vào kho', async () => {
    await relay('POST', '/suggest', { kind: 'FAQ', title: 'x', body: 'y' });
    const id = (await ceo('/suggestions')).body.data[0].id;
    expect((await ceo(`/suggestions/${id}/reject`, { note: 'sai' })).status).toBe(200);
    const all = (await ceo('/items')).body.data;
    expect(all).toHaveLength(0);
  });

  it('chạy thử: che thông tin cá nhân, agent trả lời, giá lạ bị đánh dấu, chị chấm điểm', async () => {
    const pid = await addItem();
    await ceo(`/items/${pid}/approve`, {});
    await ceo('/items', { kind: 'RULE', title: 'Câu cấm', body: 'oxygen hoạt tính' });
    const rid = (await ceo('/items?kind=RULE')).body.data[0].id;
    await ceo(`/items/${rid}/approve`, {});

    const add = await ceo('/evals', { agent_set: 'SALE', cases: [{ customer_msg: 'Giá bao nhiêu? sđt 0987654321', sale_reply: 'Dạ 149K ạ' }] });
    expect(add.body.data.added).toBe(1);
    const pend = (await relay('GET', '/evals/pending')).body.data;
    expect(pend).toHaveLength(1);
    expect(pend[0].customer_msg).not.toContain('0987654321');

    const ans = await relay('POST', `/evals/${pend[0].id}/answer`, { reply: 'Chỉ 99K, dùng oxygen hoạt tính' });
    expect(ans.body.data.flags.map((f: any) => f.code).sort()).toEqual(['CAU_CAM', 'GIA_LA']);
    expect((await relay('POST', `/evals/${pend[0].id}/answer`, { reply: 'lại' })).status).toBe(404);

    const ev = (await ceo('/evals')).body.data;
    expect(ev[0].flags).toHaveLength(2);
    expect((await ceo(`/evals/${ev[0].id}/score`, { score: 9 })).status).toBe(400);
    expect((await ceo(`/evals/${ev[0].id}/score`, { score: 2, note: 'sai giá' })).status).toBe(200);
    expect((await ceo('/overview')).body.data.evals.avg_score).toBe(2);
  });

  it('nút tắt khẩn dừng cả hàng chờ chạy thử', async () => {
    await ceo('/evals', { cases: [{ customer_msg: 'hi' }] });
    await ceo('/control', { kill: true }, 'PUT');
    expect((await relay('GET', '/evals/pending')).body.data).toHaveLength(0);
  });
});

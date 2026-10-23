/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { checkReply, extractPrices, maskPersonal } from '@shared/agentTrain';
import { emptyDoc, normalizeDoc, simulate, validateDoc, type BotDoc, type SimState } from '@shared/agentFlow';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

/** Bot mẫu nhỏ: chào, báo giá (có nút), chốt có điều kiện, giá sỉ chuyển chị, mốc gioăng chưa có giá. */
function sampleDoc(): BotDoc {
  const d = emptyDoc();
  d.products = [
    { id: 'long', name: 'Tẩy lồng' },
    { id: 'moc', name: 'Tẩy mốc gioăng' },
  ];
  d.offers = [
    { id: 'o1', prod: 'long', name: 'Mua riêng', lv: 'Mức 1', price: '145K', from: '' },
    { id: 'o2', prod: 'long', name: 'Mua riêng', lv: 'Mức 2', price: '205K', from: '' },
  ];
  d.media = [{ g: 'LONG', d: 'Giá tẩy lồng', urls: ['https://example.com/long1.jpg'] }];
  d.lib = [
    { id: 'm1', code: 'CHAO_01', grp: 'Mở đầu', text: 'Dạ {xh} ơi, AILLA xin chào {xh} ạ 🌸', claim: '', img: '' },
    { id: 'm2', code: 'GIA_01', grp: 'Báo giá', text: 'Dạ giá tẩy lồng hiện đang là {gia_long} ạ 👉', claim: '', img: 'LONG' },
    { id: 'm3', code: 'XIN_TT', grp: 'Chốt', text: 'Dạ {xh} cho em xin tên và địa chỉ nhận hàng ạ', claim: '', img: '' },
    { id: 'm4', code: 'MOC_GIA', grp: 'Báo giá', text: 'Tẩy mốc gioăng hiện đang là {gia_moc} ạ', claim: '', img: '' },
    { id: 'm5', code: 'SAI_GIA', grp: 'Báo giá', text: 'Chỉ 99K thôi ạ', claim: '', img: '' },
  ];
  d.flows = [
    { id: 'f1', code: 'TL-01', name: 'Mở đầu', keys: 'chào, alo', entry: true, win: 'in', allow: ['f2'], nodes: [{ id: 'a1', t: 'msg', x: 0, y: 0, ref: 'm1', btns: [{ label: 'Xem giá', to: 'f2' }], next: '' }] },
    { id: 'f2', code: 'TL-02', name: 'Báo giá', keys: 'giá, bao nhiêu', entry: true, win: 'in', allow: ['f3'], nodes: [{ id: 'b1', t: 'msg', x: 0, y: 0, ref: 'm2', btns: [], next: '' }] },
    {
      id: 'f3', code: 'TL-03', name: 'Chốt', keys: 'lấy, chốt', entry: false, win: 'in', allow: [],
      nodes: [
        { id: 'c1', t: 'cond', x: 0, y: 0, c: 'phone', yes: 'c3', no: 'c2' },
        { id: 'c2', t: 'msg', x: 0, y: 0, ref: 'm3', btns: [], next: 'c3' },
        { id: 'c3', t: 'handoff', x: 0, y: 0, ref: 'Khách chốt, chuyển chị' },
      ],
    },
    { id: 'f4', code: 'MG-01', name: 'Mốc gioăng', keys: 'mốc, gioăng', entry: true, win: 'in', allow: [], nodes: [{ id: 'd1', t: 'msg', x: 0, y: 0, ref: 'm4', btns: [], next: '' }] },
    { id: 'f5', code: 'SI-01', name: 'Giá sỉ', keys: 'sỉ, đại lý', entry: true, win: 'in', allow: [], nodes: [{ id: 'e1', t: 'handoff', x: 0, y: 0, ref: 'Khách hỏi giá sỉ' }] },
    { id: 'f6', code: 'LOI-01', name: 'Giá sai (thử chặn)', keys: 'thử chặn', entry: true, win: 'in', allow: [], nodes: [{ id: 'g1', t: 'msg', x: 0, y: 0, ref: 'm5', btns: [], next: '' }] },
  ];
  return d;
}
const st0: SimState = { cur: null, xh: '', phone: false };

describe('Luật kiểm tra dùng chung', () => {
  it('che số điện thoại, email, link', () => {
    expect(maskPersonal('Gọi 0912 345 678 hoặc a.b@gmail.com xem https://fb.com/x')).not.toMatch(/0912|gmail|fb\.com/);
  });
  it('đọc giá dạng K, nghìn, chấm ngăn cách', () => {
    expect(extractPrices('Combo 369K, lẻ 149.000đ, 1,2tr').sort((a, b) => a - b)).toEqual([149000, 369000, 1200000]);
  });
  it('báo giá lạ và câu cấm', () => {
    expect(checkReply('Giá 149K ạ', ['149K'], [])).toEqual([]);
    expect(checkReply('Chỉ 99K thôi', ['149K'], []).map((f) => f.code)).toEqual(['GIA_LA']);
    expect(checkReply('Dùng oxygen hoạt tính', ['149K'], ['Oxygen hoạt tính']).map((f) => f.code)).toEqual(['CAU_CAM']);
  });
});

describe('Bộ chạy luồng', () => {
  const doc = sampleDoc();
  const kinds = (r: ReturnType<typeof simulate>) => r.messages.map((m) => m.kind);

  it('khách chào thì chạy luồng mở đầu, chưa rõ giới tính xưng "mình", câu đầu viết hoa', () => {
    const r = simulate(doc, { text: 'xin chào shop' }, st0, 'Page A');
    expect(r.result).toMatchObject({ kind: 'sent', flow: 'TL-01' });
    expect(r.messages[0].text).toBe('Dạ mình ơi, AILLA xin chào mình ạ 🌸');
    expect(r.messages[0].buttons).toEqual([{ label: 'Xem giá', to: 'f2' }]);
    expect(r.state.cur).toBe('f1');
  });

  it('báo giá lấy từ bảng giá, kèm ảnh của nhóm', () => {
    const r = simulate(doc, { text: 'giá bao nhiêu' }, st0, 'Page A');
    expect(r.messages[0].text).toContain('145K / 205K');
    expect(kinds(r)).toEqual(['agent', 'image']);
    expect(r.messages[1].urls).toEqual(['https://example.com/long1.jpg']);
  });

  it('khách bấm nút thì chạy thẳng luồng của nút, không cần agent chọn', () => {
    const r = simulate(doc, { flowId: 'f2' }, st0, 'Page A');
    expect(r.result.flow).toBe('TL-02');
  });

  it('sau luồng vừa gửi agent chỉ được chọn luồng được phép: TL-03 chỉ vào được sau TL-02', () => {
    expect(simulate(doc, { text: 'lấy' }, st0, 'P').result.kind).toBe('out_of_script');
    const after = simulate(doc, { text: 'lấy luôn' }, { ...st0, cur: 'f2' }, 'P');
    expect(after.result.flow).toBe('TL-03');
  });

  it('điều kiện: chưa có SĐT thì xin thông tin rồi chuyển chị; đã có SĐT thì chuyển chị luôn', () => {
    const a = simulate(doc, { text: 'chốt' }, { ...st0, cur: 'f2' }, 'P');
    expect(kinds(a)).toEqual(['agent', 'system']);
    expect(a.result.kind).toBe('handoff');
    const b = simulate(doc, { text: 'chốt' }, { cur: 'f2', xh: 'anh', phone: true }, 'P');
    expect(kinds(b)).toEqual(['system']);
  });

  it('câu ngoài kịch bản thì dừng và báo chị', () => {
    const r = simulate(doc, { text: 'bảo hành bao lâu' }, st0, 'P');
    expect(r.result.kind).toBe('out_of_script');
    expect(r.state.cur).toBeNull();
  });

  it('giá sỉ chuyển chị Hoa', () => {
    expect(simulate(doc, { text: 'giá sỉ nha' }, st0, 'P').result).toMatchObject({ kind: 'handoff', flow: 'SI-01' });
  });

  it('thiếu giá thì chặn câu, không bịa', () => {
    const r = simulate(doc, { text: 'tẩy mốc gioăng giá sao' }, st0, 'P');
    expect(r.result.kind).toBe('blocked');
    expect(r.messages.every((m) => m.kind === 'system')).toBe(true);
    expect(r.messages[0].text).toContain('gia_moc');
  });

  it('câu có giá không có trong bảng giá bị chặn', () => {
    const r = simulate(doc, { text: 'thử chặn' }, st0, 'P');
    expect(r.result.kind).toBe('blocked');
    expect(r.messages[0].text).toContain('99');
  });

  it('xem thử luồng chạy thẳng luồng chỉ định', () => {
    expect(simulate(doc, { previewFlow: 'f3' }, st0, 'P').result.flow).toBe('TL-03');
  });
});

describe('Kiểm tra kịch bản', () => {
  it('bản mẫu hợp lệ, chỉ có cảnh báo thiếu giá mốc gioăng', () => {
    const issues = validateDoc(sampleDoc());
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(issues.some((i) => i.level === 'warn' && i.msg.includes('Tẩy mốc gioăng'))).toBe(true);
  });
  it('bắt lỗi: mã câu trùng, biến lạ, ảnh không có, luồng nối ô đã xóa', () => {
    const d = sampleDoc();
    d.lib.push({ id: 'x', code: 'CHAO_01', grp: '', text: 'Xin {bien_la}', claim: '', img: 'KHONGCO' });
    d.flows[0].nodes[0].next = 'khong-con';
    const msgs = validateDoc(d).filter((i) => i.level === 'error').map((i) => i.msg).join('|');
    expect(msgs).toContain('trùng');
    expect(msgs).toContain('{bien_la}');
    expect(msgs).toContain('KHONGCO');
    expect(msgs).toContain('ô không còn');
  });
  it('đường dẫn ảnh phải là https', () => {
    const d = sampleDoc();
    d.media[0].urls = ['http://x.com/a.jpg'];
    expect(validateDoc(d).some((i) => i.level === 'error' && i.msg.includes('https'))).toBe(true);
  });
  it('nắn dữ liệu lạ về đúng hình dạng', () => {
    const d = normalizeDoc({ flows: [{ id: 'f', nodes: [{ id: 'n', t: 'xxx' }] }], lib: 'sai' });
    expect(d.lib).toEqual([]);
    expect(d.flows[0].nodes[0].t).toBe('msg');
  });
});

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
const ceo = (path: string, body?: unknown, method?: string) => ctx.request('/api/agent-train' + path, { as: USERS.ceo, body, method } as any);

async function newBot(name = 'Bot tẩy lồng', draft: BotDoc | null = sampleDoc()) {
  const r = await ceo('/bots', { name });
  expect(r.status).toBe(200);
  const id = r.body.data.id as string;
  if (draft) expect((await ceo(`/bots/${id}`, { draft }, 'PUT')).status).toBe(200);
  return id;
}

describe('Bot, phiên bản, Page', () => {
  it('chỉ CEO dùng được', async () => {
    expect((await ctx.request('/api/agent-train/bots', { as: USERS.thao } as any)).status).toBe(403);
  });

  it('tạo bot, lưu nháp, nháp báo chưa xuất bản; nhân bản bot', async () => {
    const id = await newBot();
    const list = (await ceo('/bots')).body.data;
    expect(list[0]).toMatchObject({ id, dirty: true, current_version: null, counts: { flows: 6 } });
    const copy = await ceo('/bots', { name: 'Bản sao', from: id });
    const got = (await ceo(`/bots/${copy.body.data.id}`)).body.data;
    expect(got.draft.flows).toHaveLength(6);
    expect(got.issues.some((i: any) => i.level === 'warn')).toBe(true);
  });

  it('xuất bản bị chặn khi còn lỗi, được khi hết lỗi; cảnh báo không chặn', async () => {
    const bad = sampleDoc();
    bad.flows[0].nodes[0].ref = 'khong-co';
    const id = await newBot('Bot lỗi', bad);
    const r = await ceo(`/bots/${id}/publish`, {});
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('DOC_INVALID');
    await ceo(`/bots/${id}`, { draft: sampleDoc() }, 'PUT');
    const ok1 = await ceo(`/bots/${id}/publish`, { note: 'lần đầu' });
    expect(ok1.status).toBe(200);
    expect(ok1.body.data.version).toBe(1);
    expect(ok1.body.data.warnings.length).toBeGreaterThan(0);
    expect((await ceo(`/bots/${id}`)).body.data.dirty).toBe(false);
  });

  it('phiên bản tăng dần, quay lại bản cũ thành bản mới, lịch sử còn nguyên', async () => {
    const id = await newBot();
    await ceo(`/bots/${id}/publish`, {});
    const d2 = sampleDoc();
    d2.offers[0].price = '155K';
    await ceo(`/bots/${id}`, { draft: d2 }, 'PUT');
    expect((await ceo(`/bots/${id}/publish`, {})).body.data.version).toBe(2);
    const rb = await ceo(`/bots/${id}/rollback`, { version: 1 });
    expect(rb.body.data.version).toBe(3);
    const got = (await ceo(`/bots/${id}`)).body.data;
    expect(got.draft.offers[0].price).toBe('145K');
    expect(got.versions.map((v: any) => [v.version, v.is_current])).toEqual([[3, 1], [2, 0], [1, 0]]);
    expect((await ceo(`/bots/${id}/rollback`, { version: 99 })).status).toBe(404);
  });

  it('Page: thêm, gắn bot, chỉ bật thử khi bot đã xuất bản, không có chế độ khách thật', async () => {
    const id = await newBot();
    const p = await ceo('/pages', { name: 'Ailla Việt Nam Store', fb_page_id: '105017945992971' });
    const pid = p.body.data.id;
    expect((await ceo('/pages', { name: 'Trùng', fb_page_id: '105017945992971' })).status).toBe(409);
    expect((await ceo('/pages', { name: 'Sai', fb_page_id: 'abc' })).status).toBe(400);
    expect((await ceo(`/pages/${pid}`, { bot_id: id, mode: 'tester' }, 'PATCH')).status).toBe(422);
    await ceo(`/bots/${id}/publish`, {});
    expect((await ceo(`/pages/${pid}`, { bot_id: id, mode: 'tester' }, 'PATCH')).status).toBe(200);
    expect((await ceo(`/pages/${pid}`, { mode: 'live' }, 'PATCH')).status).toBe(400);
    // gỡ bot thì chế độ tự về tắt
    const un = await ceo(`/pages/${pid}`, { bot_id: null }, 'PATCH');
    expect(un.body.data.mode).toBe('off');
  });

  it('không xóa được bot đang gắn Page', async () => {
    const id = await newBot();
    const p = await ceo('/pages', { name: 'P', fb_page_id: '12345678' });
    await ceo(`/pages/${p.body.data.id}`, { bot_id: id }, 'PATCH');
    expect((await ceo(`/bots/${id}`, undefined, 'DELETE')).status).toBe(409);
    await ceo(`/pages/${p.body.data.id}`, { bot_id: null }, 'PATCH');
    expect((await ceo(`/bots/${id}`, undefined, 'DELETE')).status).toBe(200);
  });

  it('mô phỏng trên nháp theo trạng thái gửi lên, và trên bản đang dùng', async () => {
    const id = await newBot();
    const a = await ceo(`/bots/${id}/simulate`, { text: 'xin chào', page: 'Page A' });
    expect(a.body.data.result.flow).toBe('TL-01');
    const b = await ceo(`/bots/${id}/simulate`, { text: 'giá', state: a.body.data.state });
    expect(b.body.data.result.flow).toBe('TL-02');
    expect((await ceo(`/bots/${id}/simulate`, { text: 'x', use: 'published' })).status).toBe(404);
    await ceo(`/bots/${id}/publish`, {});
    const c = await ceo(`/bots/${id}/simulate`, { text: 'bảo hành', use: 'published' });
    expect(c.body.data.result.kind).toBe('out_of_script');
    // nháp sửa chưa xuất bản thì bản đang dùng không đổi
    const d2 = sampleDoc();
    d2.offers[0].price = '999K';
    const dr = await ceo(`/bots/${id}/simulate`, { text: 'giá', draft: d2 });
    expect(dr.body.data.messages[0].text).toContain('999K');
    const pub = await ceo(`/bots/${id}/simulate`, { text: 'giá', use: 'published' });
    expect(pub.body.data.messages[0].text).toContain('145K');
  });
});

describe('Nút tắt khẩn, giờ trả lời và gói cho agent', () => {
  async function livePage() {
    const id = await newBot();
    await ceo(`/bots/${id}/publish`, {});
    const p = await ceo('/pages', { name: 'Ailla Việt Nam Store', fb_page_id: '105017945992971' });
    await ceo(`/pages/${p.body.data.id}`, { bot_id: id, mode: 'tester' }, 'PATCH');
    return id;
  }

  it('agent chỉ nhận phiên bản đang dùng, không thấy nháp', async () => {
    const id = await livePage();
    const d2 = sampleDoc();
    d2.offers[0].price = '999K';
    await ceo(`/bots/${id}`, { draft: d2 }, 'PUT');
    const pack = (await relay('GET', '/pack?page=105017945992971')).body.data;
    expect(pack.active).toBe(true);
    expect(pack.bot.version).toBe(1);
    expect(pack.bot.data.offers[0].price).toBe('145K');
  });

  it('nút tắt khẩn, chế độ tắt, Page lạ, bot chưa xuất bản đều làm gói rỗng', async () => {
    const id = await livePage();
    const active = async (page = '105017945992971') => (await relay('GET', '/pack?page=' + page)).body.data;
    expect((await active()).active).toBe(true);
    await ceo('/control', { kill: true }, 'PUT');
    expect(await active()).toMatchObject({ active: false, reason: 'kill', bot: null });
    await ceo('/control', { kill: false }, 'PUT');
    expect((await active()).active).toBe(true);
    expect((await active('999999999')).reason).toBe('page_unknown');
    const pages = (await ceo('/pages')).body.data;
    await ceo(`/pages/${pages[0].id}`, { mode: 'off' }, 'PATCH');
    expect((await active()).reason).toBe('mode_off');
    // bot mới chưa xuất bản gắn vào Page khác
    const b2 = await newBot('Bot chưa xuất bản');
    const p2 = await ceo('/pages', { name: 'P2', fb_page_id: '22222222' });
    await ceo(`/pages/${p2.body.data.id}`, { bot_id: b2 }, 'PATCH');
    expect((await active('22222222')).reason).toBe('mode_off');
    expect(id).toBeTruthy();
  });

  it('tắt khẩn cũng chặn mô phỏng, và thiết lập giờ / im lặng được kiểm tra', async () => {
    const id = await newBot();
    await ceo('/control', { kill: true }, 'PUT');
    expect((await ceo(`/bots/${id}/simulate`, { text: 'xin chào' })).body.data.result.kind).toBe('blocked');
    expect((await ceo('/control', { hours_from: '08:00' }, 'PUT')).status).toBe(400);
    expect((await ceo('/control', { hours_from: '8h', hours_to: '22:00' }, 'PUT')).status).toBe(400);
    const okc = await ceo('/control', { kill: false, hours_from: '08:00', hours_to: '22:00', silent_minutes: 45 }, 'PUT');
    expect(okc.body.data).toMatchObject({ hours_from: '08:00', hours_to: '22:00', silent_minutes: 45, kill: false });
  });

  it('nhật ký ghi lại xuất bản, gắn Page, tắt khẩn; nhật ký agent che thông tin khách', async () => {
    const id = await livePage();
    await ceo('/control', { kill: true }, 'PUT');
    const log = (await ceo('/log')).body.data;
    expect(log.map((l: any) => l.action)).toEqual(expect.arrayContaining(['bot.create', 'bot.publish', 'page.add', 'page.update', 'control.kill']));
    expect(log[0].by_name).toBeTruthy();
    const r = await relay('POST', '/run', { page: '105017945992971', bot_id: id, version: 1, flow: 'TL-02', result: 'sent', customer: 'Gọi 0912345678 nhé' });
    expect(r.status).toBe(200);
    expect((await relay('POST', '/run', { result: 'la' })).status).toBe(400);
    const runs = (await ceo('/runs')).body.data;
    expect(runs[0]).toMatchObject({ flow: 'TL-02', result: 'sent', version: 1 });
    expect(runs[0].customer).not.toContain('0912345678');
    const list = (await ceo('/bots')).body.data;
    expect(list[0].runs).toMatchObject({ sent: 1, handoff: 0 });
  });

  it('cầu nối sai khoá bị từ chối', async () => {
    expect((await relay('GET', '/pack?page=1', undefined, 'sai')).status).toBe(401);
  });
});

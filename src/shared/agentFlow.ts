import { checkReply } from './agentTrain';

/**
 * Bộ não kịch bản của một bot bán hàng: cấu trúc dữ liệu, kiểm tra và bộ chạy luồng.
 * Dùng chung cho web (kiểm tra khi lưu/xuất bản, mô phỏng) và công cụ trên VPS.
 * Luồng giống Botcake: gửi một mạch từ ô bắt đầu rồi dừng, không chờ khách trả lời.
 * Khách nói tiếp thì khách bấm nút (chạy luồng gắn nút) hoặc agent chọn luồng kế trong danh sách "được phép".
 */

export type NodeType = 'msg' | 'img' | 'cond' | 'jump' | 'handoff';
export type CondKind = 'xh' | 'phone';

export interface FlowButton {
  label: string;
  to: string;
}
export interface FlowNode {
  id: string;
  t: NodeType;
  x: number;
  y: number;
  ref?: string; // msg: id câu mẫu · img: mã nhóm ảnh · handoff: lý do
  btns?: FlowButton[];
  next?: string;
  c?: CondKind;
  yes?: string;
  no?: string;
  to?: string; // jump: id luồng
}
export interface Flow {
  id: string;
  code: string;
  name: string;
  keys: string;
  entry: boolean;
  win: 'in' | 'out';
  allow: string[];
  nodes: FlowNode[];
}
export interface Phrase {
  id: string;
  code: string;
  grp: string;
  text: string;
  claim: string;
  img: string; // mã nhóm ảnh đi kèm
}
export interface Product {
  id: string; // dùng trong biến {gia_<id>}
  name: string;
}
export interface Offer {
  id: string;
  prod: string;
  name: string;
  lv: string;
  price: string;
  from: string;
}
export interface MediaGroup {
  g: string;
  d: string;
  urls: string[];
}
export interface Follow {
  id: string;
  when: string;
  ref: string;
}
export interface TextItem {
  id: string;
  text: string;
  on: boolean;
}
export interface BotDoc {
  products: Product[];
  lib: Phrase[];
  flows: Flow[];
  offers: Offer[];
  media: MediaGroup[];
  follow: Follow[];
  rules: TextItem[];
  handoff: TextItem[];
  banned: string[];
}

export const emptyDoc = (): BotDoc => ({
  products: [],
  lib: [],
  flows: [],
  offers: [],
  media: [],
  follow: [],
  rules: [
    { id: 'r1', text: 'Chưa chắc giới tính thì xưng "mình", không đoán.', on: true },
    { id: 'r2', text: 'Chỉ dùng cam kết có trong kịch bản đã duyệt.', on: true },
    { id: 'r3', text: 'Giá chỉ lấy từ bảng giá đang hiệu lực.', on: true },
    { id: 'r4', text: 'Chưa tạo đơn hàng ở giai đoạn này.', on: true },
  ],
  handoff: [
    { id: 'h1', text: 'Khiếu nại', on: true },
    { id: 'h2', text: 'Hỏi giá sỉ / đại lý', on: true },
    { id: 'h3', text: 'Khách đòi gặp người thật', on: true },
    { id: 'h4', text: 'Câu ngoài kịch bản đã duyệt', on: true },
    { id: 'h5', text: 'Dữ liệu mâu thuẫn', on: true },
  ],
  banned: [],
});

/** Nắn dữ liệu client gửi lên về đúng hình dạng, bỏ trường lạ, cắt độ dài. Không bao giờ ném lỗi. */
export function normalizeDoc(input: unknown): BotDoc {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : []);
  const s = (v: unknown, max: number) => String(v ?? '').slice(0, max);
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
  const ids = (v: unknown) => (Array.isArray(v) ? v.map((x) => s(x, 60)).filter(Boolean).slice(0, 100) : []);
  const base = emptyDoc();
  return {
    products: arr(o.products).slice(0, 50).map((p) => ({ id: s(p.id, 40).toLowerCase().replace(/[^a-z0-9_]/g, ''), name: s(p.name, 120) })),
    lib: arr(o.lib).slice(0, 500).map((m) => ({
      id: s(m.id, 60),
      code: s(m.code, 60),
      grp: s(m.grp, 80),
      text: s(m.text, 1200),
      claim: s(m.claim, 300),
      img: s(m.img, 60),
    })),
    flows: arr(o.flows).slice(0, 200).map((f) => ({
      id: s(f.id, 60),
      code: s(f.code, 60),
      name: s(f.name, 160),
      keys: s(f.keys, 600),
      entry: !!f.entry,
      win: f.win === 'out' ? 'out' : 'in',
      allow: ids(f.allow),
      nodes: arr(f.nodes).slice(0, 80).map((x): FlowNode => {
        const t: NodeType = (['msg', 'img', 'cond', 'jump', 'handoff'] as const).find((k) => k === x.t) ?? 'msg';
        const node: FlowNode = { id: s(x.id, 60), t, x: Math.max(0, n(x.x)), y: Math.max(0, n(x.y)) };
        if (t === 'msg') {
          node.ref = s(x.ref, 60);
          node.btns = arr(x.btns).slice(0, 3).map((b) => ({ label: s(b.label, 40), to: s(b.to, 60) }));
          node.next = s(x.next, 60);
        } else if (t === 'img') {
          node.ref = s(x.ref, 60);
          node.next = s(x.next, 60);
        } else if (t === 'cond') {
          node.c = x.c === 'phone' ? 'phone' : 'xh';
          node.yes = s(x.yes, 60);
          node.no = s(x.no, 60);
        } else if (t === 'jump') node.to = s(x.to, 60);
        else node.ref = s(x.ref, 300);
        return node;
      }),
    })),
    offers: arr(o.offers).slice(0, 300).map((x) => ({
      id: s(x.id, 60),
      prod: s(x.prod, 40),
      name: s(x.name, 120),
      lv: s(x.lv, 60),
      price: s(x.price, 40),
      from: s(x.from, 40),
    })),
    media: arr(o.media).slice(0, 100).map((g) => ({
      g: s(g.g, 40).toUpperCase().replace(/\s+/g, ''),
      d: s(g.d, 160),
      urls: Array.isArray(g.urls) ? g.urls.map((u) => s(u, 600)).filter(Boolean).slice(0, 60) : [],
    })),
    follow: arr(o.follow).slice(0, 5).map((x) => ({ id: s(x.id, 60), when: s(x.when, 160), ref: s(x.ref, 60) })),
    rules: o.rules === undefined ? base.rules : arr(o.rules).slice(0, 100).map((x) => ({ id: s(x.id, 60), text: s(x.text, 400), on: !!x.on })),
    handoff: o.handoff === undefined ? base.handoff : arr(o.handoff).slice(0, 100).map((x) => ({ id: s(x.id, 60), text: s(x.text, 400), on: !!x.on })),
    banned: Array.isArray(o.banned) ? o.banned.map((x) => s(x, 200)).filter(Boolean).slice(0, 200) : [],
  };
}

/* ---------- Kiểm tra khi lưu / xuất bản ---------- */

export interface DocIssue {
  level: 'error' | 'warn';
  msg: string;
}

const VAR_RE = /\{(\w+)\}/g;

export function allowedVars(doc: BotDoc): Set<string> {
  return new Set(['xh', 'ten_page', ...doc.products.map((p) => `gia_${p.id}`)]);
}

export function validateDoc(doc: BotDoc): DocIssue[] {
  const out: DocIssue[] = [];
  const err = (msg: string) => out.push({ level: 'error', msg });
  const warn = (msg: string) => out.push({ level: 'warn', msg });
  const vars = allowedVars(doc);
  const libIds = new Set(doc.lib.map((m) => m.id));
  const groups = new Set(doc.media.map((g) => g.g));
  const flowIds = new Set(doc.flows.map((f) => f.id));
  const seen = new Set<string>();
  for (const m of doc.lib) {
    if (!m.code) err('Có câu mẫu chưa có mã.');
    else if (seen.has(m.code)) err(`Mã câu mẫu bị trùng: ${m.code}.`);
    seen.add(m.code);
    if (!m.text.trim()) err(`Câu mẫu ${m.code || '(chưa có mã)'} chưa có nội dung.`);
    if (m.text.length > 400) warn(`Câu mẫu ${m.code} dài ${m.text.length} ký tự, nên chia thành các tin ngắn (khoảng 200 chữ).`);
    for (const v of m.text.matchAll(VAR_RE)) if (!vars.has(v[1])) err(`Câu mẫu ${m.code} dùng biến {${v[1]}} không có.`);
    if (m.img && !groups.has(m.img)) err(`Câu mẫu ${m.code} gắn ảnh nhóm "${m.img}" không tồn tại.`);
  }
  for (const g of doc.media) {
    for (const u of g.urls) if (!/^https:\/\//i.test(u)) err(`Nhóm ảnh ${g.g}: đường dẫn "${u.slice(0, 40)}" phải bắt đầu bằng https://.`);
    if (!g.urls.length) warn(`Nhóm ảnh ${g.g} chưa có ảnh nào.`);
  }
  const flowCodes = new Set<string>();
  const reach = new Set<string>();
  for (const f of doc.flows) {
    if (!f.code) err(`Luồng "${f.name}" chưa có mã.`);
    else if (flowCodes.has(f.code)) err(`Mã luồng bị trùng: ${f.code}.`);
    flowCodes.add(f.code);
    if (!f.nodes.length) {
      err(`Luồng ${f.code} chưa có ô nào.`);
      continue;
    }
    const nodeIds = new Set(f.nodes.map((n) => n.id));
    const link = (what: string, to?: string) => {
      if (to && !nodeIds.has(to)) err(`Luồng ${f.code}: ${what} nối tới ô không còn.`);
    };
    for (const a of f.allow) {
      if (!flowIds.has(a)) err(`Luồng ${f.code}: danh sách "agent được chọn sau" có luồng không còn.`);
      reach.add(a);
    }
    for (const n of f.nodes) {
      if (n.t === 'msg') {
        if (!n.ref || !libIds.has(n.ref)) err(`Luồng ${f.code}: có ô câu mẫu chưa chọn hoặc câu mẫu đã bị xóa.`);
        link('ô câu mẫu', n.next);
        for (const b of n.btns ?? []) {
          if (b.label && !b.to) warn(`Luồng ${f.code}: nút "${b.label}" chưa chọn luồng.`);
          if (b.to) {
            if (!flowIds.has(b.to)) err(`Luồng ${f.code}: nút "${b.label}" trỏ tới luồng không còn.`);
            reach.add(b.to);
          }
        }
      } else if (n.t === 'img') {
        if (!n.ref || !groups.has(n.ref)) err(`Luồng ${f.code}: ô ảnh chưa chọn nhóm ảnh hợp lệ.`);
        link('ô ảnh', n.next);
      } else if (n.t === 'cond') {
        link('nhánh "Có"', n.yes);
        link('nhánh "Không"', n.no);
        if (!n.yes || !n.no) warn(`Luồng ${f.code}: ô Điều kiện chưa nối đủ hai nhánh Có / Không.`);
      } else if (n.t === 'jump') {
        if (!n.to || !flowIds.has(n.to)) err(`Luồng ${f.code}: ô Chuyển luồng chưa chọn luồng đích.`);
        else reach.add(n.to);
      }
    }
  }
  for (const f of doc.flows) {
    if (!f.entry && !reach.has(f.id)) warn(`Luồng ${f.code} không ai gọi tới (không phải luồng mở đầu, không có nút hay danh sách nào trỏ vào).`);
  }
  if (!doc.flows.some((f) => f.entry)) warn('Chưa có luồng nào cho agent chọn từ đầu hội thoại.');
  // thiếu giá của sản phẩm mà câu mẫu đang dùng biến giá
  for (const p of doc.products) {
    const v = `{gia_${p.id}}`;
    if (!doc.offers.some((o) => o.prod === p.id && o.price.trim()) && doc.lib.some((m) => m.text.includes(v))) {
      warn(`Sản phẩm "${p.name}" chưa có giá nhưng có câu mẫu báo giá: agent sẽ dừng và báo chị khi khách hỏi giá.`);
    }
  }
  for (const f of doc.follow) if (!f.ref) warn('Có lần bám đuổi chưa chọn câu mẫu: lần đó sẽ không gửi.');
  return out;
}

/* ---------- Bộ chạy luồng (mô phỏng và dùng chung cho VPS) ---------- */

export interface SimState {
  cur: string | null; // id luồng vừa gửi
  xh: '' | 'anh' | 'chị';
  phone: boolean;
}
export interface SimMessage {
  kind: 'agent' | 'image' | 'system';
  text: string;
  urls?: string[];
  buttons?: FlowButton[];
}
export interface SimResult {
  messages: SimMessage[];
  log: string[];
  result: { kind: 'sent' | 'handoff' | 'blocked' | 'out_of_script' | 'nothing'; note: string; flow: string | null };
  state: SimState;
}

export function offerTexts(doc: BotDoc): string[] {
  return doc.offers.map((o) => `${o.name} ${o.lv} ${o.price}`);
}

export function priceOf(doc: BotDoc, prod: string): string {
  return doc.offers
    .filter((o) => o.prod === prod && o.price.trim())
    .map((o) => o.price.trim())
    .join(' / ');
}

export function renderText(doc: BotDoc, text: string, ctx: { xh: string; pageName: string }): { out: string; miss: string[] } {
  const miss: string[] = [];
  let out = text.replace(VAR_RE, (_m, v: string) => {
    let val: string | null = null;
    if (v === 'xh') val = ctx.xh || 'mình';
    else if (v === 'ten_page') val = ctx.pageName;
    else if (v.startsWith('gia_')) val = priceOf(doc, v.slice(4)) || null;
    if (!val) {
      miss.push(v);
      return `{${v}}`;
    }
    return val;
  });
  // chữ đầu câu viết hoa (xưng hô "mình" đứng đầu câu)
  out = out.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
  return { out, miss };
}

function matchScore(keys: string, low: string): number {
  let c = 0;
  for (const k of keys.split(',')) {
    const t = k.trim().toLowerCase();
    if (t && low.includes(t)) c++;
  }
  return c;
}

const MAX_NODES = 60;

function runFlow(doc: BotDoc, flow: Flow, ctx: { xh: string; phone: boolean; pageName: string }, out: SimMessage[], log: string[], res: SimResult['result'], state: { last: string }, depth: number): 'ok' | 'stop' {
  state.last = flow.id;
  log.push(`Luồng: ${flow.code} ${flow.name}${flow.win === 'out' ? ' (ngoài 24 giờ)' : ''}`);
  let node: FlowNode | undefined = flow.nodes[0];
  const byId = (id?: string) => (id ? flow.nodes.find((n) => n.id === id) : undefined);
  const offers = offerTexts(doc);
  let guard = 0;
  while (node && guard++ < MAX_NODES) {
    if (node.t === 'msg') {
      const m = doc.lib.find((x) => x.id === node!.ref);
      if (!m) {
        out.push({ kind: 'system', text: 'Ô dùng câu mẫu đã bị xóa. Dừng và báo chị Hoa.' });
        Object.assign(res, { kind: 'blocked', note: 'Thiếu câu mẫu' });
        return 'stop';
      }
      const r = renderText(doc, m.text, { xh: ctx.xh, pageName: ctx.pageName });
      if (r.miss.length) {
        out.push({ kind: 'system', text: `Chặn câu ${m.code}: thiếu dữ liệu {${r.miss.join('}, {')}}. Agent không báo, dừng và báo chị Hoa.` });
        log.push(`Câu ${m.code}: bị chặn, thiếu ${r.miss.join(', ')}`);
        Object.assign(res, { kind: 'blocked', note: `Thiếu ${r.miss.join(', ')}` });
        return 'stop';
      }
      const flags = checkReply(r.out, offers, doc.banned);
      if (flags.length) {
        out.push({ kind: 'system', text: `Chặn câu ${m.code}: ${flags.map((f) => f.msg).join(' ')} Dừng và báo chị Hoa.` });
        log.push(`Câu ${m.code}: bị chặn (${flags.map((f) => f.code).join(', ')})`);
        Object.assign(res, { kind: 'blocked', note: flags[0].msg });
        return 'stop';
      }
      out.push({ kind: 'agent', text: r.out, buttons: (node.btns ?? []).filter((b) => b.label && b.to) });
      log.push(`Câu mẫu: ${m.code} (đạt kiểm tra giá)`);
      if (m.img) {
        const g = doc.media.find((x) => x.g === m.img);
        out.push({ kind: 'image', text: `Ảnh nhóm ${m.img}`, urls: g?.urls });
        log.push(`Ảnh: ${m.img}`);
      }
    } else if (node.t === 'img') {
      const g = doc.media.find((x) => x.g === node!.ref);
      out.push({ kind: 'image', text: `Ảnh nhóm ${node.ref}`, urls: g?.urls });
      log.push(`Ảnh: ${node.ref}`);
    } else if (node.t === 'cond') {
      const v = node.c === 'phone' ? ctx.phone : !!ctx.xh;
      log.push(`Điều kiện: ${node.c === 'phone' ? 'khách đã để số điện thoại' : 'đã biết giới tính'} → ${v ? 'có' : 'không'}`);
      node = byId(v ? node.yes : node.no);
      continue;
    } else if (node.t === 'jump') {
      const tf = doc.flows.find((x) => x.id === node!.to);
      if (!tf || depth > 4) return 'ok';
      log.push(`Chuyển luồng → ${tf.code}`);
      return runFlow(doc, tf, ctx, out, log, res, state, depth + 1);
    } else {
      out.push({ kind: 'system', text: `Chuyển chị Hoa: ${node.ref || 'cần người thật'}. Agent không trả lời khách thêm.` });
      log.push(`Chuyển chị Hoa: ${node.ref ?? ''}`);
      Object.assign(res, { kind: 'handoff', note: node.ref || 'cần người thật' });
      return 'stop';
    }
    node = byId(node.next);
  }
  return 'ok';
}

/**
 * Một lượt: khách nhắn chữ (agent chọn luồng, ở bản mô phỏng bằng từ khóa) hoặc khách bấm nút (chạy thẳng luồng của nút).
 * Chọn luồng chỉ trong: luồng "mở từ đầu" + các luồng được phép sau luồng vừa gửi. Ngoài đó thì dừng, báo chị.
 */
export function simulate(doc: BotDoc, input: { text?: string; flowId?: string; previewFlow?: string }, state: SimState, pageName: string): SimResult {
  const out: SimMessage[] = [];
  const log: string[] = [];
  const res: SimResult['result'] = { kind: 'nothing', note: '', flow: null };
  const next: SimState = { ...state };
  const ctx = { xh: state.xh, phone: state.phone, pageName };
  let flow: Flow | undefined;
  const last = { last: '' };
  if (input.previewFlow) {
    flow = doc.flows.find((f) => f.id === input.previewFlow);
    log.push('Xem thử luồng (không qua agent)');
  } else if (input.flowId) {
    flow = doc.flows.find((f) => f.id === input.flowId);
    log.push(`Khách bấm nút → ${flow?.code ?? '?'} (không cần agent chọn)`);
  } else {
    const low = (input.text ?? '').toLowerCase();
    const cur = state.cur ? doc.flows.find((f) => f.id === state.cur) : undefined;
    const cand = doc.flows.filter((f) => f.entry || (cur && cur.allow.includes(f.id)));
    log.push(`${cur ? `Vừa gửi: ${cur.code}. ` : 'Đầu hội thoại. '}Agent được chọn trong: ${cand.map((f) => f.code).join(', ') || '(không có)'}`);
    // Khớp ngang nhau thì ưu tiên luồng chuyển chị Hoa (an toàn trước), rồi luồng có ít từ khóa hơn (cụ thể hơn).
    let best = 0;
    for (const f of cand) {
      const m = matchScore(f.keys, low);
      if (!m) continue;
      const sc = m * 10 + (f.nodes.some((n) => n.t === 'handoff') ? 5 : 0);
      if (sc > best || (sc === best && flow && f.keys.split(',').length < flow.keys.split(',').length)) {
        best = sc;
        flow = f;
      }
    }
    if (flow) log.push(`Agent chọn ${flow.code} vì khớp từ khóa`);
  }
  if (!flow || !flow.nodes.length) {
    out.push({ kind: 'system', text: 'Ngoài kịch bản đã có. Agent dừng và báo chị Hoa, không đoán.' });
    log.push('Không có luồng nào được phép khớp', 'Kết quả: dừng, báo chị Hoa');
    Object.assign(res, { kind: 'out_of_script', note: 'Ngoài kịch bản' });
    next.cur = null;
  } else {
    res.flow = flow.code;
    const st = runFlow(doc, flow, ctx, out, log, res, last, 0);
    if (st === 'stop') next.cur = null;
    else {
      next.cur = last.last;
      Object.assign(res, { kind: 'sent', note: 'Đã gửi (thử)' });
    }
  }
  return { messages: out, log, result: res, state: next };
}

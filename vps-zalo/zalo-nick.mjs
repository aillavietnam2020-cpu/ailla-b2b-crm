#!/usr/bin/env node
// Zalo trong CRM, đợt 1 (chị Hoa duyệt 27/11/2026): giữ kết nối NHIỀU nick Zalo công việc cho web ABOS.
//
// Mỗi sale một nick Zalo công việc do công ty cấp (không dùng Zalo cá nhân). Chương trình này:
//   - Thêm nick bằng QR: web bấm "Quét QR" -> chương trình tạo mã, đẩy ảnh mã lên web, người dùng tự quét trên điện thoại.
//   - Lưu phiên đăng nhập MÃ HÓA (AES-256-GCM, khóa ZALO_NICK_KEY chỉ nằm trên VPS) ở /root/.config/zalo-nick/sessions.
//   - Nghe tin đến / đi (cả tin sale gõ trên điện thoại), tin bị thu hồi, khách đã xem; đẩy lên web /api/zalo-nick-relay/events.
//   - Tự nối lại khi rớt (giãn dần 30 giây -> 15 phút); rớt liên tục hoặc phiên hết hạn thì báo web "Cần quét lại QR".
//   - Chỉ gửi tin khi người trên web bấm Gửi (lệnh SEND). Trần chống khóa nick: tối đa 5 tin / 30 giây / nick.
//   KHÔNG có gửi tự động, gửi hàng loạt, tự kết bạn ở đợt này.
//
// Học cách làm từ ZL-CRM (github.com/nguyentatkiem/ZL-CRM, Apache 2.0: backend/src/modules/zalo/zalo-listener-factory.ts,
// zalo-pool.ts) — viết lại, không chép nguyên đoạn.
//
// Lệnh:
//   node zalo-nick.mjs key   -> in một khóa mã hóa mới (dán vào /root/.config/zalo-nick.env: ZALO_NICK_KEY=...)
//   node zalo-nick.mjs       -> chạy (dịch vụ zalo-nick.service)
// Biến môi trường: ABOS_URL, ABOS_RELAY_KEY (file chung /root/.config/abos-relay.env), ZALO_NICK_KEY (file riêng, quyền 600).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[2] === 'key') {
  console.log(crypto.randomBytes(32).toString('base64'));
  process.exit(0);
}

const ZCA =
  process.env.ZCA_PATH ||
  '/root/.openclaw/npm/projects/openclaw-zalouser-23f4f34fca/node_modules/@openclaw/zalouser/node_modules/zca-js/dist/index.js';
const DIR = process.env.ZNK_DIR || '/root/.config/zalo-nick';
const SESS = path.join(DIR, 'sessions');
const URL_BASE = (process.env.ABOS_URL || 'https://vanhanh.ailla.vn').replace(/\/$/, '');
const RELAY = process.env.ABOS_RELAY_KEY || '';
const KEY = Buffer.from(process.env.ZALO_NICK_KEY || '', 'base64');
const POLL_MS = 4000;
const SEND_MAX = 5; // tin
const SEND_WIN = 30_000; // ms
const log = (...a) => console.log(new Date().toISOString(), ...a);

if (!RELAY) {
  log('Thiếu ABOS_RELAY_KEY');
  process.exit(1);
}
if (KEY.length !== 32) {
  log('Thiếu ZALO_NICK_KEY (32 byte, base64). Tạo bằng: node zalo-nick.mjs key');
  process.exit(1);
}
fs.mkdirSync(SESS, { recursive: true, mode: 0o700 });
const { Zalo, ThreadType, LoginQRCallbackEventType: QE } = await import(pathToFileURL(ZCA).href);

/* ------------------------------------------------------------------ phiên đăng nhập mã hóa */
const sessFile = (id) => path.join(SESS, String(id).replace(/[^A-Za-z0-9_-]/g, '') + '.enc');
function saveSession(id, cred) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([c.update(JSON.stringify(cred), 'utf8'), c.final()]);
  const out = JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') });
  const tmp = sessFile(id) + '.tmp';
  fs.writeFileSync(tmp, out, { mode: 0o600 });
  fs.renameSync(tmp, sessFile(id));
}
function loadSession(id) {
  try {
    const j = JSON.parse(fs.readFileSync(sessFile(id), 'utf8'));
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(j.iv, 'base64'));
    d.setAuthTag(Buffer.from(j.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(j.data, 'base64')), d.final()]).toString('utf8'));
  } catch {
    return null;
  }
}
const hasSession = (id) => fs.existsSync(sessFile(id));
const delSession = (id) => fs.rmSync(sessFile(id), { force: true });

/* ------------------------------------------------------------------ gọi web */
async function web(method, p, body) {
  const r = await fetch(URL_BASE + '/api/zalo-nick-relay' + p, {
    method,
    headers: { 'X-Relay-Key': RELAY, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`web ${r.status} ${t.slice(0, 160)}`);
  return JSON.parse(t).data;
}
const state = (nick_id, status, extra = {}) => web('POST', '/state', { nick_id, status, ...extra }).catch((e) => log('Không báo được trạng thái', nick_id, e.message));

/* ------------------------------------------------------------------ từng nick */
/** id -> { api, uid, name, sends: number[], chain: Promise, closes: number[], retryAt, retryN, qr, buf: [] } */
const N = new Map();
const nick = (id) => {
  let n = N.get(id);
  if (!n) {
    n = { api: null, uid: '', name: '', sends: [], chain: Promise.resolve(), closes: [], retryAt: 0, retryN: 0, qr: false, starting: false, buf: [], evq: Promise.resolve(), info: new Map(), groups: new Map() };
    N.set(id, n);
  }
  return n;
};

function stopNick(id) {
  const n = N.get(id);
  if (!n || !n.api) return;
  n.stopping = true;
  try {
    n.api.listener.stop();
  } catch {}
  n.api = null;
}

/** Nội dung tin Zalo -> {kind, text, url}. */
function contentOf(msgType, c) {
  if (typeof c === 'string') return { kind: 'text', text: c, url: '' };
  const o = c && typeof c === 'object' ? c : {};
  const href = String(o.href || o.hdUrl || o.normalUrl || o.thumbUrl || o.thumb || '');
  const url = /^https:\/\//.test(href) ? href : '';
  const title = String(o.title || o.description || '').slice(0, 2000);
  const t = String(msgType || '');
  if (t === 'chat.photo') return { kind: 'image', text: title, url };
  if (t === 'chat.sticker') return { kind: 'sticker', text: '', url: '' };
  if (t === 'share.file') return { kind: 'file', text: title, url };
  if (t === 'chat.voice') return { kind: 'voice', text: '', url };
  if (t.startsWith('chat.video')) return { kind: 'video', text: title, url };
  if (t === 'chat.recommended' || t === 'chat.link') return { kind: 'link', text: title || href, url };
  return { kind: 'other', text: title, url };
}

async function userInfo(n, uid) {
  const c = n.info.get(uid);
  if (c && Date.now() - c.at < 3_600_000) return c;
  let v = { name: '', phone: '', avatar: '', at: Date.now() };
  try {
    const r = await n.api.getUserInfo(uid);
    const p = r?.changed_profiles?.[uid] || r?.changed_profiles?.[uid + '_0'];
    if (p) v = { name: p.zaloName || p.displayName || '', phone: p.phoneNumber || '', avatar: p.avatar || '', at: Date.now() };
  } catch {}
  n.info.set(uid, v);
  return v;
}
async function groupName(n, gid) {
  if (n.groups.has(gid)) return n.groups.get(gid);
  let v = { name: '', avatar: '' };
  try {
    const r = await n.api.getGroupInfo(gid);
    const g = r?.gridInfoMap?.[gid];
    if (g) v = { name: g.name || '', avatar: g.avt || g.fullAvt || '' };
  } catch {}
  n.groups.set(gid, v);
  return v;
}

function push(id, ev) {
  const n = nick(id);
  n.buf.push(ev);
  if (n.buf.length > 1000) n.buf.splice(0, n.buf.length - 1000);
}
let flushing = false;
async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    for (const [id, n] of N) {
      while (n.buf.length) {
        const batch = n.buf.slice(0, 40);
        try {
          await web('POST', '/events', { nick_id: id, events: batch });
          n.buf.splice(0, batch.length);
        } catch (e) {
          log('Chưa đẩy được tin lên web', id, e.message);
          break;
        }
      }
    }
  } finally {
    flushing = false;
  }
}
setInterval(flush, 1500);

function attach(id, api) {
  const n = nick(id);
  n.api = api;
  n.stopping = false;
  const L = api.listener;
  // Sự kiện xếp hàng theo đúng thứ tự đến (tin đọc tên người gửi mất chút thời gian; báo thu hồi không được đi trước tin).
  const q = (fn) => (n.evq = n.evq.then(fn).catch((e) => log('Lỗi sự kiện', id, e?.message || e)));
  L.on('message', (msg) => q(async () => {
    try {
      const d = msg.data || {};
      const isGroup = msg.type === ThreadType.Group;
      const threadId = String(msg.threadId || '');
      if (!threadId) return;
      const ct = contentOf(d.msgType, d.content);
      let thread_name = '';
      let avatar = '';
      let peer_phone = '';
      if (isGroup) {
        const g = await groupName(n, threadId);
        thread_name = g.name;
        avatar = g.avatar;
      } else {
        const u = await userInfo(n, threadId);
        thread_name = u.name || (!msg.isSelf ? d.dName || '' : '');
        avatar = u.avatar;
        peer_phone = u.phone;
      }
      push(id, {
        type: 'msg',
        thread_id: threadId,
        is_group: isGroup,
        thread_name,
        avatar,
        peer_phone,
        msg_id: String(d.msgId || ''),
        cli_msg_id: String(d.cliMsgId || ''),
        from_me: !!msg.isSelf,
        sender_uid: String(d.uidFrom || ''),
        sender_name: String(d.dName || ''),
        kind: ct.kind,
        text: ct.text,
        url: ct.url,
        at: Number(d.ts) || Date.now(),
      });
    } catch (e) {
      log('Lỗi đọc tin', id, e?.message || e);
    }
  }));
  // Thu hồi: chỉ báo mã tin, web giữ nguyên nội dung cũ.
  L.on('undo', (u) => q(() => {
    const c = u?.data?.content || {};
    push(id, { type: 'undo', thread_id: String(u?.threadId || ''), msg_id: String(c.globalMsgId || ''), cli_msg_id: String(c.cliMsgId || ''), at: Number(u?.data?.ts) || Date.now() });
  }));
  L.on('seen_messages', (list) => q(() => {
    const by = new Map();
    for (const s of list || []) {
      const t = String(s?.threadId || s?.data?.groupId || s?.data?.idTo || '');
      const m = String(s?.data?.msgId || s?.data?.realMsgId || '');
      if (!t || !m) continue;
      if (!by.has(t)) by.set(t, []);
      by.get(t).push(m);
    }
    for (const [t, ids] of by) push(id, { type: 'seen', thread_id: t, msg_ids: ids });
  }));
  L.on('error', (e) => log('Lỗi kết nối', id, e?.message || e));
  L.on('closed', (code, reason) => {
    if (n.stopping) return;
    n.api = null;
    const now = Date.now();
    n.closes = n.closes.filter((t) => now - t < 10 * 60_000).concat(now);
    log('Nick rớt', id, code, reason);
    if (code === 3000 || code === 3003) {
      // Nick đang mở Zalo Web ở máy khác: chờ lâu rồi mới nối lại, tránh đá qua đá lại.
      n.retryAt = now + 15 * 60_000;
      state(id, 'OFF', { note: 'Nick đang mở Zalo Web ở nơi khác. Máy thử nối lại sau 15 phút.' });
    } else if (n.closes.length >= 5) {
      n.retryAt = Infinity;
      state(id, 'NEED_QR', { note: 'Kết nối không ổn định (rớt 5 lần trong 10 phút). Quét lại QR.' });
    } else {
      n.retryN = Math.min(n.retryN + 1, 5);
      n.retryAt = now + [30, 60, 120, 300, 900][n.retryN - 1] * 1000;
      state(id, 'OFF', { note: 'Rớt kết nối, đang tự nối lại.' });
    }
  });
  L.start({ retryOnClose: true });
}

/** Nối lại bằng phiên đã lưu. */
async function startNick(id) {
  const n = nick(id);
  if (n.api || n.starting || n.qr || Date.now() < n.retryAt) return;
  const cred = loadSession(id);
  if (!cred) return;
  n.starting = true;
  try {
    const zalo = new Zalo({ selfListen: true, checkUpdate: false, logging: false });
    const api = await zalo.login(cred);
    attach(id, api);
    n.uid = String(await api.getOwnId());
    const me = await userInfo(n, n.uid);
    n.name = me.name;
    n.retryN = 0;
    await state(id, 'ON', { zalo_uid: n.uid, zalo_name: n.name });
    log('Đã nối nick', id, n.name);
  } catch (e) {
    n.retryN = Math.min(n.retryN + 1, 5);
    log('Nối nick không được', id, e?.message || e);
    if (n.retryN >= 3) {
      n.retryAt = Infinity;
      await state(id, 'NEED_QR', { note: 'Phiên đăng nhập hết hạn hoặc bị Zalo từ chối. Quét lại QR.' });
    } else {
      n.retryAt = Date.now() + [30, 120, 600][n.retryN - 1] * 1000;
      await state(id, 'OFF', { note: 'Chưa nối được, máy thử lại.' });
    }
  } finally {
    n.starting = false;
  }
}

/** Đăng nhập bằng QR: ảnh mã đẩy lên web để người dùng tự quét. */
async function loginQR(id) {
  const n = nick(id);
  if (n.qr) return;
  stopNick(id);
  n.qr = true;
  let expired = 0;
  let declined = false;
  const zalo = new Zalo({ selfListen: true, checkUpdate: false, logging: false });
  try {
    const api = await Promise.race([
      zalo.loginQR({}, async (ev) => {
        if (ev.type === QE.QRCodeGenerated) await state(id, 'QR', { qr_image: ev.data.image, note: 'Mã QR sẵn sàng' });
        else if (ev.type === QE.QRCodeExpired) {
          if (++expired > 4) ev.actions?.abort?.();
          else ev.actions?.retry?.();
        } else if (ev.type === QE.QRCodeScanned) await state(id, 'SCANNED', { note: 'Đã quét: ' + (ev.data?.display_name || '') });
        else if (ev.type === QE.QRCodeDeclined) {
          declined = true;
          await state(id, 'NEED_QR', { note: 'Điện thoại đã từ chối đăng nhập. Bấm Quét lại.' });
        } else if (ev.type === QE.GotLoginInfo) saveSession(id, { cookie: ev.data.cookie, imei: ev.data.imei, userAgent: ev.data.userAgent });
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Quá 4 phút chưa quét')), 4 * 60_000)),
    ]);
    if (!api) throw new Error('Chưa đăng nhập được');
    n.closes = [];
    n.retryN = 0;
    n.retryAt = 0;
    attach(id, api);
    n.uid = String(await api.getOwnId());
    const me = await userInfo(n, n.uid);
    n.name = me.name;
    await state(id, 'ON', { zalo_uid: n.uid, zalo_name: n.name });
    log('Đã thêm nick bằng QR', id, n.name);
    return true;
  } catch (e) {
    log('Đăng nhập QR không xong', id, e?.message || e);
    if (!declined) await state(id, 'NEED_QR', { note: expired > 4 ? 'Mã QR hết hạn nhiều lần. Bấm Quét lại.' : 'Chưa đăng nhập được: ' + String(e?.message || e).slice(0, 120) });
    return false;
  } finally {
    n.qr = false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Gửi một tin (người trên web đã bấm Gửi). Giữ trần 5 tin / 30 giây, mỗi tin cách nhau chút cho giống người gõ. */
async function sendCmd(c) {
  const n = nick(c.nick_id);
  if (!n.api) throw new Error('Nick chưa nối Zalo');
  for (;;) {
    const now = Date.now();
    n.sends = n.sends.filter((t) => now - t < SEND_WIN);
    if (n.sends.length < SEND_MAX) break;
    await sleep(SEND_WIN - (now - n.sends[0]) + 200);
  }
  const last = n.sends[n.sends.length - 1] || 0;
  const gap = 900 + Math.floor(Math.random() * 1100);
  if (Date.now() - last < gap) await sleep(gap - (Date.now() - last));
  let threadId = c.thread_id;
  let isGroup = !!c.is_group;
  let threadName = '';
  if (!threadId && c.to_phone) {
    const u = await n.api.findUser(String(c.to_phone));
    if (!u?.uid) throw new Error('Không tìm thấy Zalo của số ' + c.to_phone);
    threadId = String(u.uid);
    isGroup = false;
    threadName = u.display_name || u.zalo_name || '';
  }
  if (!threadId) throw new Error('Thiếu người nhận');
  n.sends.push(Date.now());
  const r = await n.api.sendMessage(String(c.text), threadId, isGroup ? ThreadType.Group : ThreadType.User);
  return { msg_id: String(r?.message?.msgId || ''), thread_id: threadId, thread_name: threadName, peer_phone: c.to_phone || '' };
}

async function doCmd(c) {
  try {
    if (c.kind === 'LOGIN_QR') {
      const ok = await loginQR(c.nick_id);
      await web('POST', `/cmd/${c.id}/done`, { ok, error: ok ? undefined : 'Chưa đăng nhập được' });
    } else if (c.kind === 'LOGOUT') {
      stopNick(c.nick_id);
      delSession(c.nick_id);
      N.delete(c.nick_id);
      await state(c.nick_id, 'STOPPED', { note: 'Đã đăng xuất, xóa phiên' });
      await web('POST', `/cmd/${c.id}/done`, { ok: true });
    } else if (c.kind === 'SEND') {
      const r = await sendCmd(c);
      await web('POST', `/cmd/${c.id}/done`, { ok: true, ...r });
      log('Đã gửi tin', c.nick_id);
    }
  } catch (e) {
    log('Lệnh lỗi', c.kind, c.nick_id, e?.message || e);
    await web('POST', `/cmd/${c.id}/done`, { ok: false, error: String(e?.message || e).slice(0, 250) }).catch(() => {});
  }
}

/* ------------------------------------------------------------------ vòng chính */
let busy = false;
let lastBeat = 0;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const r = await web('GET', '/poll');
    const live = new Set();
    for (const x of r.nicks || []) {
      live.add(x.id);
      if (x.disabled) {
        if (N.get(x.id)?.api) stopNick(x.id);
        continue;
      }
      if (hasSession(x.id)) startNick(x.id);
    }
    for (const id of [...N.keys()]) if (!live.has(id)) stopNick(id);
    for (const c of r.cmds || []) {
      const n = nick(c.nick_id);
      // Mỗi nick làm lệnh lần lượt; các nick khác nhau chạy song song.
      if (c.kind === 'LOGIN_QR') doCmd(c);
      else n.chain = n.chain.then(() => doCmd(c));
    }
    // 5 phút báo web một lần nick nào đang chạy (để web biết máy còn sống).
    if (Date.now() - lastBeat > 5 * 60_000) {
      lastBeat = Date.now();
      for (const [id, n] of N) if (n.api) state(id, 'ON', { zalo_uid: n.uid, zalo_name: n.name });
    }
  } catch (e) {
    log('Không hỏi được web:', e?.message || e);
  } finally {
    busy = false;
  }
}
log('Chạy zalo-nick, web', URL_BASE);
setInterval(tick, POLL_MS);
tick();
for (const s of ['SIGTERM', 'SIGINT'])
  process.on(s, async () => {
    for (const id of N.keys()) stopNick(id);
    await flush().catch(() => {});
    process.exit(0);
  });

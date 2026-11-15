#!/usr/bin/env node
// Trợ lý đặt hàng trong nhóm Zalo (phương án 1, chị Hoa duyệt 08/11/2026).
//
// Chạy bằng MỘT SỐ ZALO RIÊNG của công ty (SIM mới), KHÔNG dùng Zalo của CEO hay của sale:
// Zalo không cho tài khoản cá nhân chạy máy, bị khóa thì chỉ mất số trợ lý.
//
// Việc của chương trình (không có AI tự trả lời):
//   1. Nghe tin trong các nhóm số này được thêm vào, đẩy lên web ABOS (/api/zalo-relay/message).
//      Web quyết định: nhóm chưa được Điều phối bật thì bỏ qua; nhóm đã bật và tin giống đơn thì máy đọc, thành đơn chờ cho sale.
//      Web trả về câu "đã nhận" cố định thì chương trình gửi câu đó vào nhóm (tối đa 1 lần / 10 phút / nhóm).
//   2. Mỗi 20 giây hỏi web có tin nào cần gửi vào nhóm không (chỉ có khi người trên web bấm gửi ở đơn đã duyệt), gửi rồi báo lại.
//
// Lệnh:
//   node zalo-dat-hang.mjs login   -> tạo mã QR ở /root/.config/zalo-dat-hang/qr.png, quét bằng Zalo của SIM trợ lý.
//   node zalo-dat-hang.mjs         -> chạy (dịch vụ zalo-dat-hang.service).
// Biến môi trường (dùng chung file /root/.config/abos-relay.env): ABOS_URL, ABOS_RELAY_KEY.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ZCA =
  process.env.ZCA_PATH ||
  '/root/.openclaw/npm/projects/openclaw-zalouser-23f4f34fca/node_modules/@openclaw/zalouser/node_modules/zca-js/dist/index.js';
const DIR = process.env.ZDH_DIR || '/root/.config/zalo-dat-hang';
const CRED = path.join(DIR, 'cred.json');
const URL_BASE = (process.env.ABOS_URL || 'https://vanhanh.ailla.vn').replace(/\/$/, '');
const KEY = process.env.ABOS_RELAY_KEY || '';
const POLL_MS = 20_000;
const MAX_IMG = 1_450_000; // byte, web nhận tối đa ~1,5 MB

const { Zalo, ThreadType, LoginQRCallbackEventType } = await import(pathToFileURL(ZCA).href);
const log = (...a) => console.log(new Date().toISOString(), ...a);
fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });

const zalo = new Zalo({ selfListen: false, checkUpdate: false, logging: false });

if (process.argv[2] === 'login') {
  const qrPath = path.join(DIR, 'qr.png');
  await zalo.loginQR({ qrPath }, async (ev) => {
    if (ev.type === LoginQRCallbackEventType.QRCodeGenerated) {
      await ev.actions.saveToFile(qrPath);
      log('Đã tạo mã QR:', qrPath, '(hết hạn sau khoảng 1 phút)');
    } else if (ev.type === LoginQRCallbackEventType.QRCodeExpired) {
      log('Mã QR hết hạn, tạo mã mới');
      ev.actions.retry();
    } else if (ev.type === LoginQRCallbackEventType.QRCodeScanned) {
      log('Đã quét bởi:', ev.data.display_name, '- bấm Đồng ý đăng nhập trên điện thoại');
    } else if (ev.type === LoginQRCallbackEventType.QRCodeDeclined) {
      log('Điện thoại đã từ chối đăng nhập');
    } else if (ev.type === LoginQRCallbackEventType.GotLoginInfo) {
      fs.writeFileSync(CRED, JSON.stringify(ev.data), { mode: 0o600 });
      log('Đăng nhập xong, đã lưu', CRED);
    }
  });
  log('Xong. Giờ bật dịch vụ: systemctl --user enable --now zalo-dat-hang');
  process.exit(0);
}

if (!KEY) {
  log('Thiếu ABOS_RELAY_KEY');
  process.exit(1);
}
if (!fs.existsSync(CRED)) {
  log('Chưa đăng nhập Zalo trợ lý. Chạy: node zalo-dat-hang.mjs login');
  process.exit(1);
}

async function web(method, p, body) {
  const r = await fetch(URL_BASE + p, {
    method,
    headers: { 'X-Relay-Key': KEY, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`web ${r.status} ${t.slice(0, 160)}`);
  return JSON.parse(t).data;
}

const api = await zalo.login(JSON.parse(fs.readFileSync(CRED, 'utf8')));
log('Đã đăng nhập Zalo trợ lý');

const names = new Map();
async function groupName(id) {
  if (names.has(id)) return names.get(id);
  try {
    const r = await api.getGroupInfo(id);
    const n = r?.gridInfoMap?.[id]?.name ?? null;
    names.set(id, n);
    return n;
  } catch {
    return null;
  }
}

async function imageOf(content) {
  const href = content && typeof content === 'object' ? content.href || content.hdUrl || content.normalUrl : null;
  if (!href || !/^https?:\/\//.test(href)) return null;
  try {
    const r = await fetch(href, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_IMG) return null;
    const ct = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
    return { b64: buf.toString('base64'), mime: /^image\/(jpeg|png|webp)$/.test(ct) ? ct : 'image/jpeg' };
  } catch {
    return null;
  }
}

api.listener.on('message', async (msg) => {
  try {
    if (msg.isSelf) return;
    const isGroup = msg.type === ThreadType.Group;
    const d = msg.data || {};
    const c = d.content;
    let text = typeof c === 'string' ? c : null;
    let img = null;
    if (d.msgType === 'chat.photo') {
      img = await imageOf(c);
      text = (c && typeof c === 'object' && (c.title || c.description)) || null;
    }
    if (!text && !img) return;
    const r = await web('POST', '/api/zalo-relay/message', {
      thread_id: String(msg.threadId),
      thread_name: isGroup ? await groupName(String(msg.threadId)) : d.dName || null,
      is_group: isGroup,
      sender_name: d.dName || null,
      msg_id: String(d.msgId || d.cliMsgId || ''),
      text,
      image_b64: img?.b64,
      mime: img?.mime,
    });
    if (r?.action === 'reply' && r.text) {
      await api.sendMessage(String(r.text), String(msg.threadId), isGroup ? ThreadType.Group : ThreadType.User);
      log('Đã báo nhận đơn', msg.threadId);
    }
  } catch (e) {
    log('Lỗi xử lý tin:', e?.message || e);
  }
});

api.listener.on('closed', (code, reason) => {
  log('Zalo ngắt kết nối', code, reason, '- thoát để dịch vụ tự chạy lại');
  process.exit(code === 3000 ? 3 : 1); // 3000: số này đang mở Zalo web ở nơi khác
});
api.listener.on('error', (e) => log('Lỗi kết nối Zalo:', e?.message || e));
api.listener.start();

let busy = false;
setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    const box = await web('GET', '/api/zalo-relay/outbox');
    for (const m of box || []) {
      try {
        // Gửi vào nhóm (mã nhóm Zalo luôn là nhóm; nếu web lưu cuộc nhắn riêng thì thử kiểu cá nhân).
        try {
          await api.sendMessage(String(m.text), String(m.thread_id), ThreadType.Group);
        } catch {
          await api.sendMessage(String(m.text), String(m.thread_id), ThreadType.User);
        }
        await web('POST', `/api/zalo-relay/outbox/${m.id}/done`, { ok: true });
        log('Đã gửi đơn vào nhóm', m.thread_id);
      } catch (e) {
        await web('POST', `/api/zalo-relay/outbox/${m.id}/done`, { ok: false, error: String(e?.message || e) }).catch(() => {});
      }
    }
  } catch (e) {
    log('Không hỏi được web:', e?.message || e);
  } finally {
    busy = false;
  }
}, POLL_MS);

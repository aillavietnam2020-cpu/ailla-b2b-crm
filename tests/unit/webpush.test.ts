import { describe, expect, it } from 'vitest';
import { b64u, encryptPayload, okEndpoint, unb64u } from '../../src/server/services/webpush';
import { classify, inQuiet, normPrefs } from '../../src/server/services/pushDispatch';

const bs = (u: Uint8Array) => u as unknown as BufferSource;

/** Phía điện thoại giải mã (RFC 8291) để chắc nội dung mã hóa đúng chuẩn. */
async function decrypt(body: Uint8Array, uaKeys: CryptoKeyPair, authSecret: Uint8Array) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPub = body.slice(21, 21 + idlen);
  const ct = body.slice(21 + idlen);
  const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', uaKeys.publicKey));
  const asKey = await crypto.subtle.importKey('raw', bs(asPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaKeys.privateKey, 256));
  const hk = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) =>
    new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: bs(s), info: bs(info) }, await crypto.subtle.importKey('raw', bs(ikm), 'HKDF', false, ['deriveBits']), n * 8));
  const te = new TextEncoder();
  const info = new Uint8Array([...te.encode('WebPush: info\0'), ...uaPub, ...asPub]);
  const ikm = await hk(authSecret, shared, info, 32);
  const cek = await hk(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hk(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', bs(cek), 'AES-GCM', false, ['decrypt']);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bs(nonce) }, key, bs(ct)));
  expect(pt[pt.length - 1]).toBe(2);
  return new TextDecoder().decode(pt.slice(0, -1));
}

describe('thông báo đẩy', () => {
  it('mã hóa aes128gcm giải ra đúng nội dung', async () => {
    const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: b64u(await crypto.subtle.exportKey('raw', ua.publicKey)), auth: b64u(auth) };
    const msg = JSON.stringify({ title: '📋 Giao việc', body: 'Lead Content giao bạn việc "Dựng video"' });
    const body = await encryptPayload(sub, new TextEncoder().encode(msg));
    expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096);
    expect(await decrypt(body, ua, unb64u(sub.auth))).toBe(msg);
  });

  it('chỉ nhận máy chủ đẩy của trình duyệt lớn', () => {
    expect(okEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(okEndpoint('https://web.push.apple.com/QG')).toBe(true);
    expect(okEndpoint('https://evil.example.com/push')).toBe(false);
    expect(okEndpoint('http://fcm.googleapis.com/x')).toBe(false);
  });

  it('xếp loại thông báo theo nội dung chuông', () => {
    expect(classify('Chị Hoa giao bạn việc "A" · hạn 10/11', 'task:1')).toBe('giao');
    expect(classify('🔔 CEO nhắc lần 2: việc "A"', 'task:1')).toBe('nhac');
    expect(classify('Lead trả về sửa: đổi hook · TT-1', 'TT-1')).toBe('sua');
    expect(classify('Quỳnh nộp kết quả việc "A", chờ bạn duyệt', 'task:1')).toBe('duyet');
    expect(classify('💬 May nhắn riêng: chào', 'room:dm1')).toBe('tin');
  });

  it('giờ yên lặng 22:00–7:00 theo giờ Việt Nam', () => {
    const p = normPrefs({});
    const vn = (h: number) => Date.UTC(2026, 10, 8, (h - 7 + 24) % 24, 30);
    expect(inQuiet(p, vn(23))).toBe(true);
    expect(inQuiet(p, vn(6))).toBe(true);
    expect(inQuiet(p, vn(7))).toBe(false);
    expect(inQuiet(p, vn(14))).toBe(false);
    expect(inQuiet(normPrefs({ quiet: false }), vn(23))).toBe(false);
  });
});

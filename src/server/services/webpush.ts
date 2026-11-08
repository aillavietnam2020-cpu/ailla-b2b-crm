/**
 * Gửi thông báo đẩy chuẩn Web Push (RFC 8030 / 8291 mã hóa aes128gcm / 8292 VAPID) bằng WebCrypto của Worker,
 * không cần thư viện ngoài. Khóa riêng VAPID đặt bằng `wrangler secret put VAPID_JWK` (JWK P-256);
 * khóa công khai dưới đây trình duyệt dùng khi bật thông báo (đổi khóa thì mọi máy phải bật lại).
 */
export const VAPID_PUBLIC = 'BEdrsBLBz-s8RaY6XzFDH_fWCPhcixd3VRPpD4rXCSoobIZr9bTRIwAUmTnL-aDwY25Nx5AB4hCJ1_9qXb3Ay4o';
const SUBJECT = 'mailto:admin@ailla.vn';

export interface PushSub { endpoint: string; p256dh: string; auth: string }
export interface PushMsg { title: string; body: string; url?: string; tag?: string }

const enc = new TextEncoder();
const bs = (u: Uint8Array) => u as unknown as BufferSource;
export const b64u = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64u = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
};
const cat = (...a: Uint8Array[]) => {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of a) {
    out.set(x, o);
    o += x.length;
  }
  return out;
};
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey('raw', bs(ikm), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: bs(salt), info: bs(info) }, k, len * 8));
}

/** Mã hóa nội dung cho một máy (aes128gcm, một bản ghi). Trả thân yêu cầu gửi lên máy chủ đẩy của Google / Apple / Mozilla. */
export async function encryptPayload(sub: PushSub, plain: Uint8Array, saltIn?: Uint8Array, localKeys?: CryptoKeyPair): Promise<Uint8Array> {
  const uaPub = unb64u(sub.p256dh);
  const authSecret = unb64u(sub.auth);
  const local = localKeys ?? ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', bs(uaPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, cat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = saltIn ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', bs(cek), 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(nonce) }, key, bs(cat(plain, new Uint8Array([2])))));
  const head = new Uint8Array(21);
  head.set(salt, 0);
  new DataView(head.buffer).setUint32(16, 4096);
  head[20] = asPub.length;
  return cat(head, asPub, ct);
}

let SIGN: { jwk: string; key: CryptoKey } | null = null;
async function vapidAuth(endpoint: string, jwk: string): Promise<string> {
  if (!SIGN || SIGN.jwk !== jwk) {
    const j = JSON.parse(jwk) as JsonWebKey;
    SIGN = { jwk, key: await crypto.subtle.importKey('jwk', { ...j, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']) };
  }
  const aud = new URL(endpoint).origin;
  const h = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const p = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, SIGN.key, bs(enc.encode(h + '.' + p)));
  return `vapid t=${h}.${p}.${b64u(sig)}, k=${VAPID_PUBLIC}`;
}

/** Chỉ nhận máy chủ đẩy của các trình duyệt lớn (không cho web gửi yêu cầu tới địa chỉ lạ). */
export function okEndpoint(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && /(^|\.)(googleapis\.com|push\.apple\.com|mozilla\.com|mozaws\.net|notify\.windows\.com)$/.test(x.hostname);
  } catch {
    return false;
  }
}

/** Gửi một thông báo. Trả 'ok' | 'gone' (máy đã gỡ, xóa đăng ký) | 'err'. */
export async function sendPush(jwk: string, sub: PushSub, msg: PushMsg, urgent = true): Promise<'ok' | 'gone' | 'err'> {
  if (!okEndpoint(sub.endpoint)) return 'gone';
  try {
    const body = await encryptPayload(sub, enc.encode(JSON.stringify(msg)));
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuth(sub.endpoint, jwk),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: urgent ? 'high' : 'normal',
        ...(msg.tag ? { Topic: msg.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'ailla' } : {}),
      },
      body: bs(body),
    });
    if (r.status === 404 || r.status === 410) return 'gone';
    if (!r.ok) {
      console.error('[push] gui loi', r.status, (await r.text().catch(() => '')).slice(0, 200));
      return 'err';
    }
    return 'ok';
  } catch (e) {
    console.error('[push] gui loi', e);
    return 'err';
  }
}

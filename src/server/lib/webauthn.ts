/**
 * Xác nhận vân tay / Face ID (WebAuthn, khóa chỉ nằm trong điện thoại) cho chấm công chính chủ (CEO 10/11).
 * Đăng ký: điện thoại tạo cặp khóa, gửi khóa công khai (SPKI) — không cần đọc CBOR.
 * Mỗi lần chấm: điện thoại ký thử thách sau khi chủ máy quét vân tay / Face ID; máy chủ kiểm chữ ký bằng khóa công khai đã lưu.
 */
export const b64u = {
  enc(buf: ArrayBuffer | Uint8Array): string {
    const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (const x of u) s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(s: string): Uint8Array<ArrayBuffer> {
    const t = s.replace(/-/g, '+').replace(/_/g, '/');
    const b = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  },
};

/** rpId dùng chung cho mọi trang *.ailla.vn để khóa đăng ký ở vanhanh dùng được cả ở /chat/. */
export function rpIdOf(host: string): string {
  const h = host.split(':')[0].toLowerCase();
  return h === 'ailla.vn' || h.endsWith('.ailla.vn') ? 'ailla.vn' : h;
}

const originOk = (origin: string, rpId: string) => {
  try {
    const u = new URL(origin);
    const h = u.hostname.toLowerCase();
    if (rpId === 'localhost' || rpId === '127.0.0.1') return h === rpId;
    return u.protocol === 'https:' && (h === rpId || h.endsWith('.' + rpId));
  } catch {
    return false;
  }
};

type ClientData = { type?: string; challenge?: string; origin?: string };
function readClientData(cd: string): ClientData {
  try {
    return JSON.parse(new TextDecoder().decode(b64u.dec(cd))) as ClientData;
  } catch {
    return {};
  }
}

/** Kiểm dữ liệu trình duyệt gửi lên; trả câu lỗi hoặc null. */
export function kiemClientData(cd: string, type: 'webauthn.create' | 'webauthn.get', challenge: string, rpId: string): string | null {
  const c = readClientData(cd);
  if (c.type !== type) return 'Dữ liệu xác nhận không đúng loại';
  if (!c.challenge || c.challenge !== challenge) return 'Mã xác nhận đã hết hạn, bấm chấm lại';
  if (!c.origin || !originOk(c.origin, rpId)) return 'Trang chấm công không đúng địa chỉ';
  return null;
}

/** Cờ trong authenticatorData: có người chạm (UP) và đã xác minh vân tay / Face ID / mã máy (UV), đúng rpId. */
export async function kiemAuthData(ad: Uint8Array, rpId: string): Promise<string | null> {
  if (ad.length < 37) return 'Dữ liệu xác nhận bị thiếu';
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)));
  for (let i = 0; i < 32; i++) if (h[i] !== ad[i]) return 'Xác nhận không thuộc web Ailla';
  const f = ad[32];
  if (!(f & 0x01)) return 'Chưa chạm xác nhận trên máy';
  if (!(f & 0x04)) return 'Máy chưa xác minh vân tay / Face ID';
  return null;
}

/** Chữ ký ES256 của trình duyệt ở dạng DER; WebCrypto cần dạng r||s (64 byte). */
function derToRaw(der: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (der[0] !== 0x30) return der;
  let i = 2;
  const read = () => {
    if (der[i] !== 0x02) throw new Error('DER');
    const len = der[i + 1];
    let v = der.slice(i + 2, i + 2 + len);
    i += 2 + len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = read();
  const s = read();
  const o = new Uint8Array(64);
  o.set(r, 0);
  o.set(s, 32);
  return o;
}

/** Kiểm chữ ký lần chấm: ký trên authenticatorData || SHA-256(clientDataJSON). alg -7 (ES256) hoặc -257 (RS256). */
export async function kiemChuKy(pubSpki: string, alg: number, ad: Uint8Array, cd: string, sig: string): Promise<boolean> {
  try {
    const cdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', b64u.dec(cd)));
    const data = new Uint8Array(ad.length + cdHash.length);
    data.set(ad, 0);
    data.set(cdHash, ad.length);
    const spki = b64u.dec(pubSpki);
    if (alg === -7) {
      const key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(b64u.dec(sig)), data);
    }
    if (alg === -257) {
      const key = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u.dec(sig), data);
    }
    return false;
  } catch {
    return false;
  }
}

/** Thử thách mới (32 byte ngẫu nhiên). */
export const taoThuThach = () => b64u.enc(crypto.getRandomValues(new Uint8Array(32)));

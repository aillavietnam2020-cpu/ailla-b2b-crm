import { describe, expect, it } from 'vitest';
import { b64u, kiemAuthData, kiemChuKy, kiemClientData, rpIdOf } from '../../src/server/lib/webauthn';

/** r||s (64 byte) → DER, như chữ ký trình duyệt gửi lên. */
function rawToDer(raw: Uint8Array): Uint8Array {
  const part = (x: Uint8Array) => {
    let v = Array.from(x);
    while (v.length > 1 && v[0] === 0) v = v.slice(1);
    if (v[0] & 0x80) v = [0, ...v];
    return [0x02, v.length, ...v];
  };
  const body = [...part(raw.slice(0, 32)), ...part(raw.slice(32))];
  return new Uint8Array([0x30, body.length, ...body]);
}

async function authData(rpId: string, flags: number): Promise<Uint8Array> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)));
  const ad = new Uint8Array(37);
  ad.set(h, 0);
  ad[32] = flags;
  return ad;
}

describe('chấm công chính chủ: vân tay / Face ID', () => {
  it('rpId dùng chung cho *.ailla.vn', () => {
    expect(rpIdOf('vanhanh.ailla.vn')).toBe('ailla.vn');
    expect(rpIdOf('qt.ailla.vn')).toBe('ailla.vn');
    expect(rpIdOf('localhost')).toBe('localhost');
  });

  it('kiểm thử thách, loại, địa chỉ trang', () => {
    const cd = (o: object) => b64u.enc(new TextEncoder().encode(JSON.stringify(o)));
    expect(kiemClientData(cd({ type: 'webauthn.get', challenge: 'abc', origin: 'https://vanhanh.ailla.vn' }), 'webauthn.get', 'abc', 'ailla.vn')).toBeNull();
    expect(kiemClientData(cd({ type: 'webauthn.get', challenge: 'xyz', origin: 'https://vanhanh.ailla.vn' }), 'webauthn.get', 'abc', 'ailla.vn')).toMatch(/hết hạn/);
    expect(kiemClientData(cd({ type: 'webauthn.get', challenge: 'abc', origin: 'https://evil.com' }), 'webauthn.get', 'abc', 'ailla.vn')).toMatch(/địa chỉ/);
    expect(kiemClientData(cd({ type: 'webauthn.create', challenge: 'abc', origin: 'https://vanhanh.ailla.vn' }), 'webauthn.get', 'abc', 'ailla.vn')).toMatch(/loại/);
  });

  it('bắt buộc đã xác minh vân tay / Face ID (cờ UV)', async () => {
    expect(await kiemAuthData(await authData('ailla.vn', 0x05), 'ailla.vn')).toBeNull();
    expect(await kiemAuthData(await authData('ailla.vn', 0x01), 'ailla.vn')).toMatch(/vân tay/);
    expect(await kiemAuthData(await authData('khac.vn', 0x05), 'ailla.vn')).toMatch(/không thuộc/);
  });

  it('chữ ký ES256 đúng khóa thì qua, khóa máy khác thì không', async () => {
    const gen = () => crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
    const k = await gen();
    const other = await gen();
    const spki = b64u.enc(await crypto.subtle.exportKey('spki', k.publicKey));
    const ad = await authData('ailla.vn', 0x05);
    const cd = b64u.enc(new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get', challenge: 'c', origin: 'https://vanhanh.ailla.vn' })));
    const cdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', b64u.dec(cd)));
    const data = new Uint8Array([...ad, ...cdHash]);
    const sign = async (key: CryptoKey) => b64u.enc(rawToDer(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data))));
    expect(await kiemChuKy(spki, -7, ad, cd, await sign(k.privateKey))).toBe(true);
    expect(await kiemChuKy(spki, -7, ad, cd, await sign(other.privateKey))).toBe(false);
  });
});

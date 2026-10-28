import { describe, expect, it, vi } from 'vitest';

vi.mock('@server/lib/session', () => ({
  readSessionCookie: (h: Headers) => (h.get('Cookie') ? 'tok' : null),
  resolveSession: async () => ({ id: 'u1', role: 'CEO', status: 'ACTIVE', must_change_password: 0 }),
}));
vi.mock('@server/middleware/auth', () => ({ loadExtraPermissions: async () => [] }));

const { serveHub, hubBuildId } = await import('@server/hub/serve');

const HTML =
  '<title>Trang quản trị Ailla</title><script>let HOST_MODE="ops";let OPS_URL="";let ADMIN_URL="";\nconst BUILD_ID="123";</script>';
const env = { DB: {}, ADMIN_HOST: 'quantri.ailla.vn', OPS_HOST: 'vanhanh.ailla.vn' } as never;
const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers: { Cookie: 'x', ...headers } });

describe('Trang /hub/ giữ trong trình duyệt theo bản dựng', () => {
  it('lấy đúng số bản dựng', () => {
    expect(hubBuildId(HTML)).toBe('123');
  });

  it('lần đầu trả trang kèm ETag, lần sau cùng bản trả 304 không thân', async () => {
    const first = await serveHub(req('https://quantri.ailla.vn/hub/'), env, HTML);
    expect(first.status).toBe(200);
    expect(first.headers.get('Cache-Control')).toBe('private, no-cache');
    const etag = first.headers.get('ETag')!;
    expect(etag).toBe('"123-a"');
    const body = await first.text();
    expect(body).toContain('Ailla Quản trị');
    expect(body).toContain('let HOST_MODE="admin"');

    const again = await serveHub(req('https://quantri.ailla.vn/hub/', { 'If-None-Match': 'W/' + etag }), env, HTML);
    expect(again.status).toBe(304);
    expect(await again.text()).toBe('');

    // Địa chỉ vận hành có trang khác (HOST_MODE) nên ETag khác, không dùng nhầm bản quản trị.
    const ops = await serveHub(req('https://vanhanh.ailla.vn/hub/', { 'If-None-Match': etag }), env, HTML);
    expect(ops.status).toBe(200);
    expect(await ops.text()).toContain('let HOST_MODE="ops"');

    // Bản dựng mới thì tải lại đủ.
    const newer = await serveHub(req('https://quantri.ailla.vn/hub/', { 'If-None-Match': etag }), env, HTML.replace('"123"', '"124"'));
    expect(newer.status).toBe(200);
  });

  it('chưa đăng nhập thì vẫn chuyển về trang đăng nhập, không trả 304', async () => {
    const r = await serveHub(new Request('https://quantri.ailla.vn/hub/', { headers: { 'If-None-Match': '"123-a"' } }), env, HTML);
    expect(r.status).toBe(302);
  });

  it('/hub/build trả số bản dựng nhỏ gọn', async () => {
    const r = await serveHub(req('https://quantri.ailla.vn/hub/build'), env, HTML);
    expect(await r.json()).toEqual({ build: '123' });
  });
});
